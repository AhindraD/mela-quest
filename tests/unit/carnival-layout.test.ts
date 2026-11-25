import { expect, test } from "vitest";
import { isBlocked, walk, type GroundPoint } from "../../src/shared/movement";
import { INTERACTION_ZONES, LANDMARKS, SPAWN_POSITION, WORLD_BOUNDS } from "../../src/shared/world";

function keyOf(x: number, z: number) {
  return `${Math.round(x * 2)},${Math.round(z * 2)}`;
}

test("spawn is unobstructed and allows movement in all four directions", () => {
  const [sx, , sz] = SPAWN_POSITION;
  expect(isBlocked(sx, sz)).toBe(false);

  for (const input of [
    { x: 0, z: -1 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 1, z: 0 },
  ]) {
    const moved = walk({ x: sx, z: sz }, input, 0.2);
    expect(moved.x !== sx || moved.z !== sz).toBe(true);
  }
});

test("landmark collisions align with visible geometry and interaction zones are clear", () => {
  for (const zone of Object.values(INTERACTION_ZONES)) {
    const [ax, , az] = zone.anchor;
    const [px, , pz] = zone.approach;
    expect(isBlocked(ax, az)).toBe(true);
    expect(isBlocked(px, pz)).toBe(false);
    expect(Math.hypot(px - ax, pz - az)).toBeLessThanOrEqual(zone.radius);
  }
  expect(Object.keys(INTERACTION_ZONES).sort()).toEqual(Object.keys(LANDMARKS).sort());
});

test("every landmark interaction point is reachable from spawn via walk()", () => {
  const stepSeconds = 0.1; // 0.5 units per step
  const start: GroundPoint = { x: SPAWN_POSITION[0], z: SPAWN_POSITION[2] };
  const visited = new Set<string>([keyOf(start.x, start.z)]);
  const queue: GroundPoint[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dir of [
      { x: 0, z: -1 },
      { x: 0, z: 1 },
      { x: -1, z: 0 },
      { x: 1, z: 0 },
    ]) {
      const next = walk(current, dir, stepSeconds);
      if (
        next.x < WORLD_BOUNDS.minX ||
        next.x > WORLD_BOUNDS.maxX ||
        next.z < WORLD_BOUNDS.minZ ||
        next.z > WORLD_BOUNDS.maxZ
      ) {
        continue;
      }
      const k = keyOf(next.x, next.z);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push(next);
      }
    }
  }

  for (const zone of Object.values(INTERACTION_ZONES)) {
    const [px, , pz] = zone.approach;
    const reachable = [...visited].some((k) => {
      const [gx, gz] = k.split(",").map((v) => Number(v) / 2);
      return Math.hypot(gx - px, gz - pz) <= 0.75;
    });
    expect(reachable, `${zone.label} at (${px}, ${pz}) should be reachable from spawn`).toBe(true);
  }
});
