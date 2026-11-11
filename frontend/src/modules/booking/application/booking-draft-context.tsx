import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useApp } from '../../shared/application/context';
import { blankDraft, type Draft } from './booking-draft';

type BookingDraftValue = {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
};

const BookingDraftContext = createContext<BookingDraftValue | null>(null);

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const { catalogue } = useApp();
  const [draft, setDraft] = useState(blankDraft);

  useEffect(() => {
    if (!catalogue) return;
    setDraft((current) => ({
      ...current,
      vehicleId: current.vehicleId || blankDraft(catalogue).vehicleId,
    }));
  }, [catalogue]);

  return (
    <BookingDraftContext.Provider value={{ draft, setDraft }}>
      {children}
    </BookingDraftContext.Provider>
  );
}

export function useBookingDraft() {
  const value = useContext(BookingDraftContext);
  if (!value) throw new Error('BookingDraftProvider manquant');
  return value;
}
