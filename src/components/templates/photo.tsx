import React from "react";
import DraggableElement from "./draggable-element";

interface PhotoProps {
  title: string;
  logoUrl: string;
  backgroundUrl?: string;
  draggable?: boolean;
  scale?: number;
}

export default function PhotoTemplate({
  title,
  logoUrl,
  backgroundUrl,
  draggable,
  scale,
}: PhotoProps) {
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

      {/* White card at bottom */}
      <DraggableElement
        enabled={draggable}
        scale={scale}
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          right: 40,
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            borderRadius: 24,
            padding: "48px 56px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          <h1
            style={{
              color: "#1A1A2E",
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.1,
              margin: 0,
              flex: 1,
            }}
          >
            {title}
          </h1>

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
