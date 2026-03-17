import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = Colors.light.primary;

/* ─── Types ─────────────────────────────────────────────── */
interface Passenger { name: string; age: number; gender: string; seatNumber: string }
interface BoardingEntry { id: string; bookingRef: string; passengers: Passenger[]; seatNumbers: string[]; status: string; totalAmount: number }
interface ParcelEntry { id: string; trackingRef: string; fromCity: string; toCity: string; senderName: string; receiverName: string; receiverPhone: string; weight: number; status: string; amount: number }
interface SeatItem { id: string; number: string; row: number; column: number; status: string }

/* ─── Demo data ─────────────────────────────────────────── */
const DEMO_BUS = { busName: "Express Abidjan 01", plateNumber: "0258 AB 01", busType: "Premium", capacity: 44 };
const DEMO_TRIP = { id: "t-demo", from: "Abidjan", to: "Bouaké", date: "17/03/2026", departureTime: "08h00", totalSeats: 44, bookedSeats: 31 };

function genDemoSeats(capacity: number, booked: number): SeatItem[] {
  const seats: SeatItem[] = [];
  const letters = ["A", "B", "C", "D"];
  const rows = Math.ceil(capacity / 4);
  let idx = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < 4; c++) {
      idx++;
      if (idx > capacity) break;
      const num = `${letters[c]}${r}`;
      seats.push({ id: `s-${num}`, number: num, row: r, column: c, status: idx <= booked ? "booked" : "available" });
    }
  }
  return seats;
}

const DEMO_BOARDING: BoardingEntry[] = [
  { id: "bk1", bookingRef: "GBB5AKZ8DZ", passengers: [{ name: "Kouassi Ama", age: 34, gender: "F", seatNumber: "A3" }], seatNumbers: ["A3"], status: "confirmed", totalAmount: 3500 },
  { id: "bk2", bookingRef: "GBB9MNX2PL", passengers: [{ name: "Traoré Youssouf", age: 28, gender: "M", seatNumber: "B1" }, { name: "Traoré Fatoumata", age: 25, gender: "F", seatNumber: "B2" }], seatNumbers: ["B1","B2"], status: "confirmed", totalAmount: 7000 },
  { id: "bk3", bookingRef: "GBBA1C3RQ7", passengers: [{ name: "Bamba Koffi", age: 45, gender: "M", seatNumber: "C4" }], seatNumbers: ["C4"], status: "boarded", totalAmount: 3500 },
  { id: "bk4", bookingRef: "GBB7FPV6NM", passengers: [{ name: "Diallo Mariam", age: 22, gender: "F", seatNumber: "D2" }], seatNumbers: ["D2"], status: "confirmed", totalAmount: 3500 },
  { id: "bk5", bookingRef: "GBBC5XK0TZ", passengers: [{ name: "Coulibaly Seydou", age: 38, gender: "M", seatNumber: "E1" }], seatNumbers: ["E1"], status: "boarded", totalAmount: 3500 },
  { id: "bk6", bookingRef: "GBB3RKZ9QW", passengers: [{ name: "Assiéta Koné", age: 29, gender: "F", seatNumber: "F3" }], seatNumbers: ["F3"], status: "confirmed", totalAmount: 3500 },
];

const DEMO_PARCELS: ParcelEntry[] = [
  { id: "p1", trackingRef: "GBX-A4F2-KM91", fromCity: "Abidjan", toCity: "Bouaké", senderName: "Assiéta Koné", receiverName: "Diabaté Oumar", receiverPhone: "0707 11 22 33", weight: 4.5, status: "en_attente", amount: 4700 },
  { id: "p2", trackingRef: "GBX-C1E7-QR22", fromCity: "Abidjan", toCity: "Yamoussoukro", senderName: "Bamba Sali", receiverName: "Traoré Adama", receiverPhone: "0505 44 55 66", weight: 2.1, status: "pris_en_charge", amount: 3500 },
  { id: "p3", trackingRef: "GBX-D5F8-MN33", fromCity: "Abidjan", toCity: "Korhogo", senderName: "Koffi Ama", receiverName: "Coulibaly Jean", receiverPhone: "0101 77 88 99", weight: 8.0, status: "en_transit", amount: 8100 },
  { id: "p4", trackingRef: "GBX-E2G9-XY77", fromCity: "Bouaké", toCity: "Abidjan", senderName: "Traoré Mamadou", receiverName: "Coulibaly Sali", receiverPhone: "0101 33 44 55", weight: 3.0, status: "en_livraison", amount: 5200 },
];

