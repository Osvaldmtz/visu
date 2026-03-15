import React from "react";
import DraggableElement from "./draggable-element";
import type { ElementPositions } from "./index";

interface OverlayProps {
  title: string;
  logoUrl: string;
  primaryColor: string;
  backgroundUrl?: string;
  draggable?: boolean;
  scale?: number;
  onDragChange?: () => void;
  positions?: ElementPositions;
  onPositionChange?: (id: string, x: number, y: number) => void;
}

export default function OverlayTemplate({ title, logoUrl, primaryColor, backgroundUrl, draggable, scale, onDragChange, positions, onPositionChange }: OverlayProps) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {backgroundUrl ? (
        <img
          src={backgroundUrl}
          alt="Background"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          crossOrigin="anonymous"
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1a0533 0%, #2d1b69 40%, #1a0533 100%)" }} />
      )}

      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div style={{ position: "absolute", inset: 0, backgroundColor: primaryColor, opacity: 0.45 }} />

      {logoUrl && (
        <DraggableElement enabled={draggable} scale={scale} onDragChange={onDragChange} elementId="logo" defaultPosition={positions?.logo} onPositionChange={onPositionChange} style={{ position: "absolute", top: 60, left: 60 }}>
          <img src={logoUrl} alt="Logo" style={{ maxWidth: 160, maxHeight: 80, objectFit: "contain" }} crossOrigin="anonymous" />
        </DraggableElement>
      )}

      <DraggableElement enabled={draggable} scale={scale} onDragChange={onDragChange} elementId="title" defaultPosition={positions?.title} onPositionChange={onPositionChange} style={{ position: "absolute", bottom: 80, left: 80, right: 80, textAlign: "center" as const }}>
        <h1 style={{ color: "#FFFFFF", fontSize: 72, fontWeight: 700, lineHeight: 1.1, margin: 0, textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
          {title}
        </h1>
      </DraggableElement>
    </div>
  );
}
