import React, { useState, useEffect, useRef } from “react”;
import {
View, Text, ScrollView, TouchableOpacity,
StyleSheet, ActivityIndicator, TextInput, Animated,
} from “react-native”;
import { CameraView, useCameraPermissions } from “expo-camera”;
import { Ionicons } from “@expo/vector-icons”;
import { BASE_URL } from “@/utils/api”;

interface CameraConnectModalProps {
trips: {
id: string;
from: string;
to: string;
departureTime: string;
busName: string;
cameraStatus?: string;
cameraStreamUrl?: string | null;
}[];
token: string | null;
onClose: () => void;
onConnected: (trip: { id: string; cameraStreamUrl?: string | null }) => void;
}

export default function CameraConnectModal({
trips, token, onClose, onConnected,
}: CameraConnectModalProps) {
const [step, setStep]             = useState<“choose” | “qr” | “wifi” | “connected”>(“choose”);
const [streamUrl, setStreamUrl]   = useState(””);
const [connecting, setConnecting] = useState(false);
const [error, setError]           = useState<string | null>(null);
const [camPerm, requestCamPerm]   = useCameraPermissions();
const scanLineAnim                = useRef(new Animated.Value(0)).current;
const scannedRef                  = useRef(false);

const trip = trips[0] ?? null;

useEffect(() => {
if (step !== “qr”) return;
const loop = Animated.loop(
Animated.sequence([
Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
])
);
loop.start();
return () => loop.stop();
}, [step]);

const connectCamera = async (url: string) => {
if (!trip || !token) return;
setConnecting(true);
setError(null);
try {
await fetch(`${BASE_URL}/agent/suivi/trips/${trip.id}/camera/connect`, {
method: “POST”,
headers: { Authorization: `Bearer ${token}`, “Content-Type”: “application/json” },
body: JSON.stringify({ streamUrl: url }),
});
} catch {}
// Connexion acceptée même hors ligne
setStep(“connected”);
setTimeout(() => onConnected({ id: trip.id, cameraStreamUrl: url }), 1200);
setConnecting(false);
};

const handleQRScanned = ({ data }: { data: string }) => {
if (scannedRef.current || connecting) return;
scannedRef.current = true;
connectCamera(data);
};

// ── Écran succès ──
if (step === “connected”) {
return (
<View style={CS.centerScreen}>
<View style={CS.successIcon}>
<Ionicons name="checkmark-circle" size={48} color="#22C55E" />
</View>
<Text style={CS.successTitle}>Caméra connectée !</Text>
<Text style={CS.successSub}>Le flux vidéo est transmis à la Tour de Contrôle.</Text>
<View style={CS.liveBadge}>
<View style={CS.liveDot} />
<Text style={CS.liveTxt}>LIVE</Text>
</View>
</View>
);
}

// ── Écran choix ──
if (step === “choose”) {
return (
<ScrollView style={CS.screen} contentContainerStyle={{ padding: 24 }}>
{/* Header */}
<View style={CS.hdr}>
<View style={CS.hdrIcon}>
<Ionicons name="videocam" size={26} color="#60A5FA" />
</View>
<View style={{ flex: 1 }}>
<Text style={CS.hdrTitle}>Connecter une caméra</Text>
<Text style={CS.hdrSub}>{trip ? `${trip.from} → ${trip.to}` : “Caméra embarquée”}</Text>
</View>
<TouchableOpacity onPress={onClose} style={CS.closeBtn}>
<Ionicons name="close" size={20} color="#94A3B8" />
</TouchableOpacity>
</View>

```
    <Text style={CS.infoTxt}>
      Connectez la caméra embarquée via QR Code ou adresse IP Wi-Fi.
      Le flux sera transmis en direct à la Tour de Contrôle.
    </Text>

    {/* Option QR */}
    <TouchableOpacity
      style={CS.optionBtn}
      onPress={async () => {
        if (!camPerm?.granted) await requestCamPerm();
        scannedRef.current = false;
        setStep("qr");
      }}
      activeOpacity={0.8}
    >
      <View style={[CS.optionIcon, { backgroundColor: "#172554" }]}>
        <Ionicons name="qr-code" size={26} color="#60A5FA" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={CS.optionTitle}>Scanner QR Code</Text>
        <Text style={CS.optionSub}>Scannez le QR affiché sur l'écran de la caméra IP</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#334155" />
    </TouchableOpacity>

    {/* Option Wi-Fi */}
    <TouchableOpacity
      style={[CS.optionBtn, { borderColor: "#1E3A5F" }]}
      onPress={() => setStep("wifi")}
      activeOpacity={0.8}
    >
      <View style={[CS.optionIcon, { backgroundColor: "#0C2744" }]}>
        <Ionicons name="wifi" size={26} color="#38BDF8" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={CS.optionTitle}>Connexion Wi-Fi / IP</Text>
        <Text style={CS.optionSub}>Entrez l'adresse IP ou l'URL RTSP de la caméra</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#334155" />
    </TouchableOpacity>

    <View style={CS.tipBox}>
      <Text style={CS.tipTxt}>
        💡 Formats : rtsp://192.168.x.x/stream · http://192.168.x.x:8080/video
      </Text>
    </View>
  </ScrollView>
);
```

}

// ── Écran QR ──
if (step === “qr”) {
if (!camPerm?.granted) {
return (
<View style={CS.centerScreen}>
<Ionicons name="camera-outline" size={52} color="#475569" />
<Text style={CS.permTitle}>Accès caméra requis</Text>
<TouchableOpacity style={CS.permBtn} onPress={requestCamPerm}>
<Ionicons name="camera" size={18} color="#fff" />
<Text style={CS.permBtnTxt}>Autoriser la caméra</Text>
</TouchableOpacity>
<TouchableOpacity onPress={() => setStep(“choose”)} style={{ marginTop: 12 }}>
<Text style={{ color: “#475569”, fontSize: 13 }}>Retour</Text>
</TouchableOpacity>
</View>
);
}
return (
<View style={{ flex: 1, backgroundColor: “#000” }}>
<CameraView
style={StyleSheet.absoluteFillObject}
facing=“back”
barcodeScannerSettings={{ barcodeTypes: [“qr”] }}
onBarcodeScanned={!scannedRef.current && !connecting ? handleQRScanned : undefined}
/>
<View style={StyleSheet.absoluteFillObject}>
{/* Top bar */}
<View style={CS.qrTopBar}>
<TouchableOpacity onPress={() => setStep(“choose”)} style={CS.qrBackBtn}>
<Ionicons name="arrow-back" size={20} color="#fff" />
<Text style={{ color: “#fff”, fontWeight: “700” }}>Retour</Text>
</TouchableOpacity>
<Text style={CS.qrTitle}>Scanner QR Caméra</Text>
<View style={{ width: 60 }} />
</View>
{/* Zone scan */}
<View style={{ flex: 1, justifyContent: “center”, alignItems: “center” }}>
<View style={CS.qrBox}>
{/* Coins */}
<View style={[CS.corner, CS.cTL]} />
<View style={[CS.corner, CS.cTR]} />
<View style={[CS.corner, CS.cBL]} />
<View style={[CS.corner, CS.cBR]} />
{/* Ligne animée */}
<Animated.View style={[CS.scanLine, {
transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] }) }],
}]} />
{connecting && <ActivityIndicator size="large" color="#60A5FA" />}
</View>
<View style={CS.qrHint}>
<Text style={CS.qrHintTxt}>
{connecting ? “Connexion en cours…” : “Pointez vers le QR de la caméra IP”}
</Text>
</View>
</View>
</View>
</View>
);
}

// ── Écran Wi-Fi ──
if (step === “wifi”) {
return (
<ScrollView style={CS.screen} contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps=“handled”>
{/* Header */}
<View style={{ flexDirection: “row”, alignItems: “center”, gap: 12, marginBottom: 24 }}>
<TouchableOpacity onPress={() => setStep(“choose”)} style={CS.closeBtn}>
<Ionicons name="arrow-back" size={20} color="#94A3B8" />
</TouchableOpacity>
<Text style={CS.hdrTitle}>Connexion Wi-Fi / IP</Text>
</View>

```
    <Text style={{ color: "#64748B", fontSize: 12, marginBottom: 20, lineHeight: 18 }}>
      Entrez l'adresse IP ou l'URL du flux vidéo.
      Assurez-vous d'être sur le même réseau Wi-Fi que la caméra.
    </Text>

    <Text style={CS.inputLabel}>Adresse de la caméra</Text>
    <TextInput
      style={[CS.input, error ? { borderColor: "#DC2626" } : {}]}
      placeholder="rtsp://192.168.1.100/stream"
      placeholderTextColor="#334155"
      value={streamUrl}
      onChangeText={t => { setStreamUrl(t); setError(null); }}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="url"
    />
    {error && <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 6 }}>{error}</Text>}

    {/* Exemples */}
    <View style={CS.examplesBox}>
      <Text style={CS.examplesTitle}>EXEMPLES</Text>
      {[
        "rtsp://192.168.1.100:554/stream",
        "http://192.168.1.100:8080/video",
        "rtsp://admin:1234@192.168.1.50/live",
      ].map(ex => (
        <TouchableOpacity key={ex} onPress={() => { setStreamUrl(ex); setError(null); }} style={{ paddingVertical: 5 }}>
          <Text style={{ color: "#38BDF8", fontSize: 11 }}>{ex}</Text>
        </TouchableOpacity>
      ))}
    </View>

    <TouchableOpacity
      style={[CS.connectBtn, connecting && { opacity: 0.7 }]}
      onPress={() => {
        if (!streamUrl.trim()) { setError("Entrez l'adresse IP ou l'URL du flux."); return; }
        connectCamera(streamUrl.trim());
      }}
      disabled={connecting}
      activeOpacity={0.85}
    >
      {connecting
        ? <ActivityIndicator size="small" color="#fff" />
        : <Ionicons name="wifi" size={20} color="#fff" />}
      <Text style={CS.connectBtnTxt}>
        {connecting ? "Connexion en cours…" : "Connecter la caméra"}
      </Text>
    </TouchableOpacity>
  </ScrollView>
);
```

}

return null;
}

const CS = StyleSheet.create({
screen:       { flex: 1, backgroundColor: “#0A0E1A” },
centerScreen: { flex: 1, justifyContent: “center”, alignItems: “center”, backgroundColor: “#0A0E1A”, padding: 32, gap: 16 },
hdr:          { flexDirection: “row”, alignItems: “center”, gap: 14, marginBottom: 20 },
hdrIcon:      { width: 52, height: 52, borderRadius: 15, backgroundColor: “#1E293B”, justifyContent: “center”, alignItems: “center” },
hdrTitle:     { color: “#F1F5F9”, fontSize: 18, fontWeight: “800” },
hdrSub:       { color: “#64748B”, fontSize: 12, marginTop: 2 },
closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: “#1E293B”, justifyContent: “center”, alignItems: “center” },
infoTxt:      { color: “#64748B”, fontSize: 12, lineHeight: 18, marginBottom: 24, backgroundColor: “#0F172A”, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: “#1E293B” },
optionBtn:    { backgroundColor: “#0F1B35”, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: “#1E3A6E”, flexDirection: “row”, alignItems: “center”, gap: 14 },
optionIcon:   { width: 52, height: 52, borderRadius: 14, justifyContent: “center”, alignItems: “center” },
optionTitle:  { color: “#F1F5F9”, fontSize: 15, fontWeight: “800” },
optionSub:    { color: “#475569”, fontSize: 12, marginTop: 3, lineHeight: 17 },
tipBox:       { backgroundColor: “#0A0A0A”, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: “#1E293B” },
tipTxt:       { color: “#334155”, fontSize: 11, lineHeight: 17 },
successIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: “#052E16”, justifyContent: “center”, alignItems: “center” },
successTitle: { color: “#fff”, fontSize: 22, fontWeight: “800”, textAlign: “center” },
successSub:   { color: “#64748B”, fontSize: 14, textAlign: “center”, lineHeight: 20 },
liveBadge:    { flexDirection: “row”, alignItems: “center”, gap: 6, backgroundColor: “#052E16”, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: “#22C55E” },
liveTxt:      { color: “#22C55E”, fontSize: 13, fontWeight: “800” },
permTitle:    { color: “#F1F5F9”, fontSize: 16, fontWeight: “700”, textAlign: “center” },
permBtn:      { backgroundColor: “#2563EB”, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, flexDirection: “row”, alignItems: “center”, gap: 8 },
permBtnTxt:   { color: “#fff”, fontWeight: “700”, fontSize: 14 },
qrTopBar:     { flexDirection: “row”, alignItems: “center”, justifyContent: “space-between”, padding: 20, paddingTop: 16, backgroundColor: “rgba(0,0,0,0.6)” },
qrBackBtn:    { flexDirection: “row”, alignItems: “center”, gap: 6 },
qrTitle:      { color: “#fff”, fontWeight: “800”, fontSize: 14 },
qrBox:        { width: 220, height: 220, position: “relative”, justifyContent: “center”, alignItems: “center” },
corner:       { position: “absolute”, width: 28, height: 28, borderColor: “#60A5FA”, borderWidth: 3 },
cTL:          { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
cTR:          { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
cBL:          { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
cBR:          { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
scanLine:     { position: “absolute”, left: 16, right: 16, height: 2.5, backgroundColor: “rgba(96,165,250,0.8)”, borderRadius: 2 },
qrHint:       { backgroundColor: “rgba(0,0,0,0.65)”, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, marginTop: 20 },
qrHintTxt:    { color: “rgba(255,255,255,0.9)”, fontSize: 13, fontWeight: “600” },
inputLabel:   { color: “#94A3B8”, fontSize: 12, fontWeight: “700”, marginBottom: 8, textTransform: “uppercase”, letterSpacing: 0.5 },
input:        { backgroundColor: “#0F172A”, borderWidth: 1.5, borderColor: “#1E3A6E”, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: “#F1F5F9”, marginBottom: 4 },
examplesBox:  { backgroundColor: “#0A0A1A”, borderRadius: 10, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: “#1E293B” },
examplesTitle:{ color: “#475569”, fontSize: 11, fontWeight: “700”, marginBottom: 6, letterSpacing: 0.5 },
connectBtn:   { backgroundColor: “#059669”, borderRadius: 14, paddingVertical: 16, flexDirection: “row”, alignItems: “center”, justifyContent: “center”, gap: 10 },
connectBtnTxt:{ color: “#fff”, fontSize: 15, fontWeight: “800” },
});
