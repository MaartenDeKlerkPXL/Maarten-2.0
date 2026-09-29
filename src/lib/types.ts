export type Source = "user" | "f1" | "roda" | "recurring";

export interface Settings {
  user_id: string;
  display_name: string;
  timezone: string;
  morning_time: string;
  reminder_time: string;
  todo_reminder_minutes: number;
  event_reminder_minutes: number;
  birthday_days_before: number;
  archive_after_days: number;
  water_goal_ml: number;
  water_reminders: boolean;
  water_start: string;
  water_end: string;
  pushup_start_date: string;
  pushup_start_target: number;
  pushup_step: number;
  pushup_goal: number;
  pushup_current_target: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  color: string;
  sort: number;
}

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  category_id: string | null;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  end_time: string | null;
  location: string | null;
  done_at: string | null;
  archived_at: string | null;
  source: Source;
  external_id: string | null;
  is_event: boolean;
  recurring_id: string | null;
  remind_days_before: number[];
  created_at: string;
}

export interface ScheduleItem {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  title: string;
  code: string | null;
  location: string | null;
  category_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  frequency: "daily" | "weekly";
  target_per_week: number;
  planned_days: number[];
  backup_days: number[];
  timer_minutes: number | null;
  sort: number;
  active: boolean;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
}

export interface HabitTimer {
  habit_id: string;
  started_at: string;
  ends_at: string;
}

export interface Birthday {
  id: string;
  name: string;
  day: number;
  month: number;
  year: number | null;
  is_self: boolean;
  notes: string | null;
}

export interface WaterLog {
  id: string;
  log_date: string;
  ml: number;
  label: string | null;
  created_at: string;
}

export interface RecurringTodo {
  id: string;
  title: string;
  notes: string | null;
  category_id: string | null;
  frequency: "monthly" | "weekly";
  day_of_month: number | null;
  weekday: number | null;
  due_time: string | null;
  is_event: boolean;
  remind_until_day: number | null;
  active: boolean;
}

export type ExerciseKind = "weight" | "assist" | "reps" | "time" | "cardio";

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  grp: "warmup" | "kracht" | "core";
  increment_kg: number;
  sort: number;
  active: boolean;
}

export interface Workout {
  id: string;
  workout_date: string;
  notes: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_no: number;
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
  distance_km: number | null;
  level: number | null;
  created_at: string;
}

export interface PushupLog {
  id: string;
  log_date: string;
  reps: number;
  created_at: string;
}
