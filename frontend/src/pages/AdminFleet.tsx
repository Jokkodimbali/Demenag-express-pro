import '../styles/admin-teams.css';
import { useAdminFleetPageModel } from '../application/controllers/useAdminFleetPageModel';
import { FleetPageView } from '../components/fleet/FleetPageView';
export function AdminFleet() {
  const model = useAdminFleetPageModel();
  return <FleetPageView model={model} />;
}
