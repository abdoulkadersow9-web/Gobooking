import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
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
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/utils/api";

const { width: SW, height: SH } = Dimensions.get("window");
const MAP_H = Math.min(SH * 0.52, 370);

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface LiveBus {
  id: string;
  companyName: string;
  busName: string;
  busType: string;
  fromCity: string;
  toCity: string;
  currentCity: string;
  mapX: number;
  mapY: number;
  lat?: number;
  lon?: number;
  availableSeats: number;
  totalSeats: number;
  departureTime: string;
  estimatedArrival: string;
  agentPhone: string;
  agentName: string;
  price: number;
  color: string;
  boardingPoints: string[];
  gpsLive?: boolean;
  speed?: number | null;
  distanceKm?: number;  /* computed client-side */
}

interface ClientPosition { lat: number; lon: number }

/* ─── Haversine distance (km) ─────────────────────────────────────────────── */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Convert mapX%/mapY% to approx lat/lon (same formula as server) */
function mapToLatLon(mapX: number, mapY: number) {
  return { lat: 10.7 - (mapY / 100) * 6.4, lon: -8.4 + (mapX / 100) * 5.2 };
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/* ─── Landmark database (Côte d'Ivoire) ─────────────────────────────────── */
type LandmarkType = "gare" | "carrefour" | "station" | "marche" | "place" | "hopital";

interface Landmark {
  id:    string;
  city:  string;
  name:  string;
  type:  LandmarkType;
  lat:   number;
  lon:   number;
}

const LANDMARK_ICON: Record<LandmarkType, string> = {
  gare:       "navigation",
  carrefour:  "shuffle",
  station:    "zap",
  marche:     "shopping-bag",
  place:      "map-pin",
  hopital:    "plus-circle",
};

const CI_LANDMARKS: Landmark[] = [
  /* ── Abidjan ── */
  { id:"abi-1", city:"Abidjan", name:"Gare routière d'Adjamé",     type:"gare",      lat:5.3620, lon:-4.0195 },
  { id:"abi-2", city:"Abidjan", name:"Gare de Port-Bouët",         type:"gare",      lat:5.2546, lon:-3.9375 },
  { id:"abi-3", city:"Abidjan", name:"Gare de Bassam",             type:"gare",      lat:5.3105, lon:-3.8720 },
  { id:"abi-4", city:"Abidjan", name:"Carrefour Palmeraie",        type:"carrefour", lat:5.3850, lon:-3.9780 },
  { id:"abi-5", city:"Abidjan", name:"Carrefour Banco Nord",       type:"carrefour", lat:5.4150, lon:-4.0500 },
  { id:"abi-6", city:"Abidjan", name:"Carrefour CHR",              type:"carrefour", lat:5.3320, lon:-4.0010 },
  { id:"abi-7", city:"Abidjan", name:"Station Total Yopougon",     type:"station",   lat:5.3710, lon:-4.0860 },
  { id:"abi-8", city:"Abidjan", name:"Station Shell Cocody",       type:"station",   lat:5.3565, lon:-3.9865 },
  { id:"abi-9", city:"Abidjan", name:"Marché de Treichville",      type:"marche",    lat:5.2985, lon:-4.0075 },
  { id:"abi-10",city:"Abidjan", name:"Marché d'Abobo",             type:"marche",    lat:5.4185, lon:-4.0300 },
  /* ── Bouaké ── */
  { id:"bou-1", city:"Bouaké",  name:"Gare routière Nord",         type:"gare",      lat:7.6972, lon:-5.0183 },
  { id:"bou-2", city:"Bouaké",  name:"Gare routière Sud",          type:"gare",      lat:7.6769, lon:-5.0378 },
  { id:"bou-3", city:"Bouaké",  name:"Carrefour Nimbo",            type:"carrefour", lat:7.6940, lon:-5.0179 },
  { id:"bou-4", city:"Bouaké",  name:"Carrefour Broukro",          type:"carrefour", lat:7.6895, lon:-5.0225 },
  { id:"bou-5", city:"Bouaké",  name:"Station Shell Bouaké",       type:"station",   lat:7.6900, lon:-5.0250 },
  { id:"bou-6", city:"Bouaké",  name:"Grand Marché de Bouaké",     type:"marche",    lat:7.6932, lon:-5.0304 },
  /* ── Yamoussoukro ── */
  { id:"yam-1", city:"Yamoussoukro", name:"Gare routière centrale",    type:"gare",      lat:6.8276, lon:-5.2893 },
  { id:"yam-2", city:"Yamoussoukro", name:"Carrefour Sinfra",          type:"carrefour", lat:6.8372, lon:-5.2872 },
  { id:"yam-3", city:"Yamoussoukro", name:"Place de la Paix",          type:"place",     lat:6.8202, lon:-5.2765 },
  { id:"yam-4", city:"Yamoussoukro", name:"Station Total Yamoussoukro",type:"station",   lat:6.8250, lon:-5.2840 },
  /* ── Korhogo ── */
  { id:"kor-1", city:"Korhogo", name:"Gare centrale de Korhogo",   type:"gare",      lat:9.4524, lon:-5.6253 },
  { id:"kor-2", city:"Korhogo", name:"Carrefour Sinématiali",      type:"carrefour", lat:9.4590, lon:-5.6320 },
  { id:"kor-3", city:"Korhogo", name:"Station Total Korhogo",      type:"station",   lat:9.4452, lon:-5.6198 },
  { id:"kor-4", city:"Korhogo", name:"Grand Marché de Korhogo",    type:"marche",    lat:9.4507, lon:-5.6289 },
  /* ── San-Pédro ── */
  { id:"san-1", city:"San-Pédro", name:"Gare routière de San-Pédro", type:"gare",  lat:4.7481, lon:-6.6360 },
  { id:"san-2", city:"San-Pédro", name:"Port de San-Pédro",          type:"place", lat:4.7350, lon:-6.6250 },
  { id:"san-3", city:"San-Pédro", name:"Carrefour Tabou",            type:"carrefour", lat:4.7420, lon:-6.6280 },
  /* ── Man ── */
  { id:"man-1", city:"Man", name:"Gare centrale de Man",           type:"gare",      lat:7.4123, lon:-7.5554 },
  { id:"man-2", city:"Man", name:"Carrefour Mont Nimba",           type:"carrefour", lat:7.4180, lon:-7.5480 },
  { id:"man-3", city:"Man", name:"Marché de Man",                  type:"marche",    lat:7.4102, lon:-7.5533 },
  /* ── Daloa ── */
  { id:"dal-1", city:"Daloa", name:"Gare routière de Daloa",       type:"gare",      lat:6.8740, lon:-6.4502 },
  { id:"dal-2", city:"Daloa", name:"Carrefour PK18 Daloa",         type:"carrefour", lat:6.8910, lon:-6.4420 },
  { id:"dal-3", city:"Daloa", name:"Station Shell Daloa",          type:"station",   lat:6.8765, lon:-6.4480 },
  /* ── Divo ── */
  { id:"div-1", city:"Divo",   name:"Gare routière de Divo",       type:"gare",      lat:5.8380, lon:-5.3573 },
  { id:"div-2", city:"Divo",   name:"Carrefour Lakota-Divo",       type:"carrefour", lat:5.8420, lon:-5.3540 },
  /* ── Gagnoa ── */
  { id:"gag-1", city:"Gagnoa", name:"Gare routière de Gagnoa",     type:"gare",      lat:6.1330, lon:-5.9483 },
  { id:"gag-2", city:"Gagnoa", name:"Carrefour Lakota",            type:"carrefour", lat:6.1400, lon:-5.9530 },
  { id:"gag-3", city:"Gagnoa", name:"Grand Marché de Gagnoa",      type:"marche",    lat:6.1312, lon:-5.9461 },
  /* ── Agboville (intermédiaire) ── */
  { id:"agb-1", city:"Agboville", name:"Gare d'Agboville",         type:"gare",      lat:5.9240, lon:-4.2183 },
  { id:"agb-2", city:"Agboville", name:"Carrefour Agboville",      type:"carrefour", lat:5.9260, lon:-4.2150 },
];

/* ─── City nodes on the CI map ─────────────────────────────────────────── */
const CITIES: Record<string, { x: number; y: number; label: string; major?: boolean }> = {
  Abidjan:      { x: 84, y: 84, label: "Abidjan",      major: true },
  Bouaké:       { x: 65, y: 47, label: "Bouaké",       major: true },
  Yamoussoukro: { x: 60, y: 61, label: "Yamoussoukro", major: true },
  Korhogo:      { x: 53, y: 19, label: "Korhogo",      major: true },
  "San-Pédro":  { x: 34, y: 93, label: "San-Pédro",   major: true },
  Man:          { x: 16, y: 51, label: "Man",           major: true },
  Daloa:        { x: 38, y: 60, label: "Daloa" },
  Divo:         { x: 58, y: 76, label: "Divo" },
  Gagnoa:       { x: 47, y: 71, label: "Gagnoa" },
};

/* road connections to draw */
const ROUTES: [string, string][] = [
  ["Abidjan", "Divo"],
  ["Divo", "Yamoussoukro"],
  ["Yamoussoukro", "Bouaké"],
  ["Bouaké", "Korhogo"],
  ["Abidjan", "Gagnoa"],
  ["Gagnoa", "Daloa"],
  ["Daloa", "Man"],
  ["Gagnoa", "San-Pédro"],
  ["Divo", "Gagnoa"],
  ["Yamoussoukro", "Daloa"],
];

/* ─── Demo buses (fallback) ─────────────────────────────────────────────── */
const now = new Date();
const hm = (h: number, m: number) =>
  `${String((h + 24) % 24).padStart(2, "0")}:${String(Math.abs(m) % 60).padStart(2, "0")}`;

const DEMO_BUSES: LiveBus[] = [
  {
    id: "live-1", companyName: "SOTRAL", busName: "SOTRAL Express 04", busType: "Premium",
    fromCity: "Abidjan", toCity: "Bouaké", currentCity: "Yamoussoukro",
    mapX: 72, mapY: 70, availableSeats: 12, totalSeats: 59,
    departureTime: hm(now.getHours() - 3, 15), estimatedArrival: hm(now.getHours() + 2, 30),
    agentPhone: "+22507123456", agentName: "Kouassi Rémi", price: 3500, color: "#1A56DB",
    boardingPoints: ["Abidjan (Gare Adjamé)", "Divo", "Yamoussoukro", "Bouaké"],
  },
  {
    id: "live-2", companyName: "UTB", busName: "UTB Comfort 12", busType: "Standard",
    fromCity: "Abidjan", toCity: "Yamoussoukro", currentCity: "Agboville",
    mapX: 78, mapY: 76, availableSeats: 5, totalSeats: 49,
    departureTime: hm(now.getHours() - 1, 45), estimatedArrival: hm(now.getHours() + 1, 0),
    agentPhone: "+22505987654", agentName: "Diomandé Salif", price: 2000, color: "#059669",
    boardingPoints: ["Abidjan (Gare Bassam)", "Agboville", "Tiébissou", "Yamoussoukro"],
  },
  {
    id: "live-3", companyName: "TSR", busName: "TSR Rapide 07", busType: "VIP",
    fromCity: "Bouaké", toCity: "Korhogo", currentCity: "Katiola",
    mapX: 59, mapY: 33, availableSeats: 18, totalSeats: 63,
    departureTime: hm(now.getHours() - 2, 0), estimatedArrival: hm(now.getHours() + 3, 45),
    agentPhone: "+22501567890", agentName: "Traoré Moussa", price: 2500, color: "#7C3AED",
    boardingPoints: ["Bouaké (Gare Nord)", "Katiola", "Niakaramandougou", "Korhogo"],
  },
  {
    id: "live-4", companyName: "SOTRA CI", busName: "SOTRA 501", busType: "Standard",
    fromCity: "Abidjan", toCity: "San-Pédro", currentCity: "Lakota",
    mapX: 48, mapY: 83, availableSeats: 23, totalSeats: 59,
    departureTime: hm(now.getHours() - 4, 0), estimatedArrival: hm(now.getHours() + 1, 20),
    agentPhone: "+22507456789", agentName: "Aka Jean-Marie", price: 3000, color: "#D97706",
    boardingPoints: ["Abidjan (Gare Yopougon)", "Gagnoa", "Lakota", "Soubré", "San-Pédro"],
  },
  {
    id: "live-5", companyName: "CTM", busName: "CTM Man 03", busType: "Premium",
    fromCity: "Man", toCity: "Abidjan", currentCity: "Daloa",
    mapX: 38, mapY: 60, availableSeats: 8, totalSeats: 49,
    departureTime: hm(now.getHours() - 5, 30), estimatedArrival: hm(now.getHours() + 4, 0),
    agentPhone: "+22505234567", agentName: "Bamba Sékou", price: 5500, color: "#DC2626",
    boardingPoints: ["Man (Gare centrale)", "Danané", "Daloa", "Divo", "Abidjan (Adjamé)"],
  },
];

/* ─── Pulse animation per bus ────────────────────────────────────────────── */
function usePulse(delay = 0) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 2.4, duration: 900, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);
  return anim;
}

