import { addDays, addMonths, addYears, differenceInCalendarDays, differenceInMonths, differenceInYears } from "date-fns";
import { parseIso } from "./dates";
import { SCHOOL_BREAKS, type SchoolBreak } from "./holidays";

/** Hoe lang sinds `start`: totalen én een nette opsplitsing (jaren · maanden · weken · dagen). */
export function sinceBreakdown(start: string, today: string) {
  const s = parseIso(start);
  const t = parseIso(today);
  const days = Math.max(0, differenceInCalendarDays(t, s));
  const years = Math.max(0, differenceInYears(t, s));
  const months = Math.max(0, differenceInMonths(t, s));
  const afterMonths = addMonths(addYears(s, years), months - years * 12);
  const rest = Math.max(0, differenceInCalendarDays(t, afterMonths));
  return {
    days,
    weeks: Math.floor(days / 7),
    months,
    years,
    parts: { years, months: months - years * 12, weeks: Math.floor(rest / 7), days: rest % 7 },
  };
}

export const daysUntil = (date: string, today: string) => differenceInCalendarDays(parseIso(date), parseIso(today));

/** Mijlpalen; de gezondheidswinst (volgens de WHO) geldt alleen voor stoppen met roken/nicotine. */
export const QUIT_MILESTONES: { days: number; label: string; benefit: string }[] = [
  { days: 1, label: "1 dag", benefit: "Het koolmonoxide in je bloed is weer normaal." },
  { days: 7, label: "1 week", benefit: "De eerste, zwaarste week zit erop." },
  { days: 14, label: "2 weken", benefit: "Je bloedsomloop en longfunctie beginnen te verbeteren." },
  { days: 30, label: "1 maand", benefit: "Hoesten en kortademigheid nemen af." },
  { days: 90, label: "3 maanden", benefit: "Je longfunctie is merkbaar beter." },
  { days: 182, label: "6 maanden", benefit: "Je longen ruimen zichzelf steeds beter op." },
  { days: 365, label: "1 jaar", benefit: "Je risico op hart- en vaatziekten is gehalveerd." },
  { days: 730, label: "2 jaar", benefit: "Twee jaar rookvrij: een gewoonte voor het leven." },
  { days: 1826, label: "5 jaar", benefit: "Je risico op een beroerte daalt naar dat van een niet-roker." },
  { days: 3652, label: "10 jaar", benefit: "Je risico op longkanker is ongeveer gehalveerd." },
  { days: 5479, label: "15 jaar", benefit: "Je hartrisico is gelijk aan dat van een niet-roker." },
];

export const isNicotineQuit = (titel: string) => /rook|roken|nicotine|sigaret|vape|vapen|snus|tabak/i.test(titel);

export function milestoneProgress(days: number) {
  const reached = [...QUIT_MILESTONES].reverse().find((m) => days >= m.days) ?? null;
  const next = QUIT_MILESTONES.find((m) => days < m.days) ?? null;
  const from = reached?.days ?? 0;
  return { reached, next, pct: next ? (days - from) / (next.days - from) : 1 };
}

/** De eerstvolgende Vlaamse schoolvakantie (of de huidige, als je er middenin zit). */
export function nextBelgianBreak(today: string): SchoolBreak | null {
  return SCHOOL_BREAKS.filter((b) => b.region === "BE" && b.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
}

export const dateOf = (iso: string, days: number) => addDays(parseIso(iso), days);
