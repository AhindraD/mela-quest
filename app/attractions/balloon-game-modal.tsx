"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BalloonGameState, GameHitResult, GameJoinResult } from "../../src/shared/protocol.ts";

export function BalloonGameModal({
  playerId,
  gameState,
  receivedAt,
  onJoin,
  onHit,
  onClose,
}: {
  playerId: string;
  gameState: BalloonGameState | null;
  receivedAt: number;
  onJoin: () => Promise<GameJoinResult>;
  onHit: (roundId: string, targetId: string) => Promise<GameHitResult>;
  onClose: () => void;
}) {
  const startButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [optimisticPopped, setOptimisticPopped] = useState<Set<string>>(() => new Set());
  const [nowMs, setNowMs] = useState(() => performance.now());

  useEffect(() => {
    if (!gameState) {
      startButton.current?.focus();
    } else if (gameState.phase === "ended") {
      closeButton.current?.focus();
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState?.phase !== "active") return;
    const timer = window.setInterval(() => setNowMs(performance.now()), 80);
    return () => window.clearInterval(timer);
  }, [gameState?.phase]);

  const poppedSet = useMemo(
    () => new Set(gameState?.poppedTargetIds ?? []),
    [gameState?.poppedTargetIds],
  );

  async function startRound() {
    setBusy(true);
    setFeedback(null);
    setOptimisticPopped(new Set());
    const result = await onJoin();
    setBusy(false);
    if (!result.ok) {
      setFeedback(result.code === "TOO_FAR" ? "Move closer to the Balloon Stall." : "Could not start the round.");
    }
  }

  async function popBalloon(roundId: string, targetId: string) {
    setOptimisticPopped((prev) => new Set(prev).add(targetId));
    const result = await onHit(roundId, targetId);
    if (result.ok) {
      setFeedback(`+${result.points} pts!`);
    } else {
      setOptimisticPopped((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      if (result.code === "TOO_LATE") setFeedback("Missed! Balloon drifted away.");
    }
  }

  const serverNow = gameState ? gameState.serverTime + Math.max(0, nowMs - receivedAt) : 0;
  const elapsedMs = gameState ? Math.max(0, serverNow - gameState.startedAt) : 0;
  const remainingSeconds = gameState ? Math.max(0, (gameState.endsAt - serverNow) / 1000) : 0;
  const visibleTargets = gameState?.phase === "active"
    ? gameState.targets.filter((target) =>
      elapsedMs >= target.spawnAtMs &&
      elapsedMs <= target.despawnAtMs &&
      !poppedSet.has(target.targetId) &&
      !optimisticPopped.has(target.targetId))
    : [];
  const selfEntry = gameState?.scoreboard.find((entry) => entry.playerId === playerId) ?? null;

  return (
    <div className="world-dialog balloon-dialog" role="dialog" aria-modal="true" aria-labelledby="balloon-game-title">
      <div className="balloon-header">
        <h2 id="balloon-game-title">Balloon Stall</h2>
        {gameState?.phase === "active" && (
          <p className="balloon-timer" role="status" aria-label="Time remaining">
            {remainingSeconds.toFixed(1)}s
          </p>
        )}
      </div>

      {!gameState && (
        <>
          <p>Pop festive balloons before they drift away. Marigold balloons award 20 points; others award 10.</p>
          {feedback && <p className="lobby-alert" role="alert">{feedback}</p>}
          <div className="world-dialog-actions">
            <button ref={startButton} type="button" className="lobby-primary" disabled={busy} onClick={() => void startRound()}>
              {busy ? "Starting…" : "Start round"}
            </button>
            <button ref={closeButton} type="button" className="lobby-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}

      {gameState?.phase === "active" && (
        <>
          <div className="balloon-stats">
            <p>Your score: <strong>{selfEntry?.score ?? 0}</strong></p>
            {feedback && <p className="balloon-feedback" role="status">{feedback}</p>}
          </div>
          <div className="balloon-stage" aria-label="Balloon targets">
            {visibleTargets.map((target) => (
              <button
                key={target.targetId}
                type="button"
                className={`balloon-target balloon-target-${target.color}`}
                style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
                aria-label={`Pop ${target.color} balloon (${target.points} pts)`}
                onClick={() => void popBalloon(gameState.roundId, target.targetId)}
              >
                {target.points}
              </button>
            ))}
          </div>
          <div className="balloon-scoreboard">
            <h3>Scoreboard</h3>
            <ul aria-label="Balloon scoreboard">
              {gameState.scoreboard.map((entry) => (
                <li key={entry.playerId}>
                  <span className={`avatar-dot avatar-${entry.color}`} aria-hidden="true" />
                  <span>{entry.nickname}</span>
                  <strong>{entry.score} pts</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="world-dialog-actions">
            <button ref={closeButton} type="button" className="lobby-secondary" onClick={onClose}>
              Leave game
            </button>
          </div>
        </>
      )}

      {gameState?.phase === "ended" && (
        <>
          <p role="status">
            Round complete! Final score: <strong>{selfEntry?.score ?? 0}</strong> pts
            {" · "}Earned <strong>{selfEntry?.rewardCoins ?? 0}</strong> coins
          </p>
          <div className="balloon-scoreboard">
            <h3>Final scoreboard</h3>
            <ul aria-label="Balloon scoreboard">
              {gameState.scoreboard.map((entry) => (
                <li key={entry.playerId}>
                  <span className={`avatar-dot avatar-${entry.color}`} aria-hidden="true" />
                  <span>{entry.nickname}</span>
                  <strong>{entry.score} pts (+{entry.rewardCoins} coins)</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="world-dialog-actions">
            <button type="button" className="lobby-primary" disabled={busy} onClick={() => void startRound()}>
              {busy ? "Starting…" : "Play again"}
            </button>
            <button ref={closeButton} type="button" className="lobby-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}
