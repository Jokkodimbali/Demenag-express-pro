import { DriverManagement } from '../components/DriverManagement';
import { messages } from '../content/fr';
import { Fleet } from './Fleet';

export function AdminFleet() {
  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>{messages.flotteEtChauffeurs}</h2>
          <p>{messages.flotteDescription}</p>
        </div>
      </div>
      <Fleet />
      <DriverManagement />
    </div>
  );
}
