import { uiText } from '../../content/reference-ui-text';
import type { useAdminFleetPageModel } from '../../application/controllers/useAdminFleetPageModel';
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
            {whatsappBriefQueue.length} autre(s) conversation(s) WhatsApp à ouvrir. Ouvrez-les une
            par une pour que le téléphone puisse lancer l’application.
          </span>
          <button type="button" onClick={() => void openNextWhatsAppBrief()}>
            Ouvrir pour {whatsappBriefQueue[0]?.member.name}
          </button>
          <button type="button" onClick={cancelWhatsAppBriefs}>
            Annuler les suivants
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
