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
const DARK = Colors.light.primaryDark;

/* ─── Types ─────────────────────────────────────────────── */
interface Stats { totalBuses: number; totalAgents: number; totalTrips: number; totalReservations: number; totalParcels: number; totalRevenue: number; activeBuses: number }
interface Bus { id: string; busName: string; plateNumber: string; busType: string; capacity: number; status: string }
interface Trip { id: string; from: string; to: string; date: string; departureTime: string; arrivalTime: string; price: number; totalSeats: number; busName: string; duration: string }
interface Reservation { id: string; bookingRef: string; tripId: string; totalAmount: number; status: string; paymentMethod: string; passengers: { name: string; seatNumber: string }[]; seatNumbers: string[]; createdAt: string }
interface SeatItem { id: string; number: string; row: number; column: number; type: string; status: string; price: number }
interface Parcel { id: string; trackingRef: string; fromCity: string; toCity: string; senderName: string; receiverName: string; weight: number; status: string; amount: number }
interface AgentItem { id: string; agentCode: string; status: string }

/* ─── Demo data ─────────────────────────────────────────── */
const DEMO_STATS: Stats = { totalBuses: 12, totalAgents: 18, totalTrips: 284, totalReservations: 1_420, totalParcels: 638, totalRevenue: 8_760_000, activeBuses: 9 };

const DEMO_BUSES: Bus[] = [
  { id: "b1", busName: "Express Abidjan 01", plateNumber: "0258 AB 01", busType: "Premium", capacity: 44, status: "active" },
  { id: "b2", busName: "Bouaké Direct 02", plateNumber: "0258 AB 02", busType: "Standard", capacity: 52, status: "active" },
  { id: "b3", busName: "Yamoussoukro 03", plateNumber: "0258 AB 03", busType: "Standard", capacity: 44, status: "maintenance" },
  { id: "b4", busName: "Korhogo Express 04", plateNumber: "0258 AB 04", busType: "Premium", capacity: 36, status: "active" },
  { id: "b5", busName: "San Pedro 05", plateNumber: "0258 AB 05", busType: "Standard", capacity: 52, status: "active" },
];

const DEMO_TRIPS: Trip[] = [
  { id: "t1", from: "Abidjan", to: "Bouaké", date: "17/03/2026", departureTime: "08h00", arrivalTime: "12h00", price: 3500, totalSeats: 44, busName: "Express Abidjan 01", duration: "4h00" },
  { id: "t2", from: "Abidjan", to: "Yamoussoukro", date: "17/03/2026", departureTime: "09h00", arrivalTime: "12h30", price: 2000, totalSeats: 52, busName: "Bouaké Direct 02", duration: "3h30" },
  { id: "t3", from: "Abidjan", to: "Korhogo", date: "18/03/2026", departureTime: "07h00", arrivalTime: "15h00", price: 6000, totalSeats: 36, busName: "Korhogo Express 04", duration: "8h00" },
  { id: "t4", from: "Bouaké", to: "Korhogo", date: "18/03/2026", departureTime: "10h00", arrivalTime: "14h00", price: 2500, totalSeats: 44, busName: "Express Abidjan 01", duration: "4h00" },
  { id: "t5", from: "San Pedro", to: "Abidjan", date: "19/03/2026", departureTime: "06h00", arrivalTime: "12h00", price: 3000, totalSeats: 52, busName: "San Pedro 05", duration: "6h00" },
];

