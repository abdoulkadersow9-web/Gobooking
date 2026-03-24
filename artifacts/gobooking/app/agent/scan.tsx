import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import {
  generateOfflineId,
  isAlreadyScanned,
  markAsScanned,
  saveOffline,
  useNetworkStatus,
} from "@/utils/offline";

const GREEN  = "#166534";
const ACCENT = "#FF6B00";

interface ScanResult {
  valid: boolean;
  type?: string;
  passenger?: string;
  route?: string;
  departure_time?: string;
  seats?: string;
  message?: string;
}

export default function AgentScan() {
  const { token }                   = useAuth();
  const networkStatus               = useNetworkStatus(BASE_URL);
  const [permission, requestPerm]   = useCameraPermissions();
  const [result, setResult]         = useState<ScanResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode]             = useState<"camera" | "manual">("camera");
  const scannedRef                  = useRef(false);

  const isOffline = !networkStatus.isOnline;

  const handleCode = async (code: string) => {
    if (!code.trim() || loading) return;
    setLoading(true);

    try {
      const already = await isAlreadyScanned(code);
      if (already) {
        setResult({ valid: false, message: "Ce QR code a déjà été scanné." });
        return;
      }

      if (!networkStatus.isOnline) {
        const id = generateOfflineId();
        await saveOffline({
          id,
          type:      "scan",
          token:     token ?? "",
          createdAt: Date.now(),
          payload:   { reservationId: code },
        });
        await markAsScanned(code);
        setResult({
          valid:   true,
          message: "Scan sauvegardé hors ligne. Sera validé dès la reconnexion.",
          type:    "hors-ligne",
        });
        return;
      }

      const res = await apiFetch<ScanResult>("/agent/validate-qr", {
        method: "POST",
        token:  token ?? undefined,
        body:   JSON.stringify({ qrCode: code }),
      });
      if (res.valid) await markAsScanned(code);
      setResult(res);
    } catch {
      const id = generateOfflineId();
      await saveOffline({
        id,
        type:      "scan",
        token:     token ?? "",
        createdAt: Date.now(),
        payload:   { reservationId: code },
      });
      await markAsScanned(code);
      setResult({
        valid:   true,
        message: "Scan sauvegardé hors ligne suite à une erreur réseau.",
        type:    "hors-ligne",
      });
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current || result) return;
    scannedRef.current = true;
    handleCode(data);
  };

  const reset = () => {
    setResult(null);
    setInputValue("");
    scannedRef.current = false;
  };

  /* ── Camera permission request ── */
  if (mode === "camera" && !permission) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.center}>
          <Text style={S.hintTxt}>Vérification des permissions caméra…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const needPerm = mode === "camera" && !permission?.granted;

  return (
    <SafeAreaView style={S.safe}>
      {/* Header */}
      <View style={S.header}>
        <Pressable onPress={() => router.replace("/agent/home")} style={S.backBtn}>
          <Feather name="arrow-left" size={18} color="white" />
        </Pressable>
        <Text style={S.title}>Scanner QR</Text>
        {isOffline && (
          <View style={S.offlinePill}>
            <Feather name="wifi-off" size={11} color="#fff" />
            <Text style={S.offlinePillTxt}>Hors ligne</Text>
          </View>
        )}
      </View>

      {/* Mode toggle */}
      <View style={S.modeBar}>
        {(["camera", "manual"] as const).map(m => (
          <Pressable
            key={m}
            style={[S.modeBtn, mode === m && S.modeBtnActive]}
            onPress={() => { setMode(m); reset(); }}
          >
            <Feather name={m === "camera" ? "camera" : "edit-2"} size={14} color={mode === m ? GREEN : "#6b7280"} />
            <Text style={[S.modeTxt, mode === m && S.modeTxtActive]}>
              {m === "camera" ? "Caméra" : "Manuel"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={S.body}>
        {/* Result card */}
        {result && (
          <View style={[S.resultCard, { borderColor: result.valid ? (result.type === "hors-ligne" ? ACCENT : "#16a34a") : "#dc2626" }]}>
            <Text style={S.resultIcon}>
              {result.valid ? (result.type === "hors-ligne" ? "⏳" : "✅") : "❌"}
            </Text>
            <Text style={[S.resultTitle, { color: result.valid ? (result.type === "hors-ligne" ? ACCENT : "#16a34a") : "#dc2626" }]}>
              {result.valid
                ? (result.type === "hors-ligne" ? "En attente de sync" : "Embarquement validé !")
                : (result.message?.includes("déjà utilisé") ? "Billet déjà utilisé" : "Billet invalide")}
            </Text>
            {result.valid && result.type !== "hors-ligne" && (
              <>
                {result.passenger      && <Text style={S.resultLine}>👤 {result.passenger}</Text>}
                {result.route          && <Text style={S.resultLine}>🛣️ {result.route}</Text>}
                {result.departure_time && <Text style={S.resultLine}>🕐 {result.departure_time}</Text>}
                {result.seats          && <Text style={S.resultLine}>💺 Siège(s) : {result.seats}</Text>}
              </>
            )}
            {result.message && (
              <Text style={[S.resultLine, { color: "#6b7280", fontStyle: "italic" }]}>{result.message}</Text>
            )}
            <Pressable onPress={reset} style={S.resetBtn}>
              <Feather name="refresh-ccw" size={14} color="white" />
              <Text style={S.resetTxt}>Nouveau scan</Text>
            </Pressable>
          </View>
        )}

        {/* Camera mode */}
        {!result && mode === "camera" && (
          needPerm ? (
            <View style={S.permBox}>
              <Feather name="camera-off" size={40} color="#9ca3af" />
              <Text style={S.permTitle}>Accès caméra requis</Text>
              <Text style={S.permSub}>Pour scanner les QR codes des billets</Text>
              <Pressable style={S.permBtn} onPress={requestPerm}>
                <Text style={S.permBtnTxt}>Autoriser la caméra</Text>
              </Pressable>
            </View>
          ) : (
            <View style={S.cameraWrap}>
              {isOffline && (
                <View style={S.offlineBanner}>
                  <Feather name="wifi-off" size={13} color="#fff" />
                  <Text style={S.offlineBannerTxt}>Mode hors ligne — scans mis en attente</Text>
                </View>
              )}
              <CameraView
                style={S.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={!result ? onBarcodeScanned : undefined}
              />
              {/* Scan overlay frame */}
              <View style={S.overlay}>
                <View style={S.overlayTop} />
                <View style={S.overlayMiddle}>
                  <View style={S.overlaySide} />
                  <View style={[S.scanBox, loading && S.scanBoxLoading]}>
                    <View style={[S.corner, S.cornerTL]} />
                    <View style={[S.corner, S.cornerTR]} />
                    <View style={[S.corner, S.cornerBL]} />
                    <View style={[S.corner, S.cornerBR]} />
                    {loading && (
                      <View style={S.scanLoading}>
                        <Text style={S.scanLoadingTxt}>Validation…</Text>
                      </View>
                    )}
                  </View>
                  <View style={S.overlaySide} />
                </View>
                <View style={S.overlayBottom}>
                  <Text style={S.cameraHint}>Alignez le QR code dans le cadre</Text>
                </View>
              </View>
            </View>
          )
        )}

        {/* Manual mode */}
        {!result && mode === "manual" && (
          <View style={S.manualSection}>
            <View style={S.manualBox}>
              <Feather name="hash" size={20} color="#9ca3af" style={{ marginBottom: 12 }} />
              <Text style={S.manualTitle}>Saisie manuelle</Text>
              <Text style={S.manualSub}>Entrez la référence du billet</Text>
              <TextInput
                style={S.manualInput}
                placeholder="Ex: BK-2024-XXXXX"
                placeholderTextColor="#9ca3af"
                value={inputValue}
                onChangeText={setInputValue}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => handleCode(inputValue)}
              />
              <Pressable
                style={[S.validateBtn, (!inputValue.trim() || loading) && { opacity: 0.45 }]}
                onPress={() => handleCode(inputValue)}
                disabled={!inputValue.trim() || loading}
              >
                <Feather name="check-circle" size={16} color="white" />
                <Text style={S.validateTxt}>{loading ? "Validation…" : "Valider"}</Text>
              </Pressable>
            </View>

            {networkStatus.pendingCount > 0 && (
              <Pressable onPress={() => router.push("/offline/history" as never)} style={S.historyBtn}>
                <Feather name="clock" size={13} color="#6b7280" />
                <Text style={S.historyBtnTxt}>
                  {networkStatus.pendingCount} scan{networkStatus.pendingCount > 1 ? "s" : ""} en attente · Voir l'historique
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#F0FDF4" },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  hintTxt:     { color: "#6b7280", fontSize: 14 },

  header:      { backgroundColor: GREEN, flexDirection: "row", alignItems: "center",
                 gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 18,
                 backgroundColor: "rgba(255,255,255,0.2)",
                 justifyContent: "center", alignItems: "center" },
  title:       { fontSize: 18, fontWeight: "700", color: "white", flex: 1, letterSpacing: 0.2 },
  offlinePill: { flexDirection: "row", alignItems: "center", gap: 4,
                 backgroundColor: ACCENT, borderRadius: 14,
                 paddingHorizontal: 10, paddingVertical: 4 },
  offlinePillTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },

  modeBar:     { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  modeBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                 gap: 6, paddingVertical: 12 },
  modeBtnActive: { borderBottomWidth: 2.5, borderBottomColor: GREEN },
  modeTxt:     { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  modeTxtActive: { color: GREEN },

  body:        { flex: 1 },

  resultCard:  { margin: 16, backgroundColor: "white", borderRadius: 20, padding: 20, gap: 10,
                 borderWidth: 2, alignItems: "center",
                 shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12,
                 shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  resultIcon:  { fontSize: 48 },
  resultTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  resultLine:  { fontSize: 14, color: "#374151", textAlign: "center", lineHeight: 20 },
  resetBtn:    { marginTop: 8, backgroundColor: GREEN, borderRadius: 12, flexDirection: "row",
                 alignItems: "center", gap: 8,
                 paddingHorizontal: 24, paddingVertical: 12 },
  resetTxt:    { color: "white", fontWeight: "700", fontSize: 14 },

  /* Camera */
  cameraWrap:  { flex: 1, position: "relative" },
  offlineBanner: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
                   backgroundColor: ACCENT, flexDirection: "row", alignItems: "center",
                   gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  offlineBannerTxt: { color: "white", fontWeight: "700", fontSize: 13 },
  camera:      { flex: 1 },
  overlay:     { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  overlayTop:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  overlayMiddle: { flexDirection: "row", height: 260 },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  overlayBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", paddingTop: 16 },
  cameraHint:  { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "500" },

  scanBox:     { width: 260, height: 260, position: "relative", alignItems: "center", justifyContent: "center" },
  scanBoxLoading: { opacity: 0.7 },
  corner:      { position: "absolute", width: 30, height: 30, borderColor: "#16a34a", borderWidth: 4 },
  cornerTL:    { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR:    { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL:    { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR:    { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLoading: { backgroundColor: "rgba(22,163,74,0.9)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  scanLoadingTxt: { color: "white", fontWeight: "700", fontSize: 13 },

  /* Permission */
  permBox:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  permTitle:   { fontSize: 18, fontWeight: "700", color: "#111827" },
  permSub:     { fontSize: 14, color: "#6b7280", textAlign: "center" },
  permBtn:     { backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  permBtnTxt:  { color: "white", fontWeight: "700", fontSize: 15 },

  /* Manual */
  manualSection: { flex: 1, padding: 16, gap: 12 },
  manualBox:   { backgroundColor: "white", borderRadius: 20, padding: 24, alignItems: "center",
                 gap: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  manualTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginTop: 4 },
  manualSub:   { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  manualInput: { width: "100%", backgroundColor: "#F9FAFB", borderRadius: 14, padding: 16,
                 borderWidth: 1.5, borderColor: "#d1fae5", fontSize: 16,
                 fontWeight: "600", color: "#111827", textAlign: "center", letterSpacing: 2, marginBottom: 12 },
  validateBtn: { flexDirection: "row", alignItems: "center", gap: 8,
                 backgroundColor: GREEN, borderRadius: 14,
                 paddingHorizontal: 28, paddingVertical: 14 },
  validateTxt: { color: "white", fontWeight: "700", fontSize: 15 },

  historyBtn:  { flexDirection: "row", alignItems: "center", gap: 8,
                 backgroundColor: "white", borderRadius: 14, padding: 14,
                 borderWidth: 1, borderColor: "#e5e7eb" },
  historyBtnTxt: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
});
