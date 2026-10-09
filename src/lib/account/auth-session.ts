import type { AuthClient } from "./auth-flows";
import type { AccountIdentity } from "./cloud-api";
type SessionStore = {
  setAccount: (account: AccountIdentity | null) => Promise<void>;
  setAuthChecking: (value: boolean) => void;
};
/** Order auth events ahead of an older initial lookup; detach safely during Strict Mode replay. */
export function observeAccountSession(
  client: AuthClient,
  store: SessionStore,
  onError: (message: string) => void,
) {
  let alive = true,
    epoch = 0;
  const apply = (session: { user: { id: string; email?: string } } | null) => {
    onError("");
    void store.setAccount(
      session
        ? { id: session.user.id, email: session.user.email ?? "Paper account" }
        : null,
    );
  };
  store.setAuthChecking(true);
  const initialEpoch = epoch;
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    // INITIAL_SESSION cannot distinguish missing credentials from recovery errors.
    // The explicit lookup owns initialization; later auth transitions supersede it.
    if (_event === "INITIAL_SESSION") return;
    if (!session && _event !== "SIGNED_OUT") return;
    const eventEpoch = ++epoch;
    queueMicrotask(() => {
      if (alive && epoch === eventEpoch) {
        apply(session);
        if (_event === "SIGNED_OUT")
          onError(
            "Your account session ended. Sign in to recover your saved paper trades; its device copy is kept.",
          );
      }
    });
  });
  void client.auth
    .getSession()
    .then(({ data, error }) => {
      if (!alive || epoch !== initialEpoch) return;
      if (error) {
        onError("Session restoration unavailable. Your account data has not been changed.");
        store.setAuthChecking(true); // Do not unlock an uncertain account or silently switch to Demo.
      } else apply(data.session);
    })
    .catch(() => {
      if (!alive || epoch !== initialEpoch) return;
      onError("Session restoration unavailable. Your account data has not been changed.");
      store.setAuthChecking(true);
    });
  return () => {
    alive = false;
    epoch++;
    data.subscription.unsubscribe();
  };
}
