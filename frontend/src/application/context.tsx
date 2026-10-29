import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Catalogue, TollPoint, User } from '../domain/model';
import { blankDraft, type Draft } from './booking-draft';
import { errorMessage } from './error-message';
import type { AccountingDocumentExporter, ApplicationApi, QuoteExporter } from './ports';
export { blankDraft } from './booking-draft';
export type { Draft } from './booking-draft';
type AppContextValue = {
  api: ApplicationApi;
  exportQuote: QuoteExporter;
  exportAccounting: AccountingDocumentExporter;
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
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
};
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({
  api,
  exportQuote,
  exportAccounting,
  children,
}: {
  api: ApplicationApi;
  exportQuote: QuoteExporter;
  exportAccounting: AccountingDocumentExporter;
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState(blankDraft);
  const [tollPoints, setTollPoints] = useState<TollPoint[]>([]);
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
          setDraft((draft) => ({
            ...draft,
            vehicleId: draft.vehicleId || blankDraft(c).vehicleId,
          }));
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
        draft,
        setDraft,
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
