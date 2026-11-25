"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  BoxGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
} from "three";
import { LANDMARKS, SPAWN_POSITION, WORLD_BOUNDS, type WorldPoint } from "../../src/shared/world";
import { PreviewFallback } from "./preview-fallback";

const paint = {
  soil: "#35243d",
  grass: "#394747",
  path: "#c69058",
  paving: "#b77c52",
  wood: "#91462e",
  trim: "#df9a45",
  indigo: "#493a75",
  stone: "#bd8b63",
  water: "#458b89",
  light: "#ffd58b",
  rose: "#c25472",
  mint: "#74a98b",
  plum: "#5b4164",
};

type Paint = keyof typeof paint;
const materials = new Map<Paint, MeshStandardMaterial | MeshBasicMaterial>(
  (Object.keys(paint) as Paint[]).map((name) => [
    name,
    name === "light"
      ? new MeshBasicMaterial({ color: paint[name] })
      : new MeshStandardMaterial({ color: paint[name], roughness: 0.92 }),
  ]),
);
const unitBox = new BoxGeometry(1, 1, 1);

function Box({ at, size, color, angle = 0 }: {
  at: WorldPoint;
  size: WorldPoint;
  color: Paint;
  angle?: number;
}) {
  return <mesh geometry={unitBox} material={materials.get(color)} position={at}
    scale={size} rotation-z={angle} />;
}

function Disc({ at, radius, height, color, sides = 12 }: {
  at: WorldPoint;
  radius: number;
  height: number;
  color: Paint;
  sides?: number;
}) {
  return (
    <mesh position={at} material={materials.get(color)}>
      <cylinderGeometry args={[radius, radius, height, sides]} />
    </mesh>
  );
}

function Lantern({ at }: { at: WorldPoint }) {
  return (
    <group position={at}>
      <Box at={[0, 0.85, 0]} size={[0.23, 1.7, 0.23]} color="wood" />
      <Box at={[0, 1.8, 0]} size={[0.56, 0.18, 0.56]} color="trim" />
      <Box at={[0, 2.1, 0]} size={[0.42, 0.48, 0.42]} color="light" />
      <Box at={[0, 2.4, 0]} size={[0.58, 0.16, 0.58]} color="indigo" />
    </group>
  );
}

function Ground() {
  const width = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
  const depth = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
  return (
    <>
      <Box at={[0, -0.6, 0]} size={[width + 0.5, 1.1, depth + 0.5]} color="soil" />
      <Box at={[0, -0.06, 0]} size={[width, 0.12, depth]} color="grass" />
      <Box at={[0, 0.02, 4]} size={[5.4, 0.045, 20]} color="path" />
      <Box at={[0, 0.03, 3]} size={[26, 0.055, 4]} color="path" />
      <Box at={[0, 0.03, -7]} size={[23, 0.055, 4]} color="paving" />
      <Box at={[-6.6, 0.04, -2]} size={[3.2, 0.055, 10]} color="paving" />
      <Box at={[6.6, 0.04, -2]} size={[3.2, 0.055, 10]} color="paving" />
      <Disc at={[0, 0.06, 0]} radius={7.1} height={0.12} color="paving" />
      <Disc at={[0, 0.13, 0]} radius={6.7} height={0.08} color="path" />
      <Box at={[0, 0.19, SPAWN_POSITION[2]]} size={[3.6, 0.08, 0.75]} color="trim" />
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <Box at={[side * 16.9, 0.36, 0]} size={[0.3, 0.72, depth]} color="wood" />
          <Box at={[side * 10.3, 0.36, 13.85]} size={[13.4, 0.72, 0.3]} color="wood" />
          <Lantern at={[side * 3.35, 0, 12.3]} />
          <Lantern at={[side * 7.4, 0, -1.7]} />
          <Lantern at={[side * 14.5, 0, 8]} />
        </group>
      ))}
      <Box at={[0, 0.36, -13.85]} size={[width, 0.72, 0.3]} color="wood" />
    </>
  );
}

function Fountain() {
  return (
    <group position={LANDMARKS.fountain}>
      <Disc at={[0, 0.37, 0]} radius={3.24} height={0.52} color="stone" sides={10} />
      <Disc at={[0, 0.65, 0]} radius={2.83} height={0.08} color="water" sides={10} />
      <Disc at={[0, 1.05, 0]} radius={0.57} height={0.8} color="stone" sides={8} />
      <Disc at={[0, 1.52, 0]} radius={1.44} height={0.27} color="stone" sides={8} />
      <Disc at={[0, 1.68, 0]} radius={1.16} height={0.06} color="water" sides={8} />
      <Disc at={[0, 1.81, 0]} radius={0.3} height={0.25} color="trim" sides={8} />
    </group>
  );
}

const stallPosts: WorldPoint[] = [
  [-2.1, 1.65, -1.26], [2.1, 1.65, -1.26], [-2.1, 1.65, 1.26], [2.1, 1.65, 1.26],
];

