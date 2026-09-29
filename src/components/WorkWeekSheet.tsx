import { useEffect, useMemo, useState } from "react";
import { Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "../lib/store";
import { useToday } from "../lib/hooks";
import { addIsoDays, fmt, hm } from "../lib/dates";
import { weekDates } from "../lib/logic";
import type { Todo } from "../lib/types";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

interface Row {
  on: boolean;
  start: string;
  end: string;
}

const DEFAULT_PRESETS = ["17:00-21:30", "09:00-17:00", "09:00-18:00"];

/** Wisselende werkdiensten in één keer voor een hele week invullen. */
export function WorkWeekSheet({ onClose }: { onClose: () => void }) {
  const { todos, categories, addTodo, updateTodo, removeTodo } = useData();
  const toast = useToast();
  const today = useToday();
  const werk = categories.find((c) => c.slug === "werk");
  const [offset, setOffset] = useState(0);
  const days = weekDates(addIsoDays(today, offset * 7));

  const isShift = (t: Todo) => t.category_id === werk?.id && t.source === "user" && t.title === "Werk" && !!t.due_time && !!t.due_date;
  const existing = useMemo(() => {
    const m = new Map<string, Todo>();
    for (const t of todos) if (isShift(t) && days.includes(t.due_date!)) m.set(t.due_date!, t);
    return m;
  }, [todos, days.join()]); // eslint-disable-line

  const presets = useMemo(() => {
    const count = new Map<string, number>();
    for (const t of todos) if (isShift(t) && t.end_time) {
      const k = `${hm(t.due_time)}-${hm(t.end_time)}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    const fromData = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return [...new Set([...fromData, ...DEFAULT_PRESETS])].slice(0, 4);
  }, [todos]); // eslint-disable-line

  const [preset, setPreset] = useState(presets[0]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  useEffect(() => {
    const [s, e] = preset.split("-");
    setRows(Object.fromEntries(days.map((d) => {
      const t = existing.get(d);
      return [d, t ? { on: true, start: hm(t.due_time), end: hm(t.end_time) || e } : { on: false, start: s, end: e }];
    })));
  }, [offset, existing]); // eslint-disable-line

  const setRow = (d: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [d]: { ...r[d], ...patch } }));

  const save = async () => {
    let n = 0;
    for (const d of days) {
      const r = rows[d];
      const t = existing.get(d);
      if (!r) continue;
      if (r.on && t) {
        if (hm(t.due_time) !== r.start || hm(t.end_time) !== r.end) await updateTodo(t.id, { due_time: r.start, end_time: r.end });
        n++;
      } else if (r.on) {
        await addTodo({ title: "Werk", category_id: werk?.id ?? null, due_date: d, due_time: r.start, end_time: r.end, is_event: true });
        n++;
      } else if (t) {
        await removeTodo(t);
      }
    }
    toast.show(`${n} ${n === 1 ? "dienst" : "diensten"} opgeslagen`);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2"><Briefcase className="size-5 text-[#3B82F6]" /> Werkweek</span>}
      footer={<button className="btn btn-primary w-full" onClick={save}>Opslaan</button>}
    >
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setOffset(offset - 1)} className="btn btn-ghost p-2" aria-label="Vorige week"><ChevronLeft className="size-4" /></button>
        <div className="text-center">
          <p className="font-semibold">{offset === 0 ? "Deze week" : offset === 1 ? "Volgende week" : `Week van ${fmt(days[0], "d MMM")}`}</p>
          <p className="text-xs text-muted">{fmt(days[0], "d MMM")} – {fmt(days[6], "d MMM")}</p>
        </div>
        <button onClick={() => setOffset(offset + 1)} className="btn btn-ghost p-2" aria-label="Volgende week"><ChevronRight className="size-4" /></button>
      </div>

      <p className="label">Standaardtijden (tik een dag aan om hem toe te voegen)</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold tabular transition ${p === preset ? "border-[#3B82F6] bg-[#3B82F6]/15 text-text" : "border-line bg-surface-2 text-muted"}`}
          >
            {p.replace("-", "–")}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {days.map((d) => {
          const r = rows[d];
          if (!r) return null;
          const [ps, pe] = preset.split("-");
          return (
            <div key={d} className={`flex items-center gap-2 rounded-2xl border p-2 transition ${r.on ? "border-[#3B82F6]/40 bg-[#3B82F6]/10" : "border-line bg-surface-2/50"}`}>
              <button
                onClick={() => setRow(d, r.on ? { on: false } : { on: true, start: ps, end: pe })}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold uppercase ${r.on ? "bg-[#3B82F6] text-white" : "bg-surface-3 text-muted"}`}>
                  {fmt(d, "EEEEEE")}
                </span>
                <span className="text-sm">
                  <span className="font-medium">{fmt(d, "d MMM")}</span>
                  {!r.on && <span className="ml-2 text-xs text-faint">vrij</span>}
                </span>
              </button>
              {r.on && (
                <div className="flex items-center gap-1">
                  <input type="time" value={r.start} onChange={(e) => setRow(d, { start: e.target.value })} className="input w-[100px] px-2 py-1.5 text-sm" />
                  <span className="text-muted">–</span>
                  <input type="time" value={r.end} onChange={(e) => setRow(d, { end: e.target.value })} className="input w-[100px] px-2 py-1.5 text-sm" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-faint">Je krijgt een melding voor elke dienst. Diensten verschijnen blauw in je agenda.</p>
    </Sheet>
  );
}
