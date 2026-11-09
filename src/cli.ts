#!/usr/bin/env node
// gitxolotl: dibuja tu ajolote a partir de tu actividad en GitHub.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { collectSnapshot, githubGraphql, yesterdayIn } from "./collect.ts";
import { DEMO_SCENARIOS, demoSnapshot } from "./demo.ts";
import { isMorph, MORPHS, type MorphName, type Sky } from "./palettes.ts";
import { renderSvg } from "./render.ts";
import { computeState, STAGE_THRESHOLDS, type Stage } from "./state.ts";
import type { AccountSnapshot } from "./types.ts";

const HELP = `
gitxolotl — tu ajolote de GitHub

Uso:
  node src/cli.ts --usuario <login> [opciones]      datos reales (requiere GITHUB_TOKEN)
  node src/cli.ts --demo [carpeta]                   galería con todos los comportamientos
  node src/cli.ts --datos snapshot.json              render desde un archivo

Opciones:
  --usuario <login>         cuenta de GitHub
  --salida <ruta>           archivo SVG (default: ajolote/ajolote.svg)
  --morph <nombre>          ${Object.keys(MORPHS).join(" | ")} (default: leucistico)
  --cielo <cielo>           auto | dia | atardecer | noche (default: auto)
  --zona <IANA>             zona horaria para decidir "ayer" (default: America/Mexico_City)
  --fecha <YYYY-MM-DD>      juzgar este día en lugar de ayer
  --excluir <a,b>           lenguajes que no cuentan para las branquias (ej. HTML,CSS)
  --guardar-datos <ruta>    guarda también la foto de actividad en JSON
  --ancho <px>              ancho del SVG (default: 640)
`;

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      usuario: { type: "string" },
      salida: { type: "string", default: "ajolote/ajolote.svg" },
      morph: { type: "string", default: "leucistico" },
      cielo: { type: "string", default: "auto" },
      zona: { type: "string", default: "America/Mexico_City" },
      fecha: { type: "string" },
      excluir: { type: "string", default: "" },
      datos: { type: "string" },
      "guardar-datos": { type: "string" },
      demo: { type: "boolean", default: false },
      ancho: { type: "string", default: "640" },
      ayuda: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.ayuda) {
    console.log(HELP);
    return;
  }
  const morph = values.morph!;
  if (!isMorph(morph)) throw new Error(`Morph desconocido "${morph}". Opciones: ${Object.keys(MORPHS).join(", ")}`);
  const sky = values.cielo as Sky | "auto";
  if (!["auto", "dia", "atardecer", "noche"].includes(sky)) throw new Error(`Cielo inválido "${sky}"`);
  const width = Number(values.ancho);
  const exclude = values.excluir!.split(",").map((s) => s.trim()).filter(Boolean);

  if (values.demo) {
    await renderDemo(positionals[0] ?? "demo", morph, width);
    return;
  }

  let snapshot: AccountSnapshot;
  if (values.datos) {
    snapshot = JSON.parse(readFileSync(values.datos, "utf8"));
  } else {
    const login = values.usuario ?? process.env.GITHUB_REPOSITORY_OWNER;
    if (!login) throw new Error("Falta --usuario.");
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    if (!token) throw new Error("Falta GITHUB_TOKEN (o GH_TOKEN) en el entorno.");
    const observedOn = values.fecha ?? yesterdayIn(values.zona!);
    snapshot = await collectSnapshot(githubGraphql(token), login, observedOn);
  }
  if (values["guardar-datos"]) write(values["guardar-datos"], JSON.stringify(snapshot, null, 2));

  const state = computeState(snapshot, exclude);
  write(values.salida!, renderSvg(state, { morph, sky, width }));
  console.log(
    `🦎 ${state.login}: ${state.stage}, ${state.behavior} · ${state.totalContributions} contribuciones · ` +
      `branquias: ${state.gillLanguages.map((l) => l.name).join(", ") || "color del morph"} → ${values.salida}`,
  );
}

async function renderDemo(dir: string, morph: MorphName, width: number) {
  const cards: string[] = [];
  for (const behavior of DEMO_SCENARIOS) {
    const state = computeState(demoSnapshot(behavior));
    const file = `${behavior}.svg`;
    write(join(dir, file), renderSvg(state, { morph, width }));
    cards.push(card(file, `${behavior} (${state.stage})`));
  }
  const stageTotals: Record<Stage, number> = { larva: 120, juvenil: 600, adulto: 1800, ancestral: 8000 };
  for (const t of STAGE_THRESHOLDS) {
    const state = computeState(demoSnapshot("nadando", "maneuz", stageTotals[t.stage]));
    const file = `etapa-${t.stage}.svg`;
    write(join(dir, file), renderSvg(state, { morph, width }));
    cards.push(card(file, `etapa: ${t.stage}`));
  }
  for (const m of Object.keys(MORPHS) as MorphName[]) {
    const state = computeState(demoSnapshot("nadando"));
    const file = `morph-${m}.svg`;
    write(join(dir, file), renderSvg(state, { morph: m, width }));
    cards.push(card(file, `morph: ${MORPHS[m].label}`));
  }
  write(
    join(dir, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Gitxólotl · demo</title>` +
      `<style>body{background:#0d1117;color:#e6edf3;font:14px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:20px}figure{margin:0}img{width:100%;image-rendering:pixelated;border-radius:8px}figcaption{margin-top:6px;opacity:.8}</style>` +
      `<h1>Gitxólotl · demo</h1><main>${cards.join("")}</main>`,
  );
  console.log(`Demo lista en ${dir}/index.html (${cards.length} escenas)`);
}

const card = (file: string, label: string) => `<figure><img src="${file}" alt="${label}"><figcaption>${label}</figcaption></figure>`;

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
