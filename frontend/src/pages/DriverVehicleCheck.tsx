import { ArrowLeft, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDriverWorkspace } from '../application/controllers/useDriverWorkspace';
import { DriverVehicleReports } from '../components/DriverVehicleReports';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

export function DriverVehicleCheck() {
  const { profile, loading, error } = useDriverWorkspace(false);
  return (
    <section className="container workspace-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{messages.espaceChauffeur}</p>
          <h1>Contrôle du véhicule</h1>
          <p>Effectuez les vérifications quotidiennes et signalez une panne depuis cette page.</p>
        </div>
        <Link className="button secondary small" to={routes.driverWorkspace}>
          <ArrowLeft size={16} />
          {messages.retourAuxMissions}
        </Link>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="panel loading">Chargement de votre véhicule…</p>
      ) : profile?.vehicleId ? (
        <DriverVehicleReports />
      ) : !error ? (
        <div className="empty-state panel">
          <Truck size={40} />
          <h2>{messages.aucunVehiculeAffecte}</h2>
        </div>
      ) : null}
    </section>
  );
}
