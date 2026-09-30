import { useMemo, useState, type ReactNode } from "react";
import { Copy, Download, ExternalLink, Search, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { useData } from "../../lib/store";
import { addIsoDays, fmt, todayIso } from "../../lib/dates";
import { downloadMarkdown, hashtag, inspirationMarkdown, RATINGS } from "../../lib/markdown";
import type { Inspiration as Item } from "../../lib/types";
import { Empty, Segmented } from "../../components/ui";
import { RatingButtons, RatingDots } from "../../components/RatingButtons";
import { useToast } from "../../components/Toast";
import { SubHeader } from "./SubHeader";

type Group = "rating" | "categories" | "tags" | "technologies";
type Period = "all" | "30" | "90" | "365" | "custom";
type Sort = "new" | "old" | "rating" | "name";

interface Filters {
  q: string;
  rating: number[];
  categories: string[];
  tags: string[];
  technologies: string[];
  period: Period;
  from: string;
  to: string;
}

const EMPTY: Filters = { q: "", rating: [], categories: [], tags: [], technologies: [], period: "all", from: "", to: "" };

const valuesOf = (i: Item, g: Group): (string | number)[] =>
  g === "rating" ? (i.rating ? [i.rating] : []) : g === "tags" ? i.tags : g === "categories" ? i.categories : i.technologies;

/** Filteren: binnen een groep OF, tussen groepen EN. `skip` = groep negeren (voor tellingen). */
function matches(i: Item, f: Filters, skip?: Group): boolean {
  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    const hay = [i.name, i.description ?? "", i.note ?? "", ...i.categories, ...i.tags, ...i.technologies, i.url ?? ""].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  const today = todayIso();
  if (f.period !== "all") {
    const from = f.period === "custom" ? f.from : addIsoDays(today, -Number(f.period));
    const to = f.period === "custom" ? f.to : "";
    if (from && i.sotd_date < from) return false;
    if (to && i.sotd_date > to) return false;
  }
  for (const g of ["rating", "categories", "tags", "technologies"] as Group[]) {
    if (g === skip) continue;
    const sel = f[g] as (string | number)[];
    if (sel.length && !valuesOf(i, g).some((v) => sel.includes(v))) return false;
  }
  return true;
}

function FacetSection({
  title, group, items, filters, toggle, render,
}: {
  title: string;
  group: Group;
  items: Item[];
  filters: Filters;
  toggle: (g: Group, v: string | number) => void;
  render?: (v: string | number) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [more, setMore] = useState(false);
  const counts = useMemo(() => {
    const m = new Map<string | number, number>();
    for (const i of items) if (matches(i, filters, group)) for (const v of valuesOf(i, group)) m.set(v, (m.get(v) ?? 0) + 1);
    // geselecteerde waarden altijd tonen
    for (const v of filters[group] as (string | number)[]) if (!m.has(v)) m.set(v, 0);
    return [...m.entries()].sort((a, b) => (group === "rating" ? Number(b[0]) - Number(a[0]) : b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
  }, [items, filters, group]);
  const shown = counts.filter(([v]) => !query || String(v).toLowerCase().includes(query.toLowerCase()));
  const limited = more || query ? shown : shown.slice(0, 8);
  if (!counts.length) return null;
  const selected = filters[group] as (string | number)[];

  return (
    <section className="border-t border-line pt-4">
      <h3 className="section-title mb-2 flex items-center justify-between">
        {title}
        {selected.length > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">{selected.length}</span>}
      </h3>
      {counts.length > 10 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Zoek in ${title.toLowerCase()}…`} className="input mb-2 py-1.5 text-sm" />
      )}
      <div className="space-y-0.5">
        {limited.map(([v, n]) => {
          const active = selected.includes(v);
          return (
            <button
              key={String(v)}
              onClick={() => toggle(group, v)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${active ? "bg-accent/15 text-text" : "text-muted hover:bg-white/[0.04] hover:text-text"}`}
            >
              <span className={`grid size-4 shrink-0 place-items-center rounded border ${active ? "border-accent bg-accent text-white" : "border-line-strong"}`}>
                {active && <span className="text-[10px] leading-none">✓</span>}
              </span>
              <span className="min-w-0 flex-1 truncate">{render ? render(v) : String(v)}</span>
              <span className="text-xs tabular text-faint">{n}</span>
            </button>
          );
        })}
      </div>
      {!query && shown.length > 8 && (
        <button onClick={() => setMore(!more)} className="mt-1 px-2 text-xs font-medium text-accent-2">
          {more ? "Minder tonen" : `Alle ${shown.length} tonen`}
        </button>
      )}
    </section>
  );
}

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

function SiteCard({ item, onTag }: { item: Item; onTag: (g: Group, v: string) => void }) {
  const { decideInspiration } = useData();
  const [editRating, setEditRating] = useState(false);
  return (
    <article className="card flex flex-col overflow-hidden">
      {item.image_url && (
        <a href={item.url ?? item.awwwards_url ?? "#"} target="_blank" rel="noreferrer" className="block aspect-[16/10] overflow-hidden bg-surface-2">
          <img src={item.image_url} alt={item.name} className="size-full object-cover transition duration-500 hover:scale-[1.03]" loading="lazy" />
        </a>
      )}
      <div className="card-pad flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold">{item.name}</h3>
            <p className="text-xs text-muted">{fmt(item.sotd_date, "d MMMM yyyy")}</p>
          </div>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted hover:text-text" aria-label="Open website">
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>

        {item.status === "saved" && (
          <div className="mt-2">
            {editRating ? (
              <RatingButtons compact current={item.rating} onRate={(r) => { decideInspiration(item.id, "saved", r); setEditRating(false); }} />
            ) : (
              <button onClick={() => setEditRating(true)} className="rounded-lg px-1 py-0.5 hover:bg-white/[0.04]" title="Cijfer aanpassen">
                <RatingDots rating={item.rating} size="md" />
              </button>
            )}
          </div>
        )}

        {item.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{item.description}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.categories.map((c) => (
            <button key={c} onClick={() => onTag("categories", c)} className="chip border-accent/30 bg-accent/10 text-accent-3 hover:bg-accent/20">{c}</button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
          {item.tags.map((t) => <button key={t} onClick={() => onTag("tags", t)} className="text-faint hover:text-accent-2">{hashtag(t)}</button>)}
          {item.technologies.map((t) => <button key={t} onClick={() => onTag("technologies", t)} className="text-faint hover:text-accent-2">{hashtag(t)}</button>)}
        </div>

        {item.status === "saved" ? (
          <>
            <NoteField item={item} />
            <div className="mt-auto flex items-center justify-between pt-2">
              {item.awwwards_url && <a href={item.awwwards_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent-2">Awwwards ↗</a>}
              <button onClick={() => decideInspiration(item.id, "skipped")} className="inline-flex items-center gap-1 text-xs text-faint hover:text-danger">
                <Trash2 className="size-3.5" /> Uit inspiratie
              </button>
            </div>
          </>
        ) : (
          <div className="mt-auto pt-4">
            <RatingButtons compact onRate={(r) => decideInspiration(item.id, "saved", r)} onSkip={() => decideInspiration(item.id, "skipped")} />
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
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<Sort>("new");
  const [showFilters, setShowFilters] = useState(false);

  const pool = useMemo(() => inspiration.filter((i) => i.status === tab), [inspiration, tab]);
  const saved = inspiration.filter((i) => i.status === "saved");
  const pendingCount = inspiration.filter((i) => i.status === "pending").length;

  const results = useMemo(() => {
    const list = pool.filter((i) => matches(i, filters));
    return list.sort((a, b) => {
      if (sort === "old") return a.sotd_date.localeCompare(b.sotd_date);
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0) || b.sotd_date.localeCompare(a.sotd_date);
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.sotd_date.localeCompare(a.sotd_date);
    });
  }, [pool, filters, sort]);

  const toggle = (g: Group, v: string | number) =>
    setFilters((f) => {
      const cur = f[g] as (string | number)[];
      return { ...f, [g]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  const active: { g: Group; v: string | number; label: string }[] = [
    ...filters.rating.map((v) => ({ g: "rating" as Group, v, label: `${v}/3 · ${RATINGS[v as 1 | 2 | 3].short}` })),
    ...filters.categories.map((v) => ({ g: "categories" as Group, v, label: v })),
    ...filters.tags.map((v) => ({ g: "tags" as Group, v, label: hashtag(v) })),
    ...filters.technologies.map((v) => ({ g: "technologies" as Group, v, label: v })),
  ];
  const hasFilters = active.length > 0 || filters.q || filters.period !== "all";
  const filterLabel = hasFilters
    ? `selectie: ${[filters.q && `“${filters.q}”`, ...active.map((a) => a.label)].filter(Boolean).join(", ") || "periode"}`
    : undefined;

  const panel = (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Zoek op naam, notitie, tag…" className="input pl-9" />
      </div>
      <section className="border-t border-line pt-4">
        <h3 className="section-title mb-2">Periode</h3>
        <select value={filters.period} onChange={(e) => setFilters({ ...filters, period: e.target.value as Period })} className="input py-2 text-sm">
          <option value="all">Alles</option>
          <option value="30">Laatste 30 dagen</option>
          <option value="90">Laatste 3 maanden</option>
          <option value="365">Laatste jaar</option>
          <option value="custom">Zelf kiezen…</option>
        </select>
        {filters.period === "custom" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="input px-2 py-1.5 text-sm" aria-label="Vanaf" />
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="input px-2 py-1.5 text-sm" aria-label="Tot" />
          </div>
        )}
      </section>
      {tab === "saved" && (
        <FacetSection title="Cijfer" group="rating" items={pool} filters={filters} toggle={toggle} render={(v) => <RatingDots rating={v as 1 | 2 | 3} />} />
      )}
      <FacetSection title="Soort" group="categories" items={pool} filters={filters} toggle={toggle} />
      <FacetSection title="Hashtags" group="tags" items={pool} filters={filters} toggle={toggle} render={(v) => hashtag(String(v))} />
      <FacetSection title="Technieken" group="technologies" items={pool} filters={filters} toggle={toggle} />
      {hasFilters && (
        <button onClick={() => setFilters(EMPTY)} className="btn btn-ghost w-full text-xs">Alle filters wissen</button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <SubHeader
        title="Inspiratiebord"
        subtitle={`${saved.length} opgeslagen Awwwards Sites of the Day${pendingCount ? ` · ${pendingCount} te beoordelen` : ""}`}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn btn-primary px-3 py-2 text-xs" disabled={!saved.length} onClick={() => downloadMarkdown(inspirationMarkdown(inspiration))}>
              <Download className="size-3.5" /> .md (alles)
            </button>
            {hasFilters && tab === "saved" && (
              <button className="btn btn-ghost px-3 py-2 text-xs" disabled={!results.length} onClick={() => downloadMarkdown(inspirationMarkdown(results, filterLabel))}>
                <Download className="size-3.5" /> .md (selectie)
              </button>
            )}
            <button
              className="btn btn-ghost px-3 py-2 text-xs"
              disabled={!saved.length}
              onClick={() => navigator.clipboard?.writeText(inspirationMarkdown(hasFilters ? results : inspiration, filterLabel)).then(() => toast.show("Markdown gekopieerd"))}
            >
              <Copy className="size-3.5" /> Kopieer
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="card card-pad sticky top-6 max-h-[calc(100dvh-48px)] overflow-y-auto">{panel}</div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-auto sm:min-w-[320px]">
              <Segmented
                options={[
                  { value: "saved", label: `Opgeslagen (${saved.length})` },
                  { value: "pending", label: `Te beoordelen (${pendingCount})` },
                ]}
                value={tab}
                onChange={(v) => { setTab(v); setFilters(EMPTY); }}
              />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="btn btn-ghost px-3 py-2 text-xs lg:hidden">
              <SlidersHorizontal className="size-3.5" /> Filters{active.length ? ` (${active.length})` : ""}
            </button>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted">
              <span className="tabular">{results.length} {results.length === 1 ? "site" : "sites"}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input w-auto py-1.5 text-sm" aria-label="Sorteren">
                <option value="new">Nieuwste eerst</option>
                <option value="old">Oudste eerst</option>
                {tab === "saved" && <option value="rating">Hoogste cijfer</option>}
                <option value="name">Naam A–Z</option>
              </select>
            </div>
          </div>

          {showFilters && <div className="card card-pad mb-4 lg:hidden">{panel}</div>}

          {active.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {active.map((a) => (
                <button key={`${a.g}-${a.v}`} onClick={() => toggle(a.g, a.v)} className="chip border-accent/40 bg-accent/15 text-text">
                  {a.label} <X className="size-3" />
                </button>
              ))}
            </div>
          )}

          {results.length === 0 ? (
            <div className="card">
              <Empty
                icon={<Sparkles className="size-5" />}
                title={pool.length === 0 ? (tab === "saved" ? "Nog niets opgeslagen" : "Alles beoordeeld") : "Geen sites met deze filters"}
                text={pool.length === 0 ? "Elke dag staat de Awwwards Site of the Day op je dashboard (laptop/Mac). Geef hem een cijfer om hem op te slaan." : "Pas je filters aan of wis ze."}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {results.map((i) => (
                <SiteCard key={i.id} item={i} onTag={(g, v) => !(filters[g] as (string | number)[]).includes(v) && toggle(g, v)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