const PARCEL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:     { label: "En attente",     color: "#B45309", bg: "#FFFBEB" },
  pris_en_charge: { label: "Pris en charge", color: "#1D4ED8", bg: "#EFF6FF" },
  en_transit:     { label: "En transit",     color: "#6D28D9", bg: "#F5F3FF" },
  en_livraison:   { label: "En livraison",   color: "#0E7490", bg: "#ECFEFF" },
  livre:          { label: "Livré",          color: "#065F46", bg: "#ECFDF5" },
};

type Tab = "mission" | "sieges" | "embarquement" | "colis";

/* ─── Component ─────────────────────────────────────────── */
export default function AgentDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("mission");
  const [boarding, setBoarding] = useState<BoardingEntry[]>(DEMO_BOARDING);
  const [parcels, setParcels] = useState<ParcelEntry[]>(DEMO_PARCELS);
  const [seats, setSeats] = useState<SeatItem[]>(genDemoSeats(DEMO_BUS.capacity, DEMO_TRIP.bookedSeats));

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      apiFetch<BoardingEntry[]>("/agent/boarding", { token }),
      apiFetch<ParcelEntry[]>("/agent/parcels", { token }),
      apiFetch<SeatItem[]>(`/agent/seats/${DEMO_TRIP.id}`, { token }),
    ]).then(([b, p, s]) => {
      if (b.status === "fulfilled" && b.value.length > 0) setBoarding(b.value);
      if (p.status === "fulfilled" && p.value.length > 0) setParcels(p.value);
      if (s.status === "fulfilled" && s.value.length > 0) setSeats(s.value);
    });
  }, [token]);

  const validateBoarding = async (bookingId: string) => {
    setBoarding(prev => prev.map(b => b.id === bookingId ? { ...b, status: "boarded" } : b));
    if (token) { try { await apiFetch(`/agent/boarding/${bookingId}/validate`, { token, method: "POST" }); } catch {} }
  };

  const updateParcel = async (parcelId: string, newStatus: string, action: "pickup" | "transit" | "deliver") => {
    setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: newStatus } : p));
    if (token) { try { await apiFetch(`/agent/parcels/${parcelId}/${action}`, { token, method: "POST" }); } catch {} }
  };

  const boarded = boarding.filter(b => b.status === "boarded").length;
  const waiting = boarding.filter(b => b.status === "confirmed").length;
  const seatBooked = seats.filter(s => s.status === "booked").length;
  const seatAvail = seats.filter(s => s.status === "available").length;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "mission", label: "Mission", icon: "navigation" },
    { id: "sieges", label: "Sièges", icon: "grid" },
    { id: "embarquement", label: "Embarquement", icon: "users" },
    { id: "colis", label: "Colis", icon: "package" },
  ];

  return (
    <View style={[S.container, { paddingTop: topPad }]}>
      <LinearGradient colors={["#059669", "#047857"]} style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Espace Agent</Text>
          <Text style={S.headerSub}>Kouassi Jean · AGT-001</Text>
        </View>
        <View style={S.roleBadge}>
          <Feather name="user" size={13} color="white" />
          <Text style={S.roleBadgeText}>Agent</Text>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabBar} contentContainerStyle={S.tabBarContent}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[S.tab, activeTab === tab.id && S.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Feather name={tab.icon as never} size={14} color={activeTab === tab.id ? "#059669" : "#94A3B8"} />
            <Text style={[S.tabText, activeTab === tab.id && S.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* ── Mission ── */}
        {activeTab === "mission" && (<>
          <View style={S.busCard}>
            <LinearGradient colors={[PRIMARY, "#0F3BA0"]} style={S.busGradient}>
              <View style={S.busTop}>
                <View style={S.busIconWrap}><Feather name="truck" size={26} color="white" /></View>
                <View style={S.onlinePill}>
                  <View style={S.onlineDot} />
                  <Text style={S.onlineText}>En service</Text>
                </View>
              </View>
              <Text style={S.busName}>{DEMO_BUS.busName}</Text>
              <Text style={S.busPlate}>{DEMO_BUS.plateNumber} · {DEMO_BUS.busType} · {DEMO_BUS.capacity} places</Text>
            </LinearGradient>
          </View>

          <View style={S.tripCard}>
            <Text style={S.sectionTitle}>Trajet du jour</Text>
            <View style={S.tripRow}>
              <View style={S.cityBlock}>
                <View style={[S.cityDot, { backgroundColor: "#10B981" }]} />
                <Text style={S.cityName}>{DEMO_TRIP.from}</Text>
                <Text style={S.cityTime}>{DEMO_TRIP.departureTime}</Text>
              </View>
              <View style={S.tripArrow}>
                <View style={S.dashedLine} />
                <Feather name="arrow-right" size={16} color={PRIMARY} />
                <View style={S.dashedLine} />
              </View>
              <View style={[S.cityBlock, { alignItems: "flex-end" }]}>
                <View style={[S.cityDot, { backgroundColor: "#EF4444" }]} />
                <Text style={S.cityName}>{DEMO_TRIP.to}</Text>
                <Text style={S.cityTime}>{DEMO_TRIP.date}</Text>
              </View>
            </View>
          </View>

          <Text style={S.sectionTitle}>Résumé de mission</Text>
          <View style={S.summaryGrid}>
            <View style={S.summaryCard}>
              <Text style={[S.summaryNum, { color: "#059669" }]}>{boarded}</Text>
              <Text style={S.summaryLabel}>Embarqués</Text>
            </View>
            <View style={[S.summaryCard, { borderColor: "#FDE68A" }]}>
              <Text style={[S.summaryNum, { color: "#B45309" }]}>{waiting}</Text>
              <Text style={S.summaryLabel}>En attente</Text>
            </View>
            <View style={[S.summaryCard, { borderColor: "#BBF7D0" }]}>
              <Text style={[S.summaryNum, { color: "#065F46" }]}>{seatBooked}/{DEMO_TRIP.totalSeats}</Text>
              <Text style={S.summaryLabel}>Réservés</Text>
            </View>
            <View style={[S.summaryCard, { borderColor: "#E9D5FF" }]}>
              <Text style={[S.summaryNum, { color: "#6D28D9" }]}>{parcels.filter(p => !["livre", "annule"].includes(p.status)).length}</Text>
              <Text style={S.summaryLabel}>Colis actifs</Text>
            </View>
          </View>

          <View style={S.quickActionsRow}>
            <TouchableOpacity style={[S.quickAction, { backgroundColor: "#ECFDF5" }]} onPress={() => setActiveTab("sieges")} activeOpacity={0.8}>
              <Feather name="grid" size={20} color="#059669" />
              <Text style={[S.quickActionText, { color: "#059669" }]}>Voir sièges</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.quickAction, { backgroundColor: "#EEF2FF" }]} onPress={() => setActiveTab("embarquement")} activeOpacity={0.8}>
              <Feather name="users" size={20} color={PRIMARY} />
              <Text style={[S.quickActionText, { color: PRIMARY }]}>Embarquement</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.quickAction, { backgroundColor: "#FFFBEB" }]} onPress={() => setActiveTab("colis")} activeOpacity={0.8}>
              <Feather name="package" size={20} color="#D97706" />
              <Text style={[S.quickActionText, { color: "#D97706" }]}>Colis</Text>
            </TouchableOpacity>
          </View>
        </>)}

        {/* ── Sièges ── */}
        {activeTab === "sieges" && (<>
          <Text style={S.sectionTitle}>Plan des sièges</Text>
          <Text style={S.subLabel}>{DEMO_TRIP.from} → {DEMO_TRIP.to} · {DEMO_TRIP.date} · {DEMO_TRIP.departureTime}</Text>

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
              <Text style={S.seatSummaryLabel}>Rempli</Text>
            </View>
          </View>

          <View style={S.seatLegend}>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#F0FDF4", borderColor: "#059669" }]} /><Text style={S.legendText}>Disponible</Text></View>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#FEF2F2", borderColor: "#DC2626" }]} /><Text style={S.legendText}>Réservé</Text></View>
          </View>

          <View style={S.seatBusFrame}>
            <View style={S.busNoseWrap}><Feather name="truck" size={18} color="#94A3B8" /><Text style={S.busNoseText}>Conducteur</Text></View>
            <View style={S.seatGridWrap}>
              {Array.from({ length: Math.ceil(DEMO_BUS.capacity / 4) }, (_, rowIdx) => (
                <View key={rowIdx} style={S.seatRowWrap}>
                  <Text style={S.rowNum}>{rowIdx + 1}</Text>
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
        </>)}

        {/* ── Embarquement ── */}
        {activeTab === "embarquement" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Passagers ({boarding.length})</Text>
            <Text style={S.boardedCount}>{boarded} embarqués / {boarding.length}</Text>
          </View>
          {boarding.map(entry => (
            <View key={entry.id} style={[S.boardingCard, entry.status === "boarded" && S.boardingDone]}>
              <View style={S.boardingTop}>
                <View style={S.bookingRefRow}>
                  <Feather name="bookmark" size={12} color={entry.status === "boarded" ? "#065F46" : PRIMARY} />
                  <Text style={[S.bookingRef, { color: entry.status === "boarded" ? "#065F46" : PRIMARY }]}>#{entry.bookingRef}</Text>
                </View>
                <View style={[S.badge, { backgroundColor: entry.status === "boarded" ? "#ECFDF5" : "#EEF2FF" }]}>
                  <Text style={[S.badgeText, { color: entry.status === "boarded" ? "#065F46" : PRIMARY }]}>
                    {entry.status === "boarded" ? "✓ Embarqué" : "En attente"}
                  </Text>
                </View>
              </View>
              {entry.passengers.map((pax, i) => (
                <View key={i} style={S.paxRow}>
                  <View style={S.seatTag}><Text style={S.seatTagText}>{pax.seatNumber}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.paxName}>{pax.name}</Text>
                    <Text style={S.paxMeta}>{pax.age} ans · {pax.gender === "M" ? "Homme" : "Femme"}</Text>
                  </View>
                </View>
              ))}
              {entry.status !== "boarded" && (
                <TouchableOpacity style={S.validateBtn} onPress={() => validateBoarding(entry.id)} activeOpacity={0.8}>
                  <Feather name="check-circle" size={16} color="white" />
                  <Text style={S.validateText}>Valider l'embarquement</Text>
                </TouchableOpacity>
              )}
              <View style={S.totalRow}>
                <Text style={S.totalLabel}>{entry.passengers.length} passager{entry.passengers.length > 1 ? "s" : ""}</Text>
                <Text style={S.totalAmount}>{entry.totalAmount.toLocaleString()} FCFA</Text>
              </View>
            </View>
          ))}
        </>)}

        {/* ── Colis ── */}
        {activeTab === "colis" && (<>
          <Text style={S.sectionTitle}>Colis à traiter ({parcels.length})</Text>
          {parcels.map(parcel => {
            const st = PARCEL_STATUS[parcel.status] ?? PARCEL_STATUS.en_attente;
            return (
              <View key={parcel.id} style={S.parcelCard}>
                <View style={S.parcelTop}>
                  <View style={[S.parcelIcon, { backgroundColor: st.bg }]}><Feather name="package" size={18} color={st.color} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.parcelRef}>{parcel.trackingRef}</Text>
                    <Text style={S.parcelRoute}>{parcel.fromCity} → {parcel.toCity}</Text>
                  </View>
                  <View style={[S.badge, { backgroundColor: st.bg }]}><Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text></View>
                </View>
                <View style={S.parcelDetails}>
                  {[
                    ["Expéditeur", parcel.senderName],
                    ["Destinataire", parcel.receiverName],
                    ["Téléphone", parcel.receiverPhone],
                    ["Poids / Prix", `${parcel.weight} kg · ${parcel.amount.toLocaleString()} FCFA`],
                  ].map(([label, val]) => (
                    <View key={label} style={S.detailRow}>
                      <Text style={S.detailLabel}>{label}</Text>
                      <Text style={S.detailValue}>{val}</Text>
                    </View>
                  ))}
                </View>
                <View style={S.parcelActions}>
                  {parcel.status === "en_attente" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#EFF6FF" }]} onPress={() => updateParcel(parcel.id, "pris_en_charge", "pickup")} activeOpacity={0.8}>
                      <Feather name="package" size={14} color="#1D4ED8" /><Text style={[S.actionText, { color: "#1D4ED8" }]}>Prise en charge</Text>
                    </TouchableOpacity>
                  )}
                  {parcel.status === "pris_en_charge" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#F5F3FF" }]} onPress={() => updateParcel(parcel.id, "en_transit", "transit")} activeOpacity={0.8}>
                      <Feather name="truck" size={14} color="#6D28D9" /><Text style={[S.actionText, { color: "#6D28D9" }]}>Mettre en transit</Text>
                    </TouchableOpacity>
                  )}
                  {parcel.status === "en_transit" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#ECFDF5" }]} onPress={() => updateParcel(parcel.id, "livre", "deliver")} activeOpacity={0.8}>
                      <Feather name="check-circle" size={14} color="#059669" /><Text style={[S.actionText, { color: "#059669" }]}>Confirmer livraison</Text>
                    </TouchableOpacity>
                  )}
                  {parcel.status === "en_livraison" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#ECFEFF" }]} onPress={() => updateParcel(parcel.id, "livre", "deliver")} activeOpacity={0.8}>
                      <Feather name="check" size={14} color="#0E7490" /><Text style={[S.actionText, { color: "#0E7490" }]}>Confirmer livraison</Text>
                    </TouchableOpacity>
                  )}
                  {parcel.status === "livre" && (
                    <View style={[S.actionBtn, { backgroundColor: "#F1F5F9" }]}>
                      <Feather name="check" size={14} color="#94A3B8" /><Text style={[S.actionText, { color: "#94A3B8" }]}>Livré ✓</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </>)}

      </ScrollView>
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
  tabBarContent: { paddingHorizontal: 16, gap: 4, alignItems: "center" },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#059669" },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  tabTextActive: { color: "#059669", fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  subLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boardedCount: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#059669" },
  busCard: { borderRadius: 20, overflow: "hidden" },
  busGradient: { padding: 20, gap: 8 },
  busTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  busIconWrap: { width: 50, height: 50, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#34D399" },
  onlineText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  busName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "white" },
  busPlate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  tripCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  tripRow: { flexDirection: "row", alignItems: "center" },
  cityBlock: { gap: 2 },
  cityDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  cityName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A" },
  cityTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  tripArrow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dashedLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  summaryGrid: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#E2E8F0" },
  summaryNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginTop: 2 },
  quickActionsRow: { flexDirection: "row", gap: 8 },
  quickAction: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center", gap: 6 },
  quickActionText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  seatSummaryRow: { flexDirection: "row", gap: 8 },
  seatSummaryCard: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1.5 },
  seatSummaryNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  seatSummaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" },
  seatLegend: { flexDirection: "row", gap: 20, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5 },
  legendText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  seatBusFrame: { backgroundColor: "white", borderRadius: 20, padding: 16, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  busNoseWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  busNoseText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  seatGridWrap: { gap: 5 },
  seatRowWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  rowNum: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#CBD5E1", width: 14, textAlign: "right" },
  seat: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  seatAvail: { backgroundColor: "#F0FDF4", borderColor: "#059669" },
  seatBooked: { backgroundColor: "#FEF2F2", borderColor: "#DC2626" },
  seatEmpty: { width: 36, height: 36 },
  seatAisle: { width: 10 },
  seatNum: { fontSize: 9, fontFamily: "Inter_700Bold" },
  boardingCard: { backgroundColor: "white", borderRadius: 16, padding: 14, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  boardingDone: { backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0" },
  boardingTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bookingRefRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  bookingRef: { fontSize: 13, fontFamily: "Inter_700Bold" },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  paxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  seatTag: { width: 34, height: 32, borderRadius: 8, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  seatTagText: { fontSize: 10, fontFamily: "Inter_700Bold", color: PRIMARY },
  paxName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  paxMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  validateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#059669", borderRadius: 12, paddingVertical: 12 },
  validateText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "white" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  totalLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  totalAmount: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#059669" },
  parcelCard: { backgroundColor: "white", borderRadius: 16, padding: 14, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  parcelTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  parcelIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  parcelRef: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  parcelRoute: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  parcelDetails: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, gap: 6 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  detailValue: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  parcelActions: {},
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 11 },
  actionText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});
