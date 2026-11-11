import { referenceInventoryNote } from '../../../moving/domain/estimate/reference-inventory-note';
import type { Booking } from '../../../shared/domain/model';

export function notesForPdf(value: string | null | undefined): string {
  const notes = value ?? '';
  const lines = notes.trim().split(/\r?\n/);
  if (!/^FICHE D['’]APPEL\b/u.test(lines[0] ?? '')) return notes.trim();
  const departure = /^Départ\s*:.*? · étage (.+)$/u.exec(lines[1] ?? '');
  const arrival = /^Arrivée\s*:.*? · étage (.+)$/u.exec(lines[2] ?? '');
  if (!departure || !arrival) return notes.trim();
  const access = (value: string) =>
    value.replace(/^(\d+)(?=\s|$)/u, (_match, floor: string) =>
      floor === '1' ? '1er étage' : `${floor}e étage`,
    );
  return [
    lines[0],
    `Accès : A · ${access(departure[1])} ; B · ${access(arrival[1])}`,
    ...lines.slice(3),
  ].join('\n');
}

export function addressNotesFrom(value: string): { from: string; to: string; remaining: string } {
  let from = '';
  let to = '';
  const remaining = value
    .split(/\r?\n/u)
    .filter((line) => {
      const departure = /^Repère départ\s*:\s*(.*)$/iu.exec(line);
      if (departure) {
        from = departure[1].trim();
        return false;
      }
      const arrival = /^Repère arrivée\s*:\s*(.*)$/iu.exec(line);
      if (arrival) {
        to = arrival[1].trim();
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
  return { from, to, remaining };
}

export function withoutInventoryBlock(
  value: string,
  inventory: NonNullable<Booking['inventorySnapshot']> | undefined,
  fromAddress: string,
  toAddress: string,
): string {
  if (inventory?.sourceInventory) {
    const expected = referenceInventoryNote(inventory.sourceInventory, fromAddress, toAddress);
    const exactStart = value.indexOf(expected);
    if (exactStart >= 0) {
      return `${value.slice(0, exactStart)}${value.slice(exactStart + expected.length)}`.trim();
    }
  }
  const lines = value.split(/\r?\n/u);
  const noteStart = lines.findIndex((line) =>
    /^Déménagement du .+ de .+ \/ au .+$/iu.test(line.trim()),
  );
  if (noteStart >= 0) {
    const estimateStart = lines.findIndex(
      (line, index) => index > noteStart && /^Estimation\s*:/iu.test(line.trim()),
    );
    return [...lines.slice(0, noteStart), ...(estimateStart >= 0 ? lines.slice(estimateStart) : [])]
      .join('\n')
      .trim();
  }
  const start = lines.findIndex((line) =>
    /^FICHE D['’]APPEL\s*·\s*INVENTAIRE$/iu.test(line.trim()),
  );
  if (start < 0) return value.trim();
  const end = lines.findIndex(
    (line, index) =>
      index > start &&
      (/^Estimation des allers-retours\s*:/iu.test(line.trim()) ||
        /^Estimation\s*:/iu.test(line.trim())),
  );
  return [...lines.slice(0, start), ...(end >= 0 ? lines.slice(end) : [])].join('\n').trim();
}

export function durationLabel(minutes: number, step = 5): string {
  const rounded = Math.max(0, Math.round(minutes / step) * step);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours ? `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}` : `${rest} min`;
}