/* ─── Bus marker component ───────────────────────────────────────────────── */
function BusMarker({ bus, mapW, mapH: mapHeight, selected, onPress }: {
  bus: LiveBus; mapW: number; mapH: number; selected: boolean; onPress: () => void;
}) {
  const pulse = usePulse(parseInt(bus.id.slice(-1)) * 300);
  const cx = (bus.mapX / 100) * mapW;
  const cy = (bus.mapY / 100) * mapHeight;
  const R = selected ? 18 : 14;

  return (
    <Pressable
      onPress={onPress}
      style={{ position: "absolute", left: cx - R, top: cy - R, width: R * 2, height: R * 2 }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: R - R * 0.5, top: R - R * 0.5,
          width: R, height: R,
          borderRadius: R / 2,
          backgroundColor: bus.color + "55",
          transform: [{ scale: pulse }],
        }}
      />
      <View style={{
        position: "absolute", left: 0, top: 0, width: R * 2, height: R * 2,
        borderRadius: R,
        backgroundColor: bus.color,
        borderWidth: selected ? 3 : 2,
        borderColor: "white",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: bus.color, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9, shadowRadius: 6, elevation: 8,
      }}>
        <Feather name="truck" size={R * 0.72} color="white" />
      </View>
    </Pressable>
  );
}

