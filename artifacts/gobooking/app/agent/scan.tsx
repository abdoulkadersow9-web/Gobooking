import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import {
  generateOfflineId,
  isAlreadyScanned,
  markAsScanned,
  saveOffline,
  useNetworkStatus,
} from "@/utils/offline";

/* ─── Constants ─────────────────────────────────────────────────── */
const GREEN_DARK   = "#14532D";
const GREEN_BG     = "#166534";
const GREEN_LIGHT  = "#DCFCE7";
const GREEN_MID    = "#16a34a";
const RED_DARK     = "#7F1D1D";
const RED_BG       = "#B91C1C";
const RED_LIGHT    = "#FEE2E2";
const AMBER        = "#FF6B00";
const AMBER_BG     = "#D97706";

/* ─── Types ─────────────────────────────────────────────────────── */
type ResultStatus = "valid" | "already_used" | "invalid" | "offline";

interface ScanResult {
  status: ResultStatus;
  passenger?: string;
  route?: string;
  departure_time?: string;
  seats?: string;
  message?: string;
}

/* ─── Helper ─────────────────────────────────────────────────────── */
function classifyResult(raw: { valid: boolean; type?: string; message?: string }): ResultStatus {
  if (!raw.valid) {
    if (raw.message?.includes("déjà utilisé")) return "already_used";
    return "invalid";
  }
  if (raw.type === "hors-ligne") return "offline";
  return "valid";
}

/* ─── Result overlay config ─────────────────────────────────────── */
const RESULT_CONFIG: Record<ResultStatus, {
  bg: string; light: string; icon: string; featherIcon: React.ComponentProps<typeof Feather>["name"];
  title: string; subtitle: string;
}> = {
  valid: {
    bg:          GREEN_BG,
    light:       GREEN_LIGHT,
    icon:        "ok",
    featherIcon: "check-circle",
    title:       "Embarquement validé",
    subtitle:    "Le passager peut embarquer",
  },
  already_used: {
    bg:          RED_BG,
    light:       RED_LIGHT,
    icon:        "used",
    featherIcon: "x-circle",
    title:       "Billet déjà utilisé",
    subtitle:    "Ce passager a déjà été enregistré",
  },
  invalid: {
    bg:          RED_BG,
    light:       RED_LIGHT,
    icon:        "invalid",
    featherIcon: "alert-circle",
    title:       "Billet invalide",
    subtitle:    "Référence introuvable ou QR falsifié",
  },
  offline: {
    bg:          AMBER_BG,
    light:       "#FEF3C7",
    icon:        "offline",
    featherIcon: "wifi-off",
    title:       "Scan hors ligne",
    subtitle:    "Sera validé à la reconnexion",
  },
};