const DEMO_RESERVATIONS: Reservation[] = [
  { id: "r1", bookingRef: "GBB5AKZ8DZ", tripId: "t1", totalAmount: 7000, status: "confirmed", paymentMethod: "orange", passengers: [{ name: "Kouassi Ama", seatNumber: "A3" }, { name: "Traoré Youssouf", seatNumber: "A4" }], seatNumbers: ["A3","A4"], createdAt: "2026-03-17T08:00:00Z" },
  { id: "r2", bookingRef: "GBB9MNX2PL", tripId: "t1", totalAmount: 3500, status: "boarded", paymentMethod: "mtn", passengers: [{ name: "Bamba Koffi", seatNumber: "B1" }], seatNumbers: ["B1"], createdAt: "2026-03-17T07:30:00Z" },
  { id: "r3", bookingRef: "GBBA1C3RQ7", tripId: "t2", totalAmount: 4000, status: "confirmed", paymentMethod: "wave", passengers: [{ name: "Diallo Mariam", seatNumber: "C2" }, { name: "Diallo Seydou", seatNumber: "C3" }], seatNumbers: ["C2","C3"], createdAt: "2026-03-16T15:00:00Z" },
  { id: "r4", bookingRef: "GBB7FPV6NM", tripId: "t3", totalAmount: 6000, status: "confirmed", paymentMethod: "orange", passengers: [{ name: "Coulibaly Jean", seatNumber: "D5" }], seatNumbers: ["D5"], createdAt: "2026-03-16T12:00:00Z" },
  { id: "r5", bookingRef: "GBBC5XK0TZ", tripId: "t2", totalAmount: 2000, status: "cancelled", paymentMethod: "visa", passengers: [{ name: "Assiéta Koné", seatNumber: "E1" }], seatNumbers: ["E1"], createdAt: "2026-03-15T10:00:00Z" },
];

const DEMO_PARCELS: Parcel[] = [
  { id: "p1", trackingRef: "GBX-A4F2-KM91", fromCity: "Abidjan", toCity: "Bouaké", senderName: "Assiéta Koné", receiverName: "Diabaté Oumar", weight: 4.5, status: "en_transit", amount: 4700 },
  { id: "p2", trackingRef: "GBX-B9C3-PL44", fromCity: "San Pedro", toCity: "Abidjan", senderName: "Traoré Adama", receiverName: "Koffi Ama", weight: 1.2, status: "livre", amount: 6200 },
  { id: "p3", trackingRef: "GBX-C1E7-QR22", fromCity: "Abidjan", toCity: "Yamoussoukro", senderName: "Bamba Sali", receiverName: "Coulibaly Jean", weight: 2.1, status: "en_attente", amount: 3500 },
  { id: "p4", trackingRef: "GBX-D5F8-MN33", fromCity: "Abidjan", toCity: "Korhogo", senderName: "Koffi Ama", receiverName: "Diallo Jean", weight: 8.0, status: "pris_en_charge", amount: 8100 },
  { id: "p5", trackingRef: "GBX-E2G9-XY77", fromCity: "Bouaké", toCity: "Abidjan", senderName: "Traoré Mamadou", receiverName: "Coulibaly Sali", weight: 3.0, status: "en_livraison", amount: 5200 },
];

const DEMO_AGENTS = [
  { id: "a1", name: "Kouassi Jean", code: "AGT-001", bus: "Express Abidjan 01", phone: "0707 11 22 33", status: "active" },
  { id: "a2", name: "Traoré Mamadou", code: "AGT-002", bus: "Bouaké Direct 02", phone: "0505 44 55 66", status: "active" },
  { id: "a3", name: "Bamba Fatima", code: "AGT-003", bus: "Korhogo Express 04", phone: "0101 77 88 99", status: "active" },
  { id: "a4", name: "Diallo Seydou", code: "AGT-004", bus: "Non assigné", phone: "0707 22 33 44", status: "inactive" },
  { id: "a5", name: "Coulibaly Koffi", code: "AGT-005", bus: "Yamoussoukro 03", phone: "0505 55 66 77", status: "active" },
  { id: "a6", name: "Assiéta Koné", code: "AGT-006", bus: "San Pedro 05", phone: "0101 88 99 00", status: "active" },
];

