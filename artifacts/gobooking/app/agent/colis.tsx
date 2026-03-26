import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform, Image, RefreshControl,
} from "react-native";
import * as Print from "expo-print";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus } from "@/utils/offline";
import { validateQR, qrErrorMessage } from "@/utils/qr";
import OfflineBanner from "@/components/OfflineBanner";

const P       = "#7C3AED";
const P_LIGHT = "#EDE9FE";
const P_DARK  = "#4C1D95";
const G       = "#059669";

const CITIES = [
  "Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pedro",
  "Daloa", "Man", "Gagnoa", "Divo", "Abengourou", "Soubré", "Bondoukou",
];
const PARCEL_TYPES = ["Documents", "Colis standard", "Fragile", "Alimentaire", "Électronique", "Vêtements", "Autre"];
const PAYMENT_METHODS = [
  { id: "cash",   label: "Espèces" },
  { id: "orange", label: "Orange Money" },
  { id: "mtn",    label: "MTN Money" },
  { id: "wave",   label: "Wave" },
];
const DELIVERY_TYPES = [
  { key: "livraison_gare",     label: "Retrait en gare" },
  { key: "livraison_domicile", label: "Livraison à domicile" },
];

const STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  créé:          { label: "Créé",       color: "#6B7280", bg: "#F3F4F6" },
  cree:          { label: "Créé",       color: "#6B7280", bg: "#F3F4F6" },
  en_attente:    { label: "Créé",       color: "#6B7280", bg: "#F3F4F6" },
  en_gare:       { label: "En gare",    color: "#D97706", bg: "#FEF3C7" },
  arrive_gare_depart: { label: "En gare", color: "#D97706", bg: "#FEF3C7" },
  "chargé_bus":  { label: "En transit", color: "#2563EB", bg: "#DBEAFE" },
  en_transit:    { label: "En transit", color: "#2563EB", bg: "#DBEAFE" },
  en_route:      { label: "En transit", color: "#2563EB", bg: "#DBEAFE" },
  arrivé:        { label: "Arrivé",     color: G,         bg: "#D1FAE5" },
  arrive:        { label: "Arrivé",     color: G,         bg: "#D1FAE5" },
  en_livraison:  { label: "Arrivé",     color: G,         bg: "#D1FAE5" },
  livré:         { label: "Retiré",     color: "#065F46", bg: "#ECFDF5" },
  livre:         { label: "Retiré",     color: "#065F46", bg: "#ECFDF5" },
  retiré:        { label: "Retiré",     color: "#065F46", bg: "#ECFDF5" },
  retire:        { label: "Retiré",     color: "#065F46", bg: "#ECFDF5" },
  annulé:        { label: "Annulé",     color: "#DC2626", bg: "#FEE2E2" },
};

type NextAction = { label: string; route: string; color: string };

function getNextAction(parcel: Parcel): NextAction | null {
  const s = parcel.status;
  const isHomeDelivery = parcel.deliveryType === "livraison_domicile";
  if (s === "créé" || s === "cree" || s === "en_attente")
    return { label: "Enregistrer en gare", route: "en-gare",       color: "#D97706" };
  if (s === "en_gare" || s === "arrive_gare_depart")
    return { label: "Charger dans bus",    route: "charge-bus",    color: P };
  if (s === "chargé_bus")
    return { label: "Déclarer en transit", route: "transit",       color: "#2563EB" };
  if (s === "en_transit" || s === "en_route")
    return { label: "Confirmer arrivée",   route: "arrive",        color: G };
  if (s === "arrivé" || s === "arrive") {
    if (isHomeDelivery)
      return { label: "Lancer la livraison", route: "lancer-livraison", color: "#EA580C" };
    return { label: "Retirer en gare",       route: "retirer",          color: "#065F46" };
  }
  if (s === "en_livraison")
    return { label: "Confirmer livraison",   route: "deliver",      color: "#065F46" };
  return null;
}

function getStatusStep(status: string): number {
  if (["créé","cree","en_attente"].includes(status)) return 1;
  if (["en_gare","arrive_gare_depart"].includes(status)) return 2;
  if (["chargé_bus","en_transit","en_route"].includes(status)) return 3;
  if (["arrivé","arrive","en_livraison"].includes(status)) return 4;
  if (["retiré","retire","livré","livre"].includes(status)) return 5;
  return 0;
}

const STEP_COLORS  = ["#6B7280","#D97706","#2563EB","#059669","#065F46"];
const STEP_LABELS  = ["Créé","En gare","Transit","Arrivé","Retiré"];

function MiniProgress({ status }: { status: string }) {
  const step = getStatusStep(status);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 }}>
      {STEP_COLORS.map((color, i) => {
        const filled  = i < step;
        const current = i === step - 1;
        return (
          <React.Fragment key={i}>
            <View style={{
              width: current ? 20 : 14, height: 6, borderRadius: 3,
              backgroundColor: filled ? color : "#E5E7EB",
            }} />
          </React.Fragment>
        );
      })}
      <Text style={{ fontSize: 10, color: STEP_COLORS[step - 1] ?? "#9CA3AF", fontWeight: "700", marginLeft: 4 }}>
        {STEP_LABELS[step - 1] ?? "—"} · {step > 0 ? step : "?"}/5
      </Text>
    </View>
  );
}

function getNotifMessage(action: string, parcel: Parcel): string | null {
  const ref = parcel.trackingRef;
  const to  = parcel.toCity;
  if (action === "arrive")          return `Votre colis ${ref} est arrivé à ${to}. Venez le retirer en gare.`;
  if (action === "retirer")         return `Votre colis ${ref} a été retiré avec succès. Merci !`;
  if (action === "lancer-livraison")return `Votre colis ${ref} est en cours de livraison à domicile. Restez disponible.`;
  if (action === "deliver")         return `Votre colis ${ref} a été livré. Bonne réception !`;
  return null;
}

interface Parcel {
  id: string;
  trackingRef: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  fromCity: string;
  toCity: string;
  parcelType: string;
  weight: string;
  amount: number;
  paymentMethod: string;
  deliveryType: string;
  status: string;
  createdAt: string;
}

type TabType = "creer" | "liste" | "retrait" | "valider";

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES[status] ?? { label: status, color: "#6B7280", bg: "#F3F4F6" };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: s.color }}>{s.label}</Text>
    </View>
  );
}

