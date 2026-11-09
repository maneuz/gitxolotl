// Fuente pixel de 3x5 para el letrero inferior.

import type { PixelCanvas } from "./pixel.ts";

const GLYPHS: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "##."],
  " ": ["...", "...", "...", "...", "..."],
  "·": ["...", "...", ".#.", "...", "..."],
  "#": ["#.#", "###", "#.#", "###", "#.#"],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "-": ["...", "...", "###", "...", "..."],
  ".": ["...", "...", "...", "...", ".#."],
  ":": ["...", ".#.", "...", ".#.", "..."],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  _: ["...", "...", "...", "...", "###"],
};

const ACCENTS: Record<string, string> = { Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ñ: "N", Ü: "U" };

export function normalizeText(text: string): string {
  return [...text.toUpperCase()].map((c) => ACCENTS[c] ?? (GLYPHS[c] ? c : " ")).join("");
}

export function textWidth(text: string): number {
  const n = [...normalizeText(text)].length;
  return n === 0 ? 0 : n * 4 - 1;
}

export function drawText(canvas: PixelCanvas, text: string, x: number, y: number, color: string): number {
  let cx = x;
  for (const ch of normalizeText(text)) {
    const g = GLYPHS[ch];
    g.forEach((row, j) => {
      for (let i = 0; i < 3; i++) if (row[i] === "#") canvas.set(cx + i, y + j, color);
    });
    cx += 4;
  }
  return cx - x - 1;
}

const ABBREVIATIONS: Record<string, string> = {
  typescript: "TS",
  javascript: "JS",
  python: "PY",
  "c#": "C#",
  "c++": "C++",
  "objective-c": "OBJC",
  "jupyter notebook": "IPYNB",
  shell: "SH",
  powershell: "PS1",
  kotlin: "KT",
  rust: "RS",
  ruby: "RB",
  golang: "GO",
  markdown: "MD",
  dockerfile: "DOCKR",
  "vim script": "VIM",
};

export function abbreviate(language: string): string {
  const key = language.toLowerCase();
  if (ABBREVIATIONS[key]) return ABBREVIATIONS[key];
  const clean = normalizeText(language).replace(/\s+/g, "");
  return clean.length <= 4 ? clean : clean.slice(0, 3);
}
