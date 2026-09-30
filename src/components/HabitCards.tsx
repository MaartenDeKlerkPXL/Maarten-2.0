import { useEffect, useMemo, useRef } from "react";
import { ExternalLink, Flame, Pause, Play, Timer } from "lucide-react";
import type { Habit } from "../lib/types";
import { useData } from "../lib/store";
import { useNow, useToday, haptic } from "../lib/hooks";
import { DOW_SHORT, parseIso, isoDow } from "../lib/dates";
import { dailyStreak, logSet, weekCount, weekDates, weeklyStatus, weeklyStreak } from "../lib/logic";
import { CheckCircle, Ring } from "./ui";
import { useToast } from "./Toast";

/** Snelknop naar de link van een gewoonte (bv. leeromgeving). */
function HabitLink({ habit }: { habit: Habit }) {
  if (!habit.url) return null;
  return (
    <a
      href={habit.url}
      target="_blank"
      rel="noopener noreferrer"
      className="grid size-10 shrink-0 place-items-center rounded-full border transition active:scale-90"
      style={{ borderColor: `${habit.color}66`, color: habit.color }}
      aria-label={`${habit.name} openen`}
      title={habit.url.replace(/^https?:\/\//, "")}
    >
      <ExternalLink className="size-4" />
    </a>
  );
}

function useDone(habitId: string) {
  const { habitLogs } = useData();
  return useMemo(() => logSet(habitLogs, habitId), [habitLogs, habitId]);
}

/** Dagelijkse gewoonte, optioneel met timer (bv. 15 min Tinder/Bumble). */
export function DailyHabitCard({ habit }: { habit: Habit }) {
  const { toggleHabit, setHabitDone, timers, startTimer, stopTimer } = useData();
  const toast = useToast();
  const today = useToday();
  const done = useDone(habit.id);
  const isDone = done.has(today);
  const streak = dailyStreak(done, today);
  const timer = timers.find((t) => t.habit_id === habit.id);
  const now = useNow(timer ? 1000 : 60_000);

  const total = (habit.timer_minutes ?? 0) * 60_000;
  const remaining = timer ? Math.max(0, Date.parse(timer.ends_at) - now) : 0;
  const running = !!timer && remaining > 0;
  const finished = !!timer && remaining <= 0;

  // Timer klaar terwijl de app open is ⇒ direct afvinken (één keer per timer)
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!finished || !timer || handled.current === timer.ends_at) return;
    handled.current = timer.ends_at;
    stopTimer(habit.id);
    if (!isDone) {
      setHabitDone(habit.id, today);
      haptic([30, 60, 30]);
      toast.show(`${habit.emoji} ${habit.name}: ${habit.timer_minutes} minuten gedaan!`);
    }
  }, [finished, timer, isDone, habit, today, stopTimer, setHabitDone, toast]);

  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);

  return (
    <div
      className={`card card-pad flex items-center gap-3.5 overflow-hidden transition ${isDone ? "border-transparent" : ""}`}
      style={isDone ? { background: `linear-gradient(135deg, ${habit.color}24, transparent 70%), var(--color-surface)`, borderColor: `${habit.color}40` } : undefined}
    >
      {running ? (
        <Ring value={1 - remaining / total} size={48} stroke={4} color={habit.color}>
          <span className="text-lg">{habit.emoji}</span>
        </Ring>
      ) : (
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${habit.color}1f` }}>
          {habit.emoji}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{habit.name}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          {running ? (
            <span className="tabular font-semibold" style={{ color: habit.color }}>
              {mm}:{String(ss).padStart(2, "0")} over
            </span>
          ) : habit.timer_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Timer className="size-3" />
              {habit.timer_minutes} min
            </span>
          ) : (
            <span>Elke dag</span>
          )}
          {streak > 0 && (
            <span className="inline-flex items-center gap-0.5 font-medium text-orange-300">
              <Flame className="size-3" fill="currentColor" />
              {streak}
            </span>
          )}
        </p>
      </div>
      <HabitLink habit={habit} />
      {habit.timer_minutes && !isDone && (
        <button
          onClick={() => {
            haptic(10);
            if (running) stopTimer(habit.id);
            else startTimer(habit);
          }}
          className="grid size-10 shrink-0 place-items-center rounded-full border transition active:scale-90"
          style={{ borderColor: `${habit.color}66`, color: habit.color, background: running ? `${habit.color}1a` : "transparent" }}
          aria-label={running ? "Timer stoppen" : "Timer starten"}
        >
          {running ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4 translate-x-px" fill="currentColor" />}
        </button>
      )}
      <CheckCircle
        size="lg"
        checked={isDone}
        color={habit.color}
        onClick={() => {
          haptic(isDone ? 8 : [10, 30, 10]);
          if (running) stopTimer(habit.id);
          toggleHabit(habit.id, today);
        }}
      />
    </div>
  );
}

const STATUS_TEXT: Record<string, string> = {
  "done-today": "Vandaag gedaan 💪",
  "goal-met": "Weekdoel gehaald 🎉",
  planned: "Gepland voor vandaag",
  backup: "Inhaaldag: vandaag!",
  open: "",
};

/** Weekdoel (bv. 2x sporten, 3x Project Management). */
export function WeeklyGoalCard({ habit }: { habit: Habit }) {
  const { toggleHabit } = useData();
  const today = useToday();
  const done = useDone(habit.id);
  const count = weekCount(done, today);
  const status = weeklyStatus(habit, done, today);
  const streak = weeklyStreak(done, habit.target_per_week, today);
  const days = weekDates(today);
  const nextPlanned = habit.planned_days.find((d) => d > isoDow(parseIso(today)) && !done.has(days[d - 1]));

  return (
    <div className="card card-pad">
      <div className="flex items-center gap-3.5">
        <Ring value={count / habit.target_per_week} size={52} stroke={5} color={habit.color}>
          <span className="text-xl">{habit.emoji}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{habit.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            <span className="tabular font-semibold text-text">{count}</span>/{habit.target_per_week} deze week
            {streak > 1 && <span className="ml-2 text-orange-300">🔥 {streak} weken</span>}
          </p>
        </div>
        <HabitLink habit={habit} />
        {(status === "done-today" || status === "goal-met") && (
          <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            {STATUS_TEXT[status]}
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const dow = i + 1;
          const isDone = done.has(d);
          const planned = habit.planned_days.includes(dow);
          const backup = habit.backup_days.includes(dow);
          const future = d > today;
          const isToday = d === today;
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => {
                haptic(10);
                toggleHabit(habit.id, d);
              }}
              className={`flex flex-col items-center gap-1 rounded-xl py-1.5 transition active:scale-90 disabled:cursor-default ${isToday ? "bg-white/[0.04]" : ""}`}
              aria-label={`${DOW_SHORT[i]} ${isDone ? "gedaan" : "niet gedaan"}`}
            >
              <span className={`text-[10px] font-semibold uppercase ${isToday ? "text-text" : "text-faint"}`}>{DOW_SHORT[i]}</span>
              <span
                className={`grid size-7 place-items-center rounded-full border-2 text-[10px] transition ${isDone ? "animate-pop" : ""}`}
                style={{
                  borderColor: isDone ? habit.color : planned ? `${habit.color}90` : backup ? `${habit.color}50` : "rgb(148 163 184 / 0.15)",
                  borderStyle: backup && !isDone ? "dashed" : "solid",
                  background: isDone ? habit.color : "transparent",
                  opacity: future && !planned && !backup ? 0.4 : 1,
                }}
              >
                {isDone && <span className="text-white">✓</span>}
              </span>
            </button>
          );
        })}
      </div>
      {status !== "done-today" && status !== "goal-met" && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {status === "planned" || status === "backup" ? STATUS_TEXT[status] : nextPlanned ? `Volgende: ${["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"][nextPlanned - 1]}` : "Nog even doorzetten"}
          </p>
          <button
            onClick={() => {
              haptic([10, 30, 10]);
              toggleHabit(habit.id, today);
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95"
            style={{ background: `${habit.color}22`, color: habit.color }}
          >
            Vandaag gedaan
          </button>
        </div>
      )}
    </div>
  );
}
