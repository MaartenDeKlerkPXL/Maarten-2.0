import { ThumbsDown } from "lucide-react";
import { RATINGS } from "../lib/markdown";
import type { Inspiration } from "../lib/types";

const COLORS = { 1: "#60A5FA", 2: "#A78BFA", 3: "#F59E0B" } as const;

export function RatingDots({ rating, size = "sm" }: { rating: Inspiration["rating"]; size?: "sm" | "md" }) {
  if (!rating) return <span className="text-xs text-faint">geen cijfer</span>;
  const dot = size === "md" ? "size-2.5" : "size-2";
  return (
    <span className="inline-flex items-center gap-1.5" title={RATINGS[rating].long}>
      <span className="inline-flex gap-0.5">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`${dot} rounded-full`} style={{ background: n <= rating ? COLORS[rating] : "rgb(148 163 184 / 0.2)" }} />
        ))}
      </span>
      <span className="text-xs font-semibold" style={{ color: COLORS[rating] }}>{RATINGS[rating].short}</span>
    </span>
  );
}

/** Opslaan met cijfer 1–3, of "niet mooi" (= niets opslaan). */
export function RatingButtons({
  onRate, onSkip, current, compact,
}: { onRate: (r: 1 | 2 | 3) => void; onSkip?: () => void; current?: Inspiration["rating"]; compact?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {([1, 2, 3] as const).map((r) => {
          const active = current === r;
          return (
            <button
              key={r}
              onClick={() => onRate(r)}
              title={RATINGS[r].long}
              className="flex flex-col items-center gap-0.5 rounded-2xl border px-2 py-2 transition active:scale-95"
              style={{
                borderColor: active ? COLORS[r] : `${COLORS[r]}40`,
                background: active ? `${COLORS[r]}30` : `${COLORS[r]}12`,
              }}
            >
              <span className="font-display text-lg font-bold tabular" style={{ color: COLORS[r] }}>{r}</span>
              {!compact && <span className="text-center text-[11px] font-medium leading-tight text-muted">{RATINGS[r].long}</span>}
              {compact && <span className="text-[11px] font-medium text-muted">{RATINGS[r].short}</span>}
            </button>
          );
        })}
      </div>
      {onSkip && (
        <button onClick={onSkip} className="btn btn-ghost w-full py-2 text-xs">
          <ThumbsDown className="size-3.5" /> Niet mooi, niet opslaan
        </button>
      )}
    </div>
  );
}
