import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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

const STATUS_STEPS = [
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
    label: "Colis prêt pour retrait ou livraison",
    desc: "Votre colis peut être retiré ou sera livré prochainement",
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

export default function SuiviScreen() {
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]).start();
  };

  const reset = () => {
    setQuery("");
    setResult(null);
    setNotFound(false);
    setSearched(false);
  };

  const handleSearch = async () => {
    const ref = query.trim().toUpperCase();
    if (!ref) return;
    Keyboard.dismiss();
    setLoading(true);
    setResult(null);
    setNotFound(false);

    // Check local context first (parcel just created)
    if (
      contextParcel.trackingRef &&
      contextParcel.trackingRef.toUpperCase() === ref
    ) {
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
      setSearched(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(localResult);
      animateIn();
      return;
    }

    try {
      const data = await apiFetch<ParcelResult>(`/parcels/track/${ref}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSearched(true);
      setResult(data);
      animateIn();
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
  const statusStyle = result
    ? STATUS_COLORS[result.status] || STATUS_COLORS.en_attente
    : null;

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
          <View style={styles.headerIcon}>
            <Feather name="map-pin" size={20} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Suivi colis</Text>
            <Text style={styles.headerSub}>
              Localisez votre colis en temps réel
            </Text>
          </View>
        </LinearGradient>

        {/* Search bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputRow}>
            <Feather name="search" size={17} color={Colors.light.textMuted} style={styles.searchInputIcon} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Entrer numéro de suivi (ex: GBX-H77Y-USDE)"
              placeholderTextColor={Colors.light.textMuted}
              value={query}
              onChangeText={(t) => setQuery(t.toUpperCase())}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={reset} style={styles.clearBtn}>
                <Feather name="x" size={15} color="#94A3B8" />
              </Pressable>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.searchBtn,
              !query.trim() && styles.searchBtnDisabled,
              pressed && query.trim() && { opacity: 0.88, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleSearch}
            disabled={!query.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Feather name="search" size={15} color="white" />
                <Text style={styles.searchBtnText}>Rechercher</Text>
              </>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: bottomPad + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Idle state ── */}
          {!searched && !loading && (
            <View style={styles.idleWrap}>
              <View style={styles.idleIllustration}>
                <LinearGradient
                  colors={["#EEF2FF", "#E0E7FF"]}
                  style={styles.idleCircle}
                >
                  <Feather name="package" size={48} color={Colors.light.primary} />
                </LinearGradient>
                <View style={styles.idlePulse} />
              </View>
              <Text style={styles.idleTitle}>Suivez votre colis</Text>
              <Text style={styles.idleDesc}>
                Saisissez votre numéro de suivi pour connaître l'état et la
                position exacte de votre envoi
              </Text>
              <View style={styles.formatBox}>
                <Text style={styles.formatLabel}>Format du numéro de suivi</Text>
                <Text style={styles.formatRef}>GBX-XXXX-XXXX</Text>
                <Text style={styles.formatHint}>
                  Retrouvez ce numéro dans votre reçu de confirmation
                </Text>
              </View>
            </View>
          )}

          {/* ── Loading ── */}
          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              <Text style={styles.loadingText}>Recherche en cours…</Text>
              <Text style={styles.loadingRef}>{query}</Text>
            </View>
          )}

          {/* ── Not found ── */}
          {notFound && !loading && (
            <View style={styles.notFoundWrap}>
              <View style={styles.notFoundIcon}>
                <Feather name="alert-circle" size={44} color="#EF4444" />
              </View>
              <Text style={styles.notFoundTitle}>Colis introuvable</Text>
              <Text style={styles.notFoundDesc}>
                Aucun colis ne correspond au numéro{"\n"}
                <Text style={styles.notFoundRef}>{query}</Text>
              </Text>
              <Text style={styles.notFoundHint}>
                Vérifiez votre numéro et réessayez
              </Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => {
                  reset();
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
              >
                <Feather name="refresh-cw" size={14} color={Colors.light.primary} />
                <Text style={styles.retryText}>Nouvel essai</Text>
              </Pressable>
            </View>
          )}

          {/* ── Result ── */}
          {result && !loading && (
            <Animated.View
              style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            >
              {/* Ref + status */}
              <View style={styles.refCard}>
                <View>
                  <Text style={styles.refCardLabel}>NUMÉRO DE SUIVI</Text>
                  <Text style={styles.refCardValue}>{result.trackingRef}</Text>
                </View>
                {statusStyle && (
                  <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusStyle.color }]} />
                    <Text style={[styles.statusPillText, { color: statusStyle.color }]}>
                      {isCancelled
                        ? "Annulé"
                        : STATUS_STEPS[currentStep]?.label || "En cours"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Route */}
              <View style={styles.routeCard}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: "#10B981" }]} />
                  <View>
                    <Text style={styles.routeCityName}>{result.fromCity}</Text>
                    <Text style={styles.routeCityLabel}>Départ</Text>
                  </View>
                </View>
                <View style={styles.routeMiddle}>
                  <View style={styles.routeHLine} />
                  <View style={styles.routeIconBox}>
                    <Feather name="package" size={14} color={Colors.light.primary} />
                  </View>
                  <View style={styles.routeHLine} />
                </View>
                <View style={[styles.routePoint, { justifyContent: "flex-end" }]}>
                  <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                    <Text style={styles.routeCityName}>{result.toCity}</Text>
                    <Text style={styles.routeCityLabel}>Destination</Text>
                  </View>
                  <View style={[styles.routeDot, { backgroundColor: "#EF4444" }]} />
                </View>
              </View>

              {/* Parcel info */}
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Informations du colis</Text>

                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { backgroundColor: "#EEF2FF" }]}>
                    <Feather name="user" size={14} color={Colors.light.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Expéditeur</Text>
                    <Text style={styles.infoValue}>{result.senderName}</Text>
                    {result.senderPhone ? (
                      <Text style={styles.infoSub}>+225 {result.senderPhone}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { backgroundColor: "#ECFDF5" }]}>
                    <Feather name="user-check" size={14} color="#059669" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Destinataire</Text>
                    <Text style={styles.infoValue}>{result.receiverName}</Text>
                    {result.receiverPhone ? (
                      <Text style={styles.infoSub}>+225 {result.receiverPhone}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { backgroundColor: "#F5F3FF" }]}>
                    <Feather name="box" size={14} color="#7C3AED" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Type de colis</Text>
                    <Text style={styles.infoValue}>
                      {TYPE_LABELS[result.parcelType] || result.parcelType}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { backgroundColor: "#FFF7ED" }]}>
                    <Feather name="shopping-bag" size={14} color="#D97706" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Poids</Text>
                    <Text style={styles.infoValue}>{result.weight} kg</Text>
                  </View>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <View style={[styles.infoIcon, { backgroundColor: "#ECFEFF" }]}>
                    <Feather name="truck" size={14} color="#0891B2" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Mode de livraison</Text>
                    <Text style={styles.infoValue}>
                      {DELIVERY_LABELS[result.deliveryType] || result.deliveryType}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Timeline */}
              {!isCancelled && (
                <View style={styles.timelineCard}>
                  <View style={styles.timelineHeader}>
                    <Feather name="activity" size={15} color={Colors.light.primary} />
                    <Text style={styles.timelineTitle}>Suivi de progression</Text>
                    <View style={styles.timelineProgress}>
                      <Text style={styles.timelineProgressText}>
                        {currentStep + 1}/{STATUS_STEPS.length}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${((currentStep + 1) / STATUS_STEPS.length) * 100}%` },
                      ]}
                    />
                  </View>

                  {/* Steps */}
                  {STATUS_STEPS.map((step, i) => {
                    const done = i <= currentStep;
                    const current = i === currentStep;
                    const isLast = i === STATUS_STEPS.length - 1;

                    return (
                      <View key={step.id} style={styles.timelineStep}>
                        {/* Left: icon + line */}
                        <View style={styles.timelineLeft}>
                          <View
                            style={[
                              styles.timelineCircle,
                              done
                                ? current
                                  ? styles.timelineCircleCurrent
                                  : styles.timelineCircleDone
                                : styles.timelineCirclePending,
                            ]}
                          >
                            {done ? (
                              current ? (
                                <Feather name={step.icon as never} size={15} color="white" />
                              ) : (
                                <Feather name="check" size={13} color="white" />
                              )
                            ) : (
                              <Text style={styles.timelineNum}>{i + 1}</Text>
                            )}
                          </View>
                          {!isLast && (
                            <View
                              style={[
                                styles.timelineLine,
                                done && i < currentStep && styles.timelineLineDone,
                              ]}
                            />
                          )}
                        </View>

                        {/* Right: text */}
                        <View style={[styles.timelineBody, !isLast && { paddingBottom: 22 }]}>
                          <Text
                            style={[
                              styles.timelineStepLabel,
                              done && !current && styles.timelineStepLabelDone,
                              current && styles.timelineStepLabelCurrent,
                            ]}
                          >
                            {step.label}
                          </Text>
                          <Text style={styles.timelineStepDesc}>{step.desc}</Text>
                          {current && (
                            <View style={styles.activeBadge}>
                              <View style={styles.activeBadgeDot} />
                              <Text style={styles.activeBadgeText}>Statut actuel</Text>
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
                  <Feather name="x-circle" size={28} color="#EF4444" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cancelledTitle}>Colis annulé</Text>
                    <Text style={styles.cancelledDesc}>
                      Ce colis a été annulé. Contactez le support pour plus d'informations.
                    </Text>
                  </View>
                </View>
              )}

              {/* New search */}
              <Pressable style={styles.newSearchBtn} onPress={reset}>
                <Feather name="search" size={14} color={Colors.light.primary} />
                <Text style={styles.newSearchText}>Rechercher un autre colis</Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },

  // Search bar
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
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInputRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInputIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#0F172A",
    letterSpacing: 0.4,
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
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  searchBtnDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  searchBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "white",
  },

  scroll: { padding: 16, gap: 14 },

  // Idle
  idleWrap: {
    alignItems: "center",
    paddingTop: 28,
    gap: 14,
  },
  idleIllustration: {
    position: "relative",
    marginBottom: 4,
  },
  idleCircle: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#C7D2FE",
  },
  idlePulse: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
    opacity: 0.4,
  },
  idleTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    textAlign: "center",
  },
  idleDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 290,
  },
  formatBox: {
    backgroundColor: "white",
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginTop: 6,
    width: "100%",
  },
  formatLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  formatRef: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    letterSpacing: 2,
    marginBottom: 6,
  },
  formatHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    textAlign: "center",
  },

  // Loading
  loadingWrap: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  loadingRef: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    letterSpacing: 1,
  },

  // Not found
  notFoundWrap: {
    alignItems: "center",
    paddingTop: 36,
    gap: 10,
  },
  notFoundIcon: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "#FECACA",
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
  },
  notFoundRef: {
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  notFoundHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 6,
  },
  retryText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },

  // Ref card
  refCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  refCardLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  refCardValue: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    letterSpacing: 1.2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 110,
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
  },
  routePoint: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeCityName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  routeCityLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 1,
  },
  routeMiddle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  routeHLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#E2E8F0",
  },
  routeIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },

  // Info card
  infoCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    gap: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  infoSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 2,
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
    gap: 0,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  timelineTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    flex: 1,
  },
  timelineProgress: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timelineProgressText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },

  // Progress bar
  progressBarBg: {
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    marginBottom: 22,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
  },

  // Timeline steps
  timelineStep: {
    flexDirection: "row",
    gap: 14,
  },
  timelineLeft: {
    alignItems: "center",
    width: 42,
  },
  timelineCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineCircleDone: {
    backgroundColor: Colors.light.primary,
  },
  timelineCirclePending: {
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  timelineCircleCurrent: {
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  timelineNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#CBD5E1",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginTop: 4,
    minHeight: 16,
  },
  timelineLineDone: {
    backgroundColor: Colors.light.primary,
  },
  timelineBody: {
    flex: 1,
    paddingTop: 9,
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
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 5,
  },
  activeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
  },
  activeBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },

  // Cancelled
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
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#EF4444",
    marginBottom: 3,
  },
  cancelledDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    lineHeight: 18,
  },

  // New search button
  newSearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  newSearchText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
});
