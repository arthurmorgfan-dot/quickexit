import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
/** Load the actual TypeScript modules with existing compiler tooling; no test dependency. */
export function loadTypeScript(relativePath) {
  const filename = path.resolve(root, relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const model = new Module(filename);
  model.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, model);
  const require = model.require.bind(model);
  model.require = (specifier) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/"))
      return require(specifier);
    const base = specifier.startsWith("@/")
      ? path.resolve(root, "src", specifier.slice(2))
      : path.resolve(path.dirname(filename), specifier);
    const target = [base, `${base}.ts`, `${base}.tsx`].find(
      (candidate) =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );
    if (!target) throw new Error(`Cannot resolve ${specifier}`);
    return loadTypeScript(target);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  model._compile(compiled, filename);
  return model.exports;
}
