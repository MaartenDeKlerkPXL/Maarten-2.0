import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Dumbbell, Play, Settings2, Trophy } from "lucide-react";
import { useData } from "../lib/store";
import { useToday } from "../lib/hooks";
import { addIsoDays, fmt } from "../lib/dates";
import { navigate } from "../lib/router";
import {
  describeSession, describeSet, fmtDuration, fmtKg, isImprovement, lowerIsBetter, sessionsFor, trainingWeekStreak, weekKey, type Session,
} from "../lib/fitness";
import type { Exercise } from "../lib/types";
import { PushupCard } from "../components/PushupCard";
import { LineChart } from "../components/Charts";
import { Sheet } from "../components/Sheet";
import { Field, PageHeader } from "../components/ui";

const unit = (ex: Exercise) =>
  ex.kind === "weight" ? "kg (e1RM)" : ex.kind === "assist" ? "kg hulp" : ex.kind === "reps" ? "herhalingen" : ex.kind === "time" ? "sec" : "km/u";

const fmtMetric = (ex: Exercise, v: number) =>
  ex.kind === "time" ? fmtDuration(v) : ex.kind === "reps" ? String(v) : `${fmtKg(v)}${ex.kind === "cardio" ? " km/u" : " kg"}`;

function Sparkline({ values, color, invert }: { values: number[]; color: string; invert?: boolean }) {
  if (values.length < 2) return <div className="h-8" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 100;
  const h = 32;
  const pts = values.map((v, i) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return `${((i / (values.length - 1)) * w).toFixed(1)},${(4 + (invert ? t : 1 - t) * (h - 8)).toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Vooruitgang sinds de eerste training: echte kilo's bij gewicht, anders het hoofdgetal. */
function Delta({ ex, sessions }: { ex: Exercise; sessions: Session[] }) {
  if (sessions.length < 2) return null;
  const byWeight = ex.kind === "weight" || ex.kind === "assist";
  const val = (s: Session) => (byWeight ? Number(s.best?.weight_kg ?? 0) : s.metric!);
  const first = val(sessions[0]);
  const last = val(sessions[sessions.length - 1]);
  if (first === last) return <span className="text-xs text-faint">gelijk</span>;
  const good = isImprovement(ex, last, first);
  const diff = Math.abs(last - first);
  const Icon = last > first ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular ${good ? "text-success" : "text-danger"}`}>
      <Icon className="size-3.5" />
      {ex.kind === "time" ? fmtDuration(diff) : fmtKg(diff)}
      {byWeight ? " kg" : ex.kind === "cardio" ? " km/u" : ""}
    </span>
  );
}

