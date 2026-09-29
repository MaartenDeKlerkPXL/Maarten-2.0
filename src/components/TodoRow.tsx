import { Bell, CalendarDays, Clock, Flag, MapPin, Repeat } from "lucide-react";
import type { Todo } from "../lib/types";
import { hm, relativeDay } from "../lib/dates";
import { useCategoryMap, useData } from "../lib/store";
import { useToast } from "./Toast";
import { haptic } from "../lib/hooks";
import { CheckCircle } from "./ui";

const PRIORITY_COLORS = ["", "#60A5FA", "#FBBF24", "#F87171"];

export function SourceBadge({ source }: { source: Todo["source"] }) {
  if (source === "f1") return <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-red-300">F1</span>;
  if (source === "roda") return <span className="rounded-md bg-yellow-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-yellow-300">RODA</span>;
  if (source === "recurring") return <Repeat className="size-3 text-faint" />;
  return null;
}

export function TodoRow({ todo, onOpen, showDate = true }: { todo: Todo; onOpen: (t: Todo) => void; showDate?: boolean }) {
  const cats = useCategoryMap();
  const { toggleTodo } = useData();
  const toast = useToast();
  const cat = todo.category_id ? cats.get(todo.category_id) : undefined;
  const color = cat?.color ?? "#3B82F6";
  const done = !!todo.done_at;

  const toggle = () => {
    haptic(done ? 8 : [10, 30, 10]);
    toggleTodo(todo);
    if (!done) toast.show(`“${todo.title}” afgevinkt`, "info", { label: "Ongedaan", run: () => toggleTodo({ ...todo, done_at: "x" }) });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(todo)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(todo)}
      className={`group flex items-start gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-white/[0.03] ${done ? "opacity-55" : ""}`}
    >
      <div className="pt-0.5">
        <CheckCircle checked={done} color={color} onClick={toggle} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className={`min-w-0 flex-1 text-[15px] leading-snug ${done ? "text-faint line-through decoration-faint/60" : "text-text"}`}>
            {todo.title}
          </p>
          {todo.priority > 0 && !done && <Flag className="mt-0.5 size-3.5 shrink-0" style={{ color: PRIORITY_COLORS[todo.priority] }} fill="currentColor" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          {showDate && todo.due_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {relativeDay(todo.due_date)}
            </span>
          )}
          {todo.due_time && (
            <span className="inline-flex items-center gap-1 tabular">
              <Clock className="size-3" />
              {hm(todo.due_time)}
              {todo.end_time && `–${hm(todo.end_time)}`}
            </span>
          )}
          {cat && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: cat.color }} />
              {cat.name}
            </span>
          )}
          {todo.location && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{todo.location}</span>
            </span>
          )}
          {todo.remind_days_before?.length > 0 && !done && <Bell className="size-3" />}
          <SourceBadge source={todo.source} />
        </div>
      </div>
    </div>
  );
}
