import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Image, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const TEAL = "#0E7490";
const TEAL_DARK = "#155E75";

const CITIES = [
  "Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pedro",
  "Daloa", "Man", "Gagnoa", "Divo", "Abengourou", "Soubré", "Bondoukou",
];
const PARCEL_TYPES = ["Documents", "Colis standard", "Fragile", "Alimentaire", "Électronique", "Vêtements", "Autre"];
const DELIVERY_TYPES = [
  { key: "livraison_gare",     label: "Retrait en gare" },
  { key: "livraison_domicile", label: "Livraison à domicile" },
];

interface Created { trackingRef: string; amount: number; status: string }

function CityPicker({ label, value, onSelect }: { label: string; value: string; onSelect: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text style={S.fieldLabel}>{label} *</Text>
      <TouchableOpacity style={S.select} onPress={() => setOpen(!open)}>
        <Text style={value ? S.selectVal : S.selectPlaceholder}>{value || `Choisir ${label.toLowerCase()}`}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
      </TouchableOpacity>
      {open && (
        <View style={S.dropdown}>
          {CITIES.map(c => (
            <TouchableOpacity key={c} style={[S.dropItem, c === value && S.dropItemActive]}
              onPress={() => { onSelect(c); setOpen(false); }}>
              <Text style={[S.dropItemText, c === value && S.dropItemTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function TypePicker({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  return (
    <View>
      <Text style={S.fieldLabel}>Type de colis *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {PARCEL_TYPES.map(pt => (
          <TouchableOpacity key={pt}
            style={[S.chip, value === pt && S.chipActive]}
            onPress={() => onSelect(pt)}>
            <Text style={[S.chipText, value === pt && S.chipTextActive]}>{pt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ColisDistanceScreen() {
  const { token } = useAuth();

  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [parcelType, setParcelType] = useState("");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryType, setDeliveryType] = useState("livraison_gare");
  const [declaredValue, setDeclaredValue] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState("");

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Veuillez autoriser l'accès à votre galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Veuillez autoriser l'accès à votre caméra.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : null);
    }
  };

  const handleSubmit = async () => {
    if (!senderName || !senderPhone || !receiverName || !receiverPhone) {
      setError("Remplissez les informations expéditeur et destinataire."); return;
    }
    if (!fromCity || !toCity) { setError("Choisissez les villes de départ et d'arrivée."); return; }
    if (fromCity === toCity) { setError("Les villes de départ et d'arrivée doivent être différentes."); return; }
    if (!parcelType) { setError("Choisissez le type de colis."); return; }
    if (!weight || parseFloat(weight) <= 0) { setError("Entrez un poids valide."); return; }

    setSubmitting(true);
    setError("");
    try {
      const body: any = {
        senderName: senderName.trim(), senderPhone: senderPhone.trim(),
        receiverName: receiverName.trim(), receiverPhone: receiverPhone.trim(),
        fromCity, toCity, parcelType, weight,
        description: description.trim() || undefined,
        deliveryType, paymentMethod: "orange",
        declaredValue: declaredValue || "0",
        photoUrl: photoBase64 || undefined,
      };
      const result = await apiFetch<Created>("/parcels/create-remote", { token: token ?? undefined, method: "POST", body });
      setCreated(result);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'envoi. Réessayez.");
    } finally { setSubmitting(false); }
  };

  if (created) {
    return (
      <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={TEAL_DARK} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 28, gap: 20 }}>
          <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center" }}>
            <Feather name="check-circle" size={44} color="#059669" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#0F172A", textAlign: "center" }}>Demande envoyée !</Text>
          <Text style={{ fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 22 }}>
            Votre demande de dépôt a été transmise à l'agence. Un agent validera votre colis et vous notifiera par SMS.
          </Text>
          <View style={{ backgroundColor: "#ECFEFF", borderRadius: 14, padding: 16, width: "100%", gap: 8, borderWidth: 1.5, borderColor: "#A5F3FC" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#64748B", fontSize: 13 }}>Référence</Text>
              <Text style={{ fontWeight: "800", color: TEAL, fontSize: 14 }}>{created.trackingRef}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#64748B", fontSize: 13 }}>Tarif estimé</Text>
              <Text style={{ fontWeight: "700", color: "#0F172A", fontSize: 13 }}>{Number(created.amount).toLocaleString()} FCFA</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#64748B", fontSize: 13 }}>Statut</Text>
              <View style={{ backgroundColor: "#FEF9C3", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#854D0E" }}>En validation</Text>
              </View>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
            Conservez votre référence pour suivre votre colis dans l'application.
          </Text>
          <TouchableOpacity style={[S.submitBtn, { width: "100%" }]} onPress={() => router.back()}>
            <Feather name="arrow-left" size={16} color="#fff" />
            <Text style={S.submitBtnText}>Retour à mes colis</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL_DARK} />
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>📷 Déposer à distance</Text>
          <Text style={S.headerSub}>L'agent validera votre colis rapidement</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>

          {error !== "" && (
            <View style={{ backgroundColor: "#FEE2E2", borderRadius: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={{ color: "#7F1D1D", fontSize: 13, fontWeight: "600", flex: 1 }}>{error}</Text>
              <TouchableOpacity onPress={() => setError("")}><Ionicons name="close" size={16} color="#6B7280" /></TouchableOpacity>
            </View>
          )}

          {/* Photo du colis */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>📷 Photo du colis (recommandée)</Text>
            <Text style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10 }}>
              Photographiez votre colis pour aider l'agent à estimer le tarif exact.
            </Text>
            {photoUri ? (
              <View style={{ gap: 8 }}>
                <Image source={{ uri: photoUri }} style={{ width: "100%", height: 200, borderRadius: 12 }} resizeMode="cover" />
                <TouchableOpacity style={S.photoChangeBtn} onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}>
                  <Feather name="x" size={14} color="#DC2626" />
                  <Text style={{ color: "#DC2626", fontSize: 13, fontWeight: "600" }}>Supprimer la photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={[S.photoBtn, { flex: 1 }]} onPress={takePhoto}>
                  <Ionicons name="camera" size={22} color={TEAL} />
                  <Text style={S.photoBtnText}>Prendre une photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.photoBtn, { flex: 1 }]} onPress={pickPhoto}>
                  <Ionicons name="image" size={22} color={TEAL} />
                  <Text style={S.photoBtnText}>Depuis la galerie</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Expéditeur */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Expéditeur</Text>
            <Text style={S.fieldLabel}>Nom complet *</Text>
            <TextInput value={senderName} onChangeText={setSenderName} placeholder="Votre nom" style={S.input} />
            <Text style={S.fieldLabel}>Téléphone *</Text>
            <TextInput value={senderPhone} onChangeText={setSenderPhone} placeholder="07 XX XX XX XX" keyboardType="phone-pad" style={S.input} />
          </View>

          {/* Destinataire */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>📬 Destinataire</Text>
            <Text style={S.fieldLabel}>Nom complet *</Text>
            <TextInput value={receiverName} onChangeText={setReceiverName} placeholder="Nom du destinataire" style={S.input} />
            <Text style={S.fieldLabel}>Téléphone *</Text>
            <TextInput value={receiverPhone} onChangeText={setReceiverPhone} placeholder="07 XX XX XX XX" keyboardType="phone-pad" style={S.input} />
          </View>

          {/* Trajet */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🗺 Trajet</Text>
            <CityPicker label="Ville de départ" value={fromCity} onSelect={setFromCity} />
            <CityPicker label="Ville d'arrivée" value={toCity} onSelect={setToCity} />
          </View>

          {/* Colis */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Informations du colis</Text>
            <TypePicker value={parcelType} onSelect={setParcelType} />
            <Text style={S.fieldLabel}>Poids estimé (kg) *</Text>
            <TextInput value={weight} onChangeText={setWeight} placeholder="Ex: 2.5" keyboardType="decimal-pad" style={S.input} />
            <Text style={S.fieldLabel}>Valeur déclarée (FCFA)</Text>
            <TextInput value={declaredValue} onChangeText={setDeclaredValue} placeholder="Valeur marchande du contenu (optionnel)" keyboardType="numeric" style={S.input} />
            <Text style={S.fieldLabel}>Description</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Contenu du colis, fragilité, instructions..." multiline style={[S.input, { minHeight: 70, textAlignVertical: "top" }]} />
          </View>

          {/* Mode de livraison */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🚚 Mode de livraison</Text>
            <View style={{ gap: 8 }}>
              {DELIVERY_TYPES.map(dt => (
                <TouchableOpacity
                  key={dt.key}
                  style={[S.deliveryOption, deliveryType === dt.key && { borderColor: TEAL, borderWidth: 2, backgroundColor: "#ECFEFF" }]}
                  onPress={() => setDeliveryType(dt.key)}>
                  <Text style={[S.deliveryLabel, { color: deliveryType === dt.key ? TEAL : "#374151" }]}>{dt.label}</Text>
                  {deliveryType === dt.key && <Ionicons name="checkmark-circle" size={20} color={TEAL} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[S.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="send" size={18} color="#fff" />
                  <Text style={S.submitBtnText}>Envoyer la demande</Text>
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#F8FAFC" },
  header:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: TEAL_DARK, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub:   { color: "rgba(255,255,255,0.75)", fontSize: 12 },

  section:      { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  fieldLabel:   { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4 },
  input:        { backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", padding: 12, fontSize: 14 },

  select:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", padding: 12 },
  selectVal:   { fontSize: 14, color: "#0F172A" },
  selectPlaceholder: { fontSize: 14, color: "#94A3B8" },
  dropdown:    { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden", marginTop: 4, zIndex: 10 },
  dropItem:    { padding: 12, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  dropItemActive: { backgroundColor: "#ECFEFF" },
  dropItemText: { fontSize: 14, color: "#374151" },
  dropItemTextActive: { color: TEAL, fontWeight: "700" },

  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  chipActive: { borderColor: TEAL, backgroundColor: "#ECFEFF" },
  chipText:  { fontSize: 13, color: "#475569", fontWeight: "600" },
  chipTextActive: { color: TEAL, fontWeight: "700" },

  photoBtn:      { flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#ECFEFF", borderRadius: 14, paddingVertical: 20, borderWidth: 1.5, borderColor: "#A5F3FC", borderStyle: "dashed" },
  photoBtnText:  { fontSize: 13, color: TEAL, fontWeight: "600", textAlign: "center" },
  photoChangeBtn:{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", padding: 8 },

  deliveryOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, backgroundColor: "#FAFAFA" },
  deliveryLabel:  { fontSize: 15, fontWeight: "600" },

  submitBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, shadowColor: TEAL, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
