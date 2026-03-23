import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import NetInfo from "@react-native-community/netinfo";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useBooking } from "@/context/BookingContext";
import { notifyReservationConfirmee } from "@/services/notificationService";
import { apiFetch } from "@/utils/api";
import { generateOfflineId, saveOffline } from "@/utils/offline";

interface BookingResponse {
  id: string;
  bookingRef: string;
}

interface TripDetail {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  busName: string;
  busType: string;
  price: number;
  duration: string;
}

type PayMethod = "orange" | "mtn" | "wave" | "card";

const PAYMENT_METHODS: {
  id: PayMethod;
  label: string;
  sub: string;
  color: string;
  dark: string;
  icon: string;
}[] = [
  {
    id: "orange",
    label: "Orange Money",
    sub: "Paiement mobile Orange",
    color: "#FF6B00",
    dark: "#E05A00",
    icon: "smartphone",
  },
  {
    id: "mtn",
    label: "MTN MoMo",
    sub: "Mobile Money MTN",
    color: "#FFCB00",
    dark: "#E6B800",
    icon: "smartphone",
  },
  {
    id: "wave",
    label: "Wave",
    sub: "Paiement Wave CI",
    color: "#1BA5E0",
    dark: "#1591C7",
    icon: "zap",
  },
  {
    id: "card",
    label: "Visa / Mastercard",
    sub: "Carte bancaire internationale",
    color: "#1A56DB",
    dark: "#0F3BA0",
    icon: "credit-card",
  },
];

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { booking, updateBooking } = useBooking();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [method, setMethod] = useState<PayMethod>("orange");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [loading, setLoading] = useState(false);
  const [payStep, setPayStep] = useState<"idle" | "creating" | "processing" | "confirming">("idle");

  const [promoInput, setPromoInput]   = useState("");
  const [promoData, setPromoData]     = useState<{ id: string; code: string; discount: number; minAmount: number } | null>(null);
  const [promoError, setPromoError]   = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    if (!booking?.tripId) return;
    apiFetch<TripDetail>(`/trips/${booking.tripId}`)
      .then(setTrip)
      .catch(() => null);
  }, [booking?.tripId]);

  const formatCard = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 10);
    if (digits.length > 4) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`.trim();
    return digits;
  };

  /* ── Flux de paiement en 3 étapes ──────────────────────────────────────
     1. Créer réservation (status: pending)
     2. Simuler le traitement du paiement mobile
     3. Confirmer la réservation (status: confirmed, paymentStatus: paid)
  ────────────────────────────────────────────────────────────────────── */
  const handlePay = async () => {
    if (!booking || !token) return;

    if (method === "card") {
      if (!cardNumber || !expiry || !cvv || !cardName) {
        Alert.alert("Champs requis", "Veuillez remplir tous les champs de la carte.");
        return;
      }
    } else {
      if (!phone || phone.replace(/\D/g, "").length < 8) {
        Alert.alert("Numéro requis", "Veuillez entrer un numéro de téléphone valide.");
        return;
      }
    }

    /* ── Détection hors-ligne ── */
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) {
      const primaryPassenger = booking.passengers?.[0];
      const offlineId = generateOfflineId();
      await saveOffline({
        id:        offlineId,
        type:      "reservation",
        token,
        createdAt: Date.now(),
        payload: {
          tripId:         booking.tripId ?? "",
          passengerName:  primaryPassenger?.name  ?? "Passager",
          passengerPhone: booking.contactPhone     ?? phone,
          passengerCount: booking.passengers?.length ?? 1,
          paymentMethod:  method,
        },
      });
      Alert.alert(
        "Hors ligne",
        "Vous n'êtes pas connecté. Votre réservation a été sauvegardée localement et sera envoyée automatiquement dès la reconnexion.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
      );
      return;
    }

    setLoading(true);
    try {
      // Étape 1 — Créer la réservation (pending)
      setPayStep("creating");
      const created = await apiFetch<BookingResponse>("/bookings", {
        method: "POST",
        token,
        body: JSON.stringify({
          tripId: booking.tripId,
          seatIds: booking.selectedSeats,
          passengers: booking.passengers.map((p) => ({
            name: p.name || "Passager",
            age: parseInt(p.age) || 25,
            gender: p.gender,
            idType: p.idType || "cni",
            idNumber: p.idNumber || "CI-000000",
            seatNumber: p.seatNumber,
          })),
          paymentMethod: method,
          contactEmail: booking.contactEmail || "user@gobooking.ci",
          contactPhone: booking.contactPhone || phone,
          ...(promoData ? { promoId: promoData.id } : {}),
        }),
      });

      // Étape 2 — Simuler le traitement du paiement
      setPayStep("processing");
      await new Promise((resolve) => setTimeout(resolve, 1800));

      // Étape 3 — Confirmer la réservation (confirmed + paid)
      setPayStep("confirming");
      await apiFetch(`/bookings/${created.id}/confirm`, {
        method: "POST",
        token,
        body: JSON.stringify({ paymentMethod: method }),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      /* Notification locale de confirmation */
      notifyReservationConfirmee({
        ref:   created.bookingRef,
        route: trip ? `${trip.from} → ${trip.to}` : undefined,
        date:  trip?.departureTime,
      }).catch(() => {});
      updateBooking({ paymentMethod: method });
      router.replace({
        pathname: "/confirmation/[bookingId]",
        params: { bookingId: created.id },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Échec du paiement";
      Alert.alert("Paiement échoué", msg);
    } finally {
      setLoading(false);
      setPayStep("idle");
    }
  };

  const payStepLabel = () => {
    if (payStep === "creating") return "Création de la réservation…";
    if (payStep === "processing") return "Traitement du paiement…";
    if (payStep === "confirming") return "Confirmation en cours…";
    return "Payer maintenant";
  };

  const validatePromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) { setPromoError("Entrez un code promo."); return; }
    setPromoLoading(true); setPromoError("");
    try {
      const data = await apiFetch<{ id: string; code: string; discount: number; minAmount: number }>(
        `/growth/promo/${code}`, { token }
      );
      const base = booking?.totalAmount ?? 0;
      if (data.minAmount > base) {
        setPromoError(`Montant minimum requis : ${data.minAmount.toLocaleString()} FCFA`);
        setPromoData(null);
      } else {
        setPromoData(data);
        setPromoError("");
      }
    } catch (err: any) {
      setPromoData(null);
      setPromoError(err.message ?? "Code promo invalide");
    } finally {
      setPromoLoading(false);
    }
  };

  const discountedTotal = promoData
    ? Math.max(0, (booking?.totalAmount ?? 0) - promoData.discount)
    : (booking?.totalAmount ?? 0);

  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === method)!;

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
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="white" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Paiement</Text>
            <Text style={styles.headerSub}>Sécurisé · Chiffré SSL</Text>
          </View>
          <View style={styles.lockBadge}>
            <Feather name="lock" size={16} color="white" />
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Trip summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <Text style={styles.summaryLabel}>Récapitulatif du voyage</Text>
              {trip && (
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>{trip.busName}</Text>
                </View>
              )}
            </View>

            {trip ? (
              <View style={styles.routeRow}>
                <View style={styles.cityBlock}>
                  <Text style={styles.routeTime}>{trip.departureTime}</Text>
                  <Text style={styles.routeCity}>{trip.from}</Text>
                </View>
                <View style={styles.routeMid}>
                  <View style={styles.routeDotGreen} />
                  <View style={styles.routeLine} />
                  <Feather name="arrow-right" size={14} color={Colors.light.primary} />
                  <View style={styles.routeLine} />
                  <View style={styles.routeDotRed} />
                </View>
                <View style={[styles.cityBlock, { alignItems: "flex-end" }]}>
                  <Text style={styles.routeTime}>{trip.arrivalTime}</Text>
                  <Text style={styles.routeCity}>{trip.to}</Text>
                </View>
              </View>
            ) : (
              <ActivityIndicator color={Colors.light.primary} style={{ marginVertical: 16 }} />
            )}

            <View style={styles.summaryDetails}>
              <View style={styles.summaryDetail}>
                <Feather name="grid" size={13} color={Colors.light.textSecondary} />
                <Text style={styles.summaryDetailText}>
                  Siège{(booking?.selectedSeatNumbers?.length ?? 0) > 1 ? "s" : ""}{" "}
                  <Text style={styles.summaryDetailValue}>
                    {booking?.selectedSeatNumbers?.join(", ") || "—"}
                  </Text>
                </Text>
              </View>
              <View style={styles.summaryDetail}>
                <Feather name="calendar" size={13} color={Colors.light.textSecondary} />
                <Text style={styles.summaryDetailText}>
                  <Text style={styles.summaryDetailValue}>{trip?.date || "—"}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Montant total</Text>
              <View style={{ alignItems: "flex-end" }}>
                {promoData && (
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8", textDecorationLine: "line-through" }}>
                    {booking?.totalAmount?.toLocaleString()} FCFA
                  </Text>
                )}
                <Text style={[styles.totalAmount, promoData ? { color: "#059669" } : {}]}>
                  {discountedTotal.toLocaleString()} FCFA
                </Text>
                {promoData && (
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#059669" }}>
                    -{promoData.discount.toLocaleString()} FCFA avec {promoData.code}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Promo code section */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: promoData ? "#059669" : "#E2E8F0" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Feather name="tag" size={16} color={promoData ? "#059669" : Colors.light.primary} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0F172A" }}>Code promo</Text>
              {promoData && (
                <View style={{ backgroundColor: "#ECFDF5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#059669" }}>Appliqué !</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={{ flex: 1, borderWidth: 1.5, borderColor: promoData ? "#059669" : "#E2E8F0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_500Medium", color: "#0F172A", backgroundColor: "#F8FAFC" }}
                placeholder="Ex: GO1000"
                placeholderTextColor="#94A3B8"
                value={promoInput}
                onChangeText={t => { setPromoInput(t.toUpperCase()); setPromoData(null); setPromoError(""); }}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!promoData}
              />
              {promoData ? (
                <Pressable onPress={() => { setPromoData(null); setPromoInput(""); }} style={{ backgroundColor: "#FEF2F2", borderRadius: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="x" size={16} color="#DC2626" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={validatePromo}
                  disabled={promoLoading || !promoInput.trim()}
                  style={{ backgroundColor: Colors.light.primary, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}
                >
                  {promoLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "white" }}>Appliquer</Text>}
                </Pressable>
              )}
            </View>
            {!!promoError && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <Feather name="alert-circle" size={13} color="#DC2626" />
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626" }}>{promoError}</Text>
              </View>
            )}
          </View>

          {/* Payment methods */}
          <Text style={styles.sectionTitle}>Mode de paiement</Text>
          <View style={styles.methodsGrid}>
            {PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.methodCard, method === m.id && { borderColor: m.color, borderWidth: 2 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMethod(m.id);
                }}
              >
                <LinearGradient
                  colors={[m.color, m.dark]}
                  style={[styles.methodIcon, method !== m.id && styles.methodIconInactive]}
                >
                  <Feather name={m.icon as never} size={18} color="white" />
                </LinearGradient>
                <Text style={[styles.methodLabel, method === m.id && { color: m.color }]}>
                  {m.label}
                </Text>
                <Text style={styles.methodSub}>{m.sub}</Text>
                {method === m.id && (
                  <View style={[styles.methodCheck, { backgroundColor: m.color }]}>
                    <Feather name="check" size={10} color="white" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* Mobile money phone input */}
          {method !== "card" && (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <LinearGradient
                  colors={[selectedMethod.color, selectedMethod.dark]}
                  style={styles.formMethodDot}
                >
                  <Feather name={selectedMethod.icon as never} size={14} color="white" />
                </LinearGradient>
                <Text style={styles.formTitle}>
                  Numéro {selectedMethod.label}
                </Text>
              </View>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇨🇮 +225</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="07 00 00 00 00"
                  placeholderTextColor={Colors.light.textMuted}
                  value={phone}
                  onChangeText={(t) => setPhone(formatPhone(t))}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
              </View>
              <View style={styles.phoneHint}>
                <Feather name="info" size={12} color={selectedMethod.color} />
                <Text style={[styles.phoneHintText, { color: selectedMethod.color }]}>
                  {method === "orange" && "Numéro Orange CI (07/08 XX XX XX XX)"}
                  {method === "mtn" && "Numéro MTN CI (05/06 XX XX XX XX)"}
                  {method === "wave" && "Votre numéro Wave enregistré"}
                </Text>
              </View>
            </View>
          )}

          {/* Card form */}
          {method === "card" && (
            <View style={styles.formCard}>
              <LinearGradient
                colors={[Colors.light.primary, Colors.light.primaryDark]}
                style={styles.cardPreview}
              >
                <View style={styles.cardPreviewTop}>
                  <View style={styles.cardChip}>
                    <Feather name="cpu" size={14} color="rgba(255,255,255,0.8)" />
                  </View>
                  <Text style={styles.cardPreviewBrand}>VISA</Text>
                </View>
                <Text style={styles.cardPreviewNumber}>
                  {cardNumber || "•••• •••• •••• ••••"}
                </Text>
                <View style={styles.cardPreviewBottom}>
                  <Text style={styles.cardPreviewLabel}>
                    {cardName || "NOM PRÉNOM"}
                  </Text>
                  <Text style={styles.cardPreviewExpiry}>{expiry || "MM/AA"}</Text>
                </View>
              </LinearGradient>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Numéro de carte</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={Colors.light.textMuted}
                  value={cardNumber}
                  onChangeText={(t) => setCardNumber(formatCard(t))}
                  keyboardType="number-pad"
                  maxLength={19}
                />
              </View>
              <View style={styles.cardRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Expiration</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="MM/AA"
                    placeholderTextColor={Colors.light.textMuted}
                    value={expiry}
                    onChangeText={(t) => setExpiry(formatExpiry(t))}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>CVV</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="123"
                    placeholderTextColor={Colors.light.textMuted}
                    value={cvv}
                    onChangeText={(t) => setCvv(t.replace(/\D/g, "").slice(0, 3))}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={3}
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nom sur la carte</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="KOFFI JEAN-PAUL"
                  placeholderTextColor={Colors.light.textMuted}
                  value={cardName}
                  onChangeText={(t) => setCardName(t.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          )}

          <View style={styles.secureRow}>
            <Feather name="shield" size={14} color="#059669" />
            <Text style={styles.secureText}>
              Paiement sécurisé · Données chiffrées 256-bit SSL
            </Text>
          </View>
        </ScrollView>

        {/* Bottom pay button */}
        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 8 }]}>
          <View style={styles.bottomAmount}>
            <Text style={styles.bottomAmountLabel}>À payer</Text>
            <Text style={styles.bottomAmountValue}>
              {booking?.totalAmount?.toLocaleString() ?? "0"} FCFA
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.payBtn,
              pressed && styles.payBtnPressed,
              loading && { opacity: 0.7 },
            ]}
            onPress={handlePay}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="white" size="small" />
                <Text style={styles.payBtnText}>{payStepLabel()}</Text>
              </>
            ) : (
              <>
                <Feather name="check-circle" size={18} color="white" />
                <Text style={styles.payBtnText}>Confirmer le paiement</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
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
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  lockBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  scroll: {
    padding: 16,
    gap: 16,
  },

  // Summary card
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#1A56DB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  companyBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  companyBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  cityBlock: { flex: 1 },
  routeTime: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  routeCity: {
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
    gap: 3,
  },
  routeDotGreen: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  routeDotRed: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  routeLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#E2E8F0",
  },
  summaryDetails: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  summaryDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  summaryDetailText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  summaryDetailValue: {
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  totalAmount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },

  // Section
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    marginBottom: 2,
    marginTop: 4,
  },

  // Methods grid
  methodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  methodCard: {
    width: "47%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 6,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  methodIconInactive: {
    opacity: 0.6,
  },
  methodLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  methodSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    lineHeight: 14,
  },
  methodCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  // Form card
  formCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  formMethodDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  formTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  phoneInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  countryCode: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  countryCodeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  phoneInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "#0F172A",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  phoneHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  phoneHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  // Card form
  cardPreview: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 4,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardPreviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardChip: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardPreviewBrand: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 2,
  },
  cardPreviewNumber: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: "white",
    letterSpacing: 2,
    marginBottom: 20,
  },
  cardPreviewBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardPreviewLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 1,
  },
  cardPreviewExpiry: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  fieldInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },

  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 4,
  },
  secureText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
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
  bottomAmount: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomAmountLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  bottomAmountValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  payBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
});
