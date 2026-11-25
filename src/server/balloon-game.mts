import { randomInt, randomUUID } from "node:crypto";
import {
  BALLOON_MIN_HIT_INTERVAL_MS,
  BALLOON_ROUND_MS,
  balloonRewardCoins,
  generateBalloonTargets,
  type BalloonTarget,
} from "../shared/balloon.ts";
import {
  PROTOCOL_VERSION,
  type AvatarColor,
  type BalloonGameState,
  type BalloonScoreEntry,
  type GameHitResult,
  type GameJoinResult,
  type GameLeaveResult,
} from "../shared/protocol.ts";
import { INTERACTION_ZONES } from "../shared/world.ts";
import type { SessionChange, SessionNotice } from "./world.mts";

interface Participant {
  playerId: string;
  nickname: string;
  color: AvatarColor;
  connectionId: string | null;
  targets: Map<string, BalloonTarget>;
  orderedTargets: BalloonTarget[];
  popped: Set<string>;
  score: number;
  rewardCoins: number;
  lastHitAt: number | null;
}

interface RoomRound {
  roomId: string;
  roundId: string;
  phase: "active" | "ended";
  startedAt: number;
  endsAt: number;
  participants: Map<string, Participant>;
  settled: boolean;
}

export class BalloonGameManager {
  private readonly rounds = new Map<string, RoomRound>();
  private readonly playerRoom = new Map<string, string>();
  private readonly roundDurationMs: number;
  private readonly minHitIntervalMs: number;
  private readonly options: {
    now: () => number;
    roundDurationMs?: number;
    minHitIntervalMs?: number;
    seed?: (playerId: string, roundId: string) => number;
    creditReward: (request: { roomId: string; playerId: string; amount: number; transactionId: string }) => void;
    publish: (state: BalloonGameState, connectionId: string) => void;
    isAvailable?: () => boolean;
  };

  constructor(options: {
    now: () => number;
    roundDurationMs?: number;
    minHitIntervalMs?: number;
    seed?: (playerId: string, roundId: string) => number;
    creditReward: (request: { roomId: string; playerId: string; amount: number; transactionId: string }) => void;
    publish: (state: BalloonGameState, connectionId: string) => void;
    isAvailable?: () => boolean;
  }) {
    this.options = options;
    this.roundDurationMs = options.roundDurationMs ?? BALLOON_ROUND_MS;
    this.minHitIntervalMs = options.minHitIntervalMs ?? BALLOON_MIN_HIT_INTERVAL_MS;
  }

  join(session: SessionNotice, playerPose: { x: number; z: number } | null): GameJoinResult {
    if (this.options.isAvailable && !this.options.isAvailable()) {
      return { ok: false, code: "UNAVAILABLE" };
    }
    if (!playerPose) return { ok: false, code: "NOT_IN_WORLD" };

    const stall = INTERACTION_ZONES.balloonStall;
    if (Math.hypot(playerPose.x - stall.anchor[0], playerPose.z - stall.anchor[2]) > stall.radius) {
      return { ok: false, code: "TOO_FAR" };
    }

    const now = this.options.now();
    this.tick(now);

    const activeRoomId = this.playerRoom.get(session.playerId);
    if (activeRoomId) {
      const existingRound = this.rounds.get(activeRoomId);
      if (existingRound && existingRound.phase === "active") {
        return { ok: false, code: "ALREADY_IN_GAME" };
      }
      this.playerRoom.delete(session.playerId);
    }

    let round = this.rounds.get(session.roomId);
    if (!round || round.phase === "ended") {
      round = {
        roomId: session.roomId,
        roundId: randomUUID(),
        phase: "active",
        startedAt: now,
        endsAt: now + this.roundDurationMs,
        participants: new Map(),
        settled: false,
      };
      this.rounds.set(session.roomId, round);
    }

    const seed = this.options.seed ? this.options.seed(session.playerId, round.roundId) : randomInt(1, 0x7fffffff);
    const orderedTargets = generateBalloonTargets(round.roundId, session.playerId, seed, this.roundDurationMs);
    const participant: Participant = {
      playerId: session.playerId,
      nickname: session.nickname,
      color: session.color,
      connectionId: session.connectionId,
      targets: new Map(orderedTargets.map((t) => [t.targetId, t])),
      orderedTargets,
      popped: new Set(),
      score: 0,
      rewardCoins: 0,
      lastHitAt: null,
    };

    round.participants.set(session.playerId, participant);
    this.playerRoom.set(session.playerId, session.roomId);
    this.publishRound(round, now);
    return { ok: true, state: this.stateFor(round, participant, now) };
  }

