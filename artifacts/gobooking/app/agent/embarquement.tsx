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
import { notifyEmbarquementValide } from "@/services/notificationService";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus, isAlreadyScanned, markAsScanned } from "@/utils/offline";
import { validateQR, qrErrorMessage } from "@/utils/qr";
import OfflineBanner from "@/components/OfflineBanner";
import { useAgentGps } from "@/utils/useAgentGps";

const G       = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK  = "#065F46";

interface Passenger {
  reservationId: string;
  name: string;
  phone: string;
  seat: string;
  status: string;
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
}

interface BoardingStatus {
  trip: {
    id: string; from: string; to: string;
    date: string; departureTime: string;
    busName: string; status: string; totalSeats: number;
  };
  passengers: BoardingPassenger[];
  stats: {
    total: number; boarded: number; absent: number;
    totalSeats: number; boardedSeats: number; absentSeats: number;
  };
}

type MainTab = "billets" | "en_route" | "depart";

export default function EmbarquementScreen() {
  const { user, token, logout } = useAuth();
  const networkStatus   = useNetworkStatus(BASE_URL);

  const isEmbarquementAgent = !user?.agentRole ||
    user.agentRole === "agent_embarquement" || user.agentRole === "embarquement";

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

  /* ── Select a trip and load its boarding status ─── */
  const selectTrip = async (trip: TodayTrip) => {
    setSelectedTrip(trip);
    setActiveTripIdForGps(trip.id);
    setShowTripSelector(false);
    setDepartureResult(null);
    await loadBoardingStatus(trip.id);
  };

  /* ── Load boarding status for a trip ─────────────── */
  const loadBoardingStatus = async (tripId: string) => {
    setBoardingLoading(true);
    try {
      const data = await apiFetch<BoardingStatus>(`/agent/trip/${tripId}/boarding-status`, { token: token ?? undefined });
      setBoardingStatus(data);
    } catch {
      setBoardingStatus(null);
    } finally {
      setBoardingLoading(false);
    }
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
            onPress={() => setActiveTab("billets")}
          >
            <Ionicons name="ticket-outline" size={13} color={activeTab === "billets" ? G_DARK : "rgba(255,255,255,0.6)"} />
            <Text style={[styles.tabBtnText, activeTab === "billets" && styles.tabBtnTextActive]}>Billets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "en_route" && styles.tabBtnActive]}
            onPress={handleEnRouteTabPress}
          >
            <Feather name="radio" size={13} color={activeTab === "en_route" ? G_DARK : "rgba(255,255,255,0.6)"} />
            <Text style={[styles.tabBtnText, activeTab === "en_route" && styles.tabBtnTextActive]}>
              En Route {enRouteList.filter(p => p.status === "accepted").length > 0
                ? `(${enRouteList.filter(p => p.status === "accepted").length})`
                : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "depart" && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab("depart");
              if (selectedTrip) loadBoardingStatus(selectedTrip.id);
            }}
          >
            <Ionicons name="checkmark-done" size={13} color={activeTab === "depart" ? G_DARK : "rgba(255,255,255,0.6)"} />
            <Text style={[styles.tabBtnText, activeTab === "depart" && styles.tabBtnTextActive]}>
              Départ{boardingStatus?.stats?.absent ? ` (${boardingStatus.stats.absent})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
                  <Ionicons name="person" size={24} color={G} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passengerName}>{found.name}</Text>
                  <Text style={styles.passengerPhone}>{found.phone}</Text>
                </View>
                <View style={styles.seatBadge}>
                  <Text style={styles.seatText}>{found.seat || "—"}</Text>
                  <Text style={styles.seatLabel}>Siège</Text>
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
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                  <TouchableOpacity onPress={() => loadBoardingStatus(selectedTrip.id)} style={{ padding: 6 }}>
                    <Feather name="refresh-cw" size={16} color={G} />
                  </TouchableOpacity>
                </View>

                {/* Stats row */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={[styles.statBox, { flex: 1, backgroundColor: G_LIGHT, borderColor: G }]}>
                    <Text style={[styles.statNum, { color: G }]}>{boardingStatus.stats.boarded}</Text>
                    <Text style={styles.statLabel}>Embarqués</Text>
                  </View>
                  <View style={[styles.statBox, { flex: 1, backgroundColor: boardingStatus.stats.absent > 0 ? "#FEF3C7" : "#F9FAFB", borderColor: boardingStatus.stats.absent > 0 ? "#FCD34D" : "#E5E7EB" }]}>
                    <Text style={[styles.statNum, { color: boardingStatus.stats.absent > 0 ? "#D97706" : "#6B7280" }]}>{boardingStatus.stats.absent}</Text>
                    <Text style={styles.statLabel}>Absents</Text>
                  </View>
                  <View style={[styles.statBox, { flex: 1 }]}>
                    <Text style={styles.statNum}>{boardingStatus.stats.total}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
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

              {/* Absents section */}
              {boardingStatus.stats.absent > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: "#D97706" }]}>
                    Passagers absents ({boardingStatus.stats.absent})
                  </Text>
                  {boardingStatus.passengers.filter(p => !p.boarded).map(p => (
                    <View key={p.bookingId} style={[styles.resultCard, { borderColor: "#FCD34D", borderWidth: 1.5 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={[styles.passengerAvatar, { backgroundColor: "#FEF3C7" }]}>
                          <Ionicons name="person" size={22} color="#D97706" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.passengerName}>{p.name}</Text>
                          <Text style={styles.passengerPhone}>{p.phone}</Text>
                          {p.seats.length > 0 && <Text style={{ fontSize: 11, color: "#9CA3AF" }}>Siège(s): {p.seats.join(", ")}</Text>}
                        </View>
                        <View style={{ backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#D97706" }}>Absent</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity style={styles.callBtn} onPress={() => callPassenger(p.phone)}>
                          <Ionicons name="call-outline" size={15} color="#0369A1" />
                          <Text style={styles.callBtnText}>Appeler</Text>
                        </TouchableOpacity>
                        <Text style={{ flex: 1, fontSize: 11, color: "#6B7280", textAlignVertical: "center", alignSelf: "center" }}>
                          Réf: {p.bookingRef}
                        </Text>
                      </View>
                    </View>
                  ))}

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
                  <View key={p.bookingId} style={[styles.resultCard, { borderColor: "#6EE7B7", borderWidth: 1.5 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={styles.passengerAvatar}>
                        <Ionicons name="checkmark-circle" size={22} color={G} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.passengerName}>{p.name}</Text>
                        <Text style={styles.passengerPhone}>{p.phone}</Text>
                        {p.seats.length > 0 && <Text style={{ fontSize: 11, color: "#9CA3AF" }}>Siège(s): {p.seats.join(", ")}</Text>}
                      </View>
                      <View style={{ backgroundColor: G_LIGHT, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: G }}>Embarqué ✓</Text>
                      </View>
                    </View>
                  </View>
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

      {/* ── En Route tab ── */}
      {activeTab === "en_route" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Scan en-route QR */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scanner QR passager en route</Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
              Scannez le QR code affiché sur le téléphone du passager
            </Text>
            <TouchableOpacity style={[styles.scanBtn, { backgroundColor: "#0369A1" }]} onPress={openEnRouteCamera}>
              <Ionicons name="qr-code-outline" size={24} color="#fff" />
              <Text style={styles.scanBtnText}>Scanner QR en route</Text>
            </TouchableOpacity>
          </View>

          {/* Trip info */}
          {activeTripId ? (
            <View style={{ backgroundColor: G_LIGHT, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="radio" size={14} color={G} />
              <Text style={{ color: G_DARK, fontSize: 12, fontWeight: "600" }}>Trajet actif : {activeTripId}</Text>
              <TouchableOpacity onPress={async () => { const tid = await fetchActiveTripId(); await loadEnRoute(tid); }} style={{ marginLeft: "auto" }}>
                <Feather name="refresh-cw" size={14} color={G} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: 14, alignItems: "center", gap: 6 }}>
              <Feather name="alert-circle" size={22} color="#D97706" />
              <Text style={{ color: "#92400E", fontWeight: "600", fontSize: 13 }}>Aucun trajet en cours trouvé</Text>
              <Text style={{ color: "#92400E", fontSize: 12, textAlign: "center" }}>Démarrez un trajet dans votre dashboard ou vérifiez votre bus.</Text>
              <TouchableOpacity style={{ marginTop: 6, backgroundColor: "#D97706", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
                onPress={async () => { const tid = await fetchActiveTripId(); await loadEnRoute(tid); }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Actualiser</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Header + refresh */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.sectionTitle}>
              Passagers confirmés ({enRouteList.length})
            </Text>
            <TouchableOpacity onPress={() => loadEnRoute(activeTripId)} style={{ padding: 6 }}>
              <Feather name="refresh-cw" size={16} color={G} />
            </TouchableOpacity>
          </View>

          {enRouteLoading && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={G} />
              <Text style={styles.loadingText}>Chargement…</Text>
            </View>
          )}

          {!enRouteLoading && enRouteList.length === 0 && activeTripId && (
            <View style={[styles.resultCard, { alignItems: "center", paddingVertical: 28 }]}>
              <Feather name="users" size={36} color="#D1FAE5" />
              <Text style={[styles.notFoundText, { color: "#64748B" }]}>Aucun passager en route</Text>
              <Text style={styles.notFoundSub}>Les demandes acceptées apparaîtront ici</Text>
            </View>
          )}

          {enRouteList.map(passenger => {
            const isEmbarque = passenger.status === "embarqué";
            const isBusy     = boardingId === passenger.id;

            return (
              <View key={passenger.id} style={[
                styles.resultCard,
                isEmbarque && { borderWidth: 1.5, borderColor: "#6EE7B7" },
              ]}>
                {/* Name + status */}
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={styles.passengerAvatar}>
                    <Ionicons name="person" size={22} color={isEmbarque ? G_DARK : G} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.passengerName}>{passenger.clientName}</Text>
                    <Text style={styles.passengerPhone}>{passenger.clientPhone}</Text>
                  </View>
                  <View style={{
                    backgroundColor: isEmbarque ? "#ECFDF5" : "#FEF3C7",
                    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: isEmbarque ? G : "#D97706" }}>
                      {isEmbarque ? "Embarqué ✓" : "Confirmé"}
                    </Text>
                  </View>
                </View>

                {/* Boarding info */}
                <View style={{ flexDirection: "row", gap: 14, paddingLeft: 4, marginTop: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="location-outline" size={13} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: "#374151" }}>{passenger.boardingPoint}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="people-outline" size={13} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: "#374151" }}>
                      {passenger.seatsRequested} siège{passenger.seatsRequested > 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>

                {/* Action buttons */}
                {!isEmbarque && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => callPassenger(passenger.clientPhone)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call-outline" size={15} color="#0369A1" />
                      <Text style={styles.callBtnText}>Appeler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.boardBtn, isBusy && { opacity: 0.6 }]}
                      onPress={() => boardEnRoute(passenger.id)}
                      disabled={isBusy}
                      activeOpacity={0.8}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={15} color="#fff" />
                          <Text style={styles.boardBtnText}>Embarquer</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {isEmbarque && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: G_LIGHT, borderRadius: 8, padding: 8, marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color={G} />
                    <Text style={{ color: G_DARK, fontSize: 12, fontWeight: "500" }}>Passager embarqué avec succès</Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Instructions en route</Text>
            <Text style={styles.tip}>• Les passagers acceptés apparaissent automatiquement</Text>
            <Text style={styles.tip}>• Scannez leur QR ou appuyez sur "Embarquer"</Text>
            <Text style={styles.tip}>• Appelez le passager si besoin pour coordonner le point d'arrêt</Text>
          </View>
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
                {todayTrips.map(trip => {
                  const isSelected = selectedTrip?.id === trip.id;
                  const tripStatusColor = trip.status === "en_route" ? G : trip.status === "scheduled" ? "#D97706" : "#6B7280";
                  const tripStatusLabel = trip.status === "en_route" ? "En route" : trip.status === "scheduled" ? "Programmé" : trip.status;

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

      {/* Rapport button */}
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#BE123C", borderRadius: 14, paddingVertical: 14, margin: 16, marginTop: 0, shadowColor: "#BE123C", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        onPress={() => router.push("/agent/rapport" as never)}
      >
        <Feather name="alert-triangle" size={16} color="#fff" />
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>Faire un rapport</Text>
      </TouchableOpacity>
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

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 14 },

  scanBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 20, paddingHorizontal: 16, borderRadius: 16, shadowColor: G, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  scanBtnText: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  divText: { fontSize: 12, color: "#9CA3AF" },

  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: G_LIGHT },
  searchBtn: { backgroundColor: G, borderRadius: 8, width: 44, alignItems: "center", justifyContent: "center" },

  centerBox: { alignItems: "center", padding: 24, gap: 10 },
  loadingText: { color: "#6B7280", fontSize: 14 },

  resultCard: { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 10 },
  notFoundCard: { borderWidth: 1.5, borderColor: "#FCA5A5", alignItems: "center" },
  validatedCard: { borderWidth: 2, borderColor: G },

  notFoundText: { fontSize: 16, fontWeight: "700", color: "#EF4444", marginTop: 4 },
  notFoundSub: { fontSize: 13, color: "#6B7280", textAlign: "center" },

  validatedBadge: { alignItems: "center", gap: 6 },
  validatedText: { fontSize: 17, fontWeight: "700", color: G },

  passengerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  passengerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: G_LIGHT, alignItems: "center", justifyContent: "center" },
  passengerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  passengerPhone: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  seatBadge: { backgroundColor: G_LIGHT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  seatText: { fontSize: 18, fontWeight: "800", color: G },
  seatLabel: { fontSize: 10, color: G, fontWeight: "500", marginTop: 1 },

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

  tips: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 6 },
  tipsTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 4 },
  tip: { fontSize: 13, color: "#6B7280", lineHeight: 20 },

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
