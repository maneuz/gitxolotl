// Lectura de la actividad desde la API GraphQL de GitHub.
//
// Con el GITHUB_TOKEN de un workflow se ve la actividad pública (y la privada
// si activaste "Private contributions" en tu perfil). Con un token personal de
// solo lectura también se cuentan los lenguajes de tus repos privados.

import type { AccountSnapshot, ContributionDay, LanguageShare } from "./types.ts";

const ENDPOINT = "https://api.github.com/graphql";

export type GraphqlFetch = (query: string, variables: Record<string, unknown>) => Promise<any>;

export function githubGraphql(token: string): GraphqlFetch {
  return async (query, variables) => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "gitxolotl",
      },
      body: JSON.stringify({ query, variables }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.errors) {
      const detail = body.errors?.map((e: any) => e.message).join("; ") ?? res.statusText;
      throw new Error(`GitHub respondió ${res.status}: ${detail}`);
    }
    return body.data;
  };
}

const CALENDAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    createdAt
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const LANGUAGES_QUERY = `
query($login: String!, $after: String) {
  user(login: $login) {
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false) {
      pageInfo { hasNextPage endCursor }
      nodes {
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

/** Fecha de "ayer" en la zona horaria indicada (el día que se juzga). */
export function yesterdayIn(timeZone: string, now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const t = Date.parse(`${today}T00:00:00Z`) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export async function collectSnapshot(
  gql: GraphqlFetch,
  login: string,
  observedOn: string,
): Promise<AccountSnapshot> {
  // Un año por consulta (límite de la API), desde que se creó la cuenta.
  const first = await gql(CALENDAR_QUERY, {
    login,
    from: `${observedOn.slice(0, 4)}-01-01T00:00:00Z`,
    to: `${observedOn}T23:59:59Z`,
  });
  if (!first?.user) throw new Error(`No existe el usuario ${login} o el token no puede verlo.`);
  const createdYear = Number(String(first.user.createdAt).slice(0, 4));
  const observedYear = Number(observedOn.slice(0, 4));

  const days = new Map<string, number>();
  const addCalendar = (data: any) => {
    for (const w of data.user.contributionsCollection.contributionCalendar.weeks) {
      for (const d of w.contributionDays) {
        if (d.date <= observedOn) days.set(d.date, d.contributionCount);
      }
    }
  };
  addCalendar(first);
  for (let year = observedYear - 1; year >= createdYear; year--) {
    addCalendar(
      await gql(CALENDAR_QUERY, { login, from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` }),
    );
  }
  const dayList: ContributionDay[] = [...days.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Lenguajes: suma de bytes por lenguaje en tus repos (no forks).
  const totals = new Map<string, LanguageShare>();
  let after: string | null = null;
  do {
    const data: any = await gql(LANGUAGES_QUERY, { login, after });
    const repos = data.user.repositories;
    for (const repo of repos.nodes) {
      for (const edge of repo.languages.edges) {
        const prev = totals.get(edge.node.name);
        totals.set(edge.node.name, {
          name: edge.node.name,
          color: edge.node.color ?? "#8b8b8b",
          bytes: (prev?.bytes ?? 0) + edge.size,
        });
      }
    }
    after = repos.pageInfo.hasNextPage ? repos.pageInfo.endCursor : null;
  } while (after);

  return {
    login,
    observedOn,
    days: dayList,
    totalContributions: dayList.reduce((s, d) => s + d.count, 0),
    languages: [...totals.values()].sort((a, b) => b.bytes - a.bytes),
  };
}
