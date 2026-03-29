import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { getSeatColor, SEAT_LEGEND } from "@/utils/seatColors";
import { apiFetch } from "@/utils/api";

const INDIGO  = "#3730A3";
const INDIGO2 = "#4F46E5";
const LIGHT   = "#EEF2FF";
const RED     = "#DC2626";

const CI_CITIES = [
  "Abidjan", "Abengourou", "Aboisso", "Adzopé", "Agboville", "Agnibilékrou",
  "Alépé", "Anyama", "Bangolo", "Bettié", "Biankouma", "Bingerville",
  "Bocanda", "Bondoukou", "Bongouanou", "Bonoua", "Bouaflé", "Bouaké",
  "Bouna", "Boundiali", "Dabou", "Daloa", "Danané", "Daoukro",
  "Didiévi", "Dimbokro", "Divo", "Duékoué", "Ferkessédougou", "Fresco",
  "Gagnoa", "Grand-Bassam", "Grand-Béréby", "Grand-Lahou", "Guiglo", "Issia",
  "Jacqueville", "Katiola", "Kong", "Korhogo", "Lakota", "Man",
  "Mankono", "Mbahiakro", "Méagui", "Minignan", "Niakaramandougou", "Niablé",
  "Odienné", "Oumé", "San-Pédro", "Sassandra", "Séguéla", "Sikensi",
  "Sinfra", "Sinématiali", "Soubré", "Tabou", "Taï", "Tengréla",
  "Tiassalé", "Tiébissou", "Touba", "Toulepleu", "Toumodi", "Vavoua",
  "Yamoussoukro", "Zouan-Hounien", "Zuénoula",
];

type Trip = {
  id: string; from_city: string; to_city: string; date: string;
  departure_time: string; arrival_time: string; status: string; price: number;
  bus_name: string; bus_id: string | null; total_seats: number;
  passenger_count: number; parcel_count: number;
  capacity_status?: string; delay_minutes?: number;
  estimated_arrival_time?: string; actual_departure_time?: string;
  waypoints_passed?: string[]; stops?: any[]; alighted_count?: number;
  intel?: any;
};

type Bus = {
  id: string; bus_name: string; plate_number: string; bus_type: string;
  capacity: number; availability_status: string; location_source?: string;
  from_city?: string; to_city?: string;
};

type AuditLog = {
  id: string; action: string; target_id: string; created_at: string;
  old_data?: any; new_data?: any; reason?: string;
};

type FormState = {
  from: string; to: string; date: string;
  departureTime: string; arrivalTime: string;
  price: string; busId: string; reason: string;
  tripType: "standard" | "vip" | "vip_plus";
};

const TRIP_TYPES: { key: "standard" | "vip" | "vip_plus"; label: string; icon: string; color: string; bg: string }[] = [
  { key: "standard", label: "Standard",  icon: "truck",   color: "#3730A3", bg: "#EEF2FF" },
  { key: "vip",      label: "VIP",       icon: "star",    color: "#B45309", bg: "#FEF3C7" },
  { key: "vip_plus", label: "VIP+",      icon: "zap",     color: "#7C3AED", bg: "#F5F3FF" },
];

function today() { return new Date().toISOString().slice(0, 10); }

function actionLabel(action: string): { label: string; icon: string; color: string } {
  if (action === "chef_create_trip")       return { label: "Création de trajet",      icon: "plus-circle",  color: INDIGO2 };
  if (action === "chef_modify_trip")       return { label: "Modification de trajet",   icon: "edit-2",       color: "#D97706" };
  if (action === "chef_cancel_trip")       return { label: "Annulation de trajet",     icon: "x-circle",     color: RED };
  if (action === "chef_emergency_transfer") return { label: "Transfert d'urgence",     icon: "alert-triangle", color: "#DC2626" };
  if (action === "chef_mark_waypoint")      return { label: "Escale marquée",           icon: "map-pin",        color: "#166534" };
  return { label: action, icon: "activity", color: "#6B7280" };
}

function tripStatusInfo(s: string) {
  if (s === "scheduled")   return { label: "Programmé",    color: "#D97706", bg: "#FEF3C7", live: false };
  if (s === "boarding")    return { label: "Embarquement", color: "#7C3AED", bg: "#EDE9FE", live: true  };
  if (s === "en_route")    return { label: "En route",     color: "#166534", bg: "#DCFCE7", live: true  };
  if (s === "in_progress") return { label: "En route",     color: "#166534", bg: "#DCFCE7", live: true  };
  if (s === "arrived")     return { label: "Arrivé",       color: "#0369A1", bg: "#E0F2FE", live: false };
  if (s === "completed")   return { label: "Terminé",      color: "#6B7280", bg: "#F3F4F6", live: false };
  if (s === "cancelled")   return { label: "Annulé",       color: RED,       bg: "#FEE2E2", live: false };
  return { label: s, color: "#6B7280", bg: "#F3F4F6", live: false };
}

function capacityBadge(c?: string): { label: string; color: string; bg: string } | null {
  if (c === "overloaded")  return { label: "⚠️ Surcharge",   color: RED,      bg: "#FEE2E2" };
  if (c === "full")        return { label: "🔴 Complet",      color: RED,      bg: "#FEE2E2" };
  if (c === "almost_full") return { label: "🟡 Presque plein", color: "#D97706", bg: "#FEF3C7" };
  return null;
}

function busAvailLabel(b: Bus): { label: string; color: string; bg: string; selectable: boolean } {
  if (b.availability_status === "disponible" || b.availability_status === "en_attente")
    return { label: "Disponible",   color: "#166534", bg: "#DCFCE7", selectable: true };
  if (b.availability_status === "en_service")
    return { label: `En route → ${b.to_city ?? "?"}`, color: "#D97706", bg: "#FEF3C7", selectable: false };
  if (b.availability_status === "en_panne")
    return { label: "En panne",     color: RED,       bg: "#FEE2E2", selectable: false };
  if (b.availability_status === "en_maintenance")
    return { label: "Maintenance",  color: "#6B7280", bg: "#F3F4F6", selectable: false };
  if (b.availability_status === "affecté")
    return { label: "Affecté",      color: "#7C3AED", bg: "#EDE9FE", selectable: false };
  return     { label: b.availability_status, color: "#6B7280", bg: "#F3F4F6", selectable: true };
}

