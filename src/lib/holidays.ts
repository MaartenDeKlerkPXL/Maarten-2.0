import { addIsoDays, iso } from "./dates";

export type Country = "NL" | "BE";
export interface Holiday {
  date: string;
  name: string;
  countries: Country[];
}

function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const cache = new Map<number, Holiday[]>();

export function holidaysForYear(year: number): Holiday[] {
  const hit = cache.get(year);
  if (hit) return hit;
  const e = easter(year);
  const rel = (n: number) => iso(new Date(e.getFullYear(), e.getMonth(), e.getDate() + n));
  const fixed = (m: number, d: number) => iso(new Date(year, m - 1, d));
  const kingsDay = new Date(year, 3, 27).getDay() === 0 ? fixed(4, 26) : fixed(4, 27);

  const list: Holiday[] = [
    { date: fixed(1, 1), name: "Nieuwjaar", countries: ["NL", "BE"] },
    { date: rel(-2), name: "Goede Vrijdag", countries: ["NL"] },
    { date: rel(0), name: "Pasen", countries: ["NL", "BE"] },
    { date: rel(1), name: "Tweede Paasdag", countries: ["NL", "BE"] },
    { date: kingsDay, name: "Koningsdag", countries: ["NL"] },
    { date: fixed(5, 1), name: "Dag van de Arbeid", countries: ["BE"] },
    { date: fixed(5, 5), name: "Bevrijdingsdag", countries: ["NL"] },
    { date: rel(39), name: "Hemelvaartsdag", countries: ["NL", "BE"] },
    { date: rel(49), name: "Pinksteren", countries: ["NL", "BE"] },
    { date: rel(50), name: "Tweede Pinksterdag", countries: ["NL", "BE"] },
    { date: fixed(7, 11), name: "Vlaamse feestdag", countries: ["BE"] },
    { date: fixed(7, 21), name: "Nationale feestdag", countries: ["BE"] },
    { date: fixed(8, 15), name: "O.L.V. Hemelvaart", countries: ["BE"] },
    { date: fixed(11, 1), name: "Allerheiligen", countries: ["BE"] },
    { date: fixed(11, 11), name: "Wapenstilstand", countries: ["BE"] },
    { date: fixed(12, 25), name: "Kerstmis", countries: ["NL", "BE"] },
    { date: fixed(12, 26), name: "Tweede Kerstdag", countries: ["NL"] },
  ];
  cache.set(year, list);
  return list;
}

export function holidaysOn(date: string): Holiday[] {
  return holidaysForYear(Number(date.slice(0, 4))).filter((h) => h.date === date);
}

export function holidayLabel(h: Holiday): string {
  return `${h.name} (${h.countries.join("/")})`;
}

export function isBelgianHoliday(date: string): boolean {
  return holidaysOn(date).some((h) => h.countries.includes("BE"));
}

export function upcomingHolidays(from: string, days: number): Holiday[] {
  const y = Number(from.slice(0, 4));
  const end = addIsoDays(from, days);
  return [...holidaysForYear(y), ...holidaysForYear(y + 1)].filter((h) => h.date >= from && h.date <= end);
}
