import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useBooking } from "@/context/BookingContext";
import { apiFetch } from "@/utils/api";

interface Trip {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: number;
  busType: string;
  busName: string;
  totalSeats: number;
  availableSeats: number;
  duration: string;
  amenities: string[];
  companyId?: string | null;
  companyName?: string | null;
  companyCity?: string | null;
  isFallback?: boolean;
}

const CITIES = ["Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pédro", "Daloa", "Man", "Divo", "Gagnoa", "Soubré", "Abengourou"];

/* ── Grille tarifaire client — prix Standard réels Côte d'Ivoire ───────────
   Utilisée pour afficher les prix même sans connexion / sans résultats API  */
const PRICE_GRID_CLIENT: Record<string, Record<string, number>> = {
  Abidjan:      { Yamoussoukro: 2000, Bouaké: 2500, Daloa: 3500, Korhogo: 7000, "San Pédro": 3500, "San Pedro": 3500, Man: 5000, Gagnoa: 2000, Divo: 1000, Soubré: 4000 },
  Yamoussoukro: { Abidjan: 2000, Bouaké: 1500, Korhogo: 5000, Daloa: 1500, Gagnoa: 1200 },
  Bouaké:       { Abidjan: 2500, Yamoussoukro: 1500, Korhogo: 3000, Daloa: 2000, Man: 3500 },
  Korhogo:      { Abidjan: 7000, Bouaké: 3000, Yamoussoukro: 5000, Man: 4000 },
  "San Pédro":  { Abidjan: 3500, Daloa: 3000, Gagnoa: 2500, Soubré: 1200 },
  "San Pedro":  { Abidjan: 3500, Daloa: 3000, Gagnoa: 2500, Soubré: 1200 },
  Daloa:        { Abidjan: 3500, Bouaké: 2000, Yamoussoukro: 1500, Man: 1500, Gagnoa: 1200 },
  Man:          { Abidjan: 5000, Bouaké: 3500, Daloa: 1500, Korhogo: 4000 },
  Gagnoa:       { Abidjan: 2000, Daloa: 1200, Yamoussoukro: 1200, "San Pédro": 2500, Soubré: 1200 },
  Divo:         { Abidjan: 1000, Gagnoa: 1000, Yamoussoukro: 1500 },
  Soubré:       { Abidjan: 4000, "San Pédro": 1200, Daloa: 2000, Gagnoa: 1200 },
};

function getPriceGrid(from: string, to: string): number | null {
  if (PRICE_GRID_CLIENT[from]?.[to] != null) return PRICE_GRID_CLIENT[from][to];
  if (PRICE_GRID_CLIENT[to]?.[from] != null) return PRICE_GRID_CLIENT[to][from];
  return null;
}

/* Trips de démonstration : données réelles Côte d'Ivoire, activés si l'API
   ne renvoie rien pour le trajet recherché */
function buildFallbackTrips(from: string, to: string, date: string): Trip[] {
  const base = getPriceGrid(from, to);
  if (base == null) return [];
  const COMPANIES = ["UTB Express", "TSR Voyages", "SOTRAL", "STC Transport", "Sotra Voyages"];
  const schedules = [
    { dep: "06:00", arr: `0${8 + Math.floor(base / 1000)}:30`.slice(-5), type: "Standard" as const },
    { dep: "09:00", arr: `${11 + Math.floor(base / 1000)}:00`.slice(-5), type: "Standard" as const },
    { dep: "12:00", arr: `${14 + Math.floor(base / 1000)}:30`.slice(-5), type: "Standard" as const },
  ];
  return schedules.map((s, i) => ({
    id:            `fb-${from}-${to}-${i}`,
    from,
    to,
    date,
    departureTime: s.dep,
    arrivalTime:   s.arr,
    price:         base,
    busType:       s.type,
    busName:       COMPANIES[i % COMPANIES.length],
    totalSeats:    44,
    availableSeats: Math.floor(Math.random() * 20) + 10,
    duration:      `${Math.floor(base / 700)}h${(base % 700) > 350 ? "30" : "00"}`,
    amenities:     ["AC"],
    isFallback:    true,
  }));
}

