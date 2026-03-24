import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";
import { generateQRData } from "@/utils/qr";
import { scheduleLocalNotification } from "@/utils/notifications";

interface Booking {
  id: string;
  bookingRef: string;
  trip: {
    from: string;
    to: string;
    departureTime: string;
    arrivalTime: string;
    date: string;
    busName: string;
    busType: string;
    duration?: string;
  };
  seatNumbers: string[];
  passengers: { name: string; seatNumber: string }[];
  totalAmount: number;
  commissionAmount: number;
  commissionRate: number;
  netAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
}

// --- Deterministic QR-like matrix ---
function makeQrMatrix(seed: string, size = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const drawFinder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const onBorder = i === 0 || i === 6 || j === 0 || j === 6;
        const inInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (r + i < size && c + j < size)
          matrix[r + i][c + j] = onBorder || inInner;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  for (let r = 8; r < size - 8; r++) {
    for (let c = 8; c < size - 8; c++) {
      hash = (hash * 1664525 + 1013904223) & 0xffffffff;
      matrix[r][c] = (hash >>> 0) % 3 !== 0;
    }
  }
  return matrix;
}

function QRCode({ value, size = 164 }: { value: string; size?: number }) {
  const matrix = makeQrMatrix(value, 21);
  const cell = size / 21;
  return (
    <View style={{ width: size, height: size, backgroundColor: "white", padding: cell, borderRadius: 12 }}>
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((on, c) => (
            <View
              key={c}
              style={{
                width: cell,
                height: cell,
                backgroundColor: on ? "#0F172A" : "transparent",
                borderRadius: on ? 1.2 : 0,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// --- Helpers ---
const METHOD_LABELS: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN MoMo",
  wave: "Wave",
  card: "Carte bancaire",
};

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, accent && rowStyles.accentValue]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  value: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
    maxWidth: "58%",
    textAlign: "right",
  },
  accentValue: {
    color: Colors.light.primary,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});

// ---

export default function ConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { token } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 16,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    apiFetch<Booking>(`/bookings/${bookingId}`, token ? { token } : {})
      .then((b) => {
        setBooking(b);
        if (b?.bookingRef) {
          scheduleLocalNotification(
            "GoBooking 🎫",
            `Réservation confirmée ! Référence : ${b.bookingRef}`
          ).catch(() => {});
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  const handleDownload = async () => {
    if (!booking) return;
    try {
      await Share.share({
        title: `Billet GoBooking — ${booking.bookingRef}`,
        message: [
          `🎫 BILLET GOBOOKING`,
          `Référence : ${booking.bookingRef}`,
          `Trajet    : ${booking.trip.from} → ${booking.trip.to}`,
          `Compagnie : ${booking.trip.busName}`,
          `Date      : ${booking.trip.date}`,
          `Départ    : ${booking.trip.departureTime}`,
          `Arrivée   : ${booking.trip.arrivalTime}`,
          `Siège(s)  : ${booking.seatNumbers.join(", ")}`,
          `Passager  : ${booking.passengers.map((p) => p.name).join(", ")}`,
          `Montant   : ${booking.totalAmount.toLocaleString()} FCFA`,
          `Paiement  : ${METHOD_LABELS[booking.paymentMethod] || booking.paymentMethod}`,
        ].join("\n"),
      });
    } catch {
      Alert.alert("Partage", "Impossible de partager le billet pour le moment.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Feather name="alert-circle" size={48} color="#CBD5E1" />
        <Text style={styles.errorText}>Réservation introuvable</Text>
      </View>
    );
  }

  const passengerNames = booking.passengers.map((p) => p.name || "—").join(", ");

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Success banner ── */}
        <LinearGradient colors={["#059669", "#047857"]} style={styles.banner}>
          <Animated.View
            style={[styles.checkCircle, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}
          >
            <Feather name="check" size={40} color="white" />
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, alignItems: "center", gap: 6 }}>
            <Text style={styles.bannerTitle}>Billet confirmé</Text>
            <Text style={styles.bannerSub}>Votre réservation a bien été enregistrée</Text>

            <View style={styles.refBadge}>
              <Text style={styles.refLabel}>RÉFÉRENCE DE RÉSERVATION</Text>
              <Text style={styles.refValue}>#{booking.bookingRef}</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ── Ticket card ── */}
        <View style={styles.ticketCard}>

          {/* Company header */}
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryDark]}
            style={styles.ticketHeader}
          >
            <View>
              <Text style={styles.ticketCompany}>{booking.trip.busName}</Text>
              <Text style={styles.ticketType}>{booking.trip.busType}</Text>
            </View>
            <View style={styles.confirmedBadge}>
              <Feather name="check-circle" size={12} color="#059669" />
              <Text style={styles.confirmedText}>Confirmé</Text>
            </View>
          </LinearGradient>

          {/* Route hero */}
          <View style={styles.routeHero}>
            <View style={styles.heroCity}>
              <Text style={styles.heroTime}>{booking.trip.departureTime}</Text>
              <Text style={styles.heroCityName}>{booking.trip.from}</Text>
              <Text style={styles.heroLabel}>Départ</Text>
            </View>

            <View style={styles.heroMid}>
              <View style={styles.midDotGreen} />
              <View style={styles.midLine} />
              <View style={styles.busIconBox}>
                <Feather name="arrow-right" size={16} color={Colors.light.primary} />
              </View>
              <View style={styles.midLine} />
              <View style={styles.midDotRed} />
            </View>

            <View style={[styles.heroCity, { alignItems: "flex-end" }]}>
              <Text style={styles.heroTime}>{booking.trip.arrivalTime}</Text>
              <Text style={styles.heroCityName}>{booking.trip.to}</Text>
              <Text style={[styles.heroLabel, { textAlign: "right" }]}>Arrivée</Text>
            </View>
          </View>

          {/* Detail rows */}
          <View style={styles.detailsSection}>
            <Row label="Route" value={`${booking.trip.from} → ${booking.trip.to}`} />
            <Row label="Compagnie" value={booking.trip.busName} />
            <Row label="Date" value={booking.trip.date} />
            <Row label="Départ" value={booking.trip.departureTime} />
            <Row label="Arrivée" value={booking.trip.arrivalTime} />
            <Row
              label={`Siège${booking.seatNumbers.length > 1 ? "s" : ""}`}
              value={booking.seatNumbers.join(", ")}
            />
            <Row
              label={`Passager${booking.passengers.length > 1 ? "s" : ""}`}
              value={passengerNames}
            />
            <Row
              label="Mode de paiement"
              value={METHOD_LABELS[booking.paymentMethod] || booking.paymentMethod}
            />
            <View style={[rowStyles.row, { borderBottomWidth: 0 }]}>
              <Text style={[rowStyles.label, { fontFamily: "Inter_600SemiBold", color: "#0F172A" }]}>
                Montant payé
              </Text>
              <Text style={rowStyles.accentValue}>
                {booking.totalAmount.toLocaleString()} FCFA
              </Text>
            </View>

            {/* ── Ventilation commission ── */}
            {booking.commissionAmount > 0 && (
              <View style={{
                marginTop: 8, backgroundColor: "#F8FAFC", borderRadius: 10,
                padding: 12, gap: 8, borderWidth: 1, borderColor: "#E2E8F0",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
                  <Feather name="info" size={11} color="#64748B" />
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Détail du règlement
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: "#64748B", fontFamily: "Inter_400Regular" }}>Montant total</Text>
                  <Text style={{ fontSize: 12, color: "#0F172A", fontFamily: "Inter_600SemiBold" }}>
                    {booking.totalAmount.toLocaleString()} FCFA
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 12, color: "#DC2626", fontFamily: "Inter_400Regular" }}>Commission plateforme</Text>
                    <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 }}>
                      <Text style={{ fontSize: 9, color: "#DC2626", fontFamily: "Inter_700Bold" }}>
                        {booking.commissionRate > 0 ? `${booking.commissionRate}%` : "GoBooking"}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: "#DC2626", fontFamily: "Inter_600SemiBold" }}>
                    -{booking.commissionAmount.toLocaleString()} FCFA
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: "#E2E8F0" }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: "#059669", fontFamily: "Inter_600SemiBold" }}>Revenu compagnie</Text>
                  <Text style={{ fontSize: 12, color: "#059669", fontFamily: "Inter_700Bold" }}>
                    {(booking.totalAmount - booking.commissionAmount).toLocaleString()} FCFA
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Perforation */}
          <View style={styles.perf}>
            <View style={styles.perfCircleL} />
            <View style={styles.perfDash} />
            <View style={styles.perfCircleR} />
          </View>

          {/* QR code */}
          <View style={styles.qrSection}>
            <Text style={styles.qrHint}>Scanner pour valider à l'embarquement</Text>
            <View style={styles.qrFrame}>
              <QRCode value={generateQRData(booking.bookingRef, "passager")} size={160} />
              <View style={styles.qrLogoBox}>
                <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={styles.qrLogo}>
                  <Text style={styles.qrLogoText}>GB</Text>
                </LinearGradient>
              </View>
            </View>
            <Text style={styles.qrRef}>{booking.bookingRef}</Text>
          </View>
        </View>

        {/* ── Info notice ── */}
        <View style={styles.infoBox}>
          <Feather name="mail" size={15} color={Colors.light.primary} />
          <Text style={styles.infoText}>
            Votre billet a été envoyé à{" "}
            <Text style={styles.infoBold}>{booking.contactEmail || "votre adresse email"}</Text>.
            Présentez ce QR code lors de l'embarquement.
          </Text>
        </View>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.7 }]}
            onPress={handleDownload}
          >
            <Feather name="download" size={17} color={Colors.light.primary} />
            <Text style={styles.outlineBtnText}>Télécharger le billet</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.solidBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Feather name="home" size={17} color="white" />
            <Text style={styles.solidBtnText}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 8,
  },

  // Banner
  banner: {
    alignItems: "center",
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
  },
  bannerTitle: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "white",
    textAlign: "center",
  },
  bannerSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
  },
  refBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  refLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.2,
  },
  refValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "white",
    marginTop: 3,
    letterSpacing: 1,
  },

  // Ticket card
  ticketCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: -26,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 7,
    marginBottom: 12,
  },

  // Ticket header
  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 14,
  },
  ticketCompany: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  ticketType: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confirmedText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#059669",
  },

  // Route hero
  routeHero: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
    backgroundColor: "#FAFBFF",
  },
  heroCity: { flex: 1 },
  heroTime: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  heroCityName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#334155",
    marginTop: 1,
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 2,
  },
  heroMid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  midDotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  midDotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  midLine: { flex: 1, height: 1.5, backgroundColor: "#CBD5E1" },
  busIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },

  // Detail rows
  detailsSection: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 8,
  },

  // Perforation
  perf: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  perfCircleL: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    marginLeft: -13,
  },
  perfDash: {
    flex: 1,
    height: 1.5,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
  },
  perfCircleR: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    marginRight: -13,
  },

  // QR
  qrSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingBottom: 28,
    gap: 12,
  },
  qrHint: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  qrFrame: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  qrLogoBox: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  qrLogo: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  qrLogoText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  qrRef: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    letterSpacing: 2.5,
  },

  // Info box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.primary,
    lineHeight: 20,
  },
  infoBold: { fontFamily: "Inter_700Bold" },

  // Actions
  actions: {
    paddingHorizontal: 16,
    gap: 10,
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  outlineBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  solidBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  solidBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
});
