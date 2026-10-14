// Reports t("…") keys used in app/ and src/ that are missing from either locale,
// plus keys present in English but not French.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_DIRS = ["app", "src"];
const I18N = join(ROOT, "src", "lib", "i18n.ts");

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if ([".ts", ".tsx"].includes(extname(entry))) out.push(full);
  }
  return out;
};

const catalogue = readFileSync(I18N, "utf8");
const [, enBlock = "", frBlock = ""] =
  /\ben\s*:\s*\{([\s\S]*?)\n\s{2}\},\s*\n\s{2}fr\s*:\s*\{([\s\S]*?)\n\s{2}\},/.exec(catalogue) ?? [];

if (!enBlock || !frBlock) {
  console.error("Could not locate the en/fr blocks in i18n.ts");
  process.exit(1);
}

const keysIn = (block) => new Set([...block.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]));
const en = keysIn(enBlock);
const fr = keysIn(frBlock);

const used = new Map();
for (const dir of SOURCE_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const body = readFileSync(file, "utf8");
    for (const m of body.matchAll(/\bt\(\s*"([^"]+)"\s*\)/g)) {
      if (!used.has(m[1])) used.set(m[1], file);
    }
    // Nav configs and similar pass keys through a `labelKey` field.
    for (const m of body.matchAll(/labelKey:\s*"([^"]+)"/g)) {
      if (!used.has(m[1])) used.set(m[1], file);
    }
  }
}

const rel = (p) => p.slice(ROOT.length).replace(/\\/g, "/");
const missingEn = [...used].filter(([k]) => !en.has(k));
const missingFr = [...used].filter(([k]) => !fr.has(k));
const untranslated = [...en].filter((k) => !fr.has(k));

if (missingEn.length) {
  console.log(`\nMissing from English (${missingEn.length}):`);
  for (const [k, f] of missingEn) console.log(`  ${k}  ← ${rel(f)}`);
}
if (missingFr.length) {
  console.log(`\nMissing from French (${missingFr.length}):`);
  for (const [k, f] of missingFr) console.log(`  ${k}  ← ${rel(f)}`);
}
if (untranslated.length) {
  console.log(`\nIn English but not French (${untranslated.length}):`);
  for (const k of untranslated) console.log(`  ${k}`);
}

console.log(
  `\nChecked ${used.size} used keys against ${en.size} English / ${fr.size} French entries.`,
);
process.exit(missingEn.length || missingFr.length || untranslated.length ? 1 : 0);
