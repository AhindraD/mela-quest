"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { GroundPoint } from "../../src/shared/movement";
import type {
  AttractionInteractResult,
  AvatarColor,
  BalloonGameState,
  GameHitResult,
  GameJoinResult,
  PlayerPose,
  RoomSnapshot,
  WorldSnapshot,
} from "../../src/shared/protocol.ts";
import { nearestAttraction, type AttractionId, type AvatarKind } from "../../src/shared/world";
import { BalloonGameModal } from "../attractions/balloon-game-modal";
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

export function CarnivalPreview({
  kind, color, playerId, roster, coins, balloonGame, balloonGameAt, world, enterWorld, leaveWorld,
  sendInput, interactAttraction, joinBalloonGame, hitBalloonTarget, leaveBalloonGame, onClose,
}: {
  kind: AvatarKind;
  color: AvatarColor;
  playerId: string;
  roster: RoomSnapshot["players"];
  coins: number;
  balloonGame: BalloonGameState | null;
  balloonGameAt: number;
  world: WorldSnapshot | null;
  enterWorld: (avatar: AvatarKind) => Promise<PlayerPose | null>;
  leaveWorld: () => Promise<void>;
  sendInput: (sequence: number, x: number, z: number) => void;
  interactAttraction: (attraction: AttractionId) => Promise<AttractionInteractResult>;
  joinBalloonGame: () => Promise<GameJoinResult>;
  hitBalloonTarget: (roundId: string, targetId: string) => Promise<GameHitResult>;
  leaveBalloonGame: () => Promise<void>;
  onClose: () => void;
}) {
  const surface = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const closeDialogButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const sequence = useRef(0);
  const request = useRef(0);
  const [initial, setInitial] = useState<(GroundPoint & { yaw: number }) | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<{ attraction: AttractionId; label: string; summary: string } | null>(null);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);

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
  const nearby = self ? nearestAttraction(self.x, self.z) : null;

  useEffect(() => {
    if (activeOverlay) closeDialogButton.current?.focus();
  }, [activeOverlay]);

  const openAttraction = useCallback(async (attraction: AttractionId) => {
    const result = await interactAttraction(attraction);
    if (result.ok) {
      setInteractionNotice(null);
      setActiveOverlay(result);
    } else if (result.code === "TOO_FAR") {
      setInteractionNotice("Move closer to the attraction to interact.");
    } else if (result.code === "UNAVAILABLE") {
      setInteractionNotice("This attraction is currently unavailable.");
    }
  }, [interactAttraction]);

  const closeOverlay = useCallback(() => {
    if (activeOverlay?.attraction === "balloonStall") {
      void leaveBalloonGame();
    }
    setActiveOverlay(null);
    heading.current?.focus({ preventScroll: true });
  }, [activeOverlay?.attraction, leaveBalloonGame]);

  function onInput(input: GroundPoint) {
    sequence.current += 1;
    sendInput(sequence.current, input.x, input.z);
  }

  return (
    <section ref={surface} className="world-preview" aria-labelledby="world-title" aria-describedby="world-controls"
      onPointerDown={() => {
        if (!activeOverlay) heading.current?.focus({ preventScroll: true });
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Escape") {
          event.preventDefault();
          if (activeOverlay) closeOverlay();
          else onClose();
          return;
        }
        if ((event.key === "e" || event.key === "E") && !event.repeat &&
          !event.altKey && !event.ctrlKey && !event.metaKey && !activeOverlay && nearby) {
          const active = document.activeElement;
          if (active instanceof HTMLElement && active.closest("input, textarea, select, [role='textbox']")) return;
          event.preventDefault();
          void openAttraction(nearby.id);
        }
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
        <p id="world-controls">WASD or arrow keys to move. E to interact. Esc to return.</p>
      </div>
      <div className="world-hud" aria-label="Carnival HUD">
        <p className="world-hud-pill" aria-label={`Coins: ${coins}`}>Coins: {coins}</p>
        <ul className="world-hud-roster" aria-label="Carnival roster">
          {roster.map((guest) => (
            <li key={guest.playerId}>
              <span className={`avatar-dot avatar-${guest.color}`} aria-hidden="true" />
              <span>{guest.nickname}</span>
            </li>
          ))}
        </ul>
      </div>
      {nearby && !activeOverlay && (
        <div className="world-prompt" role="status">
          <button type="button" className="world-prompt-button" onClick={() => void openAttraction(nearby.id)}>
            Press E to open {nearby.label}
          </button>
          {interactionNotice && <p className="lobby-alert">{interactionNotice}</p>}
        </div>
      )}
      {activeOverlay && (
        <div className="world-dialog-backdrop">
          {activeOverlay.attraction === "balloonStall" ? (
            <BalloonGameModal
              playerId={playerId}
              gameState={balloonGame}
              receivedAt={balloonGameAt}
              onJoin={joinBalloonGame}
              onHit={hitBalloonTarget}
              onClose={closeOverlay}
            />
          ) : (
            <div className="world-dialog" role="dialog" aria-modal="true" aria-labelledby="attraction-dialog-title">
              <h2 id="attraction-dialog-title">{activeOverlay.label}</h2>
              <p>{activeOverlay.summary}</p>
              <div className="world-dialog-actions">
                <button ref={closeDialogButton} type="button" className="lobby-secondary" onClick={closeOverlay}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
