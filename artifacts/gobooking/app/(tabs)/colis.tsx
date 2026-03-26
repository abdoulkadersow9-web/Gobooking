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
import { useLanguage } from "@/context/LanguageContext";
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
  paymentStatus?: string;
  createdAt: string;
}

type Filter = "tous" | "en_cours" | "livres";

const STATUS_STYLE: Record<string, { color: string; bg: string; strip: string; label: string }> = {
  en_attente:            { color: "#B45309", bg: "#FFFBEB", strip: "#F59E0B", label: "En attente" },
  en_attente_validation: { color: "#D97706", bg: "#FEF9C3", strip: "#F59E0B", label: "En validation" },
  valide:                { color: "#059669", bg: "#D1FAE5", strip: "#10B981", label: "Validé" },
  refuse:                { color: "#DC2626", bg: "#FEE2E2", strip: "#EF4444", label: "Refusé" },
  en_attente_ramassage:  { color: "#EA580C", bg: "#FFF7ED", strip: "#FB923C", label: "Ramassage" },
  ramassage_en_cours:    { color: "#EA580C", bg: "#FFF7ED", strip: "#FB923C", label: "En cours ramassage" },
  confirme:              { color: "#1D4ED8", bg: "#EFF6FF", strip: "#3B82F6", label: "Confirmé" },
  en_cours_ramassage:    { color: "#7C3AED", bg: "#F5F3FF", strip: "#8B5CF6", label: "Ramassage" },
  arrive_gare_depart:    { color: "#0E7490", bg: "#ECFEFF", strip: "#06B6D4", label: "Gare départ" },
  pris_en_charge:        { color: "#1D4ED8", bg: "#EFF6FF", strip: "#3B82F6", label: "Pris en charge" },
  en_transit:            { color: "#6D28D9", bg: "#F5F3FF", strip: "#8B5CF6", label: "En transit" },
  arrive_destination:    { color: "#D97706", bg: "#FEF3C7", strip: "#F59E0B", label: "Arrivé dest." },
  en_livraison:          { color: "#0E7490", bg: "#ECFEFF", strip: "#06B6D4", label: "En livraison" },
  livre:                 { color: "#065F46", bg: "#ECFDF5", strip: "#10B981", label: "Livré" },
  annule:                { color: "#991B1B", bg: "#FEF2F2", strip: "#EF4444", label: "Annulé" },
};

const IN_PROGRESS = ["en_attente", "confirme", "en_cours_ramassage", "arrive_gare_depart", "pris_en_charge", "en_transit", "arrive_destination", "en_livraison"];

