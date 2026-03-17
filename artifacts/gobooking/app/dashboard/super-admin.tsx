import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
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

/* ─── Types ─────────────────────────────────────────────── */
interface GlobalStats { totalUsers: number; totalCompanies: number; totalAgents: number; totalTrips: number; totalParcels: number; totalBookings: number; totalRevenue: number; totalCities: number; recentUsers: { id: string; name: string; email: string; role: string }[] }
interface Company { id: string; name: string; email: string; phone: string; city: string; status: string }
interface UserItem { id: string; name: string; email: string; role: string; createdAt?: string }
interface CityItem { id: string; name: string; region: string }
interface PaymentItem { id: string; refId: string; refType: string; amount: number; method: string; status: string; createdAt: string }

/* ─── Demo data ─────────────────────────────────────────── */
const DEMO_STATS: GlobalStats = {
  totalUsers: 1_248, totalCompanies: 8, totalAgents: 64, totalTrips: 1_834,
  totalParcels: 2_290, totalBookings: 5_610, totalRevenue: 42_880_000, totalCities: 18,
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
  { id: "c6", name: "Voyage Plus", email: "contact@voyageplus.ci", phone: "+225 27 22 88 66 55", city: "Abidjan", status: "active" },
  { id: "c7", name: "Confort Bus", email: "info@confortbus.ci", phone: "+225 27 22 99 77 66", city: "San Pedro", status: "active" },
  { id: "c8", name: "Prestige Trans", email: "prestige@pt.ci", phone: "+225 27 22 00 88 77", city: "Daloa", status: "inactive" },
];
const DEMO_USERS: UserItem[] = [
  { id: "u1", name: "Ama Koné", email: "ama.kone@gmail.com", role: "user", createdAt: "2026-03-15" },
  { id: "u2", name: "Mamadou Traoré", email: "m.traore@gmail.com", role: "user", createdAt: "2026-03-14" },
  { id: "u3", name: "Bamba Koffi", email: "b.koffi@sotral.ci", role: "company_admin", createdAt: "2026-03-10" },
  { id: "u4", name: "Mariam Diallo", email: "diallo@gobooking.com", role: "agent", createdAt: "2026-03-08" },
  { id: "u5", name: "Super Admin", email: "admin@gobooking.com", role: "admin", createdAt: "2026-01-01" },
  { id: "u6", name: "Kouassi Jean", email: "kouassi.jean@sotral.ci", role: "agent", createdAt: "2026-03-01" },
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
  { id: "ct11", name: "Bondoukou", region: "Gontougo" },
  { id: "ct12", name: "Odienné", region: "Kabadougou" },
];
const DEMO_PAYMENTS: PaymentItem[] = [
  { id: "pay1", refId: "GBB5AKZ8DZ", refType: "booking", amount: 7000, method: "orange", status: "paid", createdAt: "2026-03-17T08:00:00Z" },
  { id: "pay2", refId: "GBX-A4F2-KM91", refType: "parcel", amount: 4700, method: "mtn", status: "paid", createdAt: "2026-03-17T07:45:00Z" },
  { id: "pay3", refId: "GBB9MNX2PL", refType: "booking", amount: 3500, method: "wave", status: "paid", createdAt: "2026-03-16T15:30:00Z" },
  { id: "pay4", refId: "GBX-C1E7-QR22", refType: "parcel", amount: 3500, method: "orange", status: "paid", createdAt: "2026-03-16T14:00:00Z" },
  { id: "pay5", refId: "GBBA1C3RQ7", refType: "booking", amount: 4000, method: "visa", status: "paid", createdAt: "2026-03-15T11:00:00Z" },
  { id: "pay6", refId: "GBX-D5F8-MN33", refType: "parcel", amount: 8100, method: "mtn", status: "paid", createdAt: "2026-03-15T10:00:00Z" },
  { id: "pay7", refId: "GBB7FPV6NM", refType: "booking", amount: 6000, method: "orange", status: "paid", createdAt: "2026-03-14T09:00:00Z" },
  { id: "pay8", refId: "GBBC5XK0TZ", refType: "booking", amount: 2000, method: "wave", status: "refunded", createdAt: "2026-03-13T16:00:00Z" },
];

