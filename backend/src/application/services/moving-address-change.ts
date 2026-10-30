import type { Booking, Point } from '../../domain/model.js';

export function addressChangeForUpdate(
  booking: Booking,
  fromAddress: string,
  toAddress: string,
  from: Point,
  to: Point,
  at: string,
) {
  const fromChanged =
    fromAddress.trim() !== booking.fromAddress.trim() ||
    Math.abs(from[0] - booking.from[0]) > 1e-5 ||
    Math.abs(from[1] - booking.from[1]) > 1e-5;
  const toChanged =
    toAddress.trim() !== booking.toAddress.trim() ||
    Math.abs(to[0] - booking.to[0]) > 1e-5 ||
    Math.abs(to[1] - booking.to[1]) > 1e-5;
  if (!fromChanged && !toChanged) return booking.crewAddressChange;
  const oldChange = booking.crewAddressChange;
  const stillPending =
    oldChange && Object.values(booking.crewBriefs ?? {}).some((sentAt) => sentAt < oldChange.at);
  return {
    from: fromChanged || Boolean(stillPending && oldChange.from),
    to: toChanged || Boolean(stillPending && oldChange.to),
    at,
  };
}
