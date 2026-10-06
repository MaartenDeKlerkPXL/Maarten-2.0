// Haalt F1 (kwalificatie, sprint, race), Roda JC-wedstrijden (competitie + beker) en alle
// wedstrijden van het Nederlands elftal (heren, A-selectie) op en zet ze als todo's in de lijst.
// Draait 2x per dag via cron, of via de knop in de app.
import { adminClient, authorize, corsHeaders, json, loadSecrets } from "../_shared/admin.ts";

const RODA_TEAM_ID = "133761";
const EERSTE_DIVISIE_ID = "4641";
const KNVB_BEKER_ID = "4902";
const SPORTSDB = "https://www.thesportsdb.com/api/v1/json/123";
// Nederland heren A-selectie (strGender "Male", competities WK/EK/Nations League/oefenduels).
// Vrouwen, Jong Oranje en jeugdteams hebben een eigen team-ID en vallen zo automatisch af.
const ORANJE_TEAM_ID = "133905";

interface EventRow {
  source: "f1" | "roda" | "oranje";
  external_id: string;
  title: string;
  location: string | null;
  startIso: string | null; // UTC
  date: string; // YYYY-MM-DD (fallback als er geen tijd is)
  durationMin: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gratis TheSportsDB-key: max ~30 verzoeken per minuut, gedeeld door Roda en Oranje.
const sportsdbCalls: number[] = [];
async function sportsdb(path: string) {
  for (;;) {
    const now = Date.now();
    while (sportsdbCalls.length && now - sportsdbCalls[0] > 60_000) sportsdbCalls.shift();
    if (sportsdbCalls.length < 28) break;
    await sleep(60_000 - (now - sportsdbCalls[0]) + 50);
  }
  if (sportsdbCalls.length) await sleep(Math.max(0, 350 - (Date.now() - sportsdbCalls[sportsdbCalls.length - 1])));
  sportsdbCalls.push(Date.now());
  return getJson(`${SPORTSDB}/${path}`);
}

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
    const next = await sportsdb(`eventsnext.php?id=${RODA_TEAM_ID}`);
    add(next.events);
    const league = (next.events ?? []).find((e: Record<string, string>) => e.idLeague === EERSTE_DIVISIE_ID);
    if (league?.intRound) currentRound = Number(league.intRound);
    else {
      const last = await sportsdb(`eventslast.php?id=${RODA_TEAM_ID}`);
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
      const data = await sportsdb(`eventsround.php?id=${league}&r=${round}&s=${s}`);
      add(data.events);
    } catch (e) {
      console.warn("Roda round", league, round, e);
    }
  }
  return [...events.values()];
}

// ───────────── Nederlands elftal (heren) ─────────────
const COMPETITIONS: Record<string, string> = {
  "4490": "Nations League",
  "4562": "Oefenduel",
  "5519": "EK-kwalificatie",
  "5518": "WK-kwalificatie",
  "4429": "WK",
  "4502": "EK",
};

const COUNTRIES: Record<string, string> = {
  Netherlands: "Nederland", Germany: "Duitsland", Belgium: "België", France: "Frankrijk", England: "Engeland",
  Spain: "Spanje", Portugal: "Portugal", Italy: "Italië", Croatia: "Kroatië", Serbia: "Servië", Greece: "Griekenland",
  Denmark: "Denemarken", Sweden: "Zweden", Norway: "Noorwegen", Finland: "Finland", Iceland: "IJsland",
  Poland: "Polen", "Czech Republic": "Tsjechië", Czechia: "Tsjechië", Slovakia: "Slowakije", Hungary: "Hongarije",
  Austria: "Oostenrijk", Switzerland: "Zwitserland", Scotland: "Schotland", Wales: "Wales", "Northern Ireland": "Noord-Ierland",
  "Republic of Ireland": "Ierland", Ireland: "Ierland", Turkey: "Turkije", "Türkiye": "Turkije", Ukraine: "Oekraïne",
  Romania: "Roemenië", Bulgaria: "Bulgarije", Slovenia: "Slovenië", "Bosnia and Herzegovina": "Bosnië en Herzegovina",
  "Bosnia-Herzegovina": "Bosnië en Herzegovina", "North Macedonia": "Noord-Macedonië", Albania: "Albanië", Montenegro: "Montenegro",
  Kosovo: "Kosovo", Georgia: "Georgië", Armenia: "Armenië", Azerbaijan: "Azerbeidzjan", Kazakhstan: "Kazachstan",
  Belarus: "Wit-Rusland", Russia: "Rusland", Moldova: "Moldavië", Lithuania: "Litouwen", Latvia: "Letland", Estonia: "Estland",
  Luxembourg: "Luxemburg", Cyprus: "Cyprus", Malta: "Malta", Andorra: "Andorra", "San Marino": "San Marino",
  Liechtenstein: "Liechtenstein", Gibraltar: "Gibraltar", "Faroe Islands": "Faeröer", Israel: "Israël",
  Brazil: "Brazilië", Argentina: "Argentinië", Uruguay: "Uruguay", Mexico: "Mexico", USA: "Verenigde Staten",
  "United States": "Verenigde Staten", Canada: "Canada", Japan: "Japan", "South Korea": "Zuid-Korea", Morocco: "Marokko",
  Algeria: "Algerije", Tunisia: "Tunesië", Egypt: "Egypte", Senegal: "Senegal", Nigeria: "Nigeria", Ghana: "Ghana",
  "Ivory Coast": "Ivoorkust", Cameroon: "Kameroen", "South Africa": "Zuid-Afrika", Australia: "Australië", Qatar: "Qatar",
  "Saudi Arabia": "Saoedi-Arabië", Iran: "Iran", Ecuador: "Ecuador", Colombia: "Colombia", Chile: "Chili", Peru: "Peru",
  Paraguay: "Paraguay", Curacao: "Curaçao", "Curaçao": "Curaçao", Suriname: "Suriname",
};
const nl = (team: string | null) => (team ? COUNTRIES[team] ?? team : "?");

