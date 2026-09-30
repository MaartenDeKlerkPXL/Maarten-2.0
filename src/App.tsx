import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, Dumbbell, Home, ListTodo, Loader2, Menu, Plus, Sparkles, Target } from "lucide-react";
import { supabase } from "./lib/supabase";
import { DataProvider, useData } from "./lib/store";
import { navigate, usePath } from "./lib/router";
import { refreshPushSubscription } from "./lib/push";
import { EditorProvider, useEditor } from "./components/EditorContext";
import { Sheet } from "./components/Sheet";
import { QuickAdd } from "./components/QuickAdd";
import { Wordmark } from "./components/Logo";
import Login from "./pages/Login";
import Today from "./pages/Today";

const Todos = lazy(() => import("./pages/Todos"));
const AgendaPage = lazy(() => import("./pages/AgendaPage"));
const Goals = lazy(() => import("./pages/Goals"));
const Fitness = lazy(() => import("./pages/Fitness"));
const WorkoutPage = lazy(() => import("./pages/Workout"));
const More = lazy(() => import("./pages/More"));
const Birthdays = lazy(() => import("./pages/more/Birthdays"));
const Schedule = lazy(() => import("./pages/more/Schedule"));
const Recurring = lazy(() => import("./pages/more/Recurring"));
const Archive = lazy(() => import("./pages/more/Archive"));
const Settings = lazy(() => import("./pages/more/Settings"));
const Inspiration = lazy(() => import("./pages/more/Inspiration"));

const ROUTES: Record<string, ComponentType> = {
  "/": Today,
  "/todo": Todos,
  "/agenda": AgendaPage,
  "/doelen": Goals,
  "/fitness": Fitness,
  "/meer": More,
  "/meer/verjaardagen": Birthdays,
  "/meer/rooster": Schedule,
  "/meer/terugkerend": Recurring,
  "/meer/archief": Archive,
  "/meer/instellingen": Settings,
  "/meer/inspiratie": Inspiration,
};

const NAV = [
  { path: "/", label: "Vandaag", icon: Home },
  { path: "/todo", label: "Todo", icon: ListTodo },
  { path: "/agenda", label: "Agenda", icon: CalendarDays },
  { path: "/fitness", label: "Fitness", icon: Dumbbell },
  { path: "/doelen", label: "Doelen", icon: Target, desktopOnly: true },
  { path: "/meer/inspiratie", label: "Inspiratie", icon: Sparkles, desktopOnly: true },
  { path: "/meer", label: "Meer", icon: Menu },
];

const isActive = (path: string, current: string) =>
  path === "/" ? current === "/" : path === "/meer" ? current.startsWith("/meer") && current !== "/meer/inspiratie" : current.startsWith(path);

function Spinner() {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <Loader2 className="size-6 animate-spin text-accent" />
    </div>
  );
}

function Sidebar({ path, onAdd }: { path: string; onAdd: () => void }) {
  const { todos } = useData();
  const open = todos.filter((t) => !t.done_at && !t.is_event).length;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/60 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <Wordmark />
      </div>
      <button onClick={onAdd} className="btn btn-primary mt-8 w-full justify-start py-3">
        <Plus className="size-4" /> Nieuwe taak
        <kbd className="ml-auto rounded-md bg-white/15 px-1.5 text-[10px] font-medium">N</kbd>
      </button>
      <nav className="mt-6 space-y-1">
        {NAV.map((n) => {
          const active = isActive(n.path, path);
          return (
            <button
              key={n.path}
              onClick={() => navigate(n.path)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-accent/15 text-text" : "text-muted hover:bg-white/[0.04] hover:text-text"}`}
            >
              <n.icon className={`size-[18px] ${active ? "text-accent-2" : ""}`} />
              {n.label}
              {n.path === "/todo" && open > 0 && <span className="ml-auto rounded-full bg-surface-3 px-2 py-0.5 text-[11px] tabular text-muted">{open}</span>}
            </button>
          );
        })}
      </nav>
      <p className="mt-auto px-3 text-xs text-faint">Elke dag 1% beter 🚀</p>
    </aside>
  );
}

