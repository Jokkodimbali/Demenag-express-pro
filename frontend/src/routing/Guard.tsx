import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from './routes';
import { useApp } from '../application/context';
import { messages } from '../content/fr';
import type { Role } from '../domain/model';
const roleHome = (role: Role) => (role === 'driver' ? routes.driverWorkspace : routes.account);
export function Guard({
  children,
  admin = false,
  roles,
}: {
  children: ReactNode;
  admin?: boolean;
  roles?: Role[];
}) {
  const { user, authLoading, error, reload } = useApp();
  if (authLoading) return <p className="container loading">{messages.chargementDuCompte}</p>;
  if (error && !user)
    return (
      <div className="container alert error">
        <p>{error}</p>
        <button className="button secondary" onClick={reload}>
          {messages.reessayer}
        </button>
      </div>
    );
  if (!user || user.active === false) return <Navigate to={routes.login} replace />;
  if (admin && user.role !== 'admin') return <Navigate to={roleHome(user.role)} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}
