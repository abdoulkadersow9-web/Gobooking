import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { apiFetch } from "@/utils/api";
import { SkeletonBookingCard } from "@/components/SkeletonCard";
import { Toast, useToast } from "@/components/Toast";

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
  en_attente: { color: "#D97706", bg: "#FFFBEB",  label: "En attente",  icon: "clock"         },
  confirmé:   { color: "#1650D0", bg: "#EEF4FF",  label: "Confirmé",    icon: "check"         },
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
  label:     { fontSize: 10, fontFamily: "Inter_500Medium", color: "#94A3B8", marginTop: 3, textAlign: "center" },
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
        { borderLeftColor: cfg.color },
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
          <Text style={styles.timeText} numberOfLines={1}>{item.trip?.departureTime ?? "—"}</Text>
          <Text style={styles.cityText} numberOfLines={1}>{item.trip?.from ?? "—"}</Text>
        </View>
        <View style={styles.routeMiddle}>
          <View style={styles.routeLine} />
          <Feather name="arrow-right" size={14} color={Colors.light.textMuted} />
          <View style={styles.routeLine} />
        </View>
        <View style={[styles.cityBlock, { alignItems: "flex-end" }]}>
          <Text style={styles.timeText} numberOfLines={1}>{item.trip?.arrivalTime ?? "—"}</Text>
          <Text style={styles.cityText} numberOfLines={1}>{item.trip?.to ?? "—"}</Text>
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
        <View style={[styles.amountBadge, {
          backgroundColor: isExpired || isCancelled ? "#F1F5F9"
                         : isPaid ? "#EEF4FF"
                         : "#FFFBEB"
        }]}>
          <Text style={[styles.amountText, {
            color: isExpired || isCancelled ? "#9CA3AF"
                 : isPaid ? Colors.light.primary
                 : "#D97706"
          }]}>
            {(item.totalAmount ?? 0).toLocaleString()} F
          </Text>
        </View>
      </View>

      {/* CTA: Payer maintenant */}
      {needsPay && minsLeft !== null && minsLeft > 0 && (
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, { overflow: "hidden" }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          onPress={(e) => {
            e.stopPropagation?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: "/payment/cinetpay",
              params: { bookingId: item.id, amount: String(item.totalAmount), bookingRef: item.bookingRef },
            });
          }}
        >
          <LinearGradient
            colors={["#059669", "#047857"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
          />
          <Feather name="credit-card" size={15} color="white" />
          <Text style={[styles.ctaText, { fontSize: 15 }]}>Payer maintenant</Text>
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
          <Feather name="star" size={14} color="#7C2D12" />
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

// ─── Animated booking card with entrance effect ───────────────────────────────
function AnimatedBookingCard({ item, index, reviewed, token, onVoucherRequest }: {
  item: Booking; index: number; reviewed: Set<string>; token: string | null;
  onVoucherRequest: (id: string) => void;
}) {
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
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
    }}>
      <BookingCard item={item} reviewed={reviewed} token={token} onVoucherRequest={onVoucherRequest} />
    </Animated.View>
  );
}

