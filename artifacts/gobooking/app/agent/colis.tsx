import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform,
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
  créé:          { label: "Créé",           color: "#6B7280", bg: "#F3F4F6" },
  cree:          { label: "Créé",           color: "#6B7280", bg: "#F3F4F6" },
  en_attente:    { label: "En attente",     color: "#6B7280", bg: "#F3F4F6" },
  en_gare:       { label: "En gare",        color: "#D97706", bg: "#FEF3C7" },
  "chargé_bus":  { label: "Chargé bus",     color: "#7C3AED", bg: "#EDE9FE" },
  en_transit:    { label: "En transit",     color: "#2563EB", bg: "#DBEAFE" },
  en_route:      { label: "En route",       color: "#2563EB", bg: "#DBEAFE" },
  arrivé:        { label: "Arrivé ✅",      color: G,         bg: "#D1FAE5" },
  arrive:        { label: "Arrivé ✅",      color: G,         bg: "#D1FAE5" },
  en_livraison:  { label: "En livraison 🛵",color: "#EA580C", bg: "#FFF7ED" },
  livré:         { label: "Livré ✓",        color: "#065F46", bg: "#ECFDF5" },
  livre:         { label: "Livré ✓",        color: "#065F46", bg: "#ECFDF5" },
  retiré:        { label: "Retiré ✓",       color: "#065F46", bg: "#ECFDF5" },
  retire:        { label: "Retiré ✓",       color: "#065F46", bg: "#ECFDF5" },
  annulé:        { label: "Annulé",         color: "#DC2626", bg: "#FEE2E2" },
  arrive_gare_depart: { label: "Arrivé gare", color: G,       bg: "#D1FAE5" },
};

type NextAction = { label: string; route: string; color: string };

