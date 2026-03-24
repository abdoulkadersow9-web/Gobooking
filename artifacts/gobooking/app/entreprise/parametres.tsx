import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const AMBER       = "#D97706";
const AMBER_DARK  = "#B45309";
const AMBER_LIGHT = "#FFFBEB";
const AMBER_BG    = "#FEF3C7";

interface Agence {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  status: string;
}

interface CompanyProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  licenseNumber: string | null;
  status: string;
  walletBalance: number;
  agences: Agence[];
}

function Field({
  label, icon, value, editable = true,
  onChangeText, placeholder, keyboardType, multiline,
}: {
  label: string;
  icon: string;
  value: string;
  editable?: boolean;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  multiline?: boolean;
}) {
  return (
    <View style={S.fieldWrap}>
      <Text style={S.fieldLabel}>{label}</Text>
      <View style={[S.inputWrap, !editable && S.inputReadonly, multiline && S.inputMulti]}>
        <Feather name={icon as any} size={15} color={editable ? AMBER : "#94A3B8"} style={{ marginRight: 8, marginTop: multiline ? 2 : 0 }} />
        <TextInput
          style={[S.input, multiline && S.inputTextMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor="#CBD5E1"
          editable={editable}
          keyboardType={keyboardType ?? "default"}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      </View>
    </View>
  );
}

function AgenceCard({ agence }: { agence: Agence }) {
  const isActive = agence.status === "active";
  return (
    <View style={S.agenceCard}>
      <View style={S.agenceRow}>
        <View style={[S.agenceIconWrap, { backgroundColor: isActive ? "#DCFCE7" : "#FEE2E2" }]}>
          <Feather name="home" size={16} color={isActive ? "#166534" : "#991B1B"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.agenceName}>{agence.name}</Text>
          <Text style={S.agenceCity}>{agence.city}</Text>
        </View>
        <View style={[S.agenceBadge, { backgroundColor: isActive ? "#DCFCE7" : "#FEE2E2" }]}>
          <Text style={[S.agenceBadgeText, { color: isActive ? "#166534" : "#991B1B" }]}>
            {isActive ? "Actif" : "Inactif"}
          </Text>
        </View>
      </View>
      {(agence.address || agence.phone) && (
        <View style={S.agenceDetails}>
          {agence.address ? (
            <View style={S.agenceDetailRow}>
              <Feather name="map-pin" size={12} color="#94A3B8" />
              <Text style={S.agenceDetailText}>{agence.address}</Text>
            </View>
          ) : null}
          {agence.phone ? (
            <View style={S.agenceDetailRow}>
              <Feather name="phone" size={12} color="#94A3B8" />
              <Text style={S.agenceDetailText}>{agence.phone}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function ParametresScreen() {
  const { token, logout } = useAuth();
  const insets    = useSafeAreaInsets();

  const [profile, setProfile]     = useState<CompanyProfile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving]       = useState(false);

  const [editName,    setEditName]    = useState("");
  const [editPhone,   setEditPhone]   = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity,    setEditCity]    = useState("");
  const [editLicense, setEditLicense] = useState("");
  const [dirty, setDirty]            = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data: CompanyProfile = await apiFetch("/company/profile", { token: token ?? undefined });
      setProfile(data);
      setEditName(data.name ?? "");
      setEditPhone(data.phone ?? "");
      setEditAddress(data.address ?? "");
      setEditCity(data.city ?? "");
      setEditLicense(data.licenseNumber ?? "");
      setDirty(false);
    } catch (err) {
      console.error("[parametres] load error:", err);
      Alert.alert("Erreur", "Impossible de charger le profil.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setDirty(true);
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const updated: CompanyProfile = await apiFetch("/company/profile", {
        method: "PATCH",
        token: token ?? undefined,
        body: {
          name:          editName.trim()    || undefined,
          phone:         editPhone.trim()   || undefined,
          address:       editAddress.trim() || undefined,
          city:          editCity.trim()    || undefined,
          licenseNumber: editLicense.trim() || undefined,
        },
      });
      setProfile(prev => prev ? { ...prev, ...updated } : updated);
      setDirty(false);
      Alert.alert("Succès", "Profil mis à jour avec succès.");
    } catch (err) {
      console.error("[parametres] save error:", err);
      Alert.alert("Erreur", "Impossible de mettre à jour le profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#D97706", "#B45309"]} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View style={S.headerRow}>
          <Pressable onPress={() => router.back()} style={S.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Paramètres</Text>
            <Text style={S.headerSub}>Profil de votre compagnie</Text>
          </View>
          {dirty && (
            <Pressable
              style={[S.saveBtn, saving && { opacity: 0.7 }]}
              onPress={save}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={AMBER} />
                : <><Feather name="check" size={16} color={AMBER} /><Text style={S.saveBtnText}>Sauver</Text></>
              }
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={AMBER} />
          <Text style={S.loadTxt}>Chargement du profil…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: "#F8FAFC" }}
          contentContainerStyle={S.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AMBER} />}
          keyboardShouldPersistTaps="handled"
        >
          {profile && (
            <View style={S.balanceCard}>
              <View style={S.balanceLeft}>
                <Text style={S.balanceLabel}>Solde Wallet</Text>
                <Text style={S.balanceValue}>{(profile.walletBalance ?? 0).toLocaleString("fr-CI")} FCFA</Text>
              </View>
              <View style={[S.statusBadge, { backgroundColor: profile.status === "active" ? "#DCFCE7" : "#FEE2E2" }]}>
                <Feather name="shield" size={12} color={profile.status === "active" ? "#166534" : "#991B1B"} />
                <Text style={[S.statusText, { color: profile.status === "active" ? "#166534" : "#991B1B" }]}>
                  {profile.status === "active" ? "Actif" : "Suspendu"}
                </Text>
              </View>
            </View>
          )}

          <View style={S.section}>
            <Text style={S.sectionTitle}>Informations générales</Text>

            <Field
              label="Nom de la compagnie"
              icon="briefcase"
              value={editName}
              onChangeText={handleChange(setEditName)}
              placeholder="Ex: GoTransport CI"
            />
            <Field
              label="Email"
              icon="mail"
              value={profile?.email ?? ""}
              editable={false}
              placeholder="email@compagnie.ci"
              keyboardType="email-address"
            />
            <Field
              label="Téléphone"
              icon="phone"
              value={editPhone}
              onChangeText={handleChange(setEditPhone)}
              placeholder="+225 07 XX XX XX XX"
              keyboardType="phone-pad"
            />
            <Field
              label="Ville principale"
              icon="map-pin"
              value={editCity}
              onChangeText={handleChange(setEditCity)}
              placeholder="Ex: Abidjan"
            />
            <Field
              label="Adresse"
              icon="home"
              value={editAddress}
              onChangeText={handleChange(setEditAddress)}
              placeholder="Ex: Rue des Jardins, Cocody"
              multiline
            />
            <Field
              label="Numéro de licence"
              icon="award"
              value={editLicense}
              onChangeText={handleChange(setEditLicense)}
              placeholder="Ex: LIC-CI-2024-XXXX"
            />
          </View>

          {dirty && (
            <Pressable
              style={[S.bottomSaveBtn, saving && { opacity: 0.7 }]}
              onPress={save}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Feather name="save" size={16} color="#fff" /><Text style={S.bottomSaveTxt}>Enregistrer les modifications</Text></>
              }
            </Pressable>
          )}

          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Agences ({profile?.agences?.length ?? 0})</Text>
              <Pressable
                style={S.addBtn}
                onPress={() => router.push("/entreprise/agences" as any)}
              >
                <Feather name="plus" size={14} color={AMBER} />
                <Text style={S.addBtnText}>Gérer</Text>
              </Pressable>
            </View>

            {!profile?.agences?.length ? (
              <View style={S.emptyAgences}>
                <Feather name="home" size={28} color="#CBD5E1" />
                <Text style={S.emptyAgencesTxt}>Aucune agence enregistrée</Text>
              </View>
            ) : (
              profile.agences.map(a => <AgenceCard key={a.id} agence={a} />)
            )}
          </View>

          {/* ── Déconnexion ──────────────────────────────────────── */}
          <View style={S.logoutSection}>
            <Text style={S.logoutSectionTitle}>Compte</Text>
            <Pressable
              style={({ pressed }) => [S.logoutBtn, pressed && { opacity: 0.8 }]}
              onPress={() =>
                Alert.alert(
                  "Déconnexion",
                  "Voulez-vous vraiment vous déconnecter de votre compte ?",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Se déconnecter",
                      style: "destructive",
                      onPress: () => logout(),
                    },
                  ],
                )
              }
            >
              <Feather name="log-out" size={18} color="#DC2626" />
              <Text style={S.logoutBtnTxt}>Se déconnecter</Text>
            </Pressable>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 },

  saveBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#fff" },
  saveBtnText: { fontSize: 13, fontWeight: "700", color: AMBER },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadTxt: { fontSize: 14, color: "#94A3B8", marginTop: 10 },

  content: { padding: 16, gap: 16 },

  balanceCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#D97706", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: AMBER_BG,
  },
  balanceLeft: {},
  balanceLabel: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  balanceValue: { fontSize: 22, fontWeight: "800", color: AMBER_DARK, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700" },

  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", textTransform: "uppercase", letterSpacing: 0.6 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: AMBER_BG, backgroundColor: AMBER_LIGHT },
  addBtnText: { fontSize: 12, fontWeight: "600", color: AMBER },

  fieldWrap: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 12 },
  inputReadonly: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  inputMulti: { alignItems: "flex-start", paddingVertical: 10 },
  input: { flex: 1, fontSize: 14, color: "#0F172A" },
  inputTextMulti: { height: 70, textAlignVertical: "top" },

  bottomSaveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: AMBER, borderRadius: 14, paddingVertical: 15, shadowColor: AMBER, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  bottomSaveTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  agenceCard: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  agenceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  agenceIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  agenceName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  agenceCity: { fontSize: 12, color: "#64748B", marginTop: 1 },
  agenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  agenceBadgeText: { fontSize: 11, fontWeight: "700" },
  agenceDetails: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E2E8F0", gap: 4 },
  agenceDetailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  agenceDetailText: { fontSize: 12, color: "#64748B", flex: 1 },

  emptyAgences: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyAgencesTxt: { fontSize: 13, color: "#94A3B8" },

  logoutSection: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  logoutSectionTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", textTransform: "uppercase", letterSpacing: 0.6 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#FECACA", backgroundColor: "#FFF5F5",
  },
  logoutBtnTxt: { fontSize: 15, fontWeight: "700", color: "#DC2626" },
});
