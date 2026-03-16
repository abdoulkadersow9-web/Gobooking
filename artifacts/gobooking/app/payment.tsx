import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useBooking } from "@/context/BookingContext";
import { apiFetch } from "@/utils/api";

interface BookingResponse {
  id: string;
  bookingRef: string;
}

const PAYMENT_METHODS = [
  { id: "card", icon: "credit-card", label: "Credit / Debit Card" },
  { id: "upi", icon: "smartphone", label: "UPI Payment" },
  { id: "wallet", icon: "pocket", label: "Digital Wallet" },
  { id: "netbanking", icon: "briefcase", label: "Net Banking" },
] as const;

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { booking, updateBooking } = useBooking();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [method, setMethod] = useState<"card" | "upi" | "wallet" | "netbanking">("card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [loading, setLoading] = useState(false);

  const formatCard = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handlePay = async () => {
    if (!booking || !token) return;

    if (method === "card") {
      if (!cardNumber || !expiry || !cvv || !cardName) {
        Alert.alert("Error", "Please fill in all card details");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await apiFetch<BookingResponse>("/bookings", {
        method: "POST",
        token,
        body: JSON.stringify({
          tripId: booking.tripId,
          seatIds: booking.selectedSeats,
          passengers: booking.passengers.map((p) => ({
            name: p.name,
            age: parseInt(p.age) || 0,
            gender: p.gender,
            idType: p.idType,
            idNumber: p.idNumber,
            seatNumber: p.seatNumber,
          })),
          paymentMethod: method,
          contactEmail: booking.contactEmail,
          contactPhone: booking.contactPhone,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateBooking({ paymentMethod: method });
      router.replace({
        pathname: "/confirmation/[bookingId]",
        params: { bookingId: res.id },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      Alert.alert("Payment Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Seats</Text>
            <Text style={styles.summaryValue}>{booking?.selectedSeatNumbers?.join(", ")}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Passengers</Text>
            <Text style={styles.summaryValue}>{booking?.passengers?.length}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{booking?.totalAmount?.toLocaleString()} FCFA</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.methodsGrid}>
          {PAYMENT_METHODS.map((m) => (
            <Pressable
              key={m.id}
              style={[styles.methodCard, method === m.id && styles.methodCardActive]}
              onPress={() => setMethod(m.id)}
            >
              <View style={[styles.methodIcon, method === m.id && styles.methodIconActive]}>
                <Feather name={m.icon as never} size={20} color={method === m.id ? "white" : Colors.light.primary} />
              </View>
              <Text style={[styles.methodLabel, method === m.id && styles.methodLabelActive]}>
                {m.label}
              </Text>
              {method === m.id && (
                <View style={styles.methodCheck}>
                  <Feather name="check" size={12} color="white" />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {method === "card" && (
          <View style={styles.cardForm}>
            <Text style={styles.sectionTitle}>Card Details</Text>
            <View style={styles.cardPreview}>
              <View style={styles.cardChip}>
                <Feather name="cpu" size={16} color="rgba(255,255,255,0.8)" />
              </View>
              <Text style={styles.cardPreviewNumber}>
                {cardNumber || "•••• •••• •••• ••••"}
              </Text>
              <View style={styles.cardPreviewBottom}>
                <Text style={styles.cardPreviewLabel}>
                  {cardName || "CARDHOLDER NAME"}
                </Text>
                <Text style={styles.cardPreviewExpiry}>
                  {expiry || "MM/YY"}
                </Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Card Number</Text>
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
                <Text style={styles.fieldLabel}>Expiry</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="MM/YY"
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
              <Text style={styles.fieldLabel}>Name on Card</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="John Smith"
                placeholderTextColor={Colors.light.textMuted}
                value={cardName}
                onChangeText={(t) => setCardName(t.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
          </View>
        )}

        {method !== "card" && (
          <View style={styles.altMethodInfo}>
            <Feather name="info" size={16} color={Colors.light.primary} />
            <Text style={styles.altMethodText}>
              You'll be redirected to complete payment after placing the order.
            </Text>
          </View>
        )}

        <View style={styles.secureNote}>
          <Feather name="lock" size={14} color={Colors.light.success} />
          <Text style={styles.secureText}>256-bit SSL encryption · Secure payment</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <View>
          <Text style={styles.totalLabel}>Amount to Pay</Text>
          <Text style={styles.totalAmount}>{booking?.totalAmount?.toLocaleString()} FCFA</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.payBtn,
            pressed && styles.payBtnPressed,
            loading && styles.payBtnDisabled,
          ]}
          onPress={handlePay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Feather name="lock" size={16} color="white" />
              <Text style={styles.payBtnText}>Pay Now</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
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
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  summaryCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  summaryTotal: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 12,
  },
  methodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  methodCard: {
    width: "47%",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: "flex-start",
    gap: 8,
    position: "relative",
  },
  methodCardActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  methodIconActive: {
    backgroundColor: Colors.light.primary,
  },
  methodLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  methodLabelActive: {
    color: Colors.light.primary,
  },
  methodCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  cardForm: {
    marginBottom: 16,
  },
  cardPreview: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardChip: {
    width: 40,
    height: 30,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
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
    letterSpacing: 1,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  altMethodInfo: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  altMethodText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.primary,
    lineHeight: 20,
  },
  secureNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 8,
  },
  secureText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
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
  totalAmount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
});
