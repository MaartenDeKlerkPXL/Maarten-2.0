// Parser voor todo.md-bestanden. Gedeeld door de edge function (sync-project-todos)
// en de app (handmatige projecttaken). Geen imports: draait in Deno én in de browser.
//
//   # Kop / ## Sub      → sectie
//   - [ ] taak          → open        - [x] taak → afgerond
//   !, !!, !!! of !1–!3 → prioriteit  #tag → tag
//   2026-10-20 · 20-10-2026 · 20/10 · 20 okt · vr 20 okt → deadline
//   overige alinea's    → projectbeschrijving

export interface ParsedTask {
  sectie: string | null;
  tekst: string;
  afgerond: boolean;
  prioriteit: number;
  tags: string[];
  deadline: string | null;
  volgorde: number;
}

export interface ParsedTodoFile {
  beschrijving: string | null;
  tasks: ParsedTask[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mrt: 3, maa: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12,
};
const WEEKDAY = String.raw`(?:(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vr|za|zo)\.?,?\s+)?`;

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? isoOf(y, m, d) : null;
}

/** Zonder jaartal: het jaar waarbij de datum het dichtst bij `today` ligt (deadlines springen niet een jaar vooruit). */
function nearestYear(m: number, d: number, today: string): string | null {
  const y = Number(today.slice(0, 4));
  const t = Date.parse(`${today}T00:00:00Z`);
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const yy of [y - 1, y, y + 1]) {
    const iso = validDate(yy, m, d);
    if (!iso) continue;
    const diff = Math.abs(Date.parse(`${iso}T00:00:00Z`) - t);
    if (diff < bestDiff) {
      best = iso;
      bestDiff = diff;
    }
  }
  return best;
}

/** Haal markeringen uit één taakregel (ook gebruikt bij handmatige taken in de app). */
export function parseTaskText(input: string, today: string): { tekst: string; prioriteit: number; tags: string[]; deadline: string | null } {
  let text = ` ${input} `;
  const cut = (re: RegExp) => {
    const m = text.match(re);
    if (m) text = text.replace(m[0], " ");
    return m;
  };

  let deadline: string | null = null;
  const isoM = cut(/\s(\d{4})-(\d{1,2})-(\d{1,2})(?=[\s,.;)]|$)/);
  if (isoM) deadline = validDate(Number(isoM[1]), Number(isoM[2]), Number(isoM[3]));
  if (!deadline) {
    const m = cut(new RegExp(String.raw`\s${WEEKDAY}(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?(?=[\s,.;)]|$)`, "i"));
    if (m) {
      let y = m[3] ? Number(m[3]) : null;
      if (y !== null && y < 100) y += 2000;
      deadline = y !== null ? validDate(y, Number(m[2]), Number(m[1])) : nearestYear(Number(m[2]), Number(m[1]), today);
    }
  }
  if (!deadline) {
    const m = cut(new RegExp(String.raw`\s${WEEKDAY}(\d{1,2})\s+(jan|feb|mrt|maa|mar|apr|mei|may|jun|jul|aug|sep|okt|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?(?=[\s,.;)]|$)`, "i"));
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      deadline = m[3] ? validDate(Number(m[3]), mo, Number(m[1])) : nearestYear(mo, Number(m[1]), today);
    }
  }

  let prioriteit = 0;
  const prio = cut(/\s(!{1,3}|![1-3])(?=\s)/);
  if (prio) prioriteit = /\d/.test(prio[1]) ? Number(prio[1][1]) : prio[1].length;

  const tags: string[] = [];
  for (;;) {
    const t = cut(/\s#([\p{L}\d_-]*\p{L}[\p{L}\d_-]*)(?=[\s,.;)]|$)/u); // #12 (issue) is geen tag
    if (!t) break;
    if (!tags.includes(t[1])) tags.push(t[1]);
  }

  const tekst = text.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  return { tekst, prioriteit, tags, deadline };
}

/** Eenvoudige markdown → platte tekst (links, nadruk, code). */
function plain(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[\s(])[*_](\S(?:.*?\S)?)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

const TASK_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;

export function parseTodoMarkdown(md: string, today: string): ParsedTodoFile {
  const lines = md.replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const tasks: ParsedTask[] = [];
  const desc: string[] = [];
  let sectie: string | null = null;
  let inCode = false;
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) desc.push(paragraph.join(" "));
    paragraph = [];
  };

  for (const raw of lines) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inCode = !inCode;
      flush();
      continue;
    }
    if (inCode) continue;

    const h = raw.match(HEADING_RE);
    if (h) {
      flush();
      sectie = plain(h[2]) || null;
      continue;
    }
    const t = raw.match(TASK_RE);
    if (t) {
      flush();
      const parsed = parseTaskText(plain(t[2]), today);
      if (!parsed.tekst) continue;
      tasks.push({ sectie, ...parsed, afgerond: t[1] !== " ", volgorde: tasks.length });
      continue;
    }
    const line = raw.trim();
    if (!line || /^([-*_])\1{2,}$/.test(line) || /^\|/.test(line) || /^>\s*$/.test(line)) {
      flush();
      continue;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      desc.push(`• ${plain(line.replace(/^([-*+]|\d+[.)])\s+/, ""))}`);
      continue;
    }
    paragraph.push(plain(line.replace(/^>\s?/, "")));
  }
  flush();

  const beschrijving = desc.join("\n").trim().slice(0, 2000) || null;
  return { beschrijving, tasks };
}
