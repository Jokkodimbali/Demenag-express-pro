import type { Booking, Catalogue, Driver, Vehicle } from '../../../../shared/domain/model';
import { revenueFor, sameWeek } from '../../../accounting/application/services/revenue';

export type VehicleActivity = {
  bookings: number;
  todayRevenue: number;
  weekRevenue: number;
};

export function vehicleCreationPhotoError(
  isNewVehicle: boolean,
  profilePhoto: FormDataEntryValue | null,
  interiorPhoto: FormDataEntryValue | null,
) {
  return isNewVehicle && (!String(profilePhoto ?? '') || !String(interiorPhoto ?? ''))
    ? 'Importez une photo de profil et une photo intérieure pour ce véhicule.'
    : '';
}

export function vehicleAvailabilityUpdate(vehicle: Vehicle): Vehicle {
  return { ...vehicle, active: vehicle.active === false };
}

export function assignedDriversAfterVehicleAssignment(
  drivers: Driver[],
  savedDriver: Driver,
  vehicleId: string,
) {
  return drivers.map((driver) =>
    driver.id === savedDriver.id
      ? savedDriver
      : driver.vehicleId === vehicleId
        ? { ...driver, vehicleId: null }
        : driver,
  );
}

export function unassignedDriverUpdate(drivers: Driver[], savedDriver: Driver) {
  return drivers.map((driver) => (driver.id === savedDriver.id ? savedDriver : driver));
}

export function vehicleActivity(
  bookings: Booking[],
  vehicle: Vehicle,
  catalogue: Catalogue | null,
  currentDay: string,
): VehicleActivity {
  const vehicleBookings = bookings.filter((booking) => booking.vehicle.id === vehicle.id);
  return {
    bookings: vehicleBookings.length,
    todayRevenue: revenueFor(
      vehicleBookings.filter((booking) => booking.date === currentDay),
      catalogue,
    ).total,
    weekRevenue: revenueFor(
      vehicleBookings.filter((booking) => sameWeek(booking.date, currentDay)),
      catalogue,
    ).total,
  };
}
