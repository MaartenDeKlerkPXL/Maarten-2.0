import { useMemo, useRef, useState } from "react";
import { ArrowUp, CalendarDays, Clock, Flag, SlidersHorizontal, Tag } from "lucide-react";
import { parseQuickAdd } from "../lib/parse";
import { useData } from "../lib/store";
import { useToast } from "./Toast";
import { haptic } from "../lib/hooks";
import type { TodoDraft } from "./TodoEditor";

const ICONS = { calendar: CalendarDays, clock: Clock, tag: Tag, flag: Flag } as const;

export function QuickAdd({
  onExpand, autoFocus, defaultDate, placeholder = "Snel toevoegen… bv. “Tandarts morgen 14:00 #persoonlijk”",
}: { onExpand?: (d: TodoDraft) => void; autoFocus?: boolean; defaultDate?: string; placeholder?: string }) {
  const { categories, addTodo } = useData();
  const toast = useToast();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (value.trim() ? parseQuickAdd(value, categories) : null), [value, categories]);

  const submit = async () => {
    if (!parsed?.title) return;
    haptic(10);
    const { hints: _hints, ...rest } = parsed;
    await addTodo({ ...rest, due_date: rest.due_date ?? defaultDate ?? null });
    setValue("");
    toast.show(`“${parsed.title}” toegevoegd`);
    ref.current?.focus();
  };

  return (
    <div>
      <form
        className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2/80 p-1.5 pl-4 transition focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={ref}
          value={value}
          autoFocus={autoFocus}
          enterKeyHint="done"
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-text outline-none placeholder:text-faint"
        />
        {onExpand && (
          <button
            type="button"
            onClick={() => {
              const { hints: _h, ...rest } = parsed ?? { title: "", hints: [] };
              onExpand({ ...rest, title: rest.title ?? "", due_date: (rest as TodoDraft).due_date ?? defaultDate ?? null });
              setValue("");
            }}
            className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-text"
            aria-label="Meer opties"
          >
            <SlidersHorizontal className="size-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!parsed?.title}
          className="grid size-9 place-items-center rounded-xl bg-accent text-white shadow-[0_6px_20px_-6px_rgb(59_130_246/0.8)] transition active:scale-90 disabled:bg-surface-3 disabled:text-faint disabled:shadow-none"
          aria-label="Toevoegen"
        >
          <ArrowUp className="size-4" strokeWidth={2.5} />
        </button>
      </form>
      {parsed && parsed.hints.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
          {parsed.hints.map((h) => {
            const Icon = ICONS[h.icon as keyof typeof ICONS];
            return (
              <span key={h.icon} className="chip animate-fade-in border-accent/30 bg-accent/10 text-accent-3">
                <Icon className="size-3" />
                {h.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
