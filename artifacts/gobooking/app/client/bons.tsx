import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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

const _ws = (css: string): any => Platform.OS === "web" ? { boxShadow: css } : {};

interface WalletData {
  walletBalance: number;
  referralCode: string;
  loyalty: string;
  totalTrips: number;
}
interface BonBooking {
  id: string;
  bookingRef: string;
  totalAmount: number;
  createdAt: string;
  trip?: { from: string; to: string; date: string; departureTime: string } | null;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function SkeletonBlock({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  const anim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: "#E8ECF4", opacity: anim }} />
  );
}

function SkeletonBonCard() {
  return (
    <View style={[styles.bonCard, { gap: 14 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <SkeletonBlock w={80} h={20} r={6} />
        <SkeletonBlock w={70} h={20} r={10} />
      </View>
      <SkeletonBlock w="70%" h={16} r={6} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <SkeletonBlock w={90} h={14} r={6} />
        <SkeletonBlock w={70} h={20} r={6} />
      </View>
    </View>
  );
}

export default function MesBonsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const { token, user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [bons, setBons] = useState<BonBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [walletData, bookingsData] = await Promise.all([
        apiFetch<WalletData>("/growth/wallet", { token }),
        apiFetch<any[]>("/bookings", { token }),
      ]);
      setWallet(walletData);
      setBons((bookingsData ?? []).filter((b: any) =>
        b.status === "bon_emis" || b.status === "bon émis"
      ));
      Animated.spring(fadeAnim, { toValue: 1, speed: 14, bounciness: 2, useNativeDriver: true }).start();
    } catch {
      Animated.spring(fadeAnim, { toValue: 1, speed: 14, bounciness: 2, useNativeDriver: true }).start();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const balance = wallet?.walletBalance ?? user?.walletBalance ?? 0;

  const LOYALTY_COLOR: Record<string, string> = {
    Bronze: "#92400E", Silver: "#64748B", Gold: "#B45309", Platinum: "#0E7490", Diamond: "#6D28D9",
  };
  const loyaltyLevel = wallet?.loyalty ?? "Bronze";
  const loyaltyColor = LOYALTY_COLOR[loyaltyLevel] ?? "#1650D0";

  return (
    <View style={styles.container}>
      {/* Header gradient */}
      <LinearGradient
        colors={["#1650D0", "#1030B4", "#0A1C84"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backBtn}
            onPress={() => { Haptics.selectionAsync(); router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings" as never); }}
          >
            <Feather name="arrow-left" size={18} color="white" />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle}>Mes bons de voyage</Text>
            <Text style={styles.headerSub}>Crédit & avantages fidélité</Text>
          </View>
        </View>

        {/* Balance pill in header */}
        <View style={styles.balancePill}>
          <View style={styles.balancePillIcon}>
            <Feather name="credit-card" size={16} color={Colors.light.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.balancePillLabel}>Crédit disponible</Text>
            <Text style={styles.balancePillAmount}>{(balance ?? 0).toLocaleString()} FCFA</Text>
          </View>
          {wallet && (
            <View style={[styles.loyaltyTag, { backgroundColor: loyaltyColor + "22", borderColor: loyaltyColor + "55" }]}>
              <Feather name="star" size={11} color={loyaltyColor} />
              <Text style={[styles.loyaltyTagText, { color: loyaltyColor }]}>{loyaltyLevel}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          token
            ? <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.light.primary} />
            : undefined
        }
      >
        {/* How to use */}
        <Animated.View style={{ opacity: loading ? 1 : fadeAnim }}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Feather name="info" size={16} color={Colors.light.primary} />
              </View>
              <Text style={styles.cardTitle}>Comment utiliser vos bons</Text>
            </View>
            {[
              { n: "1", text: "Réservez un trajet depuis l'onglet Accueil" },
              { n: "2", text: "Au paiement, choisissez « Payer avec mon crédit »" },
              { n: "3", text: "Le montant est déduit de votre solde automatiquement" },
              { n: "4", text: "Parrainez vos amis pour gagner 500 FCFA par inscription" },
            ].map((step, i) => (
              <View key={i} style={[styles.step, i === 3 && { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.n}</Text>
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Bons list */}
        <View>
          <Text style={styles.sectionTitle}>
            Bons émis {!loading && `(${bons.length})`}
          </Text>

          {loading ? (
            <View style={{ gap: 14 }}>
              <SkeletonBonCard />
              <SkeletonBonCard />
            </View>
          ) : !token ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Feather name="lock" size={30} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>Connexion requise</Text>
              <Text style={styles.emptySub}>Connectez-vous pour voir vos bons de voyage</Text>
              <Pressable style={styles.ctaBtn} onPress={() => router.push("/(auth)/login")}>
                <Feather name="log-in" size={15} color="white" />
                <Text style={styles.ctaBtnText}>Se connecter</Text>
              </Pressable>
            </View>
          ) : bons.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Feather name="gift" size={30} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>Aucun bon émis</Text>
              <Text style={styles.emptySub}>
                Après un voyage payé, demandez un bon depuis vos réservations.
              </Text>
              <Pressable
                style={styles.ctaBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/(tabs)/bookings"); }}
              >
                <Feather name="bookmark" size={15} color="white" />
                <Text style={styles.ctaBtnText}>Voir mes réservations</Text>
              </Pressable>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim, gap: 14 }}>
              {bons.map((bon) => (
                <View key={bon.id} style={styles.bonCard}>
                  {/* Color strip */}
                  <View style={styles.bonStrip} />
                  <View style={styles.bonBody}>
                    <View style={styles.bonTop}>
                      <View style={styles.bonRefBadge}>
                        <Feather name="hash" size={10} color="#1D4ED8" />
                        <Text style={styles.bonRef}>{bon.bookingRef}</Text>
                      </View>
                      <View style={styles.bonStatusBadge}>
                        <Feather name="gift" size={10} color="#6D28D9" />
                        <Text style={styles.bonStatusText}>Bon émis</Text>
                      </View>
                    </View>

                    {bon.trip && (
                      <View style={styles.bonRouteRow}>
                        <Text style={styles.bonCity} numberOfLines={1}>{bon.trip.from}</Text>
                        <View style={styles.bonArrow}>
                          <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                        </View>
                        <Text style={[styles.bonCity, { color: Colors.light.primary }]} numberOfLines={1}>{bon.trip.to}</Text>
                      </View>
                    )}
                    {bon.trip && (
                      <View style={styles.bonMeta}>
                        <Feather name="calendar" size={11} color="#94A3B8" />
                        <Text style={styles.bonMetaText}>{bon.trip.date} · {bon.trip.departureTime}</Text>
                      </View>
                    )}

                    <View style={styles.bonFooter}>
                      <Text style={styles.bonDate}>Émis le {formatDate(bon.createdAt)}</Text>
                      <Text style={styles.bonAmount}>{(bon.totalAmount ?? 0).toLocaleString()} FCFA</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}
        </View>

        {/* Loyalty tips (when wallet loaded) */}
        {wallet && !loading && (
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: "#ECFDF5" }]}>
                <Feather name="trending-up" size={16} color="#059669" />
              </View>
              <Text style={styles.cardTitle}>Votre fidélité</Text>
            </View>
            <View style={styles.tipRow}>
              <Feather name="award" size={13} color="#059669" />
              <Text style={styles.tipText}>{wallet.totalTrips} voyage{wallet.totalTrips !== 1 ? "s" : ""} effectué{wallet.totalTrips !== 1 ? "s" : ""}</Text>
            </View>
            {wallet.referralCode ? (
              <View style={styles.tipRow}>
                <Feather name="share-2" size={13} color={Colors.light.primary} />
                <Text style={styles.tipText}>
                  Code parrainage :{" "}
                  <Text style={{ fontFamily: "Inter_700Bold", color: Colors.light.primary }}>{wallet.referralCode}</Text>
                </Text>
              </View>
            ) : null}
            <View style={[styles.tipRow, { borderBottomWidth: 0 }]}>
              <Feather name="info" size={13} color="#D97706" />
              <Text style={styles.tipText}>Parrainez vos amis → +500 FCFA par inscription réussie</Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
    flexShrink: 0,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "white", letterSpacing: -0.4 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 3 },

  balancePill: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "white", borderRadius: 20, padding: 18,
    ..._ws("0 8px 24px rgba(0,0,0,0.18)"),
  },
  balancePillIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center",
    flexShrink: 0,
  },
  balancePillLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#7A8FAA", marginBottom: 2 },
  balancePillAmount: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -0.6 },
  loyaltyTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, flexShrink: 0,
  },
  loyaltyTagText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  sectionTitle: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#64748B",
    textTransform: "uppercase", letterSpacing: 1.0, marginBottom: 14,
  },

  card: {
    backgroundColor: "white", borderRadius: 22, padding: 20,
    borderWidth: 1, borderColor: "#E8ECFA",
    shadowColor: "#1650D0", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 18, elevation: 5,
    ..._ws("0 6px 18px rgba(22,80,208,0.08)"),
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  cardIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A", flex: 1 },

  step: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    paddingBottom: 14, marginBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#C7D9FF", flexShrink: 0,
  },
  stepNumText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.light.primary },
  stepText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569", flex: 1, lineHeight: 20 },

  emptyCard: {
    backgroundColor: "white", borderRadius: 22, padding: 32,
    alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: "#E8ECFA",
    ..._ws("0 6px 18px rgba(22,80,208,0.08)"),
  },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#C7D9FF", marginBottom: 6,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -0.3 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", lineHeight: 20 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.primary, borderRadius: 16,
    paddingHorizontal: 22, paddingVertical: 13, marginTop: 8,
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 12, elevation: 5,
    ..._ws("0 4px 12px rgba(22,80,208,0.30)"),
  },
  ctaBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },

  bonCard: {
    flexDirection: "row", backgroundColor: "white", borderRadius: 22,
    overflow: "hidden", borderWidth: 1, borderColor: "#E8ECFA",
    shadowColor: "#1650D0", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09, shadowRadius: 18, elevation: 6,
    ..._ws("0 6px 18px rgba(22,80,208,0.09)"),
  },
  bonStrip: { width: 5, backgroundColor: "#7C3AED" },
  bonBody: { flex: 1, padding: 18, gap: 12 },
  bonTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bonRefBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  bonRef: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#1D4ED8" },
  bonStatusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F5F3FF", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: "#DDD6FE",
  },
  bonStatusText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#6D28D9" },
  bonRouteRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bonCity: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -0.3, flex: 1, minWidth: 0 },
  bonArrow: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  bonMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  bonMetaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  bonFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  bonDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  bonAmount: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#6D28D9", letterSpacing: -0.3 },

  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  tipText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569", flex: 1, lineHeight: 20 },
});
