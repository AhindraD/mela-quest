import { expect, test } from "vitest";
import { EconomyManager } from "../../src/server/economy.mts";
import { RoomManager } from "../../src/server/room-manager.mts";
import { CATALOG_ITEMS } from "../../src/shared/catalog.ts";
import type { EconomySnapshot, RoomAdmission } from "../../src/shared/protocol.ts";

function admitted(result: ReturnType<RoomManager["create"]>): RoomAdmission {
  if (!result.ok) throw new Error(`Expected admission, got ${result.code}`);
  return result;
}

test("credits, debits, and purchases are integer-only, idempotent, and never negative", () => {
  const published: { snapshot: EconomySnapshot; connectionId: string }[] = [];
  const economy = new EconomyManager({
    publish: (snapshot, connectionId) => published.push({ snapshot, connectionId }),
  });

  economy.sync({
    playerId: "p1",
    roomId: "room-a",
    nickname: "Mira",
    color: "marigold",
    connectionId: "conn-1",
    connections: ["conn-1"],
  }, "bound");

  expect(published.at(-1)?.snapshot).toMatchObject({ playerId: "p1", coins: 0, inventory: {} });

  // Invalid amounts and transaction IDs rejected.
  for (const amount of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(economy.credit({ roomId: "room-a", playerId: "p1", amount, transactionId: "bad-amt" }))
      .toEqual({ ok: false, code: "INVALID_AMOUNT" });
  }
  expect(economy.credit({ roomId: "room-a", playerId: "p1", amount: 10, transactionId: "" }))
    .toEqual({ ok: false, code: "INVALID_TRANSACTION_ID" });

  // Valid credit succeeds once; duplicate transactionId returns original result without double-crediting.
  const firstCredit = economy.credit({ roomId: "room-a", playerId: "p1", amount: 30, transactionId: "reward-1" });
  expect(firstCredit).toEqual({ ok: true, coins: 30, inventory: {} });
  const dupCredit = economy.credit({ roomId: "room-a", playerId: "p1", amount: 30, transactionId: "reward-1" });
  expect(dupCredit).toEqual(firstCredit);
  expect(economy.snapshot("p1")?.coins).toBe(30);

  // Insufficient funds rejected; balance stays 30.
  expect(economy.purchase({
    roomId: "room-a",
    playerId: "p1",
    itemId: "lantern",
    quantity: 2,
    transactionId: "buy-too-many",
  })).toEqual({ ok: false, code: "INSUFFICIENT_FUNDS" });
  expect(economy.snapshot("p1")?.coins).toBe(30);

  // Valid catalog purchase succeeds once; duplicate transactionId does not double-spend.
  const expectedAfter = 30 - CATALOG_ITEMS.jalebi.price;
  const buy = economy.purchase({
    roomId: "room-a",
    playerId: "p1",
    itemId: "jalebi",
    transactionId: "buy-1",
  });
  expect(buy).toEqual({ ok: true, coins: expectedAfter, inventory: { jalebi: 1 } });
  expect(economy.purchase({
    roomId: "room-a",
    playerId: "p1",
    itemId: "jalebi",
    transactionId: "buy-1",
  })).toEqual(buy);
  expect(economy.snapshot("p1")?.coins).toBe(expectedAfter);

  // Debit cannot go negative.
  expect(economy.debit({ roomId: "room-a", playerId: "p1", amount: expectedAfter + 1, transactionId: "debit-over" }))
    .toEqual({ ok: false, code: "INSUFFICIENT_FUNDS" });
  expect(economy.snapshot("p1")?.coins).toBe(expectedAfter);
});

test("rejects cross-room mutations and restores balance across disconnect and resume", () => {
  let now = 0;
  const published: { snapshot: EconomySnapshot; connectionId: string }[] = [];
  const economy = new EconomyManager({
    publish: (snapshot, connectionId) => published.push({ snapshot, connectionId }),
  });
  const rooms = new RoomManager({
    now: () => now,
    reconnectGraceMs: 1000,
    emptyRoomTtlMs: 2000,
    publish: () => undefined,
    onSession: (notice, change) => economy.sync(notice, change),
  });

  const host = admitted(rooms.create("c1", "Mira"));
  const other = admitted(rooms.create("c2", "Asha"));

  expect(economy.credit({
    roomId: other.snapshot.roomId,
    playerId: host.playerId,
    amount: 25,
    transactionId: "cross-room",
  })).toEqual({ ok: false, code: "ROOM_MISMATCH" });

  expect(economy.credit({
    roomId: host.snapshot.roomId,
    playerId: host.playerId,
    amount: 40,
    transactionId: "reward-host",
  })).toEqual({ ok: true, coins: 40, inventory: {} });
  expect(economy.purchase({
    roomId: host.snapshot.roomId,
    playerId: host.playerId,
    itemId: "marigold",
    transactionId: "buy-marigold",
  })).toEqual({ ok: true, coins: 30, inventory: { marigold: 1 } });

  // Disconnect preserves balance; resume restores and publishes to the new connection.
  rooms.disconnect("c1");
  expect(economy.snapshot(host.playerId)?.coins).toBe(30);

  now = 500;
  const resumed = admitted(rooms.resume("c1-resumed", host.sessionToken));
  expect(resumed.playerId).toBe(host.playerId);
  expect(published.at(-1)).toEqual({
    connectionId: "c1-resumed",
    snapshot: {
      version: 1,
      roomId: host.snapshot.roomId,
      playerId: host.playerId,
      coins: 30,
      inventory: { marigold: 1 },
    },
  });

  // Explicit leave removes economy state.
  rooms.leave("c1-resumed");
  expect(economy.snapshot(host.playerId)).toBeNull();
});