function Stall({ kind }: { kind: "balloons" | "mithai" }) {
  const balloons = kind === "balloons";
  return (
    <group position={balloons ? LANDMARKS.balloonStall : LANDMARKS.mithaiShop}>
      <Box at={[0, 0.15, 0]} size={[5, 0.3, 3.3]} color="wood" />
      {stallPosts.map((at) => <Box key={at.join()} at={at} size={[0.22, 2.9, 0.22]} color="wood" />)}
      <Box at={[0, 0.75, 1.01]} size={[4.35, 0.9, 0.65]} color="wood" />
      <Box at={[0, 1.27, 1.01]} size={[4.62, 0.18, 0.88]} color="trim" />
      <Box at={[0, 3.25, 0]} size={[5.12, 0.24, 3.66]} color={balloons ? "indigo" : "plum"} />
      <Box at={[0, 3.48, -0.12]} size={[4.65, 0.26, 2.94]} color={balloons ? "indigo" : "plum"} />
      <Box at={[0, 3.1, 1.79]} size={[5.12, 0.14, 0.16]} color="trim" />
      {(["rose", "trim", "mint"] as const).map((color, index) => {
        const x = (index - 1) * 0.96;
        return balloons ? (
          <group key={color} position={[x, 0, 1.14]}>
            <Box at={[0, 1.74, 0]} size={[0.05, 0.74, 0.05]} color="stone" />
            <mesh position={[0, 2.16 + (index % 2) * 0.25, 0]} material={materials.get(color)}>
              <sphereGeometry args={[0.44, 8, 6]} />
            </mesh>
          </group>
        ) : <Box key={color} at={[x, 1.53, 1.11]} size={[0.73, 0.35, 0.53]} color={color} />;
      })}
    </group>
  );
}

function DancePavilion() {
  return (
    <group position={LANDMARKS.dancePavilion}>
      <Box at={[0, 0.34, 0]} size={[6.5, 0.68, 4.8]} color="wood" />
      <Box at={[0, 0.17, 2.6]} size={[3.5, 0.34, 0.8]} color="trim" />
      <Box at={[0, 0.71, 0]} size={[6.2, 0.09, 4.5]} color="paving" />
      {stallPosts.map(([x, , z]) => (
        <Box key={`${x},${z}`} at={[x * 1.27, 2.35, z * 1.43]} size={[0.28, 3.32, 0.28]} color="wood" />
      ))}
      <Box at={[0, 4.05, 0]} size={[6.54, 0.25, 4.95]} color="indigo" />
      <Box at={[0, 4.34, 0]} size={[5.46, 0.37, 3.94]} color="indigo" />
      <Box at={[0, 3.85, 2.41]} size={[6.36, 0.19, 0.2]} color="trim" />
      <Box at={[0, 3.53, 2.05]} size={[0.38, 0.48, 0.38]} color="light" />
    </group>
  );
}

const wheelRadius = 3.3;
const wheelCenter = 4.65;
const wheelSeats = Array.from({ length: 6 }, (_, index) => Math.PI / 2 + (index * Math.PI) / 3);

function FerrisWheel() {
  return (
    <group position={LANDMARKS.ferrisWheel}>
      <Box at={[0, 0.19, 0]} size={[8.1, 0.38, 3.9]} color="wood" />
      <Box at={[-1.35, 2.52, -0.32]} size={[0.48, 4.9, 0.48]} color="wood" angle={-0.46} />
      <Box at={[1.35, 2.52, -0.32]} size={[0.48, 4.9, 0.48]} color="wood" angle={0.46} />
      <mesh position={[0, wheelCenter, 0]} material={materials.get("wood")}>
        <torusGeometry args={[wheelRadius, 0.16, 5, 18]} />
      </mesh>
      <Box at={[0, wheelCenter, 0.16]} size={[0.73, 0.73, 0.45]} color="trim" angle={Math.PI / 4} />
      {wheelSeats.map((angle, index) => {
        const x = Math.cos(angle) * wheelRadius;
        const y = Math.sin(angle) * wheelRadius;
        return (
          <group key={angle}>
            <Box at={[x / 2, wheelCenter + y / 2, -0.04]} size={[wheelRadius, 0.16, 0.14]}
              color="trim" angle={angle} />
            <group position={[x, wheelCenter + y - 0.35, 0.35]}>
              <Box at={[0, 0, 0]} size={[1.05, 0.69, 0.64]} color={index % 2 ? "stone" : "trim"} />
              <Box at={[0, 0.08, 0.34]} size={[0.74, 0.31, 0.05]} color="light" />
              <Box at={[0, 0.42, 0]} size={[1.19, 0.22, 0.78]} color="indigo" />
            </group>
          </group>
        );
      })}
    </group>
  );
}

function CameraRig({ onContextLost }: { onContextLost: () => void }) {
  const { get, size, invalidate, gl } = useThree();
  useLayoutEffect(() => {
    const { camera } = get();
    if (!(camera instanceof OrthographicCamera)) return;
    camera.zoom = Math.min(size.width / 43, size.height / 33);
    camera.lookAt(0, 0, -1);
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, size.width, size.height, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", onContextLost);
    return () => canvas.removeEventListener("webglcontextlost", onContextLost);
  }, [gl, onContextLost]);
  return null;
}

function supportsWebGL() {
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function CarnivalScene() {
  const [supported] = useState(supportsWebGL);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  if (!supported || lost) return <PreviewFallback />;

  return (
    <>
      {!ready && <p className="world-message" role="status">Loading the 3D carnival…</p>}
      <div className="world-canvas" role={ready ? "img" : undefined}
        aria-label={ready ? "Painted Wood carnival scene" : undefined}>
        <Canvas orthographic camera={{ position: [11, 26, 35], near: 0.1, far: 120 }}
          frameloop="demand" dpr={[1, 1.5]} onCreated={() => setReady(true)}>
          <color attach="background" args={["#20172f"]} />
          <hemisphereLight args={["#ffe9d8", "#83769c", 1.65]} />
          <directionalLight position={[-12, 18, 9]} color="#ffdda5" intensity={1.95} />
          <CameraRig onContextLost={() => setLost(true)} />
          <Ground />
          <Fountain />
          <Stall kind="balloons" />
          <Stall kind="mithai" />
          <DancePavilion />
          <FerrisWheel />
        </Canvas>
      </div>
    </>
  );
}
