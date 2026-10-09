import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadTypeScript } from "./load-typescript.mjs";
const { initialDemo } = loadTypeScript("src/lib/demo-trading.ts");
const { encodePaperTrading } = loadTypeScript(
  "src/lib/paper-trading-storage.ts",
);
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const payload = JSON.parse(
  encodePaperTrading({ asset: "BTC", state: initialDemo() }),
);
async function database() {
  const db = new PGlite();
  // Supabase's auth schema/roles are supplied by the platform in production.
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;
 insert into auth.users values('${A}'),('${B}');`);
  await db.exec(
    fs.readFileSync(
      new URL(
        "../supabase/migrations/202610080001_paper_accounts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const identity = async (id, role = "authenticated") => {
    await db.exec(`reset role;set role ${role};`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id ?? "",
    ]);
  };
  const commit = async (
    revision,
    id = crypto.randomUUID(),
    kind = "save",
    data = payload,
  ) =>
    (
      await db.query(
        "select public.commit_paper_workspace($1,$2,$3::jsonb,$4) as result",
        [revision, id, JSON.stringify(data), kind],
      )
    ).rows[0].result;
  return { db, identity, commit };
}
test("actual migration enforces RLS: each user reads only their own state and operation receipts", async () => {
  const { db, identity, commit } = await database();
  try {
    await identity(A);
    await commit(0);
    await identity(B);
    assert.deepEqual(
      (await db.query("select * from public.paper_workspaces")).rows,
      [],
    );
    assert.deepEqual(
      (await db.query("select * from public.paper_operations")).rows,
      [],
    );
    await commit(0);
    let rows = (await db.query("select user_id from public.paper_workspaces"))
      .rows;
    assert.deepEqual(rows, [{ user_id: B }]);
    await identity(A);
    rows = (await db.query("select user_id from public.paper_workspaces")).rows;
    assert.deepEqual(rows, [{ user_id: A }]);
    assert.equal(
      (
        await db.query(
          "select * from public.paper_workspaces where user_id=$1",
          [B],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "update public.paper_workspaces set payload=$1::jsonb where user_id=$2",
        [JSON.stringify(payload), B],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("insert into public.paper_workspaces(user_id) values($1)", [B]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("delete from public.paper_operations"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("anonymous or missing identities cannot read or commit account data", async () => {
  const { db, identity, commit } = await database();
  try {
    await identity(null, "anon");
    await assert.rejects(
      db.query("select * from public.paper_workspaces"),
      /permission denied/,
    );
    await assert.rejects(commit(0), /permission denied/);
    await identity(null);
    await assert.rejects(commit(0), /Authentication required/);
    assert.deepEqual(
      (await db.query("select * from public.paper_workspaces")).rows,
      [],
    );
  } finally {
    await db.close();
  }
});
test("duplicate commit IDs are transactional no-ops and stale revisions cannot overwrite a newer device", async () => {
  const { db, identity, commit } = await database();
  try {
    await identity(A);
    const id = crypto.randomUUID();
    const first = await commit(0, id);
    assert.equal(first.status, "saved");
    assert.equal(first.record.revision, 1);
    const retry = await commit(0, id);
    assert.equal(retry.status, "duplicate");
    assert.equal(retry.record.revision, 1);
    assert.equal(retry.committedRevision, 1);
    const stale = await commit(0);
    assert.equal(stale.status, "conflict");
    assert.equal(stale.record.revision, 1);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from public.paper_operations",
        )
      ).rows[0].count,
      1,
    );
    await commit(1);
    const later = await commit(0, id);
    assert.equal(later.status, "duplicate");
    assert.equal(later.committedRevision, 1);
    assert.equal(later.record.revision, 2);
  } finally {
    await db.close();
  }
});
test("one-time import and skip decisions are durable; retries and new operation IDs cannot import twice", async () => {
  const { db, identity, commit } = await database();
  try {
    await identity(A);
    const id = crypto.randomUUID();
    const first = await commit(0, id, "import");
    assert.equal(first.record.import_decided, true);
    const retry = await commit(0, id, "import");
    assert.equal(retry.status, "duplicate");
    assert.equal(
      (await commit(1, crypto.randomUUID(), "import")).status,
      "import_unavailable",
    );
    await commit(1, crypto.randomUUID(), "save");
    assert.equal(
      (await commit(2, crypto.randomUUID(), "import")).status,
      "import_unavailable",
    );
    await identity(B);
    await commit(0, crypto.randomUUID(), "skip_import");
    assert.equal(
      (await commit(1, crypto.randomUUID(), "import")).status,
      "import_unavailable",
    );
  } finally {
    await db.close();
  }
});
test("invalid requests fail atomically without inserting snapshots or receipts", async () => {
  const { db, identity, commit } = await database();
  try {
    await identity(A);
    for (const invalid of [
      null,
      {},
      { ...payload, version: 4 },
      { ...payload, state: null },
      { ...payload, selectedAsset: "DOGE" },
    ])
      await assert.rejects(
        commit(0, crypto.randomUUID(), "save", invalid),
        /Invalid paper snapshot/,
      );
    await assert.rejects(commit(-1), /Invalid paper snapshot/);
    await assert.rejects(
      commit(0, crypto.randomUUID(), "arbitrary"),
      /Invalid paper snapshot/,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from public.paper_workspaces",
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from public.paper_operations",
        )
      ).rows[0].count,
      0,
    );
  } finally {
    await db.close();
  }
});

test("identical operation IDs are scoped per authenticated owner; altered duplicate payloads cannot change stored balances", async () => {
  const { db, identity, commit } = await database();
  try {
    const id = crypto.randomUUID();
    await identity(A);
    const first = await commit(0, id);
    const altered = { ...payload, state: { ...payload.state, cash: 999999 } };
    const duplicate = await commit(0, id, "save", altered);
    assert.equal(duplicate.status, "duplicate");
    assert.deepEqual(duplicate.record.payload, first.record.payload);
    await identity(B);
    const own = await commit(0, id);
    assert.equal(own.status, "saved");
    assert.equal(own.record.user_id, B);
    const receipts = (
      await db.query(
        "select user_id, operation_id from public.paper_operations",
      )
    ).rows;
    assert.deepEqual(receipts, [{ user_id: B, operation_id: id }]);
    await identity(A);
    assert.equal(
      (await db.query("select user_id from public.paper_operations")).rows[0]
        .user_id,
      A,
    );
  } finally {
    await db.close();
  }
});

test("RLS/grants deny anonymous JWT subjects and all direct INSERT/UPDATE/DELETE/TRUNCATE mutations", async () => {
  const { db, identity, commit } = await database();
  try {
    await identity(A);
    await commit(0);
    for (const table of ["paper_workspaces", "paper_operations"]) {
      for (const sql of [
        `delete from public.${table}`,
        `truncate public.${table}`,
      ])
        await assert.rejects(db.query(sql), /permission denied/);
    }
    await assert.rejects(
      db.query("update public.paper_operations set revision=999"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("insert into public.paper_operations values($1,$2,999,now())", [
        A,
        crypto.randomUUID(),
      ]),
      /permission denied/,
    );
    await identity(A, "anon");
    await assert.rejects(commit(1), /permission denied/);
    await assert.rejects(
      db.query("select * from public.paper_operations"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("security-definer writes ignore caller search_path and nonexistent Auth owners fail atomically", async () => {
  const { db, identity, commit } = await database();
  try {
    await identity(A);
    await db.exec(
      "set search_path = pg_temp; create temporary table paper_workspaces (user_id uuid, revision bigint); create temporary table paper_operations (user_id uuid, operation_id uuid, revision bigint);",
    );
    const saved = await commit(0);
    assert.equal(saved.record.user_id, A);
    assert.equal(saved.record.revision, 1);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from pg_temp.paper_workspaces",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from pg_temp.paper_operations",
        )
      ).rows[0].n,
      0,
    );
    await identity("33333333-3333-4333-8333-333333333333");
    await assert.rejects(commit(0), /foreign key/);
    assert.deepEqual(
      (await db.query("select * from public.paper_workspaces")).rows,
      [],
    );
  } finally {
    await db.close();
  }
});

test("development SQL Editor bundle contains the unchanged migration, applies atomically and passes security assertions", async () => {
  const bundle = fs.readFileSync(
    new URL("../docs/supabase/development-apply.sql", import.meta.url),
    "utf8",
  );
  const original = fs.readFileSync(
    new URL(
      "../supabase/migrations/202610080001_paper_accounts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(
    bundle
      .split("-- BEGIN UNCHANGED REVIEWED MIGRATION\n")[1]
      .split("\n-- END UNCHANGED REVIEWED MIGRATION")[0],
    original,
  );
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;`);
    await db.exec(bundle);
    assert.equal(
      (await db.query("select count(*)::int as n from public.paper_workspaces"))
        .rows[0].n,
      0,
    );
    await assert.rejects(db.exec(bundle), /Existing QuickExit objects/);
    await db.exec("rollback");
    assert.equal(
      (await db.query("select count(*)::int as n from public.paper_operations"))
        .rows[0].n,
      0,
    );
    await db.exec(
      fs.readFileSync(
        new URL("../docs/supabase/development-preflight.sql", import.meta.url),
        "utf8",
      ),
    );
  } finally {
    await db.close();
  }
});

