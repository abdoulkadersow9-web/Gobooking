import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
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
import { useParcel } from "@/context/ParcelContext";
import { apiFetch } from "@/utils/api";

interface ParcelResult {
  id: string;
  trackingRef: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  fromCity: string;
  toCity: string;
  parcelType: string;
  weight: number;
  description?: string;
  deliveryType: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

const STATUS_STEPS: {
  id: string;
  label: string;
  desc: string;
  icon: string;
}[] = [
  {
    id: "en_attente",
    label: "Colis enregistré",
    desc: "Votre colis a été pris en compte dans notre système",
    icon: "check-circle",
  },
  {
    id: "pris_en_charge",
    label: "Colis reçu en agence",
    desc: "Le colis a été réceptionné dans notre agence de départ",
    icon: "home",
  },
  {
    id: "en_transit",
    label: "Colis en transit",
    desc: "Votre colis est en cours de transport vers la destination",
    icon: "truck",
  },
  {
    id: "en_livraison",
    label: "Colis arrivé à destination",
    desc: "Le colis est arrivé à l'agence de la ville de destination",
    icon: "map-pin",
  },
  {
    id: "livre",
    label: "Colis prêt pour retrait / livraison",
    desc: "Votre colis est prêt à être retiré ou livré",
    icon: "gift",
  },
];

const TYPE_LABELS: Record<string, string> = {
  documents: "Documents",
  vetements: "Vêtements",
  electronique: "Électronique",
  alimentaire: "Alimentaire",
  cosmetique: "Cosmétique",
  autre: "Autre",
};

const DELIVERY_LABELS: Record<string, string> = {
  depot_agence: "Dépôt en agence",
  livraison_domicile: "Livraison à domicile",
  retrait_agence: "Retrait en agence",
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  en_attente: { color: "#D97706", bg: "#FFFBEB" },
  pris_en_charge: { color: Colors.light.primary, bg: "#EEF2FF" },
  en_transit: { color: "#7C3AED", bg: "#F5F3FF" },
  en_livraison: { color: "#0891B2", bg: "#ECFEFF" },
  livre: { color: "#059669", bg: "#ECFDF5" },
  annule: { color: "#EF4444", bg: "#FEF2F2" },
};

function getCurrentStep(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.id === status);
  return idx >= 0 ? idx : 0;
}

