import React from "react";

interface SplitProps {
  title: string;
  subtitle: string;
  logoUrl: string;
  primaryColor: string;
  backgroundUrl?: string;
}

export default function SplitTemplate({
  title,
  subtitle,
  logoUrl,
  primaryColor,
  backgroundUrl,
}: SplitProps) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
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
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 60,
        }}
      >
        {/* Logo top left */}
        {logoUrl && (
          <div>
            <img
              src={logoUrl}
              alt="Logo"
              style={{ maxWidth: 120, maxHeight: 60, objectFit: "contain" }}
              crossOrigin="anonymous"
            />
          </div>
        )}

        {/* Title + subtitle bottom left */}
        <div>
          <h1
            style={{
              color: "#FFFFFF",
              fontSize: 82,
              fontWeight: 700,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 20,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                color: "#D4C4F0",
                fontSize: 28,
                fontWeight: 400,
                margin: 0,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
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
      </div>
    </div>
  );
}
