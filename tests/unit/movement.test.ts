import { expect, test } from "vitest";
import { PLAYER_RADIUS, WALK_SPEED, walk, type GroundPoint } from "../../src/shared/movement";
import { LANDMARK_FOOTPRINTS, SPAWN_POSITION, WORLD_BOUNDS } from "../../src/shared/world";

const spawn = { x: SPAWN_POSITION[0], z: SPAWN_POSITION[2] };

function simulate(start: GroundPoint, input: GroundPoint, seconds: number, fps: number) {
  let point = start;
  for (let frame = 0; frame < seconds * fps; frame++) {
    point = walk(point, input, 1 / fps);
  }
  return point;
}

test.each([
  [{ x: 0, z: -1 }, { x: 0, z: 10.5 }],
  [{ x: 0, z: 1 }, { x: 0, z: 11.5 }],
  [{ x: -1, z: 0 }, { x: -0.5, z: 11 }],
  [{ x: 1, z: 0 }, { x: 0.5, z: 11 }],
])("steps in cardinal direction %j", (input, target) => {
  const result = walk(spawn, input, 0.1);
  expect(result.x).toBeCloseTo(target.x);
  expect(result.z).toBeCloseTo(target.z);
});

test("diagonals match cardinal speed at 15, 30, 60 and 120 frames per second", () => {
  for (const fps of [15, 30, 60, 120]) {
    const end = simulate(spawn, { x: 1, z: -1 }, 1, fps);
    expect(end.x).toBeCloseTo(WALK_SPEED / Math.SQRT2, 8);
    expect(end.z).toBeCloseTo(spawn.z - WALK_SPEED / Math.SQRT2, 8);
  }
});

test("bounds keep the avatar inside every edge, including the entrance", () => {
  const right = simulate({ x: 0, z: 5.8 }, { x: 1, z: 0 }, 5, 30);
  const left = simulate({ x: 0, z: 5.8 }, { x: -1, z: 0 }, 5, 30);
  const front = simulate(spawn, { x: 0, z: 1 }, 5, 30);
  const back = simulate({ x: 0, z: -5 }, { x: 0, z: -1 }, 5, 30);
  expect(right.x).toBeLessThanOrEqual(WORLD_BOUNDS.maxX - PLAYER_RADIUS);
  expect(right.x).toBeGreaterThan(WORLD_BOUNDS.maxX - 1);
  expect(left.x).toBeCloseTo(-right.x);
  expect(front.z).toBeLessThanOrEqual(WORLD_BOUNDS.maxZ - PLAYER_RADIUS);
  expect(front.z).toBeGreaterThan(WORLD_BOUNDS.maxZ - 1);
  expect(back.z).toBeCloseTo(-front.z);
});

test("stops at the fountain and stalls and slides along an occupied edge", () => {
  const atFountain = simulate(spawn, { x: 0, z: -1 }, 4, 15);
  expect(atFountain.z).toBeGreaterThanOrEqual(LANDMARK_FOOTPRINTS.fountainRadius + PLAYER_RADIUS);
  expect(atFountain.z).toBeLessThan(LANDMARK_FOOTPRINTS.fountainRadius + PLAYER_RADIUS + 0.12);

  const inFrontOfShop = simulate({ x: 10, z: 7 }, { x: 0, z: -1 }, 4, 15);
  const frontFace = 3 + LANDMARK_FOOTPRINTS.stall.depth / 2 + PLAYER_RADIUS;
  expect(inFrontOfShop.z).toBeGreaterThanOrEqual(frontFace);
  expect(inFrontOfShop.z).toBeLessThan(frontFace + 0.15);
  const sliding = walk(inFrontOfShop, { x: 1, z: -1 }, 0.1);
  expect(sliding.x).toBeGreaterThan(inFrontOfShop.x);
  expect(sliding.z).toBeCloseTo(inFrontOfShop.z);
});

test("ignores idle and invalid input and caps a long frame", () => {
  expect(walk(spawn, { x: 0, z: 0 }, 0.1)).toBe(spawn);
  expect(walk(spawn, { x: Infinity, z: 0 }, 0.1)).toBe(spawn);
  expect(walk(spawn, { x: 1, z: 0 }, Number.NaN)).toBe(spawn);
  expect(walk(spawn, { x: 1, z: 0 }, 20)).toEqual(walk(spawn, { x: 1, z: 0 }, 0.1));
});

test("the diagonal corner rail stops travel through the cut-off corner", () => {
  const end = simulate({ x: 14, z: -7 }, { x: 1, z: -1 }, 3, 60);
  expect(end.x - end.z).toBeLessThan(26 - PLAYER_RADIUS);
  expect(end.x - end.z).toBeGreaterThan(24.8);
});

test("the planting bed stops an approach from the entrance side", () => {
  const end = simulate({ x: 11.7, z: 10.5 }, { x: 0, z: -1 }, 2, 60);
  const boundary = 8.3 + .75 + PLAYER_RADIUS;
  expect(end.z).toBeGreaterThanOrEqual(boundary);
  expect(end.z).toBeLessThanOrEqual(boundary + WALK_SPEED / 60);
});
