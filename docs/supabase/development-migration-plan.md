# Development Supabase migration approval plan

No remote database changes have been executed. The configured development Auth endpoint responds successfully with the public key; signup/email are enabled and confirmation is required. Zero-row REST checks for both paper tables returned `404 / PGRST205`. This is evidence of missing exposed schema, not proof that no database objects exist.

## Required access

The application needs only the configured public URL/key. Applying migrations additionally requires an authorized development SQL editor session, or a development PostgreSQL connection provided securely through an ignored environment file. Do not paste connection strings/passwords into chat. No service-role key is needed. Supabase CLI/Docker are unavailable in this environment. Two dedicated test-account email addresses/inboxes are also needed to verify actual confirmation and recovery delivery; no existing users will be repurposed.

## Plan requiring approval

1. Confirm the SQL connection targets the same explicitly authorized development project. Never use production.
2. Read database catalogs to inspect existing `public.paper_workspaces`, `public.paper_operations`, `public.commit_paper_workspace(bigint,uuid,jsonb,text)`, policies, grants and migration history. If any object already exists, stop and compare it; do not blindly rerun the create statements, replace objects or overwrite data.
3. If absent, apply `supabase/migrations/202610080001_paper_accounts.sql` in a single transaction. It creates two empty owner-scoped tables: one paper-state aggregate and one idempotency journal. No seed users, balances or financial activity are inserted.
4. Enable and force RLS on both tables. Own-record policies use `auth.uid()`. Anonymous access and direct authenticated writes are revoked; authenticated users may read only their own records.
5. Create the owner-derived, revision-checked transaction RPC with an empty search path and authenticated-only execution. The function atomically saves paper positions/receipts/history/cash and an owner-scoped operation receipt. Duplicate operation IDs and stale revisions cannot replay balances.
6. Before commit, inspect resulting constraints, policies, grants, RLS flags and function ownership/configuration. Roll back the entire transaction if any check fails. No disabling RLS, dropping tables, resetting data or destructive migration.
7. After successful migration, test through two dedicated Auth users and isolated browser contexts. Verify confirmation, login/logout/restoration, recovery, isolation, cross-device paper receipts/cash/history, duplicate writes, interrupted responses and reconnect/conflict handling. Preserve existing users/data; test users are not deleted without approval.

Paper payload schema stays v3 and local account journal v1. Existing legacy snapshots remain compatible. All testing uses Demo prices and simulated trading/transfers only.

Approval of this plan authorizes only the development migration described above. Push/deploy and production database access remain excluded.
