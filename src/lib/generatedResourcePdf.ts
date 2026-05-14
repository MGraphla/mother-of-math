/**
 * Branded PDF builders for AI-generated quiz & worksheet resources (no markdown in output).
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY = "#009e60";
const SECONDARY = "#4b371c";
const ACCENT = "#F4B400";
const MARGIN = 14;
/** Green bar (9mm) + gold stripe (0.8mm) */
const BANNER_BOTTOM_MM = 9 + 0.8;
/** Breathing room below the stripe before titles/body (large titles use y as baseline) */
const GAP_BELOW_BANNER_MM = 12;
const BODY_START_Y = BANNER_BOTTOM_MM + GAP_BELOW_BANNER_MM;

export interface QuizQuestion {
  n: number;
  type: "multiple_choice" | "short_answer" | "true_false";
  question: string;
  options?: string[];
  /** Lines of writing space for short_answer */
  lines?: number;
}

export interface QuizPayload {
  title: string;
  questions: QuizQuestion[];
  answers: { n: number; text: string }[];
}

export interface WorksheetPart {
  heading: string;
  tasks: string[];
}

export interface WorksheetPayload {
  title: string;
  intro: string;
  parts: WorksheetPart[];
}

/** Remove accidental markdown / markup from model output for clean PDF text */
export function stripArtifacts(s: string): string {
  if (!s) return "";
  return s
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function drawTopBanner(doc: jsPDF, subtitle: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(PRIMARY);
  doc.rect(0, 0, pageW, 9, "F");
  doc.setFillColor(ACCENT);
  doc.rect(0, 9, pageW, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(subtitle, pageW / 2, 5.8, { align: "center" });
}

function drawFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(130);
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.text("Mothers for Mathematics · Classroom resource", MARGIN, pageH - 5);
    doc.text(`Page ${i}`, pageW - MARGIN, pageH - 5, { align: "right" });
  }
}

export function buildQuizPdfBlob(quiz: QuizPayload, meta: { lessonTitle: string; level: string }): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 0;

  drawTopBanner(doc, "Mother of Math · Class Quiz");
  y = BODY_START_Y;

  doc.setTextColor(SECONDARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(stripArtifacts(quiz.title), pageW - 2 * MARGIN);
  doc.text(titleLines, pageW / 2, y, { align: "center" });
  y += titleLines.length * 6.5 + 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70);
  doc.text(`Lesson: ${stripArtifacts(meta.lessonTitle)}`, MARGIN, y);
  y += 4.5;
  doc.text(`Level: ${stripArtifacts(meta.level)}`, MARGIN, y);
  y += 6;

  doc.setDrawColor(PRIMARY);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 7;

  const sortedQs = [...quiz.questions].sort((a, b) => a.n - b.n);

  for (const q of sortedQs) {
    const qText = stripArtifacts(q.question);
    const optLines =
      q.type === "multiple_choice" && q.options?.length
        ? 2 + q.options.reduce((acc, o) => acc + doc.splitTextToSize(stripArtifacts(o), pageW - 2 * MARGIN - 6).length, 0)
        : 0;
    const shortLines = q.type === "short_answer" ? (q.lines ?? 4) * 4 : q.type === "true_false" ? 8 : 0;
    const qBodyLines = doc.splitTextToSize(qText, pageW - 2 * MARGIN).length * 4.8;
    const blockH = 10 + qBodyLines + optLines + shortLines;

    if (y + blockH > pageH - 18) {
      doc.addPage();
      drawTopBanner(doc, "Mother of Math · Class Quiz (continued)");
      y = BODY_START_Y;
    }

    doc.setFillColor(230, 247, 238);
    doc.roundedRect(MARGIN - 1, y - 4, pageW - 2 * MARGIN + 2, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(SECONDARY);
    doc.text(`Question ${q.n}`, MARGIN + 1, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30);
    const ql = doc.splitTextToSize(qText, pageW - 2 * MARGIN);
    doc.text(ql, MARGIN, y);
    y += ql.length * 4.8 + 2;

    if (q.type === "multiple_choice" && q.options?.length) {
      doc.setFontSize(9.5);
      doc.setTextColor(45);
      for (const opt of q.options) {
        const ol = doc.splitTextToSize(stripArtifacts(opt), pageW - 2 * MARGIN - 5);
        doc.text(ol, MARGIN + 4, y);
        y += ol.length * 4.5;
      }
    } else if (q.type === "true_false") {
      doc.setFontSize(10);
      doc.setTextColor(50);
      doc.text("     ○ True                    ○ False", MARGIN + 2, y);
      y += 8;
    } else {
      const lines = Math.min(8, Math.max(2, q.lines ?? 4));
      doc.setDrawColor(190);
      doc.setLineWidth(0.2);
      for (let i = 0; i < lines; i++) {
        doc.line(MARGIN, y + 2, pageW - MARGIN, y + 2);
        y += 6;
      }
    }

    y += 5;
  }

  doc.addPage();
  drawTopBanner(doc, "Mother of Math · Answer Key");
  y = BODY_START_Y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(SECONDARY);
  doc.text("Answer Key", pageW / 2, y, { align: "center" });
  y += 10;

  const sortedAns = [...quiz.answers].sort((a, b) => a.n - b.n);
  const body = sortedAns.map((a) => [String(a.n), stripArtifacts(a.text)]);

  autoTable(doc, {
    startY: y,
    head: [["Question", "Correct answer"]],
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, top: 12 },
    headStyles: {
      fillColor: PRIMARY,
      textColor: "#FFFFFF",
      fontSize: 10,
      fontStyle: "bold",
      halign: "center",
    },
    styles: {
      fontSize: 9.5,
      cellPadding: 3.5,
      lineColor: "#C8C8C8",
      lineWidth: 0.15,
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold", halign: "center", fillColor: "#E8F8EF" },
      1: { cellWidth: "auto" },
    },
  });

  drawFooter(doc);
  return doc.output("blob");
}

