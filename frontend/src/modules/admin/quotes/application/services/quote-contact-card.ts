import { contactVcard } from '../../../../shared/domain/contact-vcard';
import type { Draft } from '../../../../booking/application/booking-draft';
import type { Settings, Vehicle } from '../../../../shared/domain/model';

export function quoteContactCard(
  draft: Draft,
  reference: string | undefined,
  vehicle: Vehicle | undefined,
  settings: Pick<Settings, 'contactFirstTemplate' | 'contactLastTemplate'> | undefined,
) {
  const card = contactVcard(
    {
      name: draft.customerName,
      phone: draft.customerPhone,
      bookings: [],
      appointment: {
        reference: reference ?? '',
        date: draft.noDate ? '' : draft.date,
        month: draft.noDate ? draft.month : '',
        timeSlot: draft.timeSlot,
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
        vehicleShortName: vehicle?.shortName ?? '',
      },
    },
    settings ?? {},
  );
  return card.valid && draft.customerName.trim() ? card : null;
}
