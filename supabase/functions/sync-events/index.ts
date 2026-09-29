// Haalt F1 (kwalificatie, sprint, race) en Roda JC-wedstrijden (competitie + beker) op
// en zet ze als todo's in de lijst. Draait 2x per dag via cron, of via de knop in de app.
import { adminClient, authorize, corsHeaders, json, loadSecrets } from "../_shared/admin.ts";

const RODA_TEAM_ID = "133761";
const EERSTE_DIVISIE_ID = "4641";
const KNVB_BEKER_ID = "4902";
const SPORTSDB = "https://www.thesportsdb.com/api/v1/json/123";

interface EventRow {
  source: "f1" | "roda";
  external_id: string;
  title: string;
  location: string | null;
  startIso: string | null; // UTC
  date: string; // YYYY-MM-DD (fallback als er geen tijd is)
  durationMin: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Maarten-2.0 dashboard" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function localParts(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

// ───────────── Formule 1 (Jolpica / Ergast) ─────────────
async function fetchF1(): Promise<EventRow[]> {
  const now = new Date();
  const years = [now.getUTCFullYear()];
  if (now.getUTCMonth() >= 9) years.push(now.getUTCFullYear() + 1);
  const rows: EventRow[] = [];
  for (const year of years) {
    let data;
    try {
      data = await getJson(`https://api.jolpi.ca/ergast/f1/${year}/races/?format=json&limit=100`);
    } catch (e) {
      console.warn("F1", year, e);
      continue;
    }
    for (const race of data?.MRData?.RaceTable?.Races ?? []) {
      const gp = `GP ${String(race.raceName).replace(/\s*Grand Prix$/i, "")}`;
      const location = [race.Circuit?.circuitName, race.Circuit?.Location?.country].filter(Boolean).join(", ");
      const sessions: [string, string, { date: string; time?: string } | undefined, number][] = [
        ["quali", "Kwalificatie", race.Qualifying, 60],
        ["sprint", "Sprint", race.Sprint, 60],
        ["race", "Race", { date: race.date, time: race.time }, 120],
      ];
      for (const [key, label, s, duration] of sessions) {
        if (!s?.date) continue;
        rows.push({
          source: "f1",
          external_id: `${race.season}-${race.round}-${key}`,
          title: `F1 ${label} · ${gp}`,
          location,
          startIso: s.time ? `${s.date}T${s.time}` : null,
          date: s.date,
          durationMin: duration,
        });
      }
    }
  }
  return rows;
}

// ───────────── Roda JC (TheSportsDB, gratis key) ─────────────
function season(now = new Date()) {
  const y = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function rodaRow(e: Record<string, string | null>): EventRow | null {
  if (e.idHomeTeam !== RODA_TEAM_ID && e.idAwayTeam !== RODA_TEAM_ID) return null;
  const home = e.idHomeTeam === RODA_TEAM_ID;
  const cup = e.idLeague === KNVB_BEKER_ID;
  const ts = e.strTimestamp && !/T00:00:00/.test(e.strTimestamp) ? `${e.strTimestamp.replace(/Z$/, "")}Z` : null;
  const postponed = e.strPostponed === "yes" ? " (uitgesteld)" : "";
  return {
    source: "roda",
    external_id: String(e.idEvent),
    title: `${cup ? "KNVB Beker: " : ""}${e.strHomeTeam} – ${e.strAwayTeam} ${home ? "(thuis)" : "(uit)"}${postponed}`,
    location: e.strVenue || null,
    startIso: ts,
    date: String(e.dateEvent),
    durationMin: 120,
  };
}

async function fetchRoda(): Promise<EventRow[]> {
  const s = season();
  const events = new Map<string, EventRow>();
  const add = (list: Record<string, string | null>[] | null | undefined) => {
    for (const e of list ?? []) {
      const row = rodaRow(e);
      if (row) events.set(row.external_id, row);
    }
  };

  let currentRound = 1;
  try {
    const next = await getJson(`${SPORTSDB}/eventsnext.php?id=${RODA_TEAM_ID}`);
    add(next.events);
    const league = (next.events ?? []).find((e: Record<string, string>) => e.idLeague === EERSTE_DIVISIE_ID);
    if (league?.intRound) currentRound = Number(league.intRound);
    else {
      const last = await getJson(`${SPORTSDB}/eventslast.php?id=${RODA_TEAM_ID}`);
      const l = (last.results ?? []).find((e: Record<string, string>) => e.idLeague === EERSTE_DIVISIE_ID);
      if (l?.intRound) currentRound = Number(l.intRound) + 1;
    }
  } catch (e) {
    console.warn("Roda next/last", e);
  }

  const rounds: [string, number][] = [];
  for (let r = currentRound; r <= Math.min(38, currentRound + 12); r++) rounds.push([EERSTE_DIVISIE_ID, r]);
  for (let r = 1; r <= 8; r++) rounds.push([KNVB_BEKER_ID, r]);

  for (const [league, round] of rounds) {
    try {
      const data = await getJson(`${SPORTSDB}/eventsround.php?id=${league}&r=${round}&s=${s}`);
      add(data.events);
    } catch (e) {
      console.warn("Roda round", league, round, e);
    }
    await sleep(350); // gratis API: max ~30 verzoeken per minuut
  }
  return [...events.values()];
}

// ───────────── Opslaan ─────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = adminClient();
    const secrets = await loadSecrets(admin);
    const auth = await authorize(req, admin, secrets);
    if (!auth) return json({ error: "unauthorized" }, 401);

    const [f1, roda] = await Promise.all([
      fetchF1().catch((e) => (console.error(e), [] as EventRow[])),
      fetchRoda().catch((e) => (console.error(e), [] as EventRow[])),
    ]);

    let query = admin.from("settings").select("user_id, timezone");
    if (!auth.cron) query = query.eq("user_id", auth.userId);
    const { data: users, error } = await query;
    if (error) throw error;

    let upserted = 0;
    for (const u of users ?? []) {
      const tz = u.timezone || "Europe/Amsterdam";
      const today = localParts(new Date().toISOString(), tz).date;
      const { data: cats } = await admin.from("categories").select("id, slug").eq("user_id", u.user_id);
      const catId = (slug: string) => cats?.find((c) => c.slug === slug)?.id ?? null;

      const rows = [...f1, ...roda]
        .map((e) => {
          let due_date = e.date;
          let due_time: string | null = null;
          let end_time: string | null = null;
          if (e.startIso) {
            const start = localParts(e.startIso, tz);
            due_date = start.date;
            due_time = start.time;
            const end = localParts(new Date(Date.parse(e.startIso) + e.durationMin * 60_000).toISOString(), tz);
            end_time = end.date === start.date ? end.time : "23:59";
          }
          return {
            user_id: u.user_id,
            source: e.source,
            external_id: e.external_id,
            title: e.title,
            location: e.location,
            due_date,
            due_time,
            end_time,
            is_event: true,
            category_id: catId(e.source),
          };
        })
        .filter((r) => r.due_date >= today);

      for (let i = 0; i < rows.length; i += 200) {
        const { error: upErr } = await admin
          .from("todos")
          .upsert(rows.slice(i, i + 200), { onConflict: "user_id,source,external_id" });
        if (upErr) throw upErr;
      }
      upserted += rows.length;
    }

    return json({ f1: f1.length, roda: roda.length, upserted });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
