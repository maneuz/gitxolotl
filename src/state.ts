// Reglas: traducen la actividad de GitHub al estado del ajolote.
// No leen el reloj ni la red, así que se pueden probar con datos fijos.

import { ensureVisible } from "./color.ts";
import type { AccountSnapshot, ContributionDay, LanguageShare } from "./types.ts";

export type Stage = "larva" | "juvenil" | "adulto" | "ancestral";

export type Behavior =
  | "dormido" // 60+ días sin actividad: en el fondo, pálido, branquias mínimas
  | "descansando" // 14+ días sin actividad: quieto, pálido, branquias encogidas
  | "regenerando" // volviste tras 14+ días: le crecen de nuevo las branquias
  | "comiendo" // primer día con contribuciones de la semana
  | "acelerado" // cruzaste un hito o cerraste una semana muy activa
  | "nadando"; // cualquier otro día

export const STAGE_THRESHOLDS: { stage: Stage; from: number; scale: number }[] = [
  { stage: "larva", from: 0, scale: 0.6 },
  { stage: "juvenil", from: 250, scale: 0.8 },
  { stage: "adulto", from: 1000, scale: 1 },
  { stage: "ancestral", from: 5000, scale: 1.15 },
];

export const MILESTONES = [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000];

export const REST_QUIET_DAYS = 14;
export const DORMANT_QUIET_DAYS = 60;
const BUSY_WEEK_COMPARED = 52;
const BUSY_WEEK_MIN = 10;

export interface AxolotlState {
  login: string;
  observedOn: string;
  stage: Stage;
  scale: number;
  behavior: Behavior;
  /** Días seguidos sin contribuciones que terminan en observedOn. */
  quietDays: number;
  /** Racha más larga de días con contribuciones (en los datos disponibles). */
  longestStreak: number;
  currentStreak: number;
  totalContributions: number;
  /** 0.35 (muy encogidas) a 1 (sanas). */
  gillHealth: number;
  /** 0 (color normal) a ~0.55 (muy pálido). */
  paleness: number;
  /** Manchitas doradas ganadas por la racha más larga. */
  speckles: number;
  /** Hasta 3 lenguajes, uno por par de branquias. */
  gillLanguages: { name: string; color: string }[];
}

export function stageFor(total: number): { stage: Stage; scale: number } {
  let pick = STAGE_THRESHOLDS[0];
  for (const t of STAGE_THRESHOLDS) if (total >= t.from) pick = t;
  return { stage: pick.stage, scale: pick.scale };
}

/** Días hasta observedOn (inclusive), ordenados y sin huecos. */
export function daysUpTo(days: ContributionDay[], observedOn: string): ContributionDay[] {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const sorted = [...days].map((d) => d.date).filter((d) => d <= observedOn).sort();
  if (sorted.length === 0) return [{ date: observedOn, count: byDate.get(observedOn) ?? 0 }];
  const out: ContributionDay[] = [];
  for (let d = sorted[0]; d <= observedOn; d = addDays(d, 1)) {
    out.push({ date: d, count: byDate.get(d) ?? 0 });
  }
  return out;
}

export function addDays(date: string, n: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 0 = lunes … 6 = domingo. */
export function weekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function trailingRun(days: ContributionDay[], end: number, active: boolean): number {
  let n = 0;
  for (let i = end; i >= 0 && days[i].count > 0 === active; i--) n++;
  return n;
}

function longestRun(days: ContributionDay[]): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

function isFirstActiveDayOfWeek(days: ContributionDay[]): boolean {
  const last = days.length - 1;
  if (days[last].count === 0) return false;
  const wd = weekday(days[last].date);
  for (let k = 1; k <= wd && last - k >= 0; k++) if (days[last - k].count > 0) return false;
  return true;
}

function crossedMilestone(total: number, days: ContributionDay[]): boolean {
  const lastWeek = days.slice(-7).reduce((s, d) => s + d.count, 0);
  const before = total - lastWeek;
  return MILESTONES.some((m) => before < m && total >= m);
}

function finishedBusyWeek(days: ContributionDay[]): boolean {
  const last = days.length - 1;
  if (weekday(days[last].date) !== 6) return false;
  const weeks: number[] = [];
  for (let end = last; end - 6 >= 0; end -= 7) {
    let sum = 0;
    for (let i = end - 6; i <= end; i++) sum += days[i].count;
    weeks.push(sum);
  }
  const [thisWeek, ...previous] = weeks;
  const compared = previous.slice(0, BUSY_WEEK_COMPARED);
  if (thisWeek === 0 || compared.length < BUSY_WEEK_MIN) return false;
  const atLeast = compared.filter((w) => w >= thisWeek).length;
  return atLeast * 10 <= compared.length;
}

export function selectBehavior(days: ContributionDay[], total: number): Behavior {
  const last = days.length - 1;
  const quiet = trailingRun(days, last, false);
  if (quiet >= DORMANT_QUIET_DAYS) return "dormido";
  if (quiet >= REST_QUIET_DAYS) return "descansando";
  if (days[last].count > 0 && last >= 1) {
    const quietBefore = trailingRun(days, last - 1, false);
    if (quietBefore >= REST_QUIET_DAYS) return "regenerando";
  }
  if (isFirstActiveDayOfWeek(days)) return "comiendo";
  if (crossedMilestone(total, days) || finishedBusyWeek(days)) return "acelerado";
  return "nadando";
}

export function gillHealthFor(quietDays: number): number {
  if (quietDays < 7) return 1;
  return 1 - 0.65 * Math.min(1, (quietDays - 7) / (DORMANT_QUIET_DAYS - 7));
}

export function palenessFor(quietDays: number): number {
  if (quietDays < REST_QUIET_DAYS) return 0;
  const k = Math.min(1, (quietDays - REST_QUIET_DAYS) / (DORMANT_QUIET_DAYS - REST_QUIET_DAYS));
  return 0.25 + 0.3 * k;
}

export function pickGillLanguages(
  languages: LanguageShare[],
  exclude: string[] = [],
): { name: string; color: string }[] {
  const skip = new Set(exclude.map((e) => e.toLowerCase()));
  return [...languages]
    .filter((l) => !skip.has(l.name.toLowerCase()) && l.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 3)
    .map((l) => ({ name: l.name, color: ensureVisible(l.color || "#8b8b8b") }));
}

export function computeState(snapshot: AccountSnapshot, exclude: string[] = []): AxolotlState {
  const days = daysUpTo(snapshot.days, snapshot.observedOn);
  const last = days.length - 1;
  const quietDays = trailingRun(days, last, false);
  const { stage, scale } = stageFor(snapshot.totalContributions);
  const longestStreak = longestRun(days);
  return {
    login: snapshot.login,
    observedOn: snapshot.observedOn,
    stage,
    scale,
    behavior: selectBehavior(days, snapshot.totalContributions),
    quietDays,
    longestStreak,
    currentStreak: trailingRun(days, last, true),
    totalContributions: snapshot.totalContributions,
    gillHealth: gillHealthFor(quietDays),
    paleness: palenessFor(quietDays),
    speckles: Math.min(14, Math.floor(longestStreak / 5)),
    gillLanguages: pickGillLanguages(snapshot.languages, exclude),
  };
}
