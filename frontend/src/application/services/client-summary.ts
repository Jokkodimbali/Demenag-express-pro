import type { Booking } from '../../domain/model';

export type ClientSummary = {
  key: string;
  name: string;
  phone: string;
  identifier: string;
  bookingCount: number;
  latestBookingAt: string;
};

export function normalizedClientPhone(phone: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('221')) digits = digits.slice(3);
  return digits;
}

export function clientIdentifier(phone: string) {
  return normalizedClientPhone(phone).slice(-2).padStart(2, '0');
}

export function summarizeClients(bookings: Booking[]): ClientSummary[] {
  const clients = new Map<string, ClientSummary>();
  for (const booking of bookings) {
    const key = normalizedClientPhone(booking.phone);
    if (!key) continue;
    const current = clients.get(key);
    if (current) {
      current.bookingCount++;
      if (booking.createdAt > current.latestBookingAt) {
        current.name = booking.customerName;
        current.phone = booking.phone;
        current.latestBookingAt = booking.createdAt;
      }
      continue;
    }
    clients.set(key, {
      key,
      name: booking.customerName,
      phone: booking.phone,
      identifier: clientIdentifier(booking.phone),
      bookingCount: 1,
      latestBookingAt: booking.createdAt,
    });
  }
  return [...clients.values()].sort(
    (left, right) => right.bookingCount - left.bookingCount || left.name.localeCompare(right.name),
  );
}
