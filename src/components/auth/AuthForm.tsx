"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authenticate } from "@/lib/account/auth-flows";
import ConfirmationNotice from "./ConfirmationNotice";
import Brand from "@/components/ui/Brand";
import { browserSupabase } from "@/lib/supabase/browser";
import { registrationEnabled, supabaseSetup } from "@/lib/supabase/config";
export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup",
    configured = supabaseSetup().status === "ready",
    allowed = configured && (!signup || registrationEnabled());
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !allowed) return;
    setPending(true);
    setMessage("");
    setSuccess(false);
    const form = new FormData(event.currentTarget),
      email = String(form.get("email") ?? "").trim(),
      password = String(form.get("password") ?? "");
    try {
      const result = await authenticate(
        browserSupabase(),
        mode,
        email,
        password,
        window.location.origin,
      );
      if (result.status === "signed_in") {
        router.replace("/app");
        router.refresh();
        return;
      }
      setSuccess(result.status === "confirmation");
      setMessage(result.message);
    } catch {
      setMessage(
        "Authentication is unavailable. Please try again, or continue with Try Demo.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="qe-auth">
      <Brand href="/" />
      <section className="qe-auth-card" aria-labelledby="auth-title">
        <span className="eyebrow">QUICKEXIT / PAPER TRADING BETA</span>
        <h1 id="auth-title">{signup ? "A clear start." : "Welcome back."}</h1>
        <p>
          {signup
            ? "Create an account to keep your paper trades across devices."
            : "Sign in to your saved paper workspace."}{" "}
          All funds and trades are simulated.
        </p>
        <Suspense fallback={null}>
          <ConfirmationNotice />
        </Suspense>
        {!allowed && (
          <p className="qe-auth-message" role="status">
            {configured ? "Public registration is closed. Invited testers can sign in; Try Demo remains available." : "Accounts are not enabled on this deployment yet. Try Demo remains available."}
          </p>
        )}
        <form onSubmit={submit}>
          <label htmlFor="auth-email">
            Email
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={pending || !allowed}
            />
          </label>
          <label htmlFor="auth-password">
            Password
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={signup ? 12 : 1}
              maxLength={128}
              disabled={pending || !allowed}
            />
          </label>
          {signup && (
            <small>
              Use at least 12 characters. We never ask for banking details or
              exchange keys.
            </small>
          )}
          <button
            className="button button-primary"
            type="submit"
            disabled={pending || !allowed}
          >
            {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>
        {message && (
          <p
            className={`qe-auth-message ${success ? "is-success" : ""}`}
            role={success ? "status" : "alert"}
          >
            {message}
          </p>
        )}
        {!signup && (
          <p>
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
        )}
        {(signup || registrationEnabled()) && <p>
          {signup ? "Already have an account?" : "New to QuickExit?"}{" "}
          <Link href={signup ? "/signin" : "/signup"}>
            {signup ? "Sign in" : "Create account"}
          </Link>
        </p>}
        <Link className="button button-secondary" href="/app?demo=1">
          Try Demo
        </Link>
        <small>
          Crypto involves financial risk. Paper results are simulated and do not
          guarantee real returns.
        </small>
      </section>
    </main>
  );
}
