import type { Point, RouteTicket } from '../../shared/domain/model';

export type RouteMapDraft = {
  vehicleId: string;
  fromAddress: string;
  toAddress: string;
  fromNote: string;
  toNote: string;
  from: Point | null;
  to: Point | null;
  route: RouteTicket | null;
  distanceKmOverride?: number | null;
};

export type RouteMapDraftUpdater = (update: (current: RouteMapDraft) => RouteMapDraft) => void;
