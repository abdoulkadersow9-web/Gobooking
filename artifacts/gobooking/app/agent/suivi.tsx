import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
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
   CAMÉRA LIVE — Lecteur vidéo embarqué
   ══════════════════════════════════════════════════════════════════ */
function CameraPlayer({ trip, onClose }: { trip: TripItem; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const streamUrl = trip.cameraStreamUrl!;

  return (
    <View style={CS.container}>
      {/* Header */}
      <View style={CS.header}>
        <View style={CS.liveBadge}>
          <View style={CS.liveDot} />
          <Text style={CS.liveText}>LIVE</Text>
        </View>
        <Text style={CS.camTitle} numberOfLines={1}>
          {trip.from} → {trip.to}  ·  {trip.cameraPosition ?? "intérieur"}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={CS.closeBtn}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Video */}
      <View style={CS.videoWrap}>
        {loading && (
          <View style={CS.videoLoader}>
            <ActivityIndicator size="large" color={CAM_GR} />
            <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 10 }}>Connexion au flux caméra...</Text>
          </View>
        )}
        <WebView
          source={{ html: buildVideoHtml(streamUrl) }}
          style={CS.video}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          onLoadEnd={() => setLoading(false)}
          scrollEnabled={false}
          bounces={false}
        />
      </View>

      {/* Footer info */}
      <View style={CS.footer}>
        <View style={CS.footerItem}>
          <Ionicons name="wifi" size={13} color={CAM_GR} />
          <Text style={CS.footerTxt}>Signal actif</Text>
        </View>
        <View style={CS.footerItem}>
          <Ionicons name="videocam" size={13} color={CAM_GR} />
          <Text style={CS.footerTxt}>Caméra embarquée</Text>
        </View>
        <View style={CS.footerItem}>
          <Ionicons name="shield-checkmark" size={13} color={CAM_GR} />
          <Text style={CS.footerTxt}>Flux sécurisé</Text>
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

  const hasAlerts    = !!(data?.alerts?.length);
  const activeCamCount = data?.trips?.filter(t => t.cameraStatus === "connected").length ?? 0;
  const hasCameras   = activeCamCount > 0;

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

  const load = useCallback(async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/suivi/overview`, {
        headers: authHeader(token),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastSync(new Date());
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  /* Dynamic polling: 10s when cameras active, 30s otherwise */
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const delay = hasCameras ? 10_000 : 30_000;
    intervalRef.current = setInterval(() => load(true), delay);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hasCameras, load]);

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

  /* ── Camera full-screen modal ── */
  if (cameraTrip) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CAM_BG }}>
        <StatusBar barStyle="light-content" backgroundColor={CAM_BG} />
        <CameraPlayer trip={cameraTrip} onClose={() => setCameraTrip(null)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={RED_D} />

      {/* Header */}
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerIcon}><Ionicons name="radio" size={22} color="#fff" /></View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={S.headerTitle}>Tour de contrôle</Text>
              {hasCameras && (
                <View style={S.camBadge}>
                  <Ionicons name="videocam" size={9} color="#22C55E" />
                  <Text style={S.camBadgeTxt}>{activeCamCount} LIVE</Text>
                </View>
              )}
            </View>
            <Text style={S.headerSub}>
              {hasAlerts
                ? `⚠ ${data!.alerts.length} alerte(s) active(s)`
                : hasCameras
                  ? `${activeCamCount} caméra${activeCamCount > 1 ? "s" : ""} active${activeCamCount > 1 ? "s" : ""} · sync 10s`
                  : "Surveillance en temps réel · sync 30s"}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {lastSync && (
            <View style={S.syncPill}>
              <View style={S.syncDot} />
              <Text style={S.syncTxt}>{syncLabel}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => load(true)} style={S.refreshBtn}>
            <Feather name="refresh-cw" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={S.logoutBtn} hitSlop={8}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !data ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={RED} />
          <Text style={{ marginTop: 12, color: "#64748B" }}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          showsVerticalScrollIndicator={false}
        >

          {/* ── DASHBOARD STATS ROW ── */}
          <View style={S.statsRow}>
            <View style={[S.statCard, { borderLeftColor: "#1D4ED8" }]}>
              <Text style={S.statNum}>{data?.buses?.length ?? 0}</Text>
              <Text style={S.statLabel}>Bus actifs</Text>
            </View>
            <View style={[S.statCard, { borderLeftColor: hasAlerts ? RED : "#4ADE80" }]}>
              <Text style={[S.statNum, { color: hasAlerts ? RED : "#166534" }]}>{data?.alerts?.length ?? 0}</Text>
              <Text style={S.statLabel}>Alertes</Text>
            </View>
            <View style={[S.statCard, { borderLeftColor: hasCameras ? CAM_GR : "#94A3B8" }]}>
              <Text style={[S.statNum, { color: hasCameras ? "#166534" : "#94A3B8" }]}>{activeCamCount}</Text>
              <Text style={S.statLabel}>Caméras live</Text>
            </View>
          </View>

          {/* ── ALERT PANEL ── */}
          {hasAlerts && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={S.alarmBanner}>
                <Ionicons name="warning" size={20} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={S.alarmTxt}>
                    {data!.alerts.length} ALERTE{data!.alerts.length > 1 ? "S" : ""} ACTIVE{data!.alerts.length > 1 ? "S" : ""}
                  </Text>
                  <Text style={S.alarmSub}>
                    {data!.alerts[0]?.busName ? `Bus : ${data!.alerts[0].busName}` : "Intervention requise"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.7)" />
              </View>
            </Animated.View>
          )}

          {/* ── ALERTS LIST ── */}
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
            {!data?.alerts?.length && (
              <View style={S.empty}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center", marginBottom: 4 }}>
                  <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
                </View>
                <Text style={S.emptyTxt}>Aucune alerte active</Text>
                <Text style={{ fontSize: 11, color: "#94A3B8", textAlign: "center" }}>Tous les bus roulent normalement</Text>
              </View>
            )}
            {data?.alerts?.map(alert => {
              const hasResponse   = !!alert.response;
              const reqRequested  = !!alert.responseRequested;
              const responseOpt   = RESPONSE_OPTIONS.find(r => r.id === alert.response);
              const typeColor  = alert.type === "panne" ? "#DC2626" : alert.type === "controle" ? "#D97706" : RED;
              const typeBg     = alert.type === "panne" ? "#FEE2E2" : alert.type === "controle" ? "#FEF3C7" : RED_L;
              const borderCol  = alert.type === "panne" ? "#DC2626" : alert.type === "controle" ? "#D97706" : "#94A3B8";
              const typeLabel  = alert.type === "panne" ? "PANNE" : alert.type === "controle" ? "CONTRÔLE" : "ALERTE";
              return (
                <View key={alert.id} style={[S.alertCard, { borderLeftColor: borderCol }]}>
                  {/* Top row */}
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

                  {/* Response */}
                  {hasResponse && responseOpt && (
                    <View style={[S.responsePill, { backgroundColor: responseOpt.bg }]}>
                      <Ionicons name="checkmark-circle" size={13} color={responseOpt.color} />
                      <Text style={[S.responseTxt, { color: responseOpt.color }]}>
                        Réponse : {responseOpt.label}
                      </Text>
                    </View>
                  )}
                  {reqRequested && !hasResponse && (
                    <View style={S.waitPill}>
                      <ActivityIndicator size="small" color="#D97706" />
                      <Text style={S.waitTxt}>En attente de réponse de l'agent route…</Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={S.alertActions}>
                    {!reqRequested && (
                      <TouchableOpacity
                        style={[S.alertBtn, { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" }]}
                        onPress={() => demanderReponse(alert.id)}
                        disabled={acting}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color="#1D4ED8" />
                        <Text style={[S.alertBtnTxt, { color: "#1D4ED8" }]}>Demander rapport</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[S.alertBtn, { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }]}
                      onPress={() => doConfirm(alert.id)}
                      disabled={acting}
                    >
                      {acting ? <ActivityIndicator size="small" color="#166534" /> : <Ionicons name="checkmark-circle-outline" size={14} color="#166534" />}
                      <Text style={[S.alertBtnTxt, { color: "#166534" }]}>Résolu</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── BUS LIST — Tour de contrôle ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Feather name="radio" size={14} color="#1D4ED8" />
              <View style={{ flex: 1 }}>
                <Text style={S.sectionTitle}>Bus en temps réel</Text>
                <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{data?.buses?.length ?? 0} véhicule{(data?.buses?.length ?? 0) > 1 ? "s" : ""} suivi{(data?.buses?.length ?? 0) > 1 ? "s" : ""}</Text>
              </View>
              {hasCameras && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#052E16", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CAM_GR }} />
                  <Text style={{ color: CAM_GR, fontSize: 10, fontWeight: "800" }}>{activeCamCount} CAM LIVE</Text>
                </View>
              )}
            </View>
            {!data?.buses?.length && (
              <View style={S.empty}><Ionicons name="bus-outline" size={32} color="#CBD5E1" />
                <Text style={S.emptyTxt}>Aucun bus trouvé</Text>
              </View>
            )}
            {data?.buses?.map(bus => {
              const st   = BUS_STATUS[bus.logisticStatus] ?? { label: bus.logisticStatus, color: "#64748B", bg: "#F1F5F9", icon: "bus-outline" };
              const trip = data.trips.find(t => t.busId === bus.id);
              const busAlerts = data.alerts.filter(a => a.busId === bus.id);
              const camOk = !!(trip && trip.cameraStatus === "connected" && trip.cameraStreamUrl);
              const eta   = trip?.etaTime ?? trip?.arrivalTime;

              return (
                <View key={bus.id} style={[S.busCard, busAlerts.length > 0 && { borderLeftWidth: 3, borderLeftColor: RED }]}>

                  {/* ── Header row ── */}
                  <View style={S.busTop}>
                    <View style={[S.busStatus, { backgroundColor: st.bg }]}>
                      <Ionicons name={st.icon as any} size={20} color={st.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.busName}>{bus.busName}</Text>
                      <Text style={S.busPlate}>{bus.plateNumber}</Text>
                    </View>
                    <View style={[S.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {/* ── Route + GPS row ── */}
                  {trip && (
                    <View style={S.tcRouteRow}>
                      <View style={S.tcRouteInner}>
                        <Ionicons name="navigate" size={13} color="#1D4ED8" />
                        <Text style={S.tcRoute}>{trip.from}</Text>
                        <Ionicons name="arrow-forward" size={12} color="#94A3B8" />
                        <Text style={S.tcRoute}>{trip.to}</Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={S.tcChip}>
                          <Ionicons name="time-outline" size={11} color="#64748B" />
                          <Text style={S.tcChipTxt}>{trip.departureTime}</Text>
                        </View>
                        {eta && (
                          <View style={[S.tcChip, { backgroundColor: "#F0FDF4" }]}>
                            <Ionicons name="flag-outline" size={11} color="#15803D" />
                            <Text style={[S.tcChipTxt, { color: "#15803D" }]}>{eta}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* GPS location */}
                  {bus.currentLocation && (
                    <View style={S.tcGpsRow}>
                      <Ionicons name="location" size={13} color="#7C3AED" />
                      <Text style={S.tcGpsTxt}>{bus.currentLocation}</Text>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: CAM_GR, marginLeft: 4 }} />
                      <Text style={{ fontSize: 10, color: CAM_GR, fontWeight: "700" }}>GPS actif</Text>
                    </View>
                  )}

                  {/* ── Occupancy bar ── */}
                  {trip && trip.passengerCount != null && trip.seatCount != null && trip.seatCount > 0 && (
                    <View style={S.tcOccRow}>
                      <View style={S.tcOccHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Ionicons name="people" size={12} color="#059669" />
                          <Text style={S.tcOccLabel}>Occupation</Text>
                        </View>
                        <Text style={S.tcOccValue}>
                          {trip.passengerCount} / {trip.seatCount} passagers · {Math.min(100, Math.round((trip.passengerCount / trip.seatCount) * 100))}%
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

                  {/* ── CAMÉRA LIVE PANEL — always visible ── */}
                  <View style={[S.tcCamPanel, camOk && S.tcCamPanelActive]}>
                    <View style={S.tcCamPanelLeft}>
                      <View style={[S.tcCamIconWrap, camOk && { backgroundColor: "rgba(34,197,94,0.15)" }]}>
                        <Ionicons name="videocam" size={22} color={camOk ? CAM_GR : "#334155"} />
                        {camOk && <View style={S.tcCamLiveDot} />}
                      </View>
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[S.tcCamLabel, camOk && { color: CAM_GR }]}>
                            {camOk ? "CAMÉRA EMBARQUÉE · EN DIRECT" : "CAMÉRA EMBARQUÉE"}
                          </Text>
                          {camOk && (
                            <View style={S.tcLiveBadge}>
                              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" }} />
                              <Text style={S.tcLiveTxt}>LIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={S.tcCamSub}>
                          {camOk
                            ? `Position : ${trip?.cameraPosition ?? "intérieur"} · Flux HLS actif`
                            : trip
                              ? `Position prévue : ${trip.cameraPosition ?? "intérieur"} · Non connectée`
                              : "Aucun trajet actif · Caméra en veille"}
                        </Text>
                      </View>
                    </View>
                    {camOk && trip ? (
                      <TouchableOpacity style={S.tcWatchBtn} onPress={() => setCameraTrip(trip)} activeOpacity={0.82}>
                        <Ionicons name="play-circle" size={14} color={CAM_GR} />
                        <Text style={S.tcWatchTxt}>Voir</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={S.tcCamOffPill}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#475569" }} />
                        <Text style={S.tcCamOffTxt}>Hors ligne</Text>
                      </View>
                    )}
                  </View>

                  {/* ── Inline alert (if any) ── */}
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

                  {/* Issue */}
                  {bus.issue && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8 }}>
                      <Ionicons name="alert-circle" size={14} color="#DC2626" />
                      <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "600", flex: 1 }}>{bus.issue}</Text>
                    </View>
                  )}

                  {/* ── Action button ── */}
                  <TouchableOpacity style={S.triggerBtn} onPress={() => setTriggerBus(bus)} activeOpacity={0.8}>
                    <Ionicons name="warning-outline" size={14} color={RED} />
                    <Text style={S.triggerBtnTxt}>Déclencher une alerte</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

        </ScrollView>
      )}

      {/* ── Trigger Alert Modal ── */}
      <Modal visible={!!triggerBus} transparent animationType="slide">
        <View style={S.modalBg}>
          <View style={S.modalBox}>
            <Text style={S.modalTitle}>Déclencher une alerte</Text>
            <Text style={S.modalSub}>Bus : {triggerBus?.busName} ({triggerBus?.plateNumber})</Text>

            <Text style={S.modalLabel}>Message (optionnel)</Text>
            {[
              "Arrêt anormal non prévu",
              "Bus immobilisé sur route",
              "Besoin d'assistance immédiate",
            ].map(msg => (
              <TouchableOpacity
                key={msg}
                style={S.msgOption}
                onPress={() => triggerBus && doTrigger(triggerBus, msg)}
              >
                <Ionicons name="alert-circle-outline" size={16} color={RED} />
                <Text style={S.msgOptionTxt}>{msg}</Text>
              </TouchableOpacity>
            ))}

            <View style={S.modalActions}>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: "#F1F5F9" }]}
                onPress={() => setTriggerBus(null)}>
                <Text style={{ fontWeight: "700", color: "#475569" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: RED }]}
                onPress={() => triggerBus && doTrigger(triggerBus)}
                disabled={acting}
              >
                {acting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontWeight: "700", color: "#fff" }}>Alerte générale</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rapport button */}
      <TouchableOpacity style={S.rapportBtn} onPress={() => router.push("/agent/rapport" as never)}>
        <Feather name="file-text" size={16} color="#fff" />
        <Text style={S.rapportBtnTxt}>Faire un rapport</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/* ── Camera Player Styles ─────────────────────────────────────── */
const CS = StyleSheet.create({
  container:  { flex: 1, backgroundColor: CAM_BG },
  header:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  liveBadge:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#DC2626", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText:   { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  camTitle:   { flex: 1, color: "#E2E8F0", fontSize: 13, fontWeight: "700" },
  closeBtn:   { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  videoWrap:  { flex: 1, position: "relative" },
  videoLoader:{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 10, backgroundColor: CAM_BG },
  video:      { flex: 1, backgroundColor: "#000" },
  footer:     { flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerTxt:  { color: "#64748B", fontSize: 11, fontWeight: "600" },
});

/* ── Camera Pill Styles ────────────────────────────────────────── */
const CP = StyleSheet.create({
  pill:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  pillActive: { backgroundColor: "#052E16", borderWidth: 1, borderColor: "#166534" },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  txt:        { fontSize: 12, fontWeight: "600", color: "#94A3B8", flex: 1 },
});

/* ── Styles ───────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: "#F1F5F9" },
  header:     { backgroundColor: RED_D, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerRow:  { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitle:{ color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub:  { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 1 },
  refreshBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  logoutBtn:  { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  camBadge:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#052E16", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  camBadgeTxt:{ color: "#22C55E", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  syncPill:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  syncDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  syncTxt:    { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  statsRow:   { flexDirection: "row", gap: 10 },
  statCard:   { flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
                borderLeftWidth: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statNum:    { fontSize: 22, fontWeight: "900", color: "#0F172A", lineHeight: 26 },
  statLabel:  { fontSize: 11, color: "#64748B", fontWeight: "600", marginTop: 1 },

  alarmBanner:{ backgroundColor: RED, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, shadowColor: RED, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  alarmTxt:   { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.4 },
  alarmSub:   { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 1 },

  section:       { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle:  { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  empty:         { backgroundColor: "#fff", borderRadius: 12, padding: 28, alignItems: "center", gap: 8 },
  emptyTxt:      { color: "#94A3B8", fontSize: 14, fontWeight: "600" },

  /* Occupancy bar */
  tcOccRow:    { gap: 5 },
  tcOccHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tcOccLabel:  { fontSize: 11, color: "#64748B", fontWeight: "600" },
  tcOccValue:  { fontSize: 11, color: "#059669", fontWeight: "700" },
  tcOccBar:    { height: 6, backgroundColor: "#DCFCE7", borderRadius: 4, overflow: "hidden" },
  tcOccFill:   { height: 6, borderRadius: 4 },

  /* Rapport button */
  rapportBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                   backgroundColor: RED_D, borderRadius: 14, paddingVertical: 14, margin: 16,
                   marginTop: 0, shadowColor: RED_D, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  rapportBtnTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },

  alertCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 10, borderLeftWidth: 4, borderLeftColor: RED, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  alertTop:     { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTypeBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  alertTypeTxt: { fontSize: 10, fontWeight: "800" },
  alertBus:     { flex: 1, fontSize: 13, fontWeight: "700", color: "#0F172A" },
  alertTime:    { fontSize: 11, color: "#94A3B8" },
  alertMsg:     { fontSize: 13, color: "#1E293B", fontWeight: "600", lineHeight: 18 },
  alertAgent:   { fontSize: 11, color: "#94A3B8" },
  responsePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  responseTxt:  { fontSize: 12, fontWeight: "700" },
  waitPill:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  waitTxt:      { fontSize: 12, color: "#D97706", fontWeight: "600" },
  alertActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  alertBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  alertBtnTxt:  { fontSize: 12, fontWeight: "700" },

  busCard:   { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  busTop:    { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  busStatus: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  busName:   { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  busPlate:  { fontSize: 11, color: "#64748B" },
  busLoc:    { fontSize: 11, color: "#64748B", marginTop: 2 },
  busTrip:   { fontSize: 11, color: "#0369A1", marginTop: 2, fontWeight: "600" },
  busIssue:  { fontSize: 11, color: "#DC2626", marginTop: 2, fontWeight: "600" },
  statusPill:{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  statusTxt: { fontSize: 10, fontWeight: "700" },

  camBlock:       { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, gap: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  camBlockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  camBlockTitle:  { fontSize: 12, fontWeight: "700", color: "#64748B" },
  camPos:         { fontSize: 10, color: "#94A3B8", fontStyle: "italic" },

  camSummaryCard: { backgroundColor: CAM_BG, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderWidth: 1, borderColor: "#1E293B" },
  camSummaryLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  camThumb:       { width: 44, height: 44, borderRadius: 10, backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center" },
  camSummaryRoute:{ fontSize: 13, fontWeight: "700", color: "#E2E8F0" },
  camSummaryMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  camLivePill:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#DC2626", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  camLiveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  camLiveTxt:     { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  triggerBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: RED_M, backgroundColor: RED_L },
  triggerBtnTxt: { fontSize: 13, fontWeight: "700", color: RED },

  /* ── Tour de Contrôle — new card elements ── */
  tcRouteRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  tcRouteInner:   { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  tcRoute:        { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  tcChip:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E2E8F0", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  tcChipTxt:      { fontSize: 11, fontWeight: "700", color: "#475569" },
  tcGpsRow:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4 },
  tcGpsTxt:       { fontSize: 12, color: "#7C3AED", fontWeight: "600", flex: 1 },

  /* Camera panel */
  tcCamPanel:     { backgroundColor: CAM_BG, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderWidth: 1, borderColor: "#1E293B" },
  tcCamPanelActive:{ borderColor: "#166534" },
  tcCamPanelLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  tcCamIconWrap:  { width: 44, height: 44, borderRadius: 10, backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center", position: "relative" },
  tcCamLiveDot:   { position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: CAM_GR, borderWidth: 1.5, borderColor: CAM_BG },
  tcCamLabel:     { fontSize: 11, fontWeight: "800", color: "#94A3B8", letterSpacing: 0.3 },
  tcCamSub:       { fontSize: 10, color: "#475569", marginTop: 2, fontWeight: "500" },
  tcLiveBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DC2626", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  tcLiveTxt:      { color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  tcWatchBtn:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#166534" },
  tcWatchTxt:     { color: CAM_GR, fontSize: 12, fontWeight: "800" },
  tcCamOffPill:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1E293B", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  tcCamOffTxt:    { color: "#475569", fontSize: 11, fontWeight: "600" },

  /* Inline alert */
  tcAlertInline:  { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFF1F2", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: RED_M },
  tcAlertTxt:     { fontSize: 12, color: RED_D, fontWeight: "700", lineHeight: 16 },
  tcAlertTime:    { fontSize: 10, color: RED, marginTop: 2 },

  modalBg:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:  { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle:{ fontSize: 18, fontWeight: "900", color: "#0F172A" },
  modalSub:  { fontSize: 13, color: "#64748B" },
  modalLabel:{ fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 4 },
  msgOption: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: RED_L, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: RED_M },
  msgOptionTxt:{ flex: 1, fontSize: 13, fontWeight: "600", color: RED_D },
  responseOption:{ flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 14, borderWidth: 1.5, borderColor: "#E2E8F0" },
  responseOptionTxt:{ flex: 1, fontSize: 14, color: "#374151", fontWeight: "600" },
  modalActions:{ flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn:  { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12 },
});
