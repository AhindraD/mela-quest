import { io, type Socket } from "socket.io-client";
import { afterEach, expect, test } from "vitest";
import { INPUT_RATE } from "../../src/shared/movement.ts";
import {
  PROTOCOL_VERSION,
  SOCKET_PATH,
  type ClientToServerEvents,
  type PlayerInputResult,
  type RoomAdmissionResult,
  type ServerToClientEvents,
  type WorldSnapshot,
} from "../../src/shared/protocol.ts";
import { SPAWN_POSITION } from "../../src/shared/world.ts";

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
  const snapshots: WorldSnapshot[] = [];
  const times: number[] = [];
  client.on("world:snapshot", (snapshot) => {
    snapshots.push(snapshot);
    times.push(performance.now());
  });
  return { snapshots, times };
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.disconnect();
    client.removeAllListeners();
  }
});

test("two then five players see movement, and invalid input cannot teleport", async () => {
  const [host, guest, outsider, ...others] = await Promise.all(Array.from({ length: 6 }, () => connect()));
  const hostView = watch(host);
  const guestView = watch(guest);
  const outsiderView = watch(outsider);
  const room = admitted(await host.timeout(2000).emitWithAck("room:create", { version, nickname: "Host" }));
  const otherRoom = admitted(await outsider.timeout(2000).emitWithAck("room:create", { version, nickname: "Outsider" }));
  const joined = admitted(await guest.timeout(2000).emitWithAck("room:join", {
    version, inviteCode: room.inviteCode, nickname: "Guest",
  }));

  expect(await host.timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: 1, z: 0 }))
    .toEqual({ ok: false, code: "NOT_IN_WORLD" });
  const entered = await host.timeout(2000).emitWithAck("world:enter", { version, avatar: "Cat" });
  const guestEntered = await guest.timeout(2000).emitWithAck("world:enter", { version, avatar: "Woman" });
  const outsiderEntered = await outsider.timeout(2000).emitWithAck("world:enter", { version, avatar: "Man" });
  if (!entered.ok || !guestEntered.ok || !outsiderEntered.ok) throw new Error("enter failed");
  expect(entered.pose).toMatchObject({ playerId: room.playerId, avatar: "Cat", x: SPAWN_POSITION[0], z: SPAWN_POSITION[2] });

  const untyped = host as Socket<ServerToClientEvents, {
    "player:input": (...args: [...unknown[], (result: PlayerInputResult) => void]) => void;
  }>;
  const rejected = await Promise.all([
    untyped.timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: 40, z: 0 }),
    untyped.timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: Number.NaN, z: 0 }),
    untyped.timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: Number.POSITIVE_INFINITY, z: 0 }),
    untyped.timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: 1, z: 0, position: { x: 80, z: -40 } }),
  ]);
  expect(rejected).toEqual(Array.from({ length: 4 }, () => ({ ok: false, code: "INVALID_PAYLOAD" })));

  const sentAt = performance.now();
  expect(await host.timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: 1, z: 0 }))
    .toEqual({ ok: true, sequence: 1 });
  expect(await host.timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: 0, z: -1 }))
    .toEqual({ ok: false, code: "STALE_INPUT" });

  const hostMoved = () => guestView.snapshots.findLast((snapshot) =>
    snapshot.players.some((player) => player.playerId === room.playerId && player.x > 0.4 && player.sequence >= 1));
  await expect.poll(hostMoved, { timeout: 2000 }).toBeTruthy();
  const visible = hostMoved();
  const inputToSnapshotMs = performance.now() - sentAt;
  expect(visible?.roomId).toBe(room.snapshot.roomId);
  expect(visible?.players.find((player) => player.playerId === room.playerId)?.x).toBeLessThan(3);
  expect(visible?.players.find((player) => player.playerId === joined.playerId)?.avatar).toBe("Woman");

  await expect.poll(() => hostView.times.length, { timeout: 2000 }).toBeGreaterThanOrEqual(15);
  const intervals = hostView.times.slice(1, 16).map((time, index) => time - hostView.times[index]);
  const observed = {
    samples: intervals.length,
    minIntervalMs: Math.min(...intervals),
    medianIntervalMs: median(intervals),
    maxIntervalMs: Math.max(...intervals),
    inputToSnapshotMs,
  };
  console.info(`CP08_METRICS ${JSON.stringify(observed)}`);
  expect(observed.medianIntervalMs).toBeGreaterThan(35);
  expect(observed.medianIntervalMs).toBeLessThan(80);
  expect(inputToSnapshotMs).toBeLessThan(1000);

  await outsider.timeout(2000).emitWithAck("transport:ping", { version, echo: "world barrier" });
  expect(outsiderView.snapshots.every((snapshot) => snapshot.roomId === otherRoom.snapshot.roomId)).toBe(true);
  expect(JSON.stringify(outsiderView.snapshots)).not.toContain(room.playerId);
  expect(JSON.stringify([...hostView.snapshots, ...guestView.snapshots, ...outsiderView.snapshots]))
    .not.toContain(room.sessionToken);

  const arrivals = await Promise.all(others.map((client, index) => client.timeout(2000).emitWithAck("room:join", {
    version, inviteCode: room.inviteCode, nickname: `Player ${index + 3}`,
  })));
  const fifth = arrivals[2];
  if (!fifth?.ok) throw new Error("fifth join failed");
  await Promise.all(others.map((client) => client.timeout(2000).emitWithAck("world:enter", { version, avatar: "Man" })));
  const views = others.map(watch);
  expect(await others[2].timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: 0, z: 1 }))
    .toEqual({ ok: true, sequence: 1 });
  await expect.poll(() => views[0].snapshots.findLast((snapshot) => snapshot.players.length === 5
    && snapshot.players.some((player) => player.playerId === fifth.playerId && player.z > SPAWN_POSITION[2] + 0.3)),
  { timeout: 2000 }).toBeTruthy();
  expect(views[0].snapshots.every((snapshot) => snapshot.roomId === room.snapshot.roomId)).toBe(true);

  const burst = await Promise.all(Array.from({ length: INPUT_RATE + 1 }, (_, index) =>
    guest.timeout(2000).emitWithAck("player:input", { version, sequence: index + 1, x: 0, z: 0 })));
  expect(burst).toContainEqual({ ok: false, code: "RATE_LIMITED" });
}, 20_000);

