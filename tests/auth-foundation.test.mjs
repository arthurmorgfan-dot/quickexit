import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const {
  authenticate,
  requestPasswordRecovery,
  changePassword,
  authCallbackDestination,
  signOutAccount,
} = loadTypeScript("src/lib/account/auth-flows.ts");
const { observeAccountSession } = loadTypeScript(
  "src/lib/account/auth-session.ts",
);
const { readSupabaseConfig, supabaseSetup } = loadTypeScript(
  "src/lib/supabase/config.ts",
);
const { createPaperApi } = loadTypeScript("src/lib/account/paper-api.ts");
const { createPasswordApi } = loadTypeScript("src/lib/account/password-api.ts");
const { encodePaperTrading } = loadTypeScript(
  "src/lib/paper-trading-storage.ts",
);
const { initialDemo } = loadTypeScript("src/lib/demo-trading.ts");
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const session = (id = A) => ({ user: { id, email: "dev@example.test" } });
const payload = JSON.parse(
  encodePaperTrading({ asset: "BTC", state: initialDemo() }),
);
const password = "test-only-password-12";
const flush = () => new Promise((resolve) => setImmediate(resolve));
function client(patch = {}) {
  const calls = [];
  const result = {
    data: { session: session(), user: session().user },
    error: null,
  };
  const auth = Object.fromEntries(
    [
      "signUp",
      "signInWithPassword",
      "getSession",
      "getUser",
      "exchangeCodeForSession",
      "updateUser",
      "resetPasswordForEmail",
      "signOut",
    ].map((name) => [
      name,
      async (...args) => {
        calls.push([name, ...args]);
        return result;
      },
    ]),
  );
  return { calls, auth: { ...auth, ...patch } };
}
function request(
  body = { id: crypto.randomUUID(), revision: 0, kind: "save", payload },
  origin = "http://localhost:3000",
  path = "/api/paper",
) {
  return new Request("http://localhost:3000" + path, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("configuration rejects incomplete, unsafe URL and privileged credentials without exposing their values", () => {
  assert.equal(readSupabaseConfig(), null);
  for (const [url, key] of [
    ["https://dev.supabase.co", ""],
    ["", "sb_publishable_fixture"],
    ["http://dev.supabase.co", "sb_publishable_fixture"],
    ["https://name:private@dev.supabase.co", "sb_publishable_fixture"],
    ["https://dev.supabase.co/rest/v1", "sb_publishable_fixture"],
    ["https://dev.supabase.co?secret=private", "sb_publishable_fixture"],
    ["https://dev.supabase.co", "sb_secret_private"],
    ["https://dev.supabase.co", "arbitrary_private_key"],
  ])
    assert.throws(
      () => readSupabaseConfig(url, key),
      (error) => !error.message.includes("private"),
    );
  for (const url of [
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
    "https://dev.supabase.co/",
  ])
    assert.ok(readSupabaseConfig(url, "sb_publishable_fixture"));
  const before = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    beforeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://dev.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_private";
    assert.deepEqual(supabaseSetup(), { status: "invalid", config: null });
  } finally {
    if (before === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = before;
    if (beforeUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = beforeUrl;
  }
});

test("signup waits for email confirmation while login requires an actual session", async () => {
  const c = client({
    signUp: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: { session: null }, error: null }),
  });
  assert.equal(
    (
      await authenticate(
        c,
        "signup",
        "dev@example.test",
        password,
        "http://localhost:3000",
        true,
      )
    ).status,
    "confirmation",
  );
  assert.equal(
    (
      await authenticate(
        c,
        "signin",
        "dev@example.test",
        password,
        "http://localhost:3000",
        true,
      )
    ).status,
    "error",
  );
  const good = client();
  assert.equal(
    (
      await authenticate(
        good,
        "signin",
        "dev@example.test",
        password,
        "http://localhost:3000",
        true,
      )
    ).status,
    "signed_in",
  );
  await authenticate(
    good,
    "signup",
    " dev@example.test ",
    password,
    "http://localhost:3000",
    true,
  );
  assert.equal(
    good.calls[1][1].options.emailRedirectTo,
    "http://localhost:3000/auth/callback",
  );
  assert.equal(good.calls[1][1].email, "dev@example.test");
});

test("auth provider rejection and network failure never become successful sign-in or leak provider errors", async () => {
  for (const method of ["signUp", "signInWithPassword"]) {
    for (const fn of [
      async () => ({
        data: { session: null },
        error: { message: "private_provider_details" },
      }),
      async () => {
        throw Error("private_provider_details");
      },
    ]) {
      let called = 0;
      const result = await authenticate(
        client({ [method]: async (...args) => { called++; return fn(...args); } }),
        method === "signUp" ? "signup" : "signin",
        "dev@example.test",
        password,
        "http://localhost:3000",
        true,
      );
      assert.equal(called, 1);
      assert.equal(result.status, "error");
      assert.ok(!result.message.includes("private_provider_details"));
    }
  }
  assert.equal(
    (
      await authenticate(
        null,
        "signin",
        "dev@example.test",
        password,
        "http://localhost:3000",
        true,
      )
    ).status,
    "error",
  );
});

test("confirmation and recovery callbacks verify provider identity, preserve PKCE flow IDs and reject arbitrary redirects", async () => {
  const good = client();
  const url = new URL(
    "http://localhost:3000/auth/callback?code=fixture&next=https://untrusted.test&sb_flow_id=1234567890abcdef1234567890abcdef",
  );
  assert.equal(await authCallbackDestination(good, url), "/app");
  assert.deepEqual(good.calls[0], [
    "exchangeCodeForSession",
    "fixture",
    { flowId: "1234567890abcdef1234567890abcdef" },
  ]);
  const recovery = client({
    exchangeCodeForSession: async () => ({
      data: {
        session: session(),
        user: session().user,
        redirectType: "recovery",
      },
      error: null,
    }),
  });
  assert.equal(await authCallbackDestination(recovery, url), "/reset-password");
  for (const c of [
    null,
    client({
      exchangeCodeForSession: async () => ({
        data: { session: null },
        error: { message: "expired link" },
      }),
    }),
    client({
      getUser: async () => ({ data: { user: { id: B } }, error: null }),
    }),
    client({
      getUser: async () => {
        throw Error("offline");
      },
    }),
  ])
    assert.equal(
      await authCallbackDestination(c, url),
      "/signin?confirmation=failed",
    );
  assert.equal(
    await authCallbackDestination(
      good,
      new URL(
        "http://localhost:3000/auth/callback?code=fixture&sb_flow_id=bad",
      ),
    ),
    "/signin?confirmation=failed",
  );
  assert.equal(
    await authCallbackDestination(
      good,
      new URL("http://localhost:3000/auth/callback?flow=recovery"),
    ),
    "/signin?confirmation=failed",
  );
});

test("password reset request uses generic account-safe messaging and password changes require verified matching identity", async () => {
  const c = client();
  const mail = await requestPasswordRecovery(
    c,
    "dev@example.test",
    "http://localhost:3000",
  );
  assert.equal(mail.ok, true);
  assert.match(mail.message, /If an account exists/);
  assert.equal(c.calls[0][2].redirectTo, "http://localhost:3000/auth/callback");
  assert.equal((await changePassword(c, password, password, A)).ok, true);
  assert.deepEqual(
    c.calls.slice(1).map((call) => call[0]),
    ["getUser", "updateUser"],
  );
  assert.equal((await changePassword(c, password, "mismatch", A)).ok, false);
  const missing = client({
    getUser: async () => ({ data: { user: null }, error: { status: 401 } }),
  });
  assert.equal(
    (await changePassword(missing, password, password, A)).reason,
    "unauthenticated",
  );
  assert.equal(
    (await changePassword(c, password, password, B)).reason,
    "unauthenticated",
  );
  assert.equal(missing.calls.length, 0);
  const error = await requestPasswordRecovery(
    client({
      resetPasswordForEmail: async () => {
        throw Error("private_error");
      },
    }),
    "dev@example.test",
    "http://localhost:3000",
  );
  assert.equal(error.ok, false);
  assert.ok(!error.message.includes("private_error"));
});

test("logout uses local scope and only claims local removal when confirmed, even if revocation fails", async () => {
  const c = client();
  assert.equal((await signOutAccount(c)).signedOut, true);
  assert.deepEqual(c.calls[0], ["signOut", { scope: "local" }]);
  const cleared = client({
    signOut: async () => ({ error: { message: "offline" } }),
    getSession: async () => ({ data: { session: null }, error: null }),
  });
  const result = await signOutAccount(cleared);
  assert.equal(result.signedOut, true);
  assert.match(result.message, /could not confirm session revocation/);
  const retained = client({
    signOut: async () => ({ error: { message: "offline" } }),
  });
  assert.equal((await signOutAccount(retained)).signedOut, false);
});

test("session restoration handles signed-in/out transitions and ignores late initial lookups and detached callbacks", async () => {
  let finish, event;
  const identities = [],
    checking = [],
    errors = [];
  const c = client({
    getSession: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    onAuthStateChange: (callback) => {
      event = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    },
  });
  const stop = observeAccountSession(
    c,
    {
      setAccount: async (identity) => identities.push(identity),
      setAuthChecking: (value) => checking.push(value),
    },
    (m) => errors.push(m),
  );
  event("SIGNED_IN", session(B));
  await flush();
  finish({ data: { session: session(A) }, error: null });
  await flush();
  assert.deepEqual(
    identities.map((i) => i?.id),
    [B],
  );
  event("SIGNED_OUT", null);
  await flush();
  assert.equal(identities.at(-1), null);
  assert.match(errors.at(-1), /session ended/);
  stop();
  event("SIGNED_IN", session(A));
  await flush();
  assert.equal(identities.length, 2);
  assert.equal(checking[0], true);
});

test("failed initial session lookup never unlocks an uncertain account or pretends it is signed out", async () => {
  const identities = [],
    checking = [],
    errors = [];
  const c = client({
    getSession: async () => {
      throw Error("offline");
    },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  });
  const stop = observeAccountSession(
    c,
    {
      setAccount: async (a) => identities.push(a),
      setAuthChecking: (v) => checking.push(v),
    },
    (m) => errors.push(m),
  );
  await flush();
  assert.deepEqual(identities, []);
  assert.equal(checking.at(-1), true);
  assert.match(errors.at(-1), /unavailable/);
  stop();
});

function apiClient(patch = {}) {
  const c = client(patch),
    calls = c.calls;
  c.from = (table) => {
    calls.push(["from", table]);
    return {
      select: () => ({
        eq: (field, owner) => {
          calls.push(["eq", field, owner]);
          return {
            maybeSingle: async () => ({
              data: {
                user_id: owner,
                revision: 1,
                import_decided: true,
                payload,
              },
              error: null,
            }),
          };
        },
      }),
    };
  };
  c.rpc = async (name, command) => {
    calls.push(["rpc", name, command]);
    return {
      data: {
        status: "saved",
        committedRevision: 1,
        record: {
          user_id: A,
          revision: 1,
          import_decided: true,
          payload: command.p_payload,
        },
      },
      error: null,
    };
  };
  return c;
}

test("paper API independently verifies getUser on every read/write and derives owner only from provider", async () => {
  const c = apiClient(),
    api = createPaperApi(async () => c);
  const read = await api.GET();
  assert.equal(read.status, 200);
  assert.equal((await read.json()).userId, A);
  const saved = await api.POST(request());
  assert.equal(saved.status, 200);
  assert.equal(c.calls.filter((c) => c[0] === "getUser").length, 2);
  assert.equal(
    c.calls.some((c) => c[0] === "getSession"),
    false,
  );
  assert.deepEqual(
    c.calls.find((c) => c[0] === "eq"),
    ["eq", "user_id", A],
  );
  assert.match(read.headers.get("cache-control"), /private, no-store/);
  const forged = await api.POST(
    request({
      id: crypto.randomUUID(),
      revision: 0,
      kind: "save",
      payload,
      userId: B,
    }),
  );
  assert.equal(forged.status, 400);
  assert.equal(c.calls.filter((c) => c[0] === "rpc").length, 1);
});

test("anonymous, expired and unavailable auth never reach data queries/RPC, and cross-origin writes fail first", async () => {
  for (const [error, status] of [
    [{ status: 401 }, 401],
    [{ status: 0 }, 503],
    [{ status: 503 }, 503],
    [null, 401],
  ]) {
    const c = apiClient({
        getUser: async () => ({ data: { user: null }, error }),
      }),
      api = createPaperApi(async () => c);
    assert.equal((await api.GET()).status, status);
    assert.equal((await api.POST(request())).status, status);
    assert.equal(c.calls.length, 0);
  }
  const api = createPaperApi(async () => {
    throw Error("Must not be called");
  });
  assert.equal(
    (await api.POST(request(undefined, "https://untrusted.test"))).status,
    403,
  );
  assert.equal((await createPaperApi(async () => null).GET()).status, 503);
  assert.equal(
    (
      await createPaperApi(async () => {
        throw Error("provider failed");
      }).GET()
    ).status,
    503,
  );
});

test("paper API rejects unexpected cross-user provider rows and malformed snapshots without leaking them", async () => {
  const c = apiClient();
  c.from = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: {
            user_id: B,
            payload: { secret: "other_user" },
            revision: 1,
            import_decided: true,
          },
          error: null,
        }),
      }),
    }),
  });
  const read = await createPaperApi(async () => c).GET();
  assert.equal(read.status, 503);
  assert.ok(!(await read.text()).includes("other_user"));
  const result = await createPaperApi(async () => c).POST(
    request({
      id: crypto.randomUUID(),
      revision: 0,
      kind: "save",
      payload: { version: 3, state: { cash: 999 } },
    }),
  );
  assert.equal(result.status, 400);
  assert.equal(
    c.calls.some((c) => c[0] === "rpc"),
    false,
  );
});

