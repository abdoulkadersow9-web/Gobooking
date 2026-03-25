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
  en_attente:    { label: "En attente",     color: "#6B7280", bg: "#F3F4F6" },
  en_gare:       { label: "En gare",        color: "#D97706", bg: "#FEF3C7" },
  "chargé_bus":  { label: "Chargé bus",     color: "#7C3AED", bg: "#EDE9FE" },
  en_transit:    { label: "En transit",     color: "#2563EB", bg: "#DBEAFE" },
  arrivé:        { label: "Arrivé",         color: G,         bg: "#D1FAE5" },
  en_livraison:  { label: "En livraison 🛵",color: "#EA580C", bg: "#FFF7ED" },
  livré:         { label: "Livré ✓",        color: "#065F46", bg: "#ECFDF5" },
  livre:         { label: "Livré ✓",        color: "#065F46", bg: "#ECFDF5" },
  retiré:        { label: "Retiré ✓",       color: "#065F46", bg: "#ECFDF5" },
  annulé:        { label: "Annulé",         color: "#DC2626", bg: "#FEE2E2" },
  arrive_gare_depart: { label: "Arrivé gare", color: G,       bg: "#D1FAE5" },
};

type NextAction = { label: string; route: string; color: string };

function getNextAction(parcel: Parcel): NextAction | null {
  const s = parcel.status;
  const isHomeDelivery = parcel.deliveryType === "livraison_domicile";
  if (s === "créé" || s === "en_attente")
    return { label: "Enregistrer en gare", route: "en-gare",          color: "#D97706" };
  if (s === "en_gare" || s === "arrive_gare_depart")
    return { label: "Charger dans bus",    route: "charge-bus",        color: P };
  if (s === "chargé_bus")
    return { label: "Déclarer en transit", route: "transit",           color: "#2563EB" };
  if (s === "en_transit")
    return { label: "Confirmer arrivée",   route: "arrive",            color: G };
  if (s === "arrivé") {
    if (isHomeDelivery)
      return { label: "🛵 Lancer livraison", route: "lancer-livraison", color: "#EA580C" };
    return { label: "✅ Retrait en gare",  route: "retirer",           color: "#065F46" };
  }
  if (s === "en_livraison")
    return { label: "✅ Marquer comme livré", route: "deliver",         color: "#065F46" };
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

type TabType = "creer" | "liste" | "scanner";

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
  const [tab, setTab]           = useState<TabType>("creer");

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
        {(["creer", "liste", "scanner"] as TabType[]).map(t => (
          <TouchableOpacity key={t} style={[S.tabBtn, tab === t && S.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[S.tabTxt, tab === t && S.tabTxtActive]}>
              {t === "creer" ? "➕ Créer" : t === "liste" ? "📋 Liste" : "📷 Scanner"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "creer"   && <CreateTab token={token} networkStatus={networkStatus} />}
      {tab === "liste"   && <ListTab   token={token} />}
      {tab === "scanner" && <ScannerTab token={token} networkStatus={networkStatus} />}
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
function ListTab({ token }: { token: string | null }) {
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

  const FILTERS = ["tous", "créé", "en_gare", "chargé_bus", "en_transit", "arrivé", "en_livraison", "retiré", "livré"];

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 52 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: "center" }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[SL.chip, filter === f && SL.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[SL.chipTxt, filter === f && SL.chipTxtActive]}>
              {f === "tous" ? "Tous" : (STATUSES[f]?.label ?? f)}
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
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        {parcels.map(p => {
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
   TAB 3 — Scanner / Tracker
   ═══════════════════════════════════════════ */
function ScannerTab({ token, networkStatus }: { token: string | null; networkStatus: any }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning]   = useState(false);
  const [manualRef, setManualRef] = useState("");
  const [colis, setColis]         = useState<Parcel | null>(null);
  const [loading, setLoading]     = useState(false);
  const [updating, setUpdating]   = useState(false);
  const lastScan = useRef<string>("");

  const search = async (ref: string) => {
    if (!ref.trim()) { Alert.alert("Erreur", "Entrez un numéro de suivi."); return; }
    setLoading(true);
    setColis(null);
    try {
      const res = await apiFetch<Parcel>(`/parcels/track/${ref.trim()}`, { token: token ?? undefined });
      setColis(res);
    } catch {
      Alert.alert("Introuvable", `Aucun colis trouvé pour : ${ref.trim()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQR = (data: string) => {
    if (data === lastScan.current) return;
    lastScan.current = data;
    setScanning(false);
    const qr = validateQR(data);
    const ref = qr?.ref ?? data;
    setManualRef(ref);
    search(ref);
  };

  const handleStatusUpdate = async () => {
    if (!colis) return;
    const next = getNextAction(colis);
    if (!next) { Alert.alert("Info", "Ce colis ne peut plus être mis à jour."); return; }
    Alert.alert(next.label, `Confirmer pour : ${colis.trackingRef} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", onPress: async () => {
        setUpdating(true);
        try {
          await apiFetch(`/agent/parcels/${colis.id}/${next.route}`, { token: token ?? undefined, method: "POST", body: {} });
          await search(colis.trackingRef);
        } catch (e: any) {
          Alert.alert("Erreur", e?.message ?? "Mise à jour impossible.");
        } finally {
          setUpdating(false);
        }
      }},
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F5F3FF" }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      {/* Scanner cam */}
      <View style={SS.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={SS.cardTitle}>Scanner un QR code</Text>
          <TouchableOpacity style={[SS.scanToggle, scanning && SS.scanToggleActive]}
            onPress={async () => {
              if (!permission?.granted) await requestPermission();
              setScanning(v => !v);
            }}>
            <Feather name="camera" size={16} color={scanning ? "#fff" : P} />
            <Text style={[SS.scanToggleTxt, scanning && { color: "#fff" }]}>{scanning ? "Fermer" : "Ouvrir caméra"}</Text>
          </TouchableOpacity>
        </View>
        {scanning && permission?.granted && (
          <View style={{ height: 220, borderRadius: 12, overflow: "hidden" }}>
            <CameraView style={{ flex: 1 }} facing="back"
              onBarcodeScanned={({ data }) => handleQR(data)} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} />
            <View style={{ position: "absolute", inset: 0, justifyContent: "center", alignItems: "center" }}>
              <View style={{ width: 160, height: 160, borderWidth: 2, borderColor: "#fff", borderRadius: 12 }} />
            </View>
          </View>
        )}
        {scanning && !permission?.granted && (
          <TouchableOpacity onPress={requestPermission} style={{ padding: 12, alignItems: "center" }}>
            <Text style={{ color: P }}>Autoriser l'accès à la caméra</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Manual search */}
      <View style={SS.card}>
        <Text style={SS.cardTitle}>Recherche par référence</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput style={[SS.input, { flex: 1 }]} placeholder="Ex: PKG-20260324-ABC"
            value={manualRef} onChangeText={setManualRef} autoCapitalize="characters" />
          <TouchableOpacity style={SS.searchBtn} onPress={() => search(manualRef)} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="search" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Result */}
      {colis && (
        <View style={SS.resultCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: P }}>{colis.trackingRef}</Text>
              <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{colis.fromCity} → {colis.toCity}</Text>
            </View>
            <StatusBadge status={colis.status} />
          </View>
          {[
            { label: "Expéditeur",   val: `${colis.senderName} · ${colis.senderPhone}` },
            { label: "Destinataire", val: `${colis.receiverName} · ${colis.receiverPhone}` },
            { label: "Type",         val: colis.parcelType },
            { label: "Montant",      val: `${Number(colis.amount).toLocaleString()} FCFA` },
          ].map(r => (
            <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderColor: "#EDE9FE" }}>
              <Text style={{ fontSize: 13, color: "#6B7280" }}>{r.label}</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#111827", flexShrink: 1, textAlign: "right" }}>{r.val}</Text>
            </View>
          ))}
          {(() => {
            const na = getNextAction(colis);
            return na ? (
              <TouchableOpacity
                style={[SS.updateBtn, { borderColor: na.color, backgroundColor: na.color + "15" }]}
                onPress={handleStatusUpdate} disabled={updating}>
                {updating ? <ActivityIndicator size="small" color={na.color} /> : (
                  <Text style={[SS.updateTxt, { color: na.color }]}>{na.label}</Text>
                )}
              </TouchableOpacity>
            ) : null;
          })()}
        </View>
      )}
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