// Generate a demo seat grid for a 44-seat bus (11 rows × 4 columns)
function genDemoSeats(tripId: string, booked = 31): SeatItem[] {
  const seats: SeatItem[] = [];
  const rows = 11;
  const letters = ["A", "B", "C", "D"];
  let idx = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < 4; c++) {
      idx++;
      const num = `${letters[c]}${r}`;
      seats.push({ id: `${tripId}-${num}`, number: num, row: r, column: c, type: c === 1 ? "window" : "aisle", status: idx <= booked ? "booked" : "available", price: 3500 });
    }
  }
  return seats;
}

/* ─── Status helpers ─────────────────────────────────────── */
const PARCEL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:     { label: "En attente",     color: "#B45309", bg: "#FFFBEB" },
  pris_en_charge: { label: "Pris en charge", color: "#1D4ED8", bg: "#EFF6FF" },
  en_transit:     { label: "En transit",     color: "#6D28D9", bg: "#F5F3FF" },
  en_livraison:   { label: "En livraison",   color: "#0E7490", bg: "#ECFEFF" },
  livre:          { label: "Livré",          color: "#065F46", bg: "#ECFDF5" },
  annule:         { label: "Annulé",         color: "#DC2626", bg: "#FEF2F2" },
};
const BOOKING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:  { label: "Confirmé",    color: PRIMARY,   bg: "#EEF2FF" },
  boarded:    { label: "Embarqué",    color: "#065F46", bg: "#ECFDF5" },
  cancelled:  { label: "Annulé",      color: "#DC2626", bg: "#FEF2F2" },
  pending:    { label: "En attente",  color: "#B45309", bg: "#FFFBEB" },
};
const PAYMENT_LABELS: Record<string, string> = {
  orange: "Orange Money", mtn: "MTN MoMo", wave: "Wave", visa: "Visa/MC",
};

type Tab = "apercu" | "trajets" | "reservations" | "sieges" | "bus" | "colis" | "agents";

