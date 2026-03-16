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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  en_attente:    { label: "Enregistré",    color: "#D97706", bg: "#FFFBEB", icon: "clock" },
  pris_en_charge:{ label: "En agence",     color: Colors.light.primary, bg: "#EEF2FF", icon: "home" },
  en_transit:    { label: "En transit",    color: "#7C3AED", bg: "#F5F3FF", icon: "truck" },
  en_livraison:  { label: "En livraison",  color: "#0891B2", bg: "#ECFEFF", icon: "map-pin" },
  livre:         { label: "Livré",         color: "#059669", bg: "#ECFDF5", icon: "check-circle" },
  annule:        { label: "Annulé",        color: "#EF4444", bg: "#FEF2F2", icon: "x-circle" },
};

const TYPE_LABELS: Record<string, string> = {
  documents: "Documents", vetements: "Vêtements", electronique: "Électronique",
  alimentaire: "Alimentaire", cosmetique: "Cosmétique", autre: "Autre",
};

const IN_PROGRESS_STATUSES = ["en_attente", "pris_en_charge", "en_transit", "en_livraison"];
const DONE_STATUSES = ["livre"];

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function ParcelCard({ item, onPress }: { item: Parcel; onPress: () => void }) {
  const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.en_attente;
  const isLivred = item.status === "livre";
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
      onPress={onPress}
    >
      {/* Top row: icon + route + status */}
      <View style={styles.cardTop}>
        <View style={[styles.cardIconBox, { backgroundColor: st.bg }]}>
          <Feather name={st.icon as never} size={18} color={st.color} />
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.routeRow}>
            <Text style={styles.cityText}>{item.fromCity}</Text>
            <View style={styles.routeArrow}>
              <View style={styles.routeDotGreen} />
              <View style={styles.routeLine} />
              <Feather name="chevron-right" size={12} color="#94A3B8" />
              <View style={styles.routeDotRed} />
            </View>
            <Text style={styles.cityText}>{item.toCity}</Text>
          </View>
          <Text style={styles.refText}>{item.trackingRef}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom row: date + amount + chevron */}
      <View style={styles.cardBottom}>
        <View style={styles.cardBottomLeft}>
          <View style={styles.bottomItem}>
            <Feather name="calendar" size={11} color="#94A3B8" />
            <Text style={styles.bottomText}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={styles.bottomItem}>
            <Feather name="box" size={11} color="#94A3B8" />
            <Text style={styles.bottomText}>
              {TYPE_LABELS[item.parcelType] || item.parcelType} · {item.weight} kg
            </Text>
          </View>
        </View>

        <View style={styles.cardBottomRight}>
          <Text style={[styles.amountText, { color: isLivred ? "#059669" : Colors.light.primary }]}>
            {item.amount.toLocaleString()} FCFA
          </Text>
          <View style={styles.trackChip}>
            <Text style={styles.trackChipText}>Suivre</Text>
            <Feather name="arrow-right" size={11} color={Colors.light.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function ColisScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("tous");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

  const filtered = parcels.filter((p) => {
    if (filter === "en_cours") return IN_PROGRESS_STATUSES.includes(p.status);
    if (filter === "livres") return DONE_STATUSES.includes(p.status);
    return true;
  });

  // Counts for filter badges
  const counts = {
    tous: parcels.length,
    en_cours: parcels.filter((p) => IN_PROGRESS_STATUSES.includes(p.status)).length,
    livres: parcels.filter((p) => DONE_STATUSES.includes(p.status)).length,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "tous",    label: "Tous" },
    { key: "en_cours",label: "En cours" },
    { key: "livres",  label: "Livrés" },
  ];

  const openTracking = (item: Parcel) => {
    router.push({ pathname: "/(tabs)/suivi", params: { ref: item.trackingRef } });
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mes colis</Text>
          <Text style={styles.headerSub}>
            {parcels.length > 0 ? `${parcels.length} expédition${parcels.length > 1 ? "s" : ""}` : "Suivi de vos expéditions"}
          </Text>
        </View>
        <Pressable style={styles.sendBtn} onPress={() => router.push("/parcel/send")}>
          <Feather name="plus" size={16} color="white" />
          <Text style={styles.sendBtnText}>Envoyer</Text>
        </Pressable>
      </LinearGradient>

      {/* Track-a-parcel shortcut */}
      <Pressable
        style={({ pressed }) => [styles.trackBanner, pressed && { opacity: 0.9 }]}
        onPress={() => router.push("/(tabs)/suivi")}
      >
        <View style={styles.trackBannerLeft}>
          <View style={styles.trackBannerIcon}>
            <Feather name="search" size={17} color={Colors.light.primary} />
          </View>
          <View>
            <Text style={styles.trackBannerTitle}>Suivre un colis</Text>
            <Text style={styles.trackBannerSub}>Entrez un numéro GBX-XXXX-XXXX</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={Colors.light.primary} />
      </Pressable>

      {/* Filter tabs */}
      {token && !loading && parcels.length > 0 && (
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                  {counts[f.key] > 0 && (
                    <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                      <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                        {counts[f.key]}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : !token ? (
        <View style={styles.center}>
          <View style={styles.emptyIconBox}>
            <Feather name="lock" size={36} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyDesc}>Connectez-vous pour voir vos colis</Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconBox}>
            <Feather name="package" size={36} color={Colors.light.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {parcels.length === 0 ? "Aucun colis" : "Aucun résultat"}
          </Text>
          <Text style={styles.emptyDesc}>
            {parcels.length === 0
              ? "Vos envois de colis apparaîtront ici"
              : "Aucun colis dans cette catégorie"}
          </Text>
          {parcels.length === 0 && (
            <Pressable style={styles.ctaBtn} onPress={() => router.push("/parcel/send")}>
              <Feather name="plus" size={16} color="white" />
              <Text style={styles.ctaBtnText}>Envoyer un colis</Text>
            </Pressable>
          )}
          {parcels.length > 0 && (
            <Pressable style={styles.resetFilterBtn} onPress={() => setFilter("tous")}>
              <Text style={styles.resetFilterText}>Voir tous les colis</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ParcelCard item={item} onPress={() => openTracking(item)} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
    backgroundColor: "white", paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: "#E2E8F0", gap: 12,
  },
  trackBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  trackBannerIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center",
  },
  trackBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  trackBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 1 },

  // Filter row
  filterRow: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterScroll: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: Colors.light.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
  },
  filterChipTextActive: {
    color: Colors.light.primary,
    fontFamily: "Inter_700Bold",
  },
  filterBadge: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: Colors.light.primary,
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#64748B",
  },
  filterBadgeTextActive: {
    color: "white",
  },

  // List
  listContent: {
    padding: 14,
    paddingBottom: 120,
  },

  // Parcel card
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  cardMeta: {
    flex: 1,
    gap: 3,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cityText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  routeArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  routeDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    flexShrink: 0,
  },
  routeLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#E2E8F0",
  },
  routeDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
    flexShrink: 0,
  },
  refText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexShrink: 0,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },

  // Card bottom
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 14,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  cardBottomLeft: {
    flex: 1,
    gap: 4,
  },
  bottomItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  bottomText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  cardBottomRight: {
    alignItems: "flex-end",
    gap: 5,
    flexShrink: 0,
  },
  amountText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  trackChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trackChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },

  // Empty / center states
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  emptyIconBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center" },
  loginBtn: {
    backgroundColor: Colors.light.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  loginBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.primary, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 13, marginTop: 8,
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
  resetFilterBtn: {
    borderWidth: 1.5, borderColor: Colors.light.primary, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 11, marginTop: 8,
  },
  resetFilterText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
});
