import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
let client: SupabaseClient | undefined;
export function browserSupabase(): SupabaseClient | null {
  const config = supabaseConfig();
  if (!config) return null;
  client ??= createBrowserClient(config.url, config.key);
  return client;
}
