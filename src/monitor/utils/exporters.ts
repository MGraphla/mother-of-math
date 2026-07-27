/**
 * Branded export system for the QEDA partner monitor.
 *
 * Every monitor page can build an `ExportPayload` describing its data
 * (title, KPIs, tables, free-text sections) and pass it to one of the
 * exporters: JSON, HTML, PDF, Word (.doc), Excel (.xlsx).
 *
 * All exports share the same QEDA-branded header/footer for a consistent
 * "official report" feel.
 */

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/* ─────────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────── */

export interface ExportKpi {
  label: string;
  value: string | number;
  hint?: string;
}

export interface ExportTable {
  title: string;
  columns: string[];
  /** Each row is an array aligned with `columns`. */
  rows: (string | number | null | undefined)[][];
  /** Optional per-page note shown directly under the table title. */
  note?: string;
}

export interface ExportSection {
  /** Heading rendered as an H2. */
  title: string;
  /** Plain-text body (newlines preserved). */
  body?: string;
  /** Optional simple key/value pairs rendered as a definition list. */
  pairs?: { key: string; value: string | number }[];
}

export interface ExportPayload {
  /** File name stem (no extension). Spaces will be slugified. */
  fileStem: string;
  /** Top headline — e.g. "Overview · QEDA Monitor". */
  title: string;
  /** Subtitle line under the title — e.g. "Live snapshot, generated 12 May 2026". */
  subtitle?: string;
  /** Optional executive summary paragraph. */
  summary?: string;
  kpis?: ExportKpi[];
  tables?: ExportTable[];
  sections?: ExportSection[];
}

/* ─────────────────────────────────────────────────────────────
 * Brand constants
 * ─────────────────────────────────────────────────────────── */

const BRAND = {
  name: 'QEDA',
  fullName: 'Quality Education Development Associates',
  product: 'MAMA Math',
  url: 'qeda.ng',
  primary: '#0aa55b',
  primaryDark: '#067a44',
  accent: '#f5b81b',
  ink: '#0f172a',
  muted: '#475569',
  rule: '#e2e8f0',
  pageBg: '#ffffff',
  softBg: '#f1f5f9',
};

