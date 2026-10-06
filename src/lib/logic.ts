import { addIsoDays, daysBetween, iso, isoDow, nextBirthday, parseIso, todayIso, weekStart } from "./dates";
import { holidayLabel, holidaysOn, isBelgianSchoolFree, isPxlFreeDay, schoolBreakLabel, schoolBreaksOn } from "./holidays";
import type { Birthday, Category, Habit, HabitLog, ProjectSource, ProjectTask, ScheduleItem, Todo, WaterLog } from "./types";

// ───────────── Gewoontes ─────────────
export function logSet(logs: HabitLog[], habitId: string): Set<string> {
  return new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.log_date));
}

export function weekDates(ref: string): string[] {
  const start = weekStart(parseIso(ref));
  return Array.from({ length: 7 }, (_, i) => iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

export function weekCount(done: Set<string>, ref: string): number {
  return weekDates(ref).filter((d) => done.has(d)).length;
}

/** Aantal dagen op rij (tot en met vandaag, of gisteren als vandaag nog open staat). */
export function dailyStreak(done: Set<string>, today = todayIso()): number {
  let d = done.has(today) ? today : addIsoDays(today, -1);
  let n = 0;
  while (done.has(d)) {
    n++;
    d = addIsoDays(d, -1);
  }
  return n;
}

export function bestDailyStreak(done: Set<string>): number {
  const days = [...done].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Weken op rij waarin het weekdoel gehaald is (huidige week telt mee als hij al gehaald is). */
export function weeklyStreak(done: Set<string>, target: number, today = todayIso()): number {
  let ref = today;
  let n = 0;
  if (weekCount(done, ref) >= target) n++;
  ref = addIsoDays(weekDates(today)[0], -1);
  while (weekCount(done, ref) >= target) {
    n++;
    ref = addIsoDays(weekDates(ref)[0], -1);
  }
  return n;
}

export type WeeklyStatus = "done-today" | "goal-met" | "planned" | "backup" | "open";

export function weeklyStatus(habit: Habit, done: Set<string>, today = todayIso()): WeeklyStatus {
  if (done.has(today)) return "done-today";
  if (weekCount(done, today) >= habit.target_per_week) return "goal-met";
  const dow = isoDow(parseIso(today));
  if (habit.planned_days.includes(dow)) return "planned";
  if (habit.backup_days.includes(dow)) {
    const week = weekDates(today);
    const missed = habit.planned_days.some((p) => p < dow && !done.has(week[p - 1]));
    if (missed) return "backup";
  }
  return "open";
}

// ───────────── Water ─────────────
export function waterByDay(water: WaterLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of water) m.set(w.log_date, (m.get(w.log_date) ?? 0) + w.ml);
  return m;
}

export function waterStreak(byDay: Map<string, number>, goal: number, today = todayIso()): number {
  let d = (byDay.get(today) ?? 0) >= goal ? today : addIsoDays(today, -1);
  let n = 0;
  while ((byDay.get(d) ?? 0) >= goal) {
    n++;
    d = addIsoDays(d, -1);
  }
  return n;
}

// ───────────── Verjaardagen ─────────────
export interface UpcomingBirthday {
  birthday: Birthday;
  date: string;
  days: number;
  age: number | null;
}

export function upcomingBirthdays(list: Birthday[], today = todayIso()): UpcomingBirthday[] {
  const t = parseIso(today);
  return list
    .map((b) => {
      const next = nextBirthday(b.day, b.month, t);
      const date = iso(next);
      return { birthday: b, date, days: daysBetween(today, date), age: b.year ? next.getFullYear() - b.year : null };
    })
    .sort((a, b) => a.days - b.days);
}

// ───────────── Agenda ─────────────
export interface AgendaItem {
  key: string;
  kind: "class" | "todo" | "holiday" | "birthday" | "project";
  title: string;
  subtitle?: string | null;
  start: string | null; // HH:MM
  end: string | null;
  color: string;
  todo?: Todo;
  schedule?: ScheduleItem;
  /** projecttaak met deadline: tik opent het project */
  projectId?: string;
  done?: boolean;
}

export function agendaFor(
  date: string,
  data: {
    schedule: ScheduleItem[]; todos: Todo[]; birthdays: Birthday[]; categories: Category[];
    projects?: ProjectSource[]; projectTasks?: ProjectTask[];
  },
): AgendaItem[] {
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const color = (id: string | null) => (id && cats.get(id)?.color) || "#64748B";
  const schoolId = data.categories.find((c) => c.slug === "school")?.id;
  const stageId = data.categories.find((c) => c.slug === "stage")?.id;
  const dow = isoDow(parseIso(date));
  const noSchool = isPxlFreeDay(date);
  const noStage = isBelgianSchoolFree(date);
  // Een school-/stage-afspraak die een vast blok van dezelfde categorie overlapt vervangt dat blok (bv. een langere stagedag)
  const overrides = data.todos.filter((t) => t.is_event && t.due_date === date && t.due_time && t.category_id && (t.category_id === schoolId || t.category_id === stageId));
  const items: AgendaItem[] = [];

  for (const h of holidaysOn(date)) {
    items.push({ key: `h-${h.name}`, kind: "holiday", title: holidayLabel(h), start: null, end: null, color: "#F59E0B" });
  }
  for (const b of schoolBreaksOn(date)) {
    items.push({ key: `v-${b.region}-${b.start}`, kind: "holiday", title: schoolBreakLabel(b), start: null, end: null, color: "#2DD4BF" });
  }
  for (const b of data.birthdays) {
    const next = nextBirthday(b.day, b.month, parseIso(date));
    if (iso(next) === date) {
      const age = b.year ? next.getFullYear() - b.year : null;
      items.push({
        key: `b-${b.id}`, kind: "birthday", title: b.is_self ? "Jouw verjaardag 🎉" : `${b.name} jarig 🎂`,
        subtitle: age ? `${age} jaar` : null, start: null, end: null, color: "#EC4899",
      });
    }
  }
  for (const s of data.schedule) {
    if (s.weekday !== dow) continue;
    if (s.valid_from && date < s.valid_from) continue;
    if (s.valid_until && date > s.valid_until) continue;
    if (noSchool && s.category_id === schoolId) continue; // geen les op feestdagen en in vakanties
    if (noStage && s.category_id === stageId) continue; // stage volgt de Vlaamse vakanties
    if (overrides.some((t) => t.category_id === s.category_id && t.due_time! < s.end_time && (t.end_time ? t.end_time > s.start_time : t.due_time! >= s.start_time))) continue;
    items.push({
      key: `s-${s.id}`, kind: "class", title: s.title, subtitle: s.location, start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5), color: color(s.category_id), schedule: s,
    });
  }
  if (data.projects?.length && data.projectTasks?.length) {
    const projects = new Map(data.projects.map((p) => [p.id, p]));
    for (const t of data.projectTasks) {
      const p = t.deadline === date ? projects.get(t.project_id) : undefined;
      if (!p) continue;
      items.push({
        key: `p-${t.id}`, kind: "project", title: t.tekst, subtitle: p.naam, start: null, end: null,
        color: p.kleur, projectId: p.id, done: t.afgerond,
      });
    }
  }
  for (const t of data.todos) {
    if (t.due_date !== date) continue;
    items.push({
      key: `t-${t.id}`, kind: "todo", title: t.title, subtitle: t.location, start: t.due_time?.slice(0, 5) ?? null,
      end: t.end_time?.slice(0, 5) ?? null, color: color(t.category_id), todo: t, done: !!t.done_at,
    });
  }
  return items.sort((a, b) => {
    if (!a.start && b.start) return -1;
    if (a.start && !b.start) return 1;
    return (a.start ?? "").localeCompare(b.start ?? "");
  });
}

// ───────────── Todo-groepen ─────────────
export interface TodoGroup {
  key: string;
  title: string;
  todos: Todo[];
  tone?: "danger" | "accent";
}

export function sortTodos(a: Todo, b: Todo): number {
  const ad = a.due_date ?? "9999-99-99";
  const bd = b.due_date ?? "9999-99-99";
  if (ad !== bd) return ad.localeCompare(bd);
  const at = a.due_time ?? "99:99";
  const bt = b.due_time ?? "99:99";
  if (at !== bt) return at.localeCompare(bt);
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.created_at.localeCompare(b.created_at);
}

export function groupTodos(todos: Todo[], today = todayIso()): TodoGroup[] {
  // voorbije events (werkdienst, wedstrijd) zijn geen taken meer: alleen nog in de agenda
  const open = todos.filter((t) => !t.done_at && !(t.is_event && t.due_date && t.due_date < today)).sort(sortTodos);
  const tomorrow = addIsoDays(today, 1);
  const weekEnd = addIsoDays(today, 7);
  const groups: TodoGroup[] = [
    { key: "overdue", title: "Te laat", todos: open.filter((t) => t.due_date && t.due_date < today), tone: "danger" },
    { key: "today", title: "Vandaag", todos: open.filter((t) => t.due_date === today), tone: "accent" },
    { key: "tomorrow", title: "Morgen", todos: open.filter((t) => t.due_date === tomorrow) },
    { key: "week", title: "Komende 7 dagen", todos: open.filter((t) => t.due_date && t.due_date > tomorrow && t.due_date <= weekEnd) },
    { key: "later", title: "Later", todos: open.filter((t) => t.due_date && t.due_date > weekEnd) },
    { key: "nodate", title: "Zonder datum", todos: open.filter((t) => !t.due_date) },
    {
      key: "done", title: "Afgevinkt",
      todos: todos.filter((t) => t.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")),
    },
  ];
  return groups.filter((g) => g.todos.length);
}
