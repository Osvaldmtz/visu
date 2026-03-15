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
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");

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
        if (postData.scheduled_at) {
          const d = new Date(postData.scheduled_at);
          setScheduleDate(d.toISOString().split("T")[0]);
          setScheduleTime(d.toISOString().split("T")[1].slice(0, 5));
        }
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

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    setLoading("SCHEDULE");
    const scheduledAt = `${scheduleDate}T${scheduleTime}:00Z`;
    const supabase = createClient();
    await supabase
      .from("posts")
      .update({ status: "SCHEDULED", caption, scheduled_at: scheduledAt })
      .eq("id", id);
    router.push("/dashboard");
    router.refresh();
  };

  const handleRegenerate = async () => {
    if (!brand) return;
    setLoading("REGENERATE");

    try {
      const logoSrc =
        post.layout <= 1
          ? brand.logo_light_url || brand.logo_url || ""
          : brand.logo_dark_url || brand.logo_light_url || brand.logo_url || "";
      const logoDataUrl = logoSrc ? await toDataUrl(logoSrc) : "";

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, layout: post.layout }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();

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

  const isScheduled = post.status === "SCHEDULED";
  const isPublished = post.status === "PUBLISHED";

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
            <span className="text-xs text-neutral-500 mb-4">
              Layout {post.layout} &middot; {post.status}
              {post.scheduled_at && (
                <> &middot; {new Date(post.scheduled_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</>
              )}
            </span>

            <label className="text-sm text-neutral-400 mb-2">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              disabled={isPublished}
              className="bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-accent mb-4 flex-1 disabled:opacity-50"
            />

            {/* Schedule section */}
            {!isPublished && (
              <div className="mb-4 p-4 bg-surface-light border border-surface-border rounded-lg">
                <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                  Programar publicacion
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-28 bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={handleSchedule}
                  disabled={!scheduleDate || !!loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  {loading === "SCHEDULE" ? "..." : isScheduled ? "Reprogramar" : "Programar"}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              {!isPublished && (
                <button
                  onClick={() => updateStatus("APPROVED")}
                  disabled={!!loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm"
                >
                  {loading === "APPROVED" ? "..." : "Aprobar"}
                </button>
              )}
              {!isPublished && (
                <button
                  onClick={handleRegenerate}
                  disabled={!!loading}
                  className="flex-1 bg-surface-light hover:bg-surface-border disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm border border-surface-border"
                >
                  {loading === "REGENERATE" ? "Regenerando..." : "Regenerar"}
                </button>
              )}
              {!isPublished && (
                <button
                  onClick={() => updateStatus("DISCARDED")}
                  disabled={!!loading}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 font-medium py-3 rounded-lg transition-colors text-sm"
                >
                  {loading === "DISCARDED" ? "..." : "Descartar"}
                </button>
              )}
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
