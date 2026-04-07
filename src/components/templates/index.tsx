import React from "react";
import OverlayTemplate from "./overlay";
import SplitTemplate from "./split";
import MinimalTemplate from "./minimal";
import PhotoTemplate from "./photo";

export type OverlayFilter = "none" | "purple" | "dark" | "gradient";

export interface TemplateProps {
  title: string;
  subtitle?: string;
  logoUrl: string;
  primaryColor: string;
  backgroundUrl?: string;
  overlayFilter?: OverlayFilter;
  cardOpacity?: number;
  height?: number;
  draggable?: boolean;
  scale?: number;
  positions?: Record<string, { x: number; y: number }>;
  onDragStop?: (elementId: string, position: { x: number; y: number }) => void;
}

export const TEMPLATE_NAMES = ["Overlay", "Split", "Minimal", "Foto"];

export function renderTemplate(layout: number, props: TemplateProps) {
  const { onDragStop, positions, ...rest } = props;
  const common = { draggable: rest.draggable, scale: rest.scale, positions, onDragStop, overlayFilter: rest.overlayFilter, cardOpacity: rest.cardOpacity, height: rest.height };
  switch (layout) {
    case 0:
      return (
        <OverlayTemplate
          title={rest.title}
          logoUrl={rest.logoUrl}
          primaryColor={rest.primaryColor}
          backgroundUrl={rest.backgroundUrl}
          {...common}
        />
      );
    case 1:
      return (
        <SplitTemplate
          title={rest.title}
          subtitle={rest.subtitle ?? ""}
          logoUrl={rest.logoUrl}
          primaryColor={rest.primaryColor}
          backgroundUrl={rest.backgroundUrl}
          {...common}
        />
      );
    case 2:
      return (
        <MinimalTemplate
          title={rest.title}
          subtitle={rest.subtitle ?? ""}
          logoUrl={rest.logoUrl}
          primaryColor={rest.primaryColor}
          {...common}
        />
      );
    case 3:
      return (
        <PhotoTemplate
          title={rest.title}
          logoUrl={rest.logoUrl}
          backgroundUrl={rest.backgroundUrl}
          {...common}
        />
      );
    default:
      return null;
  }
}
