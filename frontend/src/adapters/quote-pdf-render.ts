import type { jsPDF } from 'jspdf';

export function cleanPdfText(value: string): string {
  return value
    .replace(/[\u202f\u00a0]/g, ' ')
    .replace(/≈/g, '~')
    .replace(/[·•]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/×/g, 'x')
    .replace(/[−]/g, '-')
    .replace(/→/g, '>')
    .replace(/[–—]/g, '-')
    .replace(/œ/g, 'oe');
}

export function pdfParagraph(
  doc: jsPDF,
  value: string,
  x: number,
  top: number,
  width: number,
  size = 9,
  bold = false,
  color: [number, number, number] = [36, 40, 44],
): number {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(cleanPdfText(value), width) as string[];
  doc.text(lines, x, top);
  return top + lines.length * (size * 0.42) + 1;
}

export function addPdfImage(
  doc: jsPDF,
  data: string,
  x: number,
  top: number,
  width: number,
  height: number,
): void {
  const format = data.startsWith('data:image/jpeg')
    ? 'JPEG'
    : data.startsWith('data:image/webp')
      ? 'WEBP'
      : 'PNG';
  doc.addImage(data, format, x, top, width, height);
}
