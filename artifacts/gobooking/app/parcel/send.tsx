import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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

const CITIES = [
  "Abidjan", "Bouaké", "Yamoussoukro", "Korhogo",
  "San Pedro", "Daloa", "Man", "Gagnoa",
  "Divo", "Abengourou", "Soubré", "Bondoukou",
];

const PARCEL_TYPES = [
  { id: "documents", label: "Documents", icon: "file-text" },
  { id: "vetements", label: "Vêtements", icon: "shopping-bag" },
  { id: "electronique", label: "Électronique", icon: "cpu" },
  { id: "alimentaire", label: "Alimentaire", icon: "box" },
  { id: "cosmetique", label: "Cosmétique", icon: "star" },
  { id: "autre", label: "Autre", icon: "package" },
] as const;

const DELIVERY_TYPES = [
  {
    id: "depot_agence",
    label: "Dépôt en agence",
    desc: "Le colis est déposé dans notre agence de départ",
    icon: "home",
    extra: 0,
  },
  {
    id: "livraison_domicile",
    label: "Livraison à domicile",
    desc: "Nous récupérons le colis chez l'expéditeur",
    icon: "truck",
    extra: 1000,
  },
  {
    id: "retrait_agence",
    label: "Retrait en agence",
    desc: "Le destinataire récupère le colis à l'agence d'arrivée",
    icon: "map-pin",
    extra: 0,
  },
] as const;

const CITY_DISTANCES: Record<string, Record<string, number>> = {
  Abidjan: { Bouaké: 5, Yamoussoukro: 3, Korhogo: 9, "San Pedro": 4, Daloa: 5, Man: 7, Gagnoa: 4, Divo: 2, Abengourou: 3, Soubré: 5, Bondoukou: 7 },
  Bouaké: { Abidjan: 5, Korhogo: 4, Yamoussoukro: 2, Daloa: 3, Man: 5, Bondoukou: 4, Abengourou: 4 },
  Yamoussoukro: { Abidjan: 3, Bouaké: 2, Korhogo: 6, Daloa: 2, Gagnoa: 2 },
  Korhogo: { Abidjan: 9, Bouaké: 4, Yamoussoukro: 6, Man: 6 },
  "San Pedro": { Abidjan: 4, Daloa: 5, Gagnoa: 4, Soubré: 2 },
  Daloa: { Abidjan: 5, Bouaké: 3, Yamoussoukro: 2, Man: 3, Gagnoa: 2, Soubré: 3 },
  Man: { Abidjan: 7, Bouaké: 5, Daloa: 3, Korhogo: 6 },
  Gagnoa: { Abidjan: 4, Daloa: 2, Yamoussoukro: 2, "San Pedro": 4, Soubré: 2 },
  Divo: { Abidjan: 2, Gagnoa: 2, Daloa: 3 },
  Abengourou: { Abidjan: 3, Bouaké: 4, Bondoukou: 3 },
  Soubré: { "San Pedro": 2, Daloa: 3, Gagnoa: 2, Abidjan: 5 },
  Bondoukou: { Abidjan: 7, Bouaké: 4, Abengourou: 3 },
};

function estimatePrice(fromCity: string, toCity: string, weight: string, deliveryType: string): number {
  const d = CITY_DISTANCES[fromCity]?.[toCity] ?? CITY_DISTANCES[toCity]?.[fromCity] ?? 5;
  const w = parseFloat(weight) || 1;
  const base = 1500;
  const distExtra = d * 300;
  const weightExtra = Math.ceil(w) * 400;
  const deliveryExtra = deliveryType === "livraison_domicile" ? 1000 : 0;
  return base + distExtra + weightExtra + deliveryExtra;
}

const STEPS = [
  "Villes",
  "Expéditeur",
  "Destinataire",
  "Colis",
  "Livraison",
];