function getNextAction(parcel: Parcel): NextAction | null {
  const s = parcel.status;
  const isHomeDelivery = parcel.deliveryType === "livraison_domicile";
  if (s === "créé" || s === "cree" || s === "en_attente")
    return { label: "📋 Enregistrer en gare", route: "en-gare",       color: "#D97706" };
  if (s === "en_gare" || s === "arrive_gare_depart")
    return { label: "🚌 Charger dans bus",     route: "charge-bus",    color: P };
  if (s === "chargé_bus")
    return { label: "🔄 Déclarer en transit",  route: "transit",       color: "#2563EB" };
  if (s === "en_transit" || s === "en_route")
    return { label: "📍 Confirmer arrivée",    route: "arrive",        color: G };
  if (s === "arrivé" || s === "arrive") {
    if (isHomeDelivery)
      return { label: "🛵 Lancer la livraison", route: "lancer-livraison", color: "#EA580C" };
    return { label: "✅ Retirer en gare",       route: "retirer",          color: "#065F46" };
  }
  if (s === "en_livraison")
    return { label: "✅ Confirmer livraison",   route: "deliver",      color: "#065F46" };
  return null;
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

type TabType = "creer" | "liste" | "retrait";

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
        <Text style={{ fontSize: 48 }}>🔒</Text>
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
            <Text style={S.headerTitle}>📦 Gestion Colis</Text>
            <Text style={S.headerSub}>{networkStatus.isOnline ? "Créer · Recevoir · Suivre" : "⚡ Hors ligne"}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={S.logoutBtn}>
          <Text style={S.logoutTxt}>Déco.</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={S.tabs}>
        {(["retrait", "liste", "creer"] as TabType[]).map(t => (
          <TouchableOpacity key={t} style={[S.tabBtn, tab === t && S.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[S.tabTxt, tab === t && S.tabTxtActive]}>
              {t === "retrait" ? "📦 Retrait" : t === "liste" ? "📋 Liste" : "➕ Créer"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "retrait" && <RetraitTab token={token} networkStatus={networkStatus} />}
      {tab === "liste"   && <ListTab   token={token} setTab={setTab} />}
      {tab === "creer"   && <CreateTab token={token} networkStatus={networkStatus} />}
    </SafeAreaView>
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
}

function buildLabelHtml(p: CreatedParcel): string {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(p.trackingRef)}`;
  const deliveryLabel = p.deliveryType === "livraison_domicile" ? "🛵 Livraison à domicile" : "🏢 Retrait en gare";
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
    <div class="brand">📦 GoBooking Colis</div>
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

  const handleCreate = async () => {
    if (!senderName.trim())   { Alert.alert("Erreur", "Entrez le nom de l'expéditeur."); return; }
    if (!senderPhone.trim())  { Alert.alert("Erreur", "Entrez le téléphone de l'expéditeur."); return; }
    if (!receiverName.trim()) { Alert.alert("Erreur", "Entrez le nom du destinataire."); return; }
    if (!receiverPhone.trim()){ Alert.alert("Erreur", "Entrez le téléphone du destinataire."); return; }
    if (!amount.trim() || isNaN(Number(amount))) { Alert.alert("Erreur", "Entrez un montant valide."); return; }
    if (fromCity === toCity)  { Alert.alert("Erreur", "Ville de départ et d'arrivée identiques."); return; }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ trackingRef?: string; id?: string }>("/agent/parcels", {
        token: token ?? undefined, method: "POST",
        body: { fromCity, toCity, senderName: senderName.trim(), senderPhone: senderPhone.trim(),
          receiverName: receiverName.trim(), receiverPhone: receiverPhone.trim(),
          parcelType, weight: weight.trim(), amount: Number(amount), paymentMethod, deliveryType },
      });
      setCreated({
        trackingRef: res.trackingRef ?? res.id ?? "—",
        senderName: senderName.trim(), senderPhone: senderPhone.trim(),
        receiverName: receiverName.trim(), receiverPhone: receiverPhone.trim(),
        fromCity, toCity, parcelType, weight: weight.trim(),
        amount: Number(amount), deliveryType,
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

  const reset = () => {
    setCreated(null); setSenderName(""); setSenderPhone("");
    setReceiverName(""); setReceiverPhone(""); setWeight(""); setAmount("");
  };

  const handlePrint = async () => {
    if (!created) return;
    setPrinting(true);
    await printLabel(created);
    setPrinting(false);
  };

  if (created) {
    return (
      <ScrollView contentContainerStyle={[SC.content, { alignItems: "center", paddingTop: 40 }]}>
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

        <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 10 }}>Transmettez ce numéro à l'expéditeur.</Text>

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
          <Text style={SC.label}>Ville de départ</Text>
          <TouchableOpacity style={SC.pickerBtn} onPress={() => setShowFromPicker(true)}>
            <Text style={SC.pickerTxt}>{fromCity}</Text>
            <Ionicons name="chevron-down" size={16} color={P} />
          </TouchableOpacity>
          <Text style={SC.label}>Ville d'arrivée</Text>
          <TouchableOpacity style={SC.pickerBtn} onPress={() => setShowToPicker(true)}>
            <Text style={SC.pickerTxt}>{toCity}</Text>
            <Ionicons name="chevron-down" size={16} color={P} />
          </TouchableOpacity>
        </View>

        {/* Expéditeur */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="person-outline" size={18} color={P} /><Text style={SC.cardTitle}>Expéditeur</Text></View>
          <Text style={SC.label}>Nom *</Text>
          <TextInput style={SC.input} placeholder="Ex: Konan Yao" value={senderName} onChangeText={setSenderName} />
          <Text style={SC.label}>Téléphone *</Text>
          <TextInput style={SC.input} placeholder="Ex: 07 01 23 45 67" value={senderPhone}
            onChangeText={setSenderPhone} keyboardType="phone-pad" />
        </View>

        {/* Destinataire */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="person-add-outline" size={18} color={P} /><Text style={SC.cardTitle}>Destinataire</Text></View>
          <Text style={SC.label}>Nom *</Text>
          <TextInput style={SC.input} placeholder="Ex: Bamba Awa" value={receiverName} onChangeText={setReceiverName} />
          <Text style={SC.label}>Téléphone *</Text>
          <TextInput style={SC.input} placeholder="Ex: 05 05 99 88 77" value={receiverPhone}
            onChangeText={setReceiverPhone} keyboardType="phone-pad" />
        </View>

        {/* Détails colis */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="cube-outline" size={18} color={P} /><Text style={SC.cardTitle}>Détails du colis</Text></View>
          <Text style={SC.label}>Type de colis</Text>
          <TouchableOpacity style={SC.pickerBtn} onPress={() => setShowTypePicker(true)}>
            <Text style={SC.pickerTxt}>{parcelType}</Text>
            <Ionicons name="chevron-down" size={16} color={P} />
          </TouchableOpacity>
          <Text style={SC.label}>Poids (kg)</Text>
          <TextInput style={SC.input} placeholder="Ex: 2.5" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          <Text style={SC.label}>Montant (FCFA) *</Text>
          <TextInput style={SC.input} placeholder="Ex: 2500" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
        </View>

        {/* Livraison */}
        <View style={SC.card}>
          <View style={SC.cardHeader}><Ionicons name="home-outline" size={18} color={P} /><Text style={SC.cardTitle}>Mode de livraison</Text></View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {DELIVERY_TYPES.map(d => (
              <TouchableOpacity key={d.key} style={[SC.optBtn, deliveryType === d.key && SC.optBtnSel]}
                onPress={() => setDeliveryType(d.key)}>
                <Text style={[SC.optTxt, deliveryType === d.key && SC.optTxtSel]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
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

  const FILTERS = ["tous", "⚡ Action", "créé", "en_gare", "chargé_bus", "en_transit", "arrivé", "en_livraison", "retiré", "livré"];

  const parcelsNeedingAction = parcels.filter(p => getNextAction(p) !== null && (p.status === "arrivé" || p.status === "arrive" || p.status === "en_livraison"));
  const displayedParcels = filter === "⚡ Action"
    ? parcels.filter(p => getNextAction(p) !== null)
    : filter !== "tous"
      ? parcels.filter(p => p.status === filter)
      : parcels;

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      {/* Action needed banner */}
      {filter === "tous" && parcelsNeedingAction.length > 0 && (
        <TouchableOpacity onPress={() => setFilter("⚡ Action")}
          style={{ margin: 12, marginBottom: 4, backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: "#FCD34D" }}>
          <Ionicons name="flash" size={18} color="#D97706" />
          <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#D97706" }}>
            {parcelsNeedingAction.length} colis en attente d'action (retrait/livraison)
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#D97706" />
        </TouchableOpacity>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 52 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: "center" }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[SL.chip, filter === f && SL.chipActive, f === "⚡ Action" && { borderColor: "#D97706", backgroundColor: filter === f ? "#D97706" : "#FFFBEB" }]} onPress={() => setFilter(f)}>
            <Text style={[SL.chipTxt, filter === f && SL.chipTxtActive, f === "⚡ Action" && filter !== f && { color: "#D97706" }]}>
              {f === "tous" ? "Tous" : f === "⚡ Action" ? "⚡ Action" : (STATUSES[f]?.label ?? f)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator color={P} style={{ marginTop: 24 }} />}
      {!loading && parcels.length === 0 && (
        <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
          <Text style={{ fontSize: 36 }}>📦</Text>
          <Text style={{ fontSize: 15, color: "#9CA3AF" }}>Aucun colis trouvé</Text>
          <TouchableOpacity onPress={load}><Text style={{ color: P, fontWeight: "600" }}>Actualiser</Text></TouchableOpacity>
        </View>
      )}
      {!loading && displayedParcels.length === 0 && parcels.length > 0 && (
        <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
          <Text style={{ fontSize: 36 }}>📦</Text>
          <Text style={{ fontSize: 15, color: "#9CA3AF" }}>Aucun colis pour ce filtre</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        {displayedParcels.map(p => {
          const nextAction = getNextAction(p);
          return (
            <View key={p.id} style={SL.card}>
              <View style={SL.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={SL.ref}>{p.trackingRef}</Text>
                  <Text style={SL.route}>{p.fromCity} → {p.toCity}</Text>
                  <Text style={SL.names}>{p.senderName} → {p.receiverName}</Text>
                </View>
                <StatusBadge status={p.status} />
              </View>
              <View style={SL.meta}>
                <Text style={SL.metaTxt}>{p.parcelType} {p.weight ? `· ${p.weight}kg` : ""}</Text>
                <Text style={SL.metaTxt}>{Number(p.amount).toLocaleString()} FCFA</Text>
              </View>
              {/* Delivery type badge */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ backgroundColor: p.deliveryType === "livraison_domicile" ? "#FFF7ED" : "#F0FDF4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: p.deliveryType === "livraison_domicile" ? "#EA580C" : "#065F46" }}>
                    {p.deliveryType === "livraison_domicile" ? "🛵 Domicile" : "🏠 Gare"}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {nextAction && (
                  <TouchableOpacity
                    style={[SL.actionBtn, { borderColor: nextAction.color, flex: 1 }]}
                    onPress={() => handleStatusUpdate(p)}
                    disabled={updating === p.id}
                  >
                    {updating === p.id ? <ActivityIndicator size="small" color={nextAction.color} /> : (
                      <Text style={[SL.actionTxt, { color: nextAction.color }]}>
                        {nextAction.label}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[SL.actionBtn, { borderColor: "#7C3AED", paddingHorizontal: 12 }]}
                  onPress={() => printLabel({
                    trackingRef: p.trackingRef,
                    senderName: p.senderName, senderPhone: p.senderPhone,
                    receiverName: p.receiverName, receiverPhone: p.receiverPhone,
                    fromCity: p.fromCity, toCity: p.toCity,
                    parcelType: p.parcelType, weight: p.weight ? String(p.weight) : "",
                    amount: p.amount, deliveryType: p.deliveryType ?? "livraison_gare",
                  })}
                >
                  <Ionicons name="print-outline" size={16} color="#7C3AED" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    const ref = qr?.ref ?? data;
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

  const na = colis ? getNextAction(colis) : null;
  const isHomeDelivery = colis?.deliveryType === "livraison_domicile";
  const isDone = colis && (colis.status === "retiré" || colis.status === "retire" || colis.status === "livré" || colis.status === "livre");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F5F3FF" }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">

      {/* STEP 1: Scan / Search */}
      <View style={SS.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={SS.cardTitle}>🔍 Identifier le colis</Text>
          <TouchableOpacity style={[SS.scanToggle, scanning && SS.scanToggleActive]}
            onPress={async () => {
              if (!permission?.granted) await requestPermission();
              setScanning(v => !v);
            }}>
            <Feather name="camera" size={15} color={scanning ? "#fff" : P} />
            <Text style={[SS.scanToggleTxt, scanning && { color: "#fff" }]}>{scanning ? "Fermer" : "Scanner QR"}</Text>
          </TouchableOpacity>
        </View>

        {scanning && permission?.granted && (
          <View style={{ height: 200, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
            <CameraView style={{ flex: 1 }} facing="back"
              onBarcodeScanned={({ data }) => handleQR(data)} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} />
            <View style={{ position: "absolute", inset: 0, justifyContent: "center", alignItems: "center" }}>
              <View style={{ width: 150, height: 150, borderWidth: 2.5, borderColor: "#A78BFA", borderRadius: 12 }} />
              <Text style={{ color: "#fff", fontSize: 11, marginTop: 8, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
                Pointez vers le QR du colis
              </Text>
            </View>
          </View>
        )}
        {scanning && !permission?.granted && (
          <TouchableOpacity onPress={requestPermission} style={{ padding: 14, alignItems: "center", backgroundColor: P_LIGHT, borderRadius: 10 }}>
            <Text style={{ color: P, fontWeight: "600" }}>Autoriser l'accès à la caméra</Text>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginTop: scanning ? 8 : 0 }}>
          <TextInput style={[SS.input, { flex: 1 }]} placeholder="Code colis (ex: PKG-20260324-ABC)"
            value={manualRef} onChangeText={setManualRef} autoCapitalize="characters"
            onSubmitEditing={() => search(manualRef)} returnKeyType="search" />
          <TouchableOpacity style={SS.searchBtn} onPress={() => search(manualRef)} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="search" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Notification sent feedback */}
      {lastAction && (
        <View style={{ backgroundColor: "#F0FDF4", borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: "#86EFAC", gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#16A34A" }}>Action effectuée : {lastAction.label}</Text>
          </View>
          {lastAction.notif && (
            <View style={{ backgroundColor: "#DCFCE7", borderRadius: 8, padding: 10, marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: "#166534", fontWeight: "600", marginBottom: 3 }}>📱 SMS envoyé au client :</Text>
              <Text style={{ fontSize: 12, color: "#15803D", fontStyle: "italic" }}>"{lastAction.notif}"</Text>
              <Text style={{ fontSize: 10, color: "#86EFAC", marginTop: 4 }}>→ {colis?.receiverPhone}</Text>
            </View>
          )}
        </View>
      )}

      {/* STEP 2: Colis result card */}
      {colis && (
        <View style={[SS.resultCard, isDone && { borderColor: "#86EFAC" }]}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: P }}>{colis.trackingRef}</Text>
              <Text style={{ fontSize: 13, color: "#374151", fontWeight: "600", marginTop: 2 }}>{colis.fromCity} → {colis.toCity}</Text>
            </View>
            <StatusBadge status={colis.status} />
          </View>

          {/* Delivery mode badge (prominent) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: isHomeDelivery ? "#FFF7ED" : "#F0FDF4", borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <Text style={{ fontSize: 20 }}>{isHomeDelivery ? "🛵" : "🏢"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: isHomeDelivery ? "#EA580C" : "#065F46" }}>
                {isHomeDelivery ? "Livraison à domicile" : "Retrait en gare"}
              </Text>
              <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>
                {isHomeDelivery ? "Le client attend une livraison chez lui" : "Le client vient chercher en gare"}
              </Text>
            </View>
          </View>

          {/* Parcel details */}
          {[
            { icon: "person-outline" as const, label: "Expéditeur",   val: `${colis.senderName}` },
            { icon: "person-add-outline" as const, label: "Destinataire", val: `${colis.receiverName}` },
            { icon: "call-outline" as const,    label: "Tél. destinataire", val: colis.receiverPhone },
            { icon: "cube-outline" as const,    label: "Type",         val: colis.parcelType },
            { icon: "cash-outline" as const,    label: "Montant",      val: `${Number(colis.amount).toLocaleString()} FCFA` },
          ].map(r => (
            <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: "#EDE9FE" }}>
              <Ionicons name={r.icon} size={15} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: "#6B7280", width: 110 }}>{r.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#111827", flex: 1 }}>{r.val}</Text>
            </View>
          ))}

          {/* Done state */}
          {isDone && (
            <View style={{ alignItems: "center", paddingTop: 14, gap: 4 }}>
              <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#16A34A" }}>Colis finalisé</Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>Aucune action supplémentaire requise</Text>
            </View>
          )}

          {/* Action button(s) */}
          {!isDone && na && (
            <View style={{ marginTop: 12, gap: 10 }}>
              {/* Notification preview */}
              {(na.route === "retirer" || na.route === "lancer-livraison" || na.route === "deliver" || na.route === "arrive") && (
                <View style={{ backgroundColor: "#F0F9FF", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#BAE6FD" }}>
                  <Text style={{ fontSize: 11, color: "#0369A1", fontWeight: "600" }}>📱 SMS sera envoyé au destinataire ({colis.receiverPhone}) :</Text>
                  <Text style={{ fontSize: 11, color: "#0284C7", marginTop: 3, fontStyle: "italic" }}>
                    "{getNotifMessage(na.route, colis)}"
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={{ backgroundColor: na.color, borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, elevation: 3, shadowColor: na.color, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}
                onPress={() => {
                  Alert.alert(na.label, `Confirmer pour : ${colis.trackingRef} ?`, [
                    { text: "Annuler", style: "cancel" },
                    { text: "Confirmer", onPress: () => handleAction(na) },
                  ]);
                }}
                disabled={updating}
              >
                {updating
                  ? <ActivityIndicator color="#fff" />
                  : <><Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{na.label}</Text><Ionicons name="arrow-forward-circle" size={20} color="#fff" /></>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* No action but not done */}
          {!isDone && !na && (
            <View style={{ alignItems: "center", paddingTop: 10, gap: 4 }}>
              <Ionicons name="hourglass-outline" size={28} color="#D97706" />
              <Text style={{ fontSize: 13, color: "#D97706", fontWeight: "600" }}>En attente d'étape précédente</Text>
              <Text style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>Ce colis doit d'abord passer par une autre étape (chargement, transit…)</Text>
            </View>
          )}
        </View>
      )}

      {/* Workflow guide */}
      <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: "#E5E7EB" }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 4 }}>📋 Flux de suivi colis</Text>
        {[
          { icon: "📝", step: "1. Créé",          desc: "Colis enregistré" },
          { icon: "🏢", step: "2. En gare",        desc: "Déposé à la gare de départ" },
          { icon: "🚌", step: "3. Chargé bus",     desc: "Mis dans le bus" },
          { icon: "🔄", step: "4. En transit",     desc: "En route vers destination" },
          { icon: "📍", step: "5. Arrivé ✅",      desc: "À destination → SMS client" },
          { icon: "✅", step: "6a. Retiré",        desc: "(Gare) Client vient chercher → SMS" },
          { icon: "🛵", step: "6b. En livraison",  desc: "(Domicile) Livreur part → SMS" },
          { icon: "🎁", step: "7b. Livré",         desc: "Livraison confirmée → SMS" },
        ].map(s => (
          <View key={s.step} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Text style={{ fontSize: 14, width: 22 }}>{s.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151" }}>{s.step}</Text>
              <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{s.desc}</Text>
            </View>
          </View>
        ))}
      </View>
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
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  logoutTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },
  tabs: { flexDirection: "row", backgroundColor: "#3B0764" },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 3, borderColor: "#A78BFA" },
  tabTxt: { fontSize: 13, color: "#DDD6FE", fontWeight: "600" },
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
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#DDD6FE", backgroundColor: "#fff" },
  chipActive: { backgroundColor: P, borderColor: P },
  chipTxt:    { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  chipTxtActive: { color: "#fff" },
  card:       { backgroundColor: "#fff", borderRadius: 14, padding: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, gap: 8 },
  cardTop:    { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ref:        { fontSize: 14, fontWeight: "800", color: P },
  route:      { fontSize: 12, color: "#374151", fontWeight: "600", marginTop: 2 },
  names:      { fontSize: 11, color: "#6B7280", marginTop: 2 },
  meta:       { flexDirection: "row", justifyContent: "space-between" },
  metaTxt:    { fontSize: 12, color: "#6B7280" },
  actionBtn:  { borderWidth: 1.5, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
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
