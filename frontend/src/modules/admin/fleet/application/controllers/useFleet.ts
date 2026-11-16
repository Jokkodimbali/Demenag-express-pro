import { useEffect, useState } from 'react';
import { today } from '../../../../shared/domain/date';
import type { Booking, Driver, Vehicle } from '../../../../shared/domain/model';
import { useApp } from '../../../../shared/application/context';
import { errorMessage } from '../../../../shared/application/error-message';
import { CatalogueService } from '../../../../catalogue/application/services/catalogue';
import { vehicleFromForm } from '../../../application/forms/vehicle-from-form';
import {
  assignedDriversAfterVehicleAssignment,
  unassignedDriverUpdate,
  vehicleActivity,
  vehicleAvailabilityUpdate,
  vehicleCreationPhotoError,
  type VehicleActivity,
} from '../services/fleet-policy';

export type { VehicleActivity } from '../services/fleet-policy';

export function useFleet() {
  const { api, catalogue, setCatalogue, showSuccessToast, showErrorToast } = useApp();
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
    const isNewVehicle = !catalogue.vehicles.some((vehicle) => vehicle.id === editing.id);
    const photoError = vehicleCreationPhotoError(
      isNewVehicle,
      data.get('image'),
      data.get('interior'),
    );
    if (photoError) {
      setError(photoError);
      showErrorToast(photoError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const value = await vehicleFromForm(data, editing);
      setCatalogue(await new CatalogueService(api).saveVehicle(catalogue, value));
      setEditing(null);
      showSuccessToast(isNewVehicle ? `${value.name} ajouté.` : `${value.name} modifié.`);
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      showErrorToast(message);
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
      showSuccessToast(`${deactivating.name} désactivé.`);
      setDeactivating(null);
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      showErrorToast(message);
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
          ...vehicleAvailabilityUpdate(vehicle),
        }),
      );
      showSuccessToast(vehicle.active ? `${vehicle.name} désactivé.` : `${vehicle.name} activé.`);
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveVehicleDimensions(vehicle: Vehicle) {
    if (!catalogue || busy) return;
    setBusy(true);
    setError('');
    try {
      setCatalogue(await new CatalogueService(api).saveVehicle(catalogue, vehicle));
      showSuccessToast(`Dimensions de ${vehicle.name} enregistrées.`);
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      showErrorToast(message);
      throw reason;
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
      showSuccessToast(
        bookingsEnabled ? 'Les réservations sont ouvertes.' : 'Les réservations sont fermées.',
      );
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      showErrorToast(message);
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
      setDrivers((values) => assignedDriversAfterVehicleAssignment(values, saved, vehicle.id));
      showSuccessToast(`${driver.name} affecté(e) à ${vehicle.name}.`);
      setDriverChoices((values) => {
        const remaining = { ...values };
        delete remaining[vehicle.id];
        return remaining;
      });
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      showErrorToast(message);
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
      setDrivers((values) => unassignedDriverUpdate(values, saved));
      showSuccessToast(`${driver.name} retiré(e) de ${vehicle.name}.`);
      setDriverChoices((values) => {
        const remaining = { ...values };
        delete remaining[vehicle.id];
        return remaining;
      });
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }

  function activity(vehicle: Vehicle): VehicleActivity {
    return vehicleActivity(bookings, vehicle, catalogue, today());
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
    saveVehicleDimensions,
    setBookingsAvailability,
    drivers,
    selectedDriverId,
    chooseDriver,
    assignDriver,
    unassignDriver,
    activity,
  };
}
