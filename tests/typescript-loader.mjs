import { access, readFile } from "node:fs/promises";
import ts from "typescript";

const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!context.parentURL || !specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) {
      throw error;
    }
    for (const extension of TYPESCRIPT_EXTENSIONS) {
      const url = new URL(`${specifier}${extension}`, context.parentURL);
      try {
        await access(url);
        return { url: url.href, shortCircuit: true };
      } catch {
        // Try the next TypeScript extension.
      }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!TYPESCRIPT_EXTENSIONS.some((extension) => url.endsWith(extension))) {
    return nextLoad(url, context);
  }
  const source = await readFile(new URL(url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: new URL(url).pathname,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return { format: "module", source: outputText, shortCircuit: true };
}
