import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from '../../domain/model';
import { useApp } from '../context';
import { googleTrafficDuration } from '../google-maps-traffic';

const trafficDuration = (minutes: number) => {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return hours
    ? `${hours} h${remaining ? ` ${String(remaining).padStart(2, '0')}` : ''}`
    : `${remaining} min`;
};

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
    const timeMatch = /^(\d{1,2}):(\d{2})$/u.exec(timeSlot);
    const departure =
      date && timeMatch
        ? new Date(`${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`)
        : undefined;
    const future = Boolean(departure && departure.getTime() > Date.now() + 60000);
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
  const trafficColor = !googleMapsKey
    ? '#6B737B'
    : !traffic
      ? '#AEB4BB'
      : trafficDelay > 15
        ? '#FF5A5F'
        : trafficDelay > 5
          ? '#FFD23F'
          : '#3DDC84';

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
