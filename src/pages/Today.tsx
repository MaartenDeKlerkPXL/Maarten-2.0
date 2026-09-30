import { useMemo } from "react";
import { ArrowRight, CalendarClock, ListTodo } from "lucide-react";
import { useData } from "../lib/store";
import { useMediaQuery, useToday } from "../lib/hooks";
import { fmt, greeting, isoDow, parseIso } from "../lib/dates";
import { groupTodos, logSet, waterByDay, weeklyStatus } from "../lib/logic";
import { navigate } from "../lib/router";
import { DailyHabitCard, WeeklyGoalCard } from "../components/HabitCards";
import { WaterCard } from "../components/WaterCard";
import { PushupCard } from "../components/PushupCard";
import { AwwwardsCard } from "../components/AwwwardsCard";
import { DayAgenda } from "../components/Agenda";
import { BirthdayAlerts, UpcomingCard } from "../components/Upcoming";
import { QuickAdd } from "../components/QuickAdd";
import { TodoRow } from "../components/TodoRow";
import { useEditor } from "../components/EditorContext";
import { Ring, SectionHeader } from "../components/ui";
import { LogoMark } from "../components/Logo";

function useDayScore(today: string) {
  const { habits, habitLogs, water, settings, todos } = useData();
  return useMemo(() => {
    let total = 0;
    let done = 0;
    for (const h of habits.filter((h) => h.active)) {
      const set = logSet(habitLogs, h.id);
      if (h.frequency === "daily") {
        total++;
        if (set.has(today)) done++;
      } else {
        const st = weeklyStatus(h, set, today);
        if (st === "planned" || st === "backup" || st === "done-today") {
          total++;
          if (st === "done-today") done++;
        }
      }
    }
    total++;
    if ((waterByDay(water).get(today) ?? 0) >= (settings?.water_goal_ml ?? 2300)) done++;
    for (const t of todos) {
      if (t.due_date === today && !t.is_event) {
        total++;
        if (t.done_at) done++;
      }
    }
    return { total, done, pct: total ? done / total : 0 };
  }, [habits, habitLogs, water, settings, todos, today]);
}

function Header({ today }: { today: string }) {
  const { settings } = useData();
  const score = useDayScore(today);
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-3 lg:hidden">
          <LogoMark className="size-9" />
        </div>
        <p className="text-sm font-medium text-muted first-letter:uppercase">{fmt(today, "EEEE d MMMM")}</p>
        <h1 className="mt-0.5 font-display text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">
          {greeting()}, <span className="bg-gradient-to-r from-accent-3 via-accent-2 to-accent bg-clip-text text-transparent">{settings?.display_name ?? "Maarten"}</span>
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted">Dagscore</p>
          <p className="text-sm font-semibold tabular">
            {score.done}/{score.total}
          </p>
        </div>
        <Ring value={score.pct} size={64} stroke={6}>
          <span className="text-sm font-bold tabular">{Math.round(score.pct * 100)}%</span>
        </Ring>
      </div>
    </header>
  );
}

function DailyHabits() {
  const { habits } = useData();
  const daily = habits.filter((h) => h.active && h.frequency === "daily");
  return (
    <section>
      <SectionHeader title="Elke dag" />
      <div className="space-y-2.5">
        {daily.map((h) => (
          <DailyHabitCard key={h.id} habit={h} />
        ))}
        <PushupCard />
      </div>
    </section>
  );
}

function WeeklyGoals({ today }: { today: string }) {
  const { habits } = useData();
  const dow = isoDow(parseIso(today));
  const weekly = habits
    .filter((h) => h.active && h.frequency === "weekly")
    .sort((a, b) => Number(b.planned_days.includes(dow)) - Number(a.planned_days.includes(dow)) || a.sort - b.sort);
  return (
    <section>
      <SectionHeader title="Weekdoelen" action={<button onClick={() => navigate("/doelen")} className="text-xs font-medium text-accent-2">Statistieken</button>} />
      <div className="space-y-2.5">
        {weekly.map((h) => (
          <WeeklyGoalCard key={h.id} habit={h} />
        ))}
      </div>
    </section>
  );
}

function TodayTodos({ today }: { today: string }) {
  const { todos } = useData();
  const { openTodo, newTodo } = useEditor();
  const groups = useMemo(() => groupTodos(todos, today), [todos, today]);
  const overdue = groups.find((g) => g.key === "overdue")?.todos ?? [];
  const todays = (groups.find((g) => g.key === "today")?.todos ?? []).filter((t) => !t.is_event);
  const doneToday = todos.filter((t) => t.done_at && t.due_date === today && !t.is_event);
  const noDate = (groups.find((g) => g.key === "nodate")?.todos ?? []).slice(0, 3);
  const list = [...overdue, ...todays, ...noDate];
  return (
    <section className="card card-pad">
      <SectionHeader
        title="Todo vandaag"
        icon={<ListTodo className="size-3.5" />}
        action={
          <button onClick={() => navigate("/todo")} className="inline-flex items-center gap-1 text-xs font-medium text-accent-2">
            Alles <ArrowRight className="size-3" />
          </button>
        }
      />
      <QuickAdd onExpand={(d) => newTodo(d)} defaultDate={today} placeholder="Snel toevoegen voor vandaag…" />
      <div className="mt-2 -mx-2">
        {list.length === 0 && doneToday.length === 0 && <p className="px-2 py-5 text-center text-sm text-muted">Niets meer te doen. Lekker bezig! ✨</p>}
        {list.map((t) => (
          <TodoRow key={t.id} todo={t} onOpen={openTodo} showDate={t.due_date !== today} />
        ))}
        {doneToday.map((t) => (
          <TodoRow key={t.id} todo={t} onOpen={openTodo} showDate={false} />
        ))}
      </div>
    </section>
  );
}

function TodayAgenda({ today }: { today: string }) {
  const { openTodo } = useEditor();
  return (
    <section className="card card-pad">
      <SectionHeader
        title="Agenda vandaag"
        icon={<CalendarClock className="size-3.5" />}
        action={
          <button onClick={() => navigate("/agenda")} className="inline-flex items-center gap-1 text-xs font-medium text-accent-2">
            Week <ArrowRight className="size-3" />
          </button>
        }
      />
      <DayAgenda date={today} onOpenTodo={openTodo} isToday empty="Geen lessen of afspraken vandaag 🌤️" />
    </section>
  );
}

export default function Today() {
  const today = useToday();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { openTodo } = useEditor();

  if (desktop) {
    return (
      <div className="space-y-6">
        <Header today={today} />
        <BirthdayAlerts />
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-4 space-y-6">
            <DailyHabits />
            <WeeklyGoals today={today} />
          </div>
          <div className="col-span-5 space-y-5">
            <TodayTodos today={today} />
            <TodayAgenda today={today} />
            <AwwwardsCard />
          </div>
          <div className="col-span-3 space-y-5">
            <WaterCard />
            <UpcomingCard onOpenTodo={openTodo} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header today={today} />
      <BirthdayAlerts />
      <DailyHabits />
      <WaterCard />
      <TodayAgenda today={today} />
      <TodayTodos today={today} />
      <WeeklyGoals today={today} />
      <UpcomingCard onOpenTodo={openTodo} />
    </div>
  );
}
