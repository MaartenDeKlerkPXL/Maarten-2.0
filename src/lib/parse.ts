import type { Category } from "./types";
import { addDays, iso, isoDow, pad, relativeDay } from "./dates";

export const PRIORITY_LABELS = ["Geen", "Belangrijk", "Hoog", "Urgent"];

export interface ParsedTodo {
  title: string;
  due_date: string | null;
  due_time: string | null;
  end_time: string | null;
  category_id: string | null;
  priority: number;
  hints: { icon: string; text: string }[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mrt: 3, maa: 3, apr: 4, mei: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12,
};
const WEEKDAYS: Record<string, number> = {
  maandag: 1, ma: 1, dinsdag: 2, di: 2, woensdag: 3, wo: 3, donderdag: 4, do: 4,
  vrijdag: 5, vr: 5, zaterdag: 6, za: 6, zondag: 7,
};
const TIME = String.raw`(\d{1,2})(?:[:.](\d{2})|u(\d{2})?)`;

function toTime(h: string, m1?: string, m2?: string): string | null {
  const hh = Number(h);
  const mm = Number(m1 ?? m2 ?? 0);
  if (hh > 23 || mm > 59) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

/**
 * Snel toevoegen met gewone taal, bv:
 *  "Tandarts morgen 14:00 #persoonlijk"   "Werk za 9u-17u #werk"   "Verslag inleveren 12/10 !!"
 */
export function parseQuickAdd(input: string, categories: Category[], now = new Date()): ParsedTodo {
  let text = ` ${input} `;
  const cut = (re: RegExp) => {
    const m = text.match(re);
    if (m) text = text.replace(m[0], " ");
    return m;
  };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let due_date: string | null = null;
  let due_time: string | null = null;
  let end_time: string | null = null;
  let category_id: string | null = null;
  let priority = 0;

  // tijden
  const range = cut(new RegExp(String.raw`\s(?:om|van)?\s*${TIME}\s*(?:-|–|tot)\s*${TIME}(?=\s)`, "i"));
  if (range) {
    due_time = toTime(range[1], range[2], range[3]);
    end_time = toTime(range[4], range[5], range[6]);
  } else {
    const single = cut(new RegExp(String.raw`\s(?:om\s+)?${TIME}(?=\s)`, "i"));
    if (single) due_time = toTime(single[1], single[2], single[3]);
  }

  // datums
  const rel = cut(/\s(vandaag|overmorgen|morgen)(?=\s)/i);
  if (rel) {
    const word = rel[1].toLowerCase();
    due_date = iso(addDays(today, word === "vandaag" ? 0 : word === "morgen" ? 1 : 2));
  }
  if (!due_date) {
    const dm = cut(/\s(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?(?=\s)/);
    if (dm) {
      const d = Number(dm[1]);
      const m = Number(dm[2]);
      let y = dm[3] ? Number(dm[3]) : today.getFullYear();
      if (y < 100) y += 2000;
      let date = new Date(y, m - 1, d);
      if (!dm[3] && date < today) date = new Date(y + 1, m - 1, d);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) due_date = iso(date);
    }
  }
  if (!due_date) {
    const dm = cut(/\s(\d{1,2})\s+(jan|feb|mrt|maa|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?(?=\s)/i);
    if (dm) {
      const m = MONTHS[dm[2].toLowerCase()];
      const y = dm[3] ? Number(dm[3]) : today.getFullYear();
      let date = new Date(y, m - 1, Number(dm[1]));
      if (!dm[3] && date < today) date = new Date(y + 1, m - 1, Number(dm[1]));
      due_date = iso(date);
    }
  }
  if (!due_date) {
    const wd = cut(/\s(?:op\s+)?(volgende\s+)?(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vr|za)(?=\s)/i);
    if (wd) {
      const target = WEEKDAYS[wd[2].toLowerCase()];
      let diff = (target - isoDow(today) + 7) % 7;
      if (diff === 0) diff = 7;
      if (wd[1]) diff += diff < 7 ? 7 : 0;
      due_date = iso(addDays(today, diff));
    }
  }
  if (due_time && !due_date) due_date = iso(today);

  // categorie
  const tag = cut(/\s#([\p{L}\d-]+)(?=\s)/u);
  if (tag) {
    const q = tag[1].toLowerCase();
    const cat =
      categories.find((c) => c.slug === q) ??
      categories.find((c) => c.name.toLowerCase().replace(/\s/g, "").startsWith(q));
    if (cat) category_id = cat.id;
    else text += ` #${tag[1]}`;
  }

  // prioriteit
  const prio = cut(/\s(!{1,3}|![1-3])(?=\s)/);
  if (prio) priority = prio[1].length > 1 && /\d/.test(prio[1]) ? Number(prio[1][1]) : prio[1].length;

  const title = text.replace(/\s+/g, " ").trim();
  const hints: ParsedTodo["hints"] = [];
  if (due_date) hints.push({ icon: "calendar", text: relativeDay(due_date) });
  if (due_time) hints.push({ icon: "clock", text: end_time ? `${due_time}–${end_time}` : due_time });
  if (category_id) hints.push({ icon: "tag", text: categories.find((c) => c.id === category_id)!.name });
  if (priority) hints.push({ icon: "flag", text: PRIORITY_LABELS[priority] });

  return { title, due_date, due_time, end_time, category_id, priority, hints };
}
