/**
 * CameraConnectModal — Connexion caméra IP réelle
 * QR scan (IP Webcam / DroidCam) ou URL manuelle → aperçu live → enregistrement en base
 *
 * Flux supportés :
 *  • MJPEG  : http://192.168.x.x:8080/video  (IP Webcam Android)
 *  • MJPEG  : http://192.168.x.x:4747/video  (DroidCam)
 *  • HLS    : http://....m3u8
 *  • Caméra Wi-Fi bare-host auto-complété
 *
 * L'URL est sauvegardée en base via POST /agent/suivi/trips/:tripId/camera/connect
 * Le flux est affiché dans un WebView en temps réel, SANS simulation.
 */

import { Feather, Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { BASE_URL } from "@/utils/api";

/* ─── Types ──────────────────────────────────────────────────────── */
export interface CameraTrip {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  busName?: string | null;
  cameraStreamUrl?: string | null;
  cameraStatus?: string;
  cameraPosition?: string;
  [key: string]: any;
}

export interface CameraConnectModalProps {
  trips: CameraTrip[];
  token: string | null;
  preselectedTrip?: CameraTrip | null;
  onClose: () => void;
  onConnected: (trip: CameraTrip) => void;
}

/* ─── Stream helpers (100% real, zero simulation) ────────────────── */

/** Build inline HTML to display an MJPEG stream (IP Webcam / DroidCam) */
export function buildMjpegHtml(streamUrl: string): string {
  const safe = streamUrl.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
    img{width:100%;height:100%;object-fit:contain;background:#000}
    #err{display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#FF4444;font-family:sans-serif;font-size:13px;text-align:center;padding:16px;line-height:1.5}
  </style>
</head>
<body>
  <img id="v" src="${safe}"
    onerror="document.getElementById('err').style.display='block';this.style.display='none';" />
  <div id="err">⚠️ Flux non disponible<br>Vérifiez l'URL et la connexion réseau<br><small style="color:#888;font-size:11px;margin-top:8px;display:block">${safe}</small></div>
</body>
</html>`;
}

/** Build inline HTML for HLS streams (requires hls.js) */
export function buildHlsHtml(streamUrl: string): string {
  const safe = streamUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
    video{width:100%;height:100%;object-fit:contain;background:#000}
    #err{display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#FF4444;font-family:sans-serif;font-size:13px;text-align:center;padding:16px;line-height:1.5}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script>
</head>
<body>
  <video id="v" autoplay muted playsinline controls></video>
  <div id="err">⚠️ Flux non disponible</div>
  <script>
    var v = document.getElementById("v");
    var err = document.getElementById("err");
    var url = "${safe}";
    if (Hls.isSupported()) {
      var hls = new Hls({ maxBufferLength: 10, startFragPrefetch: true });
      hls.loadSource(url);
      hls.attachMedia(v);
      hls.on(Hls.Events.ERROR, function(_, d) {
        if (d.fatal) { err.style.display = "block"; v.style.display = "none"; }
      });
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = url;
      v.addEventListener("error", function() { err.style.display = "block"; v.style.display = "none"; });
    } else {
      err.style.display = "block";
      err.innerHTML = "Lecteur HLS non compatible sur cet appareil";
    }
  </script>
</body>
</html>`;
}

/** Detect stream type from URL */
export function detectStreamType(url: string): "hls" | "mjpeg" {
  const u = url.toLowerCase();
  if (u.includes(".m3u8")) return "hls";
  return "mjpeg";
}

/** Normalise a raw URL: add http:// prefix + /video suffix for bare IP:port hosts */
export function normaliseStreamUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("rtsp://")) {
    url = "http://" + url;
  }
  // IP Webcam / DroidCam bare host (e.g. 192.168.1.5:8080) → append /video
  if (/^https?:\/\/[\d.]+:\d+\/?$/.test(url)) {
    url = url.replace(/\/$/, "") + "/video";
  }
  return url;
}

/**
 * Parse a QR code payload.
 * Supports:
 *  - Raw URL  : http://192.168.x.x:8080/video
 *  - JSON     : { "stream": "http://...", "trip": "tripId", "position": "..." }
 */
