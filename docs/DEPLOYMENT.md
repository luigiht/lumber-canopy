# Deployment (Vercel)

The app is a standard Next.js project, so Vercel builds it with no extra configuration. Once the GitHub repo is connected to Vercel:

- every push to `main` deploys to **production**;
- every other branch or pull request gets its own **preview** URL. Vercel tells search engines not to index preview URLs.

## One-time setup

1. In Vercel, choose **Add New → Project** and import `luigiht/lumber-canopy` from GitHub.
2. Leave the detected settings:
   - **Framework:** Next.js
   - **Install:** `pnpm install` (detected from `pnpm-lock.yaml`)
   - **Build:** `next build`
   - **Output:** `.next`
3. Add the environment variables below (**Settings → Environment Variables**), then deploy.
4. Optional: add a custom domain under **Settings → Domains**.

| Variable | Needed? | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | For online accounts | Supabase **Project URL** (`https://….supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For online accounts | Supabase **publishable** (anon) key. Never the secret or service-role key. |
| `NEXT_PUBLIC_SITE_URL` | Only with a custom domain | e.g. `https://lumberandcanopy.com`. Without it, links use Vercel's production address automatically. |

Without the Supabase variables the deployed game still works, in offline mode (saves stay in each player's browser).

`NEXT_PUBLIC_` values are built into the app. After changing them in Vercel, redeploy (**Deployments → ⋯ → Redeploy**) for them to take effect.

## Supabase for the deployed site

In Supabase **Authentication → URL Configuration**:

- **Site URL:** the production address (custom domain or `https://<project>.vercel.app`).
- **Redirect URLs:** add `<site>/reset-password`, and `https://*-<team>.vercel.app/**` if you want sign-up and password-reset emails to work on preview deployments.

The database setup itself is in the main [README](../README.md#setting-up-supabase).

## What the repo does to make this work

- **One lockfile:** only `pnpm-lock.yaml` (the stale `package-lock.json` was removed), so Vercel installs with pnpm and the exact locked versions.
- **Node version:** `package.json` asks for Node 20 or newer (`engines`).
- **Site address fallback:** `src/config/site.ts` uses `NEXT_PUBLIC_SITE_URL`, then Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, then localhost. Share cards, canonical links, the sitemap and `robots.txt` therefore point at the live site from the first deploy.
- **Secrets stay out of git:** `.env*` files are ignored (except `.env.example`), so keys only live in Vercel's settings.

## Before pushing

- **The build must pass:** a failed build blocks the deploy, and the previous version stays live. Run `pnpm typecheck` and `pnpm lint` first.
- **Running `pnpm build` locally:** stop `pnpm dev` first, because they share `.next`.
