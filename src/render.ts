// Compone el SVG animado: escenario + ajolote + efectos según el comportamiento.
// Solo usa CSS (sin scripts), que es lo que GitHub permite dentro de un <img>.

import { drawAxolotl, mouthPoint, type AxolotlFrame, type Pose } from "./axolotl.ts";
import { abbreviate, drawText, textWidth } from "./font.ts";
import { MORPHS, paleColor, palePalette, SKIES, type MorphName, type Sky } from "./palettes.ts";
import { hashString, PixelCanvas } from "./pixel.ts";
import { buildScene, CAPTION_TOP, MUD_TOP, SCENE_H, SCENE_W, WATERLINE } from "./scene.ts";
import type { AxolotlState, Behavior } from "./state.ts";

export interface RenderOptions {
  morph: MorphName;
  sky: Sky | "auto";
  /** Ancho en pixeles de pantalla (el alto se calcula). */
  width: number;
}

export const DEFAULT_RENDER: RenderOptions = { morph: "leucistico", sky: "auto", width: 640 };

const BEHAVIOR_LABEL: Record<Behavior, string> = {
  dormido: "DORMIDO",
  descansando: "DESCANSANDO",
  regenerando: "REGENERANDO",
  comiendo: "COMIENDO",
  acelerado: "ACELERADO",
  nadando: "NADANDO",
};

// ── Hoja de estilos ────────────────────────────────────────────────────────

class Styles {
  private rules: string[] = [];
  private keyframes = new Map<string, string>();
  private n = 0;

  id(prefix: string): string {
    return `${prefix}${(this.n++).toString(36)}`;
  }

  rule(r: string): void {
    this.rules.push(r);
  }

  keyframe(name: string, body: string): void {
    this.keyframes.set(name, `@keyframes ${name}{${body}}`);
  }

  /** Ciclo de N cuadros: devuelve la clase de cada cuadro. */
  cycle(n: number, period: number): string[] {
    const cls = this.id("c");
    const kf = `k${n}`;
    this.keyframe(kf, `0%{visibility:visible}${(100 / n).toFixed(3)}%,100%{visibility:hidden}`);
    this.rule(`.${cls}{visibility:hidden;animation:${kf} ${period}s step-end infinite}`);
    const out: string[] = [];
    for (let k = 0; k < n; k++) {
      const name = `${cls}_${k}`;
      this.rule(`.${name}{animation-delay:${((k * period) / n).toFixed(3)}s}`);
      if (k === 0) this.rule(`@media (prefers-reduced-motion:reduce){.${name}{visibility:visible}}`);
      out.push(`${cls} ${name}`);
    }
    return out;
  }

  /**
   * Visible solo dentro de las ventanas indicadas (porcentajes del periodo).
   * Usa opacity y no visibility: un hijo con visibility:visible se mostraría
   * aunque el padre esté oculto.
   */
  windows(period: number, wins: [number, number][], delay = 0): string {
    const cls = this.id("w");
    const startsVisible = wins.length > 0 && wins[0][0] <= 0;
    const points: string[] = [`0%{opacity:${startsVisible ? 1 : 0}}`];
    for (const [a, b] of wins) {
      if (a > 0) points.push(`${a}%{opacity:1}`);
      if (b < 100) points.push(`${b}%{opacity:0}`);
    }
    points.push(`100%{opacity:${wins.some(([, b]) => b >= 100) ? 1 : 0}}`);
    this.keyframe(cls, points.join(""));
    this.rule(`.${cls}{opacity:${startsVisible ? 1 : 0};animation:${cls} ${period}s step-end ${delay}s infinite}`);
    return cls;
  }

  /** Movimiento por keyframes de translate; cada tramo avanza en pasos de 1 pixel. */
  path(period: number, points: [number, number, number][], delay = 0, hold = false): string {
    const cls = this.id("m");
    const body = points
      .map(([pct, x, y], i) => {
        const next = points[i + 1];
        const steps = next ? Math.max(1, Math.round(Math.max(Math.abs(next[1] - x), Math.abs(next[2] - y)))) : 1;
        const timing = hold ? "step-end" : `steps(${steps},end)`;
        return `${pct}%{transform:translate(${x}px,${y}px);animation-timing-function:${timing}}`;
      })
      .join("");
    this.keyframe(cls, body);
    const [, x0, y0] = points[0];
    this.rule(`.${cls}{transform:translate(${x0}px,${y0}px);animation:${cls} ${period}s ${delay}s infinite}`);
    return cls;
  }

  toString(): string {
    return [...this.keyframes.values(), ...this.rules, "@media (prefers-reduced-motion:reduce){*{animation:none!important}}"].join("");
  }
}

