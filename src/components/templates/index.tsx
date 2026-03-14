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
}

export const TEMPLATE_NAMES = ["Overlay", "Split", "Minimal", "Foto"];

export function renderTemplate(layout: number, props: TemplateProps) {
  switch (layout) {
    case 0:
      return (
        <OverlayTemplate
          title={props.title}
          logoUrl={props.logoUrl}
          primaryColor={props.primaryColor}
        />
      );
    case 1:
      return (
        <SplitTemplate
          title={props.title}
          subtitle={props.subtitle ?? ""}
          logoUrl={props.logoUrl}
          primaryColor={props.primaryColor}
          backgroundUrl={props.backgroundUrl}
        />
      );
    case 2:
      return (
        <MinimalTemplate
          title={props.title}
          subtitle={props.subtitle ?? ""}
          logoUrl={props.logoUrl}
          primaryColor={props.primaryColor}
        />
      );
    case 3:
      return (
        <PhotoTemplate
          title={props.title}
          logoUrl={props.logoUrl}
          backgroundUrl={props.backgroundUrl}
        />
      );
    default:
      return null;
  }
}
