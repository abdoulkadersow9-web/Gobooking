import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

interface Parcel {
  id: string;
  trackingRef: string;
  fromCity: string;
  toCity: string;
  senderName: string;
  receiverName: string;
  parcelType: string;
  weight: number;
  deliveryType: string;
  amount: number;
  status: string;
  createdAt: string;
}

type Filter = "tous" | "en_cours" | "livres";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  en_attente:     { label: "Colis enregistré", color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" },
  pris_en_charge: { label: "Reçu en agence",  color: Colors.light.primary, bg: "#EEF2FF", dot: Colors.light.primary },
  en_transit:     { label: "En transit",       color: "#7C3AED", bg: "#F5F3FF", dot: "#8B5CF6" },
  en_livraison:   { label: "En livraison",     color: "#0891B2", bg: "#ECFEFF", dot: "#06B6D4" },
  livre:          { label: "Livré",            color: "#059669", bg: "#ECFDF5", dot: "#10B981" },
  annule:         { label: "Annulé",           color: "#EF4444", bg: "#FEF2F2", dot: "#EF4444" },
};

const TYPE_ICONS: Record<string, string> = {
  documents: "file-text", vetements: "shopping-bag", electronique: "cpu",
  alimentaire: "coffee", cosmetique: "star", autre: "package",
};

const IN_PROGRESS = ["en_attente", "pris_en_charge", "en_transit", "en_livraison"];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