export default function ParcelSendScreen() {
  const insets = useSafeAreaInsets();
  const { updateParcel } = useParcel();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [step, setStep] = useState(0);
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [parcelType, setParcelType] = useState("");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryType, setDeliveryType] = useState("");

  const [showFromCities, setShowFromCities] = useState(false);
  const [showToCities, setShowToCities] = useState(false);

  const price = fromCity && toCity && weight && deliveryType
    ? estimatePrice(fromCity, toCity, weight, deliveryType)
    : null;

  const canNext = () => {
    if (step === 0) return fromCity.trim() && toCity.trim() && fromCity !== toCity;
    if (step === 1) return senderName.trim() && senderPhone.replace(/\D/g, "").length >= 8;
    if (step === 2) return receiverName.trim() && receiverPhone.replace(/\D/g, "").length >= 8;
    if (step === 3) return parcelType && weight && parseFloat(weight) > 0;
    if (step === 4) return deliveryType;
    return false;
  };

  const next = () => {
    if (!canNext()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      const amount = price ?? 0;
      updateParcel({ fromCity, toCity, senderName, senderPhone, receiverName, receiverPhone, parcelType, weight, description, deliveryType, amount });
      router.push("/parcel/payment");
    }
  };

  const back = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 0) setStep(step - 1);
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const formatPhone = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 10);
    if (digits.length > 4) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`.trim();
    return digits;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { paddingTop: topPad }]}>
        {/* Header */}
        <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={styles.header}>
          <Pressable style={styles.backBtn} onPress={back}>
            <Feather name="arrow-left" size={20} color="white" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Envoyer un colis</Text>
            <Text style={styles.headerSub}>Étape {step + 1} sur {STEPS.length} — {STEPS[step]}</Text>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{step + 1}/{STEPS.length}</Text>
          </View>
        </LinearGradient>

        {/* Step indicator */}
        <View style={styles.stepper}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]} />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── STEP 0: Villes ── */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Villes de départ et d'arrivée</Text>
              <Text style={styles.stepDesc}>Sélectionnez les villes d'expédition et de destination</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>🏙️ Ville de départ</Text>
                <Pressable
                  style={styles.cityPicker}
                  onPress={() => { setShowFromCities(!showFromCities); setShowToCities(false); }}
                >
                  <Text style={[styles.cityPickerText, !fromCity && styles.cityPickerPlaceholder]}>
                    {fromCity || "Choisir la ville de départ"}
                  </Text>
                  <Feather name="chevron-down" size={16} color={Colors.light.textSecondary} />
                </Pressable>
                {showFromCities && (
                  <View style={styles.cityDropdown}>
                    {CITIES.filter((c) => c !== toCity).map((city) => (
                      <Pressable
                        key={city}
                        style={[styles.cityOption, fromCity === city && styles.cityOptionActive]}
                        onPress={() => { setFromCity(city); setShowFromCities(false); }}
                      >
                        <Text style={[styles.cityOptionText, fromCity === city && styles.cityOptionTextActive]}>{city}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>📍 Ville de destination</Text>
                <Pressable
                  style={styles.cityPicker}
                  onPress={() => { setShowToCities(!showToCities); setShowFromCities(false); }}
                >
                  <Text style={[styles.cityPickerText, !toCity && styles.cityPickerPlaceholder]}>
                    {toCity || "Choisir la ville de destination"}
                  </Text>
                  <Feather name="chevron-down" size={16} color={Colors.light.textSecondary} />
                </Pressable>
                {showToCities && (
                  <View style={styles.cityDropdown}>
                    {CITIES.filter((c) => c !== fromCity).map((city) => (
                      <Pressable
                        key={city}
                        style={[styles.cityOption, toCity === city && styles.cityOptionActive]}
                        onPress={() => { setToCity(city); setShowToCities(false); }}
                      >
                        <Text style={[styles.cityOptionText, toCity === city && styles.cityOptionTextActive]}>{city}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {fromCity && toCity && fromCity !== toCity && (
                <View style={styles.routePreview}>
                  <Text style={styles.routePreviewText}>{fromCity}</Text>
                  <Feather name="arrow-right" size={16} color={Colors.light.primary} />
                  <Text style={styles.routePreviewText}>{toCity}</Text>
                </View>
              )}
              {fromCity && toCity && fromCity === toCity && (
                <Text style={styles.errorText}>Les villes de départ et d'arrivée doivent être différentes</Text>
              )}
            </View>
          )}

          {/* ── STEP 1: Expéditeur ── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Informations de l'expéditeur</Text>
              <Text style={styles.stepDesc}>Qui envoie le colis ?</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nom complet</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Kouakou Jean-Pierre"
                  placeholderTextColor={Colors.light.textMuted}
                  value={senderName}
                  onChangeText={setSenderName}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🇨🇮 +225</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="07 00 00 00 00"
                    placeholderTextColor={Colors.light.textMuted}
                    value={senderPhone}
                    onChangeText={(t) => setSenderPhone(formatPhone(t))}
                    keyboardType="phone-pad"
                    maxLength={14}
                  />
                </View>
              </View>
            </View>
          )}

          {/* ── STEP 2: Destinataire ── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Informations du destinataire</Text>
              <Text style={styles.stepDesc}>Qui reçoit le colis ?</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nom complet</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Traoré Fatima"
                  placeholderTextColor={Colors.light.textMuted}
                  value={receiverName}
                  onChangeText={setReceiverName}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🇨🇮 +225</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="07 00 00 00 00"
                    placeholderTextColor={Colors.light.textMuted}
                    value={receiverPhone}
                    onChangeText={(t) => setReceiverPhone(formatPhone(t))}
                    keyboardType="phone-pad"
                    maxLength={14}
                  />
                </View>
              </View>
            </View>
          )}

          {/* ── STEP 3: Colis ── */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Détails du colis</Text>
              <Text style={styles.stepDesc}>Type, poids et description du colis</Text>

              <Text style={styles.fieldLabel}>Type de colis</Text>
              <View style={styles.typeGrid}>
                {PARCEL_TYPES.map((type) => (
                  <Pressable
                    key={type.id}
                    style={[styles.typeCard, parcelType === type.id && styles.typeCardActive]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setParcelType(type.id); }}
                  >
                    <Feather
                      name={type.icon as never}
                      size={20}
                      color={parcelType === type.id ? "white" : Colors.light.primary}
                    />
                    <Text style={[styles.typeLabel, parcelType === type.id && styles.typeLabelActive]}>
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Poids (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 2.5"
                  placeholderTextColor={Colors.light.textMuted}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Description (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Contenu du colis, fragile, etc."
                  placeholderTextColor={Colors.light.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          )}

          {/* ── STEP 4: Livraison ── */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Type de livraison</Text>
              <Text style={styles.stepDesc}>Comment souhaitez-vous envoyer ce colis ?</Text>

              {DELIVERY_TYPES.map((type) => (
                <Pressable
                  key={type.id}
                  style={[styles.deliveryCard, deliveryType === type.id && styles.deliveryCardActive]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDeliveryType(type.id); }}
                >
                  <View style={[styles.deliveryIcon, deliveryType === type.id && styles.deliveryIconActive]}>
                    <Feather name={type.icon as never} size={22} color={deliveryType === type.id ? "white" : Colors.light.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deliveryLabel, deliveryType === type.id && styles.deliveryLabelActive]}>
                      {type.label}
                    </Text>
                    <Text style={styles.deliveryDesc}>{type.desc}</Text>
                    {type.extra > 0 && (
                      <Text style={styles.deliveryExtra}>+{type.extra.toLocaleString()} FCFA</Text>
                    )}
                  </View>
                  {deliveryType === type.id && (
                    <View style={styles.deliveryCheck}>
                      <Feather name="check" size={14} color="white" />
                    </View>
                  )}
                </Pressable>
              ))}

              {price !== null && (
                <View style={styles.priceCard}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Estimation du tarif</Text>
                    <Text style={styles.priceValue}>{price.toLocaleString()} FCFA</Text>
                  </View>
                  <Text style={styles.priceSub}>
                    {fromCity} → {toCity} · {weight} kg · {DELIVERY_TYPES.find((d) => d.id === deliveryType)?.label}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 8 }]}>
          {step === STEPS.length - 1 && price !== null && (
            <View style={styles.pricePreview}>
              <Text style={styles.pricePreviewLabel}>Montant estimé</Text>
              <Text style={styles.pricePreviewValue}>{price.toLocaleString()} FCFA</Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.nextBtn,
              !canNext() && styles.nextBtnDisabled,
              pressed && canNext() && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={next}
            disabled={!canNext()}
          >
            <Text style={styles.nextBtnText}>
              {step < STEPS.length - 1 ? "Suivant" : "Procéder au paiement"}
            </Text>
            <Feather name={step < STEPS.length - 1 ? "arrow-right" : "check-circle"} size={18} color="white" />
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
  stepBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "white",
  },

  stepper: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
  },
  stepDotActive: {
    backgroundColor: Colors.light.primary,
    opacity: 0.5,
  },
  stepDotDone: {
    backgroundColor: Colors.light.primary,
    opacity: 1,
  },

  scroll: { padding: 16 },

  stepContent: { gap: 16 },
  stepTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  stepDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: -8,
    marginBottom: 4,
  },

  field: { gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  input: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  phoneRow: { flexDirection: "row", gap: 8 },
  countryCode: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    justifyContent: "center",
  },
  countryCodeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },

  cityPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  cityPickerText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#0F172A",
  },
  cityPickerPlaceholder: { color: Colors.light.textMuted },
  cityDropdown: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: -4,
  },
  cityOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  cityOptionActive: { backgroundColor: "#EEF2FF" },
  cityOptionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
  },
  cityOptionTextActive: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  routePreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 14,
  },
  routePreviewText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#EF4444",
    textAlign: "center",
  },

  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  typeCard: {
    width: "30%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  typeCardActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  typeLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
    textAlign: "center",
  },
  typeLabelActive: { color: "white" },

  deliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    position: "relative",
  },
  deliveryCardActive: {
    borderColor: Colors.light.primary,
    backgroundColor: "#EEF2FF",
  },
  deliveryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  deliveryIconActive: { backgroundColor: Colors.light.primary },
  deliveryLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  deliveryLabelActive: { color: Colors.light.primary },
  deliveryDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  deliveryExtra: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#D97706",
    marginTop: 3,
  },
  deliveryCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  priceCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.primary,
  },
  priceValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  priceSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6366F1",
    marginTop: 4,
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  pricePreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pricePreviewLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  pricePreviewValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  nextBtn: {
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
  nextBtnDisabled: { backgroundColor: "#CBD5E1", shadowOpacity: 0 },
  nextBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
});
