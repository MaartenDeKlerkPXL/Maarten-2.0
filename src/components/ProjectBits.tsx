import { useMemo } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { nl } from "date-fns/locale";
import { AlertTriangle, CalendarClock, CirclePause, ExternalLink, FileText, Flag, FolderGit2, ListPlus, Lock, Snail, Trash2 } from "lucide-react";
import { useData } from "../lib/store";
import { useToday } from "../lib/hooks";
import { daysBetween, relativeDay } from "../lib/dates";
import { navigate } from "../lib/router";
import { PRIORITY_LABELS } from "../lib/parse";
import { deadlineUrgent, isStalled, newTodoUrl, progressOf, projectTag, repoUrl, todoUrl } from "../lib/projects";
import type { ProjectProgress, ProjectSource, ProjectTask } from "../lib/types";
import { CheckCircle } from "./ui";
import { useToast } from "./Toast";

/** Taken en voortgang per project + welke projecten stilliggen. */
export function useProjectIndex() {
  const { projects, projectTasks, projectProgress } = useData();
  const today = useToday();
  return useMemo(() => {
    const tasks = new Map<string, ProjectTask[]>();
    const progress = new Map<string, ProjectProgress[]>();
    for (const p of projects) {
      tasks.set(p.id, []);
      progress.set(p.id, []);
    }
    for (const t of projectTasks) tasks.get(t.project_id)?.push(t);
    for (const r of projectProgress) progress.get(r.project_id)?.push(r);
    for (const list of tasks.values()) list.sort((a, b) => a.volgorde - b.volgorde);
    const stalled = new Set(projects.filter((p) => !p.gepauzeerd && isStalled(progress.get(p.id) ?? [], today)).map((p) => p.id));
    return { tasks, progress, stalled };
  }, [projects, projectTasks, projectProgress, today]);
}

export function ProgressBar({ tasks, color, size = "md" }: { tasks: ProjectTask[]; color: string; size?: "md" | "lg" }) {
  const { done, total, pct } = progressOf(tasks);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">
          <span className="tabular font-semibold text-text">{done}</span>/{total} taken
        </span>
        <span className="tabular font-semibold" style={{ color: total ? color : undefined }}>{total ? `${Math.round(pct * 100)}%` : "–"}</span>
      </div>
      <div
        className={`${size === "lg" ? "h-2.5" : "h-2"} overflow-hidden rounded-full bg-surface-3`}
        role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Voortgang"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ width: `${pct * 100}%`, background: `linear-gradient(90deg, ${color}aa, ${color})`, boxShadow: pct ? `0 0 12px ${color}66` : "none" }}
        />
      </div>
    </div>
  );
}

