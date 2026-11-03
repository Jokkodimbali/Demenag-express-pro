import type {
  AccountingFinanceConfiguration,
  AccountingEntry,
  AccountingRepository,
  ManualAccountingInput,
} from '../../../application/ports/index.js';
import type { Booking } from '../../../domain/model.js';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { captureAccountingCosts } from '../../../domain/accounting-costs.js';

type FinalQuoteRow = {
  id: string;
  reference: string;
  montantTotal: number;
  creeLe: Date;
  reservationId: string;
  bookingReference: string;
  customerName: string | null;
  bookingData: Booking;
};

export class PrismaAccounting implements AccountingRepository {
  constructor(private db: PrismaClient) {}

  async list(month?: string): Promise<AccountingEntry[]> {
    const from = month ? new Date(`${month}-01T00:00:00Z`) : undefined;
    const until = from
      ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
      : undefined;
    const date = from && until ? { gte: from, lt: until } : undefined;
    const period =
      from && until
        ? Prisma.sql`AND d."cree_le" >= ${from} AND d."cree_le" < ${until}`
        : Prisma.empty;
    const [manual, finalQuotes, configurationRow] = await Promise.all([
      this.db.ecritureComptable.findMany({
        where: { annuleLe: null, date },
        orderBy: { date: 'desc' },
      }),
      this.db.$queryRaw<FinalQuoteRow[]>(Prisma.sql`
        SELECT d."id", d."reference", d."montant_total" AS "montantTotal",
          d."cree_le" AS "creeLe", d."reservation_id" AS "reservationId",
          r."reference" AS "bookingReference", r."data"->>'customerName' AS "customerName",
          r."data" AS "bookingData"
        FROM "demenag"."devis" d
        JOIN "demenag"."bookings" r ON r."id" = d."reservation_id"
        WHERE d."nature" = 'definitif' AND d."montant_total" IS NOT NULL
          AND r."data"->>'status' IS DISTINCT FROM 'cancelled' ${period}
          AND NOT EXISTS (
            SELECT 1 FROM "demenag"."accounting_entries" a
            WHERE a."source_quote_id" = d."id"
          )
        ORDER BY d."cree_le" DESC
      `),
      this.db.configurationComptable.findUnique({ where: { identifiant: 'main' } }),
    ]);
    const configuration = configurationRow
      ? (configurationRow.donnees as AccountingFinanceConfiguration)
      : null;
    const archivedEntries: AccountingEntry[] = manual
      .filter((entry) => entry.sourceDevisId !== null)
      .map((entry) => ({
        id: entry.id,
        type: entry.type as 'charge' | 'revenu',
        category: entry.categorie,
        label: entry.libelle,
        amount: entry.montant,
        date: entry.date.toISOString().slice(0, 10),
        automatic: true,
        ...(entry.sourceQuoteQuantity !== null ? { quantity: entry.sourceQuoteQuantity } : {}),
        ...(entry.sourceDevisId ? { reference: entry.sourceDevisId } : {}),
      }));
    const quoteEntries: AccountingEntry[] = finalQuotes.flatMap((quote) => {
      const booking = quote.bookingData;
      const quoteSnapshot = booking.quotes?.find((item) => item.id === quote.id);
      const date = quote.creeLe.toISOString().slice(0, 10);
      const entries: AccountingEntry[] = [
        {
          id: quote.id,
          type: 'revenu',
          category: 'Déménagement',
          label: `Devis final ${quote.reference} · ${quote.bookingReference} · ${quote.customerName ?? 'Client'}`,
          amount: quote.montantTotal,
          date,
          automatic: true,
          bookingId: quote.reservationId,
          reference: quote.reference,
          bookingReference: quote.bookingReference,
        },
      ];
      if (!quoteSnapshot) return entries;
      const costs =
        quoteSnapshot.accountingCosts ??
        captureAccountingCosts(booking, quoteSnapshot.price, configuration);
      if (costs.moverAmount > 0)
        entries.push({
          id: `auto-labour-${quote.id}`,
          type: 'charge',
          category: 'Manœuvres',
          label: `Manœuvres ${costs.movers} · ${quote.bookingReference}`,
          amount: costs.moverAmount,
          date,
          automatic: true,
          quantity: costs.movers,
          bookingId: quote.reservationId,
          reference: quote.id,
          bookingReference: quote.bookingReference,
        });
      if (costs.carpenterAmount > 0)
        entries.push({
          id: `auto-assembly-${quote.id}`,
          type: 'charge',
          category: 'Menuisier',
          label: `Menuisier ${costs.carpenters} meuble(s) · ${quote.bookingReference}`,
          amount: costs.carpenterAmount,
          date,
          automatic: true,
          quantity: costs.carpenters,
          bookingId: quote.reservationId,
          reference: quote.id,
          bookingReference: quote.bookingReference,
        });
      return entries;
    });
    return [
      ...manual
        .filter((entry) => entry.sourceDevisId === null)
        .map((entry) => ({
          id: entry.id,
          type: entry.type as 'charge' | 'revenu',
          category: entry.categorie,
          label: entry.libelle,
          amount: entry.montant,
          date: entry.date.toISOString().slice(0, 10),
          automatic: false,
        })),
      ...quoteEntries,
      ...archivedEntries,
    ].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  async create(input: ManualAccountingInput): Promise<AccountingEntry> {
    const row = await this.db.ecritureComptable.create({
      data: {
        type: input.type,
        categorie: input.category,
        libelle: input.label,
        montant: input.amount,
        date: new Date(`${input.date}T00:00:00Z`),
      },
    });
    return {
      id: row.id,
      type: row.type as 'charge' | 'revenu',
      category: row.categorie,
      label: row.libelle,
      amount: row.montant,
      date: row.date.toISOString().slice(0, 10),
      automatic: false,
    };
  }

  async void(id: string): Promise<boolean> {
    const result = await this.db.ecritureComptable.updateMany({
      where: { id, annuleLe: null, sourceDevisId: null },
      data: { annuleLe: new Date() },
    });
    return result.count > 0;
  }

  async configuration(): Promise<AccountingFinanceConfiguration | null> {
    const row = await this.db.configurationComptable.findUnique({ where: { identifiant: 'main' } });
    return row ? (row.donnees as AccountingFinanceConfiguration) : null;
  }

  async saveConfiguration(value: AccountingFinanceConfiguration): Promise<void> {
    await this.db.configurationComptable.upsert({
      where: { identifiant: 'main' },
      create: { identifiant: 'main', donnees: value },
      update: { donnees: value },
    });
  }
}
