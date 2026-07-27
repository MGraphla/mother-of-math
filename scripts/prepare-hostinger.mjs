#!/usr/bin/env node
/**
 * Production build for Hostinger (and similar static Apache hosts).
 *
 * 1. Loads .env from project root
 * 2. Validates required VITE_* variables
 * 3. Runs `vite build`
 * 4. Optionally creates deploy/mama-math-hostinger.zip (contents of dist/)
 *
 * Usage:
 *   node scripts/prepare-hostinger.mjs
 *   node scripts/prepare-hostinger.mjs --zip
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const deployDir = join(root, 'deploy');

const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const RECOMMENDED = [
  'VITE_MONITOR_EMAIL',
  'VITE_MONITOR_PASSWORD',
];

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function main() {
  const wantZip = process.argv.includes('--zip');

  console.log('\n📦 Mama Math — Hostinger production build\n');

  loadEnvFile(join(root, '.env'));
  loadEnvFile(join(root, '.env.production'));

  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error('❌ Missing required environment variables:\n');
    missing.forEach((k) => console.error(`   - ${k}`));
    console.error('\nCopy .env.example → .env and fill in Supabase keys.');
    console.error('See HOSTINGER.md for the full checklist.\n');
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED.filter((k) => !process.env[k]?.trim());
  if (missingRecommended.length) {
    console.warn('⚠️  Recommended variables not set (build will continue):\n');
    missingRecommended.forEach((k) => console.warn(`   - ${k}`));
    console.warn('');
  }

  if (process.env.VITE_OPENROUTER_USE_CLIENT_KEY === 'true') {
    console.warn(
      '⚠️  VITE_OPENROUTER_USE_CLIENT_KEY=true — API key will ship in the browser bundle.',
    );
    console.warn('   For production, use the Supabase openrouter-proxy instead.\n');
  }

  const siteUrl = process.env.VITE_SITE_URL?.trim();
  if (siteUrl) {
    console.log(`   Site URL (for your reference): ${siteUrl}`);
  }

  console.log('✓ Environment OK — running vite build…\n');

  execSync('npm run build', { cwd: root, stdio: 'inherit', env: process.env });

  if (!existsSync(join(distDir, 'index.html'))) {
    console.error('❌ Build finished but dist/index.html is missing.');
    process.exit(1);
  }

  console.log('\n✅ Build complete: dist/\n');
  console.log('   Upload everything INSIDE dist/ to Hostinger public_html');
  console.log('   (not the dist folder itself).\n');

  if (wantZip) {
    mkdirSync(deployDir, { recursive: true });
    const zipPath = join(deployDir, 'mama-math-hostinger.zip');
    if (existsSync(zipPath)) rmSync(zipPath);

    const isWin = process.platform === 'win32';
    try {
      if (isWin) {
        const staging = join(deployDir, '_staging');
        if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
        cpSync(distDir, staging, { recursive: true });
        execSync(
          `powershell -NoProfile -Command "Compress-Archive -Path '${staging}\\*' -DestinationPath '${zipPath}' -Force"`,
          { stdio: 'inherit' },
        );
        rmSync(staging, { recursive: true, force: true });
      } else {
        execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
      }
      console.log(`📁 Zip ready: deploy/mama-math-hostinger.zip\n`);
    } catch (err) {
      console.warn('⚠️  Could not create zip automatically. Upload dist/ via File Manager.\n');
    }
  }
}

main();
