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
    epoch++;
    queueMicrotask(() => {
      if (alive) {
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
        onError("Account session unavailable. Try Demo or sign in again.");
        store.setAuthChecking(true); // Do not unlock an uncertain account or silently switch to Demo.
      } else apply(data.session);
    })
    .catch(() => {
      if (!alive || epoch !== initialEpoch) return;
      onError("Account session unavailable. Try Demo or sign in again.");
      store.setAuthChecking(true);
    });
  return () => {
    alive = false;
    epoch++;
    data.subscription.unsubscribe();
  };
}
