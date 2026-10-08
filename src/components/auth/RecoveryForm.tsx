"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Brand from "@/components/ui/Brand";
import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseSetup } from "@/lib/supabase/config";
import { requestPasswordRecovery } from "@/lib/account/auth-flows";
export default function RecoveryForm({ mode }: { mode: "request" | "change" }) {
  const change = mode === "change",
    configured = supabaseSetup().status === "ready";
  const [identity, setIdentity] = useState<string | null>(null);
  const [checking, setChecking] = useState(change && configured);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false);
  useEffect(() => {
    if (!change || !configured) return;
    let alive = true;
    let verification = 0;
    const client = browserSupabase();
    const verify = async () => {
      const current = ++verification;
      setChecking(true);
      try {
        const result = await client!.auth.getUser();
        if (!alive || current !== verification) return;
        setIdentity(result.error ? null : (result.data.user?.id ?? null));
      } catch {
        if (alive && current === verification) setIdentity(null);
      } finally {
        if (alive && current === verification) setChecking(false);
      }
    };
    void verify();
    const subscription = client?.auth.onAuthStateChange(() => {
      queueMicrotask(() => {
        if (alive) void verify();
      });
    }).data.subscription;
    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, [change, configured]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !configured || (change && !identity)) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    setSuccess(false);
    try {
      let result: { ok: boolean; message: string };
      if (change) {
        const response = await fetch("/api/auth/password", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: form.get("password"),
            confirmation: form.get("confirmation"),
            expectedUser: identity,
          }),
        });
        result = await response.json();
        result.ok = response.ok && result.ok === true;
      } else
        result = await requestPasswordRecovery(
          browserSupabase(),
          String(form.get("email") ?? ""),
          window.location.origin,
        );
      setSuccess(result.ok);
      setMessage(result.message);
      if (result.ok && change) (event.target as HTMLFormElement).reset();
    } catch {
      setMessage(
        "Connection unavailable. Please try again; no success has been confirmed.",
      );
    } finally {
      setPending(false);
    }
  };
  const disabled =
    pending || !configured || (change && (checking || !identity || success));
  return (
    <main className="qe-auth">
      <Brand href="/" />
      <section
        className="qe-auth-card"
        aria-labelledby="recovery-title"
        aria-busy={pending || checking}
      >
        <span className="eyebrow">QUICKEXIT / PAPER TRADING BETA</span>
        <h1 id="recovery-title">
          {change ? "A fresh password." : "Back to your account."}
        </h1>
        <p>
          {change
            ? "Choose a new password for your verified account. Paper trades and simulated balances stay unchanged."
            : "Request a password reset email. No trading or balance changes."}
        </p>
        {!configured && (
          <p className="qe-auth-message" role="status">
            Accounts are not enabled yet. Try Demo remains available.
          </p>
        )}
        {change && configured && (
          <p role="status">
            {checking
              ? "Verifying your session…"
              : identity
                ? "Your session is verified."
                : "A verified session is required. Open the latest reset email in the requesting browser, or sign in."}
          </p>
        )}
        <form onSubmit={submit}>
          {change ? (
            <>
              <label htmlFor="new-password">
                New password
                <input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={disabled}
                />
              </label>
              <label htmlFor="confirm-password">
                Confirm password
                <input
                  id="confirm-password"
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={disabled}
                />
              </label>
              <small>Use at least 12 characters.</small>
            </>
          ) : (
            <label htmlFor="recovery-email">
              Email
              <input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                disabled={disabled}
              />
            </label>
          )}
          <button
            type="submit"
            className="button button-primary"
            disabled={disabled}
          >
            {pending
              ? "Please wait…"
              : change
                ? "Update password"
                : "Send reset email"}
          </button>
        </form>
        {message && (
          <p className="qe-auth-message" role={success ? "status" : "alert"}>
            {message}
          </p>
        )}
        {change && (
          <p>
            <Link href="/forgot-password">Request a fresh reset email</Link>
          </p>
        )}
        <p>
          <Link href={success && change ? "/app" : "/signin"}>
            {success && change
              ? "Return to your paper workspace"
              : "Back to sign in"}
          </Link>
        </p>
        <Link className="button button-secondary" href="/app?demo=1">
          Try Demo
        </Link>
        <small>All trades, balances and transfers remain simulated.</small>
      </section>
    </main>
  );
}
