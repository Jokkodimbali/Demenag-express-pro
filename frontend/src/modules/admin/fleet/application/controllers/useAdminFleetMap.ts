import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { useAdminFleet } from './useAdminFleet';
import type { Booking, Driver, Point } from '../../../../shared/domain/model';
import { roles, teamIds, trafficTiles } from '../../../planning/application/services/team-planning';

type SelectedRoute = {
  bookingId: string;
  distanceKm: number;
  durationMinutes: number;
  geometry: Point[];
};

type MapLayers = { employees: boolean; bookings: boolean };

type Props = {
  mapElement: HTMLDivElement | null;
  mapTraffic: boolean;
  mapLayers: MapLayers;
  employees: Driver[];
  dayBookings: Booking[];
  selectedEmployee: string;
  setSelectedEmployee: Dispatch<SetStateAction<string>>;
  placingId: string;
  setPlacingId: Dispatch<SetStateAction<string>>;
  selectedRoute: SelectedRoute | null;
  fleetCommands: ReturnType<typeof useAdminFleet>;
  saveEmployee: (employee: Driver, patch: Partial<Driver>) => Promise<Driver | null>;
  setToast: Dispatch<SetStateAction<string>>;
};

export function useAdminFleetMap({
  mapElement,
  mapTraffic,
  mapLayers,
  employees,
  dayBookings,
  selectedEmployee,
  setSelectedEmployee,
  placingId,
  setPlacingId,
  selectedRoute,
  fleetCommands,
  saveEmployee,
  setToast,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const employeesRef = useRef(employees);
  const placingIdRef = useRef(placingId);
  const saveEmployeeRef = useRef(saveEmployee);
  employeesRef.current = employees;
  placingIdRef.current = placingId;
  saveEmployeeRef.current = saveEmployee;

  useEffect(() => {
    if (!mapElement || mapRef.current) return;
    const map = L.map(mapElement, { scrollWheelZoom: true }).setView([14.72, -17.35], 11);
    const tile = L.tileLayer(trafficTiles(true), {
      subdomains: '0123',
      maxZoom: 20,
      attribution: 'Données cartographiques et trafic © Google',
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    map.on('click', async (event) => {
      const selectedId = placingIdRef.current;
      if (!selectedId) return;
      const point: Point = [event.latlng.lat, event.latlng.lng];
      const target = employeesRef.current.find((employee) => employee.id === selectedId);
      setPlacingId('');
      if (!target) return;
      let address = target.address ?? '';
      if (!address.trim()) {
        try {
          address = (await fleetCommands.reverseAddress(point)).label || address;
        } catch {
          /* Keep the placed coordinates when reverse lookup is unavailable. */
        }
      }
      await saveEmployeeRef.current(target, {
        latitude: point[0],
        longitude: point[1],
        ...(address.trim() ? { address, geocodedAddress: address.trim() } : {}),
      });
      setToast(`Logement de ${target.name} enregistré sur la carte.`);
    });
    mapRef.current = map;
    tileRef.current = tile;
    layerRef.current = layer;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(mapElement);
    const resize = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(resize);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      layerRef.current = null;
    };
  }, [fleetCommands, mapElement, setPlacingId, setToast]);

  useEffect(() => {
    tileRef.current?.setUrl(trafficTiles(mapTraffic));
  }, [mapTraffic]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    const assigned = new Map<string, Booking>();
    for (const booking of dayBookings) for (const id of teamIds(booking)) assigned.set(id, booking);
    if (mapLayers.employees)
      for (const employee of employees) {
        if (employee.latitude == null || employee.longitude == null) continue;
        const job = assigned.get(employee.id);
        const role = roles.find((value) => value.id === (employee.role ?? 'chauffeur')) ?? roles[0];
        const markerLabel = document.createElement('span');
        markerLabel.className = `team-map-marker${employee.id === selectedEmployee ? ' selected' : ''}`;
        markerLabel.style.setProperty('--marker-color', role.color);
        const dot = document.createElement('span');
        dot.className = 'team-map-marker-dot';
        if (!employee.active) dot.classList.add('inactive');
        const name = document.createElement('span');
        name.className = 'team-map-marker-name';
        name.textContent = `${employee.name.split(' ')[0]}${job ? ` · ${job.reference}` : ''}`;
        markerLabel.append(dot, name);
        const marker = L.marker([employee.latitude, employee.longitude], {
          draggable: true,
          zIndexOffset: employee.id === selectedEmployee ? 1000 : 0,
          icon: L.divIcon({
            className: 'team-map-marker-shell',
            html: markerLabel.outerHTML,
            iconSize: [0, 0],
          }),
        }).addTo(layer);
        marker.on('click', () => {
          if (selectedEmployee === employee.id) setSelectedEmployee('');
          else {
            setSelectedEmployee(employee.id);
            map.setView([employee.latitude!, employee.longitude!], 15);
          }
        });
        marker.on('dragend', async () => {
          const point = marker.getLatLng();
          await saveEmployee(employee, { latitude: point.lat, longitude: point.lng });
        });
        const popup = document.createElement('div');
        popup.textContent = `${employee.name}\n${role.label}\n${employee.address ?? ''}\n${employee.phone}${job ? `\nCe jour : ${job.reference} (${job.timeSlot || 'journée'})` : ''}`;
        marker.bindPopup(popup);
        bounds.push([employee.latitude, employee.longitude]);
        if (mapLayers.bookings && job?.from) {
          const isSelectedRoute =
            employee.id === selectedEmployee && selectedRoute?.bookingId === job.id;
          if (isSelectedRoute && selectedRoute.geometry.length > 1) {
            L.polyline(selectedRoute.geometry, {
              color: '#1E2023',
              weight: 8,
              opacity: 0.55,
            }).addTo(layer);
            L.polyline(selectedRoute.geometry, {
              color: role.color,
              weight: 5,
              opacity: 0.95,
            }).addTo(layer);
          } else {
            L.polyline([[employee.latitude, employee.longitude], job.from], {
              color: role.color,
              weight: 2,
              opacity: 0.65,
              dashArray: '5 6',
            }).addTo(layer);
          }
        }
      }
    if (mapLayers.bookings)
      for (const booking of dayBookings) {
        for (const [point, label, color, address] of [
          [booking.from, 'A', '#2ECC71', booking.fromAddress],
          [booking.to, 'B', '#FF6B6B', booking.toAddress],
        ] as [Point, string, string, string][]) {
          if (!point) continue;
          const markerLabel = document.createElement('span');
          markerLabel.className = 'team-map-job-marker';
          markerLabel.style.setProperty('--job-marker-color', color);
          markerLabel.textContent = `${label} · ${booking.reference}`;
          const stem = document.createElement('span');
          stem.className = 'team-map-job-marker-stem';
          const popup = document.createElement('div');
          popup.textContent = `${booking.reference} · ${booking.customerName || ''}\n${label === 'A' ? 'Départ' : 'Arrivée'} : ${address || ''}`;
          L.marker(point, {
            icon: L.divIcon({
              className: 'team-map-marker-shell',
              html: `${markerLabel.outerHTML}${stem.outerHTML}`,
              iconSize: [0, 0],
            }),
          })
            .addTo(layer)
            .bindPopup(popup);
          bounds.push(point);
        }
      }
    if (!fittedRef.current && bounds.length) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [35, 35], maxZoom: 14 });
      fittedRef.current = true;
    }
  }, [
    employees,
    dayBookings,
    mapLayers,
    saveEmployee,
    selectedEmployee,
    selectedRoute,
    setSelectedEmployee,
  ]);

  return { mapRef };
}
