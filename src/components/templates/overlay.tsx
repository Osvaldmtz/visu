import React from "react";

interface OverlayProps {
  title: string;
  logoUrl: string;
  primaryColor: string;
  backgroundUrl?: string;
}

export default function OverlayTemplate({ title, logoUrl, primaryColor, backgroundUrl }: OverlayProps) {
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

      {/* Primary color overlay at 45% */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: primaryColor,
          opacity: 0.45,
        }}
      />

      {/* Logo top left */}
      {logoUrl && (
        <div
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
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}
        >
          {title}
        </h1>
      </div>
    </div>
  );
}
