"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import type { GroundPoint } from "../../src/shared/movement";
import type { AvatarColor, PlayerPose, WorldSnapshot } from "../../src/shared/protocol.ts";
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

export function CarnivalPreview({ kind, color, playerId, world, enterWorld, leaveWorld, sendInput, onClose }: {
  kind: AvatarKind;
  color: AvatarColor;
  playerId: string;
  world: WorldSnapshot | null;
  enterWorld: (avatar: AvatarKind) => Promise<PlayerPose | null>;
  leaveWorld: () => Promise<void>;
  sendInput: (sequence: number, x: number, z: number) => void;
  onClose: () => void;
}) {
  const surface = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  const sequence = useRef(0);
  const request = useRef(0);
  const [initial, setInitial] = useState<(GroundPoint & { yaw: number }) | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    const ticket = ++request.current;
    void enterWorld(kind).then((pose) => {
      if (ticket !== request.current) return;
      if (!pose) {
        onCloseRef.current();
        return;
      }
      setInitial((current) => current ?? { x: pose.x, z: pose.z, yaw: pose.yaw });
    });
    return () => {
      request.current += 1;
    };
  }, [enterWorld, kind]);

  useEffect(() => () => {
    void leaveWorld();
  }, [leaveWorld]);

  const self = world?.players.find((player) => player.playerId === playerId) ?? null;
  const remotes = world?.players.filter((player) => player.playerId !== playerId) ?? [];

  function onInput(input: GroundPoint) {
    sequence.current += 1;
    sendInput(sequence.current, input.x, input.z);
  }

  return (
    <section ref={surface} className="world-preview" aria-labelledby="world-title" aria-describedby="world-controls"
      onPointerDown={() => heading.current?.focus({ preventScroll: true })}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        onClose();
      }}>
      <PreviewBoundary>
        {initial ? <CarnivalScene surface={surface} kind={kind} color={color} initial={initial}
          authoritative={self ? { x: self.x, z: self.z, yaw: self.yaw } : null}
          remotes={remotes} onInput={onInput} /> : (
          <p className="world-message" role="status">Loading the 3D carnival…</p>
        )}
      </PreviewBoundary>
      <div className="world-preview-header">
        <h1 id="world-title" tabIndex={0} ref={heading}>Carnival</h1>
        <p id="world-controls">WASD or arrow keys to move. Esc to return.</p>
      </div>
    </section>
  );
}
