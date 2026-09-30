import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Flag, Lightbulb, Minus, Plus, Trash2, Trophy, X } from "lucide-react";
import { useData } from "../lib/store";
import { navigate } from "../lib/router";
import { fmt, todayIso } from "../lib/dates";
import { haptic } from "../lib/hooks";
import {
  DEFAULT_REPS, describeSession, fmtKg, isImprovement, metricOf, parseNum, sessionsFor, stepWeight, suggestNext, type Session,
} from "../lib/fitness";
import type { Exercise, Workout, WorkoutSet } from "../lib/types";
import { useToast } from "../components/Toast";

function useSportHabit() {
  const { habits, setHabitDone } = useData();
  const habit = habits.find((h) => /sport/i.test(h.name));
  return (date: string) => {
    if (habit) setHabitDone(habit.id, date);
  };
}

function useSaveSet(workout: Workout) {
  const { saveSet } = useData();
  const markSport = useSportHabit();
  return (set: Partial<WorkoutSet> & { exercise_id: string }) => {
    markSport(workout.workout_date);
    return saveSet({ ...set, workout_id: workout.id });
  };
}

/** Getal-invoer met − / + knoppen (groot genoeg voor zweterige vingers). */
function Stepper({
  value, onChange, step, suffix, decimals = false, width = "w-12", full = false, stepper,
}: {
  value: string; onChange: (v: string) => void; step: number; suffix?: string; decimals?: boolean; width?: string; full?: boolean;
  /** eigen stapfunctie, bv. de gewichtsreeks van een machine */
  stepper?: (current: number | null, dir: 1 | -1) => number;
}) {
  const bump = (d: number) => {
    haptic(6);
    const n = parseNum(value);
    const next = stepper ? stepper(n, d > 0 ? 1 : -1) : Math.max(0, Math.round(((n ?? 0) + d) * 100) / 100);
    onChange(String(next).replace(".", ","));
  };
  return (
    <div className={`flex items-center rounded-xl border border-line bg-surface-2 ${full ? "w-full" : ""}`}>
      <button type="button" onClick={() => bump(-step)} className="grid h-10 w-8 shrink-0 place-items-center text-muted active:scale-90" aria-label="Minder">
        <Minus className="size-3.5" />
      </button>
      <div className={`relative ${full ? "min-w-0 flex-1" : ""}`}>
        <input
          inputMode={decimals ? "decimal" : "numeric"}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(decimals ? /[^\d,.]/g : /\D/g, ""))}
          onFocus={(e) => e.target.select()}
          className={`${full ? "w-full" : width} bg-transparent py-2 text-center text-[16px] font-semibold tabular outline-none`}
        />
        {suffix && <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-medium uppercase text-faint">{suffix}</span>}
      </div>
      <button type="button" onClick={() => bump(step)} className="grid h-10 w-8 shrink-0 place-items-center text-muted active:scale-90" aria-label="Meer">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

const str = (n: number | null | undefined, dec = false) => (n == null ? "" : dec ? String(Number(n)).replace(".", ",") : String(n));

function SetRow({ ex, set, index, onSave, onDelete }: { ex: Exercise; set: WorkoutSet; index: number; onSave: (s: Partial<WorkoutSet>) => void; onDelete: () => void }) {
  const [kg, setKg] = useState(str(set.weight_kg, true));
  const [reps, setReps] = useState(str(set.reps));
  const [sec, setSec] = useState(ex.kind === "cardio" ? str(set.seconds != null ? Math.round(set.seconds / 60) : null) : str(set.seconds));
  const [lvl, setLvl] = useState(str(set.level));
  const timer = useRef<number | null>(null);

  const schedule = (patch: { kg?: string; reps?: string; sec?: string; lvl?: string }) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      onSave({
        id: set.id,
        set_no: set.set_no,
        weight_kg: parseNum(patch.kg ?? kg),
        reps: parseNum(patch.reps ?? reps),
        seconds: ex.kind === "cardio" ? Math.round((parseNum(patch.sec ?? sec) ?? 0) * 60) || null : parseNum(patch.sec ?? sec),
        level: parseNum(patch.lvl ?? lvl),
      });
    }, 450);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const inc = Number(ex.increment_kg) || 2.5;
  return (
    <div className="flex items-center gap-1.5 py-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold tabular text-muted">{index + 1}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {(ex.kind === "weight" || ex.kind === "assist") && (
          <Stepper
            value={kg} step={inc} decimals suffix={ex.kind === "assist" ? "kg hulp" : "kg"}
            stepper={ex.weight_steps?.length ? (cur, dir) => stepWeight(ex, cur, dir) : undefined}
            onChange={(v) => { setKg(v); schedule({ kg: v }); }}
          />
        )}
        {(ex.kind === "weight" || ex.kind === "assist" || ex.kind === "reps") && (
          <Stepper value={reps} step={1} suffix="reps" width="w-9" onChange={(v) => { setReps(v); schedule({ reps: v }); }} />
        )}
        {ex.kind === "time" && <Stepper value={sec} step={10} suffix="sec" onChange={(v) => { setSec(v); schedule({ sec: v }); }} />}
        {ex.kind === "cardio" && (
          <>
            <Stepper value={sec} step={1} suffix="min" width="w-9" onChange={(v) => { setSec(v); schedule({ sec: v }); }} />
            <Stepper value={lvl} step={1} suffix="niveau" width="w-9" onChange={(v) => { setLvl(v); schedule({ lvl: v }); }} />
          </>
        )}
      </div>
      <button onClick={onDelete} className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-danger" aria-label="Set verwijderen">
        <X className="size-4" />
      </button>
    </div>
  );
}

