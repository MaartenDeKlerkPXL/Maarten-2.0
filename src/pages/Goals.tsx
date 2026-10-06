import { useMemo, useState } from "react";
import { Droplets, Pencil, Plus, Trash2 } from "lucide-react";
import { useData } from "../lib/store";
import { useToday } from "../lib/hooks";
import { addIsoDays, fmt, weekStart, iso, parseIso } from "../lib/dates";
import { bestDailyStreak, dailyStreak, logSet, waterByDay, waterStreak, weekCount, weeklyStreak } from "../lib/logic";
import type { Habit } from "../lib/types";
import { Field, PageHeader, Segmented, Toggle, WeekdayPicker } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { CountdownEditor, SinceCard } from "../components/Countdowns";
import type { Countdown } from "../lib/types";

const WEEKS = 16;

function Heatmap({ isOn, color, today }: { isOn: (d: string) => boolean; color: string; today: string }) {
  const start = iso(weekStart(parseIso(addIsoDays(today, -(WEEKS - 1) * 7))));
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addIsoDays(start, w * 7 + d)));
  return (
    <div className="flex gap-[3px] overflow-hidden">
      {weeks.map((days, i) => (
        <div key={i} className="flex flex-1 flex-col gap-[3px]">
          {days.map((d) => (
            <div
              key={d}
              title={fmt(d, "EEE d MMM")}
              className="aspect-square w-full rounded-[4px]"
              style={{
                background: d > today ? "transparent" : isOn(d) ? color : "rgb(148 163 184 / 0.08)",
                boxShadow: d === today ? `0 0 0 1.5px ${color}` : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold tabular">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}

function HabitStats({ habit, onEdit }: { habit: Habit; onEdit: () => void }) {
  const { habitLogs } = useData();
  const today = useToday();
  const done = useMemo(() => logSet(habitLogs, habit.id), [habitLogs, habit.id]);
  const last30 = Array.from({ length: 30 }, (_, i) => addIsoDays(today, -i)).filter((d) => done.has(d)).length;
  return (
    <div className="card card-pad">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl text-2xl" style={{ background: `${habit.color}1f` }}>
          {habit.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{habit.name}</p>
          <p className="text-xs text-muted">
            {habit.frequency === "daily" ? "Elke dag" : `${habit.target_per_week}x per week`}
            {habit.timer_minutes ? ` · ${habit.timer_minutes} min timer` : ""}
            {!habit.active && " · gepauzeerd"}
          </p>
        </div>
        <button onClick={onEdit} className="rounded-full p-2 text-muted transition hover:bg-surface-2 hover:text-text" aria-label="Bewerken">
          <Pencil className="size-4" />
        </button>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {habit.frequency === "daily" ? (
          <>
            <Stat label="Streak" value={`${dailyStreak(done, today)}🔥`} />
            <Stat label="Record" value={bestDailyStreak(done)} />
            <Stat label="30 dagen" value={`${Math.round((last30 / 30) * 100)}%`} />
          </>
        ) : (
          <>
            <Stat label="Deze week" value={`${weekCount(done, today)}/${habit.target_per_week}`} />
            <Stat label="Weken op rij" value={`${weeklyStreak(done, habit.target_per_week, today)}🔥`} />
            <Stat label="30 dagen" value={`${last30}x`} />
          </>
        )}
      </div>
      <Heatmap isOn={(d) => done.has(d)} color={habit.color} today={today} />
    </div>
  );
}

function WaterStats() {
  const { water, settings } = useData();
  const today = useToday();
  const goal = settings?.water_goal_ml ?? 2300;
  const byDay = useMemo(() => waterByDay(water), [water]);
  const last30 = Array.from({ length: 30 }, (_, i) => addIsoDays(today, -i));
  const hit = last30.filter((d) => (byDay.get(d) ?? 0) >= goal).length;
  const tracked = last30.filter((d) => byDay.has(d));
  const avg = tracked.length ? Math.round(tracked.reduce((n, d) => n + (byDay.get(d) ?? 0), 0) / tracked.length) : 0;
  return (
    <div className="card card-pad">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-sky-400/15 text-sky-300">
          <Droplets className="size-5" />
        </div>
        <div>
          <p className="font-semibold">Waterpeil</p>
          <p className="text-xs text-muted">Doel {goal} ml per dag</p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Streak" value={`${waterStreak(byDay, goal, today)}🔥`} />
        <Stat label="Gehaald (30d)" value={`${hit}x`} />
        <Stat label="Gemiddeld" value={`${(avg / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} L`} />
      </div>
      <Heatmap isOn={(d) => (byDay.get(d) ?? 0) >= goal} color="#38BDF8" today={today} />
    </div>
  );
}

const COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#EC4899", "#14B8A6", "#F97316", "#FF4458", "#FFC629"];

function HabitEditor({ habit, onClose }: { habit: Partial<Habit>; onClose: () => void }) {
  const { saveHabit, deleteHabit, habits } = useData();
  const [f, setF] = useState<Partial<Habit>>({
    emoji: "✅", color: "#3B82F6", frequency: "daily", target_per_week: 7, planned_days: [], backup_days: [], timer_minutes: null, url: null, active: true, ...habit,
  });
  const set = (p: Partial<Habit>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.name?.trim()) return;
    await saveHabit({
      ...f,
      name: f.name.trim(),
      url: f.url?.trim() ? (/^https?:\/\//i.test(f.url.trim()) ? f.url.trim() : `https://${f.url.trim()}`) : null,
      target_per_week: f.frequency === "daily" ? 7 : f.target_per_week ?? 1,
      sort: f.sort ?? habits.length + 1,
    } as Habit);
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={habit.id ? "Gewoonte bewerken" : "Nieuwe gewoonte"}
      footer={
        <div className="flex gap-2">
          {habit.id && (
            <button className="btn btn-danger px-3" onClick={() => { if (confirm("Gewoonte en alle geschiedenis verwijderen?")) { deleteHabit(habit.id!); onClose(); } }} aria-label="Verwijderen">
              <Trash2 className="size-4" />
            </button>
          )}
          <button className="btn btn-primary ml-auto min-w-28" onClick={save}>Opslaan</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input className="input w-16 text-center text-xl" value={f.emoji} onChange={(e) => set({ emoji: e.target.value })} aria-label="Emoji" />
          <input className="input flex-1" placeholder="Naam" value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <Field group label="Kleur">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => set({ color: c })} className={`size-8 rounded-full transition ${f.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-surface" : ""}`} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </Field>
        <Field group label="Hoe vaak">
          <Segmented options={[{ value: "daily", label: "Elke dag" }, { value: "weekly", label: "Per week" }]} value={f.frequency ?? "daily"} onChange={(v) => set({ frequency: v })} />
        </Field>
        {f.frequency === "weekly" && (
          <>
            <Field label={`Doel: ${f.target_per_week}x per week`}>
              <input type="range" min={1} max={7} value={f.target_per_week} onChange={(e) => set({ target_per_week: Number(e.target.value) })} className="w-full accent-[#3B82F6]" />
            </Field>
            <Field group label="Geplande dagen">
              <WeekdayPicker value={f.planned_days ?? []} onChange={(v) => set({ planned_days: v })} color={f.color} />
            </Field>
            <Field group label="Inhaaldagen" hint="Als een geplande dag gemist is, krijg je hier een herinnering.">
              <WeekdayPicker value={f.backup_days ?? []} onChange={(v) => set({ backup_days: v })} color={f.color} />
            </Field>
          </>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Timer</p>
            <p className="text-xs text-muted">Start een timer en vink automatisch af</p>
          </div>
          <Toggle checked={!!f.timer_minutes} onChange={(v) => set({ timer_minutes: v ? 15 : null })} />
        </div>
        {!!f.timer_minutes && (
          <Field label="Minuten">
            <input type="number" min={1} max={240} className="input" value={f.timer_minutes} onChange={(e) => set({ timer_minutes: Math.max(1, Number(e.target.value)) })} />
          </Field>
        )}
        <Field label="Link" hint="Snelknop op de kaart, bv. naar je leeromgeving.">
          <input type="url" inputMode="url" className="input" placeholder="https://…" value={f.url ?? ""} onChange={(e) => set({ url: e.target.value })} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Actief</p>
          <Toggle checked={!!f.active} onChange={(v) => set({ active: v })} />
        </div>
      </div>
    </Sheet>
  );
}

export default function Goals() {
  const { habits, countdowns } = useData();
  const [editing, setEditing] = useState<Partial<Habit> | null>(null);
  const [counter, setCounter] = useState<Partial<Countdown> | null>(null);
  const since = countdowns.filter((c) => c.soort === "sinds").sort((a, b) => a.datum.localeCompare(b.datum));
  return (
    <div>
      <PageHeader
        title="Doelen"
        subtitle="Je voortgang van de afgelopen 16 weken"
        action={
          <div className="flex gap-1.5">
            <button onClick={() => setCounter({ soort: "sinds" })} className="btn btn-ghost px-3 py-2 text-xs">
              <Plus className="size-4" /> Teller
            </button>
            <button onClick={() => setEditing({})} className="btn btn-primary px-3 py-2 text-xs">
              <Plus className="size-4" /> Gewoonte
            </button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {since.map((c) => (
          <SinceCard key={c.id} item={c} onEdit={() => setCounter(c)} />
        ))}
        {habits.map((h) => (
          <HabitStats key={h.id} habit={h} onEdit={() => setEditing(h)} />
        ))}
        <WaterStats />
      </div>
      {editing && <HabitEditor habit={editing} onClose={() => setEditing(null)} />}
      {counter && <CountdownEditor value={counter} onClose={() => setCounter(null)} />}
    </div>
  );
}
