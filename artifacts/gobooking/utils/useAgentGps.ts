import { useEffect, useRef, useState, useCallback } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { apiFetch } from "./api";

export interface AgentGpsStatus {
  active: boolean;
  error: string | null;
  lat: number | null;
  lon: number | null;
  speed: number | null;
  accuracy: number | null;
  lastUpdate: number | null;
}

const IDLE: AgentGpsStatus = {
  active: false, error: null, lat: null,
  lon: null, speed: null, accuracy: null, lastUpdate: null,
};

export function useAgentGps(
  tripId: string | null,
  token: string | null | undefined,
): AgentGpsStatus {
  const [status, setStatus] = useState<AgentGpsStatus>(IDLE);

  const watcherRef  = useRef<Location.LocationSubscription | null>(null);
  const pushingRef  = useRef(false);
  const tripIdRef   = useRef<string | null>(null);
  const tokenRef    = useRef<string | null | undefined>(null);

  tripIdRef.current = tripId;
  tokenRef.current  = token;

  const pushPosition = useCallback(async (loc: Location.LocationObject) => {
    if (pushingRef.current) return;
    const tid = tripIdRef.current;
    const tok = tokenRef.current;
    if (!tid || !tok) return;
    pushingRef.current = true;
    try {
      const { latitude: lat, longitude: lon, accuracy, speed } = loc.coords;
      await apiFetch(`/agent/trip/${tid}/location`, {
        method: "POST",
        token: tok,
        body: JSON.stringify({ lat, lon, accuracy: accuracy ?? null, speed: speed ?? null }),
      });
    } catch {
    } finally {
      pushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!tripId || Platform.OS === "web") {
      watcherRef.current?.remove();
      watcherRef.current = null;
      setStatus(IDLE);
      return;
    }

    let cancelled = false;

    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") {
        if (!cancelled) setStatus({ ...IDLE, error: "Permission GPS refusée" });
        return;
      }

      if (cancelled) return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.High,
          timeInterval:     5000,
          distanceInterval: 10,
        },
        (loc) => {
          const { latitude, longitude, accuracy, speed } = loc.coords;
          setStatus({
            active:     true,
            error:      null,
            lat:        latitude,
            lon:        longitude,
            speed:      speed      ?? null,
            accuracy:   accuracy   ?? null,
            lastUpdate: Date.now(),
          });
          pushPosition(loc);
        },
      );

      if (cancelled) {
        sub.remove();
      } else {
        watcherRef.current = sub;
      }
    })();

    return () => {
      cancelled = true;
      watcherRef.current?.remove();
      watcherRef.current = null;
      setStatus(IDLE);
    };
  }, [tripId, pushPosition]);

  return status;
}
