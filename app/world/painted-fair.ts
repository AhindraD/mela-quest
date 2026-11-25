import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Euler, Float32BufferAttribute,
  Matrix4, Quaternion, Shape, ShapeGeometry, SphereGeometry, Vector3, SRGBColorSpace,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LANDMARKS, PLANTING_BEDS, LANDMARK_FOOTPRINTS, LANTERN_POSITIONS, FAIR_PERIMETER, type WorldPoint } from "../../src/shared/world";

const timber = "#974f2c", darkWood = "#663725", honey = "#e99537", gold = "#ffb94f";
const purple = "#52349a", violet = "#6442a0", cream = "#ffe99a";
const stone = "#f5c888", water = "#69daba";
const cube = new BoxGeometry();
const fruit = new SphereGeometry(1, 8, 5);

// Batch scenery, bulbs and translucent halos into three static meshes.
export function buildFair() {
  const painted: BufferGeometry[] = [], lit: BufferGeometry[] = [];
  const glows: BufferGeometry[] = [];
  const lightPools: WorldPoint[] = [];
  let origin: WorldPoint = [0, 0, 0];
  let yaw = 0;
  let modelScale = 1;
  function part(shape: BufferGeometry, x: number, y: number, z: number, scale: WorldPoint,
    color: string, rotation: WorldPoint = [0, 0, 0], glow = false) {
    const g = shape.index ? shape.toNonIndexed() : shape.clone();
    g.deleteAttribute("uv");
    const local = new Matrix4().compose(new Vector3(x, y, z),
      new Quaternion().setFromEuler(new Euler(...rotation)), new Vector3(...scale));
    const group = new Matrix4().makeRotationY(yaw).scale(new Vector3(modelScale, modelScale, modelScale)).setPosition(...origin);
    g.applyMatrix4(group.multiply(local));
    const positions = g.getAttribute("position");
    g.computeBoundingBox();
    const floor = g.boundingBox!.max.y < .22;
    const uv = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i++) {

      uv[i * 2] = floor ? .5 + positions.getX(i) / 40 : .005;
      uv[i * 2 + 1] = floor ? .5 - positions.getZ(i) / 40 : .995;
    }
    g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    const tint = new Color(color);
    const colors = new Float32Array(g.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    (glow ? lit : painted).push(g);
  }
  function box(x: number, y: number, z: number, w: number, h: number, d: number, c: string, rz = 0) {
    part(cube, x, y, z, [w, h, d], c, [0, 0, rz]);
  }
  function drum(x: number, y: number, z: number, top: number, base: number, h: number, sides: number, c: string, stretch = 1) {
    const g = new CylinderGeometry(top, base, h, sides, 1, false, Math.PI / sides);
    part(g, x, y, z, [1, 1, stretch], c); g.dispose();
  }
  function beam(a: WorldPoint, b: WorldPoint, width: number, c: string) {
    const from = new Vector3(...a), to = new Vector3(...b);
    const dir = to.clone().sub(from);
    const mid = from.lerp(to, .5);
    const turn = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0), dir.clone().normalize()));
    part(cube, mid.x, mid.y, mid.z, [width, dir.length(), width], c, [turn.x, turn.y, turn.z]);
  }
  function shadow(x: number, z: number, w: number, d: number, y = .028) {
    // Concentric low-sided paint washes ground the pieces without shadow maps.
    for (let i = 0; i < 3; i++) drum(x + .14, y + i * .003, z + .12, w * (1 - i * .12), w * (1 - i * .12), .003, 12,
      ["#9b734b", "#976b47", "#866047"][i], d / w);
  }
  function lamp(x: number, y: number, z: number, s: number) {
    const center = new Vector3(x, y, z).multiplyScalar(modelScale).applyAxisAngle(new Vector3(0, 1, 0), yaw).add(new Vector3(...origin));
    lightPools.push([center.x, center.y, center.z]);
    // A single batched translucent halo pass gives the lanterns a soft edge.
    const positions: number[] = [], colors: number[] = [];
    const tint = new Color("#ffae35");
    for (let i = 0; i < 16; i++) {
      positions.push(center.x, center.y, center.z + .26 * s);
      colors.push(tint.r, tint.g, tint.b, .54);
      for (const j of [i, i + 1]) {
        const a = j * 2 * Math.PI / 16;
        positions.push(center.x + Math.cos(a) * s, center.y + Math.sin(a) * s, center.z + .26 * s);
        colors.push(tint.r, tint.g, tint.b, 0);
      }
    }
    const halo = new BufferGeometry();
    halo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    halo.setAttribute("color", new Float32BufferAttribute(colors, 4));
    glows.push(halo);
    box(x, y - .43 * s, z, .55 * s, .13 * s, .55 * s, timber);
    part(cube, x, y, z, [.42 * s, .73 * s, .42 * s], cream, [0, 0, 0], true);
    for (const dx of [-1, 1]) for (const dz of [-1, 1])
      box(x + dx * .22 * s, y, z + dz * .22 * s, .047 * s, .75 * s, .047 * s, honey);
    box(x, y + .44 * s, z, .65 * s, .16 * s, .65 * s, darkWood);
    box(x, y + .65 * s, z, .12 * s, .18 * s, .12 * s, gold);
  }

  // Chamfered timber base, matching the walkable outline.
  const ground = new BufferGeometry();
  const xyz: number[] = [];
  for (let i = 0; i < FAIR_PERIMETER.length; i++) {
    const [x, z] = FAIR_PERIMETER[i], [nx, nz] = FAIR_PERIMETER[(i + 1) % FAIR_PERIMETER.length];
    xyz.push(0, 0, 0, nx, 0, nz, x, 0, z, x, 0, z, nx, 0, nz, x, -.85, z, nx, 0, nz, nx, -.85, nz, x, -.85, z);
  }
  ground.setAttribute("position", new Float32BufferAttribute(xyz, 3)); ground.computeVertexNormals();
  part(ground, 0, 0, 0, [1, 1, 1], "#586340"); ground.dispose();
  // Broad ochre square with a tiled avenue and apron, as on the concept sheet.
  drum(0, .012, -1, 10, 10, .018, 10, "#c79456", 1.13);
  box(0, .013, 7.9, 6.1, .025, 12.2, "#c79456");
  const ochres = ["#dca564", "#e4b378", "#d19c60", "#e9b779", "#dba666"];
  for (let row = -5; row <= 7; row++) {
    for (let col = -5; col <= 5; col++) {
      const x = col * 1.92 + (row % 2) * .86, z = row * 1.84;
      if (Math.hypot(x / 9, (z + 1) / 10.5) > .94 && !(Math.abs(x) < 2.2 && z > 0 && z < 13.5)) continue;
      box(x, .029, z, 1.9, .02, 1.82, ochres[Math.abs(row * 7 + col * 3) % ochres.length]);
    }
  }
  for (let i = 0; i < FAIR_PERIMETER.length; i++) {
    const [x, z] = FAIR_PERIMETER[i], [nx, nz] = FAIR_PERIMETER[(i + 1) % FAIR_PERIMETER.length];
    function rail(ax: number, az: number, bx: number, bz: number) {
      const length = Math.hypot(bx - ax, bz - az), n = Math.ceil(length / 2.8);
      beam([ax, 1.1, az], [bx, 1.1, bz], .18, timber);
      beam([ax, .32, az], [bx, .32, bz], .12, darkWood);
      for (let j = 0; j <= n; j++) {
        const t = j / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        box(px, .65, pz, .26, 1.3, .26, timber);
        if (j === n) continue;
        const f = (j + .5) / n;
        const flag = new CylinderGeometry(.59, 0, .75, 3);
        part(flag, ax + (bx - ax) * f, .8, az + (bz - az) * f, [1, 1, .24], j % 2 ? gold : honey, [0, -Math.atan2(bz - az, bx - ax), 0]);
        flag.dispose();
      }
    }
    if (z !== 14 || nz !== 14) rail(x, z, nx, nz);
  }
  for (const [x, , z] of LANTERN_POSITIONS) {
    box(x, .72, z, .56, 1.44, .56, timber); box(x, 1.44, z, .76, .16, .76, honey); lamp(x, 2, z, z > 13 ? 1.65 : 1.24);
  }

  origin = LANDMARKS.fountain;
  modelScale = 1.18;
  shadow(0, 0, 3.7, 3.55, .046);
  const radius = LANDMARK_FOOTPRINTS.fountainRadius / modelScale;
  drum(0, .4, 0, radius, radius, .7, 8, timber);
  drum(0, .78, 0, radius, radius, .16, 8, stone);
  drum(0, .87, 0, radius - .31, radius - .31, .05, 8, "#42ac99");
  drum(0, 1.19, 0, .67, .85, .67, 8, "#a97e59");
  drum(0, 1.65, 0, 1.52, 1.07, .47, 8, stone);
  drum(0, 1.9, 0, 1.27, 1.27, .07, 8, water);
  drum(0, 2.14, 0, .39, .51, .5, 8, "#bc895a");
  drum(0, 2.49, 0, .76, .47, .32, 8, stone);
  drum(0, 2.66, 0, .56, .56, .04, 8, water);
  drum(0, 2.82, 0, .19, .27, .35, 6, gold);
  for (const side of [-1, 1]) {
    beam([side * 1.3, 1.9, .32], [side * 1.56, 1.8, .34], .19, "#91ddc1");
    beam([side * 1.56, 1.8, .34], [side * 1.56, .94, .34], .19, "#6bd0b8");
    drum(side * 1.56, .91, .34, .43, .43, .026, 8, "#86d5b5", .65);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    box(Math.sin(a) * 2.99, .43, Math.cos(a) * 2.99, .32, .67, .32, honey);
  }

  function canopy(width: number, depth: number, y: number, height: number) {
    // Four sloping painted faces and a warm valance.
    drum(0, y + height / 2, 0, .24, width / Math.SQRT2, height, 4, purple, depth / width);
    box(0, y, 0, width, .19, depth, violet);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * width / 7;
        const span = width / 7;
        const shape = new Shape();
        shape.moveTo(-.5, 0); shape.lineTo(.5, 0); shape.lineTo(.5, -.16);
        shape.quadraticCurveTo(0, -.87, -.5, -.16); shape.closePath();
        const scallop = new ShapeGeometry(shape, 4);
        part(scallop, x, y, side * (depth / 2 + .002), [span, 1, 1], gold, [0, side === 1 ? 0 : Math.PI, 0]);
        part(scallop, x, y + .13, side * (depth / 2 + .016), [span, .91, 1], purple, [0, side === 1 ? 0 : Math.PI, 0]);
        scallop.dispose();
      }
    }
  }
  for (const sweets of [false, true]) {
    origin = sweets ? LANDMARKS.mithaiShop : LANDMARKS.balloonStall;
    yaw = 0;
    box(0, .18, 0, 4.7, .36, 2.9, darkWood);
    for (const x of [-2, 2]) for (const z of [-1.18, 1.18]) box(x, 1.83, z, .23, 3.4, .23, timber);
    box(0, .88, 1, 4.48, 1.18, .65, timber);
    for (let i = -3; i <= 3; i++) box(i * .62, .88, 1.34, .58, 1.06, .09, i % 2 ? timber : "#ae6134");
    box(0, 1.5, 1.06, 4.7, .15, .96, honey);
    yaw = sweets ? -.085 : .085;
    canopy(5.3, 3.65, 3.55, .52);
    lamp(sweets ? 2.06 : -2.06, 2.76, 1.63, 1.04);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 1.13;
      if (sweets) {
        box(x, 1.63, 1.12, .98, .1, .82, stone);
        for (let k = 0; k < 4; k++) box(x + (k % 2 - .5) * .39, 1.86, 1.12 + (Math.floor(k / 2) - .5) * .37, .37, .35, .35, [gold, cream, "#dd7986"][i]);
        box(x, 2.17, 1.12, .38, .32, .36, [gold, cream, "#dd7986"][i]);
      } else {
        const y = 2.44 + (i % 2) * .34;
        beam([x * .57, 1.56, 1.1], [x, y, 1.05], .044, honey);
        part(fruit, x, y, 1.05, [.46, .61, .43], ["#f5a327", "#d95886", "#56a995"][i]);
      }
    }
  }

  origin = LANDMARKS.dancePavilion; yaw = 0;
  box(0, .36, 0, 6.5, .72, 4.8, timber); box(0, .74, 0, 6.5, .12, 4.8, honey);
  for (let i = 0; i < 3; i++) box(0, .12 + i * .105, 2.92 - i * .32, 3.5, .24 + i * .21, .52, i % 2 ? honey : timber);
  for (const x of [-2.9, 2.9]) for (const z of [-2, 2]) {
    box(x, 2.72, z, .34, 4, .34, timber); box(x, .99, z, .53, .46, .53, honey);
    lamp(x, 4.17, z, .77);
  }
  canopy(7.25, 5.55, 5.02, 1.92);
  drum(0, 7.13, 0, .4, .48, .4, 8, honey);
  for (let i = -1; i <= 1; i++) {
    for (let j = 0; j <= 6; j++) {
      const t = j / 6;
      box(i * 2.02 + (t - .5) * 2.02, 4.61 - .64 * Math.sin(Math.PI * t), 2.59, .4, .43, .15,
        i % 2 ? "#d35068" : "#e7854c", -.7 * Math.cos(t * Math.PI));
    }
  }

  modelScale = 1;
  origin = LANDMARKS.ferrisWheel; yaw = 0;
  const cy = 5.62, r = 4.37;
  box(0, .21, 0, 8.1, .42, 3.9, darkWood);
  for (const z of [-.68, .68]) for (const side of [-1, 1]) {
    beam([side * 2.55, .3, z], [0, cy, z], .67, timber);
    box(side * 2.56, .51, z, .84, .53, .86, honey);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, b = a + Math.PI / 4, x = r * Math.sin(a), y = cy + r * Math.cos(a);
    beam([x, y, -.06], [r * Math.sin(b), cy + r * Math.cos(b), -.06], .52, "#bb643c");
    beam([0, cy, 0], [x, y, 0], .24, honey);
    {
      box(x, y - .49, .4, 1.57, .82, 1.03, honey);
      part(cube, x, y - .4, .928, [.96, .41, .03], cream, [0, 0, 0], true);
      for (const dx of [-.49, .49]) box(x + dx, y + .08, .54, .12, .7, .13, timber);
      drum(x, y + .47, .4, .94, 1.21, .32, 4, purple, .74);
    }
  }
  part(fruit, 0, cy, .78, [.63, .63, .29], gold);

  origin = [0, 0, 0]; yaw = 0;
  const posts: WorldPoint[] = [[-17, 4.6, 3], [-11.5, 5.85, -14], [0, 4.9, -14], [11.5, 5.85, -14], [17, 4.6, 3]];
  posts.forEach(([x, y, z], i) => {
    box(x, y / 2, z, .18, y, .18, timber); part(fruit, x, y + .15, z, [.25, .28, .25], gold);
    if (!i) return;
    const [ax, ay, az] = posts[i - 1];
    function onCord(t: number): WorldPoint { return [ax + (x - ax) * t, ay + (y - ay) * t - .88 * Math.sin(t * Math.PI), az + (z - az) * t]; }
    for (let j = 0; j < 8; j++)beam(onCord(j / 8), onCord((j + 1) / 8), .06, honey);
    for (const t of [.2, .5, .8]) { const [lx, ly, lz] = onCord(t); lamp(lx, ly - .45, lz, .8); }
  });
  function merge(parts: BufferGeometry[]) {
    const result = mergeGeometries(parts);
    parts.forEach(g => g.dispose());
    return result;
  }
  for (const [x, , z] of PLANTING_BEDS) {
    box(x, .14, z, 2.6, .28, 1.5, "#485c38");
    part(fruit, x - .51, .56, z, [.78, .77, .69], "#56763c");
    part(fruit, x + .56, .48, z + .1, [.68, .63, .58], "#669047");
  }
  // Shrubs grow in the planting beds against the fence, outside the walking bounds.
  for (const side of [-1, 1]) {
    for (const z of [-7, -2, 4, 8]) {
      for (let i = 0; i < 3; i++) {
        const x = side * (17.14 + i * .19);
        part(fruit, x, .46 + i * .09, z + i * .52, [.73, .69, .86], ["#45653b", "#587741", "#678046"][i]);
      }
    }
    for (const x of [4, 6, 12]) part(fruit, side * x, .48, -14.1, [1.2, .81, .9], "#526d38");
  }
  function groundPaint() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(512 / 40, 512 / 40); ctx.translate(20, 20);
    ctx.fillStyle = "white"; ctx.fillRect(-20, -20, 40, 40);
    function wash(x: number, z: number, w: number, d: number, center: string, end: string) {
      ctx.save(); ctx.translate(x, z); ctx.scale(w, d);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, center); gradient.addColorStop(1, end);
      ctx.fillStyle = gradient; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    }
    for (const [x, , z] of Object.values(LANDMARKS))
      wash(x + .6, z + .54, 5.4, 3.7, "rgba(84,46,55,.83)", "rgba(84,46,55,0)");
    for (const [x, , z] of lightPools)
      wash(x, z, 2.3, 2.1, "rgba(255,192,85,.83)", "rgba(255,192,85,0)");
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    return texture;
  }
  return { painted: merge(painted), lit: merge(lit), glows: merge(glows), groundMap: groundPaint() };
}
