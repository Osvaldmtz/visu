"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { renderTemplate, TEMPLATE_NAMES, type OverlayFilter } from "./templates";
import { toDataUrl } from "@/lib/image-utils";
import { FORMATS, type PostFormat } from "@/lib/formats";
import SlidePanel, { createDefaultSlide, type CarouselSlide } from "./slide-panel";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  font_family: string;
  active_layouts: number[];
  default_overlay_filter?: string;
  default_format?: string;
}

interface CarouselEditorProps {
  brand: Brand;
  onSaved?: () => void;
}

export default function CarouselEditor({ brand, onSaved }: CarouselEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slides, setSlides] = useState<CarouselSlide[]>([
    createDefaultSlide(),
    createDefaultSlide(),
  ]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [format, setFormat] = useState<PostFormat>(
    (brand.default_format as PostFormat) ?? "square"
  );
  const [primaryColor, setPrimaryColor] = useState(brand.primary_color ?? "#7C3DE3");
  const [scale, setScale] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [photoQuery, setPhotoQuery] = useState("");
  const [photoResults, setPhotoResults] = useState<any[]>([]);
  const [searchingPhotos, setSearchingPhotos] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [exportProgress, setExportProgress] = useState("");

  // AI generation state
  const [showAiForm, setShowAiForm] = useState(true);
  const [aiTopic, setAiTopic] = useState("");
  const [aiSlideCount, setAiSlideCount] = useState(5);
  const [aiLayout, setAiLayout] = useState(0);
  const [aiGenerateImages, setAiGenerateImages] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState("");

  const slide = slides[activeIndex];

  // Pick logo variant based on active slide layout
  const logoUrl =
    slide.layout <= 1
      ? brand.logo_light_url || brand.logo_url || ""
      : brand.logo_dark_url || brand.logo_light_url || brand.logo_url || "";

  useEffect(() => {
    if (logoUrl) {
      toDataUrl(logoUrl).then(setLogoDataUrl);
    } else {
      setLogoDataUrl("");
    }
  }, [logoUrl]);

  // Scale canvas to fit wrapper
  useEffect(() => {
    const update = () => {
      if (wrapperRef.current) {
        setScale(wrapperRef.current.offsetWidth / 1080);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const canvasHeight = FORMATS[format].height;

  const updateSlide = useCallback(
    (updates: Partial<CarouselSlide>) => {
      setSlides((prev) =>
        prev.map((s, i) => (i === activeIndex ? { ...s, ...updates } : s))
      );
    },
    [activeIndex]
  );

  const handleDragStop = useCallback(
    (elementId: string, pos: { x: number; y: number }) => {
      updateSlide({
        positions: { ...slide.positions, [elementId]: pos },
      });
    },
    [slide.positions, updateSlide]
  );

  const templateProps = {
    title: slide.title || "Tu titulo aqui",
    subtitle: slide.subtitle,
    bodyText: slide.body_text,
    logoUrl: logoDataUrl || logoUrl,
    primaryColor,
    backgroundUrl: slide.background_url || undefined,
    overlayFilter: slide.overlay_filter,
    cardOpacity: slide.card_opacity,
    titleSize: slide.title_size,
    subtitleSize: slide.subtitle_size,
    bodySize: slide.body_size,
    height: canvasHeight,
    draggable: true,
    scale,
    positions: slide.positions,
    onDragStop: handleDragStop,
  };

  // --- Slide panel handlers ---
  const handleAddSlide = () => {
    if (slides.length >= 10) return;
    const newSlide = createDefaultSlide();
    // Copy format-related defaults from current slide
    newSlide.layout = slide.layout;
    newSlide.overlay_filter = slide.overlay_filter;
    newSlide.card_opacity = slide.card_opacity;
    setSlides((prev) => [...prev, newSlide]);
    setActiveIndex(slides.length);
  };

  const handleRemoveSlide = (index: number) => {
    if (slides.length <= 2) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    if (activeIndex >= slides.length - 1) {
      setActiveIndex(Math.max(0, slides.length - 2));
    } else if (activeIndex > index) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleReorder = (from: number, to: number) => {
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    // Keep active on the moved slide
    if (activeIndex === from) {
      setActiveIndex(to);
    } else if (from < activeIndex && to >= activeIndex) {
      setActiveIndex(activeIndex - 1);
    } else if (from > activeIndex && to <= activeIndex) {
      setActiveIndex(activeIndex + 1);
    }
  };

  // --- Image handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSlide({ background_url: reader.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    setGenerateError("");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: slide.title,
          caption,
          primaryColor,
          format,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (data.backgroundUrl) updateSlide({ background_url: data.backgroundUrl });
    } catch (e: any) {
      setGenerateError(e.message || "Error al generar imagen");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSearchPhotos = async () => {
    if (!photoQuery.trim()) return;
    setSearchingPhotos(true);
    try {
      const res = await fetch(`/api/unsplash?query=${encodeURIComponent(photoQuery)}`);
      const data = await res.json();
      setPhotoResults(data.results ?? []);
    } finally {
      setSearchingPhotos(false);
    }
  };

  // --- Export all slides to PNGs ---
  // We switch the active slide index, wait for React to render the canvas,
  // then capture toPng from the live canvasRef. Sequential to avoid race conditions.
  const exportAllSlides = async (): Promise<Blob[]> => {
    const blobs: Blob[] = [];
    if (!canvasRef.current) return blobs;

    const originalIndex = activeIndex;

    for (let i = 0; i < slides.length; i++) {
      setExportProgress(`Exportando slide ${i + 1}/${slides.length}...`);

      // Switch to this slide so the canvas renders it
      setActiveIndex(i);

      // Wait for React to re-render + images to load
      await new Promise((r) => setTimeout(r, 600));

      const dataUrl = await toPng(canvasRef.current!, {
        width: 1080,
        height: canvasHeight,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: "none" },
      });
      const res = await fetch(dataUrl);
      blobs.push(await res.blob());
    }

    // Restore active slide
    setActiveIndex(originalIndex);
    setExportProgress("");
    return blobs;
  };

  const saveCarousel = async (status: string): Promise<boolean> => {
    const blobs = await exportAllSlides();
    if (blobs.length !== slides.length) return false;

    const formData = new FormData();
    blobs.forEach((blob, i) => {
      formData.append(`file_${i}`, blob, `slide-${i}.png`);
    });
    formData.append("brandId", brand.id);
    formData.append("caption", caption);
    formData.append("format", format);
    formData.append("status", status);
    formData.append("slides", JSON.stringify(slides));
    formData.append("slideCount", String(slides.length));

    const res = await fetch("/api/approve-carousel", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to save carousel");
    }
    return true;
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await saveCarousel("DRAFT");
    } catch (e: any) {
      console.error("Save draft error:", e);
      setGenerateError(e.message);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const ok = await saveCarousel("APPROVED");
      if (ok) onSaved?.();
    } catch (e: any) {
      console.error("Approve error:", e);
      setGenerateError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- AI carousel generation ---
  const handleGenerateCarousel = async () => {
    if (!aiTopic.trim()) return;
    setAiGenerating(true);
    setGenerateError("");
    setAiProgress("Generando contenido con IA...");

    try {
      const res = await fetch("/api/generate-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand.id,
          topic: aiTopic,
          slideCount: aiSlideCount,
          layout: aiLayout,
          format,
          generateImages: aiGenerateImages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      // Build slides from AI response
      const newSlides: CarouselSlide[] = data.slides.map((s: any) => ({
        ...createDefaultSlide(),
        layout: aiLayout,
        title: s.title || "",
        subtitle: s.subtitle || "",
        body_text: s.body_text || "",
        background_url: s.background_url || "",
        overlay_filter: (brand.default_overlay_filter as OverlayFilter) ?? "purple",
        card_opacity: 0.9,
      }));

      setSlides(newSlides);
      setActiveIndex(0);
      if (data.caption) setCaption(data.caption);
      setShowAiForm(false);
      setAiProgress("");
    } catch (e: any) {
      console.error("AI carousel error:", e);
      setGenerateError(e.message || "Error al generar carrusel");
      setAiProgress("");
    } finally {
      setAiGenerating(false);
    }
  };

  const needsBackground = slide.layout === 0 || slide.layout === 1 || slide.layout === 3;

  return (
    <div className="flex flex-col gap-4">
      {/* AI Generation Panel */}
      {showAiForm && (
        <div className="bg-surface-light border border-accent/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generar carrusel con IA
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Describe el tema y la IA genera todo el contenido e imagenes automaticamente
              </p>
            </div>
            <button
              onClick={() => setShowAiForm(false)}
              className="text-xs text-neutral-500 hover:text-white"
            >
              Modo manual
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Topic input */}
            <div className="lg:col-span-2">
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                Tema del carrusel
              </label>
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Ej: 5 tips para mejorar tu productividad, Beneficios de la meditacion diaria..."
                className="w-full bg-neutral-900 border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent placeholder-neutral-600"
              />
            </div>

            {/* Slide count */}
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                Numero de slides
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={aiSlideCount}
                  onChange={(e) => setAiSlideCount(Number(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <span className="text-white text-sm font-medium w-6 text-center">{aiSlideCount}</span>
              </div>
            </div>

            {/* Template layout */}
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                Template
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TEMPLATE_NAMES.map((name, i) => (
                  <button
                    key={i}
                    onClick={() => setAiLayout(i)}
                    className={`text-xs py-2 px-1 rounded-lg border transition-colors ${
                      aiLayout === i
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-surface-border bg-neutral-900 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                Formato
              </label>
              <div className="flex gap-2">
                {(["square", "portrait"] as PostFormat[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                      format === key
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-surface-border bg-neutral-900 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {FORMATS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate images toggle */}
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiGenerateImages}
                  onChange={(e) => setAiGenerateImages(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
              </label>
              <span className="text-sm text-neutral-300">Generar imagenes con IA</span>
            </div>
          </div>

          {generateError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{generateError}</p>
            </div>
          )}

          {aiProgress && (
            <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
              <p className="text-sm text-accent">{aiProgress}</p>
            </div>
          )}

          <button
            onClick={handleGenerateCarousel}
            disabled={aiGenerating || !aiTopic.trim()}
            className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm"
          >
            {aiGenerating ? "Generando carrusel..." : `Generar ${aiSlideCount} slides con IA`}
          </button>
        </div>
      )}

      {/* Show "Generate with AI" button when AI form is hidden */}
      {!showAiForm && (
        <button
          onClick={() => setShowAiForm(true)}
          className="self-start flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generar con IA
        </button>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Slide panel (left) */}
        <SlidePanel
          slides={slides}
          activeIndex={activeIndex}
          format={format}
          logoUrl={logoDataUrl || logoUrl}
          primaryColor={primaryColor}
          onSelect={setActiveIndex}
          onAdd={handleAddSlide}
          onRemove={handleRemoveSlide}
          onReorder={handleReorder}
        />

        {/* Canvas preview (center) */}
        <div className="flex-1 min-w-0">
          <div
            ref={wrapperRef}
            className="relative bg-neutral-900 rounded-xl overflow-hidden border border-surface-border"
            style={{ aspectRatio: FORMATS[format].ratio, maxWidth: 600 }}
          >
            <div
              ref={canvasRef}
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
              {renderTemplate(slide.layout, templateProps)}
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2 text-center">
            Slide {activeIndex + 1} de {slides.length}
          </p>
        </div>

        {/* Controls panel (right) */}
        <div className="w-full lg:w-80 space-y-5">
          {/* Template selector */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Template (slide {activeIndex + 1})
            </label>
            <div className="grid grid-cols-4 gap-2">
              {TEMPLATE_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => updateSlide({ layout: i, positions: {} })}
                  className={`text-xs py-2 px-1 rounded-lg border transition-colors ${
                    slide.layout === i
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-surface-border bg-surface-light text-neutral-400 hover:text-white"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Format selector (shared) */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Formato (todas las slides)
            </label>
            <div className="flex gap-2">
              {(["square", "portrait"] as PostFormat[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                    format === key
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-surface-border bg-surface-light text-neutral-400 hover:text-white"
                  }`}
                >
                  {FORMATS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Titulo
            </label>
            <input
              type="text"
              value={slide.title}
              onChange={(e) => updateSlide({ title: e.target.value })}
              placeholder="Titulo del slide"
              className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Subtitulo
            </label>
            <input
              type="text"
              value={slide.subtitle}
              onChange={(e) => updateSlide({ subtitle: e.target.value })}
              placeholder="Subtitulo"
              className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {/* Body text */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Body text
            </label>
            <textarea
              value={slide.body_text}
              onChange={(e) => updateSlide({ body_text: e.target.value })}
              rows={3}
              placeholder="Parrafo corto de 2-4 lineas..."
              className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-accent"
            />
          </div>

          {/* Caption (shared) */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Caption (compartido)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Caption para redes sociales..."
              className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-accent"
            />
          </div>

          {/* Generate image with AI */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerateImage}
              disabled={generatingImage}
              className="flex-1 bg-accent/20 hover:bg-accent/30 disabled:opacity-50 text-accent font-medium py-2.5 rounded-lg transition-colors text-sm border border-accent/30"
            >
              {generatingImage ? "Generando..." : "Generar imagen IA"}
            </button>
          </div>
          {generateError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{generateError}</p>
            </div>
          )}

          {/* Primary color */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Color primario
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 bg-surface-light border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Background image (per-slide) */}
          {needsBackground && (
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                Imagen de fondo
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full mb-2 px-3 py-2.5 bg-surface-light border border-surface-border rounded-lg text-sm text-neutral-400 hover:text-white hover:border-accent/50 transition-colors text-left"
              >
                Subir imagen propia...
              </button>

              {/* Unsplash search */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={photoQuery}
                  onChange={(e) => setPhotoQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchPhotos()}
                  placeholder="Buscar en Unsplash..."
                  className="flex-1 bg-surface-light border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleSearchPhotos}
                  disabled={searchingPhotos}
                  className="px-3 py-2 bg-surface-light border border-surface-border rounded-lg text-sm text-neutral-400 hover:text-white"
                >
                  {searchingPhotos ? "..." : "Buscar"}
                </button>
              </div>
              {photoResults.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto rounded-lg">
                  {photoResults.map((photo: any) => (
                    <button
                      key={photo.id}
                      onClick={() => updateSlide({ background_url: photo.urls.regular })}
                      className={`aspect-square rounded overflow-hidden border-2 transition-colors ${
                        slide.background_url === photo.urls.regular
                          ? "border-accent"
                          : "border-transparent hover:border-accent/50"
                      }`}
                    >
                      <img
                        src={photo.urls.thumb}
                        alt={photo.alt_description ?? ""}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {slide.background_url && (
                <button
                  onClick={() => updateSlide({ background_url: "" })}
                  className="text-xs text-red-400 hover:text-red-300 mt-2"
                >
                  Quitar imagen
                </button>
              )}

              {/* Overlay filter pills */}
              <div className="mt-3">
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
                      onClick={() => updateSlide({ overlay_filter: value as OverlayFilter })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        slide.overlay_filter === value
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

              {/* Card opacity slider */}
              <div className="mt-3">
                <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                  Opacidad del card — {Math.round(slide.card_opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(slide.card_opacity * 100)}
                  onChange={(e) => updateSlide({ card_opacity: Number(e.target.value) / 100 })}
                  className="w-full accent-accent"
                />
              </div>
            </div>
          )}

          {/* Export progress */}
          {exportProgress && (
            <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
              <p className="text-sm text-accent">{exportProgress}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft || saving}
              className="flex-1 bg-surface-light hover:bg-surface-border disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm border border-surface-border"
            >
              {savingDraft ? "Guardando..." : "Guardar borrador"}
            </button>
            <button
              onClick={handleApprove}
              disabled={saving || savingDraft}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm"
            >
              {saving ? "Guardando..." : "Aprobar carrusel"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
