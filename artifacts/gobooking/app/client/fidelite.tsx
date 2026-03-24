import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  Pressable, Alert, Platform, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/utils/api";

/* ─── Types ──────────────────────────────────────────────────── */
interface Reward {
  id: string; points: number; type: string; value: number;
  label: string; desc: string;
}
interface HistoryEntry {
  id: string; type: "earn" | "redeem"; points: number; balance: number;
  reason: string; bookingId?: string; rewardId?: string; createdAt: string;
}
interface LoyaltyProfile {
  points: number; status: string; nextStatus: string | null;
  pointsNeeded: number; rewards: Reward[]; history: HistoryEntry[];
}

/* ─── Config ─────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, {
  colors: [string, string]; icon: string; label: string; ring: string;
}> = {
  Bronze: { colors: ["#92400E", "#B45309"], icon: "award",   label: "Bronze", ring: "#D97706" },
  Silver: { colors: ["#475569", "#64748B"], icon: "award",   label: "Silver", ring: "#94A3B8" },
  Gold:   { colors: ["#92400E", "#D97706"], icon: "star",    label: "Gold",   ring: "#F59E0B" },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

/* ─── Animated progress bar ──────────────────────────────────── */
function ProgressBar({ progress }: { progress: number }) {
  const width = useAnimatedWidth(Math.min(progress, 1));
  return (
    <View style={ps.track}>
      <Animated.View style={[ps.fill, { width }]} />
    </View>
  );
}

function useAnimatedWidth(target: number) {
  const anim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: target, useNativeDriver: false, tension: 60, friction: 10 }).start();
  }, [target]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
}

const ps = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: "#E2E8F0", overflow: "hidden" },
  fill:  { height: "100%", backgroundColor: "#D97706", borderRadius: 4 },
});

