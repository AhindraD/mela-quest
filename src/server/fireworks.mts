import {
  PROTOCOL_VERSION,
  type FireworksContributeResult,
  type FireworksState,
} from "../shared/protocol.ts";
import { INTERACTION_ZONES } from "../shared/world.ts";
import type { EconomyMutationResult } from "./economy.mts";
import type { SessionChange, SessionNotice } from "./world.mts";

export const FIREWORKS_THRESHOLD = 20;
export const FIREWORKS_DURATION_MS = 10_000;
export const FIREWORKS_COOLDOWN_MS = 15_000;

interface RoomFireworks {
  pool: number;
  activeUntil: number | null;
  cooldownUntil: number | null;
}

export class FireworksManager {
  private readonly rooms = new Map<string, RoomFireworks>();
  private readonly connectionsByRoom = new Map<string, string[]>();
  private readonly options: {
    now: () => number;
    debit: (request: { roomId: string; playerId: string; amount: number; transactionId: string }) => EconomyMutationResult;
    publish: (state: FireworksState, connections: string[]) => void;
    isAvailable?: () => boolean;
  };

  constructor(options: {
    now: () => number;
    debit: (request: { roomId: string; playerId: string; amount: number; transactionId: string }) => EconomyMutationResult;
    publish: (state: FireworksState, connections: string[]) => void;
    isAvailable?: () => boolean;
  }) {
    this.options = options;
  }

  contribute(
    session: SessionNotice,
    pose: { x: number; z: number } | null,
    amount: number,
    transactionId: string,
  ): FireworksContributeResult {
    if (this.options.isAvailable && !this.options.isAvailable()) {
      return { ok: false, code: "UNAVAILABLE" };
    }
    if (!pose) return { ok: false, code: "NOT_IN_WORLD" };
    const fountain = INTERACTION_ZONES.fountain;
    if (Math.hypot(pose.x - fountain.anchor[0], pose.z - fountain.anchor[2]) > fountain.radius) {
      return { ok: false, code: "TOO_FAR" };
    }

    const now = this.options.now();
    this.connectionsByRoom.set(session.roomId, session.connections);
    const room = this.ensureRoom(session.roomId);
    if (room.cooldownUntil !== null && now < room.cooldownUntil) {
      return { ok: false, code: "COOLDOWN" };
    }

    const debit = this.options.debit({
      roomId: session.roomId,
      playerId: session.playerId,
      amount,
      transactionId,
    });
    if (!debit.ok) {
      return { ok: false, code: debit.code === "INVALID_ITEM" ? "INVALID_AMOUNT" : debit.code };
    }

    room.pool += amount;
    let started = false;
    if (room.pool >= FIREWORKS_THRESHOLD) {
      room.pool = 0;
      room.activeUntil = now + FIREWORKS_DURATION_MS;
      room.cooldownUntil = now + FIREWORKS_COOLDOWN_MS;
      started = true;
    }

    const state = this.state(session.roomId, now);
    this.options.publish(state, session.connections);
    return { ok: true, state, started };
  }

  sync(notice: SessionNotice, change: SessionChange) {
    this.connectionsByRoom.set(notice.roomId, notice.connections);
    if (change === "removed" && notice.connections.length === 0) {
      this.rooms.delete(notice.roomId);
      this.connectionsByRoom.delete(notice.roomId);
    } else if (change === "bound" && notice.connectionId) {
      this.options.publish(this.state(notice.roomId, this.options.now()), [notice.connectionId]);
    }
  }

  private ensureRoom(roomId: string): RoomFireworks {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { pool: 0, activeUntil: null, cooldownUntil: null };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  private state(roomId: string, now: number): FireworksState {
    const room = this.ensureRoom(roomId);
    return {
      version: PROTOCOL_VERSION,
      roomId,
      pool: room.pool,
      threshold: FIREWORKS_THRESHOLD,
      activeUntil: room.activeUntil && now < room.activeUntil ? room.activeUntil : null,
      cooldownUntil: room.cooldownUntil && now < room.cooldownUntil ? room.cooldownUntil : null,
      serverTime: now,
    };
  }
}
