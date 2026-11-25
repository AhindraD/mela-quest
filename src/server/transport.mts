import type { Server as HttpServer } from "node:http";
import { performance } from "node:perf_hooks";
import { Server } from "socket.io";
import type { ZodType } from "zod";
import { FlagsmithAdapter } from "../integrations/flagsmith.mts";
import { sarvamShopChat, sarvamShopVoice } from "../integrations/sarvam.mts";
import { BALLOON_HIT_RATE_LIMIT } from "../shared/balloon.ts";
import { INPUT_RATE, SNAPSHOT_INTERVAL_MS } from "../shared/movement.ts";
import {
  MAX_SOCKET_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  SOCKET_PATH,
  attractionInteractSchema,
  createRoomSchema,
  fireworksContributeSchema,
  gameHitSchema,
  gameJoinSchema,
  gameLeaveSchema,
  joinRoomSchema,
  leaveRoomSchema,
  pingSchema,
  playerInputSchema,
  resumeRoomSchema,
  rideBoardSchema,
  rideExitSchema,
  shopChatSchema,
  shopPurchaseSchema,
  shopVoiceSchema,
  worldEnterSchema,
  worldLeaveSchema,
  type ClientToServerEvents,
  type PingResult,
  type RequestError,
  type ServerToClientEvents,
} from "../shared/protocol.ts";
import { INTERACTION_ZONES } from "../shared/world.ts";
import { BalloonGameManager } from "./balloon-game.mts";
import { EconomyManager } from "./economy.mts";
import { FerrisWheelManager } from "./ferris-wheel.mts";
import { FireworksManager } from "./fireworks.mts";
import { recordFlagsmithRefresh, recordSarvamRequest, recordSocketEvent } from "../shared/metrics.ts";
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

    recordSocketEvent();
    reply(handle(payload.data));
  };
}

