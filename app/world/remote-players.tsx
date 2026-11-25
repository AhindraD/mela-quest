"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { SNAPSHOT_INTERVAL_MS, interpolatePoint, interpolateYaw } from "../../src/shared/movement";
import type { PlayerPose } from "../../src/shared/protocol.ts";
import { Avatar } from "./avatar";

interface Sample {
  fromX: number;
  fromZ: number;
  fromYaw: number;
  toX: number;
  toZ: number;
  toYaw: number;
  at: number;
}

export function RemotePlayers({ players }: { players: PlayerPose[] }) {
  const invalidate = useThree((state) => state.invalidate);
  const root = useRef<Group>(null);
  const samples = useRef(new Map<string, Sample>());

  useLayoutEffect(() => {
    const now = performance.now();
    const seen = new Set<string>();
    for (const player of players) {
      seen.add(player.playerId);
      const next = { toX: player.x, toZ: player.z, toYaw: player.yaw };
      const current = samples.current.get(player.playerId);
      if (!current) {
        samples.current.set(player.playerId, { ...next, fromX: next.toX, fromZ: next.toZ, fromYaw: next.toYaw, at: now });
        continue;
      }
      if (current.toX === next.toX && current.toZ === next.toZ && current.toYaw === next.toYaw) continue;
      const alpha = (now - current.at) / SNAPSHOT_INTERVAL_MS;
      const point = interpolatePoint(
        { x: current.fromX, z: current.fromZ },
        { x: current.toX, z: current.toZ },
        alpha,
      );
      samples.current.set(player.playerId, {
        ...next,
        fromX: point.x,
        fromZ: point.z,
        fromYaw: interpolateYaw(current.fromYaw, current.toYaw, alpha),
        at: now,
      });
    }
    for (const playerId of samples.current.keys()) {
      if (!seen.has(playerId)) samples.current.delete(playerId);
    }
    invalidate();
  }, [invalidate, players]);

  useFrame(() => {
    const group = root.current;
    if (!group) return;
    const now = performance.now();
    let moving = false;
    for (const child of group.children) {
      const sample = samples.current.get(child.name);
      if (!sample) continue;
      const alpha = (now - sample.at) / SNAPSHOT_INTERVAL_MS;
      const point = interpolatePoint({ x: sample.fromX, z: sample.fromZ }, { x: sample.toX, z: sample.toZ }, alpha);
      child.position.set(point.x, 0.14, point.z);
      child.rotation.y = interpolateYaw(sample.fromYaw, sample.toYaw, alpha);
      if (alpha < 1) moving = true;
    }
    if (moving) invalidate();
  });

  return (
    <group ref={root} name="remote-avatars">
      {players.map((player) => <RemoteAvatar key={player.playerId} player={player} />)}
    </group>
  );
}

function RemoteAvatar({ player }: { player: PlayerPose }) {
  const body = useRef<Group>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const avatar = body.current;
    if (!avatar) return;
    if (!placed.current) {
      placed.current = true;
      avatar.position.set(player.x, 0.14, player.z);
      avatar.rotation.y = player.yaw;
    }
    const opacity = player.connected ? 1 : 0.45;
    avatar.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || mesh.name === "shadow" || Array.isArray(mesh.material)) return;
      const material = mesh.material as MeshStandardMaterial;
      material.transparent = opacity < 1;
      material.opacity = opacity;
      material.needsUpdate = true;
    });
  });

  return (
    <group ref={body} name={player.playerId}>
      <mesh name="shadow" position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.49, 12]} />
        <meshBasicMaterial color="#241a29" opacity={player.connected ? 0.35 : 0.2} transparent depthWrite={false} />
      </mesh>
      <Avatar kind={player.avatar} color={player.color} />
    </group>
  );
}
