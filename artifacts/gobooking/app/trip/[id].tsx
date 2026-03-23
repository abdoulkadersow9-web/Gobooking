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
import { useBooking } from "@/context/BookingContext";
import { apiFetch } from "@/utils/api";

interface TripDetail {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: number;
  busType: string;
  busName: string;
  totalSeats: number;
  availableSeats: number;
  duration: string;
  amenities: string[];
  stops: { name: string; time: string }[];
  policies: string[];
}

const AMENITY_ICONS: Record<string, string> = {
  wifi: "wifi",
  ac: "wind",
  charging: "zap",
  snacks: "coffee",
  "recliner seat": "sun",
  blanket: "star",
  water: "droplet",
  entertainment: "monitor",
};

export default function TripDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { updateBooking } = useBooking();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<TripDetail>(`/trips/${id}`);
        setTrip(data);
      } catch {
        setTrip(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleBook = () => {
    if (!trip) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateBooking({
      tripId: trip.id,
      selectedSeats: [],
      selectedSeatNumbers: [],
      passengers: [],
      paymentMethod: "card",
      contactEmail: "",
      contactPhone: "",
      totalAmount: trip.price,
    });
    router.push({ pathname: "/seats/[tripId]", params: { tripId: trip.id } });
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryDark]}
          style={styles.hero}
        >
          <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
            <Feather name="arrow-left" size={22} color="white" />
          </Pressable>
          <View style={styles.heroContent}>
            <Text style={styles.busName}>{trip.busName}</Text>
            <View style={styles.busTypeBadge}>
              <Text style={styles.busTypeText}>{trip.busType}</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.heroTime}>{trip.departureTime}</Text>
                <Text style={styles.heroCity}>{trip.from}</Text>
              </View>
              <View style={styles.heroMid}>
                <Text style={styles.heroDuration}>{trip.duration}</Text>
                <View style={styles.heroDurLine}>
                  <View style={styles.heroDot} />
                  <View style={styles.heroLine} />
                  <Feather name="chevrons-right" size={16} color="rgba(255,255,255,0.8)" />
                  <View style={styles.heroLine} />
                  <View style={[styles.heroDot, { backgroundColor: "rgba(255,100,100,0.9)" }]} />
                </View>
                <Text style={styles.heroDate}>{trip.date}</Text>
              </View>
              <View style={[styles.timeBlock, { alignItems: "flex-end" }]}>
                <Text style={styles.heroTime}>{trip.arrivalTime}</Text>
                <Text style={styles.heroCity}>{trip.to}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Price per seat</Text>
            <Text style={styles.price}>{trip.price.toLocaleString()} FCFA</Text>
          </View>
          <View style={[
            styles.seatsBadge,
            trip.availableSeats < 5 && { backgroundColor: "#FEF2F2" }
          ]}>
            <Feather
              name="users"
              size={14}
              color={trip.availableSeats < 5 ? Colors.light.error : Colors.light.success}
            />
            <Text style={[
              styles.seatsText,
              { color: trip.availableSeats < 5 ? Colors.light.error : Colors.light.success }
            ]}>
              {trip.availableSeats} seats available
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {trip.amenities.map((a) => (
              <View key={a} style={styles.amenityItem}>
                <View style={styles.amenityIcon}>
                  <Feather
                    name={(AMENITY_ICONS[a.toLowerCase()] || "check") as never}
                    size={18}
                    color={Colors.light.primary}
                  />
                </View>
                <Text style={styles.amenityText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        {trip.stops.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stops</Text>
            <View style={styles.stopsCard}>
              <View style={styles.stopItem}>
                <View style={[styles.stopDot, { backgroundColor: Colors.light.success }]} />
                <View>
                  <Text style={styles.stopName}>{trip.from}</Text>
                  <Text style={styles.stopTime}>{trip.departureTime}</Text>
                </View>
              </View>
              {trip.stops.map((stop, i) => (
                <View key={i} style={styles.stopItem}>
                  <View style={styles.stopLine} />
                  <View style={[styles.stopDot, { backgroundColor: Colors.light.warning }]} />
                  <View>
                    <Text style={styles.stopName}>{stop.name}</Text>
                    <Text style={styles.stopTime}>{stop.time}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.stopItem}>
                <View style={styles.stopLine} />
                <View style={[styles.stopDot, { backgroundColor: Colors.light.error }]} />
                <View>
                  <Text style={styles.stopName}>{trip.to}</Text>
                  <Text style={styles.stopTime}>{trip.arrivalTime}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {trip.policies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Policies</Text>
            <View style={styles.policiesCard}>
              {trip.policies.map((p, i) => (
                <View key={i} style={styles.policyItem}>
                  <Feather name="info" size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.policyText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <View>
          <Text style={styles.totalLabel}>Total Price</Text>
          <Text style={styles.totalPrice}>{trip.price.toLocaleString()} <Text style={styles.totalSub}>FCFA/siège</Text></Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.bookBtn, pressed && styles.bookBtnPressed]}
          onPress={handleBook}
        >
          <Text style={styles.bookBtnText}>Select Seats</Text>
          <Feather name="arrow-right" size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: Colors.light.textSecondary, fontFamily: "Inter_400Regular" },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroContent: {},
  busName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "white",
    marginBottom: 6,
  },
  busTypeBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  busTypeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeBlock: { flex: 1 },
  heroTime: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  heroCity: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  heroMid: {
    flex: 1,
    alignItems: "center",
  },
  heroDuration: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 6,
  },
  heroDurLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(100,255,150,0.9)",
  },
  heroLine: {
    width: 16,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  heroDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 6,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  price: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  seatsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  seatsText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 12,
  },
  amenitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  amenityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  amenityIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  amenityText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  stopsCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    position: "relative",
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
    zIndex: 1,
  },
  stopLine: {
    position: "absolute",
    left: 5,
    top: -16,
    width: 2,
    height: 24,
    backgroundColor: Colors.light.border,
  },
  stopName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  stopTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
    marginBottom: 16,
  },
  policiesCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  policyItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  policyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 20,
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
  totalLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  totalPrice: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  totalSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  bookBtn: {
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
  bookBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  bookBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
});
