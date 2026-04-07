"use client";

import { useState } from "react";
import { FORMATS, type PostFormat } from "@/lib/formats";
import type { OverlayFilter } from "./templates";

export interface AutoGenerateConfig {
  totalPosts: number;
  format: PostFormat;
  overlayFilter: OverlayFilter;
  generateImages: boolean;
}

interface Props {
  defaultFormat: PostFormat;
  defaultOverlayFilter: OverlayFilter;
  onConfirm: (config: AutoGenerateConfig) => void;
  onCancel: () => void;
}

const POST_COUNTS = [4, 8, 12];

export default function AutoGenerateModal({ defaultFormat, defaultOverlayFilter, onConfirm, onCancel }: Props) {
  const [totalPosts, setTotalPosts] = useState(4);
  const [format, setFormat] = useState<PostFormat>(defaultFormat);
  const [overlayFilter, setOverlayFilter] = useState<OverlayFilter>(defaultOverlayFilter);
  const [generateImages, setGenerateImages] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-surface border border-surface-border rounded-2xl p-6 w-full max-w-md mx-4 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Configurar parrilla</h2>

        {/* Post count */}
        <div>
          <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
            Cantidad de posts
          </label>
          <div className="flex gap-2">
            {POST_COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => setTotalPosts(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  totalPosts === n
                    ? "border-accent bg-accent/10 text-accent border"
                    : "border border-surface-border bg-surface-light text-neutral-400 hover:text-white"
                }`}
              >
                {n}
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
            {(Object.keys(FORMATS) as PostFormat[]).map((key) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                  format === key
                    ? "border-accent bg-accent/10 text-accent border"
                    : "border border-surface-border bg-surface-light text-neutral-400 hover:text-white"
                }`}
              >
                {FORMATS[key].label}
              </button>
            ))}
          </div>
        </div>

        {/* Overlay filter */}
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

        {/* Generate images toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-300">Generar imagenes con IA</span>
          <button
            onClick={() => setGenerateImages(!generateImages)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              generateImages ? "bg-accent" : "bg-surface-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                generateImages ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-surface-border text-neutral-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ totalPosts, format, overlayFilter, generateImages })}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent/90 text-white transition-colors"
          >
            Generar {totalPosts} posts
          </button>
        </div>
      </div>
    </div>
  );
}