export default function ChefTrips() {
  const { token, user, logoutIfActiveToken } = useAuth();
  const authToken = token ?? "";

  /* ── État global ── */
  const [trips,       setTrips]       = useState<Trip[]>([]);
  const [buses,       setBuses]       = useState<Bus[]>([]);
  const [auditLogs,   setAuditLogs]   = useState<AuditLog[]>([]);
  const [agenceCity,  setAgenceCity]  = useState<string>("");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [activeTab,   setActiveTab]   = useState<"trips" | "historique">("trips");

  /* ── Modaux ── */
  const [showForm,     setShowForm]     = useState(false);  // Créer / modifier
  const [showTransfer, setShowTransfer] = useState(false);  // Transfert urgence
  const [editId,       setEditId]       = useState<string | null>(null);
  const [transferTripId, setTransferTripId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    from: "", to: "", date: today(), departureTime: "07:00",
    arrivalTime: "12:00", price: "", busId: "", reason: "", tripType: "standard",
  });
  const [priceSource, setPriceSource] = useState<"manual" | "company" | "global" | null>(null);
  const [priceLookupLoading, setPriceLookupLoading] = useState(false);

  const [xferForm, setXferForm] = useState({
    newBusId: "", location: "", detail: "",
  });

  /* ── Modal Carte des sièges ── */
  const [showSeats, setShowSeats]         = useState(false);
  const [seatsTrip, setSeatsTrip]         = useState<Trip | null>(null);
  const [seatsData, setSeatsData]         = useState<any | null>(null);
  const [seatsLoading, setSeatsLoading]   = useState(false);
  const [selectedSeat, setSelectedSeat]   = useState<any | null>(null);
  const seatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Modal Passagers ── */
  const [showPassengers, setShowPassengers]     = useState(false);
  const [passengersTrip, setPassengersTrip]     = useState<Trip | null>(null);
  const [passengersData, setPassengersData]     = useState<any | null>(null);
  const [passengersLoading, setPassengersLoading] = useState(false);

  const refreshSeats = useCallback(async (tripId: string) => {
    try {
      const data = await apiFetch<any>(`/agent/chef/trips/${tripId}/seats`, { token: authToken });
      setSeatsData(data);
    } catch {}
  }, [authToken]);

  async function openSeatMap(trip: Trip) {
    setSeatsTrip(trip);
    setSeatsData(null);
    setSelectedSeat(null);
    setShowSeats(true);
    setSeatsLoading(true);
    try {
      const data = await apiFetch<any>(`/agent/chef/trips/${trip.id}/seats`, { token: authToken });
      setSeatsData(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Impossible de charger les sièges");
      setShowSeats(false);
    } finally {
      setSeatsLoading(false);
    }
  }

  /* ── Polling plan de sièges (15s) quand modal ouvert ── */
  useEffect(() => {
    if (!showSeats || !seatsTrip) {
      if (seatPollRef.current) { clearInterval(seatPollRef.current); seatPollRef.current = null; }
      return;
    }
    seatPollRef.current = setInterval(() => refreshSeats(seatsTrip.id), 15_000);
    return () => { if (seatPollRef.current) { clearInterval(seatPollRef.current); seatPollRef.current = null; } };
  }, [showSeats, seatsTrip, refreshSeats]);

  async function openPassengers(trip: Trip) {
    setPassengersTrip(trip);
    setPassengersData(null);
    setShowPassengers(true);
    setPassengersLoading(true);
    try {
      const data = await apiFetch<any>(`/agent/chef/trips/${trip.id}/passengers`, { token: authToken });
      setPassengersData(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Impossible de charger les passagers");
      setShowPassengers(false);
    } finally {
      setPassengersLoading(false);
    }
  }

  /* ── Modal Escale (Waypoint) ── */
  const [showWaypoint, setShowWaypoint]   = useState(false);
  const [waypointTrip, setWaypointTrip]   = useState<Trip | null>(null);
  const [waypointCity, setWaypointCity]   = useState("");

  function openWaypoint(trip: Trip) {
    setWaypointTrip(trip);
    setWaypointCity("");
    setShowWaypoint(true);
  }

  async function saveWaypoint() {
    if (!waypointCity || !waypointTrip) return;
    setSaving(true);
    try {
      await apiFetch(`/agent/chef/trips/${waypointTrip.id}/waypoint`, {
        method: "POST", token: authToken,
        body: JSON.stringify({ city: waypointCity }),
      });
      Alert.alert("Escale enregistrée",
        `L'escale "${waypointCity}" a été marquée. Les sièges des passagers qui y descendent sont maintenant libérés.`);
      setShowWaypoint(false);
      load();
      if (showSeats && seatsTrip?.id === waypointTrip.id) {
        refreshSeats(waypointTrip.id);
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Impossible d'enregistrer l'escale");
    } finally {
      setSaving(false);
    }
  }

  /* ── Chargement données ── */
  const load = useCallback(async () => {
    /* Guard: skip fetch during role transitions (screen still mounted while navigating away) */
    if (!authToken || user?.agentRole !== "chef_agence") { setLoading(false); return; }
    try {
      const [t, b, a] = await Promise.all([
        apiFetch<{ trips: Trip[] }>("/agent/chef/trips", { token: authToken }),
        apiFetch<{ buses: Bus[]; agenceCity: string }>("/agent/chef/available-buses", { token: authToken }),
        apiFetch<{ logs: AuditLog[] }>("/agent/chef/audit-log", { token: authToken }),
      ]);
      setTrips(t.trips ?? []);
      setBuses(b.buses ?? []);
      setAgenceCity(b.agenceCity ?? "");
      setAuditLogs(a.logs ?? []);
    } catch (e: any) {
      /* 401 = token truly invalid → logout.  403 = RBAC (wrong role) → never logout */
      if (e?.httpStatus === 401) {
        logoutIfActiveToken(authToken);
        return;
      }
      console.error("[chef-trips]", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken, user, logoutIfActiveToken]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  /* ── Auto-lookup du prix quand from/to/tripType changent ── */
  useEffect(() => {
    if (!form.from || !form.to || form.from === form.to || editId) return;
    let cancelled = false;
    const run = async () => {
      setPriceLookupLoading(true);
      try {
        const r = await apiFetch<{ price: number | null; source: string }>(
          `/company/pricing/lookup?from=${encodeURIComponent(form.from)}&to=${encodeURIComponent(form.to)}&type=${form.tripType}`,
          { token: authToken }
        );
        if (!cancelled && r.price != null) {
          setForm(f => ({ ...f, price: String(r.price) }));
          setPriceSource(r.source === "company" || r.source === "company_reverse" ? "company" : "global");
        } else if (!cancelled && r.price == null) {
          setForm(f => ({ ...f, price: "" }));
          setPriceSource(null);
        }
      } catch { /* si le lookup échoue, laisser le champ tel quel */ }
      finally { if (!cancelled) setPriceLookupLoading(false); }
    };
    const t = setTimeout(run, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.from, form.to, form.tripType, editId, authToken]);

  /* ── Créer / Modifier un départ ── */
  function openCreate() {
    setEditId(null);
    setPriceSource(null);
    setForm({ from: "", to: "", date: today(), departureTime: "07:00", arrivalTime: "12:00", price: "", busId: "", reason: "", tripType: "standard" });
    setShowForm(true);
  }

  function openEdit(trip: Trip) {
    setEditId(trip.id);
    setPriceSource("manual");
    setForm({
      from: trip.from_city, to: trip.to_city, date: trip.date,
      departureTime: trip.departure_time, arrivalTime: trip.arrival_time,
      price: String(trip.price ?? ""), busId: trip.bus_id ?? "", reason: "",
      tripType: (trip as any).trip_type ?? "standard",
    });
    setShowForm(true);
  }

  async function saveTrip() {
    if (!editId && (!form.from || !form.to || !form.date || !form.departureTime)) {
      Alert.alert("Champs manquants", "Veuillez remplir : départ, destination, date et heure.");
      return;
    }
    if (!editId && form.from === form.to) {
      Alert.alert("Erreur", "La ville de départ et d'arrivée doivent être différentes.");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await apiFetch(`/agent/chef/trips/${editId}`, {
          method: "PUT", token: authToken,
          body: JSON.stringify({
            departureTime: form.departureTime, arrivalTime: form.arrivalTime,
            price: form.price ? Number(form.price) : undefined,
            busId: form.busId || undefined, reason: form.reason || undefined,
          }),
        });
        Alert.alert("Succès", "Départ modifié avec succès.");
      } else {
        const r = await apiFetch<any>("/agent/chef/trips", {
          method: "POST", token: authToken,
          body: JSON.stringify({
            from: form.from, to: form.to, date: form.date,
            departureTime: form.departureTime, arrivalTime: form.arrivalTime,
            price: form.price ? Number(form.price) : 0,
            tripType: form.tripType,
            busId: form.busId || undefined,
          }),
        });
        Alert.alert("✅ Départ programmé", `${form.from} → ${form.to}\n${form.date} à ${form.departureTime}\nCar : ${r.busName ?? "À définir"}\nLes agents ont été notifiés.`);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Une erreur s'est produite.");
    } finally {
      setSaving(false);
    }
  }

  /* ── Annuler un trajet ── */
  function askCancelTrip(tripId: string, route: string) {
    Alert.alert(
      "Confirmer l'annulation",
      `Annuler le départ « ${route} » ?\n\nLes passagers seront notifiés par SMS.`,
      [
        { text: "Non", style: "cancel" },
        {
          text: "Annuler le départ", style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/agent/chef/trips/${tripId}`, { method: "DELETE", token: authToken,
                body: JSON.stringify({ reason: "Annulé par le chef d'agence" }) });
              load();
            } catch (e: any) {
              Alert.alert("Erreur", e.message ?? "Impossible d'annuler ce départ.");
            }
          },
        },
      ]
    );
  }

  /* ── Ouvrir le modal transfert d'urgence ── */
  function openTransfer(tripId: string) {
    setTransferTripId(tripId);
    setXferForm({ newBusId: "", location: "", detail: "" });
    setShowTransfer(true);
  }

  /* ── Confirmer transfert d'urgence ── */
  async function confirmTransfer() {
    if (!xferForm.newBusId) {
      Alert.alert("Car requis", "Veuillez sélectionner le car de remplacement.");
      return;
    }
    if (!transferTripId) return;
    setSaving(true);
    try {
      const r = await apiFetch<any>(`/agent/chef/trips/${transferTripId}/emergency-transfer`, {
        method: "POST", token: authToken,
        body: JSON.stringify({
          newBusId: xferForm.newBusId,
          location: xferForm.location || undefined,
          detail:   xferForm.detail   || undefined,
        }),
      });
      setShowTransfer(false);
      Alert.alert(
        "🚨 Transfert effectué",
        `Ancien car : ${r.oldBus?.name ?? "—"}\nNouveau car : ${r.newBus?.name ?? "—"} (${r.newBus?.plate})\n\n${r.passengersNotified} passagers notifiés par SMS/push.\n${r.colisTransferred} colis conservés.`
      );
      load();
      if (showSeats && seatsTrip?.id === transferTripId) {
        refreshSeats(transferTripId);
      }
    } catch (e: any) {
      Alert.alert("Erreur transfert", e.message ?? "Une erreur s'est produite.");
    } finally {
      setSaving(false);
    }
  }

  /* ── Grouper les trajets par date ── */
  const grouped: { [date: string]: Trip[] } = {};
  trips.filter(t => t.status !== "cancelled").forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });
  const sortedDates = Object.keys(grouped).sort();

  const availableBuses = buses.filter(b => {
    const info = busAvailLabel(b);
    return info.selectable;
  });

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFF" }}>
        <ActivityIndicator size="large" color={INDIGO2} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFF" }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={INDIGO} />

      {/* ── Header ── */}
      <LinearGradient colors={[INDIGO, INDIGO2]} style={s.header}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home")} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color="white" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Gestion des départs</Text>
            {agenceCity ? <Text style={s.headerSub}>Agence de {agenceCity}</Text> : null}
          </View>
          <Pressable style={s.addBtn} onPress={openCreate}>
            <Feather name="plus" size={20} color={INDIGO2} />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={s.tabBar}>
          {([["trips","Départs"],["historique","Historique"]] as const).map(([key, label]) => (
            <Pressable key={key} style={[s.tab, activeTab === key && s.tabActive]} onPress={() => setActiveTab(key)}>
              <Text style={[s.tabText, activeTab === key && s.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INDIGO2} />}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
      >
        {/* ──── TAB : DÉPARTS ──── */}
        {activeTab === "trips" && (
          <>
            {sortedDates.length === 0 ? (
              <View style={s.emptyState}>
                <Feather name="calendar" size={48} color="#9CA3AF" />
                <Text style={s.emptyTitle}>Aucun départ programmé</Text>
                <Text style={s.emptyText}>Appuyez sur « + » pour programmer un premier départ.</Text>
                <Pressable style={s.emptyBtn} onPress={openCreate}>
                  <Feather name="plus-circle" size={16} color="white" />
                  <Text style={s.emptyBtnText}>Programmer un départ</Text>
                </Pressable>
              </View>
            ) : (
              sortedDates.map(dateKey => {
                const dateLabel = dateKey === today()
                  ? "Aujourd'hui — " + new Date(dateKey).toLocaleDateString("fr-CI", { day: "numeric", month: "long" })
                  : new Date(dateKey).toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long" });

                return (
                  <View key={dateKey} style={{ marginTop: 16, paddingHorizontal: 16 }}>
                    <Text style={s.dateHeader}>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</Text>

                    {grouped[dateKey].map(trip => {
                      const st          = tripStatusInfo(trip.status);
                      const cap         = capacityBadge(trip.capacity_status);
                      const pct         = trip.total_seats > 0 ? (trip.passenger_count / trip.total_seats) * 100 : 0;
                      const delay       = Number(trip.delay_minutes) || 0;
                      const eta         = trip.estimated_arrival_time ?? trip.arrival_time;
                      const canEdit     = trip.status === "scheduled";
                      const canCancel   = trip.status === "scheduled";
                      const canTransfer = ["en_route","in_progress","boarding","scheduled"].includes(trip.status);
                      const canWaypoint = ["en_route","in_progress","boarding"].includes(trip.status);

                      return (
                        <View key={trip.id} style={[s.tripCard, st.live && { borderColor: "#BBF7D0", borderWidth: 2 }]}>
                          <View style={s.tripTop}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={s.tripRoute}>{trip.from_city} → {trip.to_city}</Text>
                                {!canEdit && !st.live && (
                                  <Feather name="lock" size={12} color="#9CA3AF" />
                                )}
                                {st.live && (
                                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" }} />
                                )}
                              </View>
                              <View style={s.tripMeta}>
                                <Feather name="clock" size={12} color="#6B7280" />
                                <Text style={s.tripMetaText}>{trip.departure_time}</Text>
                                <Feather name="truck" size={12} color="#6B7280" />
                                <Text style={s.tripMetaText}>{trip.bus_name}</Text>
                              </View>
                              {canWaypoint && eta && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                                  <Feather name="map-pin" size={11} color="#166534" />
                                  <Text style={{ fontSize: 11, color: "#166534", fontWeight: "600" }}>ETA {eta}</Text>
                                  {delay > 0 && (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FEF3C7", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 }}>
                                      <Feather name="alert-circle" size={9} color="#D97706" />
                                      <Text style={{ fontSize: 10, color: "#D97706", fontWeight: "700" }}>+{delay} min</Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                            <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                            </View>
                          </View>

                          {/* Badge capacité */}
                          {cap && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5,
                              backgroundColor: cap.bg, alignSelf: "flex-start",
                              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 8 }}>
                              <Text style={{ fontSize: 11, color: cap.color, fontWeight: "700" }}>{cap.label}</Text>
                            </View>
                          )}

                          {/* Stats */}
                          <View style={s.tripStats}>
                            <View style={s.tripStatItem}>
                              <Feather name="users" size={14} color={INDIGO2} />
                              <Text style={s.tripStatVal}>{trip.passenger_count}</Text>
                              <Text style={s.tripStatLabel}>pax</Text>
                            </View>
                            {(trip.alighted_count ?? 0) > 0 && (
                              <View style={s.tripStatItem}>
                                <Feather name="log-out" size={14} color="#7C3AED" />
                                <Text style={s.tripStatVal}>{trip.alighted_count}</Text>
                                <Text style={s.tripStatLabel}>descendus</Text>
                              </View>
                            )}
                            <View style={s.tripStatItem}>
                              <Feather name="package" size={14} color="#7C3AED" />
                              <Text style={s.tripStatVal}>{trip.parcel_count}</Text>
                              <Text style={s.tripStatLabel}>colis</Text>
                            </View>
                            <View style={s.tripStatItem}>
                              <Feather name="bar-chart-2" size={14} color="#166534" />
                              <Text style={s.tripStatVal}>{Math.max(0, trip.total_seats - trip.passenger_count + (trip.alighted_count ?? 0))}</Text>
                              <Text style={s.tripStatLabel}>libres</Text>
                            </View>
                          </View>

                          {/* Barre remplissage */}
                          <View style={s.fillBg}>
                            <View style={[s.fillBar, {
                              width: `${Math.min(100, pct)}%`,
                              backgroundColor: pct >= 100 ? RED : pct >= 90 ? RED : pct >= 60 ? "#D97706" : "#166534",
                            }]} />
                          </View>
                          <Text style={s.fillLabel}>{Math.round(pct)}% rempli</Text>

                          {/* Escales passées */}
                          {(trip.waypoints_passed?.length ?? 0) > 0 && (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                              <Text style={{ fontSize: 10, color: "#9CA3AF" }}>Escales : </Text>
                              {trip.waypoints_passed!.map((wp, i) => (
                                <View key={i} style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                  <Text style={{ fontSize: 10, color: "#166534", fontWeight: "600" }}>✓ {wp}</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Suivi position temps réel */}
                          {canWaypoint && trip.intel && (() => {
                            let intel: any = null;
                            try { intel = typeof trip.intel === "string" ? JSON.parse(trip.intel) : trip.intel; } catch {}
                            if (!intel) return null;
                            const allStops: string[] = intel.allStops ?? [trip.from_city, trip.to_city];
                            const pct = intel.progressPct ?? 0;
                            return (
                              <View style={{ marginTop: 10, backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10 }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Feather name="navigation" size={11} color="#166534" />
                                    <Text style={{ fontSize: 11, color: "#166534", fontWeight: "700" }}>
                                      Position actuelle : {intel.currentCity}
                                    </Text>
                                  </View>
                                  <Text style={{ fontSize: 11, color: "#166534", fontWeight: "700" }}>{pct}%</Text>
                                </View>
                                {/* Barre progression */}
                                <View style={{ height: 4, backgroundColor: "#D1FAE5", borderRadius: 4, overflow: "hidden" }}>
                                  <View style={{ height: 4, width: `${pct}%`, backgroundColor: "#166534", borderRadius: 4 }} />
                                </View>
                                {/* Prochaine escale */}
                                {intel.nextStop && intel.nextStop !== trip.to_city && (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }}>
                                    <Feather name="arrow-right" size={10} color="#D97706" />
                                    <Text style={{ fontSize: 10, color: "#D97706" }}>Prochaine escale : {intel.nextStop}</Text>
                                  </View>
                                )}
                                {/* Ligne des étapes */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    {allStops.map((city: string, i: number) => {
                                      const passed = (intel.waypointsPassed ?? []).includes(city) || city === trip.from_city;
                                      const isCurrent = city === intel.currentCity;
                                      const isLast = i === allStops.length - 1;
                                      return (
                                        <React.Fragment key={i}>
                                          <View style={{ alignItems: "center" }}>
                                            <View style={{
                                              width: 18, height: 18, borderRadius: 9,
                                              backgroundColor: isCurrent ? "#166534" : passed ? "#BBF7D0" : "#F3F4F6",
                                              justifyContent: "center", alignItems: "center",
                                              borderWidth: isCurrent ? 2 : 1,
                                              borderColor: isCurrent ? "#14532D" : passed ? "#86EFAC" : "#E5E7EB",
                                            }}>
                                              {passed && <Feather name="check" size={9} color={isCurrent ? "white" : "#166534"} />}
                                            </View>
                                            <Text style={{ fontSize: 8, color: isCurrent ? "#166534" : "#9CA3AF", marginTop: 2, fontWeight: isCurrent ? "700" : "400", maxWidth: 40, textAlign: "center" }}>{city}</Text>
                                          </View>
                                          {!isLast && <View style={{ width: 20, height: 1, backgroundColor: passed ? "#86EFAC" : "#E5E7EB", marginBottom: 10 }} />}
                                        </React.Fragment>
                                      );
                                    })}
                                  </View>
                                </ScrollView>
                              </View>
                            );
                          })()}

                          {/* Actions */}
                          <View style={s.tripActions}>
                            {canEdit && (
                              <Pressable style={[s.actionBtn, { backgroundColor: LIGHT, borderColor: INDIGO2 }]} onPress={() => openEdit(trip)}>
                                <Feather name="edit-2" size={13} color={INDIGO2} />
                                <Text style={[s.actionBtnText, { color: INDIGO2 }]}>Modifier</Text>
                              </Pressable>
                            )}
                            <Pressable style={[s.actionBtn, { backgroundColor: "#F3F4F6", borderColor: "#6B7280" }]} onPress={() => openSeatMap(trip)}>
                              <Feather name="grid" size={13} color="#374151" />
                              <Text style={[s.actionBtnText, { color: "#374151" }]}>Sièges</Text>
                            </Pressable>
                            <Pressable style={[s.actionBtn, { backgroundColor: "#EEF2FF", borderColor: INDIGO2 }]} onPress={() => openPassengers(trip)}>
                              <Feather name="users" size={13} color={INDIGO2} />
                              <Text style={[s.actionBtnText, { color: INDIGO2 }]}>Pax</Text>
                            </Pressable>
                            {canWaypoint && (
                              <Pressable style={[s.actionBtn, { backgroundColor: "#DCFCE7", borderColor: "#166534" }]}
                                onPress={() => openWaypoint(trip)}>
                                <Feather name="map-pin" size={13} color="#166534" />
                                <Text style={[s.actionBtnText, { color: "#166534" }]}>Escale</Text>
                              </Pressable>
                            )}
                            {canTransfer && (
                              <Pressable style={[s.actionBtn, { backgroundColor: "#FEF2F2", borderColor: RED }]} onPress={() => openTransfer(trip.id)}>
                                <Feather name="alert-triangle" size={13} color={RED} />
                                <Text style={[s.actionBtnText, { color: RED }]}>Panne</Text>
                              </Pressable>
                            )}
                            {canCancel && (
                              <Pressable style={[s.actionBtn, { backgroundColor: "#FEE2E2", borderColor: "#B91C1C" }]}
                                onPress={() => askCancelTrip(trip.id, `${trip.from_city} → ${trip.to_city}`)}>
                                <Feather name="x-circle" size={13} color="#B91C1C" />
                                <Text style={[s.actionBtnText, { color: "#B91C1C" }]}>Annuler</Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ──── TAB : HISTORIQUE ──── */}
        {activeTab === "historique" && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Text style={s.sectionTitle}>Journal des actions</Text>
            {auditLogs.length === 0 ? (
              <View style={s.emptyState}>
                <Feather name="clock" size={36} color="#9CA3AF" />
                <Text style={s.emptyText}>Aucune action enregistrée pour l'instant.</Text>
              </View>
            ) : (
              auditLogs.map(log => {
                const info = actionLabel(log.action);
                const date = new Date(log.created_at).toLocaleDateString("fr-CI", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                });
                return (
                  <View key={log.id} style={s.auditCard}>
                    <View style={[s.auditIcon, { backgroundColor: info.color + "18" }]}>
                      <Feather name={info.icon as any} size={16} color={info.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.auditAction, { color: info.color }]}>{info.label}</Text>
                      <Text style={s.auditDate}>{date}</Text>
                      {log.reason && <Text style={s.auditReason}>Motif : {log.reason}</Text>}
                      {log.old_data && (
                        <View style={s.auditDiff}>
                          <View style={[s.auditDiffBox, { backgroundColor: "#FEE2E2" }]}>
                            <Text style={s.auditDiffLabel}>Avant</Text>
                            <Text style={s.auditDiffText}>{JSON.stringify(log.old_data, null, 1).slice(0, 120)}</Text>
                          </View>
                          <Feather name="arrow-right" size={14} color="#9CA3AF" />
                          <View style={[s.auditDiffBox, { backgroundColor: "#DCFCE7", flex: 1 }]}>
                            <Text style={s.auditDiffLabel}>Après</Text>
                            <Text style={s.auditDiffText}>{JSON.stringify(log.new_data, null, 1).slice(0, 120)}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {activeTab === "trips" && (
        <Pressable style={s.fab} onPress={openCreate}>
          <Feather name="plus" size={24} color="white" />
        </Pressable>
      )}

      {/* ═══════════════════════════════════════════════════════════
           MODAL : Créer / Modifier un départ
         ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFF" }} edges={["top"]}>
          <LinearGradient colors={[INDIGO, INDIGO2]} style={s.modalHeader}>
            <Pressable onPress={() => setShowForm(false)} style={{ padding: 4 }}>
              <Feather name="x" size={22} color="white" />
            </Pressable>
            <Text style={s.modalTitle}>{editId ? "Modifier le départ" : "Programmer un départ"}</Text>
            <View style={{ width: 30 }} />
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {!editId && (
              <>
                <Text style={s.label}>Ville de départ *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {CI_CITIES.map(c => (
                      <Pressable key={c} style={[s.chip, form.from === c && s.chipActive]} onPress={() => setForm(f => ({ ...f, from: c }))}>
                        <Text style={[s.chipText, form.from === c && s.chipActiveText]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Text style={s.label}>Destination *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {CI_CITIES.filter(c => c !== form.from).map(c => (
                      <Pressable key={c} style={[s.chip, form.to === c && s.chipActive]} onPress={() => setForm(f => ({ ...f, to: c }))}>
                        <Text style={[s.chipText, form.to === c && s.chipActiveText]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Text style={s.label}>Date du départ *</Text>
                <TextInput
                  style={s.input} value={form.date} placeholder="AAAA-MM-JJ"
                  placeholderTextColor="#9CA3AF"
                  onChangeText={v => setForm(f => ({ ...f, date: v }))}
                />
              </>
            )}

            <Text style={s.label}>Heure de départ *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["05:00","06:00","07:00","08:00","09:00","10:00","12:00","13:00","14:00","15:00","16:00","18:00","20:00"].map(h => (
                  <Pressable key={h} style={[s.timeChip, form.departureTime === h && s.timeChipActive]} onPress={() => setForm(f => ({ ...f, departureTime: h }))}>
                    <Text style={[s.timeChipText, form.departureTime === h && { color: "white" }]}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={s.label}>Heure d'arrivée estimée</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["06:00","07:00","08:00","09:00","10:00","11:00","12:00","14:00","16:00","18:00","20:00","22:00"].map(h => (
                  <Pressable key={h} style={[s.timeChip, form.arrivalTime === h && s.timeChipActive]} onPress={() => setForm(f => ({ ...f, arrivalTime: h }))}>
                    <Text style={[s.timeChipText, form.arrivalTime === h && { color: "white" }]}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* ─── Type de départ ─── */}
            <Text style={s.label}>Type de départ</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {TRIP_TYPES.map(tt => {
                const active = form.tripType === tt.key;
                return (
                  <Pressable key={tt.key}
                    style={{
                      flex: 1, alignItems: "center", paddingVertical: 10,
                      borderRadius: 12, borderWidth: 2,
                      borderColor: active ? tt.color : "#E5E7EB",
                      backgroundColor: active ? tt.bg : "#FAFAFA",
                    }}
                    onPress={() => {
                      setPriceSource(null);
                      setForm(f => ({ ...f, tripType: tt.key }));
                    }}>
                    <Feather name={tt.icon as any} size={18} color={active ? tt.color : "#9CA3AF"} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? tt.color : "#6B7280", marginTop: 3 }}>
                      {tt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ─── Tarif ─── */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={s.label}>Tarif (FCFA)</Text>
              {priceLookupLoading && <ActivityIndicator size="small" color={INDIGO2} />}
              {!priceLookupLoading && priceSource === "company" && (
                <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, color: "#166534", fontWeight: "700" }}>✓ Grille compagnie</Text>
                </View>
              )}
              {!priceLookupLoading && priceSource === "global" && (
                <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, color: "#92400E", fontWeight: "700" }}>⚡ Grille globale</Text>
                </View>
              )}
            </View>
            <TextInput
              style={s.input} value={form.price} placeholder={priceLookupLoading ? "Chargement…" : "Ex : 2500"}
              placeholderTextColor="#9CA3AF" keyboardType="number-pad"
              onChangeText={v => { setPriceSource("manual"); setForm(f => ({ ...f, price: v })); }}
            />

            {/* Car — cars de l'agence uniquement */}
            <Text style={s.label}>Car de l'agence{agenceCity ? ` (${agenceCity})` : ""}</Text>
            {buses.length === 0 ? (
              <View style={[s.input, s.inputCenter]}>
                <Text style={{ color: "#9CA3AF" }}>Aucun car disponible dans l'agence</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Pressable
                    style={[s.busChip, !form.busId && s.busChipActive]}
                    onPress={() => setForm(f => ({ ...f, busId: "" }))}>
                    <Text style={[s.busChipText, !form.busId && { color: "white" }]}>Sans car</Text>
                  </Pressable>
                  {buses.map(b => {
                    const avail = busAvailLabel(b);
                    const selected = form.busId === b.id;
                    const disabled = !avail.selectable;
                    return (
                      <Pressable key={b.id}
                        style={[s.busChip, selected && s.busChipActive, disabled && { opacity: 0.45 }]}
                        onPress={() => { if (!disabled) setForm(f => ({ ...f, busId: b.id })); }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Feather name="truck" size={13} color={selected ? "white" : INDIGO2} />
                          <Text style={[s.busChipText, selected && { color: "white" }]}>{b.bus_name}</Text>
                        </View>
                        <Text style={{ fontSize: 10, color: selected ? "#C7D2FE" : "#9CA3AF" }}>{b.plate_number} · {b.capacity} pl.</Text>
                        <View style={[{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: "flex-start", backgroundColor: avail.bg }]}>
                          <Text style={{ fontSize: 9, color: avail.color, fontWeight: "700" }}>{avail.label}</Text>
                        </View>
                        {b.location_source === "affecté_agence" && (
                          <Text style={{ fontSize: 9, color: "#6366F1" }}>⭐ Affecté à l'agence</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {editId && (
              <>
                <Text style={s.label}>Motif de la modification</Text>
                <TextInput
                  style={[s.input, { minHeight: 70 }]}
                  value={form.reason} placeholder="Ex : Retard fournisseur, changement de car…"
                  placeholderTextColor="#9CA3AF" multiline
                  onChangeText={v => setForm(f => ({ ...f, reason: v }))}
                />
              </>
            )}

            {!editId && form.from && form.to && form.date && (
              <View style={s.summary}>
                <Feather name="navigation" size={16} color={INDIGO2} />
                <Text style={s.summaryText}>
                  {form.from} → {form.to}{"  "}le {form.date}{"  "}à {form.departureTime}
                  {form.busId ? `\nCar : ${buses.find(b => b.id === form.busId)?.bus_name}` : ""}
                </Text>
              </View>
            )}

            <Pressable style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={saveTrip} disabled={saving}>
              {saving ? <ActivityIndicator color="white" size="small" /> : (
                <>
                  <Feather name="check-circle" size={18} color="white" />
                  <Text style={s.saveBtnText}>{editId ? "Enregistrer les modifications" : "Programmer ce départ"}</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
           MODAL : Marquer une escale (libération de sièges)
         ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showWaypoint} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F0FDF4" }} edges={["top"]}>
          <LinearGradient colors={["#14532D", "#166534"]} style={s.modalHeader}>
            <Pressable onPress={() => setShowWaypoint(false)} style={{ padding: 4 }}>
              <Feather name="x" size={22} color="white" />
            </Pressable>
            <Text style={s.modalTitle}>📍 Marquer une escale</Text>
            <View style={{ width: 30 }} />
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {waypointTrip && (
              <View style={{ backgroundColor: "#DCFCE7", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#14532D" }}>
                  {waypointTrip.from_city} → {waypointTrip.to_city}
                </Text>
                <Text style={{ fontSize: 13, color: "#166534", marginTop: 4 }}>
                  Départ : {waypointTrip.departure_time}  ·  {waypointTrip.bus_name}
                </Text>
                {(waypointTrip.waypoints_passed?.length ?? 0) > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: "#166534" }}>Déjà passées : </Text>
                    {waypointTrip.waypoints_passed!.map((wp, i) => (
                      <View key={i} style={{ backgroundColor: "#BBF7D0", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ fontSize: 11, color: "#14532D", fontWeight: "700" }}>✓ {wp}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={{ backgroundColor: "#FFF", borderRadius: 14, padding: 16, marginBottom: 20,
              borderWidth: 1, borderColor: "#D1FAE5" }}>
              <Feather name="info" size={16} color="#166534" />
              <Text style={{ fontSize: 13, color: "#166534", marginTop: 6, lineHeight: 20 }}>
                Marquer une escale libère immédiatement les sièges des passagers dont c'est la ville de descente,
                permettant à de nouveaux passagers d'embarquer à la prochaine étape.
              </Text>
            </View>

            <Text style={s.label}>Ville de l'escale *</Text>
            {(() => {
              // Escales du trajet en priorité, sinon liste CI complète
              let tripStops: string[] = [];
              try {
                const raw = waypointTrip?.stops;
                const arr = Array.isArray(raw) ? raw : (typeof raw === "string" ? JSON.parse(raw) : []);
                tripStops = arr.map((s: any) => s.city ?? s.name ?? s).filter(Boolean);
              } catch {}
              const cityOptions = tripStops.length > 0
                ? [...tripStops, waypointTrip?.to_city].filter(Boolean) as string[]
                : CI_CITIES;
              return (
                <View style={s.pickerWrap}>
                  <Feather name="map-pin" size={16} color="#166534" style={{ marginRight: 8 }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {cityOptions.map((city, i) => {
                      const sel = waypointCity === city;
                      const alreadyPassed = waypointTrip?.waypoints_passed?.includes(city);
                      return (
                        <Pressable key={`waypoint-${i}-${city}`}
                          style={[{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 6,
                            backgroundColor: sel ? "#166534" : alreadyPassed ? "#F0FDF4" : "#F3F4F6",
                            borderWidth: sel ? 0 : 1, borderColor: alreadyPassed ? "#86EFAC" : "#E5E7EB",
                            opacity: alreadyPassed ? 0.6 : 1 }]}
                          onPress={() => !alreadyPassed && setWaypointCity(city)}>
                          <Text style={{ fontSize: 13, color: sel ? "white" : alreadyPassed ? "#166534" : "#374151", fontWeight: sel ? "700" : "400" }}>
                            {alreadyPassed ? "✓ " : ""}{city}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })()}

            <Pressable
              style={[s.saveBtn, { backgroundColor: waypointCity ? "#166534" : "#9CA3AF", marginTop: 28 }]}
              onPress={saveWaypoint}
              disabled={saving || !waypointCity}>
              {saving ? <ActivityIndicator color="white" /> : (
                <>
                  <Feather name="check-circle" size={18} color="white" />
                  <Text style={s.saveBtnText}>Valider l'escale à {waypointCity || "…"}</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
           MODAL : Transfert d'urgence (panne)
         ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showTransfer} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5F5" }} edges={["top"]}>
          <LinearGradient colors={["#991B1B", "#DC2626"]} style={s.modalHeader}>
            <Pressable onPress={() => setShowTransfer(false)} style={{ padding: 4 }}>
              <Feather name="x" size={22} color="white" />
            </Pressable>
            <Text style={s.modalTitle}>🚨 Transfert d'urgence</Text>
            <View style={{ width: 30 }} />
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Avertissement */}
            <View style={s.alertBox}>
              <Feather name="alert-triangle" size={20} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>Car en panne — Action irréversible</Text>
                <Text style={s.alertText}>L'ancien car sera marqué EN PANNE. Tous les passagers et colis resteront sur le trajet. Les passagers seront notifiés par SMS et push.</Text>
              </View>
            </View>

            {/* Lieu de la panne */}
            <Text style={s.label}>Lieu de la panne</Text>
            <TextInput
              style={s.input} value={xferForm.location}
              placeholder="Ex : Entrée de Bouaké, axe Yamoussoukro…"
              placeholderTextColor="#9CA3AF"
              onChangeText={v => setXferForm(f => ({ ...f, location: v }))}
            />

            {/* Détail */}
            <Text style={s.label}>Détail de la panne</Text>
            <TextInput
              style={[s.input, { minHeight: 70 }]}
              value={xferForm.detail}
              placeholder="Ex : Pneu crevé, moteur, accident…"
              placeholderTextColor="#9CA3AF" multiline
              onChangeText={v => setXferForm(f => ({ ...f, detail: v }))}
            />

            {/* Car de remplacement — disponibles seulement */}
            <Text style={s.label}>Car de remplacement *</Text>
            <Text style={s.labelSub}>Cars disponibles dans l'agence {agenceCity ? `(${agenceCity})` : ""}</Text>
            {availableBuses.length === 0 ? (
              <View style={[s.input, s.inputCenter, { borderColor: RED }]}>
                <Feather name="alert-circle" size={18} color={RED} />
                <Text style={{ color: RED, marginTop: 4 }}>Aucun car disponible dans l'agence actuellement</Text>
              </View>
            ) : (
              availableBuses.map(b => {
                const selected = xferForm.newBusId === b.id;
                return (
                  <Pressable key={b.id}
                    style={[s.busCard, selected && s.busCardSelected]}
                    onPress={() => setXferForm(f => ({ ...f, newBusId: b.id }))}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[s.busIconSmall, { backgroundColor: selected ? "#DC262620" : "#F3F4F6" }]}>
                        <Feather name="truck" size={18} color={selected ? RED : "#6B7280"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.busCardName, selected && { color: RED }]}>{b.bus_name}</Text>
                        <Text style={s.busCardMeta}>{b.plate_number} · {b.bus_type} · {b.capacity} places</Text>
                        {b.location_source === "affecté_agence" && (
                          <Text style={s.busCardSub}>⭐ Affecté à l'agence</Text>
                        )}
                      </View>
                      {selected && <Feather name="check-circle" size={20} color={RED} />}
                    </View>
                  </Pressable>
                );
              })
            )}

            <Pressable
              style={[s.saveBtn, { backgroundColor: RED, marginTop: 16 }, (saving || !xferForm.newBusId) && { opacity: 0.6 }]}
              onPress={confirmTransfer}
              disabled={saving || !xferForm.newBusId}>
              {saving ? <ActivityIndicator color="white" size="small" /> : (
                <>
                  <Feather name="alert-triangle" size={18} color="white" />
                  <Text style={s.saveBtnText}>Confirmer le transfert d'urgence</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
           MODAL : Carte des sièges en temps réel
         ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showSeats} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFF" }} edges={["top"]}>
          <LinearGradient colors={[INDIGO, INDIGO2]} style={s.modalHeader}>
            <Pressable onPress={() => setShowSeats(false)} style={{ padding: 4 }}>
              <Feather name="x" size={22} color="white" />
            </Pressable>
            <Text style={s.modalTitle}>🪑 Carte des sièges</Text>
            <View style={{ width: 30 }} />
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {seatsTrip && (
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 }}>
                {seatsTrip.from_city} → {seatsTrip.to_city} · {seatsTrip.departure_time}
              </Text>
            )}

            {/* Légende */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { color: "#DCFCE7", border: "#86EFAC", label: "Libre" },
                { color: "#FEE2E2", border: "#FCA5A5", label: "Occupé" },
                { color: "#FEF3C7", border: "#FCD34D", label: "Réservé" },
                { color: "#EDE9FE", border: "#C4B5FD", label: "Descendu" },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: item.color, borderWidth: 1.5, borderColor: item.border }} />
                  <Text style={{ fontSize: 11, color: "#374151" }}>{item.label}</Text>
                </View>
              ))}
            </View>

            {seatsLoading ? (
              <View style={{ alignItems: "center", padding: 40 }}>
                <ActivityIndicator size="large" color={INDIGO2} />
                <Text style={{ color: "#6B7280", marginTop: 10 }}>Chargement des sièges…</Text>
              </View>
            ) : seatsData ? (
              <>
                {/* Stats + Légende */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  {[
                    { label: "Total",     value: seatsData.stats.total,              color: "#374151", bg: "#F3F4F6" },
                    { label: "Libres",    value: seatsData.stats.free,               color: "#374151", bg: "#F3F4F6" },
                    { label: "Réservés",  value: seatsData.stats.reserved ?? 0,      color: "#92400E", bg: "#FEF3C7" },
                    { label: "Vendus",    value: seatsData.stats.occupied,           color: "#991B1B", bg: "#FEE2E2" },
                    { label: "SP",        value: seatsData.stats.sp ?? 0,            color: "#6D28D9", bg: "#EDE9FE" },
                    { label: "Descendus", value: seatsData.stats.released,           color: "#15803D", bg: "#DCFCE7" },
                  ].map((item, i) => (
                    <View key={i} style={{ backgroundColor: item.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center", minWidth: 60 }}>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: item.color }}>{item.value}</Text>
                      <Text style={{ fontSize: 10, color: item.color }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
                {/* Légende sièges */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  {[
                    { status: "free",     label: "Libre" },
                    { status: "reserved", label: "Réservé" },
                    { status: "occupied", label: "Vendu" },
                    { status: "sp",       label: "SP" },
                    { status: "released", label: "Descendu" },
                  ].map(item => {
                    const c = getSeatColor(item.status);
                    return (
                      <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c.bg, borderWidth: 1.5, borderColor: c.border }} />
                        <Text style={{ fontSize: 11, color: "#6B7280" }}>{item.label}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Passagers par ville de descente */}
                {Object.keys(seatsData.byAlighting).length > 0 && (
                  <View style={{ backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#166534", marginBottom: 8 }}>Descentes prévues</Text>
                    {Object.entries(seatsData.byAlighting).map(([city, info]: [string, any], i) => (
                      <View key={`alight-${i}-${city}`} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: "#166534" }}>📍 {city}</Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#166534" }}>{info.count} pax · Sièges {info.seats.join(", ")}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Grille des sièges */}
                {(() => {
                  const seats: any[] = seatsData.seats;
                  if (!seats.length) return <Text style={{ color: "#9CA3AF", textAlign: "center", padding: 20 }}>Aucun siège trouvé pour ce trajet</Text>;

                  // Grouper par rangée
                  const rows = new Map<number, any[]>();
                  for (const seat of seats) {
                    if (!rows.has(seat.row)) rows.set(seat.row, []);
                    rows.get(seat.row)!.push(seat);
                  }

                  return (
                    <View style={{ alignItems: "center" }}>
                      {/* Avant du bus */}
                      <View style={{ backgroundColor: "#E0E7FF", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 6, marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, color: INDIGO, fontWeight: "700" }}>🚌 CONDUCTEUR</Text>
                      </View>

                      {Array.from(rows.entries()).sort(([a], [b]) => a - b).map(([rowNum, rowSeats]) => (
                        <View key={rowNum} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 }}>
                          <Text style={{ fontSize: 10, color: "#9CA3AF", width: 18, textAlign: "center" }}>{rowNum}</Text>
                          {rowSeats.sort((a, b) => a.col - b.col).map((seat: any) => {
                            const colors = getSeatColor(seat.status);
                            const isSelected = selectedSeat?.id === seat.id;
                            const hasAisle = seat.col === 3;
                            return (
                              <React.Fragment key={seat.id}>
                                {hasAisle && <View style={{ width: 10 }} />}
                                <Pressable
                                  style={{
                                    width: 38, height: 42, borderRadius: 8, borderWidth: isSelected ? 3 : 1.5,
                                    backgroundColor: colors.bg, borderColor: isSelected ? "#111827" : colors.border,
                                    justifyContent: "center", alignItems: "center",
                                  }}
                                  onPress={() => setSelectedSeat(isSelected ? null : seat)}>
                                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.text }}>{seat.number}</Text>
                                  {seat.status === "released" && <Text style={{ fontSize: 7, color: colors.text }}>↓off</Text>}
                                  {seat.status === "sp" && <Text style={{ fontSize: 7, color: colors.text }}>SP</Text>}
                                </Pressable>
                              </React.Fragment>
                            );
                          })}
                        </View>
                      ))}

                      {/* Arrière du bus */}
                      <View style={{ backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 6, marginTop: 6 }}>
                        <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "700" }}>ARRIÈRE</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Détail siège sélectionné */}
                {selectedSeat && (
                  <View style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 2,
                    borderColor: getSeatColor(selectedSeat.status).border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>Siège {selectedSeat.number}</Text>
                      <View style={{ backgroundColor: getSeatColor(selectedSeat.status).bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: getSeatColor(selectedSeat.status).text }}>
                          {selectedSeat.status === "sp" ? "SP" :
                           selectedSeat.status === "released" ? "✓ Descendu" :
                           selectedSeat.status === "occupied" ? "● Vendu" :
                           selectedSeat.status === "reserved" ? "◷ Réservé" : "✓ Libre"}
                        </Text>
                      </View>
                    </View>
                    {selectedSeat.booking ? (
                      <>
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                          <Feather name="user" size={13} color="#6B7280" />
                          <Text style={{ fontSize: 12, color: "#374151" }}>
                            Réf : {selectedSeat.booking.ref}{selectedSeat.booking.isSP ? "  🟣 SP" : ""}
                          </Text>
                        </View>
                        {selectedSeat.booking.boardingCity ? (
                          <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                            <Feather name="log-in" size={13} color="#166534" />
                            <Text style={{ fontSize: 12, color: "#166534" }}>Monte à : {selectedSeat.booking.boardingCity}</Text>
                          </View>
                        ) : null}
                        {selectedSeat.booking.alightingCity ? (
                          <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                            <Feather name="log-out" size={13} color={getSeatColor(selectedSeat.status).text} />
                            <Text style={{ fontSize: 12, color: getSeatColor(selectedSeat.status).text }}>
                              {selectedSeat.status === "released" ? "Descendu à" : "Descend à"} : {selectedSeat.booking.alightingCity}
                            </Text>
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Feather name="check-circle" size={14} color="#374151" />
                        <Text style={{ fontSize: 12, color: "#374151" }}>Siège disponible</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : (
              <View style={{ alignItems: "center", padding: 40 }}>
                <Feather name="grid" size={36} color="#9CA3AF" />
                <Text style={{ color: "#9CA3AF", marginTop: 8 }}>Aucune donnée de sièges</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
           MODAL : Liste des passagers
         ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showPassengers} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFF" }} edges={["top"]}>
          <LinearGradient colors={[INDIGO, INDIGO2]} style={s.modalHeader}>
            <Pressable onPress={() => setShowPassengers(false)} style={{ padding: 4 }}>
              <Feather name="x" size={22} color="white" />
            </Pressable>
            <Text style={s.modalTitle}>👥 Passagers</Text>
            <View style={{ width: 30 }} />
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {passengersTrip && (
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 }}>
                {passengersTrip.from_city} → {passengersTrip.to_city} · {passengersTrip.departure_time}
              </Text>
            )}

            {passengersLoading ? (
              <View style={{ alignItems: "center", padding: 40 }}>
                <ActivityIndicator size="large" color={INDIGO2} />
              </View>
            ) : passengersData ? (
              <>
                {/* Résumé */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "À bord",     value: passengersData.summary.onBoard,  color: "#166534", bg: "#DCFCE7" },
                    { label: "Descendus",  value: passengersData.summary.alighted, color: "#7C3AED", bg: "#EDE9FE" },
                    { label: "Total",      value: passengersData.summary.total,    color: "#374151", bg: "#F3F4F6" },
                  ].map((item, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: item.bg, borderRadius: 12, padding: 10, alignItems: "center" }}>
                      <Text style={{ fontSize: 20, fontWeight: "800", color: item.color }}>{item.value}</Text>
                      <Text style={{ fontSize: 10, color: item.color }}>{item.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Passagers groupés par ville de descente */}
                {Object.entries(passengersData.grouped).map(([city, paxList]: [string, any], i) => (
                  <View key={`pax-${i}-${city}`} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Feather name="map-pin" size={13} color="#D97706" />
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#D97706" }}>Descend à {city}</Text>
                      <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ fontSize: 11, color: "#D97706", fontWeight: "700" }}>{paxList.length} pax</Text>
                      </View>
                    </View>
                    {(paxList as any[]).map((pax: any, i: number) => (
                      <View key={i} style={{
                        backgroundColor: pax.passengerStatus === "alighted" ? "#F5F3FF" : "white",
                        borderRadius: 12, padding: 12, marginBottom: 6,
                        borderWidth: 1, borderColor: pax.passengerStatus === "alighted" ? "#C4B5FD" : "#E5E7EB",
                        flexDirection: "row", gap: 10, alignItems: "center",
                      }}>
                        <View style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: pax.passengerStatus === "alighted" ? "#EDE9FE" : "#EEF2FF",
                          justifyContent: "center", alignItems: "center",
                        }}>
                          <Feather name="user" size={16} color={pax.passengerStatus === "alighted" ? "#7C3AED" : INDIGO2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>{pax.name}</Text>
                          <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
                            <Text style={{ fontSize: 11, color: "#6B7280" }}>Siège {pax.seatNumber}</Text>
                            {pax.boardingCity && <Text style={{ fontSize: 11, color: "#166534" }}>↑ {pax.boardingCity}</Text>}
                            <Text style={{ fontSize: 11, color: "#DC2626" }}>↓ {pax.alightingCity}</Text>
                          </View>
                          {pax.idNumber && <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>CNI : {pax.idNumber}</Text>}
                        </View>
                        {pax.passengerStatus === "alighted" ? (
                          <View style={{ backgroundColor: "#EDE9FE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                            <Text style={{ fontSize: 10, color: "#7C3AED", fontWeight: "700" }}>Descendu</Text>
                          </View>
                        ) : (
                          <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                            <Text style={{ fontSize: 10, color: "#166534", fontWeight: "700" }}>À bord</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))}

                {passengersData.passengers.length === 0 && (
                  <View style={{ alignItems: "center", padding: 40 }}>
                    <Feather name="users" size={36} color="#9CA3AF" />
                    <Text style={{ color: "#9CA3AF", marginTop: 8 }}>Aucun passager enregistré</Text>
                  </View>
                )}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  backBtn: { padding: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "white" },
  headerSub: { fontSize: 12, color: "#A5B4FC", marginTop: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "white", justifyContent: "center", alignItems: "center" },

  tabBar: { flexDirection: "row", gap: 4, paddingBottom: 0 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "white" },
  tabText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  tabTextActive: { color: "white" },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 10 },
  dateHeader: { fontSize: 13, fontWeight: "700", color: INDIGO2, marginBottom: 8, textTransform: "capitalize" },

  tripCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: "#E0E7FF",
    shadowColor: INDIGO, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  tripTop: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  tripRoute: { fontSize: 16, fontWeight: "800", color: "#111827" },
  tripMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  tripMetaText: { fontSize: 12, color: "#6B7280", marginRight: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "700" },
  tripStats: { flexDirection: "row", gap: 16, marginBottom: 10 },
  tripStatItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  tripStatVal: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripStatLabel: { fontSize: 11, color: "#9CA3AF" },
  fillBg: { height: 5, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" },
  fillBar: { height: 5, borderRadius: 4 },
  fillLabel: { fontSize: 10, color: "#9CA3AF", marginTop: 3 },
  tripActions: { flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5 },
  actionBtnText: { fontSize: 12, fontWeight: "700" },

  emptyState: { alignItems: "center", padding: 40, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 12 },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center", marginTop: 6, lineHeight: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: INDIGO2, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 20 },
  emptyBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  auditCard: { flexDirection: "row", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F3F4F6" },
  auditIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  auditAction: { fontSize: 14, fontWeight: "700" },
  auditDate: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  auditReason: { fontSize: 12, color: "#6B7280", marginTop: 4, fontStyle: "italic" },
  auditDiff: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  auditDiffBox: { flex: 1, borderRadius: 8, padding: 8 },
  auditDiffLabel: { fontSize: 10, fontWeight: "700", color: "#6B7280", marginBottom: 2 },
  auditDiffText: { fontSize: 10, color: "#374151", fontFamily: "monospace" },

  fab: {
    position: "absolute", bottom: 28, right: 20,
    width: 58, height: 58, borderRadius: 29, backgroundColor: INDIGO2,
    justifyContent: "center", alignItems: "center",
    shadowColor: INDIGO, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },

  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "white" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  labelSub: { fontSize: 11, color: "#9CA3AF", marginBottom: 8, marginTop: -4 },
  input: { backgroundColor: "white", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 14 },
  inputCenter: { justifyContent: "center", alignItems: "center", gap: 6 },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "white", borderWidth: 1.5, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: INDIGO2, borderColor: INDIGO2 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  pickerWrap: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  chipActiveText: { color: "white" },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "white", borderWidth: 1.5, borderColor: "#E5E7EB" },
  timeChipActive: { backgroundColor: INDIGO2, borderColor: INDIGO2 },
  timeChipText: { fontSize: 13, fontWeight: "700", color: "#374151" },

  busChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: LIGHT, borderWidth: 1.5, borderColor: "#C7D2FE", gap: 4, alignItems: "flex-start" },
  busChipActive: { backgroundColor: INDIGO2, borderColor: INDIGO },
  busChipText: { fontSize: 13, fontWeight: "700", color: INDIGO2 },

  busCard: { backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: "#E5E7EB" },
  busCardSelected: { borderColor: RED, backgroundColor: "#FFF5F5" },
  busIconSmall: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  busCardName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  busCardMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  busCardSub: { fontSize: 11, color: "#6366F1", marginTop: 2 },

  alertBox: { flexDirection: "row", gap: 12, backgroundColor: "#FEE2E2", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" },
  alertTitle: { fontSize: 14, fontWeight: "700", color: "#DC2626" },
  alertText: { fontSize: 12, color: "#7F1D1D", marginTop: 4, lineHeight: 18 },

  summary: { backgroundColor: LIGHT, borderRadius: 14, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14, borderWidth: 1, borderColor: "#C7D2FE" },
  summaryText: { fontSize: 14, color: INDIGO, fontWeight: "600", lineHeight: 20, flex: 1 },

  saveBtn: { backgroundColor: INDIGO2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  saveBtnText: { color: "white", fontSize: 16, fontWeight: "800" },
});
