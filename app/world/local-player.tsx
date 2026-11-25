"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { PerspectiveCamera, type Camera, type Group } from "three";
import { walk, type GroundPoint } from "../../src/shared/movement";
import type { AvatarColor } from "../../src/shared/protocol.ts";
import { SPAWN_POSITION, type AvatarKind } from "../../src/shared/world";
import { Avatar } from "./avatar";

const moveCodes = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
]);

function canMove(surface: HTMLElement | null) {
  const focus = document.activeElement;
  return document.visibilityState === "visible" &&
    surface !== null && focus instanceof HTMLElement && surface.contains(focus) &&
    !focus.isContentEditable && !focus.closest("input, textarea, select, button, [role='textbox']") &&
    !document.querySelector("dialog[open], [role='dialog'][aria-modal='true']:not([hidden])");
}

function follow(camera: Camera, { x, z }: GroundPoint) {
  const aspect = camera instanceof PerspectiveCamera ? camera.aspect : 1;
  const distance = Math.max(1, 1.27 / aspect);
  camera.position.set(x * 0.66, 13.7 * distance, z * 0.75 + 19 * distance);
  camera.lookAt(x * 0.66, 1.75, z * 0.75 - 8.1);
}

export function LocalPlayer({ surface, kind, color }: {
  surface: RefObject<HTMLElement | null>;
  kind: AvatarKind;
  color: AvatarColor;
}) {
  const { get, invalidate, size } = useThree();
  const body = useRef<Group>(null);
  const position = useRef<GroundPoint>({ x: SPAWN_POSITION[0], z: SPAWN_POSITION[2] });
  const held = useRef(new Set<string>());
  const lastFrame = useRef<number | null>(null);

  useLayoutEffect(() => {
    follow(get().camera, position.current);
    invalidate();
  }, [get, invalidate, size.width, size.height]);

  useEffect(() => {
    const stage = surface.current;
    if (!stage) return;

    function clear() {
      held.current.clear();
      lastFrame.current = null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!moveCodes.has(event.code) || event.altKey || event.ctrlKey || event.metaKey ||
        !canMove(stage)) return;
      event.preventDefault();
      if (event.repeat) return;
      if (held.current.size === 0) lastFrame.current = performance.now();
      held.current.add(event.code);
      invalidate();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (!held.current.delete(event.code)) return;
      if (held.current.size === 0) lastFrame.current = null;
      else invalidate();
    }

    stage.addEventListener("keydown", onKeyDown);
    stage.addEventListener("focusout", clear);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      clear();
      stage.removeEventListener("keydown", onKeyDown);
      stage.removeEventListener("focusout", clear);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [invalidate, surface]);

  useFrame(({ camera }) => {
    const player = body.current;
    const keys = held.current;
    if (!player || keys.size === 0) return;
    if (!canMove(surface.current)) {
      keys.clear();
      lastFrame.current = null;
      return;
    }

    const now = performance.now();
    const seconds = (now - (lastFrame.current ?? now)) / 1000;
    lastFrame.current = now;
    const right = keys.has("KeyD") || keys.has("ArrowRight");
    const left = keys.has("KeyA") || keys.has("ArrowLeft");
    const back = keys.has("KeyS") || keys.has("ArrowDown");
    const forward = keys.has("KeyW") || keys.has("ArrowUp");
    const input = { x: Number(right) - Number(left), z: Number(back) - Number(forward) };
    const next = walk(position.current, input, seconds);
    if (next === position.current) {
      // A key or focus change will wake the renderer after a full stop.
      if (seconds === 0 && (input.x || input.z)) invalidate();
      else lastFrame.current = null;
      return;
    }

    position.current = next;
    player.position.set(next.x, 0.14, next.z);
    player.rotation.set(0, Math.atan2(-input.x, -input.z), 0);
    follow(camera, next);
    invalidate();
  });

  return (
    <group name="local-avatar" ref={body} rotation-y={Math.PI * .88} position={[SPAWN_POSITION[0], 0.14, SPAWN_POSITION[2]]}>
      <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.49, 12]} />
        <meshBasicMaterial color="#241a29" opacity={0.35} transparent depthWrite={false} />
      </mesh>
      <Avatar kind={kind} color={color} />
    </group>
  );
}
