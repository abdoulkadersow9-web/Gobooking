import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
const PURPLE  = "#7C3AED";

/* ─── Types ─────────────────────────────────────────────────────── */
interface GlobalStats { totalUsers: number; totalCompanies: number; totalAgents: number; totalTrips: number; totalParcels: number; totalBookings: number; totalRevenue: number; totalCities: number; recentUsers: { id: string; name: string; email: string; role: string }[] }
interface Company  { id: string; name: string; email: string; phone: string; city: string; status: string }
interface UserItem { id: string; name: string; email: string; phone?: string; role: string; status?: string; createdAt?: string }
interface CityItem { id: string; name: string; region: string }
interface PaymentItem { id: string; refId: string; refType: string; amount: number; method: string; status: string; createdAt: string }
interface TripItem  { id: string; from: string; to: string; date: string; departureTime: string; arrivalTime: string; price: number; busType: string; busName: string; totalSeats: number; duration: string; status: string }
interface BookingItem { id: string; bookingRef: string; tripId: string; totalAmount: number; paymentMethod: string; status: string; contactEmail?: string; contactPhone?: string; passengers?: { name: string }[]; seatNumbers?: string[]; createdAt: string }
interface CommissionSettings { type: "percentage" | "fixed"; value: number }
interface DailyCommission { date: string; amount: number }
interface CompanyCommission { name: string; commission: number; bookings: number; revenue: number }
interface RevenueData { totalCommission: number; totalRevenue: number; dailyCommissions: DailyCommission[]; byCompany: CompanyCommission[]; settings: CommissionSettings }

/* ─── Demo data ──────────────────────────────────────────────────── */
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
  { id: "u1", name: "Ama Koné",       email: "ama.kone@gmail.com",   phone: "+225 07 12 34 56", role: "user",      status: "active",   createdAt: "2026-03-15" },
  { id: "u2", name: "Mamadou Traoré", email: "m.traore@gmail.com",   phone: "+225 05 98 76 54", role: "user",      status: "active",   createdAt: "2026-03-14" },
  { id: "u3", name: "Bamba Koffi",    email: "b.koffi@sotral.ci",    phone: "+225 27 44 11 00", role: "compagnie", status: "active",   createdAt: "2026-03-10" },
  { id: "u4", name: "Mariam Diallo",  email: "diallo@gobooking.com", phone: "+225 05 55 22 33", role: "agent",     status: "active",   createdAt: "2026-03-08" },
  { id: "u5", name: "Super Admin",    email: "admin@gobooking.com",  phone: "+225 01 00 00 01", role: "admin",     status: "active",   createdAt: "2026-01-01" },
  { id: "u6", name: "Kouassi Jean",   email: "kouassi.jean@sotral.ci",phone: "+225 07 88 99 11", role: "agent",    status: "inactive", createdAt: "2026-03-01" },
];
const DEMO_CITIES: CityItem[] = [
  { id: "ct1", name: "Abidjan", region: "Lagunes" }, { id: "ct2", name: "Bouaké", region: "Vallée du Bandama" },
  { id: "ct3", name: "Yamoussoukro", region: "Yamoussoukro" }, { id: "ct4", name: "Korhogo", region: "Savanes" },
  { id: "ct5", name: "San Pedro", region: "Bas-Sassandra" }, { id: "ct6", name: "Daloa", region: "Haut-Sassandra" },
  { id: "ct7", name: "Man", region: "Montagnes" }, { id: "ct8", name: "Gagnoa", region: "Gôh" },
  { id: "ct9", name: "Divo", region: "Gôh" }, { id: "ct10", name: "Abengourou", region: "Indénié-Djuablin" },
  { id: "ct11", name: "Bondoukou", region: "Gontougo" }, { id: "ct12", name: "Odienné", region: "Kabadougou" },
];
const DEMO_PAYMENTS: PaymentItem[] = [
  { id: "pay1", refId: "GBB5AKZ8DZ",   refType: "booking", amount: 7000,  method: "orange", status: "paid",     createdAt: "2026-03-17T08:00:00Z" },
  { id: "pay2", refId: "GBX-A4F2-KM91",refType: "parcel",  amount: 4700,  method: "mtn",    status: "paid",     createdAt: "2026-03-17T07:45:00Z" },
  { id: "pay3", refId: "GBB9MNX2PL",   refType: "booking", amount: 3500,  method: "wave",   status: "paid",     createdAt: "2026-03-16T15:30:00Z" },
  { id: "pay4", refId: "GBX-C1E7-QR22",refType: "parcel",  amount: 3500,  method: "orange", status: "paid",     createdAt: "2026-03-16T14:00:00Z" },
  { id: "pay5", refId: "GBBA1C3RQ7",   refType: "booking", amount: 4000,  method: "visa",   status: "paid",     createdAt: "2026-03-15T11:00:00Z" },
  { id: "pay6", refId: "GBX-D5F8-MN33",refType: "parcel",  amount: 8100,  method: "mtn",    status: "paid",     createdAt: "2026-03-15T10:00:00Z" },
  { id: "pay7", refId: "GBB7FPV6NM",   refType: "booking", amount: 6000,  method: "orange", status: "paid",     createdAt: "2026-03-14T09:00:00Z" },
  { id: "pay8", refId: "GBBC5XK0TZ",   refType: "booking", amount: 2000,  method: "wave",   status: "refunded", createdAt: "2026-03-13T16:00:00Z" },
];
const DEMO_TRIPS: TripItem[] = [
  { id: "t1", from: "Abidjan", to: "Bouaké",        date: "2026-03-18", departureTime: "06:00", arrivalTime: "12:00", price: 7000,  busType: "VIP",      busName: "SOTRAL Express", totalSeats: 44, duration: "6h",    status: "scheduled"   },
  { id: "t2", from: "Abidjan", to: "Yamoussoukro",  date: "2026-03-18", departureTime: "07:30", arrivalTime: "11:30", price: 5000,  busType: "Standard", busName: "UTB Line",       totalSeats: 55, duration: "4h",    status: "in_progress" },
  { id: "t3", from: "Abidjan", to: "Korhogo",       date: "2026-03-17", departureTime: "05:00", arrivalTime: "15:00", price: 12000, busType: "VIP",      busName: "Trans Ivoire",   totalSeats: 40, duration: "10h",   status: "completed"   },
  { id: "t4", from: "San Pedro", to: "Abidjan",     date: "2026-03-18", departureTime: "08:00", arrivalTime: "14:30", price: 6500,  busType: "Standard", busName: "Confort Bus",    totalSeats: 55, duration: "6h30",  status: "scheduled"   },
  { id: "t5", from: "Bouaké", to: "Korhogo",        date: "2026-03-19", departureTime: "09:00", arrivalTime: "14:00", price: 5500,  busType: "Standard", busName: "Express du Nord",totalSeats: 44, duration: "5h",    status: "scheduled"   },
  { id: "t6", from: "Abidjan", to: "Daloa",         date: "2026-03-17", departureTime: "06:30", arrivalTime: "13:30", price: 8000,  busType: "VIP",      busName: "Voyage Plus",    totalSeats: 40, duration: "7h",    status: "completed"   },
];
const DEMO_BOOKINGS: BookingItem[] = [
  { id: "b1", bookingRef: "GBB5AKZ8DZ",  tripId: "t1", totalAmount: 14000, paymentMethod: "orange", status: "confirmed", contactEmail: "ama.kone@gmail.com",   contactPhone: "+225 07 12 34 56", passengers: [{ name: "Ama Koné" }, { name: "Koné Jr" }],    seatNumbers: ["A1","A2"], createdAt: "2026-03-17T08:00:00Z" },
  { id: "b2", bookingRef: "GBB9MNX2PL",  tripId: "t2", totalAmount: 5000,  paymentMethod: "wave",   status: "confirmed", contactEmail: "m.traore@gmail.com",    contactPhone: "+225 05 98 76 54", passengers: [{ name: "Mamadou Traoré" }],                   seatNumbers: ["B4"],      createdAt: "2026-03-16T15:30:00Z" },
  { id: "b3", bookingRef: "GBBA1C3RQ7",  tripId: "t4", totalAmount: 13000, paymentMethod: "mtn",    status: "pending",   contactEmail: "jean.c@gmail.com",      contactPhone: "+225 07 88 77 66", passengers: [{ name: "Jean Coulibaly" }, { name: "Marie K." }],seatNumbers: ["C1","C2"], createdAt: "2026-03-17T06:00:00Z" },
  { id: "b4", bookingRef: "GBB7FPV6NM",  tripId: "t1", totalAmount: 7000,  paymentMethod: "orange", status: "confirmed", contactEmail: "kouassi@gmail.com",     contactPhone: "+225 05 44 33 22", passengers: [{ name: "Kouassi Yao" }],                      seatNumbers: ["D3"],      createdAt: "2026-03-17T09:00:00Z" },
  { id: "b5", bookingRef: "GBBC5XK0TZ",  tripId: "t3", totalAmount: 12000, paymentMethod: "visa",   status: "cancelled", contactEmail: "mariama@gmail.com",     contactPhone: "+225 07 11 22 33", passengers: [{ name: "Mariama Bah" }],                      seatNumbers: ["A5"],      createdAt: "2026-03-16T10:00:00Z" },
  { id: "b6", bookingRef: "GBB3HK7PQR",  tripId: "t5", totalAmount: 11000, paymentMethod: "orange", status: "pending",   contactEmail: "ibrahim@gmail.com",     contactPhone: "+225 05 77 88 99", passengers: [{ name: "Ibrahim Diallo" }, { name: "Fanta B." }],seatNumbers: ["E1","E2"], createdAt: "2026-03-17T11:00:00Z" },
  { id: "b7", bookingRef: "GBB2VT9KLM",  tripId: "t6", totalAmount: 8000,  paymentMethod: "mtn",    status: "confirmed", contactEmail: "adia.yao@gmail.com",    contactPhone: "+225 07 33 44 55", passengers: [{ name: "Adia Yao" }],                         seatNumbers: ["B7"],      createdAt: "2026-03-15T14:00:00Z" },
  { id: "b8", bookingRef: "GBB8WR4XNP",  tripId: "t2", totalAmount: 10000, paymentMethod: "wave",   status: "confirmed", contactEmail: "fanta.b@gmail.com",     contactPhone: "+225 05 22 11 44", passengers: [{ name: "Fanta Barry" }, { name: "Oumar S." }],  seatNumbers: ["C5","C6"], createdAt: "2026-03-16T12:00:00Z" },
];

