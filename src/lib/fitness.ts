import { addIsoDays, daysBetween, iso, parseIso, weekStart } from "./dates";
import type { Exercise, PushupLog, Settings, Workout, WorkoutSet } from "./types";

// ───────────── Pushups: rustig opbouwen naar het doel ─────────────
export interface PushupWeek {
  start: string;
  target: number;
  daysHit: number;
  daysCounted: number;
  promoted: boolean;
}

export interface PushupPlan {
  target: number;
  weekIndex: number;
  weeks: PushupWeek[];
  weeksToGoal: number;
  byDay: Map<string, number>;
}

/** Elke week waarin je het dagdoel ≥ 5 van de 7 dagen haalt, gaat het doel met `step` omhoog (max = goal). */
export function pushupPlan(settings: Settings, logs: PushupLog[], today: string): PushupPlan {
  const byDay = new Map<string, number>();
  for (const l of logs) byDay.set(l.log_date, (byDay.get(l.log_date) ?? 0) + l.reps);
  const startDate = settings.pushup_start_date > today ? today : settings.pushup_start_date;
  let target = Math.min(settings.pushup_start_target, settings.pushup_goal);
  const weeks: PushupWeek[] = [];
  let w = iso(weekStart(parseIso(startDate)));
  const thisWeek = iso(weekStart(parseIso(today)));
  while (w < thisWeek) {
    const days = Array.from({ length: 7 }, (_, i) => addIsoDays(w, i)).filter((d) => d >= startDate);
    const daysHit = days.filter((d) => (byDay.get(d) ?? 0) >= target).length;
    const needed = Math.ceil((days.length * 5) / 7);
    const promoted = daysHit >= needed && target < settings.pushup_goal;
    weeks.push({ start: w, target, daysHit, daysCounted: days.length, promoted });
    if (promoted) target = Math.min(settings.pushup_goal, target + settings.pushup_step);
    w = addIsoDays(w, 7);
  }
  weeks.push({ start: thisWeek, target, daysHit: 0, daysCounted: 0, promoted: false });
  const weeksToGoal = Math.max(0, Math.ceil((settings.pushup_goal - target) / Math.max(1, settings.pushup_step)));
  return { target, weekIndex: weeks.length, weeks, weeksToGoal, byDay };
}

export function targetOn(plan: PushupPlan, date: string): number {
  const ws = iso(weekStart(parseIso(date)));
  return plan.weeks.find((w) => w.start === ws)?.target ?? plan.target;
}

