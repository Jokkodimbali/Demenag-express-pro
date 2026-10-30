import { uiText } from '../../content/reference-ui-text';
import type { useAdminFleetPageModel } from '../../application/controllers/useAdminFleetPageModel';
import { FleetMapPanel } from './FleetMapPanel';
import { FleetPlanningPanel } from './FleetPlanningPanel';
import { FleetEmployeesPanel } from './FleetEmployeesPanel';
type Model = ReturnType<typeof useAdminFleetPageModel>;
export function FleetPageView({ model }: { model: Model }) {
  const { pageError, bookingsError, toast, setToast } = model;
  return (
    <main className="admin-teams">
      <FleetMapPanel model={model} />

      <div className="teams-columns">
        <FleetPlanningPanel model={model} />

        <FleetEmployeesPanel model={model} />
      </div>
      {(pageError || bookingsError) && (
        <p role="alert" className="teams-error-banner">
          {pageError || bookingsError}
        </p>
      )}
      {toast && (
        <button className="teams-toast" onClick={() => setToast('')}>
          {toast} {uiText['fermer2']}
        </button>
      )}
    </main>
  );
}