export function parseQrPayload(
  raw: string,
): { streamUrl: string; tripId?: string; position?: string } | null {
  const trimmed = raw.trim();
  try {
    const obj = JSON.parse(trimmed);
    const url = obj.stream ?? obj.url ?? obj.streamUrl ?? obj.cam ?? "";
    if (url) {
      return {
        streamUrl: normaliseStreamUrl(url),
        tripId:    obj.trip ?? obj.tripId,
        position:  obj.position ?? obj.pos,
      };
    }
  } catch { /* not JSON */ }
  if (
    trimmed.startsWith("http") ||
    trimmed.startsWith("rtsp") ||
    /^\d{1,3}\.\d{1,3}/.test(trimmed)
  ) {
    return { streamUrl: normaliseStreamUrl(trimmed) };
  }
  return null;
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function CameraConnectModal({
  trips,
  token,
  preselectedTrip,
  onClose,
  onConnected,
}: CameraConnectModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode,         setMode]         = useState<"qr" | "manual">("qr");
  const [scanning,     setScanning]     = useState(true);
  const [scanned,      setScanned]      = useState(false);
  const [manualUrl,    setManualUrl]    = useState("");
  const [selectedTrip, setSelectedTrip] = useState<CameraTrip | null>(
    preselectedTrip ?? (trips.length === 1 ? trips[0] : null),
  );
  const [connecting,   setConnecting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [previewHtml,  setPreviewHtml]  = useState<string | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [webLoading,   setWebLoading]   = useState(false);
  const [webError,     setWebError]     = useState(false);

  /* ── Save camera URL to database via API ── */
  const doConnect = async (streamUrl: string) => {
    setError(null);
    if (!selectedTrip) {
      setError("Sélectionnez d'abord un trajet à associer.");
      return;
    }
    setConnecting(true);
    try {
      const r = await fetch(
        `${BASE_URL}/agent/suivi/trips/${selectedTrip.id}/camera/connect`,
        {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ streamUrl, position: "intérieur" }),
        },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Erreur serveur: ${r.status}`);
      }
      onConnected({
        ...selectedTrip,
        cameraStreamUrl: streamUrl,
        cameraStatus:    "connected",
        cameraPosition:  "intérieur",
      });
    } catch (e: any) {
      setError(e?.message ?? "Connexion impossible. Vérifiez la connexion réseau.");
    } finally {
      setConnecting(false);
    }
  };

  /* ── QR barcode handler ── */
  const handleQrScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    const parsed = parseQrPayload(data);
    if (!parsed) {
      setError("QR Code invalide — aucune URL de flux vidéo détectée.");
      setScanned(false);
      setScanning(true);
      return;
    }
    openPreview(parsed.streamUrl);
    if (parsed.tripId) {
      const t = trips.find(tr => tr.id === parsed.tripId);
      if (t) setSelectedTrip(t);
    }
  };

  /* ── Open live preview in WebView ── */
  const openPreview = (url: string) => {
    const type = detectStreamType(url);
    setPreviewUrl(url);
    setPreviewHtml(type === "hls" ? buildHlsHtml(url) : buildMjpegHtml(url));
    setWebLoading(true);
    setWebError(false);
    setError(null);
  };

  const handleManualTest = () => {
    if (!manualUrl.trim()) return;
    openPreview(normaliseStreamUrl(manualUrl));
  };

  const resetPreview = () => {
    setPreviewHtml(null);
    setPreviewUrl(null);
    setScanned(false);
    setScanning(true);
    setError(null);
    setWebError(false);
  };

  const switchMode = (m: "qr" | "manual") => {
    setMode(m);
    resetPreview();
  };

  /* ── Camera permission required for QR mode ── */
  if (!permission?.granted && mode === "qr") {
    return (
      <View style={C.root}>
        <View style={C.header}>
          <Text style={C.title}>Connexion Caméra</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={C.permBox}>
          <Feather name="camera-off" size={52} color="#64748B" />
          <Text style={C.permTitle}>Accès caméra requis</Text>
          <Text style={C.permSub}>
            Pour scanner le QR Code affiché sur l'écran IP Webcam, GoBooking a
            besoin d'accéder à votre caméra.
          </Text>
          <TouchableOpacity style={C.permBtn} onPress={requestPermission}>
            <Feather name="camera" size={16} color="#fff" />
            <Text style={C.permBtnTxt}>Autoriser la caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[C.permBtn, C.permBtnOutline]}
            onPress={() => setMode("manual")}
          >
            <Text style={[C.permBtnTxt, { color: "#94A3B8" }]}>
              Saisir l'URL manuellement
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={C.root}>
      {/* ── Header ── */}
      <View style={C.header}>
        <View style={C.headerLeft}>
          <View style={C.liveDot} />
          <Text style={C.title}>CONNEXION CAMÉRA</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Mode tabs ── */}
      <View style={C.tabs}>
        {(["qr", "manual"] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[C.tab, mode === m && C.tabActive]}
            onPress={() => switchMode(m)}
          >
            <Feather
              name={m === "qr" ? "maximize" : "wifi"}
              size={14}
              color={mode === m ? "#3B82F6" : "#64748B"}
            />
            <Text style={[C.tabTxt, mode === m && C.tabTxtActive]}>
              {m === "qr" ? "Scan QR Code" : "URL / Wi-Fi"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Trip selector (when multiple active trips) ── */}
      {trips.length > 1 && (
        <View style={C.tripSel}>
          <Text style={C.tripSelLabel}>Trajet à associer :</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {trips.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[C.tripChip, selectedTrip?.id === t.id && C.tripChipActive]}
                onPress={() => setSelectedTrip(t)}
              >
                <Text
                  style={[C.tripChipTxt, selectedTrip?.id === t.id && C.tripChipTxtActive]}
                  numberOfLines={1}
                >
                  {t.from} → {t.to}  {t.departureTime}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {trips.length === 1 && (
        <View style={C.tripInfo}>
          <Ionicons name="bus" size={13} color="#3B82F6" />
          <Text style={C.tripInfoTxt}>
            {trips[0].from} → {trips[0].to} · {trips[0].departureTime}
          </Text>
        </View>
      )}

      {/* ── Content area: preview OR scanner/form ── */}
      {previewHtml ? (
        /* ── Live preview (real stream) ── */
        <View style={C.previewWrap}>
          <View style={C.previewBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={C.previewDot} />
              <Text style={C.previewBarTxt}>APERÇU EN DIRECT</Text>
            </View>
            <Text style={C.previewUrl} numberOfLines={1}>{previewUrl}</Text>
          </View>

          {/* Real WebView rendering the actual camera stream */}
          <View style={{ flex: 1, position: "relative" }}>
            <WebView
              source={{ html: previewHtml }}
              style={{ flex: 1, backgroundColor: "#000" }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              onLoadStart={() => { setWebLoading(true); setWebError(false); }}
              onLoadEnd={() => setWebLoading(false)}
              onError={() => { setWebLoading(false); setWebError(true); }}
              scrollEnabled={false}
              bounces={false}
            />
            {webLoading && !webError && (
              <View style={C.previewLoader}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={C.previewLoaderTxt}>Connexion au flux...</Text>
              </View>
            )}
            {webError && (
              <View style={C.previewLoader}>
                <Feather name="wifi-off" size={28} color="#EF4444" />
                <Text style={[C.previewLoaderTxt, { color: "#EF4444" }]}>
                  Flux inaccessible
                </Text>
                <Text style={{ color: "#64748B", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                  Vérifiez que la caméra est allumée{"\n"}et connectée au même réseau Wi-Fi
                </Text>
              </View>
            )}
          </View>

          <View style={C.previewActions}>
            <TouchableOpacity style={C.retryBtn} onPress={resetPreview}>
              <Feather name="refresh-cw" size={14} color="#94A3B8" />
              <Text style={C.retryBtnTxt}>
                {mode === "qr" ? "Nouveau scan" : "Changer URL"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[C.connectBtn, (connecting || !selectedTrip) && { opacity: 0.55 }]}
              onPress={() => previewUrl && doConnect(previewUrl)}
              disabled={connecting || !selectedTrip || !previewUrl}
            >
              {connecting
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <>
                    <Feather name="link" size={15} color="#fff" />
                    <Text style={C.connectBtnTxt}>Confirmer la connexion</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        </View>
      ) : mode === "qr" ? (
        /* ── QR scanner ── */
        <View style={C.scanWrap}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={scanning ? handleQrScan : undefined}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          {/* Scan frame overlay */}
          <View style={C.scanOverlay} pointerEvents="none">
            <View style={C.scanFrame}>
              <View style={[C.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
              <View style={[C.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
              <View style={[C.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
              <View style={[C.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
            </View>
          </View>
          <View style={C.scanHint} pointerEvents="none">
            <Feather name="maximize" size={16} color="#3B82F6" />
            <Text style={C.scanHintTxt}>
              Alignez le QR Code IP Webcam dans le cadre
            </Text>
          </View>
        </View>
      ) : (
        /* ── URL manuelle ── */
        <View style={C.manualWrap}>
          <View style={C.infoBox}>
            <Feather name="info" size={14} color="#3B82F6" />
            <Text style={C.infoTxt}>
              Entrez l'URL du flux vidéo de votre caméra.{"\n"}
              Exemples :{"\n"}
              • IP Webcam (Android) : http://192.168.1.x:8080/video{"\n"}
              • DroidCam : http://192.168.1.x:4747/video{"\n"}
              • Caméra Wi-Fi : http://192.168.1.x/stream{"\n"}
              • HLS : http://...server.../live.m3u8
            </Text>
          </View>
          <View style={C.urlRow}>
            <TextInput
              style={C.urlInput}
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder="http://192.168.1.x:8080/video"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleManualTest}
            />
            <TouchableOpacity
              style={[C.testBtn, !manualUrl.trim() && { opacity: 0.4 }]}
              onPress={handleManualTest}
              disabled={!manualUrl.trim()}
            >
              <Feather name="play" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={C.urlHint}>
            Appuyez sur ▶ pour tester le flux avant de confirmer.
          </Text>
        </View>
      )}

      {/* ── Error banner ── */}
      {error && (
        <View style={C.errBox}>
          <Feather name="alert-circle" size={14} color="#EF4444" />
          <Text style={C.errTxt}>{error}</Text>
        </View>
      )}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */
const C = StyleSheet.create({
  root:            { flex: 1, backgroundColor: "#0A0F1C" },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  headerLeft:      { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  title:           { color: "#F1F5F9", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },

  permBox:         { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  permTitle:       { color: "#F1F5F9", fontSize: 18, fontWeight: "800", marginTop: 8 },
  permSub:         { color: "#64748B", fontSize: 14, textAlign: "center", lineHeight: 20 },
  permBtn:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#3B82F6", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  permBtnOutline:  { backgroundColor: "transparent", borderWidth: 1, borderColor: "#334155" },
  permBtnTxt:      { color: "#fff", fontWeight: "700", fontSize: 14 },

  tabs:            { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tab:             { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  tabActive:       { backgroundColor: "rgba(59,130,246,0.15)", borderColor: "rgba(59,130,246,0.4)" },
  tabTxt:          { color: "#64748B", fontSize: 13, fontWeight: "600" },
  tabTxtActive:    { color: "#3B82F6" },

  tripSel:         { paddingHorizontal: 16, paddingBottom: 10 },
  tripSelLabel:    { color: "#94A3B8", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  tripChip:        { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  tripChipActive:  { backgroundColor: "rgba(59,130,246,0.18)", borderColor: "rgba(59,130,246,0.45)" },
  tripChipTxt:     { color: "#94A3B8", fontSize: 12, fontWeight: "600", maxWidth: 160 },
  tripChipTxtActive: { color: "#60A5FA" },
  tripInfo:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "rgba(59,130,246,0.08)", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(59,130,246,0.15)" },
  tripInfoTxt:     { color: "#94A3B8", fontSize: 12 },

  /* Live preview */
  previewWrap:     { flex: 1 },
  previewBar:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 12, paddingVertical: 8 },
  previewDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  previewBarTxt:   { color: "#E2E8F0", fontSize: 11, fontWeight: "800" },
  previewUrl:      { color: "#64748B", fontSize: 10, maxWidth: 180 },
  previewLoader:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(10,15,28,0.85)", gap: 8 },
  previewLoaderTxt:{ color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  previewActions:  { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  retryBtn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  retryBtnTxt:     { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  connectBtn:      { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#059669", borderRadius: 10, paddingVertical: 12 },
  connectBtnTxt:   { color: "#fff", fontWeight: "800", fontSize: 14 },

  /* QR scanner */
  scanWrap:        { flex: 1, position: "relative" },
  scanOverlay:     { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  scanFrame:       { width: 200, height: 200, position: "relative" },
  corner:          { position: "absolute", width: 24, height: 24, borderColor: "#3B82F6", borderRadius: 3 },
  scanHint:        { position: "absolute", bottom: 24, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(10,15,28,0.75)", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" },
  scanHintTxt:     { color: "#94A3B8", fontSize: 13, textAlign: "center", flex: 1 },

  /* Manual URL */
  manualWrap:      { flex: 1, padding: 16, gap: 12 },
  infoBox:         { flexDirection: "row", gap: 10, backgroundColor: "rgba(59,130,246,0.07)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(59,130,246,0.18)" },
  infoTxt:         { color: "#94A3B8", fontSize: 12, lineHeight: 19, flex: 1 },
  urlRow:          { flexDirection: "row", gap: 8, alignItems: "center" },
  urlInput:        { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#F1F5F9", fontSize: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  testBtn:         { width: 46, height: 46, borderRadius: 10, backgroundColor: "#3B82F6", justifyContent: "center", alignItems: "center" },
  urlHint:         { color: "#475569", fontSize: 11, textAlign: "center" },

  /* Error */
  errBox:          { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(220,38,38,0.1)", margin: 16, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(220,38,38,0.3)" },
  errTxt:          { color: "#F87171", fontSize: 12, flex: 1, lineHeight: 17 },
});