const fmtNow = () => {
  const d = new Date();
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const slugify = (s: string): string =>
  s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';

const fileStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const safe = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

/* ─────────────────────────────────────────────────────────────
 * JSON exporter
 * ─────────────────────────────────────────────────────────── */

export const exportJSON = (payload: ExportPayload) => {
  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      brand: BRAND.name,
      product: BRAND.product,
      title: payload.title,
      subtitle: payload.subtitle,
    },
    summary: payload.summary,
    kpis: payload.kpis,
    tables: payload.tables,
    sections: payload.sections,
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${slugify(payload.fileStem)}-${fileStamp()}.json`);
};

/* ─────────────────────────────────────────────────────────────
 * HTML / Word — share the same styled markup
 * ─────────────────────────────────────────────────────────── */

const buildBrandedHtml = (payload: ExportPayload, opts: { forWord: boolean }): string => {
  const css = `
    @page { size: A4; margin: 22mm 18mm 22mm 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif;
      color: ${BRAND.ink};
      background: ${BRAND.pageBg};
      margin: 0;
      padding: 0;
      line-height: 1.55;
    }
    .wrap { max-width: 980px; margin: 0 auto; padding: 28px 32px 56px; }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 18px;
      border-bottom: 3px solid ${BRAND.primary};
      margin-bottom: 28px;
    }
    .head .brand-name { font-size: 22px; font-weight: 800; color: ${BRAND.primaryDark}; letter-spacing: 0.5px; }
    .head .brand-sub { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: ${BRAND.muted}; }
    .head .stamp { font-size: 11px; color: ${BRAND.muted}; text-align: right; }
    .head .stamp strong { color: ${BRAND.ink}; }
    h1 { font-size: 28px; line-height: 1.2; margin: 0 0 6px 0; color: ${BRAND.ink}; letter-spacing: -0.2px; }
    .subtitle { font-size: 13px; color: ${BRAND.muted}; margin: 0 0 22px 0; }
    .summary {
      background: ${BRAND.softBg};
      border-left: 4px solid ${BRAND.primary};
      padding: 14px 18px;
      border-radius: 6px;
      margin: 18px 0 26px 0;
      font-size: 13.5px;
    }
    h2 {
      font-size: 17px;
      color: ${BRAND.primaryDark};
      margin: 30px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid ${BRAND.rule};
      letter-spacing: -0.1px;
    }
    .kpis { display: table; width: 100%; border-collapse: separate; border-spacing: 8px; margin: 4px -8px 8px -8px; }
    .kpi-row { display: table-row; }
    .kpi {
      display: table-cell;
      width: 25%;
      padding: 14px 16px;
      background: ${BRAND.softBg};
      border-radius: 8px;
      border: 1px solid ${BRAND.rule};
      vertical-align: top;
    }
    .kpi .l { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: ${BRAND.muted}; }
    .kpi .v { font-size: 22px; font-weight: 800; color: ${BRAND.ink}; margin-top: 4px; line-height: 1.2; }
    .kpi .h { font-size: 11px; color: ${BRAND.muted}; margin-top: 3px; }
    table.data { width: 100%; border-collapse: collapse; margin: 8px 0 18px 0; font-size: 12px; }
    table.data thead th {
      background: ${BRAND.primary};
      color: white;
      text-align: left;
      padding: 9px 10px;
      font-size: 11px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    table.data tbody td { padding: 8px 10px; border-bottom: 1px solid ${BRAND.rule}; vertical-align: top; }
    table.data tbody tr:nth-child(even) td { background: ${BRAND.softBg}; }
    .note { font-size: 11.5px; color: ${BRAND.muted}; margin: -6px 0 10px 0; font-style: italic; }
    dl.pairs { margin: 6px 0 12px 0; }
    dl.pairs dt { font-size: 11px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; }
    dl.pairs dd { margin: 2px 0 0 0; font-size: 13px; color: ${BRAND.ink}; font-weight: 600; }
    p.body { margin: 8px 0 14px 0; font-size: 13px; white-space: pre-wrap; }
    .foot {
      margin-top: 40px;
      padding-top: 14px;
      border-top: 1px solid ${BRAND.rule};
      display: flex; justify-content: space-between; gap: 20px;
      font-size: 10px; color: ${BRAND.muted};
    }
    .foot .accent { color: ${BRAND.primaryDark}; font-weight: 700; }
  `;

  const kpisHtml = payload.kpis && payload.kpis.length
    ? `<section><h2>Key metrics</h2><div class="kpis">${
        chunk(payload.kpis, 4)
          .map(
            (group) =>
              `<div class="kpi-row">${group
                .map(
                  (k) =>
                    `<div class="kpi"><div class="l">${escapeHtml(k.label)}</div><div class="v">${escapeHtml(
                      String(k.value),
                    )}</div>${k.hint ? `<div class="h">${escapeHtml(k.hint)}</div>` : ''}</div>`,
                )
                .join('')}</div>`,
          )
          .join('')
      }</div></section>`
    : '';

  const tablesHtml = (payload.tables ?? [])
    .map(
      (t) => `
        <section>
          <h2>${escapeHtml(t.title)}</h2>
          ${t.note ? `<div class="note">${escapeHtml(t.note)}</div>` : ''}
          <table class="data">
            <thead><tr>${t.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
            <tbody>
              ${
                t.rows.length === 0
                  ? `<tr><td colspan="${t.columns.length}" style="text-align:center;color:${BRAND.muted};padding:18px;">No data available.</td></tr>`
                  : t.rows
                      .map(
                        (r) =>
                          `<tr>${r
                            .map((cell) => `<td>${escapeHtml(safe(cell))}</td>`)
                            .join('')}</tr>`,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </section>`,
    )
    .join('');

  const sectionsHtml = (payload.sections ?? [])
    .map(
      (s) => `
        <section>
          <h2>${escapeHtml(s.title)}</h2>
          ${s.body ? `<p class="body">${escapeHtml(s.body)}</p>` : ''}
          ${
            s.pairs && s.pairs.length
              ? `<dl class="pairs">${s.pairs
                  .map(
                    (p) =>
                      `<dt>${escapeHtml(p.key)}</dt><dd>${escapeHtml(String(p.value))}</dd>`,
                  )
                  .join('')}</dl>`
              : ''
          }
        </section>`,
    )
    .join('');

  const wordPrefix = opts.forWord
    ? `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->`
    : '';

  const xmlns = opts.forWord
    ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"'
    : '';

  return `<!DOCTYPE html>
<html${xmlns} lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.title)}</title>
  ${wordPrefix}
  <style>${css}</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <div class="brand-name">${BRAND.name}</div>
        <div class="brand-sub">${escapeHtml(BRAND.product)}</div>
      </div>
      <div class="stamp">
        <div><strong>Generated</strong> ${escapeHtml(fmtNow())}</div>
        <div>${escapeHtml(BRAND.fullName)}</div>
      </div>
    </div>

    <h1>${escapeHtml(payload.title)}</h1>
    ${payload.subtitle ? `<p class="subtitle">${escapeHtml(payload.subtitle)}</p>` : ''}
    ${payload.summary ? `<div class="summary">${escapeHtml(payload.summary)}</div>` : ''}

    ${kpisHtml}
    ${tablesHtml}
    ${sectionsHtml}

    <div class="foot">
      <div>© ${new Date().getFullYear()} <span class="accent">${escapeHtml(BRAND.fullName)}</span> · ${escapeHtml(BRAND.url)}</div>
      <div>Confidential — partner-only report</div>
    </div>
  </div>
</body>
</html>`;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  // Pad last chunk with empty placeholders so the table layout stays even
  if (out.length) {
    const last = out[out.length - 1];
    while (last.length < size) last.push({} as T);
  }
  return out;
};

export const exportHTML = (payload: ExportPayload) => {
  const html = buildBrandedHtml(payload, { forWord: false });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${slugify(payload.fileStem)}-${fileStamp()}.html`);
};

