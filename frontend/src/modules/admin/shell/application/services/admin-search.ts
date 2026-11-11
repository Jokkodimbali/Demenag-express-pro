import type { Booking } from '../../../../shared/domain/model';

export type AdminSearchResult =
  | { kind: 'booking'; booking: Booking }
  | { kind: 'client'; phone: string; name: string; address: string };

export function normalizeAdminSearchQuery(query: string) {
  return query.trim().toLocaleLowerCase('fr');
}

export function findAdminSearchResults(
  bookings: readonly Booking[],
  clients: readonly { phone: string; name: string; address: string }[],
  query: string,
): AdminSearchResult[] {
  const normalized = normalizeAdminSearchQuery(query);
  if (normalized.length < 2) return [];
  const digits = normalized.replace(/\D/g, '');
  const bookingResults: AdminSearchResult[] = bookings
    .filter(
      (booking) =>
        [booking.reference, booking.customerName, booking.fromAddress, booking.toAddress].some(
          (value) => value.toLocaleLowerCase('fr').includes(normalized),
        ) ||
        (digits.length >= 3 && booking.phone.replace(/\D/g, '').includes(digits)),
    )
    .slice(0, 8)
    .map((booking) => ({ kind: 'booking', booking }));
  const clientResults: AdminSearchResult[] = clients
    .filter(
      (client) =>
        client.name.toLocaleLowerCase('fr').includes(normalized) ||
        (digits.length >= 3 && client.phone.replace(/\D/g, '').includes(digits)),
    )
    .slice(0, 4)
    .map((client) => ({ kind: 'client', ...client }));
  return [...bookingResults, ...clientResults];
}

export function unreadNotificationPreview<T extends { readAt?: string | null }>(
  notifications: readonly T[],
) {
  return notifications.filter((notification) => !notification.readAt).slice(0, 12);
}
