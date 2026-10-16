import { Suspense, lazy } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { Layout } from '../components/Layout';
import { messages } from '../content/fr';
import { Auth } from '../pages/Auth';
import { Home } from '../pages/Home';
import { Guard } from './Guard';
import { routes } from './routes';
const Account = lazy(() => import('../pages/Account').then((m) => ({ default: m.Account })));
const Admin = lazy(() => import('../pages/Admin').then((m) => ({ default: m.Admin })));
const AdminPlanning = lazy(() =>
  import('../pages/AdminPlanning').then((m) => ({ default: m.AdminPlanning })),
);
const AdminFinance = lazy(() =>
  import('../pages/AdminFinance').then((m) => ({ default: m.AdminFinance })),
);
const AdminFleet = lazy(() =>
  import('../pages/AdminFleet').then((m) => ({ default: m.AdminFleet })),
);
const AdminSettings = lazy(() =>
  import('../pages/AdminSettings').then((m) => ({ default: m.AdminSettings })),
);
const AdminPricing = lazy(() =>
  import('../pages/AdminPricing').then((m) => ({ default: m.AdminPricing })),
);
const AdminBookingRules = lazy(() =>
  import('../pages/AdminBookingRules').then((m) => ({ default: m.AdminBookingRules })),
);
const AdminInvoicing = lazy(() =>
  import('../pages/AdminInvoicing').then((m) => ({ default: m.AdminInvoicing })),
);
const AdminUsers = lazy(() =>
  import('../pages/AdminUsers').then((m) => ({ default: m.AdminUsers })),
);
const DriverWorkspace = lazy(() =>
  import('../pages/DriverWorkspace').then((m) => ({ default: m.DriverWorkspace })),
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
            path={routes.administration.slice(1)}
            element={
              <Guard admin>
                <AdminLayout />
              </Guard>
            }
          >
            <Route index element={<Admin />} />
            <Route path="reservations" element={<Admin />} />
            <Route path="planning" element={<AdminPlanning />} />
            <Route path="finances" element={<AdminFinance />} />
            <Route path="flotte" element={<AdminFleet />} />
            <Route path="parametres" element={<AdminSettings />}>
              <Route index element={<Navigate to="tarifs" replace />} />
              <Route path="tarifs" element={<AdminPricing />} />
              <Route path="reservations" element={<AdminBookingRules />} />
              <Route path="facturation" element={<AdminInvoicing />} />
            </Route>
            <Route path="comptes" element={<AdminUsers />} />
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
