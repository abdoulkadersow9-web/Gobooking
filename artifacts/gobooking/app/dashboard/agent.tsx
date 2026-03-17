import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
const DARK = Colors.light.primaryDark;

interface Passenger { name: string; age: number; gender: string; seatNumber: string }
interface BoardingEntry {
  id: string; bookingRef: string; passengers: Passenger[];
  seatNumbers: string[]; status: string; totalAmount: number;
}

interface ParcelEntry {
  id: string; trackingRef: string; fromCity: string; toCity: string;
  senderName: string; receiverName: string; receiverPhone: string;
  weight: number; status: string; amount: number;
}

const DEMO_BUS = { busName: "Express Abidjan 01", plateNumber: "0258 AB 01", busType: "Premium", capacity: 44 };
const DEMO_TRIP = { from: "Abidjan", to: "Bouaké", date: "17/03/2026", departureTime: "08h00", totalSeats: 44, bookedSeats: 31 };

const DEMO_BOARDING: BoardingEntry[] = [
  { id: "bk1", bookingRef: "GBB5AKZ8DZ", passengers: [{ name: "Kouassi Ama", age: 34, gender: "F", seatNumber: "A3" }], seatNumbers: ["A3"], status: "confirmed", totalAmount: 3500 },
  { id: "bk2", bookingRef: "GBB9MNX2PL", passengers: [{ name: "Traoré Youssouf", age: 28, gender: "M", seatNumber: "B1" }, { name: "Traoré Fatoumata", age: 25, gender: "F", seatNumber: "B2" }], seatNumbers: ["B1", "B2"], status: "confirmed", totalAmount: 7000 },
  { id: "bk3", bookingRef: "GBBA1C3RQ7", passengers: [{ name: "Bamba Koffi", age: 45, gender: "M", seatNumber: "C4" }], seatNumbers: ["C4"], status: "boarded", totalAmount: 3500 },
  { id: "bk4", bookingRef: "GBB7FPV6NM", passengers: [{ name: "Diallo Mariam", age: 22, gender: "F", seatNumber: "D2" }], seatNumbers: ["D2"], status: "confirmed", totalAmount: 3500 },
  { id: "bk5", bookingRef: "GBBC5XK0TZ", passengers: [{ name: "Coulibaly Seydou", age: 38, gender: "M", seatNumber: "E1" }], seatNumbers: ["E1"], status: "boarded", totalAmount: 3500 },
];

const DEMO_PARCELS: ParcelEntry[] = [
  { id: "p1", trackingRef: "GBX-A4F2-KM91", fromCity: "Abidjan", toCity: "Bouaké", senderName: "Assiéta Koné", receiverName: "Diabaté Oumar", receiverPhone: "0707 11 22 33", weight: 4.5, status: "en_attente", amount: 4700 },
  { id: "p2", trackingRef: "GBX-C1E7-QR22", fromCity: "Abidjan", toCity: "Yamoussoukro", senderName: "Bamba Sali", receiverName: "Traoré Adama", receiverPhone: "0505 44 55 66", weight: 2.1, status: "pris_en_charge", amount: 3500 },
  { id: "p3", trackingRef: "GBX-D5F8-MN33", fromCity: "Abidjan", toCity: "Korhogo", senderName: "Koffi Ama", receiverName: "Coulibaly Jean", receiverPhone: "0101 77 88 99", weight: 8.0, status: "en_transit", amount: 8100 },
];

const PARCEL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:     { label: "En attente",     color: "#B45309", bg: "#FFFBEB" },
  pris_en_charge: { label: "Pris en charge", color: "#1D4ED8", bg: "#EFF6FF" },
  en_transit:     { label: "En transit",     color: "#6D28D9", bg: "#F5F3FF" },
  en_livraison:   { label: "En livraison",   color: "#0E7490", bg: "#ECFEFF" },
  livre:          { label: "Livré",          color: "#065F46", bg: "#ECFDF5" },
};

type Tab = "mission" | "embarquement" | "colis";

