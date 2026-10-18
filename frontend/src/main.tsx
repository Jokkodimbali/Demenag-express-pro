import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { createHttpApi } from './adapters/http-api';
import { AppProvider } from './application/context';
import type { QuoteExporter } from './application/ports';
import { AppRoutes } from './routing/AppRoutes';
import './styles.css';
const api = createHttpApi();
const exportQuote: QuoteExporter = async (booking, quote, settings) => {
  const { downloadQuote } = await import('./adapters/pdf');
  return downloadQuote(booking, quote, settings);
};
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider api={api} exportQuote={exportQuote}>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
