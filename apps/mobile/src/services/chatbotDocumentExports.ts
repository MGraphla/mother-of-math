/**
 * Mobile ports of web `chatbotDocumentExports`:
 * LaTeX extract, worksheet PDF/Word, Markdown-table Excel (or rubric template).
 *
 * Saving uses `src/native/saveFile.ts` so files land in Files / Downloads
 * instead of the share sheet. PDFs prefer Print `base64` so we skip
 * Expo Go's unreadable `Print /` temp folder.
 *
 * Excel uses SpreadsheetML (.xls) instead of SheetJS `xlsx` — Metro cannot
 * resolve `xlsx`'s `./dist/cpexcel.js` on React Native.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import * as Print from "expo-print";
import { shareBase64File, shareLocalFile, shareUtf8File } from "../native/shareFile";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Pull $...$ and $$...$$ segments for "Copy LaTeX" (same as web). */
export function extractLatexSnippets(markdown: string): string {
  const chunks: string[] = [];
  const display = markdown.match(/\$\$[\s\S]*?\$\$/g);
  if (display) chunks.push(...display);
  const rest = markdown.replace(/\$\$[\s\S]*?\$\$/g, "\n");
  const inline = rest.match(/\$[^$\n]+\$/g);
  if (inline) chunks.push(...inline);
  return chunks.join("\n\n").trim();
}

/** Very small Markdown → plain text (keeps line breaks). */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) => {
      const m = /^```(\w*)\n?([\s\S]*?)```$/m.exec(block);
      return m ? `\n${m[2]}\n` : "";
    })
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMarkdownTable(md: string): string[][] | null {
  const lines = md.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => l.startsWith("|") && l.includes("---"));
  if (start < 1) return null;
  const header = lines[start - 1];
  if (!header.startsWith("|")) return null;
  const splitRow = (row: string) =>
    row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
  const headers = splitRow(header);
  const rows: string[][] = [headers];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    rows.push(splitRow(line));
  }
  return rows.length > 1 ? rows : null;
}

/** SpreadsheetML workbook Excel / Sheets open without the SheetJS bundle. */
function rowsToSpreadsheetMl(rows: string[][], sheetName: string): string {
  const xmlRows = rows
    .map((row) => {
      const cells = row
        .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`;
}

/** Worksheet PDF via expo-print (mobile equivalent of web jsPDF download). */
export async function shareWorksheetPdf(markdown: string, title: string): Promise<void> {
  const plain = markdownToPlainText(markdown);
  const lines = (plain || "(empty)")
    .split("\n")
    .map((l) => `<p style="margin:0 0 8px;font-size:12pt;line-height:1.45">${escapeHtml(l) || "&nbsp;"}</p>`)
    .join("");
  const answerLines = Array.from({ length: 8 })
    .map(
      () =>
        `<div style="border-bottom:1px solid #b4b4b4;height:28px;margin:10px 0"></div>`,
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>body{font-family:Helvetica,Arial,sans-serif;padding:24px;color:#222}</style>
    </head><body>
    <h1 style="font-size:16pt;margin:0 0 16px">${escapeHtml(title.slice(0, 120) || "MAMA worksheet")}</h1>
    ${lines}
    <div style="margin-top:20px">${answerLines}</div>
    </body></html>`;

  // Prefer base64 so we never copy from Expo Go's unreadable `Print /` temp folder.
  const file = await Print.printToFileAsync({ html, base64: true });
  const name = `mama-worksheet-${new Date().toISOString().slice(0, 10)}.pdf`;
  if (file.base64) {
    await shareBase64File(file.base64, name, "application/pdf");
    return;
  }
  await shareLocalFile(file.uri, name, "application/pdf");
}

/** Word (.docx) worksheet — same structure as web. */
export async function shareWorksheetDocx(markdown: string, title: string): Promise<void> {
  const plain = markdownToPlainText(markdown);
  const paragraphs = plain.split(/\n\n+/).map(
    (block) =>
      new Paragraph({
        children: [new TextRun({ text: block, break: 1 })],
        spacing: { after: 200 },
      }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: title || "MAMA Math — Worksheet",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 },
          }),
          ...paragraphs,
          new Paragraph({ text: "", spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Name: ___________________________    Date: _______________",
                italics: true,
              }),
            ],
            alignment: AlignmentType.LEFT,
          }),
        ],
      },
    ],
  });

  const base64 = await Packer.toBase64String(doc);
  const name = `mama-worksheet-${new Date().toISOString().slice(0, 10)}.docx`;
  await shareBase64File(
    base64,
    name,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}

/** Export first Markdown table for Excel. Returns false if none found. */
export async function shareMarkdownTableExcel(
  markdown: string,
  fileStem: string,
): Promise<boolean> {
  const table = parseMarkdownTable(markdown);
  if (!table) return false;
  const name = `${fileStem}-${new Date().toISOString().slice(0, 10)}.xls`;
  await shareUtf8File(name, rowsToSpreadsheetMl(table, "Table"), "application/vnd.ms-excel");
  return true;
}

/** Generic rubric / grade tracker when no Markdown table is present. */
export async function shareRubricExcel(fileStem: string): Promise<void> {
  const rows = [
    ["Criterion", "Weight (%)", "Score (0–max)", "Notes"],
    ["Concept understanding", "30", "", ""],
    ["Problem solving / reasoning", "30", "", ""],
    ["Presentation & communication", "20", "", ""],
    ["Accuracy / computation", "20", "", ""],
    ["Learner name", "", "", ""],
    ["", "", "Total", ""],
  ];
  const name = `${fileStem}-${new Date().toISOString().slice(0, 10)}.xls`;
  await shareUtf8File(name, rowsToSpreadsheetMl(rows, "Rubric"), "application/vnd.ms-excel");
}
