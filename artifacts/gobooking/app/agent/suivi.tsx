import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { BASE_URL } from "@/utils/api";

const RED    = "#BE123C";
const RED_D  = "#9F1239";
const RED_L  = "#FFF1F2";
const RED_M  = "#FDA4AF";
const CAM_BG = "#0A0E1A";
const CAM_GR = "#22C55E";

const { width: SW } = Dimensions.get("window");

function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const RESPONSE_OPTIONS = [
  { id: "panne",    label: "Panne mécanique", color: "#DC2626", bg: "#FEE2E2" },
  { id: "controle", label: "Contrôle routier", color: "#D97706", bg: "#FEF3C7" },
  { id: "pause",    label: "Pause normale",     color: "#166534", bg: "#DCFCE7" },
];

const BUS_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  en_attente: { label: "En attente",  color: "#D97706", bg: "#FEF3C7", icon: "time-outline" },
  en_route:   { label: "En route",    color: "#166534", bg: "#DCFCE7", icon: "navigate-outline" },
  arret:      { label: "À l'arrêt",   color: "#0369A1", bg: "#E0F2FE", icon: "pause-circle-outline" },
  probleme:   { label: "Problème",    color: "#DC2626", bg: "#FEE2E2", icon: "warning-outline" },
  maintenance:{ label: "Maintenance", color: "#7C3AED", bg: "#F5F3FF", icon: "construct-outline" },
  arrivé:     { label: "Arrivé",      color: "#0369A1", bg: "#E0F2FE", icon: "checkmark-circle-outline" },
  en_panne:   { label: "En panne",    color: "#DC2626", bg: "#FEE2E2", icon: "warning-outline" },
};

/* ── HLS video player HTML ─────────────────────────────────────── */
function buildVideoHtml(streamUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
    video{width:100%;height:100%;object-fit:contain;background:#000}
    #err{display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#FF4444;font-family:sans-serif;font-size:13px;text-align:center;padding:12px}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script>
</head>
<body>
  <video id="v" autoplay muted playsinline controls></video>
  <div id="err">⚠️ Flux non disponible<br>Vérifiez la connexion caméra</div>
  <script>
    var v = document.getElementById("v");
    var err = document.getElementById("err");
    var url = "${streamUrl.replace(/"/g, '\\"')}";
    if (Hls.isSupported()) {
      var hls = new Hls({ maxBufferLength:10, startFragPrefetch:true });
      hls.loadSource(url);
      hls.attachMedia(v);
      hls.on(Hls.Events.ERROR, function(_,d){ if(d.fatal){ err.style.display="block"; v.style.display="none"; } });
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = url;
      v.addEventListener("error", function(){ err.style.display="block"; v.style.display="none"; });
    } else {
      err.style.display="block";
      err.innerHTML = "Lecteur non compatible sur cet appareil";
    }
  </script>
