"use client";

import { AdditiveBlending, NoToneMapping } from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useState, type RefObject } from "react";
import type { GroundPoint } from "../../src/shared/movement";
import type { AvatarColor, PlayerPose } from "../../src/shared/protocol.ts";
import type { AvatarKind } from "../../src/shared/world";
import { LocalPlayer } from "./local-player";
import { PreviewFallback } from "./preview-fallback";
import { RemotePlayers } from "./remote-players";
import { buildFair } from "./painted-fair";

const fair = buildFair();
function ContextMonitor({ onContextLost }: { onContextLost: () => void }) {
  const gl = useThree((state) => state.gl);
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

export default function CarnivalScene({ surface, kind, color, initial, authoritative, remotes, onInput }: {
  surface: RefObject<HTMLElement | null>;
  kind: AvatarKind;
  color: AvatarColor;
  initial: GroundPoint & { yaw: number };
  authoritative: (GroundPoint & { yaw: number }) | null;
  remotes: PlayerPose[];
  onInput: (input: GroundPoint) => void;
}) {
  const [supported] = useState(supportsWebGL);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  if (!supported || lost) return <PreviewFallback />;

  return (
    <>
      {!ready && <p className="world-message" role="status">Loading the 3D carnival…</p>}
      <div className="world-canvas" role={ready ? "img" : undefined}
        aria-label={ready ? "Painted Wood carnival scene" : undefined}>
        <Canvas camera={{ fov: 53, near: 0.1, far: 90 }}
          gl={{ toneMapping: NoToneMapping }} frameloop="demand" dpr={[1, 1.5]} onCreated={() => setReady(true)}>

          <hemisphereLight args={["#fff0df", "#b29da8", 1.17]} />
          <directionalLight position={[-9, 17, 10]} color="#ffdda5" intensity={1.85} />
          <ContextMonitor onContextLost={() => setLost(true)} />
          <mesh geometry={fair.painted} dispose={null}>
            <meshStandardMaterial map={fair.groundMap} vertexColors flatShading roughness={1} />
          </mesh>
          <mesh geometry={fair.lit} dispose={null}><meshBasicMaterial vertexColors /></mesh>
          <mesh geometry={fair.glows} dispose={null}>
            <meshBasicMaterial vertexColors transparent depthWrite={false} blending={AdditiveBlending} />
          </mesh>
          <mesh geometry={fair.signs} dispose={null}>
            <meshBasicMaterial map={fair.signMap} />
          </mesh>
          <LocalPlayer surface={surface} kind={kind} color={color} initial={initial}
            authoritative={authoritative} onInput={onInput} />
          <RemotePlayers players={remotes} />
        </Canvas>
      </div>
    </>
  );
}