export default function AgentDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("mission");
  const [boarding, setBoarding] = useState<BoardingEntry[]>(DEMO_BOARDING);
  const [parcels, setParcels] = useState<ParcelEntry[]>(DEMO_PARCELS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.allSettled([
      apiFetch<BoardingEntry[]>("/agent/boarding", { token }),
      apiFetch<ParcelEntry[]>("/agent/parcels", { token }),
    ]).then(([b, p]) => {
      if (b.status === "fulfilled" && b.value.length > 0) setBoarding(b.value);
      if (p.status === "fulfilled" && p.value.length > 0) setParcels(p.value);
    }).finally(() => setLoading(false));
  }, [token]);

  const validateBoarding = async (bookingId: string) => {
    setBoarding(prev => prev.map(b => b.id === bookingId ? { ...b, status: "boarded" } : b));
    if (token) {
      try { await apiFetch(`/agent/boarding/${bookingId}/validate`, { token, method: "POST" }); } catch {}
    }
  };

  const updateParcelStatus = async (parcelId: string, newStatus: string, action: "pickup" | "transit" | "deliver") => {
    setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: newStatus } : p));
    if (token) {
      try { await apiFetch(`/agent/parcels/${parcelId}/${action}`, { token, method: "POST" }); } catch {}
    }
  };

  const boarded = boarding.filter(b => b.status === "boarded").length;
  const waiting = boarding.filter(b => b.status === "confirmed").length;
  const parcelsPending = parcels.filter(p => ["en_attente", "pris_en_charge"].includes(p.status)).length;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "mission", label: "Mission", icon: "navigation" },
    { id: "embarquement", label: "Embarquement", icon: "users" },
    { id: "colis", label: "Colis", icon: "package" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={["#059669", "#047857"]} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Espace Agent</Text>
          <Text style={styles.headerSub}>Kouassi Jean · AGT-001</Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="user" size={13} color="white" />
          <Text style={styles.headerBadgeText}>Agent</Text>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Feather name={tab.icon as never} size={14} color={activeTab === tab.id ? "#059669" : "#94A3B8"} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 12 }} showsVerticalScrollIndicator={false}>

        {activeTab === "mission" && (
          <>
            <View style={styles.busCard}>
              <LinearGradient colors={["#1A56DB", "#0F3BA0"]} style={styles.busGradient}>
                <View style={styles.busTop}>
                  <View style={styles.busIconWrap}>
                    <Feather name="truck" size={28} color="white" />
                  </View>
                  <View style={styles.busOnline}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>En service</Text>
                  </View>
                </View>
                <Text style={styles.busName}>{DEMO_BUS.busName}</Text>
                <Text style={styles.busPlate}>{DEMO_BUS.plateNumber} · {DEMO_BUS.busType} · {DEMO_BUS.capacity} places</Text>
              </LinearGradient>
            </View>

            <View style={styles.tripCard}>
              <Text style={styles.sectionTitle}>Trajet du jour</Text>
              <View style={styles.tripRoute}>
                <View style={styles.cityBlock}>
                  <View style={[styles.cityDot, { backgroundColor: "#10B981" }]} />
                  <Text style={styles.cityName}>{DEMO_TRIP.from}</Text>
                  <Text style={styles.tripTime}>{DEMO_TRIP.departureTime}</Text>
                </View>
                <View style={styles.tripLine}>
                  <View style={styles.dashedLine} />
                  <Feather name="arrow-right" size={16} color={PRIMARY} />
                  <View style={styles.dashedLine} />
                </View>
                <View style={[styles.cityBlock, { alignItems: "flex-end" }]}>
                  <View style={[styles.cityDot, { backgroundColor: "#EF4444" }]} />
                  <Text style={styles.cityName}>{DEMO_TRIP.to}</Text>
                  <Text style={styles.tripTime}>~{DEMO_TRIP.date}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Résumé</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{boarded}</Text>
                <Text style={styles.summaryLabel}>Embarqués</Text>
              </View>
              <View style={[styles.summaryCard, { borderColor: "#FDE68A" }]}>
                <Text style={[styles.summaryValue, { color: "#B45309" }]}>{waiting}</Text>
                <Text style={styles.summaryLabel}>En attente</Text>
              </View>
              <View style={[styles.summaryCard, { borderColor: "#BBF7D0" }]}>
                <Text style={[styles.summaryValue, { color: "#065F46" }]}>{DEMO_TRIP.bookedSeats}/{DEMO_TRIP.totalSeats}</Text>
                <Text style={styles.summaryLabel}>Réservés</Text>
              </View>
              <View style={[styles.summaryCard, { borderColor: "#E9D5FF" }]}>
                <Text style={[styles.summaryValue, { color: "#6D28D9" }]}>{parcelsPending}</Text>
                <Text style={styles.summaryLabel}>Colis actifs</Text>
              </View>
            </View>
          </>
        )}

        {activeTab === "embarquement" && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Passagers ({boarding.length})</Text>
              <Text style={styles.boardedCount}>{boarded} embarqués</Text>
            </View>
            {boarding.map(entry => (
              <View key={entry.id} style={[styles.boardingCard, entry.status === "boarded" && styles.boardingCardDone]}>
                <View style={styles.boardingTop}>
                  <View style={styles.boardingRef}>
                    <Feather name="bookmark" size={13} color={entry.status === "boarded" ? "#065F46" : PRIMARY} />
                    <Text style={[styles.refText, { color: entry.status === "boarded" ? "#065F46" : PRIMARY }]}>#{entry.bookingRef}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: entry.status === "boarded" ? "#ECFDF5" : "#EEF2FF" }]}>
                    <Text style={[styles.badgeText, { color: entry.status === "boarded" ? "#065F46" : PRIMARY }]}>
                      {entry.status === "boarded" ? "✓ Embarqué" : "En attente"}
                    </Text>
                  </View>
                </View>
                {entry.passengers.map((pax, i) => (
                  <View key={i} style={styles.paxRow}>
                    <View style={styles.seatBadge}>
                      <Text style={styles.seatText}>{pax.seatNumber}</Text>
                    </View>
                    <Text style={styles.paxName}>{pax.name}</Text>
                    <Text style={styles.paxMeta}>{pax.age} ans · {pax.gender === "M" ? "Homme" : "Femme"}</Text>
                  </View>
                ))}
                {entry.status !== "boarded" && (
                  <TouchableOpacity style={styles.validateBtn} onPress={() => validateBoarding(entry.id)} activeOpacity={0.8}>
                    <Feather name="check-circle" size={16} color="white" />
                    <Text style={styles.validateText}>Valider l'embarquement</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {activeTab === "colis" && (
          <>
            <Text style={styles.sectionTitle}>Colis à traiter ({parcels.length})</Text>
            {parcels.map(parcel => {
              const st = PARCEL_STATUS[parcel.status] ?? PARCEL_STATUS.en_attente;
              return (
                <View key={parcel.id} style={styles.parcelCard}>
                  <View style={styles.parcelTop}>
                    <View style={[styles.parcelIcon, { backgroundColor: st.bg }]}>
                      <Feather name="package" size={18} color={st.color} />
                    </View>
                    <View style={styles.parcelMid}>
                      <Text style={styles.parcelRef}>{parcel.trackingRef}</Text>
                      <Text style={styles.parcelRoute}>{parcel.fromCity} → {parcel.toCity}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  <View style={styles.parcelDetails}>
                    <View style={styles.parcelDetailRow}>
                      <Text style={styles.detailLabel}>Expéditeur</Text>
                      <Text style={styles.detailValue}>{parcel.senderName}</Text>
                    </View>
                    <View style={styles.parcelDetailRow}>
                      <Text style={styles.detailLabel}>Destinataire</Text>
                      <Text style={styles.detailValue}>{parcel.receiverName}</Text>
                    </View>
                    <View style={styles.parcelDetailRow}>
                      <Text style={styles.detailLabel}>Téléphone</Text>
                      <Text style={styles.detailValue}>{parcel.receiverPhone}</Text>
                    </View>
                    <View style={styles.parcelDetailRow}>
                      <Text style={styles.detailLabel}>Poids</Text>
                      <Text style={styles.detailValue}>{parcel.weight} kg · {parcel.amount.toLocaleString()} FCFA</Text>
                    </View>
                  </View>

                  <View style={styles.parcelActions}>
                    {parcel.status === "en_attente" && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#EFF6FF" }]} onPress={() => updateParcelStatus(parcel.id, "pris_en_charge", "pickup")} activeOpacity={0.8}>
                        <Feather name="package" size={14} color="#1D4ED8" />
                        <Text style={[styles.actionBtnText, { color: "#1D4ED8" }]}>Prise en charge</Text>
                      </TouchableOpacity>
                    )}
                    {parcel.status === "pris_en_charge" && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#F5F3FF" }]} onPress={() => updateParcelStatus(parcel.id, "en_transit", "transit")} activeOpacity={0.8}>
                        <Feather name="truck" size={14} color="#6D28D9" />
                        <Text style={[styles.actionBtnText, { color: "#6D28D9" }]}>Mettre en transit</Text>
                      </TouchableOpacity>
                    )}
                    {parcel.status === "en_transit" && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#ECFDF5" }]} onPress={() => updateParcelStatus(parcel.id, "livre", "deliver")} activeOpacity={0.8}>
                        <Feather name="check-circle" size={14} color="#059669" />
                        <Text style={[styles.actionBtnText, { color: "#059669" }]}>Confirmer la livraison</Text>
                      </TouchableOpacity>
                    )}
                    {parcel.status === "livre" && (
                      <View style={[styles.actionBtn, { backgroundColor: "#F1F5F9" }]}>
                        <Feather name="check" size={14} color="#94A3B8" />
                        <Text style={[styles.actionBtnText, { color: "#94A3B8" }]}>Livré</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

      </ScrollView>
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
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#059669" },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  tabTextActive: { color: "#059669", fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boardedCount: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#059669" },
  busCard: { borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  busGradient: { padding: 20, gap: 8 },
  busTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  busIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  busOnline: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#34D399" },
  onlineText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  busName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "white" },
  busPlate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  tripCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  tripRoute: { flexDirection: "row", alignItems: "center" },
  cityBlock: { gap: 2 },
  cityDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  cityName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A" },
  tripTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  tripLine: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dashedLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#E2E8F0" },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" },
  boardingCard: { backgroundColor: "white", borderRadius: 16, padding: 14, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  boardingCardDone: { backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0" },
  boardingTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boardingRef: { flexDirection: "row", alignItems: "center", gap: 5 },
  refText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  paxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  seatBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  seatText: { fontSize: 11, fontFamily: "Inter_700Bold", color: PRIMARY },
  paxName: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  paxMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  validateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#059669", borderRadius: 12, paddingVertical: 12, marginTop: 4 },
  validateText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "white" },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  parcelCard: { backgroundColor: "white", borderRadius: 16, padding: 14, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  parcelTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  parcelIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  parcelMid: { flex: 1 },
  parcelRef: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  parcelRoute: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  parcelDetails: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, gap: 6 },
  parcelDetailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  detailValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  parcelActions: { flexDirection: "row" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 11 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});