/* ─── Main ─────────────────────────────────────────────────────── */
export default function FideliteScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<LoyaltyProfile>("/loyalty/profile");
      setProfile(data);
    } catch { setProfile(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleRedeem = async (reward: Reward) => {
    if (!profile) return;
    if (profile.points < reward.points) {
      Alert.alert(
        "Points insuffisants",
        `Il vous manque ${reward.points - profile.points} point${reward.points - profile.points > 1 ? "s" : ""} pour débloquer cette récompense.`
      );
      return;
    }
    Alert.alert(
      "Confirmer l'échange",
      `Échanger ${reward.points} points contre : ${reward.label} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer", style: "default",
          onPress: async () => {
            setRedeeming(reward.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              const result = await apiFetch<{ success: boolean; walletCredited: number; newPoints: number }>(
                "/loyalty/redeem",
                { method: "POST", body: JSON.stringify({ rewardId: reward.id }) }
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Récompense débloquée ! 🎉",
                `${result.walletCredited.toLocaleString("fr-FR")} FCFA ont été ajoutés à votre portefeuille.`
              );
              await load();
            } catch (e: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Erreur", e?.message ?? "Impossible d'échanger les points. Réessayez.");
            } finally { setRedeeming(null); }
          },
        },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const cfg = STATUS_CONFIG[profile?.status ?? "Bronze"] ?? STATUS_CONFIG.Bronze;

  const progress = profile
    ? profile.status === "Gold"
      ? 1
      : profile.nextStatus
        ? 1 - profile.pointsNeeded / (profile.status === "Silver" ? 200 : 100)
        : 0
    : 0;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* Header gradient */}
      <LinearGradient colors={cfg.colors} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as never)} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Feather name={cfg.icon as never} size={20} color="white" />
          <Text style={styles.headerTitle}>Fidélité GoBooking</Text>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#D97706" /></View>
      ) : !profile ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={40} color="#CBD5E1" />
          <Text style={styles.errText}>Impossible de charger votre profil fidélité</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ─── Points card ─── */}
          <LinearGradient colors={cfg.colors} style={styles.pointsCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { borderColor: cfg.ring }]}>
                <Feather name={cfg.icon as never} size={16} color={cfg.ring} />
                <Text style={[styles.statusText, { color: cfg.ring }]}>{profile.status}</Text>
              </View>
            </View>
            <Text style={styles.pointsBig}>{profile.points.toLocaleString("fr-FR")}</Text>
            <Text style={styles.pointsLabel}>points fidélité</Text>

            {/* Progress to next status */}
            {profile.nextStatus && (
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressDesc}>Vers le statut {profile.nextStatus}</Text>
                  <Text style={styles.progressDesc}>{profile.pointsNeeded} pts restants</Text>
                </View>
                <ProgressBar progress={progress} />
              </View>
            )}

            {profile.status === "Gold" && (
              <View style={styles.goldBanner}>
                <Feather name="star" size={14} color="#FFF" />
                <Text style={styles.goldText}>Niveau maximum atteint — Félicitations ! 🎉</Text>
              </View>
            )}
          </LinearGradient>

          {/* ─── How it works ─── */}
          <View style={styles.howRow}>
            {[
              { icon: "map", label: "Voyagez", desc: "+10 pts / voyage" },
              { icon: "gift", label: "Échangez", desc: "Récompenses" },
              { icon: "credit-card", label: "Payez", desc: "Via wallet" },
            ].map(h => (
              <View key={h.icon} style={styles.howCard}>
                <View style={styles.howIcon}>
                  <Feather name={h.icon as never} size={18} color="#D97706" />
                </View>
                <Text style={styles.howLabel}>{h.label}</Text>
                <Text style={styles.howDesc}>{h.desc}</Text>
              </View>
            ))}
          </View>

          {/* ─── Statuses ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niveaux de fidélité</Text>
            <View style={styles.levelsRow}>
              {[
                { name: "Bronze", min: 0,   max: 99,  color: "#92400E" },
                { name: "Silver", min: 100, max: 299, color: "#475569" },
                { name: "Gold",   min: 300, max: null, color: "#D97706" },
              ].map(l => (
                <View key={l.name} style={[styles.levelCard, profile.status === l.name && styles.levelCardActive]}>
                  <Text style={[styles.levelName, { color: l.color }]}>{l.name}</Text>
                  <Text style={styles.levelRange}>
                    {l.max ? `${l.min}–${l.max} pts` : `${l.min}+ pts`}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ─── Rewards ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Récompenses disponibles</Text>
            <View style={styles.rewardsGrid}>
              {profile.rewards.map(r => {
                const canRedeem = profile.points >= r.points;
                const isRedeeming = redeeming === r.id;
                return (
                  <View key={r.id} style={[styles.rewardCard, !canRedeem && styles.rewardCardLocked]}>
                    <LinearGradient
                      colors={canRedeem ? ["#FFFBEB", "#FEF3C7"] : ["#F8FAFC", "#F1F5F9"]}
                      style={styles.rewardGradient}
                    >
                      <View style={styles.rewardTop}>
                        <View style={[styles.rewardIcon, { backgroundColor: canRedeem ? "#FEF3C7" : "#E2E8F0" }]}>
                          <Feather name="gift" size={20} color={canRedeem ? "#D97706" : "#94A3B8"} />
                        </View>
                        <View style={[styles.rewardPtsBadge, { backgroundColor: canRedeem ? "#D97706" : "#94A3B8" }]}>
                          <Text style={styles.rewardPtsText}>{r.points} pts</Text>
                        </View>
                      </View>
                      <Text style={[styles.rewardLabel, !canRedeem && { color: "#94A3B8" }]}>{r.label}</Text>
                      <Text style={styles.rewardDesc}>{r.desc}</Text>
                      <Pressable
                        style={[styles.rewardBtn, !canRedeem && styles.rewardBtnLocked]}
                        onPress={() => handleRedeem(r)}
                        disabled={!canRedeem || !!isRedeeming}
                      >
                        {isRedeeming ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <Feather name={canRedeem ? "unlock" : "lock"} size={13} color="white" />
                            <Text style={styles.rewardBtnText}>{canRedeem ? "Échanger" : `${r.points - profile.points} pts manquants`}</Text>
                          </>
                        )}
                      </Pressable>
                    </LinearGradient>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ─── History ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historique des points</Text>
            {profile.history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Feather name="clock" size={28} color="#CBD5E1" />
                <Text style={styles.emptyHistText}>Aucune activité pour l'instant</Text>
                <Text style={styles.emptyHistSub}>Vos points apparaîtront après chaque voyage validé</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {profile.history.map(entry => (
                  <View key={entry.id} style={styles.historyRow}>
                    <View style={[styles.historyDot, { backgroundColor: entry.type === "earn" ? "#059669" : "#D97706" }]} />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyReason} numberOfLines={1}>{entry.reason}</Text>
                      <Text style={styles.historyDate}>{formatDate(entry.createdAt)}</Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={[styles.historyPts, { color: entry.type === "earn" ? "#059669" : "#D97706" }]}>
                        {entry.type === "earn" ? "+" : ""}{entry.points} pts
                      </Text>
                      <Text style={styles.historyBalance}>Solde : {entry.balance}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

        </ScrollView>
      )}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 18 },
  backBtn:{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle:  { fontSize: 17, fontWeight: "700", color: "white" },

  center:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  errText:   { fontSize: 14, color: "#94A3B8", textAlign: "center", marginTop: 8 },
  retryBtn:  { backgroundColor: "#D97706", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: "white", fontWeight: "600", fontSize: 14 },

  /* Points hero card */
  pointsCard: { margin: 16, borderRadius: 20, padding: 24, gap: 8 },
  statusRow:  { alignItems: "flex-start" },
  statusBadge:{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.15)" },
  statusText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  pointsBig:  { fontSize: 56, fontWeight: "900", color: "white", marginTop: 8 },
  pointsLabel:{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: -4 },

  progressSection:  { marginTop: 16, gap: 6 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  progressDesc:     { fontSize: 11, color: "rgba(255,255,255,0.7)" },

  goldBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, padding: 10, marginTop: 8 },
  goldText:   { fontSize: 12, color: "white", flex: 1 },

  /* How it works */
  howRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 8 },
  howCard:{ flex: 1, backgroundColor: "white", borderRadius: 14, padding: 14, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#E2E8F0" },
  howIcon:{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFBEB", justifyContent: "center", alignItems: "center" },
  howLabel:{ fontSize: 12, fontWeight: "700", color: "#1E293B" },
  howDesc: { fontSize: 10, color: "#94A3B8", textAlign: "center" },

  /* Sections */
  section:      { marginHorizontal: 16, marginTop: 20, gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#334155", textTransform: "uppercase", letterSpacing: 0.5 },

  /* Levels */
  levelsRow:     { flexDirection: "row", gap: 8 },
  levelCard:     { flex: 1, backgroundColor: "white", borderRadius: 12, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#E2E8F0" },
  levelCardActive:{ borderWidth: 2, borderColor: "#D97706", backgroundColor: "#FFFBEB" },
  levelName:     { fontSize: 14, fontWeight: "800" },
  levelRange:    { fontSize: 10, color: "#94A3B8" },

  /* Rewards */
  rewardsGrid:    { gap: 10 },
  rewardCard:     { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" },
  rewardCardLocked:{ borderColor: "#E2E8F0" },
  rewardGradient: { padding: 16, gap: 8 },
  rewardTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rewardIcon:     { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  rewardPtsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rewardPtsText:  { fontSize: 12, fontWeight: "800", color: "white" },
  rewardLabel:    { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  rewardDesc:     { fontSize: 12, color: "#64748B" },
  rewardBtn:      { backgroundColor: "#D97706", borderRadius: 10, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 4 },
  rewardBtnLocked:{ backgroundColor: "#94A3B8" },
  rewardBtnText:  { color: "white", fontWeight: "700", fontSize: 13 },

  /* History */
  historyList:   { backgroundColor: "white", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" },
  historyRow:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  historyDot:    { width: 10, height: 10, borderRadius: 5 },
  historyInfo:   { flex: 1, gap: 2 },
  historyReason: { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  historyDate:   { fontSize: 11, color: "#94A3B8" },
  historyRight:  { alignItems: "flex-end", gap: 2 },
  historyPts:    { fontSize: 14, fontWeight: "800" },
  historyBalance:{ fontSize: 10, color: "#94A3B8" },
  emptyHistory:  { backgroundColor: "white", borderRadius: 14, padding: 32, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  emptyHistText: { fontSize: 15, fontWeight: "700", color: "#475569" },
  emptyHistSub:  { fontSize: 12, color: "#94A3B8", textAlign: "center" },
});