test("development security assertions fail closed on unexpected grants or missing forced RLS", async () => {
  const { db } = await database();
  const checks = fs.readFileSync(
    new URL(
      "../docs/supabase/development-security-checks.sql",
      import.meta.url,
    ),
    "utf8",
  );
  try {
    await db.exec(checks);
    await db.exec("grant insert on public.paper_workspaces to authenticated");
    await assert.rejects(db.exec(checks), /Forbidden direct INSERT/);
    await db.exec(
      "revoke insert on public.paper_workspaces from authenticated; alter table public.paper_operations no force row level security",
    );
    await assert.rejects(db.exec(checks), /RLS missing or not forced/);
  } finally {
    await db.close();
  }
});

test("v0.8 read-only security report checks effective grants, forced RLS and PUBLIC execution without modifying records", async () => {
  const { db } = await database();
  try {
    const sql = fs.readFileSync(new URL("../docs/supabase/v0.8-read-only-security.sql", import.meta.url), "utf8");
    const results = await db.exec(sql);
    const report = results.flatMap(result => result.rows).find(row => row.security_verification)?.security_verification;
    assert.ok(report);
    assert.equal(report.rls.length, 2);
    assert.ok(report.rls.every(row => row.enabled && row.forced));
    assert.equal(report.policies.length, 4);
    assert.equal(report.effective_table_privileges.length, 4);
    for (const row of report.effective_table_privileges) {
      assert.equal(row.can_select, row.rolname === "authenticated");
      for (const permission of ["can_insert", "can_update", "can_delete", "can_truncate", "can_reference", "can_trigger"]) assert.equal(row[permission], false);
    }
    assert.equal(report.functions.length, 1);
    const fn = report.functions[0];
    assert.equal(fn.security_definer, true);
    assert.equal(fn.anon_execute, false);
    assert.equal(fn.public_execute, false);
    assert.equal(fn.authenticated_execute, true);
    assert.ok(fn.proconfig.includes('search_path=""'));
    assert.equal((await db.query("select count(*)::int as n from public.paper_operations")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int as n from public.paper_workspaces")).rows[0].n, 0);
  } finally { await db.close(); }
});
