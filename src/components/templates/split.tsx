import React from "react";
import DraggableElement from "./draggable-element";
import type { ElementPositions } from "./index";

interface SplitProps {
  title: string;
  subtitle: string;
  logoUrl: string;
  primaryColor: string;
  backgroundUrl?: string;
  draggable?: boolean;
  scale?: number;
  onDragChange?: () => void;
  positions?: ElementPositions;
  onPositionChange?: (id: string, x: number, y: number) => void;
}

export default function SplitTemplate({ title, subtitle, logoUrl, primaryColor, backgroundUrl, draggable, scale, onDragChange, positions, onPositionChange }: SplitProps) {
  return (
    <div style={{ width: 1080, height: 1080, position: "relative", overflow: "hidden", fontFamily: "Inter, system-ui, sans-serif", display: "flex" }}>
      <div style={{ width: "50%", height: "100%", backgroundColor: primaryColor, position: "relative", padding: 60 }}>
        {logoUrl && (
          <DraggableElement enabled={draggable} scale={scale} onDragChange={onDragChange} elementId="logo" defaultPosition={positions?.logo} onPositionChange={onPositionChange} style={{ position: "absolute", top: 60, left: 60 }}>
            <img src={logoUrl} alt="Logo" style={{ maxWidth: 120, maxHeight: 60, objectFit: "contain" }} crossOrigin="anonymous" />
          </DraggableElement>
        )}

        <DraggableElement enabled={draggable} scale={scale} onDragChange={onDragChange} elementId="title" defaultPosition={positions?.title} onPositionChange={onPositionChange} style={{ position: "absolute", bottom: 120, left: 60, right: 20 }}>
          <h1 style={{ color: "#FFFFFF", fontSize: 82, fontWeight: 700, lineHeight: 1.05, margin: 0, marginBottom: 20 }}>{title}</h1>
        </DraggableElement>

        {subtitle && (
          <DraggableElement enabled={draggable} scale={scale} onDragChange={onDragChange} elementId="subtitle" defaultPosition={positions?.subtitle} onPositionChange={onPositionChange} style={{ position: "absolute", bottom: 60, left: 60, right: 20 }}>
            <p style={{ color: "#D4C4F0", fontSize: 28, fontWeight: 400, margin: 0 }}>{subtitle}</p>
          </DraggableElement>
        )}
      </div>

      <div style={{ width: "50%", height: "100%", position: "relative" }}>
        {backgroundUrl ? (
          <img src={backgroundUrl} alt="Background" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)" }} />
        )}
      </div>
    </div>
  );
}
