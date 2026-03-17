/* ─── In-memory real-time location store ─────────────────────────────────
   Keyed by tripId. Each entry holds the latest GPS position reported by
   the agent. This data is intentionally ephemeral — it lives only in RAM
   and resets on server restart. No DB writes for sub-10s position updates.
─────────────────────────────────────────────────────────────────────────── */

export interface BusLocation {
  tripId:      string;
  lat:         number;
  lon:         number;
  accuracy?:   number;
  speed?:      number;         /* km/h */
  heading?:    number;         /* degrees */
  updatedAt:   number;         /* Date.now() ms timestamp */
  agentId:     string;
}

/* Singleton map — imported by both agent.ts and trips.ts */
export const locationStore = new Map<string, BusLocation>();

/* Prune entries older than 5 minutes (agent stopped or disconnected) */
export function pruneStale() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [tripId, loc] of locationStore.entries()) {
    if (loc.updatedAt < cutoff) locationStore.delete(tripId);
  }
}

/* Haversine distance in kilometres between two GPS coordinates */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
