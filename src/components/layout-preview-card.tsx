"use client";

import { useState } from "react";
import Image from "next/image";

interface BrandConfig {
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
}

interface LayoutPreviewCardProps {
  layoutId: number;
  layoutName: string;
  isActive: boolean;
  onToggle: () => void;
  brandConfig: BrandConfig;
}

export default function LayoutPreviewCard({
  layoutId,
  layoutName,
  isActive,
  onToggle,
  brandConfig,
}: LayoutPreviewCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGeneratePreview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/preview-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutId, brandConfig }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando preview");
      setImageUrl(data.imageUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#1a1a1a] p-4 transition-opacity ${
        isActive ? "opacity-100" : "opacity-40"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{layoutName}</h3>
        <button
          onClick={onToggle}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            isActive ? "bg-[#7C3DE3]" : "bg-white/20"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              isActive ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {imageUrl ? (
        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg">
          <Image
            src={imageUrl}
            alt={`Preview ${layoutName}`}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5">
          {loading ? (
            <svg
              className="h-8 w-8 animate-spin text-[#7C3DE3]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <span className="text-xs text-white/40">Sin preview</span>
          )}
        </div>
      )}

      {error && (
        <p className="mb-2 text-xs text-red-400">{error}</p>
      )}

      <button
        onClick={handleGeneratePreview}
        disabled={loading}
        className="w-full rounded-lg bg-[#7C3DE3] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6B2FD1] disabled:opacity-50"
      >
        {loading ? "Generando..." : "Generar preview"}
      </button>
    </div>
  );
}
