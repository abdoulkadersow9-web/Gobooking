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
  TouchableOpacity,
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

const STATUS: Record<string, { label: string; color: string; bg: string; strip: string }> = {
  en_attente:     { label: "Colis enregistré", color: "#B45309", bg: "#FFFBEB", strip: "#F59E0B" },
  pris_en_charge: { label: "Reçu en agence",   color: "#1D4ED8", bg: "#EFF6FF", strip: "#3B82F6" },
  en_transit:     { label: "En transit",        color: "#6D28D9", bg: "#F5F3FF", strip: "#8B5CF6" },
  en_livraison:   { label: "En livraison",      color: "#0E7490", bg: "#ECFEFF", strip: "#06B6D4" },
  livre:          { label: "Livré",             color: "#065F46", bg: "#ECFDF5", strip: "#10B981" },
  annule:         { label: "Annulé",            color: "#991B1B", bg: "#FEF2F2", strip: "#EF4444" },
};

const IN_PROGRESS = ["en_attente", "pris_en_charge", "en_transit", "en_livraison"];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return "—"; }
}

function ParcelRow({ item, onPress }: { item: Parcel; onPress: () => void }) {
  const st = STATUS[item.status] ?? STATUS.en_attente;
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.strip, { backgroundColor: st.strip }]} />
      <View style={styles.rowBody}>
        {/* Tracking number + status */}
        <View style={styles.rowTop}>
          <View style={styles.refRow}>
            <Feather name="hash" size={12} color="#94A3B8" />
            <Text style={styles.refText}>{item.trackingRef}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeRow}>
          <Text style={styles.city}>{item.fromCity}</Text>
          <View style={styles.routeConnector}>
            <View style={styles.routeDash} />
            <Feather name="arrow-right" size={14} color={Colors.light.primary} />
            <View style={styles.routeDash} />
          </View>
          <Text style={styles.city}>{item.toCity}</Text>
        </View>

        {/* Date + action */}
        <View style={styles.rowBottom}>
          <View style={styles.dateRow}>
            <Feather name="calendar" size={11} color="#94A3B8" />
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={styles.detailBtn}>
            <Text style={styles.detailBtnText}>Suivre</Text>
            <Feather name="chevron-right" size={13} color={Colors.light.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ColisScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("tous");

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
    if (filter === "en_cours") return IN_PROGRESS.includes(p.status);
    if (filter === "livres")   return p.status === "livre";
    return true;
  });

  const counts = {
    tous:     parcels.length,
    en_cours: parcels.filter((p) => IN_PROGRESS.includes(p.status)).length,
    livres:   parcels.filter((p) => p.status === "livre").length,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "tous",     label: "Tous" },
    { key: "en_cours", label: "En cours" },
    { key: "livres",   label: "Livrés" },
  ];

  const openSuivi = (item: Parcel) =>
    router.push({ pathname: "/(tabs)/suivi", params: { ref: item.trackingRef } });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Mes colis</Text>
          {!loading && token && parcels.length > 0 && (
            <Text style={styles.headerSub}>
              {parcels.length} expédition{parcels.length > 1 ? "s" : ""}
            </Text>
          )}
          {(!token || parcels.length === 0) && (
            <Text style={styles.headerSub}>Suivi de vos expéditions</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => router.push("/parcel/send")}
        >
          <Feather name="plus" size={16} color="white" />
          <Text style={styles.sendBtnText}>Envoyer</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Filter bar */}
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
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {f.label}
                </Text>
                <View style={[styles.chipCount, active && styles.chipCountActive]}>
                  <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>
                    {counts[f.key]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Body */}
      {!token ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Feather name="lock" size={34} color={Colors.light.primary} />
          </View>
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyDesc}>Connectez-vous pour voir vos colis</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ParcelRow item={item} onPress={() => openSuivi(item)} />
          )}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Feather name="package" size={34} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {parcels.length === 0 ? "Aucun colis" : "Aucun résultat"}
              </Text>
              <Text style={styles.emptyDesc}>
                {parcels.length === 0
                  ? "Vos envois apparaîtront ici"
                  : "Aucun colis dans cette catégorie"}
              </Text>
              {parcels.length === 0 ? (
                <TouchableOpacity
                  style={styles.ctaBtn}
                  onPress={() => router.push("/parcel/send")}
                >
                  <Feather name="plus" size={15} color="white" />
                  <Text style={styles.ctaBtnText}>Envoyer un colis</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => setFilter("tous")}
                >
                  <Text style={styles.resetBtnText}>Voir tous les colis</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.72)", marginTop: 2 },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sendBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "white" },

  filterBar: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterScroll: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  chipActive: {
    borderColor: Colors.light.primary,
    backgroundColor: "#EEF2FF",
  },
  chipLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  chipLabelActive: { color: Colors.light.primary, fontFamily: "Inter_700Bold" },
  chipCount: {
    minWidth: 20, height: 18, borderRadius: 9,
    backgroundColor: "#E2E8F0",
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 5,
  },
  chipCountActive: { backgroundColor: Colors.light.primary },
  chipCountText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#64748B" },
  chipCountTextActive: { color: "white" },

  list: { padding: 16, paddingBottom: 120 },
  listEmpty: { flex: 1 },

  row: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  strip: { width: 5 },
  rowBody: { flex: 1, padding: 14, gap: 9 },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  refRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  refText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#475569", letterSpacing: 0.5 },
  badge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },

  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  city: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A" },
  routeConnector: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  routeDash: { flex: 1, height: 1.5, backgroundColor: "#E2E8F0" },

  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  detailBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#EEF2FF", borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  detailBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },

  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center" },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 8 },
  loginBtn: {
    backgroundColor: Colors.light.primary, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 13, marginTop: 4,
  },
  loginBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 13, marginTop: 4,
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
  resetBtn: {
    borderWidth: 1.5, borderColor: Colors.light.primary,
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4,
  },
  resetBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
});
