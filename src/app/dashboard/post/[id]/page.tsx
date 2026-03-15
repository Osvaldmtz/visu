"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toPng } from "html-to-image";
import { renderTemplate } from "@/components/templates";
import { toDataUrl } from "@/lib/image-utils";

export default function PostReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [post, setPost] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState("");
  const [regenData, setRegenData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: postData } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .single();
      if (postData) {
        setPost(postData);
        setCaption(postData.caption);
        const { data: brandData } = await supabase
          .from("brands")
          .select("*")
          .eq("id", postData.brand_id)
          .single();
        setBrand(brandData);
      }
    };
    load();
  }, [id]);

  const updateStatus = async (status: string) => {
    setLoading(status);
    const supabase = createClient();
    await supabase.from("posts").update({ status, caption }).eq("id", id);
    router.push("/dashboard");
    router.refresh();
  };

  const handleRegenerate = async () => {
    if (!brand) return;
    setLoading("REGENERATE");

    try {
      // Pre-load logo as data URL
      const logoSrc =
        post.layout <= 1
          ? brand.logo_light_url || brand.logo_url || ""
          : brand.logo_dark_url || brand.logo_light_url || brand.logo_url || "";
      const logoDataUrl = logoSrc ? await toDataUrl(logoSrc) : "";

      // Generate new content (includes Unsplash search server-side)
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, layout: post.layout }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();

      // Pre-load background photo as data URL if present
      let bgDataUrl = "";
      if (data.backgroundUrl) {
        bgDataUrl = await toDataUrl(data.backgroundUrl);
      }

      setRegenData({
        title: data.title ?? "",
        subtitle: data.subtitle ?? "",
        caption: data.caption ?? "",
        scheduledAt: data.scheduled_at ?? null,
        logoDataUrl,
        bgDataUrl,
      });
    } catch (e: any) {
      console.error("Regenerate error:", e);
      setLoading("");
    }
  };

  // When regenData is set, wait for paint then capture + upload
  useEffect(() => {
    if (!regenData || !brand || !post) return;
    let cancelled = false;

    const captureAndUpload = async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 800));

      if (cancelled || !canvasRef.current) {
        if (!cancelled) setLoading("");
        return;
      }

      try {
        const dataUrl = await toPng(canvasRef.current, {
          width: 1080,
          height: 1080,
          pixelRatio: 1,
          cacheBust: true,
        });

        const blobRes = await fetch(dataUrl);
        const blob = await blobRes.blob();

        const formData = new FormData();
        formData.append("file", blob, `post-${Date.now()}.png`);
        formData.append("brandId", brand.id);
        formData.append("layout", String(post.layout));
        formData.append("title", regenData.title);
        formData.append("caption", regenData.caption);
        formData.append("postId", post.id);
        formData.append("status", "DRAFT");
        if (regenData.scheduledAt) {
          formData.append("scheduled_at", regenData.scheduledAt);
        }

        const uploadRes = await fetch("/api/approve-post", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");

        setRegenData(null);
        router.push("/dashboard");
        router.refresh();
      } catch (e: any) {
        console.error("Regen capture error:", e);
        setRegenData(null);
        setLoading("");
      }
    };

    captureAndUpload();
    return () => { cancelled = true; };
  }, [regenData, brand, post, router]);

  if (!post || !brand) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-neutral-400 hover:text-white mb-6 block"
        >
          &larr; Back to dashboard
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-square bg-surface-light rounded-xl overflow-hidden border border-surface-border">
            {post.image_url && (
              <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
            )}
          </div>

          <div className="flex flex-col">
            <h2 className="text-xl font-bold mb-1">{post.title}</h2>
            <span className="text-xs text-neutral-500 mb-6">
              Layout {post.layout} &middot; {post.status}
            </span>

            <label className="text-sm text-neutral-400 mb-2">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={8}
              className="bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-accent mb-6 flex-1"
            />

            <div className="flex gap-3">
              <button
                onClick={() => updateStatus("APPROVED")}
                disabled={!!loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm"
              >
                {loading === "APPROVED" ? "..." : "Aprobar"}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={!!loading}
                className="flex-1 bg-surface-light hover:bg-surface-border disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm border border-surface-border"
              >
                {loading === "REGENERATE" ? "Regenerando..." : "Regenerar"}
              </button>
              <button
                onClick={() => updateStatus("DISCARDED")}
                disabled={!!loading}
                className="flex-1 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 font-medium py-3 rounded-lg transition-colors text-sm"
              >
                {loading === "DISCARDED" ? "..." : "Descartar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Off-screen canvas for regeneration */}
      {regenData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 1080,
            height: 1080,
            overflow: "hidden",
            pointerEvents: "none",
            opacity: 0,
            zIndex: -1,
          }}
          aria-hidden="true"
        >
          <div ref={canvasRef} style={{ width: 1080, height: 1080 }}>
            {renderTemplate(post.layout, {
              title: regenData.title,
              subtitle: regenData.subtitle,
              logoUrl: regenData.logoDataUrl,
              primaryColor: brand.primary_color ?? "#7C3DE3",
              backgroundUrl: regenData.bgDataUrl || undefined,
            })}
          </div>
        </div>
      )}
    </div>
  );
}
