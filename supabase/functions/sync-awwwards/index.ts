// Haalt dagelijks de Awwwards Site of the Day op en zet hem klaar ("pending") voor elke gebruiker.
import { adminClient, authorize, corsHeaders, json, loadSecrets } from "../_shared/admin.ts";
import { parseDetail, parseList } from "./parse.ts";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  Accept: "text/html",
  "Accept-Language": "en",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = adminClient();
    const secrets = await loadSecrets(admin);
    const auth = await authorize(req, admin, secrets);
    if (!auth) return json({ error: "unauthorized" }, 401);

    const res = await fetch("https://www.awwwards.com/websites/sites_of_the_day/", { headers: HEADERS });
    if (!res.ok) return json({ error: `awwwards ${res.status}` }, 502);
    const sotd = parseList(await res.text());
    if (!sotd) return json({ error: "Site of the Day niet gevonden" }, 502);

    let description: string | null = null;
    let image = sotd.image_url;
    try {
      const d = await fetch(sotd.awwwards_url, { headers: HEADERS });
      if (d.ok) {
        const detail = parseDetail(await d.text());
        description = detail.description;
        image = detail.image ?? image;
      }
    } catch (e) {
      console.warn("detail", e);
    }

    let q = admin.from("settings").select("user_id");
    if (!auth.cron) q = q.eq("user_id", auth.userId);
    const { data: users, error } = await q;
    if (error) throw error;

    const rows = (users ?? []).map((u) => ({
      user_id: u.user_id,
      sotd_date: sotd.date,
      name: sotd.name,
      url: sotd.url,
      awwwards_url: sotd.awwwards_url,
      image_url: image,
      description,
      categories: sotd.categories,
      tags: sotd.tags,
      technologies: sotd.technologies,
    }));
    // bestaande beoordelingen blijven staan
    const { error: upErr } = await admin.from("inspiration").upsert(rows, { onConflict: "user_id,sotd_date", ignoreDuplicates: true });
    if (upErr) throw upErr;
    return json({ sotd: { ...sotd, description, image_url: image }, users: rows.length });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
