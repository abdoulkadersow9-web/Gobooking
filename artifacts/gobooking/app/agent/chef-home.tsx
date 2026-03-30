import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const INDIGO  = "#3730A3";
const INDIGO2 = "#4F46E5";
const LIGHT   = "#EEF2FF";

type DashData = {
  agence: { id: string; name: string; city: string; address?: string; phone?: string } | null;
  stats: { tripsToday: number; agentsActive: number; passengersToday: number; busesAvailable: number };
};
type Bus = {
  id: string; bus_name: string; plate_number: string; bus_type: string; capacity: number;
  availability_status: string; logistic_status: string; current_trip_id: string | null;
  from_city?: string; to_city?: string; date?: string; departure_time?: string;
};
type Trip = {
  id: string; from_city: string; to_city: string; date: string;
  departure_time: string; arrival_time: string; status: string;
  bus_name: string; total_seats: number; passenger_count: number;
  capacity_status?: string; delay_minutes?: number;
  estimated_arrival_time?: string; actual_departure_time?: string;
  intel?: any;
};

export default function ChefHome() {
  const { user, token, logoutIfActiveToken } = useAuth();
  const authToken = token ?? "";

  const [dash, setDash] = useState<DashData | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCaisses, setPendingCaisses] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    if (user && user.agentRole !== "chef_agence") {
      setLoading(false);
      setLoadError(`Rôle détecté : ${user.agentRole}. Ce tableau de bord est réservé au chef d'agence.`);
      return;
    }
    setLoadError(null);
    try {
      const [d, b, t, cs] = await Promise.all([
        apiFetch<DashData>("/agent/chef/dashboard", { token: authToken }),
        apiFetch<{ buses: Bus[] }>("/agent/chef/available-buses", { token: authToken }),
        apiFetch<{ trips: Trip[] }>("/agent/chef/trips", { token: authToken }),
        apiFetch<{ sessions: any[]; stats: { pending: number; validated: number; rejected: number } }>("/agent/chef/caisses", { token: authToken }),
      ]);
      setDash(d);
      setBuses(b.buses ?? []);
      setTrips(t.trips ?? []);
      setPendingCaisses((cs as any).stats?.pending ?? 0);
    } catch (e: any) {
      if (e?.httpStatus === 401) {
        logoutIfActiveToken(authToken);
        return;
      }
      console.error("[chef-home]", e);
      setLoadError(e?.message ?? e?.error ?? "Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken, user, logoutIfActiveToken]);

  useEffect(() => { load(); }, [load]);

  // Polling 30s
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    interval.current = setInterval(load, 30000);
    return () => { if (interval.current) clearInterval(interval.current); };
  }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const firstName = user?.name?.split(" ")[0] ?? "Chef";
  const agence    = dash?.agence;
  const stats     = dash?.stats;

  const todayStr  = new Date().toISOString().slice(0, 10);
  const tripsToday = trips.filter(t => t.date === todayStr && t.status !== "cancelled");
  const upcoming   = trips.filter(t => t.date > todayStr  && t.status !== "cancelled").slice(0, 5);

  function busStatusLabel(b: Bus): { label: string; color: string; bg: string } {
    if (b.availability_status === "disponible") return { label: "Disponible", color: "#166534", bg: "#DCFCE7" };
    if (b.availability_status === "en_service") return { label: `En route → ${b.to_city ?? "?"}`, color: "#D97706", bg: "#FEF3C7" };
    if (b.availability_status === "en_panne")   return { label: "En panne", color: "#DC2626", bg: "#FEE2E2" };
    return { label: b.logistic_status ?? "En attente", color: "#6B7280", bg: "#F3F4F6" };
  }

  function tripStatusLabel(s: string) {
    if (s === "scheduled")   return { label: "Programmé",   icon: "calendar",      color: "#D97706", bg: "#FEF3C7" };
    if (s === "boarding")    return { label: "Embarquement", icon: "user-check",    color: "#7C3AED", bg: "#EDE9FE" };
    if (s === "en_route")    return { label: "En route",     icon: "navigation",    color: "#166534", bg: "#DCFCE7" };
    if (s === "in_progress") return { label: "En route",     icon: "navigation",    color: "#166534", bg: "#DCFCE7" };
    if (s === "arrived")     return { label: "Arrivé",       icon: "check-circle",  color: "#0369A1", bg: "#E0F2FE" };
    if (s === "completed")   return { label: "Terminé",      icon: "check-square",  color: "#6B7280", bg: "#F3F4F6" };
    if (s === "cancelled")   return { label: "Annulé",       icon: "x-circle",      color: "#DC2626", bg: "#FEE2E2" };
    return { label: s, icon: "circle", color: "#6B7280", bg: "#F3F4F6" };
  }

  function capacityBadge(c?: string): { label: string; color: string; bg: string } | null {
    if (c === "overloaded")  return { label: "Surcharge !", color: "#DC2626", bg: "#FEE2E2" };
    if (c === "full")        return { label: "Complet",     color: "#DC2626", bg: "#FEE2E2" };
    if (c === "almost_full") return { label: "Presque plein", color: "#D97706", bg: "#FEF3C7" };
    return null;
  }

  function isLocked(status: string) {
    return ["en_route","in_progress","boarding","arrived","completed"].includes(status);
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFF" }}>
        <ActivityIndicator size="large" color={INDIGO2} />
        <Text style={{ marginTop: 12, color: INDIGO, fontSize: 15 }}>Chargement du tableau de bord…</Text>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFF", padding: 32 }}>
        <Feather name="alert-triangle" size={52} color="#DC2626" />
        <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "800", color: "#1F2937", textAlign: "center" }}>
          Tableau de bord indisponible
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 }}>
          {loadError}
        </Text>
        <Pressable
          onPress={() => { setLoading(true); load(); }}
          style={{ marginTop: 20, backgroundColor: INDIGO2, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Réessayer</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/agent/home" as never)} style={{ marginTop: 12 }}>
          <Text style={{ color: INDIGO2, fontSize: 14, fontWeight: "600" }}>Retour à l'accueil</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFF" }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={INDIGO} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INDIGO2} />}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* ── Header ── */}
        <LinearGradient colors={[INDIGO, INDIGO2, "#6366F1"]} style={s.header}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.headerGreeting}>Bonjour, {firstName} 👋</Text>
              <Text style={s.headerRole}>Chef d'Agence</Text>
              {agence && (
                <View style={s.agenceBadge}>
                  <Feather name="map-pin" size={12} color="#A5B4FC" />
                  <Text style={s.agenceText}>{agence.name} — {agence.city}</Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push("/agent/home" as never)} style={s.homeBtn}>
              <Feather name="grid" size={20} color="white" />
            </Pressable>
          </View>

          {/* Live indicator */}
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Données en temps réel</Text>
          </View>
        </LinearGradient>

        {/* ── Stats ── */}
        <View style={s.statsGrid}>
          {[
            { label: "Départs aujourd'hui", value: stats?.tripsToday ?? 0,      icon: "navigation" as const,  color: INDIGO2, bg: LIGHT },
            { label: "Agents actifs",        value: stats?.agentsActive ?? 0,    icon: "users" as const,       color: "#166534", bg: "#DCFCE7" },
            { label: "Passagers aujourd'hui",value: stats?.passengersToday ?? 0, icon: "user" as const,        color: "#D97706", bg: "#FEF3C7" },
            { label: "Cars disponibles",     value: stats?.busesAvailable ?? 0,  icon: "truck" as const,       color: "#0369A1", bg: "#E0F2FE" },
          ].map((item, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: item.bg }]}>
              <View style={[s.statIcon, { backgroundColor: item.color + "20" }]}>
                <Feather name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={[s.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Actions rapides ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Actions rapides</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <Pressable style={[s.actionBtn, { backgroundColor: INDIGO2 }]} onPress={() => router.push("/agent/chef-trips" as never)}>
              <Feather name="plus-circle" size={16} color="white" />
              <Text style={[s.actionBtnText, { color: "white" }]} numberOfLines={1} adjustsFontSizeToFit>Nouveau départ</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, { backgroundColor: "white", borderWidth: 1.5, borderColor: INDIGO2 }]} onPress={() => router.push("/agent/chef-trips" as never)}>
              <Feather name="list" size={16} color={INDIGO2} />
              <Text style={[s.actionBtnText, { color: INDIGO2 }]} numberOfLines={1} adjustsFontSizeToFit>Trajets</Text>
            </Pressable>
          </View>
          {/* Caisses agents */}
          <Pressable
            style={{ backgroundColor: "#065F46", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
            onPress={() => router.push({ pathname: "/agent/chef-trips", params: { tab: "caisses" } } as never)}
          >
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="dollar-sign" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Caisses des agents</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>
                {pendingCaisses > 0
                  ? `${pendingCaisses} caisse${pendingCaisses > 1 ? "s" : ""} en attente de validation`
                  : "Valider ou rejeter les caisses soumises par vos agents"}
              </Text>
            </View>
            {pendingCaisses > 0 && (
              <View style={{ backgroundColor: "#FCD34D", borderRadius: 12, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginRight: 4 }}>
                <Text style={{ color: "#92400E", fontWeight: "800", fontSize: 13 }}>{pendingCaisses}</Text>
              </View>
            )}
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>

        {/* ── Cars disponibles ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Flotte de cars</Text>
            <Text style={s.sectionCount}>{buses.length} car{buses.length !== 1 ? "s" : ""}</Text>
          </View>
          {buses.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="truck" size={28} color="#9CA3AF" />
              <Text style={s.emptyText}>Aucun car disponible</Text>
            </View>
          ) : (
            buses.map((bus) => {
              const st = busStatusLabel(bus);
              const isAvailable = bus.availability_status === "disponible";
              return (
                <View key={bus.id} style={[s.busCard, isAvailable && s.busCardAvail]}>
                  <View style={s.busCardLeft}>
                    <View style={[s.busIcon, { backgroundColor: isAvailable ? "#DCFCE7" : "#F3F4F6" }]}>
                      <Feather name="truck" size={18} color={isAvailable ? "#166534" : "#9CA3AF"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.busName}>{bus.bus_name}</Text>
                      <Text style={s.busPlate}>{bus.plate_number} · {bus.bus_type} · {bus.capacity} sièges</Text>
                      {bus.from_city && bus.to_city && (
                        <Text style={s.busRoute}>{bus.from_city} → {bus.to_city} · {bus.date} {bus.departure_time}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[s.busBadge, { backgroundColor: st.bg }]}>
                    <Text style={[s.busBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Départs d'aujourd'hui ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Départs d'aujourd'hui</Text>
            <Text style={s.sectionCount}>{tripsToday.length}</Text>
          </View>
          {tripsToday.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="calendar" size={28} color="#9CA3AF" />
              <Text style={s.emptyText}>Aucun départ aujourd'hui</Text>
            </View>
          ) : (
            tripsToday.map((trip) => {
              const st      = tripStatusLabel(trip.status);
              const cap     = capacityBadge(trip.capacity_status);
              const locked  = isLocked(trip.status);
              const pct     = trip.total_seats > 0 ? (trip.passenger_count / trip.total_seats) * 100 : 0;
              const delay   = Number(trip.delay_minutes) || 0;
              const eta     = trip.estimated_arrival_time ?? trip.arrival_time;
              const isLive  = ["en_route","in_progress","boarding"].includes(trip.status);

              return (
                <Pressable key={trip.id} style={[s.tripCard, isLive && { borderColor: "#BBF7D0", borderWidth: 2 }]}
                  onPress={() => router.push("/agent/chef-trips" as never)}>
                  <View style={s.tripCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={s.tripRoute}>{trip.from_city} → {trip.to_city}</Text>
                        {locked && <Feather name="lock" size={12} color="#9CA3AF" />}
                      </View>
                      <View style={{ flexDirection: "row", gap: 10, marginTop: 3, alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <Feather name="clock" size={11} color="#6B7280" />
                          <Text style={s.tripMeta}>{trip.departure_time}</Text>
                        </View>
                        {isLive && eta && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Feather name="map-pin" size={11} color="#166534" />
                            <Text style={[s.tripMeta, { color: "#166534" }]}>ETA {eta}</Text>
                          </View>
                        )}
                        {delay > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            <Feather name="alert-circle" size={10} color="#D97706" />
                            <Text style={{ fontSize: 10, color: "#D97706", fontWeight: "700" }}>+{delay} min</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[s.tripBadge, { backgroundColor: st.bg }]}>
                      <Text style={[s.tripBadgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  {/* Indicateur capacité */}
                  {cap && (
                    <View style={[s.capBadge, { backgroundColor: cap.bg }]}>
                      <Feather name="alert-triangle" size={10} color={cap.color} />
                      <Text style={[s.capText, { color: cap.color }]}>{cap.label}</Text>
                    </View>
                  )}
                  <View style={s.fillBarBg}>
                    <View style={[s.fillBar, { width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? "#DC2626" : pct >= 90 ? "#DC2626" : pct >= 70 ? "#D97706" : "#166534" }]} />
                  </View>
                  <Text style={s.fillLabel}>{trip.passenger_count} / {trip.total_seats} passagers ({Math.round(pct)}%)</Text>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Prochains départs ── */}
        {upcoming.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Prochains départs</Text>
              <Pressable onPress={() => router.push("/agent/chef-trips" as never)}>
                <Text style={{ color: INDIGO2, fontSize: 13, fontWeight: "600" }}>Voir tout</Text>
              </Pressable>
            </View>
            {upcoming.map((trip) => {
              const st = tripStatusLabel(trip.status);
              return (
                <View key={trip.id} style={[s.tripCard, { backgroundColor: "#F8FAFF" }]}>
                  <View style={s.tripCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.tripRoute}>{trip.from_city} → {trip.to_city}</Text>
                      <Text style={s.tripMeta}>{trip.date} · {trip.departure_time}</Text>
                    </View>
                    <View style={[s.tripBadge, { backgroundColor: st.bg }]}>
                      <Text style={[s.tripBadgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <Pressable style={s.fab} onPress={() => router.push("/agent/chef-trips" as never)}>
        <Feather name="plus" size={24} color="white" />
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  headerGreeting: { fontSize: 22, fontWeight: "800", color: "white" },
  headerRole: { fontSize: 13, color: "#A5B4FC", marginTop: 2, marginBottom: 6 },
  agenceBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  agenceText: { color: "#C7D2FE", fontSize: 13 },
  homeBtn: { padding: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" },
  liveText: { color: "#C7D2FE", fontSize: 12 },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    paddingHorizontal: 16, marginTop: -16, paddingTop: 0,
  },
  statCard: {
    flex: 1, minWidth: "44%", borderRadius: 18, padding: 16,
    shadowColor: "#3730A3", shadowOpacity: 0.10, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  statIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  statValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: "#6B7280", marginTop: 3, fontWeight: "600" },

  section: { marginHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", letterSpacing: -0.3 },
  sectionCount: { fontSize: 12, color: "#6B7280", backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontWeight: "600" },

  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 14, borderRadius: 16,
  },
  actionBtnText: { fontSize: 13, fontWeight: "700" },

  emptyCard: {
    backgroundColor: "white", borderRadius: 18, padding: 28,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#F3F4F6",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  emptyText: { color: "#9CA3AF", fontSize: 14 },

  busCard: {
    backgroundColor: "white", borderRadius: 16, padding: 15, marginBottom: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#EEF2F8",
    shadowColor: "#3730A3", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  busCardAvail: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  busCardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  busIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  busName: { fontSize: 14, fontWeight: "700", color: "#111827", letterSpacing: -0.2 },
  busPlate: { fontSize: 12, color: "#6B7280", marginTop: 1, fontWeight: "500" },
  busRoute: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  busBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  busBadgeText: { fontSize: 11, fontWeight: "700" },

  tripCard: {
    backgroundColor: "white", borderRadius: 16, padding: 15, marginBottom: 10,
    borderWidth: 1, borderColor: "#EEF2F8",
    shadowColor: "#3730A3", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  tripCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tripRoute: { fontSize: 15, fontWeight: "700", color: "#111827" },
  tripMeta: { fontSize: 12, color: "#6B7280", marginTop: 3 },
  tripBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tripBadgeText: { fontSize: 11, fontWeight: "700" },
  fillBarBg: { height: 5, backgroundColor: "#F3F4F6", borderRadius: 4, marginTop: 10, overflow: "hidden" },
  fillBar: { height: 5, borderRadius: 4 },
  fillLabel: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },
  capBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 8 },
  capText: { fontSize: 11, fontWeight: "700" },

  fab: {
    position: "absolute", bottom: 28, right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: INDIGO2, justifyContent: "center", alignItems: "center",
    shadowColor: INDIGO, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});
