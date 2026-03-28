import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { SkeletonParcelCard } from "@/components/SkeletonCard";
import { Toast, useToast } from "@/components/Toast";

const _ws = (css: string): any => Platform.OS === "web" ? { boxShadow: css } : {};

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
  confirme:              { color: "#1650D0", bg: "#EEF4FF", strip: "#1650D0", label: "Confirmé" },
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

// ─── Timeline helpers ──────────────────────────────────────────────────────
const TL_STEPS = [
  { key: "expedie",   label: "Expédié",   icon: "package"       as const },
  { key: "en_route",  label: "En route",  icon: "truck"         as const },
  { key: "livraison", label: "Livraison", icon: "map-pin"       as const },
  { key: "livre",     label: "Livré",     icon: "check-circle"  as const },
];

function getStep(status: string): number {
  if (status === "livre") return 3;
  if (["arrive_destination", "en_livraison"].includes(status)) return 2;
  if (["arrive_gare_depart", "pris_en_charge", "en_transit"].includes(status)) return 1;
  if (["annule", "refuse"].includes(status)) return -1;
  return 0;
}

function ParcelTimeline({ status }: { status: string }) {
  const step = getStep(status);
  const dotAnims = useRef(TL_STEPS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      100,
      dotAnims.map(a => Animated.spring(a, { toValue: 1, speed: 20, bounciness: 7, useNativeDriver: true }))
    ).start();
  }, []);

  if (step === -1) {
    return (
      <View style={tl.cancelRow}>
        <Feather name="x-circle" size={11} color="#DC2626" />
        <Text style={tl.cancelText}>Envoi annulé</Text>
      </View>
    );
  }
  return (
    <View style={tl.row}>
      {TL_STEPS.map((s, i) => {
        const done   = i <= step;
        const active = i === step;
        return (
          <React.Fragment key={s.key}>
            <View style={tl.step}>
              <Animated.View style={[tl.dot, done && tl.dotDone, active && tl.dotActive, { transform: [{ scale: dotAnims[i] }] }]}>
                <Feather name={done ? s.icon : "circle"} size={done ? 9 : 7} color={done ? "white" : "#CBD5E1"} />
              </Animated.View>
              <Animated.Text style={[tl.label, done && tl.labelDone, active && tl.labelActive, { opacity: dotAnims[i] }]}>
                {s.label}
              </Animated.Text>
            </View>
            {i < TL_STEPS.length - 1 && (
              <View style={[tl.line, i < step && tl.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const tl = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "flex-start", paddingVertical: 4 },
  step:       { alignItems: "center", width: 54 },
  dot:        { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "#CBD5E1", backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  dotDone:    { backgroundColor: "#1650D0", borderColor: "#1650D0" },
  dotActive:  { borderWidth: 2.5, borderColor: "#1650D0" },
  label:      { fontSize: 9, fontFamily: "Inter_500Medium", color: "#94A3B8", marginTop: 5, textAlign: "center" },
  labelDone:  { color: "#1650D0", fontFamily: "Inter_600SemiBold" },
  labelActive:{ fontFamily: "Inter_700Bold" },
  line:       { flex: 1, height: 2, backgroundColor: "#E2E8F0", marginTop: 11 },
  lineDone:   { backgroundColor: "#1650D0" },
  cancelRow:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  cancelText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
});

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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.city} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.fromCity}</Text>
          </View>
          <View style={styles.routeConnector}>
            <View style={styles.routeDash} />
            <Feather name="arrow-right" size={14} color={Colors.light.primary} />
            <View style={styles.routeDash} />
          </View>
          <View style={{ flex: 1, alignItems: "flex-end", minWidth: 0 }}>
            <Text style={styles.city} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.toCity}</Text>
          </View>
        </View>

        {/* Timeline livraison */}
        <ParcelTimeline status={item.status} />

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

function AnimatedParcelRow({ item, index, onPress }: { item: Parcel; index: number; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: Math.min(index * 70, 350),
      speed: 14,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
    }}>
      <ParcelRow item={item} onPress={onPress} />
    </Animated.View>
  );
}

export default function ColisScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLanguage();
  const topPad = Platform.OS === "web" ? 24 : insets.top;

  const [parcels,    setParcels]    = useState<Parcel[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<Filter>("tous");
  const [netError,   setNetError]   = useState(false);
  const { toast } = useToast();

  const headerAnim = useRef(new Animated.Value(0)).current;
  const filterAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.stagger(70, [
      Animated.spring(headerAnim, { toValue: 1, speed: 18, bounciness: 2, useNativeDriver: true }),
      Animated.spring(filterAnim, { toValue: 1, speed: 16, bounciness: 3, useNativeDriver: true }),
    ]).start();
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<Parcel[]>("/parcels", { token });
      setParcels(data ?? []);
      setNetError(false);
    } catch {
      if (!silent) setNetError(true);
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const onRefresh = () => { setRefreshing(true); load(true); };

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
    <View style={styles.container}>
      {/* Toast */}
      <Toast {...toast} />

      {/* Header */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
      }}>
        <LinearGradient
          colors={["#1650D0", "#1030B4", "#0A1C84"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: topPad + 22 }]}
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
      </Animated.View>

      {/* Filter bar */}
      <Animated.View style={[styles.filterBar, {
        opacity: filterAnim,
        transform: [{ translateY: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }]}>
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
      </Animated.View>

      {/* Network error banner */}
      {netError && !loading && token && (
        <TouchableOpacity
          style={styles.errorBanner}
          activeOpacity={0.8}
          onPress={() => { setNetError(false); load(); }}
        >
          <Feather name="wifi-off" size={14} color="#DC2626" />
          <Text style={styles.errorBannerText}>Connexion impossible — Appuyez pour réessayer</Text>
          <Feather name="refresh-cw" size={13} color="#DC2626" />
        </TouchableOpacity>
      )}

      {/* Body */}
      {loading && token ? (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
          {[0, 1, 2, 3].map(i => <SkeletonParcelCard key={i} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <AnimatedParcelRow item={item} index={index} onPress={() => openSuivi(item)} />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
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
                  <Feather name="camera" size={26} color="#0E7490" />
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
  container: { flex: 1, backgroundColor: Colors.light.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 4 },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sendBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "white" },

  filterBar: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEEF8",
  },
  filterScroll: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F4F6FF",
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

  list: { padding: 20, paddingTop: 16, paddingBottom: 130 },
  listEmpty: { flex: 1 },

  row: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#1650D0",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#E8ECFA",
    marginBottom: 2,
    ..._ws("0 6px 18px rgba(22,80,208,0.08)"),
  },
  strip: { width: 5 },
  rowBody: { flex: 1, padding: 18, gap: 14 },

  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  refRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  refText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#475569", letterSpacing: 0.8 },
  badge: { borderRadius: 22, paddingHorizontal: 13, paddingVertical: 7 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  city: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -0.4 },
  routeConnector: { width: 60, flexDirection: "row", alignItems: "center", gap: 3 },
  routeDash: { flex: 1, height: 2, backgroundColor: "#E2E8F0" },

  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  payPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 22,
  },
  payPillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  amountText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  detailBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.light.primary, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  detailBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "white" },

  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: 32 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -0.3 },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center", lineHeight: 20 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 8 },
  loginBtn: {
    backgroundColor: Colors.light.primary, borderRadius: 16,
    paddingHorizontal: 30, paddingVertical: 15, marginTop: 6,
  },
  loginBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 13, marginTop: 4,
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    ..._ws("0 4px 8px rgba(22,80,208,0.30)"),
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
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#ECFEFF", borderRadius: 20,
    padding: 16, marginBottom: 16,
    borderWidth: 1.5, borderColor: "#A5F3FC",
    shadowColor: "#0E7490", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
    ..._ws("0 4px 12px rgba(14,116,144,0.08)"),
  },
  remoteBannerIcon: {
    width: 54, height: 54, borderRadius: 16, backgroundColor: "white",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#A5F3FC",
  },
  remoteBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0E7490", letterSpacing: -0.2 },
  remoteBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#06B6D4", marginTop: 3, lineHeight: 18 },

  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 12, marginHorizontal: 18, marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626" },
});
