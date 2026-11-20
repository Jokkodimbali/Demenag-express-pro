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
type AppToast = {
  message: string;
  undo?: () => void;
  type: 'success' | 'error';
  persistent?: boolean;
  toastKey?: string;
};
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
  showSuccessToast: (message: string, undo?: () => void) => void;
  showErrorToast: (message: string, options?: { persistent?: boolean; toastKey?: string }) => void;
  clearErrorToast: (toastKey: string) => void;
  successToast: AppToast | null;
  closeSuccessToast: () => void;
};
export type ConfirmationRequest = {
  titleId: string;
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
};
const AppContext = createContext<AppContextValue | null>(null);

function AppSuccessToast({
  message,
  undo,
  type,
  bottomOffset,
  onClose,
}: {
  message: string;
  undo?: () => void;
  type: 'success' | 'error';
  bottomOffset: number;
  onClose: () => void;
}) {
  return (
    <div
      className={`reference-success-toast${type === 'error' ? ' is-error' : ''}`}
      style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span>{message}</span>
      {undo && (
        <button type="button" className="reference-success-toast-undo" onClick={undo}>
          Annuler
        </button>
      )}
      <button
        type="button"
        className="reference-success-toast-close"
        aria-label="Fermer la notification"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

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
  const [successToast, setSuccessToast] = useState<AppToast | null>(null);
  const successToastRef = useRef<AppToast | null>(null);
  const successToastTimer = useRef<number | null>(null);
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
  const showSuccessToast = useCallback((message: string, undo?: () => void) => {
    if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current);
    const toast = { message, undo, type: 'success' as const };
    successToastRef.current = toast;
    setSuccessToast(toast);
    successToastTimer.current = window.setTimeout(() => {
      if (successToastRef.current === toast) {
        successToastRef.current = null;
        setSuccessToast(null);
      }
      successToastTimer.current = null;
    }, 7000);
  }, []);
  const showErrorToast = useCallback(
    (message: string, options: { persistent?: boolean; toastKey?: string } = {}) => {
      if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current);
      const toast = {
        message,
        type: 'error' as const,
        persistent: options.persistent === true,
        toastKey: options.toastKey,
      };
      successToastRef.current = toast;
      setSuccessToast(toast);
      if (toast.persistent) {
        successToastTimer.current = null;
        return;
      }
      successToastTimer.current = window.setTimeout(() => {
        if (successToastRef.current === toast) {
          successToastRef.current = null;
          setSuccessToast(null);
        }
        successToastTimer.current = null;
      }, 7000);
    },
    [],
  );
  useEffect(() => {
    const receiveSuccess = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'string')
        showSuccessToast(event.detail);
    };
    window.addEventListener('demenag:header-success', receiveSuccess);
    return () => window.removeEventListener('demenag:header-success', receiveSuccess);
  }, [showSuccessToast]);
  const closeSuccessToast = useCallback(() => {
    if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current);
    successToastTimer.current = null;
    successToastRef.current = null;
    setSuccessToast(null);
  }, []);
  const clearErrorToast = useCallback((toastKey: string) => {
    const current = successToastRef.current;
    if (current?.type !== 'error' || current.toastKey !== toastKey) return;
    if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current);
    successToastTimer.current = null;
    successToastRef.current = null;
    setSuccessToast(null);
  }, []);
  useEffect(
    () => () => {
      if (successToastTimer.current !== null) window.clearTimeout(successToastTimer.current);
    },
    [],
  );
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
        if (active) {
          const message = errorMessage(cause);
          setError(message);
          showErrorToast(message);
        }
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
  }, [api, retry, showErrorToast]);
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
        showSuccessToast,
        showErrorToast,
        clearErrorToast,
        successToast,
        closeSuccessToast,
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

export function AppSuccessToastHost() {
  const { successToast, closeSuccessToast } = useApp();
  const [bottomOffset, setBottomOffset] = useState(92);

  useEffect(() => {
    if (!successToast) {
      setBottomOffset(92);
      return;
    }

    const saveBar = document.querySelector('.admin-quote-save-bar');
    if (!saveBar) {
      setBottomOffset(92);
      return;
    }

    const updateOffset = () =>
      setBottomOffset(Math.ceil(saveBar.getBoundingClientRect().height) + 16);
    updateOffset();
    const observer = new ResizeObserver(updateOffset);
    observer.observe(saveBar);
    return () => observer.disconnect();
  }, [successToast]);

  if (!successToast) return null;
  return (
    <AppSuccessToast
      message={successToast.message}
      undo={successToast.undo}
      type={successToast.type}
      bottomOffset={bottomOffset}
      onClose={closeSuccessToast}
    />
  );
}
