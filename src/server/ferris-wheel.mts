import {
  PROTOCOL_VERSION,
  type RideBoardResult,
  type RideExitResult,
  type RideState,
} from "../shared/protocol.ts";
import { INTERACTION_ZONES } from "../shared/world.ts";
import type { SessionChange, SessionNotice } from "./world.mts";

export const FERRIS_SEAT_COUNT = 8;
export const FERRIS_PERIOD_MS = 24_000;

export class FerrisWheelManager {
  private readonly seatsByRoom = new Map<string, (string | null)[]>();
  private readonly playerRoom = new Map<string, string>();
  private readonly connectionsByRoom = new Map<string, string[]>();
  private readonly epochMs: number;
  private readonly options: {
    now: () => number;
    publish: (state: RideState, connections: string[]) => void;
    isAvailable?: () => boolean;
  };

  constructor(options: {
    now: () => number;
    publish: (state: RideState, connections: string[]) => void;
    isAvailable?: () => boolean;
  }) {
    this.options = options;
    this.epochMs = options.now();
  }

  board(session: SessionNotice, pose: { x: number; z: number } | null, requestedSeat?: number): RideBoardResult {
    if (this.options.isAvailable && !this.options.isAvailable()) {
      return { ok: false, code: "UNAVAILABLE" };
    }
    if (!pose) return { ok: false, code: "NOT_IN_WORLD" };
    const wheel = INTERACTION_ZONES.ferrisWheel;
    if (Math.hypot(pose.x - wheel.anchor[0], pose.z - wheel.anchor[2]) > wheel.radius) {
      return { ok: false, code: "TOO_FAR" };
    }

    this.connectionsByRoom.set(session.roomId, session.connections);
    const seats = this.ensureRoom(session.roomId);
    if (seats.includes(session.playerId)) {
      return { ok: false, code: "ALREADY_RIDING" };
    }

    let seatIndex = requestedSeat;
    if (seatIndex !== undefined) {
      if (seats[seatIndex] !== null) return { ok: false, code: "SEAT_OCCUPIED" };
    } else {
      seatIndex = seats.indexOf(null);
      if (seatIndex === -1) return { ok: false, code: "WHEEL_FULL" };
    }

    seats[seatIndex] = session.playerId;
    this.playerRoom.set(session.playerId, session.roomId);
    const state = this.state(session.roomId);
    this.options.publish(state, session.connections);
    return { ok: true, seatIndex, state };
  }

  exit(playerId: string): RideExitResult {
    const roomId = this.playerRoom.get(playerId);
    if (!roomId) return { ok: false, code: "NOT_RIDING" };
    this.clearPlayer(playerId, roomId);
    const state = this.state(roomId);
    this.options.publish(state, this.connectionsByRoom.get(roomId) ?? []);
    return { ok: true, state };
  }

  sync(notice: SessionNotice, change: SessionChange) {
    this.connectionsByRoom.set(notice.roomId, notice.connections);
    if (change === "removed" || change === "unbound") {
      const roomId = this.playerRoom.get(notice.playerId);
      if (roomId) {
        this.clearPlayer(notice.playerId, roomId);
        this.options.publish(this.state(roomId), notice.connections);
      }
      if (notice.connections.length === 0) {
        this.seatsByRoom.delete(notice.roomId);
        this.connectionsByRoom.delete(notice.roomId);
      }
      return;
    }

    if (change === "bound" && notice.connectionId) {
      this.options.publish(this.state(notice.roomId), [notice.connectionId]);
    }
  }

  private ensureRoom(roomId: string) {
    let seats = this.seatsByRoom.get(roomId);
    if (!seats) {
      seats = Array.from({ length: FERRIS_SEAT_COUNT }, () => null);
      this.seatsByRoom.set(roomId, seats);
    }
    return seats;
  }

  private clearPlayer(playerId: string, roomId: string) {
    this.playerRoom.delete(playerId);
    const seats = this.seatsByRoom.get(roomId);
    if (!seats) return;
    const index = seats.indexOf(playerId);
    if (index !== -1) seats[index] = null;
  }

  private state(roomId: string): RideState {
    return {
      version: PROTOCOL_VERSION,
      roomId,
      epochMs: this.epochMs,
      periodMs: FERRIS_PERIOD_MS,
      serverTime: this.options.now(),
      seats: [...this.ensureRoom(roomId)],
    };
  }
}