const ROLE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  user:          { label: "Client",      color: PRIMARY,   bg: "#EEF2FF" },
  company_admin: { label: "Entreprise",  color: "#D97706", bg: "#FFFBEB" },
  agent:         { label: "Agent",       color: "#059669", bg: "#ECFDF5" },
  admin:         { label: "Super Admin", color: "#7C3AED", bg: "#F5F3FF" },
  super_admin:   { label: "Super Admin", color: "#7C3AED", bg: "#F5F3FF" },
};
const METHOD_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  orange: { label: "Orange Money", color: "#FF6B00", bg: "#FFF4EE" },
  mtn:    { label: "MTN MoMo",     color: "#B8860B", bg: "#FFFDE7" },
  wave:   { label: "Wave",         color: "#1BA5E0", bg: "#E0F2FE" },
  visa:   { label: "Visa/MC",      color: "#1D4ED8", bg: "#EFF6FF" },
};
const PAYMENT_METHODS_STATS = [
  { key: "orange", name: "Orange Money", color: "#FF6B00", bg: "#FFF4EE", pct: 43, amount: 18_438_400 },
  { key: "mtn",   name: "MTN MoMo",     color: "#B8860B", bg: "#FFFDE7", pct: 28, amount: 12_006_400 },
  { key: "wave",  name: "Wave",         color: "#1BA5E0", bg: "#E0F2FE", pct: 20, amount: 8_576_000 },
  { key: "visa",  name: "Visa/MC",      color: "#1D4ED8", bg: "#EFF6FF", pct: 9,  amount: 3_859_200 },
];

type Tab = "apercu" | "entreprises" | "utilisateurs" | "villes" | "paiements" | "statistiques";

