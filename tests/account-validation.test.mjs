import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { parseCloudCommand, readCloudBody } = loadTypeScript(
  "src/lib/account/request-validation.ts",
);
const { supabaseConfig } = loadTypeScript("src/lib/supabase/config.ts");
const { encodePaperTrading } = loadTypeScript(
  "src/lib/paper-trading-storage.ts",
);
const { initialDemo } = loadTypeScript("src/lib/demo-trading.ts");
const valid = () => ({
  id: crypto.randomUUID(),
  revision: 0,
  kind: "save",
  payload: JSON.parse(
    encodePaperTrading({ asset: "BTC", state: initialDemo() }),
  ),
});
test("API command validation rejects forged owners and corrupted financial records", () => {
  assert.ok(parseCloudCommand(valid()));
  for (const input of [
    null,
    "text",
    [],
    {},
    { ...valid(), id: "invalid" },
    { ...valid(), revision: -1 },
    { ...valid(), revision: 0.5 },
    { ...valid(), kind: "delete" },
    { ...valid(), userId: "other-user" },
    { ...valid(), user_id: "other-user" },
    { ...valid(), payload: { version: 3, state: { cash: 1000000 } } },
  ])
    assert.equal(parseCloudCommand(input), null);
  const input = valid();
  input.payload.injectedSecret = "not allowed";
  assert.equal(
    "injectedSecret" in JSON.parse(parseCloudCommand(input).raw),
    false,
  );
});
test("request reader limits streamed bodies and rejects malformed JSON", async () => {
  const request = new Request("https://quickexit.net/api/paper", {
    method: "POST",
    body: JSON.stringify(valid()),
  });
  assert.ok(await readCloudBody(request));
  await assert.rejects(
    readCloudBody(
      new Request("https://quickexit.net/api/paper", {
        method: "POST",
        body: "{",
      }),
    ),
  );
  await assert.rejects(
    readCloudBody(
      new Request("https://quickexit.net/api/paper", {
        method: "POST",
        headers: { "content-length": "2100001" },
        body: "{}",
      }),
    ),
    /too_large/,
  );
  await assert.rejects(
    readCloudBody(
      new Request("https://quickexit.net/api/paper", {
        method: "POST",
        body: "x".repeat(2100001),
      }),
    ),
    /too_large/,
  );
});
test("configuration accepts only public keys, never a Supabase secret/service-role credential", () => {
  const beforeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    beforeKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(supabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    assert.equal(supabaseConfig().key, "sb_publishable_test");
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_test";
    assert.throws(supabaseConfig, /publishable/);
    const token = (role) =>
      "eyJhbGciOiJIUzI1NiJ9." +
      Buffer.from(JSON.stringify({ role })).toString("base64url") +
      ".signature";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = token("service_role");
    assert.throws(supabaseConfig, /anon key/);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = token("anon");
    assert.ok(supabaseConfig());
  } finally {
    if (beforeUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = beforeUrl;
    if (beforeKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = beforeKey;
  }
});

test("same-origin writes use the public Host behind a reverse proxy, rejecting other origins", () => {
  const { sameOriginWrite, requestOrigin } = loadTypeScript(
    "src/lib/account/request-origin.ts",
  );
  const request = new Request("http://localhost:3000/api/paper", {
    headers: {
      host: "quickexit.net",
      "x-forwarded-proto": "https",
      origin: "https://quickexit.net",
    },
  });
  assert.equal(requestOrigin(request), "https://quickexit.net");
  assert.equal(sameOriginWrite(request), true);
  assert.equal(
    sameOriginWrite(
      new Request(request.url, {
        headers: {
          host: "quickexit.net",
          "x-forwarded-proto": "https",
          origin: "https://other.example",
        },
      }),
    ),
    false,
  );
  assert.equal(sameOriginWrite(new Request(request.url)), false);
  assert.equal(
    sameOriginWrite(
      new Request("http://localhost:3000/api/paper", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
    true,
  );
});
