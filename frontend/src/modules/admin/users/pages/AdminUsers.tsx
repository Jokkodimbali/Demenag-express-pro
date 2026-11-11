import { messages } from '../../../shared/content/fr';
import { Users } from '../components/UsersList';

export function AdminUsers() {
  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>{messages.comptesEtAcces}</h2>
          <p>{messages.comptesDescription}</p>
        </div>
      </div>
      <Users />
    </div>
  );
}
