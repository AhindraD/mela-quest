import { z } from "zod";

export const PROTOCOL_VERSION = 1;
export const SOCKET_PATH = "/socket.io";
export const MAX_SOCKET_MESSAGE_BYTES = 4096;

export const pingSchema = z.strictObject({
  version: z.literal(PROTOCOL_VERSION),
  echo: z.string().max(128),
});

export type PingRequest = z.infer<typeof pingSchema>;
export type PingResult =
  | { ok: true; version: typeof PROTOCOL_VERSION; echo: string; serverTime: number }
  | { ok: false; code: "INVALID_PAYLOAD" | "RATE_LIMITED" };

export interface ClientToServerEvents {
  "transport:ping": (request: PingRequest, acknowledge: (result: PingResult) => void) => void;
}

export type ServerToClientEvents = Record<never, never>;
