import { readFileSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('Usage: node scripts/extract-docx-text.mjs <path-to-docx>');
  process.exit(1);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'temp-docx');
const zipCopy = join(out, 'template.zip');
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyFileSync(src, zipCopy);

execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${out.replace(/'/g, "''")}' -Force"`,
  { stdio: 'inherit' },
);

const xml = readFileSync(join(out, 'word/document.xml'), 'utf8');
const text = xml
  .replace(/<w:tab[^>]*\/>/g, '\t')
  .replace(/<w:br[^>]*\/>/g, '\n')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

console.log(text);
