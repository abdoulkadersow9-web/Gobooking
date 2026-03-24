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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const AMBER    = "#D97706";
const AMBER_DK = "#92400E";

/* ─── Types ──────────────────────────────────────────────────────── */
interface ReviewItem {
  id:        string;
  rating:    number;
  comment:   string | null;
  createdAt: string;
  userName:  string | null;
  tripId:    string;
}
interface ReviewsData {
  averageRating: number;
  total:         number;
  distribution:  Record<number, number>;
  reviews:       ReviewItem[];
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function renderStars(rating: number, size = 14) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <Text key={n} style={{ fontSize: size, color: n <= rating ? "#FBBF24" : "#E2E8F0" }}>
          {n <= rating ? "★" : "☆"}
        </Text>
      ))}
    </View>
  );
}

function ratingColor(r: number) {
  if (r >= 4.5) return "#16A34A";
  if (r >= 3.5) return "#059669";
  if (r >= 2.5) return "#D97706";
  if (r >= 1.5) return "#EA580C";
  return "#DC2626";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 30)  return `Il y a ${days} jours`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Il y a ${months} mois`;
  return `Il y a ${Math.floor(months / 12)} an(s)`;
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

/* ─── Screen ─────────────────────────────────────────────────────── */
export default function AvisScreen() {
  const insets  = useSafeAreaInsets();
  const { user, token } = useAuth();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const botPad  = Platform.OS === "web" ? 34 : insets.bottom;

  const [data,       setData]       = useState<ReviewsData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");

  const companyId = (user as any)?.companyId ?? null;

  const load = useCallback(async () => {
    if (!companyId) { setError("ID compagnie introuvable"); setLoading(false); return; }
    try {
      const d = await apiFetch<ReviewsData>(`/reviews/company/${companyId}`, { token });
      setData(d);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, token]);

  useEffect(() => { load(); }, [load]);

  /* ─── Rating header card ─── */
  function RatingSummary() {
    if (!data) return null;
    const avg = data.averageRating;
    const total = data.total;
    const color = ratingColor(avg);

    return (
      <View style={S.summaryCard}>
        <View style={S.summaryLeft}>
          <Text style={[S.avgScore, { color }]}>{avg > 0 ? avg.toFixed(1) : "—"}</Text>
          {renderStars(Math.round(avg), 22)}
          <Text style={S.totalTxt}>{total} avis</Text>
        </View>

        <View style={S.summaryRight}>
          {[5,4,3,2,1].map(star => {
            const cnt = data.distribution[star] ?? 0;
            const pct = total > 0 ? (cnt / total) * 100 : 0;
            return (
              <View key={star} style={S.barRow}>
                <Text style={S.barLabel}>{star}</Text>
                <Text style={{ fontSize: 11, color: "#FBBF24", marginRight: 4 }}>★</Text>
                <View style={S.barTrack}>
                  <View style={[S.barFill, { width: `${pct}%` as any, backgroundColor: ratingColor(star) }]} />
                </View>
                <Text style={S.barCount}>{cnt}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  /* ─── Review card ─── */
  function ReviewCard({ item }: { item: ReviewItem }) {
    const color = ratingColor(item.rating);
    return (
      <View style={S.reviewCard}>
        <View style={S.reviewTop}>
          <View style={S.avatar}>
            <Text style={S.avatarTxt}>{initials(item.userName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.reviewerName}>{item.userName ?? "Client anonyme"}</Text>
            <Text style={S.reviewDate}>{timeAgo(item.createdAt)}</Text>
          </View>
          <View style={[S.ratingBadge, { backgroundColor: color + "18" }]}>
            <Text style={[S.ratingBadgeTxt, { color }]}>{item.rating}</Text>
            <Text style={{ fontSize: 12, color: "#FBBF24" }}>★</Text>
          </View>
        </View>

        <View style={{ marginVertical: 6 }}>
          {renderStars(item.rating, 16)}
        </View>

        {item.comment ? (
          <View style={S.commentBox}>
            <Feather name="message-circle" size={13} color="#94A3B8" style={{ marginTop: 2 }} />
            <Text style={S.commentTxt}>{item.comment}</Text>
          </View>
        ) : (
          <Text style={S.noComment}>Pas de commentaire</Text>
        )}
      </View>
    );
  }

  /* ─── Content ─── */
  if (loading) {
    return (
      <View style={[S.root, { paddingTop: topPad }]}>
        <LinearGradient colors={[AMBER, AMBER_DK]} style={S.header}>
          <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="white" />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Avis clients</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>
        <View style={S.center}>
          <ActivityIndicator size="large" color={AMBER} />
          <Text style={S.loadTxt}>Chargement des avis…</Text>
        </View>
      </View>
    );
  }

  const avg  = data?.averageRating ?? 0;
  const total = data?.total ?? 0;

  return (
    <View style={[S.root, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient colors={[AMBER, AMBER_DK]} style={S.header}>
        <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={S.headerTitle}>Avis clients</Text>
          {avg > 0 && (
            <View style={S.headerBadge}>
              <Text style={S.headerBadgeScore}>{avg.toFixed(1)}</Text>
              <Text style={{ fontSize: 13, color: "#FBBF24" }}>★</Text>
              <Text style={S.headerBadgeCount}>({total})</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {error ? (
        <View style={S.center}>
          <Feather name="alert-circle" size={36} color="#DC2626" />
          <Text style={S.errorTxt}>{error}</Text>
          <Pressable style={[S.retryBtn, { backgroundColor: AMBER }]} onPress={load}>
            <Text style={S.retryTxt}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.reviews ?? []}
          keyExtractor={it => it.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[AMBER]} />}
          contentContainerStyle={[S.list, { paddingBottom: botPad + 80 }]}
          ListHeaderComponent={<RatingSummary />}
          ListEmptyComponent={
            <View style={S.emptyBox}>
              <View style={S.emptyIcon}>
                <Feather name="star" size={40} color={AMBER} />
              </View>
              <Text style={S.emptyTitle}>Aucun avis pour l'instant</Text>
              <Text style={S.emptyDesc}>Les clients pourront noter votre compagnie après chaque trajet.</Text>
            </View>
          }
          renderItem={({ item }) => <ReviewCard item={item} />}
        />
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "white" },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  headerBadgeScore: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
  headerBadgeCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },

  center:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  loadTxt:  { fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B" },
  errorTxt: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  retryTxt: { color: "white", fontFamily: "Inter_700Bold" },

  list: { padding: 14, gap: 12 },

  summaryCard: {
    backgroundColor: "white", borderRadius: 20, padding: 20,
    flexDirection: "row", gap: 16, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    marginBottom: 4,
  },
  summaryLeft: { alignItems: "center", gap: 6, width: 90 },
  avgScore:    { fontSize: 48, fontFamily: "Inter_700Bold", lineHeight: 52 },
  totalTxt:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 4 },
  summaryRight:{ flex: 1, gap: 5 },
  barRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  barLabel:    { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748B", width: 12, textAlign: "right" },
  barTrack:    { flex: 1, height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  barFill:     { height: "100%", borderRadius: 4 },
  barCount:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", width: 20, textAlign: "right" },

  reviewCard: {
    backgroundColor: "white", borderRadius: 18, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  reviewTop:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  avatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: AMBER + "20", alignItems: "center", justifyContent: "center" },
  avatarTxt:    { fontSize: 14, fontFamily: "Inter_700Bold", color: AMBER },
  reviewerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  reviewDate:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  ratingBadge:  { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  ratingBadgeTxt: { fontSize: 14, fontFamily: "Inter_700Bold" },

  commentBox:  { flexDirection: "row", gap: 8, marginTop: 4 },
  commentTxt:  { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#334155", lineHeight: 20 },
  noComment:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "#CBD5E1", marginTop: 4, fontStyle: "italic" },

  emptyBox:    { alignItems: "center", padding: 40, gap: 12 },
  emptyIcon:   { width: 80, height: 80, borderRadius: 24, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle:  { fontSize: 17, fontFamily: "Inter_700Bold", color: "#0F172A" },
  emptyDesc:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center", lineHeight: 20 },
});
