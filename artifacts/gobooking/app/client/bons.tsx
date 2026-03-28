import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const BLUE = "#1A56DB";
const VIOLET = "#7C3AED";
const VIOLET_LIGHT = "#F5F3FF";
const VIOLET_BORDER = "#DDD6FE";

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
  trip?: {
    from: string;
    to: string;
    date: string;
    departureTime: string;
  } | null;
}

export default function MesBonsScreen() {
  const { token } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [bons, setBons] = useState<BonBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    } catch {
      Alert.alert("Erreur", "Impossible de charger vos bons.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (d?: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={VIOLET} /></View>
      </SafeAreaView>
    );
  }

  const balance = wallet?.walletBalance ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes bons de voyage</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={VIOLET} />}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <View style={styles.balanceIconWrap}>
              <Feather name="gift" size={22} color={VIOLET} />
            </View>
            <View>
              <Text style={styles.balanceLabel}>Crédit disponible</Text>
              <Text style={styles.balanceAmount}>{(balance ?? 0).toLocaleString()} FCFA</Text>
            </View>
          </View>
          {wallet && (
            <View style={styles.loyaltyPill}>
              <Feather name="star" size={11} color={VIOLET} />
              <Text style={styles.loyaltyText}>{wallet.loyalty}</Text>
            </View>
          )}
        </View>

        {/* How to use info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Comment utiliser vos bons ?</Text>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNum}><Text style={styles.infoStepNumText}>1</Text></View>
            <Text style={styles.infoStepText}>Réservez un trajet depuis l'onglet Accueil</Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNum}><Text style={styles.infoStepNumText}>2</Text></View>
            <Text style={styles.infoStepText}>Au moment du paiement, choisissez "Payer avec mon crédit"</Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNum}><Text style={styles.infoStepNumText}>3</Text></View>
            <Text style={styles.infoStepText}>Le montant est déduit automatiquement de votre solde</Text>
          </View>
          <View style={[styles.infoStep, { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}>
            <View style={styles.infoStepNum}><Text style={styles.infoStepNumText}>4</Text></View>
            <Text style={styles.infoStepText}>Accumulez des bons en voyage pour débloquer des avantages exclusifs</Text>
          </View>
        </View>

        {/* Bons list */}
        <View>
          <Text style={styles.sectionTitle}>Bons émis ({bons.length})</Text>

          {bons.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="gift" size={32} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucun bon émis</Text>
              <Text style={styles.emptySub}>
                Après un voyage payé, vous pouvez demander un bon depuis votre liste de réservations.
              </Text>
              <TouchableOpacity
                style={styles.goReserveBtn}
                onPress={() => router.push("/(tabs)/bookings" as any)}
              >
                <Feather name="list" size={14} color="white" />
                <Text style={styles.goReserveText}>Voir mes réservations</Text>
              </TouchableOpacity>
            </View>
          ) : (
            bons.map((bon) => (
              <View key={bon.id} style={styles.bonCard}>
                <View style={styles.bonHeader}>
                  <View style={styles.bonRefBadge}>
                    <Text style={styles.bonRef}>#{bon.bookingRef}</Text>
                  </View>
                  <View style={styles.bonStatusBadge}>
                    <Feather name="gift" size={10} color={VIOLET} />
                    <Text style={styles.bonStatusText}>Bon émis</Text>
                  </View>
                </View>

                {bon.trip && (
                  <View style={styles.bonRoute}>
                    <Text style={styles.bonRouteText}>{bon.trip.from} → {bon.trip.to}</Text>
                    <Text style={styles.bonDateText}>{bon.trip.date} · {bon.trip.departureTime}</Text>
                  </View>
                )}

                <View style={styles.bonFooter}>
                  <Text style={styles.bonEmittedAt}>Émis le {formatDate(bon.createdAt)}</Text>
                  <Text style={styles.bonAmount}>{(bon.totalAmount ?? 0).toLocaleString()} FCFA</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Loyalty tips */}
        {wallet && (
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Votre fidélité</Text>
            <View style={styles.tipRow}>
              <Feather name="trending-up" size={14} color="#059669" />
              <Text style={styles.tipText}>
                {wallet.totalTrips} voyage{wallet.totalTrips > 1 ? "s" : ""} effectué{wallet.totalTrips > 1 ? "s" : ""}
              </Text>
            </View>
            {wallet.referralCode && (
              <View style={styles.tipRow}>
                <Feather name="share-2" size={14} color={BLUE} />
                <Text style={styles.tipText}>
                  Code parrainage : <Text style={{ fontWeight: "700", color: BLUE }}>{wallet.referralCode}</Text>
                </Text>
              </View>
            )}
            <View style={styles.tipRow}>
              <Feather name="info" size={14} color="#B45309" />
              <Text style={styles.tipText}>
                Parrainez vos amis pour gagner 500 FCFA par ami inscrit
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },

  balanceCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: VIOLET_LIGHT, borderRadius: 16,
    borderWidth: 1, borderColor: VIOLET_BORDER, padding: 18,
  },
  balanceLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  balanceIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#EDE9FE", justifyContent: "center", alignItems: "center" },
  balanceLabel: { fontSize: 12, color: "#6B21A8", fontWeight: "500", marginBottom: 2 },
  balanceAmount: { fontSize: 24, fontWeight: "700", color: VIOLET },
  loyaltyPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EDE9FE", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  loyaltyText: { fontSize: 12, fontWeight: "600", color: VIOLET },

  infoCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", padding: 16 },
  infoTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 12 },
  infoStep: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  infoStepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: VIOLET_LIGHT, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: VIOLET_BORDER },
  infoStepNumText: { fontSize: 11, fontWeight: "700", color: VIOLET },
  infoStepText: { fontSize: 13, color: "#374151", flex: 1, lineHeight: 18 },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },

  emptyCard: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB",
    padding: 28, alignItems: "center", gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  emptySub: { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 18 },
  goReserveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: VIOLET, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  goReserveText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  bonCard: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: VIOLET_BORDER,
    padding: 14, marginBottom: 10,
  },
  bonHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  bonRefBadge: { backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#BFDBFE" },
  bonRef: { fontSize: 11, fontWeight: "700", color: "#1D4ED8" },
  bonStatusBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: VIOLET_LIGHT, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: VIOLET_BORDER },
  bonStatusText: { fontSize: 11, fontWeight: "600", color: VIOLET },
  bonRoute: { marginBottom: 10 },
  bonRouteText: { fontSize: 14, fontWeight: "700", color: "#111827" },
  bonDateText: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  bonFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bonEmittedAt: { fontSize: 11, color: "#9CA3AF" },
  bonAmount: { fontSize: 16, fontWeight: "700", color: VIOLET },

  tipsCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", padding: 16 },
  tipsTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 10 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  tipText: { fontSize: 13, color: "#374151", flex: 1, lineHeight: 18 },
});