const DEMO_PARCELS: Parcel[] = [
  { id: "d1", trackingRef: "GBX-A4F2-KM91", fromCity: "Abidjan", toCity: "Bouaké",
    senderName: "Kouamé Yao", receiverName: "Adjoua Koné", parcelType: "electronique",
    weight: 2.5, deliveryType: "retrait_agence", amount: 4700, status: "en_transit",
    paymentStatus: "paid", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "d2", trackingRef: "GBX-B9C3-PL44", fromCity: "San Pédro", toCity: "Abidjan",
    senderName: "Traoré Ahmed", receiverName: "Bamba Salif", parcelType: "vetements",
    weight: 5.0, deliveryType: "livraison_domicile", amount: 5900, status: "livre",
    paymentStatus: "paid", createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: "d3", trackingRef: "GBX-C1E7-QR22", fromCity: "Abidjan", toCity: "Yamoussoukro",
    senderName: "Gbané Marie", receiverName: "Koné Francis", parcelType: "documents",
    weight: 0.3, deliveryType: "retrait_agence", amount: 2200, status: "en_attente",
    paymentStatus: "pending", createdAt: new Date().toISOString() },
  { id: "d4", trackingRef: "GBX-D5F8-MN33", fromCity: "Abidjan", toCity: "Korhogo",
    senderName: "Ouattara Paul", receiverName: "Diomandé Cissé", parcelType: "alimentaire",
    weight: 8.0, deliveryType: "retrait_agence", amount: 8200, status: "pris_en_charge",
    paymentStatus: "paid", createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: "d5", trackingRef: "GBX-E2A1-ZP77", fromCity: "Man", toCity: "Abidjan",
    senderName: "Bamba Seydou", receiverName: "Coulibaly Awa", parcelType: "cosmetique",
    weight: 1.2, deliveryType: "livraison_domicile", amount: 3500, status: "en_livraison",
    paymentStatus: "pending", createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
];

function formatDate(iso: string, lang: string) {
  try {
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return "—"; }
}

function ParcelRow({ item, onPress }: { item: Parcel; onPress: () => void }) {
  const { t, lang } = useLanguage();
  const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.en_attente;
  const statusLabels: Record<string, string> = {
    en_attente:          t.statusEnAttente   ?? "En attente",
    confirme:            "Confirmé",
    en_cours_ramassage:  "Ramassage",
    arrive_gare_depart:  "Gare départ",
    pris_en_charge:      t.statusPrisEnCharge ?? "Pris en charge",
    en_transit:          t.statusEnTransit   ?? "En transit",
    arrive_destination:  "Arrivé dest.",
    en_livraison:        t.statusEnLivraison  ?? "En livraison",
    livre:               t.statusLivre        ?? "Livré",
    annule:              t.statusAnnule       ?? "Annulé",
  };
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
            <Text style={[styles.badgeText, { color: st.color }]}>
              {statusLabels[item.status] ?? t.statusEnAttente}
            </Text>
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

        {/* Montant + statut paiement + action */}
        <View style={styles.rowBottom}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[
              styles.payPill,
              { backgroundColor: item.paymentStatus === "paid" ? "#ECFDF5" : "#FFFBEB" }
            ]}>
              <Feather
                name={item.paymentStatus === "paid" ? "check-circle" : "alert-circle"}
                size={10}
                color={item.paymentStatus === "paid" ? "#059669" : "#D97706"}
              />
              <Text style={[styles.payPillText, { color: item.paymentStatus === "paid" ? "#059669" : "#D97706" }]}>
                {item.paymentStatus === "paid" ? "Payé" : "Paiement requis"}
              </Text>
            </View>
            <Text style={styles.amountText}>{(item.amount ?? 0).toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.detailBtn}>
            <Text style={styles.detailBtnText}>{t.suivre}</Text>
            <Feather name="chevron-right" size={13} color="white" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ColisScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLanguage();
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

  // Use real data when logged in, demo data when not
  const source = token ? parcels : DEMO_PARCELS;

  const filtered = source.filter((p) => {
    if (filter === "en_cours") return IN_PROGRESS.includes(p.status);
    if (filter === "livres")   return p.status === "livre";
    return true;
  });

  const counts = {
    tous:     source.length,
    en_cours: source.filter((p) => IN_PROGRESS.includes(p.status)).length,
    livres:   source.filter((p) => p.status === "livre").length,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "tous",     label: t.tous },
    { key: "en_cours", label: t.enCours },
    { key: "livres",   label: t.livres },
  ];

  const openSuivi = (item: Parcel) =>
    router.push({ pathname: "/client/colis-suivi", params: { ref: item.trackingRef } });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t.mesColis}</Text>
          {!loading && token && parcels.length > 0 && (
            <Text style={styles.headerSub}>
              {parcels.length} {parcels.length > 1 ? t.expeditionsPlural : t.expeditions}
            </Text>
          )}
          {(!token || parcels.length === 0) && (
            <Text style={styles.headerSub}>{t.suiviExpeditions}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => router.push("/parcel/send")}
        >
          <Feather name="plus" size={16} color="white" />
          <Text style={styles.sendBtnText}>{t.envoyer}</Text>
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
      {loading && token ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>{t.chargement}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ParcelRow item={item} onPress={() => openSuivi(item)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            token
              ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />
              : undefined
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Feather name="package" size={34} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t.aucunResultat}</Text>
              <Text style={styles.emptyDesc}>{t.aucunColisCategorie}</Text>
              <TouchableOpacity style={styles.resetBtn} onPress={() => setFilter("tous")}>
                <Text style={styles.resetBtnText}>{t.voirTousLesColis}</Text>
              </TouchableOpacity>
            </View>
          }
          ListHeaderComponent={
            token ? (
              <TouchableOpacity
                style={styles.remoteBanner}
                activeOpacity={0.85}
                onPress={() => router.push("/client/colis-distance" as never)}
              >
                <View style={styles.remoteBannerIcon}>
                  <Text style={{ fontSize: 28 }}>📷</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.remoteBannerTitle}>Déposer à distance</Text>
                  <Text style={styles.remoteBannerSub}>Photographiez votre colis, nous validons pour vous</Text>
                </View>
                <Feather name="arrow-right" size={18} color="#0E7490" />
              </TouchableOpacity>
            ) : null
          }
          ListFooterComponent={
            !token ? (
              <TouchableOpacity
                style={styles.loginBanner}
                activeOpacity={0.85}
                onPress={() => router.push("/(auth)/login")}
              >
                <Feather name="lock" size={15} color={Colors.light.primary} />
                <Text style={styles.loginBannerText}>{t.connectezVous}</Text>
                <View style={styles.loginBannerBtn}>
                  <Text style={styles.loginBannerBtnText}>{t.seConnecter} →</Text>
                </View>
              </TouchableOpacity>
            ) : null
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

  list: { padding: 16, paddingTop: 12, paddingBottom: 130 },
  listEmpty: { flex: 1 },

  row: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#0B3C5D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  strip: { width: 5 },
  rowBody: { flex: 1, padding: 16, gap: 10 },

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
  payPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  payPillText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  amountText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  detailBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.light.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  detailBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "white" },

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

  loginBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#EEF2FF", borderRadius: 16,
    padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  loginBannerText: {
    flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#1E40AF",
  },
  loginBannerBtn: {
    backgroundColor: Colors.light.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  loginBannerBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "white" },

  remoteBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#ECFEFF", borderRadius: 14,
    padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: "#A5F3FC",
  },
  remoteBannerIcon: {
    width: 50, height: 50, borderRadius: 14, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#A5F3FC",
  },
  remoteBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0E7490" },
  remoteBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#06B6D4", marginTop: 2 },
});
