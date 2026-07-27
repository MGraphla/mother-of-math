# Deploying Mama Math to your domain

> **Hostinger step-by-step:** see **[HOSTINGER.md](./HOSTINGER.md)** (domain, SSL, `public_html`, Supabase, build commands).

This app is a **Vite + React SPA**. Production output is the **`dist/`** folder after `npm run build` or `npm run build:hostinger`. Upload **everything inside `dist/`** to your host’s **web root** (often `public_html`, `www`, or `htdocs`), not the `dist` folder name itself unless your panel expects that.

## 1. Environment variables (build time)

Vite inlines variables that start with `VITE_` at **build** time.

1. Copy `.env.example` to `.env` in the project root (or set the same keys in your CI/hosting “build environment”).
2. Fill in at least:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - **OpenRouter (recommended):** deploy the `openrouter-proxy` Edge Function and set the Supabase secret `OPENROUTER_API_KEY` (see checklist in this file, section 5). The app calls OpenRouter through that proxy by default so keys are not in the browser bundle.
   - **Optional local / legacy:** `VITE_OPENROUTER_USE_CLIENT_KEY=true` plus `VITE_OPENROUTER_API_KEY` only if you intentionally call OpenRouter from the browser (not recommended for production).
   - `VITE_MONITOR_EMAIL` and `VITE_MONITOR_PASSWORD` if you expose `/monitor` (set strong values in production)
3. Run **`npm run build:hostinger`** (validates env + builds) or **`npm run build`**. The resulting `dist/` is what you deploy.

Never commit `.env` or paste server-only secrets (Infobip, ElevenLabs, service role keys) into `VITE_*` variables.

## 2. Supabase Auth URLs (required for login / email links)

In [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **URL configuration**:

- **Site URL**: your production origin, e.g. `https://mamamath.org`
- **Redirect URLs**: add every URL users may return to after auth, for example:
  - `https://mamamath.org/**` (or explicit paths your app uses)
  - `https://mamamath.org/auth/callback`
  - `https://mamamath.org/reset-password` (if you use that route)
  - Any staging origins you use

Mismatch here is the most common cause of “works locally, fails on the real domain.”

## 3. HTTPS

Serve the site over **HTTPS**. Browsers treat mixed content, storage, and some APIs strictly; free certificates (Let’s Encrypt, host panel SSL) are enough.

## 4. SPA routing (refresh and deep links)

Client-side routes (e.g. `/dashboard/...`) need the server to return **`index.html`** for paths that are not real files.

This repo includes:

- **`public/.htaccess`** — copied into `dist/` for **Apache** (typical on Hostinger-style shared hosting). Ensure **AllowOverride** / `.htaccess` processing is enabled for that directory (many hosts enable it by default).
- **`public/_redirects`** — for **Netlify** (`/*` → `/index.html` 200).

If your host uses **Nginx** or another stack, configure an equivalent “try files → `index.html`” rule in their panel or config.

The PWA service worker’s `navigateFallback` does **not** replace server rewrites for every navigation case; keep the server rule.

## 5. Deploy checklist

- [ ] Production `.env` / CI secrets set; `npm run build` succeeds.
- [ ] **OpenRouter:** `supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...` and `supabase functions deploy openrouter-proxy --no-verify-jwt` (see function comment in repo).
- [ ] Upload **contents** of `dist/` to the document root; old files removed or overwritten if you do incremental deploys.
- [ ] Supabase **Site URL** and **Redirect URLs** match your live domain.
- [ ] **HTTPS** enabled.
- [ ] SPA fallback verified: open a deep link or refresh on a non-root route.
- [ ] Supabase **Edge Functions** and **secrets** deployed if you use server features (`supabase functions deploy`, `supabase secrets set`).

## 6. Optional: build on the server

If your host runs Node (less common on basic static hosting), you can clone the repo, set env vars, run `npm ci` and `npm run build`, then point the web root at `dist/`. Most shared hosts only need the pre-built `dist/` upload.
