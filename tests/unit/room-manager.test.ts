import { expect, test, vi } from "vitest";
import { RoomManager } from "../../src/server/room-manager.mts";
import type { RoomAdmission, RoomAdmissionResult } from "../../src/shared/protocol.ts";

function setup() {
  let now = 0;
  const publish = vi.fn();
  const rooms = new RoomManager({
    now: () => now,
    reconnectGraceMs: 100,
    emptyRoomTtlMs: 50,
    publish,
  });

  return { rooms, publish, advanceTo: (time: number) => { now = time; } };
}

function admitted(result: RoomAdmissionResult): RoomAdmission {
  if (!result.ok) throw new Error(result.code);
  return result;
}

test("reserves capacity until the grace deadline and expires the old credentials", () => {
  const { rooms, advanceTo } = setup();
  const host = admitted(rooms.create("host", "Host"));
  for (let slot = 0; slot < 3; slot++) {
    admitted(rooms.join(`guest-${slot}`, host.inviteCode, "Guest"));
  }
  const guest = admitted(rooms.join("guest-3", host.inviteCode, "Guest"));
  rooms.disconnect("guest-3");

  advanceTo(99);
  expect(rooms.join("waiting", host.inviteCode, "Waiting")).toEqual({ ok: false, code: "ROOM_FULL" });
  advanceTo(100);
  const replacement = admitted(rooms.join("waiting", host.inviteCode, "Waiting"));
  expect(replacement.snapshot.players).toHaveLength(5);
  expect(replacement.snapshot.players.some(({ playerId }) => playerId === guest.playerId)).toBe(false);
  expect(rooms.resume("another", guest.sessionToken)).toEqual({ ok: false, code: "INVALID_SESSION" });
});

test("resume restores the same guest and only the active connection can leave", () => {
  const { rooms, publish, advanceTo } = setup();
  const host = admitted(rooms.create("host", "Host"));
  const guest = admitted(rooms.join("old", host.inviteCode, "Guest", "mint"));
  expect(rooms.resume("new", guest.sessionToken)).toEqual({ ok: false, code: "SESSION_ACTIVE" });
  rooms.disconnect("old");
  expect(publish).toHaveBeenLastCalledWith({
    ...guest.snapshot,
    players: [
      { playerId: host.playerId, nickname: "Host", color: "marigold", connected: true },
      { playerId: guest.playerId, nickname: "Guest", color: "mint", connected: false },
    ],
  }, ["host"]);

  advanceTo(99);
  expect(admitted(rooms.resume("new", guest.sessionToken))).toEqual(guest);
  expect(rooms.leave("old")).toEqual({ ok: false, code: "NOT_IN_ROOM" });
  expect(rooms.leave("new")).toEqual({ ok: true });
  expect(rooms.resume("old", guest.sessionToken)).toEqual({ ok: false, code: "INVALID_SESSION" });
});

test.each([[159, true], [160, false]])("empty invite at time %i has availability %s", (time, available) => {
  const { rooms, advanceTo } = setup();
  const host = admitted(rooms.create("host", "Host"));
  admitted(rooms.join("guest", host.inviteCode, "Guest"));
  // Disconnect in the reverse order of admission to exercise out-of-order deadlines.
  rooms.disconnect("guest");
  advanceTo(10);
  rooms.disconnect("host");

  advanceTo(time);
  rooms.sweep();
  expect(rooms.resume("new", host.sessionToken)).toEqual({ ok: false, code: "INVALID_SESSION" });
  expect(rooms.join("new", host.inviteCode, "Guest")).toMatchObject(
    available ? { ok: true } : { ok: false, code: "INVALID_INVITE" },
  );
});

test("a guest can reuse an empty invite before its deadline, then expires it by leaving", () => {
  const { rooms, advanceTo } = setup();
  const host = admitted(rooms.create("host", "Host"));
  expect(rooms.leave("host")).toEqual({ ok: true });
  advanceTo(49);
  const successor = admitted(rooms.join("guest", host.inviteCode, "Guest"));
  expect(successor.snapshot.roomId).toBe(host.snapshot.roomId);

  advanceTo(50);
  rooms.sweep();
  expect(rooms.leave("guest")).toEqual({ ok: true });
  advanceTo(100);
  rooms.sweep();
  expect(rooms.join("new", host.inviteCode, "Guest")).toEqual({ ok: false, code: "INVALID_INVITE" });
});
