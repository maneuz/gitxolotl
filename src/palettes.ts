// Morphs (variantes de color reales del ajolote) y paletas del escenario.

import { mix } from "./color.ts";

export interface MorphPalette {
  /** Nombre para mostrar. */
  label: string;
  outline: string;
  shade: string;
  base: string;
  light: string;
  fin: string;
  finEdge: string;
  mouth: string;
  eye: string;
  eyeShine: string;
  blush: string | null;
  /** Color de branquias cuando no hay lenguaje que asignar. */
  gill: string;
  /** Manchas propias del morph (salvaje, cobre). */
  spots: string | null;
  spotCount: number;
}

export const MORPHS = {
  leucistico: {
    label: "Leucístico",
    outline: "#8e4f60",
    shade: "#e59aab",
    base: "#f7c3cd",
    light: "#fde4e9",
    fin: "#fbd5dc",
    finEdge: "#d998a7",
    mouth: "#b8687b",
    eye: "#2a1720",
    eyeShine: "#8a6b77",
    blush: "#f08ea3",
    gill: "#e8455d",
    spots: null,
    spotCount: 0,
  },
  salvaje: {
    label: "Salvaje",
    outline: "#1f2716",
    shade: "#46532f",
    base: "#62714a",
    light: "#86956a",
    fin: "#73805a",
    finEdge: "#3a4527",
    mouth: "#2e3720",
    eye: "#0f120b",
    eyeShine: "#c9b45a",
    blush: null,
    gill: "#7b5f45",
    spots: "#323c22",
    spotCount: 22,
  },
  dorado: {
    label: "Dorado",
    outline: "#8a5a1c",
    shade: "#dca242",
    base: "#f3c860",
    light: "#fde49c",
    fin: "#f8d98a",
    finEdge: "#d39a45",
    mouth: "#b47a2e",
    eye: "#d4515f",
    eyeShine: "#ffd0d6",
    blush: "#f2a061",
    gill: "#f07f4a",
    spots: null,
    spotCount: 0,
  },
  melanoide: {
    label: "Melanoide",
    outline: "#08090b",
    shade: "#1d2024",
    base: "#2d3137",
    light: "#454b53",
    fin: "#363b42",
    finEdge: "#15171a",
    mouth: "#0c0d0f",
    eye: "#000000",
    eyeShine: "#9aa3ad",
    blush: null,
    gill: "#5b4a73",
    spots: null,
    spotCount: 0,
  },
  cobre: {
    label: "Cobre",
    outline: "#5a331c",
    shade: "#a8683f",
    base: "#c98a5c",
    light: "#e6ae82",
    fin: "#d99d72",
    finEdge: "#94582f",
    mouth: "#7d4526",
    eye: "#a63c4c",
    eyeShine: "#f3c4ca",
    blush: "#d77a62",
    gill: "#d4604f",
    spots: "#8d5130",
    spotCount: 18,
  },
} satisfies Record<string, MorphPalette>;

export type MorphName = keyof typeof MORPHS;

export function isMorph(name: string): name is MorphName {
  return Object.hasOwn(MORPHS, name);
}

const PALE = "#ebe6e2";

/** Palidece la paleta (ajolote débil por inactividad). */
export function palePalette(p: MorphPalette, amount: number): MorphPalette {
  if (amount <= 0) return p;
  const m = (c: string) => mix(c, PALE, amount);
  return {
    ...p,
    outline: mix(p.outline, "#8a8682", amount * 0.6),
    shade: m(p.shade),
    base: m(p.base),
    light: m(p.light),
    fin: m(p.fin),
    finEdge: m(p.finEdge),
    mouth: mix(p.mouth, "#8a8682", amount * 0.6),
    blush: p.blush ? m(p.blush) : null,
    spots: p.spots ? m(p.spots) : null,
  };
}

export function paleColor(c: string, amount: number): string {
  return amount <= 0 ? c : mix(c, PALE, amount);
}

export type Sky = "dia" | "atardecer" | "noche";

export interface ScenePalette {
  sky: [string, string, string];
  cloud: string | null;
  star: string | null;
  moon: string | null;
  sun: string | null;
  tree: string;
  treeLight: string;
  trunk: string;
  bank: string;
  bankDark: string;
  surface: string;
  surfaceShine: string;
  water: [string, string, string, string];
  ray: string | null;
  leaf: string;
  leafLight: string;
  flower: string;
  flowerLight: string;
  root: string;
  mud: string;
  mudDark: string;
  pebble: string;
  pebbleLight: string;
  plant: string;
  plantLight: string;
  bubble: string;
  particle: string;
  caption: string;
  captionText: string;
}

const common = {
  root: "#2c2633",
  mud: "#3b3125",
  mudDark: "#2c241a",
  pebble: "#594936",
  pebbleLight: "#74624a",
  caption: "#211a12",
  captionText: "#efe3c8",
};

export const SKIES: Record<Sky, ScenePalette> = {
  dia: {
    ...common,
    sky: ["#86c5e0", "#a3d5ea", "#c6e8f1"],
    cloud: "#f5fbfd",
    star: null,
    moon: null,
    sun: null,
    tree: "#2f5c2d",
    treeLight: "#4f8642",
    trunk: "#5a4530",
    bank: "#5f8d3d",
    bankDark: "#46702d",
    surface: "#cdeee0",
    surfaceShine: "#ffffff",
    water: ["#4b9b8a", "#3a8679", "#2e6f67", "#245a55"],
    ray: "#ffffff",
    leaf: "#2f8a5a",
    leafLight: "#86d69a",
    flower: "#a982d6",
    flowerLight: "#d7bdf2",
    plant: "#3c7a3c",
    plantLight: "#62a556",
    bubble: "#e2f7f2",
    particle: "#d5efe4",
  },
  atardecer: {
    ...common,
    sky: ["#5b5ca0", "#d9787a", "#f6b973"],
    cloud: "#f9d2a8",
    star: null,
    moon: null,
    sun: "#ffe08a",
    tree: "#2a3d2c",
    treeLight: "#465b37",
    trunk: "#3e2f24",
    bank: "#4b6532",
    bankDark: "#384c25",
    surface: "#f2c39a",
    surfaceShine: "#fff1d6",
    water: ["#4b7f7a", "#3a6c6b", "#2d5a5d", "#224a4f"],
    ray: "#ffd9a8",
    leaf: "#36723a",
    leafLight: "#5a9a4c",
    flower: "#b98ad8",
    flowerLight: "#e3c7f4",
    plant: "#346a38",
    plantLight: "#55904c",
    bubble: "#f3e6d6",
    particle: "#f0dcc4",
  },
  noche: {
    ...common,
    sky: ["#0f1530", "#172044", "#24305a"],
    cloud: null,
    star: "#f2f0dc",
    moon: "#f4efcf",
    sun: null,
    tree: "#11231a",
    treeLight: "#1d3a26",
    trunk: "#1d1712",
    bank: "#22391f",
    bankDark: "#182a16",
    surface: "#4f6f93",
    surfaceShine: "#c9dcf2",
    water: ["#1f4955", "#1a3e4a", "#15333f", "#102a34"],
    ray: null,
    leaf: "#1f4a2a",
    leafLight: "#326a3a",
    flower: "#7b62a6",
    flowerLight: "#a993cc",
    plant: "#1f4a2c",
    plantLight: "#2f6a3a",
    bubble: "#a9c8d8",
    particle: "#8fb3c4",
  },
};
