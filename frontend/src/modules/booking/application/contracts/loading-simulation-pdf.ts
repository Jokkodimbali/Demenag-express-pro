import type { Draft } from '../booking-draft';
import type { SimPlan } from '../../../moving/application/services/loading-simulation-model';
import type { MovingEstimate } from '../../../moving/domain/estimate/moving-estimate';
import type { Vehicle } from '../../../shared/domain/model';

type PdfEquipment = { key: string; name: string; quantity: string; why: string; norm: string };

export type LoadingSimulationPdfInput = {
  plan: SimPlan;
  draft: Draft;
  vehicle?: Vehicle;
  blanketLengthCm: number;
  blanketWidthCm: number;
  stock: number;
  estimate?: MovingEstimate | null;
  details: { equipment: PdfEquipment[] };
  imageDataUrl: (path: string) => Promise<string | null>;
};

export type LoadingSimulationPdfExporter = (input: LoadingSimulationPdfInput) => Promise<boolean>;
