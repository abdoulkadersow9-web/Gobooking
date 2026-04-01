import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform, Linking,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useOnSync, useSync } from "@/context/SyncContext";
import { notifyEmbarquementValide } from "@/services/notificationService";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus, isAlreadyScanned, markAsScanned } from "@/utils/offline";
import { validateQR, qrErrorMessage } from "@/utils/qr";
import OfflineBanner from "@/components/OfflineBanner";
import { useAgentGps } from "@/utils/useAgentGps";
import CameraConnectModal from "@/components/CameraConnectModal";
import type { CameraTrip } from "@/components/CameraConnectModal";

const G       = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK  = "#065F46";

interface Passenger {
  reservationId: string;
  name: string;
  phone: string;
  seat: string;
  seats?: string[];
  status: string;
  paymentStatus?: string;
  isSP?: boolean;
  departureCity: string;
  arrivalCity: string;
  departureTime: string;
}

interface EnRoutePassenger {
  id: string;
  tripId: string;
  clientName: string;
  clientPhone: string;
  boardingPoint: string;
  seatsRequested: number;
  status: string;
  createdAt: number;
}

interface TodayTrip {
  id: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  busName: string;
  busType: string;
  status: string;
  totalSeats: number;
  totalPassengers: number;
  boardedPassengers: number;
  absentPassengers: number;
}

interface BoardingPassenger {
  bookingId: string;
  bookingRef: string;
  name: string;
  phone: string;
  seats: string[];
  status: string;
  boarded: boolean;
  amount: number;
  bookingType: "guichet" | "en-ligne";
  paxCount: number;
}

interface BoardingStatus {
  trip: {
    id: string; from: string; to: string;
    date: string; departureTime: string;
    busName: string; status: string; totalSeats: number;
  };
  passengers: BoardingPassenger[];
  stats: {
    total: number; boarded: number; absent: number; pending: number;
    totalSeats: number; boardedSeats: number; absentSeats: number;
    guichetCount: number; onlineCount: number;
  };
}

type MainTab = "billets" | "depart";

