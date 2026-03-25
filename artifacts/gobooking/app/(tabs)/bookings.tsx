import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
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
    companyId?: string | null;
  };
  seatNumbers: string[];
  totalAmount: number;
  status: string;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: string;
  bagageStatus?: string;
  createdAt: string;
}

// ─── Statuts normalisés ────────────────────────────────────────────────────────
type DisplayState =
  | "en_attente"
  | "confirmé"
  | "payé"
  | "embarqué"
  | "expiré"
  | "annulé"
  | "bon_emis";

function computeState(b: Booking): DisplayState {
  const s = b.status?.toLowerCase() ?? "";
  if (s === "expiré" || s === "expired")            return "expiré";
  if (s === "bon_emis")                             return "bon_emis";
  if (s === "cancelled" || s === "annulé")          return "annulé";
  if (s === "boarded" || s === "completed" || s === "embarqué") return "embarqué";
  if (s === "confirmed" && b.paymentStatus === "paid") return "payé";
  if (s === "confirmed")                            return "confirmé";
  return "en_attente";
}

const STATE_CONFIG: Record<DisplayState, { color: string; bg: string; label: string; icon: string }> = {
  en_attente: { color: "#B45309", bg: "#FFFBEB",  label: "En attente",  icon: "clock"         },
  confirmé:   { color: "#0B3C5D", bg: "#E0F2FE",  label: "Confirmé",    icon: "check"         },
  payé:       { color: "#047857", bg: "#ECFDF5",  label: "Payé ✓",      icon: "check-circle"  },
  embarqué:   { color: "#6D28D9", bg: "#F5F3FF",  label: "Embarqué",    icon: "user-check"    },
  expiré:     { color: "#DC2626", bg: "#FEF2F2",  label: "Expiré",      icon: "alert-octagon" },
  annulé:     { color: "#DC2626", bg: "#FEF2F2",  label: "Annulé",      icon: "x-circle"      },
  bon_emis:   { color: "#7C3AED", bg: "#F5F3FF",  label: "Bon émis",    icon: "gift"          },
};

const METHOD_LABELS: Record<string, string> = {
  orange: "Orange Money",
  mtn:    "MTN MoMo",
  wave:   "Wave",
  card:   "Carte bancaire",
  cash:   "Espèces",
};

// ─── Timeline ─────────────────────────────────────────────────────────────────
type Step = { key: DisplayState; label: string };
const STEPS: Step[] = [
  { key: "en_attente", label: "Réservé"   },
  { key: "confirmé",   label: "Confirmé"  },
  { key: "payé",       label: "Payé"      },
  { key: "embarqué",   label: "Embarqué"  },
];
const STATE_ORDER: Record<DisplayState, number> = {
  en_attente: 0, confirmé: 1, payé: 2, embarqué: 3, expiré: -1, annulé: -1, bon_emis: 4,
};

