/**
 * Module 6 — Alertes temps réel
 * Polling toutes les 30 secondes vers GET /agent/realtime/alerts
 *
 * Retourne :
 *   - preDepartureAlerts : départs imminents (≤10 min) concernant l'agent
 *   - validationAlerts   : notifications type validation_complete non vues
 *   - agentRole          : rôle de l'agent courant
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_URL } from "@/utils/api";

const POLL_MS = 30_000; // 30 secondes

export interface PreDepartureAlert {
  id: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  status: string;
  minutesLeft: number;
}

export interface RealtimeNotif {
  id: string;
  type: string;
  title: string;
  message: string;
  refId: string | null;
  createdAt: string;
}

export interface RealtimeState {
  preDepartureAlerts: PreDepartureAlert[];
  validationAlerts:   RealtimeNotif[];
  agentRole:          string | null;
  lastUpdated:        number | null;
  loading:            boolean;
}

export function useRealtime(token: string | null | undefined): RealtimeState {
  const [state, setState] = useState<RealtimeState>({
    preDepartureAlerts: [],
    validationAlerts:   [],
    agentRole:          null,
    lastUpdated:        null,
    loading:            false,
  });

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const poll = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      setState(s => ({ ...s, loading: true }));
      const res = await fetch(`${BASE_URL}/agent/realtime/alerts`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setState({
        preDepartureAlerts: Array.isArray(data.preDepartureAlerts) ? data.preDepartureAlerts : [],
        validationAlerts:   Array.isArray(data.recentNotifs)
          ? data.recentNotifs.filter((n: RealtimeNotif) => n.type === "validation_complete")
          : [],
        agentRole:  data.agentRole ?? null,
        lastUpdated: Date.now(),
        loading:     false,
      });
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [token, poll]);

  return state;
}

/**
 * Polling léger pour les données live d'un trajet (impresssion tab).
 * Retourne boardedCount, bagageCount, colisCount, expenseCount, status.
 */
export interface TripLiveStats {
  boardedCount:  number;
  absentCount:   number;
  bagageCount:   number;
  colisCount:    number;
  expenseCount:  number;
  totalExpenses: number;
  status:        string;
  updatedAt:     string | null;
}

export function useTripLive(
  tripId: string | null | undefined,
  token: string | null | undefined,
  enabled = true,
): TripLiveStats {
  const [stats, setStats] = useState<TripLiveStats>({
    boardedCount: 0, absentCount: 0, bagageCount: 0,
    colisCount: 0, expenseCount: 0, totalExpenses: 0,
    status: "scheduled", updatedAt: null,
  });

  const tripRef  = useRef(tripId);
  const tokenRef = useRef(token);
  tripRef.current  = tripId;
  tokenRef.current = token;

  const fetch_ = useCallback(async () => {
    if (!tripRef.current || !tokenRef.current) return;
    try {
      const res = await fetch(`${BASE_URL}/agent/realtime/trip/${tripRef.current}`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (!tripId || !token || !enabled) return;
    fetch_();
    const id = setInterval(fetch_, POLL_MS);
    return () => clearInterval(id);
  }, [tripId, token, enabled, fetch_]);

  return stats;
}
