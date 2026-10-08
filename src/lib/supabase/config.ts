/** Values are public project identifiers. Never supply a privileged key. */
export function readSupabaseConfig(urlValue?: string, keyValue?: string) {
  const url = urlValue?.trim(),
    key = keyValue?.trim();
  if (!url && !key) return null;
  if (!url || !key)
    throw new Error(
      "Set both public Supabase variables, or leave both empty for Demo.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid Supabase project URL.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsed.hostname,
  );
  if (
    (parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && loopback)) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error(
      "Use an HTTPS project origin or an HTTP loopback origin for local Supabase.",
    );
  if (key.startsWith("sb_secret_"))
    throw new Error("Use a Supabase publishable key, never a secret key.");
  if (key.startsWith("eyJ")) {
    try {
      const segments = key.split(".");
      if (segments.length !== 3) throw new Error("Invalid key");
      const payload = JSON.parse(
        atob(segments[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") throw new Error("Invalid public key");
    } catch {
      throw new Error("Use a Supabase publishable or legacy anon key.");
    }
  } else if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error("Use a Supabase publishable or legacy anon key.");
  }
  return { url: parsed.origin, key };
}
export function supabaseConfig() {
  return readSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
/** Invalid setup disables accounts gracefully. Pre-build validation fails before public values are bundled. */
export function supabaseSetup() {
  try {
    const config = supabaseConfig();
    if (config && process.env.NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED !== "true")
      return { status: "disabled", config: null } as const;
    return { status: config ? "ready" : "missing", config } as const;
  } catch {
    return { status: "invalid", config: null } as const;
  }
}
