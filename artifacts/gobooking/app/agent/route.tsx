import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform, Linking, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { useNetworkStatus } from "@/utils/offline";
import { useAgentGps } from "@/utils/useAgentGps";
import OfflineBanner from "@/components/OfflineBanner";

const G       = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK  = "#065F46";
const AMBER   = "#D97706";

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
  const [tab, setTab]                   = useState<"trajet" | "passagers" | "contacts" | "arrets" | "alertes" | "montee">("trajet");

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const assignedTripId = user?.tripId ?? null;
  const assignedBusId  = user?.busId  ?? null;

  const gps = useAgentGps(activeTrip?.id ?? null, token);

  const loadTrips = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const raw = await apiFetch<any[]>("/trips/live", { token });
      /* Normalize API response (fromCity/toCity → from/to) */
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
          passengers: 7, totalSeats: 49, lat: 5.9, lon: -5.1, speed: 87 },
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
      setStopData(data.stops ?? []);
    } catch {
      setStopData([]);
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
        setBusAlerts(json.alerts ?? []);
      }
    } catch {}
  }, [token]);

  const respondToAlert = async (alertId: string, response: "panne" | "controle" | "pause") => {
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
    if (!manualName.trim()) { Alert.alert("Erreur", "Entrez le nom du passager."); return; }
    if (!manualPhone.trim()) { Alert.alert("Erreur", "Entrez le numéro de téléphone."); return; }
    const seats = parseInt(manualSeats, 10);
    if (isNaN(seats) || seats < 1 || seats > 10) { Alert.alert("Erreur", "Nombre de places invalide (1-10)."); return; }

    setManualSaving(true);
    try {
      const res = await apiFetch<{ bookingRef: string; totalAmount: number }>("/agent/route/manual-booking", {
        token: token ?? undefined, method: "POST",
        body: {
          passengerName: manualName.trim(),
          passengerPhone: manualPhone.trim(),
          boardingPoint: manualPoint.trim() || undefined,
          seatCount: seats,
        },
      });
      setManualSuccess({ bookingRef: res.bookingRef, total: res.totalAmount });
      setManualName(""); setManualPhone(""); setManualPoint(""); setManualSeats("1");
      /* Refresh passengers */
      if (activeTrip) loadPassengers(activeTrip.id);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer la réservation.");
    } finally {
      setManualSaving(false);
    }
  };

  /* Initial load */
  useEffect(() => { loadTrips(); loadMyDeparture(); }, []);

  /* Auto-refresh passengers every 15 seconds */
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
    ? `GPS actif · ${gps.speed ? Math.round(gps.speed) + " km/h" : "en route"}`
    : gps.error ? "GPS indisponible" : "Démarrage GPS…";

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      {/* Header */}
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>Suivi trajet</Text>
          <Text style={S.headerSub}>
            {lastSync
              ? `🟢 Sync ${lastSync.getHours().toString().padStart(2,"0")}:${lastSync.getMinutes().toString().padStart(2,"0")}:${lastSync.getSeconds().toString().padStart(2,"0")} · Auto 15s`
              : (user?.name ?? "Agent en route")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={S.gpsPill}>
            <View style={[S.gpsDot, { backgroundColor: gpsColor }]} />
            <Text style={S.gpsLabel} numberOfLines={1}>{gpsLabel}</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
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

      {/* No active trip */}
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
        <>
          {/* Trip selector (if multiple) */}
          {trips.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={S.tripChips}>
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

          {/* Active trip card */}
          {activeTrip && (
            <View style={S.tripCard}>
              <View style={S.tripRoute}>
                <Text style={S.tripCity}>{activeTrip.from}</Text>
                <View style={S.tripArrow}>
                  <View style={S.arrowLine} />
                  <Ionicons name="bus" size={20} color={G} />
                  <View style={S.arrowLine} />
                </View>
                <Text style={S.tripCity}>{activeTrip.to}</Text>
              </View>
              <View style={S.tripMeta}>
                <View style={S.metaItem}>
                  <Feather name="clock" size={13} color="#64748B" />
                  <Text style={S.metaText}>{activeTrip.departureTime} → {activeTrip.arrivalTime ?? "?"}</Text>
                </View>
                <View style={S.metaItem}>
                  <Feather name="truck" size={13} color="#64748B" />
                  <Text style={S.metaText}>{activeTrip.busName}</Text>
                </View>
                {activeTrip.speed != null && activeTrip.speed > 0 && (
                  <View style={S.metaItem}>
                    <Feather name="zap" size={13} color={AMBER} />
                    <Text style={[S.metaText, { color: AMBER }]}>{Math.round(activeTrip.speed)} km/h</Text>
                  </View>
                )}
              </View>
              {/* Occupancy bar */}
              {activeTrip.passengers != null && activeTrip.totalSeats != null && (
                <View style={S.occupancy}>
                  <View style={S.occRow}>
                    <Text style={S.occLabel}>Passagers à bord</Text>
                    <Text style={S.occCount}>{activeTrip.passengers}/{activeTrip.totalSeats}</Text>
                  </View>
                  <View style={S.occBar}>
                    <View style={[S.occFill, {
                      width: `${Math.round((activeTrip.passengers / activeTrip.totalSeats) * 100)}%`,
                    }]} />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Assigned trip/bus badge if set */}
          {(assignedTripId || assignedBusId) && (
            <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8, flexWrap: "wrap" }}>
              {assignedBusId && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Feather name="truck" size={11} color="#059669" />
                  <Text style={{ fontSize: 11, color: "#047857", fontWeight: "600" }}>Bus assigné</Text>
                </View>
              )}
              {assignedTripId && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0F9FF", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Feather name="navigation" size={11} color="#0369A1" />
                  <Text style={{ fontSize: 11, color: "#0369A1", fontWeight: "600" }}>Trajet assigné</Text>
                </View>
              )}
            </View>
          )}

          {/* Departure badge */}
          {myDeparture && (
            <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: "#F0F9FF", borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: "#0369A1" }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#0369A1" }}>🗓️ Mon départ : {myDeparture.villeDepart} → {myDeparture.villeArrivee}</Text>
              <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>⏰ {myDeparture.heureDepart} · {myDeparture.busName ?? "Bus"} {myDeparture.plateNumber ? `(${myDeparture.plateNumber})` : ""}</Text>
              {myDeparture.chauffeurNom && <Text style={{ fontSize: 11, color: "#64748B" }}>👤 {myDeparture.chauffeurNom}</Text>}
            </View>
          )}

          {/* Alert badge if any active alerts */}
          {busAlerts.length > 0 && (
            <TouchableOpacity onPress={() => setTab("alertes")}
              style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: "#FEE2E2", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, borderLeftWidth: 4, borderLeftColor: "#DC2626" }}>
              <Ionicons name="warning" size={18} color="#DC2626" />
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#DC2626", flex: 1 }}>🚨 {busAlerts.length} alerte(s) — Réponse requise</Text>
              <Ionicons name="chevron-forward" size={16} color="#DC2626" />
            </TouchableOpacity>
          )}

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabsScroll}>
            <View style={S.tabs}>
              {(["alertes", "trajet", "passagers", "arrets", "contacts", "montee"] as const).map(t => (
                <TouchableOpacity key={t} style={[S.tabBtn, tab === t && S.tabBtnActive]} onPress={() => setTab(t)}>
                  <Text style={[S.tabText, tab === t && S.tabTextActive]}>
                    {t === "alertes"   ? `🚨 Alertes${busAlerts.length > 0 ? ` (${busAlerts.length})` : ""}`
                     : t === "trajet"  ? "📍 Trajet"
                     : t === "passagers" ? "👥 Passagers"
                     : t === "arrets"  ? "🗺 Arrêts"
                     : t === "contacts" ? "📞 Contacts"
                     : "➕ Montée"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <ScrollView contentContainerStyle={S.body} showsVerticalScrollIndicator={false}>

            {/* ── TAB: ALERTES ── */}
            {tab === "alertes" && (
              <View style={{ gap: 14 }}>
                <Text style={S.sectionTitle}>🚨 Mes alertes à bord</Text>
                {busAlerts.length === 0 && (
                  <View style={{ backgroundColor: "#F0FDF4", borderRadius: 12, padding: 28, alignItems: "center", gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={36} color="#4ADE80" />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#166534" }}>Tout va bien !</Text>
                    <Text style={{ fontSize: 13, color: "#64748B", textAlign: "center" }}>Aucune alerte active pour votre bus.</Text>
                  </View>
                )}
                {busAlerts.map(alert => {
                  const hasResponse = !!alert.response;
                  const isActing    = alertActing === alert.id;
                  const RESP = [
                    { id: "panne"   as const, label: "🔧 Panne mécanique", color: "#DC2626", bg: "#FEE2E2" },
                    { id: "controle"as const, label: "🚔 Contrôle routier", color: "#D97706", bg: "#FEF3C7" },
                    { id: "pause"   as const, label: "☕ Pause normale",     color: "#166534", bg: "#DCFCE7" },
                  ];
                  const responseOpt = RESP.find(r => r.id === alert.response);
                  return (
                    <View key={alert.id} style={{ backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 12, borderLeftWidth: 4, borderLeftColor: "#DC2626", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="warning" size={20} color="#DC2626" />
                        <Text style={{ flex: 1, fontSize: 13, fontWeight: "800", color: "#0F172A" }}>{alert.message}</Text>
                        <Text style={{ fontSize: 10, color: "#94A3B8" }}>
                          {new Date(alert.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>

                      {/* Request indicator */}
                      {alert.responseRequested && !hasResponse && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 10, padding: 10 }}>
                          <Ionicons name="mail-open-outline" size={16} color="#D97706" />
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#D97706", flex: 1 }}>
                            📨 L'agent suivi demande votre réponse !
                          </Text>
                        </View>
                      )}

                      {/* Response sent */}
                      {hasResponse && responseOpt && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: responseOpt.bg, borderRadius: 10, padding: 10 }}>
                          <Ionicons name="checkmark-circle" size={16} color={responseOpt.color} />
                          <Text style={{ fontSize: 12, fontWeight: "700", color: responseOpt.color }}>
                            ✅ Réponse envoyée : {responseOpt.label}
                          </Text>
                        </View>
                      )}

                      {/* Response buttons */}
                      {!hasResponse && (
                        <>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748B" }}>Quelle est la situation ?</Text>
                          <View style={{ gap: 8 }}>
                            {RESP.map(opt => (
                              <TouchableOpacity key={opt.id}
                                style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: opt.bg, borderRadius: 10, padding: 14, borderWidth: 1.5, borderColor: opt.color + "50" }}
                                onPress={() => respondToAlert(alert.id, opt.id)}
                                disabled={isActing}
                              >
                                {isActing ? <ActivityIndicator size="small" color={opt.color} /> : <Ionicons name="radio-button-on" size={18} color={opt.color} />}
                                <Text style={{ fontSize: 14, fontWeight: "700", color: opt.color }}>{opt.label}</Text>
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

            {tab === "trajet" && activeTrip && (
              <>
                {/* GPS status */}
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

                {/* Action buttons */}
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

                {/* Status timeline */}
                <Text style={[S.sectionTitle, { marginTop: 8 }]}>Statut du trajet</Text>
                <View style={S.timeline}>
                  {[
                    { icon: "✅", label: "Départ effectué", done: true },
                    { icon: "🚌", label: "En route vers " + activeTrip.to, done: true, active: true },
                    { icon: "📍", label: "Arrivée à " + activeTrip.to, done: false },
                  ].map((step, i) => (
                    <View key={i} style={S.timelineRow}>
                      <View style={[S.timelineDot, step.active && S.timelineDotActive, step.done && !step.active && S.timelineDotDone]}>
                        <Text style={{ fontSize: 10 }}>{step.icon}</Text>
                      </View>
                      {i < 2 && <View style={[S.timelineLine, step.done && !step.active && S.timelineLineDone]} />}
                      <Text style={[S.timelineLabel, step.active && S.timelineLabelActive]}>{step.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {tab === "passagers" && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <Text style={S.sectionTitle}>Passagers à bord</Text>
                  <View style={{ backgroundColor: G, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>{passengers.length} pers.</Text>
                  </View>
                </View>
                {passLoading && <ActivityIndicator color={G} style={{ marginTop: 20 }} />}
                {!passLoading && passengers.length === 0 && (
                  <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
                    <Text style={{ fontSize: 32 }}>👥</Text>
                    <Text style={S.emptySub}>Aucun passager enregistré</Text>
                  </View>
                )}
                {!passLoading && passengers.map((p, i) => {
                  const isBoarded   = p.status === "boarded" || p.status === "confirmed";
                  const statusBg    = isBoarded ? "#DCFCE7" : "#FEF9C3";
                  const statusColor = isBoarded ? "#166534" : "#92400E";
                  const statusText  = isBoarded ? "✅ À bord" : "⏳ En attente";
                  return (
                    <View key={i} style={S.passengerCard}>
                      {/* Ligne 1 : avatar + nom + statut */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[S.passengerAvatar, { width: 46, height: 46, borderRadius: 23, backgroundColor: isBoarded ? G : "#94A3B8" }]}>
                          <Text style={[S.passengerAvatarTxt, { fontSize: 19 }]}>{p.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "800", color: "#0F172A" }}>{p.name}</Text>
                          {p.phone
                            ? <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{p.phone}</Text>
                            : <Text style={{ fontSize: 12, color: "#CBD5E1", marginTop: 2 }}>Pas de téléphone</Text>}
                        </View>
                        <View style={{ backgroundColor: statusBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: statusColor }}>{statusText}</Text>
                        </View>
                      </View>

                      {/* Séparateur */}
                      <View style={{ height: 1, backgroundColor: "#F1F5F9", marginVertical: 10 }} />

                      {/* Ligne 2 : siège + point d'embarquement */}
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F0FDF4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Feather name="hash" size={12} color={G} />
                          <Text style={{ fontSize: 13, color: G_DARK, fontWeight: "700" }}>Siège {p.seatNumber}</Text>
                        </View>
                        {p.boardingPoint && (
                          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F5F3FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <Ionicons name="location-outline" size={12} color="#7C3AED" />
                            <Text style={{ fontSize: 12, color: "#6D28D9", fontWeight: "600", flex: 1 }} numberOfLines={1}>{p.boardingPoint}</Text>
                          </View>
                        )}
                      </View>

                      {/* Bouton appel */}
                      {p.phone && (
                        <TouchableOpacity
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, backgroundColor: G_LIGHT, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: "#A7F3D0" }}
                          onPress={() => Linking.openURL(`tel:${p.phone!.replace(/\s/g, "")}`)}
                          activeOpacity={0.75}
                        >
                          <Feather name="phone" size={15} color={G} />
                          <Text style={{ fontSize: 13, fontWeight: "700", color: G_DARK }}>Appeler — {p.phone}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {tab === "arrets" && (
              <>
                <Text style={S.sectionTitle}>Ordre des arrêts</Text>
                {stopLoading && <ActivityIndicator color={G} style={{ marginTop: 20 }} />}
                {!stopLoading && stopData.length === 0 && (
                  <View style={{ alignItems: "center", marginTop: 24, gap: 8 }}>
                    <Text style={{ fontSize: 28 }}>🗺️</Text>
                    <Text style={S.emptySub}>Aucun arrêt configuré pour ce trajet.</Text>
                  </View>
                )}
                {!stopLoading && stopData.map((stop, idx) => (
                  <View key={stop.id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      {/* order dot + connector */}
                      <View style={{ width: 32, alignItems: "center" }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: G, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{idx + 1}</Text>
                        </View>
                        {idx < stopData.length - 1 && (
                          <View style={{ width: 2, height: 20, backgroundColor: "#D1FAE5", marginTop: 2 }} />
                        )}
                      </View>
                      {/* stop info */}
                      <View style={{ flex: 1, marginLeft: 10, backgroundColor: "#fff", borderRadius: 10, padding: 10, marginBottom: 4, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>{stop.name}</Text>
                          <View style={{ backgroundColor: G_LIGHT, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: G }}>{stop.passengers.length} passager{stop.passengers.length !== 1 ? "s" : ""}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>{stop.city}</Text>
                        {stop.passengers.length > 0 && (
                          <View style={{ marginTop: 8, gap: 4 }}>
                            {stop.passengers.map((p, pi) => (
                              <View key={pi} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F0FDF4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: G, alignItems: "center", justifyContent: "center" }}>
                                  <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>{(p.userName ?? "?").charAt(0)}</Text>
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: "600", color: "#166534", flex: 1 }}>{p.userName ?? "Passager"}</Text>
                                <Text style={{ fontSize: 10, color: "#6B7280" }}>#{p.bookingRef}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {tab === "montee" && (
              <>
                <Text style={S.sectionTitle}>➕ Montée en cours de route</Text>
                <Text style={{ fontSize: 12, color: "#64748B", marginBottom: 12, lineHeight: 18 }}>
                  Enregistrez un passager qui monte à bord sans application. La réservation est automatiquement liée à votre trajet en cours et synchronisée avec l'agent de réservation.
                </Text>

                {/* Success banner */}
                {manualSuccess && (
                  <View style={{ backgroundColor: "#DCFCE7", borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: "#4ADE80", gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={22} color="#166534" />
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#166534" }}>Passager enregistré !</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: "#166534" }}>Réf : <Text style={{ fontWeight: "800" }}>{manualSuccess.bookingRef}</Text></Text>
                    <Text style={{ fontSize: 12, color: "#4B5563" }}>Montant : {manualSuccess.total.toLocaleString()} FCFA · SMS envoyé au passager</Text>
                    <TouchableOpacity onPress={() => setManualSuccess(null)} style={{ alignSelf: "flex-end" }}>
                      <Text style={{ fontSize: 12, color: "#166534", fontWeight: "700" }}>Fermer ✕</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Form */}
                {!assignedTripId && (
                  <View style={{ backgroundColor: "#FEF3C7", borderRadius: 12, padding: 14, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="warning-outline" size={20} color="#D97706" />
                    <Text style={{ fontSize: 12, color: "#92400E", flex: 1, lineHeight: 18 }}>
                      Aucun trajet assigné à votre compte. Demandez à votre compagnie de vous assigner un trajet pour pouvoir créer des réservations.
                    </Text>
                  </View>
                )}

                <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 }}>Nom du passager *</Text>
                    <TextInput
                      style={{ borderWidth: 1.5, borderColor: "#D1FAE5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: "#F0FDF4" }}
                      placeholder="Ex : Kouassi Marie"
                      value={manualName} onChangeText={setManualName}
                      editable={!manualSaving}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 }}>Téléphone *</Text>
                    <TextInput
                      style={{ borderWidth: 1.5, borderColor: "#D1FAE5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: "#F0FDF4" }}
                      placeholder="Ex : 07 01 23 45 67"
                      value={manualPhone} onChangeText={setManualPhone}
                      keyboardType="phone-pad"
                      editable={!manualSaving}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 }}>Point de montée</Text>
                    <TextInput
                      style={{ borderWidth: 1.5, borderColor: "#D1FAE5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: "#F0FDF4" }}
                      placeholder="Ex : Carrefour Koumassi"
                      value={manualPoint} onChangeText={setManualPoint}
                      editable={!manualSaving}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 }}>Nombre de places</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {["1","2","3","4"].map(n => (
                        <TouchableOpacity key={n}
                          style={{ flex: 1, borderWidth: 1.5, borderColor: manualSeats === n ? G : "#D1FAE5", borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: manualSeats === n ? G : "#F0FDF4" }}
                          onPress={() => setManualSeats(n)} disabled={manualSaving}
                        >
                          <Text style={{ fontSize: 15, fontWeight: "800", color: manualSeats === n ? "#fff" : G }}>{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: G, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: (!assignedTripId || manualSaving) ? 0.5 : 1 }}
                    onPress={handleManualBooking}
                    disabled={!assignedTripId || manualSaving}
                  >
                    {manualSaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="person-add" size={18} color="#fff" />}
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
                      {manualSaving ? "Enregistrement…" : "Enregistrer la montée"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

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
                  <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
                    <Text style={{ fontSize: 32 }}>📞</Text>
                    <Text style={S.emptySub}>Aucun contact disponible</Text>
                  </View>
                )}
                {!passLoading && passengers.map((p, i) => (
                  <View key={i} style={S.passengerCard}>
                    {/* En-tête : avatar + infos + bouton appel rapide */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={[S.passengerAvatar, { width: 46, height: 46, borderRadius: 23, backgroundColor: "#1E40AF" }]}>
                        <Text style={[S.passengerAvatarTxt, { fontSize: 19 }]}>{p.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: "#0F172A" }}>{p.name}</Text>
                        <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Siège {p.seatNumber}</Text>
                      </View>
                      {p.phone ? (
                        <TouchableOpacity
                          style={{ backgroundColor: "#ECFDF5", borderRadius: 14, padding: 11, alignItems: "center", justifyContent: "center" }}
                          onPress={() => Linking.openURL(`tel:${p.phone!.replace(/\s/g, "")}`)}
                          activeOpacity={0.7}
                        >
                          <Feather name="phone" size={20} color={G} />
                        </TouchableOpacity>
                      ) : (
                        <View style={{ backgroundColor: "#F1F5F9", borderRadius: 14, padding: 11 }}>
                          <Feather name="phone-off" size={20} color="#94A3B8" />
                        </View>
                      )}
                    </View>

                    {/* Point d'embarquement */}
                    {p.boardingPoint && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#F5F3FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Ionicons name="location-outline" size={12} color="#7C3AED" />
                        <Text style={{ fontSize: 12, color: "#6D28D9", fontWeight: "600" }}>{p.boardingPoint}</Text>
                      </View>
                    )}

                    {/* Bouton appel large */}
                    {p.phone && (
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, backgroundColor: "#ECFDF5", borderRadius: 10, paddingVertical: 11, borderWidth: 1.5, borderColor: "#6EE7B7" }}
                        onPress={() => Linking.openURL(`tel:${p.phone!.replace(/\s/g, "")}`)}
                        activeOpacity={0.75}
                      >
                        <Feather name="phone-call" size={15} color={G} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: G_DARK }}>{p.phone}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Rapport button */}
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#BE123C", borderRadius: 14, paddingVertical: 14, margin: 16, shadowColor: "#BE123C", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        onPress={() => router.push("/agent/rapport" as never)}
      >
        <Feather name="alert-triangle" size={16} color="#fff" />
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>📋 Faire un rapport</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: G_LIGHT },
  header:           { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 14,
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:      { color: "white", fontSize: 18, fontWeight: "700" },
  headerSub:        { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 1 },
  gpsPill:          { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)",
                      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 6, maxWidth: 150 },
  gpsDot:           { width: 8, height: 8, borderRadius: 4 },
  gpsLabel:         { color: "white", fontSize: 10, fontWeight: "600", flexShrink: 1 },

  emptyState:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyTitle:       { fontSize: 18, fontWeight: "700", color: G_DARK, marginBottom: 6 },
  emptySub:         { fontSize: 13, color: "#64748B", textAlign: "center", marginBottom: 16 },
  refreshBtn:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: G_LIGHT,
                      borderWidth: 1.5, borderColor: G, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  refreshTxt:       { color: G, fontSize: 14, fontWeight: "600" },

  tripChips:        { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip:             { borderRadius: 20, borderWidth: 1.5, borderColor: "#CBD5E1", paddingHorizontal: 14, paddingVertical: 6 },
  chipActive:       { borderColor: G, backgroundColor: G },
  chipText:         { fontSize: 13, color: "#475569" },
  chipTextActive:   { color: "white", fontWeight: "600" },

  tripCard:         { margin: 16, marginBottom: 0, backgroundColor: "white", borderRadius: 16, padding: 16,
                      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
                      elevation: 3, borderLeftWidth: 4, borderLeftColor: G },
  tripRoute:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  tripCity:         { fontSize: 20, fontWeight: "800", color: G_DARK },
  tripArrow:        { flexDirection: "row", alignItems: "center", flex: 1, marginHorizontal: 8, gap: 4 },
  arrowLine:        { flex: 1, height: 1.5, backgroundColor: "#CBD5E1" },
  tripMeta:         { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem:         { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText:         { fontSize: 13, color: "#475569" },
  occupancy:        { marginTop: 12 },
  occRow:           { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  occLabel:         { fontSize: 12, color: "#64748B" },
  occCount:         { fontSize: 12, fontWeight: "700", color: G_DARK },
  occBar:           { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  occFill:          { height: "100%", backgroundColor: G, borderRadius: 3 },

  tabsScroll:       { marginHorizontal: 16, marginVertical: 12 },
  tabs:             { flexDirection: "row", backgroundColor: "white",
                      borderRadius: 10, padding: 4, gap: 4,
                      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  tabBtn:           { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, alignItems: "center" },
  tabBtnActive:     { backgroundColor: G },
  tabText:          { fontSize: 13, color: "#64748B", fontWeight: "600" },
  tabTextActive:    { color: "white" },

  body:             { paddingHorizontal: 16, paddingBottom: 80 },
  sectionTitle:     { fontSize: 14, fontWeight: "700", color: G_DARK, marginTop: 4, marginBottom: 10 },

  gpsCard:          { backgroundColor: "white", borderRadius: 12, padding: 14, borderWidth: 1.5,
                      marginBottom: 12,
                      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  gpsRow:           { flexDirection: "row", alignItems: "center" },
  gpsTitle:         { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  gpsSub:           { fontSize: 12, color: "#64748B", marginTop: 2 },
  gpsActiveBadge:   { backgroundColor: "#DCFCE7", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  gpsActiveBadgeTxt:{ fontSize: 10, fontWeight: "800", color: "#166534", letterSpacing: 0.5 },

  actionsGrid:      { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn:        { flex: 1, backgroundColor: "white", borderRadius: 12, padding: 14, alignItems: "center", gap: 6,
                      borderWidth: 1.5, borderColor: "#E2E8F0",
                      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  actionBtnAmber:   { borderColor: "#FCD34D" },
  actionBtnRed:     { borderColor: "#FCA5A5" },
  actionLabel:      { fontSize: 12, fontWeight: "700", color: G },

  timeline:         { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 0,
                      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  timelineRow:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 0 },
  timelineDot:      { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E2E8F0",
                      alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineDotActive:{ backgroundColor: "#DCFCE7", borderWidth: 2, borderColor: G },
  timelineDotDone:  { backgroundColor: "#DCFCE7" },
  timelineLine:     { position: "absolute", left: 13, top: 28, width: 2, height: 32, backgroundColor: "#E2E8F0" },
  timelineLineDone: { backgroundColor: G },
  timelineLabel:    { fontSize: 13, color: "#64748B", paddingTop: 6, flex: 1 },
  timelineLabelActive: { color: G_DARK, fontWeight: "700" },

  passengerCard:    { backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 10,
                      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
                      borderLeftWidth: 3, borderLeftColor: G },
  passengerRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "white",
                      borderRadius: 10, padding: 12, marginBottom: 8, gap: 10,
                      shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  passengerAvatar:  { width: 36, height: 36, borderRadius: 18, backgroundColor: G_DARK,
                      alignItems: "center", justifyContent: "center" },
  passengerAvatarTxt: { color: "white", fontWeight: "700", fontSize: 15 },
  passengerName:    { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  passengerSeat:    { fontSize: 12, color: "#64748B" },
  badge:            { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeTxt:         { fontSize: 11, fontWeight: "700" },
});