</body>
</html>`;
}

/* ── Types ─────────────────────────────────────────────────────── */
interface BusItem {
  id: string; busName: string; plateNumber: string;
  logisticStatus: string; status?: string;
  currentLocation?: string; issue?: string;
  currentTripId?: string;
}
interface TripItem {
  id: string; from: string; to: string; departureTime: string; status: string;
  arrivalTime?: string | null; etaTime?: string | null;
  passengerCount?: number | null; seatCount?: number | null;
  busId?: string; busName?: string;
  cameraStreamUrl?: string | null;
  cameraStatus?: string;
  cameraConnectedAt?: string | null;
  cameraPosition?: string;
}
interface AlertItem {
  id: string; type: string; busId?: string; busName?: string;
  agentId: string; agentName?: string;
  message: string; status: string;
  response?: string | null; respondedAt?: string | null;
  responseRequested?: boolean; createdAt: string;
}
interface Overview { buses: BusItem[]; trips: TripItem[]; alerts: AlertItem[] }

/* ══════════════════════════════════════════════════════════════════
   CAMÉRA LIVE — Lecteur vidéo plein écran immersif
   ══════════════════════════════════════════════════════════════════ */
function CameraPlayer({
  trip, onClose, liveData,
}: {
  trip: TripItem;
  onClose: () => void;
  liveData?: { frames: number; signal: number };
}) {
  const [loading,    setLoading]    = useState(true);
  const [zoomIdx,    setZoomIdx]    = useState(0);           // 0=1× 1=1.5× 2=2×
  const [showMeta,   setShowMeta]   = useState(true);        // metadata overlay auto-hides
  const [webErr,     setWebErr]     = useState(false);
  const liveDotAnim  = useRef(new Animated.Value(1)).current;
  const zoomAnim     = useRef(new Animated.Value(1)).current;
  const metaAnim     = useRef(new Animated.Value(1)).current;
  const streamUrl    = trip.cameraStreamUrl!;
  const ZOOM_LEVELS  = [1, 1.5, 2];
  const signal       = liveData?.signal ?? 92;
  const frames       = liveData?.frames ?? 0;
  const sigBars      = Math.ceil((signal / 100) * 4);
  const sigColor     = signal >= 80 ? CAM_GR : signal >= 60 ? "#FCD34D" : "#EF4444";

  /* Blinking LIVE dot */
  useEffect(() => {
    const blink = Animated.loop(Animated.sequence([
      Animated.timing(liveDotAnim, { toValue: 0.15, duration: 600, useNativeDriver: true }),
      Animated.timing(liveDotAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    blink.start();
    return () => blink.stop();
  }, []);

  /* Auto-hide metadata overlay after 5s */
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(metaAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      setShowMeta(false);
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  const toggleMeta = () => {
    const next = !showMeta;
    setShowMeta(next);
    Animated.timing(metaAnim, { toValue: next ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  };

  const handleDoubleTap = () => {
    const nextIdx = (zoomIdx + 1) % ZOOM_LEVELS.length;
    setZoomIdx(nextIdx);
    Animated.spring(zoomAnim, { toValue: ZOOM_LEVELS[nextIdx], useNativeDriver: true, tension: 120, friction: 8 }).start();
  };

  return (
    <View style={CS.container}>
      {/* ── Header ── */}
      <View style={CS.header}>
        <View style={CS.liveBadge}>
          <Animated.View style={[CS.liveDot, { opacity: liveDotAnim }]} />
          <Text style={CS.liveText}>LIVE</Text>
        </View>
        <Text style={CS.camTitle} numberOfLines={1}>
          {trip.from} → {trip.to}  ·  {trip.cameraPosition ?? "intérieur"}
        </Text>
        {/* Signal bars inline */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, marginRight: 8 }}>
          {[1,2,3,4].map(b => (
            <View key={b} style={{
              width: 4, height: 4 + b * 3,
              borderRadius: 2,
              backgroundColor: b <= sigBars ? sigColor : "rgba(255,255,255,0.18)",
            }} />
          ))}
          <Text style={{ color: sigColor, fontSize: 10, fontWeight: "800", marginLeft: 3 }}>{signal}%</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={CS.closeBtn}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Video zone ── */}
      <TouchableOpacity activeOpacity={1} style={CS.videoWrap} onPress={toggleMeta} onLongPress={handleDoubleTap}>
        {loading && !webErr && (
          <View style={CS.videoLoader}>
            <ActivityIndicator size="large" color={CAM_GR} />
            <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 10 }}>Connexion au flux caméra...</Text>
          </View>
        )}
        {webErr && (
          <View style={CS.videoLoader}>
            <Ionicons name="wifi-outline" size={42} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontSize: 14, fontWeight: "700", marginTop: 12 }}>Flux interrompu</Text>
            <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 6, textAlign: "center" }}>Vérifiez la connexion réseau{"\n"}et la liaison caméra</Text>
          </View>
        )}
        <Animated.View style={{ flex: 1, transform: [{ scale: zoomAnim }] }}>
          <WebView
            source={{ html: buildVideoHtml(streamUrl) }}
            style={CS.video}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setWebErr(true); }}
            scrollEnabled={false}
            bounces={false}
          />
        </Animated.View>

        {/* ── Metadata overlay (tap to toggle) ── */}
        <Animated.View style={[CS.metaOverlay, { opacity: metaAnim }]} pointerEvents="none">
          <View style={CS.metaRow}>
            <View style={CS.metaChip}>
              <Ionicons name="bus" size={10} color="#94A3B8" />
              <Text style={CS.metaChipTxt}>{trip.busName ?? "Bus"}</Text>
            </View>
            <View style={CS.metaChip}>
              <Ionicons name="people" size={10} color="#94A3B8" />
              <Text style={CS.metaChipTxt}>{trip.passengerCount ?? "—"} pax</Text>
            </View>
            <View style={CS.metaChip}>
              <Ionicons name="film-outline" size={10} color="#94A3B8" />
              <Text style={CS.metaChipTxt}>▲{frames} img</Text>
            </View>
            {zoomIdx > 0 && (
              <View style={[CS.metaChip, { backgroundColor: "rgba(251,191,36,0.25)", borderColor: "#FCD34D" }]}>
                <Text style={[CS.metaChipTxt, { color: "#FCD34D" }]}>{ZOOM_LEVELS[zoomIdx]}×</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Zoom hint ── */}
        {!loading && !webErr && zoomIdx === 0 && (
          <View style={CS.zoomHint} pointerEvents="none">
            <Text style={CS.zoomHintTxt}>Maintenir pour zoomer</Text>
          </View>
        )}
        {!loading && !webErr && zoomIdx > 0 && (
          <View style={[CS.zoomHint, { backgroundColor: "rgba(251,191,36,0.18)", borderColor: "#FCD34D" }]} pointerEvents="none">
            <Ionicons name="search" size={10} color="#FCD34D" />
            <Text style={[CS.zoomHintTxt, { color: "#FCD34D" }]}>{ZOOM_LEVELS[zoomIdx]}× — maintenir pour changer</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Footer info ── */}
      <View style={CS.footer}>
        <View style={CS.footerItem}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
            {[1,2,3,4].map(b => (
              <View key={b} style={{
                width: 3, height: 3 + b * 2,
                borderRadius: 1,
                backgroundColor: b <= sigBars ? sigColor : "rgba(255,255,255,0.15)",
              }} />
            ))}
          </View>
          <Text style={[CS.footerTxt, { color: sigColor }]}>Signal {signal}%</Text>
        </View>
        <View style={CS.footerItem}>
          <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR, opacity: liveDotAnim }} />
          <Text style={[CS.footerTxt, { color: CAM_GR }]}>LIVE · HLS</Text>
        </View>
        <View style={CS.footerItem}>
          <Ionicons name="shield-checkmark" size={13} color="#4ADE80" />
          <Text style={CS.footerTxt}>Flux sécurisé</Text>
        </View>
        <View style={CS.footerItem}>
          <Ionicons name="film-outline" size={13} color="#64748B" />
          <Text style={CS.footerTxt}>{frames} img</Text>
        </View>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LIVE CAM VIEW — Simulation vidéo animée style monitoring
   ══════════════════════════════════════════════════════════════════ */
function LiveCamView({
  signal, route, busId,
}: {
  signal: number; route: string; busId: string;
}) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const [ts,     setTs]     = useState(() => new Date().toLocaleTimeString("fr-FR"));
  const [coords, setCoords] = useState(() => ({
    lat: (5.35 + Math.random() * 0.08).toFixed(4),
    lon: (3.95 + Math.random() * 0.06).toFixed(4),
  }));
  const [speed, setSpeed] = useState(() => 65 + Math.floor(Math.random() * 30));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 3500, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();

    const tInterval = setInterval(() => setTs(new Date().toLocaleTimeString("fr-FR")), 1000);

    const dataInterval = setInterval(() => {
      setCoords(c => ({
        lat: (parseFloat(c.lat) + (Math.random() - 0.5) * 0.001).toFixed(4),
        lon: (parseFloat(c.lon) + (Math.random() - 0.5) * 0.0008).toFixed(4),
      }));
      setSpeed(s => Math.max(40, Math.min(110, s + Math.floor((Math.random() - 0.45) * 7))));
    }, 2500);

    return () => { loop.stop(); clearInterval(tInterval); clearInterval(dataInterval); };
  }, [busId]);

  const CARD_H = 118;
  const sigBars = Math.max(1, Math.ceil((signal / 100) * 4));
  const sigOk   = signal >= 65;

  return (
    <View style={{ height: CARD_H, backgroundColor: "#060810", overflow: "hidden" }}>

      {/* Subtle moving scan line — white, barely visible */}
      <Animated.View style={{
        position: "absolute", left: 0, right: 0, height: 1,
        backgroundColor: "rgba(255,255,255,0.1)",
        transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CARD_H] }) }],
      }} />

      {/* Corner brackets — thin white */}
      <View style={{ position:"absolute", top:7, left:8, width:9, height:9,
        borderTopWidth:1, borderLeftWidth:1, borderColor:"rgba(255,255,255,0.4)" }} />
      <View style={{ position:"absolute", top:7, right:8, width:9, height:9,
        borderTopWidth:1, borderRightWidth:1, borderColor:"rgba(255,255,255,0.4)" }} />
      <View style={{ position:"absolute", bottom:22, left:8, width:9, height:9,
        borderBottomWidth:1, borderLeftWidth:1, borderColor:"rgba(255,255,255,0.4)" }} />
      <View style={{ position:"absolute", bottom:22, right:8, width:9, height:9,
        borderBottomWidth:1, borderRightWidth:1, borderColor:"rgba(255,255,255,0.4)" }} />

      {/* GPS — top left */}
      <Text style={{ position:"absolute", top:9, left:20,
        color:"rgba(255,255,255,0.45)", fontSize:7, letterSpacing:0.5 }}>
        {coords.lat}°N · {coords.lon}°W
      </Text>

      {/* Speed — top right */}
      <Text style={{ position:"absolute", top:9, right:20,
        color:"rgba(255,255,255,0.75)", fontSize:8, fontWeight:"700" }}>
        {speed} km/h
      </Text>

      {/* Signal — middle right */}
      <View style={{ position:"absolute", right:20, top:0, bottom:22,
        justifyContent:"center" }}>
        <View style={{ flexDirection:"row", alignItems:"flex-end", gap:1.5 }}>
          {[1,2,3,4].map(b => (
            <View key={b} style={{ width:2.5, height:3 + b * 2.5, borderRadius:1,
              backgroundColor: b <= sigBars
                ? (sigOk ? "rgba(255,255,255,0.65)" : "rgba(239,68,68,0.8)")
                : "rgba(255,255,255,0.1)" }} />
          ))}
        </View>
      </View>

      {/* Bottom strip — route + timestamp */}
      <View style={{ position:"absolute", bottom:0, left:0, right:0, height:22,
        backgroundColor:"rgba(0,0,0,0.6)",
        flexDirection:"row", alignItems:"center",
        paddingHorizontal:12, justifyContent:"space-between" }}>
        <Text style={{ color:"rgba(255,255,255,0.4)", fontSize:7.5, fontWeight:"600" }} numberOfLines={1}>
          {route}
        </Text>
        <Text style={{ color:"rgba(255,255,255,0.3)", fontSize:7, letterSpacing:0.5 }}>
          {ts}
        </Text>
      </View>
    </View>
  );
}

/* ── Camera status pill ─────────────────────────────────────────── */
function CamPill({ trip, onView }: { trip: TripItem; onView: () => void }) {
  const isConnected = trip.cameraStatus === "connected" && !!trip.cameraStreamUrl;
  const dotPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isConnected) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(dotPulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [isConnected]);

  if (!isConnected) {
    return (
      <View style={CP.pill}>
        <View style={[CP.dot, { backgroundColor: "#94A3B8" }]} />
        <Text style={CP.txt}>Caméra non connectée</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[CP.pill, CP.pillActive]} onPress={onView} activeOpacity={0.8}>
      <Animated.View style={[CP.dot, { backgroundColor: CAM_GR, opacity: dotPulse }]} />
      <Text style={[CP.txt, { color: CAM_GR, fontWeight: "700" }]}>Caméra LIVE</Text>
      <Ionicons name="play-circle" size={14} color={CAM_GR} />
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ALERT DETAIL MODAL — Cycle complet : voir, répondre, valider
   ══════════════════════════════════════════════════════════════════ */
const RESP_INFO: Record<string, { label: string; color: string; icon: string }> = {
  panne:    { label: "Panne mécanique", color: "#EF4444", icon: "construct-outline"   },
  controle: { label: "Contrôle routier", color: "#F59E0B", icon: "shield-outline"     },
  pause:    { label: "Pause normale",    color: "#10B981", icon: "pause-circle-outline"},
};

function AlertDetailModal({
  alert, trip, token, onClose, onRefresh,
}: {
  alert: AlertItem; trip?: TripItem;
  token: string | null; onClose: () => void; onRefresh: () => void;
}) {
  const [acting, setActing] = useState(false);
  const alType    = alert.type?.toLowerCase() ?? "";
  const isUrgent  = alType === "urgence" || alType === "sos";
  const typeColor = isUrgent ? "#EF4444" : alType === "panne" ? "#F59E0B" : "#EF4444";
  const typeLabel = (alert.type ?? "ALERTE").toUpperCase();
  const responded = !!alert.response;
  const waiting   = alert.responseRequested && !responded;
  const respInfo  = alert.response ? RESP_INFO[alert.response] : null;

  const doDemanderReponse = async () => {
    setActing(true);
    try {
      await fetch(`${BASE_URL}/agent/suivi/alerts/${alert.id}/demander-reponse`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      onRefresh();
    } catch {} finally { setActing(false); }
  };

  const doConfirm = async () => {
    setActing(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/suivi/alerts/${alert.id}/confirm`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { onRefresh(); onClose(); }
    } catch {} finally { setActing(false); }
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#080C14", borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
          {/* Handle */}
          <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)",
            alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 11,
                backgroundColor: `${typeColor}18`, justifyContent: "center", alignItems: "center",
                borderWidth: 1, borderColor: `${typeColor}35` }}>
                <Ionicons name="warning" size={18} color={typeColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: typeColor, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{typeLabel}</Text>
                <Text style={{ color: "#E2E8F0", fontSize: 16, fontWeight: "800", marginTop: 1 }} numberOfLines={1}>
                  {alert.busName ?? "Bus inconnu"}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.07)", justifyContent: "center", alignItems: "center" }}>
              <Feather name="x" size={15} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
          {/* Message */}
          <View style={{ marginHorizontal: 20, backgroundColor: `${typeColor}0D`, borderRadius: 10,
            padding: 14, borderWidth: 1, borderColor: `${typeColor}1F`, marginBottom: 14 }}>
            <Text style={{ color: "#E2E8F0", fontSize: 13, fontWeight: "600", lineHeight: 20 }}>
              {alert.message || "Alerte signalée"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 6 }}>
              {new Date(alert.createdAt).toLocaleString("fr-FR")}
            </Text>
          </View>
          {/* Route */}
          {trip && (
            <View style={{ marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Ionicons name="navigate-outline" size={13} color="#374151" />
              <Text style={{ color: "#4B5563", fontSize: 12, fontWeight: "600" }}>
                {trip.from} → {trip.to}
              </Text>
            </View>
          )}
          {/* Response section */}
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            {!responded && !waiting && (
              <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#4B5563", fontSize: 12, marginBottom: 12 }}>
                  Aucune réponse de l'agent routier.
                </Text>
                <TouchableOpacity onPress={doDemanderReponse} disabled={acting}
                  style={{ backgroundColor: "#111827", borderRadius: 8, paddingVertical: 11,
                    alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                  {acting ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: "#E2E8F0", fontSize: 13, fontWeight: "700" }}>
                        Demander une réponse à l'agent
                      </Text>}
                </TouchableOpacity>
              </View>
            )}
            {waiting && (
              <View style={{ backgroundColor: "rgba(234,179,8,0.07)", borderRadius: 10, padding: 14,
                borderWidth: 1, borderColor: "rgba(234,179,8,0.18)",
                flexDirection: "row", alignItems: "center", gap: 12 }}>
                <ActivityIndicator size="small" color="#EAB308" />
                <Text style={{ color: "#EAB308", fontSize: 13, fontWeight: "600", flex: 1 }}>
                  En attente de réponse de l'agent en route…
                </Text>
              </View>
            )}
            {responded && respInfo && (
              <View style={{ backgroundColor: `${respInfo.color}0D`, borderRadius: 10, padding: 14,
                borderWidth: 1, borderColor: `${respInfo.color}22`,
                flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 10,
                  backgroundColor: `${respInfo.color}15`, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name={respInfo.icon as any} size={18} color={respInfo.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: respInfo.color, fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>
                    RÉPONSE REÇUE
                  </Text>
                  <Text style={{ color: "#E2E8F0", fontSize: 14, fontWeight: "800", marginTop: 2 }}>
                    {respInfo.label}
                  </Text>
                  {alert.respondedAt && (
                    <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 3 }}>
                      {new Date(alert.respondedAt).toLocaleTimeString("fr-FR")}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingBottom: 32 }}>
            <TouchableOpacity onPress={doConfirm} disabled={acting}
              style={{ flex: 1, backgroundColor: responded ? "rgba(22,163,74,0.15)" : "rgba(239,68,68,0.15)",
                borderRadius: 12, paddingVertical: 14, alignItems: "center",
                flexDirection: "row", justifyContent: "center", gap: 8,
                borderWidth: 1, borderColor: responded ? "rgba(22,163,74,0.25)" : "rgba(239,68,68,0.25)" }}>
              {acting ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name={responded ? "checkmark-circle-outline" : "close-circle-outline"}
                      size={18} color={responded ? "#16A34A" : "#EF4444"} />
                    <Text style={{ color: responded ? "#16A34A" : "#EF4444", fontSize: 14, fontWeight: "800" }}>
                      {responded ? "Valider et clore" : "Clore l'alerte"}
                    </Text>
                  </>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BUS DETAIL MODAL — Fiche complète bus + télémétrie + alertes
   ══════════════════════════════════════════════════════════════════ */
function BusDetailModal({
  bus, trip, alerts, speed, token,
  onClose, onTriggerAlert, onOpenCamera, onSelectAlert, onRefresh,
}: {
  bus: BusItem; trip?: TripItem; alerts: AlertItem[];
  speed?: number; token: string | null;
  onClose: () => void; onTriggerAlert: () => void;
  onOpenCamera: () => void; onSelectAlert: (a: AlertItem) => void;
  onRefresh: () => void;
}) {
  const st        = BUS_STATUS[bus.status ?? ""] ?? { label: bus.status ?? "—", color: "#64748B", bg: "#F1F5F9", icon: "bus-outline" };
  const occ       = trip?.passengerCount != null && trip?.seatCount
    ? Math.round((trip.passengerCount / trip.seatCount) * 100) : null;
  const camOk     = !!(trip?.cameraStatus === "connected" && trip?.cameraStreamUrl);
  const spd       = speed ?? 0;
  const speedWarn = bus.status === "en_route" && spd > 120;

  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#080C14", maxHeight: "92%",
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
          {/* Handle */}
          <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)",
            alignSelf: "center", marginTop: 12, marginBottom: 14 }} />
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, marginBottom: 18 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#F1F5F9", fontSize: 21, fontWeight: "900", letterSpacing: -0.5, lineHeight: 26 }}>
                {bus.busName}
              </Text>
              {bus.plateNumber && (
                <Text style={{ color: "#374151", fontSize: 11, fontWeight: "600", marginTop: 2, letterSpacing: 0.5 }}>
                  {bus.plateNumber}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
              {alerts.length > 0 && (
                <View style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 7,
                  paddingHorizontal: 9, paddingVertical: 4,
                  borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" }}>
                  <Text style={{ color: "#EF4444", fontSize: 10, fontWeight: "800" }}>
                    {alerts.length} ALERTE{alerts.length > 1 ? "S" : ""}
                  </Text>
                </View>
              )}
              <TouchableOpacity onPress={onClose}
                style={{ width: 32, height: 32, borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.07)", justifyContent: "center", alignItems: "center" }}>
                <Feather name="x" size={15} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "80%" }}>
            {/* Telemetry strip */}
            <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 18 }}>
              {/* Status */}
              <View style={{ flex: 1.2, backgroundColor: "#0D1117", borderRadius: 10, padding: 12,
                alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st.color }} />
                <Text style={{ color: st.color, fontSize: 9, fontWeight: "800", letterSpacing: 0.4, textAlign: "center" }}
                  numberOfLines={1}>{st.label.toUpperCase()}</Text>
              </View>
              {/* Speed */}
              {bus.status === "en_route" && (
                <View style={{ flex: 1.4, backgroundColor: speedWarn ? "rgba(239,68,68,0.07)" : "#0D1117",
                  borderRadius: 10, padding: 12, alignItems: "center",
                  borderWidth: 1, borderColor: speedWarn ? "rgba(239,68,68,0.22)" : "rgba(255,255,255,0.05)" }}>
                  <Text style={{ color: speedWarn ? "#EF4444" : "#E2E8F0", fontSize: 22, fontWeight: "900",
                    letterSpacing: -1, lineHeight: 26 }}>{spd}</Text>
                  <Text style={{ color: speedWarn ? "#EF4444" : "#374151", fontSize: 8, fontWeight: "700", letterSpacing: 0.5 }}>
                    {speedWarn ? "⚠ KM/H" : "KM/H"}
                  </Text>
                </View>
              )}
              {/* Occupancy */}
              {occ != null && (
                <View style={{ flex: 1, backgroundColor: "#0D1117", borderRadius: 10, padding: 12,
                  alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                  <Text style={{ color: occ >= 90 ? "#EF4444" : occ >= 70 ? "#F59E0B" : "#E2E8F0",
                    fontSize: 22, fontWeight: "900", letterSpacing: -1, lineHeight: 26 }}>{occ}</Text>
                  <Text style={{ color: "#374151", fontSize: 8, fontWeight: "700", letterSpacing: 0.5 }}>PASSAGERS %</Text>
                </View>
              )}
              {/* Camera */}
              <View style={{ flex: 1, backgroundColor: camOk ? "rgba(16,185,129,0.05)" : "#0D1117",
                borderRadius: 10, padding: 12, alignItems: "center", gap: 5,
                borderWidth: 1, borderColor: camOk ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.05)" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: camOk ? "#10B981" : "#1F2937" }} />
                <Text style={{ color: camOk ? "#10B981" : "#374151", fontSize: 8, fontWeight: "700" }}>CAM</Text>
              </View>
            </View>

            {/* Trip details */}
            {trip && (
              <View style={{ marginHorizontal: 20, backgroundColor: "#0D1117", borderRadius: 12,
                padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                <Text style={{ color: "#1F2937", fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 14 }}>
                  TRAJET EN COURS
                </Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ alignItems: "center", gap: 3, paddingTop: 3 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                    <View style={{ width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.08)" }} />
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#EF4444" }} />
                  </View>
                  <View style={{ flex: 1, gap: 10 }}>
                    <Text style={{ color: "#E2E8F0", fontSize: 15, fontWeight: "700" }}>{trip.from}</Text>
                    <Text style={{ color: "#E2E8F0", fontSize: 15, fontWeight: "700" }}>{trip.to}</Text>
                  </View>
                  {trip.departureTime && (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: "#1F2937", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>DÉPART</Text>
                      <Text style={{ color: "#9CA3AF", fontSize: 14, fontWeight: "700", marginTop: 3 }}>
                        {trip.departureTime.slice(11, 16)}
                      </Text>
                    </View>
                  )}
                </View>
                {occ != null && trip.passengerCount != null && trip.seatCount && (
                  <View style={{ marginTop: 14, gap: 7 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "#374151", fontSize: 10, fontWeight: "600" }}>Remplissage</Text>
                      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "700" }}>
                        {trip.passengerCount} / {trip.seatCount} passagers
                      </Text>
                    </View>
                    <View style={{ height: 3, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <View style={{ height: 3, borderRadius: 2, width: `${occ}%` as any,
                        backgroundColor: occ >= 90 ? "#EF4444" : occ >= 70 ? "#F59E0B" : "#10B981" }} />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Active alerts */}
            {alerts.length > 0 && (
              <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
                <Text style={{ color: "#1F2937", fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 }}>
                  ALERTES ACTIVES
                </Text>
                {alerts.map(a => {
                  const hasResp = !!a.response;
                  const isWait  = a.responseRequested && !hasResp;
                  return (
                    <TouchableOpacity key={a.id} onPress={() => onSelectAlert(a)} activeOpacity={0.8}
                      style={{ backgroundColor: "rgba(239,68,68,0.05)", borderRadius: 10, padding: 12,
                        marginBottom: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.18)",
                        flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444", flexShrink: 0 }} />
                      <Text style={{ flex: 1, color: "#E2E8F0", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                        {a.message || "Alerte active"}
                      </Text>
                      {hasResp && <Text style={{ color: "#10B981", fontSize: 9, fontWeight: "800" }}>RÉPONDU</Text>}
                      {isWait  && <Text style={{ color: "#EAB308", fontSize: 9, fontWeight: "800" }}>EN ATTENTE</Text>}
                      <Ionicons name="chevron-forward" size={13} color="#374151" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Camera live preview */}
            {camOk && trip && (
              <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
                <Text style={{ color: "#1F2937", fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 }}>
                  CAMÉRA EN DIRECT
                </Text>
                <TouchableOpacity onPress={onOpenCamera} activeOpacity={0.85}
                  style={{ borderRadius: 10, overflow: "hidden" }}>
                  <LiveCamView signal={90} route={`${trip.from} → ${trip.to}`} busId={bus.id} />
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    justifyContent: "center", alignItems: "center",
                    backgroundColor: "rgba(0,0,0,0.25)" }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25,
                      backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center",
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
                      <Ionicons name="play" size={22} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 10, padding: 20,
            borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
            <TouchableOpacity onPress={onTriggerAlert}
              style={{ flex: 1, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 12,
                paddingVertical: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" }}>
              <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "800" }}>
                Déclencher alerte
              </Text>
            </TouchableOpacity>
            {camOk && (
              <TouchableOpacity onPress={onOpenCamera}
                style={{ flex: 1, backgroundColor: "rgba(16,185,129,0.07)", borderRadius: 12,
                  paddingVertical: 14, alignItems: "center",
                  borderWidth: 1, borderColor: "rgba(16,185,129,0.18)" }}>
                <Text style={{ color: "#10B981", fontSize: 13, fontWeight: "800" }}>
                  Voir en direct
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ══════════════════════════════════════════════════════════════════ */

/* ── FadeCard : animation d'entrée fluide ── */
function FadeCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export default function SuiviScreen() {
  const { user, token, logout } = useAuth();
  const [data,        setData]        = useState<Overview | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [triggerBus,  setTriggerBus]  = useState<BusItem | null>(null);
  const [acting,      setActing]      = useState(false);
  const [cameraTrip,  setCameraTrip]  = useState<TripItem | null>(null);
  const [lastSync,    setLastSync]    = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  const hasAlerts      = !!(data?.alerts?.length);
  const activeCamCount = data?.trips?.filter(t => t.cameraStatus === "connected").length ?? 0;
  const hasCameras     = activeCamCount > 0;

  /* ── New interactive state ── */
  const [selectedBus,   setSelectedBus]   = useState<BusItem | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [soundMuted,    setSoundMuted]    = useState(false);
  const [busSpeedMap,   setBusSpeedMap]   = useState<Record<string, number>>({});
  const soundRef = useRef<{ stop: () => void } | null>(null);

  /* ── Live simulation frames/signal per camera trip ── */
  type LiveCamData = { frames: number; signal: number };
  const [liveFrames, setLiveFrames] = useState<Record<string, LiveCamData>>({});
  const [syncSec,    setSyncSec]    = useState(0);

  const activeCamTrips = useMemo(
    () => data?.trips?.filter(t => t.cameraStatus === "connected" && !!t.cameraStreamUrl) ?? [],
    [data]
  );

  /* ── Sorted buses: alert+camera first, then alert-only, then rest ── */
  const sortedBuses = useMemo(() => {
    if (!data?.buses) return [];
    return [...data.buses].sort((a, b) => {
      const aAlerts = data.alerts.filter(x => x.busId === a.id).length;
      const bAlerts = data.alerts.filter(x => x.busId === b.id).length;
      const aTrip   = data.trips.find(t => t.busId === a.id);
      const bTrip   = data.trips.find(t => t.busId === b.id);
      const aCamOk  = !!(aTrip?.cameraStatus === "connected" && aTrip?.cameraStreamUrl);
      const bCamOk  = !!(bTrip?.cameraStatus === "connected" && bTrip?.cameraStreamUrl);
      // Priority: alerts+camera → alerts → camera → rest
      const aScore = (aAlerts > 0 ? 10 : 0) + (aCamOk ? 5 : 0) + aAlerts;
      const bScore = (bAlerts > 0 ? 10 : 0) + (bCamOk ? 5 : 0) + bAlerts;
      return bScore - aScore;
    });
  }, [data]);

  /* ── Signal warning: any camera with signal < 75% ── */
  const signalWarnTrips = useMemo(
    () => activeCamTrips.filter(t => (liveFrames[t.id]?.signal ?? 100) < 75),
    [activeCamTrips, liveFrames]
  );

  useEffect(() => {
    if (hasAlerts) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      loop.start();
      return () => { loop.stop(); pulseAnim.setValue(1); };
    }
  }, [hasAlerts]);

  /* Slow glow breathe loop — for alert card highlights */
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const [loadError, setLoadError] = useState(false);

  const hasDataRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    let success = false;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(`${BASE_URL}/agent/suivi/overview`, {
          headers: authHeader(token),
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setLastSync(new Date());
          setLoadError(false);
          hasDataRef.current = true;
          success = true;
          break;
        }
      } catch {
        if (i < 2) await new Promise(r => setTimeout(r, 800 * (i + 1)));
      }
    }
    if (!success && !hasDataRef.current) setLoadError(true);
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  /* Dynamic polling: 5s when cameras active, 30s otherwise */
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const delay = hasCameras ? 5_000 : 30_000;
    intervalRef.current = setInterval(() => load(true), delay);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hasCameras, load]);

  /* ── Live seconds counter (resets on each sync) ── */
  useEffect(() => {
    setSyncSec(0);
    const iv = setInterval(() => setSyncSec(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [lastSync]);

  /* ── Simulated frame counter for connected camera trips (1s for fluidity) ── */
  useEffect(() => {
    if (!hasCameras || activeCamTrips.length === 0) {
      setLiveFrames({});
      return;
    }
    const iv = setInterval(() => {
      setLiveFrames(prev => {
        const next: Record<string, LiveCamData> = { ...prev };
        activeCamTrips.forEach(trip => {
          const cur = next[trip.id] ?? { frames: 0, signal: 93 };
          /* 25fps ± small jitter — natural stream rhythm */
          const fps    = 23 + Math.floor(Math.random() * 5);
          /* signal: mostly stable 87-99%, occasional dip to 65-80% */
          const rand   = Math.random();
          const signal = rand < 0.08 ? 65 + Math.floor(Math.random() * 14)   // 8% dip
                       : rand < 0.25 ? 87 + Math.floor(Math.random() * 10)   // 17% high
                       :               90 + Math.floor(Math.random() * 9);    // 75% nominal
          next[trip.id] = { frames: cur.frames + fps, signal };
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [hasCameras, activeCamTrips]);

  /* ── Sound alert: plays when active alerts + not muted (web only) ── */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (hasAlerts && !soundMuted) {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const beep = (when: number) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "square";
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0, when);
          gain.gain.linearRampToValueAtTime(0.18, when + 0.01);
          gain.gain.linearRampToValueAtTime(0, when + 0.13);
          osc.start(when);
          osc.stop(when + 0.13);
        };
        const schedule = () => {
          const t = ctx.currentTime;
          beep(t);
          beep(t + 0.22);
          beep(t + 0.44);
        };
        schedule();
        const iv = setInterval(schedule, 4200);
        soundRef.current = { stop: () => { clearInterval(iv); ctx.close().catch(() => {}); } };
      } catch {}
    } else {
      soundRef.current?.stop();
      soundRef.current = null;
    }
    return () => { soundRef.current?.stop(); soundRef.current = null; };
  }, [hasAlerts, soundMuted]);

  /* ── Speed simulation per bus (en_route only) ── */
  useEffect(() => {
    if (!data?.buses) return;
    setBusSpeedMap(prev => {
      const next: Record<string, number> = { ...prev };
      data.buses.forEach(b => {
        if ((b.status === "en_route" || b.status === "en_route_alerte") && !next[b.id])
          next[b.id] = 65 + Math.floor(Math.random() * 40);
      });
      return next;
    });
    const iv = setInterval(() => {
      setBusSpeedMap(prev => {
        const next: Record<string, number> = {};
        data.buses.forEach(b => {
          if (b.status === "en_route" || b.status === "en_route_alerte") {
            const cur = prev[b.id] ?? 75;
            next[b.id] = Math.max(45, Math.min(128, cur + Math.floor((Math.random() - 0.45) * 9)));
          }
        });
        return next;
      });
    }, 2800);
    return () => clearInterval(iv);
  }, [data?.buses]);

  /* When watching a camera live, refresh its trip data every 8s to detect disconnect */
  useEffect(() => {
    if (!cameraTrip) return;
    const iv = setInterval(async () => {
      if (!token) return;
      try {
        const res = await fetch(`${BASE_URL}/agent/suivi/trips/${cameraTrip.id}/camera`, {
          headers: authHeader(token),
        });
        if (res.ok) {
          const cam = await res.json();
          if (cam.status !== "connected" || !cam.streamUrl) {
            // Camera disconnected — close the player and refresh overview
            setCameraTrip(null);
            load(true);
          }
        }
      } catch {}
    }, 8_000);
    return () => clearInterval(iv);
  }, [cameraTrip, token, load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const syncLabel = lastSync
    ? `Sync ${lastSync.getHours().toString().padStart(2,"0")}:${lastSync.getMinutes().toString().padStart(2,"0")}:${lastSync.getSeconds().toString().padStart(2,"0")}`
    : "Synchronisation...";

  /* ── Trigger alert ── */
  const doTrigger = async (bus: BusItem, message?: string) => {
    setActing(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/suivi/alerts/trigger`, {
        method: "POST",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        body: JSON.stringify({ busId: bus.id, message }),
      });
      if (res.ok) {
        Alert.alert("Alerte déclenchée", "L'Agent Suivi est notifié.");
        setTriggerBus(null);
        await load(true);
      } else {
        Alert.alert("Erreur", "Impossible de déclencher l'alerte.");
      }
    } catch { Alert.alert("Erreur", "Problème réseau."); }
    setActing(false);
  };

  /* ── Demander réponse à l'agent en route ── */
  const demanderReponse = async (alertId: string) => {
    setActing(true);
    try {
      await fetch(`${BASE_URL}/agent/suivi/alerts/${alertId}/demander-reponse`, {
        method: "POST",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
      });
      Alert.alert("Demande envoyée", "L'agent en route va être notifié et devra répondre.");
      await load(true);
    } catch { Alert.alert("Erreur", "Problème réseau."); }
    setActing(false);
  };

  /* ── Confirm / resolve alert ── */
  const doConfirm = async (alertId: string) => {
    setActing(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/suivi/alerts/${alertId}/confirm`, {
        method: "POST",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
      });
      if (res.ok) {
        Alert.alert("Alerte résolue", "La situation est normalisée.");
        await load(true);
      }
    } catch {}
    setActing(false);
  };

  if (user?.role !== "agent") {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 32 }}>
        <Ionicons name="lock-closed" size={52} color="#D1D5DB" />
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>Accès non autorisé</Text>
        <TouchableOpacity style={{ backgroundColor: RED, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}
          onPress={() => router.replace("/agent/home" as never)}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (cameraTrip) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CAM_BG }}>
        <StatusBar barStyle="light-content" backgroundColor={CAM_BG} />
        <CameraPlayer trip={cameraTrip} onClose={() => setCameraTrip(null)} liveData={liveFrames[cameraTrip.id]} />
      </SafeAreaView>
    );
  }


  const activeTrip   = data?.trips?.find(t => t.status === "en_route") ?? data?.trips?.[0] ?? null;
  const totalPassengers = data?.trips?.reduce((s, t) => s + (t.passengerCount ?? 0), 0) ?? 0;
  const busCount     = data?.buses?.length ?? 0;
  const alertCount   = data?.alerts?.length ?? 0;

  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={RED_D} />

      {/* ══ HEADER ════════════════════════════════════════════════════ */}
      <View style={S.header}>
        {/* Top row */}
        <View style={S.headerTop}>
          <View style={S.headerLeft}>
            <View style={S.headerIcon}>
              <Ionicons name="radio" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, overflow: "hidden" }}>
              <Text style={S.headerTitle} numberOfLines={1}>{user?.name ?? "Agent Suivi"}</Text>
              <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                <Animated.View style={{ width:5, height:5, borderRadius:3,
                  backgroundColor: CAM_GR,
                  opacity: pulseAnim.interpolate({ inputRange:[1,1.04], outputRange:[1,0.1] }) }} />
                <Text style={S.headerSub}>SYSTÈME EN LIGNE · {new Date().toLocaleDateString("fr-FR")}</Text>
              </View>
            </View>
          </View>
          <View style={S.headerRight}>
            {lastSync && (
              <View style={S.syncPill}>
                <View style={S.syncDot} />
                <Text style={S.syncTxt}>{syncLabel}</Text>
              </View>
            )}
            {hasAlerts && (
              <TouchableOpacity onPress={() => setSoundMuted(m => !m)} style={[S.iconBtn,
                soundMuted && { backgroundColor: "rgba(239,68,68,0.2)", borderColor: "rgba(239,68,68,0.3)" }]}>
                <Ionicons name={soundMuted ? "volume-mute" : "volume-high"} size={16}
                  color={soundMuted ? "#EF4444" : "rgba(255,255,255,0.7)"} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => load(true)} style={S.iconBtn}>
              <Feather name="refresh-cw" size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={logout} style={S.iconBtn} hitSlop={8}>
              <Ionicons name="log-out-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        {/* KPI bar — Premium dashboard */}
        <View style={S.headerStats}>
          <View style={[S.kpiTile, { borderBottomColor: "#60A5FA" }]}>
            <Text style={S.kpiNum}>{busCount}</Text>
            <View style={S.kpiRow}>
              <Ionicons name="bus" size={9} color="rgba(255,255,255,0.45)" />
              <Text style={S.kpiLbl}>BUS</Text>
            </View>
          </View>
          <View style={S.kpiDiv} />
          <View style={[S.kpiTile, { borderBottomColor: "#4ADE80" }]}>
            <Text style={S.kpiNum}>{totalPassengers}</Text>
            <View style={S.kpiRow}>
              <Ionicons name="people" size={9} color="rgba(255,255,255,0.45)" />
              <Text style={S.kpiLbl}>PASSAGERS</Text>
            </View>
          </View>
          <View style={S.kpiDiv} />
          <View style={[S.kpiTile, { borderBottomColor: hasAlerts ? "#FCA5A5" : "rgba(255,255,255,0.1)" }]}>
            <Text style={[S.kpiNum, hasAlerts && { color: "#FCA5A5" }]}>{alertCount}</Text>
            <View style={S.kpiRow}>
              {hasAlerts && <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#FCA5A5",
                transform: [{ scale: pulseAnim }] }} />}
              <Text style={[S.kpiLbl, hasAlerts && { color: "#FCA5A5" }]}>ALERTES</Text>
            </View>
          </View>
          <View style={S.kpiDiv} />
          <View style={[S.kpiTile, { borderBottomColor: hasCameras ? CAM_GR : "rgba(255,255,255,0.1)" }]}>
            <Text style={[S.kpiNum, hasCameras && { color: CAM_GR }]}>{activeCamCount}</Text>
            <View style={S.kpiRow}>
              {hasCameras && <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: CAM_GR,
                opacity: pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.3] }) }} />}
              <Text style={[S.kpiLbl, hasCameras && { color: CAM_GR }]}>CAM LIVE</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Alarm bar — cinematic alert strip */}
      {hasAlerts && (
        <View style={S.alarmBar}>
          <Animated.View style={[S.alarmPulse, { transform: [{ scale: pulseAnim }] }]} />
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={S.alarmBarTxt}>
            {alertCount} ALERTE{alertCount > 1 ? "S" : ""} EN COURS
          </Text>
          <Text style={S.alarmBarBus} numberOfLines={1}>
            {data!.alerts[0]?.busName ?? "Intervention requise"}
          </Text>
          <View style={S.alarmUrgentBadge}>
            <Text style={S.alarmUrgentTxt}>URGENT</Text>
          </View>
        </View>
      )}

      {/* Loading / Error */}
      {loading && !data ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={RED} />
          <Text style={S.loadingTxt}>Chargement du tableau de bord…</Text>
          <Text style={S.loadingSub}>Connexion au serveur GoBooking en cours</Text>
        </View>
      ) : loadError && !data ? (
        <View style={S.center}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#FFF1F2", justifyContent: "center", alignItems: "center" }}>
            <Ionicons name="wifi-outline" size={34} color={RED} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A", textAlign: "center" }}>Connexion indisponible</Text>
          <Text style={{ fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 19 }}>
            Impossible de joindre le serveur.{"\n"}Vérifiez votre connexion réseau.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: RED_D, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8 }}
            onPress={() => { setLoadError(false); load(); }}
          >
            <Feather name="refresh-cw" size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>

          {/* ══ ALERTES FIXÉES — toujours visibles ══════════════════════ */}
          {hasAlerts && (
            <View style={S.fixedAlerts}>
              {data!.alerts.slice(0, 3).map(alert => {
                const isPanne = alert.type === "PANNE" || alert.type === "panne";
                const isCtrl  = alert.type === "CONTRÔLE" || alert.type === "controle";
                const typeColor = isPanne ? "#DC2626" : isCtrl ? "#B45309" : RED;
                const hasResponse = !!alert.response;
                const isWaiting   = alert.responseRequested && !hasResponse;
                return (
                  <TouchableOpacity key={alert.id} style={S.fixedAlertRow}
                    onPress={() => setSelectedAlert(alert)} activeOpacity={0.75}>
                    <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeColor,
                      transform: [{ scale: pulseAnim }], flexShrink: 0 }} />
                    <Text style={S.fixedAlertBus} numberOfLines={1}>{alert.busName}</Text>
                    <Text style={S.fixedAlertMsg} numberOfLines={1}>{alert.message}</Text>
                    {hasResponse && (
                      <View style={{ backgroundColor: "rgba(16,185,129,0.15)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                        <Text style={{ color: "#10B981", fontSize: 8, fontWeight: "800" }}>RÉP.</Text>
                      </View>
                    )}
                    {isWaiting && (
                      <View style={{ backgroundColor: "rgba(234,179,8,0.15)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                        <Text style={{ color: "#EAB308", fontSize: 8, fontWeight: "800" }}>ATT.</Text>
                      </View>
                    )}
                    <Text style={S.fixedAlertTime}>
                      {new Date(alert.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.25)" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ══ BANDE CAMÉRAS — priorité 2, au-dessus des bus ═════════ */}
          {hasCameras && (
            <View style={S.camStrip}>
              <View style={S.camStripHdr}>
                <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR,
                  opacity: pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.2] }) }} />
                <Text style={S.camStripTitle}>CAMÉRAS LIVE</Text>
                <Text style={S.camStripCount}>{activeCamCount} FLUX</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.camStripScroll}>
                {sortedBuses.map(bus => {
                  const trip  = data!.trips.find(t => t.busId === bus.id);
                  const camOk = !!(trip?.cameraStatus === "connected" && trip?.cameraStreamUrl);
                  if (!camOk || !trip) return null;
                  const liveCam = liveFrames[trip.id];
                  return (
                    <TouchableOpacity key={bus.id} style={S.camStripCard}
                      onPress={() => setCameraTrip(trip)} activeOpacity={0.85}>
                      {/* Badge row */}
                      <View style={S.camStripBadgeRow}>
                        <Animated.View style={{ width: 5, height: 5, borderRadius: 2.5,
                          backgroundColor: "#EF4444",
                          opacity: pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.1] }) }} />
                        <Text style={S.camStripRec}>REC</Text>
                        <View style={S.camStripLiveBadge}><Text style={S.camStripLiveTxt}>LIVE</Text></View>
                        <View style={{ flex: 1 }} />
                        <Text style={{ color: "#4B5563", fontSize: 7, fontWeight: "600" }} numberOfLines={1}>
                          {bus.busName}
                        </Text>
                      </View>
                      <LiveCamView
                        signal={liveCam?.signal ?? 82}
                        route={`${trip.from} → ${trip.to}`}
                        busId={bus.id}
                      />
                      <View style={S.camStripBtn}>
                        <Text style={S.camStripBtnTxt}>VOIR EN DIRECT</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ══ GRILLE BUS — priorité 3, flex:1 ═══════════════════════ */}
          <FlatList
            data={sortedBuses}
            numColumns={2}
            keyExtractor={b => b.id}
            style={{ flex: 1 }}
            contentContainerStyle={S.gridContent}
            columnWrapperStyle={S.gridRow}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
            ListEmptyComponent={
              <View style={[S.center, { paddingVertical: 40 }]}>
                <Ionicons name="bus-outline" size={40} color="#1E293B" />
                <Text style={[S.emptyTxt, { color: "#475569" }]}>Aucun bus en service</Text>
              </View>
            }
            renderItem={({ item: bus }) => {
              const trip      = data!.trips.find(t => t.busId === bus.id);
              const st        = BUS_STATUS[bus.status ?? ""] ?? { label: bus.status ?? "—", color: "#64748B", bg: "#F1F5F9" };
              const busAlerts = data!.alerts.filter(a => a.busId === bus.id);
              const occ       = trip?.passengerCount != null && trip?.seatCount
                ? Math.round((trip.passengerCount / trip.seatCount) * 100) : null;
              const occColor  = occ != null ? (occ >= 90 ? "#DC2626" : occ >= 70 ? "#D97706" : "#16A34A") : "#16A34A";
              const camOk     = !!(trip?.cameraStatus === "connected" && trip?.cameraStreamUrl);
              const speed     = busSpeedMap[bus.id];
              const speedWarn = speed != null && speed > 120;
              return (
                <TouchableOpacity
                  style={[S.gridCard, { borderLeftColor: busAlerts.length ? RED : speedWarn ? "#EF4444" : st.color }]}
                  onPress={() => setSelectedBus(bus)}
                  activeOpacity={0.85}>
                  {/* Name */}
                  <Text style={S.gridCardName} numberOfLines={1}>{bus.busName}</Text>
                  {/* Status chip */}
                  <View style={[S.gridStatusChip]}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: st.color }} />
                    <Text style={[S.gridStatusTxt, { color: st.color }]}>{st.label.toUpperCase()}</Text>
                  </View>
                  {/* Route */}
                  {trip && (
                    <Text style={S.gridRoute} numberOfLines={1}>{trip.from} → {trip.to}</Text>
                  )}
                  {/* Speed — only en_route */}
                  {speed != null && (
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: "900", color: speedWarn ? "#EF4444" : "#E2E8F0", letterSpacing: -0.5, lineHeight: 22 }}>
                        {speed}
                      </Text>
                      <Text style={{ fontSize: 9, color: speedWarn ? "#EF4444" : "#374151", fontWeight: "700" }}>
                        {speedWarn ? "⚠ km/h" : "km/h"}
                      </Text>
                    </View>
                  )}
                  {/* Occupancy */}
                  {occ != null && (
                    <View style={S.gridOccWrap}>
                      <View style={S.gridOccBar}>
                        <View style={[S.gridOccFill, { width: (occ + "%") as any, backgroundColor: occColor }]} />
                      </View>
                      <Text style={[S.gridOccPct, { color: occColor }]}>{occ}%</Text>
                    </View>
                  )}
                  {/* Alert */}
                  {busAlerts.length > 0 && (
                    <View style={S.gridAlertRow}>
                      <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: RED,
                        transform: [{ scale: pulseAnim }] }} />
                      <Text style={S.gridAlertTxt} numberOfLines={1}>{busAlerts[0].message}</Text>
                    </View>
                  )}
                  {/* Camera indicator + chevron */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                    {camOk && (
                      <View style={S.gridCamDot}>
                        <Animated.View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: CAM_GR,
                          opacity: pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.2] }) }} />
                        <Text style={S.gridCamTxt}>CAM</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }} />
                    <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.15)" />
                  </View>
                </TouchableOpacity>
              );
            }}
          />

        </View>
      )}

      {/* ══ MODAL — Déclencher une alerte ════════════════════════════ */}
      <Modal visible={!!triggerBus} transparent animationType="slide">
        <View style={S.modalBg}>
          <View style={S.modalBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: RED_L,
                justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: RED_M }}>
                <Ionicons name="warning" size={22} color={RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.modalTitle}>Déclencher une alerte</Text>
                <Text style={S.modalSub}>
                  {triggerBus?.busName} · {triggerBus?.plateNumber}
                </Text>
              </View>
            </View>
            <Text style={S.modalLabel}>Type d'alerte</Text>
            {["Arrêt anormal non prévu", "Bus immobilisé sur route", "Besoin d'assistance immédiate"].map(msg => (
              <TouchableOpacity key={msg} style={S.msgOption} onPress={() => triggerBus && doTrigger(triggerBus, msg)}>
                <Ionicons name="alert-circle-outline" size={18} color={RED} />
                <Text style={S.msgOptionTxt}>{msg}</Text>
                <Ionicons name="chevron-forward" size={16} color={RED_M} />
              </TouchableOpacity>
            ))}
            <View style={S.modalActions}>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: "#F1F5F9" }]} onPress={() => setTriggerBus(null)}>
                <Text style={{ color: "#64748B", fontWeight: "700", fontSize: 14 }}>Annuler</Text>
              </TouchableOpacity>
              {acting && (
                <View style={[S.modalBtn, { backgroundColor: RED_D }]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Alert Detail Modal ──────────────────────────────────── */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          trip={data?.trips.find(t => t.busId === selectedAlert.busId)}
          token={token}
          onClose={() => setSelectedAlert(null)}
          onRefresh={() => load(false)}
        />
      )}

      {/* ── Bus Detail Modal ─────────────────────────────────────── */}
      {selectedBus && (
        <BusDetailModal
          bus={selectedBus}
          trip={data?.trips.find(t => t.busId === selectedBus.id)}
          alerts={data?.alerts.filter(a => a.busId === selectedBus.id) ?? []}
          speed={busSpeedMap[selectedBus.id]}
          token={token}
          onClose={() => setSelectedBus(null)}
          onTriggerAlert={() => { setTriggerBus(selectedBus); setSelectedBus(null); }}
          onOpenCamera={() => {
            const trip = data?.trips.find(t => t.busId === selectedBus.id);
            if (trip?.cameraStatus === "connected" && trip?.cameraStreamUrl) {
              setSelectedBus(null);
              setCameraTrip(trip);
            }
          }}
          onSelectAlert={(a) => { setSelectedBus(null); setSelectedAlert(a); }}
          onRefresh={() => load(false)}
        />
      )}
    </SafeAreaView>
  );
}

