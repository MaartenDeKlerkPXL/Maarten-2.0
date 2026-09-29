import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadSecrets(admin: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await admin.from("app_secrets").select("key, value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

/** Aanroep vanuit cron (gedeeld geheim) of door een ingelogde gebruiker. */
export async function authorize(
  req: Request,
  admin: SupabaseClient,
  secrets: Record<string, string>,
): Promise<{ cron: true } | { cron: false; userId: string } | null> {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && secrets.cron_secret && cronSecret === secrets.cron_secret) return { cron: true };
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data.user ? { cron: false, userId: data.user.id } : null;
}
