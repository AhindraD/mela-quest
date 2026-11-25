export type WorldPoint = [x: number, y: number, z: number];
export const AVATAR_KINDS = ["Man", "Woman", "Cat"] as const;
export type AvatarKind = (typeof AVATAR_KINDS)[number];

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

export const LANDMARK_FOOTPRINTS = {
  fountainRadius: 3.83,
  stall: { width: 5.85, depth: 3.85 },
  ferrisWheel: { width: 8.1, depth: 3.9 },
  dancePavilion: { width: 7.6, depth: 5.62 },
  pavilionStep: { width: 4.1, depth: 1.18, offsetZ: 3.17 },
} as const;

export const LANTERN_POSITIONS: WorldPoint[] = [
  [-3.35, 0, 13.55], [3.35, 0, 13.55],
  [-7.4, 0, -1.7], [7.4, 0, -1.7],
  [-14.5, 0, 8], [14.5, 0, 8],
];

// Convex outline shared by the island mesh, fence rails and collision planes.

export const FAIR_PERIMETER = [
  [-12, -14], [12, -14], [17, -9], [17, 6], [13, 10.9], [8, 13], [3, 14], [-3, 14], [-8, 13], [-13, 10.9], [-17, 6], [-17, -9],
] as const;

export const PLANTING_BEDS: WorldPoint[] = [
  [-11.7, 0, 8.3], [11.7, 0, 8.3], [-13.5, 0, -8], [4.4, 0, -10.6],
];

export type AttractionId = keyof typeof LANDMARKS;

export interface InteractionZone {
  id: AttractionId;
  label: string;
  anchor: WorldPoint;
  approach: WorldPoint;
  radius: number;
}

export const INTERACTION_ZONES: Record<AttractionId, InteractionZone> = {
  fountain: {
    id: "fountain",
    label: "Plaza Fountain",
    anchor: LANDMARKS.fountain,
    approach: [0, 0, 4.9],
    radius: 5.4,
  },
  balloonStall: {
    id: "balloonStall",
    label: "Balloon Stall",
    anchor: LANDMARKS.balloonStall,
    approach: [-10, 0, 5.8],
    radius: 4.2,
  },
  mithaiShop: {
    id: "mithaiShop",
    label: "Mithai Shop",
    anchor: LANDMARKS.mithaiShop,
    approach: [10, 0, 5.8],
    radius: 4.2,
  },
  ferrisWheel: {
    id: "ferrisWheel",
    label: "Ferris Wheel",
    anchor: LANDMARKS.ferrisWheel,
    approach: [9, 0, -5.0],
    radius: 5.2,
  },
  dancePavilion: {
    id: "dancePavilion",
    label: "Dance Pavilion",
    anchor: LANDMARKS.dancePavilion,
    approach: [-9, 0, -3.5],
    radius: 5.5,
  },
};
