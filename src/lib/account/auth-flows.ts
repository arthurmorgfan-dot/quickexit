import type { SupabaseClient } from "@supabase/supabase-js";
export type AuthClient = Pick<SupabaseClient, "auth">;
export type AuthOutcome = {
  status: "signed_in" | "confirmation" | "error";
  message: string;
};
const unavailable =
  "Authentication is unavailable. Please try again, or continue with Try Demo.";
export const validPassword = (value: string) =>
  value.length >= 12 && value.length <= 128;
export async function authenticate(
  client: AuthClient | null,
  mode: "signin" | "signup",
  email: string,
  password: string,
  origin: string,
): Promise<AuthOutcome> {
  if (!client) return { status: "error", message: unavailable };
  if (!email.trim() || (mode === "signup" && !validPassword(password)))
    return {
      status: "error",
      message:
        "Check your email and password. New passwords must contain 12–128 characters.",
    };
  try {
    const result =
      mode === "signup"
        ? await client.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: `${origin}/auth/callback` },
          })
        : await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
    if (result.error)
      return {
        status: "error",
        message:
          mode === "signup"
            ? "Could not create the account. Check your details and try again; existing users can sign in."
            : "Could not sign in. Check your email and password, or try again when connected.",
      };
    if (result.data.session) return { status: "signed_in", message: "" };
    return mode === "signup"
      ? {
          status: "confirmation",
          message:
            "If confirmation is required, check your email in this browser, then sign in.",
        }
      : { status: "error", message: unavailable };
  } catch {
    return { status: "error", message: unavailable };
  }
}
export async function requestPasswordRecovery(
  client: AuthClient | null,
  email: string,
  origin: string,
) {
  if (!client) return { ok: false, message: unavailable };
  try {
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback`,
    });
    return error
      ? {
          ok: false,
          message: "Could not request a reset. Please try again later.",
        }
      : {
          ok: true,
          message:
            "If an account exists, a reset email has been requested. Open its link in this browser.",
        };
  } catch {
    return { ok: false, message: unavailable };
  }
}
export async function changePassword(
  client: AuthClient | null,
  password: string,
  confirmation: string,
  expectedUser?: string,
) {
  if (!validPassword(password) || password !== confirmation)
    return {
      ok: false,
      reason: "invalid",
      message: "Use 12–128 characters and make both passwords match.",
    };
  if (!client)
    return { ok: false, reason: "unavailable", message: unavailable };
  try {
    // An email query parameter or cached session is never sufficient authorization.
    const verified = await client.auth.getUser();
    if (
      verified.error &&
      (verified.error.status === 0 ||
        (verified.error.status ?? 0) >= 500 ||
        verified.error.name === "AuthRetryableFetchError")
    )
      return { ok: false, reason: "unavailable", message: unavailable };
    if (
      verified.error ||
      !verified.data.user ||
      (expectedUser !== undefined && verified.data.user.id !== expectedUser)
    )
      return {
        ok: false,
        reason: "unauthenticated",
        message:
          "Your session could not be verified. Request a new reset email or sign in again.",
      };
    const { error } = await client.auth.updateUser({ password });
    return error
      ? {
          ok: false,
          reason: "unavailable",
          message:
            "Could not update your password. Try again or request a fresh reset link.",
        }
      : {
          ok: true,
          message:
            "Your password has been updated. Your paper trades are unchanged.",
        };
  } catch {
    return { ok: false, reason: "unavailable", message: unavailable };
  }
}
/** Only a provider-confirmed recovery exchange selects the password destination. */
export async function authCallbackDestination(
  client: AuthClient | null,
  url: URL,
) {
  const failed = "/signin?confirmation=failed",
    code = url.searchParams.get("code");
  if (!client || !code || code.length > 2048) return failed;
  const flowId = url.searchParams.get("sb_flow_id");
  if (flowId && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId)) return failed;
  try {
    const { data, error } = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error || !data.session || !data.user) return failed;
    const { data: verified, error: verificationError } =
      await client.auth.getUser();
    if (verificationError || verified.user?.id !== data.user.id) return failed;
    return "redirectType" in data && data.redirectType === "recovery"
      ? "/reset-password"
      : "/app";
  } catch {
    return failed;
  }
}
export async function signOutAccount(client: AuthClient | null) {
  if (!client) return { signedOut: false, message: unavailable };
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (!error) return { signedOut: true, message: "" };
    // The SDK can clear its local session even when remote revocation fails.
    const restored = await client.auth.getSession();
    if (!restored.error && !restored.data.session)
      return {
        signedOut: true,
        message:
          "Signed out on this device. The provider could not confirm session revocation.",
      };
  } catch {
    /* Keep identity/copy unless the SDK confirms local removal. */
  }
  return {
    signedOut: false,
    message: "Could not sign out. Please retry when connected.",
  };
}
