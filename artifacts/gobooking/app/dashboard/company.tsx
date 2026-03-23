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
  Share,
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
import DashboardCharts from "@/components/DashboardCharts";

const PRIMARY = Colors.light.primary;
const DARK = Colors.light.primaryDark;

/* ─── Types ─────────────────────────────────────────────── */
interface Stats { totalBuses: number; totalAgents: number; totalTrips: number; totalReservations: number; totalParcels: number; totalRevenue: number; activeBuses: number }
interface Analytics {
  kpis: { totalBookings: number; totalRevenue: number; bookingRevenue: number; parcelRevenue: number; totalParcels: number };
  byStatus: { confirmed: number; boarded: number; cancelled: number; pending: number };
  byMethod: { method: string; count: number; revenue: number }[];
  dailyBookings: { date: string; count: number; revenue: number }[];
  parcelByStatus: Record<string, number>;
}
interface Bus { id: string; busName: string; plateNumber: string; busType: string; capacity: number; status: string }
interface Trip { id: string; from: string; to: string; date: string; departureTime: string; arrivalTime: string; price: number; totalSeats: number; busName: string; duration: string; status?: string }
interface Reservation { id: string; bookingRef: string; tripId: string; totalAmount: number; status: string; paymentMethod: string; passengers: { name: string; seatNumber: string }[]; seatNumbers: string[]; createdAt: string }
interface SeatItem { id: string; number: string; row: number; column: number; type: string; status: string; price: number; bookingRef?: string | null; bookingStatus?: string | null; passenger?: { name: string; seatNumber: string } | null }
interface Parcel { id: string; trackingRef: string; fromCity: string; toCity: string; senderName: string; receiverName: string; weight: number; status: string; amount: number }
interface AgentItem { id: string; name: string; agentCode: string; phone: string; bus: string; busId: string; status: string }
interface WalletTx { id: string; bookingRef?: string | null; type: string; grossAmount: number; commissionAmount: number; netAmount: number; description?: string | null; createdAt: string }
interface WalletData { balance: number; totalGross: number; totalCommission: number; totalNet: number; transactions: WalletTx[] }
interface Invoice { id: string; period: string; totalGross: number; totalCommission: number; totalNet: number; transactionCount: number; status: string; paidAt: string | null; createdAt: string }
interface SubscriptionPlan { id: string; name: string; priceMonthly: number; maxReservations: number | null; maxTrips: number | null; features: string[] }
interface CompanySubscription { id: string; companyId: string; planId: string; status: string; startDate: string; endDate: string | null; autoRenew: boolean; plan: SubscriptionPlan }

/* ─── Demo data ─────────────────────────────────────────── */
const DEMO_STATS: Stats = { totalBuses: 12, totalAgents: 18, totalTrips: 284, totalReservations: 1_420, totalParcels: 638, totalRevenue: 8_760_000, activeBuses: 9 };

const DEMO_BUSES: Bus[] = [
  { id: "b1", busName: "Express Abidjan 01", plateNumber: "0258 AB 01", busType: "Premium", capacity: 49, status: "active" },
  { id: "b2", busName: "Bouaké Direct 02",   plateNumber: "0258 AB 02", busType: "Standard", capacity: 59, status: "active" },
  { id: "b3", busName: "Yamoussoukro 03",    plateNumber: "0258 AB 03", busType: "Standard", capacity: 63, status: "maintenance" },
  { id: "b4", busName: "Korhogo Express 04", plateNumber: "0258 AB 04", busType: "VIP",      capacity: 49, status: "active" },
  { id: "b5", busName: "San Pedro 05",       plateNumber: "0258 AB 05", busType: "Standard", capacity: 59, status: "active" },
];

const DEMO_TRIPS: Trip[] = [
  { id: "t1", from: "Abidjan", to: "Bouaké",        date: "23/03/2026", departureTime: "08h00", arrivalTime: "12h00", price: 3500, totalSeats: 49, busName: "Express Abidjan 01", duration: "4h00", status: "en_route" },
  { id: "t2", from: "Abidjan", to: "Yamoussoukro",  date: "23/03/2026", departureTime: "09h00", arrivalTime: "12h30", price: 2000, totalSeats: 59, busName: "Bouaké Direct 02",   duration: "3h30", status: "scheduled" },
  { id: "t3", from: "Abidjan", to: "Korhogo",       date: "24/03/2026", departureTime: "07h00", arrivalTime: "15h00", price: 6000, totalSeats: 63, busName: "Yamoussoukro 03",    duration: "8h00", status: "scheduled" },
  { id: "t4", from: "Bouaké",  to: "Korhogo",       date: "22/03/2026", departureTime: "10h00", arrivalTime: "14h00", price: 2500, totalSeats: 49, busName: "Express Abidjan 01", duration: "4h00", status: "completed" },
  { id: "t5", from: "San Pedro", to: "Abidjan",     date: "21/03/2026", departureTime: "06h00", arrivalTime: "12h00", price: 3000, totalSeats: 59, busName: "San Pedro 05",       duration: "6h00", status: "completed" },
];

const DEMO_RESERVATIONS: Reservation[] = [
  { id: "r1", bookingRef: "GBB5AKZ8DZ", tripId: "t1", totalAmount: 7000, status: "confirmed",  paymentMethod: "orange", passengers: [{ name: "Kouassi Ama", seatNumber: "A3" }, { name: "Traoré Youssouf", seatNumber: "A4" }], seatNumbers: ["A3","A4"], createdAt: "2026-03-17T08:00:00Z" },
  { id: "r2", bookingRef: "GBB9MNX2PL", tripId: "t1", totalAmount: 3500, status: "boarded",    paymentMethod: "mtn",    passengers: [{ name: "Bamba Koffi", seatNumber: "B1" }], seatNumbers: ["B1"], createdAt: "2026-03-17T07:30:00Z" },
  { id: "r3", bookingRef: "GBBA1C3RQ7", tripId: "t2", totalAmount: 4000, status: "confirmed",  paymentMethod: "wave",   passengers: [{ name: "Diallo Mariam", seatNumber: "C2" }, { name: "Diallo Seydou", seatNumber: "C3" }], seatNumbers: ["C2","C3"], createdAt: "2026-03-16T15:00:00Z" },
  { id: "r4", bookingRef: "GBB7FPV6NM", tripId: "t3", totalAmount: 6000, status: "confirmed",  paymentMethod: "orange", passengers: [{ name: "Coulibaly Jean", seatNumber: "D5" }], seatNumbers: ["D5"], createdAt: "2026-03-16T12:00:00Z" },
  { id: "r5", bookingRef: "GBBC5XK0TZ", tripId: "t2", totalAmount: 2000, status: "cancelled",  paymentMethod: "visa",   passengers: [{ name: "Assiéta Koné", seatNumber: "E1" }], seatNumbers: ["E1"], createdAt: "2026-03-15T10:00:00Z" },
];

const DEMO_PARCELS: Parcel[] = [
  { id: "p1", trackingRef: "GBX-A4F2-KM91", fromCity: "Abidjan",   toCity: "Bouaké",       senderName: "Assiéta Koné",   receiverName: "Diabaté Oumar",  weight: 4.5, status: "en_transit",     amount: 4700 },
  { id: "p2", trackingRef: "GBX-B9C3-PL44", fromCity: "San Pedro", toCity: "Abidjan",      senderName: "Traoré Adama",   receiverName: "Koffi Ama",      weight: 1.2, status: "livre",          amount: 6200 },
  { id: "p3", trackingRef: "GBX-C1E7-QR22", fromCity: "Abidjan",   toCity: "Yamoussoukro", senderName: "Bamba Sali",     receiverName: "Coulibaly Jean", weight: 2.1, status: "en_attente",     amount: 3500 },
  { id: "p4", trackingRef: "GBX-D5F8-MN33", fromCity: "Abidjan",   toCity: "Korhogo",      senderName: "Koffi Ama",      receiverName: "Diallo Jean",    weight: 8.0, status: "pris_en_charge", amount: 8100 },
  { id: "p5", trackingRef: "GBX-E2G9-XY77", fromCity: "Bouaké",    toCity: "Abidjan",      senderName: "Traoré Mamadou", receiverName: "Coulibaly Sali", weight: 3.0, status: "en_livraison",  amount: 5200 },
];

const DEMO_AGENTS: AgentItem[] = [
  { id: "a1", name: "Kouassi Jean",     agentCode: "AGT-001", phone: "0707 11 22 33", bus: "Express Abidjan 01", busId: "b1", status: "active" },
  { id: "a2", name: "Traoré Mamadou",   agentCode: "AGT-002", phone: "0505 44 55 66", bus: "Bouaké Direct 02",  busId: "b2", status: "active" },
  { id: "a3", name: "Bamba Fatima",     agentCode: "AGT-003", phone: "0101 77 88 99", bus: "Korhogo Express 04",busId: "b4", status: "active" },
  { id: "a4", name: "Diallo Seydou",    agentCode: "AGT-004", phone: "0707 22 33 44", bus: "Non assigné",       busId: "",   status: "inactive" },
  { id: "a5", name: "Coulibaly Koffi",  agentCode: "AGT-005", phone: "0505 55 66 77", bus: "Yamoussoukro 03",   busId: "b3", status: "active" },
  { id: "a6", name: "Assiéta Koné",     agentCode: "AGT-006", phone: "0101 88 99 00", bus: "San Pedro 05",      busId: "b5", status: "active" },
];

/* ─── Seat grid generator ────────────────────────────────── */
function genDemoSeats(tripId: string, total: number, booked: number): SeatItem[] {
  const seats: SeatItem[] = [];
  const letters = ["A", "B", "C", "D"];
  const rows = Math.ceil(total / 4);
  let idx = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < 4; c++) {
      idx++;
      if (idx > total) break;
      const num = `${letters[c]}${r}`;
      seats.push({ id: `${tripId}-${num}`, number: num, row: r, column: c, type: c === 1 ? "window" : "aisle", status: idx <= booked ? "booked" : "available", price: 3500 });
    }
  }
  return seats;
}

/* ─── Status helpers ─────────────────────────────────────── */
const PARCEL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:          { label: "En attente",      color: "#B45309", bg: "#FFFBEB" },
  confirme:            { label: "Confirmé",         color: "#1D4ED8", bg: "#EFF6FF" },
  en_cours_ramassage:  { label: "Ramassage",        color: "#7C3AED", bg: "#F5F3FF" },
  arrive_gare_depart:  { label: "Gare départ",      color: "#0E7490", bg: "#ECFEFF" },
  pris_en_charge:      { label: "Pris en charge",   color: "#1D4ED8", bg: "#EFF6FF" },
  en_transit:          { label: "En transit",       color: "#6D28D9", bg: "#F5F3FF" },
  arrive_destination:  { label: "Arrivé dest.",     color: "#D97706", bg: "#FEF3C7" },
  en_livraison:        { label: "En livraison",     color: "#0E7490", bg: "#ECFEFF" },
  livre:               { label: "Livré",            color: "#065F46", bg: "#ECFDF5" },
  annule:              { label: "Annulé",           color: "#DC2626", bg: "#FEF2F2" },
};
const BOOKING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Confirmé",   color: PRIMARY,   bg: "#EEF2FF" },
  boarded:   { label: "Embarqué",   color: "#065F46", bg: "#ECFDF5" },
  cancelled: { label: "Annulé",     color: "#DC2626", bg: "#FEF2F2" },
  pending:   { label: "En attente", color: "#B45309", bg: "#FFFBEB" },
};
const PAYMENT_LABELS: Record<string, string> = {
  orange: "Orange Money", mtn: "MTN MoMo", wave: "Wave", visa: "Visa/MC",
};
const CI_CITIES = ["Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pedro", "Man", "Daloa", "Divo", "Gagnoa", "Abengourou"];
const BUS_CAPACITIES = [49, 59, 63];
const BUS_TYPES = ["Standard", "Premium", "VIP"];

const DEMO_WALLET: WalletData = {
  balance: 1_280_500, totalGross: 1_423_000, totalCommission: 142_500, totalNet: 1_280_500,
  transactions: [
    { id: "wt1", bookingRef: "GBB5AKZ8DZ", type: "credit", grossAmount: 14000, commissionAmount: 1400, netAmount: 12600, description: "Réservation GBB5AKZ8DZ — Abidjan → Bouaké", createdAt: new Date(Date.now() - 3_600_000).toISOString() },
    { id: "wt2", bookingRef: "GBB9MNX2PL", type: "credit", grossAmount: 5000,  commissionAmount: 500,  netAmount: 4500,  description: "Réservation GBB9MNX2PL — Abidjan → Yamoussoukro", createdAt: new Date(Date.now() - 7_200_000).toISOString() },
    { id: "wt3", bookingRef: "GBB7FPV6NM", type: "credit", grossAmount: 7000,  commissionAmount: 700,  netAmount: 6300,  description: "Réservation GBB7FPV6NM — Abidjan → Bouaké", createdAt: new Date(Date.now() - 86_400_000).toISOString() },
    { id: "wt4", bookingRef: "GBB2VT9KLM", type: "credit", grossAmount: 8000,  commissionAmount: 800,  netAmount: 7200,  description: "Réservation GBB2VT9KLM — Abidjan → Daloa", createdAt: new Date(Date.now() - 172_800_000).toISOString() },
    { id: "wt5", bookingRef: "GBB8WR4XNP", type: "credit", grossAmount: 10000, commissionAmount: 1000, netAmount: 9000,  description: "Réservation GBB8WR4XNP — Abidjan → Yamoussoukro", createdAt: new Date(Date.now() - 259_200_000).toISOString() },
  ],
};

