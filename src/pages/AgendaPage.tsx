import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useData } from "../lib/store";
import { useMediaQuery, useToday } from "../lib/hooks";
import { addIsoDays, fmt, isoDow, parseIso } from "../lib/dates";
import { agendaFor, weekDates } from "../lib/logic";
import { DayAgenda, WeekGrid } from "../components/Agenda";
import { useEditor } from "../components/EditorContext";
import { CategoryDot, PageHeader } from "../components/ui";

export default function AgendaPage() {
  const today = useToday();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [selected, setSelected] = useState(today);
  const { openTodo, newTodo } = useEditor();
  const data = useData();
  const week = weekDates(selected);

  const dots = useMemo(
    () =>
      Object.fromEntries(
        week.map((d) => [d, [...new Set(agendaFor(d, data).map((i) => i.color))].slice(0, 4)]),
      ),
    [week.join(), data.schedule, data.todos, data.birthdays, data.categories], // eslint-disable-line
  );

  const shift = (days: number) => setSelected(addIsoDays(selected, days));
  const title = `${fmt(week[0], "d MMM")} – ${fmt(week[6], "d MMM yyyy")}`;

  const nav = (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setSelected(today)} className="btn btn-ghost px-3 py-2 text-xs">
        Vandaag
      </button>
      <button onClick={() => shift(-7)} className="btn btn-ghost p-2" aria-label="Vorige week">
        <ChevronLeft className="size-4" />
      </button>
      <button onClick={() => shift(7)} className="btn btn-ghost p-2" aria-label="Volgende week">
        <ChevronRight className="size-4" />
      </button>
      <button onClick={() => newTodo({ due_date: selected, category_id: data.categories.find((c) => c.slug === "werk")?.id ?? null })} className="btn btn-primary px-3 py-2 text-xs">
        <Plus className="size-4" /> <span className="hidden sm:inline">Toevoegen</span>
      </button>
    </div>
  );

  const legend = (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
      {data.categories.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1.5 text-xs text-muted">
          <CategoryDot color={c.color} /> {c.name}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <CategoryDot color="#F59E0B" /> Feestdag
      </span>
    </div>
  );

  if (desktop) {
    return (
      <div>
        <PageHeader title="Agenda" subtitle={title} action={nav} />
        <WeekGrid dates={week} today={today} onOpenTodo={openTodo} onCreate={(date, time) => newTodo({ due_date: date, due_time: time })} />
        {legend}
      </div>
    );
  }

  const thisWeek = week.includes(today);
  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={
          <span className="flex items-center gap-2">
            {title}
            {!thisWeek && (
              <button onClick={() => setSelected(today)} className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-2">
                Vandaag
              </button>
            )}
          </span>
        }
        action={
          <div className="flex items-center gap-1.5">
            <button onClick={() => shift(-7)} className="btn btn-ghost p-2" aria-label="Vorige week"><ChevronLeft className="size-4" /></button>
            <button onClick={() => shift(7)} className="btn btn-ghost p-2" aria-label="Volgende week"><ChevronRight className="size-4" /></button>
            <button onClick={() => newTodo({ due_date: selected })} className="btn btn-primary p-2" aria-label="Toevoegen"><Plus className="size-4" /></button>
          </div>
        }
      />
      <div className="card mb-4 grid grid-cols-7 gap-1 p-2">
        {week.map((d) => {
          const active = d === selected;
          const isToday = d === today;
          return (
            <button
              key={d}
              onClick={() => setSelected(d)}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95 ${active ? "bg-accent text-white shadow-[0_8px_20px_-8px_rgb(59_130_246/0.9)]" : ""}`}
            >
              <span className={`text-[10px] font-semibold uppercase ${active ? "text-white/80" : "text-faint"}`}>{fmt(d, "EEEEEE")}</span>
              <span className={`font-display text-lg font-bold ${isToday && !active ? "text-accent-2" : ""}`}>{fmt(d, "d")}</span>
              <span className="flex h-1.5 gap-0.5">
                {(dots[d] ?? []).map((c) => (
                  <span key={c} className="size-1.5 rounded-full" style={{ background: active ? "#fff" : c }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <section className="card card-pad">
        <h2 className="mb-3 font-display text-lg font-semibold first-letter:uppercase">
          {selected === today ? "Vandaag" : fmt(selected, "EEEE d MMMM")}
          {isoDow(parseIso(selected)) >= 6 && <span className="ml-2 text-xs font-medium text-muted">weekend</span>}
        </h2>
        <DayAgenda date={selected} onOpenTodo={openTodo} isToday={selected === today} />
      </section>
      {legend}
    </div>
  );
}
