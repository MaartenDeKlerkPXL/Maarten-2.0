import { useMemo } from "react";
import { ArrowRight, ExternalLink, RefreshCw, Save, ThumbsDown, Undo2 } from "lucide-react";
import { useData } from "../lib/store";
import { navigate } from "../lib/router";
import { fmt } from "../lib/dates";
import { haptic } from "../lib/hooks";
import { hashtagsOf } from "../lib/markdown";
import { useToast } from "./Toast";

/** Dagelijkse Awwwards Site of the Day: bekijken → opslaan of "niet mooi". */
export function AwwwardsCard() {
  const { inspiration, decideInspiration, syncAwwwards } = useData();
  const toast = useToast();
  const latest = inspiration[0];
  const pending = useMemo(() => inspiration.filter((i) => i.status === "pending"), [inspiration]);
  const current = pending[0];
  const olderPending = pending.length - (current ? 1 : 0);
  const savedCount = inspiration.filter((i) => i.status === "saved").length;

  if (!latest) {
    return (
      <div className="card card-pad flex items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Site of the Day</h2>
          <p className="mt-1 text-sm text-muted">Nog niet opgehaald.</p>
        </div>
        <button className="btn btn-ghost px-3 py-2 text-xs" onClick={() => syncAwwwards().then((ok) => !ok && toast.show("Ophalen mislukt", "error"))}>
          <RefreshCw className="size-3.5" /> Ophalen
        </button>
      </div>
    );
  }

  if (!current) {
    const last = latest;
    return (
      <div className="card card-pad flex items-center gap-3">
        {last.image_url && <img src={last.image_url} alt="" className="size-12 shrink-0 rounded-xl object-cover" loading="lazy" />}
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Site of the Day</h2>
          <p className="mt-0.5 truncate text-sm">
            <span className="font-semibold">{last.name}</span>
            <span className="text-muted"> · {last.status === "saved" ? "opgeslagen ✓" : "overgeslagen"}</span>
          </p>
        </div>
        <button onClick={() => decideInspiration(last.id, "pending")} className="chip hover:text-text" aria-label="Ongedaan maken">
          <Undo2 className="size-3" />
        </button>
        <button onClick={() => navigate("/meer/inspiratie")} className="chip whitespace-nowrap hover:text-text">
          {savedCount} <ArrowRight className="size-3" />
        </button>
      </div>
    );
  }

  const decide = (status: "saved" | "skipped") => {
    haptic(status === "saved" ? [10, 30, 10] : 8);
    decideInspiration(current.id, status);
    toast.show(status === "saved" ? `${current.name} opgeslagen in je inspiratie` : "Overgeslagen, niets opgeslagen", "info", {
      label: "Ongedaan",
      run: () => decideInspiration(current.id, "pending"),
    });
  };
  const tags = hashtagsOf(current).slice(0, 6);

  return (
    <div className="card overflow-hidden">
      {current.image_url && (
        <a href={current.url ?? current.awwwards_url ?? "#"} target="_blank" rel="noreferrer" className="relative block aspect-[16/10] overflow-hidden bg-surface-2">
          <img src={current.image_url} alt={current.name} className="size-full object-cover transition duration-500 hover:scale-[1.03]" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute inset-x-4 bottom-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              Site of the Day · {fmt(current.sotd_date, "d MMM")}
            </p>
            <p className="font-display text-2xl font-bold text-white drop-shadow">{current.name}</p>
          </div>
          <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
            <ExternalLink className="size-4" />
          </span>
        </a>
      )}
      <div className="card-pad">
        {!current.image_url && <p className="font-display text-xl font-bold">{current.name}</p>}
        {current.description && <p className="line-clamp-2 text-sm text-muted">{current.description}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {current.categories.map((c) => (
            <span key={c} className="chip border-accent/30 bg-accent/10 text-accent-3">{c}</span>
          ))}
        </div>
        {tags.length > 0 && <p className="mt-2 text-xs text-faint">{tags.join(" ")}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => decide("skipped")} className="btn btn-ghost whitespace-nowrap">
            <ThumbsDown className="size-4" /> Niet mooi
          </button>
          <button onClick={() => decide("saved")} className="btn btn-primary whitespace-nowrap">
            <Save className="size-4" /> Opslaan
          </button>
        </div>
        {olderPending > 0 && (
          <button onClick={() => navigate("/meer/inspiratie")} className="mt-3 w-full text-center text-xs font-medium text-accent-2">
            +{olderPending} eerdere {olderPending === 1 ? "site" : "sites"} nog te beoordelen
          </button>
        )}
      </div>
    </div>
  );
}