function ExerciseBlock({ ex, workout, history }: { ex: Exercise; workout: Workout; history: Session[] }) {
  const { sets, deleteSet } = useData();
  const save = useSaveSet(workout);
  const today = useMemo(() => sets.filter((s) => s.workout_id === workout.id && s.exercise_id === ex.id).sort((a, b) => a.set_no - b.set_no), [sets, workout.id, ex.id]);
  const [open, setOpen] = useState(false);
  const last = history[history.length - 1];
  const suggestion = suggestNext(ex, last);
  const best = history.reduce<number | null>((b, s) => (s.metric == null ? b : b == null ? s.metric : isImprovement(ex, s.metric, b) ? s.metric : b), null);
  const current = metricOf(ex, today).metric;
  const isPR = current != null && best != null && isImprovement(ex, current, best);

  const addSet = () => {
    haptic(10);
    const prev = today[today.length - 1];
    const tmpl = prev ?? last?.sets[0];
    save({
      exercise_id: ex.id,
      set_no: (prev?.set_no ?? 0) + 1,
      weight_kg: prev?.weight_kg ?? suggestion?.weight ?? tmpl?.weight_kg ?? ex.weight_steps?.[0] ?? null,
      reps: ex.kind === "weight" || ex.kind === "assist" || ex.kind === "reps" ? DEFAULT_REPS : null,
      seconds: prev?.seconds ?? suggestion?.seconds ?? tmpl?.seconds ?? null,
      level: prev?.level ?? tmpl?.level ?? null,
    });
    setOpen(true);
  };

  return (
    <div className={`card overflow-hidden transition ${today.length ? "border-accent/30" : ""}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <div className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold tabular ${today.length ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>
          {today.length || "–"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            {ex.name}
            {isPR && <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300"><Trophy className="size-3" /> PR</span>}
          </p>
          <p className="truncate text-xs text-muted">{last ? `Vorige: ${describeSession(ex, last.sets)}` : "Nog geen eerdere training"}</p>
        </div>
        <ChevronDown className={`size-4 text-faint transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-2">
          {suggestion && (
            <p className="mb-2 flex items-start gap-2 rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent-3">
              <Lightbulb className="mt-px size-3.5 shrink-0" />
              {suggestion.text}
            </p>
          )}
          {today.map((s, i) => (
            <SetRow key={s.id} ex={ex} set={s} index={i} onSave={(p) => save({ ...s, ...p, exercise_id: ex.id })} onDelete={() => deleteSet(s.id)} />
          ))}
          <button onClick={addSet} className="btn btn-ghost mt-2 w-full">
            <Plus className="size-4" /> Set toevoegen
          </button>
        </div>
      )}
      {!open && today.length === 0 && (
        <div className="px-4 pb-3">
          <button onClick={addSet} className="text-xs font-semibold text-accent-2">+ Eerste set</button>
        </div>
      )}
    </div>
  );
}

