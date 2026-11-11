import { createContext, useContext, type ReactNode } from 'react';
import type { LoadingSimulationPdfExporter } from './contracts/loading-simulation-pdf';

const LoadingSimulationPdfContext = createContext<LoadingSimulationPdfExporter | null>(null);

export function LoadingSimulationPdfProvider({
  exporter,
  children,
}: {
  exporter: LoadingSimulationPdfExporter;
  children: ReactNode;
}) {
  return (
    <LoadingSimulationPdfContext.Provider value={exporter}>
      {children}
    </LoadingSimulationPdfContext.Provider>
  );
}

export function useLoadingSimulationPdfExporter() {
  const exporter = useContext(LoadingSimulationPdfContext);
  if (!exporter) throw new Error('LoadingSimulationPdfProvider manquant');
  return exporter;
}
