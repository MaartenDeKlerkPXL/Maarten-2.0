// Verstuurt pushmeldingen. Aangeroepen door de cron (public.dispatch_notifications)
// of door de app zelf voor een testmelding.
import { adminClient, authorize, corsHeaders, json, loadSecrets } from "../_shared/admin.ts";
import { sendWebPush, type VapidKeys } from "../_shared/webpush.ts";

interface Notification {
  user_id: string;
  key: string;
  title: string;
  body: string;
  url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = adminClient();
    const secrets = await loadSecrets(admin);
    const auth = await authorize(req, admin, secrets);
    if (!auth) return json({ error: "unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const notifications: Notification[] = auth.cron
      ? (payload.notifications ?? [])
      : [{
        user_id: auth.userId,
        key: `test:${Date.now()}`,
        title: "Maarten 2.0 🚀",
        body: "Meldingen staan aan. Tijd om elke dag een beetje beter te worden!",
        url: "/",
      }];
    if (!notifications.length) return json({ sent: 0 });

    const vapid: VapidKeys = {
      publicKey: secrets.vapid_public_key,
      privateKeyJwk: JSON.parse(secrets.vapid_private_jwk),
      subject: secrets.vapid_subject,
    };

    const userIds = [...new Set(notifications.map((n) => n.user_id))];
    const { data: subs, error } = await admin.from("push_subscriptions").select("*").in("user_id", userIds);
    if (error) throw error;

    let sent = 0;
    const failures: unknown[] = [];
    for (const n of notifications) {
      for (const sub of (subs ?? []).filter((s) => s.user_id === n.user_id)) {
        const res = await sendWebPush(
          sub,
          JSON.stringify({ title: n.title, body: n.body, url: n.url ?? "/", tag: n.key }),
          vapid,
        );
        if (res.ok) sent++;
        else {
          failures.push({ status: res.status, text: (await res.text()).slice(0, 200) });
          if (res.status === 404 || res.status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
    }
    return json({ sent, failures });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
