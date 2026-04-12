"use client";

import React, { useRef, useState, useEffect } from "react";
import { renderTemplate } from "./templates";
import type { OverlayFilter } from "./templates";
import { FORMATS, type PostFormat } from "@/lib/formats";

export interface CarouselSlide {
  id: string;
  layout: number;
  title: string;
  subtitle: string;
  body_text: string;
  background_url: string;
  overlay_filter: OverlayFilter;
  card_opacity: number;
  title_size: number;
  subtitle_size: number;
  body_size: number;
  positions: Record<string, { x: number; y: number }>;
}

export function createDefaultSlide(): CarouselSlide {
  return {
    id: crypto.randomUUID(),
    layout: 0,
    title: "",
    subtitle: "",
    body_text: "",
    background_url: "",
    overlay_filter: "purple",
    card_opacity: 0.9,
    title_size: 72,
    subtitle_size: 28,
    body_size: 20,
    positions: {},
  };
}

interface SlidePanelProps {
  slides: CarouselSlide[];
  activeIndex: number;
  format: PostFormat;
  logoUrl: string;
  primaryColor: string;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}

function SlideThumb({
  slide,
  index,
  isActive,
  format,
  logoUrl,
  primaryColor,
  canRemove,
  onSelect,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  slide: CarouselSlide;
  index: number;
  isActive: boolean;
  format: PostFormat;
  logoUrl: string;
  primaryColor: string;
  canRemove: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbScale, setThumbScale] = useState(0);
  const fmtData = FORMATS[format];

  useEffect(() => {
    if (!thumbRef.current) return;
    const update = () => {
      if (thumbRef.current) setThumbScale(thumbRef.current.offsetWidth / 1080);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(thumbRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors group ${
        isActive ? "border-accent" : "border-surface-border hover:border-accent/50"
      }`}
    >
      <div
        ref={thumbRef}
        className="relative overflow-hidden bg-neutral-800"
        style={{ aspectRatio: fmtData.ratio }}
      >
        {thumbScale > 0 && (
          <div
            style={{
              width: 1080,
              height: fmtData.height,
              transform: `scale(${thumbScale})`,
              transformOrigin: "top left",
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
          >
            {renderTemplate(slide.layout, {
              title: slide.title || "Slide " + (index + 1),
              subtitle: slide.subtitle,
              bodyText: slide.body_text,
              logoUrl,
              primaryColor,
              backgroundUrl: slide.background_url || undefined,
              overlayFilter: slide.overlay_filter,
              cardOpacity: slide.card_opacity,
              height: fmtData.height,
              titleSize: slide.title_size,
              subtitleSize: slide.subtitle_size,
              bodySize: slide.body_size,
              positions: slide.positions,
            })}
          </div>
        )}
      </div>
      {/* Slide number */}
      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
        {index + 1}
      </div>
      {/* Remove button */}
      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white/70 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function SlidePanel({
  slides,
  activeIndex,
  format,
  logoUrl,
  primaryColor,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
}: SlidePanelProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="w-full lg:w-28 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[70vh]">
      {slides.map((slide, i) => (
        <SlideThumb
          key={slide.id}
          slide={slide}
          index={i}
          isActive={i === activeIndex}
          format={format}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          canRemove={slides.length > 2}
          onSelect={() => onSelect(i)}
          onRemove={() => onRemove(i)}
          onDragStart={(e) => {
            setDragIndex(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== i) {
              onReorder(dragIndex, i);
            }
            setDragIndex(null);
          }}
        />
      ))}
      {slides.length < 10 && (
        <button
          onClick={onAdd}
          className="flex-shrink-0 w-full aspect-square lg:aspect-auto lg:h-16 rounded-lg border-2 border-dashed border-surface-border hover:border-accent/50 flex items-center justify-center text-neutral-500 hover:text-accent transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
