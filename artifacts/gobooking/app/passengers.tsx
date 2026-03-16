import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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

export default function PassengersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { booking, updateBooking } = useBooking();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [passengers, setPassengers] = useState(
    booking?.passengers || []
  );
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [contactPhone, setContactPhone] = useState(user?.phone || "");

  const updatePassenger = (index: number, field: string, value: string) => {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleContinue = () => {
    for (const p of passengers) {
      if (!p.name.trim() || !p.age || !p.idNumber.trim()) {
        Alert.alert("Error", "Please fill in all passenger details");
        return;
      }
    }
    if (!contactEmail.trim() || !contactPhone.trim()) {
      Alert.alert("Error", "Please fill in contact details");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateBooking({ passengers, contactEmail, contactPhone });
    router.push("/payment");
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Passenger Details</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {passengers.map((p, i) => (
          <View key={i} style={styles.passengerCard}>
            <View style={styles.passengerHeader}>
              <View style={styles.passengerNum}>
                <Text style={styles.passengerNumText}>{i + 1}</Text>
              </View>
              <View>
                <Text style={styles.passengerTitle}>Passenger {i + 1}</Text>
                <Text style={styles.seatInfo}>Seat {p.seatNumber}</Text>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="John Smith"
                  placeholderTextColor={Colors.light.textMuted}
                  value={p.name}
                  onChangeText={(v) => updatePassenger(i, "name", v)}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="25"
                  placeholderTextColor={Colors.light.textMuted}
                  value={p.age?.toString() || ""}
                  onChangeText={(v) => updatePassenger(i, "age", v)}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.genderRow}>
                {(["male", "female", "other"] as const).map((g) => (
                  <Pressable
                    key={g}
                    style={[
                      styles.genderChip,
                      p.gender === g && styles.genderChipActive,
                    ]}
                    onPress={() => updatePassenger(i, "gender", g)}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        p.gender === g && styles.genderChipTextActive,
                      ]}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>ID Type</Text>
                <View style={styles.idTypeRow}>
                  {["passport", "license", "id card"].map((t) => (
                    <Pressable
                      key={t}
                      style={[
                        styles.idChip,
                        p.idType === t && styles.idChipActive,
                      ]}
                      onPress={() => updatePassenger(i, "idType", t)}
                    >
                      <Text style={[styles.idChipText, p.idType === t && styles.idChipTextActive]}>
                        {t === "id card" ? "ID" : t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ID Number</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter ID number"
                placeholderTextColor={Colors.light.textMuted}
                value={p.idNumber}
                onChangeText={(v) => updatePassenger(i, "idNumber", v)}
                autoCapitalize="characters"
              />
            </View>
          </View>
        ))}

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Contact Information</Text>
          <Text style={styles.contactSubtitle}>Booking confirmation will be sent here</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputWithIcon}>
              <Feather name="mail" size={15} color={Colors.light.textMuted} />
              <TextInput
                style={styles.iconInput}
                placeholder="you@example.com"
                placeholderTextColor={Colors.light.textMuted}
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <View style={styles.inputWithIcon}>
              <Feather name="phone" size={15} color={Colors.light.textMuted} />
              <TextInput
                style={styles.iconInput}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={Colors.light.textMuted}
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <View>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>${booking?.totalAmount || 0}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>Proceed to Payment</Text>
          <Feather name="arrow-right" size={18} color="white" />
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
  passengerCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  passengerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  passengerNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  passengerNumText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  passengerTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  seatInfo: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 10,
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
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
  },
  genderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  genderChipActive: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  genderChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  genderChipTextActive: {
    color: Colors.light.primary,
  },
  idTypeRow: {
    flexDirection: "row",
    gap: 6,
  },
  idChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  idChipActive: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  idChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  idChipTextActive: {
    color: Colors.light.primary,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  iconInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  contactCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginBottom: 16,
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
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  continueBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "white",
  },
});
