import { useEffect, useState, type ReactNode } from "react";
import { BellRing, Droplets, FolderGit2, LogOut, Palette, Plus, RefreshCw, Send, Smartphone, Trash2, User } from "lucide-react";
import { useData } from "../../lib/store";
import { supabase } from "../../lib/supabase";
import { disablePush, enablePush, getPushState, isIos, isStandalone, sendTestPush, type PushState } from "../../lib/push";
import { hm } from "../../lib/dates";
import { PROJECT_COLORS, parseRepoInput, prettyRepoName } from "../../lib/projects";
import type { Settings as SettingsT } from "../../lib/types";
import { Toggle } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { SubHeader } from "./SubHeader";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card card-pad">
      <h2 className="section-title mb-3 flex items-center gap-2">{icon}{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberField({ value, min, max, suffix, onCommit }: { value: number; min: number; max: number; suffix: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const v = Math.round(Number(draft));
    if (Number.isFinite(v) && v >= min && v <= max) {
      if (v !== value) onCommit(v);
    } else setDraft(String(value));
  };
  return (
    <div className="flex items-center gap-2">
      <input
        inputMode="numeric" className="input w-20 px-2.5 py-2 text-right" value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className="w-8 text-xs text-muted">{suffix}</span>
    </div>
  );
}

const PUSH_TEXT: Record<PushState, string> = {
  enabled: "Aan op dit apparaat",
  default: "Nog niet aangezet",
  denied: "Geblokkeerd in je instellingen",
  unsupported: "Niet ondersteund in deze browser",
  "needs-install": "Installeer eerst de app op je beginscherm",
};

export default function Settings() {
  const { settings, updateSettings, categories, saveCategory, syncEvents } = useData();
  const toast = useToast();
  const [push, setPush] = useState<PushState>("default");
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    getPushState().then(setPush);
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  if (!settings) return null;
  const upd = (p: Partial<SettingsT>) => updateSettings(p);
  const timeInput = (key: keyof SettingsT) => (
    <input type="time" className="input w-28 px-2.5 py-2" value={hm(settings[key] as string)} onChange={(e) => e.target.value && upd({ [key]: e.target.value })} />
  );
  const numInput = (key: keyof SettingsT, min: number, max: number, suffix: string) => (
    <NumberField value={settings[key] as number} min={min} max={max} suffix={suffix} onCommit={(v) => upd({ [key]: v })} />
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SubHeader title="Instellingen" />

      <Section icon={<BellRing className="size-3.5" />} title="Meldingen">
        <div className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Pushmeldingen</p>
              <p className={`text-xs ${push === "enabled" ? "text-success" : "text-muted"}`}>{PUSH_TEXT[push]}</p>
            </div>
            {push === "enabled" ? (
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost px-3 py-2 text-xs"
                  disabled={busy === "test"}
                  onClick={async () => {
                    setBusy("test");
                    try {
                      const r = await sendTestPush();
                      toast.show(r.sent ? "Testmelding verstuurd" : "Geen apparaat gevonden");
                    } catch (e) {
                      toast.show(String((e as Error).message), "error");
                    }
                    setBusy(null);
                  }}
                >
                  <Send className="size-3.5" /> Test
                </button>
                <button className="btn btn-ghost px-3 py-2 text-xs" onClick={async () => { await disablePush(); setPush(await getPushState()); }}>
                  Uit
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary px-3 py-2 text-xs"
                disabled={push === "unsupported" || push === "needs-install" || busy === "push"}
                onClick={async () => {
                  setBusy("push");
                  try {
                    setPush(await enablePush());
                  } catch (e) {
                    toast.show(String((e as Error).message), "error");
                  }
                  setBusy(null);
                }}
              >
                Aanzetten
              </button>
            )}
          </div>
          {isIos() && !isStandalone() && (
            <div className="mt-3 flex gap-2.5 rounded-2xl bg-accent/10 p-3 text-xs text-muted">
              <Smartphone className="size-4 shrink-0 text-accent-2" />
              <span>Op iPhone werken meldingen alleen als de app op je beginscherm staat: Safari → Deel → <b className="text-text">Zet op beginscherm</b>. Open daarna de app en zet meldingen hier aan.</span>
            </div>
          )}
        </div>
        <Row label="Ochtendoverzicht" hint="Lessen en taken van vandaag">{timeInput("morning_time")}</Row>
        <Row label="Gewoontes-check" hint="Als er nog iets openstaat">{timeInput("reminder_time")}</Row>
        <Row label="Taak met tijd" hint="Melding van tevoren">{numInput("todo_reminder_minutes", 0, 240, "min")}</Row>
        <Row label="F1, Roda JC & Oranje" hint="Melding van tevoren">{numInput("event_reminder_minutes", 0, 600, "min")}</Row>
        <Row label="Oranje-wedstrijden" hint="Melding voor elke wedstrijd van het Nederlands elftal">
          <Toggle checked={settings.oranje_push} onChange={(v) => upd({ oranje_push: v })} label="Oranje-wedstrijden" />
        </Row>
        <Row label="Projecten-weekoverzicht" hint="Maandag 08:30: focus, wat stilligt en deadlines">
          <Toggle checked={settings.project_week_push} onChange={(v) => upd({ project_week_push: v })} label="Projecten-weekoverzicht" />
        </Row>
        <Row label="Verjaardagen" hint="Zoveel dagen van tevoren">{numInput("birthday_days_before", 1, 60, "dgn")}</Row>
      </Section>

      <Section icon={<Droplets className="size-3.5" />} title="Waterpeil">
        <Row label="Dagdoel">{numInput("water_goal_ml", 500, 6000, "ml")}</Row>
        <Row label="Drinkherinneringen" hint="Om de 2 uur, alleen als je achterloopt">
          <Toggle checked={settings.water_reminders} onChange={(v) => upd({ water_reminders: v })} />
        </Row>
        {settings.water_reminders && (
          <Row label="Tussen">
            <div className="flex items-center gap-2">{timeInput("water_start")}<span className="text-muted">–</span>{timeInput("water_end")}</div>
          </Row>
        )}
      </Section>

      <Section icon={<RefreshCw className="size-3.5" />} title="Automatisch toevoegen">
        <Row label="Formule 1, Roda JC & Oranje" hint="Kwalificaties, sprints, races en alle wedstrijden van Roda JC en het Nederlands elftal. Wordt 2x per dag bijgewerkt.">
          <button
            className="btn btn-ghost px-3 py-2 text-xs"
            disabled={busy === "sync"}
            onClick={async () => {
              setBusy("sync");
              const r = await syncEvents();
              if (r) toast.show(`Bijgewerkt: ${r.upserted} races & wedstrijden`);
              setBusy(null);
            }}
          >
            <RefreshCw className={`size-3.5 ${busy === "sync" ? "animate-spin" : ""}`} /> Nu ophalen
          </button>
        </Row>
        <Row label="Archiveren na" hint="Afgevinkte taken">{numInput("archive_after_days", 1, 60, "dgn")}</Row>
      </Section>

      <ProjectRepos />

      <Section icon={<Palette className="size-3.5" />} title="Categorieën">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line" style={{ background: c.color }}>
              <input type="color" value={c.color} onChange={(e) => saveCategory({ ...c, color: e.target.value.toUpperCase() })} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`Kleur ${c.name}`} />
            </label>
            <input className="input py-2" value={c.name} onChange={(e) => saveCategory({ ...c, name: e.target.value })} />
          </div>
        ))}
      </Section>

      <Section icon={<User className="size-3.5" />} title="Account">
        <Row label="Naam">
          <input className="input w-40 py-2" value={settings.display_name} onChange={(e) => upd({ display_name: e.target.value })} />
        </Row>
        <Row label="E-mail"><span className="text-sm text-muted">{email}</span></Row>
        <div className="pt-3">
          <button className="btn btn-danger w-full" onClick={() => supabase.auth.signOut()}>
            <LogOut className="size-4" /> Uitloggen
          </button>
        </div>
      </Section>
      <p className="pb-4 text-center text-xs text-faint">Maarten 2.0 · elke dag een beetje beter</p>
    </div>
  );
}

