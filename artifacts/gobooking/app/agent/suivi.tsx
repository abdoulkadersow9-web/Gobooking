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
              <Text style={S.headerSub}>Tour de contrôle · GoBooking</Text>
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
        {/* Stats bar */}
        <View style={S.headerStats}>
          <View style={S.statChip}>
            <Ionicons name="bus" size={13} color="rgba(255,255,255,0.65)" />
            <Text style={S.statNum}>{busCount}</Text>
            <Text style={S.statLbl}>Bus</Text>
          </View>
          <View style={S.statDiv} />
          <View style={S.statChip}>
            <Ionicons name="people" size={13} color="rgba(255,255,255,0.65)" />
            <Text style={S.statNum}>{totalPassengers}</Text>
            <Text style={S.statLbl}>Passagers</Text>
          </View>
          <View style={S.statDiv} />
          <View style={S.statChip}>
            <Ionicons name="warning" size={13} color={hasAlerts ? "#FCA5A5" : "rgba(255,255,255,0.65)"} />
            <Text style={[S.statNum, hasAlerts && { color: "#FCA5A5" }]}>{alertCount}</Text>
            <Text style={[S.statLbl, hasAlerts && { color: "#FCA5A5" }]}>Alertes</Text>
          </View>
          <View style={S.statDiv} />
          <View style={S.statChip}>
            <Ionicons name="videocam" size={13} color={hasCameras ? "#4ADE80" : "rgba(255,255,255,0.65)"} />
            <Text style={[S.statNum, hasCameras && { color: "#4ADE80" }]}>{activeCamCount}</Text>
            <Text style={[S.statLbl, hasCameras && { color: "#4ADE80" }]}>Cam LIVE</Text>
          </View>
        </View>
      </View>

      {/* Alarm bar — pinned below header if alerts */}
      {hasAlerts && (
        <Animated.View style={[S.alarmBar, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="warning" size={15} color="#fff" />
          <Text style={S.alarmBarTxt}>
            {alertCount} ALERTE{alertCount > 1 ? "S" : ""} ACTIVE{alertCount > 1 ? "S" : ""}
          </Text>
          <Text style={S.alarmBarBus}>
            {data!.alerts[0]?.busName ? "· Bus : " + data!.alerts[0].busName : "· Intervention requise"}
          </Text>
        </Animated.View>
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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          showsVerticalScrollIndicator={false}
        >

          {/* Sync ticker */}
          <View style={S.syncRow}>
            <View style={{ width: 7, height: 7, borderRadius: 4,
              backgroundColor: syncSec < 4 ? "#22C55E" : syncSec < 8 ? "#FCD34D" : "#CBD5E1" }} />
            <Text style={S.syncRowTxt}>
              {syncSec <= (hasCameras ? 5 : 30)
                ? "Prochaine synchro dans " + Math.max(0, (hasCameras ? 5 : 30) - syncSec) + "s"
                : "Synchronisation en attente…"}
              {"  ·  "}{syncLabel}
            </Text>
            {hasCameras && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: CAM_GR,
                  opacity: pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.3] }) }} />
                <Text style={{ color: CAM_GR, fontSize: 10, fontWeight: "800" }}>
                  {activeCamCount} FLUX ACTIF{activeCamCount > 1 ? "S" : ""}
                </Text>
              </View>
            )}
          </View>

          {/* ══ B. TOUR DE CONTRÔLE — Bus en supervision ═══════════════ */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBox, { backgroundColor: "#EEF2FF" }]}>
                <Feather name="monitor" size={14} color="#4F46E5" />
              </View>
              <Text style={S.sectionTitle}>Tour de contrôle</Text>
              <Text style={S.sectionCount}>{busCount} véhicule{busCount > 1 ? "s" : ""}</Text>
            </View>

            {!sortedBuses.length ? (
              <View style={S.empty}>
                <Ionicons name="bus-outline" size={36} color="#CBD5E1" />
                <Text style={S.emptyTxt}>Aucun bus en service</Text>
                <Text style={{ fontSize: 12, color: "#CBD5E1", textAlign: "center" }}>
                  Les bus apparaîtront ici dès leur activation
                </Text>
              </View>
            ) : (
              sortedBuses.map(bus => {
                const st        = BUS_STATUS[bus.logisticStatus] ?? { label: bus.logisticStatus, color: "#64748B", bg: "#F1F5F9", icon: "bus-outline" };
                const trip      = data!.trips.find(t => t.busId === bus.id);
                const busAlerts = data!.alerts.filter(a => a.busId === bus.id);
                const camOk     = !!(trip?.cameraStatus === "connected" && trip?.cameraStreamUrl);
                const liveCam   = trip ? liveFrames[trip.id] : null;
                const isPriority = busAlerts.length > 0;
                const occ = trip?.passengerCount != null && trip?.seatCount
                  ? Math.min(100, Math.round((trip.passengerCount / trip.seatCount) * 100))
                  : null;
                const occColor = occ != null ? (occ > 90 ? "#DC2626" : occ > 75 ? "#D97706" : "#059669") : "#059669";

                return (
                  <FadeCard key={bus.id} style={[S.ctCard, isPriority && S.ctCardAlert, { borderLeftColor: isPriority ? RED : st.color }]}>
                    {/* Top: icon + name + status */}
                    <View style={S.ctTop}>
                      <View style={[S.ctStatusIcon, { backgroundColor: st.bg }]}>
                        <Ionicons name={st.icon as any} size={22} color={st.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.ctBusName}>{bus.busName}</Text>
                        <Text style={S.ctBusPlate}>{bus.plateNumber}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 5 }}>
                        {busAlerts.length > 0 && (
                          <View style={S.ctAlertBadge}>
                            <Ionicons name="warning" size={11} color="#fff" />
                            <Text style={S.ctAlertBadgeTxt}>{busAlerts.length}</Text>
                          </View>
                        )}
                        <View style={[S.ctStatusPill, { backgroundColor: st.bg }]}>
                          <Text style={[S.ctStatusTxt, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Route */}
                    {trip && (
                      <View style={S.ctRouteRow}>
                        <Ionicons name="navigate" size={13} color="#3B82F6" />
                        <Text style={S.ctRouteTxt} numberOfLines={1}>{trip.from} → {trip.to}</Text>
                        <Text style={S.ctDeptTxt}>· {trip.departureTime}</Text>
                        {trip.etaTime && <Text style={S.ctEtaTxt}>ETA {trip.etaTime}</Text>}
                      </View>
                    )}

                    {/* Passenger occupancy */}
                    {trip?.passengerCount != null && (
                      <View style={S.ctPassRow}>
                        <Ionicons name="people" size={13} color="#64748B" />
                        <Text style={S.ctPassNum}>{trip.passengerCount}</Text>
                        {trip.seatCount != null && (
                          <Text style={S.ctPassTotal}>/ {trip.seatCount} sièges</Text>
                        )}
                        {occ != null && (
                          <>
                            <View style={S.ctOccBar}>
                              <View style={[S.ctOccFill, { width: (occ + "%") as any, backgroundColor: occColor }]} />
                            </View>
                            <Text style={[S.ctOccPct, { color: occColor }]}>{occ}%</Text>
                          </>
                        )}
                      </View>
                    )}

                    {/* Footer: camera + GPS + trigger */}
                    <View style={S.ctFooter}>
                      {camOk && trip ? (
                        <TouchableOpacity style={S.ctCamBtn} onPress={() => setCameraTrip(trip)} activeOpacity={0.82}>
                          <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CAM_GR,
                            opacity: liveCam ? pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.3] }) : 1 }} />
                          <Text style={S.ctCamTxt}>LIVE</Text>
                          <Ionicons name="play-circle" size={14} color={CAM_GR} />
                          {liveCam && <Text style={S.ctCamFrames}>{liveCam.signal}%</Text>}
                        </TouchableOpacity>
                      ) : (
                        <View style={S.ctNoCam}>
                          <Ionicons name="videocam-off-outline" size={13} color="#CBD5E1" />
                          <Text style={S.ctNoCamTxt}>Hors ligne</Text>
                        </View>
                      )}
                      {bus.currentLocation && (
                        <View style={S.ctGpsChip}>
                          <Ionicons name="location" size={11} color="#7C3AED" />
                          <Text style={S.ctGpsTxt} numberOfLines={1}>{bus.currentLocation}</Text>
                        </View>
                      )}
                      <TouchableOpacity style={S.ctTriggerBtn} onPress={() => setTriggerBus(bus)} activeOpacity={0.8}>
                        <Ionicons name="warning-outline" size={13} color={RED} />
                        <Text style={S.ctTriggerTxt}>Alerte</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Inline alert preview */}
                    {busAlerts.slice(0, 1).map(a => (
                      <View key={a.id} style={S.ctAlertInline}>
                        <Ionicons name="alert-circle" size={13} color={RED} />
                        <Text style={S.ctAlertInlineTxt} numberOfLines={2}>{a.message}</Text>
                        <Text style={S.ctAlertTime}>
                          {new Date(a.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                    ))}
                  </FadeCard>
                );
              })
            )}
          </View>

          {/* ══ C. CAMÉRAS EMBARQUÉES ══════════════════════════════════ */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBox, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="videocam" size={14} color="#16A34A" />
              </View>
              <Text style={S.sectionTitle}>Caméras embarquées</Text>
              {hasCameras && (
                <View style={S.camLivePill}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR }} />
                  <Text style={S.camLivePillTxt}>{activeCamCount} LIVE</Text>
                </View>
              )}
            </View>

            {/* Connection indicators */}
            <View style={S.camConnRow}>
              <View style={[S.camConnChip, hasCameras && { borderColor: "#7C3AED", backgroundColor: "#F5F3FF" }]}>
                <Ionicons name="qr-code" size={15} color={hasCameras ? "#7C3AED" : "#CBD5E1"} />
                <Text style={[S.camConnTxt, hasCameras && { color: "#7C3AED", fontWeight: "700" as any }]}>QR Code</Text>
              </View>
              <View style={[S.camConnChip, hasCameras && { borderColor: "#0369A1", backgroundColor: "#F0F9FF" }]}>
                <Feather name="bluetooth" size={15} color={hasCameras ? "#0369A1" : "#CBD5E1"} />
                <Text style={[S.camConnTxt, hasCameras && { color: "#0369A1", fontWeight: "700" as any }]}>Bluetooth</Text>
              </View>
              <View style={[S.camConnChip, hasCameras && { borderColor: "#059669", backgroundColor: "#F0FDF4" }]}>
                <Feather name="wifi" size={15} color={hasCameras ? "#059669" : "#CBD5E1"} />
                <Text style={[S.camConnTxt, hasCameras && { color: "#059669", fontWeight: "700" as any }]}>Wi-Fi</Text>
              </View>
            </View>

            {!hasCameras ? (
              <View style={[S.empty, { backgroundColor: CAM_BG, borderWidth: 1, borderColor: "#1E293B" }]}>
                <Ionicons name="videocam-off-outline" size={30} color="#334155" />
                <Text style={[S.emptyTxt, { color: "#475569" }]}>Aucune caméra connectée</Text>
                <Text style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>
                  Les caméras s'activent lorsqu'un bus est en route
                </Text>
              </View>
            ) : (
              sortedBuses.map(bus => {
                const trip    = data!.trips.find(t => t.busId === bus.id);
                const camOk   = !!(trip?.cameraStatus === "connected" && trip?.cameraStreamUrl);
                const liveCam = trip ? liveFrames[trip.id] : null;
                if (!camOk || !trip) return null;
                const sigBars  = liveCam ? Math.ceil((liveCam.signal / 100) * 4) : 0;
                const sigColor = liveCam
                  ? (liveCam.signal >= 80 ? CAM_GR : liveCam.signal >= 60 ? "#FCD34D" : "#EF4444")
                  : CAM_GR;
                return (
                  <View key={bus.id} style={S.camCard}>
                    {/* Dark header bar */}
                    <View style={S.camCardHdr}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444",
                          opacity: pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.2] }) }} />
                        <Text style={S.camLiveLbl}>● LIVE</Text>
                      </View>
                      {liveCam && (
                        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                          {[1,2,3,4].map(b => (
                            <View key={b} style={{ width: 3, height: 3 + b * 2.5, borderRadius: 1,
                              backgroundColor: b <= sigBars ? sigColor : "rgba(255,255,255,0.12)" }} />
                          ))}
                          <Text style={[S.camSigTxt, { color: sigColor }]}>{liveCam.signal}%</Text>
                        </View>
                      )}
                    </View>
                    {/* Camera body */}
                    <View style={S.camCardBody}>
                      <View style={S.camIconWrap}>
                        <Ionicons name="videocam" size={22} color={CAM_GR} />
                        <View style={S.camLiveDot} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={S.camBusName}>{bus.busName}</Text>
                        <Text style={S.camRoute}>{trip.from} → {trip.to}</Text>
                        <Text style={S.camPos}>{trip.cameraPosition ?? "Caméra intérieure"}</Text>
                        {liveCam && (
                          <Text style={S.camFrames}>▲ {liveCam.frames} img · {trip.passengerCount ?? "—"} pax</Text>
                        )}
                      </View>
                      <TouchableOpacity style={S.camWatchBtn} onPress={() => setCameraTrip(trip)} activeOpacity={0.8}>
                        <Ionicons name="play-circle" size={18} color={CAM_GR} />
                        <Text style={S.camWatchTxt}>Voir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ══ D. ALERTES ACTIVES ═════════════════════════════════════ */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBox, { backgroundColor: hasAlerts ? RED_L : "#F0FDF4" }]}>
                <Ionicons name="warning" size={14} color={hasAlerts ? RED : "#22C55E"} />
              </View>
              <Text style={S.sectionTitle}>Alertes actives</Text>
              {alertCount > 0 && (
                <View style={S.alertCountPill}>
                  <Text style={S.alertCountPillTxt}>{alertCount}</Text>
                </View>
              )}
            </View>

            {!alertCount ? (
              <View style={S.empty}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="checkmark-circle" size={30} color="#22C55E" />
                </View>
                <Text style={S.emptyTxt}>Aucune alerte active</Text>
                <Text style={{ fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                  Tous les bus roulent normalement
                </Text>
              </View>
            ) : (
              data!.alerts.map(alert => {
                const hasResponse  = !!alert.response;
                const reqRequested = !!alert.responseRequested;
                const responseOpt  = RESPONSE_OPTIONS.find(r => r.id === alert.response);
                const isCritical   = alert.type === "panne";
                const isCtrl       = alert.type === "controle";
                const typeColor    = isCritical ? "#DC2626" : isCtrl ? "#D97706" : RED;
                const typeBg       = isCritical ? "#FEE2E2" : isCtrl ? "#FEF3C7" : RED_L;
                const borderCol    = isCritical ? "#DC2626" : isCtrl ? "#D97706" : RED;
                const typeLabel    = isCritical ? "PANNE" : isCtrl ? "CONTRÔLE" : "ALERTE";
                return (
                  <FadeCard key={alert.id} style={[S.alertCard, { borderLeftColor: borderCol }]}>
                    <View style={S.alertTop}>
                      <View style={[S.alertTypeBadge, { backgroundColor: typeBg }]}>
                        <Text style={[S.alertTypeTxt, { color: typeColor }]}>{typeLabel}</Text>
                      </View>
                      <Text style={S.alertBus} numberOfLines={1}>{alert.busName ?? "Bus inconnu"}</Text>
                      <Text style={S.alertTime}>
                        {new Date(alert.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>

                    <Text style={S.alertMsg}>{alert.message}</Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="person-circle-outline" size={13} color="#94A3B8" />
                      <Text style={S.alertAgent}>{alert.agentName ?? alert.agentId}</Text>
                    </View>

                    {hasResponse && responseOpt && (
                      <View style={[S.alertResponseRow, { backgroundColor: responseOpt.bg }]}>
                        <Ionicons name="checkmark-circle" size={14} color={responseOpt.color} />
                        <Text style={[S.alertResponseTxt, { color: responseOpt.color }]}>
                          Réponse : {responseOpt.label}
                        </Text>
                      </View>
                    )}
                    {reqRequested && !hasResponse && (
                      <View style={S.alertWaitRow}>
                        <ActivityIndicator size="small" color="#D97706" />
                        <Text style={S.alertWaitTxt}>En attente de réponse de l'agent route…</Text>
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
                        style={[S.alertBtn, { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4", flex: 1 }]}
                        onPress={() => doConfirm(alert.id)} disabled={acting}
                      >
                        {acting
                          ? <ActivityIndicator size="small" color="#166534" />
                          : <Ionicons name="checkmark-circle-outline" size={14} color="#166534" />}
                        <Text style={[S.alertBtnTxt, { color: "#166534" }]}>Marquer résolu</Text>
                      </TouchableOpacity>
                    </View>
                  </FadeCard>
                );
              })
            )}
          </View>

          {/* ══ E. ACTIONS RAPIDES ═════════════════════════════════════ */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBox, { backgroundColor: "#FFF7ED" }]}>
                <Feather name="zap" size={14} color="#D97706" />
              </View>
              <Text style={S.sectionTitle}>Actions rapides</Text>
            </View>
            <View style={S.quickGrid}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity style={S.quickBtn} onPress={() => router.push("/agent/scan" as never)} activeOpacity={0.8}>
                  <View style={[S.quickIcon, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons name="qr-code" size={24} color="#4F46E5" />
                  </View>
                  <Text style={S.quickBtnTxt}>Scanner ticket</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.quickBtn} activeOpacity={0.8}
                  onPress={() => Alert.alert("Ajouter passager", "Disponible depuis le guichet ou la réservation.")}>
                  <View style={[S.quickIcon, { backgroundColor: "#F0FDF4" }]}>
                    <Ionicons name="person-add" size={24} color="#16A34A" />
                  </View>
                  <Text style={S.quickBtnTxt}>Ajouter passager</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity style={S.quickBtn} onPress={() => router.push("/agent/rapport" as never)} activeOpacity={0.8}>
                  <View style={[S.quickIcon, { backgroundColor: "#FFF7ED" }]}>
                    <Feather name="file-text" size={24} color="#D97706" />
                  </View>
                  <Text style={S.quickBtnTxt}>Faire un rapport</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.quickBtn} activeOpacity={0.8}
                  onPress={() => sortedBuses.length
                    ? setTriggerBus(sortedBuses[0])
                    : Alert.alert("Aucun bus", "Aucun bus actif disponible.")}>
                  <View style={[S.quickIcon, { backgroundColor: RED_L }]}>
                    <Ionicons name="warning" size={24} color={RED} />
                  </View>
                  <Text style={S.quickBtnTxt}>Déclencher alerte</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </ScrollView>
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
  safe: { flex: 1, backgroundColor: "#F0F4F8" },

  /* ── Header ─────────────────────────────────────────────────── */
  header:     { backgroundColor: RED_D },
  headerTop:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, overflow: "hidden" },
  headerRight:{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  headerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.18)",
                justifyContent: "center", alignItems: "center", flexShrink: 0,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  headerTitle:{ color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  headerSub:  { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 },

  /* Stats bar */
  headerStats:{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10,
                borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
                backgroundColor: "rgba(0,0,0,0.15)" },
  statChip:   { flex: 1, alignItems: "center", gap: 2 },
  statNum:    { color: "#fff", fontSize: 18, fontWeight: "900", lineHeight: 22 },
  statLbl:    { color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  statDiv:    { width: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 },

  syncPill:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  syncDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR },
  syncTxt:    { color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  iconBtn:    { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.14)",
                justifyContent: "center", alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },

  /* Alarm bar */
  alarmBar:   { flexDirection: "row", alignItems: "center", gap: 8,
                backgroundColor: "#B91C1C", paddingHorizontal: 16, paddingVertical: 9 },
  alarmBarTxt:{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  alarmBarBus:{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600", flex: 1 },

  /* Center / Loading */
  center:     { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 36 },
  loadingTxt: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  loadingSub: { fontSize: 12, color: "#94A3B8", textAlign: "center", lineHeight: 18 },

  /* Scroll */
  scroll: { padding: 14, gap: 20, paddingBottom: 52 },

  /* Sync row */
  syncRow:    { flexDirection: "row", alignItems: "center", gap: 8,
                backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                borderWidth: 1, borderColor: "#E2E8F0" },
  syncRowTxt: { fontSize: 11, color: "#64748B", fontWeight: "600", flex: 1 },

  /* Sections */
  section:      { gap: 12 },
  sectionHeader:{ flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIconBox:{ width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", letterSpacing: -0.2, flex: 1 },
  sectionCount: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },

  /* Empty state */
  empty: { backgroundColor: "#fff", borderRadius: 16, padding: 32, alignItems: "center", gap: 10,
           ...(Platform.OS === "web"
             ? { boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }
             : { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }) },
  emptyTxt: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },

  /* ── B. Tour de contrôle — Bus cards ──────────────────────────── */
  ctCard:     { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12,
                borderLeftWidth: 4, borderLeftColor: "#22C55E",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }
                  : { shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12,
                      shadowOffset: { width: 0, height: 3 }, elevation: 4 }) },
  ctCardAlert:{ backgroundColor: "#FFF8F8" },

  ctTop:      { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  ctStatusIcon:{ width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  ctBusName:  { fontSize: 16, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  ctBusPlate: { fontSize: 11, color: "#64748B", marginTop: 2 },
  ctAlertBadge:{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: RED,
                 borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  ctAlertBadgeTxt:{ fontSize: 10, fontWeight: "900", color: "#fff" },
  ctStatusPill:{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  ctStatusTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },

  ctRouteRow:  { flexDirection: "row", alignItems: "center", gap: 6,
                 backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9,
                 borderWidth: 1, borderColor: "#E2E8F0" },
  ctRouteTxt:  { fontSize: 13, fontWeight: "700", color: "#0F172A", flex: 1 },
  ctDeptTxt:   { fontSize: 11, color: "#64748B" },
  ctEtaTxt:    { fontSize: 10, color: "#7C3AED", fontWeight: "700",
                 backgroundColor: "#EDE9FE", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },

  ctPassRow:   { flexDirection: "row", alignItems: "center", gap: 7 },
  ctPassNum:   { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  ctPassTotal: { fontSize: 11, color: "#94A3B8" },
  ctOccBar:    { flex: 1, height: 6, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  ctOccFill:   { height: 6, borderRadius: 4 },
  ctOccPct:    { fontSize: 11, fontWeight: "800", minWidth: 34, textAlign: "right" },

  ctFooter:    { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  ctCamBtn:    { flexDirection: "row", alignItems: "center", gap: 5,
                 backgroundColor: "#052E16", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7,
                 borderWidth: 1, borderColor: "#166534" },
  ctCamTxt:    { color: CAM_GR, fontSize: 11, fontWeight: "900" },
  ctCamFrames: { color: "#4ADE80", fontSize: 10, fontWeight: "700" },
  ctNoCam:     { flexDirection: "row", alignItems: "center", gap: 5,
                 backgroundColor: "#F8FAFC", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7,
                 borderWidth: 1, borderColor: "#E2E8F0" },
  ctNoCamTxt:  { fontSize: 11, color: "#CBD5E1", fontWeight: "600" },
  ctGpsChip:   { flexDirection: "row", alignItems: "center", gap: 4, flex: 1,
                 backgroundColor: "#FAF5FF", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
                 borderWidth: 1, borderColor: "#E9D5FF" },
  ctGpsTxt:    { fontSize: 11, color: "#7C3AED", fontWeight: "600", flex: 1 },
  ctTriggerBtn:{ flexDirection: "row", alignItems: "center", gap: 4,
                 backgroundColor: RED_L, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7,
                 borderWidth: 1, borderColor: RED_M },
  ctTriggerTxt:{ fontSize: 11, color: RED, fontWeight: "700" },

  ctAlertInline:   { flexDirection: "row", alignItems: "center", gap: 8,
                     backgroundColor: "#FFF1F2", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
                     borderWidth: 1, borderColor: RED_M },
  ctAlertInlineTxt:{ flex: 1, fontSize: 12, color: RED_D, fontWeight: "600", lineHeight: 16 },
  ctAlertTime:     { fontSize: 10, color: RED, fontWeight: "700" },

  /* ── C. Caméras ──────────────────────────────────────────────── */
  camLivePill:    { flexDirection: "row", alignItems: "center", gap: 5,
                    backgroundColor: "#052E16", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                    borderWidth: 1, borderColor: "#166534" },
  camLivePillTxt: { color: CAM_GR, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },

  camConnRow:  { flexDirection: "row", gap: 10 },
  camConnChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                 backgroundColor: "#F8FAFC", borderRadius: 12, paddingVertical: 11,
                 borderWidth: 1.5, borderColor: "#E2E8F0" },
  camConnTxt:  { fontSize: 11, fontWeight: "600", color: "#CBD5E1" },

  camCard:     { backgroundColor: CAM_BG, borderRadius: 16, overflow: "hidden",
                 borderWidth: 1, borderColor: "#166834",
                 ...(Platform.OS === "web"
                   ? { boxShadow: "0 3px 14px rgba(0,0,0,0.2)" }
                   : { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, elevation: 5 }) },
  camCardHdr:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                 paddingHorizontal: 14, paddingVertical: 9,
                 backgroundColor: "rgba(0,0,0,0.3)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  camLiveLbl:  { color: "#EF4444", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  camSigTxt:   { fontSize: 10, fontWeight: "700", marginLeft: 3 },

  camCardBody: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  camIconWrap: { width: 46, height: 46, borderRadius: 13, backgroundColor: "rgba(34,197,94,0.15)",
                 justifyContent: "center", alignItems: "center", position: "relative", flexShrink: 0,
                 borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  camLiveDot:  { position: "absolute", top: 3, right: 3, width: 9, height: 9, borderRadius: 5,
                 backgroundColor: CAM_GR, borderWidth: 2, borderColor: CAM_BG },
  camBusName:  { fontSize: 14, fontWeight: "800", color: "#E2E8F0" },
  camRoute:    { fontSize: 11, color: "#64748B", marginTop: 1 },
  camPos:      { fontSize: 10, color: "#475569" },
  camFrames:   { fontSize: 10, color: CAM_GR, fontWeight: "700" },
  camWatchBtn: { flexDirection: "row", alignItems: "center", gap: 6,
                 backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 11,
                 paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#166834" },
  camWatchTxt: { color: CAM_GR, fontSize: 12, fontWeight: "800" },

  /* ── D. Alertes ──────────────────────────────────────────────── */
  alertCountPill:   { backgroundColor: RED, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  alertCountPillTxt:{ color: "#fff", fontSize: 12, fontWeight: "900" },

  alertCard:     { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10,
                   borderLeftWidth: 4, borderLeftColor: RED,
                   ...(Platform.OS === "web"
                     ? { boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }
                     : { shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
                         shadowOffset: { width: 0, height: 2 }, elevation: 3 }) },
  alertTop:      { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTypeBadge:{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  alertTypeTxt:  { fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  alertBus:      { flex: 1, fontSize: 13, fontWeight: "700", color: "#0F172A" },
  alertTime:     { fontSize: 11, color: "#94A3B8" },
  alertMsg:      { fontSize: 13, color: "#1E293B", fontWeight: "600", lineHeight: 19 },
  alertAgent:    { fontSize: 11, color: "#94A3B8" },
  alertResponseRow:{ flexDirection: "row", alignItems: "center", gap: 8,
                     borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  alertResponseTxt:{ fontSize: 12, fontWeight: "700" },
  alertWaitRow:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB",
                   borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8,
                   borderWidth: 1, borderColor: "#FDE68A" },
  alertWaitTxt:  { fontSize: 12, color: "#D97706", fontWeight: "600", flex: 1 },
  alertActions:  { flexDirection: "row", gap: 8 },
  alertBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
                   paddingHorizontal: 12, paddingVertical: 11, borderRadius: 11, borderWidth: 1 },
  alertBtnTxt:   { fontSize: 12, fontWeight: "700" },

  /* ── E. Actions rapides ──────────────────────────────────────── */
  quickGrid:   { gap: 12 },
  quickBtn:    { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 16,
                 alignItems: "center", gap: 10,
                 ...(Platform.OS === "web"
                   ? { boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }
                   : { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10,
                       shadowOffset: { width: 0, height: 2 }, elevation: 3 }) },
  quickIcon:   { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  quickBtnTxt: { fontSize: 12, fontWeight: "700", color: "#0F172A", textAlign: "center", lineHeight: 16 },

  /* ── Modal ──────────────────────────────────────────────────── */
  modalBg:     { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalBox:    { backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26,
                 padding: 24, gap: 12 },
  modalTitle:  { fontSize: 18, fontWeight: "900", color: "#0F172A", letterSpacing: -0.3 },
  modalSub:    { fontSize: 12, color: "#64748B" },
  modalLabel:  { fontSize: 12, fontWeight: "700", color: "#475569", letterSpacing: 0.2 },
  msgOption:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: RED_L,
                 borderRadius: 12, padding: 14, borderWidth: 1, borderColor: RED_M },
  msgOptionTxt:{ flex: 1, fontSize: 13, fontWeight: "600", color: RED_D, lineHeight: 18 },
  modalActions:{ flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn:    { flex: 1, alignItems: "center", justifyContent: "center",
                 paddingVertical: 15, borderRadius: 13 },
});
