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
import { useBooking } from "@/context/BookingContext";
import { apiFetch } from "@/utils/api";

const MAX_PHOTOS = 6;
const MAX_BAGAGES = 4;

export default function PassengersScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { booking, updateBooking } = useBooking();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [passengers, setPassengers] = useState(booking?.passengers || []);
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [contactPhone, setContactPhone] = useState(user?.phone || "");

  const [baggageCount, setBaggageCount] = useState<number>(booking?.baggageCount || 0);
  const [baggagePhotos, setBaggagePhotos] = useState<{ uri: string; url?: string }[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updatePassenger = (index: number, field: string, value: string) => {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const pickPhoto = async () => {
    if (baggagePhotos.length >= MAX_PHOTOS) {
      Alert.alert("Maximum atteint", `Vous ne pouvez pas ajouter plus de ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission requise", "Autorisez l'accès à la galerie pour ajouter une photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const fileSize = asset.fileSize ?? 0;
      if (fileSize > 2 * 1024 * 1024) {
        Alert.alert("Image trop grande", "La photo dépasse 2 Mo. Veuillez en choisir une plus petite.");
        return;
      }

      const newIdx = baggagePhotos.length;
      setBaggagePhotos(prev => [...prev, { uri: asset.uri }]);

      if (asset.base64) {
        setUploadingIdx(newIdx);
        try {
          const resp = await apiFetch<{ url?: string }>("/bookings/upload-image", {
            token: token ?? undefined,
            method: "POST",
            body: JSON.stringify({ base64: asset.base64, mimeType: asset.mimeType || "image/jpeg" }),
          });
          if (resp?.url) {
            setBaggagePhotos(prev => prev.map((p, i) => i === newIdx ? { ...p, url: resp.url } : p));
          }
        } catch {
          /* keep local URI */
        } finally {
          setUploadingIdx(null);
        }
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'accéder à la galerie.");
    }
  };

  const removePhoto = (idx: number) => {
    setBaggagePhotos(prev => prev.filter((_, i) => i !== idx));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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
    if (baggageCount >= 2 && baggagePhotos.length === 0) {
      Alert.alert(
        "Photos obligatoires",
        `Avec ${baggageCount} bagages, vous devez ajouter au moins 1 photo pour validation.`
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const photoUrls = baggagePhotos.map(p => p.url).filter(Boolean) as string[];
    updateBooking({ passengers, contactEmail, contactPhone, bagages: [], bagagePrice: 0, baggageCount, baggagePhotos: photoUrls });

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
            bagages: [],
            baggageCount,
            baggagePhotos: photoUrls,
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

  const needsPhotos = baggageCount >= 2;
  const photosOk = !needsPhotos || baggagePhotos.length > 0;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
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
        {/* ── Règle des 45 minutes ── */}
        <View style={styles.rule45Card}>
          <View style={styles.rule45Icon}>
            <Feather name="clock" size={16} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rule45Title}>Règle de paiement</Text>
            <Text style={styles.rule45Text}>
              Votre réservation doit être validée (paiement effectué) au moins <Text style={{ fontFamily: "Inter_700Bold" }}>45 minutes avant le départ</Text>. Passé ce délai, elle sera automatiquement annulée et le siège libéré.
            </Text>
          </View>
        </View>

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

        {/* ── NOUVELLE SECTION BAGAGES ─────────────────────────────────── */}
        <View style={styles.bagSection}>
          <View style={styles.bagHeader}>
            <View style={styles.bagTitleRow}>
              <Feather name="package" size={16} color="#7C3AED" />
              <Text style={styles.bagTitle}>Bagages</Text>
              <View style={styles.bagOptional}>
                <Text style={styles.bagOptionalText}>Optionnel</Text>
              </View>
            </View>
            <Text style={styles.bagSubtitle}>Sélectionnez le nombre de bagages</Text>
          </View>

          {/* Sélecteur de nombre */}
          <View style={styles.countRow}>
            <Pressable
              style={[styles.countBtn, baggageCount === 0 && styles.countBtnActive]}
              onPress={() => { setBaggageCount(0); setBaggagePhotos([]); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.countBtnText, baggageCount === 0 && styles.countBtnTextActive]}>Aucun</Text>
            </Pressable>
            {[1, 2, 3, 4].map((n) => (
              <Pressable
                key={n}
                style={[styles.countBtn, baggageCount === n && styles.countBtnActive]}
                onPress={() => { setBaggageCount(n); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.countBtnText, baggageCount === n && styles.countBtnTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          {/* Bannière info dynamique */}
          {baggageCount === 1 && (
            <View style={[styles.infoBanner, styles.infoBannerGreen]}>
              <Feather name="check-circle" size={15} color="#059669" />
              <Text style={[styles.infoBannerText, { color: "#065F46" }]}>
                1 bagage — Validation automatique, pas de photo requise
              </Text>
            </View>
          )}
          {baggageCount >= 2 && (
            <View style={[styles.infoBanner, styles.infoBannerAmber]}>
              <Feather name="camera" size={15} color="#B45309" />
              <Text style={[styles.infoBannerText, { color: "#92400E" }]}>
                {baggageCount} bagages — Photos obligatoires (1 à {MAX_PHOTOS}). Un agent validera avant le départ.
              </Text>
            </View>
          )}

          {/* Zone photos (si ≥ 2 bagages) */}
          {baggageCount >= 2 && (
            <View style={styles.photosSection}>
              <View style={styles.photosSectionHeader}>
                <Text style={styles.photosTitle}>Photos des bagages</Text>
                <Text style={styles.photosCount}>{baggagePhotos.length}/{MAX_PHOTOS}</Text>
              </View>

              <View style={styles.photosGrid}>
                {baggagePhotos.map((photo, idx) => (
                  <View key={idx} style={styles.photoThumb}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImg} contentFit="cover" />
                    {uploadingIdx === idx && (
                      <View style={styles.photoOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    )}
                    {uploadingIdx !== idx && photo.url && (
                      <View style={[styles.photoOverlay, styles.photoSuccess]}>
                        <Feather name="check" size={14} color="#fff" />
                      </View>
                    )}
                    {uploadingIdx !== idx && (
                      <Pressable style={styles.photoRemoveBtn} onPress={() => removePhoto(idx)}>
                        <Feather name="x" size={12} color="#fff" />
                      </Pressable>
                    )}
                  </View>
                ))}

                {baggagePhotos.length < MAX_PHOTOS && (
                  <Pressable style={styles.photoAddBtn} onPress={pickPhoto}>
                    <Feather name="plus" size={22} color="#7C3AED" />
                    <Text style={styles.photoAddText}>Ajouter</Text>
                  </Pressable>
                )}
              </View>

              {baggagePhotos.length === 0 && (
                <View style={styles.photoEmptyHint}>
                  <Feather name="alert-circle" size={14} color="#DC2626" />
                  <Text style={styles.photoEmptyHintText}>Au moins 1 photo est obligatoire</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <View>
          <Text style={styles.totalLabel}>Total à payer</Text>
          <Text style={styles.totalAmount}>{(booking?.totalAmount ?? 0).toLocaleString()} FCFA</Text>
          {baggageCount >= 2 && !photosOk && (
            <Text style={styles.totalWarning}>⚠️ Photos requises</Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            (pressed || submitting || (needsPhotos && !photosOk)) && styles.continueBtnPressed,
            needsPhotos && !photosOk && styles.continueBtnDisabled,
          ]}
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
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  chipTextActive: { color: PRIMARY },
  inputIcon: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1.5, borderColor: Colors.light.border,
  },
  iconInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text },

  /* ── Bagages section ── */
  bagSection: {
    backgroundColor: "#FAFAFF", borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: "#EDE9FE",
    shadowColor: VIOLET, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  bagHeader: { marginBottom: 14 },
  bagTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  bagTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text },
  bagOptional: { backgroundColor: "#EDE9FE", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  bagOptionalText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: VIOLET },
  bagSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },

  /* Count selector */
  countRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  countBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#D8B4FE",
    backgroundColor: "#fff",
  },
  countBtnActive: { backgroundColor: VIOLET, borderColor: VIOLET },
  countBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#6B7280" },
  countBtnTextActive: { color: "#fff" },

  /* Info banner */
  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 10, padding: 10, marginBottom: 10,
  },
  infoBannerGreen: { backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" },
  infoBannerAmber: { backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A" },
  infoBannerText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },

  /* Photos */
  photosSection: { marginTop: 4 },
  photosSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  photosTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  photosCount: { fontSize: 12, fontFamily: "Inter_500Medium", color: VIOLET },

  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoThumb: { width: 88, height: 88, borderRadius: 12, overflow: "hidden", position: "relative" },
  photoImg: { width: "100%", height: "100%" },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center",
  },
  photoSuccess: { backgroundColor: "rgba(5,150,105,0.6)" },
  photoRemoveBtn: {
    position: "absolute", top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(220,38,38,0.85)",
    justifyContent: "center", alignItems: "center",
  },
  photoAddBtn: {
    width: 88, height: 88, borderRadius: 12,
    borderWidth: 2, borderColor: "#D8B4FE", borderStyle: "dashed",
    justifyContent: "center", alignItems: "center",
    backgroundColor: "#F5F3FF", gap: 4,
  },
  photoAddText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: VIOLET },

  photoEmptyHint: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingHorizontal: 4,
  },
  photoEmptyHintText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#DC2626" },

  /* 45-min rule banner */
  rule45Card: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#EFF6FF", borderRadius: 12,
    borderWidth: 1, borderColor: "#BFDBFE",
    padding: 12, marginBottom: 12,
  },
  rule45Icon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center",
  },
  rule45Title: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#1E40AF", marginBottom: 3 },
  rule45Text:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "#1D4ED8", lineHeight: 16 },

  /* Bottom */
  bottomBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.light.card,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  totalLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  totalAmount: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },
  totalWarning: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#DC2626", marginTop: 2 },

  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  continueBtnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  continueBtnDisabled: { backgroundColor: "#9CA3AF" },
  continueBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "white" },
});
