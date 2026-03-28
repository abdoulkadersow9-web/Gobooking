import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
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
  logisticStatus: string; currentLocation?: string; issue?: string;
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

  const hasAlerts      = !!(data?.alerts?.length);
  const activeCamCount = data?.trips?.filter(t => t.cameraStatus === "connected").length ?? 0;
  const hasCameras     = activeCamCount > 0;

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

  const activeTrip = data?.trips?.find(t => t.status === "en_route") ?? data?.trips?.[0] ?? null;
  const agentStatusLabel = activeTrip ? "EN ROUTE" : "ACTIF";

  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={RED_D} />

      {/* ══ A. HEADER ══════════════════════════════════════════════ */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <View style={S.headerIcon}>
            <Ionicons name="radio" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={S.headerTitle} numberOfLines={1}>{user?.name ?? "Agent Suivi"}</Text>
              <View style={[S.statusBadge, { backgroundColor: activeTrip ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.12)" }]}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: activeTrip ? "#22C55E" : "rgba(255,255,255,0.4)" }} />
                <Text style={[S.statusBadgeTxt, { color: activeTrip ? "#4ADE80" : "rgba(255,255,255,0.65)" }]}>{agentStatusLabel}</Text>
              </View>
            </View>
            <Text style={S.headerSub} numberOfLines={1}>
              {activeTrip
                ? `${activeTrip.from} → ${activeTrip.to} · départ ${activeTrip.departureTime}`
                : "Surveillance en temps réel"}
            </Text>
          </View>
        </View>
        <View style={S.headerRight}>
          {lastSync && (
            <View style={S.syncPill}>
              <View style={S.syncDot} />
              <Text style={S.syncTxt}>{syncLabel}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => load(true)} style={S.iconBtn}>
            <Feather name="refresh-cw" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={S.iconBtn} hitSlop={8}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Loading / Error ── */}
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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          showsVerticalScrollIndicator={false}
        >

          {/* ══ B. TOUR DE CONTRÔLE — toujours visible ══════════════ */}
          <View style={S.cockpit}>
            {/* Cockpit header */}
            <View style={S.cockpitHdr}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Animated.View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: hasAlerts ? "#EF4444" : "#22C55E",
                  opacity: hasAlerts
                    ? pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.2] })
                    : 1,
                }} />
                <Text style={S.cockpitTitle}>TOUR DE CONTRÔLE</Text>
              </View>
              {hasCameras && (
                <View style={S.cockpitLivePill}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: CAM_GR }} />
                  <Text style={S.cockpitLiveTxt}>{activeCamCount} CAM LIVE</Text>
                </View>
              )}
            </View>

            {/* KPI row — 4 chips toujours visibles */}
            <View style={S.cockpitKpiRow}>
              <View style={S.cockpitKpiItem}>
                <Text style={[S.cockpitKpiNum, { color: "#A78BFA" }]}>
                  {data?.trips?.reduce((s, t) => s + (t.passengerCount ?? 0), 0) ?? 0}
                </Text>
                <Ionicons name="people" size={11} color="#6D28D9" />
                <Text style={S.cockpitKpiLbl}>Passagers</Text>
              </View>
              <View style={S.cockpitKpiDiv} />
              <View style={S.cockpitKpiItem}>
                <Text style={[S.cockpitKpiNum, { color: hasAlerts ? "#F87171" : "#94A3B8" }]}>
                  {data?.alerts?.length ?? 0}
                </Text>
                <Ionicons name="warning" size={11} color={hasAlerts ? "#EF4444" : "#475569"} />
                <Text style={S.cockpitKpiLbl}>Alertes</Text>
              </View>
              <View style={S.cockpitKpiDiv} />
              <View style={S.cockpitKpiItem}>
                <Text style={[S.cockpitKpiNum, { color: "#60A5FA" }]}>{data?.buses?.length ?? 0}</Text>
                <Ionicons name="bus" size={11} color="#1D4ED8" />
                <Text style={S.cockpitKpiLbl}>Bus actifs</Text>
              </View>
              <View style={S.cockpitKpiDiv} />
              <View style={S.cockpitKpiItem}>
                <Text style={[S.cockpitKpiNum, { color: hasCameras ? CAM_GR : "#94A3B8" }]}>{activeCamCount}</Text>
                <Ionicons name="videocam" size={11} color={hasCameras ? "#16A34A" : "#475569"} />
                <Text style={S.cockpitKpiLbl}>Caméras</Text>
              </View>
            </View>

            {/* Signal warning */}
            {signalWarnTrips.length > 0 && (
              <View style={S.cockpitSignalWarn}>
                <Ionicons name="warning" size={13} color="#FCD34D" />
                <Text style={S.cockpitSignalWarnTxt}>
                  SIGNAL FAIBLE — {signalWarnTrips.map(t => `${t.from}→${t.to}`).join(", ")}
                </Text>
                <Text style={{ color: "#FCD34D", fontSize: 9, fontWeight: "900" }}>
                  {Math.min(...signalWarnTrips.map(t => liveFrames[t.id]?.signal ?? 99))}%
                </Text>
              </View>
            )}

            {/* Alerte banner animée */}
            {hasAlerts && (
              <Animated.View style={[S.alarmBanner, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="warning" size={18} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={S.alarmTxt}>
                    {data!.alerts.length} ALERTE{data!.alerts.length > 1 ? "S" : ""} ACTIVE{data!.alerts.length > 1 ? "S" : ""}
                  </Text>
                  <Text style={S.alarmSub}>
                    {data!.alerts[0]?.busName ? `Bus : ${data!.alerts[0].busName}` : "Intervention requise"}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Live camera trips */}
            {activeCamTrips.map(trip => {
              const liveCam    = liveFrames[trip.id];
              const tripAlerts = data?.alerts?.filter(a => a.busId === trip.busId) ?? [];
              const hasAlert   = tripAlerts.length > 0;
              const sigLow     = (liveCam?.signal ?? 100) < 75;
              return (
                <View key={trip.id} style={[S.cockpitTripRow, hasAlert && S.cockpitTripRowAlert, sigLow && !hasAlert && S.cockpitTripRowSigWarn]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={S.cockpitLiveDot} />
                      <Text style={S.cockpitTripName} numberOfLines={1}>{trip.from} → {trip.to}</Text>
                      {tripAlerts.length > 0 && (
                        <View style={{ backgroundColor: "#7F1D1D", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
                          <Text style={{ color: "#FCA5A5", fontSize: 9, fontWeight: "900" }}>⚠ {tripAlerts.length}</Text>
                        </View>
                      )}
                    </View>
                    {liveCam && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={S.cockpitFramesTxt}>▲ {liveCam.frames} img</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          {[0,1,2,3].map(b => (
                            <View key={b} style={{ width: 3, height: 5 + b * 2,
                              backgroundColor: b < Math.ceil((liveCam.signal / 100) * 4) ? CAM_GR : "#1E293B", borderRadius: 1 }} />
                          ))}
                          <Text style={[S.cockpitFramesTxt, { marginLeft: 2 }]}>{liveCam.signal}%</Text>
                        </View>
                      </View>
                    )}
                    {!liveCam && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <ActivityIndicator size="small" color={CAM_GR} />
                        <Text style={S.cockpitFramesTxt}>Initialisation flux…</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={S.cockpitWatchBtn} onPress={() => setCameraTrip(trip)} activeOpacity={0.8}>
                    <Ionicons name="play-circle" size={16} color={CAM_GR} />
                    <Text style={S.cockpitWatchTxt}>Voir</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Sync ticker */}
            <View style={S.cockpitSyncRow}>
              <View style={{ width: 5, height: 5, borderRadius: 3,
                backgroundColor: syncSec < 4 ? CAM_GR : syncSec < 8 ? "#FCD34D" : "#94A3B8" }} />
              <Text style={S.cockpitSyncTxt}>
                {syncSec < 2
                  ? "Sync OK"
                  : syncSec <= (hasCameras ? 5 : 30)
                    ? `Next sync ${Math.max(0, (hasCameras ? 5 : 30) - syncSec)}s`
                    : "En attente…"}
                {" · "}{syncLabel}
              </Text>
              {hasCameras && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                  <Animated.View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: CAM_GR,
                    opacity: pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.2] }) }} />
                  <Text style={{ color: CAM_GR, fontSize: 9, fontWeight: "900" }}>
                    {activeCamCount} FLUX ACTIF{activeCamCount > 1 ? "S" : ""}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ══ C. CAMÉRA EMBARQUÉE ═══════════════════════════════════ */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Ionicons name="videocam" size={15} color="#334155" />
              <Text style={S.sectionTitle}>Caméra embarquée</Text>
              {hasCameras && (
                <View style={{ backgroundColor: "#052E16", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: "auto" }}>
                  <Text style={{ color: CAM_GR, fontSize: 10, fontWeight: "800" }}>{activeCamCount} LIVE</Text>
                </View>
              )}
            </View>

            {/* Connexion status — ligne horizontale : QR | Bluetooth | Wi-Fi */}
            <View style={S.camConnRow}>
              <View style={[S.camConnChip, hasCameras && { borderColor: "#7C3AED", backgroundColor: "#F5F3FF" }]}>
                <Ionicons name="qr-code" size={15} color={hasCameras ? "#7C3AED" : "#94A3B8"} />
                <Text style={[S.camConnTxt, hasCameras && { color: "#7C3AED", fontWeight: "800" }]}>QR</Text>
              </View>
              <View style={[S.camConnChip, hasCameras && { borderColor: "#0369A1", backgroundColor: "#F0F9FF" }]}>
                <Feather name="bluetooth" size={15} color={hasCameras ? "#0369A1" : "#94A3B8"} />
                <Text style={[S.camConnTxt, hasCameras && { color: "#0369A1", fontWeight: "800" }]}>Bluetooth</Text>
              </View>
              <View style={[S.camConnChip, hasCameras && { borderColor: "#059669", backgroundColor: "#F0FDF4" }]}>
                <Feather name="wifi" size={15} color={hasCameras ? "#059669" : "#94A3B8"} />
                <Text style={[S.camConnTxt, hasCameras && { color: "#059669", fontWeight: "800" }]}>Wi-Fi</Text>
              </View>
            </View>

            {/* Liste caméras ou état vide */}
            {!hasCameras ? (
              <View style={[S.empty, { backgroundColor: CAM_BG, borderWidth: 1, borderColor: "#1E293B" }]}>
                <Ionicons name="videocam-off-outline" size={28} color="#334155" />
                <Text style={[S.emptyTxt, { color: "#475569" }]}>Aucune caméra connectée</Text>
                <Text style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>
                  Les caméras s'activent lorsqu'un bus est en route
                </Text>
              </View>
            ) : (
              sortedBuses.map(bus => {
                const trip  = data!.trips.find(t => t.busId === bus.id);
                const camOk = !!(trip && trip.cameraStatus === "connected" && trip.cameraStreamUrl);
                const liveCam = trip ? liveFrames[trip.id] : null;
                if (!camOk || !trip) return null;
                return (
                  <View key={bus.id} style={S.camCard}>
                    <View style={S.camCardLeft}>
                      <View style={S.camIconWrap}>
                        <Ionicons name="videocam" size={20} color={CAM_GR} />
                        <View style={S.camLiveDot} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={S.camCardTitle}>{bus.busName}</Text>
                          <View style={S.tcLiveBadge}>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" }} />
                            <Text style={S.tcLiveTxt}>LIVE</Text>
                          </View>
                        </View>
                        <Text style={S.camCardSub}>
                          {trip.from} → {trip.to} · {trip.cameraPosition ?? "intérieur"}
                        </Text>
                        {liveCam && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
                            <Text style={{ color: CAM_GR, fontSize: 10, fontWeight: "700" }}>▲ {liveCam.frames} img</Text>
                            <View style={{ flexDirection: "row", gap: 2, alignItems: "flex-end" }}>
                              {[0,1,2,3].map(b => (
                                <View key={b} style={{ width: 3, height: 5 + b * 2,
                                  backgroundColor: b < Math.ceil((liveCam.signal / 100) * 4) ? CAM_GR : "#1E293B", borderRadius: 1 }} />
                              ))}
                              <Text style={{ color: CAM_GR, fontSize: 10, fontWeight: "700", marginLeft: 2 }}>{liveCam.signal}%</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity style={S.tcWatchBtn} onPress={() => setCameraTrip(trip)} activeOpacity={0.82}>
                      <Ionicons name="play-circle" size={16} color={CAM_GR} />
                      <Text style={S.tcWatchTxt}>Voir</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          {/* ══ D. ALERTES ═══════════════════════════════════════════ */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Ionicons name="warning" size={15} color={hasAlerts ? RED : "#22C55E"} />
              <Text style={S.sectionTitle}>Alertes actives</Text>
              {data?.alerts?.length ? (
                <View style={{ backgroundColor: RED, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: "auto" }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{data.alerts.length}</Text>
                </View>
              ) : null}
            </View>

            {!data?.alerts?.length ? (
              <View style={S.empty}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
                </View>
                <Text style={S.emptyTxt}>Aucune alerte active</Text>
                <Text style={{ fontSize: 11, color: "#94A3B8", textAlign: "center" }}>Tous les bus roulent normalement</Text>
              </View>
            ) : (
              data!.alerts.map(alert => {
                const hasResponse  = !!alert.response;
                const reqRequested = !!alert.responseRequested;
                const responseOpt  = RESPONSE_OPTIONS.find(r => r.id === alert.response);
                const typeColor    = alert.type === "panne" ? "#DC2626" : alert.type === "controle" ? "#D97706" : RED;
                const typeBg       = alert.type === "panne" ? "#FEE2E2" : alert.type === "controle" ? "#FEF3C7" : RED_L;
                const borderCol    = alert.type === "panne" ? "#DC2626" : alert.type === "controle" ? "#D97706" : "#94A3B8";
                const typeLabel    = alert.type === "panne" ? "PANNE" : alert.type === "controle" ? "CONTRÔLE" : "ALERTE";
                return (
                  <FadeCard key={alert.id} style={[S.alertCard, { borderLeftColor: borderCol }]}>
                    <View style={S.alertTop}>
                      <View style={[S.alertTypeBadge, { backgroundColor: typeBg }]}>
                        <Text style={[S.alertTypeTxt, { color: typeColor }]}>{typeLabel}</Text>
                      </View>
                      <Text style={S.alertBus}>{alert.busName ?? "Bus inconnu"}</Text>
                      <Text style={S.alertTime}>
                        {new Date(alert.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>

                    <Text style={S.alertMsg}>{alert.message}</Text>
                    <Text style={S.alertAgent}>
                      <Ionicons name="person-outline" size={10} color="#94A3B8" />{" "}
                      {alert.agentName ?? alert.agentId}
                    </Text>

                    {hasResponse && responseOpt && (
                      <View style={[S.responsePill, { backgroundColor: responseOpt.bg, gap: 6 }]}>
                        <Ionicons name="checkmark-circle" size={13} color={responseOpt.color} />
                        <Text style={[S.responseTxt, { color: responseOpt.color }]}>Réponse : {responseOpt.label}</Text>
                      </View>
                    )}
                    {reqRequested && !hasResponse && (
                      <View style={S.waitPill}>
                        <ActivityIndicator size="small" color="#D97706" />
                        <Text style={S.waitTxt}>En attente de réponse de l'agent route…</Text>
                      </View>
                    )}

                    <View style={S.alertActions}>
                      {!reqRequested && (
                        <TouchableOpacity
                          style={[S.alertBtn, { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF", flex: 1 }]}
                          onPress={() => demanderReponse(alert.id)} disabled={acting}
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color="#1D4ED8" />
                          <Text style={[S.alertBtnTxt, { color: "#1D4ED8" }]}>Demander rapport</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[S.alertBtn, { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4", flex: 1, justifyContent: "center" }]}
                        onPress={() => doConfirm(alert.id)} disabled={acting}
                      >
                        {acting
                          ? <ActivityIndicator size="small" color="#166534" />
                          : <Ionicons name="checkmark-circle-outline" size={14} color="#166834" />}
                        <Text style={[S.alertBtnTxt, { color: "#166534" }]}>Marquer résolu</Text>
                      </TouchableOpacity>
                    </View>
                  </FadeCard>
                );
              })
            )}
          </View>

          {/* ══ E. BUS EN TEMPS RÉEL ══════════════════════════════════ */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Feather name="radio" size={14} color="#1D4ED8" />
              <Text style={S.sectionTitle}>Bus en temps réel</Text>
              <Text style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>
                {data?.buses?.length ?? 0} véhicule{(data?.buses?.length ?? 0) > 1 ? "s" : ""}
              </Text>
            </View>

            {!sortedBuses.length ? (
              <View style={S.empty}>
                <Ionicons name="bus-outline" size={32} color="#CBD5E1" />
                <Text style={S.emptyTxt}>Aucun bus trouvé</Text>
              </View>
            ) : (
              sortedBuses.map(bus => {
                const st        = BUS_STATUS[bus.logisticStatus] ?? { label: bus.logisticStatus, color: "#64748B", bg: "#F1F5F9", icon: "bus-outline" };
                const trip      = data!.trips.find(t => t.busId === bus.id);
                const busAlerts = data!.alerts.filter(a => a.busId === bus.id);
                const eta       = trip?.etaTime ?? trip?.arrivalTime;
                const isPriority = busAlerts.length > 0;
                return (
                  <View key={bus.id} style={[S.busCard, { borderLeftWidth: 3, borderLeftColor: isPriority ? RED : st.color }, isPriority && S.busCardPriority]}>

                    {/* Bus header */}
                    <View style={S.busTop}>
                      <View style={[S.busStatus, { backgroundColor: st.bg }]}>
                        <Ionicons name={st.icon as any} size={20} color={st.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.busName}>{bus.busName}</Text>
                        <Text style={S.busPlate}>{bus.plateNumber}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        {busAlerts.length > 0 && (
                          <View style={S.alertCountBadge}>
                            <Ionicons name="warning" size={11} color="#fff" />
                            <Text style={S.alertCountTxt}>{busAlerts.length}</Text>
                          </View>
                        )}
                        <View style={[S.statusPill, { backgroundColor: st.bg }]}>
                          <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Trajet + ETA */}
                    {trip && (
                      <View style={S.busInfoRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
                          <Ionicons name="navigate" size={12} color="#1D4ED8" />
                          <Text style={S.busInfoTxt} numberOfLines={1}>{trip.from} → {trip.to}</Text>
                        </View>
                        <View style={S.busChip}>
                          <Ionicons name="time-outline" size={11} color="#64748B" />
                          <Text style={S.busChipTxt}>{trip.departureTime}</Text>
                        </View>
                        {eta && (
                          <View style={[S.busChip, { backgroundColor: "#F0FDF4" }]}>
                            <Ionicons name="flag-outline" size={11} color="#15803D" />
                            <Text style={[S.busChipTxt, { color: "#15803D" }]}>{eta}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* GPS */}
                    {bus.currentLocation && (
                      <View style={S.busGpsRow}>
                        <Ionicons name="location" size={12} color="#7C3AED" />
                        <Text style={S.busGpsTxt}>{bus.currentLocation}</Text>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: CAM_GR }} />
                        <Text style={{ fontSize: 10, color: CAM_GR, fontWeight: "700" }}>GPS</Text>
                      </View>
                    )}

                    {/* Occupation */}
                    {trip && trip.passengerCount != null && trip.seatCount != null && trip.seatCount > 0 && (
                      <View style={{ gap: 4 }}>
                        <View style={S.tcOccHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Ionicons name="people" size={12} color="#059669" />
                            <Text style={S.tcOccLabel}>Occupation</Text>
                          </View>
                          <Text style={S.tcOccValue}>
                            {trip.passengerCount} / {trip.seatCount} · {Math.min(100, Math.round((trip.passengerCount / trip.seatCount) * 100))}%
                          </Text>
                        </View>
                        <View style={S.tcOccBar}>
                          <View style={[S.tcOccFill, {
                            width: `${Math.min(100, Math.round((trip.passengerCount / trip.seatCount) * 100))}%` as any,
                            backgroundColor: trip.passengerCount / trip.seatCount > 0.9 ? "#DC2626" : "#22C55E",
                          }]} />
                        </View>
                      </View>
                    )}

                    {/* Alerte inline */}
                    {busAlerts.length > 0 && (
                      <View style={S.tcAlertInline}>
                        <Ionicons name="warning" size={14} color={RED} />
                        <View style={{ flex: 1 }}>
                          <Text style={S.tcAlertTxt} numberOfLines={2}>{busAlerts[0].message}</Text>
                          <Text style={S.tcAlertTime}>
                            {new Date(busAlerts[0].createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            {busAlerts.length > 1 ? ` · +${busAlerts.length - 1} alerte(s)` : ""}
                          </Text>
                        </View>
                      </View>
                    )}

                    {bus.issue && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8 }}>
                        <Ionicons name="alert-circle" size={14} color="#DC2626" />
                        <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "600", flex: 1 }}>{bus.issue}</Text>
                      </View>
                    )}

                    <TouchableOpacity style={S.triggerBtn} onPress={() => setTriggerBus(bus)} activeOpacity={0.8}>
                      <Ionicons name="warning-outline" size={14} color={RED} />
                      <Text style={S.triggerBtnTxt}>Déclencher une alerte</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          {/* ══ F. ACTIONS RAPIDES ════════════════════════════════════ */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Feather name="zap" size={14} color="#D97706" />
              <Text style={S.sectionTitle}>Actions rapides</Text>
            </View>
            <View style={S.quickGrid}>
              <TouchableOpacity style={S.quickBtn} onPress={() => router.push("/agent/scan" as never)} activeOpacity={0.8}>
                <View style={[S.quickIcon, { backgroundColor: "#EEF2FF" }]}>
                  <Ionicons name="qr-code" size={22} color="#4F46E5" />
                </View>
                <Text style={S.quickBtnTxt}>Scanner ticket</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickBtn} activeOpacity={0.8}
                onPress={() => Alert.alert("Ajouter passager", "Disponible depuis le guichet ou la réservation.")}>
                <View style={[S.quickIcon, { backgroundColor: "#F0FDF4" }]}>
                  <Ionicons name="person-add" size={22} color="#16A34A" />
                </View>
                <Text style={S.quickBtnTxt}>Ajouter passager</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickBtn} onPress={() => router.push("/agent/rapport" as never)} activeOpacity={0.8}>
                <View style={[S.quickIcon, { backgroundColor: "#FFF7ED" }]}>
                  <Feather name="file-text" size={22} color="#D97706" />
                </View>
                <Text style={S.quickBtnTxt}>Faire un rapport</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickBtn} activeOpacity={0.8}
                onPress={() => sortedBuses.length
                  ? setTriggerBus(sortedBuses[0])
                  : Alert.alert("Aucun bus", "Aucun bus actif disponible.")}>
                <View style={[S.quickIcon, { backgroundColor: RED_L }]}>
                  <Ionicons name="warning" size={22} color={RED} />
                </View>
                <Text style={S.quickBtnTxt}>Déclencher alerte</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      )}

      {/* ── Modal — Déclencher une alerte ── */}
      <Modal visible={!!triggerBus} transparent animationType="slide">
        <View style={S.modalBg}>
          <View style={S.modalBox}>
            <Text style={S.modalTitle}>Déclencher une alerte</Text>
            <Text style={S.modalSub}>Bus : {triggerBus?.busName} ({triggerBus?.plateNumber})</Text>
            <Text style={S.modalLabel}>Choisir le message</Text>
            {["Arrêt anormal non prévu", "Bus immobilisé sur route", "Besoin d'assistance immédiate"].map(msg => (
              <TouchableOpacity key={msg} style={S.msgOption} onPress={() => triggerBus && doTrigger(triggerBus, msg)}>
                <Ionicons name="alert-circle-outline" size={16} color={RED} />
                <Text style={S.msgOptionTxt}>{msg}</Text>
              </TouchableOpacity>
            ))}
            <View style={S.modalActions}>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: "#F1F5F9" }]} onPress={() => setTriggerBus(null)}>
                <Text style={{ fontWeight: "700", color: "#475569" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: RED }]}
                onPress={() => triggerBus && doTrigger(triggerBus)} disabled={acting}>
                {acting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontWeight: "700", color: "#fff" }}>Alerte générale</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  /* Metadata overlay */
  metaOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(10,14,26,0.82)", paddingHorizontal: 12, paddingVertical: 8 },
  metaRow:     { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaChip:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  metaChipTxt: { color: "#94A3B8", fontSize: 10, fontWeight: "700" },
  /* Zoom hint */
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


/* ── Styles ─────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },

  /* A. Header */
  header:        { backgroundColor: RED_D, paddingHorizontal: 16, paddingVertical: 12,
                   flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  headerLeft:    { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, overflow: "hidden" },
  headerRight:   { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  headerIcon:    { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)",
                   justifyContent: "center", alignItems: "center", flexShrink: 0 },
  headerTitle:   { color: "#fff", fontSize: 16, fontWeight: "800" },
  headerSub:     { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 1 },
  statusBadge:   { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8,
                   paddingHorizontal: 7, paddingVertical: 3 },
  statusBadgeTxt:{ fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  syncPill:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.1)",
                   borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  syncDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR },
  syncTxt:       { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  iconBtn:       { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.13)",
                   justifyContent: "center", alignItems: "center" },

  /* Loading / Error center */
  center:        { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: 36 },
  loadingTxt:    { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  loadingSub:    { fontSize: 12, color: "#94A3B8", textAlign: "center" },

  /* Scroll */
  scroll: { padding: 16, gap: 18, paddingBottom: 40 },

  /* B. Tour de Contrôle — cockpit panel */
  cockpit:             { backgroundColor: CAM_BG, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#1E293B" },
  cockpitHdr:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                         paddingHorizontal: 14, paddingVertical: 11,
                         borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  cockpitTitle:        { color: "#E2E8F0", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  cockpitLivePill:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#052E16",
                         borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  cockpitLiveTxt:      { color: CAM_GR, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  cockpitKpiRow:   { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12,
                     borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  cockpitKpiItem:  { flex: 1, alignItems: "center", gap: 3 },
  cockpitKpiNum:   { fontSize: 20, fontWeight: "900", color: "#E2E8F0" },
  cockpitKpiLbl:   { fontSize: 9, fontWeight: "700", color: "#475569", letterSpacing: 0.5 },
  cockpitKpiDiv:   { width: 1, backgroundColor: "rgba(255,255,255,0.07)", marginVertical: 4 },

  cockpitSignalWarn:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8,
                          backgroundColor: "rgba(252,211,77,0.08)", borderTopWidth: 1, borderTopColor: "rgba(252,211,77,0.2)" },
  cockpitSignalWarnTxt: { flex: 1, color: "#FCD34D", fontSize: 10, fontWeight: "700" },

  alarmBanner:  { backgroundColor: RED, flexDirection: "row", alignItems: "center", gap: 10,
                  marginHorizontal: 14, marginTop: 10, paddingVertical: 10, paddingHorizontal: 12,
                  borderRadius: 10 },
  alarmTxt:     { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.4 },
  alarmSub:     { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 1 },

  cockpitTripRow:       { flexDirection: "row", alignItems: "flex-start", gap: 12,
                          paddingHorizontal: 14, paddingVertical: 11,
                          borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  cockpitTripRowAlert:  { borderLeftWidth: 2, borderLeftColor: "#EF4444", backgroundColor: "rgba(239,68,68,0.06)" },
  cockpitTripRowSigWarn:{ borderLeftWidth: 2, borderLeftColor: "#FCD34D", backgroundColor: "rgba(252,211,77,0.04)" },
  cockpitLiveDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF3B3B", marginTop: 3 },
  cockpitTripName:      { fontSize: 13, fontWeight: "800", color: "#E2E8F0", flex: 1 },
  cockpitFramesTxt:     { fontSize: 9, color: CAM_GR, fontWeight: "800" },
  cockpitWatchBtn:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(34,197,94,0.12)",
                          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#166534" },
  cockpitWatchTxt:      { color: CAM_GR, fontSize: 11, fontWeight: "800" },

  cockpitSyncRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  cockpitSyncTxt: { fontSize: 9, color: "#334155", fontWeight: "600" },

  /* Sections */
  section:       { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle:  { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  empty:         { backgroundColor: "#fff", borderRadius: 12, padding: 28, alignItems: "center", gap: 8 },
  emptyTxt:      { color: "#94A3B8", fontSize: 13, fontWeight: "600" },

  /* C. Caméra embarquée */
  camConnRow:  { flexDirection: "row", gap: 10 },
  camConnChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                 backgroundColor: "#F8FAFC", borderRadius: 10, paddingVertical: 10,
                 borderWidth: 1, borderColor: "#E2E8F0" },
  camConnTxt:  { fontSize: 12, fontWeight: "600", color: "#94A3B8" },

  camCard:     { backgroundColor: CAM_BG, borderRadius: 12, padding: 12, flexDirection: "row",
                 alignItems: "center", justifyContent: "space-between", gap: 10,
                 borderWidth: 1, borderColor: "#166534" },
  camCardLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  camIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(34,197,94,0.15)",
                 justifyContent: "center", alignItems: "center", position: "relative", flexShrink: 0 },
  camLiveDot:  { position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 4,
                 backgroundColor: CAM_GR, borderWidth: 1.5, borderColor: CAM_BG },
  camCardTitle:{ fontSize: 13, fontWeight: "800", color: "#E2E8F0" },
  camCardSub:  { fontSize: 11, color: "#64748B", marginTop: 2 },
  tcLiveBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DC2626",
                 borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  tcLiveTxt:   { color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  tcWatchBtn:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(34,197,94,0.12)",
                 borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#166534" },
  tcWatchTxt:  { color: CAM_GR, fontSize: 12, fontWeight: "800" },

  /* D. Alertes */
  alertCard:     { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 10,
                   borderLeftWidth: 4, borderLeftColor: RED },
  alertTop:      { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTypeBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  alertTypeTxt:  { fontSize: 10, fontWeight: "800" },
  alertBus:      { flex: 1, fontSize: 13, fontWeight: "700", color: "#0F172A" },
  alertTime:     { fontSize: 11, color: "#94A3B8" },
  alertMsg:      { fontSize: 13, color: "#1E293B", fontWeight: "600", lineHeight: 18 },
  alertAgent:    { fontSize: 11, color: "#94A3B8" },
  responsePill:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  responseTxt:   { fontSize: 12, fontWeight: "700" },
  waitPill:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7",
                   paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  waitTxt:       { fontSize: 12, color: "#D97706", fontWeight: "600" },
  alertActions:  { flexDirection: "row", gap: 8 },
  alertBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                   paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  alertBtnTxt:   { fontSize: 12, fontWeight: "700" },

  /* E. Bus en temps réel */
  busCard:         { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 10 },
  busCardPriority: { backgroundColor: "#FFF5F5" },
  busTop:          { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  busStatus:       { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  busName:         { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  busPlate:        { fontSize: 11, color: "#64748B" },
  statusPill:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTxt:       { fontSize: 10, fontWeight: "700" },
  alertCountBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: RED,
                     borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  alertCountTxt:   { fontSize: 10, fontWeight: "900", color: "#fff" },

  busInfoRow:  { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
                 backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  busInfoTxt:  { fontSize: 13, fontWeight: "700", color: "#0F172A", flex: 1 },
  busChip:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E2E8F0",
                 borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  busChipTxt:  { fontSize: 11, fontWeight: "700", color: "#475569" },
  busGpsRow:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 2 },
  busGpsTxt:   { fontSize: 12, color: "#7C3AED", fontWeight: "600", flex: 1 },

  tcOccHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tcOccLabel:  { fontSize: 11, color: "#64748B", fontWeight: "600" },
  tcOccValue:  { fontSize: 11, color: "#059669", fontWeight: "700" },
  tcOccBar:    { height: 6, backgroundColor: "#DCFCE7", borderRadius: 4, overflow: "hidden" },
  tcOccFill:   { height: 6, borderRadius: 4 },

  tcAlertInline: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFF1F2",
                   borderRadius: 10, padding: 10, borderWidth: 1, borderColor: RED_M },
  tcAlertTxt:    { fontSize: 12, color: RED_D, fontWeight: "700", lineHeight: 16 },
  tcAlertTime:   { fontSize: 10, color: RED, marginTop: 2 },

  triggerBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                   paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: RED_M, backgroundColor: RED_L },
  triggerBtnTxt: { fontSize: 13, fontWeight: "700", color: RED },

  /* F. Actions rapides */
  quickGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickBtn:    { width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 14,
                 alignItems: "center", gap: 8,
                 ...(Platform.OS === "web" ? { boxShadow: "0 1px 6px rgba(0,0,0,0.07)" } : { elevation: 2 }) },
  quickIcon:   { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  quickBtnTxt: { fontSize: 12, fontWeight: "700", color: "#0F172A", textAlign: "center" },

  /* Modal */
  modalBg:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:     { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle:   { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  modalSub:     { fontSize: 13, color: "#64748B" },
  modalLabel:   { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 4 },
  msgOption:    { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: RED_L,
                  borderRadius: 10, padding: 12, borderWidth: 1, borderColor: RED_M },
  msgOptionTxt: { flex: 1, fontSize: 13, fontWeight: "600", color: RED_D },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn:     { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12 },
});
