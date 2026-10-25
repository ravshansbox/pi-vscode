import { registerHooks } from "node:module";

const stubs = {
  "@sinclair/typebox": new URL("./stubs/typebox.mjs", import.meta.url).href,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier in stubs) return { url: stubs[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
