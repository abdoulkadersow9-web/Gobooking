import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
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
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
}

// Deterministic QR-like matrix from a string
function makeQrMatrix(seed: string, size = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  // Finder pattern (top-left corner)
  const drawFinder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const onBorder = i === 0 || i === 6 || j === 0 || j === 6;
        const inInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (r + i < size && c + j < size) {
          matrix[r + i][c + j] = onBorder || inInner;
        }
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Fill data area with hash of seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  for (let r = 8; r < size - 8; r++) {
    for (let c = 8; c < size - 8; c++) {
      hash = (hash * 1664525 + 1013904223) & 0xffffffff;
      matrix[r][c] = (hash >>> 0) % 3 !== 0;
    }
  }
  return matrix;
}

function QRCode({ value, size = 160 }: { value: string; size?: number }) {
  const matrix = makeQrMatrix(value, 21);
  const cellSize = size / 21;
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: "white",
        padding: cellSize,
        borderRadius: 12,
      }}
    >
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((on, c) => (
            <View
              key={c}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: on ? "#0F172A" : "transparent",
                borderRadius: on ? 1 : 0,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const METHOD_LABELS: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN MoMo",
  wave: "Wave",
  card: "Carte bancaire",
};

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
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 14,
          bounciness: 14,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<Booking>(`/bookings/${bookingId}`, { token })
      .then(setBooking)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [bookingId, token]);

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
        <Text style={styles.errorText}>Réservation introuvable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Success banner */}
        <LinearGradient
          colors={["#059669", "#047857"]}
          style={styles.successBanner}
        >
          <Animated.View
            style={[
              styles.checkCircle,
              { transform: [{ scale: scaleAnim }], opacity: fadeAnim },
            ]}
          >
            <Feather name="check" size={38} color="white" />
          </Animated.View>
          <Animated.View style={{ opacity: fadeAnim, alignItems: "center", gap: 6 }}>
            <Text style={styles.successTitle}>Billet confirmé !</Text>
            <Text style={styles.successSubtitle}>
              Votre réservation a bien été enregistrée
            </Text>
            <View style={styles.refBadge}>
              <Text style={styles.refLabel}>Référence de réservation</Text>
              <Text style={styles.refValue}>#{booking.bookingRef}</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Ticket card with QR */}
        <View style={styles.ticketCard}>
          {/* Ticket top — route + company */}
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryDark]}
            style={styles.ticketTop}
          >
            <Text style={styles.ticketBusName}>{booking.trip.busName}</Text>
            <View style={styles.ticketTypeBadge}>
              <Text style={styles.ticketTypeBadgeText}>{booking.trip.busType}</Text>
            </View>
          </LinearGradient>

          {/* Route section */}
          <View style={styles.ticketRoute}>
            <View style={styles.ticketCity}>
              <Text style={styles.ticketTime}>{booking.trip.departureTime}</Text>
              <Text style={styles.ticketCityName}>{booking.trip.from}</Text>
            </View>
            <View style={styles.ticketMid}>
              <View style={styles.dotGreen} />
              <View style={styles.ticketLine} />
              <Feather name="arrow-right" size={14} color={Colors.light.primary} />
              <View style={styles.ticketLine} />
              <View style={styles.dotRed} />
            </View>
            <View style={[styles.ticketCity, { alignItems: "flex-end" }]}>
              <Text style={styles.ticketTime}>{booking.trip.arrivalTime}</Text>
              <Text style={styles.ticketCityName}>{booking.trip.to}</Text>
            </View>
          </View>
          <Text style={styles.ticketDate}>{booking.trip.date}</Text>

          {/* Details grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>SIÈGE(S)</Text>
              <Text style={styles.detailValue}>{booking.seatNumbers.join(", ")}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>PASSAGERS</Text>
              <Text style={styles.detailValue}>{booking.passengers.length}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>PAIEMENT</Text>
              <Text style={styles.detailValue}>
                {METHOD_LABELS[booking.paymentMethod] || booking.paymentMethod.toUpperCase()}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>MONTANT</Text>
              <Text style={[styles.detailValue, { color: Colors.light.primary }]}>
                {booking.totalAmount.toLocaleString()} FCFA
              </Text>
            </View>
          </View>

          {/* Perforation divider */}
          <View style={styles.perforationRow}>
            <View style={styles.perfCircleLeft} />
            <View style={styles.perforationDash} />
            <View style={styles.perfCircleRight} />
          </View>

          {/* QR code section */}
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Scanner pour valider</Text>
            <View style={styles.qrWrapper}>
              <QRCode value={booking.bookingRef} size={148} />
              <View style={styles.qrOverlay}>
                <View style={styles.qrLogo}>
                  <Text style={styles.qrLogoText}>GB</Text>
                </View>
              </View>
            </View>
            <Text style={styles.qrRef}>{booking.bookingRef}</Text>
            <View style={[
              styles.statusPill,
              booking.status === "confirmed" ? styles.statusConfirmed : styles.statusPending,
            ]}>
              <View style={[
                styles.statusDot,
                { backgroundColor: booking.status === "confirmed" ? "#059669" : "#D97706" },
              ]} />
              <Text style={[
                styles.statusText,
                { color: booking.status === "confirmed" ? "#059669" : "#D97706" },
              ]}>
                {booking.status === "confirmed" ? "Confirmé" : "En attente"}
              </Text>
            </View>
          </View>
        </View>

        {/* Passengers card */}
        {booking.passengers.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Passagers</Text>
            {booking.passengers.map((p, i) => (
              <View key={i} style={styles.paxRow}>
                <View style={styles.paxNum}>
                  <Text style={styles.paxNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.paxName}>{p.name || "Passager " + (i + 1)}</Text>
                <View style={styles.seatChip}>
                  <Feather name="grid" size={11} color={Colors.light.primary} />
                  <Text style={styles.seatChipText}>Siège {p.seatNumber}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Info card */}
        <View style={[styles.card, styles.infoCard]}>
          <Feather name="info" size={16} color="#1A56DB" />
          <Text style={styles.infoText}>
            Votre billet a été envoyé à{" "}
            <Text style={styles.infoBold}>{booking.contactEmail || "votre adresse email"}</Text>.
            Présentez ce QR code lors de l'embarquement.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
          >
            <Feather name="file-text" size={16} color={Colors.light.primary} />
            <Text style={styles.outlineBtnText}>Voir le billet</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.solidBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Feather name="home" size={16} color="white" />
            <Text style={styles.solidBtnText}>Accueil</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },

  // Success banner
  successBanner: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 24,
    gap: 10,
  },
  checkCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  successTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "white",
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  refBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  refLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  refValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "white",
    marginTop: 2,
  },

  // Ticket card
  ticketCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 12,
  },
  ticketTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 14,
  },
  ticketBusName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  ticketTypeBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ticketTypeBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
  ticketRoute: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 4,
  },
  ticketCity: { flex: 1 },
  ticketTime: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  ticketCityName: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  ticketMid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dotGreen: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  dotRed: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  ticketLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#E2E8F0",
  },
  ticketDate: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },

  // Details grid
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 16,
  },
  detailItem: {
    width: "45%",
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },

  // Perforation
  perforationRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    marginBottom: 0,
  },
  perfCircleLeft: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    marginLeft: -12,
  },
  perforationDash: {
    flex: 1,
    height: 1.5,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
  },
  perfCircleRight: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    marginRight: -12,
  },

  // QR section
  qrSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  qrLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  qrWrapper: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  qrOverlay: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  qrLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  qrLogoText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  qrRef: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    letterSpacing: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusConfirmed: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusPending: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Cards
  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    marginBottom: 12,
  },
  paxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  paxNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  paxNumText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  paxName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#0F172A",
  },
  seatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  seatChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },

  // Info card
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EEF2FF",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.primary,
    lineHeight: 20,
  },
  infoBold: {
    fontFamily: "Inter_600SemiBold",
  },

  // Actions
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  outlineBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  solidBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  solidBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
});