test("disconnect keeps the avatar until grace expiry and resume continues from that pose", async () => {
  const [host, guest] = await Promise.all([connect(), connect()]);
  const guestView = watch(guest);
  const room = admitted(await host.timeout(2000).emitWithAck("room:create", { version, nickname: "Host" }));
  admitted(await guest.timeout(2000).emitWithAck("room:join", {
    version, inviteCode: room.inviteCode, nickname: "Guest",
  }));
  expect((await host.timeout(2000).emitWithAck("world:enter", { version, avatar: "Man" })).ok).toBe(true);
  expect((await guest.timeout(2000).emitWithAck("world:enter", { version, avatar: "Cat" })).ok).toBe(true);
  expect(await host.timeout(2000).emitWithAck("player:input", { version, sequence: 1, x: -1, z: 0 }))
    .toEqual({ ok: true, sequence: 1 });
  await expect.poll(() => guestView.snapshots.findLast((snapshot) =>
    snapshot.players.some((player) => player.playerId === room.playerId && player.x < -0.3)),
  { timeout: 2000 }).toBeTruthy();

  host.disconnect();
  await expect.poll(() => guestView.snapshots.at(-1)?.players.find((player) => player.playerId === room.playerId)?.connected)
    .toBe(false);
  const frozen = guestView.snapshots.at(-1)?.players.find((player) => player.playerId === room.playerId);
  expect(frozen).toMatchObject({ connected: false, avatar: "Man" });
  expect(frozen?.x).toBeLessThan(-0.3);
  await new Promise((resolve) => setTimeout(resolve, 180));
  expect(guestView.snapshots.at(-1)?.players.find((player) => player.playerId === room.playerId)?.x).toBe(frozen?.x);

  const returning = await connect();
  const restored = admitted(await returning.timeout(2000).emitWithAck("room:resume", {
    version, sessionToken: room.sessionToken,
  }));
  expect(restored.playerId).toBe(room.playerId);
  await expect.poll(() => guestView.snapshots.at(-1)?.players.find((player) => player.playerId === room.playerId))
    .toMatchObject({ connected: true, x: frozen?.x, z: frozen?.z });
  expect(await returning.timeout(2000).emitWithAck("player:input", { version, sequence: 2, x: -1, z: 0 }))
    .toEqual({ ok: true, sequence: 2 });
  await expect.poll(() => guestView.snapshots.findLast((snapshot) =>
    snapshot.players.some((player) => player.playerId === room.playerId && player.x < (frozen?.x ?? 0) - 0.2)),
  { timeout: 2000 }).toBeTruthy();

  returning.disconnect();
  await expect.poll(() => guestView.snapshots.at(-1)?.players.some((player) => player.playerId === room.playerId),
    { timeout: graceMs + 5000, interval: 200 }).toBe(false);
  expect(await guest.timeout(2000).emitWithAck("world:leave", { version })).toEqual({ ok: true });
  await expect.poll(() => guestView.snapshots.at(-1)?.players).toEqual([]);
}, graceMs + 15_000);

test("server rejects distant or invalid attraction interactions and validates proximity per client", async () => {
  const [host, guest] = await Promise.all([connect(), connect()]);
  const hostView = watch(host);
  const room = admitted(await host.timeout(2000).emitWithAck("room:create", { version, nickname: "Host" }));
  admitted(await guest.timeout(2000).emitWithAck("room:join", {
    version, inviteCode: room.inviteCode, nickname: "Guest",
  }));
  expect((await host.timeout(2000).emitWithAck("world:enter", { version, avatar: "Man" })).ok).toBe(true);
  expect((await guest.timeout(2000).emitWithAck("world:enter", { version, avatar: "Woman" })).ok).toBe(true);

  expect(await host.timeout(2000).emitWithAck("attraction:interact", { version, attraction: "fountain" }))
    .toEqual({ ok: false, code: "TOO_FAR" });
  expect(await host.timeout(2000).emitWithAck("attraction:interact", {
    version,
    attraction: "spoofed" as "fountain",
  })).toEqual({ ok: false, code: "INVALID_PAYLOAD" });

  let sequence = 1;
  expect(await host.timeout(2000).emitWithAck("player:input", { version, sequence, x: 0, z: -1 }))
    .toEqual({ ok: true, sequence });
  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 95));
    sequence += 1;
    await host.timeout(2000).emitWithAck("player:input", { version, sequence, x: 0, z: -1 });
  }
  await expect.poll(() => hostView.snapshots.at(-1)?.players.find((p) => p.playerId === room.playerId)?.z ?? 11,
    { timeout: 3000 }).toBeLessThan(5.4);

  const result = await host.timeout(2000).emitWithAck("attraction:interact", { version, attraction: "fountain" });
  expect(result).toMatchObject({ ok: true, attraction: "fountain", label: "Plaza Fountain" });
  expect(await guest.timeout(2000).emitWithAck("attraction:interact", { version, attraction: "fountain" }))
    .toEqual({ ok: false, code: "TOO_FAR" });
}, 15_000);
