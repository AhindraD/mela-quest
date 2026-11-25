import { afterEach, expect, test } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  PROTOCOL_VERSION as version,
  SOCKET_PATH,
  type ClientToServerEvents,
  type EconomySnapshot,
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

test("delivers initial economy state, restores on resume, and exposes no public mint endpoint", async () => {
  const client = await connect();
  const updates: EconomySnapshot[] = [];
  client.on("economy:updated", (snapshot) => updates.push(snapshot));

  const room = admitted(await client.timeout(2000).emitWithAck("room:create", { version, nickname: "Mira" }));
  await expect.poll(() => updates.at(-1), { timeout: 2000 }).toEqual({
    version,
    roomId: room.snapshot.roomId,
    playerId: room.playerId,
    coins: 0,
    inventory: {},
  });

  client.disconnect();
  const resumed = await connect();
  const resumedUpdates: EconomySnapshot[] = [];
  resumed.on("economy:updated", (snapshot) => resumedUpdates.push(snapshot));
  admitted(await resumed.timeout(2000).emitWithAck("room:resume", { version, sessionToken: room.sessionToken }));

  await expect.poll(() => resumedUpdates.at(-1), { timeout: 2000 }).toEqual({
    version,
    roomId: room.snapshot.roomId,
    playerId: room.playerId,
    coins: 0,
    inventory: {},
  });

  const mintGet = await fetch(`${baseUrl}/api/mint`);
  const mintPost = await fetch(`${baseUrl}/api/mint`, { method: "POST" });
  expect(mintGet.status).toBe(404);
  expect(mintPost.status).toBe(404);
});
