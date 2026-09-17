import { useCallback, useEffect, useRef, useState } from 'react';
import { distanceMeters, geoErrorMessage } from './geo';

const MIN_STEP_M = 3; // ignoruj body bližšie ako 3 m (šum GPS)
const MAX_ACCURACY_M = 60; // ignoruj príliš nepresné body

/**
 * Záznam GPS trasy: sleduje polohu, počíta čas, vzdialenosť a tempo.
 * Čas sa počas pauzy zastaví, po pokračovaní nadviaže.
 */
export function useTracker() {
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [points, setPoints] = useState([]);
  const [current, setCurrent] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(null);
  const [error, setError] = useState('');

  const watchId = useRef(null);
  const pausedRef = useRef(false);
  const segmentStart = useRef(0);
  const accumulated = useRef(0);
  const pointsRef = useRef([]);

  useEffect(() => () => stopWatch(), []);

  const stopWatch = () => {
    if (watchId.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const handlePosition = useCallback((pos) => {
    if (pausedRef.current) return;
    const p = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      acc: pos.coords.accuracy,
      t: Date.now(),
    };
    setCurrent({ ...p, speed: pos.coords.speed, heading: pos.coords.heading });

    const last = pointsRef.current[pointsRef.current.length - 1];
    if (p.acc != null && p.acc > MAX_ACCURACY_M) return;
    if (last && distanceMeters(last.lat, last.lng, p.lat, p.lng) < MIN_STEP_M) return;

    const step = last ? distanceMeters(last.lat, last.lng, p.lat, p.lng) : 0;
    pointsRef.current = [...pointsRef.current, p];
    setPoints(pointsRef.current);
    if (step) setDistance((d) => d + step);
    if (pos.coords.speed != null) setSpeed(pos.coords.speed * 3.6);
  }, []);

  const startWatch = () => {
    if (!('geolocation' in navigator)) {
      setError('Tento prehliadač nepodporuje geolokáciu.');
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => setError(geoErrorMessage(err)),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  };

  const start = useCallback(() => {
    setError('');
    pointsRef.current = [];
    accumulated.current = 0;
    segmentStart.current = Date.now();
    pausedRef.current = false;
    setPoints([]);
    setDistance(0);
    setElapsedMs(0);
    setSpeed(null);
    setPaused(false);
    setTracking(true);
    startWatch();
  }, [handlePosition]);

  const pause = useCallback(() => {
    accumulated.current += Date.now() - segmentStart.current;
    pausedRef.current = true;
    stopWatch();
    setPaused(true);
    setSpeed(null);
  }, []);

  const resume = useCallback(() => {
    segmentStart.current = Date.now();
    pausedRef.current = false;
    setPaused(false);
    startWatch();
  }, [handlePosition]);

  /** Ukončí záznam a vráti objekt trasy (neukladá ho – to robí volajúci). */
  const stop = useCallback(() => {
    accumulated.current += Date.now() - segmentStart.current;
    stopWatch();
    setTracking(false);
    setPaused(false);
    pausedRef.current = false;

    const pts = pointsRef.current;
    const totalMs = accumulated.current;
    const totalM = pts.reduce(
      (sum, p, i) => (i ? sum + distanceMeters(pts[i - 1].lat, pts[i - 1].lng, p.lat, p.lng) : 0),
      0,
    );
    const startedAt = pts[0]?.t ?? Date.now();
    pointsRef.current = [];

    if (pts.length < 2) {
      setPoints([]);
      setDistance(0);
      setElapsedMs(0);
      return null;
    }

    const track = {
      name: `Trasa ${new Date(startedAt).toLocaleString('sk-SK', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date(pts[pts.length - 1].t).toISOString(),
      duration_s: Math.round(totalMs / 1000),
      distance_m: Math.round(totalM),
      avg_speed_kmh: Number(((totalM / 1000) / (totalMs / 3_600_000)).toFixed(2)) || 0,
      points: pts,
    };

    setPoints([]);
    setDistance(0);
    setElapsedMs(0);
    setSpeed(null);
    return track;
  }, []);

  // Tikanie času počas aktívneho záznamu
  useEffect(() => {
    if (!tracking || paused) return undefined;
    const id = setInterval(() => setElapsedMs(accumulated.current + (Date.now() - segmentStart.current)), 500);
    return () => clearInterval(id);
  }, [tracking, paused]);

  return {
    tracking,
    paused,
    points,
    current,
    elapsedMs,
    distance,
    speed,
    error,
    start,
    pause,
    resume,
    stop,
    clearError: () => setError(''),
  };
}
