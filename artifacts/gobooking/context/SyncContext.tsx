/**
 * SyncContext — bus d'événements global entre les écrans GoBooking
 *
 * Channels :
 *  "boarding"    — un passager embarqué / annulé / modifié
 *  "ticket"      — une vente guichet confirmée (nouveau passager)
 *  "reservation" — une réservation en ligne confirmée / annulée
 *  "trip"        — statut d'un trajet changé (boarding, en_route…)
 *  "all"         — wildcard : toutes catégories
 *
 * Usage :
 *   const { triggerSync } = useSync();
 *   triggerSync("ticket");          // après vente
 *
 *   const { useOnSync } = useSync();
 *   useOnSync("ticket", () => refetch());  // dans embarquement
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type SyncChannel = "boarding" | "ticket" | "reservation" | "trip" | "all";

interface SyncEvent {
  channel: SyncChannel;
  ts: number;
}

interface SyncCtx {
  triggerSync: (channel: SyncChannel) => void;
  lastEvents: Record<SyncChannel, number>;
}

const SyncContext = createContext<SyncCtx>({
  triggerSync: () => {},
  lastEvents: { boarding: 0, ticket: 0, reservation: 0, trip: 0, all: 0 },
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [lastEvents, setLastEvents] = useState<Record<SyncChannel, number>>({
    boarding: 0, ticket: 0, reservation: 0, trip: 0, all: 0,
  });

  const triggerSync = useCallback((channel: SyncChannel) => {
    const ts = Date.now();
    setLastEvents(prev => ({ ...prev, [channel]: ts, all: ts }));
  }, []);

  return (
    <SyncContext.Provider value={{ triggerSync, lastEvents }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}

/**
 * Déclenche `callback` immédiatement quand l'un des canaux spécifiés
 * reçoit un événement. Ignore le montage initial (ts === 0).
 */
export function useOnSync(
  channels: SyncChannel | SyncChannel[],
  callback: () => void,
) {
  const { lastEvents } = useSync();
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const watched = Array.isArray(channels) ? channels : [channels];

  const prevRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let changed = false;
    for (const ch of watched) {
      const ts = lastEvents[ch] ?? 0;
      if (ts > 0 && ts !== prevRef.current[ch]) {
        prevRef.current[ch] = ts;
        changed = true;
      }
    }
    if (changed) cbRef.current();
  }, watched.map(ch => lastEvents[ch])); // eslint-disable-line react-hooks/exhaustive-deps
}
