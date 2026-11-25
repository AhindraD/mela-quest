import { randomBytes, randomUUID } from "node:crypto";
import {
  DEFAULT_AVATAR_COLOR,
  PROTOCOL_VERSION,
  ROOM_CAPACITY,
  type AvatarColor,
  type RoomAdmission,
  type RoomError,
  type RoomSnapshot,
} from "../shared/protocol.ts";

interface Room {
  id: string;
  inviteCode: string;
  members: Set<Session>;
  emptyUntil: number | null;
}

interface Session {
  token: string;
  playerId: string;
  nickname: string;
  color: AvatarColor;
  room: Room;
  connectionId: string | null;
  reconnectUntil: number | null;
}

interface RoomManagerOptions {
  now: () => number;
  reconnectGraceMs: number;
  emptyRoomTtlMs: number;
  publish: (snapshot: RoomSnapshot, connections: string[]) => void;
}

export class RoomManager {
  private readonly options: RoomManagerOptions;
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<string, Session>();
  private readonly connections = new Map<string, Session>();

  constructor(options: RoomManagerOptions) {
    this.options = options;
  }

  create(connectionId: string, nickname: string, color = DEFAULT_AVATAR_COLOR): RoomAdmission | RoomError {
    if (this.connections.has(connectionId)) return { ok: false, code: "ALREADY_IN_ROOM" };
    let inviteCode: string;
    do {
      inviteCode = randomBytes(16).toString("base64url");
    } while (this.rooms.has(inviteCode));

    const room = { id: randomUUID(), inviteCode, members: new Set<Session>(), emptyUntil: null };
    this.rooms.set(inviteCode, room);
    return this.admit(room, connectionId, nickname, color);
  }

  join(connectionId: string, inviteCode: string, nickname: string, color = DEFAULT_AVATAR_COLOR): RoomAdmission | RoomError {
    if (this.connections.has(connectionId)) return { ok: false, code: "ALREADY_IN_ROOM" };
    const room = this.rooms.get(inviteCode);
    if (!room || !this.expireRoomState(room, this.options.now())) {
      return { ok: false, code: "INVALID_INVITE" };
    }
    if (room.members.size >= ROOM_CAPACITY) return { ok: false, code: "ROOM_FULL" };
    return this.admit(room, connectionId, nickname, color);
  }

  resume(connectionId: string, sessionToken: string): RoomAdmission | RoomError {
    if (this.connections.has(connectionId)) return { ok: false, code: "ALREADY_IN_ROOM" };
    const session = this.sessions.get(sessionToken);
    if (!session) return { ok: false, code: "INVALID_SESSION" };
    this.expireRoomState(session.room, this.options.now());
    if (!this.sessions.has(sessionToken)) return { ok: false, code: "INVALID_SESSION" };
    if (session.connectionId !== null) return { ok: false, code: "SESSION_ACTIVE" };

    this.bind(session, connectionId);
    return this.admission(session);
  }

  disconnect(connectionId: string): void {
    const session = this.connections.get(connectionId);
    if (!session) return;

    this.connections.delete(connectionId);
    session.connectionId = null;
    session.reconnectUntil = this.options.now() + this.options.reconnectGraceMs;
    this.publish(session.room);
  }

  leave(connectionId: string): { ok: true } | RoomError {
    const session = this.connections.get(connectionId);
    if (!session) return { ok: false, code: "NOT_IN_ROOM" };

    const now = this.options.now();
    this.expireRoomState(session.room, now);
    this.remove(session, now);
    this.publish(session.room);
    return { ok: true };
  }

  sweep(): void {
    const now = this.options.now();
    for (const room of this.rooms.values()) {
      this.expireRoomState(room, now);
    }
  }

  private admit(room: Room, connectionId: string, nickname: string, color: AvatarColor): RoomAdmission {
    let token: string;
    do {
      token = randomBytes(32).toString("base64url");
    } while (this.sessions.has(token));

    const session = { token, playerId: randomUUID(), nickname, color, room, connectionId, reconnectUntil: null };
    room.emptyUntil = null;
    room.members.add(session);
    this.sessions.set(token, session);
    this.bind(session, connectionId);
    return this.admission(session);
  }

  private bind(session: Session, connectionId: string): void {
    session.connectionId = connectionId;
    session.reconnectUntil = null;
    this.connections.set(connectionId, session);
    this.publish(session.room);
  }

  private remove(session: Session, endedAt: number): void {
    this.sessions.delete(session.token);
    const { room, connectionId } = session;
    if (connectionId !== null) this.connections.delete(connectionId);
    room.members.delete(session);
    if (room.members.size === 0) room.emptyUntil = endedAt + this.options.emptyRoomTtlMs;
  }

  private expireRoomState(room: Room, now: number): boolean {
    let lastExpiredAt: number | undefined;
    for (const session of room.members) {
      const deadline = session.reconnectUntil;
      if (deadline === null || deadline > now) continue;
      lastExpiredAt = Math.max(lastExpiredAt ?? deadline, deadline);
      this.remove(session, lastExpiredAt);
    }
    if (room.emptyUntil !== null && room.emptyUntil <= now) {
      this.rooms.delete(room.inviteCode);
      return false;
    }
    if (lastExpiredAt !== undefined) this.publish(room);
    return true;
  }

  private snapshot(room: Room): RoomSnapshot {
    return {
      version: PROTOCOL_VERSION,
      roomId: room.id,
      players: Array.from(room.members, ({ playerId, nickname, color, connectionId }) => ({
        playerId, nickname, color, connected: connectionId !== null,
      })),
    };
  }

  private admission(session: Session): RoomAdmission {
    return {
      ok: true,
      playerId: session.playerId,
      sessionToken: session.token,
      inviteCode: session.room.inviteCode,
      snapshot: this.snapshot(session.room),
    };
  }

  private publish(room: Room): void {
    const connections = Array.from(room.members).flatMap(({ connectionId }) =>
      connectionId === null ? [] : [connectionId],
    );
    if (connections.length > 0) this.options.publish(this.snapshot(room), connections);
  }
}
