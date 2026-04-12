import React from "react";
import DraggableElement from "./draggable-element";
import type { OverlayFilter } from "./index";

interface SplitProps {
  title: string;
  subtitle: string;
  bodyText?: string;
  logoUrl: string;
  primaryColor: string;
  backgroundUrl?: string;
  overlayFilter?: OverlayFilter;
  titleSize?: number;
  subtitleSize?: number;
  bodySize?: number;
  height?: number;
  draggable?: boolean;
  scale?: number;
  positions?: Record<string, { x: number; y: number }>;
  onDragStop?: (elementId: string, position: { x: number; y: number }) => void;
}

export default function SplitTemplate({
  title,
  subtitle,
  bodyText,
  logoUrl,
  primaryColor,
  backgroundUrl,
  overlayFilter = "none",
  titleSize = 72,
  subtitleSize = 28,
  bodySize = 20,
  height = 1080,
  draggable,
  scale,
  positions,
  onDragStop,
}: SplitProps) {
  return (
    <div
      style={{
        width: 1080,
        height,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
      }}
    >
      {/* Left half — solid primary color */}
      <div
        style={{
          width: "50%",
          height: "100%",
          backgroundColor: primaryColor,
          position: "relative",
          padding: 60,
        }}
      >
        {/* Logo top left */}
        {logoUrl && (
          <DraggableElement
            elementId="logo"
            enabled={draggable}
            scale={scale}
            defaultPosition={positions?.logo}
            onDragStop={onDragStop}
            style={{
              position: "absolute",
              top: 60,
              left: 60,
            }}
          >
            <img
              src={logoUrl}
              alt="Logo"
              style={{ maxWidth: 120, maxHeight: 60, objectFit: "contain" }}
              crossOrigin="anonymous"
            />
          </DraggableElement>
        )}

        {/* Title bottom left */}
        <DraggableElement
          elementId="title"
          enabled={draggable}
          scale={scale}
          defaultPosition={positions?.title}
          onDragStop={onDragStop}
          style={{
            position: "absolute",
            bottom: 120,
            left: 60,
            right: 20,
          }}
        >
          <h1
            style={{
              color: "#FFFFFF",
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 20,
            }}
          >
            {title}
          </h1>
        </DraggableElement>

        {/* Subtitle */}
        {subtitle && (
          <DraggableElement
            elementId="subtitle"
            enabled={draggable}
            scale={scale}
            defaultPosition={positions?.subtitle}
            onDragStop={onDragStop}
            style={{
              position: "absolute",
              bottom: 60,
              left: 60,
              right: 20,
            }}
          >
            <p
              style={{
                color: "#D4C4F0",
                fontSize: subtitleSize,
                fontWeight: 500,
                margin: 0,
              }}
            >
              {subtitle}
            </p>
          </DraggableElement>
        )}

        {/* Body text */}
        {bodyText && (
          <DraggableElement
            elementId="body"
            enabled={draggable}
            scale={scale}
            defaultPosition={positions?.body}
            onDragStop={onDragStop}
            style={{
              position: "absolute",
              bottom: 160,
              left: 60,
              right: 20,
            }}
          >
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: bodySize,
                fontWeight: 400,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {bodyText}
            </p>
          </DraggableElement>
        )}
      </div>

      {/* Right half — photo or dark gradient */}
      <div
        style={{
          width: "50%",
          height: "100%",
          position: "relative",
        }}
      >
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt="Background"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            crossOrigin="anonymous"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)`,
            }}
          />
        )}
        {/* Overlay filter */}
        {overlayFilter !== "none" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              ...(overlayFilter === "purple" ? { backgroundColor: primaryColor, opacity: 0.45 } :
                overlayFilter === "dark" ? { backgroundColor: "#000000", opacity: 0.45 } :
                { background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 100%)" }),
            }}
          />
        )}
      </div>
    </div>
  );
}