function oranjeRow(e: Record<string, string | null>): EventRow | null {
  if (e.idHomeTeam !== ORANJE_TEAM_ID && e.idAwayTeam !== ORANJE_TEAM_ID) return null;
  const home = e.idHomeTeam === ORANJE_TEAM_ID;
  const comp = COMPETITIONS[String(e.idLeague)] ?? (/european championship/i.test(String(e.strLeague)) ? "EK" : String(e.strLeague ?? "Interland"));
  const ts = e.strTimestamp && !/T00:00:00/.test(e.strTimestamp) ? `${e.strTimestamp.replace(/Z$/, "")}Z` : null;
  const postponed = e.strPostponed === "yes" ? " (uitgesteld)" : "";
  return {
    source: "oranje",
    external_id: String(e.idEvent),
    title: `${comp}: ${nl(e.strHomeTeam)} – ${nl(e.strAwayTeam)} ${home ? "(thuis)" : "(uit)"}${postponed}`,
    location: e.strVenue || null,
    startIso: ts,
    date: String(e.dateEvent),
    durationMin: 120,
  };
}

/** De gratis API geeft één "volgende wedstrijd"; vanuit die competitie halen we de komende speelrondes op.
 *  Oefenduels en wedstrijden in een nieuwe competitie komen binnen zodra ze de volgende wedstrijd zijn. */
async function fetchOranje(): Promise<EventRow[]> {
  const events = new Map<string, EventRow>();
  const add = (list: Record<string, string | null>[] | null | undefined) => {
    for (const e of list ?? []) {
      const row = oranjeRow(e);
      if (row) events.set(row.external_id, row);
    }
  };
  const next = await sportsdb(`eventsnext.php?id=${ORANJE_TEAM_ID}`);
  add(next.events);
  const first = (next.events ?? [])[0] as Record<string, string> | undefined;
  const round = Number(first?.intRound);
  if (first?.idLeague && first.idLeague !== "4562" && first.strSeason && Number.isFinite(round) && round > 0) {
    for (let r = round; r <= round + 4; r++) {
      try {
        const data = await sportsdb(`eventsround.php?id=${first.idLeague}&r=${r}&s=${encodeURIComponent(first.strSeason)}`);
        add(data.events);
      } catch (e) {
        console.warn("Oranje round", first.idLeague, r, e);
      }
    }
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

    const [f1, [roda, oranje]] = await Promise.all([
      fetchF1().catch((e) => (console.error(e), [] as EventRow[])),
      // na elkaar: ze delen de limiet van de gratis TheSportsDB-key
      (async () => [
        await fetchRoda().catch((e) => (console.error(e), [] as EventRow[])),
        await fetchOranje().catch((e) => (console.error(e), [] as EventRow[])),
      ])(),
    ]);

    let query = admin.from("settings").select("user_id, timezone");
    if (!auth.cron) query = query.eq("user_id", auth.userId);
    const { data: users, error } = await query;
    if (error) throw error;

    let upserted = 0;
    for (const u of users ?? []) {
      const tz = u.timezone || "Europe/Amsterdam";
      const today = localParts(new Date().toISOString(), tz).date;
      let { data: cats } = await admin.from("categories").select("id, slug, sort").eq("user_id", u.user_id);
      if (oranje.length && cats && !cats.some((c) => c.slug === "oranje")) {
        const sort = Math.max(0, ...cats.map((c) => c.sort ?? 0)) + 1;
        await admin.from("categories").insert({ user_id: u.user_id, slug: "oranje", name: "Oranje", color: "#FF7A00", sort });
        ({ data: cats } = await admin.from("categories").select("id, slug, sort").eq("user_id", u.user_id));
      }
      const catId = (slug: string) => cats?.find((c) => c.slug === slug)?.id ?? null;

      const rows = [...f1, ...roda, ...oranje]
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

    return json({ f1: f1.length, roda: roda.length, oranje: oranje.length, upserted });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