export function DeadlineBadge({ date, compact }: { date: string; compact?: boolean }) {
  const today = useToday();
  const urgent = deadlineUrgent(date, today);
  const overdue = date < today;
  const d = daysBetween(today, date);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular ${urgent ? "bg-red-500/15 text-red-300" : "bg-surface-3 text-muted"}`}
      title={overdue ? "Verlopen" : `Over ${d} dagen`}
    >
      <CalendarClock className="size-3" />
      {compact ? relativeDay(date, today) : `${relativeDay(date, today)}${overdue ? " (verlopen)" : ""}`}
    </span>
  );
}

const PRIO_COLORS = ["", "text-accent-2", "text-amber-300", "text-red-400"];

/** Meldingen op een projectkaart: stil, gepauzeerd, sync-fout, geen todo.md. */
export function ProjectNotices({ project, stalled, compact }: { project: ProjectSource; stalled: boolean; compact?: boolean }) {
  const repo = repoUrl(project);
  return (
    <>
      {project.gepauzeerd && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-2 py-1 text-xs font-medium text-muted">
          <CirclePause className="size-3.5" /> Gepauzeerd
        </p>
      )}
      {stalled && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-300">
          <Snail className="size-3.5" /> Ligt stil: 14 dagen geen voortgang
        </p>
      )}
      {project.type === "github" && project.sync_status === "fout" && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {project.sync_fout ?? "Synchroniseren mislukt."}
        </p>
      )}
      {project.type === "github" && project.sync_status !== "fout" && project.sync_fout && (
        <p className="flex items-start gap-1.5 rounded-lg bg-accent/10 px-2 py-1.5 text-xs text-accent-3">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {project.sync_fout}
        </p>
      )}
      {project.type === "github" && project.sync_status === "geen_todo" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <FileText className="size-3.5" /> Nog geen todo.md
          </p>
          {!compact && repo && (
            <div className="flex gap-1.5">
              <a href={newTodoUrl(project)!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="btn btn-ghost px-2.5 py-1.5 text-xs">
                Aanmaken
              </a>
              <a href={repo} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="btn btn-ghost px-2.5 py-1.5 text-xs">
                <ExternalLink className="size-3.5" /> Open repo
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function ProjectLinks({ project }: { project: ProjectSource }) {
  const repo = repoUrl(project);
  const todo = todoUrl(project);
  if (!repo) return null;
  return (
    <div className="flex items-center gap-1">
      <a href={repo} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted transition hover:bg-white/[0.05] hover:text-text" title={`${project.repo_owner}/${project.repo_name}`}>
        <FolderGit2 className="size-3.5" /> Repo
      </a>
      {todo && (
        <a href={todo} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted transition hover:bg-white/[0.05] hover:text-text">
          <FileText className="size-3.5" /> todo.md
        </a>
      )}
    </div>
  );
}

export function syncedAgo(iso: string | null) {
  if (!iso) return "Nog niet gesynchroniseerd";
  return `Gesynct ${formatDistanceToNowStrict(new Date(iso), { locale: nl, addSuffix: true })}`;
}

/** Projecttaak als Todo: titel + #projectnaam, deadline en prioriteit gaan mee. */
export function useSendToTodo() {
  const { addTodo, todos, categories } = useData();
  const toast = useToast();
  return (task: ProjectTask, project: ProjectSource) => {
    const title = `${task.tekst} #${projectTag(project.naam)}`;
    if (todos.some((t) => !t.done_at && t.title === title)) {
      toast.show("Staat al in je Todo", "info", { label: "Bekijk", run: () => navigate("/todo") });
      return;
    }
    const cat = project.categorie
      ? categories.find((c) => c.name.toLowerCase() === project.categorie!.toLowerCase() || c.slug === project.categorie!.toLowerCase())
      : undefined;
    addTodo({
      title, due_date: task.deadline, priority: task.prioriteit, category_id: cat?.id ?? null,
      notes: `Uit project ${project.naam}${task.sectie ? ` · ${task.sectie}` : ""}`,
    });
    toast.show("In je Todo gezet", "info", { label: "Bekijk", run: () => navigate("/todo") });
  };
}

/** Eén taakregel. GitHub-taken zijn alleen-lezen (afvinken doe je in de repo). */
export function TaskLine({ task, project, onDelete }: { task: ProjectTask; project: ProjectSource; onDelete?: () => void }) {
  const { toggleProjectTask } = useData();
  const send = useSendToTodo();
  const readOnly = task.bron === "github";
  return (
    <div className={`group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.03] ${task.afgerond ? "opacity-55" : ""}`}>
      <div className="pt-0.5">
        {readOnly ? (
          <span
            className="grid size-5 place-items-center rounded-full border-2"
            style={{ borderColor: task.afgerond ? project.kleur : `${project.kleur}66`, background: task.afgerond ? project.kleur : "transparent" }}
            title="Afvinken doe je in todo.md op GitHub"
            aria-label={task.afgerond ? "Afgerond" : "Open"}
          >
            {task.afgerond ? <span className="text-[10px] font-bold text-white">✓</span> : null}
          </span>
        ) : (
          <CheckCircle size="sm" checked={task.afgerond} color={project.kleur} onClick={() => toggleProjectTask(task)} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${task.afgerond ? "line-through" : ""}`}>{task.tekst}</p>
        {(task.prioriteit > 0 || task.deadline || task.tags.length > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.prioriteit > 0 && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${PRIO_COLORS[task.prioriteit]}`}>
                <Flag className="size-3" fill="currentColor" /> {PRIORITY_LABELS[task.prioriteit]}
              </span>
            )}
            {task.deadline && !task.afgerond && <DeadlineBadge date={task.deadline} />}
            {task.tags.map((t) => (
              <span key={t} className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] text-muted">#{t}</span>
            ))}
          </div>
        )}
      </div>
      {!task.afgerond && (
        <button
          onClick={() => send(task, project)}
          className="shrink-0 rounded-lg p-1.5 text-faint transition hover:bg-white/[0.06] hover:text-accent-2"
          title="Zet in Todo" aria-label={`Zet “${task.tekst}” in Todo`}
        >
          <ListPlus className="size-4" />
        </button>
      )}
      {readOnly ? (
        <Lock className="mt-1.5 size-3 shrink-0 text-faint/60" aria-hidden />
      ) : onDelete ? (
        <button onClick={onDelete} className="shrink-0 rounded-lg p-1.5 text-faint transition hover:bg-red-500/10 hover:text-red-300" aria-label="Taak verwijderen">
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