// ── Composición ────────────────────────────────────────────────────────────

interface Motion {
  frames: number;
  period: number;
  tailAmp: number;
  gillSway: number;
  pose: Pose;
}

const MOTION: Record<Behavior, Motion> = {
  nadando: { frames: 4, period: 0.8, tailAmp: 2.2, gillSway: 7, pose: "nado" },
  acelerado: { frames: 4, period: 0.4, tailAmp: 2.6, gillSway: 10, pose: "nado" },
  comiendo: { frames: 4, period: 1.2, tailAmp: 1.1, gillSway: 5, pose: "nado" },
  regenerando: { frames: 12, period: 6, tailAmp: 1.2, gillSway: 6, pose: "nado" },
  descansando: { frames: 4, period: 3.2, tailAmp: 0.6, gillSway: 4, pose: "parado" },
  dormido: { frames: 2, period: 4, tailAmp: 0.25, gillSway: 2.5, pose: "parado" },
};

export function resolveSky(state: AxolotlState, sky: Sky | "auto"): Sky {
  if (sky !== "auto") return sky;
  if (state.behavior === "dormido" || state.behavior === "descansando") return "noche";
  if (state.behavior === "regenerando") return "atardecer";
  return "dia";
}

export function renderSvg(state: AxolotlState, options: Partial<RenderOptions> = {}): string {
  const opts = { ...DEFAULT_RENDER, ...options };
  const sky = resolveSky(state, opts.sky);
  const scenePal = SKIES[sky];
  const seed = hashString(state.login.toLowerCase());
  const scene = buildScene(scenePal, seed);
  const css = new Styles();
  const motion = MOTION[state.behavior];
  const morph = MORPHS[opts.morph];

  const baseGills = [0, 1, 2].map((i) => state.gillLanguages[i]?.color ?? morph.gill) as [string, string, string];

  // ── Cuadros del ajolote
  const frames: PixelCanvas[] = [];
  for (let k = 0; k < motion.frames; k++) {
    const phase = (k / Math.min(motion.frames, 4)) * Math.PI * 2;
    let gillLength = state.gillHealth;
    let paleness = state.paleness;
    if (state.behavior === "regenerando") {
      const grow = Math.min(1, k / 6);
      gillLength = 0.35 + 0.65 * grow;
      paleness = 0.45 * (1 - grow);
    }
    if (state.behavior === "dormido") gillLength = Math.min(gillLength, 0.4);
    const frame: AxolotlFrame = {
      scale: state.scale,
      palette: palePalette(morph, paleness),
      gillColors: baseGills.map((c) => paleColor(c, paleness)) as [string, string, string],
      gillLength,
      tailPhase: phase,
      tailAmp: motion.tailAmp,
      gillPhase: phase,
      gillSway: motion.gillSway,
      pose: motion.pose,
      eyes: state.behavior === "dormido" ? "cerrados" : "abiertos",
      mouth: "cerrada",
      speckles: state.speckles,
      seed,
    };
    frames.push(drawAxolotl(frame));
  }
  const W = frames[0].width;
  const box = frames
    .map((f) => f.bounds())
    .reduce((a, b) =>
      a && b
        ? { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }
        : a ?? b,
    )!;
  const contentW = box.maxX - box.minX + 1;
  const contentH = box.maxY - box.minY + 1;

  const frameGroup = (canvases: PixelCanvas[], period: number) => {
    const classes = css.cycle(canvases.length, period);
    return canvases.map((c, k) => `<g class="${classes[k]}">${c.toSvg()}</g>`).join("");
  };

  let axolotl = "";
  let effects = "";

  if (state.behavior === "nadando" || state.behavior === "acelerado") {
    // Vueltas de lado a lado; al dar la vuelta se usa el sprite en espejo.
    const lapPeriod = state.behavior === "acelerado" ? 6 : 18;
    const centerY = state.behavior === "acelerado" ? 34 : 38;
    const ty = Math.round(centerY - contentH / 2) - box.minY;
    const left = 3 - box.minX;
    const right = SCENE_W - 3 - contentW - box.minX;
    const mirrorShift = box.minX - (W - 1 - box.maxX);
    const lap = css.path(lapPeriod, [
      [0, left, ty],
      [46, right, ty],
      [50, right, ty],
      [96, left, ty],
      [100, left, ty],
    ]);
    const rightWin = css.windows(lapPeriod, [[0, 48], [98, 100]]);
    const leftWin = css.windows(lapPeriod, [[48, 98]]);
    const bob = css.path(2.4, [[0, 0, 0], [50, 0, 1], [100, 0, 0]], 0, true);
    axolotl =
      `<g class="${lap}"><g class="${bob}">` +
      `<g class="${rightWin}">${frameGroup(frames, motion.period)}</g>` +
      `<g class="${leftWin}"><g transform="translate(${mirrorShift} 0)">${frameGroup(frames.map((f) => f.mirrored()), motion.period)}</g></g>` +
      `</g></g>`;
  } else if (state.behavior === "descansando" || state.behavior === "dormido") {
    const sink = state.behavior === "dormido" ? 1 : 0;
    const x = 34 - box.minX;
    const y = MUD_TOP + 1 + sink - box.maxY - 1;
    axolotl = `<g transform="translate(${x} ${y})">${frameGroup(frames, motion.period)}</g>`;
    if (state.behavior === "dormido") {
      // Zz que suben desde la cabeza
      const zx = x + box.maxX - 4;
      const zy = y + box.minY - 2;
      for (let i = 0; i < 2; i++) {
        const z = new PixelCanvas(4, 6);
        drawText(z, "Z", 0, 0, "#dfe8f5");
        const rise = css.path(5, [[0, zx + i * 4, zy], [80, zx + i * 4 + 3, zy - 9], [100, zx + i * 4 + 3, zy - 9]], i * 2.5);
        const win = css.windows(5, [[0, 80]], i * 2.5);
        effects += `<g class="${rise}"><g class="${win}">${z.toSvg()}</g></g>`;
      }
    }
  } else if (state.behavior === "comiendo") {
    const period = 4;
    const x = 52 - box.minX;
    const y = Math.round(44 - contentH / 2) - box.minY;
    const mouth = mouthPoint(state.scale);
    const lunge = css.path(period, [[0, 0, 0], [56, 0, 0], [58, 2, 0], [70, 2, 0], [72, 0, 0], [100, 0, 0]], 0, true);
    const mouthCanvas = drawAxolotl({
      scale: state.scale,
      palette: palePalette(morph, state.paleness),
      gillColors: baseGills,
      gillLength: state.gillHealth,
      tailPhase: 0,
      tailAmp: motion.tailAmp,
      gillPhase: 0,
      gillSway: motion.gillSway,
      pose: motion.pose,
      eyes: "abiertos",
      mouth: "abierta",
      speckles: state.speckles,
      seed,
    });
    const mouthWin = css.windows(period, [[57, 70]]);
    const closedWin = css.windows(period, [[0, 57], [70, 100]]);
    axolotl =
      `<g transform="translate(${x} ${y})"><g class="${lunge}">` +
      `<g class="${closedWin}">${frameGroup(frames, motion.period)}</g>` +
      `<g class="${mouthWin}">${mouthCanvas.toSvg()}</g>` +
      `</g></g>`;
    // Gusanito que cae desde la superficie hasta la boca
    const wormX = x + mouth.x + 3;
    const wormY = y + mouth.y - 1;
    const worm = [0, 1].map((f) => {
      const c = new PixelCanvas(5, 3);
      const pts = f === 0 ? [[0, 1], [1, 0], [2, 1], [3, 2], [4, 1]] : [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]];
      pts.forEach(([a, b], i) => c.set(a, b, i % 2 === 0 ? "#c9473d" : "#e8735f"));
      return c;
    });
    const fall = css.path(period, [[0, wormX, WATERLINE], [56, wormX, wormY], [100, wormX, wormY]]);
    const wormWin = css.windows(period, [[0, 60]]);
    effects += `<g class="${fall}"><g class="${wormWin}">${frameGroup(worm, 0.5)}</g></g>`;
  } else {
    // regenerando: flota en el centro mientras le crecen las branquias
    const x = Math.round(SCENE_W / 2 - contentW / 2) - box.minX;
    const y = Math.round(38 - contentH / 2) - box.minY;
    const bob = css.path(2.4, [[0, 0, 0], [50, 0, 1], [100, 0, 0]], 0, true);
    axolotl = `<g transform="translate(${x} ${y})"><g class="${bob}">${frameGroup(frames, motion.period)}</g></g>`;
    const sparkleSpots = [
      [box.maxX - 10, box.minY - 1],
      [box.maxX - 20, box.minY + 3],
      [box.maxX - 4, box.minY + 2],
      [box.maxX - 15, box.minY - 3],
    ];
    sparkleSpots.forEach(([sx, sy], i) => {
      const c = new PixelCanvas(3, 3);
      c.set(1, 0, "#fff6c2");
      c.set(0, 1, "#fff6c2");
      c.set(2, 1, "#fff6c2");
      c.set(1, 2, "#fff6c2");
      c.set(1, 1, "#ffffff");
      const twinkle = css.windows(1.2, [[0, 45]], i * 0.3);
      const win = css.windows(motion.period, [[0, 58]]);
      effects += `<g class="${win}"><g transform="translate(${x + sx} ${y + sy})"><g class="${twinkle}">${c.toSvg()}</g></g></g>`;
    });
  }

  // ── Ambiente
  let ambient = "";
  if (scene.rays) {
    const cls = css.id("r");
    css.keyframe(cls, "0%,100%{opacity:.05}50%{opacity:.12}");
    css.rule(`.${cls}{opacity:.08;animation:${cls} 7s ease-in-out infinite}`);
    ambient += `<g class="${cls}">${scene.rays.toSvg()}</g>`;
  }
  ambient += frameGroup(scene.backPlantFrames, 2.6);

  const bubbles = scene.bubbleSources
    .map((b, i) => {
      const c = new PixelCanvas(3, 3);
      c.set(1, 0, scenePal.bubble);
      c.set(0, 1, scenePal.bubble);
      c.set(2, 1, scenePal.bubble);
      c.set(1, 2, scenePal.bubble + "99");
      const dur = 7 + (i % 3) * 2;
      const rise = css.path(dur, [[0, b.x, b.y], [92, b.x + (i % 2 ? 2 : -2), WATERLINE + 1], [100, b.x + (i % 2 ? 2 : -2), WATERLINE + 1]], i * 1.7);
      const win = css.windows(dur, [[0, 92]], i * 1.7);
      return `<g class="${rise}"><g class="${win}">${c.toSvg()}</g></g>`;
    })
    .join("");

  const sparkles = scene.sparkles
    .map((s, i) => {
      const c = new PixelCanvas(1, 1);
      c.set(0, 0, scenePal.star ? "#fff3a0" : scenePal.particle + "aa");
      const win = css.windows(3 + (i % 4), [[0, scenePal.star ? 35 : 70]], i * 0.6);
      return `<g transform="translate(${s.x} ${s.y})"><g class="${win}">${c.toSvg()}</g></g>`;
    })
    .join("");

  const lilyBob = css.path(3.6, [[0, 0, 0], [50, 0, 1], [100, 0, 0]], 0, true);
  const surface = frameGroup(scene.surfaceFrames, 1.6);

  // ── Letrero inferior: usuario · comportamiento, y leyenda de branquias
  const caption = new PixelCanvas(SCENE_W, SCENE_H);
  const legend = state.gillLanguages.map((l) => ({ color: l.color, text: abbreviate(l.name) }));
  let legendW = legend.reduce((s, l) => s + 5 + textWidth(l.text) + 4, 0);
  const fallback = legend.length === 0 ? `${state.totalContributions} CONTRIB` : "";
  if (fallback) legendW = textWidth(fallback) + 3;
  const ty = CAPTION_TOP + 1;
  let lx = SCENE_W - 3 - legendW + (legend.length ? 4 : 3);
  if (fallback) {
    drawText(caption, fallback, lx, ty, scenePal.captionText);
  } else {
    for (const l of legend) {
      caption.fillRect(lx, ty + 1, 3, 3, l.color);
      lx += 5;
      lx += drawText(caption, l.text, lx, ty, scenePal.captionText) + 4;
    }
  }
  const room = Math.floor((SCENE_W - 6 - legendW - 6) / 4);
  let login = state.login.toUpperCase();
  const label = BEHAVIOR_LABEL[state.behavior];
  const maxLogin = room - label.length - 3;
  if (login.length > maxLogin) login = login.slice(0, Math.max(3, maxLogin - 1)) + ".";
  drawText(caption, `${login} · ${label}`, 3, ty, scenePal.captionText);

  const front = frameGroup(scene.frontPlantFrames, 2.6);
  const murk =
    state.behavior === "dormido"
      ? `<rect x="0" y="${WATERLINE}" width="${SCENE_W}" height="${MUD_TOP - WATERLINE}" fill="#1c2a1e" fill-opacity=".28"/>`
      : "";

  const height = Math.round((opts.width * SCENE_H) / SCENE_W);
  const title = `Ajolote de ${state.login}: ${state.stage}, ${BEHAVIOR_LABEL[state.behavior].toLowerCase()}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" width="${opts.width}" height="${height}" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<style>${css}</style>` +
    `<defs><clipPath id="marco"><rect width="${SCENE_W}" height="${SCENE_H}" rx="3"/></clipPath></defs>` +
    `<g clip-path="url(#marco)">` +
    scene.background.toSvg() +
    ambient +
    surface +
    `<g class="${lilyBob}">${scene.lilies.toSvg()}</g>` +
    bubbles +
    axolotl +
    effects +
    front +
    murk +
    sparkles +
    caption.toSvg() +
    `</g></svg>`
  );
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
