// Haalt per project-repo de todo.md op (root van de standaardbranch) en zet de taken in
// project_tasks. Draait 2x per dag via cron, of via "Nu synchroniseren" in de app.
//
// Token: Supabase secret GITHUB_TOKEN (fine-grained, alleen-lezen "Contents"). Een fine-grained
// token geldt voor één eigenaar; voor repo's van een andere eigenaar/organisatie kan een extra
// secret GITHUB_TOKEN_<EIGENAAR> worden gezet (hoofdletters, niet-alfanumeriek → "_"),
// bv. GITHUB_TOKEN_MIJN_ORG. Zonder token werken alleen publieke repo's.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { adminClient, authorize, corsHeaders, json, loadSecrets } from "../_shared/admin.ts";
import { parseTodoMarkdown } from "../_shared/todoMarkdown.ts";

const API = "https://api.github.com";

interface Source {
  id: string;
  user_id: string;
  type: "github" | "handmatig";
  repo_owner: string | null;
  repo_name: string | null;
  standaard_branch: string | null;
  todo_pad: string | null;
  etag: string | null;
}

function tokenFor(owner: string): string | null {
  const key = `GITHUB_TOKEN_${owner.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return Deno.env.get(key) || Deno.env.get("GITHUB_TOKEN") || null;
}

async function gh(path: string, owner: string, opts: { raw?: boolean; etag?: string | null } = {}) {
  const headers: Record<string, string> = {
    Accept: opts.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Maarten-2.0 dashboard",
  };
  const token = tokenFor(owner);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.etag) headers["If-None-Match"] = opts.etag;
  return fetch(`${API}${path}`, { headers });
}

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

async function errorText(res: Response, owner: string): Promise<string> {
  const body = await res.text().catch(() => "");
  if (res.status === 404) {
    return tokenFor(owner)
      ? "Repo niet gevonden of geen toegang met het token (controleer de naam en de rechten van het token)."
      : "Repo niet gevonden of privé: er is nog geen GitHub-token ingesteld.";
  }
  if (res.status === 401) return "GitHub-token ongeldig of verlopen.";
  if (res.status === 403 && /rate limit/i.test(body)) return "GitHub-limiet bereikt, volgende sync probeert het opnieuw.";
  if (res.status === 403) return "Geen toegang tot deze repo met het huidige token.";
  return `GitHub gaf fout ${res.status}.`;
}

type Outcome = { status: "ok" | "geen_todo" | "fout" | "ongewijzigd"; patch: Record<string, unknown> };

async function syncRepo(admin: SupabaseClient, src: Source, today: string): Promise<Outcome> {
  const owner = src.repo_owner!;
  let name = src.repo_name!;
  const notes: string[] = [];

  // 1. Repo-info: bestaat hij, hebben we toegang, wat is de standaardbranch, is hij hernoemd?
  const repoRes = await gh(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, owner);
  if (!repoRes.ok) return { status: "fout", patch: { sync_status: "fout", sync_fout: await errorText(repoRes, owner) } };
  const repo = await repoRes.json();
  const branch: string = repo.default_branch ?? "main";
  const patch: Record<string, unknown> = { standaard_branch: branch };
  const [newOwner, newName] = String(repo.full_name ?? "").split("/");
  if (newOwner && newName && `${newOwner}/${newName}`.toLowerCase() !== `${owner}/${name}`.toLowerCase()) {
    notes.push(`Repo is hernoemd naar ${repo.full_name}; automatisch bijgewerkt.`);
    patch.repo_owner = newOwner;
    patch.repo_name = newName;
    name = newName;
  }
  const base = `/repos/${encodeURIComponent(newOwner || owner)}/${encodeURIComponent(name)}/contents`;
  const branchChanged = src.standaard_branch !== null && src.standaard_branch !== branch;

  // 2. Bekend pad + ETag: alleen opnieuw verwerken als het bestand veranderd is
  let path = branchChanged ? null : src.todo_pad;
  let res: Response | null = null;
  if (path) {
    res = await gh(`${base}/${enc(path)}?ref=${encodeURIComponent(branch)}`, owner, { raw: true, etag: src.etag });
    if (res.status === 304) {
      return { status: "ongewijzigd", patch: { ...patch, sync_status: "ok", sync_fout: notes.join(" ") || null } };
    }
    if (res.status === 404) {
      path = null;
      res = null;
    } else if (!res.ok) {
      return { status: "fout", patch: { ...patch, sync_status: "fout", sync_fout: await errorText(res, owner) } };
    }
  }

  // 3. todo.md (hoofdletterongevoelig) zoeken in de root
  if (!path) {
    const list = await gh(`${base}?ref=${encodeURIComponent(branch)}`, owner);
    if (list.status === 404) {
      // lege repo zonder commits
      await admin.from("project_tasks").delete().eq("project_id", src.id).eq("bron", "github");
      return { status: "geen_todo", patch: { ...patch, sync_status: "geen_todo", sync_fout: notes.join(" ") || null, todo_pad: null, etag: null } };
    }
    if (!list.ok) return { status: "fout", patch: { ...patch, sync_status: "fout", sync_fout: await errorText(list, owner) } };
    const entries: { name: string; path: string; type: string }[] = await list.json();
    const files = Array.isArray(entries) ? entries.filter((e) => e.type === "file" && e.name.toLowerCase() === "todo.md") : [];
    const file = files.find((f) => f.name === "todo.md") ?? files.find((f) => f.name === "TODO.md") ?? files[0];
    if (!file) {
      await admin.from("project_tasks").delete().eq("project_id", src.id).eq("bron", "github");
      return {
        status: "geen_todo",
        patch: { ...patch, sync_status: "geen_todo", sync_fout: notes.join(" ") || null, todo_pad: null, etag: null, beschrijving: null },
      };
    }
    path = file.path;
    res = await gh(`${base}/${enc(path)}?ref=${encodeURIComponent(branch)}`, owner, { raw: true });
    if (!res.ok) return { status: "fout", patch: { ...patch, sync_status: "fout", sync_fout: await errorText(res, owner) } };
  }

  // 4. Verwerken: todo.md is de bron van waarheid → GitHub-taken vervangen
  const md = await res!.text();
  const parsed = parseTodoMarkdown(md, today);
  const { error: delErr } = await admin.from("project_tasks").delete().eq("project_id", src.id).eq("bron", "github");
  if (delErr) throw delErr;
  if (parsed.tasks.length) {
    const rows = parsed.tasks.map((t) => ({ ...t, project_id: src.id, user_id: src.user_id, bron: "github" }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("project_tasks").insert(rows.slice(i, i + 500));
      if (error) throw error;
    }
  }
  return {
    status: "ok",
    patch: {
      ...patch,
      sync_status: "ok",
      sync_fout: notes.join(" ") || null,
      todo_pad: path,
      etag: res!.headers.get("etag"),
      beschrijving: parsed.beschrijving,
    },
  };
}

function localDate(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Eén voortgangsrij per project per dag (voor de grafiek en "ligt stil"). */
async function recordProgress(admin: SupabaseClient, userId: string, projectIds: string[], today: string) {
  if (!projectIds.length) return;
  const { data: tasks, error } = await admin.from("project_tasks").select("project_id, afgerond").in("project_id", projectIds);
  if (error) throw error;
  const rows = projectIds.map((id) => {
    const mine = (tasks ?? []).filter((t) => t.project_id === id);
    const afgerond = mine.filter((t) => t.afgerond).length;
    return {
      project_id: id, user_id: userId, datum: today, afgerond, totaal: mine.length,
      voortgang: mine.length ? Math.round((afgerond / mine.length) * 10000) / 10000 : 0,
    };
  });
  const { error: upErr } = await admin.from("project_progress").upsert(rows, { onConflict: "project_id,datum" });
  if (upErr) throw upErr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = adminClient();
    const secrets = await loadSecrets(admin);
    const auth = await authorize(req, admin, secrets);
    if (!auth) return json({ error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));

    let query = admin.from("project_sources").select("id, user_id, type, repo_owner, repo_name, standaard_branch, todo_pad, etag");
    if (!auth.cron) query = query.eq("user_id", auth.userId);
    if (typeof body.project_id === "string") query = query.eq("id", body.project_id);
    const { data: sources, error } = await query;
    if (error) throw error;

    const userIds = [...new Set((sources ?? []).map((s) => s.user_id))];
    const { data: settings } = userIds.length
      ? await admin.from("settings").select("user_id, timezone").in("user_id", userIds)
      : { data: [] as { user_id: string; timezone: string }[] };
    const tzOf = (u: string) => settings?.find((s) => s.user_id === u)?.timezone || "Europe/Amsterdam";

    const result = { projecten: 0, bijgewerkt: 0, ongewijzigd: 0, geen_todo: 0, fouten: 0 };
    for (const src of (sources ?? []) as Source[]) {
      result.projecten++;
      if (src.type !== "github" || !src.repo_owner || !src.repo_name) continue;
      const today = localDate(tzOf(src.user_id));
      let outcome: Outcome;
      try {
        outcome = await syncRepo(admin, src, today);
      } catch (e) {
        console.error(src.repo_owner, src.repo_name, e);
        outcome = { status: "fout", patch: { sync_status: "fout", sync_fout: "Verwerken mislukt, probeer het later opnieuw." } };
      }
      if (outcome.status === "ok") result.bijgewerkt++;
      else if (outcome.status === "ongewijzigd") result.ongewijzigd++;
      else if (outcome.status === "geen_todo") result.geen_todo++;
      else result.fouten++;
      const { error: upErr } = await admin
        .from("project_sources")
        .update({ ...outcome.patch, laatste_sync: new Date().toISOString() })
        .eq("id", src.id);
      if (upErr) {
        console.error(upErr);
        // bv. hernoemd naar een repo die al in de lijst staat: alleen de status bijwerken
        await admin.from("project_sources").update({ sync_status: "fout", sync_fout: upErr.message, laatste_sync: new Date().toISOString() }).eq("id", src.id);
      }
    }

    for (const u of userIds) {
      const ids = (sources ?? []).filter((s) => s.user_id === u).map((s) => s.id);
      await recordProgress(admin, u, ids, localDate(tzOf(u)));
    }

    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
