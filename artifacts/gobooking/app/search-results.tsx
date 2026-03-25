import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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

const FALLBACK_TRIPS: Trip[] = [
  {
    id: "fallback-1",
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "06:00",
    arrivalTime: "11:30",
    date: "",
    price: 3500,
    busType: "Standard",
    busName: "UTB Express",
    totalSeats: 44,
    availableSeats: 32,
    duration: "5h 30m",
    amenities: ["AC", "WiFi"],
    isFallback: true,
  },
  {
    id: "fallback-2",
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "07:30",
    arrivalTime: "13:00",
    date: "",
    price: 5000,
    busType: "Premium",
    busName: "STC Premium",
    totalSeats: 40,
    availableSeats: 27,
    duration: "5h 30m",
    amenities: ["AC", "WiFi", "Charging", "Snacks"],
    isFallback: true,
  },
  {
    id: "fallback-3",
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "12:00",
    arrivalTime: "17:30",
    date: "",
    price: 4000,
    busType: "Standard",
    busName: "Sotra Express",
    totalSeats: 38,
    availableSeats: 18,
    duration: "5h 30m",
    amenities: ["AC", "WiFi", "Charging"],
    isFallback: true,
  },
];

const COMPANY_COLORS: Record<string, string[]> = {
  utb: ["#1A56DB", "#0F3BA0"],
  stc: ["#059669", "#047857"],
  sotra: ["#D97706", "#B45309"],
  air: ["#7C3AED", "#6D28D9"],
  ctн: ["#DC2626", "#B91C1C"],
  stif: ["#0891B2", "#0E7490"],
  tcv: ["#16A34A", "#15803D"],
  default: ["#1A56DB", "#0F3BA0"],
};

function getCompanyColor(busName: string): string[] {
  const lower = busName.toLowerCase();
  for (const key of Object.keys(COMPANY_COLORS)) {
    if (lower.includes(key)) return COMPANY_COLORS[key];
  }
  return COMPANY_COLORS.default;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type SortKey = "price" | "departure" | "duration";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "price", label: "Prix" },
  { key: "departure", label: "Départ" },
  { key: "duration", label: "Durée" },
];

