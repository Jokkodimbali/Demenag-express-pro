import type { Booking, Driver } from '../../../../shared/domain/model';

export type AdminEmployeeProof = NonNullable<Booking['employeeProofs']>[number] & {
  bookingId: string;
  mission: string;
  missionOption: string;
  employeeName: string;
  vehicleId: string;
  vehicleName: string;
};

export function isVehicleReportNotification(title: string | undefined): boolean {
  return title === 'Contrôle véhicule reçu' || title === 'Panne signalée';
}

export function employeeProofsForBookings(
  bookings: Booking[],
  drivers: Driver[],
): AdminEmployeeProof[] {
  const employeeNames = new Map(drivers.map((driver) => [driver.id, driver.name]));
  return bookings.flatMap((booking) =>
    (booking.employeeProofs ?? [])
      .filter((proof) => proof.image)
      .map((proof) => ({
        ...proof,
        bookingId: booking.id,
        mission: `${booking.reference} · ${(booking.customerName || '').split(' ')[0]}`,
        missionOption: `${booking.reference} · ${booking.customerName || ''}`,
        employeeName: employeeNames.get(proof.employeeId) ?? '-',
        vehicleId: booking.vehicle.id,
        vehicleName: booking.vehicle.shortName || booking.vehicle.name,
      })),
  );
}
