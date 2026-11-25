import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { AvatarColor } from "../../src/shared/protocol.ts";
import type { AvatarKind, WorldPoint } from "../../src/shared/world";

const accentPaint: Record<AvatarColor, string> = {
  marigold: "#ee9931", rose: "#c34871", mint: "#7bc9a7", indigo: "#a792ed",
};
const box = new RoundedBoxGeometry(1, 1, 1, 1, 0.09);
const dark = "#392622";
const cream = "#ffe0a1";

function Block({ at, size, color, tilt = 0, slant = 0 }: {
  at: WorldPoint;
  size: WorldPoint;
  color: string;
  tilt?: number;
  slant?: number;
}) {
  return (
    <mesh geometry={box} position={at} scale={size} rotation-x={tilt} rotation-z={slant}>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

export function Avatar({ kind, color }: { kind: AvatarKind; color: AvatarColor }) {
  const accent = accentPaint[color];
  if (kind === "Cat") {
    return (
      <>
        <Block at={[0, 0.49, 0.13]} size={[0.66, 0.49, 0.79]} color="#6d5056" />
        <Block at={[0, 0.76, -0.33]} size={[0.7, 0.56, 0.57]} color="#8a6664" />
        <Block at={[0, 0.66, -0.62]} size={[0.32, 0.16, 0.09]} color={cream} />
        <Block at={[0, .73, -.676]} size={[.108, .07, .054]} color="#d89186" />
        <Block at={[0, 0.54, -0.27]} size={[0.72, 0.13, 0.23]} color={accent} />
        <Block at={[0, 0.748, 0.23]} size={[0.64, 0.05, 0.37]} color={accent} />
        <Block at={[0.08, 0.54, 0.65]} size={[0.17, 0.18, 0.58]} color="#5e454f" tilt={-0.68} />
        {([-1, 1] as const).map((side) => (
          <group key={side}>
            <mesh position={[side * 0.23, 1.08, -0.32]} rotation-y={Math.PI}>
              <coneGeometry args={[0.19, 0.35, 3]} />
              <meshStandardMaterial color="#6d5056" flatShading />
            </mesh>
            <Block at={[side * 0.17, 0.84, -0.621]} size={[0.085, 0.1, 0.025]} color={dark} />
            <Block at={[side * .19, .69, -.627]} size={[.16, .025, .026]} slant={side * .13} color={cream} />
            <mesh position={[side * .23, 1.085, -.397]} rotation-y={Math.PI}>
              <coneGeometry args={[.105, .19, 3]} /><meshStandardMaterial color="#d89491" />
            </mesh>
            <Block at={[side * 0.22, 0.2, -0.16]} size={[0.2, 0.34, 0.22]} color={cream} />
            <Block at={[side * 0.22, 0.2, 0.4]} size={[0.2, 0.34, 0.24]} color={cream} />
          </group>
        ))}
      </>
    );
  }

  const woman = kind === "Woman";
  const skin = woman ? "#a96d4a" : "#c08a62";
  return (
    <>
      <Block at={[0, 1.11, 0]} size={[0.72, 0.82, 0.49]} color={cream} />
      <Block at={[0, 0.77, 0]} size={[0.76, 0.1, 0.51]} color="#c48b45" />
      {[-1, 1].map((side) => <Block key={side} at={[0, 1.16, side * .246]}
        size={[.27, .99, .055]} slant={-side * .58} color={accent} />)}
      <Block at={[.24, .77, -.257]} size={[.24, .36, .065]} color={accent} />
      <Block at={[0, 1.83, -0.015]} size={[0.82, 0.73, 0.67]} color={skin} />
      <Block at={[0, 2.17, 0.03]} size={[0.88, 0.28, 0.73]} color={dark} />
      <Block at={[-.16, 2.105, -.325]} size={[.57, .2, .15]} color={dark} slant={-.18} />
      <Block at={[.35, 2.01, -.18]} size={[.13, .32, .38]} color={dark} />
      <Block at={[0, 1.95, .303]} size={[.82, .39, .11]} color={dark} />
      {woman && <>
        <Block at={[-.31, 1.78, .17]} size={[.29, .79, .43]} color={dark} />
        <Block at={[-.365, 1.47, -.14]} size={[.20, .38, .32]} color={dark} />
        <Block at={[-.35, 1.25, -.27]} size={[.17, .23, .19]} color={dark} />
        <Block at={[-.35, 1.19, -.27]} size={[.18, .06, .20]} color={accent} />
        <Block at={[0, 1.96, -.356]} size={[.049, .064, .019]} color="#bb3e50" />
      </>}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * .181, 1.85, -.355]} scale={[.055, .059, .017]}>
            <sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color={dark} />
          </mesh>
          <Block at={[side * .426, 1.78, .005]} size={[.095, .187, .156]} color={skin} />
          {woman && <Block at={[side * .43, 1.68, -.041]} size={[.091, .092, .09]} color="#f5b63b" />}
          <Block at={[side * .446, 1.23, 0]} size={[.24, .43, .33]} slant={side * .15} color={cream} />
          <Block at={[side * .475, 1.045, 0]} size={[.245, .085, .335]} slant={side * .15} color="#e29b46" />
          <Block at={[side * 0.484, 0.92, 0]} size={[0.17, 0.23, 0.23]} color={skin} />
          <Block at={[side * 0.18, 0.49, 0]} size={[0.27, 0.61, 0.31]} color="#f7c88a" />
          <Block at={[side * 0.18, 0.16, -0.065]} size={[0.29, 0.21, 0.43]} color={dark} />
        </group>
      ))}
    </>
  );
}
