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

const _ws = (css: string): any => Platform.OS === "web" ? { boxShadow: css } : {};

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
  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const firstName = user?.name?.split(" ")[0] || "";

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scrollRef = useRef<ScrollView>(null);

  const sectionAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim,  { toValue: 1, speed: 18, bounciness: 0, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 18, bounciness: 2, useNativeDriver: true }),
    ]).start();

    Animated.stagger(90, sectionAnims.map(a =>
      Animated.spring(a, { toValue: 1, speed: 16, bounciness: 3, useNativeDriver: true })
    )).start();
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
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <LinearGradient
        colors={["#1650D0", "#1030B4", "#0A1C84"]}
        style={[styles.header, { paddingTop: topPad + 24 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerLogo}>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.primary, letterSpacing: -0.5 }}>GB</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">
                {firstName ? `Bonjour, ${firstName}` : "GoBooking"}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>Que souhaitez-vous faire ?</Text>
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
          ) : (
            <Pressable
              style={[styles.adminBtn, { backgroundColor: "rgba(255,255,255,0.18)" }]}
              onPress={() => router.push("/(tabs)/notifications" as never)}
            >
              <Feather name="bell" size={17} color="white" />
            </Pressable>
          )}
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
              {["Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pédro", "Daloa", "Man"].map((city, i) => (
                <Pressable
                  key={`city-${i}-${city}`}
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
              style={({ pressed }) => [styles.searchBtnWrap, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
              onPress={search}
            >
              <LinearGradient
                colors={["#F97316", "#E05500"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.searchBtn}
              >
                <Feather name="search" size={17} color="white" />
                <Text style={styles.searchBtnText}>Rechercher des bus</Text>
              </LinearGradient>
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
                style={({ pressed }) => [styles.searchBtnWrap, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
                onPress={() => router.push("/parcel/send")}
              >
                <LinearGradient
                  colors={["#F97316", "#E05500"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.searchBtn}
                >
                  <Feather name="arrow-right" size={17} color="white" />
                  <Text style={styles.searchBtnText}>Envoyer un colis</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── Quick CTAs ── */}
      <Animated.View style={{
        opacity: sectionAnims[0],
        transform: [{ translateY: sectionAnims[0].interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
      }}>
      <View style={styles.ctaRow}>
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, styles.ctaBtnPrimary, pressed && { transform: [{ scale: 0.97 }], opacity: 0.93 }]}
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
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ctaBtn, styles.ctaBtnGreen, pressed && { transform: [{ scale: 0.97 }], opacity: 0.93 }]}
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
        </Pressable>

        {/* ── Live tracking CTA ── */}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/live-tracking"); }}
          style={({ pressed }) => [styles.liveTrackingBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 }]}
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
        </Pressable>
      </View>
      </Animated.View>

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
                      <View style={{ backgroundColor: "rgba(26,86,219,0.85)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="star" size={9} color="white" />
                        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "white" }}>Recommandé</Text>
                      </View>
                      {isNearby && (
                        <View style={{ backgroundColor: "rgba(5,150,105,0.85)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Feather name="map-pin" size={9} color="white" />
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "white" }}>À proximité</Text>
                        </View>
                      )}
                      {hasGps && (
                        <View style={{ backgroundColor: "rgba(52,211,153,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#34D399", flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Feather name="radio" size={9} color="#34D399" />
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#34D399" }}>GPS Live</Text>
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
                            {(best.price ?? 0).toLocaleString()} FCFA
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
                          {(bus.price ?? 0).toLocaleString()} F
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
                        {(trip.price ?? 0).toLocaleString()} F
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

      <Animated.View style={{
        opacity: sectionAnims[1],
        transform: [{ translateY: sectionAnims[1].interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
      }}>
      <View style={styles.sectionDivider} />

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
          <View style={styles.activityGrid}>
            {[0, 1].map(i => (
              <View key={i} style={styles.activityCard}>
                <ActivityIndicator color={Colors.light.primary} size="small" style={{ marginVertical: 24 }} />
              </View>
            ))}
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
                  <Text style={styles.activityCity} numberOfLines={1}>{latestParcel.fromCity}</Text>
                  <View style={styles.routeLine}>
                    <View style={styles.routeDash} />
                    <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                    <View style={styles.routeDash} />
                  </View>
                  <Text style={styles.activityCity} numberOfLines={1}>{latestParcel.toCity}</Text>
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
                  <Text style={styles.activityCity} numberOfLines={1}>{upcomingBooking.from}</Text>
                  <View style={styles.routeLine}>
                    <View style={styles.routeDash} />
                    <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                    <View style={styles.routeDash} />
                  </View>
                  <Text style={styles.activityCity} numberOfLines={1}>{upcomingBooking.to}</Text>
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

      <View style={styles.sectionDivider} />

      {/* ── Quick actions grid ── */}
      <View style={styles.quickActions}>
        <Pressable style={[styles.quickCard, { borderTopColor: "#1650D0" }]} onPress={() => router.push("/(tabs)/bookings")}>
          <LinearGradient colors={["#EEF4FF", "#DDE8FF"]} style={styles.quickIcon}>
            <Feather name="bookmark" size={24} color={Colors.light.primary} />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mes réservations</Text>
          <Text style={styles.quickSub}>Trajets & billets</Text>
        </Pressable>

        <Pressable style={[styles.quickCard, { borderTopColor: "#0369A1" }]} onPress={() => router.push("/client/compagnies" as never)}>
          <LinearGradient colors={["#E0F2FE", "#BAE6FD"]} style={styles.quickIcon}>
            <Feather name="briefcase" size={24} color="#0369A1" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Compagnies</Text>
          <Text style={styles.quickSub}>Opérateurs & trajets</Text>
        </Pressable>

        <Pressable style={[styles.quickCard, { borderTopColor: "#D97706" }]} onPress={() => router.push("/client/fidelite" as never)}>
          <LinearGradient colors={["#FFFBEB", "#FEF3C7"]} style={styles.quickIcon}>
            <Feather name="award" size={24} color="#D97706" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Fidélité</Text>
          <Text style={styles.quickSub}>Points & récompenses</Text>
        </Pressable>

        <Pressable style={[styles.quickCard, { borderTopColor: "#059669" }]} onPress={() => router.push("/(tabs)/colis")}>
          <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.quickIcon}>
            <Feather name="package" size={24} color="#059669" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mes colis</Text>
          <Text style={styles.quickSub}>Suivi & envois</Text>
        </Pressable>

        <Pressable style={[styles.quickCard, { borderTopColor: "#EA580C" }]} onPress={() => router.push("/(tabs)/notifications")}>
          <LinearGradient colors={["#FFF7ED", "#FFEDD5"]} style={styles.quickIcon}>
            <Feather name="bell" size={24} color="#EA580C" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Notifications</Text>
          <Text style={styles.quickSub}>Alertes & infos</Text>
        </Pressable>

        <Pressable style={[styles.quickCard, { borderTopColor: "#7C3AED" }]} onPress={() => router.push("/(tabs)/profile")}>
          <LinearGradient colors={["#F5F3FF", "#EDE9FE"]} style={styles.quickIcon}>
            <Feather name="user" size={24} color="#7C3AED" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mon profil</Text>
          <Text style={styles.quickSub}>Compte & paramètres</Text>
        </Pressable>
      </View>

      <View style={styles.sectionDivider} />

      {/* ── Popular routes ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 20 }]}>Trajets populaires</Text>
        {POPULAR_ROUTES.map((route, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFrom(route.from);
              setTo(route.to);
              setMode("trajet");
              router.push({ pathname: "/client/resultats", params: { from: route.from, to: route.to, date, passengers: "1" } } as never);
            }}
          >
            {/* Left: icon */}
            <View style={styles.routeCardIcon}>
              <Feather name="navigation" size={16} color={Colors.light.primary} />
            </View>

            {/* Center: cities inline + duration below */}
            <View style={styles.routeCardCenter}>
              <View style={styles.routeCitiesRow}>
                <Text
                  style={styles.routeFrom}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {route.from}
                </Text>
                <View style={styles.routeArrowWrap}>
                  <Feather name="arrow-right" size={10} color="#94A3B8" />
                </View>
                <Text
                  style={styles.routeTo}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {route.to}
                </Text>
              </View>
              <View style={styles.routeMetaRow}>
                <Feather name="clock" size={10} color="#BBCADC" />
                <Text style={styles.routeCardMeta}>{route.duration}</Text>
              </View>
            </View>

            {/* Right: price + chevron */}
            <View style={styles.routeCardRight}>
              <Text style={styles.routeCardPrice}>{(route.price ?? 0).toLocaleString()} F</Text>
              <View style={styles.routeChevronCircle}>
                <Feather name="chevron-right" size={14} color="white" />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
      </Animated.View>
    </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 36 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  headerLogo: { width: 42, height: 42, borderRadius: 13, flexShrink: 0, backgroundColor: "white", justifyContent: "center", alignItems: "center" },
  greeting: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 3 },
  adminBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.28)", flexShrink: 0 },

  // Mode selector
  modeSelector: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 16, padding: 5, marginBottom: 18, gap: 4 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12 },
  modeBtnActive: { backgroundColor: "white" },
  modeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  modeBtnTextActive: { color: Colors.light.primary },

  // Search card
  searchCard: {
    backgroundColor: "white", borderRadius: 32, padding: 26,
    shadowColor: "#1650D0", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.14, shadowRadius: 36, elevation: 12,
    borderTopWidth: 4, borderTopColor: "#1650D0",
    ..._ws("0 16px 36px rgba(22,80,208,0.14)"),
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  routeInputWrap: { flex: 1 },
  routeLabel: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeLabelText: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.light.textSecondary, letterSpacing: 1.2, textTransform: "uppercase" },
  routeInput: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#06101F", borderBottomWidth: 2, borderBottomColor: "#C7D2FE", paddingBottom: 9, ...(Platform.OS === "web" ? { outlineWidth: 0 } as any : {}) },
  swapBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center", marginTop: 16, borderWidth: 1.5, borderColor: "#BFD0FF" },
  bottomRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  dateWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F4F6FC", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: "#DDE2F0" },
  dateInput: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#06101F", ...(Platform.OS === "web" ? { outlineWidth: 0 } as any : {}) },
  paxWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F6FC", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: "#DDE2F0" },
  paxBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  paxCount: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#06101F", minWidth: 18, textAlign: "center" },
  searchBtnWrap: { shadowColor: "#F97316", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.42, shadowRadius: 18, elevation: 8, ..._ws("0 8px 18px rgba(249,115,22,0.40)") },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 18, paddingVertical: 18 },
  searchBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "white", letterSpacing: 0.2 },
  citiesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18, marginTop: 12 },
  cityChip: { backgroundColor: "#EEF4FF", borderRadius: 22, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1.5, borderColor: "#C4D7FF" },
  cityChipText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#1650D0" },
  colisHero: { alignItems: "center", gap: 14, paddingVertical: 12 },
  colisIconWrap: { width: 80, height: 80, borderRadius: 26, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  colisTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#06101F", letterSpacing: -0.4 },
  colisSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 23, marginBottom: 6 },

  // Quick CTAs
  ctaRow: { paddingHorizontal: 16, paddingTop: 22, gap: 14 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderRadius: 26,
    padding: 22,
    shadowColor: "#1650D0",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 7,
    ..._ws("0 10px 28px rgba(22,80,208,0.12)"),
  },
  ctaBtnPrimary: { backgroundColor: "white", borderWidth: 1.5, borderColor: "#C4D4F8", borderLeftWidth: 5, borderLeftColor: "#1650D0" },
  ctaBtnGreen:   { backgroundColor: "white", borderWidth: 1.5, borderColor: "#A8E0C8", borderLeftWidth: 5, borderLeftColor: "#059669" },
  ctaIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center" },
  ctaText: { flex: 1 },
  ctaTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#06101F", letterSpacing: -0.3 },
  ctaSub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "#7A8FAA", marginTop: 4, lineHeight: 20 },

  liveTrackingBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0B1628", borderRadius: 24, padding: 22, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 10,
    ..._ws("0 10px 24px rgba(0,0,0,0.24)"),
  },
  liveTrackingLeft: { flexDirection: "row", alignItems: "center", gap: 16, flex: 1 },
  liveTrackingIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  liveTrackingTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "white", letterSpacing: -0.2 },
  liveTrackingSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 3 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(239,68,68,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" },
  liveDot2: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  livePillText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#FCA5A5", letterSpacing: 0.8 },

  // Section divider
  sectionDivider: { height: 10, backgroundColor: "#E2E5F4", marginVertical: 0 },

  // Activity section
  section: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 14 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sectionTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#06101F", letterSpacing: -0.5,
    borderLeftWidth: 4, borderLeftColor: "#1650D0", paddingLeft: 12,
  },
  sectionLink: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.light.primary },
  activityLoading: { height: 140, justifyContent: "center", alignItems: "center" },

  activityGrid: { flexDirection: "row", gap: 16 },
  activityCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 24,
    padding: 22,
    gap: 12,
    shadowColor: "#1650D0",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.11,
    shadowRadius: 30,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E8ECFA",
    overflow: "hidden",
    ..._ws("0 12px 30px rgba(22,80,208,0.11)"),
  },
  activityCardEmpty: { justifyContent: "center", alignItems: "flex-start" },
  activityCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  activityIconWrap: { width: 48, height: 48, borderRadius: 17, justifyContent: "center", alignItems: "center" },

  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_700Bold" },

  activityLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1.2 },
  activityRef: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -0.3 },
  activityRoute: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  routeLine: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0, minWidth: 36 },
  routeDash: { flex: 1, height: 1.5, backgroundColor: "#E2E8F0", maxWidth: 12 },
  activityCity: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1E293B", flex: 1, minWidth: 0 },
  activityFooter: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F1F3FA" },
  activityAction: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.light.primary },
  emptyCardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 },

  demoBadge: { position: "absolute", top: 10, right: 10, backgroundColor: "#F1F5F9", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  demoBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#94A3B8" },

  // Quick actions grid
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 4 },
  quickCard: {
    width: "47%", backgroundColor: "white", borderRadius: 26, padding: 22, gap: 14,
    shadowColor: "#1650D0", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 26, elevation: 7,
    borderWidth: 1, borderColor: "#E8ECFA", borderTopWidth: 4,
    ..._ws("0 10px 26px rgba(22,80,208,0.10)"),
  },
  quickIcon: { width: 60, height: 60, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  quickLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#06101F", letterSpacing: -0.3 },
  quickSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#7A8FAA", lineHeight: 19 },

  // Dashboard shortcut cards
  dashCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: "white", borderRadius: 22, padding: 20, marginBottom: 14, shadowColor: "#1650D0", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.09, shadowRadius: 20, elevation: 6, borderWidth: 1, borderColor: "#E8ECFA", ..._ws("0 8px 20px rgba(22,80,208,0.09)") },
  dashCardIcon: { width: 54, height: 54, borderRadius: 18, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  dashCardText: { flex: 1 },
  dashCardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3, color: "#06101F" },
  dashCardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#7A8FAA", marginTop: 3, lineHeight: 18 },
  dashCardBadge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12 },
  dashCardBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },

  // Popular routes
  routeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "white", borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
    shadowColor: "#1650D0", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 14, elevation: 4,
    borderWidth: 1, borderColor: "#ECEEF8",
    ..._ws("0 4px 14px rgba(22,80,208,0.07)"),
  },
  routeCardPressed: { opacity: 0.85, transform: [{ scale: 0.972 }] },
  routeCardIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#C7D9FF", flexShrink: 0,
  },
  routeCardCenter: { flex: 1, minWidth: 0, gap: 5 },
  routeCitiesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeFrom: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold", color: "#06101F", letterSpacing: -0.2, minWidth: 0 },
  routeArrowWrap: { flexShrink: 0, paddingHorizontal: 2 },
  routeTo: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.light.primary, letterSpacing: -0.2, minWidth: 0 },
  routeMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeCardMeta: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#A4B4C6" },
  routeCardRight: { alignItems: "flex-end", gap: 6, flexShrink: 0 },
  routeCardPrice: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.light.primary, letterSpacing: -0.3 },
  routeChevronCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.light.primary,
    justifyContent: "center", alignItems: "center",
  },
});
