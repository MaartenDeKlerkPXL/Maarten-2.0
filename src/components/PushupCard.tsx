import { useEffect, useMemo, useState } from "react";
import { Plus, TrendingUp, Undo2 } from "lucide-react";
import { useData } from "../lib/store";
import { useToday, haptic } from "../lib/hooks";
import { addIsoDays, fmt } from "../lib/dates";
import { pushupPlan, targetOn } from "../lib/fitness";
import { Ring } from "./ui";
import { BarChart } from "./Charts";
import { useToast } from "./Toast";

const COLOR = "#F97316";

export function usePushupPlan() {
  const { settings, pushups, updateSettings } = useData();
  const today = useToday();
  const plan = useMemo(() => (settings ? pushupPlan(settings, pushups, today) : null), [settings, pushups, today]);
  // server-meldingen gebruiken het actuele dagdoel
  useEffect(() => {
    if (plan && settings && plan.target !== settings.pushup_current_target) updateSettings({ pushup_current_target: plan.target });
  }, [plan, settings, updateSettings]);
  return plan;
}

export function PushupCard({ withChart = false }: { withChart?: boolean }) {
  const { pushups, addPushups, removePushup, settings } = useData();
  const toast = useToast();
  const today = useToday();
  const plan = usePushupPlan();
  const [custom, setCustom] = useState<string | null>(null);
  if (!plan || !settings) return null;

  const done = plan.byDay.get(today) ?? 0;
  const target = plan.target;
  const reached = done >= target;
  const last = [...pushups].reverse().find((p) => p.log_date === today);
  const goal = settings.pushup_goal;

  const add = (n: number) => {
    haptic(10);
    addPushups(n);
    if (done < target && done + n >= target) {
      haptic([20, 40, 20, 40, 60]);
      toast.show(`Pushup-doel van vandaag gehaald! 💪 (${done + n})`);
    }
  };

  const days = Array.from({ length: 28 }, (_, i) => addIsoDays(today, i - 27));

  return (
    <div className="card card-pad">
      <div className="flex items-center gap-4">
        <Ring value={done / target} size={72} stroke={7} color={COLOR}>
          <div className="text-center leading-none">
            <div className="text-lg font-bold tabular">{done}</div>
            <div className="text-[10px] text-muted">/{target}</div>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Pushups</h2>
          <p className="mt-1 font-semibold">{reached ? "Dagdoel gehaald 🔥" : `Nog ${target - done} te gaan`}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <TrendingUp className="size-3" />
            {target >= goal ? `Doel van ${goal} per dag bereikt!` : `Week ${plan.weekIndex} · nog ~${plan.weeksToGoal} weken tot ${goal}`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[5, 10, 15, 20].map((n) => (
          <button
            key={n}
            onClick={() => add(n)}
            className="rounded-2xl border border-orange-400/20 bg-orange-400/[0.07] py-2.5 text-sm font-bold tabular text-orange-200 transition hover:bg-orange-400/15 active:scale-95"
          >
            +{n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {custom === null ? (
          <button onClick={() => setCustom("")} className="chip hover:text-text">
            <Plus className="size-3" /> Eigen aantal
          </button>
        ) : (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(custom);
              if (n > 0 && n <= 500) add(n);
              setCustom(null);
            }}
          >
            <input autoFocus inputMode="numeric" className="input h-9 flex-1 py-1" placeholder="aantal" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} />
            <button className="btn btn-primary h-9 py-0">Voeg toe</button>
          </form>
        )}
        {last && custom === null && (
          <button onClick={() => removePushup(last.id)} className="chip ml-auto whitespace-nowrap hover:text-text">
            <Undo2 className="size-3" /> {last.reps}
          </button>
        )}
      </div>

      {withChart && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-1 text-xs text-muted">Laatste 4 weken · stippellijn = dagdoel</p>
          <BarChart
            color={COLOR}
            points={days.map((d) => ({ label: fmt(d, "d/M"), value: plan.byDay.get(d) ?? 0, tooltip: fmt(d, "EEE d MMM") }))}
            targets={days.map((d) => (d < settings.pushup_start_date ? 0 : targetOn(plan, d)))}
          />
        </div>
      )}
    </div>
  );
}
