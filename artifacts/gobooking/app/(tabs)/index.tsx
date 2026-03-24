import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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

/* ─── Recommandations IA ─────────────────────────────────────────────── */
interface RecommendedTrip {
  id: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: string;
  price: number;
  busType?: string;
  busName?: string;
  availableSeats: number;
  companyName: string;
  score: number;
  reasons: string[];
  routeRank: number;
}

interface RecProfile {
  totalBookings: number;
  favoriteRoute: { from: string; to: string } | null;
  preferredHour: number | null;
  preferredDay: number | null;
  preferredDayName: string | null;
}

/* ─── Matching intelligent — types & helpers ──────────────────────────── */
interface LiveBus {
  id: string;
  companyName: string;
  busName: string;
  fromCity: string;
  toCity: string;
  availableSeats: number;
  price: number;
  lat?: number;
  lon?: number;
  mapX?: number;
  mapY?: number;
  gpsLive?: boolean;
  speed?: number | null;
  estimatedArrival?: string;
  distanceKm?: number;
}

function haversine(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dL = (la2 - la1) * Math.PI / 180;
  const dO = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapToLatLon(mx: number, my: number) {
  return { lat: 10.7 - (my / 100) * 6.4, lon: -8.4 + (mx / 100) * 5.2 };
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

const DASHBOARD_CARDS = [
  { label: "Espace compagnie", sub: "Gérer bus, trajets & agents", icon: "briefcase", color: Colors.light.primary, bg: "#EEF2FF", path: "/dashboard/company" },
  { label: "Espace agent", sub: "Mission, sièges & colis", icon: "user", color: "#059669", bg: "#ECFDF5", path: "/dashboard/agent" },
  { label: "Espace admin", sub: "Plateforme GoBooking CI", icon: "shield", color: "#7C3AED", bg: "#F5F3FF", path: "/dashboard/super-admin" },
] as const;

const POPULAR_ROUTES = [
  { from: "Abidjan", to: "Bouaké",       duration: "5h 30m", price: 3500 },
  { from: "Abidjan", to: "Yamoussoukro", duration: "2h 30m", price: 2000 },
  { from: "Abidjan", to: "Korhogo",      duration: "9h",     price: 6000 },
  { from: "Bouaké",  to: "Korhogo",      duration: "3h 30m", price: 2500 },
  { from: "San Pedro", to: "Abidjan",    duration: "4h",     price: 3000 },
];

const PARCEL_STATUS_STYLE: Record<string, { label: string; color: string; bg: string; strip: string }> = {
  en_attente:     { label: "Colis enregistré", color: "#B45309", bg: "#FFFBEB", strip: "#F59E0B" },
  pris_en_charge: { label: "Reçu en agence",   color: "#1D4ED8", bg: "#EFF6FF", strip: "#3B82F6" },
  en_transit:     { label: "En transit",        color: "#6D28D9", bg: "#F5F3FF", strip: "#8B5CF6" },
  en_livraison:   { label: "En livraison",      color: "#0E7490", bg: "#ECFEFF", strip: "#06B6D4" },
  livre:          { label: "Livré",             color: "#065F46", bg: "#ECFDF5", strip: "#10B981" },
  annule:         { label: "Annulé",            color: "#991B1B", bg: "#FEF2F2", strip: "#EF4444" },
};

interface Parcel {
  id: string; trackingRef: string; fromCity: string; toCity: string;
  status: string; createdAt: string;
}
interface Booking {
  id: string; from: string; to: string;
  departureTime: string; status: string; totalAmount: number;
}

const DEMO_PARCEL: Parcel = {
  id: "d1", trackingRef: "GBX-A4F2-KM91",
  fromCity: "Abidjan", toCity: "Bouaké",
  status: "en_transit", createdAt: new Date(Date.now() - 86400000).toISOString(),
};
const DEMO_BOOKING: Booking = {
  id: "b1", from: "Abidjan", to: "Yamoussoukro",
  departureTime: new Date(Date.now() + 2 * 86400000).toISOString(),
  status: "confirmed", totalAmount: 2000,
};

type Mode = "trajet" | "colis";

function formatDeparture(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Aujourd'hui à ${time}`;
  if (diffDays === 1) return `Demain à ${time}`;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }) + ` à ${time}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, dashboardPath } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const firstName = user?.name?.split(" ")[0] || "";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  const [mode, setMode] = useState<Mode>("trajet");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [passengers, setPassengers] = useState(1);

  const [latestParcel, setLatestParcel] = useState<Parcel | null>(null);
  const [upcomingBooking, setUpcomingBooking] = useState<Booking | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  /* ── Recommandations IA ── */
  const [recommendations, setRecommendations] = useState<RecommendedTrip[]>([]);
  const [recProfile, setRecProfile] = useState<RecProfile | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  const loadRecommendations = useCallback(async () => {
    if (!token) return;
    setRecLoading(true);
    try {
      const data = await apiFetch<{ profile: RecProfile; suggestions: RecommendedTrip[] }>(
        "/bookings/recommendations",
        { token }
      );
      if (data?.suggestions?.length) {
        setRecommendations(data.suggestions);
        setRecProfile(data.profile);
      }
    } catch {
      /* Silently ignore — section reste cachée */
    } finally {
      setRecLoading(false);
    }
  }, [token]);

  useEffect(() => { loadRecommendations(); }, [loadRecommendations]);

  /* ── Matching intelligent ── */
  const [nearestBuses, setNearestBuses] = useState<LiveBus[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const matchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadActivity = useCallback(async () => {
    if (!token) {
      setLatestParcel(DEMO_PARCEL);
      setUpcomingBooking(DEMO_BOOKING);
      return;
    }
    setLoadingActivity(true);
    try {
      const [parcels, bookings] = await Promise.allSettled([
        apiFetch<Parcel[]>("/parcels", { token }),
        apiFetch<Booking[]>("/bookings", { token }),
      ]);
      if (parcels.status === "fulfilled" && parcels.value.length > 0) {
        setLatestParcel(parcels.value[0]);
      } else {
        setLatestParcel(DEMO_PARCEL);
      }
      if (bookings.status === "fulfilled") {
        const upcoming = bookings.value.find(
          (b) => new Date(b.departureTime) > new Date() && b.status !== "cancelled"
        );
        setUpcomingBooking(upcoming ?? null);
      }
    } catch {
      setLatestParcel(DEMO_PARCEL);
    } finally {
      setLoadingActivity(false);
    }
  }, [token]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  /* ── Matching: fetch + GPS sort ── */
  const loadNearestBuses = useCallback(async () => {
    setMatchLoading(true);
    try {
      let lat: number | null = null;
      let lon: number | null = null;
      if (Platform.OS !== "web") {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            setUserCoords({ lat, lon });
          }
        } catch { /* GPS failed — use distance-agnostic sort */ }
      }
      const data = await apiFetch<LiveBus[]>("/trips/live");
      const arr: LiveBus[] = (data || []).map((b: LiveBus) => {
        let bLat = b.lat, bLon = b.lon;
        if (!bLat || !bLon) {
          const ll = mapToLatLon(b.mapX ?? 50, b.mapY ?? 50);
          bLat = ll.lat; bLon = ll.lon;
        }
        const distKm = lat !== null && lon !== null ? haversine(lat, lon, bLat!, bLon!) : 9999;
        return { ...b, lat: bLat, lon: bLon, distanceKm: distKm };
      });
      /* Sort: seats first, then by distance */
      const sorted = arr
        .filter(b => b.availableSeats > 0)
        .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
      setNearestBuses(sorted.slice(0, 5));
    } catch {
      /* Silently fail — section simply stays empty */
    } finally {
      setMatchLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNearestBuses();
    matchIntervalRef.current = setInterval(loadNearestBuses, 30000);
    return () => { if (matchIntervalRef.current) clearInterval(matchIntervalRef.current); };
  }, [loadNearestBuses]);

  const swap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFrom(to);
    setTo(from);
  };

  const search = () => {
    if (!from.trim()) {
      Alert.alert("Départ manquant", "Veuillez saisir ou sélectionner une ville de départ.");
      return;
    }
    if (!to.trim()) {
      Alert.alert("Arrivée manquante", "Veuillez saisir ou sélectionner une ville d'arrivée.");
      return;
    }
    if (from.trim().toLowerCase() === to.trim().toLowerCase()) {
      Alert.alert("Trajet invalide", "La ville de départ et d'arrivée doivent être différentes.");
      return;
    }
    console.log("[GoBooking] Recherche trajet:", { from, to, date, passengers });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/client/resultats", params: { from, to, date, passengers: passengers.toString() } } as never);
  };

  const parcelStatus = latestParcel ? (PARCEL_STATUS_STYLE[latestParcel.status] ?? PARCEL_STATUS_STYLE.en_attente) : null;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.greeting}>
                {firstName ? `Bonjour, ${firstName} 👋` : "GoBooking 🚌"}
              </Text>
              <Text style={styles.headerSub}>Que souhaitez-vous faire ?</Text>
            </View>
          </View>
          {dashboardPath ? (
            <Pressable
              style={[styles.adminBtn, {
                backgroundColor: user?.role === "company_admin" ? "rgba(255,255,255,0.25)"
                  : user?.role === "agent" ? "rgba(16,185,129,0.35)"
                  : "rgba(124,58,237,0.35)",
              }]}
              onPress={() => router.push(dashboardPath as never)}
            >
              <Feather
                name={user?.role === "company_admin" ? "briefcase" : user?.role === "agent" ? "user" : "shield"}
                size={17}
                color="white"
              />
            </Pressable>
          ) : null}
        </View>

        {/* Mode selector */}
        <View style={styles.modeSelector}>
          <Pressable
            style={[styles.modeBtn, mode === "trajet" && styles.modeBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode("trajet"); }}
          >
            <Feather name="map" size={16} color={mode === "trajet" ? Colors.light.primary : "rgba(255,255,255,0.7)"} />
            <Text style={[styles.modeBtnText, mode === "trajet" && styles.modeBtnTextActive]}>
              Réserver un trajet
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "colis" && styles.modeBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode("colis"); }}
          >
            <Feather name="package" size={16} color={mode === "colis" ? Colors.light.primary : "rgba(255,255,255,0.7)"} />
            <Text style={[styles.modeBtnText, mode === "colis" && styles.modeBtnTextActive]}>
              Envoyer un colis
            </Text>
          </Pressable>
        </View>

        {/* Search card */}
        {mode === "trajet" ? (
          <View style={styles.searchCard}>
            <View style={styles.routeRow}>
              <View style={styles.routeInputWrap}>
                <View style={styles.routeLabel}>
                  <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                  <Text style={styles.routeLabelText}>DÉPART</Text>
                </View>
                <TextInput
                  style={styles.routeInput}
                  placeholder="Ville de départ"
                  placeholderTextColor={Colors.light.textMuted}
                  value={from}
                  onChangeText={setFrom}
                />
              </View>
              <Pressable style={styles.swapBtn} onPress={swap}>
                <Feather name="repeat" size={18} color={Colors.light.primary} />
              </Pressable>
              <View style={styles.routeInputWrap}>
                <View style={styles.routeLabel}>
                  <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                  <Text style={styles.routeLabelText}>ARRIVÉE</Text>
                </View>
                <TextInput
                  style={styles.routeInput}
                  placeholder="Ville d'arrivée"
                  placeholderTextColor={Colors.light.textMuted}
                  value={to}
                  onChangeText={setTo}
                />
              </View>
            </View>
            {/* ── Villes populaires ── */}
            <View style={styles.citiesRow}>
              {["Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pédro", "Daloa", "Man"].map((city) => (
                <Pressable
                  key={city}
                  style={({ pressed }) => [styles.cityChip, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    if (!from) { setFrom(city); }
                    else if (!to) { setTo(city); }
                    else { setTo(city); }
                  }}
                >
                  <Text style={styles.cityChipText}>{city}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.bottomRow}>
              <View style={styles.dateWrap}>
                <Feather name="calendar" size={15} color={Colors.light.textSecondary} />
                <TextInput
                  style={styles.dateInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor={Colors.light.textMuted}
                />
              </View>
              <View style={styles.paxWrap}>
                <Feather name="users" size={15} color={Colors.light.textSecondary} />
                <Pressable style={styles.paxBtn} onPress={() => setPassengers(Math.max(1, passengers - 1))}>
                  <Feather name="minus" size={13} color={Colors.light.primary} />
                </Pressable>
                <Text style={styles.paxCount}>{passengers}</Text>
                <Pressable style={styles.paxBtn} onPress={() => setPassengers(Math.min(9, passengers + 1))}>
                  <Feather name="plus" size={13} color={Colors.light.primary} />
                </Pressable>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={search}
            >
              <Feather name="search" size={17} color="white" />
              <Text style={styles.searchBtnText}>Rechercher des bus</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.searchCard}>
            <View style={styles.colisHero}>
              <View style={styles.colisIconWrap}>
                <Feather name="package" size={32} color={Colors.light.primary} />
              </View>
              <Text style={styles.colisTitle}>Envoi de colis</Text>
              <Text style={styles.colisSub}>
                Expédiez vos colis partout en Côte d'Ivoire en toute sécurité
              </Text>
              <Pressable
                style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => router.push("/parcel/send")}
              >
                <Feather name="arrow-right" size={17} color="white" />
                <Text style={styles.searchBtnText}>Envoyer un colis</Text>
              </Pressable>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── Quick CTAs ── */}
      <View style={styles.ctaRow}>
        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaBtnPrimary]}
          activeOpacity={0.85}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/client/resultats" as never);
          }}
        >
          <View style={styles.ctaIcon}>
            <Feather name="map" size={20} color={Colors.light.primary} />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>Réserver un trajet</Text>
            <Text style={styles.ctaSub}>Bus interurbains CI</Text>
          </View>
          <Feather name="chevron-right" size={16} color={Colors.light.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaBtnGreen]}
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/parcel/send"); }}
        >
          <View style={[styles.ctaIcon, { backgroundColor: "#DCFCE7" }]}>
            <Feather name="package" size={20} color="#059669" />
          </View>
          <View style={styles.ctaText}>
            <Text style={[styles.ctaTitle, { color: "#064E3B" }]}>Envoyer un colis</Text>
            <Text style={[styles.ctaSub, { color: "#065F46" }]}>Livraison sécurisée</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#059669" />
        </TouchableOpacity>

        {/* ── Live tracking CTA ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/live-tracking"); }}
          style={styles.liveTrackingBtn}
        >
          <View style={styles.liveTrackingLeft}>
            <View style={styles.liveTrackingIcon}>
              <Feather name="truck" size={20} color="white" />
            </View>
            <View style={styles.ctaText}>
              <Text style={styles.liveTrackingTitle}>Voir les cars en route</Text>
              <Text style={styles.liveTrackingSub}>Positions en temps réel · CI</Text>
            </View>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot2} />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Matching intelligent ── */}
      {(matchLoading || nearestBuses.length > 0) && (
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
            <View>
              <Text style={[styles.sectionTitle, { marginBottom: 2 }]}>Car recommandé</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary }}>
                {userCoords ? "Trié par distance GPS" : "Cars en route actuellement"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/cars-en-route-map" as never)}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.primary }}>Voir tous →</Text>
            </TouchableOpacity>
          </View>

          {matchLoading && nearestBuses.length === 0 ? (
            <View style={{ height: 100, backgroundColor: "white", borderRadius: 16, justifyContent: "center", alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <ActivityIndicator color={Colors.light.primary} />
              <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>Recherche des cars proches…</Text>
            </View>
          ) : nearestBuses.length > 0 ? (
            <>
              {/* ── Carte vedette (meilleur match) ── */}
              {(() => {
                const best = nearestBuses[0];
                const isNearby  = (best.distanceKm ?? 9999) < 10;
                const hasGps    = !!best.gpsLive;
                return (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/cars-en-route-map" as never); }}
                    style={{
                      backgroundColor: "#0B1628", borderRadius: 20, padding: 18, marginBottom: 10,
                      shadowColor: "#0B1628", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
                    }}
                  >
                    {/* Badges */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      <View style={{ backgroundColor: "rgba(26,86,219,0.85)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "white" }}>⭐ Recommandé</Text>
                      </View>
                      {isNearby && (
                        <View style={{ backgroundColor: "rgba(5,150,105,0.85)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "white" }}>📍 À proximité</Text>
                        </View>
                      )}
                      {hasGps && (
                        <View style={{ backgroundColor: "rgba(52,211,153,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#34D399" }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#34D399" }}>🟢 GPS Live</Text>
                        </View>
                      )}
                    </View>

                    {/* Compagnie + Route */}
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Inter_500Medium", marginBottom: 2 }}>{best.companyName}</Text>
                    <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "white", marginBottom: 12 }}>
                      {best.fromCity} → {best.toCity}
                    </Text>

                    {/* Stats */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
                      {(best.distanceKm ?? 9999) < 9990 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" }}>
                            <Feather name="map-pin" size={12} color="#94A3B8" />
                          </View>
                          <Text style={{ fontSize: 12, color: "#94A3B8", fontFamily: "Inter_500Medium" }}>
                            {fmtDist(best.distanceKm!)} de vous
                          </Text>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" }}>
                          <Feather name="users" size={12} color="#94A3B8" />
                        </View>
                        <Text style={{ fontSize: 12, color: "#94A3B8", fontFamily: "Inter_500Medium" }}>
                          {best.availableSeats} sièges libres
                        </Text>
                      </View>
                      {best.speed && best.speed > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" }}>
                            <Feather name="zap" size={12} color="#94A3B8" />
                          </View>
                          <Text style={{ fontSize: 12, color: "#94A3B8", fontFamily: "Inter_500Medium" }}>
                            {Math.round(best.speed)} km/h
                          </Text>
                        </View>
                      ) : null}
                      {best.price > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" }}>
                            <Feather name="tag" size={12} color="#94A3B8" />
                          </View>
                          <Text style={{ fontSize: 12, color: "#94A3B8", fontFamily: "Inter_500Medium" }}>
                            {best.price.toLocaleString()} FCFA
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* CTA réserver */}
                    <Pressable
                      style={({ pressed }) => [{
                        backgroundColor: Colors.light.primary, borderRadius: 12, paddingVertical: 13,
                        alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
                        opacity: pressed ? 0.88 : 1,
                      }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/cars-en-route-map" as never); }}
                    >
                      <Feather name="check-circle" size={16} color="white" />
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "white" }}>Réserver ce car</Text>
                    </Pressable>
                  </TouchableOpacity>
                );
              })()}

              {/* ── Autres cars proches ── */}
              {nearestBuses.slice(1, 4).map(bus => {
                const isClose = (bus.distanceKm ?? 9999) < 10;
                return (
                  <TouchableOpacity
                    key={bus.id}
                    activeOpacity={0.85}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/cars-en-route-map" as never); }}
                    style={{
                      backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8,
                      flexDirection: "row", alignItems: "center", gap: 12,
                      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
                    }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: bus.gpsLive ? "#ECFDF5" : "#EEF2FF", justifyContent: "center", alignItems: "center" }}>
                      <Feather name="truck" size={19} color={bus.gpsLive ? "#059669" : Colors.light.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" }} numberOfLines={1}>
                        {bus.fromCity} → {bus.toCity}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 }}>
                        {bus.companyName}
                        {(bus.distanceKm ?? 9999) < 9990 ? ` · ${fmtDist(bus.distanceKm!)}` : ""}
                        {bus.availableSeats ? ` · ${bus.availableSeats} places` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 5 }}>
                      {bus.price > 0 && (
                        <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.light.primary }}>
                          {bus.price.toLocaleString()} F
                        </Text>
                      )}
                      {isClose && (
                        <View style={{ backgroundColor: "#ECFDF5", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#059669" }}>Proche</Text>
                        </View>
                      )}
                      {bus.gpsLive && !isClose && (
                        <View style={{ backgroundColor: "#F0FDF4", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#059669" }}>GPS</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : null}
        </View>
      )}

      {/* ── Recommandations personnalisées ── */}
      {token && (recLoading || recommendations.length > 0) && (
        <View style={{ paddingHorizontal: 16, paddingTop: 28 }}>
          {/* En-tête section */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
            <View>
              <Text style={[styles.sectionTitle, { marginBottom: 2 }]}>Recommandé pour vous</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary }}>
                {recProfile?.favoriteRoute
                  ? `Basé sur ${recProfile.totalBookings} réservation${recProfile.totalBookings > 1 ? "s" : ""}`
                  : "Personnalisé selon votre historique"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F5F3FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <Feather name="cpu" size={9} color="#7C3AED" />
                <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#7C3AED" }}>IA GoBooking</Text>
              </View>
            </View>
          </View>

          {/* Profil du voyageur — pill compact */}
          {recProfile?.favoriteRoute && (
            <View style={{
              flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14,
              backgroundColor: "#FAF5FF", borderRadius: 12, padding: 10,
              borderWidth: 1, borderColor: "#E9D5FF",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Feather name="heart" size={11} color="#7C3AED" />
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6D28D9" }}>
                  {recProfile.favoriteRoute.from} → {recProfile.favoriteRoute.to}
                </Text>
              </View>
              {recProfile.preferredHour !== null && (
                <>
                  <Text style={{ fontSize: 11, color: "#C4B5FD" }}>·</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="clock" size={10} color="#9333EA" />
                    <Text style={{ fontSize: 11, color: "#7C3AED", fontFamily: "Inter_500Medium" }}>
                      ~{recProfile.preferredHour}h
                    </Text>
                  </View>
                </>
              )}
              {recProfile.preferredDayName && (
                <>
                  <Text style={{ fontSize: 11, color: "#C4B5FD" }}>·</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="calendar" size={10} color="#9333EA" />
                    <Text style={{ fontSize: 11, color: "#7C3AED", fontFamily: "Inter_500Medium" }}>
                      {recProfile.preferredDayName}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Cartes de recommandation */}
          {recLoading && recommendations.length === 0 ? (
            <View style={{ height: 90, backgroundColor: "white", borderRadius: 16, justifyContent: "center", alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
              <ActivityIndicator color="#7C3AED" size="small" />
              <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>Analyse de votre profil…</Text>
            </View>
          ) : (
            recommendations.map((trip, idx) => {
              const isTop = idx === 0;
              const fmtDate = (() => {
                try {
                  const d = new Date(trip.date);
                  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
                } catch { return trip.date; }
              })();

              return (
                <TouchableOpacity
                  key={trip.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    Haptics.impactAsync(isTop ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: "/client/resultats", params: { from: trip.from, to: trip.to, date: trip.date, passengers: "1" } } as never);
                  }}
                  style={{
                    backgroundColor: isTop ? "#FAF5FF" : "white",
                    borderRadius: 16, padding: 15, marginBottom: 8,
                    borderWidth: isTop ? 1.5 : 1,
                    borderColor: isTop ? "#C4B5FD" : "#F1F5F9",
                    shadowColor: isTop ? "#7C3AED" : "#000",
                    shadowOffset: { width: 0, height: isTop ? 4 : 1 },
                    shadowOpacity: isTop ? 0.1 : 0.04,
                    shadowRadius: isTop ? 10 : 4,
                    elevation: isTop ? 4 : 1,
                  }}
                >
                  {/* Score + Raisons */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, flex: 1 }}>
                      {trip.reasons.map(r => (
                        <View key={r} style={{ backgroundColor: isTop ? "#EDE9FE" : "#F1F5F9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                          <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: isTop ? "#6D28D9" : "#475569" }}>
                            {r}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {/* Score visuel */}
                    <View style={{ flexDirection: "row", gap: 2, marginLeft: 8 }}>
                      {[1,2,3,4,5,6,7].map(i => (
                        <View key={i} style={{ width: 4, height: 12, borderRadius: 2, backgroundColor: i <= trip.score ? "#7C3AED" : "#E2E8F0" }} />
                      ))}
                    </View>
                  </View>

                  {/* Route */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: isTop ? "#EDE9FE" : "#F8FAFC",
                      justifyContent: "center", alignItems: "center",
                    }}>
                      <Feather name="navigation" size={16} color={isTop ? "#7C3AED" : "#94A3B8"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" }} numberOfLines={1}>
                        {trip.from} → {trip.to}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 }}>
                        {trip.companyName}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: isTop ? "#7C3AED" : Colors.light.primary }}>
                        {trip.price.toLocaleString()} F
                      </Text>
                    </View>
                  </View>

                  {/* Détails */}
                  <View style={{ flexDirection: "row", gap: 14, marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="calendar" size={11} color="#94A3B8" />
                      <Text style={{ fontSize: 11, color: "#64748B", fontFamily: "Inter_500Medium" }}>{fmtDate}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="clock" size={11} color="#94A3B8" />
                      <Text style={{ fontSize: 11, color: "#64748B", fontFamily: "Inter_500Medium" }}>{trip.departureTime}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="users" size={11} color="#94A3B8" />
                      <Text style={{ fontSize: 11, color: "#64748B", fontFamily: "Inter_500Medium" }}>{trip.availableSeats} places</Text>
                    </View>
                    {trip.duration && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="activity" size={11} color="#94A3B8" />
                        <Text style={{ fontSize: 11, color: "#64748B", fontFamily: "Inter_500Medium" }}>{trip.duration}</Text>
                      </View>
                    )}
                  </View>

                  {/* CTA Réserver */}
                  <Pressable
                    style={({ pressed }) => [{
                      borderRadius: 10, paddingVertical: 10,
                      alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6,
                      backgroundColor: isTop ? "#7C3AED" : "#EEF2FF",
                      opacity: pressed ? 0.85 : 1,
                    }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push({ pathname: "/client/resultats", params: { from: trip.from, to: trip.to, date: trip.date, passengers: "1" } } as never);
                    }}
                  >
                    <Feather name="search" size={13} color={isTop ? "white" : Colors.light.primary} />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: isTop ? "white" : Colors.light.primary }}>
                      Voir les disponibilités
                    </Text>
                  </Pressable>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {/* ── Activity section ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Activité récente</Text>
          {!token && (
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.sectionLink}>Se connecter</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingActivity ? (
          <View style={styles.activityLoading}>
            <ActivityIndicator color={Colors.light.primary} />
          </View>
        ) : (
          <View style={styles.activityGrid}>
            {/* Latest parcel card */}
            {latestParcel && parcelStatus && (
              <TouchableOpacity
                style={styles.activityCard}
                activeOpacity={0.82}
                onPress={() => router.push({ pathname: "/(tabs)/suivi", params: { ref: latestParcel.trackingRef } })}
              >
                <View style={styles.activityCardHeader}>
                  <View style={[styles.activityIconWrap, { backgroundColor: parcelStatus.bg }]}>
                    <Feather name="package" size={18} color={parcelStatus.color} />
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: parcelStatus.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: parcelStatus.strip }]} />
                    <Text style={[styles.statusPillText, { color: parcelStatus.color }]}>
                      {parcelStatus.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.activityLabel}>Dernier colis</Text>
                <Text style={styles.activityRef}>{latestParcel.trackingRef}</Text>

                <View style={styles.activityRoute}>
                  <Text style={styles.activityCity}>{latestParcel.fromCity}</Text>
                  <View style={styles.routeLine}>
                    <View style={styles.routeDash} />
                    <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                    <View style={styles.routeDash} />
                  </View>
                  <Text style={styles.activityCity}>{latestParcel.toCity}</Text>
                </View>

                <View style={styles.activityFooter}>
                  <Text style={styles.activityAction}>Voir le suivi</Text>
                  <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                </View>

                {!token && (
                  <View style={styles.demoBadge}>
                    <Text style={styles.demoBadgeText}>Démo</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Upcoming trip card */}
            {upcomingBooking ? (
              <TouchableOpacity
                style={styles.activityCard}
                activeOpacity={0.82}
                onPress={() => router.push("/(tabs)/bookings")}
              >
                <View style={styles.activityCardHeader}>
                  <View style={[styles.activityIconWrap, { backgroundColor: "#EEF2FF" }]}>
                    <Feather name="navigation" size={18} color={Colors.light.primary} />
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: "#ECFDF5" }]}>
                    <View style={[styles.statusDot, { backgroundColor: "#10B981" }]} />
                    <Text style={[styles.statusPillText, { color: "#065F46" }]}>Confirmé</Text>
                  </View>
                </View>

                <Text style={styles.activityLabel}>Prochain trajet</Text>
                <Text style={styles.activityRef}>
                  {formatDeparture(upcomingBooking.departureTime)}
                </Text>

                <View style={styles.activityRoute}>
                  <Text style={styles.activityCity}>{upcomingBooking.from}</Text>
                  <View style={styles.routeLine}>
                    <View style={styles.routeDash} />
                    <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                    <View style={styles.routeDash} />
                  </View>
                  <Text style={styles.activityCity}>{upcomingBooking.to}</Text>
                </View>

                <View style={styles.activityFooter}>
                  <Text style={styles.activityAction}>Voir le billet</Text>
                  <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                </View>

                {!token && (
                  <View style={styles.demoBadge}>
                    <Text style={styles.demoBadgeText}>Démo</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              /* No upcoming trip placeholder */
              <TouchableOpacity
                style={[styles.activityCard, styles.activityCardEmpty]}
                activeOpacity={0.82}
                onPress={() => setMode("trajet")}
              >
                <View style={[styles.activityIconWrap, { backgroundColor: "#EEF2FF", marginBottom: 12 }]}>
                  <Feather name="map" size={18} color={Colors.light.primary} />
                </View>
                <Text style={styles.activityLabel}>Prochain trajet</Text>
                <Text style={styles.emptyCardDesc}>Aucun voyage prévu</Text>
                <View style={styles.activityFooter}>
                  <Text style={styles.activityAction}>Réserver maintenant</Text>
                  <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── Quick actions grid ── */}
      <View style={styles.quickActions}>
        <Pressable style={styles.quickCard} onPress={() => router.push("/(tabs)/bookings")}>
          <LinearGradient colors={["#EEF2FF", "#E0E7FF"]} style={styles.quickIcon}>
            <Feather name="bookmark" size={22} color={Colors.light.primary} />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mes réservations</Text>
          <Text style={styles.quickSub}>Trajets & billets</Text>
        </Pressable>

        <Pressable style={styles.quickCard} onPress={() => router.push("/client/compagnies" as never)}>
          <LinearGradient colors={["#E0F2FE", "#BAE6FD"]} style={styles.quickIcon}>
            <Feather name="briefcase" size={22} color="#0369A1" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Compagnies</Text>
          <Text style={styles.quickSub}>Opérateurs & trajets</Text>
        </Pressable>

        <Pressable style={styles.quickCard} onPress={() => router.push("/client/fidelite" as never)}>
          <LinearGradient colors={["#FFF7ED", "#FEF3C7"]} style={styles.quickIcon}>
            <Feather name="award" size={22} color="#D97706" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Fidélité</Text>
          <Text style={styles.quickSub}>Points & récompenses</Text>
        </Pressable>

        <Pressable style={styles.quickCard} onPress={() => router.push("/(tabs)/colis")}>
          <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.quickIcon}>
            <Feather name="package" size={22} color="#059669" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mes colis</Text>
          <Text style={styles.quickSub}>Suivi & envois</Text>
        </Pressable>

        <Pressable style={styles.quickCard} onPress={() => router.push("/(tabs)/notifications")}>
          <LinearGradient colors={["#FFF7ED", "#FFEDD5"]} style={styles.quickIcon}>
            <Feather name="bell" size={22} color="#D97706" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Notifications</Text>
          <Text style={styles.quickSub}>Alertes & infos</Text>
        </Pressable>

        <Pressable style={styles.quickCard} onPress={() => router.push("/(tabs)/profile")}>
          <LinearGradient colors={["#F5F3FF", "#EDE9FE"]} style={styles.quickIcon}>
            <Feather name="user" size={22} color="#7C3AED" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mon profil</Text>
          <Text style={styles.quickSub}>Compte & paramètres</Text>
        </Pressable>
      </View>

      {/* ── Professional Spaces ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Espaces professionnels</Text>
        {DASHBOARD_CARDS.map((card) => (
          <TouchableOpacity
            key={card.path}
            style={[styles.dashCard, dashboardPath === card.path && { borderWidth: 2, borderColor: card.color }]}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(card.path as never); }}
          >
            <View style={[styles.dashCardIcon, { backgroundColor: card.bg }]}>
              <Feather name={card.icon as never} size={20} color={card.color} />
            </View>
            <View style={styles.dashCardText}>
              <Text style={[styles.dashCardTitle, { color: card.color }]}>{card.label}</Text>
              <Text style={styles.dashCardSub}>{card.sub}</Text>
            </View>
            {dashboardPath === card.path && (
              <View style={[styles.dashCardBadge, { backgroundColor: card.bg }]}>
                <Text style={[styles.dashCardBadgeText, { color: card.color }]}>Mon espace</Text>
              </View>
            )}
            <Feather name="chevron-right" size={16} color={card.color} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Popular routes ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trajets populaires</Text>
        {POPULAR_ROUTES.map((route, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
            onPress={() => {
              setFrom(route.from);
              setTo(route.to);
              setMode("trajet");
              router.push({ pathname: "/search-results", params: { from: route.from, to: route.to, date, passengers: "1" } });
            }}
          >
            <View style={styles.routeCardLeft}>
              <View style={styles.routeCardIcon}>
                <Feather name="map-pin" size={14} color={Colors.light.primary} />
              </View>
              <View>
                <Text style={styles.routeCardRoute}>{route.from} → {route.to}</Text>
                <Text style={styles.routeCardMeta}>{route.duration}</Text>
              </View>
            </View>
            <View style={styles.routeCardRight}>
              <Text style={styles.routeCardPrice}>{route.price.toLocaleString()} FCFA</Text>
              <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerLogo: { width: 44, height: 44, borderRadius: 10 },
  greeting: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 1 },
  adminBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },

  // Mode selector
  modeSelector: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  modeBtnActive: { backgroundColor: "white" },
  modeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  modeBtnTextActive: { color: Colors.light.primary },

  // Search card
  searchCard: { backgroundColor: "white", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  routeInputWrap: { flex: 1 },
  routeLabel: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  routeLabelText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, letterSpacing: 0.5 },
  routeInput: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#0F172A", borderBottomWidth: 1.5, borderBottomColor: "#E2E8F0", paddingBottom: 6 },
  swapBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.light.primaryLight, justifyContent: "center", alignItems: "center", marginTop: 12 },
  bottomRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  dateWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  dateInput: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#0F172A" },
  paxWrap: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  paxBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  paxCount: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0F172A", minWidth: 16, textAlign: "center" },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.accent, borderRadius: 12, paddingVertical: 14, shadowColor: Colors.light.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  searchBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "white" },
  citiesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12, marginTop: 4 },
  cityChip: { backgroundColor: "#EEF2FF", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#C7D2FE" },
  cityChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
  colisHero: { alignItems: "center", gap: 10, paddingVertical: 8 },
  colisIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  colisTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  colisSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 4 },

  // Quick CTAs
  ctaRow: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ctaBtnPrimary: { backgroundColor: Colors.light.primaryLight, borderWidth: 1.5, borderColor: "#B3CBE0" },
  ctaBtnGreen:   { backgroundColor: "#F0FDF4", borderWidth: 1.5, borderColor: "#BBF7D0" },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#C7DCE9", justifyContent: "center", alignItems: "center" },
  ctaText: { flex: 1 },
  ctaTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.light.primaryDark },
  ctaSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },

  liveTrackingBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0B1628", borderRadius: 16, padding: 14, gap: 12,
    shadowColor: "#0B1628", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  liveTrackingLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  liveTrackingIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  liveTrackingTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
  liveTrackingSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 1 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(239,68,68,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" },
  liveDot2: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  livePillText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#FCA5A5", letterSpacing: 0.8 },

  // Activity section
  section: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A" },
  sectionLink: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
  activityLoading: { height: 140, justifyContent: "center", alignItems: "center" },

  activityGrid: { flexDirection: "row", gap: 12 },
  activityCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  activityCardEmpty: { justifyContent: "center", alignItems: "flex-start" },
  activityCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  activityIconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },

  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_700Bold" },

  activityLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
  activityRef: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#0F172A" },
  activityRoute: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  routeLine: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2 },
  routeDash: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  activityCity: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#334155" },
  activityFooter: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  activityAction: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
  emptyCardDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },

  demoBadge: { position: "absolute", top: 10, right: 10, backgroundColor: "#F1F5F9", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  demoBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#94A3B8" },

  // Quick actions grid
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 16, paddingTop: 20 },
  quickCard: { width: "47%", backgroundColor: "white", borderRadius: 16, padding: 14, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  quickIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  quickLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  quickSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },

  // Dashboard shortcut cards
  dashCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  dashCardIcon: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  dashCardText: { flex: 1 },
  dashCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  dashCardSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },
  dashCardBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  dashCardBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  // Popular routes
  routeCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  routeCardPressed: { opacity: 0.85 },
  routeCardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeCardIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  routeCardRoute: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  routeCardMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },
  routeCardRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeCardPrice: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.light.primary },
});
