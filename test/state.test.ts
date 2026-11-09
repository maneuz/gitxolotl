import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSnapshot, DEMO_SCENARIOS } from "../src/demo.ts";
import {
  addDays,
  computeState,
  gillHealthFor,
  palenessFor,
  pickGillLanguages,
  selectBehavior,
  stageFor,
  weekday,
} from "../src/state.ts";
import type { ContributionDay } from "../src/types.ts";

const series = (end: string, counts: number[]): ContributionDay[] =>
  counts.map((count, i) => ({ date: addDays(end, i - counts.length + 1), count }));

test("fechas: días de la semana conocidos", () => {
  assert.equal(weekday("2026-11-02"), 0); // lunes
  assert.equal(weekday("2026-11-01"), 6); // domingo
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("etapas por contribuciones totales", () => {
  assert.equal(stageFor(0).stage, "larva");
  assert.equal(stageFor(249).stage, "larva");
  assert.equal(stageFor(250).stage, "juvenil");
  assert.equal(stageFor(1000).stage, "adulto");
  assert.equal(stageFor(5000).stage, "ancestral");
});

test("cada escenario demo produce su comportamiento", () => {
  for (const behavior of DEMO_SCENARIOS) {
    assert.equal(computeState(demoSnapshot(behavior)).behavior, behavior, behavior);
  }
});

test("14 días sin actividad: descansa; 60: duerme", () => {
  const base = Array(30).fill(2);
  assert.equal(selectBehavior(series("2026-11-03", [...base, ...Array(14).fill(0)]), 900), "descansando");
  assert.equal(selectBehavior(series("2026-11-03", [...base, ...Array(13).fill(0)]), 900), "nadando");
  assert.equal(selectBehavior(series("2026-11-03", [...base, ...Array(60).fill(0)]), 900), "dormido");
});

test("volver tras una pausa larga regenera, aunque sea inicio de semana", () => {
  // 2026-11-02 es lunes: también sería "comiendo", pero regenerar tiene prioridad.
  const days = series("2026-11-02", [...Array(30).fill(2), ...Array(20).fill(0), 1]);
  assert.equal(selectBehavior(days, 900), "regenerando");
});

test("primer commit de la semana: come", () => {
  // miércoles con lunes y martes vacíos
  const days = series("2026-11-04", [...Array(30).fill(2), 0, 0, 5]);
  assert.equal(selectBehavior(days, 900), "comiendo");
});

test("cruzar un hito en la última semana: acelerado", () => {
  const days = series("2026-11-03", Array(40).fill(3));
  assert.equal(selectBehavior(days, 1010), "acelerado"); // 1010 - 21 < 1000
  assert.equal(selectBehavior(days, 1030), "nadando");
});

test("branquias y palidez según días sin actividad", () => {
  assert.equal(gillHealthFor(0), 1);
  assert.ok(gillHealthFor(30) < 1 && gillHealthFor(30) > 0.35);
  assert.ok(Math.abs(gillHealthFor(60) - 0.35) < 1e-9);
  assert.equal(palenessFor(13), 0);
  assert.ok(palenessFor(60) > palenessFor(20));
});

test("lenguajes: top 3 por bytes, con exclusiones", () => {
  const langs = [
    { name: "HTML", color: "#e34c26", bytes: 900 },
    { name: "TypeScript", color: "#3178c6", bytes: 500 },
    { name: "C", color: "#555555", bytes: 300 },
    { name: "Python", color: "#3572A5", bytes: 200 },
  ];
  assert.deepEqual(
    pickGillLanguages(langs, ["html"]).map((l) => l.name),
    ["TypeScript", "C", "Python"],
  );
  // C (#555555) es muy oscuro: se aclara para que se vea bajo el agua
  assert.notEqual(pickGillLanguages(langs)[2].color, "#555555");
});