function TabBar({ path }: { path: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/80 pb-safe backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2">
        {NAV.filter((n) => !n.desktopOnly).map((n) => {
          const active = isActive(n.path, path);
          return (
            <button key={n.path} onClick={() => navigate(n.path)} className="flex flex-col items-center gap-1 pb-1.5 pt-2.5 transition active:scale-90">
              <span className={`grid h-7 w-12 place-items-center rounded-full transition ${active ? "bg-accent/20" : ""}`}>
                <n.icon className={`size-[21px] transition ${active ? "text-accent-2" : "text-faint"}`} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={`text-[10px] font-semibold ${active ? "text-text" : "text-faint"}`}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { newTodo } = useEditor();
  return (
    <Sheet open={open} onClose={onClose} title="Snel toevoegen">
      <QuickAdd
        autoFocus
        onExpand={(d) => {
          onClose();
          newTodo(d);
        }}
      />
      <div className="mt-4 rounded-2xl bg-surface-2 p-3.5 text-xs leading-relaxed text-muted">
        <p className="mb-1 font-semibold text-text">Tips</p>
        <p><b className="text-accent-3">morgen</b>, <b className="text-accent-3">vrijdag</b>, <b className="text-accent-3">12/10</b> of <b className="text-accent-3">12 okt</b> voor een datum</p>
        <p><b className="text-accent-3">14:00</b> of <b className="text-accent-3">9u-17u</b> voor een tijd</p>
        <p><b className="text-accent-3">#werk</b>, <b className="text-accent-3">#school</b>, <b className="text-accent-3">#vrienden</b> voor een categorie · <b className="text-accent-3">!!</b> voor prioriteit</p>
      </div>
    </Sheet>
  );
}

function Shell() {
  const path = usePath();
  const { loading, todos, syncEvents, inspiration, syncAwwwards } = useData();
  const [adding, setAdding] = useState(false);
  const workoutId = path.startsWith("/fitness/training/") ? path.slice("/fitness/training/".length) : null;
  const Page = ROUTES[path] ?? Today;

  // Eerste keer: F1 en Roda JC meteen ophalen i.p.v. te wachten op de cron
  const synced = useRef(false);
  useEffect(() => {
    if (loading || synced.current) return;
    synced.current = true;
    if (!todos.some((t) => t.source === "f1" || t.source === "roda")) syncEvents();
    // Site of the Day van vandaag (Awwwards publiceert rond middernacht UTC) nog niet binnen? Ophalen.
    const utcToday = new Date().toISOString().slice(0, 10);
    if (!inspiration[0] || inspiration[0].sotd_date < utcToday) syncAwwwards();
  }, [loading, todos, syncEvents, inspiration, syncAwwwards]);

  useEffect(() => {
    refreshPushSubscription();
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setAdding(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Sidebar path={path} onAdd={() => setAdding(true)} />
      <main className="px-4 pb-[calc(env(safe-area-inset-bottom)+104px)] pt-[calc(env(safe-area-inset-top)+16px)] sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-[1400px]">
          {loading ? (
            <Spinner />
          ) : (
            <Suspense fallback={<Spinner />}>
              <div key={path} className="animate-fade-in">
                {workoutId ? <WorkoutPage id={workoutId} /> : <Page />}
              </div>
            </Suspense>
          )}
        </div>
      </main>
      {!path.startsWith("/meer") && !path.startsWith("/fitness") && <button
        onClick={() => setAdding(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] right-4 z-40 grid size-14 place-items-center rounded-full bg-gradient-to-br from-accent-2 to-accent text-white shadow-[0_12px_32px_-8px_rgb(59_130_246/0.9)] transition active:scale-90 lg:hidden"
        aria-label="Snel toevoegen"
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>}
      <TabBar path={path} />
      <QuickAddSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Spinner />;
  if (!session) return <Login />;
  return (
    <DataProvider key={session.user.id}>
      <EditorProvider>
        <Shell />
      </EditorProvider>
    </DataProvider>
  );
}
