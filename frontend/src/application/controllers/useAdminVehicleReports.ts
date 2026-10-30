import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Booking, Driver } from '../../domain/model';
import type { VehicleReports } from '../ports';
import { errorMessage } from '../error-message';
import { useApp } from '../context';

export type AdminEmployeeProof = NonNullable<Booking['employeeProofs']>[number] & {
  bookingId: string;
  mission: string;
  missionOption: string;
  employeeName: string;
  vehicleId: string;
  vehicleName: string;
};

export function useAdminVehicleReports() {
  const { api } = useApp();
  const [reports, setReports] = useState<VehicleReports>({ inspections: [], breakdowns: [] });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofsLoading, setProofsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const bookingWrites = useRef(new Map<string, Promise<Booking>>());

  useEffect(() => {
    const refreshOnReport = (event: Event) => {
      const notification = (event as CustomEvent<{ title?: string }>).detail;
      if (
        notification?.title === 'Contrôle véhicule reçu' ||
        notification?.title === 'Panne signalée'
      )
        setRetry((value) => value + 1);
    };
    window.addEventListener('demenag:notification', refreshOnReport);
    return () => window.removeEventListener('demenag:notification', refreshOnReport);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setProofsLoading(true);
    void api
      .adminVehicleReports()
      .then((nextReports) => {
        if (active) setReports(nextReports);
      })
      .catch((reason: unknown) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    void Promise.all([api.bookings(), api.drivers()])
      .then(([nextBookings, nextDrivers]) => {
        if (!active) return;
        setBookings(nextBookings);
        setDrivers(nextDrivers);
      })
      .catch((reason: unknown) => active && setError(errorMessage(reason)))
      .finally(() => active && setProofsLoading(false));
    return () => {
      active = false;
    };
  }, [api, retry]);

  const proofs = useMemo(() => {
    const staff = new Map(drivers.map((driver) => [driver.id, driver.name]));
    return bookings.flatMap((booking) =>
      (booking.employeeProofs ?? [])
        .filter((proof) => proof.image)
        .map((proof) => ({
          ...proof,
          bookingId: booking.id,
          mission: `${booking.reference} · ${(booking.customerName || '').split(' ')[0]}`,
          missionOption: `${booking.reference} · ${booking.customerName || ''}`,
          employeeName: staff.get(proof.employeeId) ?? '-',
          vehicleId: booking.vehicle.id,
          vehicleName: booking.vehicle.shortName || booking.vehicle.name,
        })),
    );
  }, [bookings, drivers]);

  const updateProof = useCallback(
    async (
      bookingId: string,
      proofId: string,
      patch: { kind?: 'retrait' | 'depot'; image?: string; note?: string },
    ) => {
      const previous = bookingWrites.current.get(bookingId) ?? Promise.resolve(null);
      const operation = previous
        .catch(() => null)
        .then(() => api.updateEmployeeProof(bookingId, proofId, patch));
      bookingWrites.current.set(bookingId, operation);
      try {
        const updated = await operation;
        setBookings((current) =>
          current.map((booking) => (booking.id === updated.id ? updated : booking)),
        );
        setError('');
      } catch (reason) {
        setError(errorMessage(reason));
        throw reason;
      } finally {
        if (bookingWrites.current.get(bookingId) === operation)
          bookingWrites.current.delete(bookingId);
      }
    },
    [api],
  );

  const deleteProof = useCallback(
    async (bookingId: string, proofId: string) => {
      const previous = bookingWrites.current.get(bookingId) ?? Promise.resolve(null);
      const operation = previous
        .catch(() => null)
        .then(() => api.deleteEmployeeProof(bookingId, proofId));
      bookingWrites.current.set(bookingId, operation);
      try {
        const updated = await operation;
        setBookings((current) =>
          current.map((booking) => (booking.id === updated.id ? updated : booking)),
        );
        setError('');
      } catch (reason) {
        setError(errorMessage(reason));
        throw reason;
      } finally {
        if (bookingWrites.current.get(bookingId) === operation)
          bookingWrites.current.delete(bookingId);
      }
    },
    [api],
  );

  const updateInspectionLevel = useCallback(
    async (
      id: string,
      key: 'engineOil' | 'brakeFluid' | 'coolant' | 'washerFluid' | 'fuel',
      good: boolean,
    ) => {
      try {
        const updated = await api.updateInspectionLevel(id, key, good);
        setReports((current) => ({
          ...current,
          inspections: current.inspections.map((inspection) =>
            inspection.id === updated.id ? updated : inspection,
          ),
        }));
        setError('');
      } catch (reason) {
        setError(errorMessage(reason));
      }
    },
    [api],
  );

  const deleteInspection = useCallback(
    async (id: string) => {
      try {
        await api.deleteInspection(id);
        setReports((current) => ({
          ...current,
          inspections: current.inspections.filter((inspection) => inspection.id !== id),
        }));
        setError('');
      } catch (reason) {
        setError(errorMessage(reason));
      }
    },
    [api],
  );

  return {
    reports,
    proofs,
    loading,
    proofsLoading,
    error,
    updateProof,
    deleteProof,
    updateInspectionLevel,
    deleteInspection,
  };
}
