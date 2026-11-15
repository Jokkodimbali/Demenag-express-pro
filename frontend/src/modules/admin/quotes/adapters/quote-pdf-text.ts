import { referenceInventoryNote } from '../../../moving/domain/estimate/reference-inventory-note';
import type { Booking, Quote } from '../../../shared/domain/model';

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

export function quotePdfNotes(booking: Booking, quote: Quote | undefined) {
  const rawNotes = notesForPdf(quote ? quote.notes : booking.notes);
  const conditionsMatch =
    /CONDITIONS DE CHARGEMENT\s*\n([\s\S]*?Ces conditions doivent être respectées le jour du déménagement\. Sinon, le déménagement n’aura pas lieu\.)/u.exec(
      rawNotes,
    );
  const loadingConditions = conditionsMatch?.[0] ?? '';
  const sourceNotes = loadingConditions ? rawNotes.replace(loadingConditions, '').trim() : rawNotes;
  const addressNotes = addressNotesFrom(
    booking.inventorySnapshot
      ? withoutInventoryBlock(
          sourceNotes,
          booking.inventorySnapshot,
          booking.fromAddress,
          booking.toAddress,
        )
      : sourceNotes,
  );
  return { loadingConditions, addressNotes };
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
  let cleaned = value.trim();
  if (inventory?.sourceInventory) {
    const expected = referenceInventoryNote(inventory.sourceInventory, fromAddress, toAddress);
    const exactStart = value.indexOf(expected);
    if (exactStart >= 0)
      cleaned = `${value.slice(0, exactStart)}${value.slice(exactStart + expected.length)}`.trim();
  }
  const generatedInventoryLine = (line: string) => {
    const normalized = line.trim();
    return (
      /^Déménagement du .+ de .+ \/ au .+$/iu.test(normalized) ||
      /^(?:Estimation\s*:\s*(?:volume|~|≈)|Main-d['’](?:oe|œ)uvre\s*:)/iu.test(normalized) ||
      /^Main-d['’](?:oe|œ)uvre\s*:\s*\d+\s+man(?:oe|œ)uvres?\b.*(?:trajet\s*(?:~|≈)|durée\s*(?:~|≈))/iu.test(
        normalized,
      ) ||
      /^(?:Trajet\s*:\s*(?:~|≈)|Planning prévisionnel\s*:.*durée\s*(?:~|≈)|Emballage\s*:\s*(?:~|≈))/iu.test(
        normalized,
      ) ||
      /^-\s+\d+\s+.+?(?:≈|~)\s*[\d,.]+\s*m[³3](?:\s|$)/iu.test(normalized) ||
      /^Logement\s*:/iu.test(normalized) ||
      /^À noter\s*:/iu.test(normalized)
    );
  };
  return cleaned
    .split(/\r?\n/u)
    .filter((line) => !generatedInventoryLine(line))
    .join('\n')
    .replace(/\n{2,}/gu, '\n')
    .trim();
}

export function durationLabel(minutes: number, step = 5): string {
  const rounded = Math.max(0, Math.round(minutes / step) * step);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours ? `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}` : `${rest} min`;
}