const DEMO_ANALYTICS: Analytics = {
  kpis: { totalBookings: 1420, totalRevenue: 8_760_000, bookingRevenue: 7_100_000, parcelRevenue: 1_660_000, totalParcels: 638 },
  byStatus: { confirmed: 924, boarded: 312, cancelled: 87, pending: 97 },
  byMethod: [
    { method: "orange", count: 540, revenue: 2_840_000 },
    { method: "mtn",    count: 380, revenue: 2_120_000 },
    { method: "wave",   count: 290, revenue: 1_540_000 },
    { method: "card",   count: 123, revenue: 600_000   },
  ],
  dailyBookings: Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return { date: d.toISOString().slice(0, 10), count: 40 + Math.round(Math.random() * 60), revenue: (40 + Math.round(Math.random() * 60)) * 3500 };
  }),
  parcelByStatus: { livre: 310, en_transit: 142, en_livraison: 88, en_attente: 58, pris_en_charge: 40 },
};

type Tab = "apercu" | "trajets" | "reservations" | "sieges" | "bus" | "colis" | "agents" | "portefeuille" | "factures" | "en_route" | "analytiques" | "abonnement";
type BoardingRequest = { id: string; tripId: string; clientName: string; clientPhone: string; boardingPoint: string; seatsRequested: number; status: string; createdAt: string };

