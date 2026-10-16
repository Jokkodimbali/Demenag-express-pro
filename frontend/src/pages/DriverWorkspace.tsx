import { RefreshCw, Truck } from 'lucide-react';
import { useDriverWorkspace } from '../application/controllers/useDriverWorkspace';
import { BookingCard } from '../components/BookingCard';
import { messages } from '../content/fr';

export function DriverWorkspace() {
  const { profile, bookings, loading, error, saving, setRetry, save } = useDriverWorkspace();
  return (
    <section className="container workspace-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{messages.espaceChauffeur}</p>
          <h1>{messages.mesMissions}</h1>
          <p>{messages.mesInformations}</p>
        </div>
        <button
          className="button secondary small"
          onClick={() => setRetry((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {messages.actualiser2}
        </button>
      </div>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {profile ? (
        <form className="panel" onSubmit={save}>
          {profile.photo ? (
            <img className="driver-profile-photo" src={profile.photo} alt={profile.name} />
          ) : null}
          <div className="field-pair">
            <div>
              <label htmlFor="driver-profile-name">{messages.nom}</label>
              <input
                id="driver-profile-name"
                name="name"
                defaultValue={profile.name}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div>
              <label htmlFor="driver-profile-phone">{messages.telephone}</label>
              <input
                id="driver-profile-phone"
                name="phone"
                defaultValue={profile.phone}
                required
                minLength={9}
                maxLength={25}
              />
            </div>
          </div>
          <label htmlFor="driver-profile-photo">{messages.photoDeProfil}</label>
          <input
            id="driver-profile-photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />
          <button className="button secondary small" disabled={saving}>
            {saving ? messages.enregistrement : messages.labelEnregistrer}
          </button>
        </form>
      ) : null}
      <div className="list-heading">
        <h2>
          {messages.mesMissions}
          <span>{bookings.length}</span>
        </h2>
      </div>
      {loading ? (
        <p className="panel loading">{messages.chargementDesReservations}</p>
      ) : bookings.length ? (
        <div className="booking-list">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onChange={() => setRetry((value) => value + 1)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state panel">
          <Truck size={40} />
          <h3>{messages.aucuneMission}</h3>
        </div>
      )}
    </section>
  );
}
