import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Until this file loaded Next's TypeScript config, ESLint matched no .ts or
// .tsx file at all — `npm run lint` passed because it linted nothing. It now
// checks everything under src/.
//
// The codebase arrived here with ~650 findings, almost all of them `any` and
// unused variables. Those rules are warnings for now so the check can run in
// CI today; correctness rules (the rules of hooks) stay errors. Turn each
// warning back into an error once its count reaches zero.
export default [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
      // React Compiler advisories: real, but pre-existing patterns rather
      // than bugs in what they flag today.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "graphify-out/**",
      "out/**",
      "build/**",
      "public/**",
      "legacy/**",
      // Deno, not Next.js — they run inside the vault Supabase project.
      "supabase/vault/functions/**",
    ],
  },
];
