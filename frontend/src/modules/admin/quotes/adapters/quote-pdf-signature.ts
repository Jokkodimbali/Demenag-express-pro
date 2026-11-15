import { assetDataUrl } from '../../../shared/adapters/pdf-assets';
import { addPdfImage, pdfParagraph } from './quote-pdf-render';
import type { Settings } from '../../../shared/domain/model';
import type { jsPDF } from 'jspdf';

type QuoteSignatureInput = {
  doc: jsPDF;
  settings: Settings;
  top: number;
  paymentText: string;
  paymentQr: string;
  paymentQrSize: { width: number; height: number } | null;
  signatureHeight: number;
  contentWidth: number;
  margin: number;
  right: number;
};

export async function drawQuoteSignature({
  doc,
  settings,
  top,
  paymentText,
  paymentQr,
  paymentQrSize,
  signatureHeight,
  contentWidth,
  margin,
  right,
}: QuoteSignatureInput) {
  if (paymentText) {
    const compact = signatureHeight < 70;
    const leftWidth = compact ? contentWidth * 0.58 : contentWidth / 2 - 4;
    const rightStart = compact ? margin + leftWidth + 6 : margin + contentWidth / 2 + 3;
    const rightWidth = right - rightStart;
    doc.setFillColor(244, 245, 247);
    doc.roundedRect(margin, top, leftWidth, signatureHeight, 2.5, 2.5, 'F');
    doc.setFillColor(244, 245, 247);
    doc.roundedRect(rightStart, top, rightWidth, signatureHeight, 2.5, 2.5, 'F');
    if (compact) {
      const qrWidth =
        paymentQr && paymentQrSize
          ? ((signatureHeight - 5) * paymentQrSize.width) / paymentQrSize.height
          : 0;
      const qrHeight = paymentQr && paymentQrSize ? signatureHeight - 5 : 0;
      const maxQrWidth = leftWidth * 0.48;
      const fittedQrWidth = Math.min(qrWidth, maxQrWidth);
      const fittedQrHeight =
        paymentQrSize && paymentQr && qrWidth > maxQrWidth
          ? (fittedQrWidth * paymentQrSize.height) / paymentQrSize.width
          : qrHeight;
      const textWidth = leftWidth - (paymentQr ? fittedQrWidth + 16 : 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(90, 97, 104);
      doc.text('MODE DE PAIEMENT', margin + 5, top + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(42, 45, 48);
      const paymentLines = doc.splitTextToSize(paymentText, textWidth) as string[];
      doc.text(paymentLines.slice(0, 2), margin + 5, top + 12.5);
      if (paymentQr && paymentQrSize) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(90, 97, 104);
        const prompt = doc.splitTextToSize(
          'Scannez ce QR code avec l’application Wave pour payer Demenag Express.',
          textWidth,
        ) as string[];
        doc.text(prompt, margin + 5, top + 14 + Math.min(2, paymentLines.length) * 4.6);
        const qrX = margin + leftWidth - fittedQrWidth - 4;
        const qrY = top + (signatureHeight - fittedQrHeight) / 2;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(qrX - 1, qrY - 1, fittedQrWidth + 2, fittedQrHeight + 2, 1.5, 1.5, 'F');
        addPdfImage(doc, paymentQr, qrX, qrY, fittedQrWidth, fittedQrHeight);
      }
      const x0 = rightStart + 5;
      const x1 = right - 5;
      const gutter = 5;
      const cellWidth = (x1 - x0 - gutter) / 2;
      const sealX = x0 + cellWidth + gutter;
      doc.setTextColor(90, 97, 104);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const clientTitle = doc.splitTextToSize('SIGNATURE DU CLIENT', cellWidth) as string[];
      doc.text(clientTitle, x0, top + 6);
      doc.setFont('helvetica', 'normal');
      const clientHint = doc.splitTextToSize(
        '« Lu et approuvé », nom et date',
        cellWidth,
      ) as string[];
      doc.text(clientHint, x0, top + 6 + clientTitle.length * 3.3);
      doc.setDrawColor(174, 180, 187);
      doc.setLineWidth(0.3);
      doc.line(x0, top + signatureHeight - 7, x0 + cellWidth, top + signatureHeight - 7);
      doc.setDrawColor(215, 219, 224);
      doc.line(
        x0 + cellWidth + gutter / 2,
        top + 5,
        x0 + cellWidth + gutter / 2,
        top + signatureHeight - 5,
      );
      doc.setFont('helvetica', 'bold');
      const sealTitle = doc.splitTextToSize('CACHET DEMENAG EXPRESS', cellWidth) as string[];
      doc.text(sealTitle, sealX, top + 6);
      const stamp = settings.invoiceStamp || (await assetDataUrl('/assets/cachet.png'));
      const signature = settings.invoiceSignature || (await assetDataUrl('/assets/signature.png'));
      const sealTop = top + 6 + sealTitle.length * 3.3 + 1.5;
      const sealSize = Math.max(
        11,
        Math.min(28, cellWidth - 2, top + signatureHeight - 3 - sealTop),
      );
      const stampX = sealX + (cellWidth - sealSize) / 2;
      addPdfImage(doc, stamp, stampX, sealTop, sealSize, sealSize);
      const signatureSize = doc.getImageProperties(signature);
      const signatureWidth = sealSize * 0.85;
      const signatureHeightDrawn = (signatureWidth * signatureSize.height) / signatureSize.width;
      addPdfImage(
        doc,
        signature,
        stampX - signatureWidth * 0.3,
        sealTop + sealSize / 2 - signatureHeightDrawn / 2 + 2,
        signatureWidth,
        signatureHeightDrawn,
      );
      return;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text('MODE DE PAIEMENT', margin + 5, top + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(42, 45, 48);
    doc.text(paymentText, margin + 5, top + 13);
    if (paymentQr && paymentQrSize) {
      doc.setFontSize(7.5);
      doc.setTextColor(90, 97, 104);
      const prompt = 'Scannez ce QR code avec l’application Wave pour payer Demenag Express.';
      const promptLines = doc.splitTextToSize(prompt, leftWidth - 10) as string[];
      doc.text(promptLines, margin + 5, top + 19);
      const maxWidth = leftWidth - 10;
      const maxHeight = signatureHeight - 36 - promptLines.length * 3.3;
      const scale = Math.min(maxWidth / paymentQrSize.width, maxHeight / paymentQrSize.height);
      const width = paymentQrSize.width * scale;
      const height = paymentQrSize.height * scale;
      addPdfImage(
        doc,
        paymentQr,
        margin + (leftWidth - width) / 2,
        top + 23 + promptLines.length * 3.3,
        width,
        height,
      );
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text('SIGNATURE DU CLIENT · BON POUR ACCORD', rightStart, top + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(42, 45, 48);
    doc.text('Écrire « Lu et approuvé », nom et date', rightStart, top + 13);
    const stamp = settings.invoiceStamp || (await assetDataUrl('/assets/cachet.png'));
    const signature = settings.invoiceSignature || (await assetDataUrl('/assets/signature.png'));
    doc.setDrawColor(174, 180, 187);
    doc.setLineWidth(0.3);
    doc.line(rightStart, top + 21, right - 5, top + 21);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text('CACHET ET SIGNATURE DEMENAG EXPRESS', rightStart, top + 30);
    addReferenceSeal(doc, stamp, signature, right, top, signatureHeight);
    return;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(42, 45, 48);
  const cardX = (right + margin) / 2 + 2;
  doc.setFillColor(244, 245, 247);
  doc.roundedRect(cardX, top, right - cardX, 50, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(90, 97, 104);
  doc.text('SIGNATURE DU CLIENT · BON POUR ACCORD', cardX + 5, top + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('Écrire « Lu et approuvé », nom et date', cardX + 5, top + 10.5);
  doc.setDrawColor(174, 180, 187);
  doc.setLineWidth(0.3);
  doc.line(cardX + 5, top + 21, right - 5, top + 21);
  doc.setFont('helvetica', 'bold');
  doc.text('CACHET ET SIGNATURE DEMENAG EXPRESS', cardX + 5, top + 30);
  const stamp = settings.invoiceStamp || (await assetDataUrl('/assets/cachet.png'));
  const signature = settings.invoiceSignature || (await assetDataUrl('/assets/signature.png'));
  addReferenceSeal(doc, stamp, signature, right, top, 50);
}

function addReferenceSeal(
  doc: jsPDF,
  stamp: string,
  signature: string,
  right: number,
  top: number,
  height: number,
) {
  const half = height / 2;
  const size = Math.max(26, Math.min(40, height - half - 8));
  const x = right - size;
  const y = top + half + 7;
  const stampSize = doc.getImageProperties(stamp);
  const stampScale = Math.min(size / stampSize.width, size / stampSize.height);
  const stampWidth = stampSize.width * stampScale;
  const stampHeight = stampSize.height * stampScale;
  addPdfImage(doc, stamp, x, y, stampWidth, stampHeight);
  const signatureSize = doc.getImageProperties(signature);
  const signatureWidth = size * 0.85;
  const signatureHeight = (signatureWidth * signatureSize.height) / signatureSize.width;
  addPdfImage(
    doc,
    signature,
    x - signatureWidth * 0.5,
    y + size / 2 - signatureHeight / 2 + 3,
    signatureWidth,
    signatureHeight,
  );
}
