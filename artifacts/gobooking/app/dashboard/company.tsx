import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = Colors.light.primary;
const DARK = Colors.light.primaryDark;

interface CompanyStats {
  totalBuses: number;
  totalAgents: number;
  totalTrips: number;
  totalReservations: number;
  totalParcels: number;
  totalRevenue: number;
  activeBuses: number;
}

interface Bus {
  id: string; busName: string; plateNumber: string; busType: string;
  capacity: number; status: string;
}
interface AgentItem {
  id: string; agentCode: string; status: string;
}

const DEMO_STATS: CompanyStats = {
  totalBuses: 12, totalAgents: 18, totalTrips: 284,
  totalReservations: 1_420, totalParcels: 638,
  totalRevenue: 8_760_000, activeBuses: 9,
};

const DEMO_BUSES: Bus[] = [
  { id: "b1", busName: "Express Abidjan 01", plateNumber: "0258 AB 01", busType: "Premium", capacity: 44, status: "active" },
  { id: "b2", busName: "Bouaké Direct 02", plateNumber: "0258 AB 02", busType: "Standard", capacity: 52, status: "active" },
  { id: "b3", busName: "Yamoussoukro 03", plateNumber: "0258 AB 03", busType: "Standard", capacity: 44, status: "maintenance" },
  { id: "b4", busName: "Korhogo Express 04", plateNumber: "0258 AB 04", busType: "Premium", capacity: 36, status: "active" },
];

const DEMO_ROUTES = [
  { from: "Abidjan", to: "Bouaké", trips: 84, revenue: 2_940_000 },
  { from: "Abidjan", to: "Yamoussoukro", trips: 62, revenue: 1_240_000 },
  { from: "Abidjan", to: "Korhogo", trips: 48, revenue: 2_880_000 },
  { from: "Bouaké", to: "Korhogo", trips: 38, revenue: 950_000 },
  { from: "San Pedro", to: "Abidjan", trips: 52, revenue: 1_560_000 },
];

const DEMO_PARCELS = [
  { id: "p1", trackingRef: "GBX-A4F2-KM91", fromCity: "Abidjan", toCity: "Bouaké", status: "en_transit", amount: 4700 },
  { id: "p2", trackingRef: "GBX-B9C3-PL44", fromCity: "San Pedro", toCity: "Abidjan", status: "livre", amount: 6200 },
  { id: "p3", trackingRef: "GBX-C1E7-QR22", fromCity: "Abidjan", toCity: "Yamoussoukro", status: "en_attente", amount: 3500 },
  { id: "p4", trackingRef: "GBX-D5F8-MN33", fromCity: "Abidjan", toCity: "Korhogo", status: "pris_en_charge", amount: 8100 },
];

type Tab = "apercu" | "bus" | "routes" | "colis" | "agents";

const PARCEL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:     { label: "En attente",     color: "#B45309", bg: "#FFFBEB" },
  pris_en_charge: { label: "Pris en charge", color: "#1D4ED8", bg: "#EFF6FF" },
  en_transit:     { label: "En transit",     color: "#6D28D9", bg: "#F5F3FF" },
  en_livraison:   { label: "En livraison",   color: "#0E7490", bg: "#ECFEFF" },
  livre:          { label: "Livré",          color: "#065F46", bg: "#ECFDF5" },
};

