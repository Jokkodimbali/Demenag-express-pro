import { Suspense, lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../../admin/shell/components/AdminLayout';
import { Layout } from '../../shared/shell/Layout';
import { messages } from '../../shared/content/fr';
import { Guard } from './Guard';
import { routes } from '../../shared/navigation/config/routes';
const Auth = lazy(() => import('../../auth/pages/Auth').then((m) => ({ default: m.Auth })));
const Home = lazy(() => import('../../public-home/pages/Home').then((m) => ({ default: m.Home })));
const Account = lazy(() =>
  import('../../account/pages/Account').then((m) => ({ default: m.Account })),
);
const Admin = lazy(() =>
  import('../../admin/dashboard/pages/Admin').then((m) => ({ default: m.Admin })),
);
const AdminCreateQuote = lazy(() =>
  import('../../admin/quotes/pages/AdminCreateQuote').then((m) => ({
    default: m.AdminCreateQuote,
  })),
);
const AdminPlanning = lazy(() =>
  import('../../admin/planning/pages/AdminPlanning').then((m) => ({ default: m.AdminPlanning })),
);
const AdminPlanFollowUp = lazy(() =>
  import('../../admin/planning/pages/AdminPlanFollowUp').then((m) => ({
    default: m.AdminPlanFollowUp,
  })),
);
const AdminFinance = lazy(() =>
  import('../../admin/finance/pages/AdminFinance').then((m) => ({ default: m.AdminFinance })),
);
const AdminAccounting = lazy(() =>
  import('../../admin/accounting/pages/AdminAccounting').then((m) => ({
    default: m.AdminAccounting,
  })),
);
const AdminFleet = lazy(() =>
  import('../../admin/fleet/pages/AdminFleet').then((m) => ({ default: m.AdminFleet })),
);
const AdminSettings = lazy(() =>
  import('../../admin/settings/pages/AdminSettings').then((m) => ({ default: m.AdminSettings })),
);
const AdminData = lazy(() =>
  import('../../admin/data/pages/AdminData').then((m) => ({ default: m.AdminData })),
);
const AdminTollPoints = lazy(() =>
  import('../../admin/tolls/pages/AdminTollPoints').then((m) => ({ default: m.AdminTollPoints })),
);
const AdminUsers = lazy(() =>
  import('../../admin/users/pages/AdminUsers').then((m) => ({ default: m.AdminUsers })),
);
const AdminClients = lazy(() =>
  import('../../admin/clients/pages/AdminClients').then((m) => ({ default: m.AdminClients })),
);
const AdminVehicleReports = lazy(() =>
  import('../../admin/vehicle-reports/pages/AdminVehicleReports').then((m) => ({
    default: m.AdminVehicleReports,
  })),
);
const AdminAnnouncements = lazy(() =>
  import('../../admin/announcements/pages/AdminAnnouncements').then((m) => ({
    default: m.AdminAnnouncements,
  })),
);
const DriverWorkspace = lazy(() =>
  import('../../driver/workspace/pages/DriverWorkspace').then((m) => ({
    default: m.DriverWorkspace,
  })),
);
const DriverVehicleCheck = lazy(() =>
  import('../../driver/vehicle-check/pages/DriverVehicleCheck').then((m) => ({
    default: m.DriverVehicleCheck,
  })),
);
const DriverProfile = lazy(() =>
  import('../../driver/profile/pages/DriverProfile').then((m) => ({ default: m.DriverProfile })),
);

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <p className="container loading" role="status">
          {messages.chargement}
        </p>
      }
    >
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path={routes.booking.slice(1)} element={<AdminCreateQuote publicRequest />} />
          <Route path={routes.login.slice(1)} element={<Auth />} />
          <Route
            path={routes.account.slice(1)}
            element={
              <Guard roles={['client', 'admin']}>
                <Account />
              </Guard>
            }
          />
          <Route
            path={routes.driverWorkspace.slice(1)}
            element={
              <Guard roles={['driver']}>
                <DriverWorkspace />
              </Guard>
            }
          />
          <Route
            path={routes.driverProfile.slice(1)}
            element={
              <Guard roles={['driver']}>
                <DriverProfile />
              </Guard>
            }
          />
          <Route
            path={routes.driverVehicleCheck.slice(1)}
            element={
              <Guard roles={['driver']}>
                <DriverVehicleCheck />
              </Guard>
            }
          />
          <Route
            path={routes.administration.slice(1)}
            element={
              <Guard admin>
                <AdminLayout />
              </Guard>
            }
          >
            <Route index element={<Admin />} />
            <Route path="creer-un-devis" element={<AdminCreateQuote />} />
            <Route path="planning" element={<AdminPlanning />} />
            <Route path="suivi-planning" element={<AdminPlanFollowUp />} />
            <Route path="finances" element={<AdminFinance />} />
            <Route path="comptabilite" element={<AdminAccounting />} />
            <Route path="flotte" element={<AdminFleet />} />
            <Route path="peages" element={<AdminTollPoints />} />
            <Route path="parametres" element={<AdminSettings />} />
            <Route path="donnees" element={<AdminData />} />
            <Route path="comptes" element={<AdminUsers />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="vehicules/rapports" element={<AdminVehicleReports />} />
            <Route path="annonces" element={<AdminAnnouncements />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="container empty-state">
                <h1>{messages.pageIntrouvable}</h1>
                <Link className="button primary" to="/">
                  {messages.retourALAccueil2}
                </Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