function asyncRequestHandler<Input, Output>(
  schema: ZodType<Input>,
  withinBudget: () => boolean,
  handle: (payload: Input) => Promise<Output>,
) {
  return (...args: unknown[]) => {
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

    recordSocketEvent();
    void handle(payload.data).then(reply, () => reply({ ok: false, code: "INVALID_PAYLOAD" }));
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
  const flagsmith = new FlagsmithAdapter((flags) => {
    io.emit("flags:updated", flags);
  });
  void flagsmith.refresh();

  const world = new WorldSimulation({
    now,
    publish(snapshot, connections) {
      for (const connection of connections) {
        io.sockets.sockets.get(connection)?.emit("world:snapshot", snapshot);
      }
    },
    isAvailable(attraction) {
      const flags = flagsmith.getFlags();
      if (attraction === "balloonStall") return flags.balloon_game;
      if (attraction === "ferrisWheel") return flags.ferris_wheel;
      if (attraction === "fountain") return flags.fireworks;
      return true;
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
    isAvailable: () => flagsmith.getFlags().balloon_game,
    creditReward(request) {
      const multiplier = flagsmith.getFlags().double_rewards ? 2 : 1;
      economy.credit({ ...request, amount: request.amount * multiplier });
    },
    publish(state, connectionId) {
      io.sockets.sockets.get(connectionId)?.emit("game:state", state);
    },
  });
  const ferris = new FerrisWheelManager({
    now,
    isAvailable: () => flagsmith.getFlags().ferris_wheel,
    publish(state, connections) {
      for (const connection of connections) {
        io.sockets.sockets.get(connection)?.emit("ride:state", state);
      }
    },
  });
  const fireworks = new FireworksManager({
    now,
    isAvailable: () => flagsmith.getFlags().fireworks,
    debit: (request) => economy.debit(request),
    publish(state, connections) {
      for (const connection of connections) {
        io.sockets.sockets.get(connection)?.emit("fireworks:started", state);
      }
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
      ferris.sync(notice, change);
      fireworks.sync(notice, change);
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
  const flagsPoll = setInterval(() => {
    recordFlagsmithRefresh();
    void flagsmith.refresh();
  }, 15_000);
  sweep.unref();
  movement.unref();
  games.unref();
  flagsPoll.unref();
  httpServer.once("close", () => {
    clearInterval(sweep);
    clearInterval(movement);
    clearInterval(games);
    clearInterval(flagsPoll);
  });

  io.on("connection", (socket) => {
    socket.emit("flags:updated", flagsmith.getFlags());
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
    const boardRide = requestHandler(rideBoardSchema, withinRoomBudget, ({ seatIndex }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return ferris.board(session, world.pose(session.playerId), seatIndex);
    });
    const exitRide = requestHandler(rideExitSchema, withinRoomBudget, () => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return ferris.exit(session.playerId);
    });
    const purchaseShop = requestHandler(shopPurchaseSchema, withinRoomBudget, ({ itemId, quantity, transactionId }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      const pose = world.pose(session.playerId);
      if (!pose) return { ok: false as const, code: "NOT_IN_WORLD" as const };
      const shop = INTERACTION_ZONES.mithaiShop;
      if (Math.hypot(pose.x - shop.anchor[0], pose.z - shop.anchor[2]) > shop.radius) {
        return { ok: false as const, code: "TOO_FAR" as const };
      }
      const res = economy.purchase({ roomId: session.roomId, playerId: session.playerId, itemId, quantity, transactionId });
      if (!res.ok) return res;
      return { ok: true as const, itemId, coins: res.coins, inventory: res.inventory };
    });
    const chatShop = asyncRequestHandler(shopChatSchema, withinRoomBudget, async ({ message, language }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      if (!flagsmith.getFlags().ai_shopkeeper) return { ok: false as const, code: "UNAVAILABLE" as const };
      const pose = world.pose(session.playerId);
      if (!pose) return { ok: false as const, code: "NOT_IN_WORLD" as const };
      const shop = INTERACTION_ZONES.mithaiShop;
      if (Math.hypot(pose.x - shop.anchor[0], pose.z - shop.anchor[2]) > shop.radius) {
        return { ok: false as const, code: "TOO_FAR" as const };
      }
      recordSarvamRequest();
      const result = await sarvamShopChat(message, language);
      return { ok: true as const, ...result };
    });
    const voiceShop = asyncRequestHandler(shopVoiceSchema, withinRoomBudget, async ({ audioBase64, mimeType, language }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      if (!flagsmith.getFlags().ai_shopkeeper) return { ok: false as const, code: "UNAVAILABLE" as const };
      const pose = world.pose(session.playerId);
      if (!pose) return { ok: false as const, code: "NOT_IN_WORLD" as const };
      const shop = INTERACTION_ZONES.mithaiShop;
      if (Math.hypot(pose.x - shop.anchor[0], pose.z - shop.anchor[2]) > shop.radius) {
        return { ok: false as const, code: "TOO_FAR" as const };
      }
      recordSarvamRequest();
      const result = await sarvamShopVoice(audioBase64, mimeType, language);
      return { ok: true as const, ...result };
    });
    const contributeFireworks = requestHandler(fireworksContributeSchema, withinRoomBudget, ({ amount, transactionId }) => {
      const session = rooms.sessionView(socket.id);
      if (!session) return { ok: false as const, code: "NOT_IN_ROOM" as const };
      return fireworks.contribute(session, world.pose(session.playerId), amount, transactionId);
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
    socket.on("ride:board", boardRide);
    socket.on("ride:exit", exitRide);
    socket.on("shop:purchase", purchaseShop);
    socket.on("shop:chat", chatShop);
    socket.on("shop:voice", voiceShop);
    socket.on("fireworks:contribute", contributeFireworks);
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
      socket.off("ride:board", boardRide);
      socket.off("ride:exit", exitRide);
      socket.off("shop:purchase", purchaseShop);
      socket.off("shop:chat", chatShop);
      socket.off("shop:voice", voiceShop);
      socket.off("fireworks:contribute", contributeFireworks);
      rooms.disconnect(socket.id);
    });
  });

  return io;
}