test("password API rejects unauthenticated, wrong-identity and cross-origin writes; successful updates do not call paper storage", async () => {
  const body = { password, confirmation: password, expectedUser: A };
  const c = apiClient(),
    api = createPasswordApi(async () => c);
  assert.equal(
    (await api(request(body, "http://localhost:3000", "/api/auth/password")))
      .status,
    200,
  );
  assert.deepEqual(
    c.calls.map((c) => c[0]),
    ["getUser", "updateUser"],
  );
  assert.equal(
    (
      await api(
        request(
          { ...body, expectedUser: B },
          "http://localhost:3000",
          "/api/auth/password",
        ),
      )
    ).status,
    401,
  );
  assert.equal(
    (await api(request(body, "https://untrusted.test", "/api/auth/password")))
      .status,
    403,
  );
  assert.equal(
    (
      await api(
        request(
          { ...body, confirmation: "wrong" },
          "http://localhost:3000",
          "/api/auth/password",
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await createPasswordApi(async () => null)(
        request(body, "http://localhost:3000", "/api/auth/password"),
      )
    ).status,
    503,
  );
});

test("password endpoint bounds malformed input and distinguishes expired sessions from provider outages", async () => {
  const base = "http://localhost:3000/api/auth/password";
  const headers = {
    Origin: "http://localhost:3000",
    "Content-Type": "application/json",
  };
  let lookups = 0;
  const api = createPasswordApi(async () => {
    lookups++;
    return null;
  });
  assert.equal(
    (await api(new Request(base, { method: "POST", headers, body: "{" })))
      .status,
    400,
  );
  assert.equal(
    (
      await api(
        new Request(base, { method: "POST", headers, body: "x".repeat(5000) }),
      )
    ).status,
    413,
  );
  assert.equal(lookups, 0);
  const body = { password, confirmation: password, expectedUser: A };
  for (const [status, expected] of [
    [401, 401],
    [503, 503],
  ]) {
    const c = client({
      getUser: async () => ({
        data: { user: null },
        error: { status, name: "AuthApiError" },
      }),
    });
    const result = await createPasswordApi(async () => c)(
      request(body, "http://localhost:3000", "/api/auth/password"),
    );
    assert.equal(result.status, expected);
    assert.equal(
      c.calls.some((call) => call[0] === "updateUser"),
      false,
    );
  }
});

test("browser transport classifies authorization failures without exposing server error content", async () => {
  const { browserCloudTransport, CloudTransportError } = loadTypeScript(
    "src/lib/account/cloud-api.ts",
  );
  for (const [status, kind] of [
    [401, "auth"],
    [503, "network"],
  ]) {
    const transport = browserCloudTransport(async (_url, options) => {
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.cache, "no-store");
      return new Response("sensitive-provider-error", { status });
    });
    await assert.rejects(
      transport.load(A, new AbortController().signal),
      (error) => {
        assert.ok(error instanceof CloudTransportError);
        assert.equal(error.kind, kind);
        assert.equal(error.status, status);
        assert.ok(!error.message.includes("sensitive-provider-error"));
        return true;
      },
    );
  }
});

test("hosted accounts fail closed until explicitly enabled despite valid public configuration", () => {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED",
  ];
  const previous = names.map((n) => process.env[n]);
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://dev.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_test_only";
    for (const value of [undefined, "false", "TRUE", "1"]) {
      if (value === undefined)
        delete process.env.NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED;
      else process.env.NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED = value;
      assert.deepEqual(supabaseSetup(), { status: "disabled", config: null });
    }
    process.env.NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED = "true";
    assert.equal(supabaseSetup().status, "ready");
  } finally {
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    });
  }
});
