import { PLANTING_BEDS, FAIR_PERIMETER, LANDMARKS, LANDMARK_FOOTPRINTS, LANTERN_POSITIONS, WORLD_BOUNDS } from "./world.ts";

export interface GroundPoint {
  x: number;
  z: number;
}

export const WALK_SPEED = 5;
export const PLAYER_RADIUS = 0.45;
export const SPAWN_YAW = Math.PI * 0.88;
export const SNAPSHOT_INTERVAL_MS = 50;
export const INPUT_REFRESH_MS = 100;
export const INPUT_TIMEOUT_MS = 300;
export const INPUT_RATE = 30;
export const MAX_INPUT_SEQUENCE = 1_000_000_000;
export const CORRECTION_DISTANCE = 3;
const EDGE_CLEARANCE = PLAYER_RADIUS + 0.31;
const MAX_FRAME_SECONDS = 0.1;
const MAX_STEP_DISTANCE = 0.12;

const solidBoxes = [
  { center: LANDMARKS.balloonStall, ...LANDMARK_FOOTPRINTS.stall },
  { center: LANDMARKS.mithaiShop, ...LANDMARK_FOOTPRINTS.stall },
  { center: LANDMARKS.ferrisWheel, ...LANDMARK_FOOTPRINTS.ferrisWheel },
  { center: LANDMARKS.dancePavilion, ...LANDMARK_FOOTPRINTS.dancePavilion },
  {
    center: [
      LANDMARKS.dancePavilion[0], 0,
      LANDMARKS.dancePavilion[2] + LANDMARK_FOOTPRINTS.pavilionStep.offsetZ,
    ],
    ...LANDMARK_FOOTPRINTS.pavilionStep,
  },
  ...PLANTING_BEDS.map((center) => ({ center, width: 2.6, depth: 1.5 })),
  ...LANTERN_POSITIONS.map((center) => ({ center, width: 0.56, depth: 0.56 })),
];

// A point stays inside a convex fence when it clears the inward face of each rail.
const rails = FAIR_PERIMETER.map(([x, z], i) => {
  const [nextX, nextZ] = FAIR_PERIMETER[(i + 1) % FAIR_PERIMETER.length];
  const length = Math.hypot(nextX - x, nextZ - z);
  return { x, z, normalX: (z - nextZ) / length, normalZ: (nextX - x) / length };
});

function blocked(x: number, z: number) {
  if (rails.some(rail => (x - rail.x) * rail.normalX + (z - rail.z) * rail.normalZ < EDGE_CLEARANCE - 1e-8)) return true;
  const [fountainX, , fountainZ] = LANDMARKS.fountain;
  if (Math.hypot(x - fountainX, z - fountainZ) < LANDMARK_FOOTPRINTS.fountainRadius + PLAYER_RADIUS) {
    return true;
  }
  return solidBoxes.some(({ center, width, depth }) => {
    const distanceX = Math.max(0, Math.abs(x - center[0]) - width / 2);
    const distanceZ = Math.max(0, Math.abs(z - center[2]) - depth / 2);
    return distanceX * distanceX + distanceZ * distanceZ < PLAYER_RADIUS * PLAYER_RADIUS;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function walk(position: GroundPoint, input: GroundPoint, seconds: number): GroundPoint {
  const magnitude = Math.hypot(input.x, input.z);
  if (!Number.isFinite(magnitude) || !Number.isFinite(seconds) || magnitude === 0 || seconds <= 0) {
    return position;
  }

  const distance = WALK_SPEED * Math.min(seconds, MAX_FRAME_SECONDS);
  const steps = Math.ceil(distance / MAX_STEP_DISTANCE);
  const scale = distance / (Math.max(1, magnitude) * steps);
  let { x, z } = position;

  for (let step = 0; step < steps; step++) {
    const nextX = clamp(x + input.x * scale, WORLD_BOUNDS.minX + EDGE_CLEARANCE, WORLD_BOUNDS.maxX - EDGE_CLEARANCE);
    if (!blocked(nextX, z)) x = nextX;
    const nextZ = clamp(z + input.z * scale, WORLD_BOUNDS.minZ + EDGE_CLEARANCE, WORLD_BOUNDS.maxZ - EDGE_CLEARANCE);
    if (!blocked(x, nextZ)) z = nextZ;
  }

  return x === position.x && z === position.z ? position : { x, z };
}

export function facingYaw(input: GroundPoint) {
  return Math.atan2(-input.x, -input.z);
}

export function interpolatePoint(from: GroundPoint, to: GroundPoint, alpha: number): GroundPoint {
  const t = Math.min(1, Math.max(0, alpha));
  return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
}

export function isBlocked(x: number, z: number) {
  return blocked(x, z);
}

export function interpolateYaw(from: number, to: number, alpha: number) {
  const t = Math.min(1, Math.max(0, alpha));
  const turn = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + turn * t;
}
