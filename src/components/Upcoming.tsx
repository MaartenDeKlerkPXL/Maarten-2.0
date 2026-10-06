import { useMemo, type ReactNode } from "react";
import { Cake, Flag, PartyPopper, Palmtree, Trophy } from "lucide-react";
import { useData } from "../lib/store";
import { useToday } from "../lib/hooks";
import { addIsoDays, daysBetween, fmt, hm, relativeDay } from "../lib/dates";
import { upcomingBirthdays } from "../lib/logic";
import { holidayLabel, schoolBreakLabel, upcomingHolidays, upcomingSchoolBreaks } from "../lib/holidays";
import { navigate } from "../lib/router";
import type { Todo } from "../lib/types";

function inDays(n: number) {
  if (n === 0) return "vandaag";
  if (n === 1) return "morgen";
  return `over ${n} dagen`;
}

/** Banner bovenaan: verjaardagen binnen 14 dagen. */
export function BirthdayAlerts() {
  const { birthdays, settings } = useData();
  const today = useToday();
  const window = settings?.birthday_days_before ?? 14;
  const soon = upcomingBirthdays(birthdays, today).filter((b) => b.days <= window && !(b.birthday.is_self && b.days > 0));
  if (!soon.length) return null;
  return (
    <div className="space-y-2">
      {soon.map(({ birthday, date, days, age }) => (
        <button
          key={birthday.id}
          onClick={() => navigate("/meer/verjaardagen")}
          className="flex w-full items-center gap-3 rounded-2xl border border-pink-400/20 bg-gradient-to-r from-pink-500/15 via-pink-500/5 to-transparent px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-pink-500/20 text-xl">{days === 0 ? "🎉" : "🎂"}</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {birthday.is_self ? "Gefeliciteerd met je verjaardag!" : days === 0 ? `${birthday.name} is vandaag jarig!` : `${birthday.name} is ${inDays(days)} jarig`}
            </p>
            <p className="text-xs text-muted">
              {fmt(date, "EEEE d MMMM")}
              {age ? ` · wordt ${age}` : ""}
              {days > 1 && " · tijd voor een cadeau 🎁"}
            </p>
          </div>
          {days > 0 && <span className="rounded-full bg-pink-500/20 px-2.5 py-1 text-xs font-bold text-pink-200 tabular">{days}d</span>}
        </button>
      ))}
    </div>
  );
}

/** "Binnenkort": feestdagen, volgende race/wedstrijd, verjaardagen, deadlines. */
export function UpcomingCard({ onOpenTodo }: { onOpenTodo: (t: Todo) => void }) {
  const { todos, birthdays } = useData();
  const today = useToday();

  const rows = useMemo(() => {
    const out: { key: string; date: string; title: string; sub: string; icon: ReactNode; color: string; todo?: Todo }[] = [];
    const nextOf = (source: Todo["source"]) =>
      todos.filter((t) => t.source === source && !t.done_at && t.due_date && t.due_date >= today).sort((a, b) => (a.due_date! + (a.due_time ?? "")).localeCompare(b.due_date! + (b.due_time ?? "")))[0];
    const roda = nextOf("roda");
    if (roda) out.push({ key: roda.id, date: roda.due_date!, title: roda.title, sub: `${relativeDay(roda.due_date!)}${roda.due_time ? ` · ${hm(roda.due_time)}` : ""}`, icon: <Trophy className="size-4" />, color: "#FACC15", todo: roda });
    const oranje = nextOf("oranje");
    if (oranje) out.push({ key: oranje.id, date: oranje.due_date!, title: oranje.title, sub: `${relativeDay(oranje.due_date!)}${oranje.due_time ? ` · ${hm(oranje.due_time)}` : ""}`, icon: <Trophy className="size-4" />, color: "#FF7A00", todo: oranje });
    const f1 = nextOf("f1");
    if (f1) out.push({ key: f1.id, date: f1.due_date!, title: f1.title, sub: `${relativeDay(f1.due_date!)}${f1.due_time ? ` · ${hm(f1.due_time)}` : ""}`, icon: <Flag className="size-4" />, color: "#EF4444", todo: f1 });
    for (const h of upcomingHolidays(today, 45)) {
      out.push({ key: `h${h.date}${h.name}`, date: h.date, title: holidayLabel(h), sub: `${relativeDay(h.date)} · ${inDays(daysBetween(today, h.date))}`, icon: <PartyPopper className="size-4" />, color: "#F59E0B" });
    }
    for (const v of upcomingSchoolBreaks(today, 45)) {
      const range = v.start === v.end ? fmt(v.start, "EEE d MMM") : `${fmt(v.start, "d MMM")} – ${fmt(v.end, "d MMM")}`;
      const when = v.start <= today ? `nog t/m ${fmt(v.end, "d MMM")}` : inDays(daysBetween(today, v.start));
      out.push({ key: `v${v.region}${v.start}`, date: v.start < today ? today : v.start, title: schoolBreakLabel(v), sub: v.start <= today ? when : `${range} · ${when}`, icon: <Palmtree className="size-4" />, color: "#2DD4BF" });
    }
    for (const b of upcomingBirthdays(birthdays, today).filter((b) => b.days <= 60)) {
      out.push({ key: `b${b.birthday.id}`, date: b.date, title: b.birthday.is_self ? "Jouw verjaardag" : `${b.birthday.name} jarig`, sub: `${fmt(b.date, "d MMM")} · ${inDays(b.days)}`, icon: <Cake className="size-4" />, color: "#EC4899" });
    }
    const horizon = addIsoDays(today, 30);
    for (const t of todos) {
      if (t.done_at || !t.due_date || t.due_date < today || t.due_date > horizon) continue;
      if (t.source === "f1" || t.source === "roda" || t.source === "oranje") continue;
      if (t.remind_days_before?.length || (t.is_event && t.source === "recurring")) {
        out.push({ key: t.id, date: t.due_date, title: t.title, sub: `${relativeDay(t.due_date)} · ${inDays(daysBetween(today, t.due_date))}`, icon: <span className="text-sm">📌</span>, color: "#60A5FA", todo: t });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  }, [todos, birthdays, today]);

  if (!rows.length) return null;
  return (
    <div className="card card-pad">
      <h2 className="section-title mb-3">Binnenkort</h2>
      <div className="space-y-1">
        {rows.map((r) => (
          <button
            key={r.key}
            onClick={() => r.todo && onOpenTodo(r.todo)}
            className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-white/[0.03]"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `${r.color}1c`, color: r.color }}>
              {r.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="truncate text-xs text-muted">{r.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
