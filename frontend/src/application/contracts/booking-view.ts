import type { Dispatch, SetStateAction } from 'react';
import type { Catalogue, Options, Price, User, Vehicle } from '../../domain/model';
import type { Draft } from '../booking-draft';
export interface BookingViewState {
  catalogue: Catalogue | null;
  selected: Vehicle | undefined;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  user: User | null;
  price: Price | null;
  tiers: string[];
  estimating: boolean;
  estimateError: string;
  submitError: string;
  submitting: boolean;
  extras: [keyof Options, string, string][];
  option: (key: keyof Options, delta: number) => void;
}