export default function SuperAdminDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("apercu");
  const [stats, setStats] = useState<GlobalStats>(DEMO_STATS);
  const [companies, setCompanies] = useState<Company[]>(DEMO_COMPANIES);
  const [users, setUsers] = useState<UserItem[]>(DEMO_USERS);
  const [cities, setCities] = useState<CityItem[]>(DEMO_CITIES);
  const [payments, setPayments] = useState<PaymentItem[]>(DEMO_PAYMENTS);
  const [addCityModal, setAddCityModal] = useState(false);
  const [addCompanyModal, setAddCompanyModal] = useState(false);
  const [newCity, setNewCity] = useState({ name: "", region: "" });
  const [newCompany, setNewCompany] = useState({ name: "", email: "", phone: "", city: "" });
  const [payFilter, setPayFilter] = useState<"all" | "booking" | "parcel">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "agent" | "company_admin" | "admin">("all");

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      apiFetch<GlobalStats>("/superadmin/stats", { token }),
      apiFetch<Company[]>("/superadmin/companies", { token }),
      apiFetch<UserItem[]>("/superadmin/users", { token }),
      apiFetch<CityItem[]>("/superadmin/cities", { token }),
      apiFetch<PaymentItem[]>("/superadmin/payments", { token }),
    ]).then(([s, c, u, ci, p]) => {
      if (s.status === "fulfilled") setStats(s.value);
      if (c.status === "fulfilled" && c.value.length > 0) setCompanies(c.value);
      if (u.status === "fulfilled" && u.value.length > 0) setUsers(u.value);
      if (ci.status === "fulfilled" && ci.value.length > 0) setCities(ci.value);
      if (p.status === "fulfilled" && p.value.length > 0) setPayments(p.value);
    });
  }, [token]);

  const toggleCompanyStatus = async (id: string) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: c.status === "active" ? "inactive" : "active" } : c));
    if (token) { try { await apiFetch(`/superadmin/companies/${id}/status`, { token, method: "PATCH", body: { status: companies.find(c => c.id === id)?.status === "active" ? "inactive" : "active" } }); } catch {} }
  };

  const filteredPayments = payFilter === "all" ? payments : payments.filter(p => p.refType === payFilter);
  const filteredUsers = roleFilter === "all" ? users : users.filter(u => u.role === roleFilter);
  const payTotal = filteredPayments.reduce((s, p) => s + p.amount, 0);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "apercu", label: "Aperçu", icon: "bar-chart-2" },
    { id: "entreprises", label: "Entreprises", icon: "briefcase" },
    { id: "utilisateurs", label: "Utilisateurs", icon: "users" },
    { id: "villes", label: "Villes", icon: "map-pin" },
    { id: "paiements", label: "Paiements", icon: "credit-card" },
    { id: "statistiques", label: "Statistiques", icon: "trending-up" },
  ];

  return (
    <View style={[S.container, { paddingTop: topPad }]}>
      <LinearGradient colors={["#7C3AED", "#5B21B6"]} style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Super Admin</Text>
          <Text style={S.headerSub}>GoBooking · Côte d'Ivoire</Text>
        </View>
        <View style={S.roleBadge}>
          <Feather name="shield" size={13} color="white" />
          <Text style={S.roleBadgeText}>Super Admin</Text>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabBar} contentContainerStyle={S.tabBarContent}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[S.tab, activeTab === tab.id && S.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Feather name={tab.icon as never} size={13} color={activeTab === tab.id ? "#7C3AED" : "#94A3B8"} />
            <Text style={[S.tabText, activeTab === tab.id && S.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* ── Aperçu ── */}
        {activeTab === "apercu" && (<>
          <View style={S.revenueCard}>
            <LinearGradient colors={["#7C3AED", "#5B21B6"]} style={S.revenueGradient}>
              <Text style={S.revenueLabel}>Revenu total de la plateforme</Text>
              <Text style={S.revenueValue}>{(stats.totalRevenue / 1_000_000).toFixed(1)} M FCFA</Text>
              <Text style={S.revenueSub}>Cumulé depuis le lancement</Text>
            </LinearGradient>
          </View>
          <View style={S.statsGrid}>
            {[
              { icon: "users",       label: "Utilisateurs",  value: stats.totalUsers.toLocaleString(),    color: PRIMARY,    bg: "#EEF2FF" },
              { icon: "briefcase",   label: "Entreprises",   value: stats.totalCompanies,                 color: "#D97706",  bg: "#FFFBEB" },
              { icon: "user",        label: "Agents",        value: stats.totalAgents,                    color: "#059669",  bg: "#ECFDF5" },
              { icon: "navigation",  label: "Trajets",       value: stats.totalTrips.toLocaleString(),    color: "#0891B2",  bg: "#ECFEFF" },
              { icon: "package",     label: "Colis",         value: stats.totalParcels.toLocaleString(),  color: "#6D28D9",  bg: "#F5F3FF" },
              { icon: "bookmark",    label: "Réservations",  value: stats.totalBookings.toLocaleString(), color: "#DC2626",  bg: "#FEF2F2" },
              { icon: "map-pin",     label: "Villes",        value: stats.totalCities,                    color: "#0F766E",  bg: "#F0FDFA" },
              { icon: "credit-card", label: "Modes paiement",value: "4 actifs",                          color: "#9333EA",  bg: "#FAF5FF" },
            ].map((c, i) => (
              <View key={i} style={[S.statCard, { borderLeftColor: c.color }]}>
                <View style={[S.statIcon, { backgroundColor: c.bg }]}><Feather name={c.icon as never} size={15} color={c.color} /></View>
                <Text style={S.statValue}>{c.value}</Text>
                <Text style={S.statLabel}>{c.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[S.sectionTitle, { marginTop: 4 }]}>Derniers inscrits</Text>
          {stats.recentUsers.map(u => {
            const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.user;
            return (
              <View key={u.id} style={S.listCard}>
                <View style={S.userAvatar}><Text style={S.userAvatarText}>{u.name.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.listTitle}>{u.name}</Text>
                  <Text style={S.listSub}>{u.email}</Text>
                </View>
                <View style={[S.badge, { backgroundColor: rs.bg }]}><Text style={[S.badgeText, { color: rs.color }]}>{rs.label}</Text></View>
              </View>
            );
          })}
        </>)}

        {/* ── Entreprises ── */}
        {activeTab === "entreprises" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Entreprises ({companies.length})</Text>
            <TouchableOpacity style={S.addBtn} onPress={() => setAddCompanyModal(true)} activeOpacity={0.8}>
              <Feather name="plus" size={14} color="white" /><Text style={S.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {companies.map(company => (
            <View key={company.id} style={S.listCard}>
              <View style={[S.companyIcon]}><Feather name="briefcase" size={18} color="#7C3AED" /></View>
              <View style={{ flex: 1 }}>
                <Text style={S.listTitle}>{company.name}</Text>
                <Text style={S.listSub}>{company.email}</Text>
                <Text style={S.listSub}>{company.city} · {company.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => toggleCompanyStatus(company.id)} activeOpacity={0.8}>
                <View style={[S.badge, { backgroundColor: company.status === "active" ? "#ECFDF5" : "#FEF2F2" }]}>
                  <Text style={[S.badgeText, { color: company.status === "active" ? "#065F46" : "#DC2626" }]}>
                    {company.status === "active" ? "Actif" : "Inactif"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </>)}

        {/* ── Utilisateurs ── */}
        {activeTab === "utilisateurs" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Utilisateurs ({users.length})</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {(["all", "user", "agent", "company_admin", "admin"] as const).map(f => (
              <Pressable key={f} style={[S.filterChip, roleFilter === f && S.filterChipActive]} onPress={() => setRoleFilter(f)}>
                <Text style={[S.filterChipText, roleFilter === f && S.filterChipTextActive]}>
                  {f === "all" ? "Tous" : f === "user" ? "Clients" : f === "agent" ? "Agents" : f === "company_admin" ? "Entreprises" : "Admins"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {filteredUsers.map(u => {
            const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.user;
            return (
              <View key={u.id} style={S.listCard}>
                <View style={S.userAvatar}><Text style={S.userAvatarText}>{u.name.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.listTitle}>{u.name}</Text>
                  <Text style={S.listSub}>{u.email}</Text>
                  {u.createdAt && <Text style={S.listSub}>Inscrit le {u.createdAt.split("T")[0]}</Text>}
                </View>
                <View style={[S.badge, { backgroundColor: rs.bg }]}><Text style={[S.badgeText, { color: rs.color }]}>{rs.label}</Text></View>
              </View>
            );
          })}
        </>)}

        {/* ── Villes ── */}
        {activeTab === "villes" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Villes desservies ({cities.length})</Text>
            <TouchableOpacity style={S.addBtn} onPress={() => setAddCityModal(true)} activeOpacity={0.8}>
              <Feather name="plus" size={14} color="white" /><Text style={S.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          <View style={S.citiesGrid}>
            {cities.map(city => (
              <View key={city.id} style={S.cityChip}>
                <Feather name="map-pin" size={12} color="#7C3AED" />
                <View>
                  <Text style={S.cityName}>{city.name}</Text>
                  {city.region && <Text style={S.cityRegion}>{city.region}</Text>}
                </View>
              </View>
            ))}
          </View>
        </>)}

        {/* ── Paiements ── */}
        {activeTab === "paiements" && (<>
          <View style={S.revenueSmallCard}>
            <Text style={S.revenueSmallLabel}>Total des transactions</Text>
            <Text style={S.revenueSmallValue}>{payTotal.toLocaleString()} FCFA</Text>
            <Text style={S.revenueSmallSub}>{filteredPayments.length} transaction{filteredPayments.length > 1 ? "s" : ""}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {(["all", "booking", "parcel"] as const).map(f => (
              <Pressable key={f} style={[S.filterChip, payFilter === f && S.filterChipActive]} onPress={() => setPayFilter(f)}>
                <Text style={[S.filterChipText, payFilter === f && S.filterChipTextActive]}>
                  {f === "all" ? "Tous" : f === "booking" ? "Réservations" : "Colis"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredPayments.map(pay => {
            const m = METHOD_STYLE[pay.method] ?? METHOD_STYLE.orange;
            return (
              <View key={pay.id} style={S.payCard}>
                <View style={[S.payMethodIcon, { backgroundColor: m.bg }]}>
                  <Feather name="credit-card" size={16} color={m.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.payRef}>{pay.refId}</Text>
                  <Text style={S.listSub}>{m.label} · {pay.refType === "booking" ? "Réservation" : "Colis"}</Text>
                  <Text style={S.listSub}>{pay.createdAt ? new Date(pay.createdAt).toLocaleDateString("fr-FR") : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 5 }}>
                  <Text style={[S.payAmount, { color: pay.status === "refunded" ? "#DC2626" : "#059669" }]}>
                    {pay.status === "refunded" ? "-" : "+"}{pay.amount.toLocaleString()} F
                  </Text>
                  <View style={[S.badge, { backgroundColor: pay.status === "paid" ? "#ECFDF5" : "#FEF2F2" }]}>
                    <Text style={[S.badgeText, { color: pay.status === "paid" ? "#065F46" : "#DC2626" }]}>
                      {pay.status === "paid" ? "Payé" : "Remboursé"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>)}

        {/* ── Statistiques ── */}
        {activeTab === "statistiques" && (<>
          <Text style={S.sectionTitle}>Répartition des revenus</Text>
          <Text style={S.subLabel}>Par mode de paiement</Text>
          {PAYMENT_METHODS_STATS.map(pm => (
            <View key={pm.key} style={S.statBarCard}>
              <View style={[S.statBarIcon, { backgroundColor: pm.bg }]}><Feather name="credit-card" size={16} color={pm.color} /></View>
              <View style={{ flex: 1, gap: 5 }}>
                <View style={S.statBarTop}>
                  <Text style={S.statBarName}>{pm.name}</Text>
                  <Text style={S.statBarPct}>{pm.pct}%</Text>
                </View>
                <View style={S.barBg}>
                  <View style={[S.barFill, { width: `${pm.pct}%` as any, backgroundColor: pm.color }]} />
                </View>
                <Text style={S.statBarAmount}>{(pm.amount / 1_000_000).toFixed(1)} M FCFA</Text>
              </View>
            </View>
          ))}

          <Text style={[S.sectionTitle, { marginTop: 8 }]}>Répartition des transactions</Text>
          <View style={S.pieRow}>
            {[
              { label: "Réservations", value: stats.totalBookings, color: PRIMARY, bg: "#EEF2FF" },
              { label: "Colis", value: stats.totalParcels, color: "#D97706", bg: "#FFFBEB" },
            ].map(item => (
              <View key={item.label} style={[S.pieCard, { borderLeftColor: item.color }]}>
                <View style={[S.pieCircle, { backgroundColor: item.bg }]}>
                  <Text style={[S.pieNum, { color: item.color }]}>{item.value.toLocaleString()}</Text>
                </View>
                <Text style={S.pieLabel}>{item.label}</Text>
                <Text style={S.piePct}>{Math.round((item.value / (stats.totalBookings + stats.totalParcels)) * 100)}%</Text>
              </View>
            ))}
          </View>

          <Text style={[S.sectionTitle, { marginTop: 8 }]}>Routes les plus actives</Text>
          {[
            { from: "Abidjan", to: "Bouaké", trips: 584, pct: 32 },
            { from: "Abidjan", to: "Yamoussoukro", trips: 422, pct: 23 },
            { from: "Abidjan", to: "Korhogo", trips: 348, pct: 19 },
            { from: "San Pedro", to: "Abidjan", trips: 312, pct: 17 },
            { from: "Bouaké", to: "Korhogo", trips: 168, pct: 9 },
          ].map((r, i) => (
            <View key={i} style={S.routeStatCard}>
              <Text style={S.routeStatRank}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.routeStatName}>{r.from} → {r.to}</Text>
                <View style={S.barBg}>
                  <View style={[S.barFill, { width: `${r.pct * 3}%` as any, backgroundColor: PRIMARY }]} />
                </View>
              </View>
              <Text style={S.routeStatTrips}>{r.trips} trajets</Text>
            </View>
          ))}
        </>)}

      </ScrollView>

      {/* Add City Modal */}
      <Modal visible={addCityModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Ajouter une ville</Text>
            <TextInput style={S.modalInput} placeholder="Nom de la ville" value={newCity.name} onChangeText={v => setNewCity(p => ({ ...p, name: v }))} />
            <TextInput style={S.modalInput} placeholder="Région" value={newCity.region} onChangeText={v => setNewCity(p => ({ ...p, region: v }))} />
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setAddCityModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: "#7C3AED" }]} onPress={() => {
                if (!newCity.name) return;
                setCities(prev => [...prev, { id: Date.now().toString(), name: newCity.name, region: newCity.region }]);
                setStats(s => ({ ...s, totalCities: s.totalCities + 1 }));
                setAddCityModal(false);
                setNewCity({ name: "", region: "" });
              }}><Text style={S.modalConfirmText}>Ajouter</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Company Modal */}
      <Modal visible={addCompanyModal} transparent animationType="slide">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Ajouter une entreprise</Text>
            <TextInput style={S.modalInput} placeholder="Nom de l'entreprise" value={newCompany.name} onChangeText={v => setNewCompany(p => ({ ...p, name: v }))} />
            <TextInput style={S.modalInput} placeholder="Email" keyboardType="email-address" value={newCompany.email} onChangeText={v => setNewCompany(p => ({ ...p, email: v }))} />
            <TextInput style={S.modalInput} placeholder="Téléphone" keyboardType="phone-pad" value={newCompany.phone} onChangeText={v => setNewCompany(p => ({ ...p, phone: v }))} />
            <TextInput style={S.modalInput} placeholder="Ville" value={newCompany.city} onChangeText={v => setNewCompany(p => ({ ...p, city: v }))} />
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setAddCompanyModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: "#7C3AED" }]} onPress={() => {
                if (!newCompany.name || !newCompany.email) return;
                setCompanies(prev => [...prev, { id: Date.now().toString(), ...newCompany, status: "active" }]);
                setStats(s => ({ ...s, totalCompanies: s.totalCompanies + 1 }));
                setAddCompanyModal(false);
                setNewCompany({ name: "", email: "", phone: "", city: "" });
              }}><Text style={S.modalConfirmText}>Créer</Text></Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 1 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  tabBar: { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", maxHeight: 52 },
  tabBarContent: { paddingHorizontal: 10, gap: 2, alignItems: "center" },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#7C3AED" },
  tabText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  tabTextActive: { color: "#7C3AED", fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  subLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  revenueCard: { borderRadius: 20, overflow: "hidden" },
  revenueGradient: { padding: 22, gap: 4, alignItems: "center" },
  revenueLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  revenueValue: { fontSize: 32, fontFamily: "Inter_700Bold", color: "white" },
  revenueSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  revenueSmallCard: { backgroundColor: "#F5F3FF", borderRadius: 16, padding: 16, alignItems: "center", gap: 2 },
  revenueSmallLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6D28D9" },
  revenueSmallValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#7C3AED" },
  revenueSmallSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", backgroundColor: "white", borderRadius: 14, padding: 14, borderLeftWidth: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 4 },
  statIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#7C3AED", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  listCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  listTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  listSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  userAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  userAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  companyIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center", flexShrink: 0 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "white" },
  filterChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B" },
  filterChipTextActive: { color: "white", fontFamily: "Inter_700Bold" },
  citiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cityChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "white", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cityName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  cityRegion: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  payCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  payMethodIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  payRef: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  payAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statBarCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  statBarIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  statBarTop: { flexDirection: "row", justifyContent: "space-between" },
  statBarName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  statBarPct: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#64748B" },
  barBg: { height: 6, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 4 },
  statBarAmount: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  pieRow: { flexDirection: "row", gap: 12 },
  pieCard: { flex: 1, backgroundColor: "white", borderRadius: 16, padding: 16, alignItems: "center", gap: 8, borderLeftWidth: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  pieCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: "center", alignItems: "center" },
  pieNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  pieLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  piePct: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#94A3B8" },
  routeStatCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  routeStatRank: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#CBD5E1", width: 28 },
  routeStatName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A", marginBottom: 5 },
  routeStatTrips: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 4 },
  modalInput: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#0F172A" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  modalConfirm: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalConfirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
});
