import { useEffect, useState } from "react";
import { todayIso } from "./dates";

/** Huidige tijd, ververst elke `ms` milliseconden. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Datum van vandaag; wisselt automatisch om middernacht. */
export function useToday(): string {
  const now = useNow(30_000);
  return todayIso(new Date(now));
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export function haptic(pattern: number | number[] = 12) {
  try {
    // alleen na een echte aanraking (anders blokkeert de browser het met een waarschuwing)
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch {
    /* niet ondersteund */
  }
}