/* ═══════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════ */
export default function AgentScan() {
  const { token, logoutIfActiveToken } = useAuth();
  const insets                      = useSafeAreaInsets();
  const networkStatus               = useNetworkStatus(BASE_URL);
  const [permission, requestPerm]   = useCameraPermissions();
  const [result, setResult]         = useState<ScanResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode]             = useState<"camera" | "manual">("camera");
  const scannedRef                  = useRef(false);
  const pulseAnim                   = useRef(new Animated.Value(1)).current;

  const isOffline = !networkStatus.isOnline;

  /* ── Pulse animation on result ── */
  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.96, duration: 80,  easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  };

  /* ── Core scan handler ── */
  const handleCode = async (code: string) => {
    if (!code.trim() || loading) return;
    setLoading(true);

    try {
      const already = await isAlreadyScanned(code);
      if (already) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setResult({ status: "already_used", message: "Ce QR a déjà été scanné sur cet appareil." });
        triggerPulse();
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResult({ status: "offline", message: "Sera synchronisé dès la reconnexion." });
        triggerPulse();
        return;
      }

      const res = await apiFetch<{
        valid: boolean; type?: string; passenger?: string;
        route?: string; departure_time?: string; seats?: string; message?: string;
      }>("/agent/validate-qr", {
        method: "POST",
        token:  token ?? undefined,
        body:   JSON.stringify({ qrCode: code }),
      });

      const status = classifyResult(res);
      if (status === "valid") {
        await markAsScanned(code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (status === "already_used") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      setResult({
        status,
        passenger:      res.passenger,
        route:          res.route,
        departure_time: res.departure_time,
        seats:          res.seats,
        message:        res.message,
      });
      triggerPulse();
    } catch (e: any) {
      if (e?.httpStatus === 401 || e?.httpStatus === 403) {
        logoutIfActiveToken(token ?? ""); return;
      }
      const id = generateOfflineId();
      await saveOffline({
        id, type: "scan", token: token ?? "", createdAt: Date.now(),
        payload: { reservationId: code },
      });
      await markAsScanned(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setResult({ status: "offline", message: "Erreur réseau — scan mis en attente." });
      triggerPulse();
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current || result || loading) return;
    scannedRef.current = true;
    handleCode(data);
  };

  const reset = () => {
    setResult(null);
    setInputValue("");
    scannedRef.current = false;
  };

  /* ── Camera permission loading ── */
  if (mode === "camera" && !permission) {
    return (
      <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
        <View style={S.center}>
          <Text style={S.hintTxt}>Vérification des permissions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const needPerm = mode === "camera" && !permission?.granted;

  /* ═══════════════════════════════════════════════════════════════
     RESULT SCREEN — full-color overlay
  ═══════════════════════════════════════════════════════════════ */
  if (result) {
    const cfg = RESULT_CONFIG[result.status];
    const isSuccess = result.status === "valid";
    const isError   = result.status === "invalid" || result.status === "already_used";

    return (
      <View style={[S.resultScreen, { backgroundColor: cfg.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* Close / back */}
        <View style={S.resultTopBar}>
          <Pressable onPress={reset} style={S.resultCloseBtn}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>

        {/* Icon circle */}
        <Animated.View style={[S.iconCircle, { transform: [{ scale: pulseAnim }] },
          { backgroundColor: isSuccess ? "rgba(255,255,255,0.2)" : isError ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.2)" }
        ]}>
          <Feather
            name={cfg.featherIcon}
            size={72}
            color="white"
          />
        </Animated.View>

        {/* Title */}
        <Text style={S.resultMainTitle}>{cfg.title}</Text>
        <Text style={S.resultSubtitle}>{cfg.subtitle}</Text>

        {/* Details card — only for valid */}
        {(result.passenger || result.route || result.seats) && (
          <View style={S.detailCard}>
            {result.passenger && (
              <View style={S.detailRow}>
                <View style={[S.detailIconBox, { backgroundColor: isSuccess ? GREEN_LIGHT : RED_LIGHT }]}>
                  <Feather name="user" size={16} color={isSuccess ? GREEN_MID : RED_BG} />
                </View>
                <View style={S.detailText}>
                  <Text style={S.detailLabel}>Passager</Text>
                  <Text style={S.detailValue}>{result.passenger}</Text>
                </View>
              </View>
            )}
            {result.route && (
              <View style={S.detailRow}>
                <View style={[S.detailIconBox, { backgroundColor: isSuccess ? GREEN_LIGHT : RED_LIGHT }]}>
                  <Feather name="map-pin" size={16} color={isSuccess ? GREEN_MID : RED_BG} />
                </View>
                <View style={S.detailText}>
                  <Text style={S.detailLabel}>Trajet</Text>
                  <Text style={S.detailValue}>{result.route}</Text>
                </View>
              </View>
            )}
            {result.departure_time && (
              <View style={S.detailRow}>
                <View style={[S.detailIconBox, { backgroundColor: isSuccess ? GREEN_LIGHT : RED_LIGHT }]}>
                  <Feather name="clock" size={16} color={isSuccess ? GREEN_MID : RED_BG} />
                </View>
                <View style={S.detailText}>
                  <Text style={S.detailLabel}>Départ</Text>
                  <Text style={S.detailValue}>{result.departure_time}</Text>
                </View>
              </View>
            )}
            {result.seats && (
              <View style={[S.detailRow, { borderBottomWidth: 0 }]}>
                <View style={[S.detailIconBox, { backgroundColor: isSuccess ? GREEN_LIGHT : RED_LIGHT }]}>
                  <Feather name="grid" size={16} color={isSuccess ? GREEN_MID : RED_BG} />
                </View>
                <View style={S.detailText}>
                  <Text style={S.detailLabel}>Siège(s)</Text>
                  <Text style={S.detailValue}>{result.seats}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Extra message (offline / error detail) */}
        {result.message && result.status !== "valid" && (
          <View style={S.messageBox}>
            <Text style={S.messageTxt}>{result.message}</Text>
          </View>
        )}

        {/* New scan button */}
        <Pressable
          onPress={reset}
          style={({ pressed }) => [S.newScanBtn, pressed && { opacity: 0.85 }]}
        >
          <Feather name="camera" size={18} color={cfg.bg} />
          <Text style={[S.newScanTxt, { color: cfg.bg }]}>Nouveau scan</Text>
        </Pressable>

      </View>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SCANNER SCREEN
  ═══════════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_BG} />
      {/* Header */}
      <View style={S.header}>
        <Pressable onPress={() => router.replace("/agent/home")} style={S.backBtn} hitSlop={8}>
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
            <Feather name={m === "camera" ? "camera" : "edit-2"} size={14} color={mode === m ? GREEN_BG : "#6b7280"} />
            <Text style={[S.modeTxt, mode === m && S.modeTxtActive]}>
              {m === "camera" ? "Caméra" : "Manuel"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={S.body}>
        {/* Camera mode */}
        {mode === "camera" && (
          needPerm ? (
            <View style={S.permBox}>
              <View style={S.permIconCircle}>
                <Feather name="camera-off" size={36} color="#6b7280" />
              </View>
              <Text style={S.permTitle}>Caméra requise</Text>
              <Text style={S.permSub}>Autorisez l'accès caméra pour scanner les billets QR</Text>
              <Pressable style={S.permBtn} onPress={requestPerm}>
                <Feather name="camera" size={16} color="white" />
                <Text style={S.permBtnTxt}>Autoriser la caméra</Text>
              </Pressable>
            </View>
          ) : (
            <View style={S.cameraWrap}>
              {isOffline && (
                <View style={S.offlineBanner}>
                  <Feather name="wifi-off" size={13} color="#fff" />
                  <Text style={S.offlineBannerTxt}>Hors ligne — scans mis en attente</Text>
                </View>
              )}
              <CameraView
                style={S.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={!result ? onBarcodeScanned : undefined}
              />
              {/* Scanner overlay */}
              <View style={S.overlay}>
                <View style={S.overlayTop} />
                <View style={S.overlayMiddle}>
                  <View style={S.overlaySide} />
                  <View style={[S.scanBox, loading && S.scanBoxLoading]}>
                    {/* Corner markers */}
                    <View style={[S.corner, S.cornerTL]} />
                    <View style={[S.corner, S.cornerTR]} />
                    <View style={[S.corner, S.cornerBL]} />
                    <View style={[S.corner, S.cornerBR]} />
                    {loading ? (
                      <View style={S.scanLoading}>
                        <Text style={S.scanLoadingTxt}>Validation en cours…</Text>
                      </View>
                    ) : (
                      <View style={S.scanIdle}>
                        <Feather name="maximize" size={22} color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                  </View>
                  <View style={S.overlaySide} />
                </View>
                <View style={S.overlayBottom}>
                  <View style={S.hintPill}>
                    <Feather name="zap" size={13} color="rgba(255,255,255,0.9)" />
                    <Text style={S.cameraHint}>Alignez le QR code dans le cadre</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        )}

        {/* Manual mode */}
        {mode === "manual" && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={S.manualSection} keyboardShouldPersistTaps="handled">
            <View style={S.manualBox}>
              <View style={S.manualIconCircle}>
                <Feather name="hash" size={28} color={GREEN_BG} />
              </View>
              <Text style={S.manualTitle}>Saisie manuelle</Text>
              <Text style={S.manualSub}>Entrez la référence du billet si le QR ne fonctionne pas</Text>
              <TextInput
                style={S.manualInput}
                placeholder="Ex: GBB-2024-XXXXX"
                placeholderTextColor="#9ca3af"
                value={inputValue}
                onChangeText={setInputValue}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (inputValue.trim()) {
                    handleCode(inputValue.trim());
                    setInputValue("");
                  }
                }}
              />
              <Pressable
                style={({ pressed }) => [S.validateBtn, (!inputValue.trim() || loading) && S.validateBtnDisabled, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  if (inputValue.trim() && !loading) {
                    handleCode(inputValue.trim());
                    setInputValue("");
                  }
                }}
                disabled={!inputValue.trim() || loading}
              >
                <Feather name={loading ? "loader" : "check-circle"} size={16} color="white" />
                <Text style={S.validateTxt}>{loading ? "Validation…" : "Valider le billet"}</Text>
              </Pressable>
            </View>

            {/* Info notice */}
            <View style={S.noticeBox}>
              <Feather name="shield" size={14} color={GREEN_BG} />
              <Text style={S.noticeTxt}>
                Les billets sont cryptographiquement signés. Toute modification invalide automatiquement le QR code.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════════════════════ */
const S = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#F0FDF4" },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  hintTxt:     { color: "#6b7280", fontSize: 14 },

  /* Header */
  header:      { backgroundColor: GREEN_BG, flexDirection: "row", alignItems: "center",
                 gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 18,
                 backgroundColor: "rgba(255,255,255,0.2)",
                 justifyContent: "center", alignItems: "center" },
  title:       { fontSize: 18, fontWeight: "700", color: "white", flex: 1, letterSpacing: 0.2 },
  offlinePill: { flexDirection: "row", alignItems: "center", gap: 4,
                 backgroundColor: AMBER, borderRadius: 14,
                 paddingHorizontal: 10, paddingVertical: 4 },
  offlinePillTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },

  /* Mode bar */
  modeBar:     { flexDirection: "row", backgroundColor: "white",
                 borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  modeBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                 gap: 6, paddingVertical: 13 },
  modeBtnActive: { borderBottomWidth: 2.5, borderBottomColor: GREEN_BG },
  modeTxt:     { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  modeTxtActive: { color: GREEN_BG },

  body:        { flex: 1 },

  /* ── Result full-screen ── */
  resultScreen: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28,
  },
  resultTopBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    alignItems: "flex-end",
  },
  resultCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  iconCircle: {
    width: 140, height: 140, borderRadius: 70,
    justifyContent: "center", alignItems: "center",
    marginBottom: 24,
  },
  resultMainTitle: {
    fontSize: 28, fontWeight: "800", color: "white",
    textAlign: "center", letterSpacing: -0.5, marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 15, color: "rgba(255,255,255,0.8)",
    textAlign: "center", marginBottom: 28,
  },

  /* Detail card */
  detailCard: {
    width: "100%", backgroundColor: "white", borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 4, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  detailRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  detailIconBox: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  detailText: { flex: 1 },
  detailLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "600",
                 textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontSize: 15, color: "#111827", fontWeight: "700" },

  /* Message box (errors/offline) */
  messageBox: {
    width: "100%", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
  },
  messageTxt: {
    color: "rgba(255,255,255,0.9)", fontSize: 13, textAlign: "center", lineHeight: 19,
  },

  /* New scan button */
  newScanBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "white", borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 16,
    marginTop: 8,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  newScanTxt: { fontSize: 16, fontWeight: "700" },

  /* Camera */
  cameraWrap:  { flex: 1, position: "relative" },
  offlineBanner: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
                   backgroundColor: AMBER, flexDirection: "row", alignItems: "center",
                   gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  offlineBannerTxt: { color: "white", fontWeight: "700", fontSize: 13 },
  camera:      { flex: 1 },
  overlay:     { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  overlayTop:  { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  overlayMiddle: { flexDirection: "row", height: 260 },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  overlayBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
                   alignItems: "center", justifyContent: "center" },

  cameraHint:  { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500" },
  hintPill:    { flexDirection: "row", alignItems: "center", gap: 6,
                 backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 20,
                 paddingHorizontal: 14, paddingVertical: 8 },

  scanBox:     { width: 260, height: 260, position: "relative",
                 alignItems: "center", justifyContent: "center" },
  scanBoxLoading: { opacity: 0.75 },
  corner:      { position: "absolute", width: 32, height: 32,
                 borderColor: "#16a34a", borderWidth: 4 },
  cornerTL:    { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 5 },
  cornerTR:    { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 5 },
  cornerBL:    { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 5 },
  cornerBR:    { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 5 },
  scanLoading: { backgroundColor: "rgba(22,101,52,0.92)", paddingHorizontal: 18,
                 paddingVertical: 10, borderRadius: 24 },
  scanLoadingTxt: { color: "white", fontWeight: "700", fontSize: 13 },
  scanIdle:    { opacity: 0.3 },

  /* Permission */
  permBox:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 40 },
  permIconCircle: { width: 80, height: 80, borderRadius: 40,
                    backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  permTitle:     { fontSize: 20, fontWeight: "700", color: "#111827" },
  permSub:       { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 21 },
  permBtn:       { flexDirection: "row", alignItems: "center", gap: 8,
                   backgroundColor: GREEN_BG, borderRadius: 16,
                   paddingHorizontal: 28, paddingVertical: 14, marginTop: 6 },
  permBtnTxt:    { color: "white", fontWeight: "700", fontSize: 15 },

  /* Manual */
  manualSection: { padding: 16, gap: 14, paddingBottom: 40 },
  manualBox:     { backgroundColor: "white", borderRadius: 24, padding: 28,
                   alignItems: "center", gap: 4,
                   shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  manualIconCircle: { width: 64, height: 64, borderRadius: 32,
                      backgroundColor: "#DCFCE7", justifyContent: "center",
                      alignItems: "center", marginBottom: 8 },
  manualTitle:   { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 4 },
  manualSub:     { fontSize: 13, color: "#6b7280", textAlign: "center",
                   marginBottom: 20, lineHeight: 19 },
  manualInput:   { width: "100%", backgroundColor: "#F9FAFB", borderRadius: 14, padding: 16,
                   borderWidth: 1.5, borderColor: "#BBF7D0", fontSize: 16,
                   fontWeight: "700", color: "#111827", textAlign: "center",
                   letterSpacing: 2, marginBottom: 16 },
  validateBtn:   { flexDirection: "row", alignItems: "center", gap: 8,
                   backgroundColor: GREEN_BG, borderRadius: 14, width: "100%",
                   justifyContent: "center", paddingVertical: 15 },
  validateBtnDisabled: { backgroundColor: "#d1d5db" },
  validateTxt:   { color: "white", fontWeight: "700", fontSize: 15 },

  /* Notice */
  noticeBox:   { flexDirection: "row", alignItems: "flex-start", gap: 10,
                 backgroundColor: "#DCFCE7", borderRadius: 14,
                 padding: 14, borderWidth: 1, borderColor: "#BBF7D0" },
  noticeTxt:   { flex: 1, fontSize: 12, color: GREEN_DARK, lineHeight: 18 },
});
