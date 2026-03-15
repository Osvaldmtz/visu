"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { renderTemplate, TEMPLATE_NAMES } from "./templates";
import { toDataUrl } from "@/lib/image-utils";

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
  const [primaryColor, setPrimaryColor] = useState(brand.primary_color ?? "#7C3DE3");
  const [backgroundUrl, setBackgroundUrl] = useState(initialBackgroundUrl ?? "");
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [photoQuery, setPhotoQuery] = useState("");
  const [photoResults, setPhotoResults] = useState<any[]>([]);
  const [searchingPhotos, setSearchingPhotos] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState("");

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

  const templateProps = {
    title: title || "Tu titulo aqui",
    subtitle,
    logoUrl: logoDataUrl || logoUrl,
    primaryColor,
    backgroundUrl: backgroundUrl || undefined,
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, layout }),
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
        height: 1080,
        pixelRatio: 1,
        cacheBust: true,
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } finally {
      setExporting(false);
    }
  }, []);

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

  const handleApprove = async () => {
    setSaving(true);
    try {
      const blob = await exportToPng();
      if (!blob) return;

      const formData = new FormData();
      formData.append("file", blob, `post-${Date.now()}.png`);
      formData.append("brandId", brand.id);
      formData.append("layout", String(layout));
      formData.append("title", title);
      formData.append("caption", caption);
      if (subtitle) formData.append("subtitle", subtitle);
      if (backgroundUrl) formData.append("background_url", backgroundUrl);
      if (postId) formData.append("postId", postId);
      if (scheduledAt) formData.append("scheduled_at", scheduledAt);

      const res = await fetch("/api/approve-post", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to save post");
      onSaved?.();
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

  const needsPhoto = layout === 1 || layout === 3;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Canvas preview */}
      <div className="flex-1 min-w-0">
        <div
          ref={wrapperRef}
          className="relative bg-neutral-900 rounded-xl overflow-hidden border border-surface-border"
          style={{ aspectRatio: "1/1", maxWidth: 600 }}
        >
          <div
            ref={canvasRef}
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
            {renderTemplate(layout, templateProps)}
          </div>
        </div>
      </div>

      {/* Controls panel */}
      <div className="w-full lg:w-80 space-y-5">
        {/* Template selector */}
        <div>
          <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
            Template
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TEMPLATE_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => setLayout(i)}
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

        {/* Photo selector (layouts 1, 3) */}
        {needsPhoto && (
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              Foto de fondo (Unsplash)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={photoQuery}
                onChange={(e) => setPhotoQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchPhotos()}
                placeholder="Buscar fotos..."
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
                Quitar foto
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 bg-surface-light hover:bg-surface-border disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm border border-surface-border"
          >
            {exporting ? "..." : "Exportar PNG"}
          </button>
          <button
            onClick={handleApprove}
            disabled={saving || exporting}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors text-sm"
          >
            {saving ? "Guardando..." : "Aprobar post"}
          </button>
        </div>
      </div>
    </div>
  );
}