/** GitHub-repo's voor de Projecten-pagina (staan alleen in de database, niet in de code). */
function ProjectRepos() {
  const { projects, saveProject, deleteProject, syncProjects } = useData();
  const toast = useToast();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const repos = projects.filter((p) => p.type === "github");
  const parsed = parseRepoInput(input);

  const add = async () => {
    if (!parsed) return toast.show("Vul eigenaar/repo in, bijv. MaartenDeKlerkPXL/Maarten-2.0", "error");
    if (repos.some((p) => p.repo_owner?.toLowerCase() === parsed.owner.toLowerCase() && p.repo_name?.toLowerCase() === parsed.name.toLowerCase())) {
      return toast.show("Deze repo staat er al in", "error");
    }
    setBusy(true);
    const row = await saveProject({
      type: "github", repo_owner: parsed.owner, repo_name: parsed.name, naam: prettyRepoName(parsed.name),
      kleur: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
    });
    setInput("");
    const r = await syncProjects(row.id);
    setBusy(false);
    if (r) toast.show(r.fouten ? "Toegevoegd, maar synchroniseren lukte niet (zie Projecten)" : "Repo toegevoegd");
  };

  return (
    <Section icon={<FolderGit2 className="size-3.5" />} title="Projecten · GitHub-repo's">
      {repos.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0">
          <span
            className={`size-2 shrink-0 rounded-full ${p.sync_status === "fout" ? "bg-red-400" : p.sync_status === "geen_todo" ? "bg-amber-300" : p.sync_status === "ok" ? "bg-success" : "bg-faint"}`}
            title={p.sync_status === "fout" ? p.sync_fout ?? "Fout" : p.sync_status === "geen_todo" ? "Nog geen todo.md" : p.sync_status === "ok" ? "OK" : "Nog niet gesynchroniseerd"}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.naam}</p>
            <p className="truncate text-xs text-muted">{p.repo_owner}/{p.repo_name}</p>
          </div>
          <button
            onClick={() => confirm(`“${p.naam}” uit je projecten halen? De repo zelf blijft bestaan.`) && deleteProject(p.id)}
            className="rounded-lg p-2 text-faint transition hover:bg-red-500/10 hover:text-red-300"
            aria-label={`${p.repo_owner}/${p.repo_name} verwijderen`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <form className="flex items-center gap-2 pt-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input
          className="input min-w-0 flex-1 py-2" placeholder="eigenaar/repo of GitHub-link" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          value={input} onChange={(e) => setInput(e.target.value)} aria-label="Repo toevoegen"
        />
        <button type="submit" className="btn btn-primary px-3 py-2 text-xs" disabled={busy || !input.trim()}>
          <Plus className="size-4" /> Toevoegen
        </button>
      </form>
      <p className="pt-2 text-xs text-faint">
        De taken komen uit todo.md in de root van de repo. Privé-repo's hebben een GitHub-token nodig (Supabase-secret <code className="text-muted">GITHUB_TOKEN</code>).
      </p>
    </Section>
  );
}
