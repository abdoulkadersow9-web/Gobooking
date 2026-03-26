import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform,
  Modal, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus } from "@/utils/offline";
import { validateQR, qrErrorMessage } from "@/utils/qr";
import OfflineBanner from "@/components/OfflineBanner";

const G = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK = "#065F46";
const G_MID = "#D1FAE5";

const STATUSES = {
  créé:        { label: "Créé",         color: "#6B7280", bg: "#F3F4F6", icon: "cube-outline" },
  en_gare:     { label: "En gare",      color: "#D97706", bg: "#FEF3C7", icon: "business-outline" },
  chargé_bus:  { label: "Chargé bus",   color: "#7C3AED", bg: "#EDE9FE", icon: "bus-outline" },
  en_transit:  { label: "En transit",   color: "#2563EB", bg: "#DBEAFE", icon: "navigate-outline" },
  arrivé:      { label: "Arrivé",       color: "#059669", bg: "#D1FAE5", icon: "location-outline" },
  livré:       { label: "Livré ✓",      color: "#065F46", bg: "#ECFDF5", icon: "checkmark-circle" },
  retiré:      { label: "Retiré ✓",     color: "#065F46", bg: "#ECFDF5", icon: "hand-left-outline" },
  annulé:      { label: "Annulé",       color: "#DC2626", bg: "#FEE2E2", icon: "close-circle-outline" },
  en_attente:  { label: "En attente",   color: "#6B7280", bg: "#F3F4F6", icon: "time-outline" },
  livre:       { label: "Livré ✓",      color: "#065F46", bg: "#ECFDF5", icon: "checkmark-circle" },
  arrive_gare_depart: { label: "Arrivé gare", color: "#059669", bg: "#D1FAE5", icon: "location-outline" },
} as const;

const NEXT_ACTION: Record<string, { label: string; route: string; icon: string; color: string }> = {
  créé:       { label: "Enregistrer en gare",  route: "en-gare",    icon: "business",        color: "#D97706" },
  en_attente: { label: "Enregistrer en gare",  route: "en-gare",    icon: "business",        color: "#D97706" },
  en_gare:    { label: "Charger dans bus",      route: "charge-bus", icon: "bus",             color: "#7C3AED" },
  chargé_bus: { label: "Déclarer en transit",   route: "transit",    icon: "navigate",        color: "#2563EB" },
  en_transit: { label: "Confirmer arrivée",     route: "arrive",     icon: "location",        color: G },
  arrivé:     { label: "Confirmer livraison",   route: "deliver",    icon: "checkmark-circle",color: G_DARK },
  arrive_gare_depart: { label: "Charger dans bus", route: "charge-bus", icon: "bus",          color: "#7C3AED" },
};

const CITIES = [
  "Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pedro",
  "Daloa", "Man", "Gagnoa", "Divo", "Abengourou", "Soubré", "Bondoukou",
];
const PARCEL_TYPES = ["Documents", "Colis standard", "Fragile", "Alimentaire", "Électronique", "Vêtements", "Autre"];
const DELIVERY_TYPES = [
  { key: "livraison_gare", label: "Retrait en gare" },
  { key: "livraison_domicile", label: "Livraison à domicile" },
];
const PAYMENT_METHODS = ["orange", "mtn", "wave", "cash"];

interface Parcel {
  id: string;
  trackingRef: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  description?: string;
  weight?: number;
  status: string;
  fromCity: string;
  toCity: string;
  busId?: string | null;
  tripId?: string | null;
  companyId?: string | null;
  amount?: number;
  createdAt?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUSES[status as keyof typeof STATUSES] ?? STATUSES.en_attente;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon as any} size={11} color={s.color} />
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
};

