import { format } from "date-fns";
import { nl } from "date-fns/locale";

export const pad = (n: number) => String(n).padStart(2, "0");

/** Lokale datum als YYYY-MM-DD. */
export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addIsoDays(s: string, n: number): string {
  return iso(addDays(parseIso(s), n));
}

export const todayIso = (d: Date = new Date()) => iso(d);

/** ISO-weekdag: 1 = maandag … 7 = zondag. */
export function isoDow(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

export function weekStart(d: Date): Date {
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -(isoDow(d) - 1));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function minutesOf(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export const fmt = (d: Date | string, pattern: string) =>
  format(typeof d === "string" ? parseIso(d) : d, pattern, { locale: nl });

export const DOW_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
export const DOW_LONG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
export const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
export const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** "Vandaag", "Morgen", "Gisteren", "wo 14 okt" */
export function relativeDay(s: string, today = todayIso()): string {
  const diff = daysBetween(today, s);
  if (diff === 0) return "Vandaag";
  if (diff === 1) return "Morgen";
  if (diff === -1) return "Gisteren";
  if (diff > 1 && diff < 7) return fmt(s, "EEEE");
  const d = parseIso(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return fmt(s, sameYear ? "EEE d MMM" : "d MMM yyyy");
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 6) return "Goedenacht";
  if (h < 12) return "Goedemorgen";
  if (h < 18) return "Goedemiddag";
  return "Goedenavond";
}

/** Eerstvolgende verjaardag (vanaf vandaag), met 29 feb → 28 feb in niet-schrikkeljaren. */
export function nextBirthday(day: number, month: number, from = new Date()): Date {
  const mk = (y: number) => new Date(y, month - 1, Math.min(day, new Date(y, month, 0).getDate()));
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const d = mk(from.getFullYear());
  return d >= start ? d : mk(from.getFullYear() + 1);
}
