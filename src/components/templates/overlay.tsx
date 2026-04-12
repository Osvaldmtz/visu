import React from "react";
import DraggableElement from "./draggable-element";
import type { OverlayFilter } from "./index";

interface OverlayProps {
  title: string;
  subtitle?: string;
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

export default function OverlayTemplate({ title, subtitle, bodyText, logoUrl, primaryColor, backgroundUrl, overlayFilter = "purple", titleSize = 72, subtitleSize = 28, bodySize = 20, height = 1080, draggable, scale, positions, onDragStop }: OverlayProps) {
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
      {/* Background: photo or gradient */}
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
            background: `linear-gradient(135deg, #1a0533 0%, #2d1b69 40%, #1a0533 100%)`,
          }}
        />
      )}

      {/* Subtle grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

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
            style={{ maxWidth: 160, maxHeight: 80, objectFit: "contain" }}
            crossOrigin="anonymous"
          />
        </DraggableElement>
      )}

      {/* Title at bottom */}
      <DraggableElement
        elementId="title"
        enabled={draggable}
        scale={scale}
        defaultPosition={positions?.title}
        onDragStop={onDragStop}
        style={{
          position: "absolute",
          bottom: 80,
          left: 80,
          right: 80,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            color: "#FFFFFF",
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.1,
            margin: 0,
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: subtitleSize,
              fontWeight: 500,
              margin: 0,
              marginTop: 16,
              textShadow: "0 1px 10px rgba(0,0,0,0.3)",
            }}
          >
            {subtitle}
          </p>
        )}
      </DraggableElement>

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
            bottom: 200,
            left: 80,
            right: 80,
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: bodySize,
              fontWeight: 400,
              lineHeight: 1.5,
              margin: 0,
              textShadow: "0 1px 8px rgba(0,0,0,0.3)",
            }}
          >
            {bodyText}
          </p>
        </DraggableElement>
      )}
    </div>
  );
}
