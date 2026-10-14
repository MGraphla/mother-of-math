/** Minimal CSV parser for bulk learner import (Excel → Save as CSV). */

export function parseCsv(text: string): { headers: string[]; rows: Record<string, unknown>[] } {
  const lines = splitCsvLines(text.replace(/^\uFEFF/, ""));
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLines(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.length) out.push(cur);
  return out;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

export function buildStudentImportCsvTemplate(): string {
  const headers = [
    "Full Name*",
    "Grade Level*",
    "Date of Birth",
    "Gender",
    "Nationality",
    "Parent/Guardian Name",
    "Parent Phone",
    "Parent Email",
    "School Name",
    "Class Name",
    "Admission Number",
    "Notes",
  ];
  const sample = [
    "Nfor Che Junior",
    "Primary 3",
    "2016-05-12",
    "Male",
    "Cameroonian",
    "Mrs. Ngum Comfort",
    "+237670000000",
    "parent@email.com",
    "GPS Bambili",
    "3A",
    "GPS/2024/001",
    "",
  ];
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return `${headers.map(esc).join(",")}\n${sample.map(esc).join(",")}\n`;
}
