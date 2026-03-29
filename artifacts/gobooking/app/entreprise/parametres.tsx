import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

const CI_CITIES = [
  "Abidjan","Abengourou","Aboisso","Adzopé","Agboville","Anyama","Bondoukou",
  "Bouaflé","Bouaké","Daloa","Daoukro","Dimbokro","Divo","Duékoué","Ferkessédougou",
  "Gagnoa","Grand-Bassam","Guiglo","Issia","Katiola","Korhogo","Man","Odienné",
  "San-Pédro","Sassandra","Séguéla","Sinfra","Soubré","Tiassalé","Toumodi","Yamoussoukro",
];

const TRIP_TYPE_LABELS: Record<string, string> = {
  standard: "Standard", vip: "VIP", vip_plus: "VIP+",
};
const TRIP_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  standard: { bg: "#EEF2FF", text: "#3730A3", border: "#A5B4FC" },
  vip:      { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  vip_plus: { bg: "#F5F3FF", text: "#7C3AED", border: "#C4B5FD" },
};

interface PricingEntry {
  id: string;
  fromCity: string;
  toCity: string;
  tripType: string;
  price: number;
}

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

  /* ── Grille tarifaire ── */
  const [pricing, setPricing]           = useState<PricingEntry[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [pricingForm, setPricingForm]   = useState({ fromCity: "", toCity: "", tripType: "standard", price: "" });
  const [pricingSaving, setPricingSaving] = useState(false);

  const loadPricing = useCallback(async () => {
    if (!token) return;
    setPricingLoading(true);
    try {
      const data = await apiFetch<PricingEntry[]>("/company/pricing", { token });
      setPricing(data ?? []);
    } catch { /* ignorer */ }
    finally { setPricingLoading(false); }
  }, [token]);

  const savePricingEntry = async () => {
    if (!pricingForm.fromCity || !pricingForm.toCity) {
      Alert.alert("Erreur", "Veuillez choisir départ et arrivée."); return;
    }
    if (pricingForm.fromCity === pricingForm.toCity) {
      Alert.alert("Erreur", "Départ et arrivée doivent être différents."); return;
    }
    const priceNum = Number(pricingForm.price);
    if (!priceNum || priceNum <= 0) {
      Alert.alert("Erreur", "Veuillez entrer un tarif valide."); return;
    }
    setPricingSaving(true);
    try {
      await apiFetch("/company/pricing", {
        method: "POST", token,
        body: { fromCity: pricingForm.fromCity, toCity: pricingForm.toCity, tripType: pricingForm.tripType, price: priceNum },
      });
      setShowPricingForm(false);
      setPricingForm({ fromCity: "", toCity: "", tripType: "standard", price: "" });
      await loadPricing();
    } catch (err: any) {
      Alert.alert("Erreur", err?.message ?? "Impossible d'enregistrer le tarif.");
    } finally { setPricingSaving(false); }
  };

  const deletePricingEntry = (entry: PricingEntry) => {
    Alert.alert(
      "Supprimer ce tarif ?",
      `${entry.fromCity} → ${entry.toCity} · ${TRIP_TYPE_LABELS[entry.tripType] ?? entry.tripType}`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: async () => {
          try {
            await apiFetch(`/company/pricing/${entry.id}`, { method: "DELETE", token });
            setPricing(p => p.filter(x => x.id !== entry.id));
          } catch { Alert.alert("Erreur", "Impossible de supprimer le tarif."); }
        }},
      ]
    );
  };

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

  useEffect(() => { load(); loadPricing(); }, [load, loadPricing]);

  const onRefresh = () => { setRefreshing(true); load(); loadPricing(); };

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
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={S.backBtn}>
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

          {/* ── Grille tarifaire ─────────────────────────────────── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Grille Tarifaire</Text>
              <Pressable style={S.addBtn} onPress={() => { setPricingForm({ fromCity: "", toCity: "", tripType: "standard", price: "" }); setShowPricingForm(true); }}>
                <Feather name="plus" size={14} color={AMBER} />
                <Text style={S.addBtnText}>Ajouter</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, color: "#94A3B8", lineHeight: 17 }}>
              Définissez vos tarifs par trajet et type. Le prix s'auto-remplira lors de la création d'un départ.
            </Text>

            {pricingLoading ? (
              <ActivityIndicator size="small" color={AMBER} style={{ marginTop: 8 }} />
            ) : pricing.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
                <Feather name="tag" size={28} color="#CBD5E1" />
                <Text style={{ fontSize: 13, color: "#94A3B8" }}>Aucun tarif configuré</Text>
                <Text style={{ fontSize: 11, color: "#CBD5E1", textAlign: "center" }}>
                  Ajoutez des tarifs pour qu'ils s'auto-remplissent à la création des départs
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {pricing.map(entry => {
                  const tc = TRIP_TYPE_COLORS[entry.tripType] ?? TRIP_TYPE_COLORS.standard;
                  return (
                    <View key={entry.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>
                          {entry.fromCity} → {entry.toCity}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                          <View style={{ backgroundColor: tc.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: tc.border }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: tc.text }}>{TRIP_TYPE_LABELS[entry.tripType] ?? entry.tripType}</Text>
                          </View>
                          <Text style={{ fontSize: 13, color: AMBER_DARK, fontWeight: "700" }}>{entry.price.toLocaleString("fr-CI")} FCFA</Text>
                        </View>
                      </View>
                      <Pressable onPress={() => deletePricingEntry(entry)} style={{ padding: 6 }}>
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Déconnexion ──────────────────────────────────────── */}
          <View style={S.logoutSection}>
            <Text style={S.logoutSectionTitle}>Compte</Text>
            <Pressable
              style={({ pressed }) => [S.logoutBtn, pressed && { opacity: 0.8 }]}
              onPress={() => {
                if (Platform.OS === "web") { logout(); return; }
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
                );
              }}
            >
              <Feather name="log-out" size={18} color="#DC2626" />
              <Text style={S.logoutBtnTxt}>Se déconnecter</Text>
            </Pressable>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── Modal : Ajouter un tarif ── */}
      <Modal visible={showPricingForm} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
          <LinearGradient colors={[AMBER, AMBER_DARK]} style={{ paddingTop: insets.top + 16, paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => setShowPricingForm(false)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="x" size={18} color="white" />
            </Pressable>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: "white" }}>Ajouter un tarif</Text>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">

            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: -8 }}>Ville de départ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CI_CITIES.map(c => {
                  const active = pricingForm.fromCity === c;
                  return (
                    <Pressable key={c}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: active ? AMBER : "#E2E8F0", backgroundColor: active ? AMBER_BG : "#fff" }}
                      onPress={() => setPricingForm(f => ({ ...f, fromCity: c }))}>
                      <Text style={{ fontSize: 13, fontWeight: active ? "700" : "400", color: active ? AMBER_DARK : "#64748B" }}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: -8 }}>Destination</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CI_CITIES.filter(c => c !== pricingForm.fromCity).map(c => {
                  const active = pricingForm.toCity === c;
                  return (
                    <Pressable key={c}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: active ? AMBER : "#E2E8F0", backgroundColor: active ? AMBER_BG : "#fff" }}
                      onPress={() => setPricingForm(f => ({ ...f, toCity: c }))}>
                      <Text style={{ fontSize: 13, fontWeight: active ? "700" : "400", color: active ? AMBER_DARK : "#64748B" }}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: -8 }}>Type de départ</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["standard","vip","vip_plus"] as const).map(t => {
                const tc = TRIP_TYPE_COLORS[t];
                const active = pricingForm.tripType === t;
                return (
                  <Pressable key={t}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: active ? tc.border : "#E2E8F0", backgroundColor: active ? tc.bg : "#FAFAFA" }}
                    onPress={() => setPricingForm(f => ({ ...f, tripType: t }))}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: active ? tc.text : "#9CA3AF" }}>{TRIP_TYPE_LABELS[t]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: -8 }}>Tarif (FCFA)</Text>
            <TextInput
              style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: "#0F172A" }}
              value={pricingForm.price} placeholder="Ex : 3500" placeholderTextColor="#CBD5E1"
              keyboardType="number-pad"
              onChangeText={v => setPricingForm(f => ({ ...f, price: v }))}
            />

            {pricingForm.fromCity && pricingForm.toCity && (
              <View style={{ backgroundColor: AMBER_BG, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#FDE68A" }}>
                <Feather name="info" size={15} color={AMBER_DARK} />
                <Text style={{ fontSize: 12, color: AMBER_DARK, flex: 1, lineHeight: 17 }}>
                  Ce tarif s'appliquera automatiquement pour {pricingForm.fromCity} → {pricingForm.toCity} ({TRIP_TYPE_LABELS[pricingForm.tripType]}).
                  Les trajets inverses utilisent également ce tarif.
                </Text>
              </View>
            )}

            <Pressable
              style={[{ backgroundColor: AMBER, borderRadius: 14, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }, pricingSaving && { opacity: 0.7 }]}
              onPress={savePricingEntry} disabled={pricingSaving}>
              {pricingSaving ? <ActivityIndicator color="white" /> : (
                <>
                  <Feather name="check-circle" size={18} color="white" />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "white" }}>Enregistrer ce tarif</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
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
