import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { createHttpApi } from '../shared/adapters/http-api';
import { AppProvider } from '../shared/application/context';
import { AppConfirmation } from '../shared/feedback/AppConfirmation';
import type {
  AccountingDocumentExporter,
  PlanningWeekExporter,
  QuoteExporter,
  TariffDocumentExporter,
} from '../shared/application/ports';
import { AppRoutes } from './routing/AppRoutes';
import './styles/global.css';
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
const api = createHttpApi();
const exportQuote: QuoteExporter = async (booking, quote, settings) => {
  const { downloadQuote } = await import('../shared/adapters/pdf');
  return downloadQuote(booking, quote, settings);
};
const exportAccounting: AccountingDocumentExporter = async (
  document,
  config,
  months,
  entries,
  endMonth,
) => {
  const { exportAccountingPdf } = await import('../admin/accounting/adapters/accounting-pdf');
  await exportAccountingPdf(document, config, months, entries, endMonth);
};
const exportPlanningWeek: PlanningWeekExporter = async (bookings, drivers, anchor, filtered) => {
  const { downloadPlanningWeekPdf } = await import('../shared/adapters/pdf');
  await downloadPlanningWeekPdf(bookings, drivers, anchor, filtered);
};
const exportTariffDocument: TariffDocumentExporter = async (catalogue, kind, share, tollPoints) => {
  const { exportTariffDocument } = await import('../admin/settings/adapters/tariff-documents');
  await exportTariffDocument(catalogue, kind, share, tollPoints);
};
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider
        api={api}
        exportQuote={exportQuote}
        exportAccounting={exportAccounting}
        exportPlanningWeek={exportPlanningWeek}
        exportTariffDocument={exportTariffDocument}
      >
        <AppRoutes />
        <AppConfirmation />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
