import { afterEach, expect, test } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  PROTOCOL_VERSION as version,
  SOCKET_PATH,
  type ClientToServerEvents,
  type RoomAdmission,
  type ServerToClientEvents,
} from "../../src/shared/protocol.ts";

const baseUrl = process.env.MELA_TEST_URL ?? "http://127.0.0.1:3000";
type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const openSockets: ClientSocket[] = [];

function connect(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket: ClientSocket = io(baseUrl, { path: SOCKET_PATH, transports: ["websocket"] });
    openSockets.push(socket);
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function admitted(result: Awaited<ReturnType<ClientSocket["emitWithAck"]>>): RoomAdmission {
  if (!result || typeof result !== "object" || !("ok" in result) || !result.ok || !("sessionToken" in result)) {
    throw new Error(`Expected room admission, got ${JSON.stringify(result)}`);
  }
  return result as RoomAdmission;
}

afterEach(() => {
  while (openSockets.length > 0) openSockets.pop()?.disconnect();
});

test("balloon game rejects distant join, validates hits over real sockets, and cleans up on leave", async () => {
  const client = await connect();
  admitted(await client.timeout(2000).emitWithAck("room:create", { version, nickname: "Mira" }));
  expect((await client.timeout(2000).emitWithAck("world:enter", { version, avatar: "Man" })).ok).toBe(true);

  expect(await client.timeout(2000).emitWithAck("game:join", { version })).toEqual({ ok: false, code: "TOO_FAR" });

  // Walk left and forward toward Balloon Stall [-10, 0, 3].
  let sequence = 1;
  await client.timeout(2000).emitWithAck("player:input", { version, sequence, x: -1, z: -0.5 });
  for (let i = 0; i < 22; i++) {
    await new Promise((resolve) => setTimeout(resolve, 95));
    sequence += 1;
    await client.timeout(2000).emitWithAck("player:input", { version, sequence, x: -1, z: -0.5 });
  }
  await client.timeout(2000).emitWithAck("player:input", { version, sequence: sequence + 1, x: 0, z: 0 });

  const joined = await client.timeout(2000).emitWithAck("game:join", { version });
  if (!joined.ok) throw new Error(`Expected game:join ok, got ${JSON.stringify(joined)}`);
  expect(joined.state.targets).toHaveLength(24);

  const activeTarget = joined.state.targets[0]!;
  await new Promise((resolve) => setTimeout(resolve, activeTarget.spawnAtMs + 50));

  const hit = await client.timeout(2000).emitWithAck("game:hit", {
    version,
    roundId: joined.state.roundId,
    targetId: activeTarget.targetId,
  });
  expect(hit).toEqual({
    ok: true,
    targetId: activeTarget.targetId,
    points: activeTarget.points,
    score: activeTarget.points,
  });

  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(await client.timeout(2000).emitWithAck("game:hit", {
    version,
    roundId: joined.state.roundId,
    targetId: activeTarget.targetId,
  })).toEqual({ ok: false, code: "DUPLICATE_HIT" });

  expect(await client.timeout(2000).emitWithAck("game:hit", {
    version,
    roundId: joined.state.roundId,
    targetId: "unknown-target",
  })).toEqual({ ok: false, code: "UNKNOWN_TARGET" });

  expect(await client.timeout(2000).emitWithAck("game:leave", { version })).toEqual({ ok: true });
}, 20_000);
