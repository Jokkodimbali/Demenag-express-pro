import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Catalogue, Options, Point, RouteTicket, User } from '../domain/model';
import type { ApplicationApi } from './ports';
export type Draft = {
  vehicleId: string;
  fromAddress: string;
  toAddress: string;
  from: Point | null;
  to: Point | null;
  route: RouteTicket | null;
  date: string;
  timeSlot: string;
  options: Options;
  notes: string;
  requestId: string;
};
export const blankDraft = (): Draft => ({
  vehicleId: 'sprinter',
  fromAddress: '',
  toAddress: '',
  from: null,
  to: null,
  route: null,
  date: '',
  timeSlot: 'Matin (8h – 12h)',
  options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
  notes: '',
  requestId: crypto.randomUUID(),
});
type AppContextValue = {
  api: ApplicationApi;
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
export function AppProvider({ api, children }: { api: ApplicationApi; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState(blankDraft);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.catalogue(), api.me()])
      .then(([c, u]) => {
        if (active) {
          setCatalogue(c);
          setUser(u);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
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
