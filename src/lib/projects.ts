import { addIsoDays, daysBetween } from "./dates";
import type { ProjectProgress, ProjectSource, ProjectTask } from "./types";

export const PROJECT_COLORS = ["#3B82F6", "#F59E0B", "#A855F7", "#22C55E", "#14B8A6", "#EC4899", "#6366F1", "#84CC16", "#0EA5E9", "#F97316", "#EF4444", "#A1A1AA"];
export const MAX_FOCUS = 3;
export const STALL_DAYS = 14;

export function progressOf(tasks: ProjectTask[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.afgerond).length;
  return { done, total, pct: total ? done / total : 0 };
}

/** Open taken in volgorde van het bestand (zoals ze in todo.md staan). */
export function openTasks(tasks: ProjectTask[]): ProjectTask[] {
  return tasks.filter((t) => !t.afgerond).sort((a, b) => a.volgorde - b.volgorde);
}

export function nearestDeadline(tasks: ProjectTask[], today: string): ProjectTask | null {
  return (
    tasks
      .filter((t) => !t.afgerond && t.deadline)
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
      .find((t) => t.deadline! >= today) ??
    // verlopen deadlines tellen ook (eerst de oudste)
    tasks.filter((t) => !t.afgerond && t.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0] ??
    null
  );
}

/** Rood binnen 7 dagen (of al verlopen). */
export function deadlineUrgent(deadline: string, today: string) {
  return daysBetween(today, deadline) <= 7;
}

/**
 * "Ligt stil": de voortgang (en het aantal afgevinkte taken) is in 14 dagen niet veranderd.
 * Projecten zonder taken of die al af zijn tellen niet mee. Zelfde regel als public.project_is_stil().
 */
export function isStalled(rows: ProjectProgress[], today: string): boolean {
  const sorted = [...rows].sort((a, b) => a.datum.localeCompare(b.datum));
  const latest = sorted[sorted.length - 1];
  if (!latest || latest.totaal === 0 || Number(latest.voortgang) >= 1) return false;
  const cutoff = addIsoDays(today, -STALL_DAYS);
  const ref = [...sorted].reverse().find((r) => r.datum <= cutoff);
  if (!ref) return false;
  return sorted
    .filter((r) => r.datum > ref.datum)
    .every((r) => Number(r.voortgang) === Number(ref.voortgang) && r.afgerond === ref.afgerond);
}

export const repoUrl = (p: ProjectSource) => (p.repo_owner && p.repo_name ? `https://github.com/${p.repo_owner}/${p.repo_name}` : null);
export const todoUrl = (p: ProjectSource) =>
  repoUrl(p) && p.todo_pad ? `${repoUrl(p)}/blob/${encodeURIComponent(p.standaard_branch ?? "main")}/${p.todo_pad}` : null;
/** Nieuwe todo.md aanmaken op GitHub (als er nog geen is). */
export const newTodoUrl = (p: ProjectSource) =>
  repoUrl(p) ? `${repoUrl(p)}/new/${encodeURIComponent(p.standaard_branch ?? "main")}?filename=todo.md` : null;

/** "Maarten 2.0" → "maarten-2.0" (voor #projectnaam in de Todo). */
export const projectTag = (naam: string) =>
  naam.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\d.]+/gu, "-").replace(/^-+|-+$/g, "");

/** "eigenaar/repo", "github.com/eigenaar/repo(.git)" of een volledige URL. */
export function parseRepoInput(input: string): { owner: string; name: string } | null {
  const m = input.trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?(?:[?#].*)?$/);
  return m ? { owner: m[1], name: m[2] } : null;
}

/** "mijn-app2.0" → "Mijn app2.0" */
export const prettyRepoName = (name: string) => {
  const s = name.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Nieuwe volgorde van een (gefilterde) deellijst terugzetten in de volledige lijst. */
export function mergeOrder(full: string[], visibleNew: string[]): string[] {
  const visible = new Set(visibleNew);
  let i = 0;
  return full.map((id) => (visible.has(id) ? visibleNew[i++] : id));
}
