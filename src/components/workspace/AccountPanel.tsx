import Link from "next/link";
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
  if (
    compact &&
    !w.authError &&
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
            w.syncMessage ||
            (active
              ? "Your account stores paper trades only."
              : "Use the demo without registering, or sign in to save paper trading across devices.")}
        </p>
      </div>
      <div className="qw-account-actions">
        {w.importAvailable ? (
          <>
            <button
              type="button"
              className="qw-small-action"
              onClick={() => void w.chooseImport(true)}
            >
              Import this device’s demo
            </button>
            <button
              type="button"
              className="qw-text-button"
              onClick={() => void w.chooseImport(false)}
            >
              Start fresh
            </button>
            <p>
              Your local demo stays on this device. Import is available once,
              only into an empty account.
            </p>
          </>
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
          ) : (
            <>
              <Link className="qw-text-button" href="/signin">
                Sign in
              </Link>
              <Link className="qw-text-button" href="/signup">
                Create account
              </Link>
            </>
          ))}
        {(compact || active) && (
          <Link className="qw-text-button" href="/app?demo=1">
            Try Demo
          </Link>
        )}
        {!compact && !active && (
          <Link className="qw-text-button" href="/app">
            Open account workspace
          </Link>
        )}
      </div>
    </section>
  );
}
