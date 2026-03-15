"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { toPng } from "html-to-image";
import { useRouter } from "next/navigation";
import { renderTemplate } from "./templates";
import { toDataUrl } from "@/lib/image-utils";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  primary_color: string;
  active_layouts: number[];
  posts_per_week?: number;
}

interface PendingPost {
  layout: number;
  title: string;
  subtitle: string;
  caption: string;
  scheduledAt: string | null;
  logoDataUrl: string;
  bgDataUrl: string;
  backgroundUrl: string;
}

export default function AutoGenerate({
  brand,
  mode = "single",
  label,
}: {
  brand: Brand;
  mode?: "single" | "batch";
  label?: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState("");
  const [pendingRender, setPendingRender] = useState<PendingPost | null>(null);
  const [queue, setQueue] = useState<PendingPost[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const pickLayout = useCallback(() => {
    const layouts = brand.active_layouts ?? [0];
    return layouts[Math.floor(Math.random() * layouts.length)];
  }, [brand.active_layouts]);

  // Process one post from the render queue
  useEffect(() => {
    if (!pendingRender) return;
    let localCancelled = false;

    const captureAndUpload = async () => {
      setStatus("rendering");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 800));

      if (localCancelled || cancelledRef.current || !canvasRef.current) {
        if (!localCancelled && !cancelledRef.current) {
          setError("Canvas not found");
          setStatus("error");
        }
        return;
      }

      try {
        const dataUrl = await toPng(canvasRef.current, {
          width: 1080, height: 1080, pixelRatio: 1, cacheBust: true,
        });

        setStatus("uploading");
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        const formData = new FormData();
        formData.append("file", blob, `post-${Date.now()}.png`);
        formData.append("brandId", brand.id);
        formData.append("layout", String(pendingRender.layout));
        formData.append("title", pendingRender.title);
        formData.append("caption", pendingRender.caption);
        formData.append("status", "DRAFT");
        if (pendingRender.subtitle) formData.append("subtitle", pendingRender.subtitle);
        if (pendingRender.backgroundUrl) formData.append("background_url", pendingRender.backgroundUrl);
        if (pendingRender.scheduledAt) formData.append("scheduled_at", pendingRender.scheduledAt);

        const uploadRes = await fetch("/api/approve-post", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("Upload failed");

        setPendingRender(null);
        setProgress((p) => ({ ...p, current: p.current + 1 }));

        // Check if cancelled before processing next
        if (cancelledRef.current) {
          setStatus("done");
          router.refresh();
          setTimeout(() => setStatus("idle"), 1500);
          return;
        }

        setQueue((q) => {
          if (q.length > 0) {
            const [next, ...rest] = q;
            setTimeout(() => setPendingRender(next), 100);
            return rest;
          }
          setStatus("done");
          router.refresh();
          setTimeout(() => setStatus("idle"), 1500);
          return [];
        });
      } catch (e: any) {
        console.error("Auto-generate error:", e);
        setError(e.message);
        setStatus("error");
        setPendingRender(null);
        setQueue([]);
      }
    };

    captureAndUpload();
    return () => { localCancelled = true; };
  }, [pendingRender, brand.id, router]);

  const generateOnePost = async (logoDataUrl: string, layout: number): Promise<PendingPost> => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: brand.id, layout }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Generation failed");
    }
    const data = await res.json();

    let bgDataUrl = "";
    const backgroundUrl = data.backgroundUrl ?? "";
    if (backgroundUrl) bgDataUrl = await toDataUrl(backgroundUrl);

    return {
      layout,
      title: data.title ?? "",
      subtitle: data.subtitle ?? "",
      caption: data.caption ?? "",
      scheduledAt: data.scheduled_at ?? null,
      logoDataUrl,
      bgDataUrl,
      backgroundUrl,
    };
  };

  const handleGenerate = async () => {
    cancelledRef.current = false;
    setStatus("generating");
    setError("");

    // posts_per_week × 4 weeks = total posts for the month
    const totalPosts = mode === "batch" ? (brand.posts_per_week ?? 1) * 4 : 1;
    setProgress({ current: 0, total: totalPosts });

    try {
      // Pre-load logos for both variants
      const lightLogo = brand.logo_light_url || brand.logo_url || "";
      const darkLogo = brand.logo_dark_url || brand.logo_light_url || brand.logo_url || "";
      const [lightDataUrl, darkDataUrl] = await Promise.all([
        lightLogo ? toDataUrl(lightLogo) : Promise.resolve(""),
        darkLogo ? toDataUrl(darkLogo) : Promise.resolve(""),
      ]);

      // Generate all posts content sequentially (respects topic dedup + cancel)
      const posts: PendingPost[] = [];
      for (let i = 0; i < totalPosts; i++) {
        if (cancelledRef.current) break;
        setStatus(`generating ${i + 1}/${totalPosts}`);
        const layout = pickLayout();
        const logoDataUrl = layout <= 1 ? lightDataUrl : darkDataUrl;
        const post = await generateOnePost(logoDataUrl, layout);
        posts.push(post);
      }

      if (cancelledRef.current && posts.length === 0) {
        setStatus("idle");
        return;
      }

      // Update total to actual generated count (may be less if cancelled)
      setProgress({ current: 0, total: posts.length });

      // Start rendering pipeline
      const [first, ...rest] = posts;
      setQueue(rest);
      setPendingRender(first);
    } catch (e: any) {
      console.error("Generate error:", e);
      setError(e.message);
      setStatus("error");
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    setQueue([]);
    // Let current in-flight post finish, then stop
  };

  const isWorking = status !== "idle" && status !== "done" && status !== "error";

  const buttonLabel = isWorking
    ? status.startsWith("generating")
      ? `Generando ${progress.current}/${progress.total}...`
      : status === "rendering"
      ? `Renderizando ${progress.current + 1}/${progress.total}...`
      : status === "uploading"
      ? `Guardando ${progress.current + 1}/${progress.total}...`
      : "Procesando..."
    : status === "done"
    ? `${progress.total} post${progress.total > 1 ? "s" : ""} creado${progress.total > 1 ? "s" : ""}`
    : label ?? (mode === "batch" ? "Generar parrilla" : "Crear post");

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={isWorking}
        className={`disabled:opacity-50 font-medium px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2 ${
          mode === "batch"
            ? "bg-accent hover:bg-accent/90 text-white"
            : "bg-surface-light hover:bg-surface-border text-neutral-300 border border-surface-border"
        }`}
      >
        {isWorking && (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {buttonLabel}
      </button>

      {isWorking && (
        <button
          onClick={handleCancel}
          className="text-xs text-red-400 hover:text-red-300 px-3 py-2 transition-colors"
        >
          Cancelar
        </button>
      )}

      {status === "error" && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {pendingRender && (
        <div
          style={{ position: "fixed", top: 0, left: 0, width: 1080, height: 1080, overflow: "hidden", pointerEvents: "none", opacity: 0, zIndex: -1 }}
          aria-hidden="true"
        >
          <div ref={canvasRef} style={{ width: 1080, height: 1080 }}>
            {renderTemplate(pendingRender.layout, {
              title: pendingRender.title,
              subtitle: pendingRender.subtitle,
              logoUrl: pendingRender.logoDataUrl,
              primaryColor: brand.primary_color ?? "#7C3DE3",
              backgroundUrl: pendingRender.bgDataUrl || undefined,
            })}
          </div>
        </div>
      )}
    </div>
  );
}
