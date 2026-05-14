# Deploying Mama Math to your domain

This app is a **Vite + React SPA**. Production output is the **`dist/`** folder after `npm run build`. Upload **everything inside `dist/`** to your host’s **web root** (often `public_html`, `www`, or `htdocs`), not the `dist` folder name itself unless your panel expects that.

## 1. Environment variables (build time)

Vite inlines variables that start with `VITE_` at **build** time.

1. Copy `.env.example` to `.env` in the project root (or set the same keys in your CI/hosting “build environment”).
2. Fill in at least:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_OPENROUTER_API_KEY` and `VITE_OPENROUTER_API_URL` if you use AI features
   - `VITE_MONITOR_PASSWORD` if you expose `/monitor` (use a strong secret in production)
3. Run **`npm run build`** on a machine that has those variables set. The resulting `dist/` is what you deploy.

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
- [ ] Upload **contents** of `dist/` to the document root; old files removed or overwritten if you do incremental deploys.
- [ ] Supabase **Site URL** and **Redirect URLs** match your live domain.
- [ ] **HTTPS** enabled.
- [ ] SPA fallback verified: open a deep link or refresh on a non-root route.
- [ ] Supabase **Edge Functions** and **secrets** deployed if you use server features (`supabase functions deploy`, `supabase secrets set`).

## 6. Optional: build on the server

If your host runs Node (less common on basic static hosting), you can clone the repo, set env vars, run `npm ci` and `npm run build`, then point the web root at `dist/`. Most shared hosts only need the pre-built `dist/` upload.