function ExerciseSheet({ ex, sessions, onClose }: { ex: Exercise; sessions: Session[]; onClose: () => void }) {
  const best = sessions.reduce<Session | null>((b, s) => (!b || isImprovement(ex, s.metric!, b.metric!) ? s : b), null);
  return (
    <Sheet open onClose={onClose} title={ex.name} wide>
      {sessions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Nog geen data. Log een set tijdens je volgende training.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="text-[11px] uppercase tracking-wider text-faint">Record</p>
              <p className="mt-1 font-display text-base font-bold leading-tight tabular">{best ? (ex.kind === "weight" || ex.kind === "assist" ? describeSet(ex, best.best).replace(" hulp", "") : fmtMetric(ex, best.metric!)) : "–"}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="text-[11px] uppercase tracking-wider text-faint">Trainingen</p>
              <p className="mt-1 font-display text-lg font-bold tabular">{sessions.length}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="text-[11px] uppercase tracking-wider text-faint">Sinds start</p>
              <p className="mt-1 font-display text-lg font-bold"><Delta ex={ex} sessions={sessions} /></p>
            </div>
          </div>
          <p className="mb-1 text-xs text-muted">
            {unit(ex)} per training{lowerIsBetter(ex) ? " · lager is beter" : ""}
            {ex.kind === "weight" && " · e1RM = geschat maximum voor 1 herhaling"}
          </p>
          <LineChart
            invert={lowerIsBetter(ex)}
            points={sessions.map((s) => ({ label: fmt(s.date, "d/M"), value: s.metric!, tooltip: fmt(s.date, "d MMM") }))}
            format={(v) => fmtMetric(ex, v)}
          />
          <div className="mt-4 divide-y divide-line">
            {[...sessions].reverse().map((s) => (
              <button key={s.workout.id} onClick={() => navigate(`/fitness/training/${s.workout.id}`)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                <span className="text-sm text-muted">{fmt(s.date, "EEE d MMM")}</span>
                <span className="text-right text-sm font-medium tabular">{describeSession(ex, s.sets)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

function PushupSettings({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useData();
  const [f, setF] = useState({
    start: String(settings?.pushup_start_target ?? 20),
    step: String(settings?.pushup_step ?? 5),
    goal: String(settings?.pushup_goal ?? 100),
    date: settings?.pushup_start_date ?? "",
  });
  return (
    <Sheet
      open
      onClose={onClose}
      title="Pushup-schema"
      footer={
        <button
          className="btn btn-primary w-full"
          onClick={() => {
            updateSettings({
              pushup_start_target: Math.max(1, Number(f.start) || 20),
              pushup_step: Math.max(1, Number(f.step) || 5),
              pushup_goal: Math.max(10, Number(f.goal) || 100),
              pushup_start_date: f.date || settings?.pushup_start_date,
            });
            onClose();
          }}
        >
          Opslaan
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Haal je het dagdoel minstens 5 van de 7 dagen, dan gaat het de week erna omhoog. Zo bouw je rustig op zonder blessures.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Start per dag"><input inputMode="numeric" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="+ per week"><input inputMode="numeric" className="input" value={f.step} onChange={(e) => setF({ ...f, step: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Einddoel"><input inputMode="numeric" className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
        <Field label="Startdatum schema"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}

export default function Fitness() {
  const { workouts, sets, exercises, createWorkout, habits } = useData();
  const today = useToday();
  const [openEx, setOpenEx] = useState<Exercise | null>(null);
  const [pushupSettings, setPushupSettings] = useState(false);
  const [cardioId, setCardioId] = useState<string | null>(null);

  const perWeek = habits.find((h) => /sport/i.test(h.name))?.target_per_week ?? 2;
  const done = workouts.filter((w) => sets.some((s) => s.workout_id === w.id));
  const todays = workouts.find((w) => w.workout_date === today);
  const thisWeek = done.filter((w) => weekKey(w.workout_date) === weekKey(today)).length;
  const last30 = done.filter((w) => w.workout_date >= addIsoDays(today, -30)).length;
  const streak = trainingWeekStreak(done, perWeek, today);

  const sessions = useMemo(() => new Map(exercises.map((e) => [e.id, sessionsFor(e, workouts, sets)])), [exercises, workouts, sets]);
  const prs30 = useMemo(() => {
    let n = 0;
    for (const e of exercises) {
      const list = sessions.get(e.id) ?? [];
      let best: number | null = null;
      for (const s of list) {
        if (best != null && isImprovement(e, s.metric!, best) && s.date >= addIsoDays(today, -30)) n++;
        if (best == null || isImprovement(e, s.metric!, best)) best = s.metric!;
      }
    }
    return n;
  }, [exercises, sessions, today]);

  const cardio = exercises.filter((e) => e.grp === "warmup");
  const cardioWithData = cardio.filter((e) => (sessions.get(e.id)?.length ?? 0) > 0);
  const cardioEx = cardio.find((e) => e.id === cardioId) ?? cardioWithData.sort((a, b) => (sessions.get(b.id)!.length - sessions.get(a.id)!.length))[0] ?? cardio[0];
  const cardioSessions = cardioEx ? sessions.get(cardioEx.id) ?? [] : [];
  const strength = exercises.filter((e) => e.active && e.grp !== "warmup");

  const start = async () => {
    if (todays) return navigate(`/fitness/training/${todays.id}`);
    const w = await createWorkout(today);
    navigate(`/fitness/training/${w.id}`);
  };

  return (
    <div>
      <PageHeader
        title="Fitness"
        subtitle={`${last30} trainingen in de laatste 30 dagen`}
        action={
          <button onClick={start} className="btn btn-primary whitespace-nowrap">
            <Play className="size-4" fill="currentColor" /> {todays ? "Verder" : "Start training"}
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Deze week", value: `${thisWeek}/${perWeek}` },
          { label: "Weken op rij", value: `${streak}🔥` },
          { label: "Laatste 30 dagen", value: last30 },
          { label: "Records (30 d)", value: `${prs30}🏆` },
        ].map((s) => (
          <div key={s.label} className="card card-pad">
            <p className="font-display text-2xl font-bold tabular">{s.value}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-faint">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <div className="relative">
            <PushupCard withChart />
            <button onClick={() => setPushupSettings(true)} className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Pushup-schema">
              <Settings2 className="size-4" />
            </button>
          </div>

          <section className="card card-pad">
            <h2 className="section-title mb-3">Warming-up · snelheid</h2>
            <div className="mb-3 flex gap-1.5">
              {cardio.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setCardioId(e.id)}
                  className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-semibold transition ${e.id === cardioEx?.id ? "border-accent bg-accent/15 text-text" : "border-line bg-surface-2 text-muted"}`}
                >
                  {e.name}
                </button>
              ))}
            </div>
            {cardioSessions.length ? (
              <>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="font-display text-2xl font-bold tabular">
                    {fmtKg(cardioSessions[cardioSessions.length - 1].metric)} <span className="text-sm font-medium text-muted">km/u</span>
                  </p>
                  {cardioEx && <Delta ex={cardioEx} sessions={cardioSessions} />}
                </div>
                <LineChart
                  points={cardioSessions.map((s) => ({ label: fmt(s.date, "d/M"), value: s.metric!, tooltip: `${fmt(s.date, "d MMM")} · ${describeSet(cardioEx!, s.best)}` }))}
                  format={(v) => `${fmtKg(v)} km/u`}
                />
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted">Log bij je warming-up de afstand in 10 minuten; hier zie je dan of je sneller wordt.</p>
            )}
          </section>
        </div>

        <section className="lg:col-span-3">
          <h2 className="section-title mb-3 flex items-center gap-2"><Dumbbell className="size-3.5" /> Krachttraining</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {strength.map((e) => {
              const list = sessions.get(e.id) ?? [];
              const last = list[list.length - 1];
              const best = list.reduce<number | null>((b, s) => (b == null || isImprovement(e, s.metric!, b) ? s.metric! : b), null);
              const lastIsPR = last && list.length > 1 && last.metric === best;
              return (
                <button key={e.id} onClick={() => setOpenEx(e)} className="card card-pad text-left transition hover:border-line-strong">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {e.name}
                        {lastIsPR && <Trophy className="size-3.5 shrink-0 text-amber-300" />}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">{last ? describeSet(e, last.best) : "Nog niet gelogd"}</p>
                    </div>
                    <Delta ex={e} sessions={list} />
                  </div>
                  <div className="mt-2">
                    <Sparkline values={list.slice(-12).map((s) => s.metric!)} color={e.kind === "assist" ? "#A855F7" : "#3B82F6"} invert={lowerIsBetter(e)} />
                  </div>
                </button>
              );
            })}
          </div>

          <h2 className="section-title mb-3 mt-6">Recente trainingen</h2>
          <div className="card divide-y divide-line overflow-hidden">
            {done.length === 0 && <p className="p-6 text-center text-sm text-muted">Nog geen trainingen. Tik op “Start training” in de sportschool.</p>}
            {[...done].reverse().slice(0, 8).map((w) => {
              const ws = sets.filter((s) => s.workout_id === w.id);
              const exCount = new Set(ws.map((s) => s.exercise_id)).size;
              const volume = ws.reduce((n, s) => n + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
              return (
                <button key={w.id} onClick={() => navigate(`/fitness/training/${w.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium first-letter:uppercase">{fmt(w.workout_date, "EEEE d MMMM")}</p>
                    <p className="text-xs text-muted">
                      {exCount} oefeningen · {ws.length} sets{volume ? ` · ${Math.round(volume).toLocaleString("nl-NL")} kg volume` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-faint" />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {openEx && <ExerciseSheet ex={openEx} sessions={sessions.get(openEx.id) ?? []} onClose={() => setOpenEx(null)} />}
      {pushupSettings && <PushupSettings onClose={() => setPushupSettings(false)} />}
    </div>
  );
}
