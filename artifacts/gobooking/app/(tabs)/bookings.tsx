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
  status: "confirmed" | "cancelled" | "completed";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  createdAt: string;
}

const STATUS_CONFIG = {
  confirmed: { color: Colors.light.primary, bg: Colors.light.primaryLight, label: "Confirmé" },
  cancelled: { color: Colors.light.error, bg: "#FEF2F2", label: "Annulé" },
  completed: { color: Colors.light.success, bg: "#ECFDF5", label: "Terminé" },
};

const PAY_CONFIG = {
  paid:    { color: "#059669", bg: "#ECFDF5", label: "Payé", icon: "check-circle" as const },
  pending: { color: "#D97706", bg: "#FFFBEB", label: "Paiement requis", icon: "alert-circle" as const },
  failed:  { color: "#EF4444", bg: "#FEF2F2", label: "Paiement échoué", icon: "x-circle" as const },
  refunded:{ color: "#6B7280", bg: "#F3F4F6", label: "Remboursé", icon: "rotate-ccw" as const },
};

const METHOD_LABELS: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN MoMo",
  wave: "Wave",
  card: "Carte bancaire",
};

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

  useEffect(() => {
    fetch();
  }, [token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetch();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 100;

  const renderBooking = ({ item }: { item: Booking }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.confirmed;
    const pay = PAY_CONFIG[item.paymentStatus] || PAY_CONFIG.pending;
    const isPaid = item.paymentStatus === "paid";
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: "/booking/[id]", params: { id: item.id } });
        }}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.refText}>#{item.bookingRef}</Text>
            <Text style={styles.dateText}>{item.trip.date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.cityBlock}>
            <Text style={styles.timeText}>{item.trip.departureTime}</Text>
            <Text style={styles.cityText}>{item.trip.from}</Text>
          </View>
          <View style={styles.routeMiddle}>
            <View style={styles.routeLine} />
            <Feather name="arrow-right" size={14} color={Colors.light.textMuted} />
            <View style={styles.routeLine} />
          </View>
          <View style={[styles.cityBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.timeText}>{item.trip.arrivalTime}</Text>
            <Text style={styles.cityText}>{item.trip.to}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.payBadge, { backgroundColor: pay.bg }]}>
            <Feather name={pay.icon} size={11} color={pay.color} />
            <Text style={[styles.payBadgeText, { color: pay.color }]}>{pay.label}</Text>
          </View>
          <Text style={[styles.amountText, { color: isPaid ? Colors.light.primary : "#D97706" }]}>
            {item.totalAmount.toLocaleString()} FCFA
          </Text>
        </View>

        {!isPaid && (
          <Pressable
            style={styles.payNowBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/booking/[id]", params: { id: item.id } });
            }}
          >
            <Feather name="credit-card" size={13} color="white" />
            <Text style={styles.payNowText}>Payer maintenant</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Réservations</Text>
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
              <Pressable
                style={styles.bookNowBtn}
                onPress={() => router.push("/(tabs)")}
              >
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
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.card,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  refText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  cityBlock: {
    flex: 1,
  },
  timeText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  cityText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  routeMiddle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  routeLine: {
    width: 24,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seatInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seatText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  amountText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  payBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  payBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  payNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "#D97706",
    borderRadius: 10,
    paddingVertical: 9,
  },
  payNowText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  bookNowBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  bookNowText: {
    color: "white",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
