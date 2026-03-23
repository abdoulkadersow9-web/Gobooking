/**
 * Offline queue utility — GoBooking agents
 *
 * - Each item has a unique `id` and a `synced` flag
 * - Synced items are kept for history (max 100 items, auto-trimmed)
 * - Duplicate scan codes are blocked via a persistent scanned-set
 * - Sync continues on individual failures (partial sync safe)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef, useState } from "react";

const QUEUE_KEY   = "gobooking_offline_queue";
const SCANNED_KEY = "gobooking_scanned_codes";
const MAX_HISTORY = 100;

/* ─── Types ────────────────────────────────────────────────────── */

export type OfflineItemType = "scan" | "reservation" | "colis_arrive" | "en_route_board";

interface OfflineBase {
  id: string;
  synced: boolean;
  syncedAt?: number;
  createdAt: number;
  token: string;
}

export interface OfflineScan extends OfflineBase {
  type: "scan";
  payload: { reservationId: string };
}

export interface OfflineReservation extends OfflineBase {
  type: "reservation";
  payload: {
    tripId: string;
    passengerName: string;
    passengerPhone: string;
    passengerCount: number;
    paymentMethod: string;
  };
}

export interface OfflineColisArrive extends OfflineBase {
  type: "colis_arrive";
  payload: { colisId: string; trackingRef: string };
}

export interface OfflineEnRouteBoard extends OfflineBase {
  type: "en_route_board";
  payload: { requestId: string };
}

export type OfflineItem =
  | OfflineScan
  | OfflineReservation
  | OfflineColisArrive
  | OfflineEnRouteBoard;

/* ─── ID generator ─────────────────────────────────────────────── */

export function generateOfflineId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ─── Queue read / write ────────────────────────────────────────── */

export async function getOfflineQueue(): Promise<OfflineItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineItem[];
  } catch {
    return [];
  }
}

async function persistQueue(items: OfflineItem[]): Promise<void> {
  /* Keep at most MAX_HISTORY items; prefer dropping old synced ones first */
  let trimmed = items;
  if (items.length > MAX_HISTORY) {
    const synced   = items.filter(i => i.synced);
    const pending  = items.filter(i => !i.synced);
    trimmed = [...pending, ...synced].slice(-MAX_HISTORY);
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
}

/**
 * Add a new offline item to the queue.
 * If an item with the same `id` already exists it is ignored (idempotent).
 */
export async function saveOffline(item: Omit<OfflineItem, "id" | "synced" | "syncedAt"> & { id?: string }): Promise<string> {
  try {
    const id = item.id ?? generateOfflineId();
    const queue = await getOfflineQueue();
    if (queue.some(q => q.id === id)) return id; /* idempotent — no duplicate */
    const full = { ...item, id, synced: false } as OfflineItem;
    await persistQueue([...queue, full]);
    return id;
  } catch {
    return item.id ?? "";
  }
}

/** Return the full history (pending + synced). */
export async function getHistory(): Promise<OfflineItem[]> {
  return getOfflineQueue();
}

/** Remove all synced items from history. */
export async function clearSyncedHistory(): Promise<void> {
  try {
    const queue = await getOfflineQueue();
    await persistQueue(queue.filter(i => !i.synced));
  } catch {
    /* ignore */
  }
}

/** Count only pending (unsynced) items. */
export async function getPendingCount(): Promise<number> {
  const queue = await getOfflineQueue();
  return queue.filter(i => !i.synced).length;
}

/* ─── Duplicate scan protection ─────────────────────────────────── */

async function getScannedSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SCANNED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveScannedSet(set: Set<string>): Promise<void> {
  await AsyncStorage.setItem(SCANNED_KEY, JSON.stringify([...set]));
}

/** Returns true if the code was already scanned (and this scan is a duplicate). */
export async function isAlreadyScanned(code: string): Promise<boolean> {
  const set = await getScannedSet();
  return set.has(code);
}

/** Mark a QR/barcode as scanned to prevent duplicate processing. */
export async function markAsScanned(code: string): Promise<void> {
  const set = await getScannedSet();
  set.add(code);
  await saveScannedSet(set);
}

/** Clear the scanned-codes memory (e.g. when a new shift starts). */
export async function clearScannedCodes(): Promise<void> {
  await AsyncStorage.removeItem(SCANNED_KEY);
}

/* ─── Timeout fetch helper ──────────────────────────────────────── */

const SYNC_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

/* ─── Sync ──────────────────────────────────────────────────────── */

async function replayItem(item: OfflineItem, baseUrl: string): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${item.token}`,
  };

  try {
    if (item.type === "scan") {
      const res = await fetchWithTimeout(
        `${baseUrl}/agent/reservation/${item.payload.reservationId}/board`,
        { method: "POST", headers }
      );
      return res.ok;
    }
    if (item.type === "reservation") {
      const res = await fetchWithTimeout(
        `${baseUrl}/reservations`,
        { method: "POST", headers, body: JSON.stringify(item.payload) }
      );
      return res.ok;
    }
    if (item.type === "colis_arrive") {
      const res = await fetchWithTimeout(
        `${baseUrl}/agent/parcels/${item.payload.colisId}/arrive`,
        { method: "POST", headers }
      );
      return res.ok;
    }
    if (item.type === "en_route_board") {
      const res = await fetchWithTimeout(
        `${baseUrl}/agent/requests/${item.payload.requestId}/board`,
        { method: "POST", headers }
      );
      return res.ok;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Replay all pending offline items.
 *
 * - Each item is tried independently (partial sync safe — one failure won't block others)
 * - Successful items are marked `synced: true` and kept in history
 * - Failed items remain `synced: false` for the next attempt
 */
export async function syncOfflineQueue(baseUrl: string): Promise<{ synced: number; failed: number }> {
  const queue = await getOfflineQueue();
  const pending = queue.filter(i => !i.synced);
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  const now = Date.now();
  const updated = [...queue];

  for (const item of pending) {
    const ok = await replayItem(item, baseUrl);
    const idx = updated.findIndex(q => q.id === item.id);
    if (ok) {
      synced++;
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], synced: true, syncedAt: now };
      }
    } else {
      failed++;
      /* keep item as-is for next retry */
    }
  }

  await persistQueue(updated);
  return { synced, failed };
}

/* ─── Hook: network status + auto-sync ──────────────────────────── */

export interface NetworkStatus {
  isOnline: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
  lastSyncResult: { synced: number; failed: number } | null;
}

export function useNetworkStatus(baseUrl: string): NetworkStatus {
  const [isOnline, setIsOnline]             = useState(true);
  const [pendingCount, setPendingCount]     = useState(0);
  const [isSyncing, setIsSyncing]           = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null);
  const syncingRef = useRef(false);

  const refreshCount = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

  const syncNow = async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue(baseUrl);
      setLastSyncResult(result);
      await refreshCount();
    } catch {
      /* network error — will retry next time */
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
      if (online) syncNow();
    });

    return () => unsub();
  }, [baseUrl]);

  return { isOnline, pendingCount, syncNow, isSyncing, lastSyncResult };
}
