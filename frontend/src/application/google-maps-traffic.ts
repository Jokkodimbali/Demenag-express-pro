import type { Point } from '../domain/model';

const storageKey = 'demenag-express-google-maps-key';
type GoogleTrafficResponse = {
  rows?: {
    elements?: {
      status: string;
      distance?: { value: number };
      duration?: { value: number };
      duration_in_traffic?: { value: number };
    }[];
  }[];
};
type GoogleMapsSdk = {
  maps: {
    LatLng: new (lat: number, lng: number) => unknown;
    DistanceMatrixService: new () => {
      getDistanceMatrix: (
        request: Record<string, unknown>,
        callback: (response: GoogleTrafficResponse, status: string) => void,
      ) => void;
    };
  };
};
declare global {
  interface Window {
    google?: GoogleMapsSdk;
    __demenagGoogleMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

let sdkPromise: Promise<boolean> | null = null;

export function readGoogleMapsKey() {
  try {
    return window.localStorage.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
}

export function saveGoogleMapsKey(value: string) {
  try {
    if (value.trim()) window.localStorage.setItem(storageKey, value.trim());
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Local storage may be disabled; live traffic remains optional.
  }
}

async function ensureGoogleMaps(key: string): Promise<boolean> {
  if (window.google?.maps?.DistanceMatrixService) return true;
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve) => {
      const callbackName = '__demenagGoogleMapsReady';
      const timeout = window.setTimeout(() => resolve(false), 15000);
      window[callbackName] = () => {
        window.clearTimeout(timeout);
        resolve(Boolean(window.google?.maps?.DistanceMatrixService));
      };
      window.gm_authFailure = () => {
        window.clearTimeout(timeout);
        resolve(false);
      };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callbackName}&language=fr&region=SN`;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

export async function googleTrafficDuration(
  from: Point,
  to: Point,
  key: string,
  departureTime?: Date,
): Promise<{ minutes: number; freeMinutes: number; distanceKm: number; fetchedAt: number } | null> {
  if (!key.trim() || !(await ensureGoogleMaps(key.trim()))) return null;
  const maps = window.google?.maps;
  if (!maps) return null;
  const departure = departureTime && departureTime.getTime() > Date.now() ? departureTime : new Date();
  return new Promise((resolve) => {
    new maps.DistanceMatrixService().getDistanceMatrix(
      {
        origins: [new maps.LatLng(from[0], from[1])],
        destinations: [new maps.LatLng(to[0], to[1])],
        travelMode: 'DRIVING',
        drivingOptions: { departureTime: departure, trafficModel: 'bestguess' },
      },
      (response, status) => {
        const element = response.rows?.[0]?.elements?.[0];
        if (status !== 'OK' || element?.status !== 'OK' || !element.duration) {
          resolve(null);
          return;
        }
        resolve({
          minutes: Math.round((element.duration_in_traffic ?? element.duration).value / 60),
          freeMinutes: Math.round(element.duration.value / 60),
          distanceKm: Math.round((element.distance?.value ?? 0) / 100) / 10,
          fetchedAt: Date.now(),
        });
      },
    );
  });
}
