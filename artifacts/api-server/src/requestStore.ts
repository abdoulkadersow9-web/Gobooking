/* ─── In-memory real-time trip request store ──────────────────────────────
   Clients send booking requests from the live-tracking screen.
   Agents see and act on them in real time.  Ephemeral — resets on restart.
─────────────────────────────────────────────────────────────────────────── */

export type RequestStatus = "pending" | "accepted" | "rejected";

export interface TripRequest {
  id:            string;
  tripId:        string;
  clientName:    string;
  clientPhone:   string;
  seatsRequested: number;
  boardingPoint: string;
  status:        RequestStatus;
  createdAt:     number;   /* Date.now() ms */
  respondedAt?:  number;
}

/* Singleton — imported by agent.ts and trips.ts */
export const requestStore = new Map<string, TripRequest>();

let _seq = 1;
export function newRequestId() {
  return `req-${Date.now()}-${_seq++}`;
}

/* All requests for a given trip, newest first */
export function requestsForTrip(tripId: string): TripRequest[] {
  return [...requestStore.values()]
    .filter(r => r.tripId === tripId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/* Prune requests older than 2 hours */
export function pruneOldRequests() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, req] of requestStore.entries()) {
    if (req.createdAt < cutoff) requestStore.delete(id);
  }
}
