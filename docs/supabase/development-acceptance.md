# Development database and account acceptance

Status: user reports both tables have forced/enabled RLS, four expected ownership
policies, SELECT-only authenticated access, no anonymous table access, the expected
security-definer function/search path and execution permissions, and paper_accounts
migration history. These are reported checks; hosted account behavior is unverified.

## Remaining read-only database review

Run the entire `development-final-verification.sql` in a new SQL Editor query in
confirmed quickexit-dev. It returns one JSON result, without relying on Messages.
Do not run the migration. Compare the result to the original migration:

- Workspace has exactly five columns: user_id uuid (required), payload jsonb
  (nullable), revision bigint (required/default 0), import_decided boolean
  (required/default false), updated_at timestamptz (required/default now()).
- Operations has exactly four columns: user_id uuid, operation_id uuid, revision
  bigint, created_at timestamptz; all required, only created_at defaults to now().
- Workspace PK is user_id; operations PK is (user_id, operation_id). Both owner
  foreign keys reference auth.users(id), ON DELETE CASCADE. Workspace revision
  is nonnegative and paper_payload_shape enforces the reviewed version-3 shape,
  assets and size bound. All constraints and indexes are valid.
- No unexplained triggers or extra constraints/indexes; investigate differences.
- column_write_permissions is null (no effective direct column mutation grants).
- Exactly one function overload: (bigint, uuid, jsonb, text), returns jsonb,
  language plpgsql, kind defaults to save; SECURITY DEFINER, empty search_path.
  Owner must be an expected platform/admin role with superuser or BYPASSRLS.
  PUBLIC must not have EXECUTE. Body matches the reviewed migration. A false
  body comparison can be formatting; inspect differences before any decision.
- History version matches 202610080001, not just a similar migration name.
- Review counts. Nonzero counts are not automatically a failure: preserve data
  and identify its origin before testing. Counts may be filtered unless the
  inspecting role bypasses RLS. Never infer absence from filtered zero counts.

## Hosted acceptance — requires separate approval

Do not enable accounts or write test data until the database review passes and
the user approves development-only account testing. Verify the configured URL is
quickexit-dev; use a local app pointed only at that project, Demo prices, two
dedicated accounts A/B with accessible inboxes, and isolated browser contexts
(two devices/sessions for A, one for B). Configure approved localhost confirmation
and recovery redirects. Never use production, existing customer accounts, real
bank details, or service-role credentials in browser tests.

- [ ] Signup A/B: confirmation email delivered, confirmation link creates only
  the intended session; invalid/expired links fail safely.
- [ ] Login: correct credentials succeed, incorrect credentials fail clearly;
  refresh/browser restart restores session. Logout removes account access and
  does not leak account state into guest mode or another account.
- [ ] Password recovery: email delivered, approved redirect works, new password
  works and old password fails; invalid/expired links handled safely.
- [ ] Guest demo remains available. Import is explicit, one-time, and preserves
  the original local demo; repeated attempts cannot overwrite account state.
  Skip-import is durable. A populated cloud account cannot import over its state.
- [ ] A opens simulated EUR100 BTC with +EUR5 net target. Refresh then sign in
  on A's second device: identical position, fixed entry details, settings and
  activity. Demonstrate synchronization on reload/reconnect; do not assume push
  updates unless that behavior is actually observed.
- [ ] Reach target in Demo: exactly one close/immutable receipt and EUR105
  simulated cash. Refresh and restore on the other device. Send to demo bank:
  EUR0 available, EUR105 sent-home total, exactly one payout/history event.
- [ ] B cannot read A's workspace/operation rows using B's actual JWT, including
  explicit A-owner filters. Direct table writes are denied; supplying a forged
  owner through the RPC cannot affect A. Anonymous reads/RPC are denied.
- [ ] Retry the same operation UUID: duplicate response, unchanged revision and
  no added operation, receipt, activity or funds. Scope tests to test accounts.
- [ ] Simultaneous stale writes from A's two devices: one succeeds, other reports
  conflict; no silent overwrite/merge. Preserve losing device data before
  explicit conflict resolution; verify canonical balances and receipts.
- [ ] Offline before save: usable local state retained, accurate pending/offline
  status. Reconnect retries safely. Interrupt after server commit but before
  response: replay uses the same operation ID and does not double apply funds.
- [ ] Expired/revoked session pauses account writes with reauthentication status;
  recovery restores the same account without replay into B or guest storage.
- [ ] Immutable receipts remain unchanged after quote changes, reload and cloud
  restoration; preferences/history persist. Record any untested behavior.

Record test date, app commit, development project, anonymized account labels,
actual outcomes and blockers. Do not record tokens, passwords or email links.
Do not delete test accounts/data without approval. Passing metadata checks alone
does not establish hosted authentication, isolation or synchronization success.