export default function ReceptionColisScreen() {
  const { user, token } = useAuth();
  const networkStatus = useNetworkStatus(BASE_URL);
  const [activeTab, setActiveTab] = useState<"creer" | "retrait" | "gerer" | "liste">("creer");

  if (user && user.role !== "agent") {
    return (
      <SafeAreaView style={styles.denied}>
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text style={styles.deniedText}>Accès réservé aux agents</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />
      <OfflineBanner status={networkStatus} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="cube" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Gestion Colis</Text>
            <Text style={styles.headerSub}>
              {networkStatus.isOnline ? "Suivi professionnel des colis" : "Mode hors ligne"}
            </Text>
          </View>
        </View>
        <View style={styles.tabs}>
          {([
            { key: "creer",   label: "Créer",   icon: "add-circle-outline"      },
            { key: "retrait", label: "Retrait",  icon: "qr-code-outline"         },
            { key: "gerer",   label: "Gérer",    icon: "search-outline"          },
            { key: "liste",   label: "Liste",    icon: "list-outline"            },
          ] as const).map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Ionicons name={t.icon as any} size={14} color={activeTab === t.key ? G_DARK : "rgba(255,255,255,0.6)"} />
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === "creer"   && <CreerTab token={token} onCreated={() => setActiveTab("retrait")} />}
      {activeTab === "retrait" && <RetraitTab token={token} />}
      {activeTab === "gerer"   && <GererTab token={token} networkStatus={networkStatus} />}
      {activeTab === "liste"   && <ListeTab token={token} />}
    </SafeAreaView>
  );
}

/* ─── Tab 1: Gérer un colis ───────────────────────────────────────────────── */
function GererTab({ token, networkStatus }: { token: string | null; networkStatus: any }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [colis, setColis] = useState<Parcel | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [invalidQR, setInvalidQR] = useState<string | null>(null);
  const [showBusModal, setShowBusModal] = useState(false);
  const [busInput, setBusInput] = useState("");
  const [buses, setBuses] = useState<{ id: string; busName: string; plateNumber: string }[]>([]);

  const lookupColis = async (ref: string) => {
    setLoading(true); setColis(null); setNotFound(false); setActionDone(null);
    try {
      const res = await apiFetch<Parcel>(`/parcels/track/${ref.trim()}`, { token: token ?? undefined });
      setColis(res);
    } catch {
      setNotFound(true);
    } finally { setLoading(false); }
  };

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanMode(false);
    const qrResult = validateQR(data.trim());
    if (!qrResult.valid) { setInvalidQR(qrErrorMessage(qrResult.reason)); return; }
    setScanned(true);
    await lookupColis(qrResult.ref);
  }, [scanned]);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) { Alert.alert("Caméra requise", "Autorisez la caméra pour scanner."); return; }
    }
    setScanned(false); setScanMode(true);
  };

  const fetchBuses = async () => {
    try {
      const res = await apiFetch("/company/buses", { token: token ?? undefined });
      if (Array.isArray(res)) setBuses(res);
    } catch {}
  };

  const doAction = async (route: string, extraBody?: object) => {
    if (!colis) return;
    if (route === "charge-bus") {
      await fetchBuses();
      setShowBusModal(true);
      return;
    }
    setActioning(true);
    try {
      if (!networkStatus.isOnline && route === "en-gare") {
        await saveOffline({
          type: "colis_arrive",
          payload: { colisId: colis.id, trackingRef: colis.trackingRef },
          token: token ?? "",
          createdAt: Date.now(),
        });
        setActionDone("en_gare");
        setColis(prev => prev ? { ...prev, status: "en_gare" } : prev);
        return;
      }
      const result = await apiFetch<{ status?: string; busId?: string }>(`/agent/parcels/${colis.id}/${route}`, {
        token: token ?? undefined,
        method: "POST",
        body: extraBody ? JSON.stringify(extraBody) : undefined,
      });
      const newStatus = result?.status ?? colis.status;
      setActionDone(newStatus);
      setColis(prev => prev ? { ...prev, status: newStatus, busId: result?.busId ?? prev.busId } : prev);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Action impossible");
    } finally { setActioning(false); }
  };

  const doChargeBus = async () => {
    if (!colis) return;
    setShowBusModal(false);
    const effectiveBusId = busInput.trim();
    await doActionDirect("charge-bus", { busId: effectiveBusId || undefined });
  };

  const doActionDirect = async (route: string, body?: object) => {
    if (!colis) return;
    setActioning(true);
    try {
      const result = await apiFetch<{ status?: string; busId?: string }>(`/agent/parcels/${colis.id}/${route}`, {
        token: token ?? undefined,
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      const newStatus = result?.status ?? colis.status;
      setActionDone(newStatus);
      setColis(prev => prev ? { ...prev, status: newStatus, busId: result?.busId ?? prev.busId } : prev);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Action impossible");
    } finally { setActioning(false); }
  };

  const reset = () => {
    setColis(null); setNotFound(false); setActionDone(null);
    setScanned(false); setSearch(""); setInvalidQR(null);
  };

  const nextAction = colis ? NEXT_ACTION[colis.status] : null;
  const isDone = colis?.status === "livré" || colis?.status === "livre" || colis?.status === "annulé";

  if (scanMode) {
    return (
      <View style={styles.cameraWrap}>
        {Platform.OS !== "web" ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
        ) : (
          <View style={styles.webCamera}>
            <Ionicons name="camera-outline" size={64} color="#fff" />
            <Text style={{ color: "#fff", marginTop: 12 }}>Scanner non disponible sur web</Text>
          </View>
        )}
        <View style={styles.cameraOverlay}>
          <View style={styles.scanBox} />
        </View>
        <TouchableOpacity style={styles.cancelScan} onPress={() => setScanMode(false)}>
          <Ionicons name="close-circle" size={44} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.scanHint}>Pointez vers le QR du colis</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rechercher un colis</Text>
        <TouchableOpacity style={styles.scanBtn} onPress={openCamera}>
          <Ionicons name="qr-code-outline" size={26} color="#fff" />
          <Text style={styles.scanBtnText}>Scanner QR</Text>
        </TouchableOpacity>
        <View style={styles.divider}>
          <View style={styles.divLine} />
          <Text style={styles.divText}>ou saisir la référence</Text>
          <View style={styles.divLine} />
        </View>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="GBX-XXXX-XXXX"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => search.trim() && lookupColis(search.trim())}
            autoCapitalize="characters"
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => search.trim() && lookupColis(search.trim())} disabled={loading}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={G} />
          <Text style={styles.loadingText}>Recherche…</Text>
        </View>
      )}

      {invalidQR && (
        <View style={[styles.resultCard, { borderColor: "#F87171", borderWidth: 1.5 }]}>
          <Ionicons name="warning-outline" size={32} color="#EF4444" style={{ alignSelf: "center" }} />
          <Text style={[styles.notFoundText, { textAlign: "center" }]}>QR invalide</Text>
          <Text style={[styles.notFoundSub, { textAlign: "center" }]}>{invalidQR}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reset}>
            <Text style={styles.retryBtnText}>Recommencer</Text>
          </TouchableOpacity>
        </View>
      )}

      {notFound && !loading && (
        <View style={[styles.resultCard, { borderColor: "#FCA5A5", borderWidth: 1.5 }]}>
          <Ionicons name="close-circle" size={32} color="#EF4444" style={{ alignSelf: "center" }} />
          <Text style={[styles.notFoundText, { textAlign: "center" }]}>Colis introuvable</Text>
          <Text style={[styles.notFoundSub, { textAlign: "center" }]}>Vérifiez la référence de suivi</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reset}>
            <Text style={styles.retryBtnText}>Recommencer</Text>
          </TouchableOpacity>
        </View>
      )}

      {colis && !loading && (
        <View style={[styles.resultCard, actionDone ? { borderColor: G, borderWidth: 2 } : {}]}>
          {actionDone && (
            <View style={{ alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={36} color={G} />
              <Text style={{ fontSize: 15, fontWeight: "700", color: G, marginTop: 4 }}>
                Statut mis à jour ✓
              </Text>
            </View>
          )}

          <View style={styles.colisHeader}>
            <View style={styles.colisIcon}>
              <Ionicons name="cube" size={26} color={G} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackingRef}>{colis.trackingRef}</Text>
              <Text style={styles.colisDesc}>{colis.description || `${colis.fromCity} → ${colis.toCity}`}</Text>
            </View>
            <StatusBadge status={colis.status} />
          </View>

          <StatusTracker status={colis.status} />

          <View style={styles.infoGrid}>
            <InfoRow icon="person-outline" label="Expéditeur" value={`${colis.senderName} · ${colis.senderPhone}`} />
            <InfoRow icon="person" label="Destinataire" value={`${colis.receiverName} · ${colis.receiverPhone}`} />
            <InfoRow icon="location-outline" label="Trajet" value={`${colis.fromCity} → ${colis.toCity}`} />
            {colis.weight ? <InfoRow icon="scale-outline" label="Poids" value={`${colis.weight} kg`} /> : null}
            {colis.busId ? <InfoRow icon="bus-outline" label="Bus" value={colis.busId} /> : null}
            {colis.amount ? <InfoRow icon="cash-outline" label="Montant" value={`${colis.amount.toLocaleString()} FCFA`} /> : null}
          </View>

          {!isDone && nextAction && !actionDone && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: nextAction.color }, actioning && { opacity: 0.6 }]}
              onPress={() => doAction(nextAction.route)}
              disabled={actioning}
            >
              {actioning ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name={nextAction.icon as any} size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>{nextAction.label}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isDone && (
            <View style={{ backgroundColor: G_LIGHT, borderRadius: 10, padding: 12, alignItems: "center" }}>
              <Ionicons name="checkmark-circle" size={28} color={G} />
              <Text style={{ color: G, fontWeight: "700", fontSize: 14, marginTop: 4 }}>
                {colis.status === "livré" || colis.status === "livre" ? "Colis livré avec succès" : "Colis annulé"}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.retryBtn} onPress={reset}>
            <Text style={styles.retryBtnText}>Rechercher un autre colis</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>Workflow de suivi</Text>
        {[
          { icon: "cube-outline", label: "Créé → Enregistrer en gare de départ" },
          { icon: "business-outline", label: "En gare → Charger dans le bus" },
          { icon: "bus-outline", label: "Chargé → Déclarer en transit" },
          { icon: "navigate-outline", label: "En transit → Confirmer arrivée à destination" },
          { icon: "checkmark-circle-outline", label: "Arrivé → Confirmer la livraison" },
        ].map((item) => (
          <View key={item.icon} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
            <Ionicons name={item.icon as any} size={14} color={G} />
            <Text style={styles.tip}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Modal visible={showBusModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Charger dans un bus</Text>
            <Text style={styles.modalSub}>Sélectionnez ou saisissez le bus</Text>
            {buses.length > 0 ? (
              <ScrollView style={{ maxHeight: 180 }}>
                {buses.map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.busPicker, busInput === b.id && { borderColor: G, borderWidth: 2 }]}
                    onPress={() => setBusInput(b.id)}
                  >
                    <Ionicons name="bus" size={16} color={G} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.busName}>{b.busName}</Text>
                      <Text style={styles.busPlate}>{b.plateNumber}</Text>
                    </View>
                    {busInput === b.id && <Ionicons name="checkmark-circle" size={20} color={G} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="ID du bus (optionnel)"
                value={busInput}
                onChangeText={setBusInput}
              />
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.retryBtn, { flex: 1 }]} onPress={() => setShowBusModal(false)}>
                <Text style={styles.retryBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: "#7C3AED" }]} onPress={doChargeBus}>
                <Ionicons name="bus" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color="#6B7280" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const STATUS_ORDER = ["créé", "en_gare", "chargé_bus", "en_transit", "arrivé", "livré"];
function StatusTracker({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {STATUS_ORDER.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const st = STATUSES[s as keyof typeof STATUSES];
          return (
            <React.Fragment key={s}>
              <View style={{ alignItems: "center", width: 60 }}>
                <View style={[styles.stepDot,
                  done && { backgroundColor: G },
                  active && { backgroundColor: st?.color ?? G, borderWidth: 0 },
                ]}>
                  {done ? <Ionicons name="checkmark" size={12} color="#fff" /> :
                   active ? <Ionicons name={st?.icon as any} size={12} color="#fff" /> :
                   <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#D1D5DB" }} />}
                </View>
                <Text style={[styles.stepLabel, done && { color: G }, active && { color: st?.color, fontWeight: "700" }]}>
                  {st?.label}
                </Text>
              </View>
              {i < STATUS_ORDER.length - 1 && (
                <View style={[styles.stepLine, done && { backgroundColor: G }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ─── Tab Retrait : client vient récupérer son colis ─────────────────────── */
function RetraitTab({ token }: { token: string | null }) {
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [colis, setColis]               = useState<Parcel | null>(null);
  const [notFound, setNotFound]         = useState(false);
  const [pickupCode, setPickupCode]     = useState("");
  const [codeError, setCodeError]       = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode]         = useState(false);
  const [scanned, setScanned]           = useState(false);

  const lookupColis = async (ref: string) => {
    setLoading(true); setColis(null); setNotFound(false); setCodeError(null); setSuccess(false); setPickupCode("");
    try {
      const res = await apiFetch<Parcel>(`/parcels/track/${ref.trim()}`, { token: token ?? undefined });
      setColis(res);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanMode(false); setScanned(true);
    const qrResult = validateQR(data.trim());
    if (!qrResult.valid) { setNotFound(true); return; }
    await lookupColis(qrResult.ref);
  }, [scanned]);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) { Alert.alert("Caméra requise", "Autorisez la caméra pour scanner."); return; }
    }
    setScanned(false); setScanMode(true);
  };

  const handleConfirmRetrait = async () => {
    if (!colis) return;
    if (!pickupCode.trim()) { setCodeError("Entrez le code de retrait reçu par SMS."); return; }
    setConfirming(true); setCodeError(null);
    try {
      await apiFetch(`/agent/parcels/${colis.id}/retirer`, {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({ pickupCode: pickupCode.trim() }),
      });
      setSuccess(true);
      setColis(prev => prev ? { ...prev, status: "retiré" } : prev);
    } catch (e: any) {
      const msg = e?.message ?? "Erreur lors de la validation.";
      if (msg.includes("incorrect") || msg.includes("invalide")) {
        setCodeError("Code incorrect. Vérifiez le SMS envoyé au destinataire.");
      } else if (msg.includes("requis")) {
        setCodeError("Le code de retrait est obligatoire.");
      } else {
        setCodeError(msg);
      }
    } finally { setConfirming(false); }
  };

  const reset = () => {
    setColis(null); setNotFound(false); setSearch(""); setPickupCode("");
    setCodeError(null); setSuccess(false); setScanned(false);
  };

  if (scanMode) {
    return (
      <View style={styles.cameraWrap}>
        {Platform.OS !== "web" ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back"
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }} />
        ) : (
          <View style={styles.webCamera}>
            <Ionicons name="camera-outline" size={64} color="#fff" />
            <Text style={{ color: "#fff", marginTop: 12 }}>Scanner non disponible sur web</Text>
          </View>
        )}
        <View style={styles.cameraOverlay}><View style={styles.scanBox} /></View>
        <TouchableOpacity style={styles.cancelScan} onPress={() => setScanMode(false)}>
          <Ionicons name="close-circle" size={44} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.scanHint}>Scannez le QR du colis</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Intro ── */}
        <View style={[styles.card, { backgroundColor: "#EDE9FE", borderColor: "#7C3AED", borderWidth: 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="hand-left" size={22} color="#7C3AED" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#4C1D95" }}>Retrait de colis</Text>
              <Text style={{ fontSize: 12, color: "#6D28D9", marginTop: 2 }}>
                Le destinataire présente son code colis + code de retrait SMS
              </Text>
            </View>
          </View>
        </View>

        {/* ── Étape 1 : Identifier le colis ── */}
        {!colis && !success && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Étape 1 — Identifier le colis</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={openCamera}>
              <Ionicons name="qr-code-outline" size={24} color="#fff" />
              <Text style={styles.scanBtnText}>Scanner le QR du colis</Text>
            </TouchableOpacity>
            <View style={styles.divider}>
              <View style={styles.divLine} /><Text style={styles.divText}>ou saisir la référence</Text><View style={styles.divLine} />
            </View>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="GBX-XXXX-XXXX"
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => search.trim() && lookupColis(search.trim())}
                autoCapitalize="characters"
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn}
                onPress={() => search.trim() && lookupColis(search.trim())} disabled={loading}>
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {loading && <ActivityIndicator color={G} style={{ marginTop: 12 }} />}
            {notFound && !loading && (
              <View style={{ alignItems: "center", gap: 4, marginTop: 12 }}>
                <Ionicons name="close-circle" size={28} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontWeight: "700" }}>Colis introuvable</Text>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>Vérifiez la référence</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Étape 2 : Infos colis + code de retrait ── */}
        {colis && !success && (
          <>
            <View style={[styles.resultCard, { borderColor: "#7C3AED", borderWidth: 1.5 }]}>
              <View style={styles.colisHeader}>
                <View style={[styles.colisIcon, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="cube" size={24} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trackingRef, { color: "#4C1D95" }]}>{colis.trackingRef}</Text>
                  <Text style={styles.colisDesc}>{colis.fromCity} → {colis.toCity}</Text>
                </View>
                <StatusBadge status={colis.status} />
              </View>

              <View style={[styles.infoGrid, { marginTop: 8 }]}>
                <InfoRow icon="person-outline"  label="Expéditeur"   value={`${colis.senderName} · ${colis.senderPhone}`} />
                <InfoRow icon="person"           label="Destinataire" value={`${colis.receiverName} · ${colis.receiverPhone}`} />
                {(colis.status === "retiré" || colis.status === "livré" || colis.status === "livre") && (
                  <View style={{ backgroundColor: G_LIGHT, borderRadius: 8, padding: 10, alignItems: "center", marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={22} color={G} />
                    <Text style={{ color: G, fontWeight: "700", fontSize: 13, marginTop: 2 }}>Ce colis a déjà été retiré</Text>
                  </View>
                )}
              </View>

              {colis.status !== "retiré" && colis.status !== "livré" && colis.status !== "livre" && (
                <>
                  <View style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 }} />
                  <Text style={[styles.cardTitle, { fontSize: 13 }]}>Étape 2 — Code de retrait</Text>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                    Demandez le code à 4 chiffres reçu par SMS par le destinataire
                  </Text>
                  <TextInput
                    style={[styles.formInput, {
                      fontSize: 22, fontWeight: "800", letterSpacing: 8, textAlign: "center",
                      color: "#4C1D95", borderColor: codeError ? "#EF4444" : "#7C3AED",
                      borderWidth: 2, backgroundColor: "#F5F3FF",
                    }]}
                    placeholder="• • • •"
                    value={pickupCode}
                    onChangeText={v => { setPickupCode(v.replace(/\D/g, "").slice(0, 4)); setCodeError(null); }}
                    keyboardType="number-pad"
                    maxLength={4}
                    returnKeyType="done"
                  />
                  {codeError && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <Ionicons name="alert-circle" size={14} color="#DC2626" />
                      <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "600" }}>{codeError}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#7C3AED", marginTop: 14 }, confirming && { opacity: 0.6 }]}
                    onPress={handleConfirmRetrait}
                    disabled={confirming || pickupCode.length < 4}
                  >
                    {confirming ? <ActivityIndicator color="#fff" size="small" /> : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Valider le retrait</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity style={styles.retryBtn} onPress={reset}>
              <Text style={styles.retryBtnText}>Rechercher un autre colis</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Succès ── */}
        {success && colis && (
          <View style={[styles.resultCard, { borderColor: G, borderWidth: 2, alignItems: "center" }]}>
            <Ionicons name="checkmark-circle" size={56} color={G} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: G, marginTop: 8 }}>Retrait validé !</Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: "#111827", marginTop: 6, letterSpacing: 2 }}>
              {colis.trackingRef}
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
              {colis.receiverName} — {colis.toCity}
            </Text>
            <View style={{ marginTop: 8 }}>
              <StatusBadge status="retiré" />
            </View>
            <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 10, textAlign: "center" }}>
              Le colis est marqué retiré. Un SMS de confirmation a été envoyé au destinataire.
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: G, marginTop: 16 }]}
              onPress={reset}
            >
              <Ionicons name="cube-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Nouveau retrait</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Tab 2: Créer un colis ───────────────────────────────────────────────── */
function CreerTab({ token, onCreated }: { token: string | null; onCreated: () => void }) {
  const [form, setForm] = useState({
    senderName: "", senderPhone: "",
    receiverName: "", receiverPhone: "",
    fromCity: "", toCity: "",
    parcelType: "", weight: "",
    deliveryType: "livraison_gare",
    paymentMethod: "cash", description: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Parcel | null>(null);
  const set = (k: string) => (v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleCreate = async () => {
    const { senderName, senderPhone, receiverName, receiverPhone, fromCity, toCity, parcelType, weight, deliveryType } = form;
    if (!senderName || !senderPhone || !receiverName || !receiverPhone || !fromCity || !toCity || !parcelType || !weight) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs obligatoires"); return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<Parcel>("/agent/parcels", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify(form),
      });
      setCreated(result);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer le colis");
    } finally { setLoading(false); }
  };

  if (created) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.resultCard, { borderColor: G, borderWidth: 2, alignItems: "center" }]}>
          <Ionicons name="checkmark-circle" size={56} color={G} />
          <Text style={{ fontSize: 18, fontWeight: "800", color: G, marginTop: 8 }}>Colis créé !</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827", marginTop: 8, letterSpacing: 2 }}>
            {created.trackingRef}
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
            {created.fromCity} → {created.toCity}
          </Text>
          <View style={{ marginTop: 8 }}>
            <StatusBadge status={created.status} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16, width: "100%" }}>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: G }]}
              onPress={() => { setCreated(null); setForm({ senderName: "", senderPhone: "", receiverName: "", receiverPhone: "", fromCity: "", toCity: "", parcelType: "", weight: "", deliveryType: "livraison_gare", paymentMethod: "cash", description: "", notes: "" }); }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Nouveau colis</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: "#7C3AED" }]}
              onPress={onCreated}
            >
              <Ionicons name="search-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Gérer ce colis</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Expéditeur</Text>
          <TextInput style={styles.formInput} placeholder="Nom de l'expéditeur *" value={form.senderName} onChangeText={set("senderName")} />
          <TextInput style={styles.formInput} placeholder="Téléphone expéditeur *" value={form.senderPhone} onChangeText={set("senderPhone")} keyboardType="phone-pad" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Destinataire</Text>
          <TextInput style={styles.formInput} placeholder="Nom du destinataire *" value={form.receiverName} onChangeText={set("receiverName")} />
          <TextInput style={styles.formInput} placeholder="Téléphone destinataire *" value={form.receiverPhone} onChangeText={set("receiverPhone")} keyboardType="phone-pad" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trajet</Text>
          <CityPicker label="Ville de départ *" value={form.fromCity} onChange={set("fromCity")} />
          <CityPicker label="Ville d'arrivée *" value={form.toCity} onChange={set("toCity")} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Détails du colis</Text>
          <Text style={styles.fieldLabel}>Type de colis *</Text>
          <View style={styles.chipRow}>
            {PARCEL_TYPES.map(t => (
              <TouchableOpacity key={t} style={[styles.chip, form.parcelType === t && styles.chipActive]} onPress={() => set("parcelType")(t)}>
                <Text style={[styles.chipText, form.parcelType === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.formInput} placeholder="Poids (kg) *" value={form.weight} onChangeText={set("weight")} keyboardType="decimal-pad" />
          <TextInput style={[styles.formInput, { minHeight: 60 }]} placeholder="Description (optionnel)" value={form.description} onChangeText={set("description")} multiline />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Livraison & Paiement</Text>
          <Text style={styles.fieldLabel}>Mode de livraison</Text>
          <View style={styles.chipRow}>
            {DELIVERY_TYPES.map(d => (
              <TouchableOpacity key={d.key} style={[styles.chip, form.deliveryType === d.key && styles.chipActive]} onPress={() => set("deliveryType")(d.key)}>
                <Text style={[styles.chipText, form.deliveryType === d.key && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Méthode de paiement</Text>
          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity key={m} style={[styles.chip, form.paymentMethod === m && styles.chipActive]} onPress={() => set("paymentMethod")(m)}>
                <Text style={[styles.chipText, form.paymentMethod === m && styles.chipTextActive]}>{m.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.formInput} placeholder="Notes agent (optionnel)" value={form.notes} onChangeText={set("notes")} />
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: G, marginBottom: 32 }, loading && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Créer le colis</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CityPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {CITIES.map(c => (
            <TouchableOpacity key={c} style={[styles.chip, value === c && styles.chipActive]} onPress={() => onChange(c)}>
              <Text style={[styles.chipText, value === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Tab 3: Liste des colis ──────────────────────────────────────────────── */
function ListeTab({ token }: { token: string | null }) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("tous");
  const [refresh, setRefresh] = useState(0);

  const STATUS_FILTERS = [
    { key: "tous",       label: "Tous" },
    { key: "créé",       label: "Créé" },
    { key: "en_gare",    label: "En gare" },
    { key: "chargé_bus", label: "Dans bus" },
    { key: "en_transit", label: "En transit" },
    { key: "arrivé",     label: "Arrivé" },
    { key: "livré",      label: "Livré" },
  ];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const url = filter !== "tous" ? `/agent/parcels?status=${encodeURIComponent(filter)}` : "/agent/parcels";
        const res = await apiFetch(url, { token: token ?? undefined });
        if (Array.isArray(res)) setParcels(res);
      } catch {
        setParcels([]);
      } finally { setLoading(false); }
    };
    load();
  }, [filter, refresh]);

  const today = new Date().toISOString().split("T")[0];
  const todayCount = parcels.filter(p => p.createdAt?.startsWith(today)).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
          {STATUS_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!loading && (
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{parcels.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{todayCount}</Text>
            <Text style={styles.statLabel}>Aujourd'hui</Text>
          </View>
          <TouchableOpacity style={[styles.statBox, { backgroundColor: G_LIGHT, borderColor: G }]} onPress={() => setRefresh(r => r + 1)}>
            <Ionicons name="refresh" size={18} color={G} />
            <Text style={[styles.statLabel, { color: G }]}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={G} />
          <Text style={styles.loadingText}>Chargement des colis…</Text>
        </View>
      ) : parcels.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
          <Text style={styles.loadingText}>Aucun colis trouvé</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
          {parcels.map(p => (
            <View key={p.id} style={styles.parcelCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={[styles.colisIcon, { width: 40, height: 40 }]}>
                  <Ionicons name="cube" size={20} color={G} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackingRef}>{p.trackingRef}</Text>
                  <Text style={styles.colisDesc} numberOfLines={1}>
                    {p.senderName} → {p.receiverName}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{p.fromCity} → {p.toCity}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <StatusBadge status={p.status} />
                  {p.amount ? <Text style={{ fontSize: 11, color: "#6B7280" }}>{p.amount.toLocaleString()} F</Text> : null}
                </View>
              </View>
              {p.busId && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#F3F4F6" }}>
                  <Ionicons name="bus-outline" size={12} color="#7C3AED" />
                  <Text style={{ fontSize: 11, color: "#7C3AED" }}>Bus: {p.busId}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: G_DARK },
  denied: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  deniedText: { fontSize: 16, color: "#EF4444", fontWeight: "600" },

  header: { backgroundColor: G_DARK, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  headerIcon: { backgroundColor: G, borderRadius: 10, padding: 8 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#A7F3D0", fontSize: 12, marginTop: 1 },

  tabs: { flexDirection: "row", gap: 0 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#34D399" },
  tabText: { fontSize: 14, color: "#A7F3D0", fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "700" },

  scroll: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 14, paddingBottom: 40 },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },

  scanBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 13, borderRadius: 10 },
  scanBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  divText: { fontSize: 12, color: "#9CA3AF" },

  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: G_LIGHT },
  searchBtn: { backgroundColor: G, borderRadius: 8, width: 44, alignItems: "center", justifyContent: "center" },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  loadingText: { color: "#9CA3AF", fontSize: 14 },

  resultCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 12 },

  colisHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  colisIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: G_LIGHT, alignItems: "center", justifyContent: "center" },
  trackingRef: { fontSize: 15, fontWeight: "700", color: "#111827" },
  colisDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "600" },

  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#D1D5DB" },
  stepLabel: { fontSize: 9, color: "#9CA3AF", marginTop: 4, textAlign: "center", width: 56 },
  stepLine: { width: 20, height: 2, backgroundColor: "#E5E7EB", marginBottom: 14 },

  infoGrid: { gap: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoLabel: { fontSize: 12, color: "#6B7280", width: 88 },
  infoValue: { fontSize: 13, fontWeight: "500", color: "#111827", flex: 1 },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, marginTop: 4 },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  retryBtn: { borderWidth: 1, borderColor: G_MID, borderRadius: 8, padding: 10, alignItems: "center", marginTop: 4 },
  retryBtnText: { color: G, fontSize: 14, fontWeight: "500" },

  notFoundText: { fontSize: 16, fontWeight: "700", color: "#EF4444" },
  notFoundSub: { fontSize: 13, color: "#6B7280" },

  tips: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 6 },
  tipsTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 4 },
  tip: { fontSize: 12, color: "#6B7280", lineHeight: 18 },

  cameraWrap: { flex: 1, position: "relative" },
  webCamera: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanBox: { width: 220, height: 220, borderWidth: 3, borderColor: "#34D399", borderRadius: 12 },
  cancelScan: { position: "absolute", top: 20, right: 20 },
  scanHint: { position: "absolute", bottom: 40, alignSelf: "center", color: "#fff", fontSize: 14, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },

  filterBar: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F3F4F6" },
  filterChipActive: { backgroundColor: G_LIGHT },
  filterChipText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  filterChipTextActive: { color: G, fontWeight: "700" },

  statRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  statBox: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingVertical: 8 },
  statNum: { fontSize: 20, fontWeight: "800", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  parcelCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },

  formInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: "#FAFAFA", marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: G_LIGHT, borderColor: G },
  chipText: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  chipTextActive: { color: G, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalSub: { fontSize: 13, color: "#6B7280" },
  busPicker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 6 },
  busName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  busPlate: { fontSize: 12, color: "#6B7280" },
});
