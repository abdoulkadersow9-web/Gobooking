import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
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

interface Booking {
  id: string;
  bookingRef: string;
  tripId: string;
  trip: {
    from: string;
    to: string;
    departureTime: string;
    arrivalTime: string;
    date: string;
    busName: string;
  };
  seatNumbers: string[];
  totalAmount: number;
  status: "pending" | "confirmed" | "boarded" | "cancelled" | "completed";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: string;
  createdAt: string;
}

/* ─── Computed 5-state status ─────────────────────────────────────────── */
type DisplayState = "en_attente" | "confirmé" | "payé" | "embarqué" | "annulé";

function computeState(b: Booking): DisplayState {
  if (b.status === "cancelled") return "annulé";
  if (b.status === "boarded" || b.status === "completed") return "embarqué";
  if (b.status === "confirmed" && b.paymentStatus === "paid") return "payé";
  if (b.status === "confirmed") return "confirmé";
  return "en_attente";
}

const STATE_CONFIG: Record<DisplayState, { color: string; bg: string; label: string; icon: string }> = {
  en_attente: { color: "#B45309", bg: "#FFFBEB", label: "En attente",  icon: "clock"         },
  confirmé:   { color: "#0B3C5D", bg: "#E0F2FE", label: "Confirmé",    icon: "check"         },
  payé:       { color: "#047857", bg: "#ECFDF5", label: "Payé",        icon: "check-circle"  },
  embarqué:   { color: "#6D28D9", bg: "#F5F3FF", label: "Embarqué",    icon: "user-check"    },
  annulé:     { color: "#DC2626", bg: "#FEF2F2", label: "Annulé",      icon: "x-circle"      },
};

const METHOD_LABELS: Record<string, string> = {
  orange: "Orange Money",
  mtn:    "MTN MoMo",
  wave:   "Wave",
  card:   "Carte bancaire",
};

/* ─── Timeline steps ──────────────────────────────────────────────────── */
type Step = { key: DisplayState; label: string };
const STEPS: Step[] = [
  { key: "en_attente", label: "Réservé"   },
  { key: "confirmé",   label: "Confirmé"  },
  { key: "payé",       label: "Payé"      },
  { key: "embarqué",   label: "Embarqué"  },
];
const STATE_ORDER: Record<DisplayState, number> = {
  en_attente: 0, confirmé: 1, payé: 2, embarqué: 3, annulé: -1,
};

