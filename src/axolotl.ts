// Dibujo procedural del ajolote en pixel art.
//
// La anatomía se define en "unidades de adulto" (un ajolote adulto mide ~52 x 28)
// y se rasteriza a cualquier escala: así las etapas de crecimiento salen del
// mismo modelo. Mira a la derecha; el espejo se hace al componer la escena.

import { darken, lighten } from "./color.ts";
import type { MorphPalette } from "./palettes.ts";
import { PixelCanvas, seededRandom } from "./pixel.ts";

export type Pose = "nado" | "parado";

export interface AxolotlFrame {
  scale: number;
  palette: MorphPalette;
  /** Color de cada par de branquias (arriba, en medio, abajo). */
  gillColors: [string, string, string];
  /** 0.3 = branquias encogidas, 1 = sanas. */
  gillLength: number;
  /** Fase de la onda de la cola (radianes). */
  tailPhase: number;
  /** Amplitud de la onda de la cola en unidades de adulto. */
  tailAmp: number;
  /** Fase y amplitud (grados) del vaivén de branquias. */
  gillPhase: number;
  gillSway: number;
  pose: Pose;
  eyes: "abiertos" | "cerrados";
  mouth: "cerrada" | "abierta";
  /** Manchitas doradas ganadas por rachas. */
  speckles: number;
  seed: number;
}

const MARGIN = 5;
const SPRITE_W = 56;
const SPRITE_H = 32;

export function spriteSize(scale: number): { width: number; height: number } {
  return {
    width: Math.ceil(SPRITE_W * scale) + MARGIN * 2,
    height: Math.ceil(SPRITE_H * scale) + MARGIN * 2,
  };
}

/** Punto de la boca (para alinear la comida), en pixeles del sprite. */
export function mouthPoint(scale: number): { x: number; y: number } {
  return { x: Math.round(50 * scale) + MARGIN, y: Math.round(19.9 * scale) + MARGIN };
}

// ── Anatomía en unidades de adulto ─────────────────────────────────────────

const HEAD = { cx: 42, cy: 16.2, rx: 9, ry: 7.1, p: 2.3 };
const TRUNK = { cx: 27, cy: 17.6, rx: 13, ry: 5 };
const TAIL_START = 18;
const TAIL_TIP = 1.4;
const TAIL_CY = 17.4;

const inHead = (u: number, v: number) =>
  Math.abs(u - HEAD.cx) ** HEAD.p / HEAD.rx ** HEAD.p +
    Math.abs(v - HEAD.cy) ** HEAD.p / HEAD.ry ** HEAD.p <=
  1;

function trunkHalf(u: number): number {
  const t = (u - TRUNK.cx) / TRUNK.rx;
  return Math.abs(t) <= 1 ? TRUNK.ry * Math.sqrt(1 - t * t) : 0;
}

const inTrunk = (u: number, v: number) => Math.abs(v - TRUNK.cy) <= trunkHalf(u) && trunkHalf(u) > 0;

function tailHalf(u: number): number {
  if (u < TAIL_TIP || u > TAIL_START) return -1;
  const k = (u - TAIL_TIP) / (TAIL_START - TAIL_TIP);
  return 0.35 + 3.9 * k ** 1.25;
}

function segmentDistance(u: number, v: number, a: [number, number], b: [number, number]): number {
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - (ax + t * dx), v - (ay + t * dy));
}

type Seg = [[number, number], [number, number], number];

function legSegments(pose: Pose, far: boolean): Seg[] {
  const ox = far ? 3 : 0;
  const oy = far ? -0.6 : 0;
  const s = (ax: number, ay: number, bx: number, by: number, r: number): Seg => [
    [ax + ox, ay + oy],
    [bx + ox, by + oy],
    r,
  ];
  if (pose === "parado") {
    return [
      s(35.5, 21, 36.8, 25.4, 1.15),
      s(35.6, 26, 39.2, 26, 0.62),
      s(20.5, 21, 21.4, 25.4, 1.15),
      s(20.4, 26, 23.8, 26, 0.62),
    ];
  }
  return [
    s(34.5, 21, 30.6, 24, 1.05),
    s(29.4, 24.5, 31.2, 24.5, 0.55),
    s(19.5, 21.2, 15.6, 23.8, 1.05),
    s(14.6, 24.3, 16.4, 24.3, 0.55),
  ];
}

const inSegs = (u: number, v: number, segs: Seg[]) =>
  segs.some(([a, b, r]) => segmentDistance(u, v, a, b) <= r);

const GILLS = [
  { root: [38.6, 10.0], angle: 86, length: 9, bend: 18 },
  { root: [36.9, 11.1], angle: 127, length: 10.5, bend: 12 },
  { root: [35.6, 12.2], angle: 156, length: 9.5, bend: 6 },
] as const;

