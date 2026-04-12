import React from "react";
import DraggableElement from "./draggable-element";

interface MinimalProps {
  title: string;
  subtitle: string;
  bodyText?: string;
  logoUrl: string;
  primaryColor: string;
  titleSize?: number;
  subtitleSize?: number;
  bodySize?: number;
  height?: number;
  draggable?: boolean;
  scale?: number;
  positions?: Record<string, { x: number; y: number }>;
  onDragStop?: (elementId: string, position: { x: number; y: number }) => void;
}

export default function MinimalTemplate({
  title,
  subtitle,
  logoUrl,
  primaryColor,
  bodyText,
  titleSize = 72,
  subtitleSize = 28,
  bodySize = 20,
  height = 1080,
  draggable,
  scale,
  positions,
  onDragStop,
}: MinimalProps) {
  return (
    <div
      style={{
        width: 1080,
        height,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
        backgroundColor: "#F8F7FF",
      }}
    >
      {/* Vertical bar left */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 14,
          backgroundColor: primaryColor,
        }}
      />

      {/* Title */}
      <DraggableElement
        elementId="title"
        enabled={draggable}
        scale={scale}
        defaultPosition={positions?.title}
        onDragStop={onDragStop}
        style={{
          position: "absolute",
          top: 120,
          left: 100,
          right: 80,
        }}
      >
        <h1
          style={{
            color: "#1A1A2E",
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.05,
            margin: 0,
            marginBottom: 30,
          }}
        >
          {title}
        </h1>

        {/* Divider */}
        <div
          style={{
            width: 120,
            height: 4,
            backgroundColor: primaryColor,
            marginBottom: 30,
            borderRadius: 2,
          }}
        />

        {/* Subtitle */}
        {subtitle && (
          <p
            style={{
              color: "#6B7280",
              fontSize: subtitleSize,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Body text */}
        {bodyText && (
          <p
            style={{
              color: "#9CA3AF",
              fontSize: bodySize,
              fontWeight: 400,
              lineHeight: 1.5,
              margin: 0,
              marginTop: 16,
            }}
          >
            {bodyText}
          </p>
        )}
      </DraggableElement>

      {/* Logo bottom left */}
      {logoUrl && (
        <DraggableElement
          elementId="logo"
          enabled={draggable}
          scale={scale}
          defaultPosition={positions?.logo}
          onDragStop={onDragStop}
          style={{
            position: "absolute",
            bottom: 60,
            left: 100,
          }}
        >
          <img
            src={logoUrl}
            alt="Logo"
            style={{ maxWidth: 140, maxHeight: 60, objectFit: "contain" }}
            crossOrigin="anonymous"
          />
        </DraggableElement>
      )}
    </div>
  );
}
