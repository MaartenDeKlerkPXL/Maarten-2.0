import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { FolderGit2, FolderKanban, GripVertical, Plus, RefreshCw, Star, Target } from "lucide-react";
import { useData } from "../lib/store";
import { useToday, haptic } from "../lib/hooks";
import { addIsoDays } from "../lib/dates";
import { navigate } from "../lib/router";
import { MAX_FOCUS, PROJECT_COLORS, mergeOrder, nearestDeadline, openTasks, parseRepoInput, prettyRepoName } from "../lib/projects";
import type { ProjectSource, ProjectTask } from "../lib/types";
import { Sheet } from "../components/Sheet";
import { Empty, Field, PageHeader, Segmented, Toggle } from "../components/ui";
import { useToast } from "../components/Toast";
import { DeadlineBadge, ProgressBar, ProjectLinks, ProjectNotices, syncedAgo, useProjectIndex } from "../components/ProjectBits";

type Filter = "alle" | "focus" | "deadline";

const load = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* privémodus */
  }
};

// ───────────── Slepen (muis én touch) ─────────────
// Tijdens het slepen luisteren we op window: als React de kaart in de DOM verplaatst,
// verliest de greep zijn pointer capture en zouden de events anders wegvallen.
function useDragSort(ids: string[], onCommit: (ids: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const orderRef = useRef<string[]>(ids);
  const els = useRef(new Map<string, HTMLElement>());
  const latest = useRef({ ids, onCommit });
  latest.current = { ids, onCommit };
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const start = (id: string, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup.current?.();
    orderRef.current = [...latest.current.ids];
    setOrder(orderRef.current);
    setActive(id);
    haptic(10);

    const onMove = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      ev.preventDefault();
      // dichtstbijzijnde kaart (werkt in lijst én raster)
      let best: string | null = null;
      let bestDist = Infinity;
      for (const [oid, el] of els.current) {
        const r = el.getBoundingClientRect();
        const dx = ev.clientX - (r.left + r.width / 2);
        const dy = ev.clientY - (r.top + r.height / 2);
        if (dx * dx + dy * dy < bestDist) {
          bestDist = dx * dx + dy * dy;
          best = oid;
        }
      }
      if (best && best !== id) {
        const next = orderRef.current.filter((x) => x !== id);
        next.splice(orderRef.current.indexOf(best), 0, id);
        orderRef.current = next;
        setOrder(next);
      }
      if (ev.clientY < 90) window.scrollBy(0, -14);
      else if (ev.clientY > window.innerHeight - 110) window.scrollBy(0, 14);
    };
    const onEnd = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      cleanup.current?.();
      const changed = orderRef.current.join() !== latest.current.ids.join();
      setActive(null);
      setOrder(null);
      if (changed) {
        haptic(12);
        latest.current.onCommit(orderRef.current);
      }
    };
    // klik na het loslaten mag de kaart niet openen
    const swallowClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    cleanup.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.addEventListener("click", swallowClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallowClick, { capture: true }), 0);
      cleanup.current = null;
    };
  };

  return {
    order: order ?? ids,
    active,
    register: (id: string) => (el: HTMLElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    handle: (id: string) => ({
      onPointerDown: (e: PointerEvent<HTMLElement>) => start(id, e),
      onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const i = ids.indexOf(id);
        const j = e.key === "ArrowUp" ? i - 1 : i + 1;
        if (j < 0 || j >= ids.length) return;
        const next = [...ids];
        next.splice(i, 1);
        next.splice(j, 0, id);
        onCommit(next);
      },
    }),
  };
}

