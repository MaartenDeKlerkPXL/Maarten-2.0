import { useMemo } from "react";
import { Cake, GraduationCap, MapPin, PartyPopper } from "lucide-react";
import { useData } from "../lib/store";
import { agendaFor, type AgendaItem } from "../lib/logic";
import { fmt, minutesOf } from "../lib/dates";
import { useNow } from "../lib/hooks";
import type { Todo } from "../lib/types";
import { CheckCircle } from "./ui";
import { SourceBadge } from "./TodoRow";

export function useAgenda(date: string) {
  const { schedule, todos, birthdays, categories } = useData();
  return useMemo(() => agendaFor(date, { schedule, todos, birthdays, categories }), [date, schedule, todos, birthdays, categories]);
}

function AllDayChip({ item, onOpenTodo }: { item: AgendaItem; onOpenTodo?: (t: Todo) => void }) {
  const Icon = item.kind === "birthday" ? Cake : item.kind === "holiday" ? PartyPopper : null;
  return (
    <button
      onClick={() => item.todo && onOpenTodo?.(item.todo)}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium ${item.done ? "line-through opacity-50" : ""}`}
      style={{ background: `${item.color}1f`, color: item.color }}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate text-text/90">{item.title}</span>
    </button>
  );
}

/** Tijdlijn van één dag (mobiel + dashboard). */
export function DayAgenda({
  date, onOpenTodo, empty = "Niets gepland", isToday,
}: { date: string; onOpenTodo?: (t: Todo) => void; empty?: string; isToday?: boolean }) {
  const items = useAgenda(date);
  const { toggleTodo } = useData();
  const now = useNow(60_000);
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const allDay = items.filter((i) => !i.start);
  const timed = items.filter((i) => i.start);
  const nowIndex = isToday ? timed.findIndex((i) => minutesOf(i.start!) > nowMin) : -1;

  if (!items.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;

  return (
    <div>
      {allDay.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {allDay.map((i) => (
            <AllDayChip key={i.key} item={i} onOpenTodo={onOpenTodo} />
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        {timed.map((i, idx) => {
          const past = isToday && minutesOf(i.end ?? i.start!) < nowMin;
          return (
            <div key={i.key}>
              {idx === nowIndex && <NowLine />}
              <div
                role={i.todo ? "button" : undefined}
                onClick={() => i.todo && onOpenTodo?.(i.todo)}
                className={`flex items-stretch gap-3 rounded-2xl p-2 transition ${i.todo ? "cursor-pointer hover:bg-white/[0.03]" : ""} ${past || i.done ? "opacity-50" : ""}`}
              >
                <div className="w-11 shrink-0 pt-0.5 text-right tabular">
                  <div className="text-sm font-semibold">{i.start}</div>
                  {i.end && <div className="text-[11px] text-faint">{i.end}</div>}
                </div>
                <div className="w-1 shrink-0 rounded-full" style={{ background: i.color, boxShadow: `0 0 12px ${i.color}60` }} />
                <div className="min-w-0 flex-1 py-0.5">
                  <p className={`flex items-center gap-2 text-[15px] font-medium leading-snug ${i.done ? "line-through" : ""}`}>
                    {i.kind === "class" && i.schedule?.code && <GraduationCap className="size-3.5 shrink-0 text-muted" />}
                    <span className="min-w-0">{i.title}</span>
                    {i.todo && <SourceBadge source={i.todo.source} />}
                  </p>
                  {i.subtitle && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                      <MapPin className="size-3 shrink-0" />
                      {i.subtitle}
                    </p>
                  )}
                </div>
                {i.todo && !i.todo.is_event && (
                  <div className="self-center">
                    <CheckCircle checked={!!i.todo.done_at} color={i.color} onClick={() => toggleTodo(i.todo!)} size="sm" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isToday && nowIndex === -1 && timed.length > 0 && <NowLine />}
      </div>
    </div>
  );
}

function NowLine() {
  return (
    <div className="flex items-center gap-2 py-1 pl-8">
      <span className="size-2 rounded-full bg-accent shadow-[0_0_10px_#3B82F6]" />
      <span className="h-px flex-1 bg-gradient-to-r from-accent to-transparent" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-2">Nu</span>
    </div>
  );
}

// ───────────── Weekraster (desktop) ─────────────
const START_H = 7;
const END_H = 24;
const HOUR_PX = 46;

function layout(items: AgendaItem[]) {
  const timed = items
    .filter((i) => i.start)
    .map((i) => {
      const s = minutesOf(i.start!);
      const e = i.end ? Math.max(minutesOf(i.end), s + 30) : s + 60;
      return { item: i, s, e, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.s - b.s);
  const active: typeof timed = [];
  for (const t of timed) {
    for (let k = active.length - 1; k >= 0; k--) if (active[k].e <= t.s) active.splice(k, 1);
    const used = new Set(active.map((a) => a.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    t.lane = lane;
    active.push(t);
    const lanes = Math.max(...active.map((a) => a.lane)) + 1;
    for (const a of active) a.lanes = Math.max(a.lanes, lanes);
  }
  return timed;
}

function WeekColumn({ date, onOpenTodo, onCreate, isToday }: { date: string; onOpenTodo: (t: Todo) => void; onCreate: (date: string, time: string) => void; isToday: boolean }) {
  const items = useAgenda(date);
  const blocks = useMemo(() => layout(items), [items]);
  const now = useNow(60_000);
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  return (
    <div
      className={`relative border-l border-line ${isToday ? "bg-accent/[0.03]" : ""}`}
      style={{ height: (END_H - START_H) * HOUR_PX }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const y = e.nativeEvent.offsetY;
        const h = Math.floor(y / HOUR_PX) + START_H;
        onCreate(date, `${String(h).padStart(2, "0")}:00`);
      }}
    >
      {blocks.map(({ item, s, e, lane, lanes }) => {
        const top = ((s - START_H * 60) / 60) * HOUR_PX;
        const height = Math.max(22, ((e - s) / 60) * HOUR_PX - 2);
        return (
          <button
            key={item.key}
            onClick={() => item.todo && onOpenTodo(item.todo)}
            className={`absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-125 ${item.done ? "opacity-50" : ""}`}
            style={{
              top: Math.max(0, top),
              height,
              left: `calc(${(lane / lanes) * 100}% + 2px)`,
              width: `calc(${100 / lanes}% - 4px)`,
              borderColor: item.color,
              background: `color-mix(in srgb, ${item.color} 16%, var(--color-surface-2))`,
            }}
            title={`${item.start}${item.end ? `–${item.end}` : ""} ${item.title}`}
          >
            <span className={`block truncate font-semibold text-text ${item.done ? "line-through" : ""}`}>{item.title}</span>
            {height > 34 && (
              <span className="block truncate text-muted tabular">
                {item.start}
                {item.end && `–${item.end}`}
              </span>
            )}
            {height > 50 && item.subtitle && <span className="block truncate text-faint">{item.subtitle}</span>}
          </button>
        );
      })}
      {isToday && nowMin >= START_H * 60 && (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_PX }}>
          <span className="-ml-1 size-2 rounded-full bg-accent" />
          <span className="h-0.5 flex-1 bg-accent" />
        </div>
      )}
    </div>
  );
}

export function WeekGrid({
  dates, today, onOpenTodo, onCreate,
}: { dates: string[]; today: string; onOpenTodo: (t: Todo) => void; onCreate: (date: string, time: string) => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-line">
        <div />
        {dates.map((d) => (
          <div key={d} className={`border-l border-line px-2 py-2.5 ${d === today ? "text-accent-2" : ""}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{fmt(d, "EEE")}</div>
            <div className={`mt-0.5 inline-grid size-8 place-items-center rounded-full font-display text-lg font-bold ${d === today ? "bg-accent text-white" : ""}`}>
              {fmt(d, "d")}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-line">
        <div className="px-1 py-2 text-right text-[10px] font-medium uppercase text-faint">hele dag</div>
        {dates.map((d) => (
          <AllDayCell key={d} date={d} onOpenTodo={onOpenTodo} />
        ))}
      </div>
      <div className="max-h-[calc(100dvh-300px)] overflow-y-auto">
        <div className="grid grid-cols-[52px_repeat(7,1fr)]">
          <div className="relative">
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <div key={i} className="pr-2 text-right text-[10px] font-medium text-faint tabular" style={{ height: HOUR_PX }}>
                <span className="relative -top-1.5">{String(START_H + i).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>
          {dates.map((d) => (
            <div key={d} className="relative" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgb(148 163 184 / 0.07) ${HOUR_PX - 1}px, rgb(148 163 184 / 0.07) ${HOUR_PX}px)` }}>
              <WeekColumn date={d} isToday={d === today} onOpenTodo={onOpenTodo} onCreate={onCreate} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AllDayCell({ date, onOpenTodo }: { date: string; onOpenTodo: (t: Todo) => void }) {
  const items = useAgenda(date).filter((i) => !i.start);
  return (
    <div className="flex min-h-9 flex-col gap-1 border-l border-line p-1">
      {items.map((i) => (
        <button
          key={i.key}
          onClick={() => i.todo && onOpenTodo(i.todo)}
          className={`truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ${i.done ? "line-through opacity-50" : ""}`}
          style={{ background: `${i.color}22`, color: i.color }}
          title={i.title}
        >
          {i.title}
        </button>
      ))}
    </div>
  );
}
