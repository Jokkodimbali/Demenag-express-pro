import { useEffect, useState } from 'react';
import { today } from '../../domain/format';
import type { Booking, Driver, Vehicle } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { CatalogueService } from '../services/catalogue';
import { revenueFor, sameWeek } from '../services/revenue';
import { vehicleFromForm } from '../validation/forms';

export type VehicleActivity = {
  bookings: number;
  todayRevenue: number;
  weekRevenue: number;
};

export function useFleet() {
  const { api, catalogue, setCatalogue } = useApp();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deactivating, setDeactivating] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverChoices, setDriverChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    api
      .bookings()
      .then((value) => {
        if (active) setBookings(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    let active = true;
    api
      .drivers()
      .then((value) => {
        if (active) setDrivers(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!catalogue || !editing || busy) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const value = await vehicleFromForm(data, editing);
      setCatalogue(await new CatalogueService(api).saveVehicle(catalogue, value));
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function requestDeactivation(vehicle: Vehicle) {
    if (busy) return;
    setError('');
    setDeactivating(vehicle);
  }

  async function deactivate() {
    if (!catalogue || !deactivating || busy) return;
    setBusy(true);
    setError('');
    try {
      setCatalogue(await new CatalogueService(api).deactivateVehicle(catalogue, deactivating));
      setDeactivating(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function setVehicleAvailability(vehicle: Vehicle) {
    if (!catalogue || busy) return;
    setBusy(true);
    setError('');
    try {
      setCatalogue(
        await new CatalogueService(api).saveVehicle(catalogue, {
          ...vehicle,
          active: vehicle.active === false,
        }),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function setBookingsAvailability(bookingsEnabled: boolean) {
    if (!catalogue || busy) return;
    setBusy(true);
    setError('');
    try {
      setCatalogue(
        await new CatalogueService(api).saveBookingAvailability(catalogue, bookingsEnabled),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function selectedDriverId(vehicle: Vehicle) {
    return (
      driverChoices[vehicle.id] ?? drivers.find((item) => item.vehicleId === vehicle.id)?.id ?? ''
    );
  }

  function chooseDriver(vehicle: Vehicle, driverId: string) {
    setDriverChoices((values) => ({ ...values, [vehicle.id]: driverId }));
  }

  async function assignDriver(vehicle: Vehicle) {
    const driverId = selectedDriverId(vehicle);
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await api.updateDriver({ ...driver, vehicleId: vehicle.id });
      setDrivers((values) =>
        values.map((item) =>
          item.id === saved.id
            ? saved
            : item.vehicleId === vehicle.id
              ? { ...item, vehicleId: null }
              : item,
        ),
      );
      setDriverChoices((values) => {
        const remaining = { ...values };
        delete remaining[vehicle.id];
        return remaining;
      });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function unassignDriver(vehicle: Vehicle) {
    const driver = drivers.find((item) => item.vehicleId === vehicle.id);
    if (!driver || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await api.updateDriver({ ...driver, vehicleId: null });
      setDrivers((values) => values.map((item) => (item.id === saved.id ? saved : item)));
      setDriverChoices((values) => {
        const remaining = { ...values };
        delete remaining[vehicle.id];
        return remaining;
      });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function activity(vehicle: Vehicle): VehicleActivity {
    const vehicleBookings = bookings.filter((booking) => booking.vehicle.id === vehicle.id);
    const currentDay = today();
    return {
      bookings: vehicleBookings.length,
      todayRevenue: revenueFor(vehicleBookings.filter((booking) => booking.date === currentDay))
        .total,
      weekRevenue: revenueFor(
        vehicleBookings.filter((booking) => sameWeek(booking.date, currentDay)),
      ).total,
    };
  }

  return {
    catalogue,
    editing,
    setEditing,
    deactivating,
    setDeactivating,
    busy,
    error,
    setError,
    save,
    requestDeactivation,
    deactivate,
    setVehicleAvailability,
    setBookingsAvailability,
    drivers,
    selectedDriverId,
    chooseDriver,
    assignDriver,
    unassignDriver,
    activity,
  };
}
