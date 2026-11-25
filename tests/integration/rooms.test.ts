import { io, type Socket } from "socket.io-client";
import { afterEach, expect, test } from "vitest";
import {
  PROTOCOL_VERSION,
  SOCKET_PATH,
  type ClientToServerEvents,
  type RoomAdmissionResult,
  type RoomSnapshot,
  type ServerToClientEvents,
} from "../../src/shared/protocol.ts";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const endpoint = new URL(process.env.MELA_TEST_URL ?? "http://127.0.0.1:3000");
const graceMs = Number(process.env.MELA_TEST_ROOM_GRACE_MS ?? 30_000);
const version = PROTOCOL_VERSION;
const clients: Client[] = [];

async function connect() {
  const client: Client = io(endpoint.origin, {
    path: SOCKET_PATH,
    forceNew: true,
    transports: ["websocket"],
    reconnection: false,
  });
  clients.push(client);
  await expect.poll(() => client.connected).toBe(true);
  return client;
}

function admitted(result: RoomAdmissionResult) {
  if (!result.ok) throw new Error(result.code);
  return result;
}

function watch(client: Client) {
  const snapshots: RoomSnapshot[] = [];
  client.on("room:snapshot", (snapshot) => snapshots.push(snapshot));
  return snapshots;
}

function join(client: Client, inviteCode: string, nickname = "Guest") {
  return client.timeout(2000).emitWithAck("room:join", { version, inviteCode, nickname });
}

function resume(client: Client, sessionToken: string) {
  return client.timeout(2000).emitWithAck("room:resume", { version, sessionToken });
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.disconnect();
    client.removeAllListeners();
  }
});

test("five independent guests, duplicate join, resume and expiry over real sockets", async () => {
  const [host, guestA, guestB, guestC, guestD, sixth] = await Promise.all(
    Array.from({ length: 6 }, () => connect()),
  );
  const hostSnapshots = watch(host);
  const room = admitted(await host.timeout(2000).emitWithAck("room:create", { version, nickname: "Host" }));
  const { inviteCode } = room;
  for (const client of [guestA, guestB, guestC]) {
    admitted(await join(client, inviteCode));
  }
  const last = admitted(await join(guestD, inviteCode, "Fifth"));
  expect(last.snapshot.players).toHaveLength(5);
  expect(new Set(last.snapshot.players.map((player) => player.playerId)).size).toBe(5);
  expect(await join(sixth, inviteCode)).toEqual({ ok: false, code: "ROOM_FULL" });
  expect(await join(guestD, inviteCode)).toEqual({ ok: false, code: "ALREADY_IN_ROOM" });
  expect(await resume(sixth, last.sessionToken)).toEqual({ ok: false, code: "SESSION_ACTIVE" });

  guestD.disconnect();
  const hostSeesConnection = () => hostSnapshots.at(-1)?.players.find(
    ({ playerId }) => playerId === last.playerId,
  )?.connected;
  await expect.poll(hostSeesConnection).toBe(false);
  const returning = await connect();
  const restored = admitted(await resume(returning, last.sessionToken));
  expect(restored.playerId).toBe(last.playerId);
  expect(restored.snapshot.players).toContainEqual({ playerId: last.playerId, nickname: "Fifth", color: "marigold", connected: true });
  await expect.poll(hostSeesConnection).toBe(true);
  returning.disconnect();
  await expect.poll(hostSeesConnection).toBe(false);

  await expect.poll(() => join(sixth, inviteCode), { timeout: graceMs + 5000, interval: 300 })
    .toMatchObject({ ok: true });
  expect(await resume(await connect(), last.sessionToken)).toEqual({ ok: false, code: "INVALID_SESSION" });
  await expect.poll(() => hostSnapshots.at(-1)?.players.map(({ playerId }) => playerId))
    .not.toContain(last.playerId);
}, graceMs + 10_000);

test("room snapshots stay isolated and contain only public roster data", async () => {
  const [host, outsider, visitor] = await Promise.all([connect(), connect(), connect()]);
  const hostSnapshots = watch(host);
  const outsiderSnapshots = watch(outsider);
  const first = admitted(await host.timeout(2000).emitWithAck("room:create", { version, nickname: "First" }));
  const second = admitted(await outsider.timeout(2000).emitWithAck("room:create", { version, nickname: "Second" }));
  const unknownCode = "A".repeat(22);
  expect(await join(visitor, unknownCode)).toEqual({ ok: false, code: "INVALID_INVITE" });
  expect(await join(visitor, first.inviteCode, "<Guest>")).toEqual({ ok: false, code: "INVALID_PAYLOAD" });
  const guest = admitted(await join(visitor, first.inviteCode, "  Visitor  "));
  await expect.poll(() => hostSnapshots.at(-1)).toEqual({
    version,
    roomId: first.snapshot.roomId,
    players: [
      { playerId: first.playerId, nickname: "First", color: "marigold", connected: true },
      { playerId: guest.playerId, nickname: "Visitor", color: "marigold", connected: true },
    ],
  });

  // Acknowledgments on the observer's socket flush any earlier roster deliveries.
  await outsider.timeout(2000).emitWithAck("transport:ping", { version, echo: "roster barrier" });
  expect(outsiderSnapshots).toEqual([second.snapshot]);
  expect(hostSnapshots.every((snapshot) => snapshot.roomId === first.snapshot.roomId)).toBe(true);
  const broadcasts = JSON.stringify([...hostSnapshots, ...outsiderSnapshots]);
  for (const member of [first, second, guest]) {
    expect(broadcasts).not.toContain(member.sessionToken);
    expect(broadcasts).not.toContain(member.inviteCode);
  }

  expect(await visitor.timeout(2000).emitWithAck("room:leave", { version })).toEqual({ ok: true });
  expect(await resume(visitor, guest.sessionToken)).toEqual({ ok: false, code: "INVALID_SESSION" });
  await expect.poll(() => hostSnapshots.at(-1)).toEqual(first.snapshot);
});
