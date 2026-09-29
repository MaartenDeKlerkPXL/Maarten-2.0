import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { useData, useCategoryMap } from "../../lib/store";
import { DOW_LONG, hm } from "../../lib/dates";
import type { ScheduleItem } from "../../lib/types";
import { Sheet } from "../../components/Sheet";
import { CategoryPicker, Field, WeekdayPicker } from "../../components/ui";
import { SubHeader } from "./SubHeader";

function ScheduleEditor({ value, onClose }: { value: Partial<ScheduleItem>; onClose: () => void }) {
  const { saveSchedule, deleteSchedule, categories } = useData();
  const [f, setF] = useState<Partial<ScheduleItem>>({ weekday: 1, start_time: "09:00", end_time: "10:00", ...value });
  const set = (p: Partial<ScheduleItem>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.title?.trim()) return;
    await saveSchedule({ ...f, title: f.title.trim(), code: f.code || null, location: f.location || null, valid_from: f.valid_from || null, valid_until: f.valid_until || null } as ScheduleItem);
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={value.id ? "Blok bewerken" : "Vast blok toevoegen"}
      footer={
        <div className="flex gap-2">
          {value.id && (
            <button className="btn btn-danger px-3" onClick={() => { deleteSchedule(value.id!); onClose(); }} aria-label="Verwijderen">
              <Trash2 className="size-4" />
            </button>
          )}
          <button className="btn btn-primary ml-auto min-w-28" onClick={save}>Opslaan</button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Titel">
          <input className="input" value={f.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Bijv. UI Design 2" />
        </Field>
        <Field group label="Dag">
          <WeekdayPicker single value={f.weekday ? [f.weekday] : []} onChange={(v) => set({ weekday: v[0] })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Van"><input type="time" className="input" value={hm(f.start_time)} onChange={(e) => set({ start_time: e.target.value })} /></Field>
          <Field label="Tot"><input type="time" className="input" value={hm(f.end_time)} onChange={(e) => set({ end_time: e.target.value })} /></Field>
        </div>
        <Field group label="Categorie">
          <CategoryPicker categories={categories} value={f.category_id ?? null} onChange={(id) => set({ category_id: id })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lokaal / locatie"><input className="input" value={f.location ?? ""} onChange={(e) => set({ location: e.target.value })} /></Field>
          <Field label="Vakcode"><input className="input" value={f.code ?? ""} onChange={(e) => set({ code: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Geldig vanaf"><input type="date" className="input px-2.5" value={f.valid_from ?? ""} onChange={(e) => set({ valid_from: e.target.value })} /></Field>
          <Field label="Geldig tot"><input type="date" className="input px-2.5" value={f.valid_until ?? ""} onChange={(e) => set({ valid_until: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-faint">Schoolblokken worden automatisch overgeslagen op Belgische feestdagen.</p>
      </div>
    </Sheet>
  );
}

export default function Schedule() {
  const { schedule } = useData();
  const cats = useCategoryMap();
  const [editing, setEditing] = useState<Partial<ScheduleItem> | null>(null);
  return (
    <div className="mx-auto max-w-2xl">
      <SubHeader
        title="Vast rooster"
        subtitle="Komt elke week terug in je agenda"
        action={<button onClick={() => setEditing({})} className="btn btn-primary px-3 py-2 text-xs"><Plus className="size-4" /> Toevoegen</button>}
      />
      <div className="space-y-4">
        {DOW_LONG.map((day, i) => {
          const items = schedule.filter((s) => s.weekday === i + 1);
          if (!items.length) return null;
          return (
            <section key={day} className="card card-pad">
              <h2 className="section-title mb-2 capitalize">{day}</h2>
              <div className="space-y-1">
                {items.map((s) => {
                  const c = s.category_id ? cats.get(s.category_id) : undefined;
                  return (
                    <button key={s.id} onClick={() => setEditing(s)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.03]">
                      <div className="w-24 shrink-0 text-sm font-semibold tabular">{hm(s.start_time)}–{hm(s.end_time)}</div>
                      <div className="h-9 w-1 rounded-full" style={{ background: c?.color ?? "#64748B" }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.title}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted">
                          {s.location && <><MapPin className="size-3" />{s.location}</>}
                          {s.code && <span className="ml-1 text-faint">{s.code}</span>}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {editing && <ScheduleEditor value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
