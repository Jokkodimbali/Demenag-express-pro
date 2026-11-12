import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from '../../../../shared/domain/model';
import { useApp } from '../../../../shared/application/context';
import { googleTrafficDuration } from '../../../../moving/maps/application/services/google-maps-traffic';
import {
  trafficDelayPresentation,
  trafficDeparture,
  trafficDuration,
} from '../services/quote-traffic-presentation';

export function useAdminQuoteTraffic({
  enabled,
  route,
  date,
  timeSlot,
}: {
  enabled: boolean;
  route: Route | undefined;
  date: string | null;
  timeSlot: string;
}) {
  const { api } = useApp();
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [traffic, setTraffic] = useState<{
    minutes: number;
    freeMinutes: number;
    fetchedAt: number;
    future: boolean;
  } | null>(null);
  const [trafficBusy, setTrafficBusy] = useState(false);
  const [trafficError, setTrafficError] = useState(false);
  const trafficRequest = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setGoogleMapsKey('');
      return;
    }
    let active = true;
    void api
      .googleMapsApiKey()
      .then((value) => {
        if (active) setGoogleMapsKey(value);
      })
      .catch(() => {
        if (active) setGoogleMapsKey('');
      });
    return () => {
      active = false;
    };
  }, [api, enabled]);

  const refreshTraffic = useCallback(async () => {
    if (!googleMapsKey || !route) return;
    const request = ++trafficRequest.current;
    const { departure, future } = trafficDeparture(date, timeSlot);
    setTrafficBusy(true);
    setTrafficError(false);
    try {
      const result = await googleTrafficDuration(route.from, route.to, googleMapsKey, departure);
      if (request === trafficRequest.current) {
        setTraffic(
          result
            ? {
                minutes: result.minutes,
                freeMinutes: result.freeMinutes,
                fetchedAt: result.fetchedAt,
                future,
              }
            : null,
        );
        setTrafficError(!result);
      }
    } catch {
      if (request === trafficRequest.current) {
        setTraffic(null);
        setTrafficError(true);
      }
    } finally {
      if (request === trafficRequest.current) setTrafficBusy(false);
    }
  }, [date, googleMapsKey, route, timeSlot]);

  useEffect(() => {
    if (!googleMapsKey || !route) {
      trafficRequest.current++;
      setTraffic(null);
      setTrafficBusy(false);
      setTrafficError(false);
      return;
    }
    setTraffic(null);
    void refreshTraffic();
    const interval = window.setInterval(() => void refreshTraffic(), 300000);
    return () => window.clearInterval(interval);
  }, [googleMapsKey, route, refreshTraffic]);

  const trafficDelay = traffic ? traffic.minutes - traffic.freeMinutes : 0;
  const trafficColor = trafficDelayPresentation(
    Boolean(googleMapsKey),
    trafficDelay,
    Boolean(traffic),
  ).color;

  return {
    googleMapsKey,
    traffic,
    trafficBusy,
    trafficError,
    trafficDuration,
    refreshTraffic,
    trafficDelay,
    trafficColor,
  };
}
