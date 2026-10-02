import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

export default ts.config(
  {
    // Vendored shadcn-svelte components; updated with the shadcn-svelte CLI.
    ignores: ["**/dist/", "**/node_modules/", "packages/web/src/lib/components/ui/"],
  },
  js.configs.recommended,
  ...ts.configs.strict,
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    files: ["packages/web/**"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["packages/server/**"],
    languageOptions: { globals: globals.node },
  },
  {
    // The domain is pure: it must not depend on any other package or runtime.
    files: ["packages/domain/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@pairbox/*", "node:*"] }],
    },
  },
);
