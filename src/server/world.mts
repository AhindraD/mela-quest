import {
  INPUT_TIMEOUT_MS,
  MAX_INPUT_SEQUENCE,
  SPAWN_YAW,
  facingYaw,
  walk,
} from "../shared/movement.ts";
import {
  PROTOCOL_VERSION,
  type AvatarColor,
  type PlayerPose,
  type WorldSnapshot,
} from "../shared/protocol.ts";
import {
  ATTRACTION_DETAILS,
  INTERACTION_ZONES,
  SPAWN_POSITION,
  type AttractionId,
  type AvatarKind,
} from "../shared/world.ts";

export interface SessionNotice {
  playerId: string;
  roomId: string;
  nickname: string;
  color: AvatarColor;
  connectionId: string | null;
  connections: string[];
}

export type SessionChange = "bound" | "unbound" | "removed";

interface Presence extends SessionNotice {
  avatar: AvatarKind;
  x: number;
  z: number;
  yaw: number;
  sequence: number;
  inputX: number;
  inputZ: number;
  inputAt: number;
  connected: boolean;
}

function pose(player: Presence): PlayerPose {
  return {
    playerId: player.playerId,
    nickname: player.nickname,
    color: player.color,
    avatar: player.avatar,
    x: player.x,
    z: player.z,
    yaw: player.yaw,
    sequence: player.sequence,
    connected: player.connected,
  };
}

export class WorldSimulation {
  private readonly players = new Map<string, Presence>();
  private readonly connections = new Map<string, string[]>();
  private readonly options: {
    now: () => number;
    publish: (snapshot: WorldSnapshot, connections: string[]) => void;
    isAvailable?: (attraction: AttractionId) => boolean;
  };
  private lastTick: number;

  constructor(options: {
    now: () => number;
    publish: (snapshot: WorldSnapshot, connections: string[]) => void;
    isAvailable?: (attraction: AttractionId) => boolean;
  }) {
    this.options = options;
    this.lastTick = options.now();
  }

  sync(notice: SessionNotice, change: SessionChange) {
    if (change === "removed") {
      this.players.delete(notice.playerId);
      this.connections.set(notice.roomId, notice.connections);
      this.publishRoom(notice.roomId);
      const stillHere = [...this.players.values()].some((player) => player.roomId === notice.roomId);
      if (!stillHere) this.connections.delete(notice.roomId);
      return;
    }

    this.connections.set(notice.roomId, notice.connections);
    const player = this.players.get(notice.playerId);
    if (!player) return;
    player.nickname = notice.nickname;
    player.color = notice.color;
    player.connectionId = notice.connectionId;
    player.connected = notice.connectionId !== null;
    if (!player.connected) {
      player.inputX = 0;
      player.inputZ = 0;
    }
    this.publishRoom(notice.roomId);
  }

  enter(notice: SessionNotice, avatar: AvatarKind): PlayerPose {
    this.connections.set(notice.roomId, notice.connections);
    const existing = this.players.get(notice.playerId);
    if (existing) {
      existing.avatar = avatar;
      existing.nickname = notice.nickname;
      existing.color = notice.color;
      existing.connectionId = notice.connectionId;
      existing.connected = notice.connectionId !== null;
      this.publishRoom(notice.roomId);
      return pose(existing);
    }

    const player: Presence = {
      ...notice,
      avatar,
      x: SPAWN_POSITION[0],
      z: SPAWN_POSITION[2],
      yaw: SPAWN_YAW,
      sequence: 0,
      inputX: 0,
      inputZ: 0,
      inputAt: this.options.now(),
      connected: notice.connectionId !== null,
    };
    this.players.set(notice.playerId, player);
    this.publishRoom(notice.roomId);
    return pose(player);
  }

  leave(playerId: string): { ok: true } | { ok: false; code: "NOT_IN_WORLD" } {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, code: "NOT_IN_WORLD" };
    this.players.delete(playerId);
    this.publishRoom(player.roomId);
    return { ok: true };
  }

  input(playerId: string, sequence: number, x: number, z: number):
    | { ok: true; sequence: number }
    | { ok: false; code: "NOT_IN_WORLD" | "STALE_INPUT" | "INVALID_PAYLOAD" } {
    const player = this.players.get(playerId);
    if (!player || !player.connected) return { ok: false, code: "NOT_IN_WORLD" };
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_INPUT_SEQUENCE
      || !Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 1 || Math.abs(z) > 1) {
      return { ok: false, code: "INVALID_PAYLOAD" };
    }
    if (sequence <= player.sequence) return { ok: false, code: "STALE_INPUT" };

    player.sequence = sequence;
    player.inputX = x;
    player.inputZ = z;
    player.inputAt = this.options.now();
    return { ok: true, sequence };
  }

  interact(playerId: string, attraction: AttractionId):
    | { ok: true; attraction: AttractionId; label: string; summary: string }
    | { ok: false; code: "NOT_IN_WORLD" | "TOO_FAR" | "UNAVAILABLE" } {
    const player = this.players.get(playerId);
    if (!player || !player.connected) return { ok: false, code: "NOT_IN_WORLD" };
    if (this.options.isAvailable && !this.options.isAvailable(attraction)) {
      return { ok: false, code: "UNAVAILABLE" };
    }
    const zone = INTERACTION_ZONES[attraction];
    const distance = Math.hypot(player.x - zone.anchor[0], player.z - zone.anchor[2]);
    if (distance > zone.radius) return { ok: false, code: "TOO_FAR" };
    return {
      ok: true,
      attraction,
      label: zone.label,
      summary: ATTRACTION_DETAILS[attraction].summary,
    };
  }

  tick(now = this.options.now()) {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    if (dt > 0) {
      for (const player of this.players.values()) {
        if (!player.connected) continue;
        if (now - player.inputAt > INPUT_TIMEOUT_MS) {
          player.inputX = 0;
          player.inputZ = 0;
        }
        if (player.inputX === 0 && player.inputZ === 0) continue;
        const next = walk(player, { x: player.inputX, z: player.inputZ }, dt);
        if (next === player) continue;
        player.yaw = facingYaw({ x: player.inputX, z: player.inputZ });
        player.x = next.x;
        player.z = next.z;
      }
    }

    const rooms = new Set([...this.players.values()].map((player) => player.roomId));
    for (const roomId of rooms) this.publishRoom(roomId);
  }

  private publishRoom(roomId: string) {
    const targets = this.connections.get(roomId) ?? [];
    if (targets.length === 0) return;
    const players = [...this.players.values()]
      .filter((player) => player.roomId === roomId)
      .map(pose)
      .sort((left, right) => left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0);
    this.options.publish({
      version: PROTOCOL_VERSION,
      roomId,
      serverTime: this.options.now(),
      players,
    }, targets);
  }
}
