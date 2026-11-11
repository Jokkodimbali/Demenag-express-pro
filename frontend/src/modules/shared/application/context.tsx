import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Catalogue, TollPoint, User } from '../domain/model';
import { errorMessage } from './error-message';
import type {
  AccountingDocumentExporter,
  ApplicationApi,
  PlanningWeekExporter,
  QuoteExporter,
  TariffDocumentExporter,
} from './ports';
type AppContextValue = {
  api: ApplicationApi;
  exportQuote: QuoteExporter;
  exportAccounting: AccountingDocumentExporter;
  exportPlanningWeek: PlanningWeekExporter;
  exportTariffDocument: TariffDocumentExporter;
  user: User | null;
  setUser: (value: User | null) => void;
  authLoading: boolean;
  catalogue: Catalogue | null;
  setCatalogue: (value: Catalogue) => void;
  tollPoints: TollPoint[];
  setTollPoints: React.Dispatch<React.SetStateAction<TollPoint[]>>;
  loading: boolean;
  error: string;
  reload: () => void;
  confirmation: ConfirmationRequest | null;
  requestConfirmation: (request: ConfirmationRequest) => Promise<boolean>;
  resolveConfirmation: (confirmed: boolean) => void;
};
export type ConfirmationRequest = {
  titleId: string;
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
};
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({
  api,
  exportQuote,
  exportAccounting,
  exportPlanningWeek,
  exportTariffDocument,
  children,
}: {
  api: ApplicationApi;
  exportQuote: QuoteExporter;
  exportAccounting: AccountingDocumentExporter;
  exportPlanningWeek: PlanningWeekExporter;
  exportTariffDocument: TariffDocumentExporter;
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [tollPoints, setTollPoints] = useState<TollPoint[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const requestConfirmation = useCallback((request: ConfirmationRequest) => {
    return new Promise<boolean>((resolve) => {
      confirmationResolver.current?.(false);
      confirmationResolver.current = resolve;
      setConfirmation(request);
    });
  }, []);
  const resolveConfirmation = useCallback((confirmed: boolean) => {
    setConfirmation(null);
    confirmationResolver.current?.(confirmed);
    confirmationResolver.current = null;
  }, []);
  useEffect(() => api.onSessionExpired?.(() => setUser(null)), [api]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setAuthLoading(true);
    setError('');
    void api
      .me()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    void api
      .catalogue()
      .then((c) => {
        if (active) {
          setCatalogue({
            ...c,
            settings: {
              ...c.settings,
              whatsappPhone: c.settings.whatsappPhone || c.settings.businessPhone || '',
            },
          });
        }
      })
      .catch((e: unknown) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void api
      .tollPoints()
      .then((points) => {
        if (active) setTollPoints(points);
      })
      .catch((cause: unknown) => {
        if (active) {
          setTollPoints([]);
          setError(errorMessage(cause));
        }
      });
    return () => {
      active = false;
    };
  }, [api, retry]);
  return (
    <AppContext.Provider
      value={{
        api,
        exportQuote,
        exportAccounting,
        exportPlanningWeek,
        exportTariffDocument,
        user,
        setUser,
        authLoading,
        catalogue,
        setCatalogue,
        tollPoints,
        setTollPoints,
        loading,
        error,
        reload: () => setRetry((n) => n + 1),
        confirmation,
        requestConfirmation,
        resolveConfirmation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider manquant');
  return value;
}
