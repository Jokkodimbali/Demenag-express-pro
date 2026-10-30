import type { AccountingEntry, AccountingFinanceConfiguration } from '../domain/model';
import {
  accountNames,
  buildSyscohadaEntries,
  type FinanceMonth,
} from '../domain/accounting-forecast';

type AccountingDocument =
  'journal' | 'gl' | 'bal' | 'cr' | 'bilan' | 'amort' | 'dette' | 'smt' | 'all';
type PdfRow = { values: (string | number)[]; bold?: boolean };

const clean = (value: unknown) =>
  String(value ?? '')
    .replace(/[−–—]/gu, '-')
    .replace(/[·•]/gu, '-')
    .replace(/[’]/gu, "'")
    .replace(/œ/giu, (letter) => (letter === 'Œ' ? 'OE' : 'oe'));
const amount = (value: number) =>
  Math.round(value || 0)
    .toLocaleString('fr-FR')
    .replace(/[\u202f\u00a0]/gu, ' ');

export async function exportAccountingPdf(
  which: AccountingDocument,
  config: AccountingFinanceConfiguration,
  months: FinanceMonth[],
  entries: AccountingEntry[],
  endMonth: string,
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ledger = buildSyscohadaEntries(config, months, entries, endMonth);
  const accounts = [...new Set(ledger.map((line) => line.account))].sort();
  const balances = Object.fromEntries(
    accounts.map((account) => {
      const rows = ledger.filter((line) => line.account === account);
      return [
        account,
        {
          debit: rows.reduce((sum, row) => sum + row.debit, 0),
          credit: rows.reduce((sum, row) => sum + row.credit, 0),
        },
      ];
    }),
  );
  const sold = (account: string) => {
    const balance = balances[account];
    return balance ? balance.debit - balance.credit : 0;
  };
  const classes = (prefix: string) => accounts.filter((account) => account.startsWith(prefix));
  const regime = months.some((month) => month.suarl)
    ? 'SUARL'
    : 'Entreprise individuelle (régime informel)';
  let firstPage = true;

  function table(title: string, columns: [string, number, boolean?][], rows: PdfRow[]) {
    if (!firstPage) doc.addPage();
    firstPage = false;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const columnTotal = columns.reduce((sum, column) => sum + column[1], 0);
    const scale = (pageWidth - margin * 2) / columnTotal;
    const x = columns.map(
      (_, index) =>
        margin + columns.slice(0, index).reduce((sum, column) => sum + column[1] * scale, 0),
    );
    let y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(clean(title), margin, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      clean(
        `Demenag Express - ${regime} - Référentiel SYSCOHADA révisé - Période ${config.start} à ${endMonth}`,
      ),
      margin,
      y + 22,
    );
    y += 40;
    const drawHead = () => {
      doc.setFillColor(235, 235, 235);
      doc.rect(margin, y - 10, pageWidth - margin * 2, 16, 'F');
      doc.setFont('helvetica', 'bold');
      columns.forEach((column, index) => {
        const text = clean(column[0]);
        if (column[2]) doc.text(text, x[index] + column[1] * scale - 4, y, { align: 'right' });
        else doc.text(text, x[index] + 3, y);
      });
      doc.setFont('helvetica', 'normal');
      y += 16;
    };
    drawHead();
    for (const row of rows) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin + 10;
        drawHead();
      }
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
      columns.forEach((column, index) => {
        const lines = doc.splitTextToSize(
          clean(row.values[index] ?? ''),
          column[1] * scale - 6,
        ) as unknown[];
        const firstLine = lines[0];
        const text = clean(typeof firstLine === 'string' ? firstLine : '');
        if (column[2]) doc.text(text, x[index] + column[1] * scale - 4, y, { align: 'right' });
        else doc.text(text, x[index] + 3, y);
      });
      doc.setFont('helvetica', 'normal');
      doc.setDrawColor(225);
      doc.line(margin, y + 4, pageWidth - margin, y + 4);
      y += 14;
    }
  }

  const docs: Record<Exclude<AccountingDocument, 'all'>, () => void> = {
    journal: () =>
      table(
        'Journal général',
        [
          ['Date', 70],
          ['Compte', 50],
          ['Libellé', 230],
          ['Débit', 80, true],
          ['Crédit', 80, true],
        ],
        [
          ...ledger.map((row) => ({
            values: [
              row.date,
              row.account,
              row.label,
              row.debit ? amount(row.debit) : '',
              row.credit ? amount(row.credit) : '',
            ],
          })),
          {
            bold: true,
            values: [
              '',
              '',
              'Totaux',
              amount(ledger.reduce((sum, row) => sum + row.debit, 0)),
              amount(ledger.reduce((sum, row) => sum + row.credit, 0)),
            ],
          },
        ],
      ),
    gl: () => {
      const rows: PdfRow[] = [];
      for (const account of accounts) {
        let balance = 0;
        rows.push({ bold: true, values: [account, accountNames[account] ?? '', '', '', ''] });
        for (const line of ledger.filter((row) => row.account === account)) {
          balance += line.debit - line.credit;
          rows.push({
            values: [
              line.date,
              line.label,
              line.debit ? amount(line.debit) : '',
              line.credit ? amount(line.credit) : '',
              amount(balance),
            ],
          });
        }
      }
      table(
        'Grand livre',
        [
          ['Date', 70],
          ['Libellé', 220],
          ['Débit', 80, true],
          ['Crédit', 80, true],
          ['Solde', 80, true],
        ],
        rows,
      );
    },
    bal: () =>
      table(
        'Balance générale',
        [
          ['Compte', 50],
          ['Intitulé', 190],
          ['Débit', 70, true],
          ['Crédit', 70, true],
          ['Solde D', 70, true],
          ['Solde C', 70, true],
        ],
        accounts.map((account) => {
          const balance = balances[account];
          const difference = balance.debit - balance.credit;
          return {
            values: [
              account,
              accountNames[account] ?? '',
              amount(balance.debit),
              amount(balance.credit),
              difference > 0 ? amount(difference) : '',
              difference < 0 ? amount(-difference) : '',
            ],
          };
        }),
      ),
    cr: () => {
      const products = classes('7').map((account) => ({
        values: [account, accountNames[account] ?? '', amount(-sold(account))],
      }));
      const charges = [...classes('6'), ...classes('8')].map((account) => ({
        values: [account, accountNames[account] ?? '', amount(sold(account))],
      }));
      const productTotal = classes('7').reduce((sum, account) => sum - sold(account), 0);
      const chargeTotal = [...classes('6'), ...classes('8')].reduce(
        (sum, account) => sum + sold(account),
        0,
      );
      table(
        'Compte de résultat',
        [
          ['Compte', 60],
          ['Intitulé', 280],
          ['Montant', 120, true],
        ],
        [
          { bold: true, values: ['', 'PRODUITS', ''] },
          ...products,
          { bold: true, values: ['', 'Total produits', amount(productTotal)] },
          { bold: true, values: ['', 'CHARGES', ''] },
          ...charges,
          { bold: true, values: ['', 'Total charges', amount(chargeTotal)] },
          { bold: true, values: ['13', 'RÉSULTAT NET', amount(productTotal - chargeTotal)] },
        ],
      );
    },
    bilan: () => {
      const result =
        classes('7').reduce((sum, account) => sum - sold(account), 0) -
        [...classes('6'), ...classes('8')].reduce((sum, account) => sum + sold(account), 0);
      const grossAssets = sold('245');
      const amortization = -(sold('2845') + sold('2848'));
      const cash = sold('571') + sold('521');
      const assets = grossAssets - amortization + cash;
      const debt = -sold('168');
      const tax = -sold('441');
      const capital = assets - debt - tax - result;
      table(
        'Bilan simplifié',
        [
          ['Poste', 300],
          ['Montant', 140, true],
        ],
        [
          { bold: true, values: ['ACTIF', ''] },
          { values: ['Matériel de transport (brut)', amount(grossAssets)] },
          { values: ['Amortissements cumulés', `- ${amount(amortization)}`] },
          { values: ['Immobilisations nettes', amount(grossAssets - amortization)] },
          { values: ['Trésorerie (caisse + réserve véhicule)', amount(cash)] },
          { bold: true, values: ['Total actif', amount(assets)] },
          { bold: true, values: ['PASSIF', ''] },
          { values: ['Capital / compte de l’exploitant', amount(capital)] },
          { values: ['Résultat de la période', amount(result)] },
          { values: ['Emprunt auprès du père (reste dû)', amount(debt)] },
          { values: ['Impôt sur les bénéfices à payer', amount(tax)] },
          { bold: true, values: ['Total passif', amount(assets)] },
        ],
      );
    },
    amort: () =>
      table(
        'Tableau des amortissements',
        [
          ['Mois', 70],
          ['Base', 90, true],
          ['Dû', 80, true],
          ['Doté', 80, true],
          ['Reporté', 80, true],
          ['Cumul', 90, true],
          ['VNC', 90, true],
        ],
        months.map((row) => ({
          values: [
            row.key,
            amount(row.fleetBase),
            amount(row.fleetDue),
            amount(row.fleetPaid),
            amount(row.fleetDue - row.fleetPaid),
            amount(row.fleetAmortized),
            amount(row.fleetBase - row.fleetAmortized),
          ],
        })),
      ),
    dette: () =>
      table(
        'Échéancier de la dette (père)',
        [
          ['Mois', 70],
          ['Bénéfice', 90, true],
          [`Plafond ${config.profitCapPercent} %`, 90, true],
          ['Dû', 80, true],
          ['Payé', 80, true],
          ['Reporté', 80, true],
          ['Reste dû', 90, true],
        ],
        months.map((row) => ({
          values: [
            row.key,
            amount(row.profit),
            amount(row.budget),
            amount(row.debtDue),
            amount(row.debtPaid),
            amount(row.debtDue - row.debtPaid),
            amount(row.debtLeft),
          ],
        })),
      ),
    smt: () => {
      let cumulative = 0;
      table(
        'Système minimal de trésorerie',
        [
          ['Mois', 70],
          ['Recettes', 90, true],
          ['Dépenses', 90, true],
          ['Solde du mois', 90, true],
          ['Cumul', 90, true],
        ],
        months.map((row) => {
          const outflow = row.costs + row.debtPaid + row.reservePaid + row.tax;
          cumulative += row.revenue - outflow;
          return {
            values: [
              row.key,
              amount(row.revenue),
              amount(outflow),
              amount(row.revenue - outflow),
              amount(cumulative),
            ],
          };
        }),
      );
    },
  };
  const requested = which === 'all' ? (Object.keys(docs) as (keyof typeof docs)[]) : [which];
  requested.forEach((key) => docs[key]());
  doc.save(`SYSCOHADA-${which === 'all' ? 'pack' : which}-${endMonth}.pdf`);
}
