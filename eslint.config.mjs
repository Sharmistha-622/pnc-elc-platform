import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
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
      // Deno, not Next.js — they run inside the vault Supabase project.
      "supabase/vault/functions/**",
    ],
  },
];
