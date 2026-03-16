import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { apiFetch } from "@/utils/api";

interface Trip {
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
}

const AMENITY_ICONS: Record<string, string> = {
  wifi: "wifi",
  ac: "wind",
  charging: "zap",
  snacks: "coffee",
  "recliner seat": "sun",
};

export default function SearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const { from, to, date, passengers } = useLocalSearchParams<{
    from: string; to: string; date: string; passengers: string;
  }>();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"price" | "duration" | "departure">("price");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<Trip[]>(
          `/trips/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}&passengers=${passengers}`
        );
        setTrips(data);
      } catch {
        setTrips([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [from, to, date, passengers]);

  const sorted = [...trips].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    if (sortBy === "duration") return a.duration.localeCompare(b.duration);
    return a.departureTime.localeCompare(b.departureTime);
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const renderTrip = ({ item }: { item: Trip }) => (
    <Pressable
      style={({ pressed }) => [styles.tripCard, pressed && styles.tripCardPressed]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/trip/[id]", params: { id: item.id } });
      }}
    >
      <View style={styles.tripHeader}>
        <View>
          <Text style={styles.busName}>{item.busName}</Text>
          <View style={styles.busTypeBadge}>
            <Text style={styles.busTypeText}>{item.busType}</Text>
          </View>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.priceText}>${item.price}</Text>
          <Text style={styles.pricePerPax}>per seat</Text>
        </View>
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.time}>{item.departureTime}</Text>
          <Text style={styles.city}>{item.from}</Text>
        </View>
        <View style={styles.durationBlock}>
          <Text style={styles.duration}>{item.duration}</Text>
          <View style={styles.durationLine}>
            <View style={styles.dot} />
            <View style={styles.line} />
            <View style={[styles.dot, { backgroundColor: Colors.light.error }]} />
          </View>
          <Text style={styles.durationSub}>Direct</Text>
        </View>
        <View style={[styles.timeBlock, { alignItems: "flex-end" }]}>
          <Text style={styles.time}>{item.arrivalTime}</Text>
          <Text style={styles.city}>{item.to}</Text>
        </View>
      </View>

      <View style={styles.tripFooter}>
        <View style={styles.amenities}>
          {item.amenities.slice(0, 4).map((a) => (
            <View key={a} style={styles.amenityChip}>
              <Feather
                name={(AMENITY_ICONS[a.toLowerCase()] || "check") as never}
                size={11}
                color={Colors.light.primary}
              />
              <Text style={styles.amenityText}>{a}</Text>
            </View>
          ))}
        </View>
        <View style={styles.seatsInfo}>
          <Text style={[
            styles.seatsText,
            item.availableSeats < 5 && { color: Colors.light.error }
          ]}>
            {item.availableSeats} seats left
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.routeTitle}>{from} → {to}</Text>
          <Text style={styles.routeSub}>{date} · {passengers} passenger{parseInt(passengers) > 1 ? "s" : ""}</Text>
        </View>
      </View>

      <View style={styles.sortBar}>
        {(["price", "duration", "departure"] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.sortChip, sortBy === s && styles.sortChipActive]}
            onPress={() => setSortBy(s)}
          >
            <Text style={[styles.sortText, sortBy === s && styles.sortTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Finding buses...</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20,
          }}
          scrollEnabled={!!sorted.length}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="map" size={48} color={Colors.light.textMuted} />
              <Text style={styles.emptyTitle}>No buses found</Text>
              <Text style={styles.emptySubtitle}>Try a different date or route</Text>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: { flex: 1 },
  routeTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  routeSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  sortBar: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: Colors.light.card,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  sortChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  sortText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  sortTextActive: {
    color: "white",
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
  tripCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  tripCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  busName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  busTypeBadge: {
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  busTypeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  priceBlock: {
    alignItems: "flex-end",
  },
  priceText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  pricePerPax: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  timeBlock: { flex: 1 },
  time: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  city: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  durationBlock: {
    alignItems: "center",
    flex: 1,
  },
  duration: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  durationLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.success,
  },
  line: {
    width: 40,
    height: 1.5,
    backgroundColor: Colors.light.border,
  },
  durationSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    marginTop: 4,
  },
  tripFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amenities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    flex: 1,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  amenityText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.light.primary,
  },
  seatsInfo: { alignItems: "flex-end" },
  seatsText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.success,
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
});
