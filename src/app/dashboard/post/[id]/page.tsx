"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toPng } from "html-to-image";
import { renderTemplate, type OverlayFilter } from "@/components/templates";
import { toDataUrl } from "@/lib/image-utils";
import { FORMATS, type PostFormat } from "@/lib/formats";

export default function PostReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const regenCanvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [post, setPost] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
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
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [savingPosition, setSavingPosition] = useState(false);
  const [publishedMessage, setPublishedMessage] = useState("");
  const [publishError, setPublishError] = useState("");
  const [igEnabled, setIgEnabled] = useState(true);
  const [fbEnabled, setFbEnabled] = useState(true);
  const [aiSuggestion, setAiSuggestion] = useState<{ days?: number[]; time?: string; reason?: string } | null>(null);
  const [showManualDate, setShowManualDate] = useState(false);
  const [suggestedLabel, setSuggestedLabel] = useState("");
  const [overlayFilter, setOverlayFilter] = useState<OverlayFilter>("purple");
  const [cardOpacity, setCardOpacity] = useState(0.9);
  const [postFormat, setPostFormat] = useState<PostFormat>("square");

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
        setTitle(postData.title || "");
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

        // Fetch AI schedule recommendation
        if (brandData && !postData.scheduled_at) {
          fetch("/api/recommend-schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brandId: brandData.id }),
          })
            .then((r) => r.ok ? r.json() : null)
            .then((rec) => {
              if (!rec?.days || !rec?.time) return;
              setAiSuggestion(rec);
              // Find the next occurrence of a suggested day
              const now = new Date();
              for (let offset = 1; offset < 30; offset++) {
                const candidate = new Date(now);
                candidate.setDate(candidate.getDate() + offset);
                const jsDay = candidate.getDay();
                const isoDay = jsDay === 0 ? 7 : jsDay;
                if (rec.days.includes(isoDay)) {
                  const dateStr = candidate.toISOString().split("T")[0];
                  setScheduleDate(dateStr);
                  setScheduleTime(rec.time);
                  const dayNames = ["", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
                  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
                  setSuggestedLabel(`${dayNames[isoDay]} ${candidate.getDate()} ${months[candidate.getMonth()]} · ${rec.time}`);
                  break;
                }
              }
            })
            .catch(() => {});
        }

        // Load saved positions
        if (postData.positions) {
          setPositions(postData.positions);
        }
        setOverlayFilter((postData.overlay_filter ?? "purple") as OverlayFilter);
        setCardOpacity(postData.card_opacity ?? 0.9);
        setPostFormat((postData.format ?? "square") as PostFormat);

        // If post has template data, enable interactive mode
        if (brandData && postData.title) {
          const logoSrc =
            postData.layout <= 1
              ? brandData.logo_light_url || brandData.logo_url || ""
              : brandData.logo_dark_url || brandData.logo_light_url || brandData.logo_url || "";
          if (logoSrc) {
            toDataUrl(logoSrc).then(setLogoDataUrl);
          }
          if (postData.background_url) {
            toDataUrl(postData.background_url).then(setBgDataUrl);
          }
          setInteractive(true);
        }
      }
    };
    load();
  }, [id]);

  // Scale the preview to fit the wrapper
  useEffect(() => {
    const update = () => {
      if (wrapperRef.current) {
        setScale(wrapperRef.current.offsetWidth / 1080);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [interactive]);

  const updateStatus = async (status: string) => {
    setLoading(status);
    const supabase = createClient();
    await supabase.from("posts").update({ status, caption }).eq("id", id);
    router.push("/dashboard");
    router.refresh();
  };

  const handleDiscard = async () => {
    if (!post) return;
    setLoading("DISCARDED");
    const supabase = createClient();

    // Delete PNG from Storage
    if (post.image_url && post.image_url.includes("/storage/v1/object/public/posts/")) {
      const path = post.image_url.split("/storage/v1/object/public/posts/")[1];
      if (path) {
        await supabase.storage.from("posts").remove([decodeURIComponent(path)]);
      }
    }

    // Delete topic so it becomes available again
    if (post.title) {
      await supabase.from("post_topics").delete().eq("brand_id", post.brand_id).eq("topic", post.title);
    }

    // Delete post record
    await supabase.from("posts").delete().eq("id", post.id);

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

  const handleUnschedule = async () => {
    setLoading("UNSCHEDULE");
    const supabase = createClient();
    await supabase
      .from("posts")
      .update({ status: "APPROVED", scheduled_at: null })
      .eq("id", id);
    router.push("/dashboard");
    router.refresh();
  };

  const handlePublishNow = async () => {
    if (!post) return;
    setPublishError("");
    setPublishedMessage("");

    if (!post.image_url) {
      setPublishError("El post no tiene imagen. Genera o sube una imagen primero.");
      return;
    }

    setLoading("PUBLISH");
    try {
      // Save caption + title first
      const supabase = createClient();
      await supabase.from("posts").update({ caption, title }).eq("id", id);

      const res = await fetch("/api/publish-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, publishNow: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      setPublishedMessage("Publicado en Instagram y Facebook");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch (e: any) {
      console.error("Publish error:", e);
      setPublishError(e.message || "Error desconocido al publicar");
      setLoading("");
    }
  };

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
        body: JSON.stringify({ brandId: brand.id, layout: post.layout, format: postFormat }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();

      let bgDataUrlNew = "";
      if (data.backgroundUrl) {
        bgDataUrlNew = await toDataUrl(data.backgroundUrl);
      }

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

  // Save position: re-export PNG with new drag positions, keep current status
  const handleSavePosition = useCallback(async () => {
    if (!canvasRef.current || !brand || !post) return;
    setSavingPosition(true);

    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 400));

      const dataUrl = await toPng(canvasRef.current, {
        width: 1080,
        height: canvasHeight,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: "none" },
      });

      const blobRes = await fetch(dataUrl);
      const blob = await blobRes.blob();

      const formData = new FormData();
      formData.append("file", blob, `post-${Date.now()}.png`);
      formData.append("brandId", brand.id);
      formData.append("layout", String(post.layout));
      formData.append("title", title);
      formData.append("caption", caption);
      formData.append("postId", post.id);
      formData.append("status", post.status);
      if (post.subtitle) formData.append("subtitle", post.subtitle);
      if (post.background_url) formData.append("background_url", post.background_url);
      if (Object.keys(positions).length > 0) formData.append("positions", JSON.stringify(positions));
      formData.append("overlay_filter", overlayFilter);
      formData.append("card_opacity", String(cardOpacity));
      formData.append("format", postFormat);

      const uploadRes = await fetch("/api/approve-post", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Save failed");

      const result = await uploadRes.json();
      setPost({ ...post, image_url: result.imageUrl, positions, overlay_filter: overlayFilter, card_opacity: cardOpacity });
      setHasDragChanges(false);
    } catch (e: any) {
      console.error("Save position error:", e);
    } finally {
      setSavingPosition(false);
    }
  }, [brand, post, caption, positions, overlayFilter, cardOpacity]);

  // Approve with re-export: capture current interactive template as PNG
  const handleApproveWithExport = useCallback(async () => {
    if (!canvasRef.current || !brand || !post) return;
    setLoading("APPROVED");

    try {
      // Wait for rendering
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 400));

      const dataUrl = await toPng(canvasRef.current, {
        width: 1080,
        height: canvasHeight,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: "none" },
      });

      const blobRes = await fetch(dataUrl);
      const blob = await blobRes.blob();

      const formData = new FormData();
      formData.append("file", blob, `post-${Date.now()}.png`);
      formData.append("brandId", brand.id);
      formData.append("layout", String(post.layout));
      formData.append("title", title);
      formData.append("caption", caption);
      formData.append("postId", post.id);
      formData.append("status", "APPROVED");
      if (post.subtitle) formData.append("subtitle", post.subtitle);
      if (post.background_url) formData.append("background_url", post.background_url);
      if (Object.keys(positions).length > 0) formData.append("positions", JSON.stringify(positions));
      formData.append("overlay_filter", overlayFilter);
      formData.append("card_opacity", String(cardOpacity));
      formData.append("format", postFormat);
      if (scheduleDate) {
        formData.append("scheduled_at", `${scheduleDate}T${scheduleTime}:00Z`);
      }

      const uploadRes = await fetch("/api/approve-post", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      console.error("Approve export error:", e);
      setLoading("");
    }
  }, [brand, post, caption, positions, overlayFilter, cardOpacity, scheduleDate, scheduleTime, router]);

  // Regeneration capture & upload
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
          width: 1080,
          height: canvasHeight,
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
        if (regenData.subtitle) formData.append("subtitle", regenData.subtitle);
        if (regenData.backgroundUrl) formData.append("background_url", regenData.backgroundUrl);
        if (regenData.scheduledAt) {
          formData.append("scheduled_at", regenData.scheduledAt);
        }
        formData.append("overlay_filter", overlayFilter);
        formData.append("card_opacity", String(cardOpacity));
        formData.append("format", postFormat);

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

  const handleDragStop = (elementId: string, pos: { x: number; y: number }) => {
    setPositions((prev) => ({ ...prev, [elementId]: pos }));
    setHasDragChanges(true);
  };

  const canvasHeight = FORMATS[postFormat].height;

  const templateProps = {
    title,
    subtitle: post.subtitle ?? "",
    logoUrl: logoDataUrl || "",
    primaryColor: brand.primary_color ?? "#7C3DE3",
    backgroundUrl: bgDataUrl || undefined,
    overlayFilter,
    cardOpacity,
    height: canvasHeight,
    draggable: true,
    scale,
    positions,
    onDragStop: handleDragStop,
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
          {/* Preview — interactive template or static image */}
          <div>
            {interactive && !isPublished ? (
              <div
                ref={wrapperRef}
                className="relative bg-neutral-900 rounded-xl overflow-hidden border border-surface-border"
                style={{ aspectRatio: FORMATS[postFormat].ratio }}
              >
                <div
                  ref={canvasRef}
                  key={resetKey}
                  style={{
                    width: 1080,
                    height: canvasHeight,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                >
                  {renderTemplate(post.layout, templateProps)}
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
                  onClick={() => { setResetKey((k) => k + 1); setHasDragChanges(false); }}
                  className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 border border-surface-border rounded-lg transition-colors"
                >
                  Resetear posicion
                </button>
                <span className="text-xs text-neutral-500 flex items-center">
                  Arrastra los elementos para moverlos
                </span>
              </div>
            )}

            {/* Overlay filter & card opacity controls */}
            {interactive && !isPublished && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                    Filtro overlay
                  </label>
                  <div className="flex gap-1.5">
                    {([
                      ["none", "Sin filtro", "bg-neutral-700"],
                      ["purple", "Morado", "bg-purple-600"],
                      ["dark", "Oscuro", "bg-neutral-900"],
                      ["gradient", "Degradado", "bg-gradient-to-b from-transparent to-black"],
                    ] as const).map(([value, label, colorClass]) => (
                      <button
                        key={value}
                        onClick={() => { setOverlayFilter(value as OverlayFilter); setHasDragChanges(true); }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          overlayFilter === value
                            ? "border-accent bg-accent/10 text-accent border"
                            : "border border-surface-border bg-surface-light text-neutral-400 hover:text-white"
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-sm ${colorClass}`} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                    Opacidad del card — {Math.round(cardOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(cardOpacity * 100)}
                    onChange={(e) => { setCardOpacity(Number(e.target.value) / 100); setHasDragChanges(true); }}
                    className="w-full accent-accent"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {!isPublished ? (
              <div className="mb-2">
                <label className="text-sm text-neutral-400 mb-1 block">Titulo</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setHasDragChanges(true); }}
                  className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                />
              </div>
            ) : (
              <h2 className="text-xl font-bold mb-1">{title}</h2>
            )}
            <span className="text-xs text-neutral-500 mb-4">
              Layout {post.layout} &middot; {post.status}
              {(post.status === "SCHEDULED" || post.status === "PUBLISHED") && post.scheduled_at && (
                <> &middot; {new Date(post.scheduled_at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>
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

            {/* Publish section */}
            {!isPublished && (
              <div className="mb-4 p-4 bg-surface-light border border-surface-border rounded-lg space-y-4">
                {/* Network toggles */}
                <div>
                  <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                    Publicar en
                  </label>
                  <div className="flex gap-2">
                    {brand.ig_handle && (
                      <button
                        onClick={() => { if (fbEnabled || !igEnabled) setIgEnabled(!igEnabled); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          igEnabled
                            ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white"
                            : "bg-surface border border-surface-border text-neutral-500"
                        }`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                        {brand.ig_handle}
                      </button>
                    )}
                    {brand.fb_page && (
                      <button
                        onClick={() => { if (igEnabled || !fbEnabled) setFbEnabled(!fbEnabled); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          fbEnabled
                            ? "bg-blue-600 text-white"
                            : "bg-surface border border-surface-border text-neutral-500"
                        }`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        {brand.fb_page}
                      </button>
                    )}
                  </div>
                </div>

                {/* AI suggestion or manual date picker */}
                <div>
                  {aiSuggestion && !showManualDate ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-neutral-300">
                          Sugerido: <span className="font-medium text-white">{suggestedLabel}</span>
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mb-2">{aiSuggestion.reason || `Horario optimo para ${brand.industry || "tu audiencia"} en LATAM`}</p>
                      <button
                        onClick={() => setShowManualDate(true)}
                        className="text-xs text-accent hover:text-accent/80 transition-colors"
                      >
                        Cambiar fecha
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-neutral-500 mb-2 block">Fecha y hora</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => { setScheduleDate(e.target.value); setSuggestedLabel(""); }}
                          min={new Date().toISOString().split("T")[0]}
                          className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                        />
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => { setScheduleTime(e.target.value); setSuggestedLabel(""); }}
                          className="w-28 bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Publish buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handlePublishNow}
                    disabled={!!loading || (!igEnabled && !fbEnabled)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                  >
                    {loading === "PUBLISH" ? "Publicando..." : "Publicar ahora"}
                  </button>
                  <button
                    onClick={handleSchedule}
                    disabled={!scheduleDate || !!loading || (!igEnabled && !fbEnabled)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                  >
                    {loading === "SCHEDULE" ? "..." : isScheduled ? "Reprogramar" : "Programar"}
                  </button>
                  {isScheduled && (
                    <button
                      onClick={handleUnschedule}
                      disabled={!!loading}
                      className="px-4 bg-surface border border-surface-border hover:border-yellow-500/50 disabled:opacity-50 text-yellow-400 font-medium py-2.5 rounded-lg transition-colors text-xs"
                    >
                      {loading === "UNSCHEDULE" ? "..." : "Desprogramar"}
                    </button>
                  )}
                </div>

                {publishedMessage && (
                  <p className="text-sm text-emerald-400 text-center">{publishedMessage}</p>
                )}
                {publishError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{publishError}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {!isPublished && (
                <button
                  onClick={interactive ? handleApproveWithExport : () => updateStatus("APPROVED")}
                  disabled={!!loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm"
                >
                  {loading === "APPROVED" ? "Exportando..." : "Aprobar y publicar"}
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
                  onClick={handleDiscard}
                  disabled={!!loading}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 font-medium py-3 rounded-lg transition-colors text-sm"
                >
                  {loading === "DISCARDED" ? "Eliminando..." : "Descartar"}
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
            height: canvasHeight,
            overflow: "hidden",
            pointerEvents: "none",
            opacity: 0,
            zIndex: -1,
          }}
          aria-hidden="true"
        >
          <div ref={regenCanvasRef} style={{ width: 1080, height: canvasHeight }}>
            {renderTemplate(post.layout, {
              title: regenData.title,
              subtitle: regenData.subtitle,
              logoUrl: regenData.logoDataUrl,
              primaryColor: brand.primary_color ?? "#7C3DE3",
              backgroundUrl: regenData.bgDataUrl || undefined,
              overlayFilter,
              cardOpacity,
              height: canvasHeight,
            })}
          </div>
        </div>
      )}
    </div>
  );
}
