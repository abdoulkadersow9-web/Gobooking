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
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useBooking } from "@/context/BookingContext";
import { apiFetch } from "@/utils/api";

interface Seat {
  id: string;
  number: string;
  row: number;
  column: number;
  type: "window" | "aisle" | "middle";
  status: "available" | "booked" | "selected";
  price: number;
}

const SEAT_AVAILABLE        = "#D1FAE5";
const SEAT_AVAILABLE_BORDER = "#10B981";
const SEAT_AVAILABLE_TEXT   = "#065F46";

const SEAT_BOOKED        = "#FEE2E2";
const SEAT_BOOKED_BORDER = "#EF4444";
const SEAT_BOOKED_TEXT   = "#B91C1C";

const SEAT_HELD        = "#FEF3C7";
const SEAT_HELD_BORDER = "#F59E0B";
const SEAT_HELD_TEXT   = "#92400E";

const SEAT_SELECTED        = "#1A56DB";
const SEAT_SELECTED_BORDER = "#0F3BA0";
const SEAT_SELECTED_TEXT   = "#FFFFFF";

export default function SeatSelectionScreen() {
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { token } = useAuth();
  const { booking, updateBooking } = useBooking();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [lastTapped, setLastTapped] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const popAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const loadSeats = async () => {
    try {
      const data = await apiFetch<Seat[]>(`/trips/${tripId}/seats`);
      setSeats(data);
    } catch {
      setSeats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeats();
  }, [tripId]);

  const isUnavailable = (seat: Seat) =>
    seat.status === "booked" || (seat.status === "selected" && !selected.includes(seat.id));

  const toggleSeat = (seat: Seat) => {
    if (isUnavailable(seat)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLastTapped(seat.id);
    Animated.sequence([
      Animated.spring(popAnim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.delay(800),
      Animated.spring(popAnim, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 0 }),
    ]).start();
    setSelected((prev) =>
      prev.includes(seat.id)
        ? prev.filter((s) => s !== seat.id)
        : [...prev, seat.id]
    );
  };

  /* ── Bloquer les sièges en base avant de passer à l'étape suivante ── */
  const handleContinue = async () => {
    if (!selected.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setHolding(true);
    try {
      await apiFetch(`/trips/${tripId}/seats/hold`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({ seatIds: selected }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Siège(s) indisponible(s)";
      Alert.alert(
        "Siège indisponible",
        msg + "\n\nLa liste des sièges va être actualisée.",
        [{ text: "OK", onPress: () => { setSelected([]); loadSeats(); } }]
      );
      setHolding(false);
      return;
    } finally {
      setHolding(false);
    }

    const selectedSeats = seats.filter((s) => selected.includes(s.id));
    const seatNumbers = selectedSeats.map((s) => s.number);
    updateBooking({
      selectedSeats: selected,
      selectedSeatNumbers: seatNumbers,
      totalAmount: totalPrice,
      passengers: seatNumbers.map((num) => ({
        name: "",
        age: "",
        gender: "male" as const,
        idType: "passport",
        idNumber: "",
        seatNumber: num,
      })),
    });
    router.push("/passengers");
  };

  const selectedSeatObjs = seats.filter((s) => selected.includes(s.id));
  const totalPrice = selectedSeatObjs.reduce((sum, s) => sum + s.price, 0);
  const rows = Array.from(new Set(seats.map((s) => s.row))).sort((a, b) => a - b);
  const tappedSeat = seats.find((s) => s.id === lastTapped);

  const getSeatStyle = (seat: Seat) => {
    const isLocallySelected = selected.includes(seat.id);
    if (isLocallySelected) return { bg: SEAT_SELECTED, border: SEAT_SELECTED_BORDER, text: SEAT_SELECTED_TEXT };
    if (seat.status === "booked") return { bg: SEAT_BOOKED, border: SEAT_BOOKED_BORDER, text: SEAT_BOOKED_TEXT };
    if (seat.status === "selected") return { bg: SEAT_HELD, border: SEAT_HELD_BORDER, text: SEAT_HELD_TEXT };
    return { bg: SEAT_AVAILABLE, border: SEAT_AVAILABLE_BORDER, text: SEAT_AVAILABLE_TEXT };
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={styles.header}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Choisir un siège</Text>
          <Text style={styles.headerSub}>
            {selected.length > 0
              ? `${selected.length} siège${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}`
              : "Appuyez sur un siège disponible"}
          </Text>
        </View>
        <View style={styles.seatCountBadge}>
          <Text style={styles.seatCountText}>{selected.length}</Text>
        </View>
      </LinearGradient>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSeat, { backgroundColor: SEAT_AVAILABLE, borderColor: SEAT_AVAILABLE_BORDER }]}>
            <Feather name="check" size={10} color={SEAT_AVAILABLE_TEXT} />
          </View>
          <Text style={styles.legendText}>Disponible</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSeat, { backgroundColor: SEAT_SELECTED, borderColor: SEAT_SELECTED_BORDER }]}>
            <Feather name="user" size={10} color="white" />
          </View>
          <Text style={styles.legendText}>Sélectionné</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSeat, { backgroundColor: SEAT_HELD, borderColor: SEAT_HELD_BORDER }]}>
            <Feather name="clock" size={10} color={SEAT_HELD_TEXT} />
          </View>
          <Text style={styles.legendText}>En cours</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSeat, { backgroundColor: SEAT_BOOKED, borderColor: SEAT_BOOKED_BORDER }]}>
            <Feather name="x" size={10} color={SEAT_BOOKED_TEXT} />
          </View>
          <Text style={styles.legendText}>Réservé</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Chargement des sièges...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: selected.length > 0 ? 140 : 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Column header */}
          <View style={styles.colHeader}>
            <View style={styles.rowLabelSpace} />
            <View style={styles.colLabels}>
              <Text style={styles.colLabelText}>A</Text>
              <Text style={styles.colLabelText}>B</Text>
            </View>
            <View style={styles.aisleGap} />
            <View style={styles.colLabels}>
              <Text style={styles.colLabelText}>C</Text>
              <Text style={styles.colLabelText}>D</Text>
            </View>
          </View>

          {/* Bus front */}
          <View style={styles.busFront}>
            <View style={styles.steeringWheel}>
              <Feather name="circle" size={22} color={Colors.light.primary} />
              <Feather name="navigation" size={12} color={Colors.light.primary} style={StyleSheet.absoluteFill as any} />
            </View>
            <Text style={styles.busFrontText}>Conducteur</Text>
          </View>
          <View style={styles.busDivider} />

          {/* Seat grid */}
          {rows.map((row) => {
            const rowSeats = seats
              .filter((s) => s.row === row)
              .sort((a, b) => a.column - b.column);
            const left = rowSeats.filter((s) => s.column <= 2);
            const right = rowSeats.filter((s) => s.column > 2);

            return (
              <View key={row} style={styles.seatRow}>
                <Text style={styles.rowLabel}>{row}</Text>
                <View style={styles.seatPair}>
                  {left.map((seat) => {
                    const s = getSeatStyle(seat);
                    return (
                      <Pressable
                        key={seat.id}
                        onPress={() => toggleSeat(seat)}
                        disabled={isUnavailable(seat)}
                        style={({ pressed }) => [
                          styles.seat,
                          {
                            backgroundColor: s.bg,
                            borderColor: s.border,
                            transform: pressed && !isUnavailable(seat) ? [{ scale: 0.92 }] : [],
                          },
                        ]}
                      >
                        <Feather
                          name={
                            seat.status === "booked" ? "x"
                            : seat.status === "selected" && !selected.includes(seat.id) ? "clock"
                            : selected.includes(seat.id) ? "user"
                            : "check"
                          }
                          size={11}
                          color={s.text}
                        />
                        <Text style={[styles.seatNum, { color: s.text }]}>{seat.number}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.aisle}>
                  <Text style={styles.aisleText}>│</Text>
                </View>
                <View style={styles.seatPair}>
                  {right.map((seat) => {
                    const s = getSeatStyle(seat);
                    return (
                      <Pressable
                        key={seat.id}
                        onPress={() => toggleSeat(seat)}
                        disabled={isUnavailable(seat)}
                        style={({ pressed }) => [
                          styles.seat,
                          {
                            backgroundColor: s.bg,
                            borderColor: s.border,
                            transform: pressed && !isUnavailable(seat) ? [{ scale: 0.92 }] : [],
                          },
                        ]}
                      >
                        <Feather
                          name={
                            seat.status === "booked" ? "x"
                            : seat.status === "selected" && !selected.includes(seat.id) ? "clock"
                            : selected.includes(seat.id) ? "user"
                            : "check"
                          }
                          size={11}
                          color={s.text}
                        />
                        <Text style={[styles.seatNum, { color: s.text }]}>{seat.number}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Seat pop tooltip */}
          {tappedSeat && (
            <Animated.View
              style={[
                styles.tooltip,
                {
                  opacity: popAnim,
                  transform: [{ scale: popAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.tooltipTitle}>
                {selected.includes(tappedSeat.id) ? "✓ Siège sélectionné" : "Siège désélectionné"}
              </Text>
              <Text style={styles.tooltipSeat}>{tappedSeat.number}</Text>
              <Text style={styles.tooltipPrice}>{tappedSeat.price.toLocaleString()} FCFA</Text>
            </Animated.View>
          )}
        </ScrollView>
      )}

      {/* Bottom bar */}
      {selected.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 12 }]}>
          <View style={styles.bottomInfo}>
            <View style={styles.selectedPills}>
              {selectedSeatObjs.slice(0, 4).map((s) => (
                <View key={s.id} style={styles.seatPill}>
                  <Text style={styles.seatPillText}>{s.number}</Text>
                </View>
              ))}
              {selectedSeatObjs.length > 4 && (
                <View style={[styles.seatPill, styles.seatPillMore]}>
                  <Text style={styles.seatPillText}>+{selectedSeatObjs.length - 4}</Text>
                </View>
              )}
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Total</Text>
              <Text style={styles.priceValue}>{totalPrice.toLocaleString()} FCFA</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              (pressed || holding) && styles.continueBtnPressed,
            ]}
            onPress={handleContinue}
            disabled={holding}
          >
            {holding ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={styles.continueBtnText}>Continuer vers paiement</Text>
                <Feather name="arrow-right" size={18} color="white" />
              </>
            )}
          </Pressable>
        </View>
      )}
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  seatCountBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  seatCountText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },

  // Legend
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendSeat: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  legendText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },

  // Scroll
  scrollContent: {
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 20,
  },

  // Column header
  colHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    width: "100%",
    maxWidth: 280,
  },
  rowLabelSpace: {
    width: 24,
  },
  colLabels: {
    flexDirection: "row",
    gap: 8,
  },
  colLabelText: {
    width: 44,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  aisleGap: {
    width: 28,
  },

  // Bus front
  busFront: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    marginBottom: 4,
    width: "100%",
    maxWidth: 280,
  },
  steeringWheel: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  busFrontText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  busDivider: {
    width: "100%",
    maxWidth: 280,
    height: 2,
    backgroundColor: "#CBD5E1",
    borderRadius: 1,
    marginBottom: 10,
    borderStyle: "dashed" as const,
  },

  // Seat row
  seatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    width: "100%",
    maxWidth: 280,
  },
  rowLabel: {
    width: 20,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textMuted,
    textAlign: "center",
  },
  seatPair: {
    flexDirection: "row",
    gap: 8,
  },
  aisle: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  aisleText: {
    fontSize: 18,
    color: "#CBD5E1",
    lineHeight: 18,
  },

  // Seat
  seat: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  seatNum: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    lineHeight: 12,
  },

  // Tooltip
  tooltip: {
    position: "absolute",
    alignSelf: "center",
    top: "45%",
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#1A56DB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: "#EEF2FF",
    zIndex: 100,
  },
  tooltipTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  tooltipSeat: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    lineHeight: 32,
  },
  tooltipPrice: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginTop: 2,
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "white",
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  bottomInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    flex: 1,
  },
  seatPill: {
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  seatPillMore: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  seatPillText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  priceRow: {
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  priceValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  continueBtn: {
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
  continueBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
});
