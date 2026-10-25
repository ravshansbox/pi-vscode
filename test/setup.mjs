import { registerHooks } from "node:module";

const stubs = {
  typebox: new URL("./stubs/typebox.mjs", import.meta.url).href,
  vscode: new URL("./stubs/vscode.cjs", import.meta.url).href,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier in stubs) return { url: stubs[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
