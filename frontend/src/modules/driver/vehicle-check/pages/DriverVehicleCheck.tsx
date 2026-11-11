import { Navigate } from 'react-router-dom';
import { routes } from '../../../shared/navigation/config/routes';
export function DriverVehicleCheck() {
  return <Navigate to={routes.driverWorkspace} replace />;
}
