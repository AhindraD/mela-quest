import { expect, test } from "vitest";
import { RoomManager } from "../../src/server/room-manager.mts";
import { WorldSimulation, type SessionNotice } from "../../src/server/world.mts";
import { WALK_SPEED } from "../../src/shared/movement.ts";
import {
  playerInputSchema,
  worldEnterSchema,
  type RoomAdmission,
  type WorldSnapshot,
} from "../../src/shared/protocol.ts";
import { SPAWN_POSITION } from "../../src/shared/world.ts";

const version = 1;

function notice(playerId: string, roomId: string, connections: string[]): SessionNotice {
  return {
    playerId,
    roomId,
    nickname: playerId,
    color: "marigold",
    connectionId: connections.includes(playerId) ? playerId : null,
    connections,
  };
}

function setup() {
  let now = 0;
  const published: WorldSnapshot[] = [];
  const world = new WorldSimulation({
    now: () => now,
    publish: (snapshot) => { published.push(snapshot); },
  });
  return {
    world,
    published,
    at(time: number) {
      now = time;
    },
  };
}

function latest(published: WorldSnapshot[], roomId: string) {
  return published.findLast((snapshot) => snapshot.roomId === roomId);
}

test("rejects movement payloads that could teleport or replay an old input", () => {
  expect(playerInputSchema.safeParse({ version, sequence: 1, x: 0, z: -1 }).success).toBe(true);
  for (const payload of [
    { version, sequence: 1, x: 40, z: 0 },
    { version, sequence: 1, x: Number.NaN, z: 0 },
    { version, sequence: 1, x: Number.POSITIVE_INFINITY, z: 0 },
    { version, sequence: 0, x: 0, z: -1 },
    { version, sequence: 1.5, x: 0, z: -1 },
    { version, sequence: 1, x: 0, z: -1, position: { x: 100, z: 100 } },
  ]) {
    expect(playerInputSchema.safeParse(payload).success).toBe(false);
  }
  expect(worldEnterSchema.safeParse({ version, avatar: "Cat" }).success).toBe(true);
  expect(worldEnterSchema.safeParse({ version, avatar: "Bird" }).success).toBe(false);
});

test("simulates one second of refreshed input and caps a stalled tick", () => {
  const { world, published, at } = setup();
  const player = notice("host", "room-a", ["host"]);
  world.sync(player, "bound");
  const entered = world.enter(player, "Woman");
  expect(entered).toMatchObject({ x: SPAWN_POSITION[0], z: SPAWN_POSITION[2], avatar: "Woman", sequence: 0 });

  let sequence = 1;
  at(0);
  expect(world.input(player.playerId, sequence, 0, -1)).toEqual({ ok: true, sequence });
  for (let time = 50; time <= 1000; time += 50) {
    at(time);
    if (time % 100 === 0) {
      sequence += 1;
      world.input(player.playerId, sequence, 0, -1);
    }
    world.tick(time);
  }

  const moved = latest(published, "room-a")?.players[0];
  expect(moved?.z).toBeCloseTo(SPAWN_POSITION[2] - WALK_SPEED, 5);
  expect(moved?.x).toBeCloseTo(0, 5);
  expect(moved?.yaw).toBeCloseTo(0, 5);

  at(5000);
  sequence += 1;
  world.input(player.playerId, sequence, 1, 0);
  const before = latest(published, "room-a")?.players[0]?.x ?? 0;
  world.tick(5000);
  const after = latest(published, "room-a")?.players[0]?.x ?? 0;
  expect(after - before).toBeCloseTo(WALK_SPEED * 0.1, 5);
  expect(after - before).toBeLessThan(1);
});

