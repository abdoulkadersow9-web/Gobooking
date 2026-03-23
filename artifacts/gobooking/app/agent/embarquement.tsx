import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus, isAlreadyScanned, markAsScanned } from "@/utils/offline";
import { validateQR, qrErrorMessage } from "@/utils/qr";
import OfflineBanner from "@/components/OfflineBanner";

const G       = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK  = "#065F46";

interface Passenger {
  reservationId: string;
  name: string;
  phone: string;
  seat: string;
  status: string;
  departureCity: string;
  arrivalCity: string;
  departureTime: string;
}

interface EnRoutePassenger {
  id: string;
  tripId: string;
  clientName: string;
  clientPhone: string;
  boardingPoint: string;
  seatsRequested: number;
  status: string;
  createdAt: number;
}

type MainTab = "billets" | "en_route";

export default function EmbarquementScreen() {
  const { user, token } = useAuth();
  const networkStatus   = useNetworkStatus(BASE_URL);

  /* ── Camera / QR scan ─────────────────────────────── */
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode]         = useState(false);
  const [scanned, setScanned]           = useState(false);

  /* ── Billet lookup (existing flow) ────────────────── */
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [validating, setValidating] = useState(false);
  const [found, setFound]         = useState<Passenger | null>(null);
  const [notFound, setNotFound]   = useState(false);
  const [validated, setValidated] = useState(false);
  const [invalidQR, setInvalidQR] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  /* ── Tab ──────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<MainTab>("billets");

  /* ── En Route passengers ──────────────────────────── */
  const [activeTripId, setActiveTripId]         = useState<string | null>(null);
  const [enRouteList, setEnRouteList]           = useState<EnRoutePassenger[]>([]);
  const [enRouteLoading, setEnRouteLoading]     = useState(false);
  const [boardingId, setBoardingId]             = useState<string | null>(null);
  const [enRouteScanMode, setEnRouteScanMode]   = useState(false);
  const [enRouteScanBusy, setEnRouteScanBusy]   = useState(false);
  const pollEnRouteRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (user && user.role !== "agent") {
    return (
      <SafeAreaView style={styles.denied}>
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text style={styles.deniedText}>Accès réservé aux agents</Text>
      </SafeAreaView>
    );
  }

  /* ── Fetch active trip for agent's bus ────────────── */
  const fetchActiveTripId = async () => {
    try {
      const info = await apiFetch<{ agent: { busId?: string }; bus: any }>("/agent/info", { token: token ?? undefined });
      const busId = info?.agent?.busId;
      if (!busId) { setActiveTripId(null); return null; }

      const trips = await apiFetch<any[]>("/agent/trips", { token: token ?? undefined });
      const active = (trips || []).find((t: any) =>
        (t.status === "en_route" || t.status === "en_cours") && t.busId === busId
      );
      const id = active?.id || null;
      setActiveTripId(id);
      return id;
    } catch {
      return null;
    }
  };

  /* ── Load en-route passengers ─────────────────────── */
  const loadEnRoute = async (tripId: string | null) => {
    if (!tripId) { setEnRouteList([]); return; }
    setEnRouteLoading(true);
    try {
      const data = await apiFetch<EnRoutePassenger[]>(`/agent/requests/confirmed?tripId=${tripId}`, { token: token ?? undefined });
      setEnRouteList(data || []);
    } catch {
      setEnRouteList([]);
    } finally {
      setEnRouteLoading(false);
    }
  };

  /* ── Switch to En Route tab ───────────────────────── */
  const handleEnRouteTabPress = async () => {
    setActiveTab("en_route");
    let tid = activeTripId;
    if (!tid) tid = await fetchActiveTripId();
    await loadEnRoute(tid);

    if (pollEnRouteRef.current) clearInterval(pollEnRouteRef.current);
    pollEnRouteRef.current = setInterval(async () => {
      const tId = activeTripId;
      if (tId) await loadEnRoute(tId);
    }, 10000);
  };

  useEffect(() => {
    return () => { if (pollEnRouteRef.current) clearInterval(pollEnRouteRef.current); };
  }, []);

  /* ── Board an en-route passenger ──────────────────── */
  const boardEnRoute = async (requestId: string) => {
    setBoardingId(requestId);
    try {
      if (!networkStatus.isOnline) {
        await saveOffline({
          type: "en_route_board",
          payload: { requestId },
          token: token ?? "",
          createdAt: Date.now(),
        });
        setEnRouteList(prev => prev.map(p => p.id === requestId ? { ...p, status: "embarqué" } : p));
        return;
      }
      await apiFetch(`/agent/requests/${requestId}/board`, { token: token ?? undefined, method: "POST" });
      setEnRouteList(prev => prev.map(p => p.id === requestId ? { ...p, status: "embarqué" } : p));
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'embarquer le passager");
    } finally {
      setBoardingId(null);
    }
  };

  /* ── En-route QR scan ─────────────────────────────── */
  const handleEnRouteScan = useCallback(async ({ data }: { data: string }) => {
    if (enRouteScanBusy) return;
    setEnRouteScanBusy(true);
    setEnRouteScanMode(false);
    const requestId = data.trim();

    const found = enRouteList.find(p => p.id === requestId);
    if (found && found.status !== "embarqué") {
      Alert.alert(
        "Embarquer passager",
        `Confirmer l'embarquement de ${found.clientName} ?`,
        [
          { text: "Annuler", style: "cancel", onPress: () => setEnRouteScanBusy(false) },
          { text: "Embarquer", style: "default", onPress: async () => {
            await boardEnRoute(requestId);
            setEnRouteScanBusy(false);
          }},
        ]
      );
    } else if (found && found.status === "embarqué") {
      Alert.alert("Déjà embarqué", `${found.clientName} a déjà été embarqué.`);
      setEnRouteScanBusy(false);
    } else {
      /* Not in list yet — try board anyway (might be from another device's accepted list) */
      Alert.alert(
        "Passager inconnu",
        `ID de demande: ${requestId}\n\nEmbarquer ce passager ?`,
        [
          { text: "Annuler", style: "cancel", onPress: () => setEnRouteScanBusy(false) },
          { text: "Embarquer", onPress: async () => {
            await boardEnRoute(requestId);
            setEnRouteScanBusy(false);
          }},
        ]
      );
    }
  }, [enRouteScanBusy, enRouteList, token]);

  /* ── Existing billet flow ─────────────────────────── */
  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanMode(false);

    /* 1. Validate QR signature */
    const qrResult = validateQR(data.trim());
    if (!qrResult.valid) {
      setInvalidQR(qrErrorMessage(qrResult.reason));
      setScanned(false);
      return;
    }

    const ref = qrResult.ref;

    /* 2. Anti-duplicate: block if already scanned this session */
    const duplicate = await isAlreadyScanned(ref);
    if (duplicate) {
      setIsDuplicate(true);
      setScanned(false);
      return;
    }

    setScanned(true);
    await markAsScanned(ref);
    await lookupPassenger(ref);
  }, [scanned]);

  const lookupPassenger = async (ref: string) => {
    setLoading(true);
    setFound(null);
    setNotFound(false);
    setValidated(false);
    try {
      const res = await apiFetch(`/agent/reservation/${ref.trim()}`, { token: token ?? undefined });
      setFound(res);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!search.trim()) return;
    lookupPassenger(search.trim());
  };

  const handleValidate = async () => {
    if (!found) return;
    setValidating(true);
    try {
      if (!networkStatus.isOnline) {
        await saveOffline({
          type: "scan",
          payload: { reservationId: found.reservationId },
          token: token ?? "",
          createdAt: Date.now(),
        });
        setValidated(true);
        setFound(prev => prev ? { ...prev, status: "confirmed" } : prev);
        return;
      }
      await apiFetch(`/agent/reservation/${found.reservationId}/board`, {
        token: token ?? undefined,
        method: "POST",
      });
      setValidated(true);
      setFound(prev => prev ? { ...prev, status: "confirmed" } : prev);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de valider l'embarquement");
    } finally {
      setValidating(false);
    }
  };

  const reset = () => {
    setFound(null);
    setNotFound(false);
    setValidated(false);
    setScanned(false);
    setSearch("");
    setInvalidQR(null);
    setIsDuplicate(false);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Caméra requise", "Autorisez l'accès à la caméra pour scanner les billets.");
        return;
      }
    }
    setScanned(false);
    setScanMode(true);
  };

  const openEnRouteCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Caméra requise", "Autorisez la caméra pour scanner les QR codes.");
        return;
      }
    }
    setEnRouteScanBusy(false);
    setEnRouteScanMode(true);
  };

  const callPassenger = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
  };

  /* ── Camera scan overlay (shared for both modes) ──── */
  if (scanMode || enRouteScanMode) {
    const hint = enRouteScanMode ? "Pointez vers le QR du passager en route" : "Pointez vers le QR du billet";
    const onScan = enRouteScanMode ? handleEnRouteScan : handleBarCodeScanned;
    const onClose = () => { setScanMode(false); setEnRouteScanMode(false); };

    return (
      <View style={styles.cameraWrap}>
        {Platform.OS !== "web" ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={onScan}
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
        <TouchableOpacity style={styles.cancelScan} onPress={onClose}>
          <Ionicons name="close-circle" size={44} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.scanHint}>{hint}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      {/* Offline Banner */}
      <OfflineBanner status={networkStatus} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="bus" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Embarquement</Text>
            <Text style={styles.headerSub}>Valider les billets voyageurs</Text>
          </View>
        </View>

        {/* Tab toggle */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "billets" && styles.tabBtnActive]}
            onPress={() => setActiveTab("billets")}
          >
            <Ionicons name="ticket-outline" size={14} color={activeTab === "billets" ? G_DARK : "rgba(255,255,255,0.6)"} />
            <Text style={[styles.tabBtnText, activeTab === "billets" && styles.tabBtnTextActive]}>Billets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "en_route" && styles.tabBtnActive]}
            onPress={handleEnRouteTabPress}
          >
            <Feather name="radio" size={14} color={activeTab === "en_route" ? G_DARK : "rgba(255,255,255,0.6)"} />
            <Text style={[styles.tabBtnText, activeTab === "en_route" && styles.tabBtnTextActive]}>
              En Route {enRouteList.filter(p => p.status === "accepted").length > 0
                ? `(${enRouteList.filter(p => p.status === "accepted").length})`
                : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Billets tab ── */}
      {activeTab === "billets" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scanner un billet</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={openCamera}>
              <Ionicons name="qr-code-outline" size={28} color="#fff" />
              <Text style={styles.scanBtnText}>Ouvrir le scanner QR</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>ou saisir le numéro</Text>
              <View style={styles.divLine} />
            </View>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="Réf. réservation ou n° siège"
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={handleSearch}
                autoCapitalize="characters"
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {loading && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={G} />
              <Text style={styles.loadingText}>Recherche en cours…</Text>
            </View>
          )}

          {/* ── QR invalide ── */}
          {invalidQR && (
            <View style={[styles.resultCard, { borderColor: "#F87171", borderWidth: 1.5 }]}>
              <Ionicons name="qr-code-outline" size={32} color="#EF4444" />
              <Text style={[styles.notFoundText, { color: "#EF4444" }]}>QR invalide</Text>
              <Text style={styles.notFoundSub}>{invalidQR}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]} onPress={reset}>
                <Text style={[styles.retryBtnText, { color: "#DC2626" }]}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Déjà utilisé ── */}
          {isDuplicate && (
            <View style={[styles.resultCard, { borderColor: "#FCD34D", borderWidth: 1.5 }]}>
              <Ionicons name="alert-circle" size={32} color="#D97706" />
              <Text style={[styles.notFoundText, { color: "#D97706" }]}>Déjà utilisé</Text>
              <Text style={styles.notFoundSub}>Ce billet a déjà été validé dans cette session.</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]} onPress={reset}>
                <Text style={[styles.retryBtnText, { color: "#B45309" }]}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {notFound && !loading && (
            <View style={[styles.resultCard, styles.notFoundCard]}>
              <Ionicons name="close-circle" size={32} color="#EF4444" />
              <Text style={styles.notFoundText}>Billet introuvable</Text>
              <Text style={styles.notFoundSub}>Vérifiez la référence ou demandez un document valide</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryBtnText}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {found && !loading && (
            <View style={[styles.resultCard, validated && styles.validatedCard]}>
              {validated ? (
                <View style={styles.validatedBadge}>
                  <Ionicons name="checkmark-circle" size={40} color={G} />
                  <Text style={styles.validatedText}>Embarquement validé !</Text>
                </View>
              ) : null}

              <View style={styles.passengerRow}>
                <View style={styles.passengerAvatar}>
                  <Ionicons name="person" size={24} color={G} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passengerName}>{found.name}</Text>
                  <Text style={styles.passengerPhone}>{found.phone}</Text>
                </View>
                <View style={styles.seatBadge}>
                  <Text style={styles.seatText}>{found.seat || "—"}</Text>
                  <Text style={styles.seatLabel}>Siège</Text>
                </View>
              </View>

              <View style={styles.tripInfo}>
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text style={styles.tripInfoText}>
                  {found.departureCity ?? "—"} → {found.arrivalCity ?? "—"}
                </Text>
                {found.departureTime ? (
                  <Text style={styles.tripTime}>{found.departureTime}</Text>
                ) : null}
              </View>

              {!validated && (
                <TouchableOpacity
                  style={[styles.validateBtn, validating && styles.validateBtnDisabled]}
                  onPress={handleValidate}
                  disabled={validating}
                >
                  {validating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.validateBtnText}>Valider l'embarquement</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryBtnText}>Nouveau scan</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Instructions</Text>
            <Text style={styles.tip}>• Scanner le QR code sur le billet du voyageur</Text>
            <Text style={styles.tip}>• Vérifier l'identité si nécessaire</Text>
            <Text style={styles.tip}>• Valider avant l'entrée dans le bus</Text>
          </View>
        </ScrollView>
      )}

      {/* ── En Route tab ── */}
      {activeTab === "en_route" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

          {/* Scan en-route QR */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scanner QR passager en route</Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
              Scannez le QR code affiché sur le téléphone du passager
            </Text>
            <TouchableOpacity style={[styles.scanBtn, { backgroundColor: "#0369A1" }]} onPress={openEnRouteCamera}>
              <Ionicons name="qr-code-outline" size={24} color="#fff" />
              <Text style={styles.scanBtnText}>Scanner QR en route</Text>
            </TouchableOpacity>
          </View>

          {/* Trip info */}
          {activeTripId ? (
            <View style={{ backgroundColor: G_LIGHT, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="radio" size={14} color={G} />
              <Text style={{ color: G_DARK, fontSize: 12, fontWeight: "600" }}>Trajet actif : {activeTripId}</Text>
              <TouchableOpacity onPress={async () => { const tid = await fetchActiveTripId(); await loadEnRoute(tid); }} style={{ marginLeft: "auto" }}>
                <Feather name="refresh-cw" size={14} color={G} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: 14, alignItems: "center", gap: 6 }}>
              <Feather name="alert-circle" size={22} color="#D97706" />
              <Text style={{ color: "#92400E", fontWeight: "600", fontSize: 13 }}>Aucun trajet en cours trouvé</Text>
              <Text style={{ color: "#92400E", fontSize: 12, textAlign: "center" }}>Démarrez un trajet dans votre dashboard ou vérifiez votre bus.</Text>
              <TouchableOpacity style={{ marginTop: 6, backgroundColor: "#D97706", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
                onPress={async () => { const tid = await fetchActiveTripId(); await loadEnRoute(tid); }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Actualiser</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Header + refresh */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.sectionTitle}>
              Passagers confirmés ({enRouteList.length})
            </Text>
            <TouchableOpacity onPress={() => loadEnRoute(activeTripId)} style={{ padding: 6 }}>
              <Feather name="refresh-cw" size={16} color={G} />
            </TouchableOpacity>
          </View>

          {enRouteLoading && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={G} />
              <Text style={styles.loadingText}>Chargement…</Text>
            </View>
          )}

          {!enRouteLoading && enRouteList.length === 0 && activeTripId && (
            <View style={[styles.resultCard, { alignItems: "center", paddingVertical: 28 }]}>
              <Feather name="users" size={36} color="#D1FAE5" />
              <Text style={[styles.notFoundText, { color: "#64748B" }]}>Aucun passager en route</Text>
              <Text style={styles.notFoundSub}>Les demandes acceptées apparaîtront ici</Text>
            </View>
          )}

          {enRouteList.map(passenger => {
            const isEmbarque = passenger.status === "embarqué";
            const isBusy     = boardingId === passenger.id;

            return (
              <View key={passenger.id} style={[
                styles.resultCard,
                isEmbarque && { borderWidth: 1.5, borderColor: "#6EE7B7" },
              ]}>
                {/* Name + status */}
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={styles.passengerAvatar}>
                    <Ionicons name="person" size={22} color={isEmbarque ? G_DARK : G} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.passengerName}>{passenger.clientName}</Text>
                    <Text style={styles.passengerPhone}>{passenger.clientPhone}</Text>
                  </View>
                  <View style={{
                    backgroundColor: isEmbarque ? "#ECFDF5" : "#FEF3C7",
                    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: isEmbarque ? G : "#D97706" }}>
                      {isEmbarque ? "Embarqué ✓" : "Confirmé"}
                    </Text>
                  </View>
                </View>

                {/* Boarding info */}
                <View style={{ flexDirection: "row", gap: 14, paddingLeft: 4, marginTop: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="location-outline" size={13} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: "#374151" }}>{passenger.boardingPoint}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="people-outline" size={13} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: "#374151" }}>
                      {passenger.seatsRequested} siège{passenger.seatsRequested > 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>

                {/* Action buttons */}
                {!isEmbarque && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => callPassenger(passenger.clientPhone)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call-outline" size={15} color="#0369A1" />
                      <Text style={styles.callBtnText}>Appeler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.boardBtn, isBusy && { opacity: 0.6 }]}
                      onPress={() => boardEnRoute(passenger.id)}
                      disabled={isBusy}
                      activeOpacity={0.8}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={15} color="#fff" />
                          <Text style={styles.boardBtnText}>Embarquer</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {isEmbarque && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: G_LIGHT, borderRadius: 8, padding: 8, marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color={G} />
                    <Text style={{ color: G_DARK, fontSize: 12, fontWeight: "500" }}>Passager embarqué avec succès</Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Instructions en route</Text>
            <Text style={styles.tip}>• Les passagers acceptés apparaissent automatiquement</Text>
            <Text style={styles.tip}>• Scannez leur QR ou appuyez sur "Embarquer"</Text>
            <Text style={styles.tip}>• Appelez le passager si besoin pour coordonner le point d'arrêt</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: G_DARK },
  denied: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  deniedText: { fontSize: 16, color: "#EF4444", fontWeight: "600" },

  header: { backgroundColor: G_DARK, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headerIcon: { backgroundColor: G, borderRadius: 10, padding: 8 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#A7F3D0", fontSize: 13, marginTop: 1 },

  tabRow: { flexDirection: "row", gap: 8 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)" },
  tabBtnActive: { backgroundColor: "#fff" },
  tabBtnText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  tabBtnTextActive: { color: G_DARK },

  scroll: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 14 },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 14 },

  scanBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 14, borderRadius: 10 },
  scanBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  divText: { fontSize: 12, color: "#9CA3AF" },

  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: G_LIGHT },
  searchBtn: { backgroundColor: G, borderRadius: 8, width: 44, alignItems: "center", justifyContent: "center" },

  centerBox: { alignItems: "center", padding: 24, gap: 10 },
  loadingText: { color: "#6B7280", fontSize: 14 },

  resultCard: { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 10 },
  notFoundCard: { borderWidth: 1.5, borderColor: "#FCA5A5", alignItems: "center" },
  validatedCard: { borderWidth: 2, borderColor: G },

  notFoundText: { fontSize: 16, fontWeight: "700", color: "#EF4444", marginTop: 4 },
  notFoundSub: { fontSize: 13, color: "#6B7280", textAlign: "center" },

  validatedBadge: { alignItems: "center", gap: 6 },
  validatedText: { fontSize: 17, fontWeight: "700", color: G },

  passengerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  passengerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: G_LIGHT, alignItems: "center", justifyContent: "center" },
  passengerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  passengerPhone: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  seatBadge: { backgroundColor: G_LIGHT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  seatText: { fontSize: 18, fontWeight: "800", color: G },
  seatLabel: { fontSize: 10, color: G, fontWeight: "500", marginTop: 1 },

  tripInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  tripInfoText: { fontSize: 13, color: "#374151", flex: 1 },
  tripTime: { fontSize: 13, fontWeight: "600", color: G },

  validateBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 10 },
  validateBtnDisabled: { opacity: 0.6 },
  validateBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  callBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 10 },
  callBtnText: { color: "#0369A1", fontSize: 13, fontWeight: "600" },

  boardBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: G, borderRadius: 8, paddingVertical: 10 },
  boardBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  retryBtn: { borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, padding: 10, alignItems: "center" },
  retryBtnText: { color: G, fontSize: 14, fontWeight: "500" },

  tips: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 6 },
  tipsTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 4 },
  tip: { fontSize: 13, color: "#6B7280", lineHeight: 20 },

  cameraWrap: { flex: 1, position: "relative" },
  webCamera: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanBox: { width: 220, height: 220, borderWidth: 3, borderColor: "#34D399", borderRadius: 12 },
  cancelScan: { position: "absolute", top: 20, right: 20 },
  scanHint: { position: "absolute", bottom: 40, alignSelf: "center", color: "#fff", fontSize: 14, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
});
