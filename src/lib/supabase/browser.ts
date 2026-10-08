import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseSetup } from "./config";
let client: SupabaseClient | undefined;
export function browserSupabase(): SupabaseClient | null {
  const { config } = supabaseSetup();
  if (!config) return null;
  client ??= createBrowserClient(config.url, config.key);
  return client;
}
