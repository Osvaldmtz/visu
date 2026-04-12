"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { renderTemplate, type OverlayFilter } from "@/components/templates";
import { toDataUrl } from "@/lib/image-utils";
import { FORMATS, type PostFormat } from "@/lib/formats";

export default function CarouselReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [carousel, setCarousel] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [caption, setCaption] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [scale, setScale] = useState(0.5);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [loading, setLoading] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishedMessage, setPublishedMessage] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: carouselData } = await supabase
        .from("carousel_posts")
        .select("*")
        .eq("id", id)
        .single();

      if (carouselData) {
        setCarousel(carouselData);
        setCaption(carouselData.caption);

        const { data: brandData } = await supabase
          .from("brands")
          .select("*")
          .eq("id", carouselData.brand_id)
          .single();
        setBrand(brandData);

        if (carouselData.scheduled_at && brandData) {
          const tz = brandData.timezone || "America/Mexico_City";
          const d = new Date(carouselData.scheduled_at);
          setScheduleDate(d.toLocaleDateString("sv-SE", { timeZone: tz }));
          setScheduleTime(d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }));
        }
      }
    };
    load();
  }, [id]);

  // Load logo for current slide
  useEffect(() => {
    if (!brand || !carousel?.slides?.[activeSlide]) return;
    const slide = carousel.slides[activeSlide];
    const logoSrc =
      slide.layout <= 1
        ? brand.logo_light_url || brand.logo_url || ""
        : brand.logo_dark_url || brand.logo_light_url || brand.logo_url || "";
    if (logoSrc) {
      toDataUrl(logoSrc).then(setLogoDataUrl);
    } else {
      setLogoDataUrl("");
    }
  }, [brand, carousel, activeSlide]);

  // Scale preview
  useEffect(() => {
    const update = () => {
      if (wrapperRef.current) setScale(wrapperRef.current.offsetWidth / 1080);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const localToUtc = (date: string, time: string): string => {
    const tz = brand?.timezone || "America/Mexico_City";
    const ref = new Date(`${date}T12:00:00Z`);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", minute: "numeric", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts = fmt.formatToParts(ref);
    const g = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0");
    const tzAtRef = g("hour") * 60 + g("minute");
    const utcAtRef = 12 * 60;
    const offsetMins = tzAtRef - utcAtRef;
    const [h, m] = time.split(":").map(Number);
    const userMins = h * 60 + m;
    const utcMins = userMins - offsetMins;
    const utcDate = new Date(`${date}T00:00:00Z`);
    utcDate.setUTCMinutes(utcMins);
    return utcDate.toISOString();
  };

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    setLoading("SCHEDULE");
    setPublishError("");
    try {
      const scheduledAt = localToUtc(scheduleDate, scheduleTime);
      const res = await fetch("/api/schedule-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carouselId: carousel.id, scheduledAt, caption }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Schedule failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setPublishError(e.message);
      setLoading("");
    }
  };

  const handleUnschedule = async () => {
    setLoading("UNSCHEDULE");
    try {
      await fetch("/api/schedule-carousel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carouselId: carousel.id }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setPublishError(e.message);
      setLoading("");
    }
  };

  const handlePublishNow = async () => {
    setPublishError("");
    setPublishedMessage("");
    setLoading("PUBLISH");
    try {
      const supabase = createClient();
      await supabase.from("carousel_posts").update({ caption }).eq("id", id);

      const res = await fetch("/api/publish-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carouselId: carousel.id, publishNow: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      setPublishedMessage("Carrusel publicado en Instagram y Facebook");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch (e: any) {
      setPublishError(e.message);
      setLoading("");
    }
  };

  const handleDiscard = async () => {
    setLoading("DISCARD");
    const supabase = createClient();
    for (const url of carousel.image_urls ?? []) {
      if (url?.includes("/storage/v1/object/public/posts/")) {
        const path = url.split("/storage/v1/object/public/posts/")[1];
        if (path) await supabase.storage.from("posts").remove([decodeURIComponent(path)]);
      }
    }
    await supabase.from("carousel_posts").delete().eq("id", carousel.id);
    router.push("/dashboard");
    router.refresh();
  };

  if (!carousel || !brand) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Loading...</span>
      </div>
    );
  }

  const slides = carousel.slides ?? [];
  const slide = slides[activeSlide];
  const fmt = (carousel.format ?? "square") as PostFormat;
  const fmtData = FORMATS[fmt] ?? FORMATS.square;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-neutral-400 hover:text-white mb-6 block"
        >
          &larr; Back to dashboard
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Preview area */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-3 overflow-x-auto">
              {slides.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    i === activeSlide
                      ? "bg-accent text-white"
                      : "bg-surface-light text-neutral-400 hover:text-white border border-surface-border"
                  }`}
                >
                  Slide {i + 1}
                </button>
              ))}
            </div>

            {slide && (
              <div
                ref={wrapperRef}
                className="relative bg-neutral-900 rounded-xl overflow-hidden border border-surface-border"
                style={{ aspectRatio: fmtData.ratio, maxWidth: 600 }}
              >
                <div
                  style={{
                    width: 1080,
                    height: fmtData.height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                >
                  {renderTemplate(slide.layout, {
                    title: slide.title || `Slide ${activeSlide + 1}`,
                    subtitle: slide.subtitle ?? "",
                    bodyText: slide.body_text ?? "",
                    logoUrl: logoDataUrl,
                    primaryColor: brand.primary_color ?? "#7C3DE3",
                    backgroundUrl: slide.background_url || undefined,
                    overlayFilter: (slide.overlay_filter ?? "purple") as OverlayFilter,
                    cardOpacity: slide.card_opacity ?? 0.9,
                    titleSize: slide.title_size,
                    subtitleSize: slide.subtitle_size,
                    bodySize: slide.body_size,
                    height: fmtData.height,
                    positions: slide.positions ?? undefined,
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-neutral-500 mt-2 text-center">
              Slide {activeSlide + 1} de {slides.length} &middot; {fmtData.label}
            </p>
          </div>

          {/* Controls */}
          <div className="w-full lg:w-80 space-y-5">
            {/* Status */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Carrusel</h2>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                carousel.status === "DRAFT" ? "bg-yellow-500/20 text-yellow-400" :
                carousel.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                carousel.status === "SCHEDULED" ? "bg-blue-500/20 text-blue-400" :
                carousel.status === "PUBLISHED" ? "bg-accent/20 text-accent" :
                "bg-red-500/20 text-red-400"
              }`}>
                {carousel.status}
              </span>
            </div>

            <p className="text-sm text-neutral-400">
              {slides.length} slides &middot; Formato {fmtData.label}
            </p>

            {/* Caption */}
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-accent"
              />
            </div>

            {/* Schedule controls */}
            {carousel.status !== "PUBLISHED" && (
              <>
                {carousel.status === "SCHEDULED" ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-400">
                        Programado para {new Date(carousel.scheduled_at).toLocaleString("es-MX", {
                          timeZone: brand.timezone || "America/Mexico_City",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <button
                      onClick={handleUnschedule}
                      disabled={!!loading}
                      className="w-full bg-surface-light hover:bg-surface-border disabled:opacity-50 text-neutral-300 font-medium py-2.5 rounded-lg text-sm border border-surface-border"
                    >
                      {loading === "UNSCHEDULE" ? "Cancelando..." : "Cancelar programacion"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="flex-1 bg-surface-light border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                      />
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-24 bg-surface-light border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                      />
                    </div>
                    <button
                      onClick={handleSchedule}
                      disabled={!scheduleDate || !!loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm"
                    >
                      {loading === "SCHEDULE" ? "Programando..." : "Programar carrusel"}
                    </button>
                  </div>
                )}

                <button
                  onClick={handlePublishNow}
                  disabled={!!loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm"
                >
                  {loading === "PUBLISH" ? "Publicando..." : "Publicar ahora"}
                </button>

                <button
                  onClick={handleDiscard}
                  disabled={!!loading}
                  className="w-full bg-surface-light hover:bg-red-500/20 disabled:opacity-50 text-red-400 font-medium py-2.5 rounded-lg text-sm border border-surface-border hover:border-red-500/30"
                >
                  {loading === "DISCARD" ? "Descartando..." : "Descartar"}
                </button>
              </>
            )}

            {publishError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{publishError}</p>
              </div>
            )}
            {publishedMessage && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-green-400">{publishedMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
