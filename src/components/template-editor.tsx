"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { renderTemplate, TEMPLATE_NAMES, type OverlayFilter } from "./templates";
import { toDataUrl } from "@/lib/image-utils";
import { FORMATS, type PostFormat } from "@/lib/formats";

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

interface TemplateEditorProps {
  brand: Brand;
  initialLayout?: number;
  initialTitle?: string;
  initialSubtitle?: string;
  initialCaption?: string;
  initialBackgroundUrl?: string;
  postId?: string;
  onSaved?: () => void;
}

export default function TemplateEditor({
  brand,
  initialLayout = 0,
  initialTitle = "",
  initialSubtitle = "",
  initialCaption = "",
  initialBackgroundUrl,
  postId,
  onSaved,
}: TemplateEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [layout, setLayout] = useState(initialLayout);
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [caption, setCaption] = useState(initialCaption);
  const [customTopic, setCustomTopic] = useState("");
  const [primaryColor, setPrimaryColor] = useState(brand.primary_color ?? "#7C3DE3");
  const [backgroundUrl, setBackgroundUrl] = useState(initialBackgroundUrl ?? "");
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentPostId, setCurrentPostId] = useState(postId ?? null);
  const [generating, setGenerating] = useState(false);
  const [photoQuery, setPhotoQuery] = useState("");
  const [photoResults, setPhotoResults] = useState<any[]>([]);
  const [searchingPhotos, setSearchingPhotos] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [overlayFilter, setOverlayFilter] = useState<OverlayFilter>((brand.default_overlay_filter as OverlayFilter) ?? "purple");
  const [cardOpacity, setCardOpacity] = useState(0.9);
  const [format, setFormat] = useState<PostFormat>((brand.default_format as PostFormat) ?? "square");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pick the right logo variant based on layout
  const logoUrl =
    layout <= 1
      ? brand.logo_light_url || brand.logo_url || ""
      : brand.logo_dark_url || brand.logo_light_url || brand.logo_url || "";

  // Pre-load logo as data URL for html-to-image export
  useEffect(() => {
    if (logoUrl) {
      toDataUrl(logoUrl).then(setLogoDataUrl);
    } else {
      setLogoDataUrl("");
    }
  }, [logoUrl]);

  const handleDragStop = useCallback((elementId: string, pos: { x: number; y: number }) => {
    setPositions((prev) => ({ ...prev, [elementId]: pos }));
  }, []);

  const canvasHeight = FORMATS[format].height;

  const templateProps = {
    title: title || "Tu titulo aqui",
    subtitle,
    logoUrl: logoDataUrl || logoUrl,
    primaryColor,
    backgroundUrl: backgroundUrl || undefined,
    overlayFilter,
    cardOpacity,
    height: canvasHeight,
    draggable: true,
    scale,
    positions,
    onDragStop: handleDragStop,
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, layout, ...(customTopic ? { customTopic } : {}) }),
      });
      const data = await res.json();
      if (data.title) setTitle(data.title);
      if (data.subtitle) setSubtitle(data.subtitle);
      if (data.caption) setCaption(data.caption);
      if (data.scheduled_at) setScheduledAt(data.scheduled_at);
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBackgroundUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSearchPhotos = async () => {
    if (!photoQuery.trim()) return;
    setSearchingPhotos(true);
    try {
      const res = await fetch(
        `/api/unsplash?query=${encodeURIComponent(photoQuery)}`
      );
      const data = await res.json();
      setPhotoResults(data.results ?? []);
    } finally {
      setSearchingPhotos(false);
    }
  };

  const exportToPng = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null;
    setExporting(true);
    try {
      const dataUrl = await toPng(canvasRef.current, {
        width: 1080,
        height: canvasHeight,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: "none" },
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } finally {
      setExporting(false);
    }
  }, [canvasHeight]);

  const handleExport = async () => {
    const blob = await exportToPng();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visu-${layout}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const savePost = async (status: string): Promise<boolean> => {
    const blob = await exportToPng();
    if (!blob) return false;

    const formData = new FormData();
    formData.append("file", blob, `post-${Date.now()}.png`);
    formData.append("brandId", brand.id);
    formData.append("layout", String(layout));
    formData.append("title", title);
    formData.append("caption", caption);
    formData.append("status", status);
    if (subtitle) formData.append("subtitle", subtitle);
    if (backgroundUrl) formData.append("background_url", backgroundUrl);
    if (currentPostId) formData.append("postId", currentPostId);
    if (scheduledAt) formData.append("scheduled_at", scheduledAt);
    if (Object.keys(positions).length > 0) formData.append("positions", JSON.stringify(positions));
    formData.append("overlay_filter", overlayFilter);
    formData.append("card_opacity", String(cardOpacity));
    formData.append("format", format);

    const res = await fetch("/api/approve-post", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Failed to save post");
    const data = await res.json();
    if (data.postId) setCurrentPostId(data.postId);
    return true;
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await savePost("DRAFT");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const ok = await savePost("APPROVED");
      if (ok) onSaved?.();
    } finally {
      setSaving(false);
    }
  };

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

  const needsBackground = layout === 0 || layout === 1 || layout === 3;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Canvas preview */}
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
            {renderTemplate(layout, templateProps)}
          </div>
        </div>
      </div>

      {/* Controls panel */}
      <div className="w-full lg:w-80 space-y-5">
        {/* Custom topic */}
        <div>
          <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
            Tema del post (opcional)
          </label>
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Ej: Dia de la Mujer, Navidad, Dia del Psicologo..."
            className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent placeholder-neutral-600"
          />
        </div>

        {/* Template selector */}
        <div>
          <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
            Template
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TEMPLATE_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => { setLayout(i); setPositions({}); }}
                className={`text-xs py-2 px-1 rounded-lg border transition-colors ${
                  layout === i
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface-border bg-surface-light text-neutral-400 hover:text-white"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Format selector */}
        <div>
          <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
            Formato
          </label>
          <div className="flex gap-2">
            {(Object.keys(FORMATS) as PostFormat[]).map((key) => (
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titulo del post"
            className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
          />
        </div>

        {/* Subtitle (layouts 1, 2) */}
        {(layout === 1 || layout === 2) && (
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Subtitulo
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Subtitulo"
              className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {/* Caption */}
        <div>
          <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
            Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="Caption para redes sociales..."
            className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-accent"
          />
        </div>

        {/* Generate with AI */}
        <button
          onClick={handleGenerateAI}
          disabled={generating}
          className="w-full bg-accent/20 hover:bg-accent/30 disabled:opacity-50 text-accent font-medium py-2.5 rounded-lg transition-colors text-sm border border-accent/30"
        >
          {generating ? "Generando..." : "Generar con IA"}
        </button>

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

        {/* Background image (layouts 0, 1, 3) */}
        {needsBackground && (
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Imagen de fondo
            </label>

            {/* Upload custom image */}
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
                    onClick={() => setBackgroundUrl(photo.urls.regular)}
                    className={`aspect-square rounded overflow-hidden border-2 transition-colors ${
                      backgroundUrl === photo.urls.regular
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
            {backgroundUrl && (
              <button
                onClick={() => setBackgroundUrl("")}
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
                    onClick={() => setOverlayFilter(value as OverlayFilter)}
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

            {/* Card opacity slider */}
            <div className="mt-3">
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                Opacidad del card — {Math.round(cardOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(cardOpacity * 100)}
                onChange={(e) => setCardOpacity(Number(e.target.value) / 100)}
                className="w-full accent-accent"
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={savingDraft || saving || exporting}
            className="flex-1 bg-surface-light hover:bg-surface-border disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm border border-surface-border"
          >
            {savingDraft ? "Guardando..." : "Guardar borrador"}
          </button>
          <button
            onClick={handleApprove}
            disabled={saving || savingDraft || exporting}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm"
          >
            {saving ? "Guardando..." : "Aprobar post"}
          </button>
        </div>
      </div>
    </div>
  );
}
