"use client";

import React, { useRef, useState } from "react";
import Draggable from "react-draggable";

interface DraggableElementProps {
  children: React.ReactNode;
  enabled?: boolean;
  scale?: number;
  style?: React.CSSProperties;
  onDragChange?: () => void;
}

export default function DraggableElement({
  children,
  enabled = false,
  scale = 1,
  style,
  onDragChange,
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
      onStart={() => setDragging(true)}
      onStop={() => {
        setDragging(false);
        onDragChange?.();
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