/* ─── Style maps ─────────────────────────────────────────────────── */
const ROLE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  user:          { label: "Client",    color: PRIMARY,   bg: "#EEF2FF" },
  client:        { label: "Client",    color: PRIMARY,   bg: "#EEF2FF" },
  company_admin: { label: "Compagnie", color: "#D97706", bg: "#FFFBEB" },
  compagnie:     { label: "Compagnie", color: "#D97706", bg: "#FFFBEB" },
  agent:         { label: "Agent",     color: "#059669", bg: "#ECFDF5" },
  admin:         { label: "Admin",     color: PURPLE,    bg: "#F5F3FF" },
  super_admin:   { label: "Admin",     color: PURPLE,    bg: "#F5F3FF" },
};
const TRIP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:   { label: "Programmé", color: "#1A56DB", bg: "#EEF2FF" },
  in_progress: { label: "En cours",  color: "#059669", bg: "#ECFDF5" },
  completed:   { label: "Terminé",   color: "#64748B", bg: "#F1F5F9" },
  cancelled:   { label: "Annulé",    color: "#DC2626", bg: "#FEF2F2" },
};
const BOOKING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Confirmée",  color: "#059669", bg: "#ECFDF5" },
  pending:   { label: "En attente", color: "#D97706", bg: "#FFFBEB" },
  cancelled: { label: "Annulée",   color: "#DC2626", bg: "#FEF2F2" },
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
  { key: "wave",  name: "Wave",         color: "#1BA5E0", bg: "#E0F2FE", pct: 20, amount: 8_576_000  },
  { key: "visa",  name: "Visa/MC",      color: "#1D4ED8", bg: "#EFF6FF", pct: 9,  amount: 3_859_200  },
];
const FILL_RATE_DATA = [
  { route: "Abidjan → Bouaké",       fillPct: 88, totalSeats: 44, filled: 39 },
  { route: "Abidjan → Yamoussoukro", fillPct: 74, totalSeats: 55, filled: 41 },
  { route: "Abidjan → Korhogo",      fillPct: 92, totalSeats: 40, filled: 37 },
  { route: "San Pedro → Abidjan",    fillPct: 65, totalSeats: 55, filled: 36 },
  { route: "Bouaké → Korhogo",       fillPct: 58, totalSeats: 44, filled: 26 },
];

type Tab = "apercu" | "entreprises" | "utilisateurs" | "trajets" | "reservations" | "statistiques" | "commission";

const SIDEBAR_W = 285;
const SIDEBAR_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "apercu",       label: "Dashboard",    icon: "grid"       },
  { id: "utilisateurs", label: "Utilisateurs", icon: "users"      },
  { id: "trajets",      label: "Trajets",      icon: "navigation" },
  { id: "reservations", label: "Réservations", icon: "bookmark"   },
  { id: "entreprises",  label: "Compagnies",   icon: "briefcase"  },
  { id: "statistiques", label: "Statistiques", icon: "trending-up"},
  { id: "commission",   label: "Commission",   icon: "dollar-sign"},
];
const SECTION_LABELS: Record<Tab, string> = {
  apercu:       "Tableau de bord",
  utilisateurs: "Utilisateurs",
  trajets:      "Trajets",
  reservations: "Réservations",
  entreprises:  "Compagnies",
  statistiques: "Statistiques",
  commission:   "Commission & Revenus",
};

const EMPTY_TRIP = { from: "", to: "", date: "", departureTime: "", arrivalTime: "", price: "", busName: "", busType: "Standard", totalSeats: "44", duration: "" };