/* ── Camera Player Styles ─────────────────────────────────────── */
const CS = StyleSheet.create({
  container:   { flex: 1, backgroundColor: CAM_BG },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  liveBadge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#DC2626", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText:    { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  camTitle:    { flex: 1, color: "#E2E8F0", fontSize: 13, fontWeight: "700" },
  closeBtn:    { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  videoWrap:   { flex: 1, position: "relative", overflow: "hidden" },
  videoLoader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 10, backgroundColor: CAM_BG },
  video:       { flex: 1, backgroundColor: "#000" },
  footer:      { flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  footerItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  footerTxt:   { color: "#64748B", fontSize: 11, fontWeight: "600" },
  metaOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(10,14,26,0.82)", paddingHorizontal: 12, paddingVertical: 8 },
  metaRow:     { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaChip:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  metaChipTxt: { color: "#94A3B8", fontSize: 10, fontWeight: "700" },
  zoomHint:    { position: "absolute", top: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(10,14,26,0.75)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  zoomHintTxt: { color: "rgba(255,255,255,0.5)", fontSize: 10 },
});

/* ── Camera Pill Styles ────────────────────────────────────────── */
const CP = StyleSheet.create({
  pill:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  pillActive: { backgroundColor: "#052E16", borderWidth: 1, borderColor: "#166534" },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  txt:        { fontSize: 12, fontWeight: "600", color: "#94A3B8", flex: 1 },
});

/* ── Main Styles ─────────────────────────────────────────────────── */
const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080C14" },

  /* ── Header ─────────────────────────────────────────────────── */
  header:     { backgroundColor: RED_D },
  headerTop:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, overflow: "hidden" },
  headerRight:{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)",
                justifyContent: "center", alignItems: "center", flexShrink: 0,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  headerTitle:{ color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  headerSub:  { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 1, letterSpacing: 0.3 },

  /* KPI bar — premium dashboard numbers */
  headerStats:{ flexDirection: "row", paddingHorizontal: 4, paddingTop: 8, paddingBottom: 16,
                borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.09)",
                backgroundColor: "rgba(0,0,0,0.3)" },
  kpiTile:    { flex: 1, alignItems: "center", paddingVertical: 12, gap: 5,
                borderBottomWidth: 3, borderBottomColor: "rgba(255,255,255,0.1)",
                marginHorizontal: 2 },
  kpiNum:     { color: "#fff", fontSize: 34, fontWeight: "900", lineHeight: 38, letterSpacing: -1.5 },
  kpiLbl:     { color: "rgba(255,255,255,0.5)", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  kpiRow:     { flexDirection: "row", alignItems: "center", gap: 4 },
  kpiDiv:     { width: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 },

  syncPill:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  syncDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR },
  syncTxt:    { color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  iconBtn:    { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.14)",
                justifyContent: "center", alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },

  /* Alarm bar — cinematic red band */
  alarmBar:        { flexDirection: "row", alignItems: "center", gap: 8,
                     backgroundColor: "#7F1D1D", paddingHorizontal: 16, paddingVertical: 14,
                     borderBottomWidth: 2, borderBottomColor: "#450A0A" },
  alarmPulse:      { width: 11, height: 11, borderRadius: 6, backgroundColor: "#FCA5A5", flexShrink: 0 },
  alarmBarTxt:     { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.6 },
  alarmBarBus:     { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700", flex: 1 },
  alarmUrgentBadge:{ backgroundColor: "#DC2626", borderRadius: 7,
                     paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#FCA5A5" },
  alarmUrgentTxt:  { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },

  /* Center / Loading */
  center:     { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 36 },
  loadingTxt: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  loadingSub: { fontSize: 12, color: "#94A3B8", textAlign: "center", lineHeight: 18 },

  /* Scroll */
  scroll: { padding: 14, gap: 20, paddingBottom: 64 },

  /* Sync row */
  syncRow:    { flexDirection: "row", alignItems: "center", gap: 8,
                backgroundColor: "rgba(255,255,255,0.88)", borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 8,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  syncRowTxt: { fontSize: 11, color: "#64748B", fontWeight: "600", flex: 1 },

  /* Sections */
  section:      { gap: 12 },
  sectionHeader:{ flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIconBox:{ width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A", letterSpacing: -0.4, flex: 1 },
  sectionCount: { backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
                  fontSize: 11, color: "#64748B", fontWeight: "800" },

  /* Alert band header — clean red announcement when alerts active */
  alertBandHeader: { flexDirection: "row", alignItems: "center", gap: 12,
                     backgroundColor: "#1A0505", borderRadius: 8,
                     paddingHorizontal: 14, paddingVertical: 12,
                     borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  alertBandTitle:  { color: "#FECACA", fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  alertBandSub:    { color: "rgba(252,165,165,0.5)", fontSize: 10, fontWeight: "500", marginTop: 1 },
  alertBandBadge:  { backgroundColor: "#EF4444", borderRadius: 6,
                     paddingHorizontal: 9, paddingVertical: 5, flexShrink: 0 },
  alertBandBadgeTxt:{ color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },

  /* Console band — dark monitoring header for Tour de contrôle / Caméras */
  consoleBand:      { flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: "#0F172A", borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 11 },
  consoleBandTitle: { flex: 1, color: "#94A3B8", fontSize: 11, fontWeight: "900",
                      letterSpacing: 2, textTransform: "uppercase" as any },
  consoleBandCount: { backgroundColor: "#1E293B", borderRadius: 7, borderWidth: 1,
                      borderColor: "#334155", paddingHorizontal: 9, paddingVertical: 4 },
  consoleBandCountTxt:{ color: "#64748B", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },

  /* Empty state */
  empty: { backgroundColor: "#fff", borderRadius: 18, padding: 32, alignItems: "center", gap: 12,
           ...(Platform.OS === "web"
             ? { boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }
             : { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }) },
  emptyTxt: { color: "#94A3B8", fontSize: 13, fontWeight: "700" },

  /* ── B. Bus cards ─────────────────────────────────────────────── */
  ctCard:        { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden",
                   ...(Platform.OS === "web"
                     ? { boxShadow: "0 6px 24px rgba(0,0,0,0.13)" }
                     : { shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 20,
                         shadowOffset: { width: 0, height: 6 }, elevation: 8 }) },
  ctHeader:      { flexDirection: "row", alignItems: "center",
                   paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  ctHeaderIconWrap:{ width: 46, height: 46, borderRadius: 14,
                   backgroundColor: "rgba(255,255,255,0.2)",
                   justifyContent: "center", alignItems: "center", flexShrink: 0 },
  ctHeaderName:  { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: -0.5 },
  ctHeaderPlate: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700", marginTop: 2 },
  ctAlertBadge:  { flexDirection: "row", alignItems: "center", gap: 5,
                   backgroundColor: "rgba(255,255,255,0.22)",
                   borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5,
                   borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  ctAlertBadgeTxt:{ fontSize: 9, fontWeight: "900", color: "#fff" },
  ctStatusChip:  { flexDirection: "row", alignItems: "center", gap: 5,
                   backgroundColor: "rgba(255,255,255,0.18)",
                   borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5,
                   borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  ctStatusChipTxt:{ color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },

  /* Route — simplified single row */
  ctRouteRow:    { flexDirection: "row", alignItems: "center",
                   backgroundColor: "#EFF6FF", borderRadius: 12,
                   paddingHorizontal: 12, paddingVertical: 10,
                   borderWidth: 1, borderColor: "#BFDBFE", gap: 8 },
  ctRouteFull:   { flex: 1, fontSize: 14, fontWeight: "800", color: "#1E3A5F", letterSpacing: -0.3 },
  ctDeptTime:    { fontSize: 12, fontWeight: "900", color: "#0F172A", flexShrink: 0 },

  /* Occupancy */
  ctOccSection: { gap: 7 },
  ctOccLabelRow:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ctPassNum:    { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  ctPassTotal:  { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  ctOccBar:     { height: 10, backgroundColor: "#F1F5F9", borderRadius: 8, overflow: "hidden" },
  ctOccFill:    { height: 10, borderRadius: 8 },
  ctOccPct:     { fontSize: 13, fontWeight: "900" },

  ctFooter:    { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  ctCamBtn:    { flexDirection: "row", alignItems: "center", gap: 5,
                 backgroundColor: "#052E16", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7,
                 borderWidth: 1, borderColor: "#166534" },
  ctCamTxt:    { color: CAM_GR, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  ctCamFrames: { color: "#4ADE80", fontSize: 10, fontWeight: "700" },
  ctNoCam:     { flexDirection: "row", alignItems: "center", gap: 4,
                 backgroundColor: "#F8FAFC", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
                 borderWidth: 1, borderColor: "#E2E8F0" },
  ctNoCamTxt:  { fontSize: 10, color: "#CBD5E1", fontWeight: "600" },
  ctGpsChip:   { flexDirection: "row", alignItems: "center", gap: 4, flex: 1,
                 backgroundColor: "#FAF5FF", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
                 borderWidth: 1, borderColor: "#E9D5FF" },
  ctGpsTxt:    { fontSize: 10, color: "#7C3AED", fontWeight: "600", flex: 1 },
  /* ── Inline camera preview block ───────────────────────────── */
  ctCamPreview:    { height: 148, backgroundColor: "#020408", position: "relative", overflow: "hidden" },
  ctCamPreviewBg:  { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  ctScanLine:      { position: "absolute", left: 0, right: 0, height: 1,
                     backgroundColor: "rgba(255,255,255,0.025)" },
  ctCamCornerTL:   { position: "absolute", top: 10, left: 10, width: 18, height: 18,
                     borderTopWidth: 2, borderLeftWidth: 2, borderColor: CAM_GR },
  ctCamCornerTR:   { position: "absolute", top: 10, right: 10, width: 18, height: 18,
                     borderTopWidth: 2, borderRightWidth: 2, borderColor: CAM_GR },
  ctCamCornerBL:   { position: "absolute", bottom: 36, left: 10, width: 18, height: 18,
                     borderBottomWidth: 2, borderLeftWidth: 2, borderColor: CAM_GR },
  ctCamCornerBR:   { position: "absolute", bottom: 36, right: 10, width: 18, height: 18,
                     borderBottomWidth: 2, borderRightWidth: 2, borderColor: CAM_GR },
  ctRecBadge:      { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 5,
                     backgroundColor: "rgba(0,0,0,0.78)", borderRadius: 6,
                     paddingHorizontal: 8, paddingVertical: 4 },
  ctRecTxt:        { color: "#EF4444", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  ctLiveBadge:     { position: "absolute", top: 10, right: 10, backgroundColor: "#DC2626",
                     borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  ctLiveTxt:       { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  ctCamCenterArea: { position: "absolute", top: 0, left: 0, right: 0, bottom: 34,
                     justifyContent: "center", alignItems: "center" },
  ctSignalWrap:    { position: "absolute", bottom: 40, right: 12,
                     flexDirection: "row", alignItems: "flex-end", gap: 2 },
  ctSignalPct:     { color: CAM_GR, fontSize: 9, fontWeight: "800", marginRight: 4 },
  ctSignalBar:     { width: 4, borderRadius: 2 },
  ctCamBottom:     { position: "absolute", bottom: 0, left: 0, right: 0,
                     backgroundColor: "rgba(0,0,0,0.85)", paddingHorizontal: 12, paddingVertical: 8,
                     flexDirection: "row", alignItems: "center", gap: 8 },
  ctCamBottomBus:  { color: "#fff", fontSize: 11, fontWeight: "800", flex: 1 },
  ctCamBottomRoute:{ color: "rgba(255,255,255,0.48)", fontSize: 9 },
  ctCamPlayBtn:    { flexDirection: "row", alignItems: "center", gap: 5,
                     backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 7,
                     paddingHorizontal: 9, paddingVertical: 5,
                     borderWidth: 1, borderColor: "rgba(34,197,94,0.35)" },
  ctCamPlayTxt:    { color: CAM_GR, fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },

  ctAlertInline:   { flexDirection: "row", alignItems: "center", gap: 8,
                     backgroundColor: "#FFF1F2", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
                     borderWidth: 1, borderColor: RED_M },
  ctAlertInlineTxt:{ flex: 1, fontSize: 12, color: RED_D, fontWeight: "600", lineHeight: 17 },
  ctAlertTime:     { fontSize: 10, color: RED, fontWeight: "800", flexShrink: 0 },

  /* ── C. Caméras ──────────────────────────────────────────────── */
  camLivePill:    { flexDirection: "row", alignItems: "center", gap: 5,
                    backgroundColor: "#052E16", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
                    borderWidth: 1, borderColor: "#166534" },
  camLivePillTxt: { color: CAM_GR, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },

  /* Stats strip */
  camStatsRow:  { flexDirection: "row", gap: 8 },
  camStatChip:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                  backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 9,
                  borderWidth: 1, borderColor: "#1E293B" },
  camStatTxt:   { fontSize: 10, fontWeight: "700", color: "#64748B" },

  camCard:     { backgroundColor: CAM_BG, borderRadius: 18, overflow: "hidden",
                 borderWidth: 1, borderColor: "#1A3A2A",
                 ...(Platform.OS === "web"
                   ? { boxShadow: "0 6px 24px rgba(0,0,0,0.35)" }
                   : { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 18, elevation: 8 }) },
  camCardHdr:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                 paddingHorizontal: 14, paddingVertical: 11,
                 backgroundColor: "#050810", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  camLiveLbl:  { color: "#EF4444", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  camSigTxt:   { fontSize: 10, fontWeight: "700", marginLeft: 2 },

  /* LIVE badge */
  camLiveBadge:    { backgroundColor: "#EF4444", borderRadius: 5,
                     paddingHorizontal: 7, paddingVertical: 3 },
  camLiveBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },

  /* Monitor area */
  camMonitor:       { height: 110, backgroundColor: "#020408", position: "relative",
                      justifyContent: "flex-end", overflow: "hidden" },
  camMonitorBg:     { position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                      padding: 12, justifyContent: "space-between" },
  camMonitorCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 28,
                      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  camMonitorFooter: { position: "absolute", bottom: 0, left: 0, right: 0,
                      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                      backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 14, paddingVertical: 7 },

  camIconWrap: { width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(34,197,94,0.15)",
                 justifyContent: "center", alignItems: "center", position: "relative", flexShrink: 0,
                 borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  camLiveDot:  { position: "absolute", top: 2, right: 2, width: 10, height: 10, borderRadius: 5,
                 backgroundColor: CAM_GR, borderWidth: 2, borderColor: "#020408" },
  camBusName:  { fontSize: 13, fontWeight: "800", color: "#E2E8F0", letterSpacing: -0.2 },
  camRoute:    { fontSize: 10, color: "#64748B" },
  camOverRoute:{ fontSize: 11, color: "#64748B", fontWeight: "600" },
  camPos:      { fontSize: 10, color: "#334155" },
  camFrames:   { fontSize: 10, color: CAM_GR, fontWeight: "700" },

  /* Full-width watch button */
  camWatchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                 backgroundColor: "#052E16", paddingVertical: 15,
                 borderTopWidth: 1, borderTopColor: "#166834" },
  camWatchTxt: { color: CAM_GR, fontSize: 13, fontWeight: "900", letterSpacing: 0.5, flex: 1, textAlign: "center" },

  /* ── D. Alertes ──────────────────────────────────────────────── */
  alertCountPill:   { backgroundColor: RED, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  alertCountPillTxt:{ color: "#fff", fontSize: 12, fontWeight: "900" },

  /* ── D. Alert cards — control tower redesign ─────────────────── */
  alertCard:       { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden",
                     ...(Platform.OS === "web"
                       ? { boxShadow: "0 6px 24px rgba(0,0,0,0.14)" }
                       : { shadowColor: "#000", shadowOpacity: 0.13, shadowRadius: 20,
                           shadowOffset: { width: 0, height: 6 }, elevation: 8 }) },
  alertHeader:     { flexDirection: "row", alignItems: "center",
                     paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  alertHeaderIcon: { width: 44, height: 44, borderRadius: 13,
                     backgroundColor: "rgba(255,255,255,0.22)",
                     justifyContent: "center", alignItems: "center", flexShrink: 0 },
  alertHeaderType: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  alertHeaderBus:  { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "800", marginTop: 2 },
  alertHeaderTime: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" },
  alertCritBadge:  { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 6,
                     paddingHorizontal: 7, paddingVertical: 3, marginTop: 4,
                     borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  alertCritBadgeTxt:{ color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  alertBody:       { padding: 14, gap: 10 },
  alertMsg:        { fontSize: 14, color: "#1E293B", fontWeight: "700", lineHeight: 21 },
  alertAgent:      { fontSize: 11, color: "#64748B", fontWeight: "600" },
  alertResponseRow:{ flexDirection: "row", alignItems: "center", gap: 8,
                     borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  alertResponseTxt:{ fontSize: 12, fontWeight: "700" },
  alertWaitRow:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB",
                   borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
                   borderWidth: 1, borderColor: "#FDE68A" },
  alertWaitTxt:  { fontSize: 12, color: "#D97706", fontWeight: "600", flex: 1 },
  alertActions:  { flexDirection: "row", gap: 8 },
  alertBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                   paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  alertBtnTxt:   { fontSize: 12, fontWeight: "700" },

  /* ── E. Actions rapides ──────────────────────────────────────── */
  quickGrid:   { gap: 12 },
  quickBtn:    { flex: 1, backgroundColor: "#fff", borderRadius: 18, padding: 18,
                 alignItems: "center", gap: 10,
                 ...(Platform.OS === "web"
                   ? { boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }
                   : { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10,
                       shadowOffset: { width: 0, height: 2 }, elevation: 3 }) },
  quickIcon:   { width: 54, height: 54, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  quickBtnTxt: { fontSize: 12, fontWeight: "700", color: "#0F172A", textAlign: "center", lineHeight: 16 },

  /* ── Modal ──────────────────────────────────────────────────── */
  modalBg:     { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalBox:    { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
                 padding: 24, gap: 12 },
  modalTitle:  { fontSize: 18, fontWeight: "900", color: "#0F172A", letterSpacing: -0.3 },
  modalSub:    { fontSize: 12, color: "#64748B" },
  modalLabel:  { fontSize: 12, fontWeight: "700", color: "#475569", letterSpacing: 0.2 },
  msgOption:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: RED_L,
                 borderRadius: 14, padding: 14, borderWidth: 1, borderColor: RED_M },
  msgOptionTxt:{ flex: 1, fontSize: 13, fontWeight: "600", color: RED_D, lineHeight: 18 },
  modalActions:{ flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn:    { flex: 1, alignItems: "center", justifyContent: "center",
                 paddingVertical: 15, borderRadius: 14 },

  /* ── ALERTES FIXÉES (bandeau haut, toujours visible) ─────────── */
  fixedAlerts:    { backgroundColor: "#450A0A", paddingVertical: 6, paddingHorizontal: 12, gap: 5 },
  fixedAlertRow:  { flexDirection: "row", alignItems: "center", gap: 8,
                    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 7 },
  fixedAlertBus:  { color: "#FCA5A5", fontSize: 11, fontWeight: "900", flexShrink: 0 },
  fixedAlertMsg:  { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "600", flex: 1 },
  fixedAlertTime: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "700", flexShrink: 0 },

  /* ── GRILLE BUS 2 COLONNES ───────────────────────────────────── */
  gridContent:    { padding: 10, gap: 10, paddingBottom: 20 },
  gridRow:        { gap: 10 },
  gridCard:       { flex: 1, backgroundColor: "#0D1117", borderRadius: 12,
                    padding: 14, gap: 9, borderLeftWidth: 3,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  gridCardName:   { fontSize: 13, fontWeight: "800", color: "#E2E8F0", letterSpacing: -0.2 },
  gridStatusChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 6,
                    paddingHorizontal: 7, paddingVertical: 4, alignSelf: "flex-start",
                    backgroundColor: "rgba(255,255,255,0.06)" },
  gridStatusTxt:  { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  gridRoute:      { fontSize: 10.5, color: "#4B5563", fontWeight: "500" },
  gridOccWrap:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  gridOccBar:     { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" },
  gridOccFill:    { height: 3, borderRadius: 2 },
  gridOccPct:     { fontSize: 10, fontWeight: "800", flexShrink: 0 },
  gridAlertRow:   { flexDirection: "row", alignItems: "center", gap: 5,
                    backgroundColor: "rgba(239,68,68,0.10)", borderRadius: 5,
                    paddingHorizontal: 7, paddingVertical: 4 },
  gridAlertTxt:   { flex: 1, fontSize: 9.5, color: "#EF4444", fontWeight: "600" },
  gridCamDot:     { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 2 },
  gridCamTxt:     { fontSize: 8, color: "#10B981", fontWeight: "700", letterSpacing: 0.8 },

  /* ── BANDE CAMÉRAS (au-dessus de la grille bus) ───────────────── */
  camStrip:       { backgroundColor: "#080C12", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  camStripHdr:    { flexDirection: "row", alignItems: "center", gap: 8,
                    paddingHorizontal: 14, paddingVertical: 9 },
  camStripTitle:  { flex: 1, color: "#374151", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  camStripCount:  { color: "#374151", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  camStripScroll: { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  camStripCard:   { width: 168, borderRadius: 8, overflow: "hidden",
                    backgroundColor: "#060810",
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  camStripMonitor:{ height: 118 },
  camStripBadgeRow:{ flexDirection: "row", alignItems: "center", gap: 4,
                    paddingHorizontal: 8, paddingVertical: 5,
                    backgroundColor: "#04060B" },
  camStripRec:    { color: "#EF4444", fontSize: 7.5, fontWeight: "800", letterSpacing: 0.4 },
  camStripLiveBadge:{ backgroundColor: "#DC2626", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  camStripLiveTxt:{ color: "#fff", fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  camStripFooter: { gap: 1 },
  camStripBusName:{ color: "#CBD5E1", fontSize: 10, fontWeight: "700" },
  camStripRoute:  { color: "#374151", fontSize: 9, fontWeight: "500" },
  camStripBtn:    { paddingVertical: 7, alignItems: "center",
                    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  camStripBtnTxt: { color: "rgba(255,255,255,0.35)", fontSize: 8.5, fontWeight: "700", letterSpacing: 1 },
});
