// Escenario: un corte de un canal de Xochimilco. Arriba la chinampa con
// ahuejotes, en la superficie lirios acuáticos con raíces colgando, abajo lodo
// y plantas. Todo determinista a partir de una semilla.

import type { ScenePalette } from "./palettes.ts";
import { PixelCanvas, seededRandom } from "./pixel.ts";

export const SCENE_W = 160;
export const SCENE_H = 80;
export const WATERLINE = 15;
export const MUD_TOP = 67;
export const CAPTION_TOP = 73;

export interface SceneLayers {
  background: PixelCanvas;
  surfaceFrames: [PixelCanvas, PixelCanvas];
  rays: PixelCanvas | null;
  lilies: PixelCanvas;
  backPlantFrames: [PixelCanvas, PixelCanvas];
  frontPlantFrames: [PixelCanvas, PixelCanvas];
  /** Posiciones base de burbujas (x, y inicial). */
  bubbleSources: { x: number; y: number }[];
  /** Puntos de luciérnagas (de noche) o motas (de día). */
  sparkles: { x: number; y: number }[];
}

function dither(c: PixelCanvas, y: number, a: string, b: string, offset = 0) {
  for (let x = 0; x < SCENE_W; x++) c.set(x, y, (x + y + offset) % 2 === 0 ? a : b);
}

