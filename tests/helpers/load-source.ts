import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

// Transpiled modules are evaluated with explicit dependency overrides; no live database is loaded.
export function loadSource<T>(file: string, dependencies: Record<string, unknown> = {}): T {
  const filename = path.resolve(file);
  const localRequire = createRequire(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2017,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loaded = { exports: {} as unknown };
  // Evaluate in the Jest environment so source and assertions share the same built-in prototypes.
  const evaluate = new Function('module', 'exports', 'require', '__filename', '__dirname', source) as (
    module: { exports: unknown }, // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
    exports: unknown, // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
    require: NodeJS.Require, // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
    filename: string, // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
    dirname: string, // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
  ) => void;
  const mockedRequire = ((name: string) =>
    name in dependencies ? dependencies[name] : localRequire(name)) as NodeJS.Require;
  evaluate(loaded, loaded.exports, mockedRequire, filename, path.dirname(filename));
  return loaded.exports as T;
}