export const exportWord = (payload: ExportPayload) => {
  const html = buildBrandedHtml(payload, { forWord: true });
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  triggerDownload(blob, `${slugify(payload.fileStem)}-${fileStamp()}.doc`);
};

/* ─────────────────────────────────────────────────────────────
 * PDF — branded with jsPDF + autoTable
 * ─────────────────────────────────────────────────────────── */

const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

export const exportPDF = (payload: ExportPayload) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const primary = hexToRgb(BRAND.primary);
  const primaryDark = hexToRgb(BRAND.primaryDark);
  const muted = hexToRgb(BRAND.muted);
  const ink = hexToRgb(BRAND.ink);
  const soft = hexToRgb(BRAND.softBg);

  const drawHeader = () => {
    // Top brand bar
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, 0, pageW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(BRAND.name, margin, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(BRAND.product.toUpperCase(), margin, 44);

    doc.setFontSize(8);
    const stamp = `Generated ${fmtNow()}`;
    doc.text(stamp, pageW - margin, 32, { align: 'right' });
    doc.text(BRAND.fullName, pageW - margin, 44, { align: 'right' });

    doc.setDrawColor(primary[0], primary[1], primary[2]);
    doc.setLineWidth(1.2);
    doc.line(margin, 56, pageW - margin, 56);
  };

  const drawFooter = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(220, 226, 232);
      doc.setLineWidth(0.5);
      doc.line(margin, pageH - 36, pageW - margin, pageH - 36);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text(`© ${new Date().getFullYear()} ${BRAND.fullName} · ${BRAND.url}`, margin, pageH - 22);
      doc.text(
        `Confidential · Page ${i} of ${total}`,
        pageW - margin,
        pageH - 22,
        { align: 'right' },
      );
    }
  };

  drawHeader();
  let y = 80;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(payload.title, margin, y);
  y += 22;

  if (payload.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    const lines = doc.splitTextToSize(payload.subtitle, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 6;
  }

  if (payload.summary) {
    const lines = doc.splitTextToSize(payload.summary, pageW - margin * 2 - 20);
    const h = lines.length * 12 + 16;
    doc.setFillColor(soft[0], soft[1], soft[2]);
    doc.rect(margin, y, pageW - margin * 2, h, 'F');
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(margin, y, 4, h, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(lines, margin + 12, y + 14);
    y += h + 16;
  }

  // KPIs as a 4-column grid of cards
  if (payload.kpis && payload.kpis.length) {
    drawSectionTitle('Key metrics', y);
    y += 18;
    const cols = 4;
    const gap = 8;
    const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
    const cardH = 56;

    payload.kpis.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (cardW + gap);
      const cy = y + row * (cardH + gap);

      if (cy + cardH > pageH - 60) {
        doc.addPage();
        drawHeader();
        y = 80;
      }

      doc.setFillColor(soft[0], soft[1], soft[2]);
      doc.roundedRect(x, cy, cardW, cardH, 4, 4, 'F');
      doc.setFontSize(7);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text(k.label.toUpperCase(), x + 10, cy + 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(String(k.value), x + 10, cy + 32);
      if (k.hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(muted[0], muted[1], muted[2]);
        doc.text(k.hint, x + 10, cy + 46);
      }
    });
    const rows = Math.ceil(payload.kpis.length / cols);
    y += rows * (cardH + gap) + 8;
  }

  function drawSectionTitle(text: string, atY: number) {
    if (atY > pageH - 120) {
      doc.addPage();
      drawHeader();
      atY = 80;
      y = atY;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(text, margin, atY);
    doc.setDrawColor(220, 226, 232);
    doc.setLineWidth(0.5);
    doc.line(margin, atY + 4, pageW - margin, atY + 4);
  }

  // Tables via autoTable
  (payload.tables ?? []).forEach((t) => {
    if (y > pageH - 120) {
      doc.addPage();
      drawHeader();
      y = 80;
    }
    drawSectionTitle(t.title, y);
    y += 14;
    if (t.note) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text(t.note, margin, y + 8);
      y += 12;
    }
    autoTable(doc, {
      startY: y + 4,
      head: [t.columns],
      body: (t.rows.length ? t.rows : [[`No data available`]]).map(
        (r) => r.map((c) => safe(c)) as RowInput,
      ),
      theme: 'grid',
      headStyles: {
        fillColor: primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 8.5, textColor: ink, cellPadding: 5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      didDrawPage: () => drawHeader(),
    });
    // After autoTable, get last Y
    // @ts-expect-error - lastAutoTable is added by plugin
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  });

  // Free-text sections
  (payload.sections ?? []).forEach((s) => {
    if (y > pageH - 120) {
      doc.addPage();
      drawHeader();
      y = 80;
    }
    drawSectionTitle(s.title, y);
    y += 18;
    if (s.body) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      const lines = doc.splitTextToSize(s.body, pageW - margin * 2);
      lines.forEach((line: string) => {
        if (y > pageH - 60) {
          doc.addPage();
          drawHeader();
          y = 80;
        }
        doc.text(line, margin, y);
        y += 13;
      });
      y += 6;
    }
    if (s.pairs && s.pairs.length) {
      s.pairs.forEach((p) => {
        if (y > pageH - 60) {
          doc.addPage();
          drawHeader();
          y = 80;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(muted[0], muted[1], muted[2]);
        doc.text(p.key.toUpperCase(), margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(ink[0], ink[1], ink[2]);
        doc.text(safe(p.value), margin, y + 13);
        y += 28;
      });
    }
  });

  drawFooter();
  doc.save(`${slugify(payload.fileStem)}-${fileStamp()}.pdf`);
};

/* ─────────────────────────────────────────────────────────────
 * Excel (.xlsx) — summary + one sheet per table
 * ─────────────────────────────────────────────────────────── */

const sanitizeSheetName = (name: string, used: Set<string>): string => {
  const base = (name.replace(/[\\/*?:[\]]/g, '').trim() || 'Sheet').slice(0, 28);
  let candidate = base;
  let n = 1;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 25)}_${n++}`;
  }
  used.add(candidate);
  return candidate;
};

export const exportExcel = (payload: ExportPayload) => {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  const summaryRows: (string | number)[][] = [
    [BRAND.name, BRAND.product],
    [BRAND.fullName],
    ['Generated', fmtNow()],
    [],
    [payload.title],
  ];
  if (payload.subtitle) summaryRows.push([payload.subtitle]);
  if (payload.summary) {
    summaryRows.push([], ['Summary'], [payload.summary]);
  }
  if (payload.kpis?.length) {
    summaryRows.push([], ['Key metrics'], ['Label', 'Value', 'Hint']);
    payload.kpis.forEach((k) => {
      summaryRows.push([k.label, safe(k.value), k.hint ?? '']);
    });
  }
  if (payload.sections?.length) {
    summaryRows.push([], ['Sections']);
    payload.sections.forEach((s) => {
      summaryRows.push([s.title]);
      if (s.body) summaryRows.push([s.body]);
      s.pairs?.forEach((p) => summaryRows.push([p.key, safe(p.value)]));
      summaryRows.push([]);
    });
  }

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryRows),
    sanitizeSheetName('Summary', used),
  );

  (payload.tables ?? []).forEach((t, i) => {
    const rows: (string | number)[][] = [];
    if (t.note) rows.push([t.note], []);
    rows.push([...t.columns]);
    if (t.rows.length === 0) {
      rows.push(['No data available']);
    } else {
      t.rows.forEach((r) => rows.push(r.map((c) => safe(c))));
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(rows),
      sanitizeSheetName(t.title || `Table ${i + 1}`, used),
    );
  });

  XLSX.writeFile(wb, `${slugify(payload.fileStem)}-${fileStamp()}.xlsx`);
};

/* ─────────────────────────────────────────────────────────────
 * Master export dispatcher
 * ─────────────────────────────────────────────────────────── */

export type ExportFormat = 'json' | 'html' | 'pdf' | 'word' | 'excel';

export const runExport = (format: ExportFormat, payload: ExportPayload) => {
  switch (format) {
    case 'json':  return exportJSON(payload);
    case 'html':  return exportHTML(payload);
    case 'pdf':   return exportPDF(payload);
    case 'word':  return exportWord(payload);
    case 'excel': return exportExcel(payload);
  }
};