export default function CompanyDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("apercu");
  const [stats, setStats] = useState<CompanyStats>(DEMO_STATS);
  const [buses, setBuses] = useState<Bus[]>(DEMO_BUSES);
  const [loading, setLoading] = useState(false);
  const [addBusModal, setAddBusModal] = useState(false);
  const [newBus, setNewBus] = useState({ busName: "", plateNumber: "", busType: "Standard", capacity: "44" });

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.allSettled([
      apiFetch<CompanyStats>("/company/stats", { token }),
      apiFetch<Bus[]>("/company/buses", { token }),
    ]).then(([s, b]) => {
      if (s.status === "fulfilled") setStats(s.value);
      if (b.status === "fulfilled" && b.value.length > 0) setBuses(b.value);
    }).finally(() => setLoading(false));
  }, [token]);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "apercu", label: "Aperçu", icon: "bar-chart-2" },
    { id: "bus", label: "Bus", icon: "truck" },
    { id: "routes", label: "Routes", icon: "map" },
    { id: "colis", label: "Colis", icon: "package" },
    { id: "agents", label: "Agents", icon: "users" },
  ];

  const StatCard = ({ icon, label, value, sub, color, bg }: { icon: string; label: string; value: string | number; sub?: string; color: string; bg: string }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Feather name={icon as never} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={[PRIMARY, DARK]} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Tableau de bord</Text>
          <Text style={styles.headerSub}>SOTRAL — Société de Transport CI</Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="shield" size={14} color="white" />
          <Text style={styles.headerBadgeText}>Entreprise</Text>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Feather name={tab.icon as never} size={14} color={activeTab === tab.id ? PRIMARY : "#94A3B8"} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 12 }} showsVerticalScrollIndicator={false}>

        {activeTab === "apercu" && (
          <>
            <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
            <View style={styles.statsGrid}>
              <StatCard icon="truck" label="Bus actifs" value={`${stats.activeBuses}/${stats.totalBuses}`} color="#1D4ED8" bg="#EFF6FF" />
              <StatCard icon="users" label="Agents" value={stats.totalAgents} color="#7C3AED" bg="#F5F3FF" />
              <StatCard icon="navigation" label="Trajets" value={stats.totalTrips} color={PRIMARY} bg="#EEF2FF" />
              <StatCard icon="bookmark" label="Réservations" value={stats.totalReservations} color="#059669" bg="#ECFDF5" />
              <StatCard icon="package" label="Colis" value={stats.totalParcels} color="#D97706" bg="#FFFBEB" />
              <StatCard icon="trending-up" label="Revenus" value={`${(stats.totalRevenue / 1000).toFixed(0)}K FCFA`} color="#0891B2" bg="#ECFEFF" />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Accès rapide</Text>
            <View style={styles.quickGrid}>
              {[
                { icon: "truck", label: "Gérer les bus", tab: "bus" as Tab, color: "#1D4ED8", bg: "#EFF6FF" },
                { icon: "map", label: "Gérer les routes", tab: "routes" as Tab, color: PRIMARY, bg: "#EEF2FF" },
                { icon: "package", label: "Gérer les colis", tab: "colis" as Tab, color: "#D97706", bg: "#FFFBEB" },
                { icon: "users", label: "Gérer les agents", tab: "agents" as Tab, color: "#7C3AED", bg: "#F5F3FF" },
              ].map(item => (
                <TouchableOpacity key={item.tab} style={styles.quickCard} onPress={() => setActiveTab(item.tab)} activeOpacity={0.8}>
                  <View style={[styles.quickIcon, { backgroundColor: item.bg }]}>
                    <Feather name={item.icon as never} size={22} color={item.color} />
                  </View>
                  <Text style={styles.quickLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {activeTab === "bus" && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Flotte de bus ({buses.length})</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => setAddBusModal(true)}>
                <Feather name="plus" size={14} color="white" />
                <Text style={styles.addBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
            {buses.map(bus => (
              <View key={bus.id} style={styles.listCard}>
                <View style={[styles.listIcon, { backgroundColor: bus.status === "active" ? "#EFF6FF" : "#FFF7ED" }]}>
                  <Feather name="truck" size={20} color={bus.status === "active" ? "#1D4ED8" : "#D97706"} />
                </View>
                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>{bus.busName}</Text>
                  <Text style={styles.listSub}>{bus.plateNumber} · {bus.busType} · {bus.capacity} places</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: bus.status === "active" ? "#ECFDF5" : "#FFFBEB" }]}>
                  <Text style={[styles.badgeText, { color: bus.status === "active" ? "#065F46" : "#B45309" }]}>
                    {bus.status === "active" ? "Actif" : "Maintenance"}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {activeTab === "routes" && (
          <>
            <Text style={styles.sectionTitle}>Routes & performances</Text>
            {DEMO_ROUTES.map((route, i) => (
              <View key={i} style={styles.routeCard}>
                <View style={styles.routeLeft}>
                  <View style={styles.routeIconWrap}>
                    <Feather name="map-pin" size={14} color={PRIMARY} />
                  </View>
                  <View>
                    <Text style={styles.routeRoute}>{route.from} → {route.to}</Text>
                    <Text style={styles.routeMeta}>{route.trips} trajets effectués</Text>
                  </View>
                </View>
                <View style={styles.routeRight}>
                  <Text style={styles.routeRevenue}>{(route.revenue / 1000).toFixed(0)}K</Text>
                  <Text style={styles.routeMeta}>FCFA</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {activeTab === "colis" && (
          <>
            <Text style={styles.sectionTitle}>Gestion des colis ({DEMO_PARCELS.length})</Text>
            {DEMO_PARCELS.map(parcel => {
              const st = PARCEL_STATUS[parcel.status] ?? PARCEL_STATUS.en_attente;
              return (
                <View key={parcel.id} style={styles.listCard}>
                  <View style={[styles.listIcon, { backgroundColor: st.bg }]}>
                    <Feather name="package" size={18} color={st.color} />
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.listTitle}>{parcel.trackingRef}</Text>
                    <Text style={styles.listSub}>{parcel.fromCity} → {parcel.toCity}</Text>
                  </View>
                  <View style={styles.colisRight}>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                    <Text style={styles.parcelAmount}>{parcel.amount.toLocaleString()} F</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {activeTab === "agents" && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Agents ({stats.totalAgents})</Text>
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
                <Feather name="plus" size={14} color="white" />
                <Text style={styles.addBtnText}>Inviter</Text>
              </TouchableOpacity>
            </View>
            {[
              { name: "Kouassi Jean", code: "AGT-001", bus: "Express Abidjan 01", status: "active" },
              { name: "Traoré Mamadou", code: "AGT-002", bus: "Bouaké Direct 02", status: "active" },
              { name: "Bamba Fatima", code: "AGT-003", bus: "Korhogo Express 04", status: "active" },
              { name: "Diallo Seydou", code: "AGT-004", bus: "Non assigné", status: "inactive" },
              { name: "Coulibaly Koffi", code: "AGT-005", bus: "Yamoussoukro 03", status: "active" },
            ].map((agent, i) => (
              <View key={i} style={styles.listCard}>
                <View style={styles.agentAvatar}>
                  <Text style={styles.agentAvatarText}>{agent.name.charAt(0)}</Text>
                </View>
                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>{agent.name}</Text>
                  <Text style={styles.listSub}>{agent.code} · {agent.bus}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: agent.status === "active" ? "#ECFDF5" : "#F1F5F9" }]}>
                  <Text style={[styles.badgeText, { color: agent.status === "active" ? "#065F46" : "#64748B" }]}>
                    {agent.status === "active" ? "Actif" : "Inactif"}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>

      <Modal visible={addBusModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajouter un bus</Text>
            <TextInput style={styles.modalInput} placeholder="Nom du bus" value={newBus.busName} onChangeText={v => setNewBus(p => ({ ...p, busName: v }))} />
            <TextInput style={styles.modalInput} placeholder="Plaque d'immatriculation" value={newBus.plateNumber} onChangeText={v => setNewBus(p => ({ ...p, plateNumber: v }))} />
            <TextInput style={styles.modalInput} placeholder="Capacité" keyboardType="numeric" value={newBus.capacity} onChangeText={v => setNewBus(p => ({ ...p, capacity: v }))} />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setAddBusModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={() => {
                if (!newBus.busName || !newBus.plateNumber) return;
                setBuses(prev => [...prev, { id: Date.now().toString(), busName: newBus.busName, plateNumber: newBus.plateNumber, busType: "Standard", capacity: Number(newBus.capacity) || 44, status: "active" }]);
                setAddBusModal(false);
                setNewBus({ busName: "", plateNumber: "", busType: "Standard", capacity: "44" });
              }}>
                <Text style={styles.modalConfirmText}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 1 },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  headerBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  tabBar: { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", maxHeight: 52 },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: "center" },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: PRIMARY },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  tabTextActive: { color: PRIMARY, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", backgroundColor: "white", borderRadius: 14, padding: 14, borderLeftWidth: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0F172A" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  statSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: { width: "47%", backgroundColor: "white", borderRadius: 16, padding: 16, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  quickIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  quickLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "white" },
  listCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  listIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  listContent: { flex: 1 },
  listTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  listSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  colisRight: { alignItems: "flex-end", gap: 4 },
  parcelAmount: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY },
  agentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  agentAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  routeCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  routeLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  routeRoute: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  routeMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  routeRight: { alignItems: "flex-end" },
  routeRevenue: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#059669" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 4 },
  modalInput: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#0F172A" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  modalConfirm: { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalConfirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
});
