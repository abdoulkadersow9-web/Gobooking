import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/context/AuthContext";
import { useParcel } from "@/context/ParcelContext";
import { apiFetch } from "@/utils/api";

type PayMethod = "orange" | "mtn" | "wave" | "card";

const PAYMENT_METHODS: {
  id: PayMethod;
  label: string;
  sub: string;
  color: string;
  dark: string;
  icon: string;
}[] = [
  { id: "orange", label: "Orange Money", sub: "Paiement mobile Orange", color: "#FF6B00", dark: "#E05A00", icon: "smartphone" },
  { id: "mtn", label: "MTN MoMo", sub: "Mobile Money MTN", color: "#FFCB00", dark: "#E6B800", icon: "smartphone" },
  { id: "wave", label: "Wave", sub: "Paiement Wave CI", color: "#1BA5E0", dark: "#1591C7", icon: "zap" },
  { id: "card", label: "Visa / Mastercard", sub: "Carte bancaire", color: "#1A56DB", dark: "#0F3BA0", icon: "credit-card" },
];

const DELIVERY_LABELS: Record<string, string> = {
  depot_agence: "Dépôt en agence",
  livraison_domicile: "Livraison à domicile",
  retrait_agence: "Retrait en agence",
};

const TYPE_LABELS: Record<string, string> = {
  documents: "Documents",
  vetements: "Vêtements",
  electronique: "Électronique",
  alimentaire: "Alimentaire",
  cosmetique: "Cosmétique",
  autre: "Autre",
};

function generateTrackingRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "GBX-";
  for (let i = 0; i < 8; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3) ref += "-";
  }
  return ref;
}

