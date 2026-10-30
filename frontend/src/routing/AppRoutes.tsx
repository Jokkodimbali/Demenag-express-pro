import { Suspense, lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { Layout } from '../components/Layout';
import { messages } from '../content/fr';
import { Guard } from './Guard';
import { routes } from './routes';
const Auth = lazy(() => import('../pages/Auth').then((m) => ({ default: m.Auth })));
const Home = lazy(() => import('../pages/Home').then((m) => ({ default: m.Home })));
const Account = lazy(() => import('../pages/Account').then((m) => ({ default: m.Account })));
const Admin = lazy(() => import('../pages/Admin').then((m) => ({ default: m.Admin })));
const AdminCreateQuote = lazy(() =>
  import('../pages/AdminCreateQuote').then((m) => ({ default: m.AdminCreateQuote })),
);
const AdminPlanning = lazy(() =>
  import('../pages/AdminPlanning').then((m) => ({ default: m.AdminPlanning })),
);
const AdminPlanFollowUp = lazy(() =>
  import('../pages/AdminPlanFollowUp').then((m) => ({ default: m.AdminPlanFollowUp })),
);
const AdminFinance = lazy(() =>
  import('../pages/AdminFinance').then((m) => ({ default: m.AdminFinance })),
);
const AdminAccounting = lazy(() =>
  import('../pages/AdminAccounting').then((m) => ({ default: m.AdminAccounting })),
);
const AdminFleet = lazy(() =>
  import('../pages/AdminFleet').then((m) => ({ default: m.AdminFleet })),
);
const AdminSettings = lazy(() =>
  import('../pages/AdminSettings').then((m) => ({ default: m.AdminSettings })),
);
const AdminTollPoints = lazy(() =>
  import('../pages/AdminTollPoints').then((m) => ({ default: m.AdminTollPoints })),
);
const AdminUsers = lazy(() =>
  import('../pages/AdminUsers').then((m) => ({ default: m.AdminUsers })),
);
const AdminClients = lazy(() =>
  import('../pages/AdminClients').then((m) => ({ default: m.AdminClients })),
);
const AdminVehicleReports = lazy(() =>
  import('../pages/AdminVehicleReports').then((m) => ({ default: m.AdminVehicleReports })),
);
const AdminAnnouncements = lazy(() =>
  import('../pages/AdminAnnouncements').then((m) => ({ default: m.AdminAnnouncements })),
);
const DriverWorkspace = lazy(() =>
  import('../pages/DriverWorkspace').then((m) => ({ default: m.DriverWorkspace })),
);
const DriverVehicleCheck = lazy(() =>
  import('../pages/DriverVehicleCheck').then((m) => ({ default: m.DriverVehicleCheck })),
);
const DriverProfile = lazy(() =>
  import('../pages/DriverProfile').then((m) => ({ default: m.DriverProfile })),
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
              <Guard>
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
