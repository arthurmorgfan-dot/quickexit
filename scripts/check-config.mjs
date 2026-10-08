import nextEnv from "@next/env";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
// Evaluate the same pure validator used by the application, with existing build tooling.
const filename = new URL("../src/lib/supabase/config.ts", import.meta.url);
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const context = { exports: {}, process, URL, atob };
vm.runInNewContext(compiled, context, { timeout: 1000 });
const { supabaseConfig } = context.exports;
const production = process.argv.includes("--production");
nextEnv.loadEnvConfig(process.cwd(), !production);
try {
  const config = supabaseConfig();
  console.log(
    config
      ? "Public Supabase configuration validated (no network verification performed)."
      : "Supabase is unconfigured. Accounts disabled; Try Demo available.",
  );
} catch (error) {
  // Configuration errors contain instructions only, never URL/key values.
  console.error(error.message);
  process.exitCode = 1;
}