// ───────────── Kaarten ─────────────
function FocusCard({ project, tasks, stalled }: { project: ProjectSource; tasks: ProjectTask[]; stalled: boolean }) {
  const next = openTasks(tasks).slice(0, 3);
  return (
    <button
      onClick={() => navigate(`/projecten/${project.id}`)}
      className="card card-pad relative flex flex-col gap-4 overflow-hidden text-left transition hover:border-line-strong"
      style={{ background: `radial-gradient(120% 90% at 0% 0%, ${project.kleur}26, transparent 60%), var(--color-surface)`, borderColor: `${project.kleur}40` }}
    >
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${project.kleur}26`, color: project.kleur }}>
          {project.type === "github" ? <FolderGit2 className="size-5" /> : <FolderKanban className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold tracking-tight">{project.naam}</p>
          {project.categorie && <p className="truncate text-xs text-muted">{project.categorie}</p>}
        </div>
        <Star className="size-4 shrink-0 text-amber-300" fill="currentColor" aria-label="Focus deze week" />
      </div>
      <ProgressBar tasks={tasks} color={project.kleur} size="lg" />
      {stalled && <ProjectNotices project={{ ...project, sync_status: "ok", sync_fout: null, gepauzeerd: false }} stalled compact />}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Eerstvolgende taken</p>
        {next.length === 0 ? (
          <p className="text-sm text-muted">{tasks.length ? "Alles afgevinkt 🎉" : "Nog geen taken"}</p>
        ) : (
          next.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: project.kleur }} />
              <span className="min-w-0 flex-1 leading-snug">{t.tekst}</span>
              {t.deadline && <DeadlineBadge date={t.deadline} compact />}
            </div>
          ))
        )}
      </div>
    </button>
  );
}

function ProjectCard({
  project, rank, tasks, stalled, dragging, register, handle, onToggleFocus,
}: {
  project: ProjectSource; rank: number; tasks: ProjectTask[]; stalled: boolean; dragging: boolean;
  register: (el: HTMLElement | null) => void; handle: ReturnType<ReturnType<typeof useDragSort>["handle"]>; onToggleFocus: () => void;
}) {
  const today = useToday();
  const next = openTasks(tasks)[0];
  const deadline = nearestDeadline(tasks, today);
  return (
    <div
      ref={register}
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/projecten/${project.id}`)}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && navigate(`/projecten/${project.id}`)}
      className={`card card-pad flex cursor-pointer flex-col gap-3 transition-[transform,box-shadow,opacity] duration-150 hover:border-line-strong ${dragging ? "z-10 scale-[1.02] opacity-95 shadow-2xl ring-2 ring-accent/60" : ""} ${project.gepauzeerd && !dragging ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <button
          {...handle}
          className="-ml-1.5 flex shrink-0 cursor-grab touch-none flex-col items-center rounded-lg px-1 py-1 text-faint transition hover:bg-white/[0.05] hover:text-muted active:cursor-grabbing"
          aria-label={`Prioriteit ${rank} – sleep of gebruik pijltjestoetsen om te verplaatsen`}
          title="Sleep om de prioriteit te wijzigen"
        >
          <GripVertical className="size-4" />
          <span className="text-[10px] font-bold tabular">{rank}</span>
        </button>
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${project.kleur}1f`, color: project.kleur }}>
          {project.type === "github" ? <FolderGit2 className="size-[18px]" /> : <FolderKanban className="size-[18px]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{project.naam}</p>
          <p className="truncate text-xs text-muted">
            {[project.categorie, project.type === "github" ? project.repo_name : "Handmatig"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFocus();
          }}
          className={`grid size-9 shrink-0 place-items-center rounded-full transition active:scale-90 ${project.focus_deze_week ? "bg-amber-400/15 text-amber-300" : "text-faint hover:bg-white/[0.05] hover:text-muted"}`}
          aria-pressed={project.focus_deze_week}
          aria-label={project.focus_deze_week ? "Uit focus halen" : "Focus deze week"}
          title={project.focus_deze_week ? "Uit focus halen" : "Focus deze week"}
        >
          <Star className="size-4" fill={project.focus_deze_week ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 empty:hidden">
        <ProjectNotices project={project} stalled={stalled} />
      </div>

      {(tasks.length > 0 || project.type === "handmatig") && <ProgressBar tasks={tasks} color={project.kleur} />}

      {(next || deadline) && (
        <div className="space-y-1.5 text-sm">
          {next && (
            <p className="flex gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-faint">Volgende</span>
              <span className="min-w-0 flex-1 truncate">{next.tekst}</span>
            </p>
          )}
          {deadline && (
            <p className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-faint">Deadline</span>
              <span className="min-w-0 flex-1 truncate text-muted">{deadline.tekst}</span>
              <DeadlineBadge date={deadline.deadline!} compact />
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <span className="truncate text-[11px] text-faint">{project.type === "github" ? syncedAgo(project.laatste_sync) : "Handmatig project"}</span>
        <ProjectLinks project={project} />
      </div>
    </div>
  );
}

// ───────────── Nieuw project ─────────────
export function ProjectEditor({ value, onClose }: { value: Partial<ProjectSource>; onClose: () => void }) {
  const { saveProject, updateProject, syncProjects, projects } = useData();
  const toast = useToast();
  const isNew = !value.id;
  const [type, setType] = useState<ProjectSource["type"]>(value.type ?? "handmatig");
  const [naam, setNaam] = useState(value.naam ?? "");
  const [repo, setRepo] = useState("");
  const [categorie, setCategorie] = useState(value.categorie ?? "");
  const [kleur, setKleur] = useState(value.kleur ?? PROJECT_COLORS[projects.length % PROJECT_COLORS.length]);
  const parsedRepo = type === "github" && isNew ? parseRepoInput(repo) : null;

  const submit = async () => {
    if (!isNew) {
      if (!naam.trim()) return;
      await updateProject(value.id!, { naam: naam.trim(), categorie: categorie.trim() || null, kleur });
      onClose();
      return;
    }
    if (type === "github") {
      if (!parsedRepo) return toast.show("Vul eigenaar/repo in, bijv. MaartenDeKlerkPXL/Maarten-2.0", "error");
      if (projects.some((p) => p.repo_owner?.toLowerCase() === parsedRepo.owner.toLowerCase() && p.repo_name?.toLowerCase() === parsedRepo.name.toLowerCase())) {
        return toast.show("Deze repo staat al in je projecten", "error");
      }
      const row = await saveProject({
        type: "github", repo_owner: parsedRepo.owner, repo_name: parsedRepo.name,
        naam: naam.trim() || prettyRepoName(parsedRepo.name), categorie: categorie.trim() || null, kleur,
      });
      onClose();
      const r = await syncProjects(row.id);
      if (r) toast.show(r.fouten ? "Repo toegevoegd, maar synchroniseren lukte niet (zie de kaart)" : "Repo toegevoegd en gesynchroniseerd");
      return;
    }
    if (!naam.trim()) return;
    const row = await saveProject({ type: "handmatig", naam: naam.trim(), categorie: categorie.trim() || null, kleur });
    onClose();
    navigate(`/projecten/${row.id}`);
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? "Nieuw project" : "Project bewerken"} footer={<button className="btn btn-primary w-full" onClick={submit}>{isNew ? "Toevoegen" : "Opslaan"}</button>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {isNew && (
          <Field group label="Soort">
            <Segmented options={[{ value: "handmatig", label: "Handmatig" }, { value: "github", label: "GitHub-repo" }]} value={type} onChange={setType} />
          </Field>
        )}
        {type === "github" && isNew && (
          <Field label="Repo" hint="eigenaar/repo of de GitHub-link. De taken komen uit todo.md in de root.">
            <input className="input" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="eigenaar/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
          </Field>
        )}
        <Field label="Naam">
          <input
            className="input" autoFocus={type === "handmatig" && isNew} value={naam} onChange={(e) => setNaam(e.target.value)}
            placeholder={parsedRepo ? prettyRepoName(parsedRepo.name) : "Bijv. Koerierswerk"}
          />
        </Field>
        <Field label="Categorie" hint="Bijv. Klant, Studie, Eigen project. Komt overeen met een Todo-categorie? Dan krijgt “Zet in Todo” die categorie.">
          <input className="input" value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Optioneel" />
        </Field>
        <Field group label="Kleur">
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setKleur(c)} className={`size-8 rounded-full transition ${kleur === c ? "ring-2 ring-white ring-offset-2 ring-offset-surface" : ""}`} style={{ background: c }} aria-label={c} aria-pressed={kleur === c} />
            ))}
          </div>
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

/** Max. 3 focusprojecten: bij een 4e keuze vragen welk project eruit moet. */
export function useFocusToggle() {
  const { projects, updateProject } = useData();
  const [swapFor, setSwapFor] = useState<ProjectSource | null>(null);
  const focus = projects.filter((p) => p.focus_deze_week);
  const toggle = (p: ProjectSource) => {
    haptic(10);
    if (p.focus_deze_week) return updateProject(p.id, { focus_deze_week: false });
    if (focus.length < MAX_FOCUS) return updateProject(p.id, { focus_deze_week: true });
    setSwapFor(p);
  };
  const sheet = swapFor && (
    <Sheet open onClose={() => setSwapFor(null)} title="Welk project moet eruit?">
      <p className="mb-3 text-sm text-muted">
        Je hebt al {MAX_FOCUS} focusprojecten. Kies welk project plaatsmaakt voor <b className="text-text">{swapFor.naam}</b>.
      </p>
      <div className="space-y-2">
        {focus.map((p) => (
          <button
            key={p.id}
            onClick={async () => {
              await updateProject(p.id, { focus_deze_week: false });
              await updateProject(swapFor.id, { focus_deze_week: true });
              setSwapFor(null);
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left transition hover:border-line-strong active:scale-[0.99]"
          >
            <span className="size-3 shrink-0 rounded-full" style={{ background: p.kleur }} />
            <span className="flex-1 font-medium">{p.naam}</span>
            <span className="text-xs text-muted">Eruit</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
  return { toggle, sheet };
}

// ───────────── Pagina ─────────────
export default function Projects() {
  const { projects, syncProjects, reorderProjects } = useData();
  const today = useToday();
  const toast = useToast();
  const index = useProjectIndex();
  const [filter, setFilterState] = useState<Filter>(() => load("projecten.filter", "alle"));
  const [hidePaused, setHidePausedState] = useState<boolean>(() => load("projecten.verbergPauze", false));
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<Partial<ProjectSource> | null>(null);
  const { toggle: toggleFocus, sheet: focusSheet } = useFocusToggle();

  const setFilter = (f: Filter) => {
    setFilterState(f);
    save("projecten.filter", f);
  };
  const setHidePaused = (v: boolean) => {
    setHidePausedState(v);
    save("projecten.verbergPauze", v);
  };

  const sync = async (silent = false) => {
    setSyncing(true);
    const r = await syncProjects();
    setSyncing(false);
    if (r && !silent) {
      const parts = [`${r.bijgewerkt} bijgewerkt`, r.ongewijzigd ? `${r.ongewijzigd} ongewijzigd` : "", r.fouten ? `${r.fouten} met fout` : ""].filter(Boolean);
      toast.show(`Gesynchroniseerd: ${parts.join(", ")}`);
    }
  };

  // Nieuw toegevoegde repo's (nog nooit gesynchroniseerd) meteen ophalen
  const autoSynced = useRef(false);
  useEffect(() => {
    if (autoSynced.current || !projects.some((p) => p.type === "github" && p.sync_status === "nieuw")) return;
    autoSynced.current = true;
    sync(true);
  }, [projects]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(
    () =>
      projects.filter((p) => {
        if (hidePaused && p.gepauzeerd) return false;
        if (filter === "focus") return p.focus_deze_week;
        if (filter === "deadline") return (index.tasks.get(p.id) ?? []).some((t) => !t.afgerond && t.deadline);
        return true;
      }),
    [projects, filter, hidePaused, index],
  );
  const allIds = projects.map((p) => p.id);
  const drag = useDragSort(visible.map((p) => p.id), (ids) => reorderProjects(mergeOrder(allIds, ids)));
  const byId = new Map(projects.map((p) => [p.id, p]));
  // live prioriteitsnummers, ook tijdens het slepen
  const rank = new Map(mergeOrder(allIds, drag.order).map((id, i) => [id, i + 1]));
  const focus = projects.filter((p) => p.focus_deze_week);
  const stalledCount = projects.filter((p) => index.stalled.has(p.id)).length;
  const deadlinesThisWeek = projects.reduce(
    (n, p) => n + (index.tasks.get(p.id) ?? []).filter((t) => !t.afgerond && t.deadline && t.deadline >= today && t.deadline <= addIsoDays(today, 7)).length,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Projecten"
        subtitle={
          projects.length
            ? [`${projects.filter((p) => !p.gepauzeerd).length} actief`, deadlinesThisWeek ? `${deadlinesThisWeek} deadline${deadlinesThisWeek > 1 ? "s" : ""} deze week` : "", stalledCount ? `${stalledCount} ligt stil` : ""].filter(Boolean).join(" · ")
            : "Taken uit je todo.md-bestanden op GitHub"
        }
        action={
          <div className="flex gap-1.5">
            <button onClick={() => sync()} disabled={syncing} className="btn btn-ghost px-3 py-2 text-xs" aria-label="Nu synchroniseren">
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Nu synchroniseren</span>
            </button>
            <button onClick={() => setEditing({})} className="btn btn-primary px-3 py-2 text-xs" aria-label="Nieuw project">
              <Plus className="size-4" /> <span className="hidden sm:inline">Project</span>
            </button>
          </div>
        }
      />

      {projects.length === 0 ? (
        <div className="card">
          <Empty
            icon={<FolderKanban className="size-5" />}
            title="Nog geen projecten"
            text="Voeg een GitHub-repo toe (de taken komen uit todo.md) of maak een handmatig project."
          />
          <div className="flex justify-center pb-6">
            <button onClick={() => setEditing({})} className="btn btn-primary px-4 py-2 text-sm"><Plus className="size-4" /> Project toevoegen</button>
          </div>
        </div>
      ) : (
        <>
          <section className="mb-6">
            <h2 className="section-title mb-3 flex items-center gap-2"><Target className="size-3.5" /> Focus deze week</h2>
            {focus.length === 0 ? (
              <div className="card card-pad flex items-center gap-3 text-sm text-muted">
                <Star className="size-4 shrink-0 text-amber-300" />
                Tik op de ster bij een project om het deze week centraal te zetten (max. {MAX_FOCUS}).
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {focus.map((p) => (
                  <FocusCard key={p.id} project={p} tasks={index.tasks.get(p.id) ?? []} stalled={index.stalled.has(p.id)} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="section-title flex flex-wrap items-center gap-x-2 gap-y-1">
                <FolderKanban className="size-3.5" /> Alle projecten
                <span className="normal-case tracking-normal text-faint">· sleep <GripVertical className="inline size-3" /> om te prioriteren</span>
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="sm:w-[23rem]">
                  <Segmented<Filter> options={[{ value: "alle", label: "Alle" }, { value: "focus", label: "Focus" }, { value: "deadline", label: "Met deadline" }]} value={filter} onChange={setFilter} />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted sm:justify-start">
                  <span>Gepauzeerd verbergen</span>
                  <Toggle checked={hidePaused} onChange={setHidePaused} label="Gepauzeerd verbergen" />
                </div>
              </div>
            </div>
            {visible.length === 0 ? (
              <div className="card"><Empty icon={<FolderKanban className="size-5" />} title="Geen projecten met dit filter" /></div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {drag.order.map((id) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  return (
                    <ProjectCard
                      key={id}
                      project={p}
                      rank={rank.get(id) ?? 0}
                      tasks={index.tasks.get(id) ?? []}
                      stalled={index.stalled.has(id)}
                      dragging={drag.active === id}
                      register={drag.register(id)}
                      handle={drag.handle(id)}
                      onToggleFocus={() => toggleFocus(p)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
      {editing && <ProjectEditor value={editing} onClose={() => setEditing(null)} />}
      {focusSheet}
    </div>
  );
}

