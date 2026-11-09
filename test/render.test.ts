import assert from "node:assert/strict";
import { test } from "node:test";
import { collectSnapshot, yesterdayIn, type GraphqlFetch } from "../src/collect.ts";
import { demoSnapshot, DEMO_SCENARIOS } from "../src/demo.ts";
import { MORPHS, type MorphName } from "../src/palettes.ts";
import { renderSvg } from "../src/render.ts";
import { computeState } from "../src/state.ts";

test("cada comportamiento y morph genera un SVG razonable", () => {
  for (const behavior of DEMO_SCENARIOS) {
    for (const morph of Object.keys(MORPHS) as MorphName[]) {
      const svg = renderSvg(computeState(demoSnapshot(behavior)), { morph });
      assert.ok(svg.startsWith("<svg"), `${behavior}/${morph}`);
      assert.ok(svg.endsWith("</svg>"));
      assert.ok(!svg.includes("<script"), "GitHub no ejecuta scripts en imágenes");
      assert.ok(svg.length < 200_000, `${behavior}/${morph} pesa ${svg.length} bytes`);
    }
  }
});

test("el render es determinista", () => {
  const state = computeState(demoSnapshot("nadando"));
  assert.equal(renderSvg(state), renderSvg(state));
});

test("el nombre de usuario se escapa en el título", () => {
  const snap = { ...demoSnapshot("nadando"), login: 'a"<b>' };
  const svg = renderSvg(computeState(snap));
  assert.ok(!svg.includes('a"<b>'));
});

test("yesterdayIn respeta la zona horaria", () => {
  // 03:00 UTC del 6 de nov = 21:00 del 5 de nov en CDMX → ayer es el 4
  const now = new Date("2026-11-06T03:00:00Z");
  assert.equal(yesterdayIn("America/Mexico_City", now), "2026-11-04");
  assert.equal(yesterdayIn("UTC", now), "2026-11-05");
});

test("collectSnapshot junta años y lenguajes", async () => {
  const calls: Record<string, unknown>[] = [];
  const gql: GraphqlFetch = async (query, vars) => {
    calls.push(vars);
    if (query.includes("contributionCalendar")) {
      const year = String(vars.from).slice(0, 4);
      return {
        user: {
          createdAt: "2025-03-01T00:00:00Z",
          contributionsCollection: {
            contributionCalendar: {
              weeks: [{ contributionDays: [{ date: `${year}-06-01`, contributionCount: 4 }, { date: "2026-12-30", contributionCount: 9 }] }],
            },
          },
        },
      };
    }
    return {
      user: {
        repositories: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            { languages: { edges: [{ size: 10, node: { name: "TypeScript", color: "#3178c6" } }] } },
            { languages: { edges: [{ size: 5, node: { name: "TypeScript", color: "#3178c6" } }, { size: 7, node: { name: "Python", color: null } }] } },
          ],
        },
      },
    };
  };
  const snap = await collectSnapshot(gql, "maneuz", "2026-11-05");
  assert.equal(snap.totalContributions, 8); // 2025-06-01 + 2026-06-01; el 30 de dic es futuro
  assert.deepEqual(snap.languages.map((l) => [l.name, l.bytes]), [["TypeScript", 15], ["Python", 7]]);
  assert.equal(calls.length, 3); // 2026, 2025 y lenguajes
});