  hit(playerId: string, roundId: string, targetId: string): GameHitResult {
    const now = this.options.now();
    this.tick(now);

    const roomId = this.playerRoom.get(playerId);
    if (!roomId) return { ok: false, code: "NOT_IN_GAME" };
    const round = this.rounds.get(roomId);
    if (!round) return { ok: false, code: "NOT_IN_GAME" };
    const participant = round.participants.get(playerId);
    if (!participant) return { ok: false, code: "NOT_IN_GAME" };

    if (round.roundId !== roundId || round.phase !== "active" || now >= round.endsAt) {
      return { ok: false, code: "ROUND_ENDED" };
    }

    if (participant.lastHitAt !== null && now - participant.lastHitAt < this.minHitIntervalMs) {
      return { ok: false, code: "HIT_RATE_LIMITED" };
    }

    const target = participant.targets.get(targetId);
    if (!target) return { ok: false, code: "UNKNOWN_TARGET" };
    if (participant.popped.has(targetId)) return { ok: false, code: "DUPLICATE_HIT" };

    const elapsed = now - round.startedAt;
    if (elapsed < target.spawnAtMs) return { ok: false, code: "TOO_EARLY" };
    if (elapsed > target.despawnAtMs) return { ok: false, code: "TOO_LATE" };

    participant.popped.add(targetId);
    participant.lastHitAt = now;
    participant.score += target.points;
    this.publishRound(round, now);
    return { ok: true, targetId, points: target.points, score: participant.score };
  }

  leave(playerId: string): GameLeaveResult {
    const roomId = this.playerRoom.get(playerId);
    if (!roomId) return { ok: false, code: "NOT_IN_GAME" };
    this.removeParticipant(playerId, roomId);
    return { ok: true };
  }

  sync(notice: SessionNotice, change: SessionChange) {
    if (change === "removed" || change === "unbound") {
      const roomId = this.playerRoom.get(notice.playerId);
      if (roomId) this.removeParticipant(notice.playerId, roomId);
    }
  }

  tick(now = this.options.now()) {
    for (const round of this.rounds.values()) {
      if (round.phase === "active" && now >= round.endsAt) {
        this.settleRound(round, now);
      }
    }
  }

  private removeParticipant(playerId: string, roomId: string) {
    this.playerRoom.delete(playerId);
    const round = this.rounds.get(roomId);
    if (!round) return;
    round.participants.delete(playerId);
    if (round.participants.size === 0) {
      this.rounds.delete(roomId);
    } else if (round.phase === "active") {
      this.publishRound(round, this.options.now());
    }
  }

  private settleRound(round: RoomRound, now: number) {
    if (round.settled) return;
    round.phase = "ended";
    round.settled = true;

    for (const participant of round.participants.values()) {
      const reward = balloonRewardCoins(participant.score);
      participant.rewardCoins = reward;
      if (reward > 0) {
        this.options.creditReward({
          roomId: round.roomId,
          playerId: participant.playerId,
          amount: reward,
          transactionId: `balloon:${round.roundId}:${participant.playerId}`,
        });
      }
    }

    this.publishRound(round, now);
  }

  private scoreboard(round: RoomRound): BalloonScoreEntry[] {
    return [...round.participants.values()]
      .map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        color: p.color,
        score: p.score,
        rewardCoins: p.rewardCoins,
      }))
      .sort((a, b) => b.score - a.score || (a.playerId < b.playerId ? -1 : 1));
  }

  private stateFor(round: RoomRound, participant: Participant, now: number): BalloonGameState {
    return {
      version: PROTOCOL_VERSION,
      roomId: round.roomId,
      roundId: round.roundId,
      phase: round.phase,
      startedAt: round.startedAt,
      endsAt: round.endsAt,
      serverTime: now,
      targets: participant.orderedTargets,
      poppedTargetIds: [...participant.popped],
      scoreboard: this.scoreboard(round),
    };
  }

  private publishRound(round: RoomRound, now: number) {
    const board = this.scoreboard(round);
    for (const participant of round.participants.values()) {
      if (!participant.connectionId) continue;
      this.options.publish({
        version: PROTOCOL_VERSION,
        roomId: round.roomId,
        roundId: round.roundId,
        phase: round.phase,
        startedAt: round.startedAt,
        endsAt: round.endsAt,
        serverTime: now,
        targets: participant.orderedTargets,
        poppedTargetIds: [...participant.popped],
        scoreboard: board,
      }, participant.connectionId);
    }
  }
}
