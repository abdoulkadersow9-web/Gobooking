/**
 * Offline queue utility for GoBooking agents
 *
 * Stores pending actions in AsyncStorage when offline and replays
 * them automatically when connectivity is restored.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef, useState } from "react";

const QUEUE_KEY = "gobooking_offline_queue";

/* ─── Queue item types ────────────────────────────────────────── */

export type OfflineItemType = "scan" | "reservation" | "colis_arrive" | "en_route_board";

export interface OfflineScan {
  type: "scan";
  payload: { reservationId: string };
  token: string;
  createdAt: number;
}

export interface OfflineReservation {
  type: "reservation";
  payload: {
    tripId: string;
    passengerName: string;
    passengerPhone: string;
    passengerCount: number;
    paymentMethod: string;
  };
  token: string;
  createdAt: number;
}

export interface OfflineColisArrive {
  type: "colis_arrive";
  payload: { colisId: string; trackingRef: string };
  token: string;
  createdAt: number;
}

export interface OfflineEnRouteBoard {
  type: "en_route_board";
  payload: { requestId: string };
  token: string;
  createdAt: number;
}

export type OfflineItem =
  | OfflineScan
  | OfflineReservation
  | OfflineColisArrive
  | OfflineEnRouteBoard;

/* ─── Read / write queue ──────────────────────────────────────── */

export async function getOfflineQueue(): Promise<OfflineItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineItem[];
  } catch {
    return [];
  }
}

export async function saveOffline(item: OfflineItem): Promise<void> {
  try {
    const queue = await getOfflineQueue();
    queue.push(item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* silently ignore storage errors */
  }
}

async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/* ─── Sync helpers ────────────────────────────────────────────── */

async function replayItem(item: OfflineItem, baseUrl: string): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${item.token}`,
  };

  try {
    let url = "";
    let body: string | undefined;

    if (item.type === "scan") {
      url = `${baseUrl}/agent/reservation/${item.payload.reservationId}/board`;
      const res = await fetch(url, { method: "POST", headers });
      return res.ok;
    }

    if (item.type === "reservation") {
      url = `${baseUrl}/reservations`;
      body = JSON.stringify(item.payload);
      const res = await fetch(url, { method: "POST", headers, body });
      return res.ok;
    }

    if (item.type === "colis_arrive") {
      url = `${baseUrl}/agent/parcels/${item.payload.colisId}/arrive`;
      const res = await fetch(url, { method: "POST", headers });
      return res.ok;
    }

    if (item.type === "en_route_board") {
      url = `${baseUrl}/agent/requests/${item.payload.requestId}/board`;
      const res = await fetch(url, { method: "POST", headers });
      return res.ok;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Replay all pending offline items.
 * Successfully synced items are removed; failed items are kept for next attempt.
 */
export async function syncOfflineQueue(baseUrl: string): Promise<{ synced: number; failed: number }> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const remaining: OfflineItem[] = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    const ok = await replayItem(item, baseUrl);
    if (ok) {
      synced++;
    } else {
      remaining.push(item);
      failed++;
    }
  }

  if (remaining.length === 0) {
    await clearOfflineQueue();
  } else {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  }

  return { synced, failed };
}

/* ─── Hook: network status + auto-sync ───────────────────────── */

export interface NetworkStatus {
  isOnline: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
}

export function useNetworkStatus(baseUrl: string): NetworkStatus {
  const [isOnline, setIsOnline]       = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing]     = useState(false);
  const syncingRef = useRef(false);

  /* Count pending items on mount and whenever state changes */
  const refreshCount = async () => {
    const q = await getOfflineQueue();
    setPendingCount(q.length);
  };

  const syncNow = async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncOfflineQueue(baseUrl);
      await refreshCount();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshCount();

    const unsub = NetInfo.addEventListener(state => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);

      if (online) {
        /* Auto-sync when connection restored */
        syncNow();
      }
    });

    return () => unsub();
  }, [baseUrl]);

  return { isOnline, pendingCount, syncNow, isSyncing };
}
