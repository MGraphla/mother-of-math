# Deploy Mama Math on Hostinger (real domain)

This app is a **static React SPA** backed by **Supabase** (database, auth, storage, Edge Functions). Hostinger shared hosting only needs the built files in `dist/` — no Node.js server on the host.

---

## What you need before starting

| Item | Where |
|------|--------|
| Hostinger account + domain | [hostinger.com](https://www.hostinger.com) — point domain DNS to Hostinger |
| Supabase project | [supabase.com/dashboard](https://supabase.com/dashboard) |
| OpenRouter API key | [openrouter.ai](https://openrouter.ai) — stored as **Supabase secret**, not in the website files |
| Your PC with Node.js 18+ | To run the production build |

---

## Part 1 — Configure Supabase (backend)

Do this **once** before going live.

### 1.1 Database & auth

- Run your SQL migrations in the Supabase SQL editor (`supabase-admin-functions.sql`, etc.) if not already applied.
- **Authentication → URL configuration**
  - **Site URL:** `https://yourdomain.com` (replace with your real domain)
  - **Redirect URLs** (add each):
    - `https://yourdomain.com/**`
    - `https://yourdomain.com/auth/callback`
    - `https://yourdomain.com/reset-password`
    - `https://www.yourdomain.com/**` (if you use `www`)

### 1.2 Edge Functions (AI, SMS, audio)

Install [Supabase CLI](https://supabase.com/docs/guides/cli), then from the project folder:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy functions and secrets:

```bash
# OpenRouter (chat, grading, lesson plans) — required for AI features
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
supabase functions deploy openrouter-proxy --no-verify-jwt

# Optional — only if you use these features:
# supabase secrets set --env-file supabase/.env
# supabase functions deploy signup-verification
# supabase functions deploy student-work-feedback-audio
# supabase functions deploy send-sms-notification
```

`openrouter-proxy` keeps the OpenRouter key on the server. The website calls it with the logged-in user’s Supabase JWT.

### 1.3 Storage

In Supabase **Storage**, ensure buckets used by the app exist (e.g. `student-works`) with policies that match your RLS setup.

---

## Part 2 — Build on your computer

### 2.1 Environment file

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```env
VITE_SITE_URL=https://yourdomain.com
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
VITE_MONITOR_EMAIL=partner@yourdomain.com
VITE_MONITOR_PASSWORD=choose-a-strong-password
```

**Do not** set `VITE_OPENROUTER_API_KEY` for production unless you intentionally want the key inside the public JavaScript bundle.

### 2.2 Production build

```bash
npm ci
npm run build:hostinger
```

Optional — create a zip for upload:

```bash
npm run build:hostinger:zip
```

Output:

- **`dist/`** — upload **everything inside** this folder to Hostinger
- **`deploy/mama-math-hostinger.zip`** — optional; extract in `public_html` on the server

Test locally before uploading:

```bash
npm run preview:prod
```

Open `http://localhost:4173` and try sign-in and a dashboard route.

---

## Part 3 — Upload to Hostinger

### 3.1 Open hPanel

1. Log in to **Hostinger hPanel**
2. **Websites** → your site → **File Manager**
3. Open **`public_html`** (this is your web root)

### 3.2 Upload files

- Delete old default files (`index.html`, etc.) if this is a fresh site
- Upload **all contents** of `dist/`:
  - `index.html`
  - `assets/` folder
  - `.htaccess` (enable “show hidden files” in File Manager)
  - `sw.js`, `workbox-*.js`, `favicon.svg`, images, etc.

**Important:** Files must sit **directly** in `public_html`, not in `public_html/dist/`.

### 3.3 SSL (HTTPS)

1. hPanel → **SSL** → install **Free SSL** (Let’s Encrypt) for your domain  
2. Wait until status is **Active**  
3. The included `.htaccess` redirects HTTP → HTTPS

### 3.4 Domain

- **Primary domain** should point to this hosting package  
- If using **www**, add redirect in hPanel or keep both in Supabase redirect URLs

---

## Part 4 — Verify after go-live

Open your domain and check:

| Test | Expected |
|------|----------|
| `https://yourdomain.com/` | Home page loads |
| `https://yourdomain.com/sign-in` | Sign-in works |
| Refresh on `https://yourdomain.com/dashboard` | No 404 (SPA routing) |
| Sign up / magic link / Google | Redirect returns to your domain (Supabase URLs) |
| Teacher chat / AI grading | Works (openrouter-proxy deployed + secret set) |
| `https://yourdomain.com/monitor/login` | Monitor login with your `VITE_MONITOR_*` credentials |

If you see a yellow banner at the bottom: the build is missing Supabase env vars — rebuild with a correct `.env` and re-upload `dist/`.

---

## Part 5 — Updating the live site

Whenever you change the app:

1. Pull latest code on your PC  
2. `npm run build:hostinger`  
3. Upload **overwrite** all files in `public_html` (or delete old `assets/` first to avoid stale chunks)  
4. Hard-refresh browser (Ctrl+Shift+R)

---

## Troubleshooting

### Blank page or “Expected a JavaScript module”

- Old `assets/` files left on the server — delete `public_html/assets/` and re-upload full `dist/`
- `.htaccess` missing — ensure it uploaded (hidden file)

### Login works locally but not on the domain

- Supabase **Site URL** and **Redirect URLs** must match `https://yourdomain.com`
- Site must be served over **HTTPS**

### AI features fail

- Deploy `openrouter-proxy` and set `OPENROUTER_API_KEY` secret  
- User must be signed in (proxy requires JWT)  
- Check browser Network tab for `functions/v1/openrouter-proxy` errors

### 404 on refresh for `/dashboard/...`

- `.htaccess` not applied — contact Hostinger support to enable `AllowOverride` for Apache, or use their “Single Page Application” option if available

### Monitor shows wrong password

- `VITE_MONITOR_EMAIL` / `VITE_MONITOR_PASSWORD` are baked in at **build** time — change `.env`, rebuild, re-upload

---

## Security reminders

- Never commit `.env` or upload it to Hostinger  
- Never put **service role** keys, Infobip keys, or OpenRouter keys in `VITE_*` variables  
- Use a **strong** monitor password before sharing `/monitor`  
- Keep Supabase RLS policies enabled for all tables

---

## Quick command reference

```bash
npm run build:hostinger      # validate .env + build dist/
npm run build:hostinger:zip  # build + create deploy/mama-math-hostinger.zip
npm run preview:prod         # test dist/ locally
```

For general hosting notes (Netlify, env list), see [HOSTING.md](./HOSTING.md).
