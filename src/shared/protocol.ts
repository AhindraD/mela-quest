import { z } from "zod";
import { MAX_INPUT_SEQUENCE } from "./movement.ts";
import type { BalloonTarget } from "./balloon.ts";
import { CATALOG_IDS, type CatalogItemId } from "./catalog.ts";
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
export const gameJoinSchema = z.strictObject(roomRequest);
export const gameLeaveSchema = z.strictObject(roomRequest);
export const gameHitSchema = z.strictObject({
  ...roomRequest,
  roundId: z.string().min(1).max(64),
  targetId: z.string().min(1).max(160),
});
export const rideBoardSchema = z.strictObject({
  ...roomRequest,
  seatIndex: z.number().int().gte(0).lte(7).optional(),
});
export const rideExitSchema = z.strictObject(roomRequest);
export const shopPurchaseSchema = z.strictObject({
  ...roomRequest,
  itemId: z.enum(CATALOG_IDS),
  quantity: z.number().int().gte(1).lte(20).default(1),
  transactionId: z.string().min(1).max(128),
});
export const SUPPORTED_LANGUAGES = ["en-IN", "hi-IN", "ta-IN", "bn-IN", "te-IN", "mr-IN"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const shopChatSchema = z.strictObject({
  ...roomRequest,
  message: z.string().trim().min(1).max(300),
  language: z.enum(SUPPORTED_LANGUAGES).default("en-IN"),
});
export const shopVoiceSchema = z.strictObject({
  ...roomRequest,
  audioBase64: z.string().min(1).max(700_000),
  mimeType: z.string().min(1).max(64),
  language: z.enum(SUPPORTED_LANGUAGES).default("en-IN"),
});
export const fireworksContributeSchema = z.strictObject({
  ...roomRequest,
  amount: z.number().int().gte(1).lte(50),
  transactionId: z.string().min(1).max(128),
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

export interface BalloonScoreEntry {
  playerId: string;
  nickname: string;
  color: AvatarColor;
  score: number;
  rewardCoins: number;
}

export interface BalloonGameState {
  version: typeof PROTOCOL_VERSION;
  roomId: string;
  roundId: string;
  phase: "active" | "ended";
  startedAt: number;
  endsAt: number;
  serverTime: number;
  targets: BalloonTarget[];
  poppedTargetIds: string[];
  scoreboard: BalloonScoreEntry[];
}

export interface RideState {
  version: typeof PROTOCOL_VERSION;
  roomId: string;
  epochMs: number;
  periodMs: number;
  serverTime: number;
  seats: (string | null)[];
}

export interface FeatureFlags {
  balloon_game: boolean;
  ferris_wheel: boolean;
  ai_shopkeeper: boolean;
  fireworks: boolean;
  double_rewards: boolean;
}

export interface FireworksState {
  version: typeof PROTOCOL_VERSION;
  roomId: string;
  pool: number;
  threshold: number;
  activeUntil: number | null;
  cooldownUntil: number | null;
  serverTime: number;
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
export type GameJoinResult =
  | { ok: true; state: BalloonGameState }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" | "TOO_FAR" | "ALREADY_IN_GAME" | "UNAVAILABLE" | "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type GameLeaveResult =
  | { ok: true }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_GAME" | "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type GameHitResult =
  | { ok: true; targetId: string; points: number; score: number }
  | {
    ok: false;
    code:
      | "NOT_IN_ROOM"
      | "NOT_IN_GAME"
      | "ROUND_ENDED"
      | "UNKNOWN_TARGET"
      | "DUPLICATE_HIT"
      | "TOO_EARLY"
      | "TOO_LATE"
      | "HIT_RATE_LIMITED"
      | "INVALID_PAYLOAD"
      | "RATE_LIMITED";
  };
export type RideBoardResult =
  | { ok: true; seatIndex: number; state: RideState }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" | "TOO_FAR" | "ALREADY_RIDING" | "SEAT_OCCUPIED" | "WHEEL_FULL" | "UNAVAILABLE" | "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type RideExitResult =
  | { ok: true; state: RideState }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_RIDING" | "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type ShopPurchaseResult =
  | { ok: true; itemId: CatalogItemId; coins: number; inventory: Record<string, number> }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" | "TOO_FAR" | "UNAVAILABLE" | "INVALID_ITEM" | "INVALID_AMOUNT" | "INVALID_TRANSACTION_ID" | "ROOM_MISMATCH" | "INSUFFICIENT_FUNDS" | "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type ShopChatResult =
  | { ok: true; reply: string; audioBase64?: string; mode: "live" | "mock" }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" | "TOO_FAR" | "UNAVAILABLE" | "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type ShopVoiceResult =
  | { ok: true; transcript: string; reply: string; audioBase64?: string; mode: "live" | "mock" }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" | "TOO_FAR" | "UNAVAILABLE" | "INVALID_PAYLOAD" | "RATE_LIMITED" };
export type FireworksContributeResult =
  | { ok: true; state: FireworksState; started: boolean }
  | { ok: false; code: "NOT_IN_ROOM" | "NOT_IN_WORLD" | "TOO_FAR" | "UNAVAILABLE" | "COOLDOWN" | "INSUFFICIENT_FUNDS" | "INVALID_AMOUNT" | "INVALID_TRANSACTION_ID" | "ROOM_MISMATCH" | "INVALID_PAYLOAD" | "RATE_LIMITED" };

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
  "game:join": (request: z.input<typeof gameJoinSchema>, acknowledge: (result: GameJoinResult) => void) => void;
  "game:hit": (request: z.input<typeof gameHitSchema>, acknowledge: (result: GameHitResult) => void) => void;
  "game:leave": (request: z.input<typeof gameLeaveSchema>, acknowledge: (result: GameLeaveResult) => void) => void;
  "ride:board": (request: z.input<typeof rideBoardSchema>, acknowledge: (result: RideBoardResult) => void) => void;
  "ride:exit": (request: z.input<typeof rideExitSchema>, acknowledge: (result: RideExitResult) => void) => void;
  "shop:purchase": (request: z.input<typeof shopPurchaseSchema>, acknowledge: (result: ShopPurchaseResult) => void) => void;
  "shop:chat": (request: z.input<typeof shopChatSchema>, acknowledge: (result: ShopChatResult) => void) => void;
  "shop:voice": (request: z.input<typeof shopVoiceSchema>, acknowledge: (result: ShopVoiceResult) => void) => void;
  "fireworks:contribute": (request: z.input<typeof fireworksContributeSchema>, acknowledge: (result: FireworksContributeResult) => void) => void;
}

export interface ServerToClientEvents {
  "room:snapshot": (snapshot: RoomSnapshot) => void;
  "world:snapshot": (snapshot: WorldSnapshot) => void;
  "economy:updated": (snapshot: EconomySnapshot) => void;
  "game:state": (state: BalloonGameState) => void;
  "ride:state": (state: RideState) => void;
  "flags:updated": (flags: FeatureFlags) => void;
  "fireworks:started": (state: FireworksState) => void;
}