export default function EmbarquementScreen() {
  const { user, token, logout } = useAuth();
  const networkStatus   = useNetworkStatus(BASE_URL);
  const { triggerSync } = useSync();

  const isEmbarquementAgent = !user?.agentRole ||
    user.agentRole === "agent_embarquement" || user.agentRole === "embarquement" ||
    user.agentRole === "agent_guichet" || user.agentRole === "guichet" ||
    user.agentRole === "vente" || user.agentRole === "agent_ticket";

  /* ── Agent GPS broadcasting ─────────────────────────── */
  const [activeTripIdForGps, setActiveTripIdForGps] = useState<string | null>(null);
  const gps = useAgentGps(activeTripIdForGps, token);

  /* ── Camera / QR scan ─────────────────────────────── */
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode]         = useState(false);
  const [scanned, setScanned]           = useState(false);

  /* ── Unified scan result overlay ──────────────────── */
  type ScanResultType = {
    type: "validé" | "double" | "refusé";
    scanType?: "passager" | "colis" | "bagage"; /* which QR type was scanned */
    name?:    string;
    seat?:    string;
    seats?:   string[];
    count?:   number;
    from?:    string;
    to?:      string;
    ref?:     string;
    errorMsg?: string;
    /* colis-specific */
    parcel?: { trackingRef: string; sender: string; receiver: string; from: string; to: string; weight: number };
    /* bagage-specific */
    bagageCount?: number;
  };
  const [scanResult, setScanResult] = useState<ScanResultType | null>(null);
  const [scanBusy,   setScanBusy]   = useState(false);
  const scanAnim = useRef(new Animated.Value(0)).current;

  const showScanResult = (result: ScanResultType) => {
    setScanResult(result);
    scanAnim.setValue(0);
    Animated.spring(scanAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    if (result.type === "validé") {
      setTimeout(resetScanResult, 4000);
    }
  };

  const resetScanResult = () => {
    setScanResult(null);
    setScanned(false);
    setScanBusy(false);
  };

  /* ── Billet lookup (manual search fallback) ────────── */
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [validating, setValidating] = useState(false);
  const [found, setFound]         = useState<Passenger | null>(null);
  const [notFound, setNotFound]   = useState(false);
  const [validated, setValidated] = useState(false);
  const [invalidQR, setInvalidQR] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  /* ── Tab ──────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<MainTab>("billets");

  /* ── Multi-départ: sélecteur de trajet ────────────── */
  const [todayTrips, setTodayTrips]             = useState<TodayTrip[]>([]);
  const [tripsLoading, setTripsLoading]         = useState(false);
  const [selectedTrip, setSelectedTrip]         = useState<TodayTrip | null>(null);
  const [showTripSelector, setShowTripSelector] = useState(false);

  /* ── Départ tab: boarding status ─────────────────── */
  const [boardingStatus, setBoardingStatus]     = useState<BoardingStatus | null>(null);
  const [boardingLoading, setBoardingLoading]   = useState(false);
  const [closingDeparture, setClosingDeparture] = useState(false);
  const [departureResult, setDepartureResult]   = useState<{ cancelledCount: number; freedSeats: number } | null>(null);
  const [boardingById, setBoardingById]         = useState<string | null>(null);
  const [showCamConnect, setShowCamConnect]     = useState(false);
  const [camConnectTrip, setCamConnectTrip]     = useState<CameraTrip | null>(null);
  const pollBoardingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Sync temps réel ─────────────────────────────── */
  const [lastBoardingSync, setLastBoardingSync] = useState<Date | null>(null);
  const [newPassengerIds, setNewPassengerIds]   = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const newBadgeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /* ── Toast animé: nouveau(x) passager(s) ─────────── */
  const [toastMsg, setToastMsg]     = useState<string | null>(null);
  const toastAnim  = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ND = Platform.OS !== "web";

  const showPassengerToast = useCallback((count: number) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const label = count === 1 ? "1 nouveau passager détecté" : `${count} nouveaux passagers détectés`;
    setToastMsg(label);
    toastAnim.setValue(0);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: ND, tension: 80, friction: 7 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: ND }).start(() => setToastMsg(null));
    }, 4500);
  }, [toastAnim, ND]);

  /* Refs pour accès synchrone dans les callbacks async / useOnSync */
  const selectedTripRef = useRef<TodayTrip | null>(null);
  const activeTabRef    = useRef<MainTab>("billets");
  const loadBoardingRef = useRef<((id: string, silent?: boolean) => Promise<void>) | null>(null);

  /* Sync croisé: déclenché AVANT le return conditionnel ── */
  useOnSync(["ticket", "reservation", "boarding"], () => {
    if (activeTabRef.current === "depart" && selectedTripRef.current) {
      loadBoardingRef.current?.(selectedTripRef.current.id, true);
    }
  });

  /* ── Absent seat release (guichet) ───────────────── */
  const [selectedAbsents, setSelectedAbsents]   = useState<Set<string>>(new Set());
  const [releasingSeats, setReleasingSeats]     = useState(false);
  const [releaseResult, setReleaseResult]       = useState<{ freedSeats: number; newGuichetSeats: number } | null>(null);

  /* ── En Route passengers ──────────────────────────── */
  const [activeTripId, setActiveTripId]         = useState<string | null>(null);
  const [enRouteList, setEnRouteList]           = useState<EnRoutePassenger[]>([]);
  const [enRouteLoading, setEnRouteLoading]     = useState(false);
  const [boardingId, setBoardingId]             = useState<string | null>(null);
  const [enRouteScanMode, setEnRouteScanMode]   = useState(false);
  const [enRouteScanBusy, setEnRouteScanBusy]   = useState(false);
  const pollEnRouteRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (user && user.role !== "agent") {
    return (
      <SafeAreaView style={styles.denied} edges={["top", "bottom"]}>
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text style={styles.deniedText}>Accès réservé aux agents</Text>
      </SafeAreaView>
    );
  }

  /* ── Load today's trips from company ─────────────── */
  const loadTodayTrips = async () => {
    setTripsLoading(true);
    try {
      const data = await apiFetch<TodayTrip[]>("/agent/trips/today", { token: token ?? undefined });
      setTodayTrips(data || []);
      /* Auto-select if only one trip */
      if (data?.length === 1 && !selectedTrip) {
        setSelectedTrip(data[0]);
        setActiveTripIdForGps(data[0].id);
      }
    } catch {
      setTodayTrips([]);
    } finally {
      setTripsLoading(false);
    }
  };

  /* ── Select a trip → auto-switch to depart tab + load list ── */
  const selectTrip = async (trip: TodayTrip) => {
    setSelectedTrip(trip);
    selectedTripRef.current = trip;
    setActiveTripIdForGps(trip.id);
    setShowTripSelector(false);
    setDepartureResult(null);
    setReleaseResult(null);
    setSelectedAbsents(new Set());
    /* Switch automatically to the passenger list tab */
    setActiveTab("depart");
    activeTabRef.current = "depart";
    /* Reset known IDs so next poll can detect "new" passengers */
    knownIdsRef.current = new Set();
    await loadBoardingStatus(trip.id, false);
    startBoardingPoll(trip.id);
  };

  /* ── Load boarding status (silent=true skips spinner) ── */
  const loadBoardingStatus = async (tripId: string, silent = false) => {
    if (!silent) setBoardingLoading(true);
    try {
      const data = await apiFetch<BoardingStatus>(`/agent/trip/${tripId}/boarding-status`, { token: token ?? undefined });

      /* Detect genuinely new passengers (not yet in knownIds) */
      if (silent && knownIdsRef.current.size > 0) {
        const incoming = (data.passengers ?? []).map(p => p.bookingId);
        const fresh = incoming.filter(id => !knownIdsRef.current.has(id));
        if (fresh.length > 0) {
          showPassengerToast(fresh.length);
          setNewPassengerIds(prev => {
            const next = new Set(prev);
            fresh.forEach(id => next.add(id));
            return next;
          });
          /* Auto-clear "NOUVEAU" badge after 5s */
          fresh.forEach(id => {
            if (newBadgeTimers.current.has(id)) clearTimeout(newBadgeTimers.current.get(id)!);
            newBadgeTimers.current.set(id, setTimeout(() => {
              setNewPassengerIds(prev => {
                const n = new Set(prev);
                n.delete(id);
                return n;
              });
              newBadgeTimers.current.delete(id);
            }, 5000));
          });
        }
      }
      /* Update known IDs */
      knownIdsRef.current = new Set((data.passengers ?? []).map(p => p.bookingId));

      if (!silent) {
        /* Initial load: full replace */
        setBoardingStatus(data);
      } else {
        /* Background refresh: MERGE to preserve scroll position and order.
           - Existing passengers: only swap reference if something changed (boarded/status)
           - New passengers: appended at the BOTTOM — never cause scroll jump
           - Removed passengers: kept until next non-silent reload (no visual disruption) */
        setBoardingStatus(prev => {
          if (!prev) return data;
          const newMap = new Map((data.passengers ?? []).map(p => [p.bookingId, p]));
          const updated = prev.passengers.map(p => {
            const fresh = newMap.get(p.bookingId);
            if (!fresh) return p;
            if (fresh.boarded === p.boarded && fresh.status === p.status) return p;
            return fresh;
          });
          const existingIds = new Set(prev.passengers.map(p => p.bookingId));
          const appended = (data.passengers ?? []).filter(p => !existingIds.has(p.bookingId));
          return { ...data, passengers: [...updated, ...appended] };
        });
      }
      setLastBoardingSync(new Date());
    } catch {
      if (!silent) setBoardingStatus(null);
    } finally {
      if (!silent) setBoardingLoading(false);
    }
  };

  /* ── Real-time polling: 8s when on Départ tab, paused otherwise ── */
  const startBoardingPoll = (tripId: string) => {
    if (pollBoardingRef.current) clearInterval(pollBoardingRef.current);
    pollBoardingRef.current = setInterval(() => {
      loadBoardingStatus(tripId, true);
    }, 8000);
  };

  /* Pause/resume poll based on active tab */
  useEffect(() => {
    if (!selectedTrip) return;
    if (activeTab === "depart") {
      startBoardingPoll(selectedTrip.id);
    } else {
      if (pollBoardingRef.current) { clearInterval(pollBoardingRef.current); pollBoardingRef.current = null; }
    }
    return () => { if (pollBoardingRef.current) clearInterval(pollBoardingRef.current); };
  }, [activeTab, selectedTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Clear boarding poll + badge timers on unmount */
  useEffect(() => {
    return () => {
      if (pollBoardingRef.current) clearInterval(pollBoardingRef.current);
      newBadgeTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  /* Keep refs in sync with state */
  selectedTripRef.current = selectedTrip;
  activeTabRef.current    = activeTab;
  loadBoardingRef.current = loadBoardingStatus;

  /* ── Board a passenger directly from the list ────── */
  const boardPassengerFromList = async (p: BoardingPassenger) => {
    if (boardingById || p.boarded) return;
    Alert.alert(
      "Embarquer passager",
      `Confirmer l'embarquement de ${p.name} ?\nSiège(s) : ${p.seats.length > 0 ? p.seats.join(", ") : "non assigné"}`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Embarquer ✓", onPress: async () => {
          setBoardingById(p.bookingId);
          try {
            await apiFetch(`/agent/reservation/${p.bookingId}/board`, {
              token: token ?? undefined,
              method: "POST",
            });
            /* Optimistic update */
            setBoardingStatus(prev => prev ? {
              ...prev,
              passengers: prev.passengers.map(x => x.bookingId === p.bookingId ? { ...x, boarded: true, status: "boarded" } : x),
              stats: {
                ...prev.stats,
                boarded: prev.stats.boarded + 1,
                absent: Math.max(0, prev.stats.absent - 1),
              },
            } : prev);
            if (selectedTrip) loadBoardingStatus(selectedTrip.id, true);
            triggerSync("boarding");
          } catch (e: any) {
            Alert.alert("Erreur", e?.message ?? "Impossible de valider l'embarquement");
          } finally {
            setBoardingById(null);
          }
        }},
      ]
    );
  };

  /* ── Toggle absent passenger selection ───────────── */
  const toggleAbsent = (bookingId: string) => {
    setSelectedAbsents(prev => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

  const toggleSelectAllAbsents = () => {
    const absentPassengers = boardingStatus?.passengers.filter(p => !p.boarded) ?? [];
    if (selectedAbsents.size === absentPassengers.length) {
      setSelectedAbsents(new Set());
    } else {
      setSelectedAbsents(new Set(absentPassengers.map(p => p.bookingId)));
    }
  };

  /* ── Release selected absent seats → guichet ─────── */
  const releaseAbsentSeats = async () => {
    if (!selectedTrip || selectedAbsents.size === 0) return;

    const ids = Array.from(selectedAbsents);
    const absentPax = boardingStatus?.passengers.filter(p => !p.boarded && selectedAbsents.has(p.bookingId)) ?? [];
    const totalSeats = absentPax.reduce((acc, p) => acc + Math.max(p.seats.length, 1), 0);

    Alert.alert(
      "Libérer des places",
      `Libérer ${totalSeats} siège(s) pour ${ids.length} passager(s) absent(s) ?\n\nCes places seront disponibles immédiatement au guichet pour revente.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Libérer au guichet",
          style: "default",
          onPress: async () => {
            setReleasingSeats(true);
            try {
              const result = await apiFetch<{ freedSeats: number; newGuichetSeats: number; message: string }>(
                `/agent/trips/${selectedTrip.id}/release-absent-seats`,
                { method: "POST", token: token ?? undefined, body: { bookingIds: ids } }
              );
              setReleaseResult({ freedSeats: result.freedSeats, newGuichetSeats: result.newGuichetSeats });
              setSelectedAbsents(new Set());
              await loadBoardingStatus(selectedTrip.id);
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "Impossible de libérer les places");
            } finally {
              setReleasingSeats(false);
            }
          },
        },
      ]
    );
  };

  /* ── Close departure: cancel absents + free seats ─── */
  const closeDeparture = async () => {
    if (!selectedTrip) return;
    Alert.alert(
      "Clôturer le départ",
      `Confirmer la clôture du départ ${selectedTrip.from} → ${selectedTrip.to} ?\n\nLes ${boardingStatus?.stats?.absent ?? 0} passager(s) absent(s) seront annulé(s) et leurs sièges libérés.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Clôturer",
          style: "destructive",
          onPress: async () => {
            setClosingDeparture(true);
            try {
              const result = await apiFetch<{ cancelledCount: number; freedSeats: number; message: string }>(
                `/agent/trips/${selectedTrip.id}/close-departure`,
                { token: token ?? undefined, method: "POST" }
              );
              setDepartureResult({ cancelledCount: result.cancelledCount, freedSeats: result.freedSeats });
              await loadBoardingStatus(selectedTrip.id);
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "Impossible de clôturer le départ");
            } finally {
              setClosingDeparture(false);
            }
          },
        },
      ]
    );
  };

  /* Load trips on mount — attendre le token */
  useEffect(() => {
    if (token) loadTodayTrips();
  }, [token]);

  /* ── Fetch active trip for agent's bus ────────────── */
  const fetchActiveTripId = async () => {
    try {
      const info = await apiFetch<{ agent: { busId?: string }; bus: any }>("/agent/info", { token: token ?? undefined });
      const busId = info?.agent?.busId;
      if (!busId) { setActiveTripId(null); setActiveTripIdForGps(null); return null; }

      const trips = await apiFetch<any[]>("/agent/trips", { token: token ?? undefined });
      const active = (trips || []).find((t: any) =>
        (t.status === "en_route" || t.status === "en_cours") && t.busId === busId
      );
      const id = active?.id || null;
      setActiveTripId(id);
      setActiveTripIdForGps(id);
      return id;
    } catch {
      return null;
    }
  };

  /* ── Load en-route passengers ─────────────────────── */
  const loadEnRoute = async (tripId: string | null) => {
    if (!tripId) { setEnRouteList([]); return; }
    setEnRouteLoading(true);
    try {
      const data = await apiFetch<EnRoutePassenger[]>(`/agent/requests/confirmed?tripId=${tripId}`, { token: token ?? undefined });
      setEnRouteList(data || []);
    } catch {
      setEnRouteList([]);
    } finally {
      setEnRouteLoading(false);
    }
  };

  /* ── Switch to En Route tab ───────────────────────── */
  const handleEnRouteTabPress = async () => {
    setActiveTab("en_route");
    let tid = activeTripId;
    if (!tid) tid = await fetchActiveTripId();
    await loadEnRoute(tid);

    if (pollEnRouteRef.current) clearInterval(pollEnRouteRef.current);
    pollEnRouteRef.current = setInterval(async () => {
      const tId = activeTripId;
      if (tId) await loadEnRoute(tId);
    }, 10000);
  };

  useEffect(() => {
    return () => { if (pollEnRouteRef.current) clearInterval(pollEnRouteRef.current); };
  }, []);

  /* ── Board an en-route passenger ──────────────────── */
  const boardEnRoute = async (requestId: string) => {
    setBoardingId(requestId);
    try {
      if (!networkStatus.isOnline) {
        await saveOffline({
          type: "en_route_board",
          payload: { requestId },
          token: token ?? "",
          createdAt: Date.now(),
        });
        setEnRouteList(prev => prev.map(p => p.id === requestId ? { ...p, status: "embarqué" } : p));
        return;
      }
      await apiFetch(`/agent/requests/${requestId}/board`, { token: token ?? undefined, method: "POST" });
      setEnRouteList(prev => prev.map(p => p.id === requestId ? { ...p, status: "embarqué" } : p));
      notifyEmbarquementValide({}).catch(() => {});
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'embarquer le passager");
    } finally {
      setBoardingId(null);
    }
  };

  /* ── En-route QR scan ─────────────────────────────── */
  const handleEnRouteScan = useCallback(async ({ data }: { data: string }) => {
    if (enRouteScanBusy) return;
    setEnRouteScanBusy(true);
    setEnRouteScanMode(false);
    const requestId = data.trim();

    const found = enRouteList.find(p => p.id === requestId);
    if (found && found.status !== "embarqué") {
      Alert.alert(
        "Embarquer passager",
        `Confirmer l'embarquement de ${found.clientName} ?`,
        [
          { text: "Annuler", style: "cancel", onPress: () => setEnRouteScanBusy(false) },
          { text: "Embarquer", style: "default", onPress: async () => {
            await boardEnRoute(requestId);
            setEnRouteScanBusy(false);
          }},
        ]
      );
    } else if (found && found.status === "embarqué") {
      Alert.alert("Déjà embarqué", `${found.clientName} a déjà été embarqué.`);
      setEnRouteScanBusy(false);
    } else {
      /* Not in list yet — try board anyway (might be from another device's accepted list) */
      Alert.alert(
        "Passager inconnu",
        `ID de demande: ${requestId}\n\nEmbarquer ce passager ?`,
        [
          { text: "Annuler", style: "cancel", onPress: () => setEnRouteScanBusy(false) },
          { text: "Embarquer", onPress: async () => {
            await boardEnRoute(requestId);
            setEnRouteScanBusy(false);
          }},
        ]
      );
    }
  }, [enRouteScanBusy, enRouteList, token]);

  /* ── Unified QR scan → validate → board in one step ── */
  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scanned || scanBusy) return;
    setScanMode(false);
    setScanBusy(true);

    /* 1. Quick client-side QR validation (before hitting API) */
    const qrResult = validateQR(data.trim());
    if (!qrResult.valid) {
      setScanBusy(false);
      showScanResult({ type: "refusé", errorMsg: qrErrorMessage(qrResult.reason) });
      return;
    }

    /* 2. Anti-duplicate session guard */
    const duplicate = await isAlreadyScanned(qrResult.ref);
    if (duplicate) {
      setScanBusy(false);
      showScanResult({ type: "double", errorMsg: "Ce billet a déjà été scanné dans cette session." });
      return;
    }

    setScanned(true);
    await markAsScanned(qrResult.ref);

    /* 3. Offline fallback */
    if (!networkStatus.isOnline) {
      await saveOffline({
        type: "scan",
        payload: { reservationId: qrResult.ref },
        token: token ?? "",
        createdAt: Date.now(),
      });
      setScanBusy(false);
      showScanResult({
        type: "validé",
        name: "Passager (hors-ligne)",
        ref: qrResult.ref,
        errorMsg: "Validé hors-ligne — synchronisation en attente.",
      });
      return;
    }

    /* 4. Unified scan endpoint: validate + board in one request */
    try {
      const res = await apiFetch<{
        success:   boolean;
        scanType:  string;
        bookingRef?: string;
        ref?:       string;
        passenger?: { name: string; seat: string; seats: string[]; count: number; from: string; to: string; };
        parcel?:    { trackingRef: string; sender: string; receiver: string; from: string; to: string; weight: number };
        bagages?:   any[];
        error?: string; code?: string;
      }>("/agent/scan", {
        token: token ?? undefined,
        method: "POST",
        body: { qrData: data.trim(), selectedTripId: selectedTrip?.id ?? undefined },
      });

      setScanBusy(false);

      if (res.scanType === "colis") {
        showScanResult({
          type:     "validé",
          scanType: "colis",
          name:     res.parcel ? `${res.parcel.sender} → ${res.parcel.receiver}` : undefined,
          from:     res.parcel?.from,
          to:       res.parcel?.to,
          ref:      res.ref ?? res.parcel?.trackingRef,
          parcel:   res.parcel,
        });
      } else if (res.scanType === "bagage") {
        showScanResult({
          type:        "validé",
          scanType:    "bagage",
          name:        res.passenger?.name,
          seat:        res.passenger?.seat,
          ref:         res.bookingRef,
          bagageCount: res.bagages?.length ?? 0,
        });
      } else {
        notifyEmbarquementValide({}).catch(() => {});
        showScanResult({
          type:     "validé",
          scanType: "passager",
          name:     res.passenger?.name,
          seat:     res.passenger?.seat,
          seats:    res.passenger?.seats,
          count:    res.passenger?.count,
          from:     res.passenger?.from,
          to:       res.passenger?.to,
          ref:      res.bookingRef,
        });
        if (activeTripId) loadEnRoute(activeTripId);
        /* Signaler immédiatement aux autres écrans qu'un passager a embarqué */
        triggerSync("boarding");
        /* Recharger silencieusement la liste de présences */
        if (selectedTripRef.current) loadBoardingRef.current?.(selectedTripRef.current.id, true);
      }
    } catch (e: any) {
      setScanBusy(false);
      const code     = e?.code     as string | undefined;
      const scanType = e?.scanType as string | undefined;

      if (code === "DOUBLE_SCAN") {
        if (scanType === "colis") {
          showScanResult({
            type:     "double",
            scanType: "colis",
            ref:      e?.ref,
            name:     e?.parcel ? `${e.parcel.sender} → ${e.parcel.receiver}` : undefined,
            errorMsg: "Ce colis a déjà été chargé dans le bus.",
          });
        } else if (scanType === "bagage") {
          showScanResult({
            type:     "double",
            scanType: "bagage",
            ref:      e?.bookingRef,
            name:     e?.passenger?.name,
            errorMsg: "Ces bagages ont déjà été scannés.",
          });
        } else {
          showScanResult({
            type:     "double",
            scanType: "passager",
            name:     e?.passenger?.name,
            seat:     e?.passenger?.seat,
            ref:      e?.bookingRef,
            errorMsg: "Ce billet a déjà été validé — passager déjà embarqué.",
          });
        }
      } else if (code === "NOT_PAID") {
        showScanResult({
          type:     "refusé",
          scanType: "passager",
          name:     e?.passenger?.name,
          ref:      e?.bookingRef,
          errorMsg: "Billet non payé — le passager doit régler son paiement avant d'embarquer.",
        });
      } else if (code === "BAGAGE_REFUS") {
        showScanResult({
          type:     "refusé",
          scanType: scanType === "bagage" ? "bagage" : "passager",
          name:     e?.passenger?.name,
          seat:     e?.passenger?.seat,
          ref:      e?.bookingRef,
          errorMsg: e?.bagageNote
            ? `Bagages refusés — embarquement bloqué.\nMotif : ${e.bagageNote}`
            : "Bagages refusés par la compagnie — embarquement bloqué.",
        });
      } else if (code === "NO_BAGAGES") {
        showScanResult({
          type:     "refusé",
          scanType: "bagage",
          ref:      e?.bookingRef,
          errorMsg: "Aucun bagage enregistré pour cette réservation.",
        });
      } else if (code === "WRONG_TRIP") {
        const bTrip = e?.bookingTrip;
        showScanResult({
          type:     "refusé",
          ref:      e?.bookingRef ?? e?.ref,
          errorMsg: bTrip
            ? `Mauvais trajet !\nCe QR est pour ${bTrip.from} → ${bTrip.to} (${bTrip.departureTime}), pas pour le trajet sélectionné.`
            : "Ce QR appartient à un autre trajet.",
        });
      } else {
        showScanResult({
          type:     "refusé",
          errorMsg: e?.message ?? e?.error ?? "QR invalide ou élément introuvable.",
        });
      }
    }
  }, [scanned, scanBusy, networkStatus.isOnline, token, selectedTrip]);

  const lookupPassenger = async (ref: string) => {
    setLoading(true);
    setFound(null);
    setNotFound(false);
    setValidated(false);
    try {
      const res = await apiFetch<Passenger>(`/agent/reservation/${ref.trim()}`, { token: token ?? undefined });
      setFound(res);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!search.trim()) return;
    lookupPassenger(search.trim());
  };

  const handleValidate = async () => {
    if (!found) return;
    setValidating(true);
    try {
      if (!networkStatus.isOnline) {
        await saveOffline({
          type: "scan",
          payload: { reservationId: found.reservationId },
          token: token ?? "",
          createdAt: Date.now(),
        });
        setValidated(true);
        setFound(prev => prev ? { ...prev, status: "confirmed" } : prev);
        return;
      }
      await apiFetch(`/agent/reservation/${found.reservationId}/board`, {
        token: token ?? undefined,
        method: "POST",
      });
      setValidated(true);
      setFound(prev => prev ? { ...prev, status: "confirmed" } : prev);
      if (activeTripId) loadEnRoute(activeTripId);
      triggerSync("boarding");
      if (selectedTripRef.current) loadBoardingRef.current?.(selectedTripRef.current.id, true);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de valider l'embarquement");
    } finally {
      setValidating(false);
    }
  };

  const reset = () => {
    setFound(null);
    setNotFound(false);
    setValidated(false);
    setScanned(false);
    setSearch("");
    setInvalidQR(null);
    setIsDuplicate(false);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Caméra requise", "Autorisez l'accès à la caméra pour scanner les billets.");
        return;
      }
    }
    setScanned(false);
    setScanMode(true);
  };

  const openEnRouteCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Caméra requise", "Autorisez la caméra pour scanner les QR codes.");
        return;
      }
    }
    setEnRouteScanBusy(false);
    setEnRouteScanMode(true);
  };

  const callPassenger = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
  };

  /* ── Stable handler refs (so memo row components don't re-render on every poll) ── */
  const _boardRef  = useRef(boardPassengerFromList);
  _boardRef.current  = boardPassengerFromList;
  const _callRef   = useRef(callPassenger);
  _callRef.current   = callPassenger;
  const _toggleRef = useRef(toggleAbsent);
  _toggleRef.current = toggleAbsent;

  const stableBoardHandler  = useCallback((p: BoardingPassenger) => _boardRef.current(p),  []);
  const stableCallPassenger = useCallback((phone: string)        => _callRef.current(phone), []);
  const stableToggleAbsent  = useCallback((id: string)           => _toggleRef.current(id), []);

  /* ── Camera scan overlay (shared for both modes) ──── */
  if (scanMode || enRouteScanMode) {
    const hint = enRouteScanMode ? "Pointez vers le QR du passager en route" : "Pointez vers le QR : passager, colis ou bagage";
    const onScan = enRouteScanMode ? handleEnRouteScan : handleBarCodeScanned;
    const onClose = () => { setScanMode(false); setEnRouteScanMode(false); };

    return (
      <View style={styles.cameraWrap}>
        {Platform.OS !== "web" ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={onScan}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
        ) : (
          <View style={styles.webCamera}>
            <Ionicons name="camera-outline" size={64} color="#fff" />
            <Text style={{ color: "#fff", marginTop: 12 }}>Scanner non disponible sur web</Text>
          </View>
        )}
        <View style={styles.cameraOverlay}>
          <View style={styles.scanBox} />
        </View>
        <TouchableOpacity style={styles.cancelScan} onPress={onClose}>
          <Ionicons name="close-circle" size={44} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.scanHint}>{hint}</Text>
        {/* Scan busy spinner */}
        {scanBusy && (
          <View style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center", justifyContent: "center",
          }}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: "#fff", marginTop: 12, fontSize: 15 }}>Validation…</Text>
          </View>
        )}
      </View>
    );
  }

  /* ── Scan result fullscreen overlay ─────────────────── */
  if (scanResult) {
    const isOk     = scanResult.type === "validé";
    const isDouble = scanResult.type === "double";
    const bgColor  = isOk ? "#065F46" : isDouble ? "#78350F" : "#7F1D1D";
    const iconColor= isOk ? "#34D399" : isDouble ? "#FCD34D" : "#FCA5A5";
    const label    = isOk ? "VALIDÉ" : isDouble ? "DOUBLE SCAN" : "REFUSÉ";
    const labelColor = isOk ? "#ECFDF5" : isDouble ? "#FEF3C7" : "#FEF2F2";

    /* Type-specific icon */
    const qrTypeIconName =
      (scanResult.scanType === "colis"  ? "cube"
      : scanResult.scanType === "bagage" ? "briefcase"
      : "person-circle") as React.ComponentProps<typeof Ionicons>["name"];

    const statusIconName =
      (isOk ? "checkmark-circle" : isDouble ? "alert-circle" : "close-circle") as React.ComponentProps<typeof Ionicons>["name"];

    /* Type badge label */
    const typeBadge =
      scanResult.scanType === "colis"  ? "COLIS"
      : scanResult.scanType === "bagage" ? "BAGAGE"
      : "PASSAGER";

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, alignItems: "center", justifyContent: "center" }} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={bgColor} />

        <Animated.View style={{
          alignItems: "center",
          transform: [{ scale: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          opacity: scanAnim,
          width: "85%",
        }}>
          {/* Type badge — only show when type is known */}
          {scanResult.scanType && (
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", letterSpacing: 2 }}>{typeBadge}</Text>
            </View>
          )}

          {/* Big status icon */}
          <Ionicons name={statusIconName} size={90} color={iconColor} />

          {/* Status label */}
          <Text style={{
            fontSize: 34, fontWeight: "900", letterSpacing: 4,
            color: labelColor, marginTop: 12, marginBottom: 20,
          }}>
            {label}
          </Text>

          {/* Content card */}
          {(isOk || isDouble) && (scanResult.name || scanResult.parcel) && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16,
              padding: 18, width: "100%", gap: 10, marginBottom: 16,
            }}>
              {/* Passager / bagage name */}
              {scanResult.name && scanResult.scanType !== "colis" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name={qrTypeIconName} size={26} color={iconColor} />
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", flex: 1 }}>
                    {scanResult.name}
                  </Text>
                </View>
              )}

              {/* Passager seat */}
              {scanResult.seat && scanResult.scanType !== "colis" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="ticket" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                    {scanResult.seats && scanResult.seats.length > 1
                      ? `Sièges : ${scanResult.seats.join(", ")} (${scanResult.count} passagers)`
                      : `Siège : ${scanResult.seat}`}
                  </Text>
                </View>
              )}

              {/* Bagage count */}
              {scanResult.scanType === "bagage" && scanResult.bagageCount != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="briefcase" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                    {scanResult.bagageCount} bagage{scanResult.bagageCount > 1 ? "s" : ""} validé{scanResult.bagageCount > 1 ? "s" : ""}
                  </Text>
                </View>
              )}

              {/* Colis info */}
              {scanResult.scanType === "colis" && scanResult.parcel && (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="cube" size={26} color={iconColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>{scanResult.parcel.sender}</Text>
                      <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>→ {scanResult.parcel.receiver}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="location" size={16} color="rgba(255,255,255,0.6)" />
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{scanResult.parcel.from} → {scanResult.parcel.to}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="scale" size={16} color="rgba(255,255,255,0.6)" />
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{scanResult.parcel.weight} kg · Chargé dans le bus</Text>
                  </View>
                </>
              )}

              {/* Route (passager) */}
              {scanResult.from && scanResult.from !== "—" && scanResult.scanType !== "colis" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="location" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                    {scanResult.from} → {scanResult.to}
                  </Text>
                </View>
              )}

              {/* Ref */}
              {scanResult.ref && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="barcode" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, letterSpacing: 1 }}>
                    Réf : {scanResult.ref}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Error message (refusé + double) */}
          {scanResult.errorMsg && !isOk && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12,
              padding: 14, width: "100%", marginBottom: 16,
            }}>
              <Text style={{ color: labelColor, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                {scanResult.errorMsg}
              </Text>
            </View>
          )}

          {/* Offline note for validé */}
          {isOk && scanResult.errorMsg && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12,
              padding: 10, width: "100%", marginBottom: 16,
            }}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center" }}>
                {scanResult.errorMsg}
              </Text>
            </View>
          )}

          {/* Auto-dismiss info */}
          {isOk && (
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 20 }}>
              Fermeture automatique dans 4 secondes…
            </Text>
          )}

          {/* Manual dismiss */}
          <TouchableOpacity
            onPress={resetScanResult}
            activeOpacity={0.8}
            style={{
              backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 18,
              paddingHorizontal: 48, paddingVertical: 18, borderWidth: 1.5,
              borderColor: "rgba(255,255,255,0.4)",
              flexDirection: "row", alignItems: "center", gap: 10,
            }}
          >
            <Ionicons name="qr-code-outline" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.5 }}>
              Nouveau scan
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (!isEmbarquementAgent) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 32 }}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="lock-closed" size={52} color="#D1D5DB" />
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>Accès non autorisé</Text>
        <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>Cet écran est réservé aux agents d'embarquement.</Text>
        <TouchableOpacity style={{ backgroundColor: G, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10, marginTop: 8 }}
          onPress={() => router.replace("/agent/home" as never)}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      {/* Offline Banner */}
      <OfflineBanner status={networkStatus} />

      {/* ── Toast: nouveaux passagers détectés ───────── */}
      {toastMsg && (
        <Animated.View
          style={{
            position: "absolute", top: 56, left: 16, right: 16, zIndex: 999,
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          }}
        >
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: "#059669", borderRadius: 14,
            paddingHorizontal: 18, paddingVertical: 13,
            shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}>
            <Ionicons name="person-add" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 }}>{toastMsg}</Text>
            <View style={{
              backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>LIVE</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="bus" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Embarquement</Text>
            <Text style={styles.headerSub}>Valider les billets voyageurs</Text>
          </View>
          {/* GPS status chip */}
          {activeTripIdForGps && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              backgroundColor: gps.active ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.1)",
              borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
              borderWidth: 1, borderColor: gps.active ? "#34D399" : "rgba(255,255,255,0.2)",
            }}>
              <View style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor: gps.active ? "#34D399" : "#FCA5A5",
              }} />
              <Text style={{ fontSize: 11, color: gps.active ? "#34D399" : "#FCA5A5", fontWeight: "700" }}>
                {gps.active
                  ? `GPS ${gps.speed ? `${Math.round(gps.speed)} km/h` : "actif"}`
                  : gps.error ? "GPS refusé" : "GPS…"}
              </Text>
            </View>
          )}
          {/* Camera connect button */}
          <TouchableOpacity
            style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center", marginLeft: 2 }}
            hitSlop={8}
            onPress={() => {
              if (selectedTrip) {
                setCamConnectTrip({
                  id: selectedTrip.id,
                  from: selectedTrip.from,
                  to: selectedTrip.to,
                  departureTime: selectedTrip.departureTime,
                  busName: selectedTrip.busName,
                });
              }
              setShowCamConnect(true);
            }}
          >
            <Ionicons name="videocam-outline" size={16} color="#67E8F9" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center", marginLeft: 2 }}
            hitSlop={8}
            onPress={() => router.push("/agent/rapport" as never)}
          >
            <Feather name="alert-triangle" size={16} color="#FCA5A5" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center", marginLeft: 6 }}
            hitSlop={8}
            onPress={() => {
              if (Platform.OS === "web") { logout(); return; }
              Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
                { text: "Annuler", style: "cancel" },
                { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Selected trip banner */}
        {selectedTrip ? (
          <TouchableOpacity style={styles.selectedTripBanner} onPress={() => setShowTripSelector(true)}>
            <Ionicons name="bus" size={14} color="#34D399" />
            <Text style={styles.selectedTripText} numberOfLines={1}>
              {selectedTrip.busName} · {selectedTrip.from} → {selectedTrip.to} · {selectedTrip.departureTime}
            </Text>
            <View style={styles.selectedTripCount}>
              <Text style={styles.selectedTripCountText}>
                {selectedTrip.boardedPassengers}/{selectedTrip.totalPassengers}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.selectTripPrompt} onPress={() => { loadTodayTrips(); setShowTripSelector(true); }}>
            <Ionicons name="git-branch-outline" size={14} color="#FCD34D" />
            <Text style={styles.selectTripPromptText}>
              {tripsLoading ? "Chargement trajets…" : "Sélectionner un départ →"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Tab toggle */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "billets" && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab("billets");
              if (pollBoardingRef.current) { clearInterval(pollBoardingRef.current); pollBoardingRef.current = null; }
            }}
          >
            <Ionicons name="ticket-outline" size={13} color={activeTab === "billets" ? G_DARK : "rgba(255,255,255,0.6)"} />
            <Text style={[styles.tabBtnText, activeTab === "billets" && styles.tabBtnTextActive]}>Billets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "depart" && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab("depart");
              if (selectedTrip) {
                loadBoardingStatus(selectedTrip.id, false);
                startBoardingPoll(selectedTrip.id);
              }
            }}
          >
            <Ionicons name="checkmark-done" size={13} color={activeTab === "depart" ? G_DARK : "rgba(255,255,255,0.6)"} />
            <Text style={[styles.tabBtnText, activeTab === "depart" && styles.tabBtnTextActive]}>
              Départ{boardingStatus?.stats?.absent ? ` (${boardingStatus.stats.absent})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── ALERTE ABSENTS — toujours visible si des passagers manquent ── */}
      {boardingStatus && boardingStatus.stats.absent > 0 && !departureResult && (
        <TouchableOpacity
          onPress={() => {
            setActiveTab("depart");
            if (selectedTrip) loadBoardingStatus(selectedTrip.id);
          }}
          activeOpacity={0.85}
          style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: "#FEF3C7",
            paddingHorizontal: 14, paddingVertical: 10,
            borderBottomWidth: 2, borderBottomColor: "#FCD34D",
          }}
        >
          <View style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: "#D97706", alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="alert" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#92400E" }}>
              {boardingStatus.stats.absent} PASSAGER{boardingStatus.stats.absent > 1 ? "S" : ""} ABSENT{boardingStatus.stats.absent > 1 ? "S" : ""}
            </Text>
            <Text style={{ fontSize: 11, color: "#B45309" }}>
              {boardingStatus.stats.boarded}/{boardingStatus.stats.total} embarqués · Appuyez pour gérer →
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#D97706" />
        </TouchableOpacity>
      )}

      {/* ── Billets tab ── */}
      {activeTab === "billets" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.card}>
            <TouchableOpacity style={styles.scanBtn} onPress={openCamera} activeOpacity={0.85}>
              <Ionicons name="qr-code-outline" size={34} color="#fff" />
              <Text style={styles.scanBtnText}>Scanner un billet QR</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>ou saisir le numéro</Text>
              <View style={styles.divLine} />
            </View>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="Réf. réservation ou n° siège"
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={handleSearch}
                autoCapitalize="characters"
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {loading && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={G} />
              <Text style={styles.loadingText}>Recherche en cours…</Text>
            </View>
          )}

          {/* ── QR invalide ── */}
          {invalidQR && (
            <View style={[styles.resultCard, { borderColor: "#F87171", borderWidth: 1.5 }]}>
              <Ionicons name="qr-code-outline" size={32} color="#EF4444" />
              <Text style={[styles.notFoundText, { color: "#EF4444" }]}>QR invalide</Text>
              <Text style={styles.notFoundSub}>{invalidQR}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]} onPress={reset}>
                <Text style={[styles.retryBtnText, { color: "#DC2626" }]}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Déjà utilisé ── */}
          {isDuplicate && (
            <View style={[styles.resultCard, { borderColor: "#FCD34D", borderWidth: 1.5 }]}>
              <Ionicons name="alert-circle" size={32} color="#D97706" />
              <Text style={[styles.notFoundText, { color: "#D97706" }]}>Déjà utilisé</Text>
              <Text style={styles.notFoundSub}>Ce billet a déjà été validé dans cette session.</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]} onPress={reset}>
                <Text style={[styles.retryBtnText, { color: "#B45309" }]}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {notFound && !loading && (
            <View style={[styles.resultCard, styles.notFoundCard]}>
              <Ionicons name="close-circle" size={32} color="#EF4444" />
              <Text style={styles.notFoundText}>Billet introuvable</Text>
              <Text style={styles.notFoundSub}>Vérifiez la référence ou demandez un document valide</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryBtnText}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {found && !loading && (
            <View style={[styles.resultCard, validated && styles.validatedCard]}>
              {validated ? (
                <View style={styles.validatedBadge}>
                  <Ionicons name="checkmark-circle" size={40} color={G} />
                  <Text style={styles.validatedText}>Embarquement validé !</Text>
                </View>
              ) : null}

              <View style={styles.passengerRow}>
                <View style={styles.passengerAvatar}>
                  <Ionicons name="person" size={24} color={found.isSP ? "#7C3AED" : G} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.passengerName}>{found.name}</Text>
                    {found.isSP && (
                      <View style={{ backgroundColor: "#EDE9FE", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "#7C3AED" }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#6D28D9", letterSpacing: 1 }}>SP</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.passengerPhone}>{found.phone}</Text>
                </View>
                <View style={[styles.seatBadge, found.isSP && { backgroundColor: "#EDE9FE", borderColor: "#7C3AED" }]}>
                  <Text style={[styles.seatText, found.isSP && { color: "#6D28D9" }]}>{found.seat || "—"}</Text>
                  <Text style={[styles.seatLabel, found.isSP && { color: "#7C3AED" }]}>Siège</Text>
                </View>
              </View>

              <View style={styles.tripInfo}>
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text style={styles.tripInfoText}>
                  {found.departureCity ?? "—"} → {found.arrivalCity ?? "—"}
                </Text>
                {found.departureTime ? (
                  <Text style={styles.tripTime}>{found.departureTime}</Text>
                ) : null}
              </View>

              {!validated && (
                <TouchableOpacity
                  style={[styles.validateBtn, validating && styles.validateBtnDisabled]}
                  onPress={handleValidate}
                  disabled={validating}
                >
                  {validating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
                      <Text style={styles.validateBtnText}>Valider l'embarquement</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Ionicons name="refresh-outline" size={15} color={G} />
                <Text style={styles.retryBtnText}>Nouveau scan</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Instructions</Text>
            <Text style={styles.tip}>• Scanner le QR code sur le billet du voyageur</Text>
            <Text style={styles.tip}>• Vérifier l'identité si nécessaire</Text>
            <Text style={styles.tip}>• Valider avant l'entrée dans le bus</Text>
          </View>
        </ScrollView>
      )}

      {/* ── Départ tab ── */}
      {activeTab === "depart" && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        >
          {!selectedTrip ? (
            <View style={[styles.resultCard, { alignItems: "center", paddingVertical: 32 }]}>
              <Ionicons name="git-branch-outline" size={44} color="#D1FAE5" />
              <Text style={[styles.notFoundText, { color: "#64748B" }]}>Aucun trajet sélectionné</Text>
              <Text style={styles.notFoundSub}>Sélectionnez un départ pour voir les passagers</Text>
              <TouchableOpacity
                style={[styles.validateBtn, { marginTop: 12 }]}
                onPress={() => { loadTodayTrips(); setShowTripSelector(true); }}
              >
                <Ionicons name="bus-outline" size={18} color="#fff" />
                <Text style={styles.validateBtnText}>Sélectionner un trajet</Text>
              </TouchableOpacity>
            </View>
          ) : boardingLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={G} />
              <Text style={styles.loadingText}>Chargement de la liste passagers…</Text>
            </View>
          ) : boardingStatus ? (
            <>
              {/* Trip summary card */}
              <View style={styles.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <View style={[styles.passengerAvatar, { backgroundColor: G_DARK }]}>
                    <Ionicons name="bus" size={22} color="#34D399" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{boardingStatus.trip.busName}</Text>
                    <Text style={{ fontSize: 13, color: "#6B7280" }}>
                      {boardingStatus.trip.from} → {boardingStatus.trip.to} · {boardingStatus.trip.departureTime}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: G }} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: G_DARK }}>
                        {lastBoardingSync
                          ? `màj ${lastBoardingSync.getHours().toString().padStart(2,"0")}:${lastBoardingSync.getMinutes().toString().padStart(2,"0")}:${lastBoardingSync.getSeconds().toString().padStart(2,"0")}`
                          : "LIVE 8s"}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => loadBoardingStatus(selectedTrip.id, false)} style={{ padding: 6 }}>
                      <Feather name="refresh-cw" size={16} color={G} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Stats row */}
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <View style={[styles.statBox, { flex: 1, minWidth: 70, backgroundColor: G_LIGHT, borderColor: G }]}>
                    <Text style={[styles.statNum, { color: G }]}>{boardingStatus.stats.boarded}</Text>
                    <Text style={styles.statLabel}>Embarqués</Text>
                  </View>
                  <View style={[styles.statBox, { flex: 1, minWidth: 70, backgroundColor: boardingStatus.stats.absent > 0 ? "#FEF3C7" : "#F9FAFB", borderColor: boardingStatus.stats.absent > 0 ? "#FCD34D" : "#E5E7EB" }]}>
                    <Text style={[styles.statNum, { color: boardingStatus.stats.absent > 0 ? "#D97706" : "#6B7280" }]}>{boardingStatus.stats.absent}</Text>
                    <Text style={styles.statLabel}>Absents</Text>
                  </View>
                  <View style={[styles.statBox, { flex: 1, minWidth: 70 }]}>
                    <Text style={styles.statNum}>{boardingStatus.stats.total}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                </View>
                {/* Guichet / En ligne breakdown */}
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F0FDF4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#BBF7D0" }}>
                    <Ionicons name="storefront-outline" size={13} color={G} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: G_DARK }}>{boardingStatus.stats.guichetCount ?? 0} guichet</Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#BFDBFE" }}>
                    <Ionicons name="globe-outline" size={13} color="#1D4ED8" />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#1E40AF" }}>{boardingStatus.stats.onlineCount ?? 0} en ligne</Text>
                  </View>
                  {(boardingStatus.stats.pending ?? 0) > 0 && (
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#FDE68A" }}>
                      <Ionicons name="time-outline" size={13} color="#D97706" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400E" }}>{boardingStatus.stats.pending} en attente</Text>
                    </View>
                  )}
                </View>

                {/* Progress bar */}
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: "#374151" }}>Progression embarquement</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: G }}>
                      {boardingStatus.stats.total > 0 ? Math.round(boardingStatus.stats.boarded / boardingStatus.stats.total * 100) : 0}%
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                    <View style={{
                      height: "100%",
                      backgroundColor: G,
                      borderRadius: 4,
                      width: `${boardingStatus.stats.total > 0 ? (boardingStatus.stats.boarded / boardingStatus.stats.total * 100) : 0}%`,
                    }} />
                  </View>
                </View>
              </View>

              {/* Departure result banner */}
              {departureResult && (
                <View style={{ backgroundColor: "#ECFDF5", borderRadius: 12, padding: 16, borderWidth: 2, borderColor: G, alignItems: "center", gap: 4 }}>
                  <Ionicons name="checkmark-circle" size={32} color={G} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: G }}>Départ clôturé</Text>
                  <Text style={{ fontSize: 13, color: G_DARK }}>
                    {departureResult.cancelledCount} réservation(s) annulée(s) · {departureResult.freedSeats} siège(s) libéré(s)
                  </Text>
                </View>
              )}

              {/* Release result banner */}
              {releaseResult && (
                <View style={{ backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, borderWidth: 2, borderColor: "#3B82F6", gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="storefront-outline" size={22} color="#1D4ED8" />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#1D4ED8" }}>Places libérées → Guichet</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: "#1E40AF" }}>
                    {releaseResult.freedSeats} siège(s) disponibles au guichet pour revente immédiate
                  </Text>
                  <Text style={{ fontSize: 11, color: "#3B82F6" }}>
                    Si non vendus avant le départ → basculement automatique en ligne
                  </Text>
                </View>
              )}

              {/* ── Absents section with selective release ── */}
              {boardingStatus.stats.absent > 0 && (
                <>
                  {/* Section header with select-all */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="alert-circle" size={16} color="#D97706" />
                      <Text style={[styles.sectionTitle, { color: "#D97706", marginBottom: 0 }]}>
                        Passagers absents ({boardingStatus.stats.absent})
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={toggleSelectAllAbsents}
                      style={{ backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#FCD34D" }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#D97706" }}>
                        {selectedAbsents.size === boardingStatus.passengers.filter(p => !p.boarded).length
                          ? "Désélect. tout"
                          : "Tout sélect."}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Instruction */}
                  <View style={{ backgroundColor: "#FFFBEB", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#FDE68A", flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Ionicons name="information-circle-outline" size={16} color="#D97706" style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, color: "#92400E", flex: 1, lineHeight: 18 }}>
                      Sélectionnez les absents dont vous souhaitez libérer les sièges. Les places seront immédiatement disponibles au guichet pour revente.
                    </Text>
                  </View>

                  {boardingStatus.passengers.filter(p => !p.boarded && p.status !== "pending").map(p => (
                    <AbsentPassengerRow
                      key={p.bookingId}
                      p={p}
                      isSelected={selectedAbsents.has(p.bookingId)}
                      isBoarding={boardingById === p.bookingId}
                      isBoardingDisabled={!!boardingById}
                      onToggle={stableToggleAbsent}
                      onCall={stableCallPassenger}
                      onBoard={stableBoardHandler}
                    />
                  ))}

                  {/* Release to guichet button */}
                  {selectedAbsents.size > 0 && !departureResult && (
                    <TouchableOpacity
                      style={[styles.validateBtn, { backgroundColor: "#1D4ED8" }, releasingSeats && { opacity: 0.6 }]}
                      onPress={releaseAbsentSeats}
                      disabled={releasingSeats}
                    >
                      {releasingSeats ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Ionicons name="storefront-outline" size={20} color="#fff" />
                          <Text style={styles.validateBtnText}>
                            Libérer {selectedAbsents.size} absent{selectedAbsents.size > 1 ? "s" : ""} → Guichet
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Close departure button */}
                  {!departureResult && (
                    <TouchableOpacity
                      style={[styles.validateBtn, { backgroundColor: "#DC2626" }, closingDeparture && { opacity: 0.6 }]}
                      onPress={closeDeparture}
                      disabled={closingDeparture}
                    >
                      {closingDeparture ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Ionicons name="close-circle-outline" size={20} color="#fff" />
                          <Text style={styles.validateBtnText}>
                            Clôturer le départ ({boardingStatus.stats.absent} absent{boardingStatus.stats.absent > 1 ? "s" : ""})
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Embarked section */}
              <Text style={styles.sectionTitle}>
                Embarqués ({boardingStatus.stats.boarded})
              </Text>
              {boardingStatus.passengers.filter(p => p.boarded).length === 0 ? (
                <View style={[styles.resultCard, { alignItems: "center", paddingVertical: 20 }]}>
                  <Ionicons name="people-outline" size={32} color="#D1FAE5" />
                  <Text style={[styles.notFoundSub, { marginTop: 6 }]}>Aucun passager embarqué</Text>
                </View>
              ) : (
                boardingStatus.passengers.filter(p => p.boarded).map(p => (
                  <BoardedPassengerRow
                    key={p.bookingId}
                    p={p}
                    isNew={newPassengerIds.has(p.bookingId)}
                  />
                ))
              )}

              {boardingStatus.stats.absent === 0 && boardingStatus.stats.boarded > 0 && !departureResult && (
                <View style={{ backgroundColor: G_LIGHT, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1.5, borderColor: G }}>
                  <Ionicons name="checkmark-circle" size={32} color={G} />
                  <Text style={{ color: G_DARK, fontWeight: "700", fontSize: 15, marginTop: 6 }}>Tous les passagers sont à bord !</Text>
                  <Text style={{ color: G, fontSize: 12, marginTop: 4 }}>Prêt pour le départ.</Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.resultCard, { alignItems: "center", paddingVertical: 28 }]}>
              <Ionicons name="cloud-offline-outline" size={36} color="#D1FAE5" />
              <Text style={[styles.notFoundSub, { marginTop: 8 }]}>Impossible de charger les données</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => selectedTrip && loadBoardingStatus(selectedTrip.id)}>
                <Text style={styles.retryBtnText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Trip Selector Modal ── */}
      {showTripSelector && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Sélectionner un départ</Text>
              <TouchableOpacity onPress={() => { loadTodayTrips(); }}>
                <Feather name="refresh-cw" size={16} color={G} />
              </TouchableOpacity>
            </View>

            {tripsLoading ? (
              <View style={{ alignItems: "center", padding: 24 }}>
                <ActivityIndicator color={G} size="large" />
                <Text style={{ color: "#6B7280", marginTop: 8 }}>Chargement des trajets…</Text>
              </View>
            ) : todayTrips.length === 0 ? (
              <View style={{ alignItems: "center", padding: 24, gap: 8 }}>
                <Ionicons name="calendar-outline" size={40} color="#D1FAE5" />
                <Text style={{ color: "#6B7280", fontSize: 14, textAlign: "center" }}>
                  Aucun départ prévu aujourd'hui
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: G_LIGHT, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
                  onPress={loadTodayTrips}
                >
                  <Text style={{ color: G, fontWeight: "600", fontSize: 13 }}>Actualiser</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {[...todayTrips]
                  .sort((a, b) => {
                    const pri = (s: string) => s === "boarding" ? 0 : s === "en_route" ? 1 : s === "scheduled" ? 2 : s === "in_progress" ? 1 : 3;
                    return pri(a.status) - pri(b.status) || a.departureTime.localeCompare(b.departureTime);
                  })
                  .map(trip => {
                  const isSelected = selectedTrip?.id === trip.id;
                  const tripStatusColor =
                    trip.status === "en_route" || trip.status === "in_progress" ? G :
                    trip.status === "boarding" ? "#7C3AED" :
                    trip.status === "scheduled" ? "#D97706" :
                    "#6B7280";
                  const tripStatusLabel =
                    trip.status === "en_route" || trip.status === "in_progress" ? "En route" :
                    trip.status === "boarding" ? "Embarquement" :
                    trip.status === "scheduled" ? "Programmé" :
                    trip.status === "completed" ? "Terminé" :
                    trip.status === "arrived" ? "Arrivé" :
                    trip.status ?? "Inconnu";

                  return (
                    <TouchableOpacity
                      key={trip.id}
                      style={[styles.tripCard, isSelected && { borderColor: G, borderWidth: 2, backgroundColor: G_LIGHT }]}
                      onPress={() => selectTrip(trip)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                        <View style={[styles.tripIcon, { backgroundColor: isSelected ? G : G_DARK }]}>
                          <Ionicons name="bus" size={18} color={isSelected ? "#fff" : "#34D399"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.tripBusName, isSelected && { color: G_DARK }]}>{trip.busName}</Text>
                            <View style={{ backgroundColor: isSelected ? G : tripStatusColor + "22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: isSelected ? "#fff" : tripStatusColor }}>{tripStatusLabel}</Text>
                            </View>
                          </View>
                          <Text style={styles.tripRoute}>
                            {trip.from} → {trip.to}
                          </Text>
                          <View style={{ flexDirection: "row", gap: 12, marginTop: 3 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Ionicons name="time-outline" size={11} color="#9CA3AF" />
                              <Text style={styles.tripMeta}>{trip.departureTime}</Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Ionicons name="people-outline" size={11} color="#9CA3AF" />
                              <Text style={styles.tripMeta}>{trip.totalPassengers} passager{trip.totalPassengers > 1 ? "s" : ""}</Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Ionicons name={trip.absentPassengers === 0 ? "checkmark-circle-outline" : "alert-circle-outline"} size={11} color={trip.absentPassengers === 0 ? G : "#D97706"} />
                              <Text style={[styles.tripMeta, { color: trip.absentPassengers === 0 ? G : "#D97706" }]}>
                                {trip.boardedPassengers}/{trip.totalPassengers} à bord
                              </Text>
                            </View>
                          </View>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={22} color={G} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.retryBtn, { marginTop: 12 }]}
              onPress={() => setShowTripSelector(false)}
            >
              <Text style={styles.retryBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Camera connect modal */}
      {showCamConnect && (
        <CameraConnectModal
          trips={todayTrips.map(t => ({
            id: t.id, from: t.from, to: t.to,
            departureTime: t.departureTime, busName: t.busName,
          }))}
          token={token}
          preselectedTrip={camConnectTrip}
          onClose={() => { setShowCamConnect(false); setCamConnectTrip(null); }}
          onConnected={(_trip) => {
            setShowCamConnect(false);
            setCamConnectTrip(null);
          }}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: G_DARK },
  denied: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  deniedText: { fontSize: 16, color: "#EF4444", fontWeight: "600" },

  header: { backgroundColor: G_DARK, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headerIcon: { backgroundColor: G, borderRadius: 10, padding: 8 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#A7F3D0", fontSize: 13, marginTop: 1 },

  tabRow: { flexDirection: "row", gap: 8 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)" },
  tabBtnActive: { backgroundColor: "#fff" },
  tabBtnText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  tabBtnTextActive: { color: G_DARK },

  scroll: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 14 },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },

  card: { backgroundColor: "#fff", borderRadius: 18, padding: 18, elevation: 4, shadowColor: "#059669", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, borderWidth: 1, borderColor: "#F0FDF4" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 14, letterSpacing: -0.2 },

  scanBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 20, paddingHorizontal: 16, borderRadius: 18, shadowColor: G, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.38, shadowRadius: 12, elevation: 7 },
  scanBtnText: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  divText: { fontSize: 12, color: "#9CA3AF" },

  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: G_LIGHT },
  searchBtn: { backgroundColor: G, borderRadius: 8, width: 44, alignItems: "center", justifyContent: "center" },

  centerBox: { alignItems: "center", padding: 24, gap: 10 },
  loadingText: { color: "#6B7280", fontSize: 14 },

  resultCard: { backgroundColor: "#fff", borderRadius: 18, padding: 18, elevation: 5, shadowColor: "#059669", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, gap: 12, borderWidth: 1, borderColor: "#E9FBF2" },
  notFoundCard: { borderWidth: 1.5, borderColor: "#FCA5A5", alignItems: "center", shadowColor: "#EF4444", shadowOpacity: 0.07, elevation: 3 },
  validatedCard: { borderWidth: 2, borderColor: G, shadowColor: G, shadowOpacity: 0.12, elevation: 6 },

  notFoundText: { fontSize: 16, fontWeight: "700", color: "#EF4444", marginTop: 4 },
  notFoundSub: { fontSize: 13, color: "#6B7280", textAlign: "center" },

  validatedBadge: { alignItems: "center", gap: 6 },
  validatedText: { fontSize: 17, fontWeight: "700", color: G },

  passengerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  passengerAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#86EFAC" },
  passengerName: { fontSize: 16, fontWeight: "800", color: "#111827" },
  passengerPhone: { fontSize: 13, color: "#6B7280", marginTop: 2, fontWeight: "500" },
  seatBadge: { backgroundColor: "#ECFDF5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", borderWidth: 1.5, borderColor: G },
  seatText: { fontSize: 20, fontWeight: "800", color: G },
  seatLabel: { fontSize: 10, color: G, fontWeight: "600", marginTop: 2 },

  tripInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  tripInfoText: { fontSize: 13, color: "#374151", flex: 1 },
  tripTime: { fontSize: 13, fontWeight: "600", color: G },

  validateBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 14, shadowColor: G, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  validateBtnDisabled: { opacity: 0.6 },
  validateBtnText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },

  callBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 10 },
  callBtnText: { color: "#0369A1", fontSize: 13, fontWeight: "600" },

  boardBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: G, borderRadius: 10, paddingVertical: 13, shadowColor: G, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  boardBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  retryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  retryBtnText: { color: G, fontSize: 14, fontWeight: "600" },

  tips: { backgroundColor: "#fff", borderRadius: 18, padding: 18, gap: 8, borderWidth: 1, borderColor: "#F0FDF4", shadowColor: "#059669", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  tipsTitle: { fontSize: 13, fontWeight: "800", color: "#374151", marginBottom: 2 },
  tip: { fontSize: 13, color: "#6B7280", lineHeight: 21 },

  cameraWrap: { flex: 1, position: "relative" },
  webCamera: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanBox: { width: 220, height: 220, borderWidth: 3, borderColor: "#34D399", borderRadius: 12 },
  cancelScan: { position: "absolute", top: 20, right: 20 },
  scanHint: { position: "absolute", bottom: 40, alignSelf: "center", color: "#fff", fontSize: 14, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },

  /* ── Trip selector banner ── */
  selectedTripBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10, borderWidth: 1, borderColor: "rgba(52,211,153,0.3)" },
  selectedTripText: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "500" },
  selectedTripCount: { backgroundColor: "rgba(52,211,153,0.2)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  selectedTripCountText: { color: "#34D399", fontSize: 11, fontWeight: "700" },
  selectTripPrompt: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(252,211,77,0.1)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: "rgba(252,211,77,0.3)" },
  selectTripPromptText: { color: "#FCD34D", fontSize: 12, fontWeight: "600" },

  /* ── Trip selector modal ── */
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 100 },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHandle: { width: 36, height: 4, backgroundColor: "#D1D5DB", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },

  /* ── Trip cards in selector ── */
  tripCard: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  tripIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tripBusName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripRoute: { fontSize: 13, color: "#374151", marginTop: 2 },
  tripMeta: { fontSize: 11, color: "#6B7280" },

  /* ── Boarding stats ── */
  statBox: { alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingVertical: 8, backgroundColor: "#F9FAFB" },
  statNum: { fontSize: 22, fontWeight: "800", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },
});

/* ══════════════════════════════════════════════════════════════
   Composants mémorisés — ne se re-rendent QUE si leurs props changent.
   La merge strategy + React.memo combinées = aucune ligne ne
   re-rend inutilement lors d'un poll silencieux.
════════════════════════════════════════════════════════════════ */

type BoardedRowProps = {
  p: BoardingPassenger;
  isNew: boolean;
};
const BoardedPassengerRow = React.memo(function BoardedPassengerRow({ p, isNew }: BoardedRowProps) {
  const isGuichet = (p.bookingType ?? "en-ligne") === "guichet";
  const initials = p.name.split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <View style={{
      backgroundColor: isNew ? "#F0FDF4" : "#FAFFFE",
      borderRadius: 14,
      borderWidth: isNew ? 2 : 1,
      borderColor: isNew ? "#34D399" : "#D1FAE5",
      marginBottom: 8,
      overflow: "hidden",
    }}>
      {/* Top accent bar */}
      <View style={{ height: 3, backgroundColor: isNew ? "#059669" : "#6EE7B7" }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
        {/* Avatar circle */}
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: isNew ? "#059669" : G_LIGHT,
          alignItems: "center", justifyContent: "center",
          borderWidth: 2, borderColor: isNew ? "#34D399" : "#A7F3D0",
        }}>
          {isNew
            ? <Ionicons name="star" size={20} color="#fff" />
            : <Text style={{ fontSize: 15, fontWeight: "900", color: G }}>{initials || "?"}</Text>
          }
        </View>

        {/* Info */}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827" }}>{p.name}</Text>
            {isNew && (
              <View style={{ backgroundColor: "#059669", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 0.8 }}>NOUVEAU</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 12, color: "#6B7280" }}>{p.phone}</Text>
          <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
            {p.seats.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F0FDF4", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#BBF7D0" }}>
                <Ionicons name="grid-outline" size={10} color={G} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: G_DARK }}>
                  {p.seats.join(", ")}
                </Text>
              </View>
            )}
            <View style={{ backgroundColor: isGuichet ? "#ECFDF5" : "#EFF6FF", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: isGuichet ? "#BBF7D0" : "#BFDBFE" }}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: isGuichet ? G_DARK : "#1E40AF" }}>
                {isGuichet ? "GUICHET" : "EN LIGNE"}
              </Text>
            </View>
            {p.paxCount > 1 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F3F4F6", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 }}>
                <Ionicons name="people-outline" size={10} color="#6B7280" />
                <Text style={{ fontSize: 9, fontWeight: "700", color: "#6B7280" }}>{p.paxCount} pax</Text>
              </View>
            )}
          </View>
        </View>

        {/* Status badge */}
        <View style={{ alignItems: "center", gap: 4 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#059669", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
          <Text style={{ fontSize: 9, fontWeight: "800", color: G_DARK }}>À BORD</Text>
        </View>
      </View>
    </View>
  );
});

type AbsentRowProps = {
  p: BoardingPassenger;
  isSelected: boolean;
  isBoarding: boolean;
  isBoardingDisabled: boolean;
  onToggle: (id: string) => void;
  onCall: (phone: string) => void;
  onBoard: (p: BoardingPassenger) => void;
};
const AbsentPassengerRow = React.memo(function AbsentPassengerRow({
  p, isSelected, isBoarding, isBoardingDisabled, onToggle, onCall, onBoard,
}: AbsentRowProps) {
  const isGuichet = p.bookingType === "guichet";
  const initials = p.name.split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <View style={{
      backgroundColor: isSelected ? "#EFF6FF" : "#FFFBEB",
      borderRadius: 14,
      borderWidth: isSelected ? 2 : 1.5,
      borderColor: isSelected ? "#3B82F6" : "#FCD34D",
      marginBottom: 8,
      overflow: "hidden",
    }}>
      {/* Top accent bar */}
      <View style={{ height: 3, backgroundColor: isSelected ? "#3B82F6" : "#F59E0B" }} />

      <TouchableOpacity activeOpacity={0.8} onPress={() => onToggle(p.bookingId)} style={{ padding: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Checkbox */}
          <View style={{
            width: 26, height: 26, borderRadius: 8, borderWidth: 2,
            borderColor: isSelected ? "#3B82F6" : "#D97706",
            backgroundColor: isSelected ? "#3B82F6" : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {isSelected && <Ionicons name="checkmark" size={15} color="#fff" />}
          </View>

          {/* Avatar */}
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: isSelected ? "#DBEAFE" : "#FEF3C7",
            alignItems: "center", justifyContent: "center",
            borderWidth: 2, borderColor: isSelected ? "#93C5FD" : "#FDE68A",
          }}>
            <Text style={{ fontSize: 15, fontWeight: "900", color: isSelected ? "#1D4ED8" : "#D97706" }}>
              {initials || "?"}
            </Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827" }}>{p.name}</Text>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>{p.phone}</Text>
            <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
              {p.seats.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#FDE68A" }}>
                  <Ionicons name="grid-outline" size={10} color="#D97706" />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#92400E" }}>{p.seats.join(", ")}</Text>
                </View>
              )}
              <View style={{ backgroundColor: isGuichet ? "#ECFDF5" : "#EFF6FF", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: isGuichet ? "#BBF7D0" : "#BFDBFE" }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: isGuichet ? G_DARK : "#1E40AF" }}>
                  {isGuichet ? "GUICHET" : "EN LIGNE"}
                </Text>
              </View>
            </View>
          </View>

          {/* Absent badge */}
          <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: "#FDE68A", alignItems: "center" }}>
            <Ionicons name="alert-circle" size={14} color="#D97706" />
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#D97706", marginTop: 2 }}>ABSENT</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#E0F2FE", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#BAE6FD", flex: 1 }}
          onPress={() => onCall(p.phone)}
        >
          <Ionicons name="call-outline" size={14} color="#0369A1" />
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#0369A1" }}>Appeler</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center" }}>Réf: {p.bookingRef}</Text>
        </View>
        <TouchableOpacity
          style={{
            flexDirection: "row", alignItems: "center", gap: 5,
            backgroundColor: G, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
            opacity: isBoarding ? 0.6 : 1, flex: 1, justifyContent: "center",
          }}
          onPress={() => onBoard(p)}
          disabled={isBoardingDisabled}
        >
          {isBoarding
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>Embarquer</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
});
