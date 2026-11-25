import type { AvatarColor } from "./protocol.ts";

export const BALLOON_ROUND_MS = 30_000;
export const BALLOON_TARGET_COUNT = 24;
export const BALLOON_TARGET_LIFETIME_MS = 3_200;
export const BALLOON_MIN_HIT_INTERVAL_MS = 80;
export const BALLOON_HIT_RATE_LIMIT = 15;

export interface BalloonTarget {
  targetId: string;
  spawnAtMs: number;
  despawnAtMs: number;
  x: number;
  y: number;
  color: AvatarColor;
  points: number;
}

const TARGET_COLORS: readonly AvatarColor[] = ["marigold", "rose", "mint", "indigo"];

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateBalloonTargets(
  roundId: string,
  playerId: string,
  seed: number,
  roundDurationMs = BALLOON_ROUND_MS,
): BalloonTarget[] {
  const rand = mulberry32(seed);
  const targets: BalloonTarget[] = [];
  const usableWindow = Math.max(1_000, roundDurationMs - BALLOON_TARGET_LIFETIME_MS);
  for (let i = 0; i < BALLOON_TARGET_COUNT; i++) {
    const baseSpawn = Math.floor((i / BALLOON_TARGET_COUNT) * usableWindow);
    const jitter = Math.floor(rand() * 450);
    const spawnAtMs = Math.min(usableWindow, baseSpawn + jitter);
    const despawnAtMs = Math.min(roundDurationMs, spawnAtMs + BALLOON_TARGET_LIFETIME_MS);
    const color = TARGET_COLORS[Math.floor(rand() * TARGET_COLORS.length)]!;
    const points = color === "marigold" ? 20 : 10;
    targets.push({
      targetId: `${roundId}:${playerId}:${i}`,
      spawnAtMs,
      despawnAtMs,
      x: 0.12 + rand() * 0.76,
      y: 0.18 + rand() * 0.62,
      color,
      points,
    });
  }
  return targets;
}

export function balloonRewardCoins(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(60, Math.max(5, Math.floor(score / 10) * 2));
}
