import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

interface GlobalStats {
  totalUsers: number; totalCompanies: number; totalAgents: number;
  totalTrips: number; totalParcels: number; totalBookings: number;
  totalRevenue: number; totalCities: number;
  recentUsers: { id: string; name: string; email: string; role: string }[];
}

interface Company { id: string; name: string; email: string; phone: string; city: string; status: string }
interface UserItem { id: string; name: string; email: string; role: string }
interface CityItem { id: string; name: string; region: string }

const DEMO_STATS: GlobalStats = {
  totalUsers: 1_248, totalCompanies: 8, totalAgents: 64,
  totalTrips: 1_834, totalParcels: 2_290, totalBookings: 5_610,
  totalRevenue: 42_880_000, totalCities: 18,
  recentUsers: [
    { id: "u1", name: "Ama Koné", email: "ama.kone@gmail.com", role: "user" },
    { id: "u2", name: "Mamadou Traoré", email: "m.traore@gmail.com", role: "user" },
    { id: "u3", name: "Bamba Koffi", email: "b.koffi@sotral.ci", role: "company_admin" },
    { id: "u4", name: "Mariam Diallo", email: "diallo@gobooking.com", role: "agent" },
    { id: "u5", name: "Jean Coulibaly", email: "jean.c@gmail.com", role: "user" },
  ],
};

const DEMO_COMPANIES: Company[] = [
  { id: "c1", name: "SOTRAL", email: "contact@sotral.ci", phone: "+225 27 22 44 11 00", city: "Abidjan", status: "active" },
  { id: "c2", name: "UTB", email: "info@utb.ci", phone: "+225 27 22 44 22 11", city: "Abidjan", status: "active" },
  { id: "c3", name: "Trans Ivoire", email: "contact@transivoire.ci", phone: "+225 27 22 55 33 22", city: "Bouaké", status: "active" },
  { id: "c4", name: "CTM Côte d'Ivoire", email: "ctm@ctm-ci.com", phone: "+225 27 22 11 44 33", city: "Yamoussoukro", status: "active" },
  { id: "c5", name: "Express du Nord", email: "nord@express.ci", phone: "+225 27 22 77 55 44", city: "Korhogo", status: "inactive" },
];

const DEMO_CITIES: CityItem[] = [
  { id: "ct1", name: "Abidjan", region: "Lagunes" },
  { id: "ct2", name: "Bouaké", region: "Vallée du Bandama" },
  { id: "ct3", name: "Yamoussoukro", region: "Yamoussoukro" },
  { id: "ct4", name: "Korhogo", region: "Savanes" },
  { id: "ct5", name: "San Pedro", region: "Bas-Sassandra" },
  { id: "ct6", name: "Daloa", region: "Haut-Sassandra" },
  { id: "ct7", name: "Man", region: "Montagnes" },
  { id: "ct8", name: "Gagnoa", region: "Gôh" },
  { id: "ct9", name: "Divo", region: "Gôh" },
  { id: "ct10", name: "Abengourou", region: "Indénié-Djuablin" },
];

const DEMO_USERS: UserItem[] = [
  { id: "u1", name: "Ama Koné", email: "ama.kone@gmail.com", role: "user" },
  { id: "u2", name: "Mamadou Traoré", email: "m.traore@gmail.com", role: "user" },
  { id: "u3", name: "Bamba Koffi", email: "b.koffi@sotral.ci", role: "company_admin" },
  { id: "u4", name: "Mariam Diallo", email: "diallo@gobooking.com", role: "agent" },
  { id: "u5", name: "Super Admin", email: "admin@gobooking.com", role: "admin" },
];

const ROLE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  user:          { label: "Client",          color: PRIMARY,    bg: "#EEF2FF" },
  company_admin: { label: "Entreprise",      color: "#D97706",  bg: "#FFFBEB" },
  agent:         { label: "Agent",           color: "#059669",  bg: "#ECFDF5" },
  admin:         { label: "Super Admin",     color: "#7C3AED",  bg: "#F5F3FF" },
  super_admin:   { label: "Super Admin",     color: "#7C3AED",  bg: "#F5F3FF" },
};

