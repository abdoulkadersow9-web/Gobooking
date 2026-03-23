import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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
  message?: string;
}

export default function AgentScan() {
  const { token }         = useAuth();
  const networkStatus     = useNetworkStatus(BASE_URL);
  const [result, setResult]     = useState<ScanResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [inputValue, setInputValue] = useState("");

  const handleCode = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);

    try {
      /* ── Duplicate scan guard ── */
      const already = await isAlreadyScanned(code);
      if (already) {
        setResult({ valid: false, message: "Ce QR code a déjà été scanné." });
        setLoading(false);
        return;
      }

      if (!networkStatus.isOnline) {
        /* ── OFFLINE — queue the scan ── */
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

      /* ── ONLINE — validate with server ── */
      const res = await apiFetch<ScanResult>("/agent/validate-qr", {
        method: "POST",
        token:  token ?? undefined,
        body:   JSON.stringify({ qrCode: code }),
      });
      if (res.valid) await markAsScanned(code);
      setResult(res);
    } catch {
      /* Network error — fall back to offline queue */
      if (code.trim()) {
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
      } else {
        setResult({ valid: false, message: "Code invalide ou expiré" });
      }
    } finally {
      setLoading(false);
    }
  };

  const promptCode = () => {
    if (Platform.OS !== "web" && Alert.prompt) {
      Alert.prompt("Saisir le code QR", "", (txt) => {
        const c = txt?.trim() ?? "";
        if (c) { setManualCode(c); handleCode(c); }
      });
    }
  };

  const isOffline = !networkStatus.isOnline;

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <Pressable onPress={() => router.replace("/agent/home")} style={S.backBtn}>
          <Text style={S.backTxt}>←</Text>
        </Pressable>
        <Text style={S.title}>Scanner QR</Text>
        {isOffline && (
          <View style={S.offlinePill}>
            <Feather name="wifi-off" size={11} color="#fff" />
            <Text style={S.offlinePillTxt}>Hors ligne</Text>
          </View>
        )}
      </View>

      <View style={S.body}>
        {/* Scanner frame */}
        <View style={[S.scanFrame, isOffline && S.scanFrameOffline]}>
          <Feather name="camera" size={48} color={isOffline ? ACCENT : "#9ca3af"} />
          <Text style={S.scanHint}>
            {isOffline
              ? "Mode hors ligne — les scans seront mis en attente"
              : "Utilisez la caméra de votre appareil\nou saisissez le code manuellement"}
          </Text>
        </View>

        {/* Résultat */}
        {result && (
          <View style={[S.resultCard, { borderColor: result.valid ? (result.type === "hors-ligne" ? ACCENT : "#16a34a") : "#dc2626" }]}>
            <Text style={S.resultIcon}>
              {result.valid ? (result.type === "hors-ligne" ? "⏳" : "✅") : "❌"}
            </Text>
            <Text style={[S.resultTitle, {
              color: result.valid
                ? (result.type === "hors-ligne" ? ACCENT : "#16a34a")
                : "#dc2626",
            }]}>
              {result.valid
                ? (result.type === "hors-ligne" ? "En attente de sync" : "QR Code Valide")
                : "QR Code Invalide"}
            </Text>
            {result.valid && result.type !== "hors-ligne" && (
              <>
                {result.passenger     && <Text style={S.resultLine}>👤 {result.passenger}</Text>}
                {result.route         && <Text style={S.resultLine}>🛣️ {result.route}</Text>}
                {result.departure_time && (
                  <Text style={S.resultLine}>
                    🕐 {new Date(result.departure_time).toLocaleString("fr-FR")}
                  </Text>
                )}
                {result.type && <Text style={S.resultLine}>📋 Type : {result.type}</Text>}
              </>
            )}
            {result.message && <Text style={[S.resultLine, { color: "#6b7280", fontStyle: "italic" }]}>{result.message}</Text>}
            <Pressable onPress={() => { setResult(null); setManualCode(""); setInputValue(""); }} style={S.resetBtn}>
              <Text style={S.resetTxt}>Nouveau scan</Text>
            </Pressable>
          </View>
        )}

        {/* Saisie manuelle */}
        {!result && (
          <View style={S.manualSection}>
            <Text style={S.manualLabel}>Code QR manuel</Text>
            <View style={S.manualRow}>
              {Platform.OS === "web" ? (
                <TextInput
                  style={[S.manualInput, S.manualTxtInput]}
                  placeholder="Entrez le code QR…"
                  placeholderTextColor="#9ca3af"
                  value={inputValue}
                  onChangeText={setInputValue}
                  onSubmitEditing={() => { setManualCode(inputValue); handleCode(inputValue); }}
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : (
                <Pressable style={S.manualInput} onPress={promptCode}>
                  <Text style={manualCode ? S.manualTxt : S.manualPlaceholder}>
                    {manualCode || "Appuyez pour saisir un code…"}
                  </Text>
                </Pressable>
              )}
              {(inputValue.length > 0 || manualCode.length > 0) && (
                <Pressable
                  style={[S.validateBtn, loading && { opacity: 0.5 }]}
                  onPress={() => {
                    const c = Platform.OS === "web" ? inputValue : manualCode;
                    setManualCode(c);
                    handleCode(c);
                  }}
                  disabled={loading}
                >
                  <Text style={S.validateTxt}>{loading ? "…" : "Valider"}</Text>
                </Pressable>
              )}
            </View>

            {isOffline && (
              <View style={S.offlineNote}>
                <Feather name="info" size={13} color={ACCENT} />
                <Text style={S.offlineNoteTxt}>
                  Les scans hors ligne seront synchronisés à la reconnexion.
                </Text>
              </View>
            )}

            {networkStatus.pendingCount > 0 && (
              <Pressable onPress={() => router.push("/offline/history")} style={S.historyBtn}>
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
  header:      { backgroundColor: GREEN, flexDirection: "row", alignItems: "center",
                 gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 18,
                 backgroundColor: "rgba(255,255,255,0.2)",
                 justifyContent: "center", alignItems: "center" },
  backTxt:     { fontSize: 18, color: "white", lineHeight: 22 },
  title:       { fontSize: 18, fontWeight: "700", color: "white", flex: 1, letterSpacing: 0.2 },
  offlinePill: { flexDirection: "row", alignItems: "center", gap: 4,
                 backgroundColor: ACCENT, borderRadius: 14,
                 paddingHorizontal: 10, paddingVertical: 4 },
  offlinePillTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },

  body:        { flex: 1, padding: 16, gap: 14 },

  scanFrame:   { backgroundColor: "white", borderRadius: 24, padding: 36,
                 alignItems: "center", gap: 16, borderWidth: 2,
                 borderColor: "#d1fae5", borderStyle: "dashed",
                 shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10,
                 shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  scanFrameOffline: { borderColor: "#fed7aa" },
  scanHint:    { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 20 },

  resultCard:  { backgroundColor: "white", borderRadius: 20, padding: 20, gap: 10,
                 borderWidth: 2, alignItems: "center",
                 shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12,
                 shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  resultIcon:  { fontSize: 44 },
  resultTitle: { fontSize: 18, fontWeight: "700" },
  resultLine:  { fontSize: 14, color: "#374151", textAlign: "center", lineHeight: 20 },
  resetBtn:    { marginTop: 8, backgroundColor: GREEN, borderRadius: 12,
                 paddingHorizontal: 28, paddingVertical: 12 },
  resetTxt:    { color: "white", fontWeight: "700", fontSize: 14 },

  manualSection: { gap: 10 },
  manualLabel:   { fontSize: 14, fontWeight: "700", color: GREEN, letterSpacing: 0.2 },
  manualRow:     { flexDirection: "row", gap: 10 },
  manualInput:   { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 14,
                   borderWidth: 1, borderColor: "#d1fae5",
                   shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6,
                   shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  manualTxtInput:   { fontSize: 14, color: "#111827" },
  manualTxt:        { color: "#111827", fontSize: 14 },
  manualPlaceholder: { color: "#9ca3af", fontSize: 14 },
  validateBtn:  { backgroundColor: ACCENT, borderRadius: 14,
                  paddingHorizontal: 18, justifyContent: "center",
                  shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  validateTxt:  { color: "white", fontWeight: "700", fontSize: 14 },

  offlineNote:  { flexDirection: "row", alignItems: "flex-start", gap: 8,
                  backgroundColor: "#FFF7ED", borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: "#fed7aa" },
  offlineNoteTxt: { fontSize: 12, color: "#92400e", flex: 1, lineHeight: 18 },

  historyBtn:   { flexDirection: "row", alignItems: "center", gap: 8,
                  backgroundColor: "white", borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: "#e5e7eb",
                  shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  historyBtnTxt: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
});
