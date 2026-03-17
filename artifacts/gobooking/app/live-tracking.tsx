import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  availableSeats: number;
  totalSeats: number;
  departureTime: string;
  estimatedArrival: string;
  agentPhone: string;
  agentName: string;
  price: number;
  color: string;
  boardingPoints: string[];
}

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
  const [buses, setBuses] = useState<LiveBus[]>(DEMO_BUSES);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<LiveBus | null>(null);
  const [boardingPoint, setBoardingPoint] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState({ w: SW, h: MAP_H });
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    setLoading(true);
    apiFetch<LiveBus[]>("/trips/live", {})
      .then((data) => { if (data?.length) setBuses(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openDetail = useCallback((bus: LiveBus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(bus);
    setBoardingPoint(null);
    slideAnim.setValue(600);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 65, friction: 11 }).start();
  }, [slideAnim]);

  const closeDetail = useCallback(() => {
    Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: false }).start(() => setSelected(null));
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

        {/* Legend bottom-left */}
        <View style={S.legend}>
          <View style={S.legendItem}>
            <View style={[S.legendDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={S.legendText}>{buses.length} cars en route</Text>
          </View>
        </View>

        {/* Map label */}
        <View style={S.mapLabel}>
          <Feather name="map-pin" size={10} color="#64748B" />
          <Text style={S.mapLabelText}>Côte d'Ivoire</Text>
        </View>
      </View>

      {/* Bus list */}
      <View style={S.listHeader}>
        <Text style={S.listTitle}>{buses.length} cars en route maintenant</Text>
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
                <View style={S.seatsBadge}>
                  <Feather name="users" size={11} color={bus.availableSeats <= 5 ? "#DC2626" : "#059669"} />
                  <Text style={[S.seatsText, { color: bus.availableSeats <= 5 ? "#DC2626" : "#059669" }]}>
                    {bus.availableSeats} places
                  </Text>
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

            {/* Reserve CTA */}
            <View style={S.sheetFooter}>
              <View style={S.priceWrap}>
                <Text style={S.priceLabel}>Prix / place</Text>
                <Text style={[S.priceVal, { color: selected.color }]}>{selected.price.toLocaleString()} F</Text>
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
