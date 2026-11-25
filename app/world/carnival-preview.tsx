"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, type ReactNode } from "react";
import type { AvatarColor } from "../../src/shared/protocol.ts";
import type { AvatarKind } from "../../src/shared/world";
import { PreviewFallback } from "./preview-fallback";

const CarnivalScene = dynamic(() => import("./carnival-scene"), {
  ssr: false,
  loading: () => <p className="world-message" role="status">Loading the 3D carnival…</p>,
});

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <PreviewFallback /> : this.props.children;
  }
}

export function CarnivalPreview({ kind, color, onClose }: {
  kind: AvatarKind;
  color: AvatarColor;
  onClose: () => void;
}) {
  const surface = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <section ref={surface} className="world-preview" aria-labelledby="world-title" aria-describedby="world-controls"
      onPointerDown={() => heading.current?.focus({ preventScroll: true })}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        onClose();
      }}>
      <PreviewBoundary><CarnivalScene surface={surface} kind={kind} color={color} /></PreviewBoundary>
      <div className="world-preview-header">
        <h1 id="world-title" tabIndex={0} ref={heading}>Carnival</h1>
        <p id="world-controls">WASD or arrow keys to move. Esc to return.</p>
      </div>
    </section>
  );
}
