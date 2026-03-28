import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";
import { validateQR, qrErrorMessage } from "@/utils/qr";
import { isAlreadyScanned, markAsScanned } from "@/utils/offline";

const G = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK = "#065F46";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  en_attente:   { bg: "#FEF9C3", text: "#92400E", label: "En attente" },
  confirme:     { bg: "#DBEAFE", text: "#1D4ED8", label: "Confirmé" },
  en_route:     { bg: "#D1FAE5", text: "#065F46", label: "En route" },
  arrive:       { bg: "#F3F4F6", text: "#374151", label: "Arrivé" },
  annule:       { bg: "#FEE2E2", text: "#991B1B", label: "Annulé" },
};

interface ReservationInfo {
  id: string;
  bookingRef: string;
  passengerName: string;
  passengerPhone: string;
  seat: string;
  status: string;
  tripId: string;
  departureCity: string;
  arrivalCity: string;
  departureTime: string;
  price: number;
}

export default function ValidationScreen() {
  const { user, token, logout } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [validated, setValidated] = useState(false);
  const [invalidQR, setInvalidQR] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  if (user && user.role !== "agent") {
    return (
      <SafeAreaView style={styles.denied}>
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text style={styles.deniedText}>Accès réservé aux agents</Text>
      </SafeAreaView>
    );
  }

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanMode(false);

    const qrResult = validateQR(data.trim());
    if (!qrResult.valid) {
      setInvalidQR(qrErrorMessage(qrResult.reason));
      return;
    }
    const ref = qrResult.ref;

    const duplicate = await isAlreadyScanned(ref);
    if (duplicate) {
      setIsDuplicate(true);
      return;
    }

    setScanned(true);
    await markAsScanned(ref);
    await lookupReservation(ref);
  }, [scanned]);

  const lookupReservation = async (ref: string) => {
    setLoading(true);
    setReservation(null);
    setNotFound(false);
    setValidated(false);
    try {
      const res = await apiFetch<ReservationInfo>(`/agent/reservation/${ref.trim()}`, { token: token ?? undefined });
      setReservation(res);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!search.trim()) return;
    lookupReservation(search.trim());
  };

  const handleValidate = async () => {
    if (!reservation) return;
    setValidating(true);
    try {
      await apiFetch(`/agent/reservation/${reservation.id}/confirm`, {
        token: token ?? undefined,
        method: "POST",
      });
      setValidated(true);
      setReservation(prev => prev ? { ...prev, status: "confirme" } : prev);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de valider la réservation");
    } finally {
      setValidating(false);
    }
  };

  const reset = () => {
    setReservation(null);
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
        Alert.alert("Caméra requise", "Autorisez l'accès à la caméra.");
        return;
      }
    }
    setScanned(false);
    setScanMode(true);
  };

  const statusMeta = reservation ? (STATUS_COLORS[reservation.status] ?? { bg: "#F3F4F6", text: "#374151", label: reservation.status }) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Validation</Text>
            <Text style={styles.headerSub}>Confirmer les réservations</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
            hitSlop={8}
            onPress={() => {
              if (Platform.OS === "web") { logout(); return; }
              Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
                { text: "Annuler", style: "cancel" },
                { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {scanMode ? (
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
          <Text style={styles.scanHint}>Pointez vers le QR de la réservation</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rechercher une réservation</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={openCamera}>
              <Ionicons name="qr-code-outline" size={28} color="#fff" />
              <Text style={styles.scanBtnText}>Scanner le QR code</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>ou saisir la référence</Text>
              <View style={styles.divLine} />
            </View>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="Réf. réservation (ex: GB-XXXX)"
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
              <Text style={styles.loadingText}>Recherche…</Text>
            </View>
          )}

          {invalidQR && (
            <View style={[styles.resultCard, { borderColor: "#F87171", borderWidth: 1.5, alignItems: "center" }]}>
              <Ionicons name="qr-code-outline" size={32} color="#EF4444" />
              <Text style={[styles.notFoundText, { color: "#EF4444" }]}>QR invalide</Text>
              <Text style={styles.notFoundSub}>{invalidQR}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]} onPress={reset}>
                <Text style={[styles.retryBtnText, { color: "#DC2626" }]}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {isDuplicate && (
            <View style={[styles.resultCard, { borderColor: "#FCD34D", borderWidth: 1.5, alignItems: "center" }]}>
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
              <Text style={styles.notFoundText}>Réservation introuvable</Text>
              <Text style={styles.notFoundSub}>Vérifiez la référence</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryBtnText}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {reservation && !loading && (
            <View style={[styles.resultCard, validated && styles.validatedCard]}>
              {validated ? (
                <View style={styles.validatedBadge}>
                  <Ionicons name="checkmark-circle" size={40} color={G} />
                  <Text style={styles.validatedText}>Réservation confirmée !</Text>
                </View>
              ) : null}

              <View style={styles.reservationHeader}>
                <View>
                  <Text style={styles.bookingRef}>{reservation.bookingRef}</Text>
                  <Text style={styles.passengerName}>{reservation.passengerName}</Text>
                  <Text style={styles.passengerPhone}>{reservation.passengerPhone}</Text>
                </View>
                {statusMeta && (
                  <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                    <Text style={[styles.statusText, { color: statusMeta.text }]}>
                      {validated ? "Confirmé" : statusMeta.label}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoLabel}>Trajet</Text>
                  <Text style={styles.infoValue}>{reservation.departureCity} → {reservation.arrivalCity}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoLabel}>Départ</Text>
                  <Text style={styles.infoValue}>{reservation.departureTime}</Text>
                </View>
                {reservation.seat ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="accessibility-outline" size={14} color="#6B7280" />
                    <Text style={styles.infoLabel}>Siège</Text>
                    <Text style={[styles.infoValue, { fontWeight: "700", color: G }]}>{reservation.seat}</Text>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoLabel}>Tarif</Text>
                  <Text style={styles.infoValue}>{reservation.price?.toLocaleString()} FCFA</Text>
                </View>
              </View>

              {!validated && reservation.status !== "confirme" && (
                <TouchableOpacity
                  style={[styles.validateBtn, validating && styles.validateBtnDisabled]}
                  onPress={handleValidate}
                  disabled={validating}
                >
                  {validating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                      <Text style={styles.validateBtnText}>Confirmer la réservation</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {(validated || reservation.status === "confirme") && !validating && (
                <View style={styles.alreadyConfirmed}>
                  <Ionicons name="checkmark-done-circle" size={18} color={G} />
                  <Text style={styles.alreadyConfirmedText}>Cette réservation est déjà confirmée</Text>
                </View>
              )}

              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryBtnText}>Rechercher une autre réservation</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Instructions</Text>
            <Text style={styles.tip}>• Scanner le QR ou saisir la référence du billet</Text>
            <Text style={styles.tip}>• Vérifier l'identité du passager</Text>
            <Text style={styles.tip}>• Confirmer uniquement si le paiement est reçu</Text>
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

  header: { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { backgroundColor: G, borderRadius: 10, padding: 8 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#A7F3D0", fontSize: 13, marginTop: 1 },

  scroll: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 16 },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 14 },

  scanBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 14, borderRadius: 10 },
  scanBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  divText: { fontSize: 12, color: "#9CA3AF" },

  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: G_LIGHT },
  searchBtn: { backgroundColor: G, borderRadius: 8, width: 44, alignItems: "center", justifyContent: "center" },

  centerBox: { alignItems: "center", padding: 24, gap: 10 },
  loadingText: { color: "#6B7280", fontSize: 14 },

  resultCard: { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, gap: 14 },
  notFoundCard: { borderWidth: 1.5, borderColor: "#FCA5A5", alignItems: "center" },
  validatedCard: { borderWidth: 2, borderColor: G },

  notFoundText: { fontSize: 16, fontWeight: "700", color: "#EF4444", marginTop: 4 },
  notFoundSub: { fontSize: 13, color: "#6B7280", textAlign: "center" },

  validatedBadge: { alignItems: "center", gap: 6 },
  validatedText: { fontSize: 17, fontWeight: "700", color: G },

  reservationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  bookingRef: { fontSize: 16, fontWeight: "700", color: "#111827" },
  passengerName: { fontSize: 14, color: "#374151", marginTop: 2 },
  passengerPhone: { fontSize: 13, color: "#9CA3AF", marginTop: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: "600" },

  infoGrid: { gap: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoLabel: { fontSize: 13, color: "#6B7280", width: 60 },
  infoValue: { fontSize: 13, color: "#111827", flex: 1 },

  validateBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 10 },
  validateBtnDisabled: { opacity: 0.6 },
  validateBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  alreadyConfirmed: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: G_LIGHT, padding: 10, borderRadius: 8 },
  alreadyConfirmedText: { fontSize: 13, color: G, fontWeight: "500" },

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