export default function SuperAdminDashboard() {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();
  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  /* ── Sidebar animation ── */
  const sidebarAnim  = useRef(new Animated.Value(-SIDEBAR_W)).current;
  const overlayAnim  = useRef(new Animated.Value(0)).current;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.spring(sidebarAnim,  { toValue: 0,   useNativeDriver: true, bounciness: 0, speed: 20 }),
      Animated.timing(overlayAnim,  { toValue: 1,   useNativeDriver: true, duration: 220 }),
    ]).start();
  };
  const closeSidebar = () => {
    Animated.parallel([
      Animated.spring(sidebarAnim,  { toValue: -SIDEBAR_W, useNativeDriver: true, bounciness: 0, speed: 20 }),
      Animated.timing(overlayAnim,  { toValue: 0,          useNativeDriver: true, duration: 180 }),
    ]).start(() => setSidebarOpen(false));
  };
  const navigateTo = (tab: Tab) => { setActiveTab(tab); closeSidebar(); };
  const handleLogout = async () => { closeSidebar(); setTimeout(async () => { await logout(); router.replace("/(auth)/login"); }, 200); };

  const [activeTab, setActiveTab]     = useState<Tab>("apercu");
  const [stats, setStats]             = useState<GlobalStats>(DEMO_STATS);
  const [companies, setCompanies]     = useState<Company[]>(DEMO_COMPANIES);
  const [users, setUsers]             = useState<UserItem[]>(DEMO_USERS);
  const [cities, setCities]           = useState<CityItem[]>(DEMO_CITIES);
  const [payments, setPayments]       = useState<PaymentItem[]>(DEMO_PAYMENTS);
  const [trips, setTrips]             = useState<TripItem[]>(DEMO_TRIPS);
  const [bookings, setBookings]       = useState<BookingItem[]>(DEMO_BOOKINGS);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [commSettings, setCommSettings] = useState<CommissionSettings>({ type: "percentage", value: 10 });
  const [commForm, setCommForm]       = useState<{ type: "percentage" | "fixed"; value: string }>({ type: "percentage", value: "10" });
  const [commSaving, setCommSaving]   = useState(false);
  const [commSaveMsg, setCommSaveMsg] = useState("");

  /* ── modals & filters ── */
  const [addCityModal, setAddCityModal]       = useState(false);
  const [addCompanyModal, setAddCompanyModal] = useState(false);
  const [addUserModal, setAddUserModal]       = useState(false);
  const [addTripModal, setAddTripModal]       = useState(false);
  const [editTripModal, setEditTripModal]     = useState(false);
  const [newCity, setNewCity]           = useState({ name: "", region: "" });
  const [newCompany, setNewCompany]     = useState({ name: "", email: "", phone: "", city: "" });
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError]   = useState("");
  const [editCompanyModal, setEditCompanyModal]   = useState(false);
  const [selectedCompany, setSelectedCompany]     = useState<Company | null>(null);
  const [editCompanyForm, setEditCompanyForm]     = useState({ name: "", email: "", phone: "", city: "" });
  const [editCompanyLoading, setEditCompanyLoading] = useState(false);
  const [editCompanyError, setEditCompanyError]   = useState("");
  const [actionMenuCompany, setActionMenuCompany] = useState<string | null>(null);
  const [confirmCompanyAction, setConfirmCompanyAction] = useState<{ type: "delete" | "deactivate" | "activate"; company: Company } | null>(null);
  const [confirmCompanyLoading, setConfirmCompanyLoading] = useState(false);
  const [newTrip, setNewTrip]         = useState(EMPTY_TRIP);
  const [editTripForm, setEditTripForm] = useState(EMPTY_TRIP);
  const [selectedTrip, setSelectedTrip] = useState<TripItem | null>(null);
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState<TripItem | null>(null);
  const [tripSaving, setTripSaving]   = useState(false);
  const [tripError, setTripError]     = useState("");
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState<string>("all");
  const [tripFilter, setTripFilter]   = useState<string>("all");
  const [payFilter, setPayFilter]     = useState<"all" | "booking" | "parcel">("all");
  const [roleFilter, setRoleFilter]   = useState<string>("all");

  /* ── user management state ── */
  const [newStaff, setNewStaff]       = useState({ name: "", email: "", phone: "", password: "", role: "agent" as "agent" | "compagnie" | "admin" });
  const [staffCreating, setStaffCreating] = useState(false);
  const [staffError, setStaffError]   = useState("");
  const [provisionalCreds, setProvisionalCreds] = useState<{ name: string; email: string; role: string; password: string } | null>(null);
  const [editUserModal, setEditUserModal]   = useState(false);
  const [selectedUser, setSelectedUser]     = useState<UserItem | null>(null);
  const [editForm, setEditForm]             = useState({ name: "", email: "", phone: "", role: "" });
  const [editLoading, setEditLoading]       = useState(false);
  const [editError, setEditError]           = useState("");
  const [actionMenuUser, setActionMenuUser] = useState<string | null>(null);
  const [confirmAction, setConfirmAction]   = useState<{ type: "delete" | "deactivate" | "activate"; user: UserItem } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [resetPwdResult, setResetPwdResult] = useState<{ name: string; email: string; password: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      apiFetch<GlobalStats>("/superadmin/stats",      { token }),
      apiFetch<Company[]>("/superadmin/companies",    { token }),
      apiFetch<UserItem[]>("/superadmin/users",       { token }),
      apiFetch<CityItem[]>("/superadmin/cities",      { token }),
      apiFetch<PaymentItem[]>("/superadmin/payments", { token }),
      apiFetch<TripItem[]>("/superadmin/trips",       { token }),
      apiFetch<BookingItem[]>("/superadmin/bookings", { token }),
      apiFetch<CommissionSettings>("/superadmin/commission", { token }),
      apiFetch<RevenueData>("/superadmin/revenue",    { token }),
    ]).then(([s, c, u, ci, p, tr, bk, cs, rv]) => {
      if (s.status  === "fulfilled") setStats(s.value);
      if (c.status  === "fulfilled" && c.value.length  > 0) setCompanies(c.value);
      if (u.status  === "fulfilled" && u.value.length  > 0) setUsers(u.value);
      if (ci.status === "fulfilled" && ci.value.length > 0) setCities(ci.value);
      if (p.status  === "fulfilled" && p.value.length  > 0) setPayments(p.value);
      if (tr.status === "fulfilled" && tr.value.length > 0) setTrips(tr.value);
      if (bk.status === "fulfilled" && bk.value.length > 0) setBookings(bk.value);
      if (cs.status === "fulfilled") {
        setCommSettings(cs.value);
        setCommForm({ type: cs.value.type, value: String(cs.value.value) });
      }
      if (rv.status === "fulfilled") setRevenueData(rv.value);
    });
  }, [token]);

  /* ─── Company handlers ─── */
  const createCompany = async () => {
    setCompanyError("");
    if (!newCompany.name.trim()) { setCompanyError("Le nom est requis."); return; }
    if (!newCompany.email.trim() || !newCompany.email.includes("@")) { setCompanyError("Email invalide."); return; }
    if (!newCompany.phone.trim()) { setCompanyError("Le téléphone est requis."); return; }
    setCompanySaving(true);
    try {
      const created = await apiFetch<Company>("/superadmin/companies", { token: token || "", method: "POST", body: { name: newCompany.name.trim(), email: newCompany.email.trim().toLowerCase(), phone: newCompany.phone.trim(), city: newCompany.city.trim() } });
      setCompanies(prev => [created, ...prev]);
      setStats(s => ({ ...s, totalCompanies: s.totalCompanies + 1 }));
      setAddCompanyModal(false);
      setNewCompany({ name: "", email: "", phone: "", city: "" });
    } catch (err: unknown) { setCompanyError(err instanceof Error ? err.message : "Échec de la création"); } finally { setCompanySaving(false); }
  };
  const openEditCompany = (c: Company) => {
    setSelectedCompany(c);
    setEditCompanyForm({ name: c.name, email: c.email, phone: c.phone, city: c.city });
    setEditCompanyError("");
    setActionMenuCompany(null);
    setEditCompanyModal(true);
  };
  const saveEditCompany = async () => {
    if (!selectedCompany) return;
    setEditCompanyError("");
    if (!editCompanyForm.name.trim()) { setEditCompanyError("Le nom est requis."); return; }
    if (!editCompanyForm.email.includes("@")) { setEditCompanyError("Email invalide."); return; }
    setEditCompanyLoading(true);
    try {
      const updated = await apiFetch<Company>(`/superadmin/companies/${selectedCompany.id}`, { token: token || "", method: "PATCH", body: { name: editCompanyForm.name.trim(), email: editCompanyForm.email.trim(), phone: editCompanyForm.phone.trim(), city: editCompanyForm.city.trim() } });
      setCompanies(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      setEditCompanyModal(false);
    } catch (err: unknown) { setEditCompanyError(err instanceof Error ? err.message : "Échec"); } finally { setEditCompanyLoading(false); }
  };
  const handleCompanyConfirmAction = async () => {
    if (!confirmCompanyAction) return;
    const { company, type } = confirmCompanyAction;
    setConfirmCompanyLoading(true);
    try {
      if (type === "delete") {
        await apiFetch(`/superadmin/companies/${company.id}`, { token: token || "", method: "DELETE" });
        setCompanies(prev => prev.filter(c => c.id !== company.id));
        setStats(s => ({ ...s, totalCompanies: Math.max(0, s.totalCompanies - 1) }));
      } else {
        const newStatus = type === "deactivate" ? "inactive" : "active";
        await apiFetch(`/superadmin/companies/${company.id}/status`, { token: token || "", method: "PATCH", body: { status: newStatus } });
        setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: newStatus } : c));
      }
      setConfirmCompanyAction(null);
    } catch { setConfirmCompanyAction(null); } finally { setConfirmCompanyLoading(false); }
  };

  /* ─── User handlers ─── */
  const createStaffAccount = async () => {
    setStaffError("");
    if (!newStaff.name.trim()) { setStaffError("Le nom est requis."); return; }
    if (!newStaff.email.trim() || !newStaff.email.includes("@")) { setStaffError("Email invalide."); return; }
    setStaffCreating(true);
    try {
      const body: Record<string, string> = { name: newStaff.name.trim(), email: newStaff.email.trim().toLowerCase(), role: newStaff.role };
      if (newStaff.phone.trim())    body.phone    = newStaff.phone.trim();
      if (newStaff.password.trim()) body.password = newStaff.password.trim();
      const res = await apiFetch<{ user: UserItem; provisionalPassword: string }>("/superadmin/users", { token: token || "", method: "POST", body });
      setUsers(prev => [{ ...res.user, createdAt: res.user.createdAt || new Date().toISOString() }, ...prev]);
      setProvisionalCreds({ name: res.user.name, email: res.user.email, role: res.user.role, password: res.provisionalPassword });
      setNewStaff({ name: "", email: "", phone: "", password: "", role: "agent" });
    } catch (err: unknown) {
      setStaffError(err instanceof Error ? err.message : "Échec de la création");
    } finally { setStaffCreating(false); }
  };
  const openEditUser = (u: UserItem) => { setSelectedUser(u); setEditForm({ name: u.name, email: u.email, phone: u.phone || "", role: u.role }); setEditError(""); setActionMenuUser(null); setEditUserModal(true); };
  const saveEditUser = async () => {
    if (!selectedUser) return;
    setEditError("");
    if (!editForm.name.trim()) { setEditError("Le nom est requis."); return; }
    if (!editForm.email.includes("@")) { setEditError("Email invalide."); return; }
    setEditLoading(true);
    try {
      const updated = await apiFetch<UserItem>(`/superadmin/users/${selectedUser.id}`, { token: token || "", method: "PATCH", body: { name: editForm.name.trim(), email: editForm.email.trim(), phone: editForm.phone.trim(), role: editForm.role } });
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
      setEditUserModal(false);
    } catch (err: unknown) { setEditError(err instanceof Error ? err.message : "Échec"); } finally { setEditLoading(false); }
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
    } catch { setConfirmAction(null); } finally { setConfirmLoading(false); }
  };
  const handleDeleteUser = async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    setConfirmLoading(true);
    try {
      await apiFetch(`/superadmin/users/${confirmAction.user.id}`, { token: token || "", method: "DELETE" });
      setUsers(prev => prev.filter(u => u.id !== confirmAction.user.id));
      setConfirmAction(null);
    } catch { setConfirmAction(null); } finally { setConfirmLoading(false); }
  };
  const handleResetPassword = async (u: UserItem) => {
    setActionMenuUser(null);
    try {
      const res = await apiFetch<{ provisionalPassword: string; email: string; name: string }>(`/superadmin/users/${u.id}/reset-password`, { token: token || "", method: "POST" });
      setResetPwdResult({ name: res.name, email: res.email, password: res.provisionalPassword });
    } catch {}
  };

  /* ─── Trip handlers ─── */
  const createTrip = async () => {
    setTripError("");
    if (!newTrip.from || !newTrip.to || !newTrip.date || !newTrip.departureTime || !newTrip.arrivalTime || !newTrip.price || !newTrip.busName) {
      setTripError("Tous les champs obligatoires (*) doivent être remplis."); return;
    }
    setTripSaving(true);
    try {
      const created = await apiFetch<TripItem>("/superadmin/trips", { token: token || "", method: "POST", body: { ...newTrip, price: parseFloat(newTrip.price), totalSeats: parseInt(newTrip.totalSeats) } });
      setTrips(prev => [created, ...prev]);
      setStats(s => ({ ...s, totalTrips: s.totalTrips + 1 }));
      setAddTripModal(false);
      setNewTrip(EMPTY_TRIP);
    } catch (err: unknown) { setTripError(err instanceof Error ? err.message : "Échec de la création"); } finally { setTripSaving(false); }
  };
  const openEditTrip = (t: TripItem) => {
    setSelectedTrip(t);
    setEditTripForm({ from: t.from, to: t.to, date: t.date, departureTime: t.departureTime, arrivalTime: t.arrivalTime, price: t.price.toString(), busName: t.busName, busType: t.busType, totalSeats: t.totalSeats.toString(), duration: t.duration });
    setTripError("");
    setEditTripModal(true);
  };
  const saveEditTrip = async () => {
    if (!selectedTrip) return;
    setTripError("");
    if (!editTripForm.from || !editTripForm.to || !editTripForm.date) { setTripError("Les champs obligatoires sont requis."); return; }
    setTripSaving(true);
    try {
      const updated = await apiFetch<TripItem>(`/superadmin/trips/${selectedTrip.id}`, { token: token || "", method: "PATCH", body: { ...editTripForm, price: parseFloat(editTripForm.price), totalSeats: parseInt(editTripForm.totalSeats) } });
      setTrips(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      setEditTripModal(false);
    } catch (err: unknown) { setTripError(err instanceof Error ? err.message : "Échec"); } finally { setTripSaving(false); }
  };
  const deleteTrip = async () => {
    if (!confirmDeleteTrip) return;
    setConfirmLoading(true);
    try {
      await apiFetch(`/superadmin/trips/${confirmDeleteTrip.id}`, { token: token || "", method: "DELETE" });
      setTrips(prev => prev.filter(t => t.id !== confirmDeleteTrip.id));
      setStats(s => ({ ...s, totalTrips: Math.max(0, s.totalTrips - 1) }));
      setConfirmDeleteTrip(null);
    } catch { setConfirmDeleteTrip(null); } finally { setConfirmLoading(false); }
  };

  /* ─── Booking handlers ─── */
  const updateBookingStatus = async (id: string, newStatus: string) => {
    try {
      await apiFetch(`/superadmin/bookings/${id}/status`, { token: token || "", method: "PATCH", body: { status: newStatus } });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    } catch {}
  };

  /* ─── Commission handlers ─── */
  const saveCommission = async () => {
    const v = parseFloat(commForm.value);
    if (isNaN(v) || v < 0) { setCommSaveMsg("Veuillez entrer un montant valide."); return; }
    if (commForm.type === "percentage" && v > 100) { setCommSaveMsg("Le pourcentage ne peut pas dépasser 100%."); return; }
    setCommSaving(true);
    setCommSaveMsg("");
    try {
      const updated = await apiFetch<CommissionSettings>("/superadmin/commission", { token: token || "", method: "PUT", body: { type: commForm.type, value: v } });
      setCommSettings(updated);
      setCommForm({ type: updated.type, value: String(updated.value) });
      setCommSaveMsg("Réglages enregistrés !");
      const rv = await apiFetch<RevenueData>("/superadmin/revenue", { token: token || "" });
      setRevenueData(rv);
    } catch (err) {
      setCommSaveMsg(err instanceof Error ? err.message : "Échec de la sauvegarde");
    } finally { setCommSaving(false); setTimeout(() => setCommSaveMsg(""), 3000); }
  };

  /* ─── Computed lists ─── */
  const filteredPayments  = payFilter === "all" ? payments : payments.filter(p => p.refType === payFilter);
  const filteredUsers     = roleFilter === "all" ? users : users.filter(u => {
    if (roleFilter === "client")    return u.role === "client"    || u.role === "user";
    if (roleFilter === "compagnie") return u.role === "compagnie" || u.role === "company_admin";
    if (roleFilter === "admin")     return u.role === "admin"     || u.role === "super_admin";
    return u.role === roleFilter;
  });
  const filteredTrips = tripFilter === "all" ? trips : trips.filter(t => t.status === tripFilter);
  const filteredBookings = bookingFilter === "all" ? bookings : bookings.filter(b => b.status === bookingFilter);
  const payTotal = filteredPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <View style={[S.container, { paddingTop: topPad }]}>
      {/* ── Header ────────────────────────────────────────── */}
      <LinearGradient colors={[PURPLE, "#5B21B6"]} style={S.header}>
        <Pressable onPress={openSidebar} style={S.menuBtn}>
          <Feather name="menu" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>{SECTION_LABELS[activeTab]}</Text>
          <Text style={S.headerSub}>GoBooking · Côte d'Ivoire</Text>
        </View>
        <View style={S.roleBadge}>
          <Feather name="shield" size={13} color="white" />
          <Text style={S.roleBadgeText}>Admin</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* ══ Aperçu ══════════════════════════════════════════════ */}
        {activeTab === "apercu" && (<>
          <View style={S.revenueCard}>
            <LinearGradient colors={[PURPLE, "#5B21B6"]} style={S.revenueGradient}>
              <Text style={S.revenueLabel}>Revenu total de la plateforme</Text>
              <Text style={S.revenueValue}>{(stats.totalRevenue / 1_000_000).toFixed(1)} M FCFA</Text>
              <Text style={S.revenueSub}>Cumulé depuis le lancement</Text>
            </LinearGradient>
          </View>
          <View style={S.statsGrid}>
            {[
              { icon: "users",       label: "Utilisateurs",  value: stats.totalUsers.toLocaleString(),    color: PRIMARY,   bg: "#EEF2FF" },
              { icon: "briefcase",   label: "Compagnies",    value: stats.totalCompanies,                 color: "#D97706", bg: "#FFFBEB" },
              { icon: "user",        label: "Agents",        value: stats.totalAgents,                    color: "#059669", bg: "#ECFDF5" },
              { icon: "navigation",  label: "Trajets",       value: stats.totalTrips.toLocaleString(),    color: "#0891B2", bg: "#ECFEFF" },
              { icon: "package",     label: "Colis",         value: stats.totalParcels.toLocaleString(),  color: "#6D28D9", bg: "#F5F3FF" },
              { icon: "bookmark",    label: "Réservations",  value: stats.totalBookings.toLocaleString(), color: "#DC2626", bg: "#FEF2F2" },
              { icon: "map-pin",     label: "Villes",        value: stats.totalCities,                    color: "#0F766E", bg: "#F0FDFA" },
              { icon: "credit-card", label: "Modes paiement",value: "4 actifs",                           color: "#9333EA", bg: "#FAF5FF" },
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

        {/* ══ Compagnies ══════════════════════════════════════════ */}
        {activeTab === "entreprises" && (<>
          <View style={S.sectionRow}>
            <View>
              <Text style={S.sectionTitle}>Gestion des compagnies</Text>
              <Text style={S.subLabel}>{companies.length} compagnie{companies.length > 1 ? "s" : ""} enregistrée{companies.length > 1 ? "s" : ""}</Text>
            </View>
            <TouchableOpacity style={S.addBtn} onPress={() => setAddCompanyModal(true)} activeOpacity={0.8}>
              <Feather name="plus" size={14} color="white" /><Text style={S.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {companies.map(company => {
            const isActive = company.status === "active";
            const menuOpen = actionMenuCompany === company.id;
            return (
              <View key={company.id} style={[S.userCard, !isActive && S.userCardInactive]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[S.companyIcon, { backgroundColor: isActive ? "#F5F3FF" : "#F1F5F9" }]}>
                    <Feather name="briefcase" size={18} color={isActive ? PURPLE : "#94A3B8"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[S.listTitle, !isActive && { color: "#94A3B8" }]}>{company.name}</Text>
                      <View style={[S.badge, { backgroundColor: isActive ? "#ECFDF5" : "#FEF2F2" }]}>
                        <Text style={[S.badgeText, { color: isActive ? "#065F46" : "#DC2626" }]}>{isActive ? "Actif" : "Inactif"}</Text>
                      </View>
                    </View>
                    <Text style={S.listSub}>{company.email}</Text>
                    {(company.city || company.phone) ? <Text style={S.listSub}>{[company.city, company.phone].filter(Boolean).join(" · ")}</Text> : null}
                  </View>
                  <TouchableOpacity style={S.actionMenuBtn} onPress={() => setActionMenuCompany(menuOpen ? null : company.id)} activeOpacity={0.7}>
                    <Feather name="more-vertical" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
                {menuOpen && (
                  <View style={S.actionMenu}>
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => openEditCompany(company)} activeOpacity={0.7}>
                      <Feather name="edit-2" size={14} color="#1A56DB" /><Text style={[S.actionMenuText, { color: "#1A56DB" }]}>Modifier</Text>
                    </TouchableOpacity>
                    <View style={S.actionMenuDivider} />
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => { setActionMenuCompany(null); setConfirmCompanyAction({ type: isActive ? "deactivate" : "activate", company }); }} activeOpacity={0.7}>
                      <Feather name={isActive ? "pause-circle" : "play-circle"} size={14} color={isActive ? "#D97706" : "#059669"} />
                      <Text style={[S.actionMenuText, { color: isActive ? "#D97706" : "#059669" }]}>{isActive ? "Désactiver" : "Réactiver"}</Text>
                    </TouchableOpacity>
                    <View style={S.actionMenuDivider} />
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => { setActionMenuCompany(null); setConfirmCompanyAction({ type: "delete", company }); }} activeOpacity={0.7}>
                      <Feather name="trash-2" size={14} color="#DC2626" /><Text style={[S.actionMenuText, { color: "#DC2626" }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </>)}

        {/* ══ Utilisateurs ════════════════════════════════════════ */}
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
              { f: "all",       label: "Tous",       count: users.length },
              { f: "client",    label: "Clients",    count: users.filter(u => u.role === "client" || u.role === "user").length },
              { f: "agent",     label: "Agents",     count: users.filter(u => u.role === "agent").length },
              { f: "compagnie", label: "Compagnies", count: users.filter(u => u.role === "compagnie" || u.role === "company_admin").length },
              { f: "admin",     label: "Admins",     count: users.filter(u => u.role === "admin" || u.role === "super_admin").length },
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
                      <View style={[S.badge, { backgroundColor: rs.bg }]}><Text style={[S.badgeText, { color: rs.color }]}>{rs.label}</Text></View>
                    </View>
                    <Text style={S.listSub}>{u.email}</Text>
                    {u.phone ? <Text style={S.listSub}>{u.phone}</Text> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <View style={[S.statusDot, { backgroundColor: isActive ? "#10B981" : "#EF4444" }]} />
                      <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: isActive ? "#059669" : "#DC2626" }}>{isActive ? "Actif" : "Désactivé"}</Text>
                      {u.createdAt && <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#CBD5E1" }}>· Créé le {u.createdAt.split("T")[0]}</Text>}
                    </View>
                  </View>
                  <TouchableOpacity style={S.actionMenuBtn} onPress={() => setActionMenuUser(menuOpen ? null : u.id)} activeOpacity={0.7}>
                    <Feather name="more-vertical" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
                {menuOpen && (
                  <View style={S.actionMenu}>
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => openEditUser(u)} activeOpacity={0.7}>
                      <Feather name="edit-2" size={14} color="#1A56DB" /><Text style={[S.actionMenuText, { color: "#1A56DB" }]}>Modifier</Text>
                    </TouchableOpacity>
                    <View style={S.actionMenuDivider} />
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => { setActionMenuUser(null); setConfirmAction({ type: isActive ? "deactivate" : "activate", user: u }); }} activeOpacity={0.7}>
                      <Feather name={isActive ? "pause-circle" : "play-circle"} size={14} color={isActive ? "#D97706" : "#059669"} />
                      <Text style={[S.actionMenuText, { color: isActive ? "#D97706" : "#059669" }]}>{isActive ? "Désactiver" : "Réactiver"}</Text>
                    </TouchableOpacity>
                    <View style={S.actionMenuDivider} />
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => handleResetPassword(u)} activeOpacity={0.7}>
                      <Feather name="refresh-cw" size={14} color={PURPLE} /><Text style={[S.actionMenuText, { color: PURPLE }]}>Réinitialiser MDP</Text>
                    </TouchableOpacity>
                    <View style={S.actionMenuDivider} />
                    <TouchableOpacity style={S.actionMenuItem} onPress={() => { setActionMenuUser(null); setConfirmAction({ type: "delete", user: u }); }} activeOpacity={0.7}>
                      <Feather name="trash-2" size={14} color="#DC2626" /><Text style={[S.actionMenuText, { color: "#DC2626" }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </>)}

        {/* ══ Trajets ═════════════════════════════════════════════ */}
        {activeTab === "trajets" && (<>
          <View style={S.sectionRow}>
            <View>
              <Text style={S.sectionTitle}>Gestion des trajets</Text>
              <Text style={S.subLabel}>{trips.length} trajet{trips.length > 1 ? "s" : ""} au total</Text>
            </View>
            <TouchableOpacity style={S.addBtn} onPress={() => { setAddTripModal(true); setNewTrip(EMPTY_TRIP); setTripError(""); }} activeOpacity={0.8}>
              <Feather name="plus" size={14} color="white" /><Text style={S.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {[
              { f: "all",         label: "Tous",       count: trips.length },
              { f: "scheduled",   label: "Programmés", count: trips.filter(t => t.status === "scheduled").length },
              { f: "in_progress", label: "En cours",   count: trips.filter(t => t.status === "in_progress").length },
              { f: "completed",   label: "Terminés",   count: trips.filter(t => t.status === "completed").length },
            ].map(({ f, label, count }) => (
              <Pressable key={f} style={[S.filterChip, tripFilter === f && S.filterChipActive]} onPress={() => setTripFilter(f)}>
                <Text style={[S.filterChipText, tripFilter === f && S.filterChipTextActive]}>{label} ({count})</Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredTrips.map(t => {
            const ts = TRIP_STATUS[t.status] ?? TRIP_STATUS.scheduled;
            return (
              <View key={t.id} style={S.tripCard}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={[S.tripIcon, { backgroundColor: ts.bg }]}>
                    <Feather name="navigation" size={16} color={ts.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={S.tripRoute}>{t.from} → {t.to}</Text>
                      <View style={[S.badge, { backgroundColor: ts.bg }]}><Text style={[S.badgeText, { color: ts.color }]}>{ts.label}</Text></View>
                    </View>
                    <Text style={S.listSub}>{t.date} · {t.departureTime} – {t.arrivalTime} ({t.duration})</Text>
                    <Text style={S.listSub}>{t.busName} · {t.busType} · {t.totalSeats} places</Text>
                    <Text style={[S.listTitle, { fontSize: 13, color: "#059669", marginTop: 2 }]}>{t.price.toLocaleString()} FCFA</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity style={S.iconBtn} onPress={() => openEditTrip(t)} activeOpacity={0.7}>
                      <Feather name="edit-2" size={14} color="#1A56DB" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[S.iconBtn, { backgroundColor: "#FEF2F2" }]} onPress={() => setConfirmDeleteTrip(t)} activeOpacity={0.7}>
                      <Feather name="trash-2" size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
          {filteredTrips.length === 0 && (
            <View style={S.emptyState}>
              <Feather name="navigation" size={32} color="#CBD5E1" />
              <Text style={S.emptyStateText}>Aucun trajet dans cette catégorie</Text>
            </View>
          )}
        </>)}

        {/* ══ Réservations ════════════════════════════════════════ */}
        {activeTab === "reservations" && (<>
          <View style={S.sectionRow}>
            <View>
              <Text style={S.sectionTitle}>Gestion des réservations</Text>
              <Text style={S.subLabel}>{bookings.length} réservation{bookings.length > 1 ? "s" : ""} au total</Text>
            </View>
          </View>

          <View style={S.revenueSmallCard}>
            <Text style={S.revenueSmallLabel}>Montant total des réservations</Text>
            <Text style={S.revenueSmallValue}>{filteredBookings.reduce((s, b) => s + b.totalAmount, 0).toLocaleString()} FCFA</Text>
            <Text style={S.revenueSmallSub}>{filteredBookings.length} réservation{filteredBookings.length > 1 ? "s" : ""}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {[
              { f: "all",       label: "Toutes",       count: bookings.length },
              { f: "confirmed", label: "Confirmées",   count: bookings.filter(b => b.status === "confirmed").length },
              { f: "pending",   label: "En attente",   count: bookings.filter(b => b.status === "pending").length },
              { f: "cancelled", label: "Annulées",     count: bookings.filter(b => b.status === "cancelled").length },
            ].map(({ f, label, count }) => (
              <Pressable key={f} style={[S.filterChip, bookingFilter === f && S.filterChipActive]} onPress={() => setBookingFilter(f)}>
                <Text style={[S.filterChipText, bookingFilter === f && S.filterChipTextActive]}>{label} ({count})</Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredBookings.map(b => {
            const bs   = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.confirmed;
            const meth = METHOD_STYLE[b.paymentMethod] ?? METHOD_STYLE.orange;
            const expanded = expandedBooking === b.id;
            return (
              <View key={b.id} style={S.bookingCard}>
                <TouchableOpacity onPress={() => setExpandedBooking(expanded ? null : b.id)} activeOpacity={0.85}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View style={[S.bookingRefBadge, { backgroundColor: bs.bg }]}>
                      <Feather name="bookmark" size={14} color={bs.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={S.bookingRef}>{b.bookingRef}</Text>
                        <View style={[S.badge, { backgroundColor: bs.bg }]}><Text style={[S.badgeText, { color: bs.color }]}>{bs.label}</Text></View>
                      </View>
                      <Text style={S.listSub}>{b.passengers?.length ?? 0} passager{(b.passengers?.length ?? 0) > 1 ? "s" : ""} · Sièges : {b.seatNumbers?.join(", ") || "—"}</Text>
                      <Text style={[S.listTitle, { fontSize: 13, color: "#059669", marginTop: 2 }]}>{b.totalAmount.toLocaleString()} FCFA</Text>
                    </View>
                    <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>

                {expanded && (
                  <View style={S.bookingDetails}>
                    <View style={S.detailRow}><Feather name="mail" size={12} color="#94A3B8" /><Text style={S.detailText}>{b.contactEmail || "—"}</Text></View>
                    <View style={S.detailRow}><Feather name="phone" size={12} color="#94A3B8" /><Text style={S.detailText}>{b.contactPhone || "—"}</Text></View>
                    <View style={S.detailRow}><Feather name="credit-card" size={12} color={meth.color} /><Text style={S.detailText}>{meth.label}</Text></View>
                    <View style={S.detailRow}><Feather name="clock" size={12} color="#94A3B8" /><Text style={S.detailText}>{new Date(b.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</Text></View>
                    {b.passengers && b.passengers.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748B", marginBottom: 4 }}>PASSAGERS</Text>
                        {b.passengers.map((p, i) => (
                          <Text key={i} style={S.detailText}>· {p.name} {b.seatNumbers?.[i] ? `(Siège ${b.seatNumbers[i]})` : ""}</Text>
                        ))}
                      </View>
                    )}
                    {b.status !== "cancelled" && (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
                        <Feather name="eye" size={12} color="#64748B" />
                        <Text style={{ fontSize: 11, color: "#64748B", fontFamily: "Inter_400Regular" }}>Lecture seule — géré par la compagnie</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {filteredBookings.length === 0 && (
            <View style={S.emptyState}>
              <Feather name="bookmark" size={32} color="#CBD5E1" />
              <Text style={S.emptyStateText}>Aucune réservation dans cette catégorie</Text>
            </View>
          )}
        </>)}

        {/* ══ Statistiques ════════════════════════════════════════ */}
        {activeTab === "statistiques" && (<>

          <View style={S.statsSummaryRow}>
            {[
              { label: "Réservations", value: stats.totalBookings.toLocaleString(), icon: "bookmark",  color: PRIMARY   },
              { label: "Revenus",      value: `${(stats.totalRevenue/1_000_000).toFixed(1)}M`,icon:"trending-up",color:"#059669"},
              { label: "Utilisateurs", value: stats.totalUsers.toLocaleString(),    icon: "users",     color: "#D97706" },
            ].map((c,i) => (
              <View key={i} style={[S.summaryCard, { borderTopColor: c.color }]}>
                <Feather name={c.icon as never} size={18} color={c.color} />
                <Text style={[S.summaryValue, { color: c.color }]}>{c.value}</Text>
                <Text style={S.summaryLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          <Text style={S.sectionTitle}>Taux de remplissage des bus</Text>
          <Text style={S.subLabel}>Pourcentage d'occupation par route</Text>
          {FILL_RATE_DATA.map((r, i) => (
            <View key={i} style={S.statBarCard}>
              <View style={[S.statBarIcon, { backgroundColor: "#EEF2FF" }]}><Feather name="users" size={16} color={PRIMARY} /></View>
              <View style={{ flex: 1, gap: 5 }}>
                <View style={S.statBarTop}>
                  <Text style={S.statBarName}>{r.route}</Text>
                  <Text style={[S.statBarPct, { color: r.fillPct >= 80 ? "#059669" : r.fillPct >= 60 ? "#D97706" : "#DC2626" }]}>{r.fillPct}%</Text>
                </View>
                <View style={S.barBg}>
                  <View style={[S.barFill, { width: `${r.fillPct}%` as unknown as number, backgroundColor: r.fillPct >= 80 ? "#059669" : r.fillPct >= 60 ? "#D97706" : "#DC2626" }]} />
                </View>
                <Text style={S.statBarAmount}>{r.filled}/{r.totalSeats} places occupées</Text>
              </View>
            </View>
          ))}

          <Text style={[S.sectionTitle, { marginTop: 8 }]}>Répartition des revenus</Text>
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
                  <View style={[S.barFill, { width: `${pm.pct}%` as unknown as number, backgroundColor: pm.color }]} />
                </View>
                <Text style={S.statBarAmount}>{(pm.amount / 1_000_000).toFixed(1)} M FCFA</Text>
              </View>
            </View>
          ))}

          <Text style={[S.sectionTitle, { marginTop: 8 }]}>Transactions : Réservations vs Colis</Text>
          <View style={S.pieRow}>
            {[
              { label: "Réservations", value: stats.totalBookings, color: PRIMARY,   bg: "#EEF2FF" },
              { label: "Colis",        value: stats.totalParcels,  color: "#D97706", bg: "#FFFBEB" },
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
            { from: "Abidjan", to: "Bouaké",       trips: 584, pct: 32 },
            { from: "Abidjan", to: "Yamoussoukro", trips: 422, pct: 23 },
            { from: "Abidjan", to: "Korhogo",      trips: 348, pct: 19 },
            { from: "San Pedro", to: "Abidjan",    trips: 312, pct: 17 },
            { from: "Bouaké", to: "Korhogo",       trips: 168, pct: 9  },
          ].map((r, i) => (
            <View key={i} style={S.routeStatCard}>
              <Text style={S.routeStatRank}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.routeStatName}>{r.from} → {r.to}</Text>
                <View style={S.barBg}>
                  <View style={[S.barFill, { width: `${r.pct * 3}%` as unknown as number, backgroundColor: PRIMARY }]} />
                </View>
              </View>
              <Text style={S.routeStatTrips}>{r.trips} trajets</Text>
            </View>
          ))}
        </>)}

        {/* ══ Commission & Revenus ══════════════════════════════════ */}
        {activeTab === "commission" && (<>
          {/* Commission Settings */}
          <View style={S.commCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" }}>
                <Feather name="sliders" size={18} color="#D97706" />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" }}>Réglages de commission</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" }}>Appliqué à chaque réservation</Text>
              </View>
            </View>

            {/* Type selector */}
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#475569", marginBottom: 8 }}>Type de commission</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {([
                { key: "percentage" as const, label: "Pourcentage (%)", icon: "percent" },
                { key: "fixed"      as const, label: "Montant fixe (FCFA)", icon: "hash" },
              ]).map(opt => {
                const active = commForm.type === opt.key;
                return (
                  <TouchableOpacity key={opt.key} style={{ flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12, borderWidth: active ? 2 : 1.5, borderColor: active ? "#D97706" : "#E2E8F0", backgroundColor: active ? "#FFFBEB" : "#F8FAFC", gap: 4 }} onPress={() => setCommForm(p => ({ ...p, type: opt.key }))} activeOpacity={0.75}>
                    <Feather name={opt.icon as never} size={16} color={active ? "#D97706" : "#94A3B8"} />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: active ? "#D97706" : "#64748B", textAlign: "center" }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Value input */}
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#475569", marginBottom: 8 }}>
              {commForm.type === "percentage" ? "Taux (%)" : "Montant fixe (FCFA)"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, backgroundColor: "#F8FAFC", paddingHorizontal: 14 }}>
                <Feather name={commForm.type === "percentage" ? "percent" : "hash"} size={14} color="#94A3B8" />
                <TextInput
                  style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#0F172A" }}
                  value={commForm.value}
                  onChangeText={v => setCommForm(p => ({ ...p, value: v }))}
                  keyboardType="decimal-pad"
                  placeholder={commForm.type === "percentage" ? "Ex: 10" : "Ex: 500"}
                />
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#94A3B8" }}>{commForm.type === "percentage" ? "%" : "FCFA"}</Text>
              </View>
              <TouchableOpacity style={{ backgroundColor: "#D97706", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 6, opacity: commSaving ? 0.7 : 1 }} onPress={saveCommission} disabled={commSaving} activeOpacity={0.8}>
                {commSaving ? <ActivityIndicator size="small" color="white" /> : <Feather name="save" size={15} color="white" />}
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" }}>Sauver</Text>
              </TouchableOpacity>
            </View>
            {!!commSaveMsg && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                <Feather name={commSaveMsg.includes("!") ? "check-circle" : "alert-circle"} size={13} color={commSaveMsg.includes("!") ? "#059669" : "#DC2626"} />
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: commSaveMsg.includes("!") ? "#059669" : "#DC2626" }}>{commSaveMsg}</Text>
              </View>
            )}

            {/* Live preview */}
            <View style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 1, borderColor: "#F1F5F9" }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", marginBottom: 10 }}>APERÇU EN TEMPS RÉEL</Text>
              {[3500, 5000, 7000, 12000].map(price => {
                const v = parseFloat(commForm.value) || 0;
                const comm = commForm.type === "percentage" ? Math.round((price * v) / 100) : v;
                return (
                  <View key={price} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569" }}>Ticket {price.toLocaleString()} FCFA</Text>
                    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#D97706" }}>+{comm.toLocaleString()} FCFA</Text>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>({v}{commForm.type === "percentage" ? "%" : "F"})</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Revenue Summary */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <LinearGradient colors={["#D97706", "#B45309"]} style={S.commRevCard}>
              <Feather name="trending-up" size={18} color="white" style={{ marginBottom: 6 }} />
              <Text style={S.commRevValue}>{((revenueData?.totalCommission ?? 0) / 1000).toFixed(1)}K</Text>
              <Text style={S.commRevLabel}>FCFA commissions</Text>
            </LinearGradient>
            <LinearGradient colors={[PURPLE, "#5B21B6"]} style={S.commRevCard}>
              <Feather name="layers" size={18} color="white" style={{ marginBottom: 6 }} />
              <Text style={S.commRevValue}>{((revenueData?.totalRevenue ?? 0) / 1000).toFixed(1)}K</Text>
              <Text style={S.commRevLabel}>FCFA transactions</Text>
            </LinearGradient>
          </View>
          <View style={[S.commCard, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
            <View>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" }}>Taux effectif moyen</Text>
              <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#0F172A" }}>
                {revenueData && revenueData.totalRevenue > 0 ? ((revenueData.totalCommission / revenueData.totalRevenue) * 100).toFixed(1) : commSettings.type === "percentage" ? commSettings.value : "—"}%
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" }}>Mode actuel</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 }}>
                <Feather name={commSettings.type === "percentage" ? "percent" : "hash"} size={12} color="#D97706" />
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#D97706" }}>
                  {commSettings.type === "percentage" ? `${commSettings.value}%` : `${commSettings.value.toLocaleString()} FCFA fixe`}
                </Text>
              </View>
            </View>
          </View>

          {/* Daily bar chart (last 7 days) */}
          <View style={S.commCard}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 14 }}>Commissions — 7 derniers jours</Text>
            {(() => {
              const days = revenueData?.dailyCommissions.slice(-7) ?? [];
              const maxVal = Math.max(...days.map(d => d.amount), 1);
              const dayLabels = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];
              return (
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 100 }}>
                  {days.map((d, i) => {
                    const pct = (d.amount / maxVal) * 100;
                    const dt  = new Date(d.date);
                    const lbl = dayLabels[dt.getDay()];
                    return (
                      <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                        {d.amount > 0 && (
                          <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#D97706" }}>{d.amount >= 1000 ? `${(d.amount/1000).toFixed(1)}k` : d.amount}</Text>
                        )}
                        <View style={{ flex: 1, width: "100%", justifyContent: "flex-end" }}>
                          <View style={{ width: "100%", height: `${Math.max(pct, 4)}%`, backgroundColor: d.amount > 0 ? "#D97706" : "#F1F5F9", borderRadius: 6, minHeight: 4 }} />
                        </View>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>{lbl}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>

          {/* Per-company commissions */}
          <View style={S.commCard}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 14 }}>Commissions par compagnie</Text>
            {(revenueData?.byCompany.length ?? 0) === 0 ? (
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center", paddingVertical: 20 }}>Aucune donnée disponible</Text>
            ) : (revenueData?.byCompany ?? []).map((c, idx) => {
              const pct = revenueData && revenueData.totalCommission > 0 ? (c.commission / revenueData.totalCommission) * 100 : 0;
              return (
                <View key={c.name} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#94A3B8", width: 20 }}>#{idx + 1}</Text>
                      <View>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" }}>{c.name}</Text>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>{c.bookings} réservation{c.bookings > 1 ? "s" : ""}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#D97706" }}>{c.commission.toLocaleString()} FCFA</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ height: 6, width: `${pct}%`, backgroundColor: "#D97706", borderRadius: 3 }} />
                  </View>
                </View>
              );
            })}
          </View>
        </>)}

      </ScrollView>

      {/* ══ Modal : Ajouter une ville ══════════════════════════════ */}
      <Modal visible={addCityModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Ajouter une ville</Text>
            <TextInput style={S.modalInput} placeholder="Nom de la ville" value={newCity.name} onChangeText={v => setNewCity(p => ({ ...p, name: v }))} />
            <TextInput style={S.modalInput} placeholder="Région" value={newCity.region} onChangeText={v => setNewCity(p => ({ ...p, region: v }))} />
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setAddCityModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: PURPLE }]} onPress={() => {
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

      {/* ══ Modal : Ajouter une compagnie ═══════════════════════════ */}
      <Modal visible={addCompanyModal} transparent animationType="slide">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.modalOverlay}>
          <View style={S.modalCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center" }}>
                <Feather name="briefcase" size={16} color={PURPLE} />
              </View>
              <Text style={S.modalTitle}>Ajouter une compagnie</Text>
            </View>
            {!!companyError && (
              <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
                <Feather name="alert-circle" size={13} color="#DC2626" />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" }}>{companyError}</Text>
              </View>
            )}
            <TextInput style={S.modalInput} placeholder="Nom de l'entreprise *" value={newCompany.name} onChangeText={v => { setNewCompany(p => ({ ...p, name: v })); setCompanyError(""); }} autoCapitalize="words" />
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Email *" keyboardType="email-address" autoCapitalize="none" value={newCompany.email} onChangeText={v => { setNewCompany(p => ({ ...p, email: v })); setCompanyError(""); }} />
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Téléphone *" keyboardType="phone-pad" value={newCompany.phone} onChangeText={v => { setNewCompany(p => ({ ...p, phone: v })); setCompanyError(""); }} />
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Ville siège" value={newCompany.city} onChangeText={v => setNewCompany(p => ({ ...p, city: v }))} />
            <View style={[S.modalBtns, { marginTop: 16 }]}>
              <Pressable style={S.modalCancel} onPress={() => { setAddCompanyModal(false); setCompanyError(""); }}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: PURPLE, opacity: companySaving ? 0.7 : 1 }]} onPress={createCompany} disabled={companySaving}>
                {companySaving ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>Créer</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* ══ Modal : Modifier une compagnie ══════════════════════════ */}
      <Modal visible={editCompanyModal} transparent animationType="slide">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.modalOverlay}>
          <View style={S.modalCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center" }}>
                <Feather name="edit-2" size={16} color={PURPLE} />
              </View>
              <View>
                <Text style={S.modalTitle}>Modifier la compagnie</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>{selectedCompany?.email}</Text>
              </View>
            </View>
            {!!editCompanyError && (
              <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
                <Feather name="alert-circle" size={13} color="#DC2626" />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" }}>{editCompanyError}</Text>
              </View>
            )}
            <TextInput style={S.modalInput} placeholder="Nom *" value={editCompanyForm.name} onChangeText={v => { setEditCompanyForm(p => ({ ...p, name: v })); setEditCompanyError(""); }} autoCapitalize="words" />
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Email *" keyboardType="email-address" autoCapitalize="none" value={editCompanyForm.email} onChangeText={v => { setEditCompanyForm(p => ({ ...p, email: v })); setEditCompanyError(""); }} />
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Téléphone" keyboardType="phone-pad" value={editCompanyForm.phone} onChangeText={v => setEditCompanyForm(p => ({ ...p, phone: v }))} />
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Ville siège" value={editCompanyForm.city} onChangeText={v => setEditCompanyForm(p => ({ ...p, city: v }))} />
            <View style={[S.modalBtns, { marginTop: 16 }]}>
              <Pressable style={S.modalCancel} onPress={() => setEditCompanyModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: PURPLE, opacity: editCompanyLoading ? 0.7 : 1 }]} onPress={saveEditCompany} disabled={editCompanyLoading}>
                {editCompanyLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>Enregistrer</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* ══ Modal : Confirmation action compagnie ════════════════════ */}
      <Modal visible={!!confirmCompanyAction} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <View style={[S.modalCard, { maxWidth: 340, alignSelf: "center" }]}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", backgroundColor: confirmCompanyAction?.type === "delete" ? "#FEF2F2" : confirmCompanyAction?.type === "deactivate" ? "#FFFBEB" : "#ECFDF5" }}>
                <Feather name={confirmCompanyAction?.type === "delete" ? "trash-2" : confirmCompanyAction?.type === "deactivate" ? "pause-circle" : "play-circle"} size={24} color={confirmCompanyAction?.type === "delete" ? "#DC2626" : confirmCompanyAction?.type === "deactivate" ? "#D97706" : "#059669"} />
              </View>
            </View>
            <Text style={[S.modalTitle, { textAlign: "center" }]}>
              {confirmCompanyAction?.type === "delete" ? "Supprimer la compagnie" : confirmCompanyAction?.type === "deactivate" ? "Désactiver la compagnie" : "Réactiver la compagnie"}
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 6, marginBottom: 20 }}>
              {confirmCompanyAction?.type === "delete"
                ? `Supprimer définitivement "${confirmCompanyAction?.company.name}" ? Tous les trajets associés resteront en base.`
                : confirmCompanyAction?.type === "deactivate"
                ? `Désactiver "${confirmCompanyAction?.company.name}" ? Les agents de cette compagnie ne pourront plus accéder à la plateforme.`
                : `Réactiver "${confirmCompanyAction?.company.name}" ?`}
            </Text>
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setConfirmCompanyAction(null)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable
                style={[S.modalConfirm, { backgroundColor: confirmCompanyAction?.type === "delete" ? "#DC2626" : confirmCompanyAction?.type === "deactivate" ? "#D97706" : "#059669", opacity: confirmCompanyLoading ? 0.7 : 1 }]}
                onPress={handleCompanyConfirmAction}
                disabled={confirmCompanyLoading}
              >
                {confirmCompanyLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>{confirmCompanyAction?.type === "delete" ? "Supprimer" : confirmCompanyAction?.type === "deactivate" ? "Désactiver" : "Réactiver"}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Modal : Ajouter un trajet ════════════════════════════════ */}
      <Modal visible={addTripModal} transparent animationType="slide">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.modalOverlay}>
          <View style={S.modalCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" }}>
                <Feather name="navigation" size={16} color={PRIMARY} />
              </View>
              <Text style={S.modalTitle}>Ajouter un trajet</Text>
            </View>
            {!!tripError && (
              <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
                <Feather name="alert-circle" size={13} color="#DC2626" />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" }}>{tripError}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Départ *" value={newTrip.from} onChangeText={v => setNewTrip(p => ({ ...p, from: v }))} />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Arrivée *" value={newTrip.to} onChangeText={v => setNewTrip(p => ({ ...p, to: v }))} />
            </View>
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Date (YYYY-MM-DD) *" value={newTrip.date} onChangeText={v => setNewTrip(p => ({ ...p, date: v }))} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Départ *" value={newTrip.departureTime} onChangeText={v => setNewTrip(p => ({ ...p, departureTime: v }))} />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Arrivée *" value={newTrip.arrivalTime} onChangeText={v => setNewTrip(p => ({ ...p, arrivalTime: v }))} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Prix (FCFA) *" keyboardType="numeric" value={newTrip.price} onChangeText={v => setNewTrip(p => ({ ...p, price: v }))} />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Durée" value={newTrip.duration} onChangeText={v => setNewTrip(p => ({ ...p, duration: v }))} />
            </View>
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Nom du bus / compagnie *" value={newTrip.busName} onChangeText={v => setNewTrip(p => ({ ...p, busName: v }))} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Type (VIP/Standard)" value={newTrip.busType} onChangeText={v => setNewTrip(p => ({ ...p, busType: v }))} />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Nb places" keyboardType="numeric" value={newTrip.totalSeats} onChangeText={v => setNewTrip(p => ({ ...p, totalSeats: v }))} />
            </View>
            <View style={[S.modalBtns, { marginTop: 16 }]}>
              <Pressable style={S.modalCancel} onPress={() => { setAddTripModal(false); setTripError(""); }}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: PRIMARY, opacity: tripSaving ? 0.7 : 1 }]} onPress={createTrip} disabled={tripSaving}>
                {tripSaving ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>Créer le trajet</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* ══ Modal : Modifier un trajet ═══════════════════════════════ */}
      <Modal visible={editTripModal} transparent animationType="slide">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.modalOverlay}>
          <View style={S.modalCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" }}>
                <Feather name="edit-2" size={16} color={PRIMARY} />
              </View>
              <View>
                <Text style={S.modalTitle}>Modifier le trajet</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>{selectedTrip?.from} → {selectedTrip?.to}</Text>
              </View>
            </View>
            {!!tripError && (
              <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
                <Feather name="alert-circle" size={13} color="#DC2626" />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" }}>{tripError}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Départ *" value={editTripForm.from} onChangeText={v => setEditTripForm(p => ({ ...p, from: v }))} />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Arrivée *" value={editTripForm.to} onChangeText={v => setEditTripForm(p => ({ ...p, to: v }))} />
            </View>
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Date (YYYY-MM-DD) *" value={editTripForm.date} onChangeText={v => setEditTripForm(p => ({ ...p, date: v }))} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Départ" value={editTripForm.departureTime} onChangeText={v => setEditTripForm(p => ({ ...p, departureTime: v }))} />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Arrivée" value={editTripForm.arrivalTime} onChangeText={v => setEditTripForm(p => ({ ...p, arrivalTime: v }))} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Prix (FCFA)" keyboardType="numeric" value={editTripForm.price} onChangeText={v => setEditTripForm(p => ({ ...p, price: v }))} />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Durée" value={editTripForm.duration} onChangeText={v => setEditTripForm(p => ({ ...p, duration: v }))} />
            </View>
            <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Nom du bus / compagnie" value={editTripForm.busName} onChangeText={v => setEditTripForm(p => ({ ...p, busName: v }))} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Type de bus" value={editTripForm.busType} onChangeText={v => setEditTripForm(p => ({ ...p, busType: v }))} />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Nb places" keyboardType="numeric" value={editTripForm.totalSeats} onChangeText={v => setEditTripForm(p => ({ ...p, totalSeats: v }))} />
            </View>
            <View style={[S.modalBtns, { marginTop: 16 }]}>
              <Pressable style={S.modalCancel} onPress={() => { setEditTripModal(false); setTripError(""); }}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: PRIMARY, opacity: tripSaving ? 0.7 : 1 }]} onPress={saveEditTrip} disabled={tripSaving}>
                {tripSaving ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>Enregistrer</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* ══ Modal : Créer compte staff ════════════════════════════════ */}
      <Modal visible={addUserModal} transparent animationType="slide">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.modalOverlay}>
          <View style={S.modalCard}>
            {provisionalCreds ? (
              <>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center", marginBottom: 10 }}>
                    <Feather name="check-circle" size={28} color="#059669" />
                  </View>
                  <Text style={[S.modalTitle, { textAlign: "center" }]}>Compte créé avec succès</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 4 }}>Communiquez ces identifiants provisoires à l'utilisateur</Text>
                </View>
                <View style={{ backgroundColor: "#F8FAFC", borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 }}>
                  {[{ label: "Nom", value: provisionalCreds.name, color: "#0F172A" }, { label: "Email (identifiant)", value: provisionalCreds.email, color: "#1A56DB" }].map(item => (
                    <View key={item.label} style={{ gap: 4 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</Text>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: item.color }}>{item.value}</Text>
                    </View>
                  ))}
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Mot de passe provisoire</Text>
                    <View style={{ backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#FDE68A" }}>
                      <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#92400E", letterSpacing: 2 }}>{provisionalCreds.password}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" }}>
                  <Feather name="alert-triangle" size={14} color="#DC2626" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626" }}>Notez ce mot de passe maintenant. Il ne sera plus affiché après fermeture de cette fenêtre.</Text>
                </View>
                <Pressable style={[S.modalConfirm, { backgroundColor: PURPLE }]} onPress={() => { setAddUserModal(false); setProvisionalCreds(null); }}>
                  <Text style={S.modalConfirmText}>Fermer</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={S.modalTitle}>Créer un compte</Text>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", marginBottom: 16 }}>Réservé aux rôles Agent, Compagnie et Admin</Text>
                {!!staffError && (
                  <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
                    <Feather name="alert-circle" size={13} color="#DC2626" />
                    <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" }}>{staffError}</Text>
                  </View>
                )}
                <TextInput style={S.modalInput} placeholder="Nom complet *" value={newStaff.name} onChangeText={v => { setNewStaff(p => ({ ...p, name: v })); setStaffError(""); }} autoCapitalize="words" />
                <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Email *" keyboardType="email-address" autoCapitalize="none" value={newStaff.email} onChangeText={v => { setNewStaff(p => ({ ...p, email: v })); setStaffError(""); }} />
                <TextInput style={[S.modalInput, { marginTop: 10 }]} placeholder="Téléphone (optionnel)" keyboardType="phone-pad" value={newStaff.phone} onChangeText={v => setNewStaff(p => ({ ...p, phone: v }))} />
                <View style={{ marginTop: 10 }}>
                  <TextInput style={S.modalInput} placeholder="Mot de passe provisoire (laisser vide = auto)" autoCapitalize="none" autoCorrect={false} value={newStaff.password} onChangeText={v => setNewStaff(p => ({ ...p, password: v }))} />
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 4 }}>Laissez vide pour générer automatiquement un mot de passe sécurisé (format GB…)</Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A", marginTop: 14, marginBottom: 8 }}>Type de compte *</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {([
                    { key: "agent",     label: "Agent",     icon: "briefcase", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
                    { key: "compagnie", label: "Compagnie", icon: "truck",     color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
                    { key: "admin",     label: "Admin",     icon: "shield",    color: PURPLE,    bg: "#F5F3FF", border: "#DDD6FE" },
                  ] as const).map(r => {
                    const active = newStaff.role === r.key;
                    return (
                      <Pressable key={r.key} style={{ flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12, borderWidth: active ? 2 : 1.5, borderColor: active ? r.color : "#E2E8F0", backgroundColor: active ? r.bg : "#F8FAFC", gap: 4 }} onPress={() => setNewStaff(p => ({ ...p, role: r.key }))}>
                        <Feather name={r.icon} size={18} color={active ? r.color : "#94A3B8"} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: active ? r.color : "#64748B" }}>{r.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={S.modalBtns}>
                  <Pressable style={S.modalCancel} onPress={() => { setAddUserModal(false); setStaffError(""); }}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
                  <Pressable style={[S.modalConfirm, { backgroundColor: PURPLE, opacity: staffCreating ? 0.7 : 1 }]} onPress={createStaffAccount} disabled={staffCreating}>
                    {staffCreating ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>Créer le compte</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </Modal>

      {/* ══ Modal : Modifier utilisateur ════════════════════════════ */}
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
                { key: "agent", label: "Agent", icon: "briefcase", color: "#059669", bg: "#ECFDF5" },
                { key: "compagnie", label: "Compagnie", icon: "truck", color: "#D97706", bg: "#FFFBEB" },
                { key: "admin", label: "Admin", icon: "shield", color: PURPLE, bg: "#F5F3FF" },
              ] as const).map(r => {
                const active = editForm.role === r.key;
                return (
                  <Pressable key={r.key} style={{ flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 10, borderWidth: active ? 2 : 1.5, borderColor: active ? r.color : "#E2E8F0", backgroundColor: active ? r.bg : "#F8FAFC", gap: 4 }} onPress={() => setEditForm(p => ({ ...p, role: r.key }))}>
                    <Feather name={r.icon} size={16} color={active ? r.color : "#94A3B8"} />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: active ? r.color : "#64748B" }}>{r.label}</Text>
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

      {/* ══ Modal : Confirmation (user) ══════════════════════════════ */}
      <Modal visible={!!confirmAction} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <View style={[S.modalCard, { maxWidth: 340, alignSelf: "center" }]}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", backgroundColor: confirmAction?.type === "delete" ? "#FEF2F2" : confirmAction?.type === "deactivate" ? "#FFFBEB" : "#ECFDF5" }}>
                <Feather name={confirmAction?.type === "delete" ? "trash-2" : confirmAction?.type === "deactivate" ? "pause-circle" : "play-circle"} size={24} color={confirmAction?.type === "delete" ? "#DC2626" : confirmAction?.type === "deactivate" ? "#D97706" : "#059669"} />
              </View>
            </View>
            <Text style={[S.modalTitle, { textAlign: "center" }]}>
              {confirmAction?.type === "delete" ? "Supprimer le compte" : confirmAction?.type === "deactivate" ? "Désactiver le compte" : "Réactiver le compte"}
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 6, marginBottom: 20 }}>
              {confirmAction?.type === "delete" ? `Supprimer définitivement "${confirmAction?.user.name}" ? Cette action est irréversible.` : confirmAction?.type === "deactivate" ? `"${confirmAction?.user.name}" ne pourra plus se connecter.` : `"${confirmAction?.user.name}" pourra de nouveau se connecter.`}
            </Text>
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setConfirmAction(null)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable
                style={[S.modalConfirm, { backgroundColor: confirmAction?.type === "delete" ? "#DC2626" : confirmAction?.type === "deactivate" ? "#D97706" : "#059669", opacity: confirmLoading ? 0.7 : 1 }]}
                onPress={confirmAction?.type === "delete" ? handleDeleteUser : handleToggleStatus}
                disabled={confirmLoading}
              >
                {confirmLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>{confirmAction?.type === "delete" ? "Supprimer" : confirmAction?.type === "deactivate" ? "Désactiver" : "Réactiver"}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Modal : Confirmation suppression trajet ══════════════════ */}
      <Modal visible={!!confirmDeleteTrip} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <View style={[S.modalCard, { maxWidth: 340, alignSelf: "center" }]}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center" }}>
                <Feather name="trash-2" size={24} color="#DC2626" />
              </View>
            </View>
            <Text style={[S.modalTitle, { textAlign: "center" }]}>Supprimer le trajet</Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 6, marginBottom: 20 }}>
              Supprimer {confirmDeleteTrip?.from} → {confirmDeleteTrip?.to} du {confirmDeleteTrip?.date} ? Cette action est irréversible.
            </Text>
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setConfirmDeleteTrip(null)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, { backgroundColor: "#DC2626", opacity: confirmLoading ? 0.7 : 1 }]} onPress={deleteTrip} disabled={confirmLoading}>
                {confirmLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={S.modalConfirmText}>Supprimer</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Modal : MDP réinitialisé ════════════════════════════════ */}
      <Modal visible={!!resetPwdResult} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <View style={[S.modalCard, { maxWidth: 340, alignSelf: "center" }]}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center" }}>
                <Feather name="refresh-cw" size={24} color={PURPLE} />
              </View>
            </View>
            <Text style={[S.modalTitle, { textAlign: "center" }]}>Mot de passe réinitialisé</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 4, marginBottom: 12 }}>{resetPwdResult?.name} · {resetPwdResult?.email}</Text>
            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#92400E", marginBottom: 6 }}>NOUVEAU MOT DE PASSE PROVISOIRE</Text>
              <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#92400E", letterSpacing: 3 }}>{resetPwdResult?.password}</Text>
            </View>
            <View style={{ backgroundColor: "#FEF2F2", borderRadius: 8, padding: 10, flexDirection: "row", gap: 8, marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" }}>
              <Feather name="alert-triangle" size={13} color="#DC2626" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626" }}>Communiquez ce mot de passe à l'utilisateur. Il ne sera plus affiché.</Text>
            </View>
            <Pressable style={[S.modalConfirm, { backgroundColor: PURPLE }]} onPress={() => setResetPwdResult(null)}>
              <Text style={S.modalConfirmText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ══ Sidebar Drawer ═══════════════════════════════════════════ */}
      {sidebarOpen && (
        <Animated.View
          style={[S.sidebarOverlay, { opacity: overlayAnim }]}
          pointerEvents={sidebarOpen ? "auto" : "none"}
        >
          <Pressable style={{ flex: 1 }} onPress={closeSidebar} />
        </Animated.View>
      )}

      <Animated.View style={[S.sidebarDrawer, { transform: [{ translateX: sidebarAnim }] }, { paddingTop: topPad }]}>
        {/* ── Brand header ── */}
        <LinearGradient colors={[PURPLE, "#5B21B6"]} style={S.sidebarHeader}>
          <View style={S.sidebarBrand}>
            <View style={S.sidebarLogo}>
              <Feather name="navigation" size={20} color={PURPLE} />
            </View>
            <View>
              <Text style={S.sidebarBrandName}>GoBooking</Text>
              <Text style={S.sidebarBrandSub}>Côte d'Ivoire</Text>
            </View>
          </View>
          <View style={S.sidebarAdminRow}>
            <View style={S.sidebarAdminAvatar}>
              <Feather name="shield" size={14} color={PURPLE} />
            </View>
            <View>
              <Text style={S.sidebarAdminName}>Super Administrateur</Text>
              <Text style={S.sidebarAdminRole}>Accès complet</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Nav items ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.sidebarNav} showsVerticalScrollIndicator={false}>
          {SIDEBAR_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[S.sidebarItem, isActive && S.sidebarItemActive]}
                onPress={() => navigateTo(item.id)}
                activeOpacity={0.75}
              >
                <View style={[S.sidebarItemIcon, isActive && S.sidebarItemIconActive]}>
                  <Feather name={item.icon as never} size={17} color={isActive ? PURPLE : "#64748B"} />
                </View>
                <Text style={[S.sidebarItemLabel, isActive && S.sidebarItemLabelActive]}>
                  {item.label}
                </Text>
                {isActive && <View style={S.sidebarItemDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Bottom actions ── */}
        <View style={[S.sidebarFooter, { paddingBottom: bottomPad + 16 }]}>
          <View style={S.sidebarDivider} />
          <TouchableOpacity style={S.sidebarLogout} onPress={handleLogout} activeOpacity={0.75}>
            <View style={S.sidebarLogoutIcon}>
              <Feather name="log-out" size={17} color="#DC2626" />
            </View>
            <Text style={S.sidebarLogoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#F8FAFC" },
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerTitle:      { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },
  headerSub:        { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 1 },
  menuBtn:          { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  roleBadge:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  roleBadgeText:    { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  /* sidebar */
  sidebarOverlay:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 100 },
  sidebarDrawer:    { position: "absolute", top: 0, left: 0, bottom: 0, width: SIDEBAR_W, backgroundColor: "white", zIndex: 101, shadowColor: "#000", shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 20 },
  sidebarHeader:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  sidebarBrand:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  sidebarLogo:      { width: 42, height: 42, borderRadius: 14, backgroundColor: "white", justifyContent: "center", alignItems: "center" },
  sidebarBrandName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  sidebarBrandSub:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 1 },
  sidebarAdminRow:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 10 },
  sidebarAdminAvatar:{ width: 34, height: 34, borderRadius: 10, backgroundColor: "white", justifyContent: "center", alignItems: "center" },
  sidebarAdminName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },
  sidebarAdminRole: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 1 },
  sidebarNav:       { paddingHorizontal: 12, paddingVertical: 16, gap: 4 },
  sidebarItem:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  sidebarItemActive:{ backgroundColor: "#F5F3FF" },
  sidebarItemIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  sidebarItemIconActive: { backgroundColor: "#EDE9FE" },
  sidebarItemLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#475569" },
  sidebarItemLabelActive: { color: PURPLE, fontFamily: "Inter_600SemiBold" },
  sidebarItemDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: PURPLE },
  sidebarFooter:    { paddingHorizontal: 12 },
  sidebarDivider:   { height: 1, backgroundColor: "#F1F5F9", marginBottom: 8 },
  sidebarLogout:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 13, borderRadius: 12, backgroundColor: "#FEF2F2" },
  sidebarLogoutIcon:{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FECACA", justifyContent: "center", alignItems: "center" },
  sidebarLogoutText:{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
  sectionRow:       { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  sectionTitle:     { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A" },
  subLabel:         { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 },
  addBtn:           { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:       { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },
  filterChip:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#F5F3FF", borderColor: PURPLE },
  filterChipText:   { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B" },
  filterChipTextActive: { color: PURPLE, fontFamily: "Inter_600SemiBold" },
  listCard:         { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  listTitle:        { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  listSub:          { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  badge:            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText:        { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  userCard:         { backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  userCardInactive: { opacity: 0.65 },
  userAvatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
  userAvatarText:   { fontSize: 15, fontFamily: "Inter_700Bold", color: "white" },
  statusDot:        { width: 6, height: 6, borderRadius: 3 },
  actionMenuBtn:    { width: 32, height: 32, borderRadius: 8, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
  actionMenu:       { marginTop: 10, backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#F1F5F9", overflow: "hidden" },
  actionMenuItem:   { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  actionMenuText:   { fontSize: 13, fontFamily: "Inter_500Medium" },
  actionMenuDivider:{ height: 1, backgroundColor: "#F1F5F9" },
  companyIcon:      { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center" },
  tripCard:         { backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  tripIcon:         { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  tripRoute:        { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  iconBtn:          { width: 32, height: 32, borderRadius: 8, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  bookingCard:      { backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  bookingRefBadge:  { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  bookingRef:       { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  bookingDetails:   { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9", gap: 6 },
  detailRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText:       { fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569" },
  statusActionBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statusActionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyState:       { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyStateText:   { fontSize: 14, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  revenueCard:      { borderRadius: 18, overflow: "hidden" },
  revenueGradient:  { padding: 22, gap: 4 },
  revenueLabel:     { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  revenueValue:     { fontSize: 32, fontFamily: "Inter_700Bold", color: "white" },
  revenueSub:       { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  revenueSmallCard: { backgroundColor: PURPLE, borderRadius: 14, padding: 16, gap: 2 },
  revenueSmallLabel:{ fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  revenueSmallValue:{ fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  revenueSmallSub:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  statsGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard:         { flex: 1, minWidth: "44%", backgroundColor: "white", borderRadius: 14, padding: 14, borderLeftWidth: 3, gap: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statIcon:         { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  statValue:        { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  statLabel:        { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  statsSummaryRow:  { flexDirection: "row", gap: 8 },
  summaryCard:      { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12, alignItems: "center", borderTopWidth: 3, gap: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  summaryValue:     { fontSize: 17, fontFamily: "Inter_700Bold" },
  summaryLabel:     { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" },
  statBarCard:      { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statBarIcon:      { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  statBarTop:       { flexDirection: "row", justifyContent: "space-between" },
  statBarName:      { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  statBarPct:       { fontSize: 13, fontFamily: "Inter_700Bold", color: "#64748B" },
  statBarAmount:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  barBg:            { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
  barFill:          { height: 6, borderRadius: 3 },
  pieRow:           { flexDirection: "row", gap: 8 },
  pieCard:          { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 14, alignItems: "center", borderLeftWidth: 3, gap: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  pieCircle:        { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  pieNum:           { fontSize: 16, fontFamily: "Inter_700Bold" },
  pieLabel:         { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  piePct:           { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  routeStatCard:    { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  routeStatRank:    { fontSize: 13, fontFamily: "Inter_700Bold", color: "#94A3B8", width: 22 },
  routeStatName:    { fontSize: 13, fontFamily: "Inter_500Medium", color: "#0F172A", marginBottom: 4 },
  routeStatTrips:   { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#64748B", minWidth: 70, textAlign: "right" },
  citiesGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cityChip:         { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "white", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cityName:         { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  cityRegion:       { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  payCard:          { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  payMethodIcon:    { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  payRef:           { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  payAmount:        { fontSize: 14, fontFamily: "Inter_700Bold" },
  /* commission */
  commCard:         { backgroundColor: "white", borderRadius: 16, padding: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  commRevCard:      { flex: 1, borderRadius: 16, padding: 18, alignItems: "flex-start", gap: 2 },
  commRevValue:     { fontSize: 24, fontFamily: "Inter_700Bold", color: "white" },
  commRevLabel:     { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  modalOverlay:     { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end", padding: 0 },
  modalCard:        { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, maxHeight: "90%" },
  modalTitle:       { fontSize: 17, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 16 },
  modalInput:       { backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#0F172A" },
  modalBtns:        { flexDirection: "row", gap: 10 },
  modalCancel:      { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", alignItems: "center" },
  modalCancelText:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  modalConfirm:     { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalConfirmText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
});
