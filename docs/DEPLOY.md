# Deploying

## 1. Supabase project

Use the **Pro plan**, or keep the daily FX job running. Free projects pause after about a week of low activity, and over a two-year planning horizon that shows up as "the site is broken".

```bash
supabase link --project-ref <ref>
supabase db push                 # applies supabase/migrations in order
supabase functions deploy assistant autofill send-invite fx-refresh purge-attachments
supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```

Never change the schema in the dashboard. Every change is a migration file, so staging and production stay identical.

## 2. Auth settings (dashboard → Authentication)

| Setting | Value |
|---|---|
| Providers | Email only, magic link / OTP. Password sign-in off. |
| Site URL | `https://<your-domain>` |
| Redirect allow-list | `https://<your-domain>/**` (and `http://localhost:5173/**` for development) |
| Email OTP expiry | 3600 seconds |
| Rate limits → emails per hour | Keep it low (e.g. 30). The endpoint must not become an email cannon. |
| JWT expiry | 3600 seconds, refresh tokens on |
| Email template (Magic Link) | Include `{{ .Token }}` as well as the link, so people who open the email on another device can type the 6-digit code. |
| SMTP | Configure a real SMTP provider; the built-in sender is heavily rate-limited. |

Signup stays **on**. A new user with no invitation lands on "Create your wedding" and can reach nothing else. That falls out of RLS.

## 3. Secrets

```bash
supabase secrets set MODEL_API_KEY=sk-ant-...        # Claude, for assistant + autofill
supabase secrets set SITE_URL=https://<your-domain>   # where invitation links point
supabase secrets set ALLOWED_ORIGINS=https://<your-domain>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.

## 4. Scheduled jobs

Migration `…008` schedules two pg_cron jobs through pg_net: a daily FX refresh and an hourly attachment purge. They read the project URL and service key from Vault. Run this once in the SQL editor:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<service-role-key>',        'service_role_key');
```

Use the **legacy `service_role` JWT** (Project Settings → API) as `service_role_key`. The two cron functions accept exactly the key the platform injects as `SUPABASE_SERVICE_ROLE_KEY`. They're deployed with `verify_jwt = false` and check the key themselves.

If pg_cron or pg_net weren't available when the migration ran, enable them (Database → Extensions) and re-run the `do $outer$ … $outer$` block from that migration.

## 5. Hosting the SPA

Build with `npm run build` and deploy `dist/` to any static host. SPA fallbacks are included for Vercel (`vercel.json`) and Netlify / Cloudflare Pages (`public/_redirects`), so `/join?token=…` and deep links resolve. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's build environment.

## 6. Before inviting anyone

Run the checks in [TESTING.md](TESTING.md) against the deployed project.
