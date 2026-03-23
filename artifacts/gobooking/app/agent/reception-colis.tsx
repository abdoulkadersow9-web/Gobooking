import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import { saveOffline, useNetworkStatus } from "@/utils/offline";
import OfflineBanner from "@/components/OfflineBanner";

const G = "#059669";
const G_LIGHT = "#ECFDF5";
const G_DARK = "#065F46";

const PARCEL_STATUS_LABELS: Record<string, string> = {
  en_attente:           "En attente",
  confirme:             "Confirmé",
  en_cours_ramassage:   "Ramassage en cours",
  arrive_gare_depart:   "Arrivé gare départ",
  pris_en_charge:       "Pris en charge",
  en_transit:           "En transit",
  arrive_destination:   "Arrivé à destination",
  en_livraison:         "En livraison",
  livre:                "Livré",
};

interface ColisInfo {
  id: string;
  trackingRef: string;
  senderName: string;
  receiverName: string;
  receiverPhone: string;
  description: string;
  weight?: number;
  status: string;
  fromCity: string;
  toCity: string;
}

export default function ReceptionColisScreen() {
  const { user, token } = useAuth();
  const networkStatus   = useNetworkStatus(BASE_URL);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [colis, setColis] = useState<ColisInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

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
    await lookupColis(data);
  }, [scanned]);

  const lookupColis = async (ref: string) => {
    setLoading(true);
    setColis(null);
    setNotFound(false);
    setConfirmed(false);
    try {
      const res = await apiFetch(`/parcels/track/${ref.trim()}`, { token: token ?? undefined });
      setColis(res);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!search.trim()) return;
    lookupColis(search.trim());
  };

  const handleConfirmArrival = async () => {
    if (!colis) return;
    setConfirming(true);
    try {
      if (!networkStatus.isOnline) {
        await saveOffline({
          type: "colis_arrive",
          payload: { colisId: colis.id, trackingRef: colis.trackingRef },
          token: token ?? "",
          createdAt: Date.now(),
        });
        setConfirmed(true);
        setColis(prev => prev ? { ...prev, status: "arrive_gare_depart" } : prev);
        return;
      }
      await apiFetch(`/agent/parcels/${colis.id}/arrive`, {
        token: token ?? undefined,
        method: "POST",
      });
      setConfirmed(true);
      setColis(prev => prev ? { ...prev, status: "arrive_gare_depart" } : prev);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de confirmer l'arrivée");
    } finally {
      setConfirming(false);
    }
  };

  const reset = () => {
    setColis(null);
    setNotFound(false);
    setConfirmed(false);
    setScanned(false);
    setSearch("");
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Caméra requise", "Autorisez l'accès à la caméra pour scanner les colis.");
        return;
      }
    }
    setScanned(false);
    setScanMode(true);
  };

  const statusLabel = colis ? (PARCEL_STATUS_LABELS[colis.status] ?? colis.status) : "";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      <OfflineBanner status={networkStatus} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="cube" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Réception Colis</Text>
            <Text style={styles.headerSub}>
              {networkStatus.isOnline ? "Confirmer l'arrivée des colis" : "⚡ Mode hors ligne actif"}
            </Text>
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
          <Text style={styles.scanHint}>Pointez vers le QR du colis</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scanner un colis</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={openCamera}>
              <Ionicons name="qr-code-outline" size={28} color="#fff" />
              <Text style={styles.scanBtnText}>Ouvrir le scanner QR</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>ou saisir la référence</Text>
              <View style={styles.divLine} />
            </View>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="Référence de suivi (ex: GB-XXXX)"
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
              <Text style={styles.loadingText}>Recherche du colis…</Text>
            </View>
          )}

          {notFound && !loading && (
            <View style={[styles.resultCard, styles.notFoundCard]}>
              <Ionicons name="close-circle" size={32} color="#EF4444" />
              <Text style={styles.notFoundText}>Colis introuvable</Text>
              <Text style={styles.notFoundSub}>Vérifiez la référence de suivi</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryBtnText}>Recommencer</Text>
              </TouchableOpacity>
            </View>
          )}

          {colis && !loading && (
            <View style={[styles.resultCard, confirmed && styles.confirmedCard]}>
              {confirmed ? (
                <View style={styles.confirmedBadge}>
                  <Ionicons name="checkmark-circle" size={40} color={G} />
                  <Text style={styles.confirmedText}>Arrivée confirmée !</Text>
                </View>
              ) : null}

              <View style={styles.colisHeader}>
                <View style={styles.colisIcon}>
                  <Ionicons name="cube" size={26} color={G} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackingRef}>{colis.trackingRef}</Text>
                  <Text style={styles.colisDesc}>{colis.description}</Text>
                </View>
                <View style={[styles.statusBadge, confirmed && styles.statusBadgeGreen]}>
                  <Text style={[styles.statusText, confirmed && styles.statusTextGreen]}>
                    {confirmed ? "Arrivé gare" : statusLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoLabel}>Expéditeur</Text>
                  <Text style={styles.infoValue}>{colis.senderName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={14} color="#6B7280" />
                  <Text style={styles.infoLabel}>Destinataire</Text>
                  <Text style={styles.infoValue}>{colis.receiverName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoLabel}>Tél. dest.</Text>
                  <Text style={styles.infoValue}>{colis.receiverPhone}</Text>
                </View>
                {colis.weight ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="scale-outline" size={14} color="#6B7280" />
                    <Text style={styles.infoLabel}>Poids</Text>
                    <Text style={styles.infoValue}>{colis.weight} kg</Text>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoLabel}>Trajet</Text>
                  <Text style={styles.infoValue}>{colis.fromCity} → {colis.toCity}</Text>
                </View>
              </View>

              {!confirmed && (
                <TouchableOpacity
                  style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
                  onPress={handleConfirmArrival}
                  disabled={confirming}
                >
                  {confirming ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.confirmBtnText}>Confirmer l'arrivée en gare</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryBtnText}>Scanner un autre colis</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Instructions</Text>
            <Text style={styles.tip}>• Scanner le QR ou saisir la référence de suivi</Text>
            <Text style={styles.tip}>• Vérifier le contenu si nécessaire</Text>
            <Text style={styles.tip}>• Confirmer l'arrivée pour notifier l'expéditeur</Text>
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
  confirmedCard: { borderWidth: 2, borderColor: G },

  notFoundText: { fontSize: 16, fontWeight: "700", color: "#EF4444", marginTop: 4 },
  notFoundSub: { fontSize: 13, color: "#6B7280", textAlign: "center" },

  confirmedBadge: { alignItems: "center", gap: 6 },
  confirmedText: { fontSize: 17, fontWeight: "700", color: G },

  colisHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  colisIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: G_LIGHT, alignItems: "center", justifyContent: "center" },
  trackingRef: { fontSize: 15, fontWeight: "700", color: "#111827" },
  colisDesc: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  statusBadge: { backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeGreen: { backgroundColor: G_LIGHT },
  statusText: { fontSize: 11, fontWeight: "600", color: "#D97706" },
  statusTextGreen: { color: G },

  infoGrid: { gap: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoLabel: { fontSize: 13, color: "#6B7280", width: 90 },
  infoValue: { fontSize: 13, fontWeight: "500", color: "#111827", flex: 1 },

  confirmBtn: { backgroundColor: G, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 10 },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

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
