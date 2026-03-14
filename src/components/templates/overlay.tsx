import React from "react";

interface OverlayProps {
  title: string;
  logoUrl: string;
  primaryColor: string;
}

export default function OverlayTemplate({ title, logoUrl, primaryColor }: OverlayProps) {
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
      {/* Deep purple gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, #1a0533 0%, #2d1b69 40%, #1a0533 100%)`,
        }}
      />

      {/* Subtle grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Primary color overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: primaryColor,
          opacity: 0.45,
          mixBlendMode: "overlay",
        }}
      />

      {/* Logo centered */}
      {logoUrl && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={logoUrl}
            alt="Logo"
            style={{ maxWidth: 280, maxHeight: 200, objectFit: "contain" }}
            crossOrigin="anonymous"
          />
        </div>
      )}

      {/* Title at bottom */}
      <div
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
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {title}
        </h1>
      </div>
    </div>
  );
}
