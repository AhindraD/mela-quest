"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, type ReactNode } from "react";
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

export function CarnivalPreview() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <section className="world-preview" aria-labelledby="world-title">
      <PreviewBoundary><CarnivalScene /></PreviewBoundary>
      <h1 id="world-title" tabIndex={-1} ref={heading}>Carnival preview</h1>
    </section>
  );
}
