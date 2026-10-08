/** Only the public project URL/key belong here. No service-role key is used anywhere. */
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (key.startsWith("sb_secret_"))
    throw new Error("Use a Supabase publishable key, never a secret key.");
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") throw new Error("Invalid public key");
    } catch {
      throw new Error("Use a Supabase publishable or legacy anon key.");
    }
  }
  return { url, key };
}