/* ─── Main screen ─────────────────────────────────────────────────────────── */
export default function LiveTrackingScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [rawBuses, setRawBuses] = useState<LiveBus[]>(DEMO_BUSES);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<LiveBus | null>(null);
  const [boardingPoint, setBoardingPoint] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState({ w: SW, h: MAP_H });
  const slideAnim = useRef(new Animated.Value(600)).current;

  /* ── Auth token (loaded from storage to authenticate GPS calls) ── */
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem("auth_token").then(t => { if (t) setAuthToken(t); }).catch(() => {});
  }, []);

  /* ── GPS trail state (breadcrumb dots on map) ── */
  const [gpsTrail, setGpsTrail]   = useState<{ x: number; y: number; speed: number | null }[]>([]);
  const trailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTrail = useCallback(async (busId: string, token: string | null) => {
    if (!token) return;
    try {
      const rows = await apiFetch<{ lat: number; lon: number; speed: number | null }[]>(
        `/agent/trip/${busId}/trail?limit=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!Array.isArray(rows)) return;
      const pts = rows.map(r => ({
        x: Math.max(1, Math.min(99, ((r.lon - (-8.4)) / 5.2) * 100)),
        y: Math.max(1, Math.min(99, ((10.7 - r.lat) / 6.4) * 100)),
        speed: r.speed,
      }));
      setGpsTrail(pts);
    } catch { /* silent — trail is optional */ }
  }, []);

  /* Refresh trail every 10s while a bus is selected */
  useEffect(() => {
    if (!selected || !authToken) { setGpsTrail([]); return; }
    fetchTrail(selected.id, authToken);
    trailTimerRef.current = setInterval(() => fetchTrail(selected.id, authToken), 10_000);
    return () => { if (trailTimerRef.current) { clearInterval(trailTimerRef.current); trailTimerRef.current = null; } };
  }, [selected, authToken, fetchTrail]);

  /* ── Client GPS ── */
  const [clientPos,    setClientPos]    = useState<ClientPosition | null>(null);
  const [gpsGranted,   setGpsGranted]   = useState<boolean | null>(null);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Request client location once on mount */
  useEffect(() => {
    let active = true;
    (async () => {
      setGpsLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (status !== "granted") { setGpsGranted(false); setGpsLoading(false); return; }
        setGpsGranted(true);
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        setClientPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch { if (active) setGpsGranted(false); }
      finally   { if (active) setGpsLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  /* Fetch buses (and re-fetch every 10s) — pass auth token for live GPS */
  const fetchBuses = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = authToken ?? (await AsyncStorage.getItem("auth_token")) ?? undefined;
      const data = await apiFetch<LiveBus[]>("/trips/live", { token: token ?? undefined });
      if (data?.length) setRawBuses(data);
    } catch { /* keep demo data */ }
    finally { if (!silent) setLoading(false); }
  }, [authToken]);

  useEffect(() => {
    fetchBuses();
    refreshTimerRef.current = setInterval(() => fetchBuses(true), 10_000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [fetchBuses]);

  /* Compute distances and sort buses by proximity */
  const buses = useMemo<LiveBus[]>(() => {
    if (!clientPos) return rawBuses;
    return rawBuses
      .map(bus => {
        const busCoords = bus.lat != null && bus.lon != null
          ? { lat: bus.lat, lon: bus.lon }
          : mapToLatLon(bus.mapX, bus.mapY);
        return { ...bus, distanceKm: haversine(clientPos.lat, clientPos.lon, busCoords.lat, busCoords.lon) };
      })
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }, [rawBuses, clientPos]);

  /* ── Client request form state ── */
  const [showRequestForm,    setShowRequestForm]    = useState(false);
  const [reqName,            setReqName]            = useState("");
  const [reqPhone,           setReqPhone]           = useState("");
  const [reqSeats,           setReqSeats]           = useState("1");
  const [reqLoading,         setReqLoading]         = useState(false);
  const [reqSuccess,         setReqSuccess]         = useState(false);

  /* ── Request status tracking (polling after submission) ── */
  const [submittedReqId,  setSubmittedReqId]  = useState<string | null>(null);
  const [reqStatus,       setReqStatus]       = useState<"pending"|"accepted"|"rejected"|null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Poll for request status every 5s after submission */
  useEffect(() => {
    if (!submittedReqId || !selected) return;
    const doCheck = async () => {
      try {
        const data = await apiFetch<{ status: string }>(
          `/trips/${selected.id}/request/${submittedReqId}`, {}
        );
        if (data?.status === "accepted") {
          setReqStatus("accepted");
          if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
        } else if (data?.status === "rejected") {
          setReqStatus("rejected");
          if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
        }
      } catch { /* keep polling */ }
    };
    doCheck();
    pollTimerRef.current = setInterval(doCheck, 5_000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [submittedReqId, selected]);

  /* Pickup point selection */
  const [pickupType,         setPickupType]         = useState<"gps"|"landmark"|null>(null);
  const [pickupLat,          setPickupLat]          = useState<number|null>(null);
  const [pickupLon,          setPickupLon]          = useState<number|null>(null);
  const [pickupLabel,        setPickupLabel]        = useState<string>("");
  const [pickupCity,         setPickupCity]         = useState<string>("");
  const [showLandmarkPicker, setShowLandmarkPicker] = useState(false);
  const [landmarkSearch,     setLandmarkSearch]     = useState("");

  /* Pickup marker position on map (%) */
  const pickupMapPos = useMemo(() => {
    if (pickupLat == null || pickupLon == null) return null;
    const x = Math.max(1, Math.min(99, ((pickupLon - (-8.4)) / 5.2) * 100));
    const y = Math.max(1, Math.min(99, ((10.7 - pickupLat) / 6.4) * 100));
    return { x, y };
  }, [pickupLat, pickupLon]);

  /* Landmarks filtered by search + boarding city */
  const filteredLandmarks = useMemo<Landmark[]>(() => {
    /* Try to extract city from boardingPoint string */
    const bpCity = boardingPoint
      ? CI_LANDMARKS.find(l => boardingPoint.toLowerCase().includes(l.city.toLowerCase()))?.city
      : null;
    const q = landmarkSearch.trim().toLowerCase();
    return CI_LANDMARKS.filter(l => {
      const matchCity = !bpCity || l.city === bpCity;
      if (!q) return matchCity;
      return matchCity && (l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.type.includes(q));
    });
  }, [boardingPoint, landmarkSearch]);

  const selectGpsPickup = () => {
    if (!clientPos) {
      Alert.alert("Localisation indisponible", "Activez la localisation pour utiliser votre position actuelle.");
      return;
    }
    setPickupType("gps");
    setPickupLat(clientPos.lat);
    setPickupLon(clientPos.lon);
    setPickupLabel("Ma position actuelle");
    setPickupCity("");
    setShowLandmarkPicker(false);
  };

  const selectLandmark = (lm: Landmark) => {
    setPickupType("landmark");
    setPickupLat(lm.lat);
    setPickupLon(lm.lon);
    setPickupLabel(lm.name);
    setPickupCity(lm.city);
    setShowLandmarkPicker(false);
    setLandmarkSearch("");
  };

  const clearPickup = () => {
    setPickupType(null); setPickupLat(null); setPickupLon(null);
    setPickupLabel(""); setPickupCity("");
  };

  const submitRequest = useCallback(async () => {
    if (!selected) return;
    if (!boardingPoint) {
      Alert.alert("Point de montée requis", "Sélectionnez d'abord un point de montée ci-dessus.");
      return;
    }
    if (reqName.trim().length < 2) {
      Alert.alert("Nom invalide", "Entrez votre nom complet (min. 2 caractères).");
      return;
    }
    if (reqPhone.trim().length < 8) {
      Alert.alert("Téléphone invalide", "Entrez un numéro valide.");
      return;
    }
    setReqLoading(true);
    try {
      const data = await apiFetch<{ success: boolean; requestId: string }>(`/trips/${selected.id}/request`, {
        method: "POST",
        body: JSON.stringify({
          clientName:     reqName.trim(),
          clientPhone:    reqPhone.trim(),
          seatsRequested: parseInt(reqSeats, 10) || 1,
          boardingPoint,
          pickupType:  pickupType  ?? undefined,
          pickupLat:   pickupLat   ?? undefined,
          pickupLon:   pickupLon   ?? undefined,
          pickupLabel: pickupLabel || undefined,
          pickupCity:  pickupCity  || undefined,
        }),
      });
      setReqSuccess(true);
      setSubmittedReqId(data.requestId);   /* start polling for status */
      setReqStatus("pending");
      setReqName(""); setReqPhone(""); setReqSeats("1");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'envoyer la demande. Réessayez.");
    }
    setReqLoading(false);
  }, [selected, boardingPoint, reqName, reqPhone, reqSeats, pickupType, pickupLat, pickupLon, pickupLabel, pickupCity]);

  /* Client position on map (mapX/mapY %) — clamped to CI bounding box */
  const clientMapPos = useMemo<{ x: number; y: number } | null>(() => {
    if (!clientPos) return null;
    const x = Math.max(1, Math.min(99, ((clientPos.lon - (-8.4)) / 5.2) * 100));
    const y = Math.max(1, Math.min(99, ((10.7 - clientPos.lat) / 6.4) * 100));
    /* If outside CI bounds, don't show on map */
    if (clientPos.lat < 4 || clientPos.lat > 11 || clientPos.lon < -8.6 || clientPos.lon > -3) return null;
    return { x, y };
  }, [clientPos]);

  const openDetail = useCallback((bus: LiveBus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(bus);
    setBoardingPoint(null);
    setShowRequestForm(false);
    setReqSuccess(false);
    setReqName(""); setReqPhone(""); setReqSeats("1");
    setPickupType(null); setPickupLat(null); setPickupLon(null);
    setPickupLabel(""); setPickupCity("");
    setShowLandmarkPicker(false); setLandmarkSearch("");
    /* Reset communication state */
    setSubmittedReqId(null);
    setReqStatus(null);
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    slideAnim.setValue(600);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 65, friction: 11 }).start();
  }, [slideAnim]);

  const closeDetail = useCallback(() => {
    Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: false }).start(() => {
      setSelected(null);
      setShowRequestForm(false);
      setReqSuccess(false);
    });
  }, [slideAnim]);

  const callAgent = (bus: LiveBus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${bus.agentPhone.replace(/\s/g, "")}`);
  };
  const smsAgent = (bus: LiveBus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`sms:${bus.agentPhone.replace(/\s/g, "")}`);
  };

  const reserve = (bus: LiveBus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    closeDetail();
    router.push({
      pathname: "/search-results",
      params: { from: bus.fromCity, to: bus.toCity, date: new Date().toISOString().split("T")[0], passengers: "1" },
    });
  };

  return (
    <View style={[S.root, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient colors={["#0B1E3D", "#0B1628"]} style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Cars en route</Text>
          <Text style={S.headerSub}>Côte d'Ivoire — temps réel</Text>
        </View>
        <View style={S.liveBadge}>
          <View style={S.liveDot} />
          <Text style={S.liveText}>LIVE</Text>
        </View>
      </LinearGradient>

      {/* Map */}
      <View
        style={[S.mapContainer, { height: mapSize.h }]}
        onLayout={(e) => setMapSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <LinearGradient colors={["#0B1628", "#0D1F3C"]} style={StyleSheet.absoluteFill} />

        {/* SVG road network */}
        <Svg width={mapSize.w} height={mapSize.h} style={StyleSheet.absoluteFill}>
          {/* Road lines */}
          {ROUTES.map(([a, b], i) => {
            const ca = CITIES[a]; const cb = CITIES[b];
            if (!ca || !cb) return null;
            return (
              <Line key={i}
                x1={(ca.x / 100) * mapSize.w} y1={(ca.y / 100) * mapSize.h}
                x2={(cb.x / 100) * mapSize.w} y2={(cb.y / 100) * mapSize.h}
                stroke="#1E3A5F" strokeWidth={1.5} strokeDasharray="6,5"
              />
            );
          })}
          {/* City dots */}
          {Object.entries(CITIES).map(([name, city]) => {
            const cx = (city.x / 100) * mapSize.w;
            const cy = (city.y / 100) * mapSize.h;
            const r = city.major ? 5 : 3;
            return (
              <React.Fragment key={name}>
                <Circle cx={cx} cy={cy} r={r + 4} fill="#1E3A5F88" />
                <Circle cx={cx} cy={cy} r={r} fill={city.major ? "#60A5FA" : "#475569"} />
                <SvgText
                  x={cx} y={cy - r - 5}
                  fontSize={city.major ? 10 : 8}
                  fill={city.major ? "#BAD4F7" : "#64748B"}
                  textAnchor="middle"
                  fontWeight={city.major ? "bold" : "normal"}
                >
                  {city.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>

        {/* GPS trail dots — breadcrumb showing where selected bus has been */}
        {gpsTrail.map((pt, i) => {
          const opacity = 0.25 + (i / Math.max(gpsTrail.length - 1, 1)) * 0.6;
          const size    = 5 + (i / Math.max(gpsTrail.length - 1, 1)) * 4;
          return (
            <View
              key={`trail-${i}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: (pt.x / 100) * mapSize.w - size / 2,
                top:  (pt.y / 100) * mapSize.h - size / 2,
                width: size, height: size,
                borderRadius: size / 2,
                backgroundColor: "#10B981",
                opacity,
              }}
            />
          );
        })}

        {/* Animated bus markers */}
        {buses.map((bus) => (
          <BusMarker
            key={bus.id}
            bus={bus}
            mapW={mapSize.w}
            mapH={mapSize.h}
            selected={selected?.id === bus.id}
            onPress={() => openDetail(bus)}
          />
        ))}

        {/* Client position marker (cyan circle) */}
        {clientMapPos && (
          <View style={{
            position: "absolute",
            left: (clientMapPos.x / 100) * mapSize.w - 10,
            top:  (clientMapPos.y / 100) * mapSize.h - 10,
            width: 20, height: 20, borderRadius: 10,
            backgroundColor: "#22D3EE", borderWidth: 3, borderColor: "white",
            shadowColor: "#22D3EE", shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9, shadowRadius: 6, elevation: 10,
          }} />
        )}

        {/* Selected pickup point marker (orange diamond) */}
        {pickupMapPos && (
          <View style={{
            position: "absolute",
            left: (pickupMapPos.x / 100) * mapSize.w - 11,
            top:  (pickupMapPos.y / 100) * mapSize.h - 11,
          }}>
            <View style={{
              width: 22, height: 22,
              backgroundColor: "#F97316",
              borderWidth: 2.5, borderColor: "white",
              borderRadius: 3,
              transform: [{ rotate: "45deg" }],
              shadowColor: "#F97316",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.9, shadowRadius: 8, elevation: 12,
            }} />
          </View>
        )}

        {/* Legend bottom-left */}
        <View style={S.legend}>
          <View style={S.legendItem}>
            <View style={[S.legendDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={S.legendText}>{buses.length} cars en route</Text>
          </View>
          {clientPos && (
            <View style={[S.legendItem, { marginTop: 3 }]}>
              <View style={[S.legendDot, { backgroundColor: "#22D3EE" }]} />
              <Text style={S.legendText}>Votre position</Text>
            </View>
          )}
          {pickupMapPos && (
            <View style={[S.legendItem, { marginTop: 3 }]}>
              <View style={[S.legendDot, { backgroundColor: "#F97316", borderRadius: 2, transform: [{ rotate: "45deg" }] }]} />
              <Text style={S.legendText}>Point de montée</Text>
            </View>
          )}
          {gpsTrail.length > 0 && (
            <View style={[S.legendItem, { marginTop: 3 }]}>
              <View style={[S.legendDot, { backgroundColor: "#10B981" }]} />
              <Text style={S.legendText}>Trajet parcouru</Text>
            </View>
          )}
        </View>

        {/* Map label */}
        <View style={S.mapLabel}>
          <Feather name="map-pin" size={10} color="#64748B" />
          <Text style={S.mapLabelText}>Côte d'Ivoire</Text>
        </View>
      </View>

      {/* Bus list */}
      <View style={S.listHeader}>
        <View>
          <Text style={S.listTitle}>{buses.length} cars en route maintenant</Text>
          {clientPos && (
            <Text style={{ color: "#22D3EE", fontSize: 11, marginTop: 1 }}>
              Triés par distance depuis vous
            </Text>
          )}
          {gpsLoading && (
            <Text style={{ color: "#94A3B8", fontSize: 11, marginTop: 1 }}>
              Localisation en cours…
            </Text>
          )}
        </View>
        {loading && <Text style={S.loadingText}>Actualisation…</Text>}
      </View>
      <ScrollView style={S.list} contentContainerStyle={{ paddingBottom: 32, gap: 10 }} showsVerticalScrollIndicator={false}>
        {buses.map((bus) => (
          <TouchableOpacity
            key={bus.id}
            style={[S.busCard, selected?.id === bus.id && { borderColor: bus.color, borderWidth: 2 }]}
            activeOpacity={0.85}
            onPress={() => openDetail(bus)}
          >
            <View style={[S.busCardStrip, { backgroundColor: bus.color }]} />
            <View style={S.busCardBody}>
              <View style={S.busCardTop}>
                <View style={[S.companyBadge, { backgroundColor: bus.color + "20" }]}>
                  <Text style={[S.companyName, { color: bus.color }]}>{bus.companyName}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {bus.distanceKm != null && (
                    <View style={[S.seatsBadge, { backgroundColor: "#22D3EE18" }]}>
                      <Feather name="navigation" size={11} color="#22D3EE" />
                      <Text style={[S.seatsText, { color: "#22D3EE" }]}>
                        {fmtDist(bus.distanceKm)}
                      </Text>
                    </View>
                  )}
                  <View style={S.seatsBadge}>
                    <Feather name="users" size={11} color={bus.availableSeats <= 5 ? "#DC2626" : "#059669"} />
                    <Text style={[S.seatsText, { color: bus.availableSeats <= 5 ? "#DC2626" : "#059669" }]}>
                      {bus.availableSeats} places
                    </Text>
                  </View>
                </View>
              </View>
              <View style={S.routeRow}>
                <Text style={S.cityText}>{bus.fromCity}</Text>
                <View style={S.routeArrow}>
                  <View style={S.routeLine2} />
                  <Feather name="arrow-right" size={12} color="#1A56DB" />
                  <View style={S.routeLine2} />
                </View>
                <Text style={S.cityText}>{bus.toCity}</Text>
              </View>
              <View style={S.busCardMeta}>
                <View style={S.metaItem}>
                  <Feather name="map-pin" size={11} color="#94A3B8" />
                  <Text style={S.metaText}>{bus.currentCity}</Text>
                </View>
                <View style={S.metaItem}>
                  <Feather name="clock" size={11} color="#94A3B8" />
                  <Text style={S.metaText}>Arrivée {bus.estimatedArrival}</Text>
                </View>
                <View style={S.metaItem}>
                  <Feather name="tag" size={11} color="#94A3B8" />
                  <Text style={S.metaText}>{bus.price.toLocaleString()} F</Text>
                </View>
                {bus.gpsLive && (
                  <View style={[S.metaItem, { backgroundColor: "#22C55E18", borderRadius: 4, paddingHorizontal: 4 }]}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" }} />
                    <Text style={[S.metaText, { color: "#22C55E" }]}>GPS live</Text>
                  </View>
                )}
              </View>
            </View>
            <Feather name="chevron-right" size={16} color="#CBD5E1" style={{ marginRight: 4 }} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Detail modal */}
      {selected && (
        <Modal transparent animationType="none" visible statusBarTranslucent onRequestClose={closeDetail}>
          <Pressable style={S.modalOverlay} onPress={closeDetail} />
          <Animated.View style={[S.sheet, { transform: [{ translateY: slideAnim }] }]}>
            {/* Handle */}
            <View style={S.sheetHandle} />

            {/* Header strip */}
            <LinearGradient colors={[selected.color, selected.color + "CC"]} style={S.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={S.sheetCompany}>{selected.companyName}</Text>
                <Text style={S.sheetBus}>{selected.busName}</Text>
                <View style={S.sheetRouteRow}>
                  <Text style={S.sheetCity}>{selected.fromCity}</Text>
                  <Feather name="arrow-right" size={14} color="rgba(255,255,255,0.8)" style={{ marginHorizontal: 6 }} />
                  <Text style={S.sheetCity}>{selected.toCity}</Text>
                </View>
              </View>
              <Pressable onPress={closeDetail} style={S.closeBtn}>
                <Feather name="x" size={18} color="white" />
              </Pressable>
            </LinearGradient>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              {/* Info grid */}
              <View style={S.infoGrid}>
                <View style={S.infoCell}>
                  <Feather name="map-pin" size={16} color={selected.color} />
                  <Text style={S.infoCellLabel}>Position actuelle</Text>
                  <Text style={S.infoCellVal}>{selected.currentCity}</Text>
                </View>
                <View style={S.infoCell}>
                  <Feather name="users" size={16} color={selected.availableSeats <= 5 ? "#DC2626" : "#059669"} />
                  <Text style={S.infoCellLabel}>Places disponibles</Text>
                  <Text style={[S.infoCellVal, { color: selected.availableSeats <= 5 ? "#DC2626" : "#059669" }]}>
                    {selected.availableSeats} / {selected.totalSeats}
                  </Text>
                </View>
                <View style={S.infoCell}>
                  <Feather name="clock" size={16} color={selected.color} />
                  <Text style={S.infoCellLabel}>Départ / Arrivée</Text>
                  <Text style={S.infoCellVal}>{selected.departureTime} → {selected.estimatedArrival}</Text>
                </View>
                <View style={S.infoCell}>
                  <Feather name="tag" size={16} color={selected.color} />
                  <Text style={S.infoCellLabel}>Prix par place</Text>
                  <Text style={S.infoCellVal}>{selected.price.toLocaleString()} FCFA</Text>
                </View>
                {selected.distanceKm != null && (
                  <View style={S.infoCell}>
                    <Feather name="navigation" size={16} color="#22D3EE" />
                    <Text style={S.infoCellLabel}>Distance depuis vous</Text>
                    <Text style={[S.infoCellVal, { color: "#22D3EE" }]}>{fmtDist(selected.distanceKm)}</Text>
                  </View>
                )}
                {selected.speed != null && (
                  <View style={S.infoCell}>
                    <Feather name="wind" size={16} color={selected.color} />
                    <Text style={S.infoCellLabel}>Vitesse actuelle</Text>
                    <Text style={S.infoCellVal}>{selected.speed} km/h</Text>
                  </View>
                )}
              </View>

              {/* Seat fill bar */}
              <View style={S.seatBarWrap}>
                <Text style={S.seatBarLabel}>Occupation du bus</Text>
                <View style={S.seatBarTrack}>
                  <View style={[S.seatBarFill, {
                    width: `${((selected.totalSeats - selected.availableSeats) / selected.totalSeats) * 100}%` as any,
                    backgroundColor: selected.color,
                  }]} />
                </View>
                <Text style={S.seatBarSub}>
                  {selected.totalSeats - selected.availableSeats} occupés · {selected.availableSeats} libres
                </Text>
              </View>

              {/* Boarding points */}
              <View>
                <Text style={S.sectionLabel}>Choisir un point de montée</Text>
                <View style={{ gap: 8 }}>
                  {selected.boardingPoints.map((pt) => (
                    <Pressable
                      key={pt}
                      style={[S.boardingBtn, boardingPoint === pt && { borderColor: selected.color, backgroundColor: selected.color + "12" }]}
                      onPress={() => { Haptics.selectionAsync(); setBoardingPoint(pt); }}
                    >
                      <View style={[S.boardingDot, { backgroundColor: boardingPoint === pt ? selected.color : "#CBD5E1" }]} />
                      <Text style={[S.boardingText, boardingPoint === pt && { color: selected.color, fontFamily: "Inter_600SemiBold" }]}>
                        {pt}
                      </Text>
                      {boardingPoint === pt && <Feather name="check-circle" size={16} color={selected.color} style={{ marginLeft: "auto" }} />}
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Agent contact */}
              <View style={S.agentRow}>
                <View style={S.agentInfo}>
                  <View style={[S.agentAvatar, { backgroundColor: selected.color + "20" }]}>
                    <Feather name="user" size={18} color={selected.color} />
                  </View>
                  <View>
                    <Text style={S.agentName}>{selected.agentName}</Text>
                    <Text style={S.agentLabel}>Agent de bord</Text>
                  </View>
                </View>
                <View style={S.contactBtns}>
                  <Pressable style={[S.contactBtn, { backgroundColor: "#ECFDF5" }]} onPress={() => smsAgent(selected)}>
                    <Feather name="message-circle" size={18} color="#059669" />
                  </Pressable>
                  <Pressable style={[S.contactBtn, { backgroundColor: "#EFF6FF" }]} onPress={() => callAgent(selected)}>
                    <Feather name="phone" size={18} color="#1A56DB" />
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            {/* Request form — inline below scroll content */}
            {showRequestForm && !reqSuccess && (
              <View style={{
                marginHorizontal: 16, marginBottom: 12,
                backgroundColor: "#F8FAFC", borderRadius: 14,
                borderWidth: 1.5, borderColor: "#E2E8F0",
                padding: 14, gap: 10,
              }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" }}>
                  Demander une montée
                </Text>
                {!boardingPoint && (
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Feather name="alert-circle" size={13} color="#D97706" />
                    <Text style={{ fontSize: 12, color: "#D97706", fontFamily: "Inter_500Medium" }}>
                      Sélectionnez d'abord un arrêt ci-dessus
                    </Text>
                  </View>
                )}
                <TextInput
                  style={{
                    backgroundColor: "white", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0",
                    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular",
                  }}
                  placeholder="Votre nom complet"
                  placeholderTextColor="#94A3B8"
                  value={reqName}
                  onChangeText={setReqName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={{
                    backgroundColor: "white", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0",
                    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular",
                  }}
                  placeholder="Numéro de téléphone"
                  placeholderTextColor="#94A3B8"
                  value={reqPhone}
                  onChangeText={setReqPhone}
                  keyboardType="phone-pad"
                />

                {/* ── Pickup point selector ── */}
                <View>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#475569", marginBottom: 6 }}>
                    Point de montée précis
                  </Text>

                  {/* Selected pickup badge */}
                  {pickupType ? (
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: 8,
                      backgroundColor: "#FFF7ED", borderRadius: 10, padding: 10,
                      borderWidth: 1.5, borderColor: "#FDBA74",
                    }}>
                      <Feather name={pickupType === "gps" ? "crosshair" : "map-pin"} size={15} color="#F97316" />
                      <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#9A3412" }} numberOfLines={1}>
                        {pickupLabel}
                      </Text>
                      <Pressable onPress={clearPickup} hitSlop={8}>
                        <Feather name="x" size={14} color="#94A3B8" />
                      </Pressable>
                    </View>
                  ) : (
                    /* Choice buttons */
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {/* GPS button */}
                      <Pressable
                        onPress={selectGpsPickup}
                        style={({ pressed }) => [{
                          flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                          gap: 6, height: 40, borderRadius: 10,
                          backgroundColor: clientPos ? "#F0FDF4" : "#F8FAFC",
                          borderWidth: 1.5, borderColor: clientPos ? "#86EFAC" : "#E2E8F0",
                          opacity: pressed ? 0.8 : 1,
                        }]}
                      >
                        <Feather name="crosshair" size={13} color={clientPos ? "#16A34A" : "#94A3B8"} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: clientPos ? "#16A34A" : "#94A3B8" }}>
                          Ma position
                        </Text>
                      </Pressable>

                      {/* Landmark button */}
                      <Pressable
                        onPress={() => setShowLandmarkPicker(v => !v)}
                        style={({ pressed }) => [{
                          flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                          gap: 6, height: 40, borderRadius: 10,
                          backgroundColor: showLandmarkPicker ? "#EEF2FF" : "#F8FAFC",
                          borderWidth: 1.5, borderColor: showLandmarkPicker ? "#A5B4FC" : "#E2E8F0",
                          opacity: pressed ? 0.8 : 1,
                        }]}
                      >
                        <Feather name="search" size={13} color={showLandmarkPicker ? "#4F46E5" : "#64748B"} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: showLandmarkPicker ? "#4F46E5" : "#64748B" }}>
                          Point de repère
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Landmark search panel */}
                  {showLandmarkPicker && !pickupType && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      <TextInput
                        style={{
                          backgroundColor: "white", borderRadius: 10, borderWidth: 1, borderColor: "#C7D2FE",
                          paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_400Regular",
                        }}
                        placeholder="Chercher gare, carrefour, station…"
                        placeholderTextColor="#94A3B8"
                        value={landmarkSearch}
                        onChangeText={setLandmarkSearch}
                        autoCapitalize="none"
                      />
                      <View style={{
                        maxHeight: 190,
                        backgroundColor: "white", borderRadius: 10,
                        borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden",
                      }}>
                        {filteredLandmarks.length === 0 ? (
                          <View style={{ padding: 14, alignItems: "center" }}>
                            <Text style={{ fontSize: 12, color: "#94A3B8" }}>Aucun résultat</Text>
                          </View>
                        ) : (
                          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                            {filteredLandmarks.map((lm, idx) => (
                              <Pressable
                                key={lm.id}
                                onPress={() => selectLandmark(lm)}
                                style={({ pressed }) => [{
                                  flexDirection: "row", alignItems: "center", gap: 10,
                                  paddingHorizontal: 12, paddingVertical: 10,
                                  backgroundColor: pressed ? "#F1F5F9" : "white",
                                  borderTopWidth: idx > 0 ? 1 : 0,
                                  borderTopColor: "#F1F5F9",
                                }]}
                              >
                                <View style={{
                                  width: 28, height: 28, borderRadius: 8,
                                  backgroundColor: lm.type === "gare" ? "#EFF6FF"
                                    : lm.type === "carrefour" ? "#F0FDF4"
                                    : lm.type === "station" ? "#FFFBEB"
                                    : lm.type === "marche" ? "#FDF4FF"
                                    : "#F8FAFC",
                                  justifyContent: "center", alignItems: "center",
                                }}>
                                  <Feather
                                    name={LANDMARK_ICON[lm.type] as any}
                                    size={13}
                                    color={lm.type === "gare" ? "#1D4ED8"
                                      : lm.type === "carrefour" ? "#059669"
                                      : lm.type === "station" ? "#D97706"
                                      : lm.type === "marche" ? "#7C3AED"
                                      : "#64748B"}
                                  />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0F172A" }} numberOfLines={1}>
                                    {lm.name}
                                  </Text>
                                  <Text style={{ fontSize: 11, color: "#64748B" }}>{lm.city} · {lm.type}</Text>
                                </View>
                                <Feather name="chevron-right" size={13} color="#CBD5E1" />
                              </Pressable>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                {/* Seats selector */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 13, color: "#475569", fontFamily: "Inter_500Medium" }}>Places :</Text>
                  {["1","2","3","4"].map(n => (
                    <Pressable
                      key={n}
                      onPress={() => setReqSeats(n)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center",
                        backgroundColor: reqSeats === n ? selected.color : "#F1F5F9",
                        borderWidth: 1.5, borderColor: reqSeats === n ? selected.color : "#E2E8F0",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: reqSeats === n ? "white" : "#475569" }}>{n}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Action row */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" }}
                    onPress={() => setShowRequestForm(false)}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748B" }}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [{
                      flex: 2, height: 40, borderRadius: 10,
                      backgroundColor: selected.color,
                      justifyContent: "center", alignItems: "center",
                      flexDirection: "row", gap: 6,
                      opacity: reqLoading || !boardingPoint ? 0.7 : (pressed ? 0.88 : 1),
                    }]}
                    onPress={submitRequest}
                    disabled={reqLoading || !boardingPoint}
                  >
                    {reqLoading
                      ? <ActivityIndicator color="white" size="small" />
                      : <><Feather name="send" size={14} color="white" />
                         <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "white" }}>Envoyer la demande</Text></>
                    }
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Communication banner — status-aware ── */}
            {reqSuccess && reqStatus === "pending" && (
              <View style={{
                marginHorizontal: 16, marginBottom: 12, padding: 14,
                backgroundColor: "#FFFBEB", borderRadius: 14,
                borderWidth: 1.5, borderColor: "#FDE68A",
                flexDirection: "row", alignItems: "center", gap: 10,
              }}>
                <ActivityIndicator size="small" color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#92400E" }}>
                    Demande envoyée !
                  </Text>
                  <Text style={{ fontSize: 12, color: "#B45309", fontFamily: "Inter_400Regular" }}>
                    En attente de l'agent…
                  </Text>
                </View>
              </View>
            )}

            {/* Accepted — show agent contact */}
            {reqSuccess && reqStatus === "accepted" && selected && (
              <View style={{
                marginHorizontal: 16, marginBottom: 12,
                backgroundColor: "#ECFDF5", borderRadius: 14,
                borderWidth: 1.5, borderColor: "#BBF7D0", overflow: "hidden",
              }}>
                <View style={{ height: 4, backgroundColor: "#10B981" }} />
                <View style={{ padding: 14, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: "#D1FAE5", justifyContent: "center", alignItems: "center",
                    }}>
                      <Feather name="check-circle" size={18} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#065F46" }}>
                        Montée acceptée ! ✓
                      </Text>
                      <Text style={{ fontSize: 12, color: "#059669" }}>
                        L'agent {selected.agentName} vous attend
                      </Text>
                    </View>
                  </View>
                  {/* Agent contact info */}
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 8,
                    backgroundColor: "white", borderRadius: 10, padding: 10,
                    borderWidth: 1, borderColor: "#BBF7D0",
                  }}>
                    <View style={{
                      width: 34, height: 34, borderRadius: 17,
                      backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center",
                    }}>
                      <Feather name="user" size={16} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" }}>
                        {selected.agentName}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#475569" }}>{selected.agentPhone}</Text>
                    </View>
                  </View>
                  {/* Call & SMS buttons */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      style={({ pressed }) => [{
                        flex: 1, height: 44, borderRadius: 12,
                        backgroundColor: "#059669",
                        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: pressed ? 0.85 : 1,
                      }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        Linking.openURL(`tel:${selected.agentPhone.replace(/\s/g, "")}`);
                      }}
                    >
                      <Feather name="phone" size={16} color="white" />
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "white" }}>
                        Appeler l'agent
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [{
                        flex: 1, height: 44, borderRadius: 12,
                        backgroundColor: "#1A56DB",
                        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: pressed ? 0.85 : 1,
                      }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const msg = `Bonjour ${selected.agentName}, je vous attends pour ${parseInt(reqSeats)||1} place(s).`;
                        Linking.openURL(`sms:${selected.agentPhone.replace(/\s/g, "")}?body=${encodeURIComponent(msg)}`);
                      }}
                    >
                      <Feather name="message-circle" size={16} color="white" />
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "white" }}>
                        Envoyer message
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* Rejected — show retry option */}
            {reqSuccess && reqStatus === "rejected" && (
              <View style={{
                marginHorizontal: 16, marginBottom: 12, padding: 14,
                backgroundColor: "#FEF2F2", borderRadius: 14,
                borderWidth: 1.5, borderColor: "#FECACA",
                gap: 10,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Feather name="x-circle" size={20} color="#DC2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#7F1D1D" }}>
                      Demande refusée
                    </Text>
                    <Text style={{ fontSize: 12, color: "#EF4444" }}>
                      L'agent ne peut pas vous prendre en charge.
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [{
                    height: 38, borderRadius: 10, backgroundColor: "#F1F5F9",
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                  onPress={() => {
                    setReqSuccess(false); setSubmittedReqId(null); setReqStatus(null);
                    setShowRequestForm(true);
                  }}
                >
                  <Feather name="refresh-cw" size={13} color="#1A56DB" />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1A56DB" }}>
                    Réessayer
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Reserve CTA */}
            <View style={[S.sheetFooter, { flexDirection: "column", gap: 10 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={S.priceWrap}>
                  <Text style={S.priceLabel}>Prix / place</Text>
                  <Text style={[S.priceVal, { color: selected.color }]}>{selected.price.toLocaleString()} F</Text>
                </View>
                {/* "Demander en direct" toggle — hidden when pending/accepted, shown when idle or rejected */}
                {(!reqSuccess || reqStatus === "rejected") && (
                  <Pressable
                    style={({ pressed }) => [{
                      flexDirection: "row", alignItems: "center", gap: 6,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: showRequestForm ? "#F1F5F9" : "#F0FDF4",
                      borderWidth: 1.5,
                      borderColor: showRequestForm ? "#E2E8F0" : "#BBF7D0",
                      opacity: pressed ? 0.8 : 1,
                    }]}
                    onPress={() => { Haptics.selectionAsync(); setShowRequestForm(v => !v); }}
                  >
                    <Feather name={showRequestForm ? "x" : "radio"} size={13} color={showRequestForm ? "#94A3B8" : "#059669"} />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: showRequestForm ? "#64748B" : "#059669" }}>
                      {showRequestForm ? "Fermer" : "Demander en direct"}
                    </Text>
                  </Pressable>
                )}
              </View>
              <Pressable
                style={({ pressed }) => [S.reserveBtn, { backgroundColor: selected.color }, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
                onPress={() => reserve(selected)}
              >
                <Feather name="bookmark" size={17} color="white" />
                <Text style={S.reserveBtnText}>Réserver une place</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, paddingTop: 14, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 1 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(239,68,68,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FCA5A5", letterSpacing: 0.8 },

  mapContainer: { width: "100%", overflow: "hidden" },
  legend: { position: "absolute", left: 12, bottom: 12, backgroundColor: "rgba(11,22,40,0.85)", borderRadius: 10, padding: 8, gap: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#BAD4F7" },
  mapLabel: { position: "absolute", right: 10, bottom: 12, flexDirection: "row", alignItems: "center", gap: 4 },
  mapLabelText: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#475569" },

  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  listTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  loadingText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  list: { flex: 1, paddingHorizontal: 16 },

  busCard: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: "#F1F5F9", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  busCardStrip: { width: 5, alignSelf: "stretch" },
  busCardBody: { flex: 1, padding: 12, gap: 6 },
  busCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  companyBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  companyName: { fontSize: 11, fontFamily: "Inter_700Bold" },
  seatsBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  seatsText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cityText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  routeArrow: { flex: 1, flexDirection: "row", alignItems: "center" },
  routeLine2: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  busCardMeta: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SH * 0.88, overflow: "hidden" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 },
  sheetCompany: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 0.5 },
  sheetBus: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white", marginTop: 2 },
  sheetRouteRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  sheetCity: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", alignItems: "center" },

  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoCell: { flex: 1, minWidth: "45%", backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: "#F1F5F9" },
  infoCellLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 4 },
  infoCellVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },

  seatBarWrap: { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: "#F1F5F9" },
  seatBarLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  seatBarTrack: { height: 8, backgroundColor: "#E2E8F0", borderRadius: 4, overflow: "hidden" },
  seatBarFill: { height: "100%", borderRadius: 4 },
  seatBarSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 8 },
  boardingBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0" },
  boardingDot: { width: 10, height: 10, borderRadius: 5 },
  boardingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569" },

  agentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#F1F5F9" },
  agentInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  agentAvatar: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  agentName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  agentLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 },
  contactBtns: { flexDirection: "row", gap: 10 },
  contactBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },

  sheetFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: "#F1F5F9", backgroundColor: "white", gap: 12 },
  priceWrap: { gap: 2 },
  priceLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  priceVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  reserveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14 },
  reserveBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "white" },
});
