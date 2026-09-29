import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { addIsoDays, todayIso } from "./dates";
import { useToast } from "../components/Toast";
import type {
  Birthday, Category, Exercise, Habit, HabitLog, HabitTimer, PushupLog, RecurringTodo, ScheduleItem, Settings, Todo,
  WaterLog, Workout, WorkoutSet,
} from "./types";

interface DataState {
  loading: boolean;
  settings: Settings | null;
  categories: Category[];
  todos: Todo[];
  schedule: ScheduleItem[];
  habits: Habit[];
  habitLogs: HabitLog[];
  timers: HabitTimer[];
  birthdays: Birthday[];
  water: WaterLog[];
  recurring: RecurringTodo[];
  exercises: Exercise[];
  workouts: Workout[];
  sets: WorkoutSet[];
  pushups: PushupLog[];
}

const EMPTY: DataState = {
  loading: true, settings: null, categories: [], todos: [], schedule: [], habits: [], habitLogs: [],
  timers: [], birthdays: [], water: [], recurring: [], exercises: [], workouts: [], sets: [], pushups: [],
};

type ListKey = Exclude<keyof DataState, "loading" | "settings">;
const TABLES: Record<ListKey, string> = {
  categories: "categories", todos: "todos", schedule: "schedule_items", habits: "habits", habitLogs: "habit_logs",
  timers: "habit_timers", birthdays: "birthdays", water: "water_logs", recurring: "recurring_todos",
  exercises: "exercises", workouts: "workouts", sets: "workout_sets", pushups: "pushup_logs",
};

export type NewTodo = Partial<Omit<Todo, "id">> & { title: string };

