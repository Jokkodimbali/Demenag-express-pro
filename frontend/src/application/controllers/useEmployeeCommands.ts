import { useCallback } from 'react';
import { useApp } from '../context';

export function useEmployeeCommands() {
  const { api } = useApp();
  const addProofs = useCallback(
    (...args: Parameters<typeof api.addEmployeeProofs>) => api.addEmployeeProofs(...args),
    [api],
  );
  const submitInspection = useCallback(
    (...args: Parameters<typeof api.submitEmployeeInspection>) =>
      api.submitEmployeeInspection(...args),
    [api],
  );
  const driverReports = useCallback(() => api.driverReports(), [api]);
  return { addProofs, submitInspection, driverReports };
}
