import type { Point, Route } from '../../../../shared/domain/model';
import { googleTrafficMapsReady } from './google-maps-traffic';

export type ReferenceRouteAlternative = Route & { via: string };

type GoogleDirectionsResult = {
  routes?: Array<{
    overview_path: Array<{ lat(): number; lng(): number }>;
    summary?: string;
    legs: Array<{
      distance: { value: number };
      duration: { value: number };
      duration_in_traffic?: { value: number };
    }>;
  }>;
};

type GoogleDirectionsService = {
  route(request: Record<string, unknown>): Promise<GoogleDirectionsResult>;
};

type GoogleRoutingMaps = {
  DirectionsService: new () => GoogleDirectionsService;
  TravelMode?: { DRIVING: string };
};

export async function referenceRouteAlternatives(
  from: Point,
  to: Point,
  key: string,
): Promise<ReferenceRouteAlternative[]> {
  if (await googleTrafficMapsReady(key)) {
    try {
      const maps = window.google?.maps as unknown as GoogleRoutingMaps | undefined;
      if (maps?.DirectionsService) {
        const result = await new maps.DirectionsService().route({
          origin: { lat: from[0], lng: from[1] },
          destination: { lat: to[0], lng: to[1] },
          travelMode: maps.TravelMode?.DRIVING ?? 'DRIVING',
          provideRouteAlternatives: true,
          drivingOptions: { departureTime: new Date(Date.now() + 60000), trafficModel: 'bestguess' },
          language: 'fr',
          region: 'SN',
        });
        const alternatives = (result.routes ?? []).flatMap((route) => {
          const leg = route.legs[0];
          if (!leg) return [];
          return [{
            from,
            to,
            geometry: route.overview_path.map((point): Point => [point.lat(), point.lng()]),
            distanceKm: Math.round(leg.distance.value / 100) / 10,
            durationMinutes: Math.round((leg.duration_in_traffic ?? leg.duration).value / 60),
            via: route.summary ?? '',
          }];
        });
        if (alternatives.length) return alternatives;
      }
    } catch {
      // The reference falls back to OSRM if Google routing is unavailable.
    }
  }

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&alternatives=3&steps=true`,
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { coordinates: number[][] };
        legs: Array<{ steps?: Array<{ name?: string; distance: number }> }>;
      }>;
    };
    return (data.routes ?? []).map((route) => {
      const names: Record<string, number> = {};
      for (const step of route.legs[0]?.steps ?? []) {
        if (step.name && step.distance > 300) names[step.name] = (names[step.name] ?? 0) + step.distance;
      }
      return {
        from,
        to,
        geometry: route.geometry.coordinates.map(([lng, lat]): Point => [lat, lng]),
        distanceKm: Math.round(route.distance / 100) / 10,
        durationMinutes: Math.round(route.duration / 60),
        via: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name]) => name).join(', '),
      };
    });
  } catch {
    return [];
  }
}