function useDataStore() {
  const toast = useToast();
  const [state, setState] = useState<DataState>(EMPTY);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastLoad = useRef(0);

  const fail = useCallback((e: unknown) => {
    console.error(e);
    toast.show((e as { message?: string })?.message ?? "Er ging iets mis", "error");
  }, [toast]);

  const refresh = useCallback(async () => {
    lastLoad.current = Date.now();
    const since = addIsoDays(todayIso(), -400);
    const q = <T,>(p: PromiseLike<{ data: T | null; error: unknown }>) =>
      Promise.resolve(p).then((r) => {
        if (r.error) throw r.error;
        return r.data as T;
      });
    try {
      const [settings, categories, todos, schedule, habits, habitLogs, timers, birthdays, water, recurring, exercises, workouts, sets, pushups] = await Promise.all([
        q<Settings>(supabase.from("settings").select("*").maybeSingle()),
        q<Category[]>(supabase.from("categories").select("*").order("sort")),
        q<Todo[]>(supabase.from("todos").select("*").is("archived_at", null).order("due_date", { nullsFirst: false }).limit(2000)),
        q<ScheduleItem[]>(supabase.from("schedule_items").select("*").order("weekday").order("start_time")),
        q<Habit[]>(supabase.from("habits").select("*").order("sort")),
        q<HabitLog[]>(supabase.from("habit_logs").select("id, habit_id, log_date").gte("log_date", since).limit(5000)),
        q<HabitTimer[]>(supabase.from("habit_timers").select("*")),
        q<Birthday[]>(supabase.from("birthdays").select("*").order("month").order("day")),
        q<WaterLog[]>(supabase.from("water_logs").select("*").gte("log_date", since).order("created_at").limit(10000)),
        q<RecurringTodo[]>(supabase.from("recurring_todos").select("*").order("created_at")),
        q<Exercise[]>(supabase.from("exercises").select("*").order("sort")),
        q<Workout[]>(supabase.from("workouts").select("*").gte("workout_date", since).order("workout_date").limit(2000)),
        q<WorkoutSet[]>(supabase.from("workout_sets").select("*").gte("created_at", `${since}T00:00:00Z`).order("created_at").limit(20000)),
        q<PushupLog[]>(supabase.from("pushup_logs").select("*").gte("log_date", since).order("created_at").limit(10000)),
      ]);
      setState({ loading: false, settings, categories, todos, schedule, habits, habitLogs, timers, birthdays, water, recurring, exercises, workouts, sets, pushups });
    } catch (e) {
      setState((s) => ({ ...s, loading: false }));
      fail(e);
    }
  }, [fail]);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > 20_000) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  // ── generieke helpers (optimistisch bijwerken, bij fout opnieuw laden)
  const setList = useCallback(<K extends ListKey>(key: K, fn: (list: DataState[K]) => DataState[K]) => {
    setState((s) => ({ ...s, [key]: fn(s[key]) }));
  }, []);

  const upsert = useCallback(async <K extends ListKey>(key: K, row: DataState[K][number] & { id?: string }) => {
    const idKey = key === "timers" ? "habit_id" : "id";
    const full = { ...row } as Record<string, unknown>;
    if (idKey === "id" && !full.id) full.id = crypto.randomUUID();
    setList(key, (list) => {
      const arr = list as unknown as Record<string, unknown>[];
      const i = arr.findIndex((x) => x[idKey] === full[idKey]);
      const next = [...arr];
      if (i >= 0) next[i] = { ...next[i], ...full };
      else next.push(full);
      return next as unknown as DataState[K];
    });
    const { error } = await supabase.from(TABLES[key]).upsert(full);
    if (error) {
      fail(error);
      refresh();
    }
    return full as unknown as DataState[K][number];
  }, [fail, refresh, setList]);

  const patchRow = useCallback(async <K extends ListKey>(key: K, id: string, patch: Record<string, unknown>) => {
    setList(key, (list) =>
      (list as unknown as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) as unknown as DataState[K]);
    const { error } = await supabase.from(TABLES[key]).update(patch).eq("id", id);
    if (error) {
      fail(error);
      refresh();
    }
  }, [fail, refresh, setList]);

  const removeRow = useCallback(async (key: ListKey, id: string, idKey = "id") => {
    setList(key, (list) => (list as unknown as Record<string, unknown>[]).filter((x) => x[idKey] !== id) as never);
    const { error } = await supabase.from(TABLES[key]).delete().eq(idKey, id);
    if (error) {
      fail(error);
      refresh();
    }
  }, [fail, refresh, setList]);

  // ── Todo's
  const addTodo = useCallback((t: NewTodo) => {
    const row = {
      id: crypto.randomUUID(), notes: null, category_id: null, priority: 0, due_date: null, due_time: null,
      end_time: null, location: null, done_at: null, archived_at: null, source: "user" as const, external_id: null,
      is_event: false, recurring_id: null, remind_days_before: [], created_at: new Date().toISOString(), ...t,
    };
    return upsert("todos", row as Todo);
  }, [upsert]);

  const updateTodo = useCallback((id: string, patch: Partial<Todo>) => patchRow("todos", id, patch), [patchRow]);

  const toggleTodo = useCallback((todo: Todo) => {
    const done_at = todo.done_at ? null : new Date().toISOString();
    return patchRow("todos", todo.id, { done_at });
  }, [patchRow]);

  const removeTodo = useCallback((todo: Todo) => {
    // automatisch toegevoegde items (F1/Roda/terugkerend) archiveren, anders komen ze bij de volgende sync terug
    if (todo.source !== "user") {
      setList("todos", (l) => l.filter((x) => x.id !== todo.id));
      return supabase.from("todos").update({ archived_at: new Date().toISOString() }).eq("id", todo.id).then(({ error }) => error && fail(error));
    }
    return removeRow("todos", todo.id);
  }, [fail, removeRow, setList]);

  // ── Gewoontes
  const toggleHabit = useCallback(async (habitId: string, date: string) => {
    const existing = state.habitLogs.find((l) => l.habit_id === habitId && l.log_date === date);
    if (existing) return removeRow("habitLogs", existing.id);
    return upsert("habitLogs", { id: crypto.randomUUID(), habit_id: habitId, log_date: date });
  }, [removeRow, state.habitLogs, upsert]);

  const refreshHabitLogs = useCallback(async () => {
    const { data } = await supabase.from("habit_logs").select("id, habit_id, log_date").gte("log_date", addIsoDays(todayIso(), -400)).limit(5000);
    if (data) setState((s) => ({ ...s, habitLogs: data as HabitLog[] }));
  }, []);

  /** Idempotent afvinken (timer klaar, training gelogd): nooit dubbel, ook niet als de server het al deed. */
  const setHabitDone = useCallback(async (habitId: string, date: string) => {
    if (stateRef.current.habitLogs.some((l) => l.habit_id === habitId && l.log_date === date)) return;
    const row = { id: crypto.randomUUID(), habit_id: habitId, log_date: date };
    setList("habitLogs", (l) => [...l, row]);
    const { error } = await supabase.from("habit_logs").upsert(row, { onConflict: "habit_id,log_date", ignoreDuplicates: true });
    if (error) fail(error);
    refreshHabitLogs();
  }, [fail, setList, refreshHabitLogs]);


  const startTimer = useCallback((habit: Habit) => {
    const now = Date.now();
    return upsert("timers", {
      habit_id: habit.id,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + (habit.timer_minutes ?? 15) * 60_000).toISOString(),
    });
  }, [upsert]);

  const stopTimer = useCallback((habitId: string) => removeRow("timers", habitId, "habit_id"), [removeRow]);

  const saveHabit = useCallback((h: Partial<Habit> & { name: string }) => upsert("habits", h as Habit), [upsert]);
  const deleteHabit = useCallback((id: string) => removeRow("habits", id), [removeRow]);

  // ── Water
  const addWater = useCallback((ml: number, label: string | null) =>
    upsert("water", { id: crypto.randomUUID(), log_date: todayIso(), ml, label, created_at: new Date().toISOString() }), [upsert]);
  const removeWater = useCallback((id: string) => removeRow("water", id), [removeRow]);

  // ── Pushups
  const addPushups = useCallback((reps: number) =>
    upsert("pushups", { id: crypto.randomUUID(), log_date: todayIso(), reps, created_at: new Date().toISOString() }), [upsert]);
  const removePushup = useCallback((id: string) => removeRow("pushups", id), [removeRow]);

  // ── Fitness
  const createWorkout = useCallback((date: string) =>
    upsert("workouts", { id: crypto.randomUUID(), workout_date: date, notes: null, finished_at: null, created_at: new Date().toISOString() }), [upsert]);
  const updateWorkout = useCallback((id: string, patch: Partial<Workout>) => patchRow("workouts", id, patch), [patchRow]);
  const deleteWorkout = useCallback(async (id: string) => {
    setList("sets", (l) => l.filter((x) => x.workout_id !== id));
    await removeRow("workouts", id);
  }, [removeRow, setList]);
  const saveSet = useCallback((set: Partial<WorkoutSet> & { workout_id: string; exercise_id: string }) =>
    upsert("sets", {
      id: crypto.randomUUID(), set_no: 1, weight_kg: null, reps: null, seconds: null, distance_km: null, level: null,
      created_at: new Date().toISOString(), ...set,
    } as WorkoutSet), [upsert]);
  const deleteSet = useCallback((id: string) => removeRow("sets", id), [removeRow]);
  const saveExercise = useCallback((e: Partial<Exercise> & { name: string }) =>
    upsert("exercises", { kind: "weight", grp: "kracht", increment_kg: 2.5, active: true, sort: 100, ...e } as Exercise), [upsert]);

  // ── Verjaardagen, rooster, categorieën
  const saveBirthday = useCallback((b: Partial<Birthday> & { name: string }) =>
    upsert("birthdays", { year: null, is_self: false, notes: null, ...b } as Birthday), [upsert]);
  const deleteBirthday = useCallback((id: string) => removeRow("birthdays", id), [removeRow]);
  const saveSchedule = useCallback((s: Partial<ScheduleItem> & { title: string }) =>
    upsert("schedule", { code: null, location: null, category_id: null, valid_from: null, valid_until: null, ...s } as ScheduleItem), [upsert]);
  const deleteSchedule = useCallback((id: string) => removeRow("schedule", id), [removeRow]);
  const saveCategory = useCallback((c: Category) => upsert("categories", c), [upsert]);

  // ── Terugkerende taken
  const reloadTodos = useCallback(async () => {
    const { data, error } = await supabase.from("todos").select("*").is("archived_at", null).limit(2000);
    if (error) return fail(error);
    setState((s) => ({ ...s, todos: data as Todo[] }));
  }, [fail]);

  const saveRecurring = useCallback(async (r: Partial<RecurringTodo> & { title: string }) => {
    const row = await upsert("recurring", { notes: null, due_time: null, is_event: false, remind_until_day: null, active: true, ...r } as RecurringTodo);
    // toekomstige, nog open exemplaren bijwerken naar de nieuwe instellingen
    await supabase.from("todos").delete().eq("recurring_id", row.id).is("done_at", null).gte("due_date", todayIso());
    await supabase.rpc("generate_my_recurring");
    await reloadTodos();
  }, [reloadTodos, upsert]);

  const deleteRecurring = useCallback(async (id: string) => {
    await supabase.from("todos").delete().eq("recurring_id", id).is("done_at", null).gte("due_date", todayIso());
    await removeRow("recurring", id);
    await reloadTodos();
  }, [reloadTodos, removeRow]);

  // ── Instellingen
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setState((s) => (s.settings ? { ...s, settings: { ...s.settings, ...patch } } : s));
    const { error } = await supabase.from("settings").update(patch).eq("user_id", state.settings?.user_id ?? "");
    if (error) fail(error);
  }, [fail, state.settings?.user_id]);

  // ── Sync F1 / Roda
  const syncEvents = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("sync-events", { body: {} });
    if (error) {
      fail(error);
      return null;
    }
    await reloadTodos();
    return data as { f1: number; roda: number; upserted: number };
  }, [fail, reloadTodos]);

  return {
    ...state, refresh, reloadTodos,
    addTodo, updateTodo, toggleTodo, removeTodo,
    toggleHabit, setHabitDone, startTimer, stopTimer, saveHabit, deleteHabit,
    addWater, removeWater, addPushups, removePushup,
    createWorkout, updateWorkout, deleteWorkout, saveSet, deleteSet, saveExercise,
    saveBirthday, deleteBirthday, saveSchedule, deleteSchedule, saveCategory,
    saveRecurring, deleteRecurring,
    updateSettings, syncEvents,
  };
}

export type DataStore = ReturnType<typeof useDataStore>;
const DataContext = createContext<DataStore | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const store = useDataStore();
  return <DataContext.Provider value={store}>{children}</DataContext.Provider>;
}

export function useData(): DataStore {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData buiten DataProvider");
  return ctx;
}

export function useCategoryMap() {
  const { categories } = useData();
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}
