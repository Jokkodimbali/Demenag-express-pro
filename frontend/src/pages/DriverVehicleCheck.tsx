import { Navigate } from 'react-router-dom';
import { routes } from '../routing/routes';
export function DriverVehicleCheck() {
  return <Navigate to={routes.driverWorkspace} replace />;
}