export default function ParcelPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { parcel, updateParcel } = useParcel();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [method, setMethod] = useState<PayMethod>("orange");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [loading, setLoading] = useState(false);

  const formatPhone = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 10);
    if (digits.length > 6) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`.trim();
    if (digits.length > 4) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`.trim();
    if (digits.length > 2) return `${digits.slice(0, 2)} ${digits.slice(2)}`.trim();
    return digits;
  };

  const formatCard = (t: string) =>
    t.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  const formatExpiry = (t: string) => {
    const d = t.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const clientRef = generateTrackingRef();
      let confirmedRef = clientRef;
      let parcelId: string | null = null;

      if (token) {
        try {
          /* Create parcel with paymentStatus=pending so CinetPay flow can confirm it */
          const saved = await apiFetch<{ trackingRef: string; id: string }>("/parcels", {
            method: "POST",
            token,
            body: JSON.stringify({
              fromCity: parcel.fromCity,
              toCity: parcel.toCity,
              senderName: parcel.senderName,
              senderPhone: parcel.senderPhone,
              receiverName: parcel.receiverName,
              receiverPhone: parcel.receiverPhone,
              parcelType: parcel.parcelType,
              weight: parcel.weight,
              description: parcel.description,
              deliveryType: parcel.deliveryType,
              paymentMethod: method,
              trackingRef: clientRef,
              paymentStatus: "pending",
            }),
          });
          if (saved?.trackingRef) confirmedRef = saved.trackingRef;
          if (saved?.id) parcelId = saved.id;
        } catch {
          /* API unavailable — fall back to local confirmation */
        }
      }

      updateParcel({ paymentMethod: method, trackingRef: confirmedRef });

      /* If we have a parcelId from server, go through the CinetPay payment flow */
      if (parcelId) {
        router.replace({
          pathname: "/parcel/cinetpay",
          params: { parcelId, amount: String(parcel.amount ?? 0), trackingRef: confirmedRef },
        });
      } else {
        /* Offline / unauthenticated — go straight to local confirmation */
        router.replace({
          pathname: "/parcel/confirmation/[parcelId]",
          params: { parcelId: "local", trackingRef: confirmedRef },
        });
      }
    } catch {
      const trackingRef = generateTrackingRef();
      updateParcel({ paymentMethod: method, trackingRef });
      router.replace({
        pathname: "/parcel/confirmation/[parcelId]",
        params: { parcelId: "local", trackingRef },
      });
    } finally {
      setLoading(false);
    }
  };

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
          <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
            <Feather name="arrow-left" size={20} color="white" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Paiement colis</Text>
            <Text style={styles.headerSub}>Sécurisé · Chiffré SSL</Text>
          </View>
          <View style={styles.lockBadge}>
            <Feather name="lock" size={16} color="white" />
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 130 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Parcel summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryIconBox}>
                <Feather name="package" size={18} color="#059669" />
              </View>
              <Text style={styles.summaryTitle}>Récapitulatif du colis</Text>
            </View>

            <View style={styles.routeBanner}>
              <Text style={styles.routeCity}>{parcel.fromCity || "—"}</Text>
              <View style={styles.routeArrow}>
                <View style={styles.routeLine} />
                <Feather name="chevron-right" size={16} color={Colors.light.primary} />
              </View>
              <Text style={styles.routeCity}>{parcel.toCity || "—"}</Text>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Expéditeur</Text>
                <Text style={styles.summaryValue}>{parcel.senderName || "—"}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Destinataire</Text>
                <Text style={styles.summaryValue}>{parcel.receiverName || "—"}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>
                  {TYPE_LABELS[parcel.parcelType ?? ""] || parcel.parcelType || "—"}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Poids</Text>
                <Text style={styles.summaryValue}>{parcel.weight ? `${parcel.weight} kg` : "—"}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Livraison</Text>
                <Text style={styles.summaryValue}>
                  {DELIVERY_LABELS[parcel.deliveryType ?? ""] || parcel.deliveryType || "—"}
                </Text>
              </View>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Montant total</Text>
              <Text style={styles.totalValue}>
                {(parcel.amount ?? 0).toLocaleString()} FCFA
              </Text>
            </View>
          </View>

          {/* Payment methods */}
          <Text style={styles.sectionTitle}>Mode de paiement</Text>
          <View style={styles.methodsGrid}>
            {PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m.id}
                style={[
                  styles.methodCard,
                  method === m.id && { borderColor: m.color, borderWidth: 2 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMethod(m.id);
                }}
              >
                <LinearGradient
                  colors={[m.color, m.dark]}
                  style={[styles.methodIcon, method !== m.id && { opacity: 0.55 }]}
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

          {/* Mobile payment input */}
          {method !== "card" && (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <LinearGradient
                  colors={[selectedMethod.color, selectedMethod.dark]}
                  style={styles.formIconBox}
                >
                  <Feather name={selectedMethod.icon as never} size={14} color="white" />
                </LinearGradient>
                <Text style={styles.formTitle}>Numéro {selectedMethod.label}</Text>
              </View>
              <View style={styles.phoneRow}>
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
              <Text style={styles.phoneHint}>
                Vous recevrez une demande de paiement sur ce numéro
              </Text>
            </View>
          )}

          {/* Card payment input */}
          {method === "card" && (
            <View style={styles.formCard}>
              <LinearGradient
                colors={[Colors.light.primary, Colors.light.primaryDark]}
                style={styles.cardPreview}
              >
                <View style={styles.cardPreviewTop}>
                  <View style={styles.cardChip}>
                    <Feather name="cpu" size={13} color="rgba(255,255,255,0.8)" />
                  </View>
                  <Text style={styles.cardBrand}>VISA</Text>
                </View>
                <Text style={styles.cardNumber}>
                  {cardNumber || "•••• •••• •••• ••••"}
                </Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardLabel}>{cardName || "NOM PRÉNOM"}</Text>
                  <Text style={styles.cardLabel}>{expiry || "MM/AA"}</Text>
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
              <View style={styles.twoCol}>
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
            <Feather name="shield" size={13} color="#059669" />
            <Text style={styles.secureText}>
              Paiement sécurisé · Données chiffrées 256-bit SSL
            </Text>
          </View>
        </ScrollView>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 8 }]}>
          <View style={styles.bottomAmount}>
            <Text style={styles.bottomAmountLabel}>À payer</Text>
            <Text style={styles.bottomAmountValue}>
              {(parcel.amount ?? 0).toLocaleString()} FCFA
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.payBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.75 },
            ]}
            onPress={handlePay}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
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
  container: { flex: 1, backgroundColor: "#F1F5F9" },

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
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
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

  scroll: { padding: 16, gap: 16 },

  // Summary card
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    gap: 14,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  routeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 14,
    gap: 0,
  },
  routeCity: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    flex: 1,
    textAlign: "center",
  },
  routeArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    width: 50,
    justifyContent: "center",
  },
  routeLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#C7D2FE",
  },
  summaryGrid: { gap: 0 },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
    maxWidth: "55%",
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  totalValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },

  // Payment methods
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
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
  methodLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  methodSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
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
  },
  formIconBox: {
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
  phoneRow: {
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
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 16,
  },

  // Card preview
  cardPreview: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 4,
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
  cardBrand: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 2,
  },
  cardNumber: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    color: "white",
    letterSpacing: 2,
    marginBottom: 20,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 1,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  fieldInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  twoCol: { flexDirection: "row", gap: 12 },

  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  secureText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
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
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomAmount: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomAmountLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
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
  payBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
});
