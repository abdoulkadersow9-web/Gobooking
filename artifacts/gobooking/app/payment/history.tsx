import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const METHOD_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  wave:   { label: "Wave",          color: "#1BA5E0", icon: "zap"          },
  orange: { label: "Orange Money",  color: "#FF6B00", icon: "smartphone"   },
  mtn:    { label: "MTN MoMo",      color: "#FFCB00", icon: "smartphone"   },
  card:   { label: "Carte bancaire",color: "#1A56DB", icon: "credit-card"  },
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  paid:    { label: "Payé",    color: "#065F46", bg: "#D1FAE5", icon: "check-circle" },
  pending: { label: "En attente", color: "#92400E", bg: "#FEF3C7", icon: "clock" },
  failed:  { label: "Échoué", color: "#991B1B", bg: "#FEE2E2", icon: "x-circle" },
};

interface PaymentItem {
  id: string;
  refType: string;
  transactionId: string | null;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  booking: {
    bookingRef: string;
    from: string;
    to: string;
    date: string;
    departureTime: string;
    status: string;
    paymentStatus?: string;
  } | null;
  parcel: {
    trackingRef: string;
    from: string;
    to: string;
    status: string;
    paymentStatus?: string;
    parcelType?: string;
  } | null;
}

export default function PaymentHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === "web" ? 24 : insets.top;

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<PaymentItem[]>("/payment/receipts", { token });
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const renderItem = ({ item }: { item: PaymentItem }) => {
    const m = METHOD_LABELS[item.method] ?? { label: item.method, color: "#6B7280", icon: "credit-card" };
    const date = new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    const time = new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const isParcel = item.refType === "parcel";

    /* Derive effective paymentStatus from nested booking/parcel or from payment record itself */
    const payStatus = isParcel
      ? (item.parcel?.paymentStatus ?? item.status)
      : (item.booking?.paymentStatus ?? item.status);
    const badge = STATUS_BADGE[payStatus] ?? STATUS_BADGE.paid;

    return (
      <Pressable
        style={({ pressed }) => [ss.card, pressed && { opacity: 0.88 }]}
        onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/payment/receipt/[id]", params: { id: item.id } }); }}
      >
        <View style={ss.cardLeft}>
          <View style={[ss.methodIcon, { backgroundColor: isParcel ? "#DBEAFE" : m.color + "20" }]}>
            {isParcel
              ? <Feather name="package" size={22} color="#1D4ED8" />
              : <Feather name={m.icon as never} size={22} color={m.color} />
            }
          </View>
          <View style={{ flex: 1 }}>
            {isParcel && item.parcel ? (
              <>
                <Text style={ss.route} numberOfLines={1}>{item.parcel.from} → {item.parcel.to}</Text>
                <Text style={ss.ref} numberOfLines={1}>{item.parcel.trackingRef}</Text>
              </>
            ) : item.booking ? (
              <>
                <Text style={ss.route} numberOfLines={1}>{item.booking.from} → {item.booking.to}</Text>
                <Text style={ss.ref} numberOfLines={1}>#{item.booking.bookingRef} · {item.booking.date}</Text>
              </>
            ) : (
              <Text style={ss.route}>Paiement GoBooking</Text>
            )}
            <View style={ss.metaRow}>
              <Text style={[ss.methodLabel, { color: m.color }]}>{m.label}</Text>
              <Text style={ss.metaDot}>·</Text>
              <Text style={ss.dateLabel}>{date} à {time}</Text>
            </View>
          </View>
        </View>
        <View style={ss.cardRight}>
          <Text style={ss.amount}>{(item.amount ?? 0).toLocaleString()} F</Text>
          <View style={[ss.statusBadge, { backgroundColor: badge.bg }]}>
            <Feather name={badge.icon as never} size={10} color={badge.color} />
            <Text style={[ss.statusText, { color: badge.color }]}>{badge.label}</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#CBD5E1" style={{ marginTop: 4 }} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={ss.flex}>
      {/* Gradient header */}
      <LinearGradient
        colors={["#1650D0", "#1030B4", "#0A1C84"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[ss.header, { paddingTop: topPad + 16 }]}
      >
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings"); }}
          style={ss.backBtn}
        >
          <Feather name="arrow-left" size={18} color="white" />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={ss.headerTitle}>Historique des paiements</Text>
          <Text style={ss.headerSub}>
            {!loading ? `${payments.length} paiement${payments.length !== 1 ? "s" : ""}` : "Chargement..."}
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={[ss.flex, ss.center]}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#94A3B8", marginTop: 12 }}>Chargement...</Text>
        </View>
      ) : payments.length === 0 ? (
        <View style={[ss.flex, ss.center, { paddingHorizontal: 32 }]}>
          <View style={ss.emptyIcon}>
            <Feather name="credit-card" size={32} color={Colors.light.primary} />
          </View>
          <Text style={ss.emptyTitle}>Aucun paiement</Text>
          <Text style={ss.emptySub}>Vos paiements apparaîtront ici après confirmation.</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0B3C5D" />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: Colors.light.background },
  center:       { alignItems: "center", justifyContent: "center", gap: 10 },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 22, gap: 16 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", flexShrink: 0 },
  headerTitle:  { fontSize: 20, fontFamily: "Inter_700Bold", color: "white", letterSpacing: -0.4 },
  headerSub:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 3 },
  card:         { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E8ECFA" },
  cardLeft:     { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  methodIcon:   { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  route:        { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1E293B", marginBottom: 2 },
  ref:          { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginBottom: 4 },
  metaRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  methodLabel:  { fontSize: 11, fontFamily: "Inter_500Medium" },
  metaDot:      { fontSize: 11, color: "#CBD5E1" },
  dateLabel:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  cardRight:    { alignItems: "flex-end", gap: 2 },
  amount:       { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0B3C5D" },
  statusBadge:  { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  statusText:   { fontSize: 10, fontFamily: "Inter_700Bold" },
  emptyIcon:    { width: 72, height: 72, borderRadius: 36, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#374151" },
  emptySub:     { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center", maxWidth: 260, lineHeight: 19 },
});
