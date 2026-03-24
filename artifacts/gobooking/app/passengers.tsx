import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useBooking, type BagageInfo, type BagageType } from "@/context/BookingContext";
import { apiFetch } from "@/utils/api";

const PRIX_PAR_KG = 500; // FCFA par kg
const MAX_BAGAGES = 5;

const BAGAGE_TYPES: { value: BagageType; label: string; icon: string }[] = [
  { value: "valise", label: "Valise",  icon: "briefcase" },
  { value: "sac",    label: "Sac",     icon: "shopping-bag" },
  { value: "colis",  label: "Colis",   icon: "package" },
  { value: "autre",  label: "Autre",   icon: "box" },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function PassengersScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { booking, updateBooking } = useBooking();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [passengers, setPassengers] = useState(booking?.passengers || []);
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [contactPhone, setContactPhone] = useState(user?.phone || "");
  const [bagages, setBagages] = useState<BagageInfo[]>(booking?.bagages || []);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ── helpers ─────────────────────────────────────────────────────── */
  const updatePassenger = (index: number, field: string, value: string) => {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const bagagePrice = bagages.reduce((s, b) => s + b.prix, 0);
  const ticketPrice = (booking?.totalAmount ?? 0) - (booking?.bagagePrice ?? 0);
  const totalPrice  = ticketPrice + bagagePrice;

  /* ── bagage actions ──────────────────────────────────────────────── */
  const addBagage = () => {
    if (bagages.length >= MAX_BAGAGES) {
      Alert.alert("Maximum atteint", `Vous ne pouvez pas ajouter plus de ${MAX_BAGAGES} bagages.`);
      return;
    }
    const newBag: BagageInfo = { id: generateId(), type: "valise", poids: 1, prix: PRIX_PAR_KG };
    setBagages(prev => [...prev, newBag]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeBagage = (id: string) => {
    setBagages(prev => prev.filter(b => b.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updateBagage = (id: string, field: keyof BagageInfo, value: any) => {
    setBagages(prev => prev.map(b => {
      if (b.id !== id) return b;
      const updated = { ...b, [field]: value };
      if (field === "poids") {
        updated.prix = Math.max(1, Number(value) || 0) * PRIX_PAR_KG;
      }
      return updated;
    }));
  };

  const pickImage = async (bagageId: string) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission requise", "Autorisez l'accès à la galerie pour ajouter une photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setBagages(prev => prev.map(b => b.id === bagageId ? { ...b, imageUri: asset.uri } : b));

      if (asset.base64) {
        setUploadingId(bagageId);
        try {
          const resp = await apiFetch<{ url?: string }>("/bookings/upload-image", {
            token: token ?? undefined,
            method: "POST",
            body: JSON.stringify({ base64: asset.base64, mimeType: asset.mimeType || "image/jpeg" }),
          });
          if (resp?.url) {
            setBagages(prev => prev.map(b => b.id === bagageId ? { ...b, imageUrl: resp.url } : b));
          }
        } catch {
          /* keep local URI only */
        } finally {
          setUploadingId(null);
        }
      }
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'accéder à la galerie.");
    }
  };

  /* ── continue ────────────────────────────────────────────────────── */
  const handleContinue = async () => {
    for (const p of passengers) {
      if (!p.name.trim() || !p.age || !p.idNumber.trim()) {
        Alert.alert("Erreur", "Veuillez renseigner tous les champs passager.");
        return;
      }
    }
    if (!contactEmail.trim() || !contactPhone.trim()) {
      Alert.alert("Erreur", "Veuillez renseigner vos coordonnées de contact.");
      return;
    }
    if (!booking?.tripId || !booking?.selectedSeats?.length) {
      Alert.alert("Erreur", "Informations de trajet manquantes. Recommencez la sélection.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateBooking({ passengers, contactEmail, contactPhone, bagages, bagagePrice, totalAmount: totalPrice });

    setSubmitting(true);
    try {
      const result = await apiFetch<{ id: string; bookingRef: string; totalAmount: number }>(
        "/bookings",
        {
          token: token ?? undefined,
          method: "POST",
          body: {
            tripId:       booking.tripId,
            seatIds:      booking.selectedSeats,
            passengers,
            paymentMethod: "wave",
            contactEmail,
            contactPhone,
            bagages,
            fromStopId:   booking.fromStopId ?? null,
            toStopId:     booking.toStopId   ?? null,
          },
        }
      );
      router.push({
        pathname: "/payment/cinetpay",
        params: {
          bookingId:  result.id,
          amount:     String(result.totalAmount),
          bookingRef: result.bookingRef,
        },
      });
    } catch (err: any) {
      Alert.alert("Erreur de réservation", err?.message ?? "Impossible de créer la réservation. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Détails du voyage</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Passengers ─────────────────────────────────────────────── */}
        {passengers.map((p, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.numBadge}>
                <Text style={styles.numBadgeText}>{i + 1}</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>Passager {i + 1}</Text>
                <Text style={styles.cardSub}>Siège {p.seatNumber}</Text>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>Nom complet</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Ex : Konan Yao"
                  placeholderTextColor={Colors.light.textMuted}
                  value={p.name}
                  onChangeText={(v) => updatePassenger(i, "name", v)}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Âge</Text>
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
              <Text style={styles.fieldLabel}>Genre</Text>
              <View style={styles.chipRow}>
                {(["male", "female", "other"] as const).map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.chip, p.gender === g && styles.chipActive]}
                    onPress={() => updatePassenger(i, "gender", g)}
                  >
                    <Text style={[styles.chipText, p.gender === g && styles.chipTextActive]}>
                      {g === "male" ? "Homme" : g === "female" ? "Femme" : "Autre"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Type pièce</Text>
                <View style={styles.chipRow}>
                  {["passport", "license", "id card"].map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.chip, p.idType === t && styles.chipActive]}
                      onPress={() => updatePassenger(i, "idType", t)}
                    >
                      <Text style={[styles.chipText, p.idType === t && styles.chipTextActive]}>
                        {t === "id card" ? "CNI" : t === "passport" ? "Passeport" : "Permis"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Numéro pièce</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ex : CI12345678"
                placeholderTextColor={Colors.light.textMuted}
                value={p.idNumber}
                onChangeText={(v) => updatePassenger(i, "idNumber", v)}
                autoCapitalize="characters"
              />
            </View>
          </View>
        ))}

        {/* ── Contact ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coordonnées</Text>
          <Text style={styles.cardSub2}>La confirmation sera envoyée ici</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputIcon}>
              <Feather name="mail" size={15} color={Colors.light.textMuted} />
              <TextInput
                style={styles.iconInput}
                placeholder="vous@exemple.com"
                placeholderTextColor={Colors.light.textMuted}
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <View style={styles.inputIcon}>
              <Feather name="phone" size={15} color={Colors.light.textMuted} />
              <TextInput
                style={styles.iconInput}
                placeholder="+225 07 00 00 00 00"
                placeholderTextColor={Colors.light.textMuted}
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* ── Bagages ─────────────────────────────────────────────────── */}
        <View style={styles.bagSection}>
          <View style={styles.bagHeader}>
            <View style={styles.bagTitleRow}>
              <Feather name="package" size={16} color="#7C3AED" />
              <Text style={styles.bagTitle}>Bagages</Text>
              <View style={styles.bagOptional}>
                <Text style={styles.bagOptionalText}>Optionnel</Text>
              </View>
            </View>
            <Text style={styles.bagRate}>{PRIX_PAR_KG} FCFA/kg</Text>
          </View>

          {bagages.length === 0 && (
            <View style={styles.bagEmpty}>
              <Feather name="briefcase" size={28} color="#C4B5FD" />
              <Text style={styles.bagEmptyText}>Aucun bagage ajouté</Text>
              <Text style={styles.bagEmptySub}>Bagages soumis à validation avant départ</Text>
            </View>
          )}

          {bagages.map((b, idx) => (
            <View key={b.id} style={styles.bagCard}>
              {/* Bag header */}
              <View style={styles.bagCardHeader}>
                <Text style={styles.bagCardTitle}>Bagage {idx + 1}</Text>
                <Pressable style={styles.bagRemove} onPress={() => removeBagage(b.id)}>
                  <Feather name="trash-2" size={15} color="#DC2626" />
                </Pressable>
              </View>

              {/* Type selector */}
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={[styles.chipRow, { marginBottom: 12 }]}>
                {BAGAGE_TYPES.map(t => (
                  <Pressable
                    key={t.value}
                    style={[styles.chip, b.type === t.value && styles.chipBagActive]}
                    onPress={() => updateBagage(b.id, "type", t.value)}
                  >
                    <Feather name={t.icon as any} size={12} color={b.type === t.value ? "#7C3AED" : "#6B7280"} />
                    <Text style={[styles.chipText, b.type === t.value && styles.chipTextBagActive]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Weight + price */}
              <View style={styles.fieldRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Poids (kg)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Ex : 5"
                    placeholderTextColor={Colors.light.textMuted}
                    value={b.poids > 0 ? String(b.poids) : ""}
                    onChangeText={(v) => updateBagage(b.id, "poids", Number(v) || 0)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Prix estimé</Text>
                  <View style={styles.prixBox}>
                    <Text style={styles.prixValue}>{b.prix.toLocaleString()} FCFA</Text>
                  </View>
                </View>
              </View>

              {/* Photo */}
              <Text style={styles.fieldLabel}>Photo du bagage</Text>
              <Pressable style={styles.photoBtn} onPress={() => pickImage(b.id)}>
                {b.imageUri ? (
                  <View style={styles.photoPreview}>
                    <Image source={{ uri: b.imageUri }} style={styles.photoImg} contentFit="cover" />
                    {uploadingId === b.id && (
                      <View style={styles.photoOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.photoOverlayTxt}>Upload…</Text>
                      </View>
                    )}
                    {uploadingId !== b.id && b.imageUrl && (
                      <View style={[styles.photoOverlay, styles.photoSuccess]}>
                        <Feather name="check-circle" size={16} color="#fff" />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Feather name="camera" size={20} color="#7C3AED" />
                    <Text style={styles.photoPlaceholderTxt}>Ajouter une photo</Text>
                  </View>
                )}
              </Pressable>
            </View>
          ))}

          {bagages.length < MAX_BAGAGES && (
            <Pressable style={styles.addBagBtn} onPress={addBagage}>
              <Feather name="plus-circle" size={18} color="#7C3AED" />
              <Text style={styles.addBagTxt}>Ajouter un bagage</Text>
            </Pressable>
          )}

          {bagagePrice > 0 && (
            <View style={styles.bagPriceRow}>
              <Feather name="tag" size={14} color="#7C3AED" />
              <Text style={styles.bagPriceLabel}>Bagages inclus :</Text>
              <Text style={styles.bagPriceValue}>+{bagagePrice.toLocaleString()} FCFA</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <View>
          <Text style={styles.totalLabel}>Total à payer</Text>
          <Text style={styles.totalAmount}>{totalPrice.toLocaleString()} FCFA</Text>
          {bagagePrice > 0 && (
            <Text style={styles.totalSub}>dont {bagagePrice.toLocaleString()} FCFA bagages</Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.continueBtn, (pressed || submitting) && styles.continueBtnPressed]}
          onPress={handleContinue}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.continueBtnText}>Paiement</Text>
              <Feather name="arrow-right" size={18} color="white" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const PRIMARY = Colors.light.primary;
const VIOLET  = "#7C3AED";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.light.background,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },

  card: {
    backgroundColor: Colors.light.card, borderRadius: 16, padding: 16,
    marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  numBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center",
  },
  numBadgeText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  cardSub2: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginBottom: 16 },

  fieldRow: { flexDirection: "row", gap: 10 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.text, marginBottom: 6 },
  fieldInput: {
    backgroundColor: Colors.light.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text,
    borderWidth: 1.5, borderColor: Colors.light.border,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.light.border, backgroundColor: Colors.light.background,
  },
  chipActive: { backgroundColor: Colors.light.primaryLight, borderColor: PRIMARY },
  chipBagActive: { backgroundColor: "#EDE9FE", borderColor: VIOLET },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  chipTextActive: { color: PRIMARY },
  chipTextBagActive: { color: VIOLET },
  inputIcon: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1.5, borderColor: Colors.light.border,
  },
  iconInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text },

  /* Bagage section */
  bagSection: {
    backgroundColor: "#FAFAFF", borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: "#EDE9FE",
    shadowColor: VIOLET, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  bagHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  bagTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bagTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text },
  bagOptional: { backgroundColor: "#EDE9FE", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  bagOptionalText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: VIOLET },
  bagRate: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: VIOLET },

  bagEmpty: { alignItems: "center", paddingVertical: 20, gap: 6 },
  bagEmptyText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  bagEmptySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center" },

  bagCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#E9D5FF",
    shadowColor: VIOLET, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  bagCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  bagCardTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.light.text },
  bagRemove: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center",
  },

  prixBox: {
    backgroundColor: "#F5F3FF", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1.5, borderColor: "#DDD6FE",
    justifyContent: "center",
  },
  prixValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: VIOLET },

  photoBtn: { marginBottom: 4, borderRadius: 10, overflow: "hidden" },
  photoPlaceholder: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EDE9FE", borderRadius: 10, padding: 12,
    borderWidth: 1.5, borderColor: "#C4B5FD", borderStyle: "dashed",
  },
  photoPlaceholderTxt: { fontSize: 13, fontFamily: "Inter_500Medium", color: VIOLET },
  photoPreview: { width: "100%", height: 120, borderRadius: 10, overflow: "hidden" },
  photoImg: { width: "100%", height: "100%" },
  photoOverlay: {
    position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", gap: 4,
  },
  photoSuccess: { backgroundColor: "rgba(16,185,129,0.5)" },
  photoOverlayTxt: { fontSize: 12, color: "#fff", fontFamily: "Inter_600SemiBold" },

  addBagBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#EDE9FE", borderRadius: 12, paddingVertical: 12,
    borderWidth: 1.5, borderColor: "#C4B5FD", borderStyle: "dashed", marginTop: 4,
  },
  addBagTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: VIOLET },

  bagPriceRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EDE9FE", borderRadius: 10, padding: 10, marginTop: 10,
  },
  bagPriceLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#4C1D95" },
  bagPriceValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: VIOLET },

  /* Bottom bar */
  bottomBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: Colors.light.card, paddingHorizontal: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 8,
  },
  totalLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  totalAmount: { fontSize: 22, fontFamily: "Inter_700Bold", color: PRIMARY },
  totalSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: VIOLET, marginTop: 1 },
  continueBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  continueBtnPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  continueBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
});