type FilterKey = "tous" | "en_cours" | "terminés";

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewed,   setReviewed]   = useState<Set<string>>(new Set());
  const [filter,     setFilter]     = useState<FilterKey>("tous");
  const [netError,   setNetError]   = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast, show: showToast } = useToast();

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
      setNetError(false);
    } catch {
      if (!silent) setNetError(true);
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => {
    loadData();
    pollingRef.current = setInterval(() => loadData(true), 30_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

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
              await apiFetch(`/bookings/${bookingId}/voucher`, { token: token ?? undefined, method: "POST" });
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

  const FILTER_TABS: { key: FilterKey; label: string }[] = [
    { key: "tous",    label: `Tous${bookings.length ? ` (${bookings.length})` : ""}` },
    { key: "en_cours", label: `En cours (${bookings.filter(b => ["en_attente","confirmé"].includes(computeState(b))).length})` },
    { key: "terminés", label: `Terminés (${bookings.filter(b => ["embarqué","bon_emis","payé"].includes(computeState(b))).length})` },
  ];

  const filteredBookings = bookings.filter(b => {
    const st = computeState(b);
    if (filter === "en_cours") return ["en_attente", "confirmé"].includes(st);
    if (filter === "terminés") return ["payé", "embarqué", "bon_emis", "expiré", "annulé"].includes(st);
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Toast */}
      <Toast {...toast} />

      <LinearGradient
        colors={["#1650D0", "#1030B4", "#0A1C84"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 18 }]}
      >
        <View>
          <Text style={styles.headerTitle}>Mes Réservations</Text>
          {bookings.length > 0 && (
            <Text style={styles.headerSub}>{bookings.length} trajet{bookings.length > 1 ? "s" : ""} au total</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={styles.historyBtn} onPress={() => { Haptics.selectionAsync(); router.push("/client/bons" as any); }}>
            <Feather name="gift" size={15} color="white" />
            <Text style={styles.historyBtnText}>Bons</Text>
          </Pressable>
          <Pressable style={styles.historyBtn} onPress={() => { Haptics.selectionAsync(); router.push("/payment/history"); }}>
            <Feather name="clock" size={15} color="white" />
            <Text style={styles.historyBtnText}>Paiements</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => { Haptics.selectionAsync(); setFilter(tab.key); }}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Network error banner */}
      {netError && !loading && (
        <Pressable
          style={styles.errorBanner}
          onPress={() => { setNetError(false); loadData(); }}
        >
          <Feather name="wifi-off" size={15} color="#DC2626" />
          <Text style={styles.errorText}>Connexion impossible — Appuyez pour réessayer</Text>
          <Feather name="refresh-cw" size={13} color="#DC2626" />
        </Pressable>
      )}

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
          {[0, 1, 2].map(i => <SkeletonBookingCard key={i} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <AnimatedBookingCard
              item={item}
              index={index}
              reviewed={reviewed}
              token={token}
              onVoucherRequest={handleVoucherRequest}
            />
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: bottomPad }}
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
  header:       { paddingHorizontal: 22, paddingBottom: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:  { fontSize: 26, fontFamily: "Inter_700Bold", color: "white", letterSpacing: -0.6 },
  headerSub:    { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.72)", marginTop: 5 },
  historyBtn:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 22, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  historyBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "white" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },

  filterBar:         { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#ECEEF8", maxHeight: 62 },
  filterBarContent:  { paddingHorizontal: 20, paddingVertical: 13, gap: 10, flexDirection: "row", alignItems: "center" },
  filterTab:         { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 22, backgroundColor: "#F4F6FF", borderWidth: 1.5, borderColor: "transparent" },
  filterTabActive:   { backgroundColor: "#EEF4FF", borderColor: "#1650D0" },
  filterTabText:     { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  filterTabTextActive: { color: "#1650D0", fontFamily: "Inter_700Bold" },

  card:         {
    backgroundColor: "white", borderRadius: 24, padding: 22, marginBottom: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 7,
    borderWidth: 1, borderColor: "#ECEEF8", borderLeftWidth: 5,
  },
  cardPressed:  { transform: [{ scale: 0.982 }], opacity: 0.95 },
  cardExpired:  { borderColor: "#FECACA", backgroundColor: "#FFFAFA" },
  cardCancelled:{ borderColor: "#FECACA", backgroundColor: "#FFFAFA" },
  cardHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  refText:      { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -0.2 },
  dateText:     { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 3 },
  statusBadge:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 22 },
  statusText:   { fontSize: 12, fontFamily: "Inter_700Bold" },

  routeRow:     { flexDirection: "row", alignItems: "center", marginBottom: 18, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "#ECEEF8" },
  cityBlock:    { flex: 1 },
  timeText:     { fontSize: 28, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -1.2 },
  cityText:     { fontSize: 14, fontFamily: "Inter_500Medium", color: "#64748B", marginTop: 5 },
  routeMiddle:  { flexDirection: "row", alignItems: "center", gap: 4 },
  routeLine:    { width: 32, height: 1.5, backgroundColor: "#E2E8F0" },

  rule45Banner: { flexDirection: "row", alignItems: "flex-start", gap: 5, backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: "#BFDBFE" },
  rule45Text:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "#1D4ED8", flex: 1, lineHeight: 16 },

  cardFooter:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 },
  methodRow:    { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  methodText:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  seatRow:      { flexDirection: "row", alignItems: "center", gap: 5 },
  seatText:     { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  amountBadge:  { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  amountText:   { fontSize: 21, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },

  ctaBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16, borderRadius: 18, paddingVertical: 17, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5 },
  ctaText:      { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
  waitingRow:   { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, borderRadius: 12, padding: 12 },
  waitingText:  { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 16 },

  empty:        { alignItems: "center", paddingTop: 80, gap: 16 },
  emptyIconWrap:{ width: 96, height: 96, borderRadius: 28, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 6, borderWidth: 1, borderColor: "#C7D2FE" },
  emptyTitle:   { fontSize: 22, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: -0.4 },
  emptySubtitle:{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", lineHeight: 22 },
  bookNowBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.primary, borderRadius: 18, paddingHorizontal: 30, paddingVertical: 16, marginTop: 8, shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 5 },
  bookNowText:  { color: "white", fontSize: 15, fontFamily: "Inter_700Bold" },

  errorBanner:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 14, marginHorizontal: 20, marginTop: 10, paddingHorizontal: 16, paddingVertical: 12 },
  errorText:    { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626" },
});
