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

/* ─── Types ─────────────────────────────────────────────── */
interface GlobalStats { totalUsers: number; totalCompanies: number; totalAgents: number; totalTrips: number; totalParcels: number; totalBookings: number; totalRevenue: number; totalCities: number; recentUsers: { id: string; name: string; email: string; role: string }[] }
interface Company { id: string; name: string; email: string; phone: string; city: string; status: string }
interface UserItem { id: string; name: string; email: string; phone?: string; role: string; status?: string; createdAt?: string }
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
  { id: "u1", name: "Ama Koné",      email: "ama.kone@gmail.com",      phone: "+225 07 12 34 56", role: "user",         status: "active",   createdAt: "2026-03-15" },
  { id: "u2", name: "Mamadou Traoré",email: "m.traore@gmail.com",       phone: "+225 05 98 76 54", role: "user",         status: "active",   createdAt: "2026-03-14" },
  { id: "u3", name: "Bamba Koffi",   email: "b.koffi@sotral.ci",        phone: "+225 27 44 11 00", role: "compagnie",    status: "active",   createdAt: "2026-03-10" },
  { id: "u4", name: "Mariam Diallo", email: "diallo@gobooking.com",      phone: "+225 05 55 22 33", role: "agent",        status: "active",   createdAt: "2026-03-08" },
  { id: "u5", name: "Super Admin",   email: "admin@gobooking.com",       phone: "+225 01 00 00 01", role: "admin",        status: "active",   createdAt: "2026-01-01" },
  { id: "u6", name: "Kouassi Jean",  email: "kouassi.jean@sotral.ci",    phone: "+225 07 88 99 11", role: "agent",        status: "inactive", createdAt: "2026-03-01" },
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
  client:        { label: "Client",      color: PRIMARY,   bg: "#EEF2FF" },
  company_admin: { label: "Compagnie",   color: "#D97706", bg: "#FFFBEB" },
  compagnie:     { label: "Compagnie",   color: "#D97706", bg: "#FFFBEB" },
  agent:         { label: "Agent",       color: "#059669", bg: "#ECFDF5" },
  admin:         { label: "Admin",       color: "#7C3AED", bg: "#F5F3FF" },
  super_admin:   { label: "Admin",       color: "#7C3AED", bg: "#F5F3FF" },
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
  const [addUserModal, setAddUserModal] = useState(false);
  const [newCity, setNewCity] = useState({ name: "", region: "" });
  const [newCompany, setNewCompany] = useState({ name: "", email: "", phone: "", city: "" });
  const [newStaff, setNewStaff] = useState({ name: "", email: "", phone: "", password: "", role: "agent" as "agent" | "compagnie" | "admin" });
  const [staffCreating, setStaffCreating] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [provisionalCreds, setProvisionalCreds] = useState<{ name: string; email: string; role: string; password: string } | null>(null);
  const [payFilter, setPayFilter] = useState<"all" | "booking" | "parcel">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editUserModal, setEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", role: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [actionMenuUser, setActionMenuUser] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "deactivate" | "activate"; user: UserItem } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [resetPwdResult, setResetPwdResult] = useState<{ name: string; email: string; password: string } | null>(null);

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

  const createStaffAccount = async () => {
    setStaffError("");
    if (!newStaff.name.trim()) { setStaffError("Le nom est requis."); return; }
    if (!newStaff.email.trim() || !newStaff.email.includes("@")) { setStaffError("Email invalide."); return; }
    setStaffCreating(true);
    try {
      const body: Record<string, string> = {
        name: newStaff.name.trim(),
        email: newStaff.email.trim().toLowerCase(),
        role: newStaff.role,
      };
      if (newStaff.phone.trim()) body.phone = newStaff.phone.trim();
      if (newStaff.password.trim()) body.password = newStaff.password.trim();
      const res = await apiFetch<{ user: UserItem; provisionalPassword: string }>(
        "/superadmin/users",
        { token: token || "", method: "POST", body }
      );
      setUsers(prev => [{ ...res.user, createdAt: res.user.createdAt || new Date().toISOString() }, ...prev]);
      setProvisionalCreds({ name: res.user.name, email: res.user.email, role: res.user.role, password: res.provisionalPassword });
      setNewStaff({ name: "", email: "", phone: "", password: "", role: "agent" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Échec de la création";
      setStaffError(msg);
    } finally {
      setStaffCreating(false);
    }
  };

  const openEditUser = (u: UserItem) => {
    setSelectedUser(u);
    setEditForm({ name: u.name, email: u.email, phone: u.phone || "", role: u.role });
    setEditError("");
    setActionMenuUser(null);
    setEditUserModal(true);
  };

  const saveEditUser = async () => {
    if (!selectedUser) return;
    setEditError("");
    if (!editForm.name.trim()) { setEditError("Le nom est requis."); return; }
    if (!editForm.email.includes("@")) { setEditError("Email invalide."); return; }
    setEditLoading(true);
    try {
      const updated = await apiFetch<UserItem>(
        `/superadmin/users/${selectedUser.id}`,
        { token: token || "", method: "PATCH", body: { name: editForm.name.trim(), email: editForm.email.trim(), phone: editForm.phone.trim(), role: editForm.role } }
      );
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
      setEditUserModal(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Échec de la modification");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmAction) return;
    const { user, type } = confirmAction;
    const newStatus = type === "deactivate" ? "inactive" : "active";
    setConfirmLoading(true);
    try {
      await apiFetch(`/superadmin/users/${user.id}/status`, { token: token || "", method: "PATCH", body: { status: newStatus } });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      setConfirmAction(null);
    } catch {
      setConfirmAction(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    setConfirmLoading(true);
    try {
      await apiFetch(`/superadmin/users/${confirmAction.user.id}`, { token: token || "", method: "DELETE" });
      setUsers(prev => prev.filter(u => u.id !== confirmAction.user.id));
      setConfirmAction(null);
    } catch {
      setConfirmAction(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleResetPassword = async (u: UserItem) => {
    setActionMenuUser(null);
    try {
      const res = await apiFetch<{ provisionalPassword: string; email: string; name: string }>(
        `/superadmin/users/${u.id}/reset-password`,
        { token: token || "", method: "POST" }
      );
      setResetPwdResult({ name: res.name, email: res.email, password: res.provisionalPassword });
    } catch (err) {
      console.error("Reset pwd error:", err);
    }
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
            <View>
              <Text style={S.sectionTitle}>Gestion des utilisateurs</Text>
              <Text style={S.subLabel}>{users.length} compte{users.length > 1 ? "s" : ""} enregistré{users.length > 1 ? "s" : ""}</Text>
            </View>
            <TouchableOpacity style={S.addBtn} onPress={() => { setAddUserModal(true); setProvisionalCreds(null); setStaffError(""); setNewStaff({ name: "", email: "", phone: "", password: "", role: "agent" }); }} activeOpacity={0.8}>
              <Feather name="user-plus" size={14} color="white" /><Text style={S.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {[
              { f: "all",        label: "Tous",       count: users.length },
              { f: "client",     label: "Clients",    count: users.filter(u => u.role === "client" || u.role === "user").length },
              { f: "agent",      label: "Agents",     count: users.filter(u => u.role === "agent").length },
              { f: "compagnie",  label: "Compagnies", count: users.filter(u => u.role === "compagnie" || u.role === "company_admin").length },
              { f: "admin",      label: "Admins",     count: users.filter(u => u.role === "admin" || u.role === "super_admin").length },
            ].map(({ f, label, count }) => (
              <Pressable key={f} style={[S.filterChip, roleFilter === f && S.filterChipActive]} onPress={() => setRoleFilter(f)}>
                <Text style={[S.filterChipText, roleFilter === f && S.filterChipTextActive]}>{label} ({count})</Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredUsers.map(u => {
            const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.user;
            const isActive = !u.status || u.status === "active";
            const menuOpen = actionMenuUser === u.id;
            return (
              <View key={u.id} style={[S.userCard, !isActive && S.userCardInactive]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[S.userAvatar, { backgroundColor: rs.color }]}>
                    <Text style={S.userAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[S.listTitle, !isActive && { color: "#94A3B8" }]}>{u.name}</Text>
                      <View style={[S.badge, { backgroundColor: rs.bg }]}>
                        <Text style={[S.badgeText, { color: rs.color }]}>{rs.label}</Text>
                      </View>
                    </View>
                    <Text style={S.listSub}>{u.email}</Text>
                    {u.phone ? <Text style={S.listSub}>{u.phone}</Text> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <View style={[S.statusDot, { backgroundColor: isActive ? "#10B981" : "#EF4444" }]} />
                      <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: isActive ? "#059669" : "#DC2626" }}>
                        {isActive ? "Actif" : "Désactivé"}
                      </Text>
                      {u.createdAt && (
                        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#CBD5E1" }}>
                          · Créé le {u.createdAt.split("T")[0]}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={S.actionMenuBtn}
                    onPress={() => setActionMenuUser(menuOpen ? null : u.id)}
                    activeOpacity={0.7}
                  >
                    <Feather name="more-vertical" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {menuOpen && (
                  <View style={S.actionMenu}>
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => openEditUser(u)} activeOpacity={0.7}>
                      <Feather name="edit-2" size={14} color="#1A56DB" />
                      <Text style={[S.actionMenuText, { color: "#1A56DB" }]}>Modifier</Text>
                    </TouchableOpacity>
                    <View style={S.actionMenuDivider} />
                    <TouchableOpacity
                      style={S.actionMenuItem}
                      onPress={() => { setActionMenuUser(null); setConfirmAction({ type: isActive ? "deactivate" : "activate", user: u }); }}
                      activeOpacity={0.7}
                    >
                      <Feather name={isActive ? "pause-circle" : "play-circle"} size={14} color={isActive ? "#D97706" : "#059669"} />
                      <Text style={[S.actionMenuText, { color: isActive ? "#D97706" : "#059669" }]}>
                        {isActive ? "Désactiver" : "Réactiver"}
                      </Text>
                    </TouchableOpacity>
                    <View style={S.actionMenuDivider} />
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => handleResetPassword(u)} activeOpacity={0.7}>
                      <Feather name="refresh-cw" size={14} color="#7C3AED" />
                      <Text style={[S.actionMenuText, { color: "#7C3AED" }]}>Réinitialiser MDP</Text>
                    </TouchableOpacity>
                    <View style={S.actionMenuDivider} />
                    <TouchableOpacity
                      style={S.actionMenuItem}
                      onPress={() => { setActionMenuUser(null); setConfirmAction({ type: "delete", user: u }); }}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={14} color="#DC2626" />
                      <Text style={[S.actionMenuText, { color: "#DC2626" }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                )}
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

      {/* ── Modal Créer un compte Staff ── */}
      <Modal visible={addUserModal} transparent animationType="slide">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.modalOverlay}>
          <View style={S.modalCard}>
            {provisionalCreds ? (
              /* ── Affichage des identifiants provisoires ── */
              <>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center", marginBottom: 10 }}>
                    <Feather name="check-circle" size={28} color="#059669" />
                  </View>
                  <Text style={[S.modalTitle, { textAlign: "center" }]}>Compte créé avec succès</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 4 }}>
                    Communiquez ces identifiants provisoires à l'utilisateur
                  </Text>
                </View>
                <View style={{ backgroundColor: "#F8FAFC", borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 }}>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Nom</Text>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0F172A" }}>{provisionalCreds.name}</Text>
                  </View>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Email (identifiant)</Text>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1A56DB" }}>{provisionalCreds.email}</Text>
                  </View>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Mot de passe provisoire</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ flex: 1, backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#FDE68A" }}>
                        <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#92400E", letterSpacing: 2 }}>{provisionalCreds.password}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Rôle attribué</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {(() => { const rs = ROLE_STYLE[provisionalCreds.role] ?? ROLE_STYLE.agent; return (
                        <View style={{ backgroundColor: rs.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: rs.color }}>{rs.label}</Text>
                        </View>
                      ); })()}
                    </View>
                  </View>
                </View>
                <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" }}>
                  <Feather name="alert-triangle" size={14} color="#DC2626" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626" }}>
                    Notez ce mot de passe maintenant. Il ne sera plus affiché après fermeture de cette fenêtre.
                  </Text>
                </View>
                <Pressable style={[S.modalConfirm, { backgroundColor: "#7C3AED" }]} onPress={() => { setAddUserModal(false); setProvisionalCreds(null); }}>
                  <Text style={S.modalConfirmText}>Fermer</Text>
                </Pressable>
              </>
            ) : (
              /* ── Formulaire de création ── */
              <>
                <Text style={S.modalTitle}>Créer un compte</Text>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", marginBottom: 16 }}>
                  Réservé aux rôles Agent, Compagnie et Admin
                </Text>
                {!!staffError && (
                  <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
                    <Feather name="alert-circle" size={13} color="#DC2626" />
                    <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" }}>{staffError}</Text>
                  </View>
                )}
                <TextInput
                  style={S.modalInput}
                  placeholder="Nom complet *"
                  value={newStaff.name}
                  onChangeText={v => { setNewStaff(p => ({ ...p, name: v })); setStaffError(""); }}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[S.modalInput, { marginTop: 10 }]}
                  placeholder="Email *"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={newStaff.email}
                  onChangeText={v => { setNewStaff(p => ({ ...p, email: v })); setStaffError(""); }}
                />
                <TextInput
                  style={[S.modalInput, { marginTop: 10 }]}
                  placeholder="Téléphone (optionnel)"
                  keyboardType="phone-pad"
                  value={newStaff.phone}
                  onChangeText={v => setNewStaff(p => ({ ...p, phone: v }))}
                />
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={S.modalInput}
                    placeholder="Mot de passe provisoire (laisser vide = auto)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={newStaff.password}
                    onChangeText={v => setNewStaff(p => ({ ...p, password: v }))}
                  />
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 4 }}>
                    Laissez vide pour générer automatiquement un mot de passe sécurisé (format GB…)
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A", marginTop: 14, marginBottom: 8 }}>Type de compte *</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {([
                    { key: "agent",     label: "Agent",     icon: "briefcase", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
                    { key: "compagnie", label: "Compagnie", icon: "truck",     color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
                    { key: "admin",     label: "Admin",     icon: "shield",    color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
                  ] as const).map(r => {
                    const active = newStaff.role === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        style={{ flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12, borderWidth: active ? 2 : 1.5, borderColor: active ? r.color : "#E2E8F0", backgroundColor: active ? r.bg : "#F8FAFC", gap: 4 }}
                        onPress={() => setNewStaff(p => ({ ...p, role: r.key }))}
                      >
                        <Feather name={r.icon} size={18} color={active ? r.color : "#94A3B8"} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: active ? r.color : "#64748B" }}>{r.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={S.modalBtns}>
                  <Pressable style={S.modalCancel} onPress={() => { setAddUserModal(false); setStaffError(""); setNewStaff({ name: "", email: "", role: "agent" }); }}>
                    <Text style={S.modalCancelText}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    style={[S.modalConfirm, { backgroundColor: "#7C3AED", opacity: staffCreating ? 0.7 : 1 }]}
                    onPress={createStaffAccount}
                    disabled={staffCreating}
                  >
                    {staffCreating
                      ? <ActivityIndicator size="small" color="white" />
                      : <Text style={S.modalConfirmText}>Créer le compte</Text>
                    }
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
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

      {/* ── Modal Modifier un utilisateur ── */}
      <Modal visible={editUserModal} transparent animationType="slide">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.modalOverlay}>
          <View style={S.modalCard}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginRight: 10 }}>
                <Feather name="edit-2" size={16} color="#1A56DB" />
              </View>
              <View>
                <Text style={S.modalTitle}>Modifier l'utilisateur</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>{selectedUser?.email}</Text>
              </View>
            </View>
            {!!editError && (
              <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" }}>
                <Feather name="alert-circle" size={13} color="#DC2626" />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" }}>{editError}</Text>
              </View>
            )}
            <TextInput style={S.modalInput} placeholder="Nom complet *" value={editForm.name} onChangeText={v => { setEditForm(p => ({ ...p, name: v })); setEditError(""); }} autoCapitalize="words" />
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Email *" keyboardType="email-address" autoCapitalize="none" value={editForm.email} onChangeText={v => { setEditForm(p => ({ ...p, email: v })); setEditError(""); }} />
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Téléphone" keyboardType="phone-pad" value={editForm.phone} onChangeText={v => setEditForm(p => ({ ...p, phone: v }))} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A", marginTop: 14, marginBottom: 8 }}>Rôle</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {([
                { key: "agent",     label: "Agent",     icon: "briefcase", color: "#059669", bg: "#ECFDF5" },
                { key: "compagnie", label: "Compagnie", icon: "truck",     color: "#D97706", bg: "#FFFBEB" },
                { key: "admin",     label: "Admin",     icon: "shield",    color: "#7C3AED", bg: "#F5F3FF" },
              ] as const).map(r => {
                const active = editForm.role === r.key;
                return (
                  <Pressable key={r.key} style={{ flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12, borderWidth: active ? 2 : 1.5, borderColor: active ? r.color : "#E2E8F0", backgroundColor: active ? r.bg : "#F8FAFC", gap: 4 }} onPress={() => setEditForm(p => ({ ...p, role: r.key }))}>
                    <Feather name={r.icon} size={18} color={active ? r.color : "#94A3B8"} />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: active ? r.color : "#64748B" }}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setEditUserModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: "#1A56DB", opacity: editLoading ? 0.7 : 1 }]} onPress={saveEditUser} disabled={editLoading}>
                {editLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>Enregistrer</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* ── Modal Confirmation (désactiver / supprimer) ── */}
      <Modal visible={!!confirmAction} transparent animationType="fade">
        <View style={[S.modalOverlay, { justifyContent: "center", paddingHorizontal: 24 }]}>
          <View style={[S.modalCard, { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderRadius: 20 }]}>
            {confirmAction?.type === "delete" ? (
              <>
                <View style={{ alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center" }}>
                    <Feather name="trash-2" size={22} color="#DC2626" />
                  </View>
                  <Text style={[S.modalTitle, { textAlign: "center" }]}>Supprimer le compte</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" }}>
                    Confirmez-vous la suppression définitive du compte de{"\n"}
                    <Text style={{ fontFamily: "Inter_700Bold", color: "#0F172A" }}>{confirmAction?.user.name}</Text> ?{"\n"}
                    Cette action est irréversible.
                  </Text>
                </View>
                <View style={S.modalBtns}>
                  <Pressable style={S.modalCancel} onPress={() => setConfirmAction(null)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
                  <Pressable style={[S.modalConfirm, { backgroundColor: "#DC2626", opacity: confirmLoading ? 0.7 : 1 }]} onPress={handleDeleteUser} disabled={confirmLoading}>
                    {confirmLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>Supprimer</Text>}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={{ alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: confirmAction?.type === "deactivate" ? "#FFFBEB" : "#ECFDF5", justifyContent: "center", alignItems: "center" }}>
                    <Feather name={confirmAction?.type === "deactivate" ? "pause-circle" : "play-circle"} size={22} color={confirmAction?.type === "deactivate" ? "#D97706" : "#059669"} />
                  </View>
                  <Text style={[S.modalTitle, { textAlign: "center" }]}>
                    {confirmAction?.type === "deactivate" ? "Désactiver le compte" : "Réactiver le compte"}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" }}>
                    {confirmAction?.type === "deactivate"
                      ? `Le compte de ${confirmAction?.user.name} sera suspendu. L'utilisateur ne pourra plus se connecter.`
                      : `Le compte de ${confirmAction?.user.name} sera réactivé.`}
                  </Text>
                </View>
                <View style={S.modalBtns}>
                  <Pressable style={S.modalCancel} onPress={() => setConfirmAction(null)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
                  <Pressable style={[S.modalConfirm, { backgroundColor: confirmAction?.type === "deactivate" ? "#D97706" : "#059669", opacity: confirmLoading ? 0.7 : 1 }]} onPress={handleToggleStatus} disabled={confirmLoading}>
                    {confirmLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>{confirmAction?.type === "deactivate" ? "Désactiver" : "Réactiver"}</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal Résultat Réinitialisation MDP ── */}
      <Modal visible={!!resetPwdResult} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center", marginBottom: 10 }}>
                <Feather name="refresh-cw" size={22} color="#7C3AED" />
              </View>
              <Text style={[S.modalTitle, { textAlign: "center" }]}>Mot de passe réinitialisé</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 4 }}>
                Communiquez ce nouveau mot de passe à l'utilisateur
              </Text>
            </View>
            <View style={{ backgroundColor: "#F8FAFC", borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Utilisateur</Text>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" }}>{resetPwdResult?.name}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" }}>{resetPwdResult?.email}</Text>
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Nouveau mot de passe provisoire</Text>
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#FDE68A" }}>
                  <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#92400E", letterSpacing: 3 }}>{resetPwdResult?.password}</Text>
                </View>
              </View>
            </View>
            <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
              <Feather name="alert-triangle" size={13} color="#DC2626" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#DC2626" }}>
                Notez ce mot de passe maintenant. Il ne sera plus affiché après fermeture.
              </Text>
            </View>
            <Pressable style={[S.modalConfirm, { backgroundColor: "#7C3AED" }]} onPress={() => setResetPwdResult(null)}>
              <Text style={S.modalConfirmText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
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
  userCard: { backgroundColor: "white", borderRadius: 16, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  userCardInactive: { backgroundColor: "#FAFAFA", borderColor: "#F1F5F9", borderWidth: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  actionMenuBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
  actionMenu: { marginTop: 10, backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  actionMenuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  actionMenuDivider: { height: 1, backgroundColor: "#E2E8F0" },
  actionMenuText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
