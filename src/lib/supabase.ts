import { createClient } from "@supabase/supabase-js";

// Publieke sleutels (veilig om in de browser te gebruiken; data is beschermd met RLS).
export const SUPABASE_URL = "https://kocljptisexuwwpcsidd.supabase.co";
export const SUPABASE_KEY = "sb_publishable_oAYXOBXwPPkGCYFF9S9HRQ_NKTWq4Ve";
export const VAPID_PUBLIC_KEY = "BJLoJpCY8YXmHOEhyl32yNDAZEgIphb7uHMcLrAjegzueh0ccnYHtUwsW3PpcXJIoTyeWgDsndvfvHJC8jyPSAU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