// ── Dibujo ─────────────────────────────────────────────────────────────────

export function drawAxolotl(f: AxolotlFrame): PixelCanvas {
  const { width, height } = spriteSize(f.scale);
  const s = f.scale;
  const pal = f.palette;
  const toU = (x: number) => (x - MARGIN + 0.5) / s;
  const toV = (y: number) => (y - MARGIN + 0.5) / s;
  const toX = (u: number) => Math.floor(u * s + MARGIN);
  const toY = (v: number) => Math.floor(v * s + MARGIN);

  const tailWave = (u: number) => {
    if (u >= TAIL_START) return 0;
    const k = (TAIL_START - u) / (TAIL_START - TAIL_TIP);
    return f.tailAmp * Math.sin(f.tailPhase + k * Math.PI * 1.15) * k;
  };
  const inTail = (u: number, v: number) => {
    const h = tailHalf(u);
    return h >= 0 && Math.abs(v - (TAIL_CY + tailWave(u))) <= h;
  };
  const inBody = (u: number, v: number) => inHead(u, v) || inTrunk(u, v) || inTail(u, v);
  const inFin = (u: number, v: number) => {
    if (u < TAIL_TIP - 0.6 || u > 31) return false;
    const onTail = u < TAIL_START;
    const c = onTail ? TAIL_CY + tailWave(u) : TRUNK.cy;
    const core = Math.max(onTail ? tailHalf(u) : 0, trunkHalf(u));
    const k = (u - (TAIL_TIP - 0.6)) / (31 - (TAIL_TIP - 0.6));
    const top = 3.1 * Math.sin(Math.PI * Math.min(1, k)) ** 0.6;
    const kb = (u - (TAIL_TIP - 0.6)) / (17 - (TAIL_TIP - 0.6));
    const bottom = kb <= 1 ? 2.3 * Math.sin(Math.PI * kb) ** 0.6 : 0;
    return v >= c - core - top && v <= c + core + bottom;
  };

  const nearLegs = legSegments(f.pose, false);
  const farLegs = legSegments(f.pose, true);

  // Máscaras
  const body = new PixelCanvas(width, height);
  const fin = new PixelCanvas(width, height);
  const legN = new PixelCanvas(width, height);
  const legF = new PixelCanvas(width, height);
  const X = "x";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = toU(x);
      const v = toV(y);
      if (inBody(u, v)) body.set(x, y, X);
      else if (inFin(u, v)) fin.set(x, y, X);
      if (inSegs(u, v, nearLegs)) legN.set(x, y, X);
      else if (inSegs(u, v, farLegs)) legF.set(x, y, X);
    }
  }
  const has = (c: PixelCanvas, x: number, y: number) => c.get(x, y) !== undefined;

  const out = new PixelCanvas(width, height);

  // 1. Branquias del lado lejano: solo asoman las puntas detrás de la cabeza
  drawGills(out, f, toX, toY, true);

  // 2. Aleta translúcida
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (has(fin, x, y) && !has(body, x, y)) out.set(x, y, pal.fin + "e0");
    }
  }

  // 3. Patas lejanas
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (has(legF, x, y) && !has(body, x, y)) out.set(x, y, pal.shade);
    }
  }

  // 4. Cuerpo con sombreado: luz arriba (con tramado), sombra abajo
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!has(body, x, y)) continue;
      let c = pal.base;
      if (!has(body, x, y - 1)) c = pal.light;
      else if (!has(body, x, y - 2) && (x + y) % 2 === 0) c = pal.light;
      else if (!has(body, x, y + 1)) c = pal.shade;
      else if (!has(body, x, y + 2) && (x + y) % 2 === 0) c = pal.shade;
      out.set(x, y, c);
    }
  }

  // 5. Patas cercanas
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (has(legN, x, y)) out.set(x, y, has(legN, x, y + 1) ? pal.base : pal.shade);
    }
  }

  // 6. Contorno
  const solid = (x: number, y: number) => has(body, x, y) || has(legN, x, y) || has(legF, x, y);
  const any = (x: number, y: number) => solid(x, y) || has(fin, x, y);
  const outline = new PixelCanvas(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (any(x, y)) continue;
      const n: [number, number][] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      if (n.some(([a, b]) => solid(a, b))) outline.set(x, y, pal.outline);
      else if (n.some(([a, b]) => has(fin, a, b))) outline.set(x, y, pal.finEdge);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = outline.get(x, y);
      if (c) out.setIfEmpty(x, y, c);
    }
  }

  // 7. Manchas del morph y manchitas doradas (solo en tronco y cabeza, que no ondulan)
  const rand = seededRandom(f.seed);
  const paint = (count: number, colors: string[], vMax: number) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 20; tries++) {
      const u = 17 + rand() * 30;
      const v = 11 + rand() * (vMax - 11);
      const x = toX(u);
      const y = toY(v);
      if (has(body, x, y) && has(body, x, y - 1) && has(body, x, y + 1) && has(body, x - 1, y) && has(body, x + 1, y)) {
        out.set(x, y, colors[placed % colors.length]);
        placed++;
      }
    }
  };
  if (pal.spots && pal.spotCount > 0) paint(Math.round(pal.spotCount * s), [pal.spots], 21);
  if (f.speckles > 0) paint(f.speckles, ["#f3cb4f", "#ffeaa0"], 16.5);

  // 8. Cara: boca sonriente, ojo, rubor
  const mouthPts: [number, number][] = [];
  for (let u = 44.1; u <= 49.9; u += 0.25) {
    const v = u < 45.3 ? 19.0 + (u - 44.1) * 0.75 : 19.9;
    mouthPts.push([u, v]);
  }
  for (const [u, v] of mouthPts) {
    const x = toX(u);
    const y = toY(v);
    if (has(body, x, y)) out.set(x, y, pal.mouth);
  }
  if (f.mouth === "abierta") {
    for (let u = 45.4; u <= 50.2; u += 0.25) {
      for (let v = 20.3; v <= 21.9; v += 0.25) {
        const x = toX(u);
        const y = toY(v);
        if (has(body, x, y) || has(body, x - 1, y)) out.set(x, y, "#3a1c24");
      }
    }
  }
  const ex = toX(46.2);
  const ey = toY(14.4);
  if (f.eyes === "cerrados") {
    out.set(ex, ey + 1, pal.mouth);
    out.set(ex + 1, ey + 1, pal.mouth);
  } else if (s >= 0.8) {
    out.fillRect(ex, ey, 2, 2, pal.eye);
    out.set(ex, ey, pal.eyeShine);
  } else {
    out.set(ex, ey, pal.eye);
  }
  if (pal.blush && s >= 0.7) {
    const bx = toX(47.6);
    const by = toY(17.6);
    if (has(body, bx, by)) out.set(bx, by, pal.blush);
    if (s >= 0.95 && has(body, bx + 1, by)) out.set(bx + 1, by, pal.blush);
  }

  // 9. Branquias del lado cercano (encima de todo)
  drawGills(out, f, toX, toY, false);

  return out;
}