export function buildScene(p: ScenePalette, seed: number): SceneLayers {
  const rand = seededRandom(seed);
  const bg = new PixelCanvas(SCENE_W, SCENE_H);

  // ── Cielo
  const skyRows = WATERLINE - 1;
  for (let y = 0; y < skyRows; y++) {
    const band = y < 4 ? 0 : y < 8 ? 1 : 2;
    for (let x = 0; x < SCENE_W; x++) bg.set(x, y, p.sky[band]);
  }
  dither(bg, 4, p.sky[0], p.sky[1]);
  dither(bg, 8, p.sky[1], p.sky[2]);

  if (p.star) {
    for (let i = 0; i < 26; i++) {
      bg.set(Math.floor(rand() * SCENE_W), Math.floor(rand() * 9), p.star);
    }
  }
  if (p.moon) {
    const mx = 136;
    const my = 2;
    bg.fillRect(mx + 1, my, 3, 5, p.moon);
    bg.fillRect(mx, my + 1, 5, 3, p.moon);
    bg.set(mx + 3, my + 1, p.sky[0]);
    bg.set(mx + 3, my + 2, p.sky[0]);
    bg.set(mx + 4, my + 2, p.sky[0]);
  }
  if (p.sun) {
    const sx = 122;
    const sy = 7;
    bg.fillRect(sx + 1, sy, 5, 7, p.sun);
    bg.fillRect(sx, sy + 1, 7, 5, p.sun);
  }
  if (p.cloud) {
    for (const [cx, cy, w] of [
      [18, 2, 9],
      [70, 4, 12],
      [128, 1, 8],
    ] as const) {
      bg.fillRect(cx, cy + 1, w, 2, p.cloud);
      bg.fillRect(cx + 2, cy, w - 5, 1, p.cloud);
    }
  }

  // ── Chinampa y ahuejotes (árboles columnares típicos de Xochimilco)
  for (let x = 0; x < SCENE_W; x++) {
    const top = 11 + (Math.sin(x * 0.21 + seed) > 0.6 ? -1 : 0);
    for (let y = top; y < WATERLINE - 1; y++) bg.set(x, y, y === WATERLINE - 2 ? p.bankDark : p.bank);
  }
  let tx = 3 + Math.floor(rand() * 6);
  while (tx < SCENE_W - 4) {
    const h = 7 + Math.floor(rand() * 5);
    const w = rand() < 0.5 ? 3 : 4;
    const base = 11;
    for (let j = 0; j < h; j++) {
      const y = base - j;
      const half = j < 2 ? w - 1 : j > h - 3 ? Math.max(1, w - 2) : w;
      for (let i = 0; i < half; i++) {
        const x = tx + Math.floor((w - half) / 2) + i;
        bg.set(x, y, i === 0 && j % 2 === 0 ? p.treeLight : p.tree);
      }
    }
    bg.set(tx + Math.floor(w / 2), base + 1, p.trunk);
    tx += w + 3 + Math.floor(rand() * 9);
  }

  // ── Agua: bandas con tramado entre ellas
  const bands: [number, number][] = [
    [WATERLINE, 24],
    [24, 36],
    [36, 50],
    [50, MUD_TOP],
  ];
  bands.forEach(([from, to], i) => {
    for (let y = from; y < to; y++) for (let x = 0; x < SCENE_W; x++) bg.set(x, y, p.water[i]);
    if (i > 0) dither(bg, from, p.water[i - 1], p.water[i]);
  });

  // ── Lodo, piedritas y letrero
  for (let x = 0; x < SCENE_W; x++) {
    const top = MUD_TOP + (Math.sin(x * 0.17 + seed * 0.1) > 0.3 ? -1 : 0) + (Math.sin(x * 0.53) > 0.85 ? -1 : 0);
    for (let y = top; y < SCENE_H; y++) bg.set(x, y, y > top + 2 ? p.mudDark : p.mud);
  }
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rand() * SCENE_W);
    const y = MUD_TOP + 1 + Math.floor(rand() * (CAPTION_TOP - MUD_TOP - 2));
    bg.set(x, y, rand() < 0.5 ? p.pebble : p.pebbleLight);
    if (rand() < 0.4) bg.set(x + 1, y, p.pebble);
  }
  bg.fillRect(0, CAPTION_TOP, SCENE_W, SCENE_H - CAPTION_TOP, p.caption);

  // ── Superficie (2 cuadros de brillo)
  const surfaceFrames: [PixelCanvas, PixelCanvas] = [
    new PixelCanvas(SCENE_W, SCENE_H),
    new PixelCanvas(SCENE_W, SCENE_H),
  ];
  surfaceFrames.forEach((c, f) => {
    for (let x = 0; x < SCENE_W; x++) {
      c.set(x, WATERLINE - 1, p.surface);
      if ((x + f * 3) % 7 === 0) c.set(x, WATERLINE - 1, p.surfaceShine);
      if ((x + f * 5) % 11 === 0) c.set(x, WATERLINE, p.surface + "99");
    }
  });

  // ── Rayos de luz
  let rays: PixelCanvas | null = null;
  if (p.ray) {
    rays = new PixelCanvas(SCENE_W, SCENE_H);
    for (const x0 of [26, 74, 118]) {
      for (let y = WATERLINE; y < MUD_TOP - 6; y++) {
        const w = 3 + Math.floor((y - WATERLINE) / 12);
        const xs = x0 + Math.floor((y - WATERLINE) * 0.35);
        for (let i = 0; i < w; i++) if ((xs + i + y) % 2 === 0 || i > 0) rays.set(xs + i, y, p.ray);
      }
    }
  }

  // ── Lirios acuáticos con raíces colgantes
  const lilies = new PixelCanvas(SCENE_W, SCENE_H);
  const lilyXs = [14 + Math.floor(rand() * 10), 96 + Math.floor(rand() * 20)];
  for (const lx of lilyXs) {
    // raíces: pocas, delgadas e irregulares
    for (let r = 0; r < 4; r++) {
      const rx = lx + 2 + r * 3 + Math.floor(rand() * 2);
      const len = 3 + Math.floor(rand() * 7);
      let x = rx;
      for (let j = 0; j < len; j++) {
        if (j > 0 && rand() < 0.3) x += rand() < 0.5 ? -1 : 1;
        lilies.set(x, WATERLINE + j, p.root + (j > len - 3 ? "66" : "aa"));
      }
    }
    // hojas redondas que flotan, con contorno para separarlas de la chinampa
    const leaves = new PixelCanvas(SCENE_W, SCENE_H);
    leaves.fillRect(lx, WATERLINE - 2, 15, 2, p.leaf);
    leaves.fillRect(lx + 1, WATERLINE - 3, 5, 1, p.leaf);
    leaves.fillRect(lx + 8, WATERLINE - 4, 5, 2, p.leaf);
    leaves.fillRect(lx + 2, WATERLINE - 3, 3, 1, p.leafLight);
    leaves.fillRect(lx + 9, WATERLINE - 4, 3, 1, p.leafLight);
    for (let y = WATERLINE - 6; y < WATERLINE; y++) {
      for (let x = lx - 1; x < lx + 17; x++) {
        if (leaves.get(x, y)) continue;
        if (leaves.get(x, y + 1) || leaves.get(x - 1, y) || leaves.get(x + 1, y)) lilies.set(x, y, p.root);
      }
    }
    lilies.draw(leaves, 0, 0);
    // espiga de flores lilas
    lilies.fillRect(lx + 6, WATERLINE - 6, 2, 3, p.flower);
    lilies.set(lx + 6, WATERLINE - 7, p.flowerLight);
    lilies.set(lx + 7, WATERLINE - 5, p.flowerLight);
    lilies.set(lx + 5, WATERLINE - 5, p.flowerLight);
  }

  // ── Plantas del fondo (elodea), 2 cuadros de vaivén
  const plants = (count: number, front: boolean): [PixelCanvas, PixelCanvas] => {
    const frames: [PixelCanvas, PixelCanvas] = [
      new PixelCanvas(SCENE_W, SCENE_H),
      new PixelCanvas(SCENE_W, SCENE_H),
    ];
    const xs: number[] = [];
    for (let i = 0; i < count; i++) {
      xs.push(front ? (i % 2 === 0 ? 2 + Math.floor(rand() * 16) : 140 + Math.floor(rand() * 16)) : 6 + Math.floor(rand() * 148));
    }
    for (const px of xs) {
      const h = front ? 9 + Math.floor(rand() * 6) : 12 + Math.floor(rand() * 14);
      const phase = rand() * Math.PI * 2;
      frames.forEach((c, f) => {
        for (let j = 0; j < h; j++) {
          const y = MUD_TOP - j;
          const k = j / h;
          const x = px + Math.round(Math.sin(phase + j * 0.35) * 1.2 * k + (f === 1 ? k * 1.5 : 0));
          c.set(x, y, p.plant);
          if (j % 3 === 1 && j > 1) {
            c.set(x - 1, y, p.plantLight);
            c.set(x + 1, y - 1, p.plantLight);
          }
        }
      });
    }
    return frames;
  };

  const bubbleSources: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i++) bubbleSources.push({ x: 8 + Math.floor(rand() * 144), y: MUD_TOP - 2 });

  const sparkles: { x: number; y: number }[] = [];
  for (let i = 0; i < 7; i++) {
    sparkles.push({ x: 6 + Math.floor(rand() * 148), y: p.star ? 3 + Math.floor(rand() * 9) : WATERLINE + 3 + Math.floor(rand() * 44) });
  }

  return {
    background: bg,
    surfaceFrames,
    rays,
    lilies,
    backPlantFrames: plants(9, false),
    frontPlantFrames: plants(2, true),
    bubbleSources,
    sparkles,
  };
}
