import { useMemo, useState } from "react";
import { CupSoda, Droplets, GlassWater, Milk, Plus, Undo2 } from "lucide-react";
import { useData } from "../lib/store";
import { useToday, haptic } from "../lib/hooks";
import { addIsoDays, fmt } from "../lib/dates";
import { waterByDay, waterStreak } from "../lib/logic";
import { useToast } from "./Toast";

export const WATER_PRESETS = [
  { ml: 250, label: "Glas", icon: GlassWater },
  { ml: 350, label: "Groot glas", icon: CupSoda },
  { ml: 500, label: "Flesje 0,5 L", icon: Milk },
];

function Wave({ pct }: { pct: number }) {
  const h = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[22px] border border-sky-400/20 bg-sky-950/30">
      <div className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out" style={{ height: `${h}%` }}>
        <svg className="absolute -top-3 left-0 h-4 w-[200%] animate-wave-slow opacity-60" viewBox="0 0 200 16" preserveAspectRatio="none">
          <path d="M0 8 Q 12.5 0 25 8 T 50 8 T 75 8 T 100 8 T 125 8 T 150 8 T 175 8 T 200 8 V16 H0 Z" fill="#38BDF8" />
        </svg>
        <svg className="absolute -top-2.5 left-0 h-3.5 w-[200%] animate-wave" viewBox="0 0 200 16" preserveAspectRatio="none">
          <path d="M0 8 Q 12.5 16 25 8 T 50 8 T 75 8 T 100 8 T 125 8 T 150 8 T 175 8 T 200 8 V16 H0 Z" fill="#3B82F6" />
        </svg>
        <div className="h-full w-full bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8]" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-transparent" />
    </div>
  );
}

export function WaterCard({ compact = false }: { compact?: boolean }) {
  const { water, settings, addWater, removeWater } = useData();
  const toast = useToast();
  const today = useToday();
  const [custom, setCustom] = useState<string | null>(null);
  const goal = settings?.water_goal_ml ?? 2300;
  const byDay = useMemo(() => waterByDay(water), [water]);
  const total = byDay.get(today) ?? 0;
  const pct = (total / goal) * 100;
  const streak = waterStreak(byDay, goal, today);
  const todays = water.filter((w) => w.log_date === today);
  const last = todays[todays.length - 1];
  const week = Array.from({ length: 7 }, (_, i) => addIsoDays(today, i - 6));

  const add = (ml: number, label: string) => {
    haptic(10);
    const before = total;
    addWater(ml, label);
    if (before < goal && before + ml >= goal) {
      haptic([20, 40, 20, 40, 60]);
      toast.show("Waterdoel gehaald! 💧🎉");
    }
  };

  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Droplets className="size-3.5 text-sky-400" />
            Waterpeil
          </h2>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight tabular">
            {(total / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 2 })}
            <span className="text-base font-semibold text-muted"> / {(goal / 1000).toLocaleString("nl-NL")} L</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {total >= goal ? "Doel gehaald, top! 🎉" : `Nog ${goal - total} ml te gaan`}
            {streak > 0 && <span className="ml-2 text-sky-300">🔥 {streak} {streak === 1 ? "dag" : "dagen"}</span>}
          </p>
        </div>
        <div className="h-24 w-16 shrink-0">
          <Wave pct={pct} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {WATER_PRESETS.map((p) => (
          <button
            key={p.ml}
            onClick={() => add(p.ml, p.label)}
            className="group flex min-w-0 flex-col items-center gap-1 rounded-2xl border border-sky-400/15 bg-sky-400/[0.06] px-1 py-2.5 transition hover:bg-sky-400/10 active:scale-95"
          >
            <p.icon className="size-5 text-sky-300 transition group-active:scale-110" />
            <span className="w-full truncate text-center text-[11px] font-medium text-muted">{p.label}</span>
            <span className="whitespace-nowrap text-xs font-semibold tabular text-text">+{p.ml}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {custom === null ? (
          <button onClick={() => setCustom("")} className="chip hover:text-text">
            <Plus className="size-3" /> Eigen
          </button>
        ) : (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const ml = Number(custom);
              if (ml > 0 && ml <= 3000) add(ml, "Eigen");
              setCustom(null);
            }}
          >
            <input autoFocus inputMode="numeric" className="input h-9 flex-1 py-1" placeholder="ml" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} />
            <button className="btn btn-primary h-9 py-0">Voeg toe</button>
          </form>
        )}
        {last && custom === null && (
          <button
            onClick={() => {
              removeWater(last.id);
              toast.show(`${last.ml} ml verwijderd`);
            }}
            className="chip ml-auto whitespace-nowrap hover:text-text"
          >
            <Undo2 className="size-3" /> {last.ml} ml
          </button>
        )}
      </div>

      {!compact && (
        <div className="mt-4 grid grid-cols-7 gap-1.5 border-t border-line pt-3">
          {week.map((d) => {
            const v = byDay.get(d) ?? 0;
            const ok = v >= goal;
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <div className="relative h-10 w-full overflow-hidden rounded-lg bg-surface-2">
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-lg transition-all ${ok ? "bg-sky-400" : "bg-sky-400/35"}`}
                    style={{ height: `${Math.min(100, (v / goal) * 100)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium uppercase ${ok ? "text-sky-300" : d === today ? "text-text" : "text-faint"}`}>
                  {fmt(d, "EEEEEE")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