/* ─── Reusable picker row ─────────────────────────────────── */
function PickerRow<T>({ label, options, value, onSelect, display }: { label: string; options: T[]; value: T; onSelect: (v: T) => void; display?: (v: T) => string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={S.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((opt, i) => {
          const active = opt === value;
          return (
            <Pressable key={i} onPress={() => onSelect(opt)} style={[S.pickerChip, active && S.pickerChipActive]}>
              <Text style={[S.pickerChipText, active && S.pickerChipTextActive]}>{display ? display(opt) : String(opt)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ─── City quick-select ──────────────────────────────────── */
function CityPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <TextInput style={S.modalInput} placeholder={label} value={value} onChangeText={onChange} placeholderTextColor="#94A3B8" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
        {CI_CITIES.map(city => (
          <Pressable key={city} onPress={() => onChange(city)} style={[S.cityChip, value === city && S.cityChipActive]}>
            <Text style={[S.cityChipText, value === city && S.cityChipTextActive]}>{city}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* ─── Bus selector ───────────────────────────────────────── */
function BusSelector({ buses, selected, onSelect }: { buses: Bus[]; selected: string; onSelect: (bus: Bus) => void }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={S.pickerLabel}>Bus assigné</Text>
      {buses.map(bus => {
        const active = selected === bus.id;
        return (
          <Pressable key={bus.id} onPress={() => onSelect(bus)} style={[S.busPickerRow, active && S.busPickerRowActive]}>
            <View style={[S.busPickerDot, { backgroundColor: active ? PRIMARY : "#E2E8F0" }]} />
            <View style={{ flex: 1 }}>
              <Text style={[S.busPickerName, active && { color: PRIMARY }]}>{bus.busName}</Text>
              <Text style={S.busPickerSub}>{bus.plateNumber} · {bus.busType} · {bus.capacity} places</Text>
            </View>
            {active && <Feather name="check-circle" size={16} color={PRIMARY} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Component ─────────────────────────────────────────── */
export default function CompanyDashboard() {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Voulez-vous vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: () => { logout(); router.replace("/(auth)/login"); },
        },
      ]
    );
  };
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("apercu");
  const [stats, setStats] = useState<Stats>(DEMO_STATS);
  const [buses, setBuses] = useState<Bus[]>(DEMO_BUSES);
  const [trips, setTrips] = useState<Trip[]>(DEMO_TRIPS);
  const [reservations, setReservations] = useState<Reservation[]>(DEMO_RESERVATIONS);
  const [parcels, setParcels] = useState<Parcel[]>(DEMO_PARCELS);
  const [agents, setAgents] = useState<AgentItem[]>(DEMO_AGENTS);
  const [walletData, setWalletData] = useState<WalletData>(DEMO_WALLET);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invGenerating, setInvGenerating] = useState(false);
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subChanging, setSubChanging] = useState(false);
  const [selectedTripForSeats, setSelectedTripForSeats] = useState<Trip>(DEMO_TRIPS[0]);
  const [seats, setSeats] = useState<SeatItem[]>(genDemoSeats("t1", 49, 31));
  const [selectedSeat, setSelectedSeat] = useState<SeatItem | null>(null);
  const [seatDetailModal, setSeatDetailModal] = useState(false);
  const [seatActionLoading, setSeatActionLoading] = useState(false);
  const [seatFilter, setSeatFilter] = useState<"all" | "available" | "booked" | "blocked">("all");
  const [reservationFilter, setReservationFilter] = useState<"all" | "confirmed" | "boarded" | "cancelled">("all");
  const [boardingRequests, setBoardingRequests]   = useState<BoardingRequest[]>([]);
  const [boardingLoading, setBoardingLoading]     = useState(false);
  const [tripFilter, setTripFilter] = useState<"all" | "scheduled" | "en_route" | "completed">("all");
  const [tripStatusLoading, setTripStatusLoading] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics>(DEMO_ANALYTICS);

  /* modal states */
  const [addBusModal, setAddBusModal] = useState(false);
  const [addTripModal, setAddTripModal] = useState(false);
  const [addAgentModal, setAddAgentModal] = useState(false);
  const [assignAgentModal, setAssignAgentModal] = useState<AgentItem | null>(null);
  const [addReservationModal, setAddReservationModal] = useState(false);
  const [addParcelModal, setAddParcelModal] = useState(false);

  /* form states */
  const [newBus, setNewBus] = useState({ busName: "", plateNumber: "", busType: "Standard", capacity: 49 });
  const [newTrip, setNewTrip] = useState({ from: "", to: "", date: "", departureTime: "", arrivalTime: "", price: "", busId: "", busName: "", totalSeats: 49 });
  const [newAgent, setNewAgent] = useState({ name: "", phone: "", agentCode: "", busId: "", busName: "" });
  const [newReservation, setNewReservation] = useState({ clientName: "", clientPhone: "", tripId: "", seatCount: "1", paymentMethod: "cash" });
  const [newParcel, setNewParcel] = useState({ senderName: "", senderPhone: "", receiverName: "", receiverPhone: "", fromCity: "Abidjan", toCity: "Bouaké", weight: "1", paymentMethod: "cash" });

  /* submission states */
  const [busSubmitting, setBusSubmitting] = useState(false);
  const [busError, setBusError] = useState("");
  const [reservationSubmitting, setReservationSubmitting] = useState(false);
  const [reservationError, setReservationError] = useState("");
  const [parcelSubmitting, setParcelSubmitting] = useState(false);
  const [parcelError, setParcelError] = useState("");

  const loadSubscription = () => {
    if (!token) return;
    setSubLoading(true);
    apiFetch<CompanySubscription>("/company/subscription", { token })
      .then(data => setSubscription(data))
      .catch(() => {})
      .finally(() => setSubLoading(false));
  };

  const changeSubscription = (planId: string) => {
    if (!token) return;
    setSubChanging(true);
    apiFetch<CompanySubscription>("/company/subscription", { token, method: "POST", body: { planId } })
      .then(data => { setSubscription(data); Alert.alert("Abonnement mis à jour", `Votre abonnement ${data.plan.name} est maintenant actif.`); })
      .catch(() => Alert.alert("Erreur", "Impossible de modifier l'abonnement. Veuillez réessayer."))
      .finally(() => setSubChanging(false));
  };

  const loadInvoices = () => {
    if (!token) return;
    setInvLoading(true);
    apiFetch<Invoice[]>("/company/invoices", { token })
      .then(data => setInvoices(data))
      .catch(() => {})
      .finally(() => setInvLoading(false));
  };

  const generateInvoice = () => {
    if (!token) return;
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setInvGenerating(true);
    apiFetch<Invoice>("/company/invoices/generate", { token, method: "POST", body: { period } })
      .then(inv => setInvoices(prev => [inv, ...prev.filter(i => i.period !== inv.period)]))
      .catch(() => Alert.alert("Erreur", "Impossible de générer la facture."))
      .finally(() => setInvGenerating(false));
  };

  const loadBoardingRequests = () => {
    if (!token) return;
    setBoardingLoading(true);
    apiFetch<BoardingRequest[]>("/company/boarding-requests", { token })
      .then(data => setBoardingRequests(data))
      .catch(() => {})
      .finally(() => setBoardingLoading(false));
  };

  const handleBoardingAction = (id: string, action: "accept" | "reject") => {
    if (!token) return;
    const endpoint = `/company/boarding-requests/${id}/${action}`;
    apiFetch<{ success: boolean }>(endpoint, { token, method: "POST" })
      .then(() => loadBoardingRequests())
      .catch(() => Alert.alert("Erreur", "Impossible de traiter la demande."));
  };

  const handleTripStatus = (tripId: string, action: "start" | "end") => {
    setTripStatusLoading(tripId);
    const endpoint = `/company/trips/${tripId}/${action}`;
    const newStatus = action === "start" ? "en_route" : "completed";
    (token
      ? apiFetch<{ success: boolean; status: string }>(endpoint, { token, method: "POST" })
      : Promise.resolve({ success: true, status: newStatus })
    )
      .then(() => {
        setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: newStatus } : t));
      })
      .catch(() => Alert.alert("Erreur", "Impossible de modifier le statut du trajet."))
      .finally(() => setTripStatusLoading(null));
  };

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      apiFetch<Stats>("/company/stats",     { token }),
      apiFetch<Bus[]>("/company/buses",     { token }),
      apiFetch<Trip[]>("/company/trips",    { token }),
      apiFetch<Reservation[]>("/company/reservations", { token }),
      apiFetch<Parcel[]>("/company/parcels",{ token }),
      apiFetch<WalletData>("/company/wallet",{ token }),
      apiFetch<Analytics>("/company/analytics", { token }),
    ]).then(([s, b, t, r, p, w, a]) => {
      if (s.status === "fulfilled") setStats(s.value);
      if (b.status === "fulfilled" && b.value.length > 0) setBuses(b.value);
      if (t.status === "fulfilled" && t.value.length > 0) setTrips(t.value);
      if (r.status === "fulfilled" && r.value.length > 0) setReservations(r.value);
      if (p.status === "fulfilled" && p.value.length > 0) setParcels(p.value);
      if (w.status === "fulfilled") setWalletData(w.value);
      if (a.status === "fulfilled") setAnalytics(a.value);
    });
    loadBoardingRequests();
    loadInvoices();
    loadSubscription();
  }, [token]);

  const confirmReservation = async (reservationId: string) => {
    Alert.alert("Confirmer la réservation", "Confirmer cette réservation ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer",
        onPress: async () => {
          setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, status: "confirmed" } : r));
          if (token) {
            try {
              await apiFetch(`/bookings/${reservationId}/company-confirm`, { token, method: "POST" });
            } catch {}
          }
        },
      },
    ]);
  };

  const cancelReservation = async (reservationId: string) => {
    Alert.alert("Annuler la réservation", "Annuler définitivement cette réservation ?", [
      { text: "Non", style: "cancel" },
      {
        text: "Annuler la réservation",
        style: "destructive",
        onPress: async () => {
          setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, status: "cancelled" } : r));
          if (token) {
            try {
              await apiFetch(`/bookings/${reservationId}/cancel`, { token, method: "POST" });
            } catch {}
          }
        },
      },
    ]);
  };

  const updateParcelStatus = async (parcelId: string, newStatus: string) => {
    setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: newStatus } : p));
    if (token) {
      try { await apiFetch(`/parcels/${parcelId}/status`, { token, method: "PATCH", body: { status: newStatus } }); } catch {}
    }
  };

  const handleCreateReservation = async () => {
    const { clientName, clientPhone, tripId, seatCount, paymentMethod } = newReservation;
    if (!clientName.trim()) { setReservationError("Le nom du client est obligatoire."); return; }
    if (!tripId) { setReservationError("Veuillez sélectionner un trajet."); return; }
    setReservationError("");
    setReservationSubmitting(true);
    try {
      const created = await apiFetch<Reservation>("/company/reservations", {
        token: token!, method: "POST",
        body: { clientName: clientName.trim(), clientPhone: clientPhone.trim(), tripId, seatCount: Number(seatCount) || 1, paymentMethod },
      });
      setReservations(prev => [created, ...prev]);
      setAddReservationModal(false);
      setNewReservation({ clientName: "", clientPhone: "", tripId: "", seatCount: "1", paymentMethod: "cash" });
      Alert.alert("Réservation créée", `Réf : ${created.bookingRef}`);
    } catch (e: any) {
      setReservationError(e?.message || "Échec de la création. Vérifiez les données.");
    } finally { setReservationSubmitting(false); }
  };

  const handleCreateParcel = async () => {
    const { senderName, senderPhone, receiverName, receiverPhone, fromCity, toCity, weight, paymentMethod } = newParcel;
    if (!senderName.trim()) { setParcelError("Le nom de l'expéditeur est obligatoire."); return; }
    if (!receiverName.trim()) { setParcelError("Le nom du destinataire est obligatoire."); return; }
    if (!fromCity || !toCity) { setParcelError("Villes de départ et d'arrivée obligatoires."); return; }
    if (fromCity === toCity) { setParcelError("Les villes de départ et d'arrivée doivent être différentes."); return; }
    setParcelError("");
    setParcelSubmitting(true);
    try {
      const created = await apiFetch<Parcel>("/company/parcels", {
        token: token!, method: "POST",
        body: { senderName: senderName.trim(), senderPhone: senderPhone.trim(), receiverName: receiverName.trim(), receiverPhone: receiverPhone.trim(), fromCity, toCity, weight, paymentMethod },
      });
      setParcels(prev => [created, ...prev]);
      setAddParcelModal(false);
      setNewParcel({ senderName: "", senderPhone: "", receiverName: "", receiverPhone: "", fromCity: "Abidjan", toCity: "Bouaké", weight: "1", paymentMethod: "cash" });
      Alert.alert("Colis enregistré", `Ref : ${created.trackingRef}`);
    } catch (e: any) {
      setParcelError(e?.message || "Échec de la création. Vérifiez les données.");
    } finally { setParcelSubmitting(false); }
  };

  const loadSeats = (trip: Trip) => {
    setSelectedTripForSeats(trip);
    setActiveTab("sieges");
    setSeatFilter("all");
    setSeats(genDemoSeats(trip.id, trip.totalSeats, Math.floor(trip.totalSeats * 0.65)));
    if (token) {
      apiFetch<SeatItem[]>(`/company/seats/${trip.id}/detail`, { token })
        .then(s => { if (s.length > 0) setSeats(s); })
        .catch(() => {
          apiFetch<SeatItem[]>(`/company/seats/${trip.id}`, { token })
            .then(s => { if (s.length > 0) setSeats(s); })
            .catch(() => {});
        });
    }
  };

  const openSeatDetail = (seat: SeatItem) => {
    setSelectedSeat(seat);
    setSeatDetailModal(true);
  };

  const handleToggleSeatBlock = async () => {
    if (!selectedSeat || !token) return;
    const newStatus = selectedSeat.status === "blocked" ? "available" : "blocked";
    setSeatActionLoading(true);
    try {
      await apiFetch(`/company/seats/${selectedSeat.id}/status`, {
        token, method: "PATCH", body: JSON.stringify({ status: newStatus }),
      });
      setSeats(prev => prev.map(s => s.id === selectedSeat.id ? { ...s, status: newStatus } : s));
      setSelectedSeat(prev => prev ? { ...prev, status: newStatus } : null);
    } catch {
      /* optimistic update if API unavailable */
      setSeats(prev => prev.map(s => s.id === selectedSeat.id ? { ...s, status: newStatus } : s));
      setSelectedSeat(prev => prev ? { ...prev, status: newStatus } : null);
    } finally {
      setSeatActionLoading(false);
      setSeatDetailModal(false);
    }
  };

  const handleAddBus = async () => {
    if (!newBus.busName || !newBus.plateNumber) return;
    setBusSubmitting(true);
    setBusError("");
    try {
      const created = await apiFetch<Bus>("/company/buses", {
        token: token ?? undefined,
        method: "POST",
        body: {
          busName: newBus.busName,
          plateNumber: newBus.plateNumber,
          busType: newBus.busType,
          capacity: newBus.capacity,
        },
      });
      setBuses(prev => [created, ...prev]);
      setStats(s => ({ ...s, totalBuses: s.totalBuses + 1, activeBuses: s.activeBuses + 1 }));
      setAddBusModal(false);
      setNewBus({ busName: "", plateNumber: "", busType: "Standard", capacity: 49 });
    } catch (err: any) {
      setBusError(err?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setBusSubmitting(false);
    }
  };

  const handleAddTrip = () => {
    if (!newTrip.from || !newTrip.to || !newTrip.date || !newTrip.price) return;
    const t: Trip = { id: Date.now().toString(), from: newTrip.from, to: newTrip.to, date: newTrip.date, departureTime: newTrip.departureTime || "08h00", arrivalTime: newTrip.arrivalTime || "12h00", price: Number(newTrip.price), totalSeats: newTrip.totalSeats, busName: newTrip.busName || "Bus GoBooking", duration: "4h00" };
    setTrips(p => [t, ...p]);
    setStats(s => ({ ...s, totalTrips: s.totalTrips + 1 }));
    setAddTripModal(false);
    setNewTrip({ from: "", to: "", date: "", departureTime: "", arrivalTime: "", price: "", busId: "", busName: "", totalSeats: 49 });
    if (token) apiFetch("/company/trips", { token, method: "POST", body: { ...t } }).catch(() => {});
  };

  const handleAddAgent = () => {
    if (!newAgent.name || !newAgent.phone) return;
    const code = newAgent.agentCode || `AGT-${String(agents.length + 1).padStart(3, "0")}`;
    const busLabel = newAgent.busName || "Non assigné";
    const ag: AgentItem = { id: Date.now().toString(), name: newAgent.name, agentCode: code, phone: newAgent.phone, bus: busLabel, busId: newAgent.busId, status: "active" };
    setAgents(p => [...p, ag]);
    setStats(s => ({ ...s, totalAgents: s.totalAgents + 1 }));
    setAddAgentModal(false);
    setNewAgent({ name: "", phone: "", agentCode: "", busId: "", busName: "" });
  };

  const handleAssignAgent = (agent: AgentItem, bus: Bus) => {
    setAgents(p => p.map(a => a.id === agent.id ? { ...a, bus: bus.busName, busId: bus.id, status: "active" } : a));
    setAssignAgentModal(null);
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "apercu",       label: "Aperçu",        icon: "bar-chart-2" },
    { id: "analytiques",  label: "Analytiques",   icon: "trending-up" },
    { id: "portefeuille", label: "Portefeuille",  icon: "credit-card" },
    { id: "factures",     label: "Factures",      icon: "file-text" },
    { id: "abonnement",   label: "Abonnement",    icon: "star" },
    { id: "trajets",      label: "Trajets",       icon: "navigation" },
    { id: "reservations", label: "Réservations",  icon: "bookmark" },
    { id: "sieges",       label: "Sièges",        icon: "grid" },
    { id: "bus",          label: "Bus",           icon: "truck" },
    { id: "colis",        label: "Colis",         icon: "package" },
    { id: "agents",       label: "Agents",        icon: "users" },
    { id: "en_route",     label: "En Route",      icon: "radio" },
  ];
  const pendingBoardingCount = boardingRequests.filter(r => r.status === "pending").length;

  const filteredRes = reservationFilter === "all" ? reservations : reservations.filter(r => r.status === reservationFilter);
  const seatBooked  = seats.filter(s => s.status === "booked").length;
  const seatAvail   = seats.filter(s => s.status === "available").length;
  const seatBlocked = seats.filter(s => s.status === "blocked").length;
  const seatRevenue = seats.filter(s => s.status === "booked").reduce((sum, s) => sum + s.price, 0);
  const filteredSeats = seatFilter === "all" ? seats : seats.filter(s => s.status === seatFilter);
  const seatRows    = Math.ceil(seats.length / 4);

  return (
    <View style={[S.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient colors={[PRIMARY, DARK]} style={S.header}>
        <Pressable onPress={handleLogout} style={S.backBtn}>
          <Feather name="log-out" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Tableau de bord</Text>
          <Text style={S.headerSub}>SOTRAL — Société de Transport CI</Text>
        </View>
        <View style={S.roleBadge}>
          <Feather name="briefcase" size={13} color="white" />
          <Text style={S.roleBadgeText}>Entreprise</Text>
        </View>
      </LinearGradient>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabBar} contentContainerStyle={S.tabBarContent}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[S.tab, activeTab === tab.id && S.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Feather name={tab.icon as never} size={13} color={activeTab === tab.id ? PRIMARY : "#94A3B8"} />
            <Text style={[S.tabText, activeTab === tab.id && S.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* ── Aperçu ── */}
        {activeTab === "apercu" && (<>
          <Text style={S.sectionTitle}>Vue d'ensemble</Text>
          <View style={S.statsGrid}>
            {[
              { icon: "truck",       label: "Bus actifs",    value: `${stats.activeBuses}/${stats.totalBuses}`, color: "#1D4ED8", bg: "#EFF6FF" },
              { icon: "users",       label: "Agents",        value: stats.totalAgents,                         color: "#7C3AED", bg: "#F5F3FF" },
              { icon: "navigation",  label: "Trajets",       value: stats.totalTrips,                          color: PRIMARY,   bg: "#EEF2FF" },
              { icon: "bookmark",    label: "Réservations",  value: stats.totalReservations.toLocaleString(),  color: "#059669", bg: "#ECFDF5" },
              { icon: "package",     label: "Colis",         value: stats.totalParcels,                        color: "#D97706", bg: "#FFFBEB" },
              { icon: "trending-up", label: "Revenus",       value: `${(stats.totalRevenue / 1_000_000).toFixed(1)} M FCFA`, color: "#0891B2", bg: "#ECFEFF" },
            ].map((c, i) => (
              <View key={i} style={[S.statCard, { borderLeftColor: c.color }]}>
                <View style={[S.statIcon, { backgroundColor: c.bg }]}><Feather name={c.icon as never} size={16} color={c.color} /></View>
                <Text style={S.statValue}>{c.value}</Text>
                <Text style={S.statLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Graphiques activité ── */}
          <DashboardCharts
            dailyBookings={analytics.dailyBookings}
            accentColor={Colors.light.accent ?? "#FF6B00"}
            showRevenue
          />

          <Text style={[S.sectionTitle, { marginTop: 8 }]}>Accès rapide</Text>
          <View style={S.quickGrid}>
            {([
              { icon: "navigation", label: "Trajets",      tab: "trajets"      as Tab, color: "#1D4ED8", bg: "#EFF6FF" },
              { icon: "bookmark",   label: "Réservations", tab: "reservations" as Tab, color: "#059669", bg: "#ECFDF5" },
              { icon: "grid",       label: "Sièges",       tab: "sieges"       as Tab, color: "#6D28D9", bg: "#F5F3FF" },
              { icon: "truck",      label: "Bus",          tab: "bus"          as Tab, color: PRIMARY,   bg: "#EEF2FF" },
              { icon: "package",    label: "Colis",        tab: "colis"        as Tab, color: "#D97706", bg: "#FFFBEB" },
              { icon: "users",      label: "Agents",       tab: "agents"       as Tab, color: "#0891B2", bg: "#ECFEFF" },
            ] as const).map(item => (
              <TouchableOpacity key={item.tab} style={S.quickCard} onPress={() => setActiveTab(item.tab)} activeOpacity={0.8}>
                <View style={[S.quickIcon, { backgroundColor: item.bg }]}><Feather name={item.icon as never} size={20} color={item.color} /></View>
                <Text style={S.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Seats overview per bus */}
          <Text style={[S.sectionTitle, { marginTop: 8 }]}>Disponibilité par bus</Text>
          {buses.filter(b => b.status === "active").slice(0, 4).map(bus => {
            const pct = Math.round(Math.random() * 40 + 45);
            const booked = Math.round(bus.capacity * pct / 100);
            return (
              <View key={bus.id} style={S.busAvailRow}>
                <View style={S.busAvailLeft}>
                  <Text style={S.busAvailName}>{bus.busName}</Text>
                  <Text style={S.busAvailSub}>{booked}/{bus.capacity} réservés · {bus.capacity - booked} libres</Text>
                </View>
                <View style={S.busAvailBar}>
                  <View style={[S.busAvailFill, { width: `${pct}%` as never, backgroundColor: pct > 80 ? "#DC2626" : pct > 60 ? "#D97706" : PRIMARY }]} />
                </View>
                <Text style={S.busAvailPct}>{pct}%</Text>
              </View>
            );
          })}
        </>)}

        {/* ══ Portefeuille ═══════════════════════════════════════════ */}
        {activeTab === "portefeuille" && (<>
          {/* Solde principal */}
          <LinearGradient colors={["#D97706", "#B45309"]} style={{ borderRadius: 20, padding: 22, gap: 2, marginBottom: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                <Feather name="credit-card" size={18} color="white" />
              </View>
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)" }}>Solde disponible</Text>
            </View>
            <Text style={{ fontSize: 36, fontFamily: "Inter_700Bold", color: "white" }}>{walletData.balance.toLocaleString()}</Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)" }}>FCFA</Text>
          </LinearGradient>

          {/* Statistiques rapides */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: "white", borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: "#059669", gap: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
              <Feather name="trending-up" size={16} color="#059669" />
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginTop: 6 }}>{walletData.totalGross.toLocaleString()}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" }}>FCFA total brut</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "white", borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: "#DC2626", gap: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
              <Feather name="minus-circle" size={16} color="#DC2626" />
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginTop: 6 }}>{walletData.totalCommission.toLocaleString()}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" }}>FCFA commissions</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "white", borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: "#D97706", gap: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
              <Feather name="dollar-sign" size={16} color="#D97706" />
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginTop: 6 }}>{walletData.totalNet.toLocaleString()}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" }}>FCFA net reçu</Text>
            </View>
          </View>

          {/* Info commission */}
          <View style={{ backgroundColor: "#FFFBEB", borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderColor: "#FDE68A" }}>
            <Feather name="info" size={14} color="#D97706" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#92400E" }}>
              GoBooking déduit automatiquement sa commission sur chaque réservation confirmée. Le montant net est crédité immédiatement sur votre solde.
            </Text>
          </View>

          {/* Historique transactions */}
          <Text style={[S.sectionTitle, { marginBottom: 0 }]}>Historique des transactions ({walletData.transactions.length})</Text>

          {walletData.transactions.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
              <Feather name="inbox" size={32} color="#CBD5E1" />
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>Aucune transaction pour l'instant</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#CBD5E1", textAlign: "center" }}>Les transactions apparaissent ici dès qu'une réservation est confirmée</Text>
            </View>
          ) : walletData.transactions.map(tx => {
            const date = new Date(tx.createdAt);
            const dateStr = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
            const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            return (
              <View key={tx.id} style={{ backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" }}>
                    <Feather name="arrow-down-left" size={18} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" }} numberOfLines={1}>{tx.description || `Réservation ${tx.bookingRef}`}</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 }}>{dateStr} à {timeStr}{tx.bookingRef ? ` · Réf. ${tx.bookingRef}` : ""}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#059669" }}>+{tx.netAmount.toLocaleString()} F</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" }}>net</Text>
                  </View>
                </View>
                {/* Détail commission */}
                <View style={{ flexDirection: "row", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", gap: 16 }}>
                  <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" }}>Prix transport</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0F172A" }}>{tx.grossAmount.toLocaleString()} FCFA</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: "#F1F5F9" }} />
                  <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" }}>Commission</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#DC2626" }}>-{tx.commissionAmount.toLocaleString()} FCFA</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>)}

        {/* ── Trajets ── */}
        {activeTab === "trajets" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Trajets ({trips.length})</Text>
            <TouchableOpacity style={S.addBtn} onPress={() => setAddTripModal(true)} activeOpacity={0.8}>
              <Feather name="plus" size={14} color="white" />
              <Text style={S.addBtnText}>Nouveau trajet</Text>
            </TouchableOpacity>
          </View>

          {/* Status filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {(["all", "scheduled", "en_route", "completed"] as const).map(f => {
              const labels: Record<string, string> = { all: "Tous", scheduled: "En attente", en_route: "En cours", completed: "Terminé" };
              const active = tripFilter === f;
              return (
                <Pressable key={f} style={[S.filterChip, active && S.filterChipActive]} onPress={() => setTripFilter(f)}>
                  <Text style={[S.filterChipText, active && S.filterChipTextActive]}>{labels[f]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {trips.filter(t => tripFilter === "all" || (t.status ?? "scheduled") === tripFilter).map(trip => {
            const st = trip.status ?? "scheduled";
            const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
              scheduled:  { label: "En attente", color: "#D97706", bg: "#FEF3C7" },
              en_route:   { label: "En cours",   color: "#059669", bg: "#ECFDF5" },
              en_cours:   { label: "En cours",   color: "#059669", bg: "#ECFDF5" },
              completed:  { label: "Terminé",    color: "#6B7280", bg: "#F3F4F6" },
            };
            const meta = statusMeta[st] ?? statusMeta.scheduled;
            const isLoading = tripStatusLoading === trip.id;
            return (
              <View key={trip.id} style={S.tripCard}>
                <View style={S.tripLeft}>
                  <View style={S.tripIconWrap}>
                    <Feather name={st === "en_route" || st === "en_cours" ? "radio" : "navigation"} size={16} color={st === "en_route" || st === "en_cours" ? "#059669" : PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <Text style={S.tripRoute}>{trip.from} → {trip.to}</Text>
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, backgroundColor: meta.bg }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: meta.color }}>{meta.label}</Text>
                      </View>
                    </View>
                    <Text style={S.tripMeta}>{trip.date} · {trip.departureTime} → {trip.arrivalTime} · {trip.duration}</Text>
                    <Text style={S.tripMeta}>{trip.busName} · {trip.totalSeats} places</Text>
                  </View>
                </View>
                <View style={S.tripRight}>
                  <Text style={S.tripPrice}>{trip.price.toLocaleString()} F</Text>
                  <TouchableOpacity style={S.seatBtn} onPress={() => loadSeats(trip)} activeOpacity={0.8}>
                    <Feather name="grid" size={12} color={PRIMARY} />
                    <Text style={S.seatBtnText}>Sièges</Text>
                  </TouchableOpacity>
                </View>
                {/* Action buttons */}
                {(st === "scheduled") && (
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 9, borderRadius: 8, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" }}
                    onPress={() => handleTripStatus(trip.id, "start")}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? <ActivityIndicator size="small" color="#059669" />
                      : <><Feather name="play-circle" size={14} color="#059669" /><Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#059669" }}>Démarrer le trajet</Text></>
                    }
                  </TouchableOpacity>
                )}
                {(st === "en_route" || st === "en_cours") && (
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 9, borderRadius: 8, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}
                    onPress={() => handleTripStatus(trip.id, "end")}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? <ActivityIndicator size="small" color="#DC2626" />
                      : <><Feather name="stop-circle" size={14} color="#DC2626" /><Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#DC2626" }}>Terminer le trajet</Text></>
                    }
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>)}

        {/* ── Réservations ── */}
        {activeTab === "reservations" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Réservations ({reservations.length})</Text>
            <TouchableOpacity style={S.addBtn} onPress={() => setAddReservationModal(true)} activeOpacity={0.8}>
              <Feather name="plus" size={14} color="white" /><Text style={S.addBtnText}>Créer</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {(["all", "confirmed", "boarded", "cancelled"] as const).map(f => (
              <Pressable key={f} style={[S.filterChip, reservationFilter === f && S.filterChipActive]} onPress={() => setReservationFilter(f)}>
                <Text style={[S.filterChipText, reservationFilter === f && S.filterChipTextActive]}>
                  {f === "all" ? "Tous" : f === "confirmed" ? "Confirmés" : f === "boarded" ? "Embarqués" : "Annulés"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {filteredRes.map(res => {
            const st = BOOKING_STATUS[res.status] ?? BOOKING_STATUS.confirmed;
            return (
              <View key={res.id} style={S.reservCard}>
                <View style={S.reservTop}>
                  <Text style={S.reservRef}>#{res.bookingRef}</Text>
                  <View style={[S.badge, { backgroundColor: st.bg }]}><Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text></View>
                </View>
                <View style={S.reservMid}>
                  {res.passengers.map((p, i) => (
                    <View key={i} style={S.paxRow}>
                      <View style={S.seatTag}><Text style={S.seatTagText}>{p.seatNumber}</Text></View>
                      <Text style={S.paxName}>{p.name}</Text>
                    </View>
                  ))}
                </View>
                <View style={S.reservBottom}>
                  <Text style={S.reservPay}>{PAYMENT_LABELS[res.paymentMethod] || res.paymentMethod}</Text>
                  <Text style={S.reservAmount}>{res.totalAmount.toLocaleString()} FCFA</Text>
                </View>
                {res.status === "pending" && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" }}
                      onPress={() => confirmReservation(res.id)}
                      activeOpacity={0.8}
                    >
                      <Feather name="check-circle" size={13} color="#059669" />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#059669" }}>Confirmer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}
                      onPress={() => cancelReservation(res.id)}
                      activeOpacity={0.8}
                    >
                      <Feather name="x-circle" size={13} color="#DC2626" />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626" }}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {res.status === "confirmed" && (
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}
                    onPress={() => cancelReservation(res.id)}
                    activeOpacity={0.8}
                  >
                    <Feather name="x-circle" size={13} color="#DC2626" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626" }}>Annuler</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>)}

        {/* ── Sièges ── */}
        {activeTab === "sieges" && (<>
          <Text style={S.sectionTitle}>Sièges — {selectedTripForSeats.from} → {selectedTripForSeats.to}</Text>
          <Text style={[S.subLabel, { marginBottom: 8 }]}>{selectedTripForSeats.date} · {selectedTripForSeats.departureTime} · {selectedTripForSeats.busName}</Text>

          {/* Stats row */}
          <View style={S.seatSummaryRow}>
            <View style={[S.seatSummaryCard, { borderColor: "#BBF7D0" }]}>
              <Text style={[S.seatSummaryNum, { color: "#059669" }]}>{seatAvail}</Text>
              <Text style={S.seatSummaryLabel}>Disponibles</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#FECACA" }]}>
              <Text style={[S.seatSummaryNum, { color: "#DC2626" }]}>{seatBooked}</Text>
              <Text style={S.seatSummaryLabel}>Réservés</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#E9D5FF" }]}>
              <Text style={[S.seatSummaryNum, { color: "#7C3AED" }]}>{seatBlocked}</Text>
              <Text style={S.seatSummaryLabel}>Bloqués</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#FDE68A" }]}>
              <Text style={[S.seatSummaryNum, { color: "#D97706" }]}>{Math.round((seatBooked / Math.max(seats.length, 1)) * 100)}%</Text>
              <Text style={S.seatSummaryLabel}>Taux</Text>
            </View>
          </View>

          {/* Revenue card */}
          <View style={S.revenueCard}>
            <Feather name="trending-up" size={16} color="#059669" />
            <Text style={S.revenueLabel}>Recettes sièges :</Text>
            <Text style={S.revenueAmount}>{seatRevenue.toLocaleString("fr-CI")} FCFA</Text>
          </View>

          {/* Legend */}
          <View style={S.seatLegend}>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#ECFDF5", borderColor: "#059669" }]} /><Text style={S.legendText}>Libre</Text></View>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#FEF2F2", borderColor: "#DC2626" }]} /><Text style={S.legendText}>Réservé</Text></View>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#F5F3FF", borderColor: "#7C3AED" }]} /><Text style={S.legendText}>Bloqué</Text></View>
          </View>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {(["all","available","booked","blocked"] as const).map(f => (
              <Pressable key={f} onPress={() => setSeatFilter(f)}
                style={[S.filterChip, seatFilter === f && S.filterChipActive]}>
                <Text style={[S.filterChipText, seatFilter === f && S.filterChipTextActive]}>
                  {f === "all" ? "Tous" : f === "available" ? "Disponibles" : f === "booked" ? "Réservés" : "Bloqués"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Trip switcher */}
          <Text style={[S.pickerLabel, { marginBottom: 6 }]}>Changer de trajet</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {trips.map(trip => (
              <Pressable key={trip.id} onPress={() => loadSeats(trip)} style={[S.tripChip, selectedTripForSeats.id === trip.id && S.tripChipActive]}>
                <Text style={[S.tripChipText, selectedTripForSeats.id === trip.id && S.tripChipTextActive]}>{trip.from} → {trip.to}</Text>
                <Text style={[S.tripChipSub, selectedTripForSeats.id === trip.id && { color: PRIMARY }]}>{trip.totalSeats} places</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Seat map */}
          <View style={S.seatBusFrame}>
            <View style={S.busNose}><Feather name="truck" size={18} color="#94A3B8" /></View>
            <View style={S.seatGrid}>
              {Array.from({ length: seatRows }, (_, rowIdx) => (
                <View key={rowIdx} style={S.seatRow}>
                  {[0, 1].map(col => {
                    const s = seats.find(s => s.row === rowIdx + 1 && s.column === col);
                    if (!s) return <View key={col} style={S.seatEmpty} />;
                    const hidden = seatFilter !== "all" && s.status !== seatFilter;
                    const sStyle = s.status === "booked" ? S.seatBooked : s.status === "blocked" ? S.seatBlocked : S.seatAvail;
                    const tColor = s.status === "booked" ? "#DC2626" : s.status === "blocked" ? "#7C3AED" : "#059669";
                    return (
                      <TouchableOpacity key={col} onPress={() => openSeatDetail(s)}
                        style={[S.seat, sStyle, hidden && { opacity: 0.25 }]} activeOpacity={0.7}>
                        <Text style={[S.seatNum, { color: tColor }]}>{s.number}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={S.seatAisle} />
                  {[2, 3].map(col => {
                    const s = seats.find(s => s.row === rowIdx + 1 && s.column === col);
                    if (!s) return <View key={col} style={S.seatEmpty} />;
                    const hidden = seatFilter !== "all" && s.status !== seatFilter;
                    const sStyle = s.status === "booked" ? S.seatBooked : s.status === "blocked" ? S.seatBlocked : S.seatAvail;
                    const tColor = s.status === "booked" ? "#DC2626" : s.status === "blocked" ? "#7C3AED" : "#059669";
                    return (
                      <TouchableOpacity key={col} onPress={() => openSeatDetail(s)}
                        style={[S.seat, sStyle, hidden && { opacity: 0.25 }]} activeOpacity={0.7}>
                        <Text style={[S.seatNum, { color: tColor }]}>{s.number}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
          {filteredSeats.length === 0 && (
            <Text style={[S.subLabel, { textAlign: "center", marginTop: 16 }]}>Aucun siège dans ce filtre</Text>
          )}
        </>)}

        {/* ── Bus ── */}
        {activeTab === "bus" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Flotte ({buses.length})</Text>
            <TouchableOpacity style={S.addBtn} onPress={() => setAddBusModal(true)} activeOpacity={0.8}>
              <Feather name="plus" size={14} color="white" /><Text style={S.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {buses.map(bus => (
            <View key={bus.id} style={S.listCard}>
              <View style={[S.listIcon, { backgroundColor: bus.status === "active" ? "#EFF6FF" : "#FFF7ED" }]}>
                <Feather name="truck" size={18} color={bus.status === "active" ? "#1D4ED8" : "#D97706"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.listTitle}>{bus.busName}</Text>
                <Text style={S.listSub}>{bus.plateNumber} · {bus.busType}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <View style={S.capacityBadge}>
                    <Feather name="users" size={10} color={PRIMARY} />
                    <Text style={S.capacityText}>{bus.capacity} places</Text>
                  </View>
                </View>
              </View>
              <View style={[S.badge, { backgroundColor: bus.status === "active" ? "#ECFDF5" : "#FFFBEB" }]}>
                <Text style={[S.badgeText, { color: bus.status === "active" ? "#065F46" : "#B45309" }]}>
                  {bus.status === "active" ? "Actif" : "Maintenance"}
                </Text>
              </View>
            </View>
          ))}
        </>)}

        {/* ── Colis ── */}
        {activeTab === "colis" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Expéditions ({parcels.length})</Text>
            <TouchableOpacity style={S.addBtn} onPress={() => setAddParcelModal(true)} activeOpacity={0.8}>
              <Feather name="plus" size={14} color="white" /><Text style={S.addBtnText}>Créer</Text>
            </TouchableOpacity>
          </View>
          {parcels.map(parcel => {
            const st = PARCEL_STATUS[parcel.status] ?? PARCEL_STATUS.en_attente;
            return (
              <View key={parcel.id} style={S.reservCard}>
                <View style={S.reservTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.reservRef}>{parcel.trackingRef}</Text>
                    <Text style={S.listSub}>{parcel.fromCity} → {parcel.toCity} · {parcel.weight} kg</Text>
                    <Text style={S.listSub}>{parcel.senderName} → {parcel.receiverName}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    <View style={[S.badge, { backgroundColor: st.bg }]}><Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text></View>
                    <Text style={[S.badgeText, { color: PRIMARY }]}>{parcel.amount.toLocaleString()} F</Text>
                  </View>
                </View>
                {/* Workflow actions */}
                {parcel.status === "en_attente" && (
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE" }}
                    onPress={() => updateParcelStatus(parcel.id, "confirme")} activeOpacity={0.8}>
                    <Feather name="check-circle" size={13} color="#1D4ED8" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1D4ED8" }}>Confirmer le colis</Text>
                  </TouchableOpacity>
                )}
                {parcel.status === "confirme" && (
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE" }}
                    onPress={() => updateParcelStatus(parcel.id, "en_cours_ramassage")} activeOpacity={0.8}>
                    <Feather name="map-pin" size={13} color="#7C3AED" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#7C3AED" }}>Lancer ramassage</Text>
                  </TouchableOpacity>
                )}
                {parcel.status === "en_cours_ramassage" && (
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#ECFEFF", borderWidth: 1, borderColor: "#A5F3FC" }}
                    onPress={() => updateParcelStatus(parcel.id, "arrive_gare_depart")} activeOpacity={0.8}>
                    <Feather name="home" size={13} color="#0E7490" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0E7490" }}>Arrivé en gare départ</Text>
                  </TouchableOpacity>
                )}
                {(parcel.status === "arrive_gare_depart" || parcel.status === "pris_en_charge") && (
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE" }}
                    onPress={() => updateParcelStatus(parcel.id, "en_transit")} activeOpacity={0.8}>
                    <Feather name="truck" size={13} color="#6D28D9" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6D28D9" }}>Mettre en transit</Text>
                  </TouchableOpacity>
                )}
                {parcel.status === "en_transit" && (
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A" }}
                    onPress={() => updateParcelStatus(parcel.id, "arrive_destination")} activeOpacity={0.8}>
                    <Feather name="flag" size={13} color="#D97706" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#D97706" }}>Arrivé à destination</Text>
                  </TouchableOpacity>
                )}
                {parcel.status === "arrive_destination" && (
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" }}
                    onPress={() => updateParcelStatus(parcel.id, "livre")} activeOpacity={0.8}>
                    <Feather name="gift" size={13} color="#065F46" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#065F46" }}>Confirmer livraison</Text>
                  </TouchableOpacity>
                )}
                {parcel.status === "livre" && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F1F5F9" }}>
                    <Feather name="check" size={13} color="#94A3B8" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#94A3B8" }}>Livré ✓</Text>
                  </View>
                )}
              </View>
            );
          })}
        </>)}

        {/* ── Agents ── */}
        {activeTab === "agents" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Agents ({agents.length})</Text>
            <TouchableOpacity style={S.addBtn} onPress={() => setAddAgentModal(true)} activeOpacity={0.8}>
              <Feather name="user-plus" size={14} color="white" /><Text style={S.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {agents.map(agent => (
            <View key={agent.id} style={S.listCard}>
              <View style={S.agentAvatar}><Text style={S.agentAvatarText}>{agent.name.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={S.listTitle}>{agent.name}</Text>
                <Text style={S.listSub}>{agent.agentCode} · {agent.phone}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Feather name="truck" size={10} color={agent.busId ? PRIMARY : "#94A3B8"} />
                  <Text style={[S.listSub, { color: agent.busId ? PRIMARY : "#94A3B8" }]}>{agent.bus}</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={[S.badge, { backgroundColor: agent.status === "active" ? "#ECFDF5" : "#F1F5F9" }]}>
                  <Text style={[S.badgeText, { color: agent.status === "active" ? "#065F46" : "#64748B" }]}>
                    {agent.status === "active" ? "Actif" : "Inactif"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAssignAgentModal(agent)} style={S.assignBtn}>
                  <Feather name="link" size={10} color="#7C3AED" />
                  <Text style={S.assignBtnText}>Assigner</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>)}

        {/* ── Factures ── */}
        {activeTab === "factures" && (<>
          <View style={S.sectionRow}>
            <View>
              <Text style={S.sectionTitle}>Mes Factures</Text>
              <Text style={[S.listSub, { marginTop: 2 }]}>Commissions & reversements mensuels</Text>
            </View>
            <TouchableOpacity
              style={[S.addBtn, { backgroundColor: "#D97706" }]}
              onPress={generateInvoice}
              activeOpacity={0.8}
              disabled={invGenerating}
            >
              {invGenerating
                ? <ActivityIndicator size={13} color="white" />
                : <Feather name="file-plus" size={13} color="white" />}
              <Text style={S.addBtnText}>{invGenerating ? "Génération…" : "Générer"}</Text>
            </TouchableOpacity>
          </View>

          {invLoading && (
            <View style={{ alignItems: "center", padding: 32 }}>
              <ActivityIndicator color="#D97706" />
              <Text style={[S.listSub, { marginTop: 8 }]}>Chargement…</Text>
            </View>
          )}

          {!invLoading && invoices.length === 0 && (
            <View style={S.emptyState}>
              <Feather name="file-text" size={36} color="#CBD5E1" />
              <Text style={S.emptyStateText}>Aucune facture pour l'instant</Text>
              <Text style={[S.listSub, { textAlign: "center" }]}>
                Appuyez sur "Générer" pour créer la facture du mois en cours.
              </Text>
            </View>
          )}

          {!invLoading && invoices.map(inv => {
            const isPaid = inv.status === "paid";
            const [yr, mo] = inv.period.split("-");
            const moNames = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];
            const moLabel = `${moNames[parseInt(mo, 10) - 1]} ${yr}`;
            return (
              <View key={inv.id} style={[S.card, { borderLeftWidth: 4, borderLeftColor: isPaid ? "#059669" : "#D97706" }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", fontSize: 15, color: "#1E293B" }}>{moLabel}</Text>
                    <Text style={[S.listSub, { marginTop: 2 }]}>{inv.transactionCount} transaction(s)</Text>
                  </View>
                  <View style={[S.badge, { backgroundColor: isPaid ? "#ECFDF5" : "#FEF3C7" }]}>
                    <Text style={[S.badgeText, { color: isPaid ? "#065F46" : "#92400E" }]}>
                      {isPaid ? "Payée" : "En attente"}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 12, gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={S.listSub}>Chiffre brut</Text>
                    <Text style={{ fontWeight: "600", color: "#1E293B" }}>
                      {inv.totalGross.toLocaleString()} FCFA
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={S.listSub}>Commission GoBooking</Text>
                    <Text style={{ fontWeight: "600", color: "#DC2626" }}>
                      − {inv.totalCommission.toLocaleString()} FCFA
                    </Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: "#F1F5F9", marginVertical: 2 }} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700", color: "#1E293B" }}>Net à reverser</Text>
                    <Text style={{ fontWeight: "700", fontSize: 15, color: "#059669" }}>
                      {inv.totalNet.toLocaleString()} FCFA
                    </Text>
                  </View>
                </View>

                {isPaid && inv.paidAt && (
                  <Text style={[S.listSub, { marginTop: 8 }]}>
                    Payée le {new Date(inv.paidAt).toLocaleDateString("fr-FR")}
                  </Text>
                )}

                <TouchableOpacity
                  style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
                  onPress={() => Share.share({
                    title: `Facture GoBooking — ${moLabel}`,
                    message: `Facture GoBooking — ${moLabel}\n\nTransactions : ${inv.transactionCount}\nBrut : ${inv.totalGross.toLocaleString()} FCFA\nCommission : ${inv.totalCommission.toLocaleString()} FCFA\nNet : ${inv.totalNet.toLocaleString()} FCFA\nStatut : ${isPaid ? "Payée" : "En attente"}`,
                  })}
                >
                  <Feather name="share-2" size={13} color="#64748B" />
                  <Text style={[S.listSub, { color: PRIMARY }]}>Partager la facture</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>)}

        {/* ── Abonnement ── */}
        {activeTab === "abonnement" && (<>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View>
              <Text style={S.sectionTitle}>Abonnement GoBooking</Text>
              <Text style={[S.listSub, { marginTop: 2 }]}>Gérez votre plan et vos fonctionnalités</Text>
            </View>
            <TouchableOpacity onPress={loadSubscription} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
              <Feather name="refresh-cw" size={13} color="#64748B" />
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B" }}>Actualiser</Text>
            </TouchableOpacity>
          </View>

          {subLoading ? (
            <View style={{ alignItems: "center", padding: 40 }}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : (<>
            {/* Current plan banner */}
            {subscription && (
              <View style={{ backgroundColor: PRIMARY + "14", borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1.5, borderColor: PRIMARY + "40" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: PRIMARY, textTransform: "uppercase", letterSpacing: 0.8 }}>Plan actuel</Text>
                    <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#0F172A", marginTop: 4 }}>{subscription.plan.name}</Text>
                    {subscription.plan.priceMonthly > 0 ? (
                      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: PRIMARY, marginTop: 2 }}>
                        {subscription.plan.priceMonthly.toLocaleString()} FCFA / mois
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#059669", marginTop: 2 }}>Gratuit</Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: subscription.status === "active" ? "#ECFDF5" : "#FEF2F2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: subscription.status === "active" ? "#065F46" : "#DC2626" }}>
                      {subscription.status === "active" ? "Actif" : subscription.status}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 20, marginTop: 14 }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A" }}>
                      {subscription.plan.maxReservations ?? "∞"}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" }}>Réservations/mois</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A" }}>
                      {subscription.plan.maxTrips ?? "∞"}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" }}>Trajets actifs</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Plan cards */}
            {[
              { id: "free",    name: "Free",    price: 0,      maxRes: 10,   maxTrips: 3,    color: "#64748B", features: ["10 réservations/mois", "3 trajets actifs", "Support e-mail", "Tableau de bord basique"] },
              { id: "pro",     name: "Pro",     price: 25_000, maxRes: 500,  maxTrips: null, color: PRIMARY,   features: ["500 réservations/mois", "Trajets illimités", "Suivi GPS", "QR billets signés", "Support prioritaire"] },
              { id: "premium", name: "Premium", price: 75_000, maxRes: null, maxTrips: null, color: "#D97706", features: ["Réservations illimitées", "Trajets illimités", "IA recommendations", "API access", "Account manager dédié", "Analytics avancés"] },
            ].map(plan => {
              const isCurrent = subscription?.planId === plan.id;
              return (
                <View key={plan.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: isCurrent ? 2 : 1.5, borderColor: isCurrent ? plan.color : "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <View>
                      <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: plan.color }}>{plan.name}</Text>
                      {plan.price > 0 ? (
                        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0F172A", marginTop: 2 }}>
                          {plan.price.toLocaleString()} FCFA<Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" }}> /mois</Text>
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#059669", marginTop: 2 }}>Gratuit</Text>
                      )}
                    </View>
                    {isCurrent && (
                      <View style={{ backgroundColor: plan.color + "20", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: plan.color }}>Plan actuel</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ gap: 6, marginBottom: 14 }}>
                    {plan.features.map(f => (
                      <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Feather name="check" size={13} color={plan.color} />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569" }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  {!isCurrent && (
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          `Passer au plan ${plan.name}`,
                          plan.price > 0
                            ? `Ce plan coûte ${plan.price.toLocaleString()} FCFA/mois. Confirmer la souscription ?`
                            : "Revenir au plan gratuit. Confirmer ?",
                          [
                            { text: "Annuler", style: "cancel" },
                            { text: "Confirmer", onPress: () => changeSubscription(plan.id) },
                          ]
                        );
                      }}
                      disabled={subChanging}
                      style={{ backgroundColor: plan.color, borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                    >
                      {subChanging ? <ActivityIndicator size={14} color="white" /> : <Feather name="arrow-up-circle" size={14} color="white" />}
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "white" }}>
                        {subChanging ? "En cours…" : plan.price > 0 ? `Passer à ${plan.name}` : "Rétrograder"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>)}
        </>)}

        {/* ── En Route ── */}
        {activeTab === "en_route" && (<>
          <View style={S.sectionRow}>
            <View>
              <Text style={S.sectionTitle}>Demandes En Route</Text>
              <Text style={[S.listSub, { marginTop: 2 }]}>Passagers demandant à monter à bord</Text>
            </View>
            <TouchableOpacity style={[S.addBtn, { backgroundColor: "#059669" }]} onPress={loadBoardingRequests} activeOpacity={0.8}>
              <Feather name="refresh-cw" size={13} color="white" />
              <Text style={S.addBtnText}>Rafraîchir</Text>
            </TouchableOpacity>
          </View>

          {boardingLoading && (
            <View style={{ alignItems: "center", padding: 24 }}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={[S.listSub, { marginTop: 8 }]}>Chargement...</Text>
            </View>
          )}

          {!boardingLoading && boardingRequests.length === 0 && (
            <View style={{ alignItems: "center", padding: 32 }}>
              <Feather name="radio" size={40} color="#CBD5E1" />
              <Text style={[S.listTitle, { marginTop: 12, color: "#64748B" }]}>Aucune demande en cours</Text>
              <Text style={[S.listSub, { textAlign: "center", marginTop: 4 }]}>Les demandes apparaissent quand des passagers demandent à monter sur un trajet en route.</Text>
            </View>
          )}

          {boardingRequests.map(req => {
            const isPending = req.status === "pending";
            const isAccepted = req.status === "accepted";
            const isEmbarque = req.status === "embarqué";
            const isRejected = req.status === "rejected";

            const statusColor = isPending ? "#D97706" : isAccepted ? "#059669" : isEmbarque ? "#1D4ED8" : "#DC2626";
            const statusBg    = isPending ? "#FFFBEB" : isAccepted ? "#ECFDF5" : isEmbarque ? "#EFF6FF" : "#FEF2F2";
            const statusLabel = isPending ? "En attente" : isAccepted ? "Accepté" : isEmbarque ? "Embarqué" : "Refusé";

            return (
              <View key={req.id} style={[S.listCard, { flexDirection: "column", gap: 10 }]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.listTitle}>{req.clientName}</Text>
                    <Text style={S.listSub}>{req.clientPhone}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Feather name="map-pin" size={11} color="#64748B" />
                      <Text style={S.listSub}>{req.boardingPoint}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Feather name="users" size={11} color="#64748B" />
                      <Text style={S.listSub}>{req.seatsRequested} siège{req.seatsRequested > 1 ? "s" : ""}</Text>
                    </View>
                  </View>
                  <View style={[S.badge, { backgroundColor: statusBg }]}>
                    <Text style={[S.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                {isPending && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: "#ECFDF5", borderRadius: 8, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                      onPress={() => handleBoardingAction(req.id, "accept")} activeOpacity={0.8}
                    >
                      <Feather name="check" size={14} color="#059669" />
                      <Text style={{ color: "#059669", fontWeight: "600", fontSize: 13 }}>Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: "#FEF2F2", borderRadius: 8, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                      onPress={() => handleBoardingAction(req.id, "reject")} activeOpacity={0.8}
                    >
                      <Feather name="x" size={14} color="#DC2626" />
                      <Text style={{ color: "#DC2626", fontWeight: "600", fontSize: 13 }}>Refuser</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(isAccepted || isEmbarque) && (
                  <View style={{ backgroundColor: isEmbarque ? "#EFF6FF" : "#F0FDF4", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name={isEmbarque ? "check-circle" : "clock"} size={14} color={isEmbarque ? "#1D4ED8" : "#059669"} />
                    <Text style={{ fontSize: 12, color: isEmbarque ? "#1D4ED8" : "#059669" }}>
                      {isEmbarque ? "Passager embarqué par l'agent" : "En attente d'embarquement par l'agent"}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {boardingRequests.length > 0 && (
            <View style={{ padding: 12, backgroundColor: "#F8FAFC", borderRadius: 10, alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: "#64748B" }}>
                {pendingBoardingCount} en attente · {boardingRequests.filter(r => r.status === "accepted").length} accepté(s) · {boardingRequests.filter(r => r.status === "embarqué").length} embarqué(s)
              </Text>
            </View>
          )}
        </>)}

        {/* ══ Analytiques ════════════════════════════════════════════ */}
        {activeTab === "analytiques" && (() => {
          const { kpis, byStatus, byMethod, dailyBookings } = analytics;
          const totalActive = kpis.totalBookings - byStatus.cancelled;
          const maxDay = Math.max(...dailyBookings.map(d => d.count), 1);

          const METHOD_META: Record<string, { label: string; color: string; bg: string }> = {
            orange: { label: "Orange Money",    color: "#FF6B00", bg: "#FFF3E0" },
            mtn:    { label: "MTN MoMo",        color: "#FFCB00", bg: "#FFFDE7" },
            wave:   { label: "Wave",            color: "#1BA5E0", bg: "#E3F2FD" },
            card:   { label: "Carte bancaire",  color: PRIMARY,   bg: "#EEF2FF" },
            cash:   { label: "Espèces",         color: "#059669", bg: "#ECFDF5" },
          };
          const maxMethodRevenue = Math.max(...byMethod.map(m => m.revenue), 1);

          return (<>
            {/* KPI cards */}
            <Text style={S.sectionTitle}>Vue business</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Total réservations", value: kpis.totalBookings.toLocaleString(), icon: "bookmark",    color: PRIMARY,   bg: "#EEF2FF" },
                { label: "Revenus totaux",      value: `${(kpis.totalRevenue/1_000_000).toFixed(2)} M FCFA`, icon: "trending-up", color: "#059669", bg: "#ECFDF5" },
                { label: "Revenus billets",     value: `${(kpis.bookingRevenue/1_000_000).toFixed(2)} M`,    icon: "navigation",  color: "#1D4ED8", bg: "#EFF6FF" },
                { label: "Revenus colis",       value: `${(kpis.parcelRevenue/1_000_000).toFixed(2)} M`,     icon: "package",     color: "#D97706", bg: "#FFFBEB" },
                { label: "Total colis",         value: kpis.totalParcels.toLocaleString(),                   icon: "package",     color: "#7C3AED", bg: "#F5F3FF" },
                { label: "Actives",             value: totalActive.toLocaleString(),                         icon: "check-circle",color: "#0891B2", bg: "#ECFEFF" },
              ].map((c, i) => (
                <View key={i} style={[S.statCard, { width: "47%", borderLeftColor: c.color }]}>
                  <View style={[S.statIcon, { backgroundColor: c.bg }]}><Feather name={c.icon as never} size={16} color={c.color} /></View>
                  <Text style={[S.statValue, { fontSize: 16 }]}>{c.value}</Text>
                  <Text style={S.statLabel}>{c.label}</Text>
                </View>
              ))}
            </View>

            {/* Status breakdown */}
            <Text style={[S.sectionTitle, { marginTop: 8 }]}>Statuts des réservations</Text>
            {[
              { label: "Confirmées",  count: byStatus.confirmed, color: "#1D4ED8", bg: "#EFF6FF", total: kpis.totalBookings },
              { label: "Embarquées",  count: byStatus.boarded,   color: "#059669", bg: "#ECFDF5", total: kpis.totalBookings },
              { label: "En attente",  count: byStatus.pending,   color: "#D97706", bg: "#FFFBEB", total: kpis.totalBookings },
              { label: "Annulées",    count: byStatus.cancelled, color: "#DC2626", bg: "#FEF2F2", total: kpis.totalBookings },
            ].map((s, i) => {
              const pct = kpis.totalBookings > 0 ? Math.round((s.count / kpis.totalBookings) * 100) : 0;
              return (
                <View key={i} style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" }}>{s.label}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[S.badge, { backgroundColor: s.bg }]}>
                        <Text style={[S.badgeText, { color: s.color }]}>{s.count.toLocaleString()}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: s.color }}>{pct}%</Text>
                    </View>
                  </View>
                  <View style={{ height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                    <View style={{ height: 8, width: `${pct}%` as never, backgroundColor: s.color, borderRadius: 4 }} />
                  </View>
                </View>
              );
            })}

            {/* Revenue by payment method */}
            <Text style={[S.sectionTitle, { marginTop: 8 }]}>Revenus par mode de paiement</Text>
            {byMethod.map((m, i) => {
              const meta = METHOD_META[m.method] || { label: m.method, color: "#6B7280", bg: "#F9FAFB" };
              const pct = Math.round((m.revenue / maxMethodRevenue) * 100);
              return (
                <View key={i} style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: meta.bg, justifyContent: "center", alignItems: "center" }}>
                    <Feather name="credit-card" size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" }}>{meta.label}</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: meta.color }}>{(m.revenue / 1_000).toFixed(0)} k FCFA</Text>
                    </View>
                    <View style={{ height: 7, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                      <View style={{ height: 7, width: `${pct}%` as never, backgroundColor: meta.color, borderRadius: 4 }} />
                    </View>
                    <Text style={{ fontSize: 11, color: "#94A3B8" }}>{m.count} transaction{m.count > 1 ? "s" : ""}</Text>
                  </View>
                </View>
              );
            })}

            {/* Bookings trend (last 14 days) */}
            <Text style={[S.sectionTitle, { marginTop: 8 }]}>Tendance — 14 derniers jours</Text>
            <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 80 }}>
                {dailyBookings.map((day, i) => {
                  const h = Math.max(4, Math.round((day.count / maxDay) * 80));
                  const isToday = i === dailyBookings.length - 1;
                  const dayLabel = new Date(day.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
                  return (
                    <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                      <View style={{
                        height: h,
                        width: "100%",
                        backgroundColor: isToday ? PRIMARY : "#93C5FD",
                        borderRadius: 3,
                        opacity: 0.85 + (i / dailyBookings.length) * 0.15,
                      }} />
                    </View>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
                {dailyBookings.filter((_, i) => i % 7 === 0 || i === dailyBookings.length - 1).map((day, i) => (
                  <View key={i} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, color: "#94A3B8", textAlign: "center" }}>
                      {new Date(day.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" }}>
                <Text style={{ fontSize: 12, color: "#64748B" }}>Total 14 jours</Text>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY }}>
                  {dailyBookings.reduce((s, d) => s + d.count, 0)} réservations
                </Text>
              </View>
            </View>

            {/* Recap card */}
            <View style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 20, marginTop: 8, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" }}>
                  <Feather name="bar-chart-2" size={18} color="white" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "white" }}>Résumé financier</Text>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Toutes périodes confondues</Text>
                </View>
              </View>
              {[
                { label: "Revenus billets",      value: kpis.bookingRevenue, icon: "navigation" },
                { label: "Revenus livraisons",   value: kpis.parcelRevenue,  icon: "package"    },
                { label: "Total consolidé",      value: kpis.totalRevenue,   icon: "trending-up" },
              ].map((row, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: i > 0 ? 10 : 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name={row.icon as never} size={14} color="rgba(255,255,255,0.5)" />
                    <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{row.label}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: i === 2 ? "#34D399" : "white" }}>
                    {(row.value / 1_000_000).toFixed(2)} M FCFA
                  </Text>
                </View>
              ))}
            </View>
          </>);
        })()}

      </ScrollView>

      {/* ─────────── Seat Detail Sheet ─────────── */}
      <Modal visible={seatDetailModal} transparent animationType="slide" onRequestClose={() => setSeatDetailModal(false)}>
        <Pressable style={S.modalOverlay} onPress={() => setSeatDetailModal(false)}>
          <Pressable style={[S.modalCard, { paddingBottom: 32 }]} onPress={e => e.stopPropagation()}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Siège {selectedSeat?.number}</Text>
              <Pressable onPress={() => setSeatDetailModal(false)}><Feather name="x" size={20} color="#64748B" /></Pressable>
            </View>

            {/* Status badge */}
            <View style={{ alignItems: "flex-start", marginBottom: 16 }}>
              {selectedSeat?.status === "booked" && (
                <View style={[S.badge, { backgroundColor: "#FEF2F2" }]}>
                  <Text style={[S.badgeText, { color: "#DC2626" }]}>Réservé</Text>
                </View>
              )}
              {selectedSeat?.status === "available" && (
                <View style={[S.badge, { backgroundColor: "#ECFDF5" }]}>
                  <Text style={[S.badgeText, { color: "#059669" }]}>Disponible</Text>
                </View>
              )}
              {selectedSeat?.status === "blocked" && (
                <View style={[S.badge, { backgroundColor: "#F5F3FF" }]}>
                  <Text style={[S.badgeText, { color: "#7C3AED" }]}>Bloqué (maintenance)</Text>
                </View>
              )}
            </View>

            {/* Seat type */}
            <View style={S.seatDetailRow}>
              <Feather name="info" size={14} color="#64748B" />
              <Text style={S.seatDetailLabel}>Type :</Text>
              <Text style={S.seatDetailValue}>{selectedSeat?.type === "window" ? "Fenêtre" : "Couloir"}</Text>
            </View>
            <View style={S.seatDetailRow}>
              <Feather name="tag" size={14} color="#64748B" />
              <Text style={S.seatDetailLabel}>Prix :</Text>
              <Text style={S.seatDetailValue}>{selectedSeat?.price?.toLocaleString("fr-CI")} FCFA</Text>
            </View>

            {/* Passenger info (if booked) */}
            {selectedSeat?.status === "booked" && (
              <View style={S.passengerCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <View style={[S.listIcon, { backgroundColor: "#EEF2FF", width: 36, height: 36, borderRadius: 9 }]}>
                    <Feather name="user" size={16} color={PRIMARY} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1E293B" }}>
                    {(selectedSeat as any)?.passenger?.name ?? "Passager"}
                  </Text>
                </View>
                {(selectedSeat as any)?.bookingRef && (
                  <View style={S.seatDetailRow}>
                    <Feather name="hash" size={13} color="#64748B" />
                    <Text style={S.seatDetailLabel}>Réf. :</Text>
                    <Text style={[S.seatDetailValue, { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}>
                      {(selectedSeat as any).bookingRef}
                    </Text>
                  </View>
                )}
                {(selectedSeat as any)?.bookingStatus && (
                  <View style={S.seatDetailRow}>
                    <Feather name="check-circle" size={13} color="#64748B" />
                    <Text style={S.seatDetailLabel}>Statut résa :</Text>
                    <Text style={[S.seatDetailValue, { color: (selectedSeat as any).bookingStatus === "boarded" ? "#059669" : PRIMARY }]}>
                      {BOOKING_STATUS[(selectedSeat as any).bookingStatus ?? ""]?.label ?? (selectedSeat as any).bookingStatus}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Block / Unblock action (only for non-booked) */}
            {selectedSeat?.status !== "booked" && (
              <TouchableOpacity
                style={[S.modalSubmit, selectedSeat?.status === "blocked"
                  ? { backgroundColor: "#059669" }
                  : { backgroundColor: "#7C3AED" }
                ]}
                onPress={handleToggleSeatBlock}
                disabled={seatActionLoading}
                activeOpacity={0.85}>
                {seatActionLoading
                  ? <Text style={S.modalSubmitText}>En cours...</Text>
                  : <Text style={S.modalSubmitText}>
                      {selectedSeat?.status === "blocked" ? "✓ Débloquer ce siège" : "⊘ Bloquer (maintenance)"}
                    </Text>
                }
              </TouchableOpacity>
            )}
            {selectedSeat?.status === "booked" && (
              <View style={[S.modalSubmit, { backgroundColor: "#F1F5F9" }]}>
                <Text style={[S.modalSubmitText, { color: "#64748B" }]}>Siège réservé — non modifiable</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─────────── Add Bus Modal ─────────── */}
      <Modal visible={addBusModal} transparent animationType="slide" onRequestClose={() => { if (!busSubmitting) { setAddBusModal(false); setBusError(""); } }}>
        <View style={S.modalOverlay}>
          <ScrollView contentContainerStyle={S.modalCard} keyboardShouldPersistTaps="handled">
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Ajouter un bus</Text>
              <Pressable onPress={() => { if (!busSubmitting) { setAddBusModal(false); setBusError(""); } }}><Feather name="x" size={20} color="#64748B" /></Pressable>
            </View>

            <TextInput style={S.modalInput} placeholder="Nom du bus" value={newBus.busName} onChangeText={v => setNewBus(p => ({ ...p, busName: v }))} placeholderTextColor="#94A3B8" editable={!busSubmitting} />
            <TextInput style={S.modalInput} placeholder="Plaque d'immatriculation" value={newBus.plateNumber} onChangeText={v => setNewBus(p => ({ ...p, plateNumber: v }))} placeholderTextColor="#94A3B8" editable={!busSubmitting} />
            <PickerRow label="Type de bus" options={BUS_TYPES} value={newBus.busType} onSelect={v => setNewBus(p => ({ ...p, busType: v }))} />
            <PickerRow<number> label="Capacité (places)" options={BUS_CAPACITIES} value={newBus.capacity} onSelect={v => setNewBus(p => ({ ...p, capacity: v }))} display={v => `${v} places`} />

            <View style={S.modalCapacityNote}>
              <Feather name="info" size={12} color="#64748B" />
              <Text style={S.modalCapacityNoteText}>Capacités disponibles : 49, 59 ou 63 sièges</Text>
            </View>

            <View style={[S.modalCapacityNote, { backgroundColor: "#F0F9FF", borderRadius: 8, padding: 8, marginBottom: 10 }]}>
              <Feather name="database" size={12} color="#0369A1" />
              <Text style={[S.modalCapacityNoteText, { color: "#0369A1" }]}>Sauvegardé en base de données · Visible instantanément</Text>
            </View>

            {busError ? (
              <View style={{ backgroundColor: "#FEF2F2", borderRadius: 8, padding: 10, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="alert-circle" size={14} color="#DC2626" />
                <Text style={{ color: "#DC2626", fontSize: 13, flex: 1 }}>{busError}</Text>
              </View>
            ) : null}

            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => { if (!busSubmitting) { setAddBusModal(false); setBusError(""); } }} disabled={busSubmitting}>
                <Text style={S.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[S.modalConfirm, (!newBus.busName || !newBus.plateNumber || busSubmitting) && S.modalConfirmDisabled]}
                onPress={handleAddBus}
                disabled={!newBus.busName || !newBus.plateNumber || busSubmitting}
              >
                <Text style={S.modalConfirmText}>{busSubmitting ? "Enregistrement…" : "Ajouter"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─────────── Add Trip Modal ─────────── */}
      <Modal visible={addTripModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <ScrollView contentContainerStyle={S.modalCard} keyboardShouldPersistTaps="handled">
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Nouveau trajet</Text>
              <Pressable onPress={() => setAddTripModal(false)}><Feather name="x" size={20} color="#64748B" /></Pressable>
            </View>
            <CityPicker label="Ville de départ" value={newTrip.from} onChange={v => setNewTrip(p => ({ ...p, from: v }))} />
            <CityPicker label="Ville d'arrivée" value={newTrip.to}   onChange={v => setNewTrip(p => ({ ...p, to: v }))} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Date (20/03/2026)" value={newTrip.date} onChangeText={v => setNewTrip(p => ({ ...p, date: v }))} placeholderTextColor="#94A3B8" />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Départ (08h00)" value={newTrip.departureTime} onChangeText={v => setNewTrip(p => ({ ...p, departureTime: v }))} placeholderTextColor="#94A3B8" />
              <TextInput style={[S.modalInput, { flex: 1 }]} placeholder="Arrivée (12h00)" value={newTrip.arrivalTime} onChangeText={v => setNewTrip(p => ({ ...p, arrivalTime: v }))} placeholderTextColor="#94A3B8" />
            </View>
            <TextInput style={S.modalInput} placeholder="Prix par place (FCFA)" keyboardType="numeric" value={newTrip.price} onChangeText={v => setNewTrip(p => ({ ...p, price: v }))} placeholderTextColor="#94A3B8" />
            <BusSelector buses={buses} selected={newTrip.busId} onSelect={bus => setNewTrip(p => ({ ...p, busId: bus.id, busName: bus.busName, totalSeats: bus.capacity }))} />
            {newTrip.busId && (
              <View style={S.tripBusInfo}>
                <Feather name="check-circle" size={14} color="#059669" />
                <Text style={S.tripBusInfoText}>{newTrip.totalSeats} places · {buses.find(b => b.id === newTrip.busId)?.busType}</Text>
              </View>
            )}
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setAddTripModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, (!newTrip.from || !newTrip.to || !newTrip.date || !newTrip.price) && S.modalConfirmDisabled]} onPress={handleAddTrip}>
                <Text style={S.modalConfirmText}>Créer</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─────────── Add Agent Modal ─────────── */}
      <Modal visible={addAgentModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <ScrollView contentContainerStyle={S.modalCard} keyboardShouldPersistTaps="handled">
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Ajouter un agent</Text>
              <Pressable onPress={() => setAddAgentModal(false)}><Feather name="x" size={20} color="#64748B" /></Pressable>
            </View>
            <TextInput style={S.modalInput} placeholder="Nom complet" value={newAgent.name} onChangeText={v => setNewAgent(p => ({ ...p, name: v }))} placeholderTextColor="#94A3B8" />
            <TextInput style={S.modalInput} placeholder="Téléphone (07 XX XX XX XX)" keyboardType="phone-pad" value={newAgent.phone} onChangeText={v => setNewAgent(p => ({ ...p, phone: v }))} placeholderTextColor="#94A3B8" />
            <TextInput style={S.modalInput} placeholder={`Code agent (auto: AGT-${String(agents.length + 1).padStart(3,"0")})`} value={newAgent.agentCode} onChangeText={v => setNewAgent(p => ({ ...p, agentCode: v }))} placeholderTextColor="#94A3B8" />
            <BusSelector buses={buses} selected={newAgent.busId} onSelect={bus => setNewAgent(p => ({ ...p, busId: bus.id, busName: bus.busName }))} />
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setAddAgentModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={[S.modalConfirm, (!newAgent.name || !newAgent.phone) && S.modalConfirmDisabled]} onPress={handleAddAgent}>
                <Text style={S.modalConfirmText}>Ajouter</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─────────── Assign Agent to Bus Modal ─────────── */}
      {assignAgentModal && (
        <Modal visible={true} transparent animationType="slide">
          <View style={S.modalOverlay}>
            <ScrollView contentContainerStyle={S.modalCard} keyboardShouldPersistTaps="handled">
              <View style={S.modalHeader}>
                <Text style={S.modalTitle}>Assigner {assignAgentModal.name}</Text>
                <Pressable onPress={() => setAssignAgentModal(null)}><Feather name="x" size={20} color="#64748B" /></Pressable>
              </View>
              <Text style={[S.subLabel, { marginBottom: 12 }]}>Choisissez le bus à assigner à cet agent :</Text>
              <BusSelector buses={buses} selected={assignAgentModal.busId} onSelect={bus => handleAssignAgent(assignAgentModal, bus)} />
              <Pressable style={[S.modalCancel, { marginTop: 8 }]} onPress={() => setAssignAgentModal(null)}>
                <Text style={S.modalCancelText}>Fermer</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* ─────────── Modal : Créer une réservation guichet ─────────── */}
      <Modal visible={addReservationModal} transparent animationType="slide" onRequestClose={() => setAddReservationModal(false)}>
        <View style={S.modalOverlay}>
          <ScrollView contentContainerStyle={S.modalCard} keyboardShouldPersistTaps="handled">
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Nouvelle réservation</Text>
              <Pressable onPress={() => { setAddReservationModal(false); setReservationError(""); }}>
                <Feather name="x" size={20} color="#64748B" />
              </Pressable>
            </View>
            <Text style={S.subLabel}>Client</Text>
            <TextInput style={S.modalInput} placeholder="Nom complet du client *" value={newReservation.clientName}
              onChangeText={v => setNewReservation(p => ({ ...p, clientName: v }))} placeholderTextColor="#94A3B8" />
            <TextInput style={S.modalInput} placeholder="Téléphone du client" keyboardType="phone-pad"
              value={newReservation.clientPhone} onChangeText={v => setNewReservation(p => ({ ...p, clientPhone: v }))} placeholderTextColor="#94A3B8" />
            <Text style={[S.subLabel, { marginTop: 8 }]}>Trajet *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {trips.map(t => (
                <Pressable key={t.id} onPress={() => setNewReservation(p => ({ ...p, tripId: t.id }))}
                  style={[S.filterChip, newReservation.tripId === t.id && S.filterChipActive]}>
                  <Text style={[S.filterChipText, newReservation.tripId === t.id && S.filterChipTextActive]}>
                    {t.from} → {t.to} · {t.departureTime}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[S.subLabel, { marginTop: 8 }]}>Nombre de places</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {["1","2","3","4","5"].map(n => (
                <Pressable key={n} onPress={() => setNewReservation(p => ({ ...p, seatCount: n }))}
                  style={[S.filterChip, newReservation.seatCount === n && S.filterChipActive]}>
                  <Text style={[S.filterChipText, newReservation.seatCount === n && S.filterChipTextActive]}>{n}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[S.subLabel, { marginTop: 8 }]}>Mode de paiement</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {[["cash","Cash"],["orange","Orange Money"],["mtn","MTN MoMo"],["wave","Wave"]].map(([val,lbl]) => (
                <Pressable key={val} onPress={() => setNewReservation(p => ({ ...p, paymentMethod: val }))}
                  style={[S.filterChip, newReservation.paymentMethod === val && S.filterChipActive]}>
                  <Text style={[S.filterChipText, newReservation.paymentMethod === val && S.filterChipTextActive]}>{lbl}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {newReservation.tripId !== "" && (
              <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: "#F8FAFC" }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" }}>
                  {(() => { const t = trips.find(x => x.id === newReservation.tripId); return t ? `${t.from} → ${t.to} · ${t.price.toLocaleString()} FCFA/place × ${newReservation.seatCount} = ${(t.price * Number(newReservation.seatCount)).toLocaleString()} FCFA` : ""; })()}
                </Text>
              </View>
            )}
            {reservationError !== "" && <Text style={{ color: "#DC2626", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 }}>{reservationError}</Text>}
            <View style={[S.modalBtns, { marginTop: 14 }]}>
              <Pressable style={S.modalCancel} onPress={() => { setAddReservationModal(false); setReservationError(""); }}>
                <Text style={S.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[S.modalConfirm, reservationSubmitting && S.modalConfirmDisabled]} onPress={handleCreateReservation} disabled={reservationSubmitting}>
                <Text style={S.modalConfirmText}>{reservationSubmitting ? "Création…" : "Créer"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─────────── Modal : Créer un colis ─────────── */}
      <Modal visible={addParcelModal} transparent animationType="slide" onRequestClose={() => setAddParcelModal(false)}>
        <View style={S.modalOverlay}>
          <ScrollView contentContainerStyle={S.modalCard} keyboardShouldPersistTaps="handled">
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Nouveau colis</Text>
              <Pressable onPress={() => { setAddParcelModal(false); setParcelError(""); }}>
                <Feather name="x" size={20} color="#64748B" />
              </Pressable>
            </View>
            <Text style={S.subLabel}>Expéditeur</Text>
            <TextInput style={S.modalInput} placeholder="Nom de l'expéditeur *" value={newParcel.senderName}
              onChangeText={v => setNewParcel(p => ({ ...p, senderName: v }))} placeholderTextColor="#94A3B8" />
            <TextInput style={S.modalInput} placeholder="Téléphone expéditeur" keyboardType="phone-pad"
              value={newParcel.senderPhone} onChangeText={v => setNewParcel(p => ({ ...p, senderPhone: v }))} placeholderTextColor="#94A3B8" />
            <Text style={[S.subLabel, { marginTop: 8 }]}>Destinataire</Text>
            <TextInput style={S.modalInput} placeholder="Nom du destinataire *" value={newParcel.receiverName}
              onChangeText={v => setNewParcel(p => ({ ...p, receiverName: v }))} placeholderTextColor="#94A3B8" />
            <TextInput style={S.modalInput} placeholder="Téléphone destinataire" keyboardType="phone-pad"
              value={newParcel.receiverPhone} onChangeText={v => setNewParcel(p => ({ ...p, receiverPhone: v }))} placeholderTextColor="#94A3B8" />
            <Text style={[S.subLabel, { marginTop: 8 }]}>Ville de départ *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {CI_CITIES.map(c => (
                <Pressable key={c} onPress={() => setNewParcel(p => ({ ...p, fromCity: c }))}
                  style={[S.filterChip, newParcel.fromCity === c && S.filterChipActive]}>
                  <Text style={[S.filterChipText, newParcel.fromCity === c && S.filterChipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[S.subLabel, { marginTop: 8 }]}>Ville d'arrivée *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {CI_CITIES.filter(c => c !== newParcel.fromCity).map(c => (
                <Pressable key={c} onPress={() => setNewParcel(p => ({ ...p, toCity: c }))}
                  style={[S.filterChip, newParcel.toCity === c && S.filterChipActive]}>
                  <Text style={[S.filterChipText, newParcel.toCity === c && S.filterChipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[S.subLabel, { marginTop: 8 }]}>Poids (kg)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {["0.5","1","2","3","5","10","15","20"].map(w => (
                <Pressable key={w} onPress={() => setNewParcel(p => ({ ...p, weight: w }))}
                  style={[S.filterChip, newParcel.weight === w && S.filterChipActive]}>
                  <Text style={[S.filterChipText, newParcel.weight === w && S.filterChipTextActive]}>{w} kg</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[S.subLabel, { marginTop: 8 }]}>Mode de paiement</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {[["cash","Cash"],["orange","Orange Money"],["mtn","MTN MoMo"],["wave","Wave"]].map(([val,lbl]) => (
                <Pressable key={val} onPress={() => setNewParcel(p => ({ ...p, paymentMethod: val }))}
                  style={[S.filterChip, newParcel.paymentMethod === val && S.filterChipActive]}>
                  <Text style={[S.filterChipText, newParcel.paymentMethod === val && S.filterChipTextActive]}>{lbl}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {parcelError !== "" && <Text style={{ color: "#DC2626", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 }}>{parcelError}</Text>}
            <View style={[S.modalBtns, { marginTop: 14 }]}>
              <Pressable style={S.modalCancel} onPress={() => { setAddParcelModal(false); setParcelError(""); }}>
                <Text style={S.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[S.modalConfirm, parcelSubmitting && S.modalConfirmDisabled]} onPress={handleCreateParcel} disabled={parcelSubmitting}>
                <Text style={S.modalConfirmText}>{parcelSubmitting ? "Création…" : "Enregistrer"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const S = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#F1F5F9" },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn:        { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle:    { color: "white", fontWeight: "700", fontSize: 16 },
  headerSub:      { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 1 },
  roleBadge:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeText:  { color: "white", fontSize: 12, fontWeight: "600" },

  tabBar:         { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", maxHeight: 50 },
  tabBarContent:  { paddingHorizontal: 12, gap: 4, alignItems: "center" },
  tab:            { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 12 },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  tabText:        { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  tabTextActive:  { color: PRIMARY, fontWeight: "700" },

  sectionTitle:   { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  sectionRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subLabel:       { fontSize: 12, color: "#64748B" },

  statsGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:       { backgroundColor: "white", borderRadius: 12, padding: 12, flex: 1, minWidth: "44%", borderLeftWidth: 3, gap: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statIcon:       { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue:      { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  statLabel:      { fontSize: 11, color: "#64748B" },

  quickGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard:      { backgroundColor: "white", borderRadius: 12, padding: 14, flex: 1, minWidth: "28%", alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  quickIcon:      { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickLabel:     { fontSize: 11, fontWeight: "600", color: "#475569" },

  busAvailRow:    { backgroundColor: "white", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  busAvailLeft:   { flex: 1 },
  busAvailName:   { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  busAvailSub:    { fontSize: 11, color: "#64748B", marginTop: 2 },
  busAvailBar:    { width: 70, height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  busAvailFill:   { height: "100%", borderRadius: 3 },
  busAvailPct:    { fontSize: 12, fontWeight: "700", color: "#475569", width: 36, textAlign: "right" },

  addBtn:         { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText:     { color: "white", fontSize: 12, fontWeight: "600" },

  tripCard:       { backgroundColor: "white", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  tripLeft:       { flex: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tripIconWrap:   { width: 36, height: 36, borderRadius: 10, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  tripRoute:      { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  tripMeta:       { fontSize: 11, color: "#64748B", marginTop: 2 },
  tripRight:      { alignItems: "flex-end", gap: 6 },
  tripPrice:      { fontSize: 14, fontWeight: "700", color: PRIMARY },
  seatBtn:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  seatBtnText:    { fontSize: 11, color: PRIMARY, fontWeight: "600" },

  filterChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  filterChipActive:    { backgroundColor: "#EEF2FF", borderColor: PRIMARY },
  filterChipText:      { fontSize: 12, color: "#64748B" },
  filterChipTextActive:{ color: PRIMARY, fontWeight: "600" },

  reservCard:     { backgroundColor: "white", borderRadius: 12, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  reservTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  reservRef:      { fontWeight: "700", color: "#1E293B", fontSize: 13 },
  reservMid:      { gap: 6, marginBottom: 10 },
  paxRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  seatTag:        { backgroundColor: "#EEF2FF", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  seatTagText:    { fontSize: 11, fontWeight: "700", color: PRIMARY },
  paxName:        { fontSize: 13, color: "#334155" },
  reservBottom:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8 },
  reservPay:      { fontSize: 12, color: "#64748B" },
  reservAmount:   { fontSize: 14, fontWeight: "700", color: "#059669" },

  seatSummaryRow: { flexDirection: "row", gap: 8 },
  seatSummaryCard:{ flex: 1, backgroundColor: "white", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1 },
  seatSummaryNum: { fontSize: 20, fontWeight: "800" },
  seatSummaryLabel:{ fontSize: 10, color: "#64748B", marginTop: 2 },

  seatLegend:     { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendItem:     { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:      { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5 },
  legendText:     { fontSize: 12, color: "#64748B" },

  tripChip:       { backgroundColor: "#F1F5F9", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#E2E8F0", minWidth: 120, alignItems: "center" },
  tripChipActive: { backgroundColor: "#EEF2FF", borderColor: PRIMARY },
  tripChipText:   { fontSize: 12, fontWeight: "600", color: "#475569" },
  tripChipTextActive: { color: PRIMARY },
  tripChipSub:    { fontSize: 10, color: "#94A3B8", marginTop: 2 },

  seatBusFrame:   { backgroundColor: "white", borderRadius: 16, padding: 16, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  busNose:        { marginBottom: 12, alignItems: "center" },
  seatGrid:       { gap: 6, width: "100%" },
  seatRow:        { flexDirection: "row", gap: 4, justifyContent: "center" },
  seat:           { width: 40, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  seatBooked:     { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  seatAvail:      { backgroundColor: "#ECFDF5", borderColor: "#86EFAC" },
  seatBlocked:    { backgroundColor: "#F5F3FF", borderColor: "#C4B5FD" },
  seatEmpty:      { width: 40, height: 36 },
  seatAisle:      { width: 12 },
  seatNum:        { fontSize: 10, fontWeight: "700" },

  revenueCard:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#ECFDF5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: "#86EFAC" },
  revenueLabel:   { fontSize: 13, color: "#065F46", flex: 1 },
  revenueAmount:  { fontSize: 14, fontWeight: "700", color: "#059669" },

  modalSubmit:    { borderRadius: 10, paddingVertical: 13, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 4 },
  modalSubmitText:{ fontSize: 14, fontWeight: "700" as const, color: "white" },

  passengerCard:  { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginVertical: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  seatDetailRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  seatDetailLabel:{ fontSize: 13, color: "#64748B", width: 80 },
  seatDetailValue:{ fontSize: 13, color: "#1E293B", fontWeight: "600", flex: 1 },

  listCard:       { backgroundColor: "white", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  listIcon:       { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  listTitle:      { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  listSub:        { fontSize: 12, color: "#64748B", marginTop: 2 },
  capacityBadge:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF2FF", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  capacityText:   { fontSize: 11, fontWeight: "600", color: PRIMARY },

  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:      { fontSize: 11, fontWeight: "600" },

  agentAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  agentAvatarText:{ fontSize: 16, fontWeight: "700", color: PRIMARY },
  assignBtn:      { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F5F3FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  assignBtnText:  { fontSize: 11, color: "#7C3AED", fontWeight: "600" },

  /* Modal */
  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard:      { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 0 },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  modalTitle:     { fontSize: 17, fontWeight: "700", color: "#1E293B" },
  modalInput:     { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1E293B", marginBottom: 10 },
  modalBtns:      { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancel:    { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalCancelText:{ fontSize: 14, fontWeight: "600", color: "#64748B" },
  modalConfirm:   { flex: 1, backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalConfirmDisabled: { opacity: 0.45 },
  modalConfirmText:{ fontSize: 14, fontWeight: "700", color: "white" },
  modalCapacityNote:{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F8FAFC", borderRadius: 8, padding: 10, marginBottom: 10 },
  modalCapacityNoteText:{ fontSize: 11, color: "#64748B" },

  /* Pickers */
  pickerLabel:    { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  pickerChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  pickerChipActive:    { backgroundColor: "#EEF2FF", borderColor: PRIMARY },
  pickerChipText:      { fontSize: 13, color: "#64748B", fontWeight: "500" },
  pickerChipTextActive:{ color: PRIMARY, fontWeight: "700" },

  cityChip:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  cityChipActive: { backgroundColor: "#EEF2FF", borderColor: PRIMARY },
  cityChipText:   { fontSize: 11, color: "#64748B" },
  cityChipTextActive: { color: PRIMARY, fontWeight: "600" },

  busPickerRow:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  busPickerRowActive: { borderColor: PRIMARY, backgroundColor: "#EEF2FF" },
  busPickerDot:   { width: 10, height: 10, borderRadius: 5 },
  busPickerName:  { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  busPickerSub:   { fontSize: 11, color: "#64748B", marginTop: 2 },

  tripBusInfo:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 8, padding: 10, marginBottom: 10 },
  tripBusInfoText:{ fontSize: 12, color: "#059669", fontWeight: "600" },
});
