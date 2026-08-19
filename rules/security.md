---
trigger: always_on
description: Secrets, environment variables, and auth handling
---

# Security Rules

## Rules

- Never hardcode API keys, Supabase URLs/keys, or any credential in source code —
  always read from environment variables (`process.env.NEXT_PUBLIC_*` for
  values needed client-side, unprefixed `process.env.*` for server-only values).
- Never commit `.env` / `.env.local` — confirm they stay covered by `.gitignore`
  before adding any new env-dependent feature.
- Anything prefixed `NEXT_PUBLIC_` is exposed to the browser — never put a secret
  (service-role key, private API token) behind that prefix.
- Auth checks belong on the server (middleware, server components, route
  handlers) — a client-side redirect or conditional render is a UX nicety, not a
  security boundary. Don't treat "the button is hidden" as equivalent to "the
  action is protected."
- When writing a script that touches production data (anything under
  `src/scripts` or root-level `*.ts` maintenance scripts), require an explicit
  confirmation step or dry-run flag before it mutates data.
- Log errors without leaking sensitive payloads (user emails, tokens) into
  client-visible console output in production code paths.