/* ─── Component ─────────────────────────────────────────── */
export default function CompanyDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("apercu");
  const [stats, setStats] = useState<Stats>(DEMO_STATS);
  const [buses, setBuses] = useState<Bus[]>(DEMO_BUSES);
  const [trips, setTrips] = useState<Trip[]>(DEMO_TRIPS);
  const [reservations, setReservations] = useState<Reservation[]>(DEMO_RESERVATIONS);
  const [parcels, setParcels] = useState<Parcel[]>(DEMO_PARCELS);
  const [selectedTripForSeats, setSelectedTripForSeats] = useState<Trip>(DEMO_TRIPS[0]);
  const [seats, setSeats] = useState<SeatItem[]>(genDemoSeats("t1", 31));
  const [addBusModal, setAddBusModal] = useState(false);
  const [addTripModal, setAddTripModal] = useState(false);
  const [newBus, setNewBus] = useState({ busName: "", plateNumber: "", busType: "Standard", capacity: "44" });
  const [newTrip, setNewTrip] = useState({ from: "", to: "", date: "", departureTime: "", price: "", busName: "", totalSeats: "44" });
  const [reservationFilter, setReservationFilter] = useState<"all" | "confirmed" | "boarded" | "cancelled">("all");

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      apiFetch<Stats>("/company/stats", { token }),
      apiFetch<Bus[]>("/company/buses", { token }),
      apiFetch<Trip[]>("/company/trips", { token }),
      apiFetch<Reservation[]>("/company/reservations", { token }),
      apiFetch<Parcel[]>("/company/parcels", { token }),
    ]).then(([s, b, t, r, p]) => {
      if (s.status === "fulfilled") setStats(s.value);
      if (b.status === "fulfilled" && b.value.length > 0) setBuses(b.value);
      if (t.status === "fulfilled" && t.value.length > 0) setTrips(t.value);
      if (r.status === "fulfilled" && r.value.length > 0) setReservations(r.value);
      if (p.status === "fulfilled" && p.value.length > 0) setParcels(p.value);
    });
  }, [token]);

  const loadSeats = async (trip: Trip) => {
    setSelectedTripForSeats(trip);
    setActiveTab("sieges");
    setSeats(genDemoSeats(trip.id, Math.floor(trip.totalSeats * 0.7)));
    if (token) {
      try {
        const s = await apiFetch<SeatItem[]>(`/company/seats/${trip.id}`, { token });
        if (s.length > 0) setSeats(s);
      } catch {}
    }
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "apercu", label: "Aperçu", icon: "bar-chart-2" },
    { id: "trajets", label: "Trajets", icon: "navigation" },
    { id: "reservations", label: "Réservations", icon: "bookmark" },
    { id: "sieges", label: "Sièges", icon: "grid" },
    { id: "bus", label: "Bus", icon: "truck" },
    { id: "colis", label: "Colis", icon: "package" },
    { id: "agents", label: "Agents", icon: "users" },
  ];

  const filteredRes = reservationFilter === "all" ? reservations : reservations.filter(r => r.status === reservationFilter);
  const seatBooked = seats.filter(s => s.status === "booked").length;
  const seatAvail = seats.filter(s => s.status === "available").length;

  return (
    <View style={[S.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient colors={[PRIMARY, DARK]} style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
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
              { icon: "truck", label: "Bus actifs", value: `${stats.activeBuses}/${stats.totalBuses}`, color: "#1D4ED8", bg: "#EFF6FF" },
              { icon: "users", label: "Agents", value: stats.totalAgents, color: "#7C3AED", bg: "#F5F3FF" },
              { icon: "navigation", label: "Trajets", value: stats.totalTrips, color: PRIMARY, bg: "#EEF2FF" },
              { icon: "bookmark", label: "Réservations", value: stats.totalReservations.toLocaleString(), color: "#059669", bg: "#ECFDF5" },
              { icon: "package", label: "Colis", value: stats.totalParcels, color: "#D97706", bg: "#FFFBEB" },
              { icon: "trending-up", label: "Revenus", value: `${(stats.totalRevenue / 1_000_000).toFixed(1)} M FCFA`, color: "#0891B2", bg: "#ECFEFF" },
            ].map((c, i) => (
              <View key={i} style={[S.statCard, { borderLeftColor: c.color }]}>
                <View style={[S.statIcon, { backgroundColor: c.bg }]}><Feather name={c.icon as never} size={16} color={c.color} /></View>
                <Text style={S.statValue}>{c.value}</Text>
                <Text style={S.statLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          <Text style={[S.sectionTitle, { marginTop: 8 }]}>Accès rapide</Text>
          <View style={S.quickGrid}>
            {([
              { icon: "navigation", label: "Trajets", tab: "trajets" as Tab, color: "#1D4ED8", bg: "#EFF6FF" },
              { icon: "bookmark", label: "Réservations", tab: "reservations" as Tab, color: "#059669", bg: "#ECFDF5" },
              { icon: "grid", label: "Sièges", tab: "sieges" as Tab, color: "#6D28D9", bg: "#F5F3FF" },
              { icon: "truck", label: "Bus", tab: "bus" as Tab, color: PRIMARY, bg: "#EEF2FF" },
              { icon: "package", label: "Colis", tab: "colis" as Tab, color: "#D97706", bg: "#FFFBEB" },
              { icon: "users", label: "Agents", tab: "agents" as Tab, color: "#0891B2", bg: "#ECFEFF" },
            ] as const).map(item => (
              <TouchableOpacity key={item.tab} style={S.quickCard} onPress={() => setActiveTab(item.tab)} activeOpacity={0.8}>
                <View style={[S.quickIcon, { backgroundColor: item.bg }]}><Feather name={item.icon as never} size={20} color={item.color} /></View>
                <Text style={S.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
          {trips.map(trip => (
            <View key={trip.id} style={S.tripCard}>
              <View style={S.tripLeft}>
                <View style={S.tripIconWrap}><Feather name="navigation" size={16} color={PRIMARY} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.tripRoute}>{trip.from} → {trip.to}</Text>
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
            </View>
          ))}
        </>)}

        {/* ── Réservations ── */}
        {activeTab === "reservations" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Réservations ({reservations.length})</Text>
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
              </View>
            );
          })}
        </>)}

        {/* ── Sièges ── */}
        {activeTab === "sieges" && (<>
          <Text style={S.sectionTitle}>Sièges — {selectedTripForSeats.from} → {selectedTripForSeats.to}</Text>
          <Text style={[S.subLabel, { marginBottom: 4 }]}>{selectedTripForSeats.date} · {selectedTripForSeats.departureTime}</Text>

          <View style={S.seatSummaryRow}>
            <View style={[S.seatSummaryCard, { borderColor: "#BBF7D0" }]}>
              <Text style={[S.seatSummaryNum, { color: "#059669" }]}>{seatAvail}</Text>
              <Text style={S.seatSummaryLabel}>Disponibles</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#FECACA" }]}>
              <Text style={[S.seatSummaryNum, { color: "#DC2626" }]}>{seatBooked}</Text>
              <Text style={S.seatSummaryLabel}>Réservés</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#C7D2FE" }]}>
              <Text style={[S.seatSummaryNum, { color: PRIMARY }]}>{seats.length}</Text>
              <Text style={S.seatSummaryLabel}>Total</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#FDE68A" }]}>
              <Text style={[S.seatSummaryNum, { color: "#D97706" }]}>{Math.round((seatBooked / Math.max(seats.length, 1)) * 100)}%</Text>
              <Text style={S.seatSummaryLabel}>Taux</Text>
            </View>
          </View>

          <View style={S.seatLegend}>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#ECFDF5", borderColor: "#059669" }]} /><Text style={S.legendText}>Disponible</Text></View>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#FEF2F2", borderColor: "#DC2626" }]} /><Text style={S.legendText}>Réservé</Text></View>
          </View>

          <View style={S.seatBusFrame}>
            <View style={S.busNose}><Feather name="truck" size={18} color="#94A3B8" /></View>
            <View style={S.seatGrid}>
              {Array.from({ length: 11 }, (_, rowIdx) => (
                <View key={rowIdx} style={S.seatRow}>
                  {[0, 1].map(col => {
                    const s = seats.find(s => s.row === rowIdx + 1 && s.column === col);
                    return s ? (
                      <View key={col} style={[S.seat, s.status === "booked" ? S.seatBooked : S.seatAvail]}>
                        <Text style={[S.seatNum, { color: s.status === "booked" ? "#DC2626" : "#059669" }]}>{s.number}</Text>
                      </View>
                    ) : <View key={col} style={S.seatEmpty} />;
                  })}
                  <View style={S.seatAisle} />
                  {[2, 3].map(col => {
                    const s = seats.find(s => s.row === rowIdx + 1 && s.column === col);
                    return s ? (
                      <View key={col} style={[S.seat, s.status === "booked" ? S.seatBooked : S.seatAvail]}>
                        <Text style={[S.seatNum, { color: s.status === "booked" ? "#DC2626" : "#059669" }]}>{s.number}</Text>
                      </View>
                    ) : <View key={col} style={S.seatEmpty} />;
                  })}
                </View>
              ))}
            </View>
          </View>

          <Text style={[S.subLabel, { textAlign: "center", marginTop: 4 }]}>Touchez un trajet dans l'onglet Trajets pour voir ses sièges</Text>
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
                <Text style={S.listSub}>{bus.plateNumber} · {bus.busType} · {bus.capacity} places</Text>
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
          <Text style={S.sectionTitle}>Expéditions ({parcels.length})</Text>
          {parcels.map(parcel => {
            const st = PARCEL_STATUS[parcel.status] ?? PARCEL_STATUS.en_attente;
            return (
              <View key={parcel.id} style={S.listCard}>
                <View style={[S.listIcon, { backgroundColor: st.bg }]}><Feather name="package" size={16} color={st.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.listTitle}>{parcel.trackingRef}</Text>
                  <Text style={S.listSub}>{parcel.fromCity} → {parcel.toCity} · {parcel.weight} kg</Text>
                  <Text style={S.listSub}>{parcel.senderName} → {parcel.receiverName}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 5 }}>
                  <View style={[S.badge, { backgroundColor: st.bg }]}><Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text></View>
                  <Text style={[S.badgeText, { color: PRIMARY }]}>{parcel.amount.toLocaleString()} F</Text>
                </View>
              </View>
            );
          })}
        </>)}

        {/* ── Agents ── */}
        {activeTab === "agents" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Agents ({DEMO_AGENTS.length})</Text>
            <TouchableOpacity style={S.addBtn} activeOpacity={0.8}>
              <Feather name="user-plus" size={14} color="white" /><Text style={S.addBtnText}>Inviter</Text>
            </TouchableOpacity>
          </View>
          {DEMO_AGENTS.map(agent => (
            <View key={agent.id} style={S.listCard}>
              <View style={S.agentAvatar}><Text style={S.agentAvatarText}>{agent.name.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={S.listTitle}>{agent.name}</Text>
                <Text style={S.listSub}>{agent.code} · {agent.phone}</Text>
                <Text style={S.listSub}>{agent.bus}</Text>
              </View>
              <View style={[S.badge, { backgroundColor: agent.status === "active" ? "#ECFDF5" : "#F1F5F9" }]}>
                <Text style={[S.badgeText, { color: agent.status === "active" ? "#065F46" : "#64748B" }]}>
                  {agent.status === "active" ? "Actif" : "Inactif"}
                </Text>
              </View>
            </View>
          ))}
        </>)}

      </ScrollView>

      {/* Add Bus Modal */}
      <Modal visible={addBusModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Ajouter un bus</Text>
            <TextInput style={S.modalInput} placeholder="Nom du bus" value={newBus.busName} onChangeText={v => setNewBus(p => ({ ...p, busName: v }))} />
            <TextInput style={S.modalInput} placeholder="Plaque d'immatriculation" value={newBus.plateNumber} onChangeText={v => setNewBus(p => ({ ...p, plateNumber: v }))} />
            <TextInput style={S.modalInput} placeholder="Capacité (ex: 44)" keyboardType="numeric" value={newBus.capacity} onChangeText={v => setNewBus(p => ({ ...p, capacity: v }))} />
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setAddBusModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={S.modalConfirm} onPress={() => {
                if (!newBus.busName || !newBus.plateNumber) return;
                setBuses(p => [...p, { id: Date.now().toString(), busName: newBus.busName, plateNumber: newBus.plateNumber, busType: "Standard", capacity: Number(newBus.capacity) || 44, status: "active" }]);
                setStats(s => ({ ...s, totalBuses: s.totalBuses + 1 }));
                setAddBusModal(false);
                setNewBus({ busName: "", plateNumber: "", busType: "Standard", capacity: "44" });
              }}><Text style={S.modalConfirmText}>Ajouter</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Trip Modal */}
      <Modal visible={addTripModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <ScrollView contentContainerStyle={S.modalCard}>
            <Text style={S.modalTitle}>Nouveau trajet</Text>
            <TextInput style={S.modalInput} placeholder="Ville de départ" value={newTrip.from} onChangeText={v => setNewTrip(p => ({ ...p, from: v }))} />
            <TextInput style={S.modalInput} placeholder="Ville d'arrivée" value={newTrip.to} onChangeText={v => setNewTrip(p => ({ ...p, to: v }))} />
            <TextInput style={S.modalInput} placeholder="Date (ex: 20/03/2026)" value={newTrip.date} onChangeText={v => setNewTrip(p => ({ ...p, date: v }))} />
            <TextInput style={S.modalInput} placeholder="Heure de départ (ex: 08h00)" value={newTrip.departureTime} onChangeText={v => setNewTrip(p => ({ ...p, departureTime: v }))} />
            <TextInput style={S.modalInput} placeholder="Prix par place (FCFA)" keyboardType="numeric" value={newTrip.price} onChangeText={v => setNewTrip(p => ({ ...p, price: v }))} />
            <TextInput style={S.modalInput} placeholder="Nom du bus" value={newTrip.busName} onChangeText={v => setNewTrip(p => ({ ...p, busName: v }))} />
            <TextInput style={S.modalInput} placeholder="Nombre de places (ex: 44)" keyboardType="numeric" value={newTrip.totalSeats} onChangeText={v => setNewTrip(p => ({ ...p, totalSeats: v }))} />
            <View style={S.modalBtns}>
              <Pressable style={S.modalCancel} onPress={() => setAddTripModal(false)}><Text style={S.modalCancelText}>Annuler</Text></Pressable>
              <Pressable style={S.modalConfirm} onPress={() => {
                if (!newTrip.from || !newTrip.to || !newTrip.date || !newTrip.price) return;
                const t: Trip = { id: Date.now().toString(), from: newTrip.from, to: newTrip.to, date: newTrip.date, departureTime: newTrip.departureTime || "08h00", arrivalTime: "12h00", price: Number(newTrip.price), totalSeats: Number(newTrip.totalSeats) || 44, busName: newTrip.busName || "Bus GoBooking", duration: "4h00" };
                setTrips(p => [t, ...p]);
                setStats(s => ({ ...s, totalTrips: s.totalTrips + 1 }));
                setAddTripModal(false);
                setNewTrip({ from: "", to: "", date: "", departureTime: "", price: "", busName: "", totalSeats: "44" });
              }}><Text style={S.modalConfirmText}>Créer</Text></Pressable>
            </View>
          </ScrollView>
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
  tabActive: { borderBottomColor: PRIMARY },
  tabText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  tabTextActive: { color: PRIMARY, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  subLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", backgroundColor: "white", borderRadius: 14, padding: 14, borderLeftWidth: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 4 },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: { width: "30%", flex: 1, backgroundColor: "white", borderRadius: 16, padding: 14, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  quickIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  quickLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  listCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  listIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  listTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  listSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  agentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  agentAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  tripCard: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 14, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  tripLeft: { flex: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tripIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", flexShrink: 0 },
  tripRoute: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  tripMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  tripRight: { alignItems: "flex-end", gap: 6 },
  tripPrice: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#059669" },
  seatBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  seatBtnText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "white" },
  filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B" },
  filterChipTextActive: { color: "white", fontFamily: "Inter_700Bold" },
  reservCard: { backgroundColor: "white", borderRadius: 14, padding: 14, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  reservTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reservRef: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  reservMid: { gap: 6 },
  paxRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  seatTag: { width: 32, height: 28, borderRadius: 8, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  seatTagText: { fontSize: 10, fontFamily: "Inter_700Bold", color: PRIMARY },
  paxName: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#0F172A" },
  reservBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  reservPay: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  reservAmount: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#059669" },
  seatSummaryRow: { flexDirection: "row", gap: 8 },
  seatSummaryCard: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1.5 },
  seatSummaryNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  seatSummaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" },
  seatLegend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5 },
  legendText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  seatBusFrame: { backgroundColor: "white", borderRadius: 20, padding: 16, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  busNose: { alignItems: "center", marginBottom: 4 },
  seatGrid: { gap: 6 },
  seatRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  seat: { width: 38, height: 38, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  seatAvail: { backgroundColor: "#F0FDF4", borderColor: "#059669" },
  seatBooked: { backgroundColor: "#FEF2F2", borderColor: "#DC2626" },
  seatEmpty: { width: 38, height: 38 },
  seatAisle: { width: 12 },
  seatNum: { fontSize: 9, fontFamily: "Inter_700Bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 4 },
  modalInput: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#0F172A" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  modalConfirm: { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalConfirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
});
