import { z } from "zod";
import { MAX_INPUT_SEQUENCE } from "./movement.ts";
import { ATTRACTION_IDS, AVATAR_KINDS, type AttractionId } from "./world.ts";

export const PROTOCOL_VERSION = 1;
export const SOCKET_PATH = "/socket.io";
export const MAX_SOCKET_MESSAGE_BYTES = 4096;
export const ROOM_CAPACITY = 5;
export const AVATAR_COLORS = ["marigold", "rose", "mint", "indigo"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];
export const DEFAULT_AVATAR_COLOR: AvatarColor = "marigold";

export const pingSchema = z.strictObject({
  version: z.literal(PROTOCOL_VERSION),
  echo: z.string().max(128),
});

export type PingRequest = z.infer<typeof pingSchema>;
export type RequestError = { ok: false; code: "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type PingResult =
  | { ok: true; version: typeof PROTOCOL_VERSION; echo: string; serverTime: number }
  | RequestError;

const roomRequest = { version: z.literal(PROTOCOL_VERSION) };
const nickname = z.string().max(96).trim().normalize().min(1).max(24)
  .regex(/^[^<>\p{Cc}\u202A-\u202E\u2066-\u2069]+$/u);

const guestProfile = { nickname, color: z.enum(AVATAR_COLORS).default(DEFAULT_AVATAR_COLOR) };
export const inviteCodeSchema = z.string().length(22).regex(/^[A-Za-z0-9_-]+$/);
export const createRoomSchema = z.strictObject({ ...roomRequest, ...guestProfile });
export const joinRoomSchema = z.strictObject({
  ...roomRequest,
  ...guestProfile,
  inviteCode: inviteCodeSchema,
});
export const resumeRoomSchema = z.strictObject({
  ...roomRequest,
  sessionToken: z.string().length(43).regex(/^[A-Za-z0-9_-]+$/),
});
export const leaveRoomSchema = z.strictObject(roomRequest);
export const worldEnterSchema = z.strictObject({
  ...roomRequest,
  avatar: z.enum(AVATAR_KINDS),
});
export const worldLeaveSchema = z.strictObject(roomRequest);
export const playerInputSchema = z.strictObject({
  ...roomRequest,
  sequence: z.number().int().gte(1).lte(MAX_INPUT_SEQUENCE),
  x: z.number().gte(-1).lte(1),
  z: z.number().gte(-1).lte(1),
});
export const attractionInteractSchema = z.strictObject({
  ...roomRequest,
  attraction: z.enum(ATTRACTION_IDS),
});

export interface RoomSnapshot {
  version: typeof PROTOCOL_VERSION;
  roomId: string;
  players: { playerId: string; nickname: string; color: AvatarColor; connected: boolean }[];
}

export type RoomError = {
  ok: false;
  code: "ALREADY_IN_ROOM" | "INVALID_INVITE" | "ROOM_FULL" | "INVALID_SESSION"
    | "SESSION_ACTIVE" | "NOT_IN_ROOM";
};

export type RoomAdmission = {
  ok: true;
  playerId: string;
  inviteCode: string;
  sessionToken: string;
  snapshot: RoomSnapshot;
};

export type RoomAdmissionResult = RoomAdmission | RoomError | RequestError;
export type RoomLeaveResult = { ok: true } | RoomError | RequestError;

export interface PlayerPose {
  playerId: string;
  nickname: string;
  color: AvatarColor;
  avatar: (typeof AVATAR_KINDS)[number];
  x: number;
  z: number;
  yaw: number;
  sequence: number;
  connected: boolean;
}

export interface WorldSnapshot {
  version: typeof PROTOCOL_VERSION;
  roomId: string;
  serverTime: number;
  players: PlayerPose[];
}

export interface EconomySnapshot {
  version: typeof PROTOCOL_VERSION;
  roomId: string;
  playerId: string;
  coins: number;
  inventory: Record<string, number>;
}

export type WorldEnterResult = { ok: true; pose: PlayerPose } | RoomError | RequestError;
export type WorldLeaveResult =
  | { ok: true }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" }
  | RequestError;
export type PlayerInputResult =
  | { ok: true; sequence: number }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" | "STALE_INPUT" | "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type AttractionInteractResult =
  | { ok: true; attraction: AttractionId; label: string; summary: string }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" | "TOO_FAR" | "UNAVAILABLE" | "INVALID_PAYLOAD" | "RATE_LIMITED" };

export interface ClientToServerEvents {
  "transport:ping": (request: PingRequest, acknowledge: (result: PingResult) => void) => void;
  "room:create": (request: z.input<typeof createRoomSchema>, acknowledge: (result: RoomAdmissionResult) => void) => void;
  "room:join": (request: z.input<typeof joinRoomSchema>, acknowledge: (result: RoomAdmissionResult) => void) => void;
  "room:resume": (request: z.input<typeof resumeRoomSchema>, acknowledge: (result: RoomAdmissionResult) => void) => void;
  "room:leave": (request: z.input<typeof leaveRoomSchema>, acknowledge: (result: RoomLeaveResult) => void) => void;
  "world:enter": (request: z.input<typeof worldEnterSchema>, acknowledge: (result: WorldEnterResult) => void) => void;
  "world:leave": (request: z.input<typeof worldLeaveSchema>, acknowledge: (result: WorldLeaveResult) => void) => void;
  "player:input": (request: z.input<typeof playerInputSchema>, acknowledge: (result: PlayerInputResult) => void) => void;
  "attraction:interact": (request: z.input<typeof attractionInteractSchema>, acknowledge: (result: AttractionInteractResult) => void) => void;
}

export interface ServerToClientEvents {
  "room:snapshot": (snapshot: RoomSnapshot) => void;
  "world:snapshot": (snapshot: WorldSnapshot) => void;
  "economy:updated": (snapshot: EconomySnapshot) => void;
}
