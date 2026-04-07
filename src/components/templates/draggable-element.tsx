"use client";

import React, { useRef, useState } from "react";
import Draggable from "react-draggable";

interface DraggableElementProps {
  children: React.ReactNode;
  elementId?: string;
  enabled?: boolean;
  scale?: number;
  style?: React.CSSProperties;
  defaultPosition?: { x: number; y: number };
  onDragStop?: (elementId: string, position: { x: number; y: number }) => void;
}

export default function DraggableElement({
  children,
  elementId = "",
  enabled = false,
  scale = 1,
  style,
  defaultPosition,
  onDragStop,
}: DraggableElementProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (!enabled) {
    return <div style={style}>{children}</div>;
  }

  return (
    <Draggable
      nodeRef={nodeRef as any}
      bounds="parent"
      scale={scale}
      defaultPosition={defaultPosition ?? { x: 0, y: 0 }}
      onStart={() => setDragging(true)}
      onStop={(_e, data) => {
        setDragging(false);
        onDragStop?.(elementId, { x: data.x, y: data.y });
      }}
    >
      <div
        ref={nodeRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...style,
          cursor: dragging ? "grabbing" : "grab",
          outline: hovered || dragging ? "2px dashed rgba(255,255,255,0.4)" : "none",
          outlineOffset: 4,
          userSelect: "none",
          zIndex: dragging ? 50 : undefined,
        }}
      >
        {children}
      </div>
    </Draggable>
  );
}
