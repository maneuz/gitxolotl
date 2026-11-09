// Datos sintéticos para ver cada comportamiento sin tocar la API.

import { addDays, type Behavior } from "./state.ts";
import type { AccountSnapshot, ContributionDay } from "./types.ts";

export const DEMO_LANGUAGES = [
  { name: "TypeScript", color: "#3178c6", bytes: 420_000 },
  { name: "JavaScript", color: "#f1e05a", bytes: 180_000 },
  { name: "Python", color: "#3572A5", bytes: 90_000 },
  { name: "CSS", color: "#663399", bytes: 40_000 },
];

export const DEMO_SCENARIOS: Behavior[] = [
  "nadando",
  "acelerado",
  "comiendo",
  "regenerando",
  "descansando",
  "dormido",
];

/**
 * Arma 400 días de actividad que terminan en un día que dispara el
 * comportamiento pedido. `total` controla la etapa de crecimiento.
 */
export function demoSnapshot(behavior: Behavior, login = "maneuz", total = 1800): AccountSnapshot {
  // Termina en martes por defecto (no es inicio de semana ni domingo).
  let end = "2026-11-03";
  const pattern: number[] = [];
  const n = 400;
  for (let i = 0; i < n; i++) pattern.push(i % 7 === 5 ? 0 : 1 + ((i * 7) % 5));

  if (behavior === "acelerado") {
    end = "2026-11-01"; // domingo que cierra una semana enorme
    for (let i = n - 7; i < n; i++) pattern[i] = 30;
  } else if (behavior === "comiendo") {
    end = "2026-11-04"; // miércoles; lunes y martes sin actividad
    pattern[n - 3] = 0;
    pattern[n - 2] = 0;
    pattern[n - 1] = 4;
  } else if (behavior === "regenerando") {
    for (let i = n - 21; i < n - 1; i++) pattern[i] = 0;
    pattern[n - 1] = 3;
  } else if (behavior === "descansando") {
    for (let i = n - 20; i < n; i++) pattern[i] = 0;
  } else if (behavior === "dormido") {
    for (let i = n - 75; i < n; i++) pattern[i] = 0;
  } else {
    pattern[n - 1] = 3;
    pattern[n - 2] = 2;
  }

  const start = addDays(end, -(n - 1));
  const days: ContributionDay[] = pattern.map((count, i) => ({ date: addDays(start, i), count }));
  return {
    login,
    observedOn: end,
    days,
    // El total histórico es independiente de los 400 días de muestra: decide la etapa.
    totalContributions: total,
    languages: DEMO_LANGUAGES,
  };
}