export default function ParcelTrackScreen() {
  const insets = useSafeAreaInsets();
  const { parcel: contextParcel } = useParcel();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParcelResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const resultAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const showResult = (data: ParcelResult) => {
    setResult(data);
    setNotFound(false);
    setSearched(true);
    resultAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(resultAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 8 }),
    ]).start();
  };

  const handleSearch = async () => {
    const ref = query.trim().toUpperCase();
    if (!ref) return;
    Keyboard.dismiss();
    setLoading(true);
    setResult(null);
    setNotFound(false);

    // Check context first (locally created parcels)
    if (contextParcel.trackingRef && contextParcel.trackingRef.toUpperCase() === ref) {
      const localResult: ParcelResult = {
        id: "local",
        trackingRef: contextParcel.trackingRef,
        senderName: contextParcel.senderName || "—",
        senderPhone: contextParcel.senderPhone || "",
        receiverName: contextParcel.receiverName || "—",
        receiverPhone: contextParcel.receiverPhone || "",
        fromCity: contextParcel.fromCity || "—",
        toCity: contextParcel.toCity || "—",
        parcelType: contextParcel.parcelType || "autre",
        weight: parseFloat(contextParcel.weight || "0"),
        description: contextParcel.description,
        deliveryType: contextParcel.deliveryType || "depot_agence",
        amount: contextParcel.amount || 0,
        paymentMethod: contextParcel.paymentMethod || "orange",
        status: "en_attente",
        createdAt: new Date().toISOString(),
      };
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showResult(localResult);
      return;
    }

    try {
      const data = await apiFetch<ParcelResult>(`/parcels/track/${ref}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showResult(data);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setNotFound(true);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const currentStep = result ? getCurrentStep(result.status) : 0;
  const isCancelled = result?.status === "annule";
  const statusStyle = result ? (STATUS_COLORS[result.status] || STATUS_COLORS.en_attente) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: topPad }]}>
        {/* Header */}
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryDark]}
          style={styles.header}
        >
          <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
            <Feather name="arrow-left" size={20} color="white" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Suivi de colis</Text>
            <Text style={styles.headerSub}>Entrez votre numéro pour localiser votre colis</Text>
          </View>
        </LinearGradient>

        {/* Search bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchCard}>
            <View style={styles.searchIcon}>
              <Feather name="search" size={18} color={Colors.light.primary} />
            </View>
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Entrer numéro de suivi (ex: GBX-P368-CJ2S)"
              placeholderTextColor={Colors.light.textMuted}
              value={query}
              onChangeText={(t) => setQuery(t.toUpperCase())}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => { setQuery(""); setResult(null); setNotFound(false); setSearched(false); }}
                style={styles.clearBtn}
              >
                <Feather name="x" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.searchBtn,
              !query.trim() && styles.searchBtnDisabled,
              pressed && query.trim() && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleSearch}
            disabled={!query.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Feather name="map-pin" size={15} color="white" />
                <Text style={styles.searchBtnText}>Suivre</Text>
              </>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Empty / idle state */}
          {!searched && !loading && (
            <View style={styles.idleState}>
              <View style={styles.idleIcon}>
                <Feather name="package" size={44} color={Colors.light.primary} />
              </View>
              <Text style={styles.idleTitle}>Suivre votre colis</Text>
              <Text style={styles.idleDesc}>
                Saisissez votre numéro de suivi pour connaître l'état et la localisation de votre colis en temps réel
              </Text>
              <View style={styles.exampleBox}>
                <Text style={styles.exampleLabel}>Format du numéro de suivi</Text>
                <Text style={styles.exampleRef}>GBX-XXXX-XXXX</Text>
              </View>
            </View>
          )}

          {/* Loading */}
          {loading && (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              <Text style={styles.loadingText}>Recherche en cours…</Text>
            </View>
          )}

          {/* Not found */}
          {notFound && !loading && (
            <View style={styles.notFoundState}>
              <View style={styles.notFoundIcon}>
                <Feather name="alert-circle" size={40} color="#EF4444" />
              </View>
              <Text style={styles.notFoundTitle}>Colis introuvable</Text>
              <Text style={styles.notFoundDesc}>
                Aucun colis ne correspond au numéro{" "}
                <Text style={{ fontFamily: "Inter_700Bold" }}>{query}</Text>
                {"\n"}Vérifiez le numéro et réessayez.
              </Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => { setQuery(""); setNotFound(false); setSearched(false); inputRef.current?.focus(); }}
              >
                <Feather name="refresh-cw" size={14} color={Colors.light.primary} />
                <Text style={styles.retryBtnText}>Réessayer</Text>
              </Pressable>
            </View>
          )}

          {/* Result */}
          {result && !loading && (
            <Animated.View style={{ opacity: resultAnim, transform: [{ translateY: slideAnim }] }}>
              {/* Ref & status pill */}
              <View style={styles.refRow}>
                <View>
                  <Text style={styles.refLabel}>RÉFÉRENCE DE SUIVI</Text>
                  <Text style={styles.refValue}>{result.trackingRef}</Text>
                </View>
                {statusStyle && (
                  <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusStyle.color }]} />
                    <Text style={[styles.statusPillText, { color: statusStyle.color }]}>
                      {STATUS_STEPS[currentStep]?.label || "En cours"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Route card */}
              <View style={styles.routeCard}>
                <View style={styles.routeCity}>
                  <View style={styles.routeCityDot} />
                  <View>
                    <Text style={styles.routeCityName}>{result.fromCity}</Text>
                    <Text style={styles.routeCityLabel}>Ville de départ</Text>
                  </View>
                </View>
                <View style={styles.routeMidLine}>
                  <View style={styles.routeDashedLine} />
                  <View style={styles.routePackageIcon}>
                    <Feather name="package" size={14} color={Colors.light.primary} />
                  </View>
                  <View style={styles.routeDashedLine} />
                </View>
                <View style={[styles.routeCity, { flexDirection: "row-reverse" }]}>
                  <View style={[styles.routeCityDot, { backgroundColor: "#EF4444" }]} />
                  <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                    <Text style={styles.routeCityName}>{result.toCity}</Text>
                    <Text style={styles.routeCityLabel}>Destination</Text>
                  </View>
                </View>
              </View>

              {/* Info grid */}
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Informations du colis</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoGridItem}>
                    <View style={styles.infoGridIcon}>
                      <Feather name="user" size={14} color={Colors.light.primary} />
                    </View>
                    <View>
                      <Text style={styles.infoGridLabel}>Expéditeur</Text>
                      <Text style={styles.infoGridValue}>{result.senderName}</Text>
                      {result.senderPhone ? (
                        <Text style={styles.infoGridSub}>+225 {result.senderPhone}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <View style={[styles.infoGridIcon, { backgroundColor: "#ECFDF5" }]}>
                      <Feather name="user-check" size={14} color="#059669" />
                    </View>
                    <View>
                      <Text style={styles.infoGridLabel}>Destinataire</Text>
                      <Text style={styles.infoGridValue}>{result.receiverName}</Text>
                      {result.receiverPhone ? (
                        <Text style={styles.infoGridSub}>+225 {result.receiverPhone}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <View style={[styles.infoGridIcon, { backgroundColor: "#F5F3FF" }]}>
                      <Feather name="box" size={14} color="#7C3AED" />
                    </View>
                    <View>
                      <Text style={styles.infoGridLabel}>Type de colis</Text>
                      <Text style={styles.infoGridValue}>
                        {TYPE_LABELS[result.parcelType] || result.parcelType}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <View style={[styles.infoGridIcon, { backgroundColor: "#FFF7ED" }]}>
                      <Feather name="shopping-bag" size={14} color="#D97706" />
                    </View>
                    <View>
                      <Text style={styles.infoGridLabel}>Poids</Text>
                      <Text style={styles.infoGridValue}>{result.weight} kg</Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <View style={[styles.infoGridIcon, { backgroundColor: "#ECFEFF" }]}>
                      <Feather name="truck" size={14} color="#0891B2" />
                    </View>
                    <View>
                      <Text style={styles.infoGridLabel}>Mode de livraison</Text>
                      <Text style={styles.infoGridValue}>
                        {DELIVERY_LABELS[result.deliveryType] || result.deliveryType}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <View style={[styles.infoGridIcon, { backgroundColor: "#EEF2FF" }]}>
                      <Feather name="dollar-sign" size={14} color={Colors.light.primary} />
                    </View>
                    <View>
                      <Text style={styles.infoGridLabel}>Montant</Text>
                      <Text style={styles.infoGridValue}>
                        {(result.amount ?? 0).toLocaleString()} FCFA
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Status timeline */}
              {!isCancelled && (
                <View style={styles.timelineCard}>
                  <View style={styles.timelineHeader}>
                    <Feather name="activity" size={15} color={Colors.light.primary} />
                    <Text style={styles.timelineTitle}>Progression du colis</Text>
                  </View>

                  {STATUS_STEPS.map((step, i) => {
                    const done = i <= currentStep;
                    const current = i === currentStep;
                    const isLast = i === STATUS_STEPS.length - 1;

                    return (
                      <View key={step.id} style={styles.timelineStep}>
                        {/* Left: icon + connector */}
                        <View style={styles.timelineLeft}>
                          <View
                            style={[
                              styles.timelineIcon,
                              done ? styles.timelineIconDone : styles.timelineIconPending,
                              current && styles.timelineIconCurrent,
                            ]}
                          >
                            {done ? (
                              current ? (
                                <Feather name={step.icon as never} size={16} color="white" />
                              ) : (
                                <Feather name="check" size={14} color="white" />
                              )
                            ) : (
                              <Text style={styles.timelineNum}>{i + 1}</Text>
                            )}
                          </View>
                          {!isLast && (
                            <View
                              style={[
                                styles.timelineConnector,
                                done && i < currentStep && styles.timelineConnectorDone,
                              ]}
                            />
                          )}
                        </View>

                        {/* Right: text */}
                        <View style={[styles.timelineContent, !isLast && { paddingBottom: 20 }]}>
                          <Text
                            style={[
                              styles.timelineStepLabel,
                              done && styles.timelineStepLabelDone,
                              current && styles.timelineStepLabelCurrent,
                            ]}
                          >
                            {step.label}
                          </Text>
                          <Text style={styles.timelineStepDesc}>{step.desc}</Text>
                          {current && (
                            <View style={styles.currentBadge}>
                              <View style={styles.currentBadgeDot} />
                              <Text style={styles.currentBadgeText}>Statut actuel</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {isCancelled && (
                <View style={styles.cancelledCard}>
                  <Feather name="x-circle" size={32} color="#EF4444" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cancelledTitle}>Colis annulé</Text>
                    <Text style={styles.cancelledDesc}>
                      Ce colis a été annulé. Contactez-nous pour plus d'informations.
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
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
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
    lineHeight: 16,
  },

  // Search section
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    gap: 8,
    height: 48,
  },
  searchIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  searchBtnDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
  },
  searchBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "white",
  },

  scroll: { padding: 16, gap: 14 },

  // Idle state
  idleState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 14,
  },
  idleIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    borderWidth: 2,
    borderColor: "#C7D2FE",
  },
  idleTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  idleDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  exampleBox: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginTop: 8,
  },
  exampleLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  exampleRef: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    letterSpacing: 2,
  },

  // Loading
  loadingState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },

  // Not found
  notFoundState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
  },
  notFoundIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  notFoundTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#EF4444",
  },
  notFoundDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },

  // Ref row
  refRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  refLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  refValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    letterSpacing: 1.5,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },

  // Route card
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 0,
  },
  routeCity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeCityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
  },
  routeCityName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  routeCityLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 1,
  },
  routeMidLine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  routeDashedLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#E2E8F0",
  },
  routePackageIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },

  // Info card
  infoCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  infoCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    marginBottom: 2,
  },
  infoGrid: { gap: 14 },
  infoGridItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoGridIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  infoGridLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginBottom: 2,
  },
  infoGridValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  infoGridSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 1,
  },

  // Timeline
  timelineCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 4,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  timelineTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  timelineStep: {
    flexDirection: "row",
    gap: 14,
  },
  timelineLeft: {
    alignItems: "center",
    width: 40,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineIconDone: {
    backgroundColor: Colors.light.primary,
  },
  timelineIconPending: {
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  timelineIconCurrent: {
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  timelineNum: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginTop: 4,
    minHeight: 20,
  },
  timelineConnectorDone: {
    backgroundColor: Colors.light.primary,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 8,
    gap: 3,
  },
  timelineStepLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  timelineStepLabelDone: {
    color: "#0F172A",
    fontFamily: "Inter_600SemiBold",
  },
  timelineStepLabelCurrent: {
    color: Colors.light.primary,
    fontFamily: "Inter_700Bold",
  },
  timelineStepDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    lineHeight: 18,
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  currentBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
  },
  currentBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },

  cancelledCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelledTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#EF4444",
    marginBottom: 2,
  },
  cancelledDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    lineHeight: 18,
  },
});
