/**
 * Smoke test for network error mapping + Supabase reachability.
 * Run: node --experimental-strip-types scripts/test-network.mjs
 * (plain JS so we don't need a TS runner)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const envText = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

ok("env has SUPABASE_URL", !!url, url ?? "missing");
ok("env has SUPABASE_ANON_KEY", !!key && key.split(".").length === 3, `len=${key?.length ?? 0}`);

// Mirror toFriendlyNetworkError patterns from src/lib/network.ts
const NETWORK_HINT = "Your phone cannot reach the internet";
const toFriendly = (error) => {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  const msg = raw.toLowerCase();
  if (
    msg.includes("unknownhost") ||
    msg.includes("unable to resolve host") ||
    msg.includes("no address associated with hostname") ||
    msg.includes("network request failed") ||
    msg.includes("failed to fetch")
  ) {
    return NETWORK_HINT;
  }
  return raw;
};

ok(
  "maps UnknownHostException",
  toFriendly(
    new Error('fetch failed: java.net.UnknownHostException: Unable to resolve host "yfxomzzihrvaxqyjearo.supabase.co": No address associated with hostname'),
  ).includes("cannot reach the internet"),
);

ok(
  "keeps Invalid login credentials",
  toFriendly(new Error("Invalid login credentials")).includes("Invalid login credentials"),
);

// Live fetch like assertSupabaseReachable
try {
  const health = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  ok("supabase /auth/v1/health reachable", health.status < 500, `status=${health.status}`);
} catch (e) {
  ok("supabase /auth/v1/health reachable", false, String(e));
}

try {
  const auth = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "connectivity-test@example.com", password: "wrong" }),
  });
  const body = await auth.json();
  const expected =
    auth.status === 400 &&
    (body.error_code === "invalid_credentials" || /invalid/i.test(body.msg || body.error || ""));
  ok("auth API responds (invalid_credentials)", expected, JSON.stringify(body));
} catch (e) {
  ok("auth API responds (invalid_credentials)", false, String(e));
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
