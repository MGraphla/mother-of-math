import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface GuardianPacketPdfInput {
  learnerName: string;
  learnerCode: string | null;
  accessUrl: string;
  schoolName?: string | null;
}

export async function buildGuardianPacketPdf(input: GuardianPacketPdfInput): Promise<Blob> {
  const qrDataUrl = await QRCode.toDataURL(input.accessUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 56;

  doc.setFontSize(18);
  doc.text('Learner portal — for parents & guardians', pageW / 2, y, { align: 'center' });
  y += 28;

  doc.setFontSize(11);
  doc.setTextColor(60);
  const school = input.schoolName?.trim() || 'Your school';
  doc.text(`School / class context: ${school}`, pageW / 2, y, { align: 'center' });
  y += 36;

  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.text(`Learner: ${input.learnerName}`, 48, y);
  y += 22;
  doc.setFontSize(12);
  doc.text(`Learner code: ${input.learnerCode || '—'}`, 48, y);
  y += 20;
  doc.setFontSize(10);
  doc.setTextColor(40);
  const lines = doc.splitTextToSize(
    'How to log in:\n\n' +
      '1. Open the link below on the phone or computer your child uses for schoolwork.\n' +
      '2. You can also scan the QR code with the camera app — it opens the same page.\n' +
      '3. No password is required; keep this page private like a banking app link.\n' +
      '4. If the link stops working, ask your teacher for a new one.\n',
    pageW - 96,
  );
  doc.text(lines, 48, y);
  y += lines.length * 14 + 16;

  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const linkLines = doc.splitTextToSize(`Access link:\n${input.accessUrl}`, pageW - 96);
  doc.text(linkLines, 48, y);
  y += linkLines.length * 12 +24;

  const imgW = 140;
  const imgH = 140;
  doc.addImage(qrDataUrl, 'PNG', (pageW - imgW) / 2, y, imgW, imgH);
  y += imgH + 28;

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Mother of Mathematics — Learner Portal', pageW / 2, y, { align: 'center' });

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