export function buildWorksheetPdfBlob(ws: WorksheetPayload, meta: { lessonTitle: string; level: string }): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 0;

  drawTopBanner(doc, "Mother of Math · Practice Worksheet");
  y = BODY_START_Y;

  doc.setTextColor(SECONDARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(stripArtifacts(ws.title), pageW - 2 * MARGIN);
  doc.text(titleLines, pageW / 2, y, { align: "center" });
  y += titleLines.length * 6.5 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70);
  doc.text(`Lesson: ${stripArtifacts(meta.lessonTitle)}  ·  Level: ${stripArtifacts(meta.level)}`, MARGIN, y);
  y += 7;

  const intro = stripArtifacts(ws.intro);
  if (intro) {
    doc.setFillColor(252, 248, 240);
    doc.setDrawColor(ACCENT);
    doc.setLineWidth(0.25);
    const introLines = doc.splitTextToSize(intro, pageW - 2 * MARGIN - 6);
    const boxH = introLines.length * 4.5 + 8;
    doc.roundedRect(MARGIN, y, pageW - 2 * MARGIN, boxH, 2, 2, "FD");
    doc.setFontSize(9.5);
    doc.setTextColor(55);
    doc.text(introLines, MARGIN + 3, y + 6);
    y += boxH + 6;
  }

  for (const part of ws.parts) {
    const heading = stripArtifacts(part.heading);
    const tasks = (part.tasks || []).map((t) => stripArtifacts(t)).filter(Boolean);

    const estH =
      12 +
      tasks.reduce((sum, t) => sum + doc.splitTextToSize(t, pageW - 2 * MARGIN - 10).length * 4.5 + 3, 0);

    if (y + estH > pageH - 16) {
      doc.addPage();
      drawTopBanner(doc, "Mother of Math · Practice Worksheet (continued)");
      y = BODY_START_Y;
    }

    doc.setFillColor(PRIMARY);
    doc.rect(MARGIN, y, 3, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(SECONDARY);
    doc.text(heading, MARGIN + 6, y + 5.5);
    y += 11;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(35);
    let idx = 1;
    for (const task of tasks) {
      const prefix = `${idx}. `;
      const tw = pageW - 2 * MARGIN - 8;
      const lines = doc.splitTextToSize(prefix + task, tw);
      if (y + lines.length * 4.8 > pageH - 14) {
        doc.addPage();
        drawTopBanner(doc, "Mother of Math · Practice Worksheet (continued)");
        y = BODY_START_Y;
      }
      doc.text(lines, MARGIN + 4, y);
      y += lines.length * 4.8 + 3;
      idx++;
    }
    y += 4;

    doc.setDrawColor(220);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 6;
  }

  drawFooter(doc);
  return doc.output("blob");
}
