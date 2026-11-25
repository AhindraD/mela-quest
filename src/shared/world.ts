export type WorldPoint = [x: number, y: number, z: number];

// One unit is roughly one metre. X points right from the entrance,
// Y points up, and positive Z points toward the entrance.
export const WORLD_BOUNDS = { minX: -17, maxX: 17, minZ: -14, maxZ: 14 } as const;

export const SPAWN_POSITION: WorldPoint = [0, 0, 11];

export const LANDMARKS = {
  fountain: [0, 0, 0],
  balloonStall: [-10, 0, 3],
  mithaiShop: [10, 0, 3],
  ferrisWheel: [9, 0, -8],
  dancePavilion: [-9, 0, -8],
} satisfies Record<string, WorldPoint>;
