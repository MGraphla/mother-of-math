/**
 * Chatbot-side document helpers: worksheets (PDF / Word), tables & rubrics (Excel),
 * and LaTeX extraction for teacher workflows.
 */

import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import * as XLSX from 'xlsx';

/** Pull $...$ and $$...$$ segments for "Copy LaTeX" style workflows. */
export function extractLatexSnippets(markdown: string): string {
  const chunks: string[] = [];
  const display = markdown.match(/\$\$[\s\S]*?\$\$/g);
  if (display) chunks.push(...display);
  const rest = markdown.replace(/\$\$[\s\S]*?\$\$/g, '\n');
  const inline = rest.match(/\$[^$\n]+\$/g);
  if (inline) chunks.push(...inline);
  return chunks.join('\n\n').trim();
}

/** Very small Markdown → plain text (keeps line breaks). */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) => {
      const m = /^```(\w*)\n?([\s\S]*?)```$/m.exec(block);
      return m ? `\n${m[2]}\n` : '';
    })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseMarkdownTable(md: string): string[][] | null {
  const lines = md.split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) => l.startsWith('|') && l.includes('---'));
  if (start < 1) return null;
  const header = lines[start - 1];
  if (!header.startsWith('|')) return null;
  const splitRow = (row: string) =>
    row
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
  const headers = splitRow(header);
  const rows: string[][] = [headers];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) break;
    rows.push(splitRow(line));
  }
  return rows.length > 1 ? rows : null;
}

export function downloadWorksheetPdf(markdown: string, title: string): void {
  const plain = markdownToPlainText(markdown);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title.slice(0, 120) || 'MAMA worksheet', margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(plain || '(empty)', maxW);
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 6;
  }

  y += 4;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  for (let i = 0; i < 8; i++) {
    if (y > doc.internal.pageSize.getHeight() - margin - 20) {
      doc.addPage();
      y = margin;
    }
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  }

  doc.save(`mama-worksheet-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function downloadWorksheetDocx(markdown: string, title: string): Promise<void> {
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
            text: title || 'MAMA Math — Worksheet',
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 },
          }),
          ...paragraphs,
          new Paragraph({ text: '', spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Name: ___________________________    Date: _______________',
                italics: true,
              }),
            ],
            alignment: AlignmentType.LEFT,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mama-worksheet-${new Date().toISOString().slice(0, 10)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMarkdownTableExcel(markdown: string, fileStem: string): boolean {
  const table = parseMarkdownTable(markdown);
  if (!table) return false;
  const ws = XLSX.utils.aoa_to_sheet(table);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Table');
  XLSX.writeFile(wb, `${fileStem}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}

/** Generic rubric / grade tracker when no Markdown table is present. */
export function downloadRubricExcel(fileStem: string): void {
  const rows = [
    ['Criterion', 'Weight (%)', 'Score (0–max)', 'Notes'],
    ['Concept understanding', '30', '', ''],
    ['Problem solving / reasoning', '30', '', ''],
    ['Presentation & communication', '20', '', ''],
    ['Accuracy / computation', '20', '', ''],
    ['Learner name', '', '', ''],
    ['', '', 'Total', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rubric');
  XLSX.writeFile(wb, `${fileStem}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