function BookingTimeline({ state }: { state: DisplayState }) {
  if (state === "annulé") return null;
  const cur = STATE_ORDER[state];
  return (
    <View style={tl.row}>
      {STEPS.map((s, i) => {
        const done    = STATE_ORDER[s.key] <= cur;
        const active  = STATE_ORDER[s.key] === cur;
        const cfg     = STATE_CONFIG[s.key];
        return (
          <React.Fragment key={s.key}>
            <View style={tl.step}>
              <View style={[tl.dot, done && { backgroundColor: cfg.color, borderColor: cfg.color }, active && tl.dotActive]}>
                {done && <Feather name="check" size={8} color="white" />}
              </View>
              <Text style={[tl.label, done && { color: cfg.color, fontFamily: "Inter_600SemiBold" }]}>{s.label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[tl.line, STATE_ORDER[STEPS[i + 1].key] <= cur && { backgroundColor: STATE_CONFIG[STEPS[i + 1].key].color }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const tl = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, paddingTop: 4 },
  step:     { alignItems: "center", width: 56 },
  dot:      { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#CBD5E1", backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  dotActive:{ borderWidth: 3 },
  line:     { flex: 1, height: 2, backgroundColor: "#E2E8F0", marginTop: 8 },
  label:    { fontSize: 9, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 3, textAlign: "center" },
});

/* ─── Screen ──────────────────────────────────────────────────────────── */
export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    if (!token) return;
    try {
      const data = await apiFetch<Booking[]>("/bookings", { token });
      setBookings(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetch(); }, [token]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 100;

  const renderBooking = ({ item }: { item: Booking }) => {
    const state   = computeState(item);
    const cfg     = STATE_CONFIG[state];
    const isPaid  = item.paymentStatus === "paid";
    const needsPay = state === "confirmé";   /* confirmed by company but not yet paid */
    const isWaiting = state === "en_attente"; /* created, not confirmed yet */

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: "/booking/[id]", params: { id: item.id } });
        }}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.refText}>#{item.bookingRef}</Text>
            <Text style={styles.dateText}>{item.trip?.date ?? "—"}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeRow}>
          <View style={styles.cityBlock}>
            <Text style={styles.timeText}>{item.trip?.departureTime ?? "—"}</Text>
            <Text style={styles.cityText}>{item.trip?.from ?? "—"}</Text>
          </View>
          <View style={styles.routeMiddle}>
            <View style={styles.routeLine} />
            <Feather name="arrow-right" size={14} color={Colors.light.textMuted} />
            <View style={styles.routeLine} />
          </View>
          <View style={[styles.cityBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.timeText}>{item.trip?.arrivalTime ?? "—"}</Text>
            <Text style={styles.cityText}>{item.trip?.to ?? "—"}</Text>
          </View>
        </View>

        {/* Timeline (hidden for cancelled) */}
        <BookingTimeline state={state} />

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View>
            {item.paymentMethod && isPaid && (
              <View style={styles.methodRow}>
                <Feather name="credit-card" size={11} color={Colors.light.textMuted} />
                <Text style={styles.methodText}>{METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}</Text>
              </View>
            )}
            {item.seatNumbers?.length > 0 && (
              <View style={styles.seatRow}>
                <Feather name="map-pin" size={11} color={Colors.light.textMuted} />
                <Text style={styles.seatText}>Sièges : {item.seatNumbers.join(", ")}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.amountText, { color: isPaid ? Colors.light.primary : "#D97706" }]}>
            {item.totalAmount.toLocaleString()} FCFA
          </Text>
        </View>

        {/* CTA: pay now if confirmed but not paid */}
        {needsPay && (
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: "#059669" }]}
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: "/payment/cinetpay",
                params: {
                  bookingId:  item.id,
                  amount:     String(item.totalAmount),
                  bookingRef: item.bookingRef,
                },
              });
            }}
          >
            <Feather name="credit-card" size={13} color="white" />
            <Text style={styles.ctaText}>Payer maintenant</Text>
          </Pressable>
        )}

        {/* Info: waiting for company confirmation */}
        {isWaiting && (
          <View style={styles.waitingRow}>
            <Feather name="info" size={11} color="#B45309" />
            <Text style={styles.waitingText}>En attente de confirmation par la compagnie</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mes Réservations</Text>
          {bookings.length > 0 && (
            <Text style={styles.headerSub}>{bookings.length} trajet{bookings.length > 1 ? "s" : ""}</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={styles.historyBtn}
            onPress={() => { Haptics.selectionAsync(); router.push("/client/factures" as any); }}
          >
            <Feather name="file-text" size={15} color={Colors.light.primary} />
            <Text style={styles.historyBtnText}>Factures</Text>
          </Pressable>
          <Pressable
            style={styles.historyBtn}
            onPress={() => { Haptics.selectionAsync(); router.push("/payment/history"); }}
          >
            <Feather name="clock" size={15} color={Colors.light.primary} />
            <Text style={styles.historyBtnText}>Paiements</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
          refreshControl={
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />
          }
          scrollEnabled={bookings.length > 0}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="bookmark" size={48} color={Colors.light.textMuted} />
              <Text style={styles.emptyTitle}>Aucune réservation</Text>
              <Text style={styles.emptySubtitle}>Vos réservations de voyage apparaîtront ici</Text>
              <Pressable style={styles.bookNowBtn} onPress={() => router.push("/(tabs)")}>
                <Text style={styles.bookNowText}>Réserver un trajet</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.light.background },
  header:         { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: Colors.light.border, backgroundColor: Colors.light.card, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:    { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub:      { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  historyBtn:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.light.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  historyBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  card:         { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardPressed:  { transform: [{ scale: 0.98 }] },
  cardHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  refText:      { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  dateText:     { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },
  statusBadge:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  routeRow:     { flexDirection: "row", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  cityBlock:    { flex: 1 },
  timeText:     { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  cityText:     { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  routeMiddle:  { flexDirection: "row", alignItems: "center", gap: 4 },
  routeLine:    { width: 24, height: 1, backgroundColor: Colors.light.border },
  cardFooter:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  methodRow:    { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  methodText:   { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textMuted },
  seatRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  seatText:     { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  amountText:   { fontSize: 17, fontFamily: "Inter_700Bold" },
  ctaBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, borderRadius: 10, paddingVertical: 9 },
  ctaText:      { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },
  waitingRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, backgroundColor: "#FFFBEB", borderRadius: 8, padding: 8 },
  waitingText:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "#B45309", flex: 1 },
  empty:        { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  emptySubtitle:{ fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  bookNowBtn:   { backgroundColor: Colors.light.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  bookNowText:  { color: "white", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
