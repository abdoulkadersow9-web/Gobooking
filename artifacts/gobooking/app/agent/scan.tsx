import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

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
  const { token } = useAuth();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleManualCode = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch<ScanResult>("/agent/validate-qr", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({ qrCode: code }),
      });
      setResult(res);
    } catch {
      setResult({ valid: false, message: "Code invalide ou expiré" });
    } finally {
      setLoading(false);
    }
  };

  const [manualCode, setManualCode] = useState("");

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <Pressable onPress={() => router.replace("/agent/home")} style={S.backBtn}>
          <Text style={S.backTxt}>←</Text>
        </Pressable>
        <Text style={S.title}>Scanner QR</Text>
      </View>

      <View style={S.body}>
        {/* Scanner placeholder */}
        <View style={S.scanFrame}>
          <Text style={S.scanIcon}>📷</Text>
          <Text style={S.scanHint}>
            Utilisez la caméra de votre appareil{"\n"}ou saisissez le code manuellement
          </Text>
        </View>

        {/* Résultat */}
        {result && (
          <View style={[S.resultCard, { borderColor: result.valid ? "#16a34a" : "#dc2626" }]}>
            <Text style={[S.resultIcon]}>{result.valid ? "✅" : "❌"}</Text>
            <Text style={[S.resultTitle, { color: result.valid ? "#16a34a" : "#dc2626" }]}>
              {result.valid ? "QR Code Valide" : "QR Code Invalide"}
            </Text>
            {result.valid && (
              <>
                {result.passenger && <Text style={S.resultLine}>👤 {result.passenger}</Text>}
                {result.route && <Text style={S.resultLine}>🛣️ {result.route}</Text>}
                {result.departure_time && (
                  <Text style={S.resultLine}>
                    🕐 {new Date(result.departure_time).toLocaleString("fr-FR")}
                  </Text>
                )}
                {result.type && <Text style={S.resultLine}>📋 Type : {result.type}</Text>}
              </>
            )}
            {!result.valid && result.message && (
              <Text style={S.resultLine}>{result.message}</Text>
            )}
            <Pressable onPress={() => setResult(null)} style={S.resetBtn}>
              <Text style={S.resetTxt}>Nouveau scan</Text>
            </Pressable>
          </View>
        )}

        {!result && (
          <View style={S.manualSection}>
            <Text style={S.manualLabel}>Code QR manuel</Text>
            <View style={S.manualRow}>
              <Pressable
                style={S.manualInput}
                onPress={() =>
                  Alert.prompt
                    ? Alert.prompt("Saisir le code QR", "", (txt) => {
                        setManualCode(txt ?? "");
                        handleManualCode(txt ?? "");
                      })
                    : Alert.alert("Info", "Scanner disponible sur appareil mobile")
                }
              >
                <Text style={manualCode ? S.manualTxt : S.manualPlaceholder}>
                  {manualCode || "Appuyez pour saisir un code..."}
                </Text>
              </Pressable>
              {manualCode.length > 0 && (
                <Pressable
                  style={[S.validateBtn, loading && { opacity: 0.5 }]}
                  onPress={() => handleManualCode(manualCode)}
                  disabled={loading}
                >
                  <Text style={S.validateTxt}>{loading ? "..." : "Valider"}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#F0FDF4" },
  header:      { backgroundColor: GREEN, flexDirection: "row", alignItems: "center",
                 gap: 12, padding: 16 },
  backBtn:     { padding: 4 },
  backTxt:     { fontSize: 22, color: "white" },
  title:       { fontSize: 20, fontWeight: "700", color: "white" },
  body:        { flex: 1, padding: 20, gap: 20 },
  scanFrame:   { backgroundColor: "white", borderRadius: 20, padding: 40,
                 alignItems: "center", gap: 16, borderWidth: 2,
                 borderColor: "#d1fae5", borderStyle: "dashed" },
  scanIcon:    { fontSize: 56 },
  scanHint:    { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  resultCard:  { backgroundColor: "white", borderRadius: 16, padding: 20, gap: 10,
                 borderWidth: 2, alignItems: "center" },
  resultIcon:  { fontSize: 40 },
  resultTitle: { fontSize: 18, fontWeight: "700" },
  resultLine:  { fontSize: 14, color: "#374151" },
  resetBtn:    { marginTop: 8, backgroundColor: GREEN, borderRadius: 10,
                 paddingHorizontal: 24, paddingVertical: 10 },
  resetTxt:    { color: "white", fontWeight: "600" },
  manualSection:{ gap: 10 },
  manualLabel: { fontSize: 15, fontWeight: "700", color: GREEN },
  manualRow:   { flexDirection: "row", gap: 10 },
  manualInput: { flex: 1, backgroundColor: "white", borderRadius: 12, padding: 14,
                 borderWidth: 1, borderColor: "#d1fae5" },
  manualTxt:   { color: "#111827" },
  manualPlaceholder: { color: "#9ca3af" },
  validateBtn: { backgroundColor: ACCENT, borderRadius: 12,
                 paddingHorizontal: 16, justifyContent: "center" },
  validateTxt: { color: "white", fontWeight: "700" },
});