/** Warming-up: 10 min fietsen / loopband / hardlopen, en zien of je sneller wordt. */
function WarmupBlock({ workout, options }: { workout: Workout; options: Exercise[] }) {
  const { sets, workouts, deleteSet } = useData();
  const save = useSaveSet(workout);
  const existing = sets.find((s) => s.workout_id === workout.id && options.some((o) => o.id === s.exercise_id));
  const lastUsed = useMemo(() => {
    const prev = [...sets].reverse().find((s) => s.workout_id !== workout.id && options.some((o) => o.id === s.exercise_id));
    return prev?.exercise_id;
  }, [sets, workout.id, options]);
  const [typeId, setTypeId] = useState(existing?.exercise_id ?? lastUsed ?? options[0]?.id);
  const ex = options.find((o) => o.id === typeId) ?? options[0];
  const history = useMemo(() => (ex ? sessionsFor(ex, workouts.filter((w) => w.id !== workout.id), sets) : []), [ex, workouts, workout.id, sets]);
  const last = history[history.length - 1];

  const [min, setMin] = useState(existing?.seconds ? String(Math.round(existing.seconds / 60)) : "10");
  const [km, setKm] = useState(str(existing?.distance_km, true));
  const [lvl, setLvl] = useState(str(existing?.level));
  const timer = useRef<number | null>(null);
  const setId = useRef(existing?.id ?? crypto.randomUUID());

  const persist = (p: { min?: string; km?: string; lvl?: string; type?: string }) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const kmN = parseNum(p.km ?? km);
      const lvlN = parseNum(p.lvl ?? lvl);
      if (!kmN && !lvlN) return;
      save({ id: setId.current, exercise_id: p.type ?? typeId!, set_no: 1, seconds: Math.round((parseNum(p.min ?? min) ?? 10) * 60), distance_km: kmN, level: lvlN });
    }, 450);
  };

  if (!ex) return null;
  const minutes = parseNum(min) ?? 10;
  const kmN = parseNum(km);
  const speed = kmN && minutes ? Math.round((kmN / (minutes / 60)) * 10) / 10 : null;
  const lastSpeed = last?.metric ?? null;
  const better = speed != null && lastSpeed != null && speed > lastSpeed;

  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Warming-up</h2>
        {existing && (
          <button
            onClick={() => {
              deleteSet(existing.id);
              setKm("");
              setLvl("");
              setId.current = crypto.randomUUID();
            }}
            className="text-xs text-faint hover:text-danger"
          >
            Wissen
          </button>
        )}
      </div>
      <div className="mb-3 flex gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              setTypeId(o.id);
              persist({ type: o.id });
            }}
            className={`flex-1 rounded-xl border px-2 py-2 text-sm font-semibold transition ${o.id === typeId ? "border-accent bg-accent/15 text-text" : "border-line bg-surface-2 text-muted"}`}
          >
            {o.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Stepper full value={min} step={1} suffix="min" onChange={(v) => { setMin(v); persist({ min: v }); }} />
        <Stepper full value={km} step={0.1} decimals suffix="km" onChange={(v) => { setKm(v); persist({ km: v }); }} />
        <Stepper full value={lvl} step={1} suffix="niveau" onChange={(v) => { setLvl(v); persist({ lvl: v }); }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {speed != null && (
          <span className={`font-semibold tabular ${better ? "text-success" : "text-text"}`}>
            {fmtKg(speed)} km/u {better && "↑ sneller dan vorige keer"}
          </span>
        )}
        {last && (
          <span className="text-muted">
            Vorige ({fmt(last.date, "d MMM")}): {describeSession(ex, last.sets)}
            {lastSpeed ? ` · ${fmtKg(lastSpeed)} km/u` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export default function WorkoutPage({ id }: { id: string }) {
  const { workouts, exercises, sets, updateWorkout, deleteWorkout } = useData();
  const toast = useToast();
  const workout = workouts.find((w) => w.id === id);
  const others = useMemo(() => workouts.filter((w) => w.id !== id), [workouts, id]);
  const active = exercises.filter((e) => e.active);
  const warmups = active.filter((e) => e.grp === "warmup");
  const strength = active.filter((e) => e.grp === "kracht");
  const core = active.filter((e) => e.grp === "core");
  const histories = useMemo(() => new Map(active.map((e) => [e.id, sessionsFor(e, others, sets)])), [active, others, sets]);

  if (!workout) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">Training niet gevonden.</p>
        <button onClick={() => navigate("/fitness")} className="btn btn-ghost mt-4">Terug naar Fitness</button>
      </div>
    );
  }
  const count = sets.filter((s) => s.workout_id === workout.id).length;
  const isToday = workout.workout_date === todayIso();

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate("/fitness")} className="-ml-1 mb-2 inline-flex items-center gap-0.5 text-sm font-medium text-accent-2">
        <ChevronLeft className="size-4" /> Fitness
      </button>
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">Training</h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">
            {isToday ? "vandaag" : fmt(workout.workout_date, "EEEE d MMMM")} · {count} {count === 1 ? "set" : "sets"}
          </p>
        </div>
        <button
          onClick={() => {
            if (count === 0 || confirm("Deze training verwijderen?")) {
              deleteWorkout(workout.id);
              navigate("/fitness");
            }
          }}
          className="btn btn-ghost p-2.5 text-muted"
          aria-label="Training verwijderen"
        >
          <Trash2 className="size-4" />
        </button>
      </header>

      <div className="space-y-3">
        {warmups.length > 0 && <WarmupBlock workout={workout} options={warmups} />}
        <h2 className="section-title pt-3">Krachttraining</h2>
        {strength.map((e) => (
          <ExerciseBlock key={e.id} ex={e} workout={workout} history={histories.get(e.id) ?? []} />
        ))}
        {core.length > 0 && <h2 className="section-title pt-3">Core & conditie</h2>}
        {core.map((e) => (
          <ExerciseBlock key={e.id} ex={e} workout={workout} history={histories.get(e.id) ?? []} />
        ))}
      </div>

      <button
        onClick={() => {
          updateWorkout(workout.id, { finished_at: new Date().toISOString() });
          haptic([20, 40, 60]);
          toast.show("Training opgeslagen 💪");
          navigate("/fitness");
        }}
        className="btn btn-primary mt-6 w-full py-3.5 text-[15px]"
      >
        <Flag className="size-4" /> Training afronden
      </button>
      <p className="mt-3 text-center text-xs text-faint">
        Alles wordt direct opgeslagen. Bij Chin assist telt minder hulpgewicht als vooruitgang.
      </p>
    </div>
  );
}