function BookingTimeline({ state }: { state: DisplayState }) {
  if (state === "annulé" || state === "expiré") return null;
  if (state === "bon_emis") {
    return (
      <View style={[tl.row, { justifyContent: "center" }]}>
        <View style={tl.bonBadge}>
          <Feather name="gift" size={12} color="#7C3AED" />
          <Text style={tl.bonLabel}>Bon de voyage émis</Text>
        </View>
      </View>
    );
  }
  const cur = STATE_ORDER[state];
  return (
    <View style={tl.row}>
      {STEPS.map((s, i) => {
        const done   = STATE_ORDER[s.key] <= cur;
        const active = STATE_ORDER[s.key] === cur;
        const cfg    = STATE_CONFIG[s.key];
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
  row:       { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, paddingTop: 4 },
  step:      { alignItems: "center", width: 56 },
  dot:       { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#CBD5E1", backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  dotActive: { borderWidth: 3 },
  line:      { flex: 1, height: 2, backgroundColor: "#E2E8F0", marginTop: 8 },
  label:     { fontSize: 9, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 3, textAlign: "center" },
  bonBadge:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F5F3FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#DDD6FE" },
  bonLabel:  { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
});

// ─── Countdown helper ─────────────────────────────────────────────────────────
function useCountdown(trip: Booking["trip"] | undefined, status: string) {
  const [minsLeft, setMinsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!trip?.date || !trip?.departureTime) return;
    if (!["pending", "en_attente", "confirmed", "confirmé"].includes(status.toLowerCase())) return;

    const update = () => {
      const dep = new Date(`${trip.date}T${trip.departureTime}:00`);
      const diff = (dep.getTime() - Date.now()) / 60_000 - 45; // mins left before 45-min cutoff
      setMinsLeft(Math.floor(diff));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [trip?.date, trip?.departureTime, status]);

  return minsLeft;
}

// ─── CountdownBadge ───────────────────────────────────────────────────────────
function CountdownBadge({ minsLeft }: { minsLeft: number | null }) {
  if (minsLeft === null) return null;
  if (minsLeft <= 0) {
    return (
      <View style={cd.badgeRed}>
        <Feather name="alert-circle" size={11} color="#DC2626" />
        <Text style={cd.textRed}>Délai expiré</Text>
      </View>
    );
  }
  const hrs  = Math.floor(minsLeft / 60);
  const mins = minsLeft % 60;
  const label = hrs > 0 ? `${hrs}h${mins.toString().padStart(2, "0")} restant` : `${mins} min restant`;
  const urgent = minsLeft <= 30;
  return (
    <View style={urgent ? cd.badgeOrange : cd.badgeAmber}>
      <Feather name="clock" size={11} color={urgent ? "#EA580C" : "#B45309"} />
      <Text style={urgent ? cd.textOrange : cd.textAmber}>{label} pour payer</Text>
    </View>
  );
}

const cd = StyleSheet.create({
  badgeAmber:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFBEB", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#FDE68A", marginTop: 6 },
  badgeOrange: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF7ED", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#FED7AA", marginTop: 6 },
  badgeRed:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF2F2", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#FECACA", marginTop: 6 },
  textAmber:   { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#B45309" },
  textOrange:  { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#EA580C" },
  textRed:     { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
});

// ─── Baggage badge ────────────────────────────────────────────────────────────
function BaggageBadge({ status }: { status?: string | null }) {
  if (!status || status === "accepté") return null;
  if (status === "en_attente") {
    return (
      <View style={[cd.badgeAmber, { marginTop: 4 }]}>
        <Feather name="briefcase" size={10} color="#B45309" />
        <Text style={cd.textAmber}>Bagages en attente de validation</Text>
      </View>
    );
  }
  if (status === "refusé") {
    return (
      <View style={[cd.badgeRed, { marginTop: 4 }]}>
        <Feather name="briefcase" size={10} color="#DC2626" />
        <Text style={cd.textRed}>Bagages refusés — à régulariser en gare</Text>
      </View>
    );
  }
  return null;
}

// ─── Booking card ─────────────────────────────────────────────────────────────
function BookingCard({
  item,
  reviewed,
  token,
  onVoucherRequest,
}: {
  item: Booking;
  reviewed: Set<string>;
  token: string | null;
  onVoucherRequest: (id: string) => void;
}) {
  const state    = computeState(item);
  const cfg      = STATE_CONFIG[state];
  const minsLeft = useCountdown(item.trip, item.status);
  const isPaid       = item.paymentStatus === "paid";
  const needsPay     = state === "confirmé" && !isPaid;
  const isExpired    = state === "expiré";
  const isCancelled  = state === "annulé";
  const isBonEmis    = state === "bon_emis";
  const isPayé       = state === "payé";
  const canReview    = state === "embarqué" && !reviewed.has(item.id);
  const alreadyRev   = state === "embarqué" && reviewed.has(item.id);
  const canVoucher   = isPayé && !isBonEmis;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        isExpired && styles.cardExpired,
        isCancelled && styles.cardCancelled,
      ]}
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

      {/* Countdown (if pending payment) */}
      {state === "en_attente" && (
        <>
          <CountdownBadge minsLeft={minsLeft} />
          <View style={styles.rule45Banner}>
            <Feather name="info" size={11} color="#1D4ED8" />
            <Text style={styles.rule45Text}>Payez au moins 45 min avant le départ pour valider votre place.</Text>
          </View>
        </>
      )}

      {/* Baggage badge */}
      <BaggageBadge status={item.bagageStatus} />

      {/* Timeline */}
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
        <Text style={[styles.amountText, {
          color: isExpired || isCancelled ? "#9CA3AF"
               : isPaid ? Colors.light.primary
               : "#D97706"
        }]}>
          {item.totalAmount.toLocaleString()} FCFA
        </Text>
      </View>

      {/* CTA: Payer maintenant */}
      {needsPay && minsLeft !== null && minsLeft > 0 && (
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: "#059669" }]}
          onPress={(e) => {
            e.stopPropagation?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: "/payment/cinetpay",
              params: { bookingId: item.id, amount: String(item.totalAmount), bookingRef: item.bookingRef },
            });
          }}
        >
          <Feather name="credit-card" size={13} color="white" />
          <Text style={styles.ctaText}>Payer maintenant</Text>
        </Pressable>
      )}

      {/* Expired explanation */}
      {isExpired && (
        <View style={[styles.waitingRow, { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1 }]}>
          <Feather name="alert-octagon" size={11} color="#DC2626" />
          <Text style={[styles.waitingText, { color: "#DC2626" }]}>
            Réservation expirée — le paiement n'a pas été effectué avant la limite de 45 min.
          </Text>
        </View>
      )}

      {/* Voucher request */}
      {canVoucher && (
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: "#7C3AED", marginTop: 8 }]}
          onPress={(e) => {
            e.stopPropagation?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onVoucherRequest(item.id);
          }}
        >
          <Feather name="gift" size={13} color="white" />
          <Text style={styles.ctaText}>Demander un bon de voyage</Text>
        </Pressable>
      )}

      {/* Bon émis info */}
      {isBonEmis && (
        <View style={[styles.waitingRow, { backgroundColor: "#F5F3FF" }]}>
          <Feather name="gift" size={11} color="#7C3AED" />
          <Text style={[styles.waitingText, { color: "#7C3AED" }]}>Bon de voyage disponible dans votre espace fidélité</Text>
        </View>
      )}

      {/* Review */}
      {canReview && (
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: "#FBBF24", marginTop: 8 }]}
          onPress={(e) => {
            e.stopPropagation?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: "/client/review",
              params: { bookingId: item.id, tripId: item.tripId, companyId: item.trip?.companyId ?? "", from: item.trip?.from ?? "", to: item.trip?.to ?? "", date: item.trip?.date ?? "" },
            });
          }}
        >
          <Text style={{ fontSize: 16, color: "#7C2D12" }}>★</Text>
          <Text style={[styles.ctaText, { color: "#7C2D12" }]}>Laisser un avis</Text>
        </Pressable>
      )}
      {alreadyRev && (
        <View style={[styles.waitingRow, { backgroundColor: "#F0FDF4" }]}>
          <Feather name="check-circle" size={11} color="#16A34A" />
          <Text style={[styles.waitingText, { color: "#16A34A" }]}>Vous avez déjà laissé un avis</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewed,   setReviewed]   = useState<Set<string>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [data, reviewedIds] = await Promise.all([
        apiFetch<Booking[]>("/bookings", { token }),
        apiFetch<string[]>("/reviews/my-reviews", { token }).catch(() => [] as string[]),
      ]);
      setBookings(data ?? []);
      setReviewed(new Set(reviewedIds));
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => {
    loadData();
    pollingRef.current = setInterval(() => loadData(true), 30_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(true); };

  const handleVoucherRequest = async (bookingId: string) => {
    Alert.alert(
      "Bon de voyage",
      "Voulez-vous convertir cette réservation en bon de voyage ? Votre crédit sera ajouté à votre compte fidélité.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          style: "default",
          onPress: async () => {
            try {
              await apiFetch(`/bookings/${bookingId}/voucher`, { token, method: "POST" });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Bon émis", "Votre bon de voyage a été ajouté à votre espace fidélité.");
              loadData(true);
            } catch {
              Alert.alert("Erreur", "Impossible d'émettre le bon. Veuillez réessayer.");
            }
          },
        },
      ]
    );
  };

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 100;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerTitle}>Mes Réservations</Text>
          {bookings.length > 0 && (
            <Text style={styles.headerSub}>{bookings.length} trajet{bookings.length > 1 ? "s" : ""}</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={styles.historyBtn} onPress={() => { Haptics.selectionAsync(); router.push("/client/bons" as any); }}>
            <Feather name="gift" size={15} color="white" />
            <Text style={styles.historyBtnText}>Mes bons</Text>
          </Pressable>
          <Pressable style={styles.historyBtn} onPress={() => { Haptics.selectionAsync(); router.push("/payment/history"); }}>
            <Feather name="clock" size={15} color="white" />
            <Text style={styles.historyBtnText}>Paiements</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BookingCard
              item={item}
              reviewed={reviewed}
              token={token}
              onVoucherRequest={handleVoucherRequest}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Feather name={token ? "bookmark" : "lock"} size={40} color={Colors.light.primary} />
              </View>
              {token ? (
                <>
                  <Text style={styles.emptyTitle}>Aucune réservation</Text>
                  <Text style={styles.emptySubtitle}>Vos réservations de voyage apparaîtront ici</Text>
                  <Pressable style={styles.bookNowBtn} onPress={() => router.push("/(tabs)")}>
                    <Feather name="search" size={16} color="white" />
                    <Text style={styles.bookNowText}>Rechercher un trajet</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>Non connecté</Text>
                  <Text style={styles.emptySubtitle}>Connectez-vous pour voir vos réservations</Text>
                  <Pressable style={styles.bookNowBtn} onPress={() => router.push("/(auth)/login")}>
                    <Feather name="log-in" size={16} color="white" />
                    <Text style={styles.bookNowText}>Se connecter</Text>
                  </Pressable>
                </>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.light.background },
  header:       { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:  { fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  headerSub:    { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  historyBtn:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  historyBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },

  card:         { backgroundColor: Colors.light.card, borderRadius: 20, padding: 18, marginBottom: 12, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  cardPressed:  { transform: [{ scale: 0.98 }] },
  cardExpired:  { borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FFF9F9" },
  cardCancelled:{ borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FFF9F9" },
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

  rule45Banner: { flexDirection: "row", alignItems: "flex-start", gap: 5, backgroundColor: "#EFF6FF", borderRadius: 8, padding: 8, marginTop: 6, borderWidth: 1, borderColor: "#BFDBFE" },
  rule45Text:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "#1D4ED8", flex: 1 },

  cardFooter:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  methodRow:    { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  methodText:   { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textMuted },
  seatRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  seatText:     { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  amountText:   { fontSize: 17, fontFamily: "Inter_700Bold" },

  ctaBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, borderRadius: 14, paddingVertical: 13, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  ctaText:      { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
  waitingRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, borderRadius: 8, padding: 8 },
  waitingText:  { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },

  empty:        { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyIconWrap:{ width: 88, height: 88, borderRadius: 28, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:   { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text },
  emptySubtitle:{ fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  bookNowBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.primary, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8, shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  bookNowText:  { color: "white", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