// ── Parcel card ──────────────────────────────────────────────────────────────
function ParcelCard({ item, onPress, demo }: { item: Parcel; onPress: () => void; demo?: boolean }) {
  const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.en_attente;
  const typeIcon = (TYPE_ICONS[item.parcelType] || "package") as never;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        demo && styles.cardDemo,
        pressed && !demo && { opacity: 0.92 },
      ]}
      onPress={demo ? undefined : onPress}
    >
      {/* Status strip at left edge */}
      <View style={[styles.cardStrip, { backgroundColor: st.dot }]} />

      <View style={styles.cardInner}>
        {/* Row 1: ref + status pill */}
        <View style={styles.row1}>
          <View style={styles.refBox}>
            <Feather name={typeIcon} size={13} color={Colors.light.primary} />
            <Text style={styles.refText}>{item.trackingRef}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
            <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        {/* Row 2: route */}
        <View style={styles.routeRow}>
          <Text style={styles.cityFrom}>{item.fromCity}</Text>
          <View style={styles.routeMid}>
            <View style={styles.routeLineFill} />
            <Feather name="chevron-right" size={13} color={Colors.light.primary} />
            <View style={styles.routeLineFill} />
          </View>
          <Text style={styles.cityTo}>{item.toCity}</Text>
        </View>

        {/* Row 3: date + chevron */}
        <View style={styles.row3}>
          <View style={styles.dateRow}>
            <Feather name="calendar" size={11} color="#94A3B8" />
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
          {!demo && (
            <View style={styles.chevronPill}>
              <Text style={styles.chevronPillText}>Voir le suivi</Text>
              <Feather name="arrow-right" size={12} color={Colors.light.primary} />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Demo parcels shown when logged out ───────────────────────────────────────
const DEMO_PARCELS: Parcel[] = [
  { id: "d1", trackingRef: "GBX-A4F2-KM91", fromCity: "Abidjan", toCity: "Bouaké",
    senderName: "Kouamé Yao", receiverName: "Adjoua Koné", parcelType: "electronique",
    weight: 2.5, deliveryType: "retrait_agence", amount: 4700, status: "en_transit",
    createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "d2", trackingRef: "GBX-B9C3-PL44", fromCity: "San Pédro", toCity: "Abidjan",
    senderName: "Traoré Ahmed", receiverName: "Bamba Salif", parcelType: "vetements",
    weight: 5.0, deliveryType: "livraison_domicile", amount: 5900, status: "livre",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: "d3", trackingRef: "GBX-C1E7-QR22", fromCity: "Abidjan", toCity: "Yamoussoukro",
    senderName: "Gbané Marie", receiverName: "Koné Francis", parcelType: "documents",
    weight: 0.3, deliveryType: "retrait_agence", amount: 2200, status: "en_attente",
    createdAt: new Date().toISOString() },
];

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ColisScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("tous");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isLoggedIn = !!token;

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const data = await apiFetch<Parcel[]>("/parcels", { token });
      setParcels(data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // Source: real data when logged in, demo when not
  const source = isLoggedIn ? parcels : DEMO_PARCELS;

  const filtered = source.filter((p) => {
    if (filter === "en_cours") return IN_PROGRESS.includes(p.status);
    if (filter === "livres") return p.status === "livre";
    return true;
  });

  const counts = {
    tous: source.length,
    en_cours: source.filter((p) => IN_PROGRESS.includes(p.status)).length,
    livres: source.filter((p) => p.status === "livre").length,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "tous",     label: "Tous" },
    { key: "en_cours", label: "En cours" },
    { key: "livres",   label: "Livrés" },
  ];

  const openTracking = (item: Parcel) =>
    router.push({ pathname: "/(tabs)/suivi", params: { ref: item.trackingRef } });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerTitle}>Mes colis</Text>
          <Text style={styles.headerSub}>
            {isLoggedIn && parcels.length > 0
              ? `${parcels.length} expédition${parcels.length > 1 ? "s" : ""}`
              : "Suivi de vos expéditions"}
          </Text>
        </View>
        <Pressable style={styles.sendBtn} onPress={() => router.push("/parcel/send")}>
          <Feather name="plus" size={16} color="white" />
          <Text style={styles.sendBtnText}>Envoyer</Text>
        </Pressable>
      </LinearGradient>

      {/* ── Track-by-number shortcut ── */}
      <Pressable
        style={({ pressed }) => [styles.trackBanner, pressed && { opacity: 0.9 }]}
        onPress={() => router.push("/(tabs)/suivi")}
      >
        <View style={styles.trackBannerLeft}>
          <View style={styles.trackIconBox}>
            <Feather name="search" size={16} color={Colors.light.primary} />
          </View>
          <View>
            <Text style={styles.trackBannerTitle}>Suivre un colis</Text>
            <Text style={styles.trackBannerSub}>Rechercher par numéro GBX-XXXX-XXXX</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={Colors.light.primary} />
      </Pressable>

      {/* ── Filter bar ── */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {counts[f.key]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ParcelCard
              item={item}
              onPress={() => openTracking(item)}
              demo={!isLoggedIn}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            isLoggedIn
              ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />
              : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Feather name="package" size={36} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>Aucun colis</Text>
              <Text style={styles.emptyDesc}>
                {filter !== "tous"
                  ? "Aucun colis dans cette catégorie"
                  : "Vos expéditions apparaîtront ici"}
              </Text>
              {filter !== "tous" ? (
                <Pressable style={styles.resetBtn} onPress={() => setFilter("tous")}>
                  <Text style={styles.resetBtnText}>Voir tous les colis</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.ctaBtn} onPress={() => router.push("/parcel/send")}>
                  <Feather name="plus" size={15} color="white" />
                  <Text style={styles.ctaBtnText}>Envoyer un colis</Text>
                </Pressable>
              )}
            </View>
          }
          ListFooterComponent={
            !isLoggedIn && filtered.length > 0 ? (
              <View style={styles.loginBanner}>
                <Feather name="lock" size={16} color={Colors.light.primary} />
                <Text style={styles.loginBannerText}>
                  Connectez-vous pour voir vos vrais colis
                </Text>
                <Pressable
                  style={styles.loginBannerBtn}
                  onPress={() => router.push("/(auth)/login")}
                >
                  <Text style={styles.loginBannerBtnText}>Se connecter</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  sendBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  sendBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "white" },

  // Track banner
  trackBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "white", paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
  },
  trackBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  trackIconBox: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center",
  },
  trackBannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  trackBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 1 },

  // Filter bar
  filterBar: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterScroll: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  chipActive: { backgroundColor: "#EEF2FF", borderColor: Colors.light.primary },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  chipTextActive: { color: Colors.light.primary, fontFamily: "Inter_700Bold" },
  chipBadge: {
    backgroundColor: "#E2E8F0", borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: "center",
  },
  chipBadgeActive: { backgroundColor: Colors.light.primary },
  chipBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#64748B" },
  chipBadgeTextActive: { color: "white" },

  // List
  list: { padding: 14, paddingBottom: 120 },

  // Card
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDemo: { opacity: 0.72 },
  cardStrip: { width: 4 },
  cardInner: { flex: 1, padding: 14, gap: 10 },

  // Row 1: ref + status
  row1: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  refBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  refText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: 0.4 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontFamily: "Inter_700Bold" },

  // Row 2: route
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cityFrom: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  routeMid: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 2,
  },
  routeLineFill: { flex: 1, height: 1.5, backgroundColor: "#E2E8F0" },
  cityTo: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },

  // Row 3: date + chevron
  row3: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  chevronPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
  },
  chevronPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },

  // Empty
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 12, padding: 24 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center" },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.primary, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 13, marginTop: 4,
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
  resetBtn: {
    borderWidth: 1.5, borderColor: Colors.light.primary,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, marginTop: 4,
  },
  resetBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },

  // Login banner (bottom of demo list)
  loginBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#EEF2FF", borderRadius: 16, padding: 14,
    marginTop: 12, borderWidth: 1, borderColor: "#C7D2FE",
  },
  loginBannerText: {
    flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#1E40AF",
  },
  loginBannerBtn: {
    backgroundColor: Colors.light.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  loginBannerBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "white" },
});