export default function ColisScreen() {
  const { user, token, logout } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);
  const [tab, setTab]           = useState<TabType>("retrait");

  const isAgent = user?.role === "agent";

  if (!isAgent) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 32 }}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="lock-closed-outline" size={52} color="#CBD5E1" />
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>Accès non autorisé</Text>
        <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>Cet espace est réservé aux agents GoBooking.</Text>
        <TouchableOpacity style={{ backgroundColor: P, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10, marginTop: 8 }}
          onPress={() => router.replace("/agent/home" as never)}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={P_DARK} />
      <OfflineBanner status={networkStatus} />

      {/* Header */}
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerIcon}><Ionicons name="cube" size={22} color="#fff" /></View>
          <View>
            <Text style={S.headerTitle}>Gestion Colis</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: networkStatus.isOnline ? "#34D399" : "#F87171" }} />
              <Text style={S.headerSub}>{networkStatus.isOnline ? "En ligne · Suivre · Livrer" : "Hors ligne"}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={S.logoutBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={S.tabs}>
        {([
          { key: "retrait",  icon: "qr-code-outline",          label: "Retrait"     },
          { key: "valider",  icon: "checkmark-circle-outline",  label: "Progression" },
          { key: "liste",    icon: "time-outline",              label: "Historique"  },
          { key: "creer",    icon: "add-circle-outline",        label: "Nouveau"     },
        ] as { key: TabType; icon: any; label: string }[]).map(t => (
          <TouchableOpacity key={t.key} style={[S.tabBtn, tab === t.key && S.tabBtnActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={t.icon} size={20} color={tab === t.key ? "#fff" : "#C4B5FD"} />
            <Text style={[S.tabTxt, tab === t.key && S.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "retrait" && <RetraitTab token={token} networkStatus={networkStatus} />}
      {tab === "valider" && <ValiderTab token={token} />}
      {tab === "liste"   && <ListTab   token={token} setTab={setTab} />}
      {tab === "creer"   && <CreateTab token={token} networkStatus={networkStatus} />}
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════
   TAB — Valider colis à distance
   ═══════════════════════════════════════════ */
interface RemoteParcel {
  id: string;
  trackingRef: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  fromCity: string;
  toCity: string;
  parcelType: string;
  weight: number;
  amount: number;
  deliveryType: string;
  photoUrl: string | null;
  declaredValue: number;
  status: string;
  createdAt: string;
}

function ValiderTab({ token }: { token: string | null }) {
  const [parcels, setParcels] = React.useState<RemoteParcel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selected, setSelected] = React.useState<RemoteParcel | null>(null);
  const [prixReel, setPrixReel] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [refusReason, setRefusReason] = React.useState("");
  const [showRefusModal, setShowRefusModal] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);

  const load = React.useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const data = await apiFetch<RemoteParcel[]>("/agent/parcels/pending-validation", { token });
      setParcels(Array.isArray(data) ? data : []);
    } catch { setParcels([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const handleValidate = async () => {
    if (!selected || !token) return;
    setActing(true);
    try {
      const body: any = {};
      if (prixReel.trim() && parseFloat(prixReel) > 0) body.prixReel = parseFloat(prixReel);
      if (notes.trim()) body.notes = notes.trim();
      await apiFetch(`/agent/parcels/${selected.id}/validate`, { token, method: "POST", body });
      setResult({ ok: true, msg: `Colis ${selected.trackingRef} validé. SMS envoyé au client.` });
      setSelected(null);
      setPrixReel("");
      setNotes("");
      load();
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? "Erreur réseau" });
    } finally { setActing(false); }
  };

  const handleRefuse = async () => {
    if (!selected || !token) return;
    setActing(true);
    try {
      await apiFetch(`/agent/parcels/${selected.id}/refuse`, { token, method: "POST", body: { reason: refusReason } });
      setResult({ ok: false, msg: `Colis ${selected.trackingRef} refusé. SMS envoyé au client.` });
      setSelected(null);
      setShowRefusModal(false);
      setRefusReason("");
      load();
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? "Erreur réseau" });
    } finally { setActing(false); }
  };

  const handleSendLivreur = async (parcel: RemoteParcel) => {
    if (!token) return;
    setActing(true);
    try {
      await apiFetch(`/agent/parcels/${parcel.id}/send-livreur`, { token, method: "POST", body: {} });
      setResult({ ok: true, msg: `Livreur envoyé pour le colis ${parcel.trackingRef}.` });
      load();
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? "Erreur réseau" });
    } finally { setActing(false); }
  };

  const TEAL = "#0E7490";
  const TEAL_LT = "#ECFEFF";

  const pendingValidation = parcels.filter(p => p.status === "en_attente_validation");
  const pendingRamassage  = parcels.filter(p => p.status === "en_attente_ramassage");

  if (loading) {
    return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator color={TEAL} size="large" />
    </View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      contentContainerStyle={{ padding: 14, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>

      {result && (
        <View style={{ backgroundColor: result.ok ? "#ECFDF5" : "#FFF1F2", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: result.ok ? "#065F46" : "#9F1239", fontSize: 14, fontWeight: "600", flex: 1 }}>{result.msg}</Text>
          <TouchableOpacity onPress={() => setResult(null)}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity>
        </View>
      )}

      {/* À valider */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <Ionicons name="time" size={18} color={TEAL} />
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#0F172A" }}>
          À valider ({pendingValidation.length})
        </Text>
      </View>

      {pendingValidation.length === 0 && (
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" }}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#CBD5E1" />
          <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 8 }}>Aucun colis en attente de validation</Text>
        </View>
      )}

      {pendingValidation.map(parcel => (
        <View key={parcel.id} style={{ backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: selected?.id === parcel.id ? TEAL : "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <View style={{ backgroundColor: TEAL_LT, padding: 12, borderBottomWidth: 1, borderColor: "#CFFAFE" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="document-text" size={16} color={TEAL} />
                <Text style={{ fontWeight: "800", color: TEAL, fontSize: 14 }}>{parcel.trackingRef}</Text>
              </View>
              <View style={{ backgroundColor: "#FEF9C3", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#854D0E" }}>Créé à distance</Text>
              </View>
            </View>
          </View>
          <View style={{ padding: 12, gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#94A3B8", fontWeight: "600" }}>EXPÉDITEUR</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>{parcel.senderName}</Text>
                <Text style={{ fontSize: 12, color: "#475569" }}>{parcel.senderPhone}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#94A3B8", fontWeight: "600" }}>DESTINATAIRE</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>{parcel.receiverName}</Text>
                <Text style={{ fontSize: 12, color: "#475569" }}>{parcel.receiverPhone}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: "#64748B" }}>{parcel.fromCity} → {parcel.toCity}</Text>
              <Text style={{ fontSize: 12, color: "#64748B" }}>{parcel.weight} kg · {parcel.parcelType}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ backgroundColor: parcel.deliveryType === "livraison_domicile" ? "#FFF7ED" : "#F0F9FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: parcel.deliveryType === "livraison_domicile" ? "#EA580C" : "#0284C7" }}>
                  {parcel.deliveryType === "livraison_domicile" ? "Domicile" : "Gare"}
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#16A34A" }}>
                {Number(parcel.amount).toLocaleString()} FCFA
                {parcel.declaredValue > 0 && <Text style={{ fontSize: 11, color: "#6B7280" }}> (déclaré: {Number(parcel.declaredValue).toLocaleString()})</Text>}
              </Text>
            </View>
            {parcel.photoUrl && (
              <View style={{ borderRadius: 10, overflow: "hidden", marginTop: 4, borderWidth: 1, borderColor: "#E2E8F0" }}>
                <Image source={{ uri: parcel.photoUrl }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
                <View style={{ backgroundColor: "#F0FDF4", padding: 6 }}>
                  <Text style={{ fontSize: 11, color: "#15803D", textAlign: "center", fontWeight: "600" }}>Photo du colis fournie par le client</Text>
                </View>
              </View>
            )}
            {/* Validation panel */}
            {selected?.id === parcel.id ? (
              <View style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, gap: 10, marginTop: 4, borderWidth: 1.5, borderColor: TEAL }}>
                <TextInput
                  value={prixReel}
                  onChangeText={setPrixReel}
                  placeholder="Ajuster le prix FCFA (optionnel)"
                  keyboardType="numeric"
                  style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }}
                />
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Note pour le client (optionnel)"
                  style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "#059669", borderRadius: 12, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                    onPress={handleValidate} disabled={acting}>
                    {acting ? <ActivityIndicator size="small" color="#fff" />
                      : <><Ionicons name="checkmark-circle" size={16} color="#fff" /><Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Valider</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "#DC2626", borderRadius: 12, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                    onPress={() => setShowRefusModal(true)} disabled={acting}>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Refuser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ backgroundColor: "#F1F5F9", borderRadius: 12, padding: 13 }}
                    onPress={() => setSelected(null)}>
                    <Ionicons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={{ backgroundColor: TEAL, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4, flexDirection: "row", justifyContent: "center", gap: 8 }}
                onPress={() => { setSelected(parcel); setPrixReel(""); setNotes(""); }}>
                <Ionicons name="eye-outline" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Vérifier ce colis</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {/* À ramasser (domicile) */}
      {pendingRamassage.length > 0 && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Ionicons name="bicycle" size={18} color="#EA580C" />
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#0F172A" }}>
              Ramassage domicile ({pendingRamassage.length})
            </Text>
          </View>
          {pendingRamassage.map(parcel => (
            <View key={parcel.id} style={{ backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: "#FED7AA" }}>
              <View style={{ backgroundColor: "#FFF7ED", padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "800", color: "#EA580C", fontSize: 13 }}>{parcel.trackingRef}</Text>
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#B45309" }}>À ramasser</Text>
                </View>
              </View>
              <View style={{ padding: 12, gap: 6 }}>
                <Text style={{ fontSize: 13, color: "#0F172A", fontWeight: "600" }}>{parcel.senderName} — {parcel.senderPhone}</Text>
                <Text style={{ fontSize: 12, color: "#64748B" }}>{parcel.fromCity} → {parcel.toCity}</Text>
                <TouchableOpacity
                  style={{ backgroundColor: "#EA580C", borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4, flexDirection: "row", justifyContent: "center", gap: 8 }}
                  onPress={() => handleSendLivreur(parcel)} disabled={acting}>
                  {acting ? <ActivityIndicator size="small" color="#fff" />
                    : <><Ionicons name="bicycle-outline" size={16} color="#fff" /><Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Envoyer livreur</Text></>}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Refus modal */}
      <Modal visible={showRefusModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Motif du refus</Text>
            <TextInput
              value={refusReason}
              onChangeText={setRefusReason}
              placeholder="Expliquer pourquoi le colis est refusé..."
              multiline
              style={{ backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, minHeight: 80, fontSize: 14 }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#DC2626", borderRadius: 12, padding: 14, alignItems: "center" }}
                onPress={handleRefuse} disabled={acting}>
                {acting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Confirmer le refus</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#F1F5F9", borderRadius: 12, padding: 14, alignItems: "center" }}
                onPress={() => setShowRefusModal(false)}>
                <Text style={{ color: "#475569", fontWeight: "700", fontSize: 15 }}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ═══════════════════════════════════════════
   TAB 1 — Créer un colis
   ═══════════════════════════════════════════ */
interface CreatedParcel {
  trackingRef: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  fromCity: string;
  toCity: string;
  parcelType: string;
  weight: string;
  amount: number;
  deliveryType: string;
  pickupCode?: string;
}

function buildLabelHtml(p: CreatedParcel): string {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(p.trackingRef)}`;
  const deliveryLabel = p.deliveryType === "livraison_domicile" ? "Livraison à domicile" : "Retrait en gare";
  const deliveryColor = p.deliveryType === "livraison_domicile" ? "#EA580C" : "#7C3AED";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Étiquette Colis GoBooking</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    background: #fff;
    display: flex;
    justify-content: center;
    padding: 20px;
  }
  .label {
    width: 80mm;
    margin: 0 auto;
    padding: 12px;
    border: 3px solid #7C3AED;
    border-radius: 8px;
    text-align: center;
  }
  .header {
    border-bottom: 2px dashed #7C3AED;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .brand { font-size: 16px; font-weight: bold; color: #4C1D95; }
  .sub   { font-size: 9px; color: #6B7280; margin-top: 2px; }
  .date  { font-size: 9px; color: #9CA3AF; margin-top: 3px; }
  .ref-box {
    background: #EDE9FE;
    border-radius: 6px;
    padding: 8px 12px;
    margin: 10px 0;
    border: 1px dashed #7C3AED;
  }
  .ref   { font-size: 18px; font-weight: bold; color: #7C3AED; letter-spacing: 2px; }
  .route { font-size: 16px; font-weight: bold; color: #111; margin: 8px 0; }
  .arrow { color: #7C3AED; }
  .divider { border-top: 1px dashed #DDD6FE; margin: 8px 0; }
  .parties { display: flex; justify-content: space-between; gap: 8px; margin: 8px 0; text-align: left; }
  .party { flex: 1; background: #F5F3FF; border-radius: 6px; padding: 6px 8px; font-size: 10px; }
  .party-role { font-size: 8px; color: #7C3AED; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
  .party-name { font-weight: 700; color: #111; font-size: 11px; }
  .party-phone { color: #6B7280; font-size: 10px; margin-top: 1px; }
  .info-row { display: flex; justify-content: space-between; font-size: 10px; padding: 3px 0; }
  .info-key { color: #6B7280; }
  .info-val { color: #111; font-weight: 600; }
  .qr-section { margin: 12px auto 6px; text-align: center; }
  .qr-section img {
    width: 180px;
    height: 180px;
    display: block;
    margin: 0 auto;
  }
  .qr-label { font-size: 8px; color: #9CA3AF; margin-top: 4px; }
  .delivery-badge {
    display: inline-block;
    background: ${deliveryColor};
    color: #fff;
    font-size: 10px;
    font-weight: bold;
    padding: 5px 12px;
    border-radius: 4px;
    margin: 8px 0;
  }
  .footer { font-size: 8px; color: #9CA3AF; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #DDD6FE; }
  @media print {
    body {
      width: 80mm;
      margin: 0;
      padding: 10px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .label { border: 3px solid #7C3AED; }
    .qr-section img { width: 180px; height: 180px; }
  }
</style>
</head>
<body>
<div class="label">
  <div class="header">
    <div class="brand">GoBooking Colis</div>
    <div class="sub">Transport · Côte d'Ivoire</div>
    <div class="date">${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
  </div>

  <div class="ref-box">
    <div class="ref">${p.trackingRef}</div>
  </div>

  <div class="route">${p.fromCity} <span class="arrow">→</span> ${p.toCity}</div>

  <div class="divider"></div>

  <div class="parties">
    <div class="party">
      <div class="party-role">Expéditeur</div>
      <div class="party-name">${p.senderName}</div>
      <div class="party-phone">${p.senderPhone}</div>
    </div>
    <div class="party">
      <div class="party-role">Destinataire</div>
      <div class="party-name">${p.receiverName}</div>
      <div class="party-phone">${p.receiverPhone}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-row"><span class="info-key">Type</span><span class="info-val">${p.parcelType}</span></div>
  ${p.weight ? `<div class="info-row"><span class="info-key">Poids</span><span class="info-val">${p.weight} kg</span></div>` : ""}
  <div class="info-row"><span class="info-key">Montant</span><span class="info-val">${Number(p.amount).toLocaleString("fr-FR")} FCFA</span></div>

  <div class="delivery-badge">${deliveryLabel}</div>

  <div class="qr-section">
    <img src="${qrUrl}" alt="QR Code ${p.trackingRef}" />
    <div class="qr-label">Scannez pour suivre votre colis</div>
  </div>

  <div class="footer">
    GoBooking · Transport Côte d'Ivoire<br/>
    Conservez cette étiquette jusqu'à livraison
  </div>
</div>
</body>
</html>`;
}

async function printLabel(p: CreatedParcel) {
  try {
    const html = buildLabelHtml(p);
    if (Platform.OS === "web") {
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); win.print(); }
    } else {
      await Print.printAsync({ html });
    }
  } catch (e: any) {
    Alert.alert("Impression", e?.message ?? "Impossible d'ouvrir l'impression.");
  }
}

function CreateTab({ token, networkStatus }: { token: string | null; networkStatus: any }) {
  const [fromCity, setFromCity]       = useState("Abidjan");
  const [toCity, setToCity]           = useState("Bouaké");
  const [senderName, setSenderName]   = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName]   = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [parcelType, setParcelType]   = useState("Colis standard");
  const [description, setDescription] = useState("");
  const [weight, setWeight]           = useState("");
  const [amount, setAmount]           = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [deliveryType, setDeliveryType]   = useState("livraison_gare");
  const [submitting, setSubmitting]   = useState(false);
  const [printing, setPrinting]       = useState(false);
  const [created, setCreated]         = useState<CreatedParcel | null>(null);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker]     = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const reset = () => {
    setSenderName(""); setSenderPhone(""); setReceiverName(""); setReceiverPhone("");
    setDescription(""); setWeight(""); setAmount(""); setCreated(null);
    setFromCity("Abidjan"); setToCity("Bouaké"); setParcelType("Colis standard");
    setPaymentMethod("cash"); setDeliveryType("livraison_gare");
  };

  const handleCreate = async () => {
    if (!senderName.trim())   { Alert.alert("Erreur", "Entrez le nom de l'expéditeur."); return; }
    if (!senderPhone.trim())  { Alert.alert("Erreur", "Entrez le téléphone de l'expéditeur."); return; }
    if (!receiverName.trim()) { Alert.alert("Erreur", "Entrez le nom du destinataire."); return; }
    if (!receiverPhone.trim()){ Alert.alert("Erreur", "Entrez le téléphone du destinataire."); return; }
    if (!amount.trim() || isNaN(Number(amount))) { Alert.alert("Erreur", "Entrez un montant valide."); return; }
    if (fromCity === toCity)  { Alert.alert("Erreur", "Ville de départ et d'arrivée identiques."); return; }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ trackingRef?: string; id?: string; pickupCode?: string }>("/agent/parcels", {
        token: token ?? undefined, method: "POST",
        body: { fromCity, toCity, senderName: senderName.trim(), senderPhone: senderPhone.trim(),
          receiverName: receiverName.trim(), receiverPhone: receiverPhone.trim(),
          parcelType, description: description.trim() || undefined,
          weight: weight.trim(), amount: Number(amount), paymentMethod, deliveryType },
      });
      setCreated({
        trackingRef: res.trackingRef ?? res.id ?? "—",
        senderName: senderName.trim(), senderPhone: senderPhone.trim(),
        receiverName: receiverName.trim(), receiverPhone: receiverPhone.trim(),
        fromCity, toCity, parcelType, weight: weight.trim(),
        amount: Number(amount), deliveryType,
        pickupCode: res.pickupCode,
      });
    } catch (e: any) {
      if (e?.status === 404 || e?.status === 405) {
        Alert.alert("Info", "L'endpoint de création sera disponible prochainement.");
      } else {
        Alert.alert("Erreur", e?.message ?? "Impossible de créer le colis.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = async () => {
    if (!created) return;
    setPrinting(true);
    await printLabel(created);
    setPrinting(false);
  };

  if (created) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[SC.content, { alignItems: "center", paddingTop: 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Ionicons name="checkmark-circle" size={72} color={G} />
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#111827", marginTop: 12 }}>Colis enregistré !</Text>

        {/* Recap card */}
        <View style={{ backgroundColor: P_LIGHT, borderRadius: 14, padding: 16, marginTop: 16, width: "100%", borderWidth: 2, borderColor: "#DDD6FE", gap: 6 }}>
          <View style={{ alignItems: "center", borderBottomWidth: 1, borderColor: "#DDD6FE", paddingBottom: 10, marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Numéro de suivi</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: P, marginTop: 2, letterSpacing: 1 }}>{created.trackingRef}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#111", textAlign: "center" }}>{created.fromCity} → {created.toCity}</Text>
          {[
            { k: "Expéditeur",   v: `${created.senderName} · ${created.senderPhone}` },
            { k: "Destinataire", v: `${created.receiverName} · ${created.receiverPhone}` },
            { k: "Type",         v: created.parcelType },
            { k: "Montant",      v: `${Number(created.amount).toLocaleString("fr-FR")} FCFA` },
          ].map(r => (
            <View key={r.k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 1, borderColor: "#EDE9FE" }}>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>{r.k}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#111", flexShrink: 1, textAlign: "right", maxWidth: "60%" }}>{r.v}</Text>
            </View>
          ))}
        </View>

        {created.pickupCode && (
          <View style={{ backgroundColor: "#FEF3C7", borderRadius: 14, padding: 16, marginTop: 10, width: "100%", borderWidth: 2, borderColor: "#FCD34D", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Ionicons name="shield-checkmark" size={20} color="#D97706" />
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#92400E" }}>Code de retrait sécurisé</Text>
            </View>
            <Text style={{ fontSize: 36, fontWeight: "900", color: "#D97706", letterSpacing: 10, marginBottom: 4 }}>{created.pickupCode}</Text>
            <Text style={{ fontSize: 11, color: "#92400E", textAlign: "center", lineHeight: 16 }}>
              SMS envoyé au destinataire ({created.receiverPhone}){"\n"}
              Ce code est requis pour récupérer le colis en gare.
            </Text>
          </View>
        )}
        <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 10 }}>Transmettez le code de suivi à l'expéditeur et rappellez au destinataire de conserver son SMS.</Text>

        <TouchableOpacity
          style={{ marginTop: 20, backgroundColor: "#4C1D95", flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, width: "100%", justifyContent: "center" }}
          onPress={handlePrint} disabled={printing}>
          {printing
            ? <ActivityIndicator color="#fff" />
            : <><Ionicons name="print-outline" size={20} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Imprimer l'étiquette</Text></>
          }
        </TouchableOpacity>

        <TouchableOpacity style={[SC.submitBtn, { marginTop: 10 }]} onPress={reset}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={SC.submitTxt}>Nouveau colis</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: "#F5F3FF" }} contentContainerStyle={SC.content} keyboardShouldPersistTaps="handled">

        {/* Villes */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="navigate-outline" size={18} color={P} /><Text style={SC.cardTitle}>Trajet</Text></View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[SC.label, { marginBottom: 6 }]}>Départ</Text>
              <TouchableOpacity style={SC.pickerBtn} onPress={() => setShowFromPicker(true)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <Ionicons name="business-outline" size={14} color={P} />
                  <Text style={SC.pickerTxt}>{fromCity}</Text>
                </View>
                <Ionicons name="chevron-down" size={14} color={P} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ width: 38, height: 46, borderRadius: 12, backgroundColor: P_LIGHT, borderWidth: 1.5, borderColor: "#DDD6FE", justifyContent: "center", alignItems: "center", marginBottom: 1 }}
              onPress={() => { const tmp = fromCity; setFromCity(toCity); setToCity(tmp); }}
            >
              <Ionicons name="swap-horizontal" size={18} color={P} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[SC.label, { marginBottom: 6 }]}>Arrivée</Text>
              <TouchableOpacity style={SC.pickerBtn} onPress={() => setShowToPicker(true)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <Ionicons name="location-outline" size={14} color={P} />
                  <Text style={SC.pickerTxt}>{toCity}</Text>
                </View>
                <Ionicons name="chevron-down" size={14} color={P} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Expéditeur + Destinataire regroupés */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="people-outline" size={18} color={P} /><Text style={SC.cardTitle}>Personnes</Text></View>
          {/* Expéditeur */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: P_LIGHT, justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="arrow-up" size={12} color={P} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: P }}>Expéditeur</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <TextInput style={[SC.input, { flex: 1 }]} placeholder="Nom *" value={senderName} onChangeText={setSenderName} returnKeyType="next" />
            <TextInput style={[SC.input, { flex: 1 }]} placeholder="Téléphone *" value={senderPhone}
              onChangeText={setSenderPhone} keyboardType="phone-pad" />
          </View>
          {/* Séparateur */}
          <View style={{ height: 1, backgroundColor: "#EDE9FE", marginBottom: 12 }} />
          {/* Destinataire */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="arrow-down" size={12} color="#059669" />
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#059669" }}>Destinataire</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput style={[SC.input, { flex: 1 }]} placeholder="Nom *" value={receiverName} onChangeText={setReceiverName} returnKeyType="next" />
            <TextInput style={[SC.input, { flex: 1 }]} placeholder="Téléphone *" value={receiverPhone}
              onChangeText={setReceiverPhone} keyboardType="phone-pad" />
          </View>
        </View>

        {/* Détails colis */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="cube-outline" size={18} color={P} /><Text style={SC.cardTitle}>Détails du colis</Text></View>
          <TouchableOpacity style={SC.pickerBtn} onPress={() => setShowTypePicker(true)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Ionicons name="cube-outline" size={15} color="#9CA3AF" />
              <Text style={SC.pickerTxt}>{parcelType}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={P} />
          </TouchableOpacity>
          {/* Poids + Montant côte à côte */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[SC.label, { marginBottom: 5 }]}>Poids (kg)</Text>
              <TextInput style={SC.input} placeholder="Ex: 2.5" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[SC.label, { marginBottom: 5 }]}>Montant FCFA *</Text>
              <TextInput style={SC.input} placeholder="Ex: 2500" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            </View>
          </View>
          <TextInput
            style={[SC.input, { minHeight: 44, textAlignVertical: "top" }]}
            placeholder="Note / description (optionnel)"
            value={description} onChangeText={setDescription} multiline numberOfLines={2}
          />
        </View>

        {/* Livraison */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="home-outline" size={18} color={P} /><Text style={SC.cardTitle}>Livraison</Text></View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[SC.optBtn, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, deliveryType === "livraison_gare" && SC.optBtnSel]}
              onPress={() => setDeliveryType("livraison_gare")}>
              <Ionicons name="business-outline" size={14} color={deliveryType === "livraison_gare" ? P : "#9CA3AF"} />
              <Text style={[SC.optTxt, deliveryType === "livraison_gare" && SC.optTxtSel]}>En gare</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[SC.optBtn, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, deliveryType === "livraison_domicile" && SC.optBtnSel]}
              onPress={() => setDeliveryType("livraison_domicile")}>
              <Ionicons name="bicycle-outline" size={14} color={deliveryType === "livraison_domicile" ? P : "#9CA3AF"} />
              <Text style={[SC.optTxt, deliveryType === "livraison_domicile" && SC.optTxtSel]}>À domicile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Paiement */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="wallet-outline" size={18} color={P} /><Text style={SC.cardTitle}>Paiement</Text></View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity key={pm.id} style={[SC.optBtn, paymentMethod === pm.id && SC.optBtnSel]}
                onPress={() => setPaymentMethod(pm.id)}>
                <Text style={[SC.optTxt, paymentMethod === pm.id && SC.optTxtSel]}>{pm.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[SC.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleCreate} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="checkmark-circle-outline" size={22} color="#fff" /><Text style={SC.submitTxt}>Enregistrer le colis</Text></>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Pickers */}
      <CityPickerModal visible={showFromPicker} onClose={() => setShowFromPicker(false)}
        title="Ville de départ" exclude={toCity} onSelect={c => { setFromCity(c); setShowFromPicker(false); }} />
      <CityPickerModal visible={showToPicker} onClose={() => setShowToPicker(false)}
        title="Ville d'arrivée" exclude={fromCity} onSelect={c => { setToCity(c); setShowToPicker(false); }} />
      <ListPickerModal visible={showTypePicker} onClose={() => setShowTypePicker(false)}
        title="Type de colis" items={PARCEL_TYPES} onSelect={t => { setParcelType(t); setShowTypePicker(false); }} />
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════════════════════════════
   TAB 2 — Liste des colis
   ═══════════════════════════════════════════ */
function ListTab({ token, setTab }: { token: string | null; setTab(t: TabType): void }) {
  const [parcels, setParcels]   = useState<Parcel[]>([]);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState("tous");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = filter !== "tous" ? `/agent/parcels?status=${encodeURIComponent(filter)}` : "/agent/parcels";
      const res = await apiFetch<Parcel[]>(url, { token });
      setParcels(Array.isArray(res) ? res : []);
    } catch {
      setParcels([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { load(); }, [filter]);

  const handleStatusUpdate = async (parcel: Parcel) => {
    const next = getNextAction(parcel);
    if (!next) { Alert.alert("Info", "Ce colis ne peut plus être mis à jour."); return; }
    Alert.alert(next.label, `Confirmer pour : ${parcel.trackingRef} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", onPress: async () => {
        setUpdating(parcel.id);
        try {
          await apiFetch(`/agent/parcels/${parcel.id}/${next.route}`, { token: token ?? undefined, method: "POST", body: {} });
          await load();
        } catch (e: any) {
          Alert.alert("Erreur", e?.message ?? "Mise à jour impossible.");
        } finally {
          setUpdating(null);
        }
      }},
    ]);
  };

  const STEP_FILTERS = [
    { key: "tous",      label: "Tous",       icon: "list-outline"           as const, color: "#6B7280" },
    { key: "créé",      label: "Créé",       icon: "add-circle-outline"     as const, color: "#6B7280" },
    { key: "en_gare",   label: "En gare",    icon: "business-outline"       as const, color: "#D97706" },
    { key: "en_transit",label: "En transit", icon: "bus-outline"            as const, color: "#2563EB" },
    { key: "arrivé",    label: "Arrivé",     icon: "location-outline"       as const, color: "#059669" },
    { key: "retiré",    label: "Retiré",     icon: "checkmark-circle-outline" as const, color: "#065F46" },
  ];

  function matchesFilter(p: Parcel, f: string): boolean {
    if (f === "tous") return true;
    if (f === "créé")       return ["créé","cree","en_attente"].includes(p.status);
    if (f === "en_gare")    return ["en_gare","arrive_gare_depart"].includes(p.status);
    if (f === "en_transit") return ["chargé_bus","en_transit","en_route"].includes(p.status);
    if (f === "arrivé")     return ["arrivé","arrive","en_livraison"].includes(p.status);
    if (f === "retiré")     return ["retiré","retire","livré","livre"].includes(p.status);
    return p.status === f;
  }

  const arrivedCount  = parcels.filter(p => ["arrivé","arrive"].includes(p.status)).length;
  const totalActionCount = parcels.filter(p => getNextAction(p) !== null).length;
  const actionBreakdown = [
    { key: "arrivé",     label: "arrivés",       count: parcels.filter(p => ["arrivé","arrive"].includes(p.status)).length },
    { key: "en_gare",    label: "en gare",        count: parcels.filter(p => p.status === "en_gare").length },
    { key: "en_transit", label: "en transit",     count: parcels.filter(p => p.status === "en_transit").length },
    { key: "créé",       label: "créés",          count: parcels.filter(p => p.status === "créé").length },
  ].filter(s => s.count > 0);

  /* ── Sort parcels: most recent first ── */
  const sortByDate = (list: Parcel[]) =>
    [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  /* ── Group sections (order = urgency priority) ── */
  const SECTIONS = [
    { key: "en_transit", label: "En transit",  icon: "bus-outline"              as const, color: "#2563EB", bg: "#DBEAFE" },
    { key: "arrivé",     label: "Arrivé",       icon: "location"                 as const, color: "#059669", bg: "#D1FAE5" },
    { key: "en_gare",    label: "En gare",      icon: "business-outline"         as const, color: "#D97706", bg: "#FEF3C7" },
    { key: "créé",       label: "Créé",         icon: "add-circle-outline"       as const, color: "#6B7280", bg: "#F3F4F6" },
    { key: "retiré",     label: "Retiré",       icon: "checkmark-circle-outline" as const, color: "#065F46", bg: "#ECFDF5" },
    { key: "annulé",     label: "Annulé",       icon: "close-circle-outline"     as const, color: "#DC2626", bg: "#FEE2E2" },
  ];

  const grouped = SECTIONS.map(s => ({
    ...s,
    items: sortByDate(parcels.filter(p => matchesFilter(p, s.key))),
  })).filter(s => s.items.length > 0);

  const displayedParcels = sortByDate(parcels.filter(p => matchesFilter(p, filter)));
  const activeFilter = STEP_FILTERS.find(f => f.key === filter);

  /* ── Parcel card renderer (shared) ── */
  const renderCard = (p: Parcel) => {
    const nextAction = getNextAction(p);
    const statusInfo = STATUSES[p.status] ?? { color: "#6B7280", bg: "#F3F4F6", label: p.status };
    const isHomeDelivery = p.deliveryType === "livraison_domicile";
    const isDone = !nextAction;

    return (
      <View key={p.id} style={[
        SL.card,
        { borderLeftWidth: isDone ? 3 : 5, borderLeftColor: statusInfo.color },
        isDone && { opacity: 0.72, elevation: 1, shadowOpacity: 0.03 },
        !isDone && {
          elevation: 4,
          shadowColor: statusInfo.color,
          shadowOpacity: 0.13,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        },
      ]}>
        {/* Top row: ref + route + status badge + print icon + date */}
        <View style={SL.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[SL.ref, isDone && { color: "#6B7280" }]}>{p.trackingRef}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
              <Ionicons name="navigate-outline" size={12} color="#9CA3AF" />
              <Text style={SL.route}>{p.fromCity} → {p.toCity}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <Ionicons name="person-outline" size={11} color="#9CA3AF" />
              <Text style={SL.names}>{p.senderName} → {p.receiverName}</Text>
            </View>
          </View>
          {/* Right column: status badge + print + date */}
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <StatusBadge status={p.status} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {p.createdAt ? (
                <Text style={{ fontSize: 10, color: "#9CA3AF", fontWeight: "500" }}>
                  {new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={() => printLabel({
                  trackingRef: p.trackingRef,
                  senderName: p.senderName, senderPhone: p.senderPhone,
                  receiverName: p.receiverName, receiverPhone: p.receiverPhone,
                  fromCity: p.fromCity, toCity: p.toCity,
                  parcelType: p.parcelType, weight: p.weight ? String(p.weight) : "",
                  amount: p.amount, deliveryType: p.deliveryType ?? "livraison_gare",
                })}
                style={{ padding: 4 }}
              >
                <Ionicons name="print-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Meta row: type + weight + amount + livraison */}
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <View style={{ backgroundColor: "#F1F5F9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, color: "#475569", fontWeight: "600" }}>
              {p.parcelType}{p.weight ? ` · ${p.weight}kg` : ""}
            </Text>
          </View>
          <View style={{ backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, color: "#0369A1", fontWeight: "700" }}>
              {Number(p.amount).toLocaleString()} FCFA
            </Text>
          </View>
          <View style={{ backgroundColor: isHomeDelivery ? "#FFF7ED" : "#F0FDF4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: isHomeDelivery ? "#EA580C" : "#065F46" }}>
              {isHomeDelivery ? "Domicile" : "Gare"}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <MiniProgress status={p.status} />

        {/* Primary action — FULL WIDTH for maximum tap speed */}
        {nextAction ? (
          <TouchableOpacity
            style={{
              backgroundColor: nextAction.color,
              borderRadius: 12, paddingVertical: 16,
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              shadowColor: nextAction.color, shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
            }}
            onPress={() => handleStatusUpdate(p)}
            disabled={updating === p.id}
            activeOpacity={0.8}
          >
            {updating === p.id
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: -0.2 }}>
                    {nextAction.label}
                  </Text>
                </>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 }}>
            <Ionicons name="checkmark-done-circle" size={16} color="#9CA3AF" />
            <Text style={{ fontSize: 12, color: "#9CA3AF", fontWeight: "600" }}>Terminé</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>

      {/* Bannière synthèse globale — affiché uniquement en vue "Tous" s'il y a des actions */}
      {filter === "tous" && totalActionCount > 0 && (
        <View style={{ marginHorizontal: 12, marginTop: 10, backgroundColor: "#FFF7ED", borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: "#FED7AA" }}>
          {/* Header principal */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingBottom: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#F97316", justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="flash" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#9A3412", letterSpacing: -0.3 }}>
                {totalActionCount} action{totalActionCount > 1 ? "s" : ""} en attente
              </Text>
              <Text style={{ fontSize: 11, color: "#EA580C", marginTop: 1 }}>
                Appuyez sur un filtre pour traiter chaque groupe
              </Text>
            </View>
          </View>
          {/* Chips rapides cliquables par statut */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 12 }}>
            {actionBreakdown.map(s => {
              const STATUS_COLORS: Record<string, string> = {
                arrivé: "#059669", en_gare: "#D97706", en_transit: "#2563EB", "créé": "#6B7280",
              };
              const col = STATUS_COLORS[s.key] ?? "#6B7280";
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setFilter(s.key)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: col + "18", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: col + "44" }}
                >
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: col }}>
                    {s.count} {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 52 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 7, alignItems: "center" }}>
        {STEP_FILTERS.map(f => {
          const count = f.key !== "tous" ? parcels.filter(p => matchesFilter(p, f.key)).length : null;
          const isActive = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[SL.chip, isActive && { backgroundColor: f.color, borderColor: f.color }]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons name={f.icon} size={12} color={isActive ? "#fff" : f.color} />
              <Text style={[SL.chipTxt, isActive && { color: "#fff" }]}>
                {f.label}{count !== null ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && (
        <View style={{ alignItems: "center", marginTop: 40, gap: 12 }}>
          <ActivityIndicator color={P} size="large" />
          <Text style={{ fontSize: 13, color: "#9CA3AF" }}>Chargement des colis…</Text>
        </View>
      )}

      {!loading && parcels.length === 0 && (
        <View style={{ alignItems: "center", marginTop: 48, gap: 10, paddingHorizontal: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: P_LIGHT, justifyContent: "center", alignItems: "center" }}>
            <Ionicons name="cube-outline" size={32} color={P} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#374151" }}>Aucun colis</Text>
          <Text style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 19 }}>
            Créez votre premier colis via l'onglet "Nouveau"
          </Text>
          <TouchableOpacity
            style={{ marginTop: 4, backgroundColor: P, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}
            onPress={load}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && displayedParcels.length === 0 && parcels.length > 0 && (
        <View style={{ alignItems: "center", marginTop: 48, gap: 8, paddingHorizontal: 32 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" }}>
            <Ionicons name="filter-outline" size={28} color="#9CA3AF" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#374151" }}>Aucun colis dans cette étape</Text>
          <Text style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>Essayez "Tous" pour voir tous les colis</Text>
        </View>
      )}

      {!loading && parcels.length > 0 && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>

          {/* ── VUE PAR SECTIONS (filtre Tous) ── */}
          {filter === "tous" ? (
            grouped.map((section) => (
              <View key={section.key} style={{ marginBottom: 24 }}>
                {/* Section header — accent bar + icon + label + count */}
                <View style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: section.bg,
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 12,
                  shadowColor: section.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                  elevation: 2,
                }}>
                  {/* Left accent bar */}
                  <View style={{ width: 5, alignSelf: "stretch", backgroundColor: section.color }} />
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: section.color, justifyContent: "center", alignItems: "center" }}>
                      <Ionicons name={section.icon} size={17} color="#fff" />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "800", color: section.color, letterSpacing: -0.3 }}>
                      {section.label}
                    </Text>
                    <View style={{ backgroundColor: section.color, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>{section.items.length}</Text>
                    </View>
                  </View>
                </View>
                {/* Cards in this section */}
                <View style={{ gap: 10 }}>
                  {section.items.map(p => renderCard(p))}
                </View>
              </View>
            ))
          ) : (
            /* ── VUE FILTRÉE (statut précis) ── */
            <View>
              {activeFilter && (
                <View style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: activeFilter.color + "15",
                  borderRadius: 12, overflow: "hidden",
                  marginBottom: 14,
                  shadowColor: activeFilter.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1, shadowRadius: 5, elevation: 2,
                }}>
                  <View style={{ width: 5, alignSelf: "stretch", backgroundColor: activeFilter.color }} />
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: activeFilter.color, justifyContent: "center", alignItems: "center" }}>
                      <Ionicons name={activeFilter.icon} size={16} color="#fff" />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "800", color: activeFilter.color }}>
                      {activeFilter.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: activeFilter.color, fontWeight: "700", backgroundColor: activeFilter.color + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                      {displayedParcels.length} colis
                    </Text>
                  </View>
                </View>
              )}
              <View style={{ gap: 10 }}>
                {displayedParcels.map(p => renderCard(p))}
              </View>
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════
   TAB 3 — Retrait / Livraison
   ═══════════════════════════════════════════ */
function RetraitTab({ token, networkStatus }: { token: string | null; networkStatus: any }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning]   = useState(false);
  const [manualRef, setManualRef] = useState("");
  const [colis, setColis]         = useState<Parcel | null>(null);
  const [loading, setLoading]     = useState(false);
  const [updating, setUpdating]   = useState(false);
  const [lastAction, setLastAction] = useState<{ label: string; notif: string | null } | null>(null);
  const lastScan = useRef<string>("");

  /* Retrait confirmation */
  const [showRetraitConfirm, setShowRetraitConfirm] = useState(false);
  const [pickupCode, setPickupCode]   = useState("");
  const [codeError, setCodeError]     = useState("");
  const [resending, setResending]     = useState(false);
  const [retraitScanMode, setRetraitScanMode] = useState(false);
  const lastRetraitScan = useRef<string>("");

  /* Historique retraits de la session */
  type RecentPickup = { ref: string; receiver: string; phone: string; time: string; amount: string };
  const [recentPickups, setRecentPickups] = useState<RecentPickup[]>([]);

  const search = useCallback(async (ref: string) => {
    if (!ref.trim()) { Alert.alert("Erreur", "Entrez un numéro de suivi."); return; }
    setLoading(true);
    setColis(null);
    setLastAction(null);
    try {
      const res = await apiFetch<Parcel>(`/parcels/track/${ref.trim()}`, { token: token ?? undefined });
      setColis(res);
    } catch {
      Alert.alert("Introuvable", `Aucun colis trouvé pour : ${ref.trim()}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleQR = (data: string) => {
    if (data === lastScan.current) return;
    lastScan.current = data;
    setScanning(false);
    const qr = validateQR(data);
    const ref = (qr.valid ? qr.ref : null) ?? data;
    setManualRef(ref);
    search(ref);
  };

  const handleAction = async (action: { label: string; route: string; color: string }) => {
    if (!colis) return;
    setUpdating(true);
    try {
      await apiFetch(`/agent/parcels/${colis.id}/${action.route}`, { token: token ?? undefined, method: "POST", body: {} });
      const notif = getNotifMessage(action.route, colis);
      setLastAction({ label: action.label, notif });
      await search(colis.trackingRef);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Mise à jour impossible.");
    } finally {
      setUpdating(false);
    }
  };

  const handleRetrait = async () => {
    if (!colis) return;
    const code = pickupCode.trim();
    if (!code || code.length < 4) {
      setCodeError("Veuillez saisir le code de retrait à 4 chiffres");
      return;
    }
    setCodeError("");
    setUpdating(true);
    try {
      await apiFetch(`/agent/parcels/${colis.id}/retirer`, {
        token: token ?? undefined, method: "POST", body: { pickupCode: code },
      });
      setShowRetraitConfirm(false);
      setPickupCode("");
      const notif = `Votre colis ${colis.trackingRef} a été retiré avec succès. Merci !`;
      setLastAction({ label: "Retrait validé", notif });
      setRecentPickups(prev => [
        {
          ref: colis.trackingRef,
          receiver: colis.receiverName,
          phone: colis.receiverPhone,
          time: new Date().toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit" }),
          amount: `${Number(colis.amount).toLocaleString()} FCFA`,
        },
        ...prev.slice(0, 9),
      ]);
      await search(colis.trackingRef);
    } catch (e: any) {
      if (e?.message?.includes("incorrect")) {
        setCodeError("Code incorrect — Demandez au destinataire de vérifier son SMS");
      } else {
        Alert.alert("Erreur", e?.message ?? "Retrait impossible");
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleResendCode = async () => {
    if (!colis) return;
    setResending(true);
    try {
      await apiFetch(`/agent/parcels/${colis.id}/resend-pickup-code`, {
        token: token ?? undefined, method: "POST", body: {},
      });
      Alert.alert("SMS envoyé", `Le code de retrait a été renvoyé au ${colis.receiverPhone}`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de renvoyer le SMS");
    } finally {
      setResending(false);
    }
  };

  const na = colis ? getNextAction(colis) : null;
  const isHomeDelivery = colis?.deliveryType === "livraison_domicile";
  const isDone = colis && (colis.status === "retiré" || colis.status === "retire" || colis.status === "livré" || colis.status === "livre");

  const retraitStep = colis ? (isDone ? 3 : 2) : 1;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F5F3FF" }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">

      {/* ── Indicateur de progression compact ── */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#EDE9FE" }}>
        {[
          { num: 1, label: "Identifier", icon: "search-outline"          as const },
          { num: 2, label: "Vérifier",   icon: "document-text-outline"  as const },
          { num: 3, label: "Retiré",     icon: "checkmark-circle-outline" as const },
        ].map((s, i) => {
          const done   = retraitStep > s.num;
          const active = retraitStep === s.num;
          return (
            <React.Fragment key={s.num}>
              <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center",
                  backgroundColor: done ? "#059669" : active ? P : "#F3F4F6",
                  borderWidth: active ? 2 : 0, borderColor: P,
                }}>
                  {done
                    ? <Ionicons name="checkmark" size={16} color="#fff" />
                    : <Ionicons name={s.icon} size={15} color={active ? P : "#9CA3AF"} />
                  }
                </View>
                <Text style={{ fontSize: 10, fontWeight: "700", color: done ? "#059669" : active ? P : "#9CA3AF" }}>{s.label}</Text>
              </View>
              {i < 2 && <View style={{ flex: 0.3, height: 2, marginBottom: 18, backgroundColor: retraitStep > s.num ? "#059669" : "#E5E7EB" }} />}
            </React.Fragment>
          );
        })}
      </View>

      {/* ── Zone scanner : toujours visible ── */}
      <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: scanning ? P : "#E5E7EB" }}>
        {scanning && permission?.granted ? (
          <View>
            <View style={{ height: 220 }}>
              <CameraView style={{ flex: 1 }} facing="back"
                onBarcodeScanned={({ data }) => handleQR(data)} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} />
              <View style={{ position: "absolute", inset: 0, justifyContent: "center", alignItems: "center" }}>
                <View style={{ width: 160, height: 160, borderWidth: 2.5, borderColor: "#A78BFA", borderRadius: 14 }} />
              </View>
            </View>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, backgroundColor: P_LIGHT }}
              onPress={() => setScanning(false)}>
              <Feather name="x-circle" size={16} color={P} />
              <Text style={{ color: P, fontWeight: "700", fontSize: 13 }}>Fermer le scanner</Text>
            </TouchableOpacity>
          </View>
        ) : scanning && !permission?.granted ? (
          <TouchableOpacity onPress={requestPermission}
            style={{ padding: 20, alignItems: "center", gap: 8 }}>
            <Ionicons name="camera-outline" size={32} color={P} />
            <Text style={{ color: P, fontWeight: "700", fontSize: 13 }}>Autoriser la caméra</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={{ padding: 20, alignItems: "center", gap: 10 }}
            onPress={async () => {
              if (!permission?.granted) await requestPermission();
              setScanning(true);
            }}
            activeOpacity={0.75}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: P_LIGHT, justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="qr-code-outline" size={38} color={P} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>Scanner le QR du colis</Text>
            <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Touchez pour activer la caméra</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Saisie manuelle : toujours visible ── */}
      <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E5E7EB" }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9CA3AF", marginBottom: 8, letterSpacing: 0.5 }}>OU SAISIR LE CODE MANUELLEMENT</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[SS.input, { flex: 1 }]}
            placeholder="Ex: PKG-20260324-ABC"
            value={manualRef} onChangeText={setManualRef}
            autoCapitalize="characters"
            onSubmitEditing={() => search(manualRef)}
            returnKeyType="search"
          />
          <TouchableOpacity style={SS.searchBtn} onPress={() => search(manualRef)} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="search" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Feedback action effectuée ── */}
      {lastAction && (
        <View style={{ backgroundColor: "#ECFDF5", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#86EFAC", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#065F46" }}>{lastAction.label}</Text>
            {lastAction.notif && (
              <Text style={{ fontSize: 11, color: "#15803D", marginTop: 4, fontStyle: "italic" }}>"{lastAction.notif}"</Text>
            )}
          </View>
        </View>
      )}

      {/* ── Carte résultat (colis trouvé) ── */}
      {colis && (
        <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 2, borderColor: isDone ? "#86EFAC" : P, overflow: "hidden" }}>
          {/* Header coloré */}
          <View style={{ backgroundColor: isDone ? "#ECFDF5" : P_LIGHT, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: isDone ? "#065F46" : P, letterSpacing: 0.5 }}>{colis.trackingRef}</Text>
              <Text style={{ fontSize: 12, color: isDone ? "#059669" : "#6D28D9", marginTop: 2, fontWeight: "600" }}>{colis.fromCity} → {colis.toCity}</Text>
            </View>
            <StatusBadge status={colis.status} />
          </View>

          <View style={{ padding: 14, gap: 10 }}>
            {/* Delivery mode badge */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isHomeDelivery ? "#FFF7ED" : "#F0FDF4", borderRadius: 10, padding: 10 }}>
              <Ionicons name={isHomeDelivery ? "bicycle-outline" : "business-outline"} size={22} color={isHomeDelivery ? "#EA580C" : "#065F46"} />
              <Text style={{ fontSize: 13, fontWeight: "800", color: isHomeDelivery ? "#EA580C" : "#065F46" }}>
                {isHomeDelivery ? "Livraison à domicile" : "Retrait en gare"}
              </Text>
            </View>

            {/* Info essentielle : 3 lignes compactes */}
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="person-outline" size={14} color="#9CA3AF" />
                <Text style={{ fontSize: 12, color: "#6B7280", width: 90 }}>Destinataire</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#111827", flex: 1 }}>{colis.receiverName}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="call-outline" size={14} color="#9CA3AF" />
                <Text style={{ fontSize: 12, color: "#6B7280", width: 90 }}>Téléphone</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827", flex: 1 }}>{colis.receiverPhone}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="cash-outline" size={14} color="#9CA3AF" />
                <Text style={{ fontSize: 12, color: "#6B7280", width: 90 }}>Montant</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827", flex: 1 }}>{Number(colis.amount).toLocaleString()} FCFA</Text>
              </View>
            </View>

            {/* SMS preview (before action) */}
            {!isDone && na && (na.route === "retirer" || na.route === "lancer-livraison" || na.route === "deliver" || na.route === "arrive") && (
              <View style={{ backgroundColor: "#F0F9FF", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#BAE6FD" }}>
                <Text style={{ fontSize: 11, color: "#0369A1", fontWeight: "600", marginBottom: 3 }}>SMS destinataire :</Text>
                <Text style={{ fontSize: 11, color: "#0284C7", fontStyle: "italic" }}>"{getNotifMessage(na.route, colis)}"</Text>
              </View>
            )}

            {/* ── Bouton action principal ── */}
            {isDone ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#ECFDF5", borderRadius: 12, paddingVertical: 14 }}>
                <Ionicons name="checkmark-circle" size={24} color="#059669" />
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#059669" }}>Retrait effectué</Text>
              </View>
            ) : na ? (
              na.route === "retirer" ? (
                <TouchableOpacity
                  style={{ backgroundColor: na.color, borderRadius: 14, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, elevation: 4, shadowColor: na.color, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
                  onPress={() => { setPickupCode(""); setRetraitScanMode(false); lastRetraitScan.current = ""; setShowRetraitConfirm(true); }}
                  disabled={updating}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>Valider le retrait</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={{ backgroundColor: na.color, borderRadius: 14, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, elevation: 4, shadowColor: na.color, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
                  onPress={() => Alert.alert(na.label, `Confirmer pour : ${colis.trackingRef} ?`, [
                    { text: "Annuler", style: "cancel" },
                    { text: "Confirmer", onPress: () => handleAction(na) },
                  ])}
                  disabled={updating}
                >
                  {updating
                    ? <ActivityIndicator color="#fff" />
                    : <><Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{na.label}</Text><Ionicons name="arrow-forward-circle" size={20} color="#fff" /></>
                  }
                </TouchableOpacity>
              )
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12 }}>
                <Ionicons name="hourglass-outline" size={20} color="#D97706" />
                <Text style={{ fontSize: 13, color: "#D97706", fontWeight: "700" }}>En attente d'étape précédente</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Historique retraits de la session ── */}
      {recentPickups.length > 0 && (
        <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, borderColor: "#BBF7D0", overflow: "hidden" }}>
          <View style={{ backgroundColor: "#ECFDF5", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#065F46" }}>Session — Retraits effectués</Text>
            <View style={{ marginLeft: "auto", backgroundColor: "#059669", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>{recentPickups.length}</Text>
            </View>
          </View>
          {recentPickups.map((r, idx) => (
            <View key={r.ref + idx} style={{
              flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
              borderTopWidth: idx > 0 ? 1 : 0, borderColor: "#F0FDF4", gap: 10,
            }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="checkmark" size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#065F46" }}>{r.ref}</Text>
                <Text style={{ fontSize: 11, color: "#374151", marginTop: 1 }}>{r.receiver} · {r.phone}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#059669" }}>{r.amount}</Text>
                <Text style={{ fontSize: 10, color: "#9CA3AF" }}>{r.time}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Rapport */}
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#BE123C", borderRadius: 14, paddingVertical: 13, shadowColor: "#BE123C", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        onPress={() => router.push("/agent/rapport" as never)}
      >
        <Feather name="alert-triangle" size={15} color="#fff" />
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>Faire un rapport</Text>
      </TouchableOpacity>
    {/* ── Modal validation retrait : code sécurisé ── */}
    <Modal visible={showRetraitConfirm} transparent animationType="slide" onRequestClose={() => { setShowRetraitConfirm(false); setPickupCode(""); setCodeError(""); }}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 }}>

            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="shield-checkmark" size={20} color="#059669" />
                </View>
                <Text style={{ fontSize: 17, fontWeight: "900", color: "#065F46" }}>Validation sécurisée</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowRetraitConfirm(false); setPickupCode(""); setCodeError(""); }}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Colis info */}
            {colis && (
              <View style={{ backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#BBF7D0" }}>
                <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>COLIS À RETIRER</Text>
                <Text style={{ fontSize: 17, fontWeight: "900", color: "#065F46", marginTop: 2, letterSpacing: 0.5 }}>{colis.trackingRef}</Text>
                <Text style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>
                  {colis.senderName} → <Text style={{ fontWeight: "700" }}>{colis.receiverName}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{colis.receiverPhone}</Text>
              </View>
            )}

            {/* Instructions */}
            <View style={{ backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FDE68A" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400E", marginBottom: 4 }}>Instructions</Text>
              <Text style={{ fontSize: 12, color: "#78350F", lineHeight: 18 }}>
                Demandez au destinataire le <Text style={{ fontWeight: "800" }}>code de retrait à 4 chiffres</Text> reçu par SMS lors de la création du colis. Saisissez-le ci-dessous pour valider.
              </Text>
            </View>

            {/* Code input */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 }}>Code de retrait <Text style={{ color: "#DC2626" }}>*</Text></Text>
              <TextInput
                style={{
                  borderWidth: 2, borderColor: codeError ? "#DC2626" : pickupCode.length === 4 ? "#059669" : "#D1D5DB",
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
                  fontSize: 28, fontWeight: "900", color: "#111827", backgroundColor: "#F9FAFB",
                  textAlign: "center", letterSpacing: 12,
                }}
                placeholder="• • • •"
                placeholderTextColor="#D1D5DB"
                value={pickupCode}
                onChangeText={v => { setPickupCode(v.replace(/\D/g, "").slice(0, 4)); setCodeError(""); }}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleRetrait}
                autoFocus
              />
              {codeError ? (
                <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "600", marginTop: 6, textAlign: "center" }}>{codeError}</Text>
              ) : pickupCode.length === 4 ? (
                <Text style={{ fontSize: 12, color: "#059669", fontWeight: "600", marginTop: 6, textAlign: "center" }}>✓ Code complet — prêt à valider</Text>
              ) : null}
            </View>

            {/* Resend code */}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}
              onPress={handleResendCode}
              disabled={resending}
            >
              {resending
                ? <ActivityIndicator size="small" color="#6B7280" />
                : <><Feather name="refresh-cw" size={14} color="#6B7280" /><Text style={{ fontSize: 13, color: "#6B7280", fontWeight: "600" }}>Renvoyer le SMS au destinataire</Text></>
              }
            </TouchableOpacity>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#F1F5F9", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => { setShowRetraitConfirm(false); setPickupCode(""); setCodeError(""); }}
              >
                <Text style={{ fontWeight: "700", color: "#475569" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
                  pickupCode.length === 4 ? { backgroundColor: "#065F46" } : { backgroundColor: "#D1D5DB" }
                ]}
                disabled={updating || pickupCode.length < 4}
                onPress={handleRetrait}
              >
                {updating
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="shield-checkmark" size={18} color="#fff" /><Text style={{ fontWeight: "900", color: "#fff", fontSize: 15 }}>Valider le retrait</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
    </ScrollView>
  );
}

/* ═══════ Modals ═══════ */
function CityPickerModal({ visible, onClose, title, exclude, onSelect }:
  { visible: boolean; onClose(): void; title: string; exclude: string; onSelect(c: string): void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "60%", position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 }}>{title}</Text>
        <ScrollView>
          {CITIES.filter(c => c !== exclude).map(c => (
            <TouchableOpacity key={c} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: "#F3F4F6" }} onPress={() => onSelect(c)}>
              <Text style={{ fontSize: 15, color: "#374151" }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ListPickerModal({ visible, onClose, title, items, onSelect }:
  { visible: boolean; onClose(): void; title: string; items: string[]; onSelect(v: string): void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "60%", position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 }}>{title}</Text>
        <ScrollView>
          {items.map(i => (
            <TouchableOpacity key={i} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: "#F3F4F6" }} onPress={() => onSelect(i)}>
              <Text style={{ fontSize: 15, color: "#374151" }}>{i}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ═══════ StyleSheets ═══════ */
const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: P_DARK },
  header: { backgroundColor: P_DARK, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { backgroundColor: P, borderRadius: 10, padding: 8 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSub: { color: "#DDD6FE", fontSize: 12, marginTop: 1 },
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  tabs: { flexDirection: "row", backgroundColor: "#3B0764", borderBottomWidth: 1, borderColor: "#4C1D95" },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", gap: 3 },
  tabBtnActive: { borderBottomWidth: 3, borderColor: "#fff" },
  tabTxt: { fontSize: 10, color: "#C4B5FD", fontWeight: "600" },
  tabTxtActive: { color: "#fff", fontWeight: "800" },
});

const SC = StyleSheet.create({
  content:  { padding: 16, gap: 14, paddingBottom: 32 },
  card:     { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  label:    { fontSize: 13, fontWeight: "500", color: "#374151" },
  input:    { borderWidth: 1.5, borderColor: "#DDD6FE", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: P_LIGHT, color: "#111827" },
  pickerBtn:{ borderWidth: 1.5, borderColor: "#DDD6FE", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: P_LIGHT, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerTxt:{ fontSize: 14, color: "#111827", fontWeight: "600" },
  optBtn:   { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: "#DDD6FE", borderRadius: 10 },
  optBtnSel:{ borderColor: P, backgroundColor: P_LIGHT },
  optTxt:   { fontSize: 13, color: "#6B7280" },
  optTxtSel:{ color: P, fontWeight: "700" },
  submitBtn:{ backgroundColor: P, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 14, elevation: 3, shadowColor: P, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  submitTxt:{ color: "#fff", fontSize: 16, fontWeight: "700" },
});

const SL = StyleSheet.create({
  chip:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#DDD6FE", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 5 },
  chipActive: { backgroundColor: P, borderColor: P },
  chipTxt:    { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  chipTxtActive: { color: "#fff" },
  card:       { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 3, shadowColor: "#0B3C5D", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, gap: 10, overflow: "hidden" },
  cardTop:    { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ref:        { fontSize: 15, fontWeight: "800", color: P, letterSpacing: -0.2 },
  route:      { fontSize: 12, color: "#374151", fontWeight: "600" },
  names:      { fontSize: 11, color: "#9CA3AF" },
  meta:       { flexDirection: "row", justifyContent: "space-between" },
  metaTxt:    { fontSize: 12, color: "#6B7280" },
  actionBtn:  { borderWidth: 1.5, borderRadius: 11, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  actionTxt:  { fontSize: 13, fontWeight: "700" },
});

const SS = StyleSheet.create({
  card:       { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle:  { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 10 },
  input:      { borderWidth: 1.5, borderColor: "#DDD6FE", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: P_LIGHT, color: "#111827" },
  searchBtn:  { backgroundColor: P, borderRadius: 10, width: 48, alignItems: "center", justifyContent: "center" },
  scanToggle: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: P, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  scanToggleActive: { backgroundColor: P },
  scanToggleTxt: { fontSize: 12, fontWeight: "700", color: P },
  resultCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 2, borderColor: P, gap: 8, elevation: 3 },
  updateBtn:  { borderWidth: 2, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  updateTxt:  { fontSize: 14, fontWeight: "700" },
});