export default function ResultatsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { updateBooking } = useBooking();
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string; passengers?: string }>();

  const [from, setFrom] = useState(params.from ?? "");
  const [to, setTo] = useState(params.to ?? "");
  const [date, setDate] = useState(params.date ?? new Date().toISOString().split("T")[0]);
  const [passengers, setPassengers] = useState(Number(params.passengers ?? 1));

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [quickStates, setQuickStates] = useState<Record<string, "idle" | "loading" | "success">>({});

  const topPad = insets.top + 8;

  const doSearch = async (f: string, t: string, d: string, p: number) => {
    if (!f.trim() || !t.trim()) return;
    setLoading(true);
    setSearched(true);
    setUsingFallback(false);
    try {
      const url = `/trips/search?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&date=${d}&passengers=${p}`;
      const raw = await apiFetch<unknown>(url);
      const data: Trip[] = Array.isArray(raw) ? (raw as Trip[]) : [];
      if (data.length === 0) {
        const fallback = buildFallbackTrips(f, t, d);
        if (fallback.length > 0) {
          setTrips(fallback);
          setUsingFallback(true);
        } else {
          setTrips([]);
        }
      } else {
        setTrips(data);
      }
    } catch (err) {
      console.error("[Resultats] Erreur recherche:", err);
      const fallback = buildFallbackTrips(f, t, d);
      if (fallback.length > 0) {
        setTrips(fallback);
        setUsingFallback(true);
      } else {
        setTrips([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.from && params.to) {
      doSearch(params.from, params.to, params.date ?? date, Number(params.passengers ?? 1));
    }
  }, []);

  const search = () => {
    if (!from.trim()) {
      Alert.alert("Départ manquant", "Veuillez saisir une ville de départ.");
      return;
    }
    if (!to.trim()) {
      Alert.alert("Arrivée manquante", "Veuillez saisir une ville d'arrivée.");
      return;
    }
    if (from.trim().toLowerCase() === to.trim().toLowerCase()) {
      Alert.alert("Trajet invalide", "Les villes de départ et d'arrivée doivent être différentes.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    doSearch(from, to, date, passengers);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleQuickBook = async (item: Trip) => {
    if (!token) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour réserver.", [
        { text: "Annuler", style: "cancel" },
        { text: "Se connecter", onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }
    if (item.isFallback) {
      Alert.alert("Démo", "Ce trajet est un exemple. Recherchez un vrai trajet disponible.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setQuickStates((s) => ({ ...s, [item.id]: "loading" }));
    try {
      const res = await apiFetch<{ bookingRef: string }>("/bookings/quick", {
        method: "POST",
        token: token ?? undefined,
        body: { tripId: item.id },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQuickStates((s) => ({ ...s, [item.id]: "success" }));
      setTimeout(() => {
        router.push("/client/mes-reservations" as any);
      }, 900);
    } catch (err: any) {
      console.error("[Resultats] Erreur réservation:", err);
      setQuickStates((s) => ({ ...s, [item.id]: "idle" }));
      Alert.alert("Erreur", err?.message ?? "Impossible de créer la réservation.");
    }
  };

  const handleSelectSeat = (item: Trip) => {
    if (item.isFallback) {
      Alert.alert("Démo", "Ce trajet est un exemple.");
      return;
    }
    updateBooking({ tripId: item.id });
    router.push({ pathname: "/seats/[tripId]", params: { tripId: item.id } });
  };

  const renderTrip = ({ item }: { item: Trip }) => {
    const isLow = item.availableSeats <= 5;
    const qState = quickStates[item.id] ?? "idle";
    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.companyBadge}>
            <Text style={s.companyInitials}>
              {(item.companyName ?? item.busName ?? "?").substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.companyName}>{item.companyName ?? item.busName}</Text>
            <View style={[s.typePill, item.busType === "Premium" && { backgroundColor: "#FEF3C7" }]}>
              <Text style={[s.typeText, item.busType === "Premium" && { color: "#D97706" }]}>
                {item.busType}
              </Text>
            </View>
          </View>
          <View style={s.pricePill}>
            <Text style={s.priceAmount}>{(item.price ?? 0).toLocaleString()}</Text>
            <Text style={s.priceCurrency}> FCFA</Text>
          </View>
        </View>

        <View style={s.routeRow}>
          <View style={s.timeBlock}>
            <Text style={s.timeText}>{item.departureTime}</Text>
            <Text style={s.cityText}>{item.from}</Text>
          </View>
          <View style={s.routeMid}>
            <Text style={s.durationText}>{item.duration}</Text>
            <View style={s.routeLine}>
              <View style={s.routeDotLeft} />
              <View style={s.routeDash} />
              <Feather name="arrow-right" size={13} color={Colors.light.primary} />
              <View style={s.routeDash} />
              <View style={s.routeDotRight} />
            </View>
            <Text style={s.directText}>Direct</Text>
          </View>
          <View style={[s.timeBlock, { alignItems: "flex-end" }]}>
            <Text style={s.timeText}>{item.arrivalTime}</Text>
            <Text style={s.cityText}>{item.to}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.cardFooter}>
          <View style={[s.seatsPill, isLow && s.seatsPillLow]}>
            <Feather name="users" size={11} color={isLow ? "#DC2626" : "#059669"} />
            <Text style={[s.seatsText, isLow && { color: "#DC2626" }]}>
              {item.availableSeats} places
            </Text>
          </View>
          {item.amenities.slice(0, 3).map((a) => (
            <View key={a} style={s.amenityDot}>
              <Text style={s.amenityText}>{a}</Text>
            </View>
          ))}
        </View>

        <View style={s.actions}>
          <Pressable
            style={[s.quickBtn, qState === "success" && { backgroundColor: "#16A34A" }]}
            onPress={() => handleQuickBook(item)}
            disabled={qState === "loading" || qState === "success"}
          >
            {qState === "loading" ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Feather name={qState === "success" ? "check-circle" : "calendar"} size={14} color="white" />
            )}
            <Text style={s.btnText}>
              {qState === "loading" ? "En cours…" : qState === "success" ? "Réservé !" : "Réserver"}
            </Text>
          </Pressable>
          <Pressable style={s.seatBtn} onPress={() => handleSelectSeat(item)}>
            <Feather name="grid" size={14} color="white" />
            <Text style={s.btnText}>Choisir siège</Text>
          </Pressable>
        </View>

        {item.isFallback && (
          <View style={s.demoBadge}>
            <Text style={s.demoBadgeText}>EXEMPLE</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      {/* Header + Search Form */}
      <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={s.header}>
        <View style={s.headerTop}>
          <Pressable style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
            <Feather name="arrow-left" size={20} color="white" />
          </Pressable>
          <Text style={s.headerTitle}>Rechercher un trajet</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* From / To */}
        <View style={s.searchCard}>
          <View style={s.routeInputRow}>
            <View style={s.inputWrap}>
              <View style={s.inputLabel}>
                <View style={[s.dot, { backgroundColor: "#10B981" }]} />
                <Text style={s.labelText}>DÉPART</Text>
              </View>
              <TextInput
                style={s.routeInput}
                placeholder="Ville de départ"
                placeholderTextColor="#94A3B8"
                value={from}
                onChangeText={setFrom}
                returnKeyType="next"
              />
            </View>
            <Pressable style={s.swapBtn} onPress={swap}>
              <Feather name="repeat" size={16} color={Colors.light.primary} />
            </Pressable>
            <View style={s.inputWrap}>
              <View style={s.inputLabel}>
                <View style={[s.dot, { backgroundColor: "#EF4444" }]} />
                <Text style={s.labelText}>ARRIVÉE</Text>
              </View>
              <TextInput
                style={s.routeInput}
                placeholder="Ville d'arrivée"
                placeholderTextColor="#94A3B8"
                value={to}
                onChangeText={setTo}
                returnKeyType="done"
                onSubmitEditing={search}
              />
            </View>
          </View>

          {/* City chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6 }}>
            {CITIES.map((city, i) => (
              <Pressable
                key={`city-${i}-${city}`}
                style={s.cityChip}
                onPress={() => {
                  if (!from) { setFrom(city); }
                  else if (!to) { setTo(city); }
                  else { setTo(city); }
                }}
              >
                <Text style={s.cityChipText}>{city}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Date + Passengers */}
          <View style={s.bottomRow}>
            <View style={s.dateWrap}>
              <Feather name="calendar" size={13} color="#64748B" />
              <TextInput
                style={s.dateInput}
                value={date}
                onChangeText={setDate}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={s.paxWrap}>
              <Feather name="users" size={13} color="#64748B" />
              <Pressable style={s.paxBtn} onPress={() => setPassengers(Math.max(1, passengers - 1))}>
                <Feather name="minus" size={12} color={Colors.light.primary} />
              </Pressable>
              <Text style={s.paxCount}>{passengers}</Text>
              <Pressable style={s.paxBtn} onPress={() => setPassengers(Math.min(9, passengers + 1))}>
                <Feather name="plus" size={12} color={Colors.light.primary} />
              </Pressable>
            </View>
          </View>

          {/* Search Button */}
          <Pressable
            style={({ pressed }) => [s.searchBtn, pressed && { opacity: 0.85 }]}
            onPress={search}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Feather name="search" size={16} color="white" />
            )}
            <Text style={s.searchBtnText}>
              {loading ? "Recherche en cours…" : "Rechercher des bus"}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Results */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={s.loadingText}>Recherche des trajets disponibles…</Text>
        </View>
      ) : !searched ? (
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Feather name="map" size={36} color={Colors.light.primary} />
          </View>
          <Text style={s.emptyTitle}>Trouvez votre prochain voyage</Text>
          <Text style={s.emptyDesc}>Saisissez vos villes de départ et d'arrivée, puis recherchez.</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.resultsHeader}>
              <Text style={s.resultsCount}>
                {trips.length > 0
                  ? `${trips.length} trajet${trips.length > 1 ? "s" : ""} trouvé${trips.length > 1 ? "s" : ""}`
                  : "Aucun trajet trouvé"}
              </Text>
              {usingFallback && (
                <View style={s.demoBanner}>
                  <Feather name="info" size={12} color="#D97706" />
                  <Text style={s.demoBannerText}>Exemples de trajets affichés</Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={s.emptyResults}>
              <View style={s.emptyIcon}>
                <Feather name="search" size={32} color="#94A3B8" />
              </View>
              <Text style={s.emptyTitle}>Aucun trajet disponible</Text>
              <Text style={s.emptyDesc}>
                Aucun bus trouvé pour ce trajet à cette date. Essayez une autre date ou d'autres villes.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { paddingBottom: 16, paddingHorizontal: 16 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },

  searchCard: { backgroundColor: "white", borderRadius: 16, padding: 14, gap: 0 },
  routeInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  inputWrap: { flex: 1 },
  inputLabel: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  labelText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#94A3B8", letterSpacing: 0.5 },
  routeInput: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0F172A", borderBottomWidth: 1.5, borderBottomColor: "#E2E8F0", paddingBottom: 4 },
  swapBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginTop: 10 },

  cityChip: { backgroundColor: "#EEF2FF", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#C7D2FE" },
  cityChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },

  bottomRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  dateWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: "#E2E8F0" },
  dateInput: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#0F172A" },
  paxWrap: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: "#E2E8F0" },
  paxBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  paxCount: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0F172A", minWidth: 16, textAlign: "center" },

  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.accent, borderRadius: 12, paddingVertical: 13 },
  searchBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "white" },

  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 8 },

  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", textAlign: "center" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", lineHeight: 20 },
  emptyResults: { alignItems: "center", paddingTop: 40, gap: 12, paddingHorizontal: 16 },

  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  resultsCount: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  demoBanner: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFBEB", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  demoBannerText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#D97706" },

  card: { backgroundColor: "white", borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  companyBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.light.primary, justifyContent: "center", alignItems: "center" },
  companyInitials: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
  companyName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  typePill: { alignSelf: "flex-start", backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 },
  typeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
  pricePill: { flexDirection: "row", alignItems: "baseline" },
  priceAmount: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.primary },
  priceCurrency: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748B" },

  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  timeBlock: { alignItems: "flex-start" },
  timeText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0F172A" },
  cityText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },
  routeMid: { flex: 1, alignItems: "center", gap: 3 },
  durationText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B" },
  routeLine: { flexDirection: "row", alignItems: "center", gap: 4, width: "100%" },
  routeDotLeft: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  routeDash: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  routeDotRight: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.primary },
  directText: { fontSize: 9, fontFamily: "Inter_500Medium", color: "#94A3B8" },

  divider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 12 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  seatsPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  seatsPillLow: { backgroundColor: "#FEF2F2" },
  seatsText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#059669" },
  amenityDot: { backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  amenityText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#64748B" },

  actions: { flexDirection: "row", gap: 8 },
  quickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.light.primary, borderRadius: 12, paddingVertical: 11 },
  seatBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.light.accent, borderRadius: 12, paddingVertical: 11 },
  btnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },

  demoBadge: { position: "absolute", top: 10, right: 10, backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  demoBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#D97706" },
});
