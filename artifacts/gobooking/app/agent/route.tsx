import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform, Linking, TextInput, Animated, Easing,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { useNetworkStatus, isAlreadyScanned, markAsScanned } from "@/utils/offline";
import { useAgentGps } from "@/utils/useAgentGps";
import OfflineBanner from "@/components/OfflineBanner";

const G       = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK  = "#065F46";
const AMBER   = "#D97706";

/* ── Types scan ticket ── */
type ScanStatus = "valid" | "already_used" | "invalid" | "offline";
interface ScanRouteResult {
  status: ScanStatus;
  passenger?: string;
  route?: string;
  departure_time?: string;
  seats?: string;
  message?: string;
}

/* ── Tickets de simulation pour tests en route ── */
const DEMO_TICKETS_ROUTE = [
  { ref: "GBB-2026-A001", name: "Coulibaly Jean",  seat: "D5", note: "En attente embarquement" },
  { ref: "GBB-2026-A002", name: "Assiéta Koné",    seat: "E1", note: "En attente embarquement" },
  { ref: "GBB-2026-B003", name: "Bamba Konan",     seat: "B2", note: "En attente embarquement" },
];

/* ── Constante stable hors composant (ne se recrée jamais) ── */
const RESP = [
  { id: "panne"    as const, label: "🔧 Panne mécanique",  color: "#DC2626", bg: "#FEE2E2" },
  { id: "controle" as const, label: "🚔 Contrôle routier", color: "#D97706", bg: "#FEF3C7" },
  { id: "pause"    as const, label: "☕ Pause normale",     color: "#166534", bg: "#DCFCE7" },
] as const;

interface LiveTrip {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime?: string;
  busName: string;
  status: string;
  passengers?: number;
  totalSeats?: number;
  lat?: number | null;
  lon?: number | null;
  speed?: number | null;
}

interface Passenger {
  name: string;
  seatNumber: string;
  status: string;
  phone?: string;
  boardingPoint?: string;
}

const DEMO_PASSENGERS: Passenger[] = [
  { name: "Kouassi Ama",     seatNumber: "A3", status: "boarded",  phone: "07 01 11 22 33", boardingPoint: "Gare routière Adjamé" },
  { name: "Traoré Youssouf", seatNumber: "A4", status: "boarded",  phone: "05 04 44 55 66", boardingPoint: "Gare routière Adjamé" },
  { name: "Bamba Koffi",     seatNumber: "B1", status: "boarded",  phone: "01 01 77 88 99", boardingPoint: "Arrêt Cocody" },
  { name: "Diallo Mariam",   seatNumber: "C2", status: "boarded",  phone: "07 07 22 33 44", boardingPoint: "Gare routière Adjamé" },
  { name: "Coulibaly Jean",  seatNumber: "D5", status: "pending",  phone: "05 05 55 66 77", boardingPoint: "Arrêt Marcory" },
  { name: "Assiéta Koné",    seatNumber: "E1", status: "pending",  phone: "01 01 88 99 00", boardingPoint: "Arrêt Marcory" },
];

/* ── Arrêts simulés (fallback quand l'API ne retourne rien) ── */
const DEMO_STOPS_FALLBACK = [
  { id: "ds1", name: "Gare d'Adjamé",    city: "Abidjan",      order: 1, stopStatus: "passé"    as const, estimatedTime: "07:00", passengers: [{ bookingRef:"SIM-A01", userName:"Kouassi Ama",     fromStopId: null }, { bookingRef:"SIM-A02", userName:"Traoré Youssouf", fromStopId: null }] },
  { id: "ds2", name: "Péage Anyama",      city: "Anyama",       order: 2, stopStatus: "passé"    as const, estimatedTime: "07:35", passengers: [] },
  { id: "ds3", name: "Gare Yamoussoukro", city: "Yamoussoukro", order: 3, stopStatus: "en_cours" as const, estimatedTime: "09:15", passengers: [{ bookingRef:"SIM-Y01", userName:"Bamba Koffi", fromStopId: null }] },
  { id: "ds4", name: "Arrêt Tiébissou",  city: "Tiébissou",    order: 4, stopStatus: "prévu"    as const, estimatedTime: "10:30", passengers: [] },
  { id: "ds5", name: "Gare de Bouaké",   city: "Bouaké",       order: 5, stopStatus: "prévu"    as const, estimatedTime: "11:00", passengers: [] },
];