test("stops stale input, ignores impossible axes, and keeps rooms apart", () => {
  const { world, published, at } = setup();
  const host = notice("host", "room-a", ["host", "guest"]);
  const guest = notice("guest", "room-a", ["host", "guest"]);
  const outsider = notice("outsider", "room-b", ["outsider"]);
  world.sync(host, "bound");
  world.sync(guest, "bound");
  world.sync(outsider, "bound");
  world.enter(host, "Man");
  world.enter(guest, "Cat");
  world.enter(outsider, "Woman");

  expect(world.input("missing", 1, 0, -1)).toEqual({ ok: false, code: "NOT_IN_WORLD" });
  expect(world.input(host.playerId, 1, 8, 0)).toEqual({ ok: false, code: "INVALID_PAYLOAD" });
  expect(world.input(host.playerId, 1, 0, -1)).toEqual({ ok: true, sequence: 1 });
  expect(world.input(host.playerId, 1, 1, 0)).toEqual({ ok: false, code: "STALE_INPUT" });

  at(50);
  world.tick(50);
  const moving = latest(published, "room-a");
  expect(moving?.players).toHaveLength(2);
  expect(moving?.players.find((player) => player.playerId === "host")?.z).toBeLessThan(SPAWN_POSITION[2]);
  expect(moving?.players.find((player) => player.playerId === "guest")?.z).toBe(SPAWN_POSITION[2]);
  expect(latest(published, "room-b")?.players.map((player) => player.playerId)).toEqual(["outsider"]);
  expect(JSON.stringify(published)).not.toContain("session-token");

  const stalledZ = latest(published, "room-a")?.players.find((player) => player.playerId === "host")?.z;
  at(400);
  world.tick(400);
  expect(latest(published, "room-a")?.players.find((player) => player.playerId === "host")?.z).toBe(stalledZ);

  world.sync({ ...host, connectionId: null, connections: ["guest"] }, "unbound");
  expect(latest(published, "room-a")?.players.find((player) => player.playerId === "host")).toMatchObject({
    connected: false,
    z: stalledZ,
  });
  at(450);
  expect(world.input(host.playerId, 2, 0, -1)).toEqual({ ok: false, code: "NOT_IN_WORLD" });
  world.tick(450);
  expect(latest(published, "room-a")?.players.find((player) => player.playerId === "host")?.z).toBe(stalledZ);

  world.sync({ ...host, connectionId: "host", connections: ["host", "guest"] }, "bound");
  const kept = world.enter({ ...host, connections: ["host", "guest"] }, "Cat");
  expect(kept.z).toBe(stalledZ);
  expect(kept.avatar).toBe("Cat");
  expect(kept.sequence).toBe(1);

  world.sync({ ...host, connectionId: null, connections: ["guest"] }, "removed");
  expect(latest(published, "room-a")?.players.map((player) => player.playerId)).toEqual(["guest"]);
});

test("room disconnect keeps the pose until the grace period and resume continues it", () => {
  let now = 0;
  const published: WorldSnapshot[] = [];
  const world = new WorldSimulation({
    now: () => now,
    publish: (snapshot) => { published.push(snapshot); },
  });
  const rooms = new RoomManager({
    now: () => now,
    reconnectGraceMs: 100,
    emptyRoomTtlMs: 50,
    publish: () => undefined,
    onSession: (session, change) => world.sync(session, change),
  });
  const admitted = (result: ReturnType<RoomManager["create"]>): RoomAdmission => {
    if (!result.ok) throw new Error(result.code);
    return result;
  };

  const host = admitted(rooms.create("host", "Host"));
  const guest = admitted(rooms.join("guest", host.inviteCode, "Guest"));
  const hostView = rooms.sessionView("host");
  const guestView = rooms.sessionView("guest");
  if (!hostView || !guestView) throw new Error("missing session");
  world.enter(hostView, "Man");
  world.enter(guestView, "Woman");
  world.input(host.playerId, 1, 1, 0);
  now = 200;
  world.tick(200);
  const parked = latest(published, host.snapshot.roomId)?.players.find((player) => player.playerId === host.playerId);
  expect(parked?.x).toBeGreaterThan(0);

  rooms.disconnect("host");
  expect(latest(published, host.snapshot.roomId)?.players.find((player) => player.playerId === host.playerId)).toMatchObject({
    connected: false,
    x: parked?.x,
  });
  now = 250;
  world.tick(250);
  expect(latest(published, host.snapshot.roomId)?.players.find((player) => player.playerId === host.playerId)?.x).toBe(parked?.x);

  const resumed = admitted(rooms.resume("host-2", host.sessionToken));
  expect(resumed.playerId).toBe(host.playerId);
  expect(world.input(host.playerId, 2, 1, 0)).toEqual({ ok: true, sequence: 2 });
  now = 350;
  world.tick(350);
  expect(latest(published, host.snapshot.roomId)?.players.find((player) => player.playerId === host.playerId)?.x)
    .toBeGreaterThan(parked?.x ?? 0);

  rooms.disconnect("host-2");
  now = 500;
  rooms.sweep();
  expect(latest(published, host.snapshot.roomId)?.players.map((player) => player.playerId)).toEqual([guest.playerId]);
  expect(world.leave(guest.playerId)).toEqual({ ok: true });
  expect(latest(published, host.snapshot.roomId)?.players).toEqual([]);
});
