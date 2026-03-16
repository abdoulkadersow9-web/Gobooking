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

const CITIES = [
  "Abidjan", "Bouaké", "Yamoussoukro", "Korhogo",
  "San Pedro", "Daloa", "Man", "Gagnoa",
  "Divo", "Abengourou", "Soubré", "Bondoukou",
];

const POPULAR_ROUTES = [
  { from: "Abidjan", to: "Bouaké", duration: "5h 30m", price: 3500 },
  { from: "Abidjan", to: "Yamoussoukro", duration: "2h 30m", price: 2000 },
  { from: "Abidjan", to: "Korhogo", duration: "9h", price: 6000 },
  { from: "Bouaké", to: "Korhogo", duration: "3h 30m", price: 2500 },
  { from: "San Pedro", to: "Abidjan", duration: "4h", price: 3000 },
];

type Mode = "trajet" | "colis";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const firstName = user?.name?.split(" ")[0] || "Bienvenue";

  const [mode, setMode] = useState<Mode>("trajet");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [passengers, setPassengers] = useState(1);

  const swap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFrom(to);
    setTo(from);
  };

  const search = () => {
    if (!from.trim() || !to.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/search-results", params: { from, to, date, passengers: passengers.toString() } });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
            <Text style={styles.headerSub}>Que souhaitez-vous faire ?</Text>
          </View>
          {user?.role === "admin" && (
            <Pressable style={styles.adminBtn} onPress={() => router.push("/admin")}>
              <Feather name="settings" size={18} color="white" />
            </Pressable>
          )}
        </View>

        {/* ── Mode selector ── */}
        <View style={styles.modeSelector}>
          <Pressable
            style={[styles.modeBtn, mode === "trajet" && styles.modeBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode("trajet"); }}
          >
            <Feather name="map" size={16} color={mode === "trajet" ? Colors.light.primary : "rgba(255,255,255,0.7)"} />
            <Text style={[styles.modeBtnText, mode === "trajet" && styles.modeBtnTextActive]}>
              Réserver un trajet
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "colis" && styles.modeBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode("colis"); }}
          >
            <Feather name="package" size={16} color={mode === "colis" ? Colors.light.primary : "rgba(255,255,255,0.7)"} />
            <Text style={[styles.modeBtnText, mode === "colis" && styles.modeBtnTextActive]}>
              Envoyer un colis
            </Text>
          </Pressable>
        </View>

        {/* ── Search card ── */}
        {mode === "trajet" ? (
          <View style={styles.searchCard}>
            <View style={styles.routeRow}>
              <View style={styles.routeInputWrap}>
                <View style={styles.routeLabel}>
                  <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                  <Text style={styles.routeLabelText}>DÉPART</Text>
                </View>
                <TextInput
                  style={styles.routeInput}
                  placeholder="Ville de départ"
                  placeholderTextColor={Colors.light.textMuted}
                  value={from}
                  onChangeText={setFrom}
                />
              </View>
              <Pressable style={styles.swapBtn} onPress={swap}>
                <Feather name="repeat" size={18} color={Colors.light.primary} />
              </Pressable>
              <View style={styles.routeInputWrap}>
                <View style={styles.routeLabel}>
                  <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                  <Text style={styles.routeLabelText}>ARRIVÉE</Text>
                </View>
                <TextInput
                  style={styles.routeInput}
                  placeholder="Ville d'arrivée"
                  placeholderTextColor={Colors.light.textMuted}
                  value={to}
                  onChangeText={setTo}
                />
              </View>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.dateWrap}>
                <Feather name="calendar" size={15} color={Colors.light.textSecondary} />
                <TextInput
                  style={styles.dateInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor={Colors.light.textMuted}
                />
              </View>
              <View style={styles.paxWrap}>
                <Feather name="users" size={15} color={Colors.light.textSecondary} />
                <Pressable style={styles.paxBtn} onPress={() => setPassengers(Math.max(1, passengers - 1))}>
                  <Feather name="minus" size={13} color={Colors.light.primary} />
                </Pressable>
                <Text style={styles.paxCount}>{passengers}</Text>
                <Pressable style={styles.paxBtn} onPress={() => setPassengers(Math.min(9, passengers + 1))}>
                  <Feather name="plus" size={13} color={Colors.light.primary} />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={search}
            >
              <Feather name="search" size={17} color="white" />
              <Text style={styles.searchBtnText}>Rechercher des bus</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.searchCard}>
            <View style={styles.colisHero}>
              <View style={styles.colisIconWrap}>
                <Feather name="package" size={32} color={Colors.light.primary} />
              </View>
              <Text style={styles.colisTitle}>Envoi de colis</Text>
              <Text style={styles.colisSub}>
                Expédiez vos colis partout en Côte d'Ivoire en toute sécurité
              </Text>
              <Pressable
                style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => router.push("/parcel/send")}
              >
                <Feather name="arrow-right" size={17} color="white" />
                <Text style={styles.searchBtnText}>Envoyer un colis</Text>
              </Pressable>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── Quick actions ── */}
      <View style={styles.quickActions}>
        <Pressable
          style={styles.quickCard}
          onPress={() => router.push("/(tabs)/bookings")}
        >
          <LinearGradient colors={["#EEF2FF", "#E0E7FF"]} style={styles.quickIcon}>
            <Feather name="bookmark" size={22} color={Colors.light.primary} />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mes réservations</Text>
          <Text style={styles.quickSub}>Trajets & billets</Text>
        </Pressable>

        <Pressable
          style={styles.quickCard}
          onPress={() => router.push("/(tabs)/colis")}
        >
          <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.quickIcon}>
            <Feather name="package" size={22} color="#059669" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mes colis</Text>
          <Text style={styles.quickSub}>Suivi & envois</Text>
        </Pressable>

        <Pressable
          style={styles.quickCard}
          onPress={() => router.push("/(tabs)/notifications")}
        >
          <LinearGradient colors={["#FFF7ED", "#FFEDD5"]} style={styles.quickIcon}>
            <Feather name="bell" size={22} color="#D97706" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Notifications</Text>
          <Text style={styles.quickSub}>Alertes & infos</Text>
        </Pressable>

        <Pressable
          style={styles.quickCard}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <LinearGradient colors={["#F5F3FF", "#EDE9FE"]} style={styles.quickIcon}>
            <Feather name="user" size={22} color="#7C3AED" />
          </LinearGradient>
          <Text style={styles.quickLabel}>Mon profil</Text>
          <Text style={styles.quickSub}>Compte & paramètres</Text>
        </Pressable>
      </View>

      {/* ── Services section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nos services</Text>
        <View style={styles.servicesRow}>
          <Pressable
            style={styles.serviceCard}
            onPress={() => { setMode("trajet"); }}
          >
            <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={styles.serviceGradient}>
              <Feather name="map" size={28} color="white" />
              <Text style={styles.serviceTitle}>Réserver un trajet</Text>
              <Text style={styles.serviceSub}>Bus interurbains CI</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={styles.serviceCard}
            onPress={() => router.push("/parcel/send")}
          >
            <LinearGradient colors={["#059669", "#047857"]} style={styles.serviceGradient}>
              <Feather name="package" size={28} color="white" />
              <Text style={styles.serviceTitle}>Envoyer un colis</Text>
              <Text style={styles.serviceSub}>Livraison sécurisée</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* ── Popular routes ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trajets populaires</Text>
        {POPULAR_ROUTES.map((route, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
            onPress={() => {
              setFrom(route.from);
              setTo(route.to);
              setMode("trajet");
              router.push({ pathname: "/search-results", params: { from: route.from, to: route.to, date, passengers: "1" } });
            }}
          >
            <View style={styles.routeCardLeft}>
              <View style={styles.routeCardIcon}>
                <Feather name="map-pin" size={14} color={Colors.light.primary} />
              </View>
              <View>
                <Text style={styles.routeCardRoute}>
                  {route.from} → {route.to}
                </Text>
                <Text style={styles.routeCardMeta}>{route.duration}</Text>
              </View>
            </View>
            <View style={styles.routeCardRight}>
              <Text style={styles.routeCardPrice}>
                {route.price.toLocaleString()} FCFA
              </Text>
              <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  headerRow: {
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
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  adminBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Mode selector
  modeSelector: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: "white",
  },
  modeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },
  modeBtnTextActive: {
    color: Colors.light.primary,
  },

  // Search card
  searchCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  routeInputWrap: { flex: 1 },
  routeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  routeLabelText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  routeInput: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#0F172A",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 6,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  bottomRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  dateWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#0F172A",
  },
  paxWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  paxBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  paxCount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
    minWidth: 16,
    textAlign: "center",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "white",
  },

  // Colis card content
  colisHero: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  colisIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  colisTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  colisSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 4,
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 16,
    paddingTop: 20,
  },
  quickCard: {
    width: "47%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  quickLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  quickSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },

  // Services
  section: { paddingHorizontal: 16, paddingBottom: 8 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    marginBottom: 12,
  },
  servicesRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  serviceCard: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  serviceGradient: {
    padding: 18,
    gap: 8,
    minHeight: 130,
    justifyContent: "flex-end",
  },
  serviceTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  serviceSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
  },

  // Popular routes
  routeCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  routeCardPressed: { opacity: 0.85 },
  routeCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  routeCardRoute: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  routeCardMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  routeCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  routeCardPrice: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
});
