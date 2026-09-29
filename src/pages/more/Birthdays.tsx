import { useState } from "react";
import { Cake, Plus, Trash2 } from "lucide-react";
import { useData } from "../../lib/store";
import { useToday } from "../../lib/hooks";
import { fmt, MONTHS } from "../../lib/dates";
import { upcomingBirthdays } from "../../lib/logic";
import type { Birthday } from "../../lib/types";
import { Sheet } from "../../components/Sheet";
import { Empty, Field } from "../../components/ui";
import { SubHeader } from "./SubHeader";

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const HUES = ["#EC4899", "#A855F7", "#3B82F6", "#14B8A6", "#F59E0B", "#22C55E", "#F97316"];
const hue = (s: string) => HUES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];

function BirthdayEditor({ value, onClose }: { value: Partial<Birthday>; onClose: () => void }) {
  const { saveBirthday, deleteBirthday } = useData();
  const [f, setF] = useState<Partial<Birthday>>({ day: 1, month: 1, ...value });
  const set = (p: Partial<Birthday>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.name?.trim()) return;
    await saveBirthday({ ...f, name: f.name.trim() } as Birthday);
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={value.id ? "Verjaardag bewerken" : "Verjaardag toevoegen"}
      footer={
        <div className="flex gap-2">
          {value.id && (
            <button className="btn btn-danger px-3" onClick={() => { deleteBirthday(value.id!); onClose(); }} aria-label="Verwijderen">
              <Trash2 className="size-4" />
            </button>
          )}
          <button className="btn btn-primary ml-auto min-w-28" onClick={save}>Opslaan</button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Naam">
          <input className="input" autoFocus={!value.id} value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="Bijv. Oma" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Dag">
            <select className="input px-2.5" value={f.day} onChange={(e) => set({ day: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
          </Field>
          <Field label="Maand">
            <select className="input px-2.5" value={f.month} onChange={(e) => set({ month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field label="Geboortejaar">
            <input className="input px-2.5" inputMode="numeric" placeholder="optioneel" value={f.year ?? ""} onChange={(e) => set({ year: e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 4)) : null })} />
          </Field>
        </div>
        <Field label="Notities" hint="Bijv. cadeau-ideeën">
          <textarea className="input min-h-20" value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

export default function Birthdays() {
  const { birthdays, settings } = useData();
  const today = useToday();
  const [editing, setEditing] = useState<Partial<Birthday> | null>(null);
  const list = upcomingBirthdays(birthdays, today);
  const window = settings?.birthday_days_before ?? 14;
  return (
    <div className="mx-auto max-w-2xl">
      <SubHeader
        title="Verjaardagen"
        subtitle={`Je krijgt ${window} dagen van tevoren een melding`}
        action={<button onClick={() => setEditing({})} className="btn btn-primary px-3 py-2 text-xs"><Plus className="size-4" /> Toevoegen</button>}
      />
      <div className="card overflow-hidden">
        {list.length === 0 && <Empty icon={<Cake className="size-5" />} title="Nog geen verjaardagen" />}
        <div className="divide-y divide-line">
          {list.map(({ birthday: b, date, days, age }) => {
            const soon = days <= window;
            return (
              <button key={b.id} onClick={() => setEditing(b)} className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition hover:bg-white/[0.03]">
                <div className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${hue(b.name)}, ${hue(b.name)}99)` }}>
                  {initials(b.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {b.name} {b.is_self && <span className="text-xs text-accent-2">(jij)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {fmt(date, "EEEE d MMMM")}
                    {age ? ` · wordt ${age}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular ${days === 0 ? "bg-pink-500 text-white" : soon ? "bg-pink-500/20 text-pink-200" : "bg-surface-2 text-muted"}`}>
                  {days === 0 ? "Vandaag 🎉" : days === 1 ? "Morgen" : `${days} d`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {editing && <BirthdayEditor value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
