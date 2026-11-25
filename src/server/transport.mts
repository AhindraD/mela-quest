import type { Server as HttpServer } from "node:http";
import { performance } from "node:perf_hooks";
import { Server } from "socket.io";
import type { ZodType } from "zod";
import {
  MAX_SOCKET_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  SOCKET_PATH,
  createRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
  pingSchema,
  resumeRoomSchema,
  type ClientToServerEvents,
  type PingResult,
  type RequestError,
  type ServerToClientEvents,
} from "../shared/protocol.mts";
import { RoomManager } from "./room-manager.mts";

function requestBudget() {
  let startedAt = performance.now();
  let requests = 0;
  return () => {
    const now = performance.now();
    if (now - startedAt >= 1000) {
      startedAt = now;
      requests = 0;
    }
    return ++requests <= 10;
  };
}

function requestHandler<Input, Output>(
  schema: ZodType<Input>,
  withinBudget: () => boolean,
  handle: (payload: Input) => Output,
) {
  return (...args: unknown[]) => {
    // Socket.IO appends the acknowledgment after the arguments sent on the wire.
    const callback = args.at(-1);
    if (typeof callback !== "function") return;
    const reply = callback as (result: Output | RequestError) => void;
    if (!withinBudget()) {
      reply({ ok: false, code: "RATE_LIMITED" });
      return;
    }

    const payload = schema.safeParse(args[0]);
    if (args.length !== 2 || !payload.success) {
      reply({ ok: false, code: "INVALID_PAYLOAD" });
      return;
    }

    reply(handle(payload.data));
  };
}

function roomDuration(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 86_400_000) {
    throw new Error(`${name} must be an integer from 1 to 86400000 milliseconds`);
  }
  return value;
}

export function attachTransport(httpServer: HttpServer) {
  const reconnectGraceMs = roomDuration("MELA_RECONNECT_GRACE_MS", 30_000);
  const emptyRoomTtlMs = roomDuration("MELA_EMPTY_ROOM_TTL_MS", 60_000);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    destroyUpgrade: false,
    allowRequest: ({ headers }, accept) => {
      accept(null, headers.origin === undefined || headers.origin === `http://${headers.host}`);
    },
  });

  const rooms = new RoomManager({
    now: () => performance.now(),
    reconnectGraceMs,
    emptyRoomTtlMs,
    publish(snapshot, connections) {
      for (const connection of connections) {
        io.sockets.sockets.get(connection)?.emit("room:snapshot", snapshot);
      }
    },
  });
  const sweep = setInterval(() => rooms.sweep(), 1000);
  sweep.unref();
  httpServer.once("close", () => clearInterval(sweep));

  io.on("connection", (socket) => {
    const withinRoomBudget = requestBudget();
    const handlePing = requestHandler(pingSchema, requestBudget(), ({ echo }): PingResult =>
      ({ ok: true, version: PROTOCOL_VERSION, echo, serverTime: Date.now() }),
    );
    const create = requestHandler(createRoomSchema, withinRoomBudget, ({ nickname }) =>
      rooms.create(socket.id, nickname),
    );
    const join = requestHandler(joinRoomSchema, withinRoomBudget, ({ nickname, inviteCode }) =>
      rooms.join(socket.id, inviteCode, nickname),
    );
    const resume = requestHandler(resumeRoomSchema, withinRoomBudget, ({ sessionToken }) =>
      rooms.resume(socket.id, sessionToken),
    );
    const leave = requestHandler(leaveRoomSchema, withinRoomBudget, () => rooms.leave(socket.id));

    socket.on("transport:ping", handlePing);
    socket.on("room:create", create);
    socket.on("room:join", join);
    socket.on("room:resume", resume);
    socket.on("room:leave", leave);
    socket.once("disconnect", () => {
      socket.off("transport:ping", handlePing);
      socket.off("room:create", create);
      socket.off("room:join", join);
      socket.off("room:resume", resume);
      socket.off("room:leave", leave);
      rooms.disconnect(socket.id);
    });
  });

  return io;
}
