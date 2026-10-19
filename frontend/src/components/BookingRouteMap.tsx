import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { mapConfiguration } from '../config/maps';
import type { Booking } from '../domain/model';
import { useApp } from '../application/context';

export function BookingRouteMap({ booking }: { booking: Booking }) {
  const { api } = useApp();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const fromKey = booking.from.join(',');
  const toKey = booking.to.join(',');

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let active = true;
    setError(false);
    const from: L.LatLngExpression = booking.from;
    const to: L.LatLngExpression = booking.to;
    const map = L.map(element, { scrollWheelZoom: false, zoomControl: true }).setView(from, 12);
    L.tileLayer(mapConfiguration.tileUrl, {
      attribution: mapConfiguration.attribution,
      maxZoom: 19,
    }).addTo(map);
    const bounds = L.latLngBounds(from, to);
    const markerIcon = (label: string, side: string) =>
      L.divIcon({
        className: 'booking-route-pin-host',
        html: `<span class="booking-route-pin ${side}"><span>${label}</span></span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
    L.marker(from, { icon: markerIcon('A', 'from'), alt: 'Adresse de retrait' }).addTo(map);
    L.marker(to, { icon: markerIcon('B', 'to'), alt: 'Adresse de dépôt' }).addTo(map);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });

    void api
      .route(booking.from, booking.to)
      .then((route) => {
        if (!active) return;
        L.polyline(route.geometry, { color: '#1a73e8', weight: 6, opacity: 0.95 }).addTo(map);
        map.fitBounds(L.latLngBounds(route.geometry), { padding: [32, 32], maxZoom: 15 });
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        L.polyline([from, to], {
          color: '#1a73e8',
          weight: 5,
          dashArray: '8 8',
          opacity: 0.9,
        }).addTo(map);
      });

    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(element);
    return () => {
      active = false;
      resize.disconnect();
      map.remove();
    };
  }, [api, fromKey, toKey]);

  return (
    <div className="booking-route-map-wrap">
      <div
        className="booking-route-map"
        ref={host}
        role="region"
        aria-label={`Carte interactive de l’itinéraire de retrait à dépôt pour la réservation ${booking.reference}`}
      />
      <div className="booking-route-map-labels">
        <span>
          <b>A</b> {booking.fromAddress}
        </span>
        <span>
          <b>B</b> {booking.toAddress}
        </span>
      </div>
      {error && (
        <small className="muted">
          Tracé routier indisponible ; aperçu direct entre les deux adresses.
        </small>
      )}
    </div>
  );
}
