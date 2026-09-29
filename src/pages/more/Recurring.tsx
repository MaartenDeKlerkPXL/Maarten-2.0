import { useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { useData, useCategoryMap } from "../../lib/store";
import { DOW_LONG, hm } from "../../lib/dates";
import type { RecurringTodo } from "../../lib/types";
import { Sheet } from "../../components/Sheet";
import { CategoryPicker, Empty, Field, Segmented, Toggle, WeekdayPicker } from "../../components/ui";
import { SubHeader } from "./SubHeader";

function describe(r: RecurringTodo) {
  const when = r.frequency === "weekly" ? `Elke ${DOW_LONG[(r.weekday ?? 1) - 1]}` : `Elke ${r.day_of_month}e van de maand`;
  const time = r.due_time ? ` om ${hm(r.due_time)}` : "";
  const nag = r.remind_until_day ? ` · herinnering t/m de ${r.remind_until_day}e` : "";
  return when + time + nag;
}

function RecurringEditor({ value, onClose }: { value: Partial<RecurringTodo>; onClose: () => void }) {
  const { saveRecurring, deleteRecurring, categories } = useData();
  const [f, setF] = useState<Partial<RecurringTodo>>({ frequency: "monthly", day_of_month: 1, weekday: 7, is_event: false, active: true, ...value });
  const set = (p: Partial<RecurringTodo>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.title?.trim()) return;
    await saveRecurring({
      ...f,
      title: f.title.trim(),
      day_of_month: f.frequency === "monthly" ? f.day_of_month ?? 1 : null,
      weekday: f.frequency === "weekly" ? f.weekday ?? 1 : null,
      remind_until_day: f.frequency === "monthly" && !f.is_event ? f.remind_until_day ?? null : null,
      due_time: f.due_time || null,
    } as RecurringTodo);
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={value.id ? "Terugkerende taak" : "Nieuwe terugkerende taak"}
      footer={
        <div className="flex gap-2">
          {value.id && (
            <button className="btn btn-danger px-3" onClick={() => { deleteRecurring(value.id!); onClose(); }} aria-label="Verwijderen">
              <Trash2 className="size-4" />
            </button>
          )}
          <button className="btn btn-primary ml-auto min-w-28" onClick={save}>Opslaan</button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Titel"><input className="input" value={f.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Segmented options={[{ value: "monthly", label: "Maandelijks" }, { value: "weekly", label: "Wekelijks" }]} value={f.frequency ?? "monthly"} onChange={(v) => set({ frequency: v })} />
        {f.frequency === "monthly" ? (
          <Field label="Dag van de maand">
            <select className="input" value={f.day_of_month ?? 1} onChange={(e) => set({ day_of_month: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}e</option>)}
            </select>
          </Field>
        ) : (
          <Field group label="Dag"><WeekdayPicker single value={[f.weekday ?? 7]} onChange={(v) => set({ weekday: v[0] })} /></Field>
        )}
        <Field label="Tijd (optioneel)"><input type="time" className="input" value={hm(f.due_time)} onChange={(e) => set({ due_time: e.target.value || null })} /></Field>
        <Field group label="Categorie"><CategoryPicker categories={categories} value={f.category_id ?? null} onChange={(id) => set({ category_id: id })} /></Field>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Het is een gebeurtenis</p>
            <p className="text-xs text-muted">Bijv. uitbetaling; hoeft niet afgevinkt te worden</p>
          </div>
          <Toggle checked={!!f.is_event} onChange={(v) => set({ is_event: v })} />
        </div>
        {f.frequency === "monthly" && !f.is_event && (
          <Field label="Blijf herinneren tot" hint="Elke ochtend een melding zolang hij niet is afgevinkt.">
            <select className="input" value={f.remind_until_day ?? ""} onChange={(e) => set({ remind_until_day: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Geen extra herinneringen</option>
              {Array.from({ length: 10 }, (_, i) => (f.day_of_month ?? 1) + i + 1).filter((d) => d <= 31).map((d) => <option key={d} value={d}>de {d}e</option>)}
            </select>
          </Field>
        )}
      </div>
    </Sheet>
  );
}

export default function Recurring() {
  const { recurring } = useData();
  const cats = useCategoryMap();
  const [editing, setEditing] = useState<Partial<RecurringTodo> | null>(null);
  return (
    <div className="mx-auto max-w-2xl">
      <SubHeader
        title="Terugkerend"
        subtitle="Wordt automatisch op je todo-lijst gezet"
        action={<button onClick={() => setEditing({})} className="btn btn-primary px-3 py-2 text-xs"><Plus className="size-4" /> Toevoegen</button>}
      />
      <div className="card divide-y divide-line overflow-hidden">
        {recurring.length === 0 && <Empty icon={<Repeat className="size-5" />} title="Nog niets terugkerends" />}
        {recurring.map((r) => {
          const c = r.category_id ? cats.get(r.category_id) : undefined;
          return (
            <button key={r.id} onClick={() => setEditing(r)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-white/[0.03]">
              <div className="grid size-10 place-items-center rounded-xl" style={{ background: `${c?.color ?? "#3B82F6"}1f`, color: c?.color ?? "#3B82F6" }}>
                <Repeat className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted">{describe(r)}</p>
              </div>
            </button>
          );
        })}
      </div>
      {editing && <RecurringEditor value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
