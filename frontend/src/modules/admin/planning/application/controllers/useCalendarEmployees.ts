import { useEffect, useState } from 'react';
import type { Driver } from '../../../../shared/domain/model';
import { useApp } from '../../../../shared/application/context';

export function useCalendarEmployees(): Driver[] {
  const { api } = useApp();
  const [employees, setEmployees] = useState<Driver[]>([]);

  useEffect(() => {
    let active = true;
    void api
      .drivers()
      .then((rows) => {
        if (active) setEmployees(rows);
      })
      .catch(() => {
        if (active) setEmployees([]);
      });
    return () => {
      active = false;
    };
  }, [api]);

  return employees;
}
