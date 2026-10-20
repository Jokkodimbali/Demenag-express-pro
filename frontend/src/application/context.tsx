import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Catalogue, User } from '../domain/model';
import { blankDraft, type Draft } from './booking-draft';
import { errorMessage } from './error-message';
import type { ApplicationApi, QuoteExporter } from './ports';
export { blankDraft } from './booking-draft';
export type { Draft } from './booking-draft';
type AppContextValue = {
  api: ApplicationApi;
  exportQuote: QuoteExporter;
  user: User | null;
  setUser: (value: User | null) => void;
  authLoading: boolean;
  catalogue: Catalogue | null;
  setCatalogue: (value: Catalogue) => void;
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
  children,
}: {
  api: ApplicationApi;
  exportQuote: QuoteExporter;
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState(blankDraft);
  useEffect(() => api.onSessionExpired?.(() => setUser(null)), [api]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.catalogue(), api.me()])
      .then(([c, u]) => {
        if (active) {
          setCatalogue({
            ...c,
            settings: {
              ...c.settings,
              whatsappPhone: c.settings.whatsappPhone || c.settings.businessPhone || '',
            },
          });
          setUser(u);
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
        if (active) {
          setLoading(false);
          setAuthLoading(false);
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
        user,
        setUser,
        authLoading,
        catalogue,
        setCatalogue,
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
