import type { Booking } from '../../../../shared/domain/model';

export type ClientSuggestionProfile = {
  phone: string;
  name: string;
  address: string;
};

type ClientSuggestionBooking = Pick<
  Booking,
  'phone' | 'customerName' | 'fromAddress' | 'createdAt'
>;

type HiddenClientProfile = { phone: string; hiddenAt: string };

export function mergeClientSuggestionProfiles(
  profiles: ClientSuggestionProfile[],
  bookings: ClientSuggestionBooking[],
  hiddenClients: HiddenClientProfile[],
) {
  const profilesByPhone = new Map<string, ClientSuggestionProfile>();
  for (const profile of profiles) {
    const key = clientPhoneKey(profile.phone);
    if (key.length >= 9 && !profilesByPhone.has(key)) profilesByPhone.set(key, profile);
  }

  const hiddenByPhone = new Map<string, string>();
  for (const profile of hiddenClients) {
    const key = clientPhoneKey(profile.phone);
    if (key.length >= 9 && !hiddenByPhone.has(key)) hiddenByPhone.set(key, profile.hiddenAt);
  }

  const latestBookings = [...bookings].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const seenPhones = new Set<string>();
  const merged: ClientSuggestionProfile[] = [];

  for (const booking of latestBookings) {
    const key = clientPhoneKey(booking.phone);
    if (key.length < 9 || seenPhones.has(key) || !booking.customerName.trim()) continue;
    seenPhones.add(key);

    const hiddenAt = hiddenByPhone.get(key);
    if (hiddenAt && booking.createdAt <= hiddenAt) continue;

    const profile = profilesByPhone.get(key);
    merged.push({
      phone: profile?.phone || booking.phone,
      name: profile?.name || booking.customerName,
      address: profile?.address || booking.fromAddress,
    });
  }

  const bookingPhoneKeys = new Set(latestBookings.map((booking) => clientPhoneKey(booking.phone)));
  for (const profile of profiles) {
    const key = clientPhoneKey(profile.phone);
    if (key.length < 9 || bookingPhoneKeys.has(key) || hiddenByPhone.has(key)) continue;
    if (profile.name.trim()) merged.push(profile);
  }

  return merged;
}

export function clientSuggestionSelection(
  profile: ClientSuggestionProfile,
  departureAddress: string,
) {
  return {
    customerName: profile.name,
    customerPhone: profile.phone,
    ...(!departureAddress.trim() && profile.address ? { fromAddress: profile.address } : {}),
  };
}

export function clientPhoneKey(phone: string) {
  return phone.replace(/\D/g, '').slice(-9);
}

export function savedClientForPhone(profiles: ClientSuggestionProfile[], phone: string) {
  const key = clientPhoneKey(phone);
  return key.length >= 9
    ? (profiles.find((profile) => clientPhoneKey(profile.phone) === key) ?? null)
    : null;
}

export function clientNameSuggestions(
  profiles: ClientSuggestionProfile[],
  query: string,
  selectedPhone: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const phoneQuery = normalizedQuery.replace(/\D/g, '') || '#';
  const selectedPhoneKey = clientPhoneKey(selectedPhone);

  return profiles
    .filter(
      (profile) =>
        profile.name.toLowerCase().includes(normalizedQuery) ||
        clientPhoneKey(profile.phone).includes(phoneQuery),
    )
    .filter(
      (profile) =>
        !(
          profile.name.toLowerCase() === normalizedQuery &&
          clientPhoneKey(profile.phone) === selectedPhoneKey
        ),
    )
    .slice(0, 6);
}
