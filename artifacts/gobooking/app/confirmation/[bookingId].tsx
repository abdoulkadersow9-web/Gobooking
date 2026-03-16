import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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

export default function ConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { token } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const load = async () => {
      if (!token) return;
      try {
        const data = await apiFetch<Booking>(`/bookings/${bookingId}`, { token });
        setBooking(data);
      } catch {
        setBooking(null);
      } finally {
        setLoading(false);
      }
    };
    load();
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
        <Text style={styles.errorText}>Booking not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.light.success, "#059669"]}
          style={styles.successBanner}
        >
          <View style={styles.checkCircle}>
            <Feather name="check" size={36} color="white" />
          </View>
          <Text style={styles.successTitle}>Booking Confirmed!</Text>
          <Text style={styles.successSubtitle}>Your ticket has been booked successfully</Text>
          <View style={styles.refBadge}>
            <Text style={styles.refLabel}>Booking Reference</Text>
            <Text style={styles.refValue}>#{booking.bookingRef}</Text>
          </View>
        </LinearGradient>

        <View style={styles.ticketCard}>
          <View style={styles.ticketHeader}>
            <Text style={styles.busName}>{booking.trip.busName}</Text>
            <View style={styles.busTypeBadge}>
              <Text style={styles.busTypeText}>{booking.trip.busType}</Text>
            </View>
          </View>

          <View style={styles.routeSection}>
            <View style={styles.cityBlock}>
              <Text style={styles.time}>{booking.trip.departureTime}</Text>
              <Text style={styles.city}>{booking.trip.from}</Text>
            </View>
            <View style={styles.routeMid}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <Feather name="navigation" size={14} color={Colors.light.primary} />
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, { backgroundColor: Colors.light.error }]} />
            </View>
            <View style={[styles.cityBlock, { alignItems: "flex-end" }]}>
              <Text style={styles.time}>{booking.trip.arrivalTime}</Text>
              <Text style={styles.city}>{booking.trip.to}</Text>
            </View>
          </View>

          <Text style={styles.dateInfo}>{booking.trip.date}</Text>

          <View style={styles.ticketDivider}>
            <View style={styles.ticketCircleLeft} />
            <View style={styles.ticketDashedLine} />
            <View style={styles.ticketCircleRight} />
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Seats</Text>
              <Text style={styles.detailValue}>{booking.seatNumbers.join(", ")}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Passengers</Text>
              <Text style={styles.detailValue}>{booking.passengers.length}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Payment</Text>
              <Text style={styles.detailValue}>{booking.paymentMethod.toUpperCase()}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={[styles.detailValue, { color: Colors.light.primary }]}>
                {booking.totalAmount.toLocaleString()} FCFA
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.passengersCard}>
          <Text style={styles.cardTitle}>Passengers</Text>
          {booking.passengers.map((p, i) => (
            <View key={i} style={styles.paxRow}>
              <View style={styles.paxNum}>
                <Text style={styles.paxNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.paxName}>{p.name}</Text>
              <View style={styles.seatChip}>
                <Text style={styles.seatChipText}>Seat {p.seatNumber}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.cardTitle}>Confirmation Sent To</Text>
          <View style={styles.contactRow}>
            <Feather name="mail" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.contactText}>{booking.contactEmail}</Text>
          </View>
          <View style={styles.contactRow}>
            <Feather name="phone" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.contactText}>{booking.contactPhone}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
          >
            <Feather name="eye" size={16} color={Colors.light.primary} />
            <Text style={styles.secondaryBtnText}>View Booking</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: Colors.light.textSecondary, fontFamily: "Inter_400Regular" },
  successBanner: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 20,
    gap: 8,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
  refBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  refLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  refValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "white",
    marginTop: 2,
  },
  ticketCard: {
    backgroundColor: Colors.light.card,
    margin: 16,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    paddingBottom: 12,
  },
  busName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  busTypeBadge: {
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  busTypeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  routeSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  cityBlock: { flex: 1 },
  time: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  city: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  routeMid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  routeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.light.success,
  },
  routeLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.light.border,
  },
  dateInfo: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  ticketDivider: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  ticketCircleLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.background,
    marginLeft: -10,
  },
  ticketCircleRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.background,
    marginRight: -10,
  },
  ticketDashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: "dashed",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  detailItem: {
    width: "45%",
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  passengersCard: {
    backgroundColor: Colors.light.card,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
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
    backgroundColor: Colors.light.primaryLight,
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
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  seatChip: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  seatChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  contactCard: {
    backgroundColor: Colors.light.card,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  secondaryBtn: {
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
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
});
