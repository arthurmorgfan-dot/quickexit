import Link from "next/link";
import DemoImport from "./DemoImport";
import { registrationEnabled, supabaseSetup } from "@/lib/supabase/config";
import type usePersistentDemo from "./usePersistentDemo";
type Workspace = ReturnType<typeof usePersistentDemo>;
export default function AccountPanel({
  workspace: w,
  compact = false,
}: {
  workspace: Workspace;
  compact?: boolean;
}) {
  const active = w.account;
  const enabled = supabaseSetup().status === "ready";
  if (
    compact &&
    !w.authError &&
    !w.recovered &&
    !w.checkingAuth &&
    (!active || ["saved", "demo", "syncing"].includes(w.syncStatus))
  )
    return null;
  return (
    <section
      className="qw-card qw-account-panel"
      aria-label="Paper account and sync"
      aria-busy={
        w.checkingAuth ||
        w.syncStatus === "loading" ||
        w.syncStatus === "syncing"
      }
    >
      <div>
        <strong>
          {w.checkingAuth
            ? "Checking account…"
            : active
              ? active.email
              : "Try Demo. Keep it simple."}
        </strong>
        <p role="status">
          {w.authError ||
            (active && w.recovered
              ? "This device’s account cache could not be restored. Its original data was preserved for recovery; the account copy is shown when available."
              : "") ||
            w.syncMessage ||
            (active
              ? "Your account stores paper trades only."
              : enabled ? "Use the demo without registering, or sign in to save paper trading across devices." : "Demo mode · saved on this device. Hosted accounts and registration remain disabled while verification is completed.")}
        </p>
      </div>
      <div className="qw-account-actions" inert={w.checkingAuth}>
        {w.importAvailable ? (
          <DemoImport key={active?.id} preview={w.importPreview} onChoose={w.chooseImport} />
        ) : w.syncStatus === "reauth" ? (
          <Link className="qw-text-button" href="/signin">
            Sign in to resume sync
          </Link>
        ) : w.syncStatus === "conflict" ? (
          <>
            <button
              type="button"
              className="qw-small-action"
              onClick={() => {
                if (
                  window.confirm(
                    "Use the cloud copy? Unsynced device changes will be replaced. A recovery copy will remain on this device.",
                  )
                )
                  void w.resolveConflict(false);
              }}
            >
              Use cloud copy
            </button>
            <button
              type="button"
              className="qw-text-button"
              onClick={() => {
                if (
                  window.confirm(
                    "Replace the cloud copy with this device’s paper state? Other devices will see this copy.",
                  )
                )
                  void w.resolveConflict(true);
              }}
            >
              Use this device’s copy
            </button>
          </>
        ) : w.syncStatus === "offline" ? (
          <>
            <button
              type="button"
              className="qw-small-action"
              onClick={() => void w.retrySync()}
            >
              Retry sync
            </button>
            <Link className="qw-text-button" href="/signin">
              Sign in again
            </Link>
          </>
        ) : null}
        {!compact &&
          (active ? (
            <button
              type="button"
              className="qw-text-button"
              onClick={() => void w.signOut()}
            >
              Sign out
            </button>
          ) : enabled ? (
            <>
              <Link className="qw-text-button" href="/signin">
                Sign in
              </Link>
              {registrationEnabled() && <Link className="qw-text-button" href="/signup">Create account</Link>}
            </>
          ) : null)}
        {(compact || active) && (
          <Link className="qw-text-button" href="/app?demo=1">
            Try Demo
          </Link>
        )}
        {!compact && !active && enabled && (
          <Link className="qw-text-button" href="/app">
            Open account workspace
          </Link>
        )}
      </div>
    </section>
  );
}