// ───────────── Krachttraining ─────────────
/** "" → null (niet 0), "42,5" → 42.5 */
export const parseNum = (v: string) => {
  if (!v || !v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const DEFAULT_REPS = 8;

/** Volgend/vorig gewicht: op de gewichtsreeks van de machine, anders ± increment. */
export function stepWeight(ex: Exercise, current: number | null, dir: 1 | -1): number {
  const steps = (ex.weight_steps ?? []).map(Number).sort((a, b) => a - b);
  const w = current ?? 0;
  if (steps.length) {
    if (dir > 0) return steps.find((s) => s > w + 0.001) ?? steps[steps.length - 1];
    return [...steps].reverse().find((s) => s < w - 0.001) ?? steps[0];
  }
  const inc = Number(ex.increment_kg) || 2.5;
  return Math.max(0, Math.round((w + dir * inc) * 100) / 100);
}

export const fmtKg = (n: number | null | undefined) =>
  n == null ? "–" : `${Number(n).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}`;

export const fmtDuration = (sec: number | null | undefined) => {
  if (!sec) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
};

/** Epley: geschatte 1 herhaling maximum. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

export interface Session {
  workout: Workout;
  date: string;
  sets: WorkoutSet[];
  /** hoofdgetal om voortgang te volgen (hoger = beter, behalve bij 'assist') */
  metric: number | null;
  best: WorkoutSet | null;
  volume: number;
}

export function metricOf(ex: Exercise, sets: WorkoutSet[]): { metric: number | null; best: WorkoutSet | null } {
  const valid = sets.filter((s) => (s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0 || (s.distance_km ?? 0) > 0);
  if (!valid.length) return { metric: null, best: null };
  switch (ex.kind) {
    case "weight": {
      const best = valid.reduce((a, b) => (e1rm(b.weight_kg ?? 0, b.reps ?? 0) > e1rm(a.weight_kg ?? 0, a.reps ?? 0) ? b : a));
      return { metric: Math.round(e1rm(best.weight_kg ?? 0, best.reps ?? 0) * 10) / 10, best };
    }
    case "assist": {
      const withReps = valid.filter((s) => (s.reps ?? 0) >= 5);
      const pool = withReps.length ? withReps : valid;
      const best = pool.reduce((a, b) => ((b.weight_kg ?? 0) < (a.weight_kg ?? 0) ? b : a));
      return { metric: best.weight_kg ?? 0, best };
    }
    case "reps": {
      const best = valid.reduce((a, b) => ((b.reps ?? 0) > (a.reps ?? 0) ? b : a));
      return { metric: best.reps ?? 0, best };
    }
    case "time": {
      const best = valid.reduce((a, b) => ((b.seconds ?? 0) > (a.seconds ?? 0) ? b : a));
      return { metric: best.seconds ?? 0, best };
    }
    case "cardio": {
      const best = valid[0];
      if (best.distance_km && best.seconds) return { metric: Math.round((best.distance_km / (best.seconds / 3600)) * 10) / 10, best };
      return { metric: best.level ?? null, best };
    }
  }
}

export function sessionsFor(ex: Exercise, workouts: Workout[], sets: WorkoutSet[]): Session[] {
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (s.exercise_id !== ex.id) continue;
    const list = byWorkout.get(s.workout_id) ?? [];
    list.push(s);
    byWorkout.set(s.workout_id, list);
  }
  return workouts
    .filter((w) => byWorkout.has(w.id))
    .map((w) => {
      const ss = byWorkout.get(w.id)!.sort((a, b) => a.set_no - b.set_no);
      const { metric, best } = metricOf(ex, ss);
      const volume = ss.reduce((n, s) => n + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
      return { workout: w, date: w.workout_date, sets: ss, metric, best, volume };
    })
    .filter((s) => s.metric != null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.workout.created_at.localeCompare(b.workout.created_at));
}

export const lowerIsBetter = (ex: Exercise) => ex.kind === "assist";

export function isImprovement(ex: Exercise, now: number, before: number) {
  return lowerIsBetter(ex) ? now < before : now > before;
}

export function describeSet(ex: Exercise, s: WorkoutSet | null): string {
  if (!s) return "–";
  switch (ex.kind) {
    case "weight":
      return `${fmtKg(s.weight_kg)} kg × ${s.reps ?? 0}`;
    case "assist":
      return `${fmtKg(s.weight_kg)} kg hulp × ${s.reps ?? 0}`;
    case "reps":
      return `${s.reps ?? 0} herhalingen`;
    case "time":
      return fmtDuration(s.seconds);
    case "cardio": {
      const parts = [fmtDuration(s.seconds)];
      if (s.distance_km) parts.push(`${fmtKg(s.distance_km)} km`);
      if (s.level) parts.push(`niveau ${s.level}`);
      return parts.join(" · ");
    }
  }
}

export function describeSession(ex: Exercise, sets: WorkoutSet[]): string {
  if (!sets.length) return "–";
  if (ex.kind === "cardio" || ex.kind === "time") return sets.map((s) => describeSet(ex, s)).join(", ");
  const same = sets.every((s) => s.weight_kg === sets[0].weight_kg && s.reps === sets[0].reps);
  if (same) {
    const s = sets[0];
    if (ex.kind === "reps") return `${sets.length} × ${s.reps}`;
    return `${sets.length} × ${s.reps} @ ${fmtKg(s.weight_kg)} kg${ex.kind === "assist" ? " hulp" : ""}`;
  }
  if (ex.kind === "reps") return sets.map((s) => s.reps).join(" / ");
  return sets.map((s) => `${fmtKg(s.weight_kg)}×${s.reps}`).join(", ");
}

export const REP_LOW = 8;
export const REP_HIGH = 12;

export interface Suggestion {
  text: string;
  weight?: number | null;
  reps?: number | null;
  seconds?: number | null;
}

/** Progressive overload: wat probeer je vandaag? */
export function suggestNext(ex: Exercise, last: Session | undefined): Suggestion | null {
  if (!last) return null;
  const sets = last.sets;
  const topWeight = ex.kind === "assist"
    ? Math.min(...sets.map((s) => s.weight_kg ?? 0))
    : Math.max(...sets.map((s) => s.weight_kg ?? 0));
  const allHigh = sets.every((s) => (s.reps ?? 0) >= REP_HIGH);
  const anyLow = sets.some((s) => (s.reps ?? 0) < REP_LOW);
  const inc = Number(ex.increment_kg) || 2.5;
  switch (ex.kind) {
    case "weight": {
      const heavier = stepWeight(ex, topWeight, 1);
      if (allHigh && heavier > topWeight) return { text: `Zwaarder: ${fmtKg(heavier)} kg × ${REP_LOW}–${REP_HIGH}`, weight: heavier, reps: REP_LOW };
      if (allHigh) return { text: `${fmtKg(topWeight)} kg is het maximum: probeer meer herhalingen`, weight: topWeight, reps: REP_HIGH };
      if (anyLow) return { text: `Blijf op ${fmtKg(topWeight)} kg en haal ${REP_LOW}+ herhalingen`, weight: topWeight, reps: REP_LOW };
      return { text: `${fmtKg(topWeight)} kg: probeer +1 herhaling per set`, weight: topWeight, reps: Math.min(REP_HIGH, (last.best?.reps ?? REP_LOW) + 1) };
    }
    case "assist":
      if (allHigh) return { text: `Minder hulp: ${fmtKg(Math.max(0, topWeight - inc))} kg × ${REP_LOW}–${REP_HIGH}`, weight: Math.max(0, topWeight - inc), reps: REP_LOW };
      return { text: `${fmtKg(topWeight)} kg hulp: probeer +1 herhaling per set`, weight: topWeight, reps: Math.min(REP_HIGH, (last.best?.reps ?? REP_LOW) + 1) };
    case "reps":
      return { text: `Doel: ${(last.best?.reps ?? 0) + 1} herhalingen in je beste set`, reps: (last.best?.reps ?? 0) + 1 };
    case "time":
      return { text: `Doel: ${fmtDuration((last.best?.seconds ?? 0) + 10)} volhouden`, seconds: (last.best?.seconds ?? 0) + 10 };
    case "cardio": {
      const b = last.best;
      if (b?.distance_km && b.seconds) {
        const goal = Math.round((b.distance_km + 0.1) * 10) / 10;
        return { text: `Doel: ${fmtKg(goal)} km in ${fmtDuration(b.seconds)}`, seconds: b.seconds };
      }
      if (b?.level) return { text: `Doel: niveau ${b.level + 1} of langer volhouden`, seconds: b.seconds };
      return null;
    }
  }
}

export function weekKey(date: string) {
  return iso(weekStart(parseIso(date)));
}

export function trainingWeekStreak(workouts: Workout[], perWeek: number, today: string): number {
  const counts = new Map<string, number>();
  for (const w of workouts) counts.set(weekKey(w.workout_date), (counts.get(weekKey(w.workout_date)) ?? 0) + 1);
  let wk = weekKey(today);
  let n = (counts.get(wk) ?? 0) >= perWeek ? 1 : 0;
  wk = addIsoDays(wk, -7);
  while ((counts.get(wk) ?? 0) >= perWeek) {
    n++;
    wk = addIsoDays(wk, -7);
  }
  return n;
}

export const daysAgo = (date: string, today: string) => {
  const d = daysBetween(date, today);
  return d === 0 ? "vandaag" : d === 1 ? "gisteren" : `${d} dagen geleden`;
};
