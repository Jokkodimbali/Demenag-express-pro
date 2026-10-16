import { Suspense, lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { messages } from '../content/fr';
import { Auth } from '../pages/Auth';
import { Home } from '../pages/Home';
import { Guard } from './Guard';
import { routes } from './routes';
const Account = lazy(() => import('../pages/Account').then((m) => ({ default: m.Account })));
const Admin = lazy(() => import('../pages/Admin').then((m) => ({ default: m.Admin })));
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
            path={routes.administration.slice(1)}
            element={
              <Guard admin>
                <Admin />
              </Guard>
            }
          />
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
