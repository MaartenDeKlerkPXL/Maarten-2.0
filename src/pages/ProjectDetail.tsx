import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, CirclePause, FolderGit2, FolderKanban, Pencil, Play, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { useData } from "../lib/store";
import { fmt } from "../lib/dates";
import { navigate } from "../lib/router";
import { progressOf, todoUrl } from "../lib/projects";
import type { ProjectTask } from "../lib/types";
import { LineChart } from "../components/Charts";
import { Empty } from "../components/ui";
import { useToast } from "../components/Toast";
import { ProgressBar, ProjectLinks, ProjectNotices, TaskLine, syncedAgo, useProjectIndex } from "../components/ProjectBits";
import { ProjectEditor, useFocusToggle } from "./Projects";

function Section({ title, tasks, render }: { title: string | null; tasks: ProjectTask[]; render: (t: ProjectTask) => ReactNode }) {
  const [showDone, setShowDone] = useState(false);
  const open = tasks.filter((t) => !t.afgerond);
  const done = tasks.filter((t) => t.afgerond);
  const { done: d, total } = progressOf(tasks);
  return (
    <section className="card card-pad">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title ?? "Taken"}</h3>
        <span className="text-xs tabular text-muted">{d}/{total}</span>
      </div>
      {open.length === 0 && <p className="px-2 py-1 text-sm text-muted">Alles afgevinkt 🎉</p>}
      <div className="-mx-2">{open.map(render)}</div>
      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone((v) => !v)} className="mt-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-medium text-muted transition hover:text-text" aria-expanded={showDone}>
            <ChevronDown className={`size-3.5 transition ${showDone ? "rotate-180" : ""}`} />
            {done.length} afgerond
          </button>
          {showDone && <div className="-mx-2">{done.map(render)}</div>}
        </>
      )}
    </section>
  );
}

