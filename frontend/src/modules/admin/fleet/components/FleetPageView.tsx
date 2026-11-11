import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { uiText } from '../../../shared/content/reference-ui-text';
import type { useAdminFleetPageModel } from '../application/controllers/useAdminFleetPageModel';
import { FleetMapPanel } from './FleetMapPanel';
import { FleetPlanningPanel } from './FleetPlanningPanel';
import { FleetEmployeesPanel } from './FleetEmployeesPanel';
type Model = ReturnType<typeof useAdminFleetPageModel>;
export function FleetPageView({ model }: { model: Model }) {
  const {
    pageError,
    bookingsError,
    toast,
    setToast,
    whatsappBriefQueue,
    openNextWhatsAppBrief,
    cancelWhatsAppBriefs,
  } = model;
  return (
    <main className="admin-teams">
      <FleetMapPanel model={model} />

      {whatsappBriefQueue.length > 0 && (
        <aside className="teams-whatsapp-queue" role="status">
          <span>
            {whatsappBriefQueue.length} {visibleUiText.text176}
          </span>
          <button type="button" onClick={() => void openNextWhatsAppBrief()}>
            {visibleUiText.text177}
            {whatsappBriefQueue[0]?.member.name}
          </button>
          <button type="button" onClick={cancelWhatsAppBriefs}>
            {visibleUiText.text178}
          </button>
        </aside>
      )}

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
