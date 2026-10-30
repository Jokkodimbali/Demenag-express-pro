import { uiText } from '../content/reference-ui-text';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Pencil, Save, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mapConfiguration } from '../config/maps';
import type { Booking, Point, TollPoint } from '../domain/model';
import { useApp } from '../application/context';
import { useBookingCommands } from '../application/controllers/useBookingCommands';
import { errorMessage } from '../application/error-message';
import { addRouteLine } from './maps/route-line';
import { addTollMarkers } from './maps/toll-markers';
import { tollsOnRoute } from '../domain/tolls-on-route';

export function BookingRouteMap({
  booking,
  admin = false,
  onChange,
}: {
  booking: Booking;
  admin?: boolean;
  onChange?: (booking: Booking) => void;
}) {
  const { tollPoints } = useApp();
  const commands = useBookingCommands();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<'from' | 'to'>('from');
  const [busy, setBusy] = useState(false);
  const [routeTolls, setRouteTolls] = useState<TollPoint[]>([]);
  const [draftFrom, setDraftFrom] = useState<Point>(booking.from);
  const [draftTo, setDraftTo] = useState<Point>(booking.to);
  const [draftFromAddress, setDraftFromAddress] = useState(booking.fromAddress);
  const [draftToAddress, setDraftToAddress] = useState(booking.toAddress);
  const from = editing ? draftFrom : booking.from;
  const to = editing ? draftTo : booking.to;
  const fromKey = from.join(',');
  const toKey = to.join(',');

  const changePoint = useCallback(
    (side: 'from' | 'to', point: Point) => {
      if (side === 'from') setDraftFrom(point);
      else setDraftTo(point);
      setError('');
      void commands
        .reverseAddress(point)
        .then(({ label }) => {
          if (side === 'from') setDraftFromAddress(label);
          else setDraftToAddress(label);
        })
        .catch(() => {
          const label = `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`;
          if (side === 'from') setDraftFromAddress(label);
          else setDraftToAddress(label);
        });
    },
    [commands],
  );

  async function saveRoute() {
    if (!onChange || busy) return;
    setBusy(true);
    setError('');
    try {
      onChange(await commands.updateRoute(booking.id, draftFrom, draftTo, booking.version));
      setEditing(false);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let active = true;
    setError('');
    setRouteTolls([]);
    const start: L.LatLngExpression = from;
    const end: L.LatLngExpression = to;
    const map = L.map(element, {
      scrollWheelZoom: true,
      zoomControl: true,
      minZoom: 9,
      maxBounds: [
        [12, -18.2],
        [16.8, -11.2],
      ],
    }).setView(start, 12);
    L.tileLayer(mapConfiguration.tileUrl, mapConfiguration.tileOptions).addTo(map);
    let tollLayer = addTollMarkers(map, tollPoints);
    const markerIcon = (label: string, side: string) =>
      L.divIcon({
        className: 'booking-route-pin-host',
        html: `<span class="booking-route-pin ${side}"><span>${label}</span></span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
    const addMarker = (point: Point, label: string, side: 'from' | 'to') => {
      const marker = L.marker(point, {
        icon: markerIcon(label, side),
        alt: side === 'from' ? 'Adresse de retrait' : 'Adresse de dépôt',
        draggable: admin && editing,
      }).addTo(map);
      if (admin && editing) {
        marker.on('dragend', () => {
          const p = marker.getLatLng();
          changePoint(side, [p.lat, p.lng]);
        });
      }
    };
    addMarker(from, 'A', 'from');
    addMarker(to, 'B', 'to');
    map.fitBounds(L.latLngBounds(start, end), { padding: [50, 50], maxZoom: 13 });
    if (admin && editing) {
      map.getContainer().classList.add('booking-route-map-editing');
      map.on('click', (event) => changePoint(selected, [event.latlng.lat, event.latlng.lng]));
    }

    void commands
      .routeTicket(from, to)
      .then((route) => {
        if (!active) return;
        addRouteLine(map, route.geometry);
        const matches = tollsOnRoute(route.geometry, tollPoints);
        setRouteTolls(matches);
        tollLayer.remove();
        tollLayer = addTollMarkers(
          map,
          tollPoints,
          undefined,
          undefined,
          undefined,
          new Set(matches.map((point) => point.id)),
        );
        map.fitBounds(L.latLngBounds(route.geometry), { padding: [50, 50], maxZoom: 15 });
      })
      .catch(() => {
        if (!active) return;
        setRouteTolls([]);
        addRouteLine(map, [from, to], true);
      });

    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(element);
    return () => {
      active = false;
      resize.disconnect();
      map.remove();
    };
  }, [admin, changePoint, commands, editing, from, fromKey, selected, to, toKey, tollPoints]);

  useEffect(() => {
    if (!editing) {
      setDraftFrom(booking.from);
      setDraftTo(booking.to);
      setDraftFromAddress(booking.fromAddress);
      setDraftToAddress(booking.toAddress);
    }
  }, [booking.from, booking.fromAddress, booking.to, booking.toAddress, editing]);

  return (
    <div className="booking-route-map-wrap">
      {admin && (
        <div className="booking-route-map-toolbar">
          {editing ? (
            <>
              <span>{uiText['choisissezLePointADeplacer']}</span>
              <button
                className={`button small ${selected === 'from' ? 'primary' : 'secondary'}`}
                type="button"
                aria-pressed={selected === 'from'}
                onClick={() => setSelected('from')}
              >
                <MapPin size={15} /> {uiText['depart']}
              </button>
              <button
                className={`button small ${selected === 'to' ? 'primary' : 'secondary'}`}
                type="button"
                aria-pressed={selected === 'to'}
                onClick={() => setSelected('to')}
              >
                <MapPin size={15} /> {uiText['arrivee']}
              </button>
              <button
                className="button primary small"
                type="button"
                disabled={busy}
                onClick={() => void saveRoute()}
              >
                <Save size={15} /> {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                className="button secondary small"
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setError('');
                }}
              >
                <X size={15} /> {uiText['annuler2']}
              </button>
            </>
          ) : (
            <button
              className="button secondary small"
              type="button"
              onClick={() => {
                setDraftFrom(booking.from);
                setDraftTo(booking.to);
                setDraftFromAddress(booking.fromAddress);
                setDraftToAddress(booking.toAddress);
                setSelected('from');
                setEditing(true);
              }}
            >
              <Pencil size={15} /> {uiText['modifierLesLieuxSurLaCarte']}
            </button>
          )}
        </div>
      )}
      <div
        className="booking-route-map"
        ref={host}
        role="region"
        aria-label={`Carte interactive de l’itinéraire de retrait à dépôt pour la réservation ${booking.reference}`}
      />
      {editing && (
        <small className="muted">
          {uiText['cliquezSurLaCarteOuFaitesGlisserUnReperePourLeDeplacer']}
        </small>
      )}
      <div className="booking-route-map-labels">
        <span>
          <b>{uiText['a2']}</b> {editing ? draftFromAddress : booking.fromAddress}
        </span>
        <span>
          <b>{uiText['b']}</b> {editing ? draftToAddress : booking.toAddress}
        </span>
      </div>
      {routeTolls.length > 0 && (
        <div className="route-tolls" role="status">
          <strong>{uiText['peagesReperesSurCetItineraire']}</strong>
          <ul>
            {routeTolls.map((point) => (
              <li key={point.id}>{point.name}</li>
            ))}
          </ul>
          <p>{uiText['reperageIndicatifLEquipeConfirmeLesPeagesReellementEmp']}</p>
        </div>
      )}
      {error && <small className="booking-route-map-error">{error}</small>}
    </div>
  );
}
