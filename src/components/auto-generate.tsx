"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { toPng } from "html-to-image";
import { useRouter } from "next/navigation";
import { renderTemplate } from "./templates";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  primary_color: string;
  active_layouts: number[];
}

export default function AutoGenerate({ brand }: { brand: Brand }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "rendering" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [pendingRender, setPendingRender] = useState<{
    layout: number;
    title: string;
    subtitle: string;
    caption: string;
    scheduledAt: string | null;
  } | null>(null);

  // Pick layout — cycle through active layouts, default to 0
  const pickLayout = useCallback(() => {
    const layouts = brand.active_layouts ?? [0];
    // Pick randomly from active layouts, but avoid 1 and 3 (need photos)
    const safe = layouts.filter((l) => l === 0 || l === 2);
    if (safe.length > 0) return safe[Math.floor(Math.random() * safe.length)];
    return layouts[0] ?? 0;
  }, [brand.active_layouts]);

  const logoUrl = useCallback(
    (layout: number) =>
      layout <= 1
        ? brand.logo_light_url || brand.logo_url || ""
        : brand.logo_dark_url || brand.logo_light_url || brand.logo_url || "",
    [brand]
  );

  // When pendingRender is set, wait for React to paint the template, then capture + upload
  useEffect(() => {
    if (!pendingRender) return;

    const captureAndUpload = async () => {
      setStatus("rendering");

      // Wait for React to paint the template into the DOM
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Extra delay for fonts/images to load
      await new Promise((r) => setTimeout(r, 300));

      if (!canvasRef.current) {
        setError("Canvas not found");
        setStatus("error");
        return;
      }

      try {
        const dataUrl = await toPng(canvasRef.current, {
          width: 1080,
          height: 1080,
          pixelRatio: 1,
          cacheBust: true,
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
        if (pendingRender.scheduledAt) {
          formData.append("scheduled_at", pendingRender.scheduledAt);
        }

        const uploadRes = await fetch("/api/approve-post", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "Upload failed");
        }

        setStatus("done");
        setPendingRender(null);
        router.refresh();

        // Reset to idle after a moment
        setTimeout(() => setStatus("idle"), 1500);
      } catch (e: any) {
        console.error("Auto-generate error:", e);
        setError(e.message);
        setStatus("error");
        setPendingRender(null);
      }
    };

    captureAndUpload();
  }, [pendingRender, brand.id, router]);

  const handleGenerate = async () => {
    setStatus("generating");
    setError("");

    const layout = pickLayout();

    try {
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

      // Set pending render — this triggers the useEffect to capture + upload
      setPendingRender({
        layout,
        title: data.title ?? "",
        subtitle: data.subtitle ?? "",
        caption: data.caption ?? "",
        scheduledAt: data.scheduled_at ?? null,
      });
    } catch (e: any) {
      console.error("Generate error:", e);
      setError(e.message);
      setStatus("error");
    }
  };

  const statusMessages: Record<string, string> = {
    generating: "Generando contenido con IA...",
    rendering: "Renderizando imagen...",
    uploading: "Guardando post...",
    done: "Post creado",
  };

  const isWorking = status === "generating" || status === "rendering" || status === "uploading";

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={isWorking}
        className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
      >
        {isWorking && (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {isWorking
          ? statusMessages[status]
          : status === "done"
          ? "Post creado"
          : "Generar parrilla"}
      </button>

      {status === "error" && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}

      {/* Off-screen canvas for rendering the template */}
      {pendingRender && (
        <div
          style={{
            position: "fixed",
            left: "-9999px",
            top: "-9999px",
            width: 1080,
            height: 1080,
            overflow: "hidden",
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          <div ref={canvasRef} style={{ width: 1080, height: 1080 }}>
            {renderTemplate(pendingRender.layout, {
              title: pendingRender.title,
              subtitle: pendingRender.subtitle,
              logoUrl: logoUrl(pendingRender.layout),
              primaryColor: brand.primary_color ?? "#7C3DE3",
            })}
          </div>
        </div>
      )}
    </>
  );
}
