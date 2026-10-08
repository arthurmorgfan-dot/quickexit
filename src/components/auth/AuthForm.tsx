"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmationNotice from "./ConfirmationNotice";
import Brand from "@/components/ui/Brand";
import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup",
    configured = !!supabaseConfig();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    setSuccess(false);
    const form = new FormData(event.currentTarget),
      email = String(form.get("email") ?? "").trim(),
      password = String(form.get("password") ?? "");
    try {
      const client = browserSupabase();
      if (!client)
        throw Error("Accounts are not configured yet. You can still Try Demo.");
      const result = signup
        ? await client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        setMessage(
          signup
            ? "Could not create the account. Check your details and try again; existing users can sign in."
            : "Could not sign in. Check your email and password, or try again when connected.",
        );
        return;
      }
      if (result.data.session) {
        router.replace("/app");
        router.refresh();
        return;
      }
      setSuccess(true);
      setMessage("Check your email to confirm your account, then sign in.");
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
        {!configured && (
          <p className="qe-auth-message" role="status">
            Accounts are not configured on this deployment yet. Try Demo remains
            available.
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
              disabled={pending || !configured}
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
              disabled={pending || !configured}
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
            disabled={pending || !configured}
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
        <p>
          {signup ? "Already have an account?" : "New to QuickExit?"}{" "}
          <Link href={signup ? "/signin" : "/signup"}>
            {signup ? "Sign in" : "Create account"}
          </Link>
        </p>
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
