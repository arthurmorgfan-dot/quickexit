# Approved development migration: SQL Editor handoff

**Status: NOT APPLIED.** Only public application settings are available locally. No secure SQL connection, management token, CLI or project link is configured. The public key cannot verify a dashboard project name or run SQL. No production resources are accessed.

## 1. Confirm the target before executing any SQL

Open your Supabase dashboard and select the dedicated project named **quickexit-dev**. In that project's API/Connect settings, compare its Project URL locally with `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`. Both the project name and URL must match. Do not use a production project. Do not copy passwords/keys into chat, screenshots, SQL files or Git. SQL's `current_database()` commonly returns `postgres`; it does not prove project identity.

## 2. Run the read-only preflight

Open SQL Editor in that verified project. Paste the entire contents of [development-preflight.sql](development-preflight.sql) and run it. Inspect every result and notice: public objects/owners, existing table row counts, function signatures, policies, grants and migration versions. It retrieves counts/catalog metadata only, not user payloads or credentials.

**Stop and report if** either paper table, any `commit_paper_workspace` overload, migration `202610080001`, unexpected public objects or unexpected existing data are present. Do not rerun an existing migration, replace functions, delete data or disable RLS. An existing compatible installation should be verified rather than recreated. Missing REST schema objects alone do not establish that this preflight is clean.

## 3. Apply the reviewed SQL only if preflight is clean

Paste and execute the entire [development-apply.sql](development-apply.sql) as one SQL Editor operation. This file embeds the original migration byte-for-byte inside `BEGIN` / `COMMIT`, preceded by conflict guards and followed by security assertions. It creates no users, seed data or paper positions. It contains no DROP, TRUNCATE, DELETE, RLS disabling, table replacement or existing-data migration. The reviewed `ON DELETE CASCADE` constraints govern future account deletion; this script does not delete accounts. Runtime INSERT/UPDATE statements are the previously reviewed RPC body, not operations performed during migration.

If a conflict or assertion raises an error, **stop**. The transaction must not commit. If SQL Editor retains an aborted transaction, run `ROLLBACK;` before other work. Save the error category without credentials or user data. Do not remove assertions to make it pass. No CLI migration-history table is rewritten; SQL Editor execution may not register a CLI version automatically, so retain this execution record and don't later blindly replay through CLI.

## 4. Verify after application

In a separate SQL Editor operation, run `BEGIN READ ONLY;`, the complete [development-security-checks.sql](development-security-checks.sql), then `COMMIT;`. Inspect the returned policy/RLS metadata. Assertions check forced RLS, anonymous denial, authenticated read-only grants, no direct write privileges, ownership policies, and the security-definer function's owner/search path/execution restrictions. Any failure is a stop condition.

These metadata checks do **not** prove hosted Auth or real JWT user isolation/idempotency. Local automated tests exercise those behaviors against the same migration in isolated PostgreSQL. Actual hosted acceptance needs two dedicated test accounts/inboxes and isolated browser sessions: signup/confirmation, login/logout/restoration, password recovery; own-only reads including forged owner/direct writes; two-device positions/immutable receipts/history/cash restoration; repeated operation IDs, stale revisions, interrupted requests and reconnect. Use Demo prices and simulated funds only. Do not repurpose existing users or reset their data. No test account cleanup without approval.

Report whether preflight was clean, the migration transaction completed and postflight passed. Share only non-sensitive results/errors. Until these steps are actually executed, the project name, remote schema/RLS and migration application remain unverified. No push/deploy or v0.5 is authorized by this handoff.
