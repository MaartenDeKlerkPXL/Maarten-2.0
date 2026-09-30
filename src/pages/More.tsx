import { Archive, Bell, Cake, CalendarRange, ChevronRight, Repeat, Settings as SettingsIcon, Smartphone, Sparkles, Target } from "lucide-react";
import { navigate } from "../lib/router";
import { PageHeader } from "../components/ui";
import { isIos, isStandalone } from "../lib/push";

const ITEMS = [
  { path: "/doelen", icon: Target, label: "Doelen & statistieken", sub: "Streaks en heatmaps van je gewoontes", color: "#A855F7" },
  { path: "/meer/inspiratie", icon: Sparkles, label: "Inspiratie", sub: "Awwwards Sites of the Day · .md export", color: "#F59E0B" },
  { path: "/meer/verjaardagen", icon: Cake, label: "Verjaardagen", sub: "Toevoegen en aanpassen", color: "#EC4899" },
  { path: "/meer/rooster", icon: CalendarRange, label: "Vast rooster", sub: "School, klussen en andere vaste blokken", color: "#A1A1AA" },
  { path: "/meer/terugkerend", icon: Repeat, label: "Terugkerende taken", sub: "Maandelijks en wekelijks", color: "#3B82F6" },
  { path: "/meer/archief", icon: Archive, label: "Archief", sub: "Afgevinkte en verlopen items", color: "#64748B" },
  { path: "/meer/instellingen", icon: SettingsIcon, label: "Instellingen", sub: "Meldingen, water, categorieën", color: "#14B8A6" },
];

export default function More() {
  const showInstall = isIos() && !isStandalone();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Meer" />
      {showInstall && (
        <div className="card card-pad mb-4 border-accent/30 bg-gradient-to-br from-accent/15 to-transparent">
          <div className="flex gap-3">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-accent-2" />
            <div className="text-sm">
              <p className="font-semibold">Installeer als app</p>
              <p className="mt-1 text-muted">
                Tik in Safari op <b className="text-text">Deel</b> (vierkant met pijl) → <b className="text-text">Zet op beginscherm</b>. Daarna werkt de app fullscreen en kun je meldingen aanzetten.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="card divide-y divide-line overflow-hidden">
        {ITEMS.map((i) => (
          <button key={i.path} onClick={() => navigate(i.path)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-white/[0.03]">
            <div className="grid size-10 place-items-center rounded-xl" style={{ background: `${i.color}1f`, color: i.color }}>
              <i.icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{i.label}</p>
              <p className="truncate text-xs text-muted">{i.sub}</p>
            </div>
            <ChevronRight className="size-4 text-faint" />
          </button>
        ))}
      </div>
      <button onClick={() => navigate("/meer/instellingen")} className="card card-pad mt-4 flex w-full items-center gap-3 text-left">
        <Bell className="size-5 text-accent-2" />
        <span className="text-sm text-muted">Meldingen instellen voor gewoontes, water, verjaardagen en deadlines</span>
      </button>
    </div>
  );
}
