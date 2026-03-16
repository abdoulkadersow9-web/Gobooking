import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
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

export default function SeatSelectionScreen() {
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { booking, updateBooking } = useBooking();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<Seat[]>(`/trips/${tripId}/seats`);
        setSeats(data);
      } catch {
        setSeats([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tripId]);

  const toggleSeat = (seat: Seat) => {
    if (seat.status === "booked") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) =>
      prev.includes(seat.id)
        ? prev.filter((s) => s !== seat.id)
        : [...prev, seat.id]
    );
  };

  const selectedSeats = seats.filter((s) => selected.includes(s.id));
  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const handleContinue = () => {
    if (!selected.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const rows = Array.from(new Set(seats.map((s) => s.row))).sort((a, b) => a - b);

  const getSeatColor = (seat: Seat) => {
    if (seat.status === "booked") return "#E2E8F0";
    if (selected.includes(seat.id)) return Colors.light.primary;
    return "#F1F5F9";
  };

  const getSeatTextColor = (seat: Seat) => {
    if (seat.status === "booked") return Colors.light.textMuted;
    if (selected.includes(seat.id)) return "white";
    return Colors.light.text;
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Select Seats</Text>
        <Text style={styles.headerSub}>{selected.length} selected</Text>
      </View>

      <View style={styles.legend}>
        {[
          { color: "#F1F5F9", label: "Available" },
          { color: Colors.light.primary, label: "Selected" },
          { color: "#E2E8F0", label: "Booked" },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color, borderWidth: l.color === "#F1F5F9" ? 1 : 0, borderColor: Colors.light.border }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.busLayout}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.busContainer}>
            <View style={styles.busTop}>
              <Feather name="navigation" size={20} color={Colors.light.primary} />
              <Text style={styles.busTopText}>Driver</Text>
            </View>

            {rows.map((row) => {
              const rowSeats = seats.filter((s) => s.row === row);
              const left = rowSeats.filter((s) => s.column <= 2);
              const right = rowSeats.filter((s) => s.column > 2);

              return (
                <View key={row} style={styles.seatRow}>
                  <Text style={styles.rowLabel}>{row}</Text>
                  <View style={styles.leftSeats}>
                    {left.map((seat) => (
                      <Pressable
                        key={seat.id}
                        style={[
                          styles.seat,
                          {
                            backgroundColor: getSeatColor(seat),
                            opacity: seat.status === "booked" ? 0.5 : 1,
                          },
                        ]}
                        onPress={() => toggleSeat(seat)}
                        disabled={seat.status === "booked"}
                      >
                        <Text style={[styles.seatText, { color: getSeatTextColor(seat) }]}>
                          {seat.number}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.aisle} />
                  <View style={styles.rightSeats}>
                    {right.map((seat) => (
                      <Pressable
                        key={seat.id}
                        style={[
                          styles.seat,
                          {
                            backgroundColor: getSeatColor(seat),
                            opacity: seat.status === "booked" ? 0.5 : 1,
                          },
                        ]}
                        onPress={() => toggleSeat(seat)}
                        disabled={seat.status === "booked"}
                      >
                        <Text style={[styles.seatText, { color: getSeatTextColor(seat) }]}>
                          {seat.number}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {selected.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <View>
            <Text style={styles.selectedInfo}>
              Seats: {selectedSeats.map((s) => s.number).join(", ")}
            </Text>
            <Text style={styles.totalPrice}>${totalPrice}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
            onPress={handleContinue}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="white" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.primary,
  },
  legend: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  busLayout: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
    alignItems: "center",
  },
  busContainer: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.light.border,
    width: "100%",
    maxWidth: 300,
  },
  busTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: Colors.light.border,
    borderStyle: "dashed",
  },
  busTopText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
  },
  seatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  rowLabel: {
    width: 20,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textMuted,
    textAlign: "center",
  },
  leftSeats: {
    flexDirection: "row",
    gap: 4,
  },
  rightSeats: {
    flexDirection: "row",
    gap: 4,
  },
  aisle: {
    flex: 1,
  },
  seat: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  seatText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  selectedInfo: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  totalPrice: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  continueBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
});
