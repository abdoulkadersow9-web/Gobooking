import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = "#0B3C5D";
const PROFIT_GREEN = "#16A34A";
const LOSS_RED = "#DC2626";

interface TripPerf {
  tripId: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  busName: string;
  busType: string;
  totalRecettes: number;
  totalDepenses: number;
  benefice: number;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR") + " FCFA";
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

export default function ComparaisonScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [trips, setTrips] = useState<TripPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiFetch<{ trips?: TripPerf[] }>("/company/rentabilite", { token: token! });
      const raw: TripPerf[] = Array.isArray(data?.trips) ? data.trips : [];
      /* Sort by bénéfice descending */
      raw.sort((a, b) => b.benefice - a.benefice);
      setTrips(raw);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const profitable = trips.filter(t => t.benefice >= 0).length;
  const lossMaking = trips.length - profitable;

  /* Best and worst */
  const best  = trips[0];
  const worst = trips[trips.length - 1];

  return (
    <SafeAreaView style={S.root} edges={["bottom"]}>
      <LinearGradient colors={[PRIMARY, "#1E5F8A"]} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View style={S.headerRow}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={S.iconBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Comparaison des trajets</Text>
            <Text style={S.headerSub}>{trips.length} trajet{trips.length !== 1 ? "s" : ""} classé{trips.length !== 1 ? "s" : ""} par bénéfice</Text>
          </View>
        </View>

        <View style={S.kpiRow}>
          <View style={S.kpiCard}>
            <Feather name="trending-up" size={16} color="#34D399" />
            <Text style={[S.kpiVal, { color: "#34D399" }]}>{profitable}</Text>
            <Text style={S.kpiLbl}>Rentable{profitable !== 1 ? "s" : ""}</Text>
          </View>
          <View style={S.kpiDivider} />
          <View style={S.kpiCard}>
            <Feather name="trending-down" size={16} color="#F87171" />
            <Text style={[S.kpiVal, { color: "#F87171" }]}>{lossMaking}</Text>
            <Text style={S.kpiLbl}>Non rentable{lossMaking !== 1 ? "s" : ""}</Text>
          </View>
          <View style={S.kpiDivider} />
          <View style={S.kpiCard}>
            <Feather name="bar-chart-2" size={16} color={PRIMARY} />
            <Text style={S.kpiVal}>{trips.length}</Text>
            <Text style={S.kpiLbl}>Total</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={S.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : trips.length === 0 ? (
        <View style={S.center}>
          <Feather name="bar-chart-2" size={40} color={PRIMARY} style={{ marginBottom: 12 }} />
          <Text style={S.emptyTitle}>Aucun trajet</Text>
          <Text style={S.emptySub}>Les trajets de votre compagnie apparaîtront ici classés par performance.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {/* Best / Worst highlight */}
          {trips.length >= 2 && (
            <View style={S.highlightRow}>
              <View style={[S.highlightCard, { borderColor: "#BBF7D0" }]}>
                <Feather name="award" size={22} color="#16A34A" />
                <Text style={S.highlightLabel}>Meilleur</Text>
                <Text style={S.highlightRoute} numberOfLines={1}>{best.from} → {best.to}</Text>
                <Text style={[S.highlightVal, { color: PROFIT_GREEN }]}>{fmt(best.benefice)}</Text>
              </View>
              <View style={[S.highlightCard, { borderColor: "#FECACA" }]}>
                <Feather name="trending-down" size={22} color="#DC2626" />
                <Text style={S.highlightLabel}>Plus faible</Text>
                <Text style={S.highlightRoute} numberOfLines={1}>{worst.from} → {worst.to}</Text>
                <Text style={[S.highlightVal, { color: worst.benefice < 0 ? LOSS_RED : "#94A3B8" }]}>{fmt(worst.benefice)}</Text>
              </View>
            </View>
          )}

          <Text style={S.sectionTitle}>Classement</Text>

          {trips.map((trip, idx) => {
            const profit = trip.benefice >= 0;
            const isTop3 = idx < 3;
            const rank = idx + 1;
            const rankColor = rank === 1 ? "#B45309" : rank === 2 ? "#6B7280" : rank === 3 ? "#92400E" : null;

            /* Margin % */
            const margin = trip.totalRecettes > 0
              ? Math.round((trip.benefice / trip.totalRecettes) * 100)
              : null;

            return (
              <View key={trip.tripId} style={[S.card, isTop3 && profit && { borderLeftWidth: 3, borderLeftColor: PROFIT_GREEN }]}>
                <View style={S.cardTop}>
                  {/* Rank */}
                  <View style={[S.rankBox, isTop3 && profit && { backgroundColor: "#FEF9C3" }]}>
                    <Text style={[S.rankNum, rankColor && profit && { color: rankColor, fontWeight: "800" }]}>#{rank}</Text>
                  </View>

                  {/* Route & Bus */}
                  <View style={{ flex: 1 }}>
                    <View style={S.routeRow}>
                      <Text style={S.routeText}>{trip.from}</Text>
                      <Feather name="arrow-right" size={11} color="#94A3B8" />
                      <Text style={S.routeText}>{trip.to}</Text>
                    </View>
                    <Text style={S.busText}>{trip.busName} · {trip.busType}</Text>
                    <Text style={S.dateText}>{fmtDate(trip.date)} {trip.departureTime}</Text>
                  </View>

                  {/* Indicator */}
                  <View style={[S.indicator, { backgroundColor: profit ? "#F0FDF4" : "#FEF2F2" }]}>
                    <Feather name={profit ? "trending-up" : "trending-down"} size={14} color={profit ? PROFIT_GREEN : LOSS_RED} />
                    <Text style={[S.indicatorText, { color: profit ? PROFIT_GREEN : LOSS_RED }]}>
                      {profit ? "Rentable" : "Perte"}
                    </Text>
                  </View>
                </View>

                {/* Finance row */}
                <View style={S.finRow}>
                  <View style={S.finItem}>
                    <Text style={S.finLabel}>Recettes</Text>
                    <Text style={S.finGreen}>{fmt(trip.totalRecettes)}</Text>
                  </View>
                  <View style={S.finDivider} />
                  <View style={S.finItem}>
                    <Text style={S.finLabel}>Dépenses</Text>
                    <Text style={S.finRed}>{fmt(trip.totalDepenses)}</Text>
                  </View>
                  <View style={S.finDivider} />
                  <View style={S.finItem}>
                    <Text style={S.finLabel}>Bénéfice</Text>
                    <Text style={[S.finBen, { color: profit ? PROFIT_GREEN : LOSS_RED }]}>
                      {trip.benefice >= 0 ? "+" : ""}{fmt(trip.benefice)}
                    </Text>
                    {margin !== null && (
                      <Text style={[S.finMargin, { color: profit ? PROFIT_GREEN : LOSS_RED }]}>
                        {profit ? "+" : ""}{margin}%
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  kpiRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 14, padding: 14 },
  kpiCard: { flex: 1, alignItems: "center", gap: 3 },
  kpiDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.15)" },
  kpiVal: { fontSize: 20, fontWeight: "800", color: "#fff" },
  kpiLbl: { fontSize: 10, color: "rgba(255,255,255,0.75)", textAlign: "center" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  emptySub: { fontSize: 14, color: "#94A3B8", textAlign: "center", lineHeight: 20 },

  list: { padding: 16, gap: 10 },

  highlightRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  highlightCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", gap: 4, borderWidth: 1.5, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  highlightEmoji: { fontSize: 22 },
  highlightLabel: { fontSize: 11, color: "#64748B", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  highlightRoute: { fontSize: 12, fontWeight: "700", color: "#0F172A", textAlign: "center" },
  highlightVal: { fontSize: 13, fontWeight: "800" },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, marginTop: 4 },

  card: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 10 },
  rankBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  rankNum: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  routeText: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  busText: { fontSize: 11, color: "#64748B", marginBottom: 1 },
  dateText: { fontSize: 11, color: "#94A3B8" },
  indicator: { alignItems: "center", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  indicatorText: { fontSize: 10, fontWeight: "700" },

  finRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#F1F5F9", backgroundColor: "#FAFAFA" },
  finItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2 },
  finDivider: { width: 1, backgroundColor: "#F1F5F9" },
  finLabel: { fontSize: 10, fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
  finGreen: { fontSize: 12, fontWeight: "700", color: PROFIT_GREEN },
  finRed: { fontSize: 12, fontWeight: "700", color: LOSS_RED },
  finBen: { fontSize: 13, fontWeight: "800" },
  finMargin: { fontSize: 10, fontWeight: "600" },
});
