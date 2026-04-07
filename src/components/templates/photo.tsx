import React from "react";
import DraggableElement from "./draggable-element";
import type { OverlayFilter } from "./index";

interface PhotoProps {
  title: string;
  subtitle?: string;
  logoUrl: string;
  backgroundUrl?: string;
  overlayFilter?: OverlayFilter;
  cardOpacity?: number;
  height?: number;
  draggable?: boolean;
  scale?: number;
  positions?: Record<string, { x: number; y: number }>;
  onDragStop?: (elementId: string, position: { x: number; y: number }) => void;
}

export default function PhotoTemplate({
  title,
  subtitle,
  logoUrl,
  backgroundUrl,
  overlayFilter = "none",
  cardOpacity = 0.9,
  height = 1080,
  draggable,
  scale,
  positions,
  onDragStop,
}: PhotoProps) {
  return (
    <div
      style={{
        width: 1080,
        height,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Full background photo */}
      {backgroundUrl ? (
        <img
          src={backgroundUrl}
          alt="Background"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          crossOrigin="anonymous"
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        />
      )}

      {/* Overlay filter */}
      {overlayFilter !== "none" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            ...(overlayFilter === "purple" ? { backgroundColor: "#7C3DE3", opacity: 0.45 } :
              overlayFilter === "dark" ? { backgroundColor: "#000000", opacity: 0.45 } :
              { background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 100%)" }),
          }}
        />
      )}

      {/* White card at bottom */}
      <DraggableElement
        elementId="card"
        enabled={draggable}
        scale={scale}
        defaultPosition={positions?.card}
        onDragStop={onDragStop}
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          right: 40,
        }}
      >
        <div
          style={{
            backgroundColor: `rgba(255, 255, 255, ${cardOpacity})`,
            borderRadius: 24,
            padding: "48px 56px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          <div style={{ flex: 1 }}>
            <h1
              style={{
                color: "#1A1A2E",
                fontSize: 68,
                fontWeight: 700,
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  color: "#6B7280",
                  fontSize: 24,
                  fontWeight: 400,
                  margin: 0,
                  marginTop: 12,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              style={{
                maxWidth: 100,
                maxHeight: 50,
                objectFit: "contain",
                flexShrink: 0,
              }}
              crossOrigin="anonymous"
            />
          )}
        </div>
      </DraggableElement>
    </div>
  );
}
