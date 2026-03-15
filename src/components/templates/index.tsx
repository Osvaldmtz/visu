import React from "react";
import OverlayTemplate from "./overlay";
import SplitTemplate from "./split";
import MinimalTemplate from "./minimal";
import PhotoTemplate from "./photo";

export interface TemplateProps {
  title: string;
  subtitle?: string;
  logoUrl: string;
  primaryColor: string;
  backgroundUrl?: string;
  draggable?: boolean;
  scale?: number;
  onDragChange?: () => void;
}

export const TEMPLATE_NAMES = ["Overlay", "Split", "Minimal", "Foto"];

export function renderTemplate(layout: number, props: TemplateProps) {
  const { onDragChange, ...rest } = props;
  switch (layout) {
    case 0:
      return (
        <OverlayTemplate
          title={rest.title}
          logoUrl={rest.logoUrl}
          primaryColor={rest.primaryColor}
          backgroundUrl={rest.backgroundUrl}
          draggable={rest.draggable}
          scale={rest.scale}
          onDragChange={onDragChange}
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
          draggable={rest.draggable}
          scale={rest.scale}
          onDragChange={onDragChange}
        />
      );
    case 2:
      return (
        <MinimalTemplate
          title={rest.title}
          subtitle={rest.subtitle ?? ""}
          logoUrl={rest.logoUrl}
          primaryColor={rest.primaryColor}
          draggable={rest.draggable}
          scale={rest.scale}
          onDragChange={onDragChange}
        />
      );
    case 3:
      return (
        <PhotoTemplate
          title={rest.title}
          logoUrl={rest.logoUrl}
          backgroundUrl={rest.backgroundUrl}
          draggable={rest.draggable}
          scale={rest.scale}
          onDragChange={onDragChange}
        />
      );
    default:
      return null;
  }
}
