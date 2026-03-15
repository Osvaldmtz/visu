"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toPng } from "html-to-image";
import { renderTemplate, type ElementPositions } from "@/components/templates";
import { toDataUrl } from "@/lib/image-utils";

export default function PostReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const exportRef = useRef<HTMLDivElement>(null);
  const regenCanvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [post, setPost] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState("");
  const [regenData, setRegenData] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scale, setScale] = useState(0.5);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [bgDataUrl, setBgDataUrl] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [interactive, setInteractive] = useState(false);
  const [hasDragChanges, setHasDragChanges] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [positions, setPositions] = useState<ElementPositions>({});

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
        if (postData.element_positions) {
          setPositions(postData.element_positions);
        }
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

        if (brandData && postData.title) {
          const logoSrc =
            postData.layout <= 1
              ? brandData.logo_light_url || brandData.logo_url || ""
              : brandData.logo_dark_url || brandData.logo_light_url || brandData.logo_url || "";
          if (logoSrc) toDataUrl(logoSrc).then(setLogoDataUrl);
          if (postData.background_url) toDataUrl(postData.background_url).then(setBgDataUrl);
          setInteractive(true);
        }
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const update = () => {
      if (wrapperRef.current) setScale(wrapperRef.current.offsetWidth / 1080);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [interactive]);

  const handlePositionChange = useCallback((elementId: string, x: number, y: number) => {
    setPositions((prev) => ({ ...prev, [elementId]: { x, y } }));
  }, []);

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

  // Capture the off-screen export canvas (full 1080x1080, no transform)
  const captureExport = useCallback(async (): Promise<Blob | null> => {
    if (!exportRef.current) return null;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 500));

    const dataUrl = await toPng(exportRef.current, {
      width: 1080,
      height: 1080,
      pixelRatio: 1,
      cacheBust: true,
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  }, []);

  const handleSavePosition = useCallback(async () => {
    if (!brand || !post) return;
    setSavingPosition(true);

    try {
      const blob = await captureExport();
      if (!blob) throw new Error("Export failed");

      const formData = new FormData();
      formData.append("file", blob, `post-${Date.now()}.png`);
      formData.append("brandId", brand.id);
      formData.append("layout", String(post.layout));
      formData.append("title", post.title);
      formData.append("caption", caption);
      formData.append("postId", post.id);
      formData.append("status", post.status);
      if (post.subtitle) formData.append("subtitle", post.subtitle);
      if (post.background_url) formData.append("background_url", post.background_url);

      const uploadRes = await fetch("/api/approve-post", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Save failed");

      const result = await uploadRes.json();

      // Save positions to DB
      const supabase = createClient();
      await supabase.from("posts").update({ element_positions: positions }).eq("id", post.id);

      setPost({ ...post, image_url: result.imageUrl, element_positions: positions });
      setHasDragChanges(false);
    } catch (e: any) {
      console.error("Save position error:", e);
    } finally {
      setSavingPosition(false);
    }
  }, [brand, post, caption, positions, captureExport]);

  const handleApproveWithExport = useCallback(async () => {
    if (!brand || !post) return;
    setLoading("APPROVED");

    try {
      const blob = await captureExport();
      if (!blob) throw new Error("Export failed");

      const formData = new FormData();
      formData.append("file", blob, `post-${Date.now()}.png`);
      formData.append("brandId", brand.id);
      formData.append("layout", String(post.layout));
      formData.append("title", post.title);
      formData.append("caption", caption);
      formData.append("postId", post.id);
      formData.append("status", "APPROVED");
      if (post.subtitle) formData.append("subtitle", post.subtitle);
      if (post.background_url) formData.append("background_url", post.background_url);
      if (scheduleDate) formData.append("scheduled_at", `${scheduleDate}T${scheduleTime}:00Z`);

      const uploadRes = await fetch("/api/approve-post", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // Save positions
      const supabase = createClient();
      await supabase.from("posts").update({ element_positions: positions }).eq("id", post.id);

      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      console.error("Approve export error:", e);
      setLoading("");
    }
  }, [brand, post, caption, scheduleDate, scheduleTime, positions, captureExport, router]);

  const handleRegenerate = async () => {
    if (!brand) return;
    setLoading("REGENERATE");

    try {
      const logoSrc =
        post.layout <= 1
          ? brand.logo_light_url || brand.logo_url || ""
          : brand.logo_dark_url || brand.logo_light_url || brand.logo_url || "";
      const logoDataUrlNew = logoSrc ? await toDataUrl(logoSrc) : "";

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, layout: post.layout }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();

      let bgDataUrlNew = "";
      if (data.backgroundUrl) bgDataUrlNew = await toDataUrl(data.backgroundUrl);

      setRegenData({
        title: data.title ?? "",
        subtitle: data.subtitle ?? "",
        caption: data.caption ?? "",
        scheduledAt: data.scheduled_at ?? null,
        logoDataUrl: logoDataUrlNew,
        bgDataUrl: bgDataUrlNew,
        backgroundUrl: data.backgroundUrl ?? "",
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

      if (cancelled || !regenCanvasRef.current) {
        if (!cancelled) setLoading("");
        return;
      }

      try {
        const dataUrl = await toPng(regenCanvasRef.current, {
          width: 1080, height: 1080, pixelRatio: 1, cacheBust: true,
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
        if (regenData.subtitle) formData.append("subtitle", regenData.subtitle);
        if (regenData.backgroundUrl) formData.append("background_url", regenData.backgroundUrl);
        if (regenData.scheduledAt) formData.append("scheduled_at", regenData.scheduledAt);

        const uploadRes = await fetch("/api/approve-post", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("Upload failed");

        // Reset positions on regen
        const supabase = createClient();
        await supabase.from("posts").update({ element_positions: {} }).eq("id", post.id);

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

  const baseTemplateProps = {
    title: post.title,
    subtitle: post.subtitle ?? "",
    logoUrl: logoDataUrl || "",
    primaryColor: brand.primary_color ?? "#7C3DE3",
    backgroundUrl: bgDataUrl || undefined,
  };

  const previewProps = {
    ...baseTemplateProps,
    draggable: true,
    scale,
    onDragChange: () => setHasDragChanges(true),
    positions,
    onPositionChange: handlePositionChange,
  };

  // Export props: same positions but no draggable, no scale
  const exportProps = {
    ...baseTemplateProps,
    positions,
  };

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
          <div>
            {interactive && !isPublished ? (
              <div
                ref={wrapperRef}
                className="relative bg-neutral-900 rounded-xl overflow-hidden border border-surface-border"
                style={{ aspectRatio: "1/1" }}
              >
                <div
                  key={resetKey}
                  style={{
                    width: 1080,
                    height: 1080,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                >
                  {renderTemplate(post.layout, previewProps)}
                </div>
              </div>
            ) : (
              <div className="aspect-square bg-surface-light rounded-xl overflow-hidden border border-surface-border">
                {post.image_url && (
                  <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
                )}
              </div>
            )}
            {interactive && !isPublished && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {hasDragChanges && (
                  <button
                    onClick={handleSavePosition}
                    disabled={savingPosition}
                    className="text-xs bg-accent hover:bg-accent/90 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    {savingPosition ? "Guardando..." : "Guardar posicion"}
                  </button>
                )}
                <button
                  onClick={() => { setResetKey((k) => k + 1); setPositions({}); setHasDragChanges(false); }}
                  className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 border border-surface-border rounded-lg transition-colors"
                >
                  Resetear posicion
                </button>
                <span className="text-xs text-neutral-500 flex items-center">
                  Arrastra los elementos para moverlos
                </span>
              </div>
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

            {!isPublished && (
              <div className="mb-4 p-4 bg-surface-light border border-surface-border rounded-lg">
                <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                  Programar publicacion
                </label>
                <div className="flex gap-2 mb-3">
                  <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                  <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-28 bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
                </div>
                <button onClick={handleSchedule} disabled={!scheduleDate || !!loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
                  {loading === "SCHEDULE" ? "..." : isScheduled ? "Reprogramar" : "Programar"}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              {!isPublished && (
                <button onClick={interactive ? handleApproveWithExport : () => updateStatus("APPROVED")} disabled={!!loading} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm">
                  {loading === "APPROVED" ? "Exportando..." : "Aprobar y publicar"}
                </button>
              )}
              {!isPublished && (
                <button onClick={handleRegenerate} disabled={!!loading} className="flex-1 bg-surface-light hover:bg-surface-border disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm border border-surface-border">
                  {loading === "REGENERATE" ? "Regenerando..." : "Regenerar"}
                </button>
              )}
              {!isPublished && (
                <button onClick={() => updateStatus("DISCARDED")} disabled={!!loading} className="flex-1 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 font-medium py-3 rounded-lg transition-colors text-sm">
                  {loading === "DISCARDED" ? "..." : "Descartar"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Off-screen export canvas: full 1080x1080, NO transform, same positions */}
      {interactive && !isPublished && (
        <div style={{ position: "fixed", left: -9999, top: -9999, width: 1080, height: 1080, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
          <div ref={exportRef} style={{ width: 1080, height: 1080 }}>
            {renderTemplate(post.layout, exportProps)}
          </div>
        </div>
      )}

      {/* Off-screen canvas for regeneration */}
      {regenData && (
        <div style={{ position: "fixed", left: -9999, top: -9999, width: 1080, height: 1080, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
          <div ref={regenCanvasRef} style={{ width: 1080, height: 1080 }}>
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
