import { expect, test } from "vitest";
import { BalloonGameManager } from "../../src/server/balloon-game.mts";
import { EconomyManager } from "../../src/server/economy.mts";
import { balloonRewardCoins, generateBalloonTargets } from "../../src/shared/balloon.ts";
import type { BalloonGameState } from "../../src/shared/protocol.ts";
import { INTERACTION_ZONES } from "../../src/shared/world.ts";

const stallPos = {
  x: INTERACTION_ZONES.balloonStall.approach[0],
  z: INTERACTION_ZONES.balloonStall.approach[2],
};

function setup(seedValue = 42) {
  let now = 1000;
  const states: { state: BalloonGameState; connectionId: string }[] = [];
  const economy = new EconomyManager({ publish: () => undefined });
  const game = new BalloonGameManager({
    now: () => now,
    seed: () => seedValue,
    creditReward: (req) => economy.credit(req),
    publish: (state, connectionId) => states.push({ state, connectionId }),
  });

  const bindPlayer = (playerId: string, roomId: string, connectionId: string) => {
    const notice = {
      playerId,
      roomId,
      nickname: playerId,
      color: "marigold" as const,
      connectionId,
      connections: [connectionId],
    };
    economy.sync(notice, "bound");
    return notice;
  };

  return {
    game,
    economy,
    states,
    bindPlayer,
    at(time: number) {
      now = time;
    },
  };
}

test("generates deterministic target schedule and validates round lifecycle, hits, rate limit, and one-time reward", () => {
  const a = generateBalloonTargets("r1", "p1", 12345);
  const b = generateBalloonTargets("r1", "p1", 12345);
  expect(a).toEqual(b);
  expect(a).toHaveLength(24);

  const { game, economy, bindPlayer, at } = setup(77);
  const p1 = bindPlayer("p1", "room-a", "c1");

  expect(game.join(p1, { x: 0, z: 11 })).toEqual({ ok: false, code: "TOO_FAR" });
  const joined = game.join(p1, stallPos);
  if (!joined.ok) throw new Error("Expected join success");
  expect(joined.state.phase).toBe("active");
  expect(game.join(p1, stallPos)).toEqual({ ok: false, code: "ALREADY_IN_GAME" });

  const targets = joined.state.targets;
  const first = targets[0]!;
  const lateTarget = targets.find((t) => t.spawnAtMs > 5000)!;

  // Unknown target and too early rejected.
  expect(game.hit("p1", joined.state.roundId, "missing")).toEqual({ ok: false, code: "UNKNOWN_TARGET" });
  expect(game.hit("p1", joined.state.roundId, lateTarget.targetId)).toEqual({ ok: false, code: "TOO_EARLY" });

  // Advance to first target window and hit it.
  at(1000 + first.spawnAtMs + 10);
  const hit1 = game.hit("p1", joined.state.roundId, first.targetId);
  expect(hit1).toEqual({ ok: true, targetId: first.targetId, points: first.points, score: first.points });

  // Immediate hit within 80ms rate-limited; duplicate hit after interval rejected.
  at(1000 + first.spawnAtMs + 30);
  expect(game.hit("p1", joined.state.roundId, first.targetId)).toEqual({ ok: false, code: "HIT_RATE_LIMITED" });

  at(1000 + first.spawnAtMs + 120);
  expect(game.hit("p1", joined.state.roundId, first.targetId)).toEqual({ ok: false, code: "DUPLICATE_HIT" });

  // Too late after despawnAtMs.
  at(1000 + first.despawnAtMs + 100);
  const second = targets[1]!;
  if (first.despawnAtMs + 100 > second.despawnAtMs) {
    expect(game.hit("p1", joined.state.roundId, second.targetId)).toEqual({ ok: false, code: "TOO_LATE" });
  }

  // End round at endsAt; reward credited exactly once.
  at(joined.state.endsAt);
  game.tick();
  const expectedCoins = balloonRewardCoins(first.points);
  expect(economy.snapshot("p1")?.coins).toBe(expectedCoins);

  // Additional ticks or late hits do not double-credit.
  at(joined.state.endsAt + 1000);
  game.tick();
  expect(economy.snapshot("p1")?.coins).toBe(expectedCoins);
  expect(game.hit("p1", joined.state.roundId, targets[2]!.targetId)).toEqual({ ok: false, code: "ROUND_ENDED" });
});

test("cleans up on disconnect and keeps concurrent rooms independent", () => {
  const { game, states, bindPlayer } = setup(99);
  const p1 = bindPlayer("p1", "room-a", "c1");
  const p2 = bindPlayer("p2", "room-a", "c2");
  const outsider = bindPlayer("p3", "room-b", "c3");

  const j1 = game.join(p1, stallPos);
  const j2 = game.join(p2, stallPos);
  const j3 = game.join(outsider, stallPos);
  if (!j1.ok || !j2.ok || !j3.ok) throw new Error("Expected joins");

  expect(j1.state.roundId).toBe(j2.state.roundId);
  expect(j3.state.roundId).not.toBe(j1.state.roundId);
  expect(j2.state.scoreboard.map((e) => e.playerId)).toEqual(["p1", "p2"]);
  expect(j3.state.scoreboard.map((e) => e.playerId)).toEqual(["p3"]);

  // Disconnect cleans up p1 from room-a without affecting room-b.
  game.sync(p1, "unbound");
  expect(game.hit("p1", j1.state.roundId, j1.state.targets[0]!.targetId)).toEqual({ ok: false, code: "NOT_IN_GAME" });
  const latestRoomA = states.findLast((s) => s.state.roomId === "room-a")?.state;
  expect(latestRoomA?.scoreboard.map((e) => e.playerId)).toEqual(["p2"]);
});
