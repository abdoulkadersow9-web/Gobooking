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

const G = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK = "#065F46";

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

export default function EmbarquementScreen() {
  const { user, token } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [found, setFound] = useState<Passenger | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [validated, setValidated] = useState(false);

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
    setScanned(true);
    setScanMode(false);
    await lookupPassenger(data);
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

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
          <Text style={styles.scanHint}>Pointez vers le QR du billet</Text>
        </View>
      ) : (
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
