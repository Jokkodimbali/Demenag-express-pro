import type { Booking, Options, Quote } from '../../domain/model';

const serviceLabels: Record<keyof Options, string> = {
  labour: 'Manœuvre',
  desk: 'Menuisier · bureau',
  wardrobe: 'Menuisier · armoire',
  bed: 'Menuisier · lit',
};

export function isQuotedServiceLine(label: string) {
  return Object.values(serviceLabels).some(
    (serviceLabel) =>
      label === serviceLabel ||
      (serviceLabel === serviceLabels.labour && label.startsWith(`${serviceLabel} (`)),
  );
}

/** Read the saved quote lines, which are also the quantities printed in the PDF. */
export function quotedServiceOptions(booking: Booking, quote: Quote | undefined): Options {
  const price = quote?.price ?? booking.estimate;
  const quantity = (label: string) =>
    price.lines.find((line) =>
      label === serviceLabels.labour
        ? line.label === label || line.label.startsWith(`${label} (`)
        : line.label === label,
    )?.quantity ?? 0;
  return {
    labour: quantity(serviceLabels.labour),
    desk: quantity(serviceLabels.desk),
    wardrobe: quantity(serviceLabels.wardrobe),
    bed: quantity(serviceLabels.bed),
  };
}