export default function SearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const { from, to, date, passengers, companyId, companyName: paramCompanyName } = useLocalSearchParams<{
    from: string; to: string; date: string; passengers: string;
    companyId?: string; companyName?: string;
  }>();
  const { updateBooking } = useBooking();
  const { token } = useAuth();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("price");
  const [usingFallback, setUsingFallback] = useState(false);
  const [quickStates, setQuickStates] = useState<Record<string, "idle" | "loading" | "success">>({});

  const handleQuickBook = async (item: Trip) => {
    if (!token) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour réserver.");
      router.push("/(auth)/login" as any);
      return;
    }
    if (item.isFallback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setQuickStates(s => ({ ...s, [item.id]: "loading" }));
    try {
      await apiFetch<{ bookingRef: string }>("/bookings/quick", {
        method: "POST",
        token: token ?? undefined,
        body: { tripId: item.id },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQuickStates(s => ({ ...s, [item.id]: "success" }));
      setTimeout(() => {
        router.push("/client/mes-reservations" as any);
      }, 1000);
    } catch (err: any) {
      setQuickStates(s => ({ ...s, [item.id]: "idle" }));
      Alert.alert("Erreur", err?.message ?? "Impossible de créer la réservation.");
    }
  };

  const isAbidjanBouake =
    from?.toLowerCase().includes("abidjan") &&
    (to?.toLowerCase().includes("boua") || to?.toLowerCase().includes("bouaké"));

  useEffect(() => {
    const load = async () => {
      setUsingFallback(false);
      console.log("[GoBooking] Recherche de trajets:", { from, to, date, passengers });
      try {
        let url = `/trips/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}&passengers=${passengers}`;
        if (companyId) url += `&companyId=${encodeURIComponent(companyId)}`;
        const data = await apiFetch<Trip[]>(url);
        if (data.length === 0 && isAbidjanBouake && !companyId) {
          setTrips(FALLBACK_TRIPS.map((t) => ({ ...t, date })));
          setUsingFallback(true);
        } else {
          setTrips(data);
        }
      } catch {
        if (isAbidjanBouake && !companyId) {
          setTrips(FALLBACK_TRIPS.map((t) => ({ ...t, date })));
          setUsingFallback(true);
        } else {
          setTrips([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [from, to, date, passengers, companyId]);

  const sorted = [...trips].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    if (sortBy === "duration") return a.duration.localeCompare(b.duration);
    return a.departureTime.localeCompare(b.departureTime);
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSelectSeat = (item: Trip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (item.isFallback) {
      router.replace({
        pathname: "/search-results",
        params: { from, to, date: "2026-03-16", passengers },
      });
      return;
    }
    updateBooking({
      tripId: item.id,
      selectedSeats: [],
      selectedSeatNumbers: [],
      passengers: [],
      paymentMethod: "card",
      contactEmail: "",
      contactPhone: "",
      totalAmount: item.price,
    });
    router.push({ pathname: "/seats/[tripId]", params: { tripId: item.id } });
  };

  const renderTrip = ({ item, index }: { item: Trip; index: number }) => {
    const displayName = item.companyName ?? item.busName;
    const colors = getCompanyColor(displayName);
    const isLowSeat = item.availableSeats <= 5;

    return (
      <View style={styles.card}>
        {/* Company Header */}
        <View style={styles.cardHeader}>
          <View style={styles.companyRow}>
            <LinearGradient
              colors={colors as [string, string]}
              style={styles.companyBadge}
            >
              <Text style={styles.companyInitials}>{getInitials(displayName)}</Text>
            </LinearGradient>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{displayName}</Text>
              {item.companyCity && (
                <Text style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>{item.companyCity}</Text>
              )}
              <View style={[
                styles.typePill,
                item.busType === "Premium" && styles.typePillPremium,
              ]}>
                <Text style={[
                  styles.typeText,
                  item.busType === "Premium" && styles.typeTextPremium,
                ]}>
                  {item.busType}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.pricePill}>
            <Text style={styles.priceAmount}>{(item.price ?? 0).toLocaleString()}</Text>
            <Text style={styles.priceCurrency}>FCFA</Text>
          </View>
        </View>

        {/* Time Route */}
        <View style={styles.routeRow}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeText}>{item.departureTime}</Text>
            <Text style={styles.cityText}>{item.from}</Text>
          </View>

          <View style={styles.routeMid}>
            <Text style={styles.durationText}>{item.duration}</Text>
            <View style={styles.routeLine}>
              <View style={styles.routeDotLeft} />
              <View style={styles.routeDash} />
              <Feather name="arrow-right" size={14} color={Colors.light.primary} />
              <View style={styles.routeDash} />
              <View style={styles.routeDotRight} />
            </View>
            <Text style={styles.directText}>Direct</Text>
          </View>

          <View style={[styles.timeBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.timeText}>{item.arrivalTime}</Text>
            <Text style={styles.cityText}>{item.to}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Footer: seats + amenities */}
        <View style={styles.cardFooter}>
          <View style={[styles.seatsPill, isLowSeat && styles.seatsPillLow]}>
            <Feather
              name="users"
              size={12}
              color={isLowSeat ? Colors.light.error : Colors.light.success}
            />
            <Text style={[styles.seatsCount, isLowSeat && { color: Colors.light.error }]}>
              {item.availableSeats} sièges
            </Text>
          </View>

          <View style={styles.amenityRow}>
            {item.amenities.slice(0, 2).map((a) => (
              <View key={a} style={styles.amenityDot}>
                <Text style={styles.amenityLabel}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <Pressable
            style={({ pressed }) => [
              styles.quickBtn,
              pressed && styles.selectBtnPressed,
              quickStates[item.id] === "loading" && { opacity: 0.8 },
              quickStates[item.id] === "success" && { backgroundColor: "#16A34A" },
            ]}
            onPress={() => handleQuickBook(item)}
            disabled={quickStates[item.id] === "loading" || quickStates[item.id] === "success"}
          >
            {quickStates[item.id] === "loading" ? (
              <ActivityIndicator size="small" color="white" />
            ) : quickStates[item.id] === "success" ? (
              <Feather name="check-circle" size={15} color="white" />
            ) : (
              <Feather name="calendar" size={15} color="white" />
            )}
            <Text style={styles.selectBtnText}>
              {quickStates[item.id] === "loading" ? "En cours…" : quickStates[item.id] === "success" ? "Réservé !" : "Réserver"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.selectBtn, pressed && styles.selectBtnPressed, { flex: 1 }]}
            onPress={() => handleSelectSeat(item)}
          >
            <Feather name="grid" size={15} color="white" />
            <Text style={styles.selectBtnText}>Choisir siège</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={styles.header}
      >
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeFrom}>{from}</Text>
            <View style={styles.routeArrow}>
              <Feather name="arrow-right" size={14} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={styles.routeTo}>{to}</Text>
          </View>
          <Text style={styles.routeDate}>
            {date} · {passengers} passager{parseInt(passengers) > 1 ? "s" : ""}
          </Text>
        </View>
      </LinearGradient>

      {/* Company filter chip */}
      {!!companyId && !!paramCompanyName && (
        <View style={styles.companyFilterBar}>
          <Feather name="briefcase" size={13} color="#0B3C5D" />
          <Text style={styles.companyFilterText}>{paramCompanyName}</Text>
          <Pressable
            onPress={() => router.setParams({ companyId: undefined, companyName: undefined })}
            style={styles.companyFilterRemove}
          >
            <Feather name="x" size={13} color="#94A3B8" />
          </Pressable>
        </View>
      )}

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Trier par :</Text>
        <View style={styles.sortChips}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
              onPress={() => setSortBy(opt.key)}
            >
              <Text style={[styles.sortText, sortBy === opt.key && styles.sortTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Recherche des bus...</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={{
            padding: 16,
            gap: 12,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            sorted.length > 0 ? (
              <View>
                {usingFallback && (
                  <View style={styles.fallbackBanner}>
                    <Feather name="info" size={14} color="#92400E" />
                    <Text style={styles.fallbackText}>
                      Aucun bus pour cette date. Voici des exemples disponibles — appuyez pour voir les départs réels.
                    </Text>
                  </View>
                )}
                <Text style={styles.resultsCount}>
                  {sorted.length} bus disponible{sorted.length > 1 ? "s" : ""}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="search" size={32} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>Aucun bus trouvé</Text>
              <Text style={styles.emptySubtitle}>
                Essayez une autre date ou un autre itinéraire
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeFrom: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  routeArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  routeTo: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  routeDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 3,
  },
  companyFilterBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderBottomWidth: 1, borderBottomColor: "#BFDBFE",
    paddingHorizontal: 16, paddingVertical: 8,
  },
  companyFilterText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#0B3C5D" },
  companyFilterRemove: { padding: 4 },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 10,
  },
  sortLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  sortChips: {
    flexDirection: "row",
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "white",
  },
  sortChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  sortText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
  },
  sortTextActive: {
    color: "white",
  },
  resultsCount: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  fallbackBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  fallbackText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#92400E",
    lineHeight: 18,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },

  // Card
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#1A56DB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  companyBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  companyInitials: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "white",
    letterSpacing: 0.5,
  },
  companyInfo: {
    flex: 1,
    gap: 4,
  },
  companyName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  typePill: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillPremium: {
    backgroundColor: "#EEF2FF",
  },
  typeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
  },
  typeTextPremium: {
    color: Colors.light.primary,
  },
  pricePill: {
    alignItems: "flex-end",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priceAmount: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    lineHeight: 24,
  },
  priceCurrency: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
    opacity: 0.7,
    textAlign: "right",
  },

  // Route
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  timeBlock: {
    flex: 1,
  },
  timeText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  cityText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  routeMid: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  durationText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
    marginBottom: 5,
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  routeDotLeft: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  routeDash: {
    width: 14,
    height: 1.5,
    backgroundColor: "#CBD5E1",
  },
  routeDotRight: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  directText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 12,
  },

  // Footer
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  seatsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  seatsPillLow: {
    backgroundColor: "#FEF2F2",
  },
  seatsCount: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#059669",
  },
  amenityRow: {
    flexDirection: "row",
    gap: 6,
  },
  amenityDot: {
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  amenityLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },

  // Buttons
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#D97706",
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.light.accent,
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  selectBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  selectBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "white",
    flex: 1,
    textAlign: "center",
  },

  // Empty
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
