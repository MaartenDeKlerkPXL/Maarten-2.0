import { useMemo, useState } from "react";
import { Copy, Download, ExternalLink, Save, Share2, Sparkles, ThumbsDown, Trash2 } from "lucide-react";
import { useData } from "../../lib/store";
import { fmt } from "../../lib/dates";
import { downloadMarkdown, hashtagsOf, inspirationMarkdown, shareMarkdown } from "../../lib/markdown";
import type { Inspiration as Item } from "../../lib/types";
import { Empty, Segmented } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { SubHeader } from "./SubHeader";

function NoteField({ item }: { item: Item }) {
  const { updateInspiration } = useData();
  const [value, setValue] = useState(item.note ?? "");
  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== (item.note ?? "") && updateInspiration(item.id, { note: value.trim() || null })}
      placeholder="Wat vind je er mooi aan? (komt in je .md)"
      rows={2}
      className="input mt-3 resize-none py-2 text-sm"
    />
  );
}

function SiteCard({ item }: { item: Item }) {
  const { decideInspiration } = useData();
  const tags = hashtagsOf(item);
  return (
    <article className="card overflow-hidden">
      {item.image_url && (
        <a href={item.url ?? item.awwwards_url ?? "#"} target="_blank" rel="noreferrer" className="block aspect-[16/10] overflow-hidden bg-surface-2">
          <img src={item.image_url} alt={item.name} className="size-full object-cover transition duration-500 hover:scale-[1.03]" loading="lazy" />
        </a>
      )}
      <div className="card-pad">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold">{item.name}</h3>
            <p className="text-xs text-muted">Site of the Day · {fmt(item.sotd_date, "EEEE d MMMM yyyy")}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted hover:text-text" aria-label="Open website">
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        </div>
        {item.description && <p className="mt-2 text-sm text-muted">{item.description}</p>}
        {item.categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.categories.map((c) => <span key={c} className="chip border-accent/30 bg-accent/10 text-accent-3">{c}</span>)}
          </div>
        )}
        {tags.length > 0 && <p className="mt-2 text-xs leading-relaxed text-faint">{tags.join(" ")}</p>}

        {item.status === "saved" ? (
          <>
            <NoteField item={item} />
            <div className="mt-2 flex items-center justify-between">
              {item.awwwards_url && (
                <a href={item.awwwards_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent-2">Bekijk op Awwwards ↗</a>
              )}
              <button onClick={() => decideInspiration(item.id, "skipped")} className="inline-flex items-center gap-1 text-xs text-faint hover:text-danger">
                <Trash2 className="size-3.5" /> Uit inspiratie
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => decideInspiration(item.id, "skipped")} className="btn btn-ghost"><ThumbsDown className="size-4" /> Niet mooi</button>
            <button onClick={() => decideInspiration(item.id, "saved")} className="btn btn-primary"><Save className="size-4" /> Opslaan</button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function Inspiration() {
  const { inspiration } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<"saved" | "pending">("saved");
  const [tag, setTag] = useState<string | null>(null);
  const saved = inspiration.filter((i) => i.status === "saved");
  const pending = inspiration.filter((i) => i.status === "pending");
  const md = useMemo(() => inspirationMarkdown(inspiration), [inspiration]);

  const topTags = useMemo(() => {
    const count = new Map<string, number>();
    for (const i of saved) for (const t of [...i.categories, ...hashtagsOf(i)]) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [saved]);

  const list = (tab === "saved" ? saved : pending).filter((i) => !tag || i.categories.includes(tag) || hashtagsOf(i).includes(tag));

  return (
    <div className="mx-auto max-w-4xl">
      <SubHeader title="Inspiratie" subtitle="Awwwards Sites of the Day die jij mooi vond" />

      <div className="card card-pad mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <p className="font-semibold">awwwards-inspiratie.md</p>
            <p className="text-xs text-muted">{saved.length} opgeslagen · naam, datum, link, onderwerp, soort en hashtags</p>
          </div>
          <button className="btn btn-primary px-3 py-2 text-xs" disabled={!saved.length} onClick={() => downloadMarkdown(md)}>
            <Download className="size-3.5" /> .md downloaden
          </button>
          <button
            className="btn btn-ghost px-3 py-2 text-xs"
            disabled={!saved.length}
            onClick={async () => {
              if (!(await shareMarkdown(md))) {
                await navigator.clipboard?.writeText(md);
                toast.show("Delen niet beschikbaar: Markdown gekopieerd");
              }
            }}
          >
            <Share2 className="size-3.5" /> Delen
          </button>
          <button
            className="btn btn-ghost px-3 py-2 text-xs"
            disabled={!saved.length}
            onClick={() => navigator.clipboard?.writeText(md).then(() => toast.show("Markdown gekopieerd"))}
          >
            <Copy className="size-3.5" /> Kopieer
          </button>
        </div>
      </div>

      <div className="mb-4">
        <Segmented
          options={[
            { value: "saved", label: `Opgeslagen (${saved.length})` },
            { value: "pending", label: `Te beoordelen (${pending.length})` },
          ]}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setTag(null);
          }}
        />
      </div>

      {tab === "saved" && topTags.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
          {topTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${tag === t ? "border-accent bg-accent text-white" : "border-line bg-surface-2 text-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="card">
          <Empty
            icon={<Sparkles className="size-5" />}
            title={tab === "saved" ? "Nog niets opgeslagen" : "Alles beoordeeld"}
            text={tab === "saved" ? "Elke dag staat de Awwwards Site of the Day op je dashboard. Vind je hem mooi? Opslaan!" : "Morgen staat er weer een nieuwe klaar."}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((i) => <SiteCard key={i.id} item={i} />)}
        </div>
      )}
    </div>
  );
}