function drawGills(
  out: PixelCanvas,
  f: AxolotlFrame,
  toX: (u: number) => number,
  toY: (v: number) => number,
  far: boolean,
): void {
  const g = Math.max(0.15, Math.min(1, f.gillLength));
  GILLS.forEach((gill, i) => {
    const color = f.gillColors[i];
    const stalk = far ? darken(color, 0.5) : darken(color, 0.28);
    const fringe = far ? darken(color, 0.32) : color;
    const tip = far ? darken(color, 0.2) : lighten(color, 0.35);
    const sway = f.gillSway * Math.sin(f.gillPhase + i * 1.1);
    const base = gill.angle + sway + (far ? 14 : 0);
    const length = gill.length * g * (far ? 0.75 : 1);
    let u = gill.root[0] + (far ? 0.8 : 0);
    let v = gill.root[1] + (far ? 0.6 : 0);
    const step = 0.3;
    const stalkPx: [number, number][] = [];
    const fringePx: [number, number][] = [];
    let nextFringe = 1.4;
    for (let t = 0; t <= length; t += step) {
      const a = ((base + gill.bend * (t / gill.length)) * Math.PI) / 180;
      const du = Math.cos(a);
      const dv = -Math.sin(a);
      u += du * step;
      v += dv * step;
      stalkPx.push([toX(u), toY(v)]);
      if (t >= nextFringe && t < length - 0.4) {
        nextFringe += 1.9;
        const fl = (2.6 - 0.9 * (t / gill.length)) * (0.55 + 0.45 * g);
        for (const side of [-1, 1]) {
          const fa = a + side * (48 * Math.PI) / 180;
          for (let k = 0.5; k <= fl; k += 0.35) {
            fringePx.push([toX(u + Math.cos(fa) * k), toY(v - Math.sin(fa) * k)]);
          }
        }
      }
    }
    for (const [x, y] of fringePx) out.set(x, y, fringe);
    for (const [x, y] of stalkPx) out.set(x, y, stalk);
    const last = stalkPx[stalkPx.length - 1];
    if (last) out.set(last[0], last[1], tip);
    if (!far) {
      const edge = darken(color, 0.6);
      for (const [x, y] of [...fringePx, ...stalkPx]) {
        for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
          out.setIfEmpty(a, b, edge);
        }
      }
    }
  });
}