type Tab = "apercu" | "entreprises" | "utilisateurs" | "villes" | "paiements";

const PAYMENT_METHODS = [
  { name: "Orange Money", amount: 18_400_000, pct: 43, color: "#FF6B00", bg: "#FFF4EE" },
  { name: "MTN MoMo",    amount: 12_200_000, pct: 28, color: "#FFCB00", bg: "#FFFDE7" },
  { name: "Wave",        amount: 8_600_000,  pct: 20, color: "#1BA5E0", bg: "#E0F2FE" },
  { name: "Visa/MC",     amount: 3_680_000,  pct: 9,  color: "#1D4ED8", bg: "#EFF6FF" },
];

export default function SuperAdminDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("apercu");
  const [stats, setStats] = useState<GlobalStats>(DEMO_STATS);
  const [companies, setCompanies] = useState<Company[]>(DEMO_COMPANIES);
  const [cities, setCities] = useState<CityItem[]>(DEMO_CITIES);
  const [users, setUsers] = useState<UserItem[]>(DEMO_USERS);
  const [loading, setLoading] = useState(false);
  const [addCityModal, setAddCityModal] = useState(false);
  const [newCity, setNewCity] = useState({ name: "", region: "" });
  const [addCompanyModal, setAddCompanyModal] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", email: "", phone: "", city: "" });

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.allSettled([
      apiFetch<GlobalStats>("/superadmin/stats", { token }),
      apiFetch<Company[]>("/superadmin/companies", { token }),
      apiFetch<CityItem[]>("/superadmin/cities", { token }),
      apiFetch<UserItem[]>("/superadmin/users", { token }),
    ]).then(([s, c, ci, u]) => {
      if (s.status === "fulfilled") setStats(s.value);
      if (c.status === "fulfilled" && c.value.length > 0) setCompanies(c.value);
      if (ci.status === "fulfilled" && ci.value.length > 0) setCities(ci.value);
      if (u.status === "fulfilled" && u.value.length > 0) setUsers(u.value);
    }).finally(() => setLoading(false));
  }, [token]);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "apercu", label: "Aperçu", icon: "bar-chart-2" },
    { id: "entreprises", label: "Entreprises", icon: "briefcase" },
    { id: "utilisateurs", label: "Utilisateurs", icon: "users" },
    { id: "villes", label: "Villes", icon: "map-pin" },
    { id: "paiements", label: "Paiements", icon: "credit-card" },
  ];

  const StatCard = ({ icon, label, value, color, bg }: { icon: string; label: string; value: string | number; color: string; bg: string }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Feather name={icon as never} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={["#7C3AED", "#5B21B6"]} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Super Admin</Text>
          <Text style={styles.headerSub}>GoBooking · Côte d'Ivoire</Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="shield" size={13} color="white" />
          <Text style={styles.headerBadgeText}>Super Admin</Text>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Feather name={tab.icon as never} size={13} color={activeTab === tab.id ? "#7C3AED" : "#94A3B8"} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 14 }} showsVerticalScrollIndicator={false}>

        {activeTab === "apercu" && (
          <>
            <View style={styles.revenueCard}>
              <LinearGradient colors={["#7C3AED", "#5B21B6"]} style={styles.revenueGradient}>
                <Text style={styles.revenueLabel}>Revenu total de la plateforme</Text>
                <Text style={styles.revenueValue}>
                  {(stats.totalRevenue / 1_000_000).toFixed(1)} M FCFA
                </Text>
                <Text style={styles.revenueSub}>Cumulé depuis le lancement</Text>
              </LinearGradient>
            </View>

            <View style={styles.statsGrid}>
              <StatCard icon="users" label="Utilisateurs" value={stats.totalUsers.toLocaleString()} color={PRIMARY} bg="#EEF2FF" />
              <StatCard icon="briefcase" label="Entreprises" value={stats.totalCompanies} color="#D97706" bg="#FFFBEB" />
              <StatCard icon="user" label="Agents" value={stats.totalAgents} color="#059669" bg="#ECFDF5" />
              <StatCard icon="navigation" label="Trajets" value={stats.totalTrips.toLocaleString()} color="#0891B2" bg="#ECFEFF" />
              <StatCard icon="package" label="Colis" value={stats.totalParcels.toLocaleString()} color="#6D28D9" bg="#F5F3FF" />
              <StatCard icon="bookmark" label="Réservations" value={stats.totalBookings.toLocaleString()} color="#DC2626" bg="#FEF2F2" />
              <StatCard icon="map-pin" label="Villes" value={stats.totalCities} color="#0F766E" bg="#F0FDFA" />
              <StatCard icon="credit-card" label="Paiements" value="4 modes" color="#9333EA" bg="#FAF5FF" />
            </View>

            <Text style={styles.sectionTitle}>Derniers utilisateurs</Text>
            {stats.recentUsers.map(u => {
              const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.user;
              return (
                <View key={u.id} style={styles.listCard}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{u.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.listTitle}>{u.name}</Text>
                    <Text style={styles.listSub}>{u.email}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: rs.bg }]}>
                    <Text style={[styles.badgeText, { color: rs.color }]}>{rs.label}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {activeTab === "entreprises" && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Entreprises ({companies.length})</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#7C3AED" }]} onPress={() => setAddCompanyModal(true)} activeOpacity={0.8}>
                <Feather name="plus" size={14} color="white" />
                <Text style={styles.addBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
            {companies.map(company => (
              <View key={company.id} style={styles.listCard}>
                <View style={[styles.companyIcon, { backgroundColor: "#F5F3FF" }]}>
                  <Feather name="briefcase" size={18} color="#7C3AED" />
                </View>
                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>{company.name}</Text>
                  <Text style={styles.listSub}>{company.email}</Text>
                  <Text style={styles.listSub}>{company.city} · {company.phone}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: company.status === "active" ? "#ECFDF5" : "#FEF2F2" }]}>
                  <Text style={[styles.badgeText, { color: company.status === "active" ? "#065F46" : "#DC2626" }]}>
                    {company.status === "active" ? "Actif" : "Inactif"}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {activeTab === "utilisateurs" && (
          <>
            <Text style={styles.sectionTitle}>Utilisateurs ({users.length})</Text>
            {users.map(u => {
              const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.user;
              return (
                <View key={u.id} style={styles.listCard}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{u.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.listTitle}>{u.name}</Text>
                    <Text style={styles.listSub}>{u.email}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: rs.bg }]}>
                    <Text style={[styles.badgeText, { color: rs.color }]}>{rs.label}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {activeTab === "villes" && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Villes ({cities.length})</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#7C3AED" }]} onPress={() => setAddCityModal(true)} activeOpacity={0.8}>
                <Feather name="plus" size={14} color="white" />
                <Text style={styles.addBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.citiesGrid}>
              {cities.map(city => (
                <View key={city.id} style={styles.cityChip}>
                  <Feather name="map-pin" size={12} color="#7C3AED" />
                  <View>
                    <Text style={styles.cityChipName}>{city.name}</Text>
                    {city.region && <Text style={styles.cityChipRegion}>{city.region}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === "paiements" && (
          <>
            <Text style={styles.sectionTitle}>Statistiques de paiement</Text>
            <View style={styles.revenueTotalCard}>
              <Text style={styles.revenueTotalLabel}>Revenu total</Text>
              <Text style={styles.revenueTotalValue}>{stats.totalRevenue.toLocaleString()} FCFA</Text>
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Répartition par mode</Text>
            {PAYMENT_METHODS.map((pm, i) => (
              <View key={i} style={styles.paymentCard}>
                <View style={[styles.paymentIcon, { backgroundColor: pm.bg }]}>
                  <Feather name="credit-card" size={18} color={pm.color} />
                </View>
                <View style={styles.paymentContent}>
                  <View style={styles.paymentTop}>
                    <Text style={styles.paymentName}>{pm.name}</Text>
                    <Text style={styles.paymentPct}>{pm.pct}%</Text>
                  </View>
                  <View style={styles.barWrap}>
                    <View style={[styles.bar, { width: `${pm.pct}%` as any, backgroundColor: pm.color }]} />
                  </View>
                  <Text style={styles.paymentAmount}>{(pm.amount / 1_000_000).toFixed(1)} M FCFA</Text>
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>

      <Modal visible={addCityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajouter une ville</Text>
            <TextInput style={styles.modalInput} placeholder="Nom de la ville" value={newCity.name} onChangeText={v => setNewCity(p => ({ ...p, name: v }))} />
            <TextInput style={styles.modalInput} placeholder="Région" value={newCity.region} onChangeText={v => setNewCity(p => ({ ...p, region: v }))} />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setAddCityModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: "#7C3AED" }]} onPress={() => {
                if (!newCity.name) return;
                setCities(prev => [...prev, { id: Date.now().toString(), name: newCity.name, region: newCity.region }]);
                setAddCityModal(false);
                setNewCity({ name: "", region: "" });
              }}>
                <Text style={styles.modalConfirmText}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addCompanyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajouter une entreprise</Text>
            <TextInput style={styles.modalInput} placeholder="Nom de l'entreprise" value={newCompany.name} onChangeText={v => setNewCompany(p => ({ ...p, name: v }))} />
            <TextInput style={styles.modalInput} placeholder="Email" keyboardType="email-address" value={newCompany.email} onChangeText={v => setNewCompany(p => ({ ...p, email: v }))} />
            <TextInput style={styles.modalInput} placeholder="Téléphone" keyboardType="phone-pad" value={newCompany.phone} onChangeText={v => setNewCompany(p => ({ ...p, phone: v }))} />
            <TextInput style={styles.modalInput} placeholder="Ville" value={newCompany.city} onChangeText={v => setNewCompany(p => ({ ...p, city: v }))} />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setAddCompanyModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: "#7C3AED" }]} onPress={() => {
                if (!newCompany.name || !newCompany.email) return;
                setCompanies(prev => [...prev, { id: Date.now().toString(), ...newCompany, status: "active" }]);
                setAddCompanyModal(false);
                setNewCompany({ name: "", email: "", phone: "", city: "" });
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
  tabActive: { borderBottomColor: "#7C3AED" },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  tabTextActive: { color: "#7C3AED", fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  revenueCard: { borderRadius: 20, overflow: "hidden" },
  revenueGradient: { padding: 22, gap: 4, alignItems: "center" },
  revenueLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  revenueValue: { fontSize: 32, fontFamily: "Inter_700Bold", color: "white" },
  revenueSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", backgroundColor: "white", borderRadius: 14, padding: 14, borderLeftWidth: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 4 },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0F172A" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "white" },
  listCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  listContent: { flex: 1 },
  listTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  listSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  userAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  userAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  companyIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  citiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cityChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "white", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cityChipName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  cityChipRegion: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  revenueTotalCard: { backgroundColor: "white", borderRadius: 16, padding: 18, alignItems: "center", gap: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  revenueTotalLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  revenueTotalValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#7C3AED" },
  paymentCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  paymentIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  paymentContent: { flex: 1, gap: 5 },
  paymentTop: { flexDirection: "row", justifyContent: "space-between" },
  paymentName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  paymentPct: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#64748B" },
  barWrap: { height: 6, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  bar: { height: 6, borderRadius: 4 },
  paymentAmount: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 4 },
  modalInput: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#0F172A" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  modalConfirm: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalConfirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
});