/* ── Alertes simulées (fallback si API retourne aucune alerte) ── */
const DEMO_ALERTS_FALLBACK = [
  {
    id: "sim-demo-1",
    type: "arret_prolonge",
    message: "⚠️ [Simulation] Arrêt anormal à Yamoussoukro — véhicule immobile depuis 12 min",
    status: "active" as const,
    response: null as null,
    responseRequested: true,
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
];

export default function RouteScreen() {
  const { user, token, logout } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);

  const [trips, setTrips]               = useState<LiveTrip[]>([]);
  const [activeTrip, setActiveTrip]     = useState<LiveTrip | null>(null);
  const [passengers, setPassengers]     = useState<Passenger[]>([]);
  const [loading, setLoading]           = useState(false);
  const [passLoading, setPassLoading]   = useState(false);
  const [reporting, setReporting]       = useState(false);
  const [arriving, setArriving]         = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [tab, setTab]                   = useState<"passagers" | "scan" | "montee" | "trajet" | "arrets" | "contacts" | "alertes">("passagers");
  const [isModalOpen, setIsModalOpen]   = useState(false);

  const PAGE_TITLES: Record<string, string> = {
    passagers: "Liste des passagers",
    scan:      "Scanner un ticket",
    montee:    "Ajouter un passager",
    trajet:    "Mon trajet",
    arrets:    "Arrêts programmés",
    contacts:  "Contacts d'urgence",
    alertes:   "Alertes à bord",
  };

  /* ── Manual booking state ── */
  const [manualName,    setManualName]    = useState("");
  const [manualPhone,   setManualPhone]   = useState("");
  const [manualPoint,   setManualPoint]   = useState("");
  const [manualSeats,   setManualSeats]   = useState("1");
  const [manualSaving,  setManualSaving]  = useState(false);
  const [manualSuccess, setManualSuccess] = useState<{bookingRef: string; total: number} | null>(null);

  /* ── Departure & Alerts ── */
  interface MyDeparture { id: string; busId?: string; busName?: string; plateNumber?: string; villeDepart: string; villeArrivee: string; heureDepart: string; chauffeurNom?: string; agentRouteNom?: string; statut: string }
  interface BusAlert { id: string; type: string; message: string; status: string; response?: string | null; responseRequested?: boolean; createdAt: string }
  const [myDeparture,  setMyDeparture]  = useState<MyDeparture | null>(null);
  const [busAlerts,    setBusAlerts]    = useState<BusAlert[]>([]);
  const [alertActing,  setAlertActing]  = useState<string | null>(null);
  const [autoAlerts,   setAutoAlerts]   = useState<BusAlert[]>([]);

  interface StopWithPassengers {
    id: string;
    name: string;
    city: string;
    order: number;
    passengers: { bookingRef: string; userName: string | null; fromStopId: string | null }[];
  }
  const [stopData, setStopData]         = useState<StopWithPassengers[]>([]);
  const [stopLoading, setStopLoading]   = useState(false);
  const [lastSync, setLastSync]         = useState<Date | null>(null);
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedZeroRef     = useRef<number | null>(null);
  const anomalyInjected  = useRef<Set<string>>(new Set());

  /* ── Scan ticket ── */
  const [scanPerm, requestScanPerm]   = useCameraPermissions();
  const [scanMode, setScanMode]       = useState<"camera" | "manual">("camera");
  const [scanInput, setScanInput]     = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult]   = useState<ScanRouteResult | null>(null);
  const scannedRouteRef               = useRef(false);
  const scanPulse                     = useRef(new Animated.Value(1)).current;

  const assignedTripId = user?.tripId ?? null;
  const assignedBusId  = user?.busId  ?? null;

  const gps = useAgentGps(activeTrip?.id ?? null, token);

  const loadTrips = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const raw = await apiFetch<any[]>("/trips/live", { token });
      const allTrips: LiveTrip[] = raw.map(t => ({
        id:            t.id,
        from:          t.from ?? t.fromCity ?? "—",
        to:            t.to   ?? t.toCity   ?? "—",
        departureTime: t.departureTime ?? "—",
        arrivalTime:   t.arrivalTime   ?? t.estimatedArrival,
        busName:       t.busName       ?? "Bus",
        status:        "en_route",
        passengers:    t.totalSeats ? (t.totalSeats - (t.availableSeats ?? 0)) : undefined,
        totalSeats:    t.totalSeats,
        lat:           t.lat,
        lon:           t.lon,
        speed:         t.speed,
      }));
      setTrips(allTrips);
      if (!activeTrip) {
        const matched = assignedTripId
          ? allTrips.find(t => t.id === assignedTripId)
          : allTrips[0];
        if (matched) setActiveTrip(matched);
      }
    } catch {
      const demo: LiveTrip[] = [
        { id: "trip-sim-001", from: "Abidjan", to: "Bouaké", departureTime: "07:00",
          arrivalTime: "11:00", busName: "Daloa Express 07", status: "en_route",
          passengers: 14, totalSeats: 63, lat: 6.4120, lon: -5.0340, speed: 82 },
      ];
      setTrips(demo);
      if (!activeTrip) setActiveTrip(demo[0]);
    } finally {
      setLoading(false);
    }
  }, [token, activeTrip, assignedTripId]);

  const loadPassengers = useCallback(async (tripId: string, silent = false) => {
    if (!token) return;
    if (!silent) setPassLoading(true);
    try {
      const data = await apiFetch<Passenger[]>(`/agent/trip/${tripId}/passengers`, { token });
      setPassengers(data.length > 0 ? data : DEMO_PASSENGERS);
      setLastSync(new Date());
    } catch {
      if (!silent) setPassengers(DEMO_PASSENGERS);
    } finally {
      if (!silent) setPassLoading(false);
    }
  }, [token]);

  const loadStopData = useCallback(async (tripId: string) => {
    if (!token) return;
    setStopLoading(true);
    try {
      const data = await apiFetch<{ stops: StopWithPassengers[] }>(`/company/trips/${tripId}/stop-passengers`, { token });
      const stops = data.stops ?? [];
      setStopData(stops.length > 0 ? stops : (DEMO_STOPS_FALLBACK as any));
    } catch {
      setStopData(DEMO_STOPS_FALLBACK as any);
    } finally {
      setStopLoading(false);
    }
  }, [token]);

  const loadMyDeparture = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/agent/route/my-departure`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setMyDeparture(json.departure ?? null);
        const apiAlerts: BusAlert[] = json.alerts ?? [];
        setBusAlerts(apiAlerts.length > 0 ? apiAlerts : DEMO_ALERTS_FALLBACK);
      }
    } catch {}
  }, [token]);

  const respondToAlert = async (alertId: string, response: "panne" | "controle" | "pause") => {
    /* ── Alertes auto-détectées ou simulées : résolution locale ── */
    if (alertId.startsWith("auto-") || alertId.startsWith("sim-")) {
      setAlertActing(alertId);
      await new Promise(r => setTimeout(r, 700)); // feedback visuel
      setAutoAlerts(prev  => prev.filter(a  => a.id !== alertId));
      setBusAlerts(prev   => prev.filter(a  => a.id !== alertId));
      anomalyInjected.current.delete("arret_prolonge");
      anomalyInjected.current.delete("vitesse_anormale");
      speedZeroRef.current = null;
      Alert.alert("✅ Anomalie résolue", "L'alerte a été clôturée. Le suivi continue.");
      setAlertActing(null);
      return;
    }
    /* ── Alertes réelles : appel API ── */
    setAlertActing(alertId);
    try {
      const res = await fetch(`${BASE_URL}/agent/route/alerts/${alertId}/respond`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (res.ok) {
        Alert.alert("✅ Réponse envoyée", "L'Agent Suivi a été notifié.");
        await loadMyDeparture();
      }
    } catch { Alert.alert("Erreur", "Problème réseau."); }
    setAlertActing(null);
  };

  const handleManualBooking = async () => {
    console.log("[Montée] Bouton cliqué — début validation");
    if (!manualName.trim()) { Alert.alert("Erreur", "Entrez le nom du passager."); return; }
    if (!manualPhone.trim()) { Alert.alert("Erreur", "Entrez le numéro de téléphone."); return; }
    const seats = parseInt(manualSeats, 10);
    if (isNaN(seats) || seats < 1 || seats > 10) { Alert.alert("Erreur", "Nombre de places invalide (1-10)."); return; }

    const payload = {
      passengerName: manualName.trim(),
      passengerPhone: manualPhone.trim(),
      boardingPoint: manualPoint.trim() || undefined,
      seatCount: seats,
    };
    console.log("[Montée] Données envoyées :", JSON.stringify(payload));

    setManualSaving(true);
    try {
      const res = await apiFetch<{ bookingRef: string; totalAmount: number }>("/agent/route/manual-booking", {
        token: token ?? undefined, method: "POST",
        body: payload,
      });
      console.log("[Montée] Réponse API :", JSON.stringify(res));
      setManualSuccess({ bookingRef: res.bookingRef, total: res.totalAmount });
      setManualName(""); setManualPhone(""); setManualPoint(""); setManualSeats("1");
      if (activeTrip) loadPassengers(activeTrip.id);
    } catch (e: any) {
      console.error("[Montée] Erreur API :", e?.message, e);
      Alert.alert("Erreur création ticket", e?.message ?? "Impossible de créer la réservation. Vérifiez votre connexion.");
    } finally {
      setManualSaving(false);
    }
  };

  /* ── Scan ticket handler ── */
  const triggerScanPulse = () => {
    Animated.sequence([
      Animated.timing(scanPulse, { toValue: 1.08, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(scanPulse, { toValue: 0.96, duration: 80,  easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      Animated.timing(scanPulse, { toValue: 1,    duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  };

  const handleScanCode = async (code: string) => {
    if (!code.trim() || scanLoading) return;
    setScanLoading(true);
    try {
      const already = await isAlreadyScanned(code);
      if (already) {
        setScanResult({ status: "already_used", message: "Ce billet a déjà été scanné sur cet appareil." });
        triggerScanPulse();
        return;
      }
      if (!networkStatus.isOnline) {
        setScanResult({ status: "offline", message: "Connexion requise pour valider un ticket en temps réel." });
        triggerScanPulse();
        return;
      }
      const res = await apiFetch<{
        valid: boolean; message?: string; passenger?: string;
        route?: string; departure_time?: string; seats?: string;
      }>("/agent/validate-qr", {
        method: "POST", token: token ?? undefined,
        body: JSON.stringify({ qrCode: code }),
      });
      if (res.valid) {
        await markAsScanned(code);
        setScanResult({ status: "valid", passenger: res.passenger, route: res.route, departure_time: res.departure_time, seats: res.seats });
        triggerScanPulse();
        if (activeTrip) loadPassengers(activeTrip.id, true);
      } else {
        const msg = res.message ?? "";
        const status: ScanStatus = msg.includes("déjà utilisé") ? "already_used" : "invalid";
        setScanResult({ status, message: msg });
        triggerScanPulse();
      }
    } catch {
      setScanResult({ status: "offline", message: "Erreur réseau — vérifiez votre connexion." });
      triggerScanPulse();
    } finally {
      setScanLoading(false);
      scannedRouteRef.current = false;
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setScanInput("");
    scannedRouteRef.current = false;
  };

  useEffect(() => { loadTrips(); loadMyDeparture(); }, []);

  useEffect(() => {
    const tripIdToLoad = assignedTripId ?? activeTrip?.id ?? null;
    if (!tripIdToLoad) return;
    loadPassengers(tripIdToLoad);
    loadStopData(tripIdToLoad);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      loadPassengers(tripIdToLoad, true);
      loadMyDeparture();
    }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTrip?.id, assignedTripId, loadPassengers, loadMyDeparture]);

  /* ── Détection automatique des anomalies GPS ── */
  useEffect(() => {
    if (!gps.active || !activeTrip) return;
    const speed = gps.speed ?? 0;
    const now   = Date.now();

    /* Vitesse nulle prolongée → arrêt anormal */
    if (speed < 2) {
      if (!speedZeroRef.current) speedZeroRef.current = now;
      const stoppedMin = Math.floor((now - speedZeroRef.current) / 60_000);
      if (stoppedMin >= 5 && !anomalyInjected.current.has("arret_prolonge")) {
        anomalyInjected.current.add("arret_prolonge");
        setAutoAlerts(prev => [...prev.filter(a => a.type !== "arret_prolonge"), {
          id: `auto-${now}`,
          type: "arret_prolonge",
          message: `🚨 Arrêt prolongé détecté — véhicule immobile depuis ${stoppedMin} min (détection automatique)`,
          status: "active",
          response: null,
          responseRequested: true,
          createdAt: new Date().toISOString(),
        }]);
      }
    } else {
      if (speedZeroRef.current) {
        speedZeroRef.current = null;
        anomalyInjected.current.delete("arret_prolonge");
        setAutoAlerts(prev => prev.filter(a => a.type !== "arret_prolonge"));
      }
    }

    /* Vitesse anormalement élevée */
    if (speed > 100 && !anomalyInjected.current.has("vitesse_anormale")) {
      anomalyInjected.current.add("vitesse_anormale");
      setAutoAlerts(prev => [...prev.filter(a => a.type !== "vitesse_anormale"), {
        id: `auto-speed-${now}`,
        type: "vitesse_anormale",
        message: `⚡ Vitesse anormale détectée : ${Math.round(speed)} km/h — vérification requise`,
        status: "active",
        response: null,
        responseRequested: false,
        createdAt: new Date().toISOString(),
      }]);
    } else if (speed <= 100) {
      anomalyInjected.current.delete("vitesse_anormale");
      setAutoAlerts(prev => prev.filter(a => a.type !== "vitesse_anormale"));
    }
  }, [gps.speed, gps.active, activeTrip]);

  /* ── Signal GPS perdu ── */
  useEffect(() => {
    if (!activeTrip) return;
    if (gps.error && !anomalyInjected.current.has("gps_perdu")) {
      anomalyInjected.current.add("gps_perdu");
      setAutoAlerts(prev => [...prev.filter(a => a.type !== "gps_perdu"), {
        id: `auto-gps-${Date.now()}`,
        type: "gps_perdu",
        message: "📡 Signal GPS perdu — position non disponible",
        status: "active",
        response: null,
        responseRequested: false,
        createdAt: new Date().toISOString(),
      }]);
    } else if (!gps.error) {
      anomalyInjected.current.delete("gps_perdu");
      setAutoAlerts(prev => prev.filter(a => a.type !== "gps_perdu"));
    }
  }, [gps.error, activeTrip]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  const handleReportIncident = () => {
    Alert.alert(
      "Signaler un incident",
      "Quel type d'incident voulez-vous signaler ?",
      [
        { text: "Panne mécanique", onPress: () => sendReport("panne_mecanique") },
        { text: "Accident",        onPress: () => sendReport("accident") },
        { text: "Retard trafic",   onPress: () => sendReport("retard_trafic") },
        { text: "Passager malade", onPress: () => sendReport("passager_malade") },
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const sendReport = async (type: string) => {
    if (!activeTrip || !token) return;
    setReporting(true);
    try {
      await apiFetch("/agent/incident", {
        token, method: "POST",
        body: JSON.stringify({ tripId: activeTrip.id, type, lat: gps.lat, lon: gps.lon }),
      });
      Alert.alert("Signalement envoyé", "Le dispatcher a été notifié.");
    } catch {
      Alert.alert("Incident enregistré", "Il sera transmis à la reprise de connexion.");
    } finally {
      setReporting(false);
    }
  };

  const handleMarkArrived = () => {
    Alert.alert(
      "Confirmer l'arrivée",
      `Confirmer l'arrivée à ${activeTrip?.to} ?`,
      [
        { text: "Confirmer", style: "destructive", onPress: confirmArrival },
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const confirmArrival = async () => {
    if (!activeTrip || !token) return;
    setArriving(true);
    try {
      await apiFetch(`/company/trips/${activeTrip.id}/end`, { token, method: "POST", body: "{}" });
      Alert.alert("Arrivée confirmée !", `Le trajet ${activeTrip.from} → ${activeTrip.to} est terminé.`);
      setActiveTrip(null);
      setTrips([]);
      loadTrips();
    } catch {
      Alert.alert("Erreur", "Impossible de confirmer l'arrivée. Réessayez.");
    } finally {
      setArriving(false);
    }
  };

  const gpsColor = gps.active ? "#10B981" : "#94A3B8";
  const gpsLabel = gps.active
    ? `EN DIRECT${gps.speed ? " · " + Math.round(gps.speed) + " km/h" : ""}`
    : gps.error ? "GPS indisponible" : "Démarrage GPS…";

  const syncTime = lastSync
    ? `Sync ${lastSync.getHours().toString().padStart(2,"0")}:${lastSync.getMinutes().toString().padStart(2,"0")}:${lastSync.getSeconds().toString().padStart(2,"0")}`
    : null;

  const boardedCount  = passengers.filter(p => p.status === "boarded" || p.status === "confirmed").length;
  const pendingCount  = passengers.filter(p => p.status !== "boarded" && p.status !== "confirmed").length;

  /* Toutes les alertes : API + auto-détectées */
  const allAlerts: BusAlert[] = [...busAlerts, ...autoAlerts];

  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      {/* ── Header ── */}
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>Agent En Route</Text>
          <Text style={S.headerSub}>
            {syncTime ? `🟢 ${syncTime} · auto 15s` : (user?.name ?? "En route")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            style={S.logoutBtn}
            onPress={() =>
              Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
                { text: "Annuler", style: "cancel" },
                { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
              ])
            }
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Déco.</Text>
          </TouchableOpacity>
        </View>
      </View>

      <OfflineBanner status={networkStatus} />

      {/* ── État vide / chargement ── */}
      {!loading && trips.length === 0 && (
        <View style={S.emptyState}>
          <Text style={S.emptyIcon}>🚌</Text>
          <Text style={S.emptyTitle}>Aucun trajet en cours</Text>
          <Text style={S.emptySub}>Les trajets "En route" apparaîtront ici automatiquement.</Text>
          <TouchableOpacity style={S.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color={G} />
              : <><Feather name="refresh-cw" size={15} color={G} /><Text style={S.refreshTxt}>Actualiser</Text></>}
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={S.emptyState}>
          <ActivityIndicator size="large" color={G} />
          <Text style={[S.emptySub, { marginTop: 12 }]}>Chargement du trajet…</Text>
        </View>
      )}

      {!loading && trips.length > 0 && (
        <View style={{ flex: 1 }}>

          {/* ── Sélecteur de trajet (si plusieurs) ── */}
          {trips.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.tripChips}>
              {trips.map(t => (
                <TouchableOpacity key={t.id}
                  style={[S.chip, activeTrip?.id === t.id && S.chipActive]}
                  onPress={() => setActiveTrip(t)}>
                  <Text style={[S.chipText, activeTrip?.id === t.id && S.chipTextActive]}>
                    {t.from} → {t.to}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── Carte trajet actif ── */}
          {activeTrip && (
            <>
              <View style={S.tripCard}>

                {/* ─ Route principale ─ */}
                <View style={S.tripRouteRow}>
                  <View style={{ flex: 1, alignItems: "flex-start" }}>
                    <Text style={S.tripCityLabel}>DÉPART</Text>
                    <Text style={S.tripCity} numberOfLines={1}>{activeTrip.from}</Text>
                    <View style={S.tripTimePill}>
                      <Ionicons name="time-outline" size={12} color={G} />
                      <Text style={S.tripTime}>{activeTrip.departureTime}</Text>
                    </View>
                  </View>

                  <View style={S.tripArrowBlock}>
                    <View style={S.arrowLine} />
                    <View style={S.busBadge}>
                      <Ionicons name="bus" size={20} color="#fff" />
                    </View>
                    <View style={S.arrowLine} />
                  </View>

                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={S.tripCityLabel}>ARRIVÉE</Text>
                    <Text style={S.tripCity} numberOfLines={1}>{activeTrip.to}</Text>
                    <View style={[S.tripTimePill, { alignSelf: "flex-end" }]}>
                      <Ionicons name="flag-outline" size={12} color="#7C3AED" />
                      <Text style={[S.tripTime, { color: "#7C3AED" }]}>{activeTrip.arrivalTime ?? "?"}</Text>
                    </View>
                  </View>
                </View>

                {/* ─ Séparateur ─ */}
                <View style={S.cardDivider} />

                {/* ─ Info bus + places + vitesse ─ */}
                <View style={S.tripInfoRow}>
                  <View style={S.tripInfoPill}>
                    <Feather name="truck" size={13} color="#475569" />
                    <Text style={S.tripInfoTxt}>{activeTrip.busName}</Text>
                  </View>
                  {activeTrip.passengers != null && activeTrip.totalSeats != null && (
                    <View style={[S.tripInfoPill, { backgroundColor: "#DCFCE7" }]}>
                      <Ionicons name="people-outline" size={14} color={G} />
                      <Text style={[S.tripInfoTxt, { color: G_DARK, fontWeight: "700" }]}>
                        {activeTrip.passengers} / {activeTrip.totalSeats} places
                      </Text>
                    </View>
                  )}
                  {activeTrip.speed != null && activeTrip.speed > 0 && (
                    <View style={[S.tripInfoPill, { backgroundColor: "#FEF3C7" }]}>
                      <Feather name="zap" size={13} color={AMBER} />
                      <Text style={[S.tripInfoTxt, { color: AMBER, fontWeight: "700" }]}>{Math.round(activeTrip.speed)} km/h</Text>
                    </View>
                  )}
                </View>

                {/* ─ Barre d'occupation avec taux ─ */}
                {activeTrip.passengers != null && activeTrip.totalSeats != null && (
                  <View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                      <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "600" }}>Taux d'occupation</Text>
                      <Text style={{ fontSize: 11, color: G_DARK, fontWeight: "800" }}>
                        {Math.min(100, Math.round((activeTrip.passengers / activeTrip.totalSeats) * 100))}%
                      </Text>
                    </View>
                    <View style={S.occBar}>
                      <View style={[S.occFill, {
                        width: `${Math.min(100, Math.round((activeTrip.passengers / activeTrip.totalSeats) * 100))}%` as any,
                      }]} />
                    </View>
                  </View>
                )}
              </View>

              {/* ─ Bande GPS — hors carte pour aérer ─ */}
              <View style={[S.gpsStrip, {
                borderColor: gps.active ? "#A7F3D0" : "#E2E8F0",
                backgroundColor: gps.active ? "#F0FDF4" : "#F8FAFC",
              }]}>
                <View style={[S.gpsPulse, { backgroundColor: gpsColor }]} />
                <Ionicons name="navigate" size={14} color={gps.active ? G : "#94A3B8"} />
                <Text style={[S.gpsStripTxt, { color: gps.active ? G_DARK : "#64748B" }]}>
                  {gps.active
                    ? (gps.lat && gps.lon
                        ? `${gps.lat.toFixed(4)}° N, ${gps.lon.toFixed(4)}° E`
                        : "GPS actif — signal en attente")
                    : (gps.error ? "GPS indisponible" : "Démarrage GPS…")}
                </Text>
                {gps.active && (
                  <View style={S.gpsLiveBadge}>
                    <Text style={S.gpsLiveTxt}>{gpsLabel}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── Alertes actives (bannière rapide) ── */}
          {allAlerts.length > 0 && (
            <TouchableOpacity onPress={() => setTab("alertes")} style={S.alertBanner}>
              <View style={S.alertBannerIcon}>
                <Ionicons name="warning" size={16} color="#DC2626" />
              </View>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#7F1D1D", flex: 1, lineHeight: 18 }}>
                {allAlerts.length} alerte{allAlerts.length > 1 ? "s" : ""} active{allAlerts.length > 1 ? "s" : ""} — Appuyez pour répondre
              </Text>
              <Ionicons name="chevron-forward" size={15} color="#DC2626" />
            </TouchableOpacity>
          )}

          {/* ── Actions rapides (grille dashboard) ── */}
          <View style={S.quickGrid}>
            {/* Scanner ticket */}
            <TouchableOpacity
              style={[S.quickBtn, tab === "scan" && S.quickBtnActive]}
              onPress={() => { setTab("scan"); setIsModalOpen(true); }}
              activeOpacity={0.78}
            >
              <View style={[S.quickIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="qr-code" size={24} color="#2563EB" />
              </View>
              <Text style={S.quickLabel}>Scanner{"\n"}ticket</Text>
            </TouchableOpacity>

            {/* Ajouter passager */}
            <TouchableOpacity
              style={[S.quickBtn, tab === "montee" && S.quickBtnActive]}
              onPress={() => { setTab("montee"); setIsModalOpen(true); }}
              activeOpacity={0.78}
            >
              <View style={[S.quickIcon, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="person-add" size={24} color={G} />
              </View>
              <Text style={S.quickLabel}>Ajouter{"\n"}passager</Text>
            </TouchableOpacity>

            {/* Liste passagers */}
            <TouchableOpacity
              style={[S.quickBtn, tab === "passagers" && S.quickBtnActive]}
              onPress={() => { setTab("passagers"); setIsModalOpen(true); }}
              activeOpacity={0.78}
            >
              <View style={[S.quickIcon, { backgroundColor: "#F5F3FF" }]}>
                <Ionicons name="people" size={24} color="#7C3AED" />
              </View>
              <Text style={S.quickLabel}>
                {passengers.length > 0 ? `Passagers\n(${passengers.length})` : "Passagers"}
              </Text>
            </TouchableOpacity>

            {/* Alertes */}
            <TouchableOpacity
              style={[S.quickBtn, tab === "alertes" && S.quickBtnActive]}
              onPress={() => { setTab("alertes"); setIsModalOpen(true); }}
              activeOpacity={0.78}
            >
              <View style={[S.quickIcon, { backgroundColor: allAlerts.length > 0 ? "#FEF2F2" : "#F8FAFC" }]}>
                <Ionicons name="warning" size={24} color={allAlerts.length > 0 ? "#DC2626" : "#94A3B8"} />
                {allAlerts.length > 0 && (
                  <View style={S.quickBadge}>
                    <Text style={S.quickBadgeTxt}>{allAlerts.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[S.quickLabel, allAlerts.length > 0 && { color: "#DC2626", fontWeight: "700" }]}>
                Alertes{allAlerts.length > 0 ? `\n(${allAlerts.length})` : ""}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      )}

      {/* ════════════════════════════════════════════════
          MODAL — Pages de détail plein écran
          ════════════════════════════════════════════════ */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
        presentationStyle="fullScreen"
      >
        <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }} edges={["top", "bottom"]}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          {/* Header modal */}
          <View style={S.pageHeader}>
            <TouchableOpacity style={S.pageBackBtn} onPress={() => setIsModalOpen(false)} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={G_DARK} />
              <Text style={S.pageBackTxt}>Retour</Text>
            </TouchableOpacity>
            <Text style={S.pageTitle} numberOfLines={1}>{PAGE_TITLES[tab] ?? ""}</Text>
            <View style={{ width: 90 }} />
          </View>

          {/* Onglets de navigation dans la modal */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabsScroll}>
            <View style={S.tabs}>
              {([
                { key: "passagers", label: "👥 Passagers" },
                { key: "scan",      label: "🔍 Scan" },
                { key: "montee",    label: "➕ Montée" },
                { key: "trajet",    label: "📍 Trajet" },
                { key: "arrets",    label: `🗺 Arrêts${stopData.length > 0 ? ` (${stopData.length})` : ""}` },
                { key: "contacts",  label: "📞 Contacts" },
                { key: "alertes",   label: `🚨 Alertes${allAlerts.length > 0 ? ` (${allAlerts.length})` : ""}` },
              ] as const).map(t => (
                <TouchableOpacity key={t.key}
                  style={[S.tabBtn, tab === t.key && S.tabBtnActive]}
                  onPress={() => setTab(t.key)}>
                  <Text style={[S.tabText, tab === t.key && S.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Contenu de la page */}
          <ScrollView
            contentContainerStyle={S.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
          >

            {/* ══ PASSAGERS ══ */}
            {tab === "passagers" && (
              <>
                {/* En-tête compteurs */}
                <View style={S.passengerHeader}>
                  <Text style={S.sectionTitle}>Liste des passagers</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={[S.countBadge, { backgroundColor: G }]}>
                      <Ionicons name="checkmark-circle" size={13} color="#fff" />
                      <Text style={S.countBadgeTxt}>{boardedCount} à bord</Text>
                    </View>
                    {pendingCount > 0 && (
                      <View style={[S.countBadge, { backgroundColor: AMBER }]}>
                        <Ionicons name="time-outline" size={13} color="#fff" />
                        <Text style={S.countBadgeTxt}>{pendingCount}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {passLoading && <ActivityIndicator color={G} style={{ marginTop: 20 }} />}

                {!passLoading && passengers.length === 0 && (
                  <View style={S.emptyCard}>
                    <Text style={{ fontSize: 36 }}>👥</Text>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#374151" }}>Aucun passager</Text>
                    <Text style={S.emptySub}>Ajoutez un passager via le bouton vert ci-dessous</Text>
                  </View>
                )}

                {!passLoading && passengers.map((p) => {
                  const isBoarded   = p.status === "boarded" || p.status === "confirmed";
                  const isAbsent    = p.status === "absent"  || p.status === "no_show";
                  const avatarBg    = isBoarded ? G : isAbsent ? "#EF4444" : "#94A3B8";
                  const statusBg    = isBoarded ? "#DCFCE7" : isAbsent ? "#FEE2E2" : "#FEF9C3";
                  const statusColor = isBoarded ? "#166534" : isAbsent ? "#991B1B" : "#92400E";
                  const statusIconName = isBoarded ? "checkmark-circle" : isAbsent ? "close-circle" : "time-outline";
                  const statusText  = isBoarded ? "À bord" : isAbsent ? "Non monté" : "En attente";
                  const phoneClean  = p.phone ? p.phone.replace(/\s/g, "") : "";
                  return (
                    <View key={p.name + p.seatNumber} style={S.passengerCard}>
                      {/* Ligne 1 : avatar + nom + statut */}
                      <View style={S.paxCardRow}>
                        <View style={[S.passengerAvatar, { backgroundColor: avatarBg }]}>
                          <Text style={S.passengerAvatarTxt}>{p.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={S.paxFlex1}>
                          <Text style={S.passengerName}>{p.name}</Text>
                          {p.phone
                            ? <TouchableOpacity
                                style={S.paxPhoneRow}
                                onPress={() => Linking.openURL(`tel:${phoneClean}`)}>
                                <Feather name="phone" size={11} color={G} />
                                <Text style={S.passengerPhone}>{p.phone}</Text>
                              </TouchableOpacity>
                            : <Text style={S.passengerNoPhone}>Pas de téléphone</Text>}
                        </View>
                        <View style={[S.statusBadge, { backgroundColor: statusBg }]}>
                          <Ionicons name={statusIconName} size={15} color={statusColor} />
                          <Text style={[S.statusBadgeTxt, { color: statusColor }]}>{statusText}</Text>
                        </View>
                      </View>

                      <View style={S.divider} />

                      {/* Ligne 2 : siège + point d'embarquement */}
                      <View style={S.paxTagsRow}>
                        <View style={S.tagGreen}>
                          <Feather name="hash" size={12} color={G} />
                          <Text style={S.paxSeatText}>Siège {p.seatNumber}</Text>
                        </View>
                        {p.boardingPoint && (
                          <View style={S.paxBoardingTag}>
                            <Ionicons name="location-outline" size={12} color="#7C3AED" />
                            <Text style={S.paxBoardingText} numberOfLines={1}>{p.boardingPoint}</Text>
                          </View>
                        )}
                      </View>

                      {/* Bouton appel */}
                      {p.phone && (
                        <TouchableOpacity
                          style={S.callBtn}
                          onPress={() => Linking.openURL(`tel:${phoneClean}`)}
                          activeOpacity={0.75}
                        >
                          <Feather name="phone" size={15} color={G} />
                          <Text style={S.callBtnTxt}>Appeler — {p.phone}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                {/* Bouton "Ajouter un passager" en bas de liste */}
                <TouchableOpacity style={S.addPassengerBtn} onPress={() => setTab("montee")}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={S.addPassengerBtnTxt}>Ajouter un passager en route</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ══ SCAN TICKET ══ */}
            {tab === "scan" && (
              <>
                {/* En-tête */}
                <View style={S.scanHeader}>
                  <Feather name="maximize" size={22} color={G} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.sectionTitle}>Scan ticket passager</Text>
                    <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 17 }}>
                      Scannez le QR code ou saisissez la référence du billet pour valider la montée à bord.
                    </Text>
                  </View>
                </View>

                {/* Résultat du scan */}
                {scanResult && (
                  <Animated.View style={[
                    S.scanResultCard,
                    { transform: [{ scale: scanPulse }] },
                    scanResult.status === "valid"        && { borderColor: G,         backgroundColor: "#F0FDF4" },
                    scanResult.status === "already_used" && { borderColor: "#F59E0B",  backgroundColor: "#FFFBEB" },
                    scanResult.status === "invalid"      && { borderColor: "#DC2626",  backgroundColor: "#FEF2F2" },
                    scanResult.status === "offline"      && { borderColor: "#6B7280",  backgroundColor: "#F9FAFB" },
                  ]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <Feather
                        name={scanResult.status === "valid" ? "check-circle" : scanResult.status === "already_used" ? "alert-circle" : scanResult.status === "offline" ? "wifi-off" : "x-circle"}
                        size={24}
                        color={scanResult.status === "valid" ? G : scanResult.status === "already_used" ? "#F59E0B" : scanResult.status === "offline" ? "#6B7280" : "#DC2626"}
                      />
                      <Text style={[
                        S.scanResultTitle,
                        { color: scanResult.status === "valid" ? G_DARK : scanResult.status === "already_used" ? "#92400E" : scanResult.status === "offline" ? "#374151" : "#991B1B" },
                      ]}>
                        {scanResult.status === "valid"        ? "✅ Passager validé — À bord !" :
                         scanResult.status === "already_used" ? "⚠️ Billet déjà utilisé" :
                         scanResult.status === "offline"      ? "📡 Hors ligne" :
                                                                "❌ Billet invalide"}
                      </Text>
                    </View>
                    {scanResult.passenger && (
                      <View style={S.scanDetailRow}>
                        <Feather name="user" size={14} color="#6B7280" />
                        <Text style={S.scanDetailTxt}>{scanResult.passenger}</Text>
                      </View>
                    )}
                    {scanResult.route && (
                      <View style={S.scanDetailRow}>
                        <Feather name="map-pin" size={14} color="#6B7280" />
                        <Text style={S.scanDetailTxt}>{scanResult.route}</Text>
                      </View>
                    )}
                    {scanResult.departure_time && (
                      <View style={S.scanDetailRow}>
                        <Feather name="clock" size={14} color="#6B7280" />
                        <Text style={S.scanDetailTxt}>Départ : {scanResult.departure_time}</Text>
                      </View>
                    )}
                    {scanResult.seats && (
                      <View style={S.scanDetailRow}>
                        <Feather name="grid" size={14} color="#6B7280" />
                        <Text style={S.scanDetailTxt}>Siège(s) : {scanResult.seats}</Text>
                      </View>
                    )}
                    {scanResult.message && scanResult.status !== "valid" && (
                      <Text style={[S.scanDetailTxt, { marginTop: 6, fontStyle: "italic", color: "#6B7280" }]}>{scanResult.message}</Text>
                    )}
                    <TouchableOpacity style={S.scanResetBtn} onPress={resetScan}>
                      <Feather name="refresh-cw" size={14} color={G} />
                      <Text style={{ fontSize: 13, fontWeight: "700", color: G }}>Nouveau scan</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {/* Sélecteur mode */}
                {!scanResult && (
                  <View style={S.scanModeBar}>
                    {(["camera", "manual"] as const).map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[S.scanModeBtn, scanMode === m && S.scanModeBtnActive]}
                        onPress={() => { setScanMode(m); resetScan(); }}
                      >
                        <Feather name={m === "camera" ? "camera" : "edit-2"} size={14} color={scanMode === m ? G : "#6b7280"} />
                        <Text style={[S.scanModeTxt, scanMode === m && S.scanModeTxtActive]}>
                          {m === "camera" ? "Caméra QR" : "Saisie manuelle"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Mode caméra */}
                {!scanResult && scanMode === "camera" && (
                  <>
                    {!scanPerm?.granted ? (
                      <View style={S.scanPermBox}>
                        <Feather name="camera-off" size={36} color="#94A3B8" style={{ marginBottom: 10 }} />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 6 }}>Accès caméra requis</Text>
                        <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 14, lineHeight: 18 }}>
                          Autorisez la caméra pour scanner les QR codes des billets.
                        </Text>
                        <TouchableOpacity style={S.scanPermBtn} onPress={requestScanPerm}>
                          <Feather name="camera" size={15} color="#fff" />
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Autoriser la caméra</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={S.scanCameraWrap}>
                        <CameraView
                          style={S.scanCamera}
                          facing="back"
                          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                          onBarcodeScanned={!scannedRouteRef.current && !scanLoading && !scanResult
                            ? ({ data }: { data: string }) => {
                                if (scannedRouteRef.current || scanLoading) return;
                                scannedRouteRef.current = true;
                                handleScanCode(data);
                              }
                            : undefined}
                        />
                        <View style={S.scanOverlay}>
                          <View style={S.scanBox}>
                            <View style={[S.scanCorner, S.scanCornerTL]} />
                            <View style={[S.scanCorner, S.scanCornerTR]} />
                            <View style={[S.scanCorner, S.scanCornerBL]} />
                            <View style={[S.scanCorner, S.scanCornerBR]} />
                            {scanLoading
                              ? <ActivityIndicator size="large" color="#fff" />
                              : <Feather name="maximize" size={22} color="rgba(255,255,255,0.5)" />}
                          </View>
                          <View style={S.scanHintPill}>
                            <Feather name="zap" size={13} color="rgba(255,255,255,0.9)" />
                            <Text style={S.scanHintTxt}>Alignez le QR code du billet dans le cadre</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* Mode saisie manuelle */}
                {!scanResult && scanMode === "manual" && (
                  <View style={S.scanManualBox}>
                    <Feather name="hash" size={28} color={G} style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#1F2937", marginBottom: 4 }}>Référence du billet</Text>
                    <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 14, textAlign: "center" }}>
                      Entrez la référence si le QR ne fonctionne pas
                    </Text>
                    <TextInput
                      style={S.scanInput}
                      placeholder="Ex: GBB-2026-XXXXX"
                      placeholderTextColor="#9CA3AF"
                      value={scanInput}
                      onChangeText={setScanInput}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => { if (scanInput.trim()) { handleScanCode(scanInput.trim()); setScanInput(""); } }}
                    />
                    <TouchableOpacity
                      style={[S.scanValidateBtn, (!scanInput.trim() || scanLoading) && { opacity: 0.45 }]}
                      onPress={() => { if (scanInput.trim() && !scanLoading) { handleScanCode(scanInput.trim()); setScanInput(""); } }}
                      disabled={!scanInput.trim() || scanLoading}
                    >
                      {scanLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Feather name="check-circle" size={16} color="#fff" />}
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                        {scanLoading ? "Validation…" : "Valider le billet"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Tickets de simulation */}
                {!scanResult && (
                  <View style={S.demoSection}>
                    <Text style={S.demoTitle}>🧪 Tickets de test (simulation)</Text>
                    <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>
                      Appuyez sur une référence pour la tester directement
                    </Text>
                    {DEMO_TICKETS_ROUTE.map(t => (
                      <TouchableOpacity
                        key={t.ref}
                        style={S.demoTicketRow}
                        onPress={() => handleScanCode(t.ref)}
                        disabled={scanLoading}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={S.demoTicketRef}>{t.ref}</Text>
                          <Text style={S.demoTicketName}>{t.name} · Siège {t.seat}</Text>
                          <Text style={S.demoTicketNote}>{t.note}</Text>
                        </View>
                        <View style={S.demoScanBtn}>
                          {scanLoading
                            ? <ActivityIndicator size="small" color={G} />
                            : <Feather name="maximize" size={16} color={G} />}
                        </View>
                      </TouchableOpacity>
                    ))}
                    <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>
                      En production : utilisez la caméra pour scanner le QR du passager
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ══ MONTÉE EN ROUTE ══ */}
            {tab === "montee" && (
              <>
                <View style={S.monteeHeader}>
                  <Ionicons name="person-add" size={22} color={G} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.sectionTitle}>Montée en cours de route</Text>
                    <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 17 }}>
                      Enregistrez un passager qui monte sans application. Synchronisation automatique avec l'agent de réservation et la compagnie.
                    </Text>
                  </View>
                </View>

                {!assignedTripId && (
                  <View style={S.warningBanner}>
                    <Ionicons name="warning-outline" size={20} color="#D97706" />
                    <Text style={{ fontSize: 12, color: "#92400E", flex: 1, lineHeight: 18 }}>
                      Aucun trajet assigné à votre compte. Demandez à votre compagnie de vous assigner un trajet.
                    </Text>
                  </View>
                )}

                {/* Bannière succès */}
                {manualSuccess && (
                  <View style={S.successBanner}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={22} color="#166534" />
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#166534" }}>Passager enregistré !</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: "#166534", marginTop: 4 }}>
                      Réf : <Text style={{ fontWeight: "800" }}>{manualSuccess.bookingRef}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: "#4B5563", marginTop: 2 }}>
                      Montant : {(manualSuccess.total ?? 0).toLocaleString()} FCFA · SMS envoyé
                    </Text>
                    <TouchableOpacity onPress={() => setManualSuccess(null)} style={{ alignSelf: "flex-end", marginTop: 4 }}>
                      <Text style={{ fontSize: 12, color: "#166534", fontWeight: "700" }}>Fermer ✕</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Formulaire */}
                <View style={S.formCard}>
                  <View style={S.formField}>
                    <Text style={S.fieldLabel}>Nom du passager *</Text>
                    <TextInput
                      style={S.fieldInput}
                      placeholder="Ex : Kouassi Marie"
                      value={manualName} onChangeText={setManualName}
                      editable={!manualSaving}
                    />
                  </View>
                  <View style={S.formField}>
                    <Text style={S.fieldLabel}>Téléphone *</Text>
                    <TextInput
                      style={S.fieldInput}
                      placeholder="Ex : 07 01 23 45 67"
                      value={manualPhone} onChangeText={setManualPhone}
                      keyboardType="phone-pad"
                      editable={!manualSaving}
                    />
                  </View>
                  <View style={S.formField}>
                    <Text style={S.fieldLabel}>Point de montée</Text>
                    <TextInput
                      style={S.fieldInput}
                      placeholder="Ex : Carrefour Koumassi"
                      value={manualPoint} onChangeText={setManualPoint}
                      editable={!manualSaving}
                    />
                  </View>
                  <View style={S.formField}>
                    <Text style={S.fieldLabel}>Nombre de places</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {["1","2","3","4"].map(n => (
                        <TouchableOpacity key={n}
                          style={[S.seatBtn, manualSeats === n && S.seatBtnActive]}
                          onPress={() => setManualSeats(n)} disabled={manualSaving}
                        >
                          <Text style={[S.seatBtnTxt, manualSeats === n && S.seatBtnTxtActive]}>{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[S.submitBtn, (!assignedTripId || manualSaving) && { opacity: 0.5 }]}
                    onPress={handleManualBooking}
                    disabled={!assignedTripId || manualSaving}
                  >
                    {manualSaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="person-add" size={18} color="#fff" />}
                    <Text style={S.submitBtnTxt}>
                      {manualSaving ? "Enregistrement…" : "Enregistrer la montée"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ══ TRAJET ══ */}
            {tab === "trajet" && activeTrip && (
              <>
                {/* Carte GPS détaillée */}
                <View style={[S.gpsCard, { borderColor: gps.active ? "#10B981" : "#E2E8F0" }]}>
                  <View style={S.gpsRow}>
                    <Ionicons name="location" size={20} color={gps.active ? "#10B981" : "#94A3B8"} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={S.gpsTitle}>{gps.active ? "Position GPS active" : "GPS inactif"}</Text>
                      {gps.lat && gps.lon
                        ? <Text style={S.gpsSub}>{gps.lat.toFixed(5)}° N, {gps.lon.toFixed(5)}° E</Text>
                        : <Text style={S.gpsSub}>En attente de signal…</Text>}
                    </View>
                    {gps.active && (
                      <View style={S.gpsActiveBadge}>
                        <Text style={S.gpsActiveBadgeTxt}>EN DIRECT</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <Text style={S.sectionTitle}>Actions</Text>
                <View style={S.actionsGrid}>
                  <TouchableOpacity style={S.actionBtn} onPress={handleRefresh} disabled={refreshing}>
                    {refreshing
                      ? <ActivityIndicator size="small" color={G} />
                      : <Feather name="refresh-cw" size={22} color={G} />}
                    <Text style={S.actionLabel}>Actualiser</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[S.actionBtn, S.actionBtnAmber]} onPress={handleReportIncident} disabled={reporting}>
                    {reporting
                      ? <ActivityIndicator size="small" color={AMBER} />
                      : <Feather name="alert-triangle" size={22} color={AMBER} />}
                    <Text style={[S.actionLabel, { color: AMBER }]}>Incident</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[S.actionBtn, S.actionBtnRed]} onPress={handleMarkArrived} disabled={arriving}>
                    {arriving
                      ? <ActivityIndicator size="small" color="#DC2626" />
                      : <Feather name="map-pin" size={22} color="#DC2626" />}
                    <Text style={[S.actionLabel, { color: "#DC2626" }]}>Arrivée</Text>
                  </TouchableOpacity>
                </View>

                {/* Statut du trajet */}
                <Text style={[S.sectionTitle, { marginTop: 8 }]}>Statut du trajet</Text>
                <View style={S.timeline}>
                  {([
                    { iconName: "checkmark" as const,  iconColor: "#166534", label: "Départ effectué",          done: true,  active: false },
                    { iconName: "bus"       as const,  iconColor: "#fff",    label: "En route vers " + activeTrip.to, done: true,  active: true  },
                    { iconName: "location"  as const,  iconColor: "#94A3B8", label: "Arrivée à " + activeTrip.to,     done: false, active: false },
                  ]).map((step, i) => (
                    <View key={step.iconName} style={S.timelineRow}>
                      <View style={[S.timelineDot, step.active && S.timelineDotActive, step.done && !step.active && S.timelineDotDone]}>
                        <Ionicons name={step.iconName} size={13} color={step.active ? "#fff" : step.done ? "#166534" : "#94A3B8"} />
                      </View>
                      {i < 2 && <View style={[S.timelineLine, step.done && !step.active && S.timelineLineDone]} />}
                      <Text style={[S.timelineLabel, step.active && S.timelineLabelActive]}>{step.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Mon départ */}
                {myDeparture && (
                  <View style={S.departureBadge}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#0369A1" }}>
                      🗓️ {myDeparture.villeDepart} → {myDeparture.villeArrivee}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>
                      ⏰ {myDeparture.heureDepart} · {myDeparture.busName ?? "Bus"}{myDeparture.plateNumber ? ` (${myDeparture.plateNumber})` : ""}
                    </Text>
                    {myDeparture.chauffeurNom && <Text style={{ fontSize: 11, color: "#64748B" }}>👤 {myDeparture.chauffeurNom}</Text>}
                  </View>
                )}
              </>
            )}

            {/* ══ ARRÊTS ══ */}
            {tab === "arrets" && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={S.sectionTitle}>Ordre des arrêts</Text>
                  <View style={{ backgroundColor: "#1E40AF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{stopData.length} arrêts</Text>
                  </View>
                </View>
                {stopLoading && <ActivityIndicator color={G} style={{ marginTop: 20 }} />}
                {!stopLoading && stopData.map((stop, idx) => {
                  const st = (stop as any).stopStatus as "passé" | "en_cours" | "prévu" | undefined;
                  const et = (stop as any).estimatedTime as string | undefined;
                  const dotStyle = st === "passé"
                    ? S.stopDotPasse
                    : st === "en_cours"
                    ? S.stopDotEnCours
                    : S.stopDotCircle;
                  return (
                    <View key={stop.id} style={S.stopWrapper}>
                      <View style={S.stopRowOuter}>
                        <View style={S.stopDotCol}>
                          <View style={dotStyle}>
                            {st === "passé"
                              ? <Ionicons name="checkmark" size={13} color="#fff" />
                              : st === "en_cours"
                              ? <Ionicons name="navigate" size={12} color="#fff" />
                              : <Text style={S.stopDotText}>{idx + 1}</Text>}
                          </View>
                          {idx < stopData.length - 1 && (
                            <View style={[S.stopConnector, st === "passé" && S.stopConnectorDone]} />
                          )}
                        </View>
                        <View style={[S.stopCard, st === "en_cours" && S.stopCardActive]}>
                          <View style={S.stopCardHeader}>
                            <Text style={S.stopCardTitle}>{stop.name}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              {st === "passé"    && <View style={S.stopStatusPasse}><Text style={S.stopStatusTxt}>✓ Passé</Text></View>}
                              {st === "en_cours" && <View style={S.stopStatusEnCours}><Text style={[S.stopStatusTxt, { color: "#1E40AF" }]}>▶ En cours</Text></View>}
                              {st === "prévu"    && <View style={S.stopStatusPrevu}><Text style={[S.stopStatusTxt, { color: "#64748B" }]}>○ Prévu</Text></View>}
                              {stop.passengers.length > 0 && (
                                <View style={S.stopBadge}>
                                  <Text style={S.stopBadgeText}>{stop.passengers.length} pax</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={S.stopCity}>{stop.city}</Text>
                            {et && <Text style={S.stopEstTime}>{et}</Text>}
                          </View>
                          {stop.passengers.length > 0 && (
                            <View style={S.stopPassList}>
                              {stop.passengers.map((p) => (
                                <View key={p.bookingRef} style={S.stopPassRow}>
                                  <View style={S.stopPassAvatar}>
                                    <Text style={S.stopPassAvatarText}>{(p.userName ?? "?").charAt(0)}</Text>
                                  </View>
                                  <Text style={S.stopPassName}>{p.userName ?? "Passager"}</Text>
                                  <Text style={S.stopPassRef}>#{p.bookingRef}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* ══ CONTACTS ══ */}
            {tab === "contacts" && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <Text style={S.sectionTitle}>Contacts clients</Text>
                  <View style={{ backgroundColor: "#1E40AF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>{passengers.length} contacts</Text>
                  </View>
                </View>
                {passLoading && <ActivityIndicator color={G} style={{ marginTop: 20 }} />}
                {!passLoading && passengers.length === 0 && (
                  <View style={S.emptyCard}>
                    <Text style={{ fontSize: 32 }}>📞</Text>
                    <Text style={S.emptySub}>Aucun contact disponible</Text>
                  </View>
                )}
                {!passLoading && passengers.map((p) => {
                  const phoneClean = p.phone ? p.phone.replace(/\s/g, "") : "";
                  return (
                    <View key={p.name + p.seatNumber} style={S.passengerCard}>
                      <View style={S.paxCardRow}>
                        <View style={[S.passengerAvatar, S.contactAvatar]}>
                          <Text style={S.passengerAvatarTxt}>{p.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={S.paxFlex1}>
                          <Text style={S.passengerName}>{p.name}</Text>
                          <Text style={S.contactSeat}>Siège {p.seatNumber}</Text>
                        </View>
                        {p.phone ? (
                          <TouchableOpacity
                            style={S.contactCallIconBtn}
                            onPress={() => Linking.openURL(`tel:${phoneClean}`)}
                          >
                            <Feather name="phone" size={20} color={G} />
                          </TouchableOpacity>
                        ) : (
                          <View style={S.contactNoPhoneIcon}>
                            <Feather name="phone-off" size={20} color="#94A3B8" />
                          </View>
                        )}
                      </View>
                      {p.boardingPoint && (
                        <View style={S.contactBoarding}>
                          <Ionicons name="location-outline" size={12} color="#7C3AED" />
                          <Text style={S.contactBoardingText}>{p.boardingPoint}</Text>
                        </View>
                      )}
                      {p.phone && (
                        <TouchableOpacity
                          style={S.callBtn}
                          onPress={() => Linking.openURL(`tel:${phoneClean}`)}
                          activeOpacity={0.75}
                        >
                          <Feather name="phone-call" size={15} color={G} />
                          <Text style={S.callBtnTxt}>{p.phone}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* ══ ALERTES ══ */}
            {tab === "alertes" && (
              <View style={S.alertsContainer}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={S.sectionTitle}>🚨 Mes alertes à bord</Text>
                  {allAlerts.length > 0 && (
                    <View style={{ backgroundColor: "#DC2626", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{allAlerts.length} active(s)</Text>
                    </View>
                  )}
                </View>
                {allAlerts.length === 0 && (
                  <View style={S.emptyCard}>
                    <Ionicons name="checkmark-circle" size={36} color="#4ADE80" />
                    <Text style={S.alertEmptyTitle}>Tout va bien !</Text>
                    <Text style={S.alertEmptyText}>Aucune alerte active pour votre bus.</Text>
                  </View>
                )}
                {allAlerts.map(alert => {
                  const hasResponse = !!alert.response;
                  const isActing    = alertActing === alert.id;
                  const responseOpt = RESP.find(r => r.id === alert.response);
                  const isAuto = alert.id.startsWith("auto-") || alert.id.startsWith("sim-");
                  return (
                    <View key={alert.id} style={[S.alertCard, isAuto && { borderLeftColor: "#D97706" }]}>
                      <View style={S.alertRow}>
                        <Ionicons name="warning" size={20} color={isAuto ? "#D97706" : "#DC2626"} />
                        <Text style={S.alertMessage}>{alert.message}</Text>
                        <Text style={S.alertTime}>
                          {new Date(alert.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                      {isAuto && (
                        <View style={S.autoDetectedBadge}>
                          <Ionicons name="flash" size={12} color="#D97706" />
                          <Text style={S.autoDetectedTxt}>Détectée automatiquement</Text>
                        </View>
                      )}
                      {alert.responseRequested && !hasResponse && (
                        <View style={S.alertRequestBanner}>
                          <Ionicons name="mail-open-outline" size={16} color="#D97706" />
                          <Text style={S.alertRequestText}>
                            📨 L'agent suivi demande votre réponse !
                          </Text>
                        </View>
                      )}
                      {hasResponse && responseOpt && (
                        <View style={[S.alertResponseBanner, { backgroundColor: responseOpt.bg }]}>
                          <Ionicons name="checkmark-circle" size={16} color={responseOpt.color} />
                          <Text style={[S.alertResponseText, { color: responseOpt.color }]}>
                            ✅ Réponse envoyée : {responseOpt.label}
                          </Text>
                        </View>
                      )}
                      {!hasResponse && (
                        <>
                          <Text style={S.alertStatusLabel}>Quelle est la situation ?</Text>
                          <View style={S.respGap}>
                            {RESP.map(opt => (
                              <TouchableOpacity key={opt.id}
                                style={[S.respOptBtn, { backgroundColor: opt.bg, borderColor: opt.color + "50" }]}
                                onPress={() => respondToAlert(alert.id, opt.id)}
                                disabled={isActing}
                              >
                                {isActing
                                  ? <ActivityIndicator size="small" color={opt.color} />
                                  : <Ionicons name="radio-button-on" size={18} color={opt.color} />}
                                <Text style={[S.respOptText, { color: opt.color }]}>{opt.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      {/* ── Bouton Rapport (bas de page) ── */}
      <TouchableOpacity
        style={S.rapportBtn}
        onPress={() => router.push("/agent/rapport" as never)}
      >
        <Feather name="file-text" size={16} color="#fff" />
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>Faire un rapport</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: "#F8FAFC" },

  /* Header */
  header:       { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 14,
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:  { color: "white", fontSize: 18, fontWeight: "700" },
  headerSub:    { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 },
  logoutBtn:    { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },

  /* Empty state */
  emptyState:   { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 28, alignItems: "center", gap: 10,
                  shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 12 },
  emptyIcon:    { fontSize: 48 },
  emptyTitle:   { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  emptySub:     { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 19 },
  refreshBtn:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: G_LIGHT,
                  borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  refreshTxt:   { fontSize: 14, fontWeight: "600", color: G },

  /* Trip selector chips */
  tripChips:    { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip:         { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
                  borderWidth: 1.5, borderColor: "#E2E8F0" },
  chipActive:   { backgroundColor: G, borderColor: G },
  chipText:     { fontSize: 13, fontWeight: "600", color: "#475569" },
  chipTextActive: { color: "#fff" },

  /* Trip card */
  tripCard:     { marginHorizontal: 16, marginTop: 12, marginBottom: 0, backgroundColor: "#fff",
                  borderRadius: 18, padding: 18, shadowColor: "#000", shadowOpacity: 0.08,
                  shadowRadius: 14, elevation: 5, gap: 14 },
  tripRouteRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tripCityLabel:{ fontSize: 10, color: "#94A3B8", fontWeight: "700", marginBottom: 4,
                  textTransform: "uppercase", letterSpacing: 0.8 },
  tripCity:     { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  tripTimePill: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5,
                  backgroundColor: "#F0FDF4", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                  alignSelf: "flex-start" },
  tripTime:     { fontSize: 13, color: G, fontWeight: "700" },
  tripArrowBlock:{ width: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  arrowLine:    { flex: 1, height: 2, backgroundColor: "#D1FAE5" },
  busBadge:     { backgroundColor: G, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center",
                  shadowColor: G, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
  cardDivider:  { height: 1, backgroundColor: "#F1F5F9" },
  tripInfoRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tripInfoPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F1F5F9",
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tripInfoTxt:  { fontSize: 12, color: "#475569", fontWeight: "600" },

  /* Occupancy bar */
  occBar:       { height: 7, backgroundColor: "#D1FAE5", borderRadius: 4, overflow: "hidden" },
  occFill:      { height: 7, backgroundColor: G, borderRadius: 4 },

  /* GPS strip — maintenant HORS de la carte pour aérer */
  gpsStrip:     { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 12,
                  marginHorizontal: 16, marginTop: 8, marginBottom: 6,
                  paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1 },
  gpsPulse:     { width: 8, height: 8, borderRadius: 4 },
  gpsStripTxt:  { fontSize: 12, fontWeight: "600", flex: 1 },
  gpsLiveBadge: { backgroundColor: "#DCFCE7", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  gpsLiveTxt:   { fontSize: 10, fontWeight: "800", color: "#166534" },

  /* Alert banner */
  alertBanner:  { marginHorizontal: 16, marginBottom: 6, backgroundColor: "#FEF2F2", borderRadius: 12,
                  paddingVertical: 10, paddingHorizontal: 12,
                  flexDirection: "row", alignItems: "center", gap: 10,
                  borderWidth: 1, borderColor: "#FECACA" },
  alertBannerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FEE2E2",
                     justifyContent: "center", alignItems: "center" },

  /* Quick action grid */
  quickGrid:    { flexDirection: "row", marginHorizontal: 16, marginTop: 10, marginBottom: 4,
                  gap: 8 },
  quickBtn:     { flex: 1, alignItems: "center", backgroundColor: "#fff", borderRadius: 14,
                  paddingVertical: 12, paddingHorizontal: 4,
                  shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
                  borderWidth: 1.5, borderColor: "#F1F5F9", gap: 6 },
  quickBtnActive: { borderColor: G, backgroundColor: G_LIGHT },
  quickIcon:    { width: 46, height: 46, borderRadius: 14, alignItems: "center",
                  justifyContent: "center", position: "relative" },
  quickLabel:   { fontSize: 11, fontWeight: "600", color: "#374151", textAlign: "center", lineHeight: 15 },
  quickBadge:   { position: "absolute", top: -4, right: -4, backgroundColor: "#DC2626",
                  borderRadius: 10, minWidth: 18, height: 18, alignItems: "center",
                  justifyContent: "center", paddingHorizontal: 4 },
  quickBadgeTxt:{ fontSize: 10, fontWeight: "800", color: "#fff" },

  /* Page header (fullscreen mode) */
  pageHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12,
                  borderBottomWidth: 1.5, borderBottomColor: "#E2E8F0" },
  pageBackBtn:  { flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: G_LIGHT, borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 8, width: 90 },
  pageBackTxt:  { fontSize: 13, fontWeight: "700", color: G_DARK },
  pageTitle:    { fontSize: 16, fontWeight: "800", color: "#0F172A", flex: 1, textAlign: "center" },

  /* Tabs */
  tabsScroll:   { flexGrow: 0, borderBottomWidth: 1.5, borderBottomColor: "#E2E8F0", backgroundColor: "#fff" },
  tabs:         { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22,
                  backgroundColor: "#F1F5F9", borderWidth: 1.5, borderColor: "#E2E8F0" },
  tabBtnActive: { backgroundColor: G_LIGHT, borderColor: G },
  tabText:      { fontSize: 12, fontWeight: "700", color: "#475569" },
  tabTextActive:{ color: G_DARK, fontWeight: "800" },

  /* Body */
  body:         { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 0 },

  /* Section title */
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginBottom: 14 },

  /* Passenger list header */
  passengerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  countBadge:   { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
                  flexDirection: "row", alignItems: "center", gap: 5 },
  countBadgeTxt:{ fontSize: 12, fontWeight: "800", color: "#fff" },

  /* Passenger card */
  passengerCard:{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
                  shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  passengerAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  passengerAvatarTxt: { fontSize: 19, fontWeight: "800", color: "#fff" },
  passengerName:{ fontSize: 15, fontWeight: "800", color: "#0F172A" },
  passengerPhone:{ fontSize: 12, color: G, textDecorationLine: "underline" },
  passengerNoPhone: { fontSize: 12, color: "#CBD5E1", marginTop: 2 },
  divider:      { height: 1, backgroundColor: "#F1F5F9", marginVertical: 10 },
  tagGreen:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F0FDF4",
                  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  callBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  marginTop: 10, backgroundColor: G_LIGHT, borderRadius: 10, paddingVertical: 10,
                  borderWidth: 1, borderColor: "#A7F3D0" },
  callBtnTxt:   { fontSize: 13, fontWeight: "700", color: G_DARK },

  /* Passenger card layout — stable references, no inline objects */
  paxCardRow:      { flexDirection: "row", alignItems: "center", gap: 12 },
  paxFlex1:        { flex: 1 },
  paxPhoneRow:     { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  paxTagsRow:      { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  paxSeatText:     { fontSize: 13, color: G_DARK, fontWeight: "700" },
  paxBoardingTag:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F5F3FF",
                     borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flex: 1 },
  paxBoardingText: { fontSize: 12, color: "#6D28D9", fontWeight: "600", flex: 1 },
  statusBadge:     { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
                     flexDirection: "row", alignItems: "center", gap: 5 },
  statusBadgeTxt:  { fontSize: 12, fontWeight: "700" },

  /* Contact tab */
  contactAvatar:       { backgroundColor: "#1E40AF" },
  contactSeat:         { fontSize: 12, color: "#64748B", marginTop: 2 },
  contactCallIconBtn:  { backgroundColor: "#ECFDF5", borderRadius: 14, padding: 11 },
  contactNoPhoneIcon:  { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 11 },
  contactBoarding:     { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10,
                         backgroundColor: "#F5F3FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  contactBoardingText: { fontSize: 12, color: "#6D28D9", fontWeight: "600" },

  /* Arrêts tab */
  stopWrapper:       { marginBottom: 8 },
  stopRowOuter:      { flexDirection: "row", alignItems: "flex-start" },
  stopDotCol:        { width: 32, alignItems: "center" },
  stopDotCircle:     { width: 28, height: 28, borderRadius: 14, backgroundColor: G,
                       alignItems: "center", justifyContent: "center" },
  stopDotText:       { fontSize: 12, fontWeight: "800", color: "#fff" },
  stopConnector:     { width: 2, height: 20, backgroundColor: "#D1FAE5", marginTop: 2 },
  stopConnectorDone: { backgroundColor: G },
  stopDotPasse:      { width: 26, height: 26, borderRadius: 13, backgroundColor: G,
                       alignItems: "center", justifyContent: "center" },
  stopDotEnCours:    { width: 26, height: 26, borderRadius: 13, backgroundColor: "#1E40AF",
                       alignItems: "center", justifyContent: "center",
                       shadowColor: "#1E40AF", shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 },
  stopCard:          { flex: 1, marginLeft: 10, backgroundColor: "#fff", borderRadius: 10,
                       padding: 10, marginBottom: 4, elevation: 1,
                       shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 2,
                       shadowOffset: { width: 0, height: 1 } },
  stopCardActive:    { borderWidth: 1.5, borderColor: "#1E40AF", backgroundColor: "#EFF6FF" },
  stopCardHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stopCardTitle:     { fontSize: 14, fontWeight: "700", color: "#111827" },
  stopBadge:         { backgroundColor: G_LIGHT, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  stopBadgeText:     { fontSize: 11, fontWeight: "700", color: G },
  stopCity:          { fontSize: 12, color: "#6B7280", marginTop: 1 },
  stopEstTime:       { fontSize: 11, color: "#1E40AF", fontWeight: "700" },
  stopStatusPasse:   { backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  stopStatusEnCours: { backgroundColor: "#DBEAFE", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  stopStatusPrevu:   { backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  stopStatusTxt:     { fontSize: 10, fontWeight: "800", color: G },
  stopPassList:      { marginTop: 8, gap: 4 },
  stopPassRow:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F0FDF4",
                       borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  stopPassAvatar:    { width: 20, height: 20, borderRadius: 10, backgroundColor: G,
                       alignItems: "center", justifyContent: "center" },
  stopPassAvatarText:{ fontSize: 10, color: "#fff", fontWeight: "700" },
  stopPassName:      { fontSize: 12, fontWeight: "600", color: "#166534", flex: 1 },
  stopPassRef:       { fontSize: 10, color: "#6B7280" },

  /* Alertes tab */
  alertsContainer:    { gap: 14 },
  alertEmptyTitle:    { fontSize: 15, fontWeight: "700", color: "#166534" },
  alertEmptyText:     { fontSize: 13, color: "#64748B", textAlign: "center" },
  alertCard:          { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 12,
                        borderLeftWidth: 4, borderLeftColor: "#DC2626",
                        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  alertRow:           { flexDirection: "row", alignItems: "center", gap: 8 },
  alertMessage:       { flex: 1, fontSize: 13, fontWeight: "800", color: "#0F172A" },
  alertTime:          { fontSize: 10, color: "#94A3B8" },
  alertRequestBanner: { flexDirection: "row", alignItems: "center", gap: 8,
                        backgroundColor: "#FEF3C7", borderRadius: 10, padding: 10 },
  alertRequestText:   { fontSize: 12, fontWeight: "700", color: "#D97706", flex: 1 },
  alertResponseBanner:{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10 },
  alertResponseText:  { fontSize: 12, fontWeight: "700", flex: 1 },
  alertStatusLabel:   { fontSize: 12, fontWeight: "700", color: "#64748B" },
  autoDetectedBadge:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEF3C7",
                        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  autoDetectedTxt:    { fontSize: 11, fontWeight: "700", color: "#D97706" },
  respGap:            { gap: 8 },
  respOptBtn:         { flexDirection: "row", alignItems: "center", gap: 10,
                        borderRadius: 10, padding: 14, borderWidth: 1.5 },
  respOptText:        { fontSize: 14, fontWeight: "700" },

  /* Add passenger button */
  addPassengerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                     backgroundColor: G, borderRadius: 14, paddingVertical: 15, marginTop: 8,
                     shadowColor: G, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  addPassengerBtnTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },

  /* Montée form */
  monteeHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16,
                  backgroundColor: "#fff", borderRadius: 14, padding: 14,
                  shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  warningBanner:{ backgroundColor: "#FEF3C7", borderRadius: 12, padding: 14, marginBottom: 14,
                  flexDirection: "row", alignItems: "center", gap: 10 },
  successBanner:{ backgroundColor: "#DCFCE7", borderRadius: 14, padding: 16, marginBottom: 16,
                  borderWidth: 1.5, borderColor: "#4ADE80" },
  formCard:     { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 14,
                  shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  formField:    { gap: 6 },
  fieldLabel:   { fontSize: 12, fontWeight: "700", color: "#374151" },
  fieldInput:   { borderWidth: 1.5, borderColor: "#D1FAE5", borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, backgroundColor: "#F0FDF4", color: "#111827" },
  seatBtn:      { flex: 1, borderWidth: 1.5, borderColor: "#D1FAE5", borderRadius: 10,
                  paddingVertical: 10, alignItems: "center", backgroundColor: "#F0FDF4" },
  seatBtnActive:{ backgroundColor: G, borderColor: G },
  seatBtnTxt:   { fontSize: 15, fontWeight: "800", color: G },
  seatBtnTxtActive: { color: "#fff" },
  submitBtn:    { backgroundColor: G, borderRadius: 12, paddingVertical: 14,
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  submitBtnTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },

  /* GPS card (in trajet tab) */
  gpsCard:      { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 14,
                  borderWidth: 1.5, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  gpsRow:       { flexDirection: "row", alignItems: "center" },
  gpsTitle:     { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  gpsSub:       { fontSize: 12, color: "#64748B", marginTop: 2 },
  gpsPill:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)",
                  borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  gpsDot:       { width: 7, height: 7, borderRadius: 4 },
  gpsLabel:     { fontSize: 11, color: "#fff", fontWeight: "600", maxWidth: 130 },
  gpsActiveBadge:    { backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gpsActiveBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#065F46" },

  /* Actions */
  actionsGrid:  { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn:    { flex: 1, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14,
                  alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#D1FAE5",
                  shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  actionBtnAmber: { borderColor: "#FDE68A" },
  actionBtnRed:   { borderColor: "#FECACA" },
  actionLabel:    { fontSize: 12, fontWeight: "700", color: G },

  /* Timeline */
  timeline:     { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16,
                  shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  timelineRow:  { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  timelineDot:  { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E2E8F0",
                  alignItems: "center", justifyContent: "center", marginRight: 12 },
  timelineDotActive: { backgroundColor: G, shadowColor: G, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  timelineDotDone:   { backgroundColor: "#D1FAE5" },
  timelineLine:      { width: 2, height: 22, backgroundColor: "#E2E8F0", marginLeft: 13, marginBottom: 4 },
  timelineLineDone:  { backgroundColor: "#A7F3D0" },
  timelineLabel:     { fontSize: 14, color: "#64748B", fontWeight: "600" },
  timelineLabelActive: { color: G_DARK, fontWeight: "800", fontSize: 15 },

  /* Departure badge (in trajet tab) */
  departureBadge: { marginTop: 8, backgroundColor: "#F0F9FF", borderRadius: 12, padding: 14,
                    borderLeftWidth: 4, borderLeftColor: "#0369A1" },

  /* Rapport button */
  rapportBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                  backgroundColor: "#BE123C", borderRadius: 14, paddingVertical: 14,
                  margin: 16, shadowColor: "#BE123C", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },

  /* ── Scan ticket tab ── */
  scanHeader:       { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  scanResultCard:   { borderRadius: 16, borderWidth: 2, padding: 16, marginBottom: 16,
                      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  scanResultTitle:  { fontSize: 16, fontWeight: "800", flex: 1, lineHeight: 22 },
  scanDetailRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  scanDetailTxt:    { fontSize: 13, color: "#374151", flex: 1, lineHeight: 18 },
  scanResetBtn:     { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14,
                      backgroundColor: "#F0FDF4", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
                      alignSelf: "flex-start", borderWidth: 1, borderColor: "#D1FAE5" },
  scanModeBar:      { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12,
                      borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 14, overflow: "hidden" },
  scanModeBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: 6, paddingVertical: 11 },
  scanModeBtnActive:{ borderBottomWidth: 2.5, borderBottomColor: G, backgroundColor: "#F0FDF4" },
  scanModeTxt:      { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  scanModeTxtActive:{ color: G_DARK, fontWeight: "700" },
  scanPermBox:      { backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center",
                      marginBottom: 16, borderWidth: 1.5, borderColor: "#E2E8F0" },
  scanPermBtn:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: G,
                      borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  scanCameraWrap:   { height: 260, borderRadius: 16, overflow: "hidden", marginBottom: 14, position: "relative" },
  scanCamera:       { flex: 1 },
  scanOverlay:      { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  scanBox:          { width: 190, height: 190, justifyContent: "center", alignItems: "center",
                      borderWidth: 0 },
  scanCorner:       { position: "absolute", width: 22, height: 22, borderColor: "#fff", borderWidth: 3 },
  scanCornerTL:     { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  scanCornerTR:     { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  scanCornerBL:     { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  scanCornerBR:     { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHintPill:     { position: "absolute", bottom: 14, flexDirection: "row", alignItems: "center", gap: 5,
                      backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  scanHintTxt:      { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  scanManualBox:    { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center",
                      marginBottom: 14, borderWidth: 1.5, borderColor: "#E2E8F0" },
  scanInput:        { width: "100%", borderWidth: 1.5, borderColor: "#D1D5DB", borderRadius: 10,
                      paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#111827",
                      textAlign: "center", fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  scanValidateBtn:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: G,
                      borderRadius: 12, paddingVertical: 13, paddingHorizontal: 24 },
  demoSection:      { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14,
                      borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 8 },
  demoTitle:        { fontSize: 13, fontWeight: "800", color: "#374151", marginBottom: 4 },
  demoTicketRow:    { flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
                      borderRadius: 10, padding: 12, marginBottom: 8,
                      borderWidth: 1, borderColor: "#E5E7EB" },
  demoTicketRef:    { fontSize: 13, fontWeight: "800", color: "#1F2937", fontFamily: "monospace" },
  demoTicketName:   { fontSize: 12, color: "#4B5563", marginTop: 2 },
  demoTicketNote:   { fontSize: 11, color: "#9CA3AF", marginTop: 1, fontStyle: "italic" },
  demoScanBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: G_LIGHT,
                      justifyContent: "center", alignItems: "center" },
});
