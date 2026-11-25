import type { Server as HttpServer } from "node:http";
import { performance } from "node:perf_hooks";
import { Server } from "socket.io";
import type { ZodType } from "zod";
import { BALLOON_HIT_RATE_LIMIT } from "../shared/balloon.ts";
import { INPUT_RATE, SNAPSHOT_INTERVAL_MS } from "../shared/movement.ts";
import {
  MAX_SOCKET_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  SOCKET_PATH,
  attractionInteractSchema,
  createRoomSchema,
  gameHitSchema,
  gameJoinSchema,
  gameLeaveSchema,
  joinRoomSchema,
  leaveRoomSchema,
  pingSchema,
  playerInputSchema,
  resumeRoomSchema,
  worldEnterSchema,
  worldLeaveSchema,
  type ClientToServerEvents,
  type PingResult,
  type RequestError,
  type ServerToClientEvents,
} from "../shared/protocol.ts";
import { BalloonGameManager } from "./balloon-game.mts";
import { EconomyManager } from "./economy.mts";
import { RoomManager } from "./room-manager.mts";
import { WorldSimulation } from "./world.mts";

function requestBudget(limit = 10) {
  let startedAt = performance.now();
  let requests = 0;
  return () => {
    const now = performance.now();
    if (now - startedAt >= 1000) {
      startedAt = now;
      requests = 0;
    }
    return ++requests <= limit;
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
  const balloonRoundMs = roomDuration("MELA_BALLOON_ROUND_MS", 30_000);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    destroyUpgrade: false,
    allowRequest: ({ headers }, accept) => {
      accept(null, headers.origin === undefined || headers.origin === `http://${headers.host}`);
    },
  });

  const now = () => performance.now();
  const world = new WorldSimulation({
    now,
    publish(snapshot, connections) {
      for (const connection of connections) {
        io.sockets.sockets.get(connection)?.emit("world:snapshot", snapshot);
      }
    },
  });
  const economy = new EconomyManager({
    publish(snapshot, connectionId) {
      io.sockets.sockets.get(connectionId)?.emit("economy:updated", snapshot);
    },
  });
  const balloon = new BalloonGameManager({
    now,
    roundDurationMs: balloonRoundMs,
    creditReward: (request) => economy.credit(request),
    publish(state, connectionId) {
      io.sockets.sockets.get(connectionId)?.emit("game:state", state);
    },
  });
  const rooms = new RoomManager({
    now,
    reconnectGraceMs,
    emptyRoomTtlMs,
    onSession(notice, change) {
      world.sync(notice, change);
      economy.sync(notice, change);
      balloon.sync(notice, change);
    },
    publish(snapshot, connections) {
      for (const connection of connections) {
        io.sockets.sockets.get(connection)?.emit("room:snapshot", snapshot);
      }
    },
  });
  const sweep = setInterval(() => rooms.sweep(), 1000);
  const movement = setInterval(() => world.tick(), SNAPSHOT_INTERVAL_MS);
  const games = setInterval(() => balloon.tick(), 250);
  sweep.unref();
  movement.unref();
  games.unref();
  httpServer.once("close", () => {
    clearInterval(sweep);
    clearInterval(movement);
    clearInterval(games);
  });

  io.on("connection", (socket) => {
    const withinRoomBudget = requestBudget();
    const handlePing = requestHandler(pingSchema, requestBudget(), ({ echo }): PingResult =>
      ({ ok: true, version: PROTOCOL_VERSION, echo, serverTime: Date.now() }),
    );
    const create = requestHandler(createRoomSchema, withinRoomBudget, ({ nickname, color }) =>
      rooms.create(socket.id, nickname, color),
    );
    const join = requestHandler(joinRoomSchema, withinRoomBudget, ({ nickname, inviteCode, color }) =>
      rooms.join(socket.id, inviteCode, nickname, color),
    );
    const resume = requestHandler(resumeRoomSchema, withinRoomBudget, ({ sessionToken }) =>
      rooms.resume(socket.id, sessionToken),
    );
    const leave = requestHandler(leaveRoomSchema, withinRoomBudget, () => rooms.leave(socket.id));
    const enterWorld = requestHandler(worldEnterSchema, withinRoomBudget, ({ avatar }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return { ok: true as const, pose: world.enter(session, avatar) };
    });
    const leaveWorld = requestHandler(worldLeaveSchema, withinRoomBudget, () => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return world.leave(session.playerId);
    });
    const move = requestHandler(playerInputSchema, requestBudget(INPUT_RATE), ({ sequence, x, z }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return world.input(session.playerId, sequence, x, z);
    });
    const interact = requestHandler(attractionInteractSchema, withinRoomBudget, ({ attraction }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return world.interact(session.playerId, attraction);
    });
    const joinGame = requestHandler(gameJoinSchema, withinRoomBudget, () => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return balloon.join(session, world.pose(session.playerId));
    });
    const hitGame = requestHandler(gameHitSchema, requestBudget(BALLOON_HIT_RATE_LIMIT), ({ roundId, targetId }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return balloon.hit(session.playerId, roundId, targetId);
    });
    const leaveGame = requestHandler(gameLeaveSchema, withinRoomBudget, () => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return balloon.leave(session.playerId);
    });

    socket.on("transport:ping", handlePing);
    socket.on("room:create", create);
    socket.on("room:join", join);
    socket.on("room:resume", resume);
    socket.on("room:leave", leave);
    socket.on("world:enter", enterWorld);
    socket.on("world:leave", leaveWorld);
    socket.on("player:input", move);
    socket.on("attraction:interact", interact);
    socket.on("game:join", joinGame);
    socket.on("game:hit", hitGame);
    socket.on("game:leave", leaveGame);
    socket.once("disconnect", () => {
      socket.off("transport:ping", handlePing);
      socket.off("room:create", create);
      socket.off("room:join", join);
      socket.off("room:resume", resume);
      socket.off("room:leave", leave);
      socket.off("world:enter", enterWorld);
      socket.off("world:leave", leaveWorld);
      socket.off("player:input", move);
      socket.off("attraction:interact", interact);
      socket.off("game:join", joinGame);
      socket.off("game:hit", hitGame);
      socket.off("game:leave", leaveGame);
      rooms.disconnect(socket.id);
    });
  });

  return io;
}
