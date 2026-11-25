"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { PerspectiveCamera, type Camera, type Group } from "three";
import {
  CORRECTION_DISTANCE,
  INPUT_REFRESH_MS,
  walk,
  type GroundPoint,
} from "../../src/shared/movement";
import type { AvatarColor } from "../../src/shared/protocol.ts";
import type { AvatarKind } from "../../src/shared/world";
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

function axes(keys: ReadonlySet<string>): GroundPoint {
  const right = keys.has("KeyD") || keys.has("ArrowRight");
  const left = keys.has("KeyA") || keys.has("ArrowLeft");
  const back = keys.has("KeyS") || keys.has("ArrowDown");
  const forward = keys.has("KeyW") || keys.has("ArrowUp");
  return { x: Number(right) - Number(left), z: Number(back) - Number(forward) };
}

function follow(camera: Camera, { x, z }: GroundPoint) {
  const aspect = camera instanceof PerspectiveCamera ? camera.aspect : 1;
  const distance = Math.max(1, 1.27 / aspect);
  camera.position.set(x * 0.66, 13.7 * distance, z * 0.75 + 19 * distance);
  camera.lookAt(x * 0.66, 1.75, z * 0.75 - 8.1);
}

export function LocalPlayer({ surface, kind, color, initial, authoritative, onInput }: {
  surface: RefObject<HTMLElement | null>;
  kind: AvatarKind;
  color: AvatarColor;
  initial: GroundPoint & { yaw: number };
  authoritative: (GroundPoint & { yaw: number }) | null;
  onInput: (input: GroundPoint) => void;
}) {
  const { get, invalidate, size } = useThree();
  const body = useRef<Group>(null);
  const position = useRef<GroundPoint>({ x: initial.x, z: initial.z });
  const yaw = useRef(initial.yaw);
  const held = useRef(new Set<string>());
  const lastFrame = useRef<number | null>(null);
  const onInputRef = useRef(onInput);
  const server = useRef(authoritative);
  const serverAt = useRef(0);

  useLayoutEffect(() => {
    onInputRef.current = onInput;
    server.current = authoritative;
    serverAt.current = performance.now();
  }, [authoritative, onInput]);

  useLayoutEffect(() => {
    const player = body.current;
    if (!player) return;
    player.position.set(position.current.x, 0.14, position.current.z);
    player.rotation.y = yaw.current;
    follow(get().camera, position.current);
    invalidate();
  }, [get, invalidate, size.width, size.height]);

  useEffect(() => {
    const stage = surface.current;
    if (!stage) return;

    function publish() {
      onInputRef.current(axes(held.current));
    }

    function clear() {
      if (held.current.size === 0) {
        lastFrame.current = null;
        return;
      }
      held.current.clear();
      lastFrame.current = null;
      publish();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!moveCodes.has(event.code) || event.altKey || event.ctrlKey || event.metaKey ||
        !canMove(stage)) return;
      event.preventDefault();
      if (event.repeat) return;
      if (held.current.size === 0) lastFrame.current = performance.now();
      held.current.add(event.code);
      publish();
      invalidate();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (!held.current.delete(event.code)) return;
      if (held.current.size === 0) lastFrame.current = null;
      publish();
      if (held.current.size > 0) invalidate();
    }

    const refresh = window.setInterval(() => {
      if (held.current.size > 0 && canMove(stage)) publish();
    }, INPUT_REFRESH_MS);

    stage.addEventListener("keydown", onKeyDown);
    stage.addEventListener("focusout", clear);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.clearInterval(refresh);
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
    if (!player) return;
    const reported = server.current;
    if (reported && performance.now() - serverAt.current < 400) {
      const offsetX = reported.x - position.current.x;
      const offsetZ = reported.z - position.current.z;
      if (offsetX * offsetX + offsetZ * offsetZ > CORRECTION_DISTANCE * CORRECTION_DISTANCE) {
        position.current = { x: reported.x, z: reported.z };
        yaw.current = reported.yaw;
        player.position.set(reported.x, 0.14, reported.z);
        player.rotation.y = reported.yaw;
        follow(camera, position.current);
      }
    }

    const keys = held.current;
    if (keys.size === 0) return;
    if (!canMove(surface.current)) {
      keys.clear();
      lastFrame.current = null;
      onInputRef.current({ x: 0, z: 0 });
      return;
    }

    const now = performance.now();
    const seconds = (now - (lastFrame.current ?? now)) / 1000;
    lastFrame.current = now;
    const input = axes(keys);
    const next = walk(position.current, input, seconds);
    if (next === position.current) {
      if (seconds === 0 && (input.x || input.z)) invalidate();
      else lastFrame.current = null;
      return;
    }

    position.current = next;
    yaw.current = Math.atan2(-input.x, -input.z);
    player.position.set(next.x, 0.14, next.z);
    player.rotation.y = yaw.current;
    follow(camera, next);
    invalidate();
  });

  return (
    <group name="local-avatar" ref={body}>
      <mesh name="shadow" position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.49, 12]} />
        <meshBasicMaterial color="#241a29" opacity={0.35} transparent depthWrite={false} />
      </mesh>
      <Avatar kind={kind} color={color} />
    </group>
  );
}
