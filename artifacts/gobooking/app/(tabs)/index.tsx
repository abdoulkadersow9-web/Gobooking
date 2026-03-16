import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const POPULAR_ROUTES = [
  { from: "New York", to: "Boston", duration: "4h 30m", price: 35 },
  { from: "Los Angeles", to: "San Francisco", duration: "6h", price: 28 },
  { from: "Chicago", to: "Detroit", duration: "4h", price: 22 },
  { from: "Miami", to: "Orlando", duration: "3h 30m", price: 18 },
];

const CITIES = [
  "New York", "Boston", "Los Angeles", "San Francisco",
  "Chicago", "Detroit", "Miami", "Orlando", "Seattle",
  "Denver", "Dallas", "Houston", "Atlanta", "Philadelphia",
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [passengers, setPassengers] = useState(1);

  const swap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFrom(to);
    setTo(from);
  };

  const search = () => {
    if (!from.trim() || !to.trim()) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/search-results",
      params: { from, to, date, passengers: passengers.toString() },
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const firstName = user?.name?.split(" ")[0] || "Traveler";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : 100 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={[styles.header, { paddingTop: topPad + 20 }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName}</Text>
            <Text style={styles.headerSubtitle}>Where are you heading today?</Text>
          </View>
          {user?.role === "admin" && (
            <Pressable
              style={styles.adminBadge}
              onPress={() => router.push("/admin")}
            >
              <Feather name="settings" size={18} color="white" />
            </Pressable>
          )}
        </View>

        <View style={styles.searchCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeInputWrapper}>
              <View style={styles.routeLabel}>
                <View style={[styles.routeDot, { backgroundColor: Colors.light.success }]} />
                <Text style={styles.routeLabelText}>FROM</Text>
              </View>
              <TextInput
                style={styles.routeInput}
                placeholder="Departure city"
                placeholderTextColor={Colors.light.textMuted}
                value={from}
                onChangeText={setFrom}
              />
            </View>

            <Pressable style={styles.swapBtn} onPress={swap}>
              <Feather name="repeat" size={18} color={Colors.light.primary} />
            </Pressable>

            <View style={styles.routeInputWrapper}>
              <View style={styles.routeLabel}>
                <View style={[styles.routeDot, { backgroundColor: Colors.light.error }]} />
                <Text style={styles.routeLabelText}>TO</Text>
              </View>
              <TextInput
                style={styles.routeInput}
                placeholder="Destination city"
                placeholderTextColor={Colors.light.textMuted}
                value={to}
                onChangeText={setTo}
              />
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.dateWrapper}>
              <Feather name="calendar" size={16} color={Colors.light.textSecondary} />
              <TextInput
                style={styles.dateInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.light.textMuted}
              />
            </View>

            <View style={styles.paxWrapper}>
              <Feather name="users" size={16} color={Colors.light.textSecondary} />
              <Pressable
                onPress={() => setPassengers(Math.max(1, passengers - 1))}
                style={styles.paxBtn}
              >
                <Feather name="minus" size={14} color={Colors.light.primary} />
              </Pressable>
              <Text style={styles.paxCount}>{passengers}</Text>
              <Pressable
                onPress={() => setPassengers(Math.min(9, passengers + 1))}
                style={styles.paxBtn}
              >
                <Feather name="plus" size={14} color={Colors.light.primary} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.searchBtn, pressed && styles.searchBtnPressed]}
            onPress={search}
          >
            <Feather name="search" size={18} color="white" />
            <Text style={styles.searchBtnText}>Search Buses</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular Routes</Text>
        {POPULAR_ROUTES.map((route, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
            onPress={() => {
              setFrom(route.from);
              setTo(route.to);
              router.push({
                pathname: "/search-results",
                params: { from: route.from, to: route.to, date, passengers: "1" },
              });
            }}
          >
            <View style={styles.routeCardLeft}>
              <View style={styles.cityRow}>
                <View style={styles.cityDot} />
                <Text style={styles.cityName}>{route.from}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.cityRow}>
                <View style={[styles.cityDot, { backgroundColor: Colors.light.error }]} />
                <Text style={styles.cityName}>{route.to}</Text>
              </View>
            </View>
            <View style={styles.routeCardRight}>
              <Text style={styles.routePrice}>${route.price}</Text>
              <Text style={styles.routeDuration}>{route.duration}</Text>
              <View style={styles.routeArrow}>
                <Feather name="arrow-right" size={14} color={Colors.light.primary} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Destinations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.citiesScroll}>
          {CITIES.map((city) => (
            <Pressable
              key={city}
              style={({ pressed }) => [styles.cityChip, pressed && { opacity: 0.7 }]}
              onPress={() => setTo(city)}
            >
              <Feather name="map-pin" size={13} color={Colors.light.primary} />
              <Text style={styles.cityChipText}>{city}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  adminBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  routeInputWrapper: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 10,
  },
  routeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  routeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.light.success,
  },
  routeLabelText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textMuted,
    letterSpacing: 0.5,
  },
  routeInput: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
    paddingVertical: 2,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  dateWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  paxWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paxBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  paxCount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    minWidth: 18,
    textAlign: "center",
  },
  searchBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  searchBtnText: {
    color: "white",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 14,
  },
  routeCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  routeCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  routeCardLeft: {
    gap: 4,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.success,
  },
  cityName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: Colors.light.border,
    marginLeft: 3,
  },
  routeCardRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  routePrice: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  routeDuration: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  routeArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  citiesScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  cityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cityChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
});
