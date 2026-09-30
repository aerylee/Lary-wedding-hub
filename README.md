# Wedding Planning Hub

A shared planning hub for a destination wedding: thirteen linked modules (dashboard, venues, timeline, budget, vendors, guests, travel, seating, run of show, comms, legal, decisions, settings) over one dataset, for the couple and the small team around them.

- **Accounts and roles.** Email magic-link sign-in. Four roles — owner, planner, collaborator, viewer — enforced by Postgres row-level security, not just the UI. Money and guest contact details are the sensitive surfaces.
- **Multi-tenant.** Every row belongs to one wedding; a person can belong to several with a different role in each.
- **Dual currency.** Euro spend against a dollar ceiling, side by side.
- **Editable roles.** Owners can change what each role may see and do, per wedding, from Account & team. The database enforces the edited matrix; owners always keep everything.
- **Comments and team chat.** Comment mode (the speech-bubble button, or press C) pins a thread to anything on the page, with @mentions. Comments are only visible to people who can open that page. Team chat has channels in categories, threads, pins and unread counts.

Mentions are stored in `public.mentions`, with an `emailed_at` column ready for the email notifications that come next. A notification can link to `/w/<wedding>/<page>?comment=<id>` to open the thread, or to `/w/<wedding>/chat?channel=<id>&message=<id>` for a chat message.

Stack: React 18 + TypeScript + Vite + Tailwind, React Router, Supabase (Postgres, Auth, Realtime, Storage, Edge Functions). Claude powers the assistant and email autofill, server-side only.

## Layout

```
src/
  main.tsx            router + providers
  routes/             AuthScreen, Join, Onboarding, WeddingLayout (shell), Team, Account
  lib/                supabase client, generated DB types, auth (can()), store, derive, util, address, email
  components/         kit, icons, Gate (Can / CanButton), editor, attachments, autofill, address editor
  modules/            one file per tab, plus the Assistant
supabase/
  migrations/         schema, RLS, RPCs, seed function, storage, realtime + cron — in order
  functions/          assistant, autofill, send-invite, fx-refresh, purge-attachments
  tests/              pgTAP permission tests
  seed.sql            local dev data: one wedding, one user per role
scripts/db/           run migrations + tests on plain Postgres; generate types without the CLI
```

## Local development

With Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npm install
supabase start              # prints the API URL and anon key
supabase db reset           # applies migrations + seed.sql
supabase test db            # pgTAP permission suite
cp .env.example .env.local  # paste VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Sign in as any seeded user — `owner@`, `planner@`, `collaborator@`, `viewer@` or `outsider@example.test` — and open the magic link from Mailpit at http://127.0.0.1:54324. Sign in as the collaborator to watch the Budget tab disappear.

Without Docker, `npm run db:verify` applies every migration and the seed to a throwaway local Postgres (with stand-ins for Supabase's `auth`/`storage` schemas) and runs the pgTAP suite. It needs PostgreSQL 15+ and pgTAP installed.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests: derive maths, dates/CSV, addresses, email parsing, evidence verification |
| `npm run db:verify` | Migrations + seed + pgTAP on plain Postgres |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the local stack |
| `npm run build` | Typecheck and build the static SPA into `dist/` |

## Deploying

See [docs/DEPLOY.md](docs/DEPLOY.md) for the Supabase project settings, secrets, cron jobs and hosting. See [docs/TESTING.md](docs/TESTING.md) for the permission checks to run before real people get access.

The service-role key and the model API key are server-only: Edge Function secrets, never `VITE_*` variables and never in the repo.
