import { useState, type ReactNode } from "react";
import { Hourglass, Palmtree, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { useData } from "../lib/store";
import { useToday } from "../lib/hooks";
import { fmt } from "../lib/dates";
import { daysUntil, isNicotineQuit, milestoneProgress, nextBelgianBreak, QUIT_MILESTONES, sinceBreakdown } from "../lib/countdown";
import { schoolBreakLabel } from "../lib/holidays";
import type { Countdown } from "../lib/types";
import { Sheet } from "./Sheet";
import { Field, SectionHeader, Segmented } from "./ui";

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

export function CountdownEditor({ value, onClose }: { value: Partial<Countdown>; onClose: () => void }) {
  const { saveCountdown, deleteCountdown } = useData();
  const today = useToday();
  const [f, setF] = useState<Partial<Countdown>>({ emoji: value.soort === "sinds" ? "🏆" : "📅", soort: "tot", datum: today, ...value });
  const set = (p: Partial<Countdown>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.titel?.trim() || !f.datum) return;
    await saveCountdown({ ...f, titel: f.titel.trim(), emoji: f.emoji?.trim() || "📅" } as Countdown);
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={value.id ? "Bewerken" : f.soort === "sinds" ? "Nieuwe teller" : "Nieuw aftelmoment"}
      footer={
        <div className="flex gap-2">
          {value.id && (
            <button className="btn btn-danger px-3" onClick={() => { deleteCountdown(value.id!); onClose(); }} aria-label="Verwijderen">
              <Trash2 className="size-4" />
            </button>
          )}
          <button className="btn btn-primary ml-auto min-w-28" onClick={save}>Opslaan</button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field group label="Soort">
          <Segmented options={[{ value: "tot", label: "Aftellen tot" }, { value: "sinds", label: "Optellen sinds" }]} value={f.soort ?? "tot"} onChange={(soort) => set({ soort })} />
        </Field>
        <div className="flex gap-2">
          <input className="input w-16 text-center text-xl" value={f.emoji ?? ""} onChange={(e) => set({ emoji: e.target.value })} aria-label="Emoji" />
          <input
            className="input flex-1" autoFocus={!value.id} value={f.titel ?? ""} onChange={(e) => set({ titel: e.target.value })}
            placeholder={f.soort === "sinds" ? "Bijv. Gestopt met snoepen" : "Bijv. Vakantie"} aria-label="Titel"
          />
        </div>
        <Field label={f.soort === "sinds" ? "Sinds" : "Datum"}>
          <input type="date" className="input" value={f.datum ?? ""} onChange={(e) => set({ datum: e.target.value })} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

function Tile({ emoji, title, date, days, color, onClick }: { emoji: ReactNode; title: string; date: string; days: number; color: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="card flex min-w-0 flex-col gap-3 p-4 text-left transition hover:border-line-strong"
      style={{ background: `radial-gradient(120% 100% at 100% 0%, ${color}22, transparent 60%), var(--color-surface)` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl text-xl" style={{ background: `${color}1f`, color }}>{emoji}</span>
        <div className="text-right">
          {days === 0 ? (
            <p className="font-display text-2xl font-bold" style={{ color }}>Vandaag!</p>
          ) : (
            <>
              <p className="font-display text-3xl font-bold leading-none tabular">{days}</p>
              <p className="mt-0.5 text-[11px] font-medium text-muted">{days === 1 ? "dag" : "dagen"}</p>
            </>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        <p className="mt-0.5 text-xs text-muted" title={fmt(date, "EEEE d MMMM yyyy")}>
          {fmt(date, "EEE d MMM yyyy")}
          {days >= 14 && ` · ${n(Math.floor(days / 7), "week", "weken")}`}
        </p>
      </div>
    </Comp>
  );
}

const TILE_COLORS = ["#60A5FA", "#F472B6", "#34D399", "#FBBF24", "#A78BFA", "#22D3EE"];

/** Voorpagina: over zoveel dagen gebeurt er dit of dat (+ de eerstvolgende Vlaamse schoolvakantie). */
export function CountdownStrip() {
  const { countdowns } = useData();
  const today = useToday();
  const [editing, setEditing] = useState<Partial<Countdown> | null>(null);
  const items = countdowns
    .filter((c) => c.soort === "tot" && daysUntil(c.datum, today) >= 0)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const vakantie = nextBelgianBreak(today);
  const inVakantie = vakantie && vakantie.start <= today;

  return (
    <section>
      <SectionHeader
        title="Aftellen"
        icon={<Hourglass className="size-3.5" />}
        action={
          <button onClick={() => setEditing({ soort: "tot" })} className="inline-flex items-center gap-1 text-xs font-medium text-accent-2">
            <Plus className="size-3.5" /> Toevoegen
          </button>
        }
      />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c, i) => (
          <Tile key={c.id} emoji={c.emoji} title={c.titel} date={c.datum} days={daysUntil(c.datum, today)} color={TILE_COLORS[i % TILE_COLORS.length]} onClick={() => setEditing(c)} />
        ))}
        {vakantie && (
          inVakantie ? (
            <div className="card flex flex-col justify-between gap-3 p-4" style={{ background: "radial-gradient(120% 100% at 100% 0%, #2DD4BF22, transparent 60%), var(--color-surface)" }}>
              <span className="grid size-10 place-items-center rounded-2xl bg-[#2DD4BF1f] text-[#2DD4BF]"><Palmtree className="size-5" /></span>
              <div>
                <p className="text-sm font-semibold">{schoolBreakLabel(vakantie)} 🎉</p>
                <p className="mt-0.5 text-xs text-muted">Nog t/m {fmt(vakantie.end, "EEEE d MMMM")}</p>
              </div>
            </div>
          ) : (
            <Tile emoji={<Palmtree className="size-5" />} title={schoolBreakLabel(vakantie)} date={vakantie.start} days={daysUntil(vakantie.start, today)} color="#2DD4BF" />
          )
        )}
      </div>
      {editing && <CountdownEditor value={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2/80 px-3 py-2.5 text-center">
      <p className="font-display text-2xl font-bold leading-none tabular">{value.toLocaleString("nl-NL")}</p>
      <p className="mt-1 text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}

/** Doelen: optellende teller (sinds een datum) met mijlpalen. */
export function SinceCard({ item, onEdit }: { item: Countdown; onEdit: () => void }) {
  const today = useToday();
  const b = sinceBreakdown(item.datum, today);
  const { reached, next, pct } = milestoneProgress(b.days);
  const p = b.parts;
  const parts = [p.years && n(p.years, "jaar", "jaar"), p.months && n(p.months, "maand", "maanden"), p.weeks && n(p.weeks, "week", "weken"), n(p.days, "dag", "dagen")].filter(Boolean);
  const color = "#34D399";
  const health = isNicotineQuit(item.titel);
  return (
    <section
      className="card card-pad md:col-span-2 xl:col-span-3"
      style={{ background: `radial-gradient(80% 120% at 0% 0%, ${color}1f, transparent 55%), var(--color-surface)`, borderColor: `${color}33` }}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${color}1f` }}>{item.emoji}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-tight">{item.titel}</h2>
          <p className="text-xs text-muted first-letter:uppercase">sinds {fmt(item.datum, "EEEE d MMMM yyyy")}</p>
        </div>
        <button onClick={onEdit} className="rounded-lg p-2 text-faint transition hover:bg-white/[0.05] hover:text-text" aria-label={`${item.titel} bewerken`}>
          <Pencil className="size-4" />
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="lg:w-56">
          <p className="font-display text-6xl font-bold leading-none tabular" style={{ color }}>{b.days.toLocaleString("nl-NL")}</p>
          <p className="mt-1 text-sm font-medium text-muted">{b.days === 1 ? "dag" : "dagen"} volgehouden 💪</p>
          <p className="mt-2 text-xs text-faint">{parts.join(" · ")}</p>
        </div>
        <div className="grid flex-1 grid-cols-4 gap-2">
          <Stat value={b.days} label={b.days === 1 ? "dag" : "dagen"} />
          <Stat value={b.weeks} label="weken" />
          <Stat value={b.months} label={b.months === 1 ? "maand" : "maanden"} />
          <Stat value={b.years} label="jaar" />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface-2/50 p-3.5">
        {next ? (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold">Volgende mijlpaal: {next.label}</span>
              <span className="tabular text-muted">nog {n(next.days - b.days, "dag", "dagen")}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Naar volgende mijlpaal" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct * 100}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
            </div>
            {health && <p className="mt-2 text-xs text-muted">{next.benefit}</p>}
          </>
        ) : (
          <p className="text-sm font-semibold">Alle mijlpalen gehaald. Legendarisch! 🏆</p>
        )}
        {reached && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUIT_MILESTONES.filter((m) => b.days >= m.days).map((m) => (
              <span key={m.days} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${color}1a`, color }} title={health ? m.benefit : undefined}>
                <Trophy className="size-3" /> {m.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