export default function ProjectDetail({ id }: { id: string }) {
  const { projects, updateProject, deleteProject, syncProjects, addProjectTask, deleteProjectTask } = useData();
  const toast = useToast();
  const index = useProjectIndex();
  const project = projects.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [draft, setDraft] = useState("");
  const { toggle: toggleFocus, sheet: focusSheet } = useFocusToggle();
  const tasks = useMemo(() => index.tasks.get(id) ?? [], [index, id]);
  const history = index.progress.get(id) ?? [];

  const sections = useMemo(() => {
    const out: { title: string | null; tasks: ProjectTask[] }[] = [];
    for (const t of tasks) {
      const last = out[out.length - 1];
      if (last && last.title === t.sectie) last.tasks.push(t);
      else {
        const existing = out.find((s) => s.title === t.sectie);
        if (existing) existing.tasks.push(t);
        else out.push({ title: t.sectie, tasks: [t] });
      }
    }
    return out;
  }, [tasks]);

  if (!project) {
    return (
      <div className="card">
        <Empty icon={<FolderKanban className="size-5" />} title="Project niet gevonden" text="Misschien is het verwijderd." />
        <div className="flex justify-center pb-6"><button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => navigate("/projecten")}>Naar Projecten</button></div>
      </div>
    );
  }

  const manual = project.type === "handmatig";
  const points = history.map((r) => ({ label: fmt(r.datum, "d MMM"), value: Math.round(Number(r.voortgang) * 100), tooltip: `${r.afgerond}/${r.totaal} taken` }));
  const file = todoUrl(project);

  const sync = async () => {
    setSyncing(true);
    const r = await syncProjects(project.id);
    setSyncing(false);
    if (r) toast.show(r.fouten ? "Synchroniseren mislukt, zie de melding" : r.bijgewerkt ? "Bijgewerkt vanuit todo.md" : r.geen_todo ? "Nog geen todo.md gevonden" : "Geen wijzigingen");
  };

  const add = async () => {
    if (!draft.trim()) return;
    await addProjectTask(project.id, draft);
    setDraft("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <button onClick={() => navigate("/projecten")} className="-ml-1 mb-2 inline-flex items-center gap-0.5 text-sm font-medium text-accent-2">
          <ChevronLeft className="size-4" /> Projecten
        </button>
        <div className="flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${project.kleur}26`, color: project.kleur }}>
            {manual ? <FolderKanban className="size-5" /> : <FolderGit2 className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">{project.naam}</h1>
            <p className="mt-0.5 truncate text-sm text-muted">
              {[project.categorie, manual ? "Handmatig project" : `${project.repo_owner}/${project.repo_name}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
          <button onClick={() => toggleFocus(project)} className={`btn px-3 py-2 text-xs ${project.focus_deze_week ? "bg-amber-400/15 text-amber-200" : "btn-ghost"}`} aria-pressed={project.focus_deze_week}>
            <Star className="size-4" fill={project.focus_deze_week ? "currentColor" : "none"} /> {project.focus_deze_week ? "In focus" : "Focus deze week"}
          </button>
          <button
            onClick={() => updateProject(project.id, { gepauzeerd: !project.gepauzeerd })} className="btn btn-ghost px-3 py-2 text-xs"
            aria-pressed={project.gepauzeerd} aria-label={project.gepauzeerd ? "Hervatten" : "Pauzeren"} title={project.gepauzeerd ? "Hervatten" : "Pauzeren"}
          >
            {project.gepauzeerd ? <Play className="size-4" /> : <CirclePause className="size-4" />} <span className="hidden sm:inline">{project.gepauzeerd ? "Hervatten" : "Pauzeren"}</span>
          </button>
          {!manual && (
            <button onClick={sync} disabled={syncing} className="btn btn-ghost px-3 py-2 text-xs" aria-label="Synchroniseren" title="Synchroniseren">
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Synchroniseren</span>
            </button>
          )}
          <button onClick={() => setEditing(true)} className="btn btn-ghost px-3 py-2 text-xs" aria-label="Bewerken" title="Bewerken">
            <Pencil className="size-4" /> <span className="hidden sm:inline">Bewerken</span>
          </button>
          <button
            onClick={async () => {
              if (!confirm(`“${project.naam}” verwijderen?${manual ? " Alle taken gaan verloren." : " De repo zelf blijft gewoon bestaan."}`)) return;
              navigate("/projecten");
              await deleteProject(project.id);
            }}
            className="btn btn-ghost px-3 py-2 text-xs text-red-300"
            aria-label="Verwijderen" title="Verwijderen"
          >
            <Trash2 className="size-4" /> <span className="hidden sm:inline">Verwijderen</span>
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-2 empty:hidden">
        <ProjectNotices project={project} stalled={index.stalled.has(project.id)} />
      </div>

      <section className="card card-pad space-y-4">
        <ProgressBar tasks={tasks} color={project.kleur} size="lg" />
        {project.beschrijving && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{project.beschrijving}</p>}
        {points.length > 1 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Voortgang door de tijd</p>
            <LineChart points={points} color={project.kleur} height={130} format={(v) => `${v}%`} axisFormat={(v) => `${Math.round(v)}%`} />
          </div>
        ) : (
          <p className="text-xs text-faint">De grafiek verschijnt zodra er een paar dagen voortgang is bijgehouden.</p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-[11px] text-faint">{manual ? "Taken beheer je hier" : syncedAgo(project.laatste_sync)}</span>
          <ProjectLinks project={project} />
        </div>
      </section>

      {manual && (
        <form className="card flex items-center gap-2 p-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-faint"
            placeholder="Taak toevoegen… (!! · #tag · 20 okt)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Nieuwe taak"
          />
          <button type="submit" className="btn btn-primary p-2.5" disabled={!draft.trim()} aria-label="Toevoegen"><Plus className="size-4" /></button>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="card">
          <Empty
            icon={<FolderKanban className="size-5" />}
            title="Nog geen taken"
            text={manual ? "Voeg hierboven je eerste taak toe." : project.sync_status === "geen_todo" ? "Maak een todo.md in de root van de repo met regels als “- [ ] taak”." : "Er staan nog geen taken (- [ ] …) in todo.md."}
          />
        </div>
      ) : (
        sections.map((s) => (
          <Section
            key={s.title ?? "_"}
            title={s.title}
            tasks={s.tasks}
            render={(t) => <TaskLine key={t.id} task={t} project={project} onDelete={manual ? () => deleteProjectTask(t) : undefined} />}
          />
        ))
      )}

      {!manual && tasks.length > 0 && (
        <p className="pb-2 text-center text-xs text-faint">
          Taken uit todo.md zijn alleen-lezen. Afvinken doe je in de repo{file ? <> (<a href={file} target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">todo.md openen</a>)</> : null}.
        </p>
      )}

      {editing && <ProjectEditor value={project} onClose={() => setEditing(false)} />}
      {focusSheet}
    </div>
  );
}
