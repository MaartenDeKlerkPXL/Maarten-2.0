import { useEffect, useState } from "react";
import { Archive, Check, Clock3, Trash2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { CategoryPicker, Field, Segmented } from "./ui";
import { useData, type NewTodo } from "../lib/store";
import type { Todo } from "../lib/types";
import { useToast } from "./Toast";
import { addIsoDays, fmt, isoDow, parseIso, todayIso } from "../lib/dates";

const REMIND_OPTIONS = [
  { days: 1, label: "1 dag" },
  { days: 3, label: "3 dagen" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weken" },
];

export type TodoDraft = NewTodo & { id?: string };

export function postponeOptions() {
  const today = todayIso();
  const monday = addIsoDays(today, 8 - isoDow(parseIso(today)));
  return [
    { label: "Vandaag", date: today },
    { label: "Morgen", date: addIsoDays(today, 1) },
    { label: `Maandag ${fmt(monday, "d/M")}`, date: monday },
    { label: "Over 1 week", date: addIsoDays(today, 7) },
  ];
}

export function TodoEditor({ draft, onClose }: { draft: TodoDraft | null; onClose: () => void }) {
  const { categories, addTodo, updateTodo, removeTodo, toggleTodo, todos } = useData();
  const toast = useToast();
  const [form, setForm] = useState<TodoDraft | null>(draft);
  useEffect(() => setForm(draft), [draft]);

  if (!form) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const existing = form.id ? todos.find((t) => t.id === form.id) : undefined;
  const set = (patch: Partial<TodoDraft>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!form.title.trim()) return;
    const clean: Partial<Todo> = {
      title: form.title.trim(),
      notes: form.notes?.trim() || null,
      due_date: form.due_date || null,
      due_time: form.due_date && form.due_time ? form.due_time : null,
      end_time: form.due_date && form.due_time && form.end_time ? form.end_time : null,
      category_id: form.category_id ?? null,
      priority: form.priority ?? 0,
      location: form.location?.trim() || null,
      remind_days_before: form.due_date ? form.remind_days_before ?? [] : [],
    };
    if (existing) await updateTodo(existing.id, clean);
    else {
      await addTodo({ ...clean, title: clean.title! });
      toast.show("Toegevoegd");
    }
    onClose();
  };

  const synced = existing && existing.source !== "user";
  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? (existing.is_event ? "Details" : "Taak bewerken") : "Nieuwe taak"}
      footer={
        <div className="flex items-center gap-2">
          {existing && (
            <button
              className="btn btn-danger px-3"
              onClick={() => {
                removeTodo(existing);
                toast.show(synced ? "Gearchiveerd" : "Verwijderd");
                onClose();
              }}
              aria-label={synced ? "Archiveren" : "Verwijderen"}
            >
              {synced ? <Archive className="size-4" /> : <Trash2 className="size-4" />}
            </button>
          )}
          {existing && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                toggleTodo(existing);
                onClose();
              }}
            >
              <Check className="size-4" />
              {existing.done_at ? "Heropenen" : "Afvinken"}
            </button>
          )}
          <button className="btn btn-primary ml-auto min-w-28" onClick={save} disabled={!form.title.trim()}>
            Opslaan
          </button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          className="input text-[17px] font-medium"
          placeholder="Wat moet er gebeuren?"
          value={form.title}
          autoFocus={!existing}
          onChange={(e) => set({ title: e.target.value })}
        />
        {existing && !existing.done_at && !existing.is_event && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-muted"><Clock3 className="size-3.5" /> Uitstellen</span>
            {postponeOptions().map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  updateTodo(existing.id, { due_date: o.date });
                  toast.show(`Verplaatst naar ${o.label.toLowerCase()}`);
                  onClose();
                }}
                className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition hover:border-accent/50 active:scale-95"
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <Field label="Datum">
          <input type="date" className="input" value={form.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value || null })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Van">
            <input type="time" className="input" value={form.due_time?.slice(0, 5) ?? ""} onChange={(e) => set({ due_time: e.target.value || null, due_date: form.due_date ?? (e.target.value ? todayIso() : null) })} />
          </Field>
          <Field label="Tot">
            <input type="time" className="input" value={form.end_time?.slice(0, 5) ?? ""} onChange={(e) => set({ end_time: e.target.value || null })} />
          </Field>
        </div>
        <Field group label="Categorie">
          <CategoryPicker categories={categories} value={form.category_id ?? null} onChange={(id) => set({ category_id: id })} />
        </Field>
        <Field group label="Prioriteit">
          <Segmented
            options={[
              { value: "0", label: "Geen" },
              { value: "1", label: "!" },
              { value: "2", label: "!!" },
              { value: "3", label: "!!!" },
            ]}
            value={String(form.priority ?? 0) as "0" | "1" | "2" | "3"}
            onChange={(v) => set({ priority: Number(v) })}
          />
        </Field>
        {form.due_date && (
          <Field group label="Melding vooraf" hint="Je krijgt 's ochtends een melding op deze dagen voor de datum.">
            <div className="flex flex-wrap gap-1.5">
              {REMIND_OPTIONS.map((o) => {
                const active = (form.remind_days_before ?? []).includes(o.days);
                return (
                  <button
                    key={o.days}
                    type="button"
                    onClick={() => {
                      const cur = form.remind_days_before ?? [];
                      set({ remind_days_before: active ? cur.filter((d) => d !== o.days) : [...cur, o.days].sort((a, b) => b - a) });
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-accent bg-accent/15 text-text" : "border-line bg-surface-2 text-muted"}`}
                  >
                    {o.label} van tevoren
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <Field label="Locatie">
          <input className="input" placeholder="Optioneel" value={form.location ?? ""} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="Notities">
          <textarea className="input min-h-20 resize-y" placeholder="Optioneel" value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        {synced && (
          <p className="text-xs text-faint">
            Dit item wordt automatisch bijgewerkt ({existing.source === "f1" ? "Formule 1-kalender" : existing.source === "roda" ? "Roda JC-programma" : existing.source === "oranje" ? "programma van het Nederlands elftal" : "terugkerende taak"}).
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
