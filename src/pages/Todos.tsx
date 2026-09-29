import { useMemo, useState } from "react";
import { Archive, ChevronDown, ListChecks } from "lucide-react";
import { useData } from "../lib/store";
import { useToday } from "../lib/hooks";
import { groupTodos } from "../lib/logic";
import { navigate } from "../lib/router";
import { QuickAdd } from "../components/QuickAdd";
import { TodoRow } from "../components/TodoRow";
import { useEditor } from "../components/EditorContext";
import { CategoryDot, Empty, PageHeader } from "../components/ui";

type Filter = "all" | "tasks" | "events";

export default function Todos() {
  const { todos, categories, updateTodo } = useData();
  const { openTodo, newTodo } = useEditor();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>("all");
  const [cat, setCat] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(
    () =>
      todos.filter(
        (t) =>
          (filter === "all" || (filter === "tasks" ? !t.is_event : t.is_event)) && (!cat || t.category_id === cat),
      ),
    [todos, filter, cat],
  );
  const groups = useMemo(() => groupTodos(filtered, today), [filtered, today]);
  const openCount = filtered.filter((t) => !t.done_at).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Todo"
        subtitle={`${openCount} open`}
        action={
          <button onClick={() => navigate("/meer/archief")} className="btn btn-ghost px-3 py-2 text-xs">
            <Archive className="size-3.5" /> Archief
          </button>
        }
      />

      <div className="sticky top-[calc(env(safe-area-inset-top)+8px)] z-20 -mx-1 mb-4 rounded-3xl bg-bg/70 p-1 backdrop-blur-xl lg:top-4">
        <QuickAdd onExpand={(d) => newTodo(d)} autoFocus={false} />
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
        {([
          ["all", "Alles"],
          ["tasks", "Taken"],
          ["events", "Events"],
        ] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${filter === v ? "border-accent bg-accent text-white" : "border-line bg-surface-2 text-muted"}`}
          >
            {l}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(cat === c.id ? null : c.id)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition"
            style={{
              borderColor: cat === c.id ? c.color : "var(--color-line)",
              background: cat === c.id ? `${c.color}22` : "var(--color-surface-2)",
              color: cat === c.id ? "var(--color-text)" : "var(--color-muted)",
            }}
          >
            <CategoryDot color={c.color} />
            {c.name}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="card">
          <Empty icon={<ListChecks className="size-5" />} title="Alles gedaan!" text="Voeg hierboven snel iets toe. Tip: typ “morgen 14:00 #werk”." />
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => {
          const collapsible = g.key === "later" || g.key === "done";
          const isOpen = !collapsible || expanded[g.key];
          const shown = isOpen ? g.todos : [];
          return (
            <section key={g.key} className="card card-pad">
              <div className="mb-1 flex items-center justify-between gap-2">
                <button
                  disabled={!collapsible}
                  onClick={() => setExpanded((e) => ({ ...e, [g.key]: !e[g.key] }))}
                  className="flex flex-1 items-center justify-between disabled:cursor-default"
                >
                  <h2 className={`section-title ${g.tone === "danger" ? "text-danger" : g.tone === "accent" ? "text-accent-2" : ""}`}>
                    {g.title} <span className="ml-1 text-faint">{g.todos.length}</span>
                  </h2>
                  {collapsible && <ChevronDown className={`size-4 text-muted transition ${isOpen ? "rotate-180" : ""}`} />}
                </button>
                {g.key === "overdue" && g.todos.some((t) => !t.is_event) && (
                  <button
                    onClick={() => g.todos.filter((t) => !t.is_event).forEach((t) => updateTodo(t.id, { due_date: today }))}
                    className="rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger transition active:scale-95"
                  >
                    Alles naar vandaag
                  </button>
                )}
              </div>
              <div className="-mx-2">
                {shown.map((t) => (
                  <TodoRow key={t.id} todo={t} onOpen={openTodo} showDate={g.key !== "today" && g.key !== "tomorrow"} />
                ))}
              </div>
              {g.key === "done" && isOpen && (
                <p className="mt-2 text-xs text-faint">Afgevinkte items blijven hier staan en gaan na een week automatisch naar het archief.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
