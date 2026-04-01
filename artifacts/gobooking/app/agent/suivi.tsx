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
  Pressable as RNPressable,
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
import CameraConnectModal, { buildHlsHtml, buildMjpegHtml } from "@/components/CameraConnectModal";


/* ── 3-colour operational palette ─────────────────────────── */
const OK      = "#10B981";   /* Vert  — tout va bien          */
const WARN    = "#F59E0B";   /* Orange — attention requise    */
const CRIT    = "#EF4444";   /* Rouge  — alerte critique      */
const RED     = CRIT;
const RED_D   = "#B91C1C";
const RED_L   = "#FEF2F2";
const RED_M   = "#FCA5A5";
const CAM_BG  = "#060A10";
const CAM_GR  = "#94A3B8";
const BG      = "#09101A";   /* Fond général                  */
const CARD    = "#0F1622";   /* Fond carte                    */
const CARD2   = "#131D2B";   /* Fond carte secondaire         */
const BDR     = "rgba(255,255,255,0.07)";

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
  en_route:    { label: "EN ROUTE",    color: OK,   bg: `${OK}18`,   icon: "navigate-outline"        },
  en_attente:  { label: "EN ATTENTE",  color: WARN, bg: `${WARN}18`, icon: "time-outline"            },
  arret:       { label: "À L'ARRÊT",   color: WARN, bg: `${WARN}18`, icon: "pause-circle-outline"    },
  probleme:    { label: "PROBLÈME",    color: CRIT, bg: `${CRIT}18`, icon: "warning-outline"         },
  maintenance: { label: "MAINTENANCE", color: WARN, bg: `${WARN}18`, icon: "construct-outline"       },
  arrivé:      { label: "ARRIVÉ",      color: OK,   bg: `${OK}18`,   icon: "checkmark-circle-outline"},
  en_panne:    { label: "EN PANNE",    color: CRIT, bg: `${CRIT}18`, icon: "alert-circle-outline"    },
};


/* ── Types ─────────────────────────────────────────────────────── */
interface BusItem {
  id: string; busName: string; plateNumber: string;
  logisticStatus: string; status?: string;
  currentLocation?: string; issue?: string;
  currentTripId?: string; maxSpeedKmh?: number;
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
function CameraPlayer({ trip, onClose }: { trip: TripItem; onClose: () => void; }) {
  const [loading,    setLoading]    = useState(true);
  const [zoomIdx,    setZoomIdx]    = useState(0);           // 0=1× 1=1.5× 2=2×
  const [showMeta,   setShowMeta]   = useState(true);        // metadata overlay auto-hides
  const [webErr,     setWebErr]     = useState(false);
  const liveDotAnim  = useRef(new Animated.Value(1)).current;
  const zoomAnim     = useRef(new Animated.Value(1)).current;
  const metaAnim     = useRef(new Animated.Value(1)).current;
  const streamUrl    = trip.cameraStreamUrl!;
  const ZOOM_LEVELS  = [1, 1.5, 2];
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
        {/* Live connection status */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginRight: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: webErr ? "#EF4444" : "#4ADE80" }} />
          <Text style={{ color: webErr ? "#EF4444" : "#4ADE80", fontSize: 10, fontWeight: "800" }}>
            {webErr ? "COUPÉ" : "EN DIRECT"}
          </Text>
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
            source={{ html: buildHlsHtml(streamUrl) }}
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
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: webErr ? "#EF4444" : "#4ADE80" }} />
          <Text style={[CS.footerTxt, { color: webErr ? "#EF4444" : "#4ADE80" }]}>{webErr ? "Flux coupé" : "Flux actif"}</Text>
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
   ALERT DETAIL MODAL — Cycle complet : voir, répondre, valider
   ══════════════════════════════════════════════════════════════════ */
const RESP_INFO: Record<string, { label: string; color: string; icon: string }> = {
  panne:    { label: "Panne mécanique", color: "#EF4444", icon: "construct-outline"   },
  controle: { label: "Contrôle routier", color: "#F59E0B", icon: "shield-outline"     },
  pause:    { label: "Pause normale",    color: "#10B981", icon: "pause-circle-outline"},
};

function AlertDetailModal({
  alert, trip, token, onClose, onRefresh, onClearAutoAlert,
}: {
  alert: AlertItem; trip?: TripItem;
  token: string | null; onClose: () => void; onRefresh: () => void;
  onClearAutoAlert?: (id: string) => void;
}) {
  const [acting, setActing] = useState(false);
  const alType    = alert.type?.toLowerCase() ?? "";
  const TYPE_META: Record<string, { color: string; label: string }> = {
    urgence:          { color: "#EF4444", label: "URGENCE" },
    sos:              { color: "#DC2626", label: "SOS" },
    panne:            { color: "#F59E0B", label: "PANNE" },
    controle:         { color: "#3B82F6", label: "CONTRÔLE" },
    bus_offline:      { color: "#EF4444", label: "HORS LIGNE" },
    bus_arret:        { color: "#F59E0B", label: "ARRÊT ANORMAL" },
    vitesse_anormale: { color: "#EF4444", label: "EXCÈS VITESSE" },
    alerte:           { color: "#EF4444", label: "ALERTE" },
  };
  const meta      = TYPE_META[alType] ?? { color: "#EF4444", label: (alert.type ?? "ALERTE").toUpperCase() };
  const typeColor = meta.color;
  const typeLabel = meta.label;
  const responded = !!alert.response;
  const waiting   = alert.responseRequested && !responded;
  const respInfo  = alert.response ? RESP_INFO[alert.response] : null;

  const doDemanderReponse = async () => {
    setActing(true);
    try {
      const isAutoAlert = alert.id.startsWith("speed-") || alert.id.startsWith("auto-");
      if (!isAutoAlert) {
        await fetch(`${BASE_URL}/agent/suivi/alerts/${alert.id}/demander-reponse`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        });
      }
      onRefresh();
    } catch {} finally { setActing(false); }
  };

  const doConfirm = async () => {
    setActing(true);
    try {
      /* Alertes auto-vitesse (ID synthétique) : validation locale uniquement */
      const isAutoAlert = alert.id.startsWith("speed-") || alert.id.startsWith("auto-");
      if (isAutoAlert) {
        onClearAutoAlert?.(alert.id);
        onRefresh(); onClose();
        return;
      }
      const res = await fetch(`${BASE_URL}/agent/suivi/alerts/${alert.id}/confirm`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        /* Si c'est une panne : notifier automatiquement la logistique */
        const isPanneType = alert.type === "PANNE" || alert.type === "panne";
        if (isPanneType && alert.busId) {
          fetch(`${BASE_URL}/agent/logistique/buses/${alert.busId}/signaler-panne`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ note: `Signalé par Agent Suivi — ${alert.message}` }),
          }).catch(() => {});
        }
        onRefresh(); onClose();
      }
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
  const st        = BUS_STATUS[bus.status ?? bus.logisticStatus ?? ""] ?? { label: bus.status ?? "—", color: "#64748B", bg: "#F1F5F9", icon: "bus-outline" };
  const occ       = trip?.passengerCount != null && trip?.seatCount
    ? Math.round((trip.passengerCount / trip.seatCount) * 100) : null;
  const camOk     = !!(trip?.cameraStatus === "connected" && trip?.cameraStreamUrl);
  const spd       = speed ?? 0;
  const isMoving  = bus.status === "en_route" || bus.logisticStatus === "en_route";
  const maxSpd    = bus.maxSpeedKmh ?? 120;
  const speedWarn = isMoving && spd > maxSpd;

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
              {isMoving && (
                <View style={{ flex: 1.4, backgroundColor: speedWarn ? "rgba(239,68,68,0.07)" : "#0D1117",
                  borderRadius: 10, padding: 12, alignItems: "center",
                  borderWidth: 1, borderColor: speedWarn ? "rgba(239,68,68,0.22)" : "rgba(255,255,255,0.05)" }}>
                  <Text style={{ color: speedWarn ? "#EF4444" : "#E2E8F0", fontSize: 22, fontWeight: "900",
                    letterSpacing: -1, lineHeight: 26 }}>{spd}</Text>
                  <Text style={{ color: speedWarn ? "#EF4444" : "#374151", fontSize: 8, fontWeight: "700", letterSpacing: 0.5 }}>
                    {speedWarn ? `⚠ MAX ${maxSpd}` : `KM/H · MAX ${maxSpd}`}
                  </Text>
                </View>
              )}
              {/* Occupancy */}
              {occ != null && (
                <View style={{ flex: 1, backgroundColor: "#0D1117", borderRadius: 10, padding: 12,
                  alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                  <Text style={{ color: occ != null && occ >= 90 ? "#EF4444" : occ != null && occ >= 70 ? "#F59E0B" : "#E2E8F0",
                    fontSize: 22, fontWeight: "900", letterSpacing: -1, lineHeight: 26 }}>{occ ?? "—"}</Text>
                  <Text style={{ color: "#374151", fontSize: 8, fontWeight: "700", letterSpacing: 0.5 }}>PASSAGERS %</Text>
                </View>
              )}
              {/* Camera */}
              <View style={{ flex: 1, backgroundColor: "#0D1117", borderRadius: 10, padding: 12,
                alignItems: "center", gap: 5,
                borderWidth: 1, borderColor: camOk ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4,
                  backgroundColor: camOk ? "#E2E8F0" : "#1F2937" }} />
                <Text style={{ color: camOk ? "#94A3B8" : "#374151", fontSize: 8, fontWeight: "700" }}>CAM</Text>
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
  const [showCamConnect, setShowCamConnect] = useState(false);
  const [connectTargetTrip, setConnectTargetTrip] = useState<TripItem | null>(null);
  const [lastSync,    setLastSync]    = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  const [autoSpeedAlerts, setAutoSpeedAlerts] = useState<AlertItem[]>([]);
  const mergedAlerts   = useMemo(() => [...(data?.alerts ?? []), ...autoSpeedAlerts], [data?.alerts, autoSpeedAlerts]);
  const hasAlerts      = mergedAlerts.length > 0;
  const activeCamCount = data?.trips?.filter(t => t.cameraStatus === "connected").length ?? 0;
  const hasCameras     = activeCamCount > 0;

  /* ── New interactive state ── */
  const [selectedBus,   setSelectedBus]   = useState<BusItem | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [soundMuted,    setSoundMuted]    = useState(false);
  const [busSpeedMap,   setBusSpeedMap]   = useState<Record<string, number>>({});

  /* Focus Alert Mode */
  const [alertFocusIdx,  setAlertFocusIdx]  = useState(0);
  const [fleetExpanded,  setFleetExpanded]  = useState(true);
  const [showAllAlerts,  setShowAllAlerts]  = useState(false);
  const [suiviTab,       setSuiviTab]       = useState<"alertes" | "flotte" | "voyages">("alertes");
  const soundRef = useRef<{ stop: () => void } | null>(null);

  const [syncSec,    setSyncSec]    = useState(0);
  const [liveTime,   setLiveTime]   = useState(() => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

  const activeCamTrips = useMemo(
    () => data?.trips?.filter(t => t.cameraStatus === "connected" && !!t.cameraStreamUrl) ?? [],
    [data]
  );

  /* ── Sorted buses: alert+camera first, then alert-only, then rest ── */
  const sortedBuses = useMemo(() => {
    if (!data?.buses) return [];
    return [...data.buses].sort((a, b) => {
      /* Inclut alertes auto-vitesse dans le calcul de priorité */
      const aAlerts = mergedAlerts.filter(x => x.busId === a.id).length;
      const bAlerts = mergedAlerts.filter(x => x.busId === b.id).length;
      const aTrip   = data.trips.find(t => t.busId === a.id);
      const bTrip   = data.trips.find(t => t.busId === b.id);
      const aCamOk  = !!(aTrip?.cameraStatus === "connected" && aTrip?.cameraStreamUrl);
      const bCamOk  = !!(bTrip?.cameraStatus === "connected" && bTrip?.cameraStreamUrl);
      /* Priorité absolue : alertes actives → caméra → reste */
      const aScore = (aAlerts > 0 ? 100 : 0) + aAlerts * 10 + (aCamOk ? 3 : 0);
      const bScore = (bAlerts > 0 ? 100 : 0) + bAlerts * 10 + (bCamOk ? 3 : 0);
      return bScore - aScore;
    });
  }, [data, mergedAlerts]);  const signalWarnTrips: any[] = [];

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

  /* ── Live clock (HH:MM:SS) ── */
  useEffect(() => {
    const iv = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(iv);
  }, []);



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

  /* ── Speed simulation per bus (en_route only) — uses per-bus maxSpeedKmh ── */
  const autoAlertSent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data?.buses) return;
    setBusSpeedMap(prev => {
      const next: Record<string, number> = { ...prev };
      data.buses.forEach(b => {
        const isMoving = b.status === "en_route" || b.logisticStatus === "en_route";
        if (isMoving && !next[b.id]) {
          const max = b.maxSpeedKmh ?? 120;
          next[b.id] = Math.max(50, Math.round(max * 0.60) + Math.floor(Math.random() * Math.round(max * 0.30)));
        }
      });
      return next;
    });
    const iv = setInterval(() => {
      setBusSpeedMap(prev => {
        const next: Record<string, number> = {};
        data.buses.forEach(b => {
          const isMoving = b.status === "en_route" || b.logisticStatus === "en_route";
          if (isMoving) {
            const max = b.maxSpeedKmh ?? 120;
            const cur = prev[b.id] ?? Math.round(max * 0.7);
            const drift = Math.floor((Math.random() - 0.43) * 10);
            next[b.id] = Math.max(40, Math.min(Math.round(max * 1.18), cur + drift));
          }
        });
        return next;
      });
    }, 2800);
    return () => clearInterval(iv);
  }, [data?.buses]);

  /* ── Auto-alerte vitesse : si dépassement du seuil par bus ── */
  useEffect(() => {
    if (!data?.buses) return;
    data.buses.forEach(b => {
      const spd  = busSpeedMap[b.id];
      const max  = b.maxSpeedKmh ?? 120;
      const key  = `speed-${b.id}`;
      if (spd && spd > max && !autoAlertSent.current.has(key)) {
        autoAlertSent.current.add(key);
        const newAlert: AlertItem = {
          id:                key,
          type:              "VITESSE",
          busId:             b.id,
          busName:           b.busName,
          agentId:           "system",
          agentName:         "Système Auto",
          message:           `Vitesse excessive : ${spd} km/h (limite ${max} km/h)`,
          status:            "active",
          response:          null,
          respondedAt:       null,
          responseRequested: false,
          createdAt:         new Date().toISOString(),
        };
        setAutoSpeedAlerts(prev => {
          const exists = prev.some(a => a.id === key);
          return exists ? prev : [newAlert, ...prev];
        });
        /* Notify API — best effort */
        if (token) {
          fetch(`${BASE_URL}/agent/suivi/alerts/trigger`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              busId: b.id, busName: b.busName, tripId: b.currentTripId,
              type: "VITESSE",
              message: `Vitesse excessive détectée : ${spd} km/h — limite autorisée ${max} km/h`,
            }),
          }).catch(() => {});
        }
      }
    });
  }, [busSpeedMap, data?.buses, token]);

  /* Sync focus index when alert count changes, auto-collapse fleet in alert mode */
  useEffect(() => {
    setAlertFocusIdx(prev => Math.min(prev, Math.max(0, mergedAlerts.length - 1)));
    if (mergedAlerts.length > 0) setFleetExpanded(false);
    else                         setFleetExpanded(true);
  }, [mergedAlerts.length]);

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
        <CameraPlayer trip={cameraTrip} onClose={() => setCameraTrip(null)} />
      </SafeAreaView>
    );
  }


  const activeTrip      = data?.trips?.find(t => t.status === "en_route") ?? data?.trips?.[0] ?? null;
  const totalPassengers = data?.trips?.reduce((s, t) => s + (t.passengerCount ?? 0), 0) ?? 0;
  const busCount        = data?.buses?.length ?? 0;
  const alertCount      = mergedAlerts.length;
  const busesEnRoute    = data?.buses?.filter(b => b.status === "en_route")?.length ?? 0;
  const tripsSansAlerte = (data?.buses?.length ?? 0) - [...new Set(mergedAlerts.map(a => a.busId))].length;

  /* ── Alertes tab pre-computed vars ── */
  const alertRank   = (a: AlertItem) => a.response ? 2 : a.responseRequested ? 1 : 0;
  const alertSorted = [...mergedAlerts].sort((a, b) => alertRank(a) - alertRank(b));
  const alertVis    = showAllAlerts ? alertSorted : alertSorted.slice(0, 5);
  const alertExtra  = alertSorted.length - 5;

  /* ── Voyages tab pre-computed vars ── */
  const allTrips   = data?.trips ?? [];
  const tripsActive= allTrips.filter(t => ["en_route","en_cours","embarquement"].includes(t.status ?? ""));
  const tripsDone  = allTrips.filter(t => ["terminé","arrivé"].includes(t.status ?? ""));
  const tripsOther = allTrips.filter(t => !tripsActive.includes(t) && !tripsDone.includes(t));
  const TRIP_ST: Record<string, { label: string; color: string; bg: string }> = {
    en_route:      { label: "En route",      color: "#2563EB", bg: "#EFF6FF" },
    en_cours:      { label: "En cours",      color: "#2563EB", bg: "#EFF6FF" },
    embarquement:  { label: "Embarquement",  color: "#D97706", bg: "#FFFBEB" },
    "terminé":     { label: "Terminé",       color: "#059669", bg: "#ECFDF5" },
    "arrivé":      { label: "Arrivé",        color: "#059669", bg: "#ECFDF5" },
    planifié:      { label: "Planifié",      color: "#6B7280", bg: "#F3F4F6" },
  };

  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1120" />

      {/* ══ HEADER ════════════════════════════════════════════════════ */}
      <View style={S.header}>
        {/* Top row */}
        <View style={S.headerTop}>
          <View style={S.headerLeft}>
            <View style={S.headerIcon}>
              <Ionicons name="pulse" size={20} color={OK} />
            </View>
            <View style={{ flex: 1, overflow: "hidden" }}>
              <Text style={S.headerTitle} numberOfLines={1}>Centre de Contrôle</Text>
              <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                <Animated.View style={{ width:5, height:5, borderRadius:3,
                  backgroundColor: hasAlerts ? CRIT : OK,
                  opacity: pulseAnim.interpolate({ inputRange:[1,1.04], outputRange:[1,0.1] }) }} />
                <Text style={[S.headerSub, hasAlerts && { color: "#F87171" }]}>
                  {hasAlerts ? `${alertCount} ALERTE${alertCount > 1 ? "S" : ""} ACTIVE${alertCount > 1 ? "S" : ""}` : "SYSTÈME EN LIGNE"}
                </Text>
              </View>
            </View>
          </View>
          <View style={S.headerRight}>
            {/* Horloge temps réel */}
            <View style={S.clockPill}>
              <Ionicons name="time-outline" size={11} color="#475569" />
              <Text style={S.clockTxt}>{liveTime}</Text>
            </View>
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
        {/* ── Barre de statut global opérationnel ── */}
        <View style={S.statusBar}>
          {/* ALERTES — tile dominant si présentes */}
          <View style={[S.statusTile, hasAlerts && S.statusTileAlert]}>
            {hasAlerts ? (
              <>
                <Animated.Text style={[S.statusBigNum, { color: CRIT, transform: [{ scale: pulseAnim }] }]}>
                  {alertCount}
                </Animated.Text>
                <View style={S.statusLblRow}>
                  <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CRIT,
                    transform: [{ scale: pulseAnim }] }} />
                  <Text style={[S.statusLbl, { color: CRIT }]}>ALERTE{alertCount > 1 ? "S" : ""}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={[S.statusBigNum, { color: OK }]}>0</Text>
                <View style={S.statusLblRow}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: OK }} />
                  <Text style={[S.statusLbl, { color: OK }]}>ALERTES</Text>
                </View>
              </>
            )}
          </View>

          <View style={S.statusDiv} />

          {/* ACTIFS */}
          <View style={S.statusTile}>
            <Text style={[S.statusNum, { color: busesEnRoute > 0 ? OK : "#475569" }]}>{busesEnRoute}</Text>
            <View style={S.statusLblRow}>
              <Ionicons name="navigate" size={9} color={busesEnRoute > 0 ? OK : "#374151"} />
              <Text style={[S.statusLbl, { color: busesEnRoute > 0 ? OK : "#374151" }]}>EN ROUTE</Text>
            </View>
          </View>

          <View style={S.statusDiv} />

          {/* OK — sans alerte */}
          <View style={S.statusTile}>
            <Text style={[S.statusNum, { color: tripsSansAlerte > 0 ? OK : "#475569" }]}>{Math.max(0, tripsSansAlerte)}</Text>
            <View style={S.statusLblRow}>
              <Ionicons name="checkmark-circle" size={9} color={tripsSansAlerte > 0 ? OK : "#374151"} />
              <Text style={[S.statusLbl, { color: tripsSansAlerte > 0 ? OK : "#374151" }]}>OK</Text>
            </View>
          </View>

          <View style={S.statusDiv} />

          {/* PASSAGERS */}
          <View style={S.statusTile}>
            <Text style={S.statusNum}>{totalPassengers}</Text>
            <View style={S.statusLblRow}>
              <Ionicons name="people" size={9} color="#374151" />
              <Text style={S.statusLbl}>PAX</Text>
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
            {mergedAlerts[0]?.busName ?? "Intervention requise"}
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
        <>
          {/* ══ ONGLETS NAVIGATION — FIXE, ne défile pas ══════════════ */}
          <View style={{
            flexDirection: "row", backgroundColor: CARD2, padding: 4,
            marginHorizontal: 14, marginTop: 8, marginBottom: 8,
            borderRadius: 16, borderWidth: 1, borderColor: BDR,
          }}>
            {([
              { key: "alertes",  icon: "alert-circle-outline",  label: "Alertes",    badge: mergedAlerts.filter(a => !a.response).length },
              { key: "flotte",   icon: "bus-outline",            label: "Flotte",     badge: data?.buses?.length ?? 0 },
              { key: "voyages",  icon: "map-outline",            label: "Voyages",    badge: data?.trips?.filter(t => t.status === "en_route" || t.status === "en_cours").length ?? 0 },
            ] as { key: "alertes" | "flotte" | "voyages"; icon: any; label: string; badge: number }[]).map(t => {
              const active = suiviTab === t.key;
              const showBadge = t.badge > 0;
              const tabColor = t.key === "alertes" ? RED_D : t.key === "flotte" ? "#1D4ED8" : "#0D9488";
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setSuiviTab(t.key)}
                  style={{
                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                    paddingVertical: 12, borderRadius: 12, gap: 5,
                    backgroundColor: active ? tabColor : "transparent",
                  }}>
                  <Ionicons name={t.icon} size={15} color={active ? "#fff" : "#475569"} />
                  <Text style={{ fontSize: 12, fontWeight: active ? "800" : "600", color: active ? "#fff" : "#475569" }}>{t.label}</Text>
                  {showBadge && (
                    <View style={{
                      backgroundColor: active ? "rgba(255,255,255,0.25)" : `${tabColor}99`,
                      borderRadius: 10, minWidth: 18, height: 18,
                      justifyContent: "center", alignItems: "center", paddingHorizontal: 4,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>{t.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={S.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OK} />}
          >

          {/* ══ SECTION ALERTES ══════════════════════════════════════════ */}
          {suiviTab === "alertes" && (
              <View style={S.section}>
                {/* Titre section */}
                <View style={S.sectionHeader}>
                  {hasAlerts ? (
                    <>
                      <Animated.View style={{ width: 7, height: 7, borderRadius: 4,
                        backgroundColor: CRIT, transform: [{ scale: pulseAnim }] }} />
                      <Text style={S.sectionTitleAlert}>
                        {alertCount} ALERTE{alertCount > 1 ? "S" : ""} ACTIVE{alertCount > 1 ? "S" : ""}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={12} color={OK} />
                      <Text style={S.sectionTitleOk}>AUCUNE ALERTE ACTIVE</Text>
                    </>
                  )}
                </View>

                {/* Aucune alerte */}
                {!hasAlerts && (
                  <View style={S.noAlertBox}>
                    <Ionicons name="shield-checkmark" size={32} color={OK} />
                    <Text style={S.noAlertTitle}>Système normal</Text>
                    <Text style={S.noAlertSub}>Tous les bus opèrent sans incident</Text>
                  </View>
                )}

                {/* Liste des alertes (max 5, puis voir plus) */}
                {alertVis.map((alert) => {
                  const flowStep  = alert.response ? "validate" : alert.responseRequested ? "waiting" : "new";
                  const stepColor = flowStep === "validate" ? OK : flowStep === "waiting" ? WARN : CRIT;
                  const btnLabel  = flowStep === "validate" ? "VALIDER" : "TRAITER";
                  const alTypeLow = alert.type?.toLowerCase() ?? "";
                  const TYPE_MAP: Record<string, { color: string; label: string }> = {
                    urgence: { color: "#EF4444", label: "URGENCE" }, sos: { color: "#DC2626", label: "SOS" },
                    panne: { color: "#F59E0B", label: "PANNE" }, controle: { color: "#3B82F6", label: "CONTRÔLE" },
                    bus_offline: { color: "#EF4444", label: "HORS LIGNE" }, bus_arret: { color: "#F59E0B", label: "ARRÊT" },
                    vitesse_anormale: { color: "#EF4444", label: "VITESSE" }, alerte: { color: "#EF4444", label: "ALERTE" },
                  };
                  const typeMeta = TYPE_MAP[alTypeLow] ?? { color: "#EF4444", label: (alert.type ?? "ALERTE").toUpperCase() };
                  const aTrip     = data?.trips.find(t =>
                    (alert.busId && t.busId === alert.busId) ||
                    (alert.busName && t.busName === alert.busName)
                  );
                  const aCamOk  = !!(aTrip?.cameraStatus === "connected" && aTrip?.cameraStreamUrl);
                                    const timeAgo = Math.round((Date.now() - new Date(alert.createdAt).getTime()) / 60000);

                  return (
                    <View key={alert.id} style={[S.alertCard, { borderColor: `${stepColor}35` }]}>

                      {/* ── Ligne 1 : badge + type + temps ── */}
                      <View style={S.alertCardRow1}>
                        <View style={[S.alertBadge, { backgroundColor: `${stepColor}15`, borderColor: `${stepColor}30` }]}>
                          <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: stepColor, flexShrink: 0,
                            ...(flowStep === "new" ? { transform: [{ scale: pulseAnim }] } : {}) }} />
                          <Text style={[S.alertBadgeTxt, { color: stepColor }]}>
                            {flowStep === "validate" ? "Réponse reçue" : flowStep === "waiting" ? "En attente" : "Action requise"}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: `${typeMeta.color}18`, borderRadius: 6, borderWidth: 1, borderColor: `${typeMeta.color}30`, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: typeMeta.color, letterSpacing: 0.5 }}>
                            {typeMeta.label}
                          </Text>
                        </View>
                        <Text style={[S.alertTimeTxt, { marginLeft: "auto" }]}>{timeAgo < 1 ? "À l'instant" : `${timeAgo} min`}</Text>
                      </View>

                      {/* ── Ligne 2 : Nom bus ── */}
                      <Text style={S.alertBusName} numberOfLines={1} ellipsizeMode="tail">
                        {alert.busName ?? "Bus inconnu"}
                      </Text>

                      {/* ── Ligne 3 : Message ── */}
                      <Text style={S.alertMessage} numberOfLines={2} ellipsizeMode="tail">
                        {alert.message}
                      </Text>

                      {/* ── Caméra (si disponible) ── */}
                      {aCamOk && aTrip && (
                        <TouchableOpacity style={S.alertCamBlock} onPress={() => setCameraTrip(aTrip)} activeOpacity={0.9}>
                          <View style={S.alertCamHeader}>
                            <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: CRIT, flexShrink: 0,
                              opacity: pulseAnim.interpolate({ inputRange: [1, 1.04], outputRange: [1, 0.2] }) }} />
                            <Text style={S.alertCamTitleTxt}>CAMÉRA LIVE</Text>
                            <Ionicons name="expand-outline" size={11} color="#374151" />
                          </View>
                          <View style={S.alertCamFeed}>
                            
                          </View>
                        </TouchableOpacity>
                      )}

                      {/* ── Bouton TRAITER ── */}
                      <TouchableOpacity
                        style={[S.alertTraiterBtn, { backgroundColor: `${stepColor}12`, borderColor: `${stepColor}40` }]}
                        onPress={() => setSelectedAlert(alert)}
                        activeOpacity={0.82}
                      >
                        <Ionicons name={flowStep === "validate" ? "checkmark-done" : "shield-checkmark"} size={16} color={stepColor} />
                        <Text style={[S.alertTraiterTxt, { color: stepColor }]}>{btnLabel} L'ALERTE</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {/* Voir plus / voir moins */}
                {!showAllAlerts && alertExtra > 0 && (
                  <TouchableOpacity style={S.showMoreBtn} onPress={() => setShowAllAlerts(true)} activeOpacity={0.8}>
                    <Text style={S.showMoreTxt}>Voir {alertExtra} autre{alertExtra > 1 ? "s" : ""} alerte{alertExtra > 1 ? "s" : ""}</Text>
                    <Ionicons name="chevron-down" size={13} color="#374151" />
                  </TouchableOpacity>
                )}
                {showAllAlerts && alertSorted.length > 5 && (
                  <TouchableOpacity style={S.showMoreBtn} onPress={() => setShowAllAlerts(false)} activeOpacity={0.8}>
                    <Text style={S.showMoreTxt}>Réduire</Text>
                    <Ionicons name="chevron-up" size={13} color="#374151" />
                  </TouchableOpacity>
                )}
              </View>
          )}

          {/* ══ SECTION FLOTTE ═══════════════════════════════════════════ */}
          {suiviTab === "flotte" && <View style={S.section}>
            {/* Toggle flotte */}
            <TouchableOpacity style={S.sectionHeader} onPress={() => setFleetExpanded(v => !v)} activeOpacity={0.8}>
              <Ionicons name="bus-outline" size={12} color="#374151" />
              <Text style={S.sectionTitleFleet}>FLOTTE — {busCount} BUS</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name={fleetExpanded ? "chevron-up" : "chevron-down"} size={14} color="#374151" />
            </TouchableOpacity>

            {/* Lignes compactes — bus */}
            {fleetExpanded && sortedBuses.map(bus => {
              const trip       = data!.trips.find(t => t.busId === bus.id || t.busName === bus.busName);
              const st         = BUS_STATUS[bus.status ?? ""] ?? { label: bus.status ?? "—", color: "#64748B", bg: "#1E293B", icon: "bus-outline" };
              const busAlerts  = mergedAlerts.filter(a => a.busId === bus.id || a.busName === bus.busName);
              const hasBusAlert = busAlerts.length > 0;
              const speed      = busSpeedMap[bus.id];
              const speedLimit = bus.maxSpeedKmh ?? 120;
              const speedWarn  = speed != null && speed > speedLimit;
              const accent     = hasBusAlert ? CRIT : speedWarn ? WARN : st.color;

              return (
                <TouchableOpacity
                  key={bus.id}
                  style={[S.fleetRow, hasBusAlert && S.fleetRowAlert]}
                  onPress={() => setSelectedBus(bus)}
                  activeOpacity={0.8}
                >
                  {/* Dot statut */}
                  <View style={[S.fleetDot, { backgroundColor: accent }]} />

                  {/* Info texte */}
                  <View style={S.fleetRowText}>
                    <Text style={[S.fleetRowName, hasBusAlert && { color: "#F1F5F9" }]} numberOfLines={1} ellipsizeMode="tail">
                      {bus.busName}
                    </Text>
                    {trip ? (
                      <Text style={S.fleetRowRoute} numberOfLines={1} ellipsizeMode="tail">
                        {trip.from} → {trip.to}
                      </Text>
                    ) : (
                      <Text style={[S.fleetRowRoute, { color: accent }]}>{st.label}</Text>
                    )}
                  </View>

                  {/* Vitesse ou statut */}
                  {speed != null ? (
                    <Text style={[S.fleetRowSpeed, { color: speedWarn ? CRIT : "#64748B" }]} numberOfLines={1}>
                      {speed} km/h
                    </Text>
                  ) : (
                    <Text style={[S.fleetRowSpeed, { color: accent }]} numberOfLines={1}>{st.label}</Text>
                  )}

                  <Ionicons name="chevron-forward" size={13} color="#1E293B" />
                </TouchableOpacity>
              );
            })}

            {fleetExpanded && sortedBuses.length === 0 && (
              <Text style={S.fleetEmpty}>Aucun bus en service</Text>
            )}
          </View>}

          {/* ══ SECTION VOYAGES ════════════════════════════════════════════ */}
          {suiviTab === "voyages" && (
            <View>
              {allTrips.length === 0 ? (
                <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 36, alignItems: "center", borderWidth: 1, borderColor: BDR }}>
                  <Ionicons name="bus-outline" size={40} color="#334155" />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#94A3B8", marginTop: 12 }}>Aucun voyage</Text>
                  <Text style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Aucun voyage enregistré pour votre agence.</Text>
                </View>
              ) : (
                <>
                  {tripsActive.length > 0 && (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: "#3B82F6" }} />
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#E2E8F0", letterSpacing: 0.3 }}>EN COURS ({tripsActive.length})</Text>
                      </View>
                      {tripsActive.map(trip => {
                        const cam = trip.cameraStatus === "connected" && !!trip.cameraStreamUrl;
                        const tripStatusColor = trip.status === "en_route" || trip.status === "en_cours" ? "#3B82F6" : "#D97706";
                        return (
                          <View key={trip.id} style={{ backgroundColor: CARD, borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: `${tripStatusColor}35`, marginBottom: 10 }}>
                            {/* En-tête coloré */}
                            <View style={{ backgroundColor: `${tripStatusColor}18`, padding: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Ionicons name="bus" size={14} color={tripStatusColor} />
                                <Text style={{ fontWeight: "800", color: tripStatusColor, fontSize: 13 }}>{trip.busName ?? "Bus"}</Text>
                              </View>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                {cam ? (
                                  <TouchableOpacity onPress={() => setCameraTrip(trip)}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(220,38,38,0.18)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(220,38,38,0.35)" }}>
                                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#DC2626" }} />
                                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#F87171" }}>LIVE</Text>
                                    </View>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity onPress={() => { setConnectTargetTrip(trip); setShowCamConnect(true); }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(59,130,246,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(59,130,246,0.35)" }}>
                                      <Feather name="video" size={10} color="#60A5FA" />
                                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#60A5FA" }}>+ Caméra</Text>
                                    </View>
                                  </TouchableOpacity>
                                )}
                                <View style={{ backgroundColor: `${tripStatusColor}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${tripStatusColor}40` }}>
                                  <Text style={{ fontSize: 10, fontWeight: "700", color: tripStatusColor }}>{(trip.status ?? "—").toUpperCase().replace("_", " ")}</Text>
                                </View>
                              </View>
                            </View>
                            {/* Corps */}
                            <View style={{ padding: 12, gap: 7 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Ionicons name="navigate-outline" size={13} color="#64748B" />
                                <Text style={{ fontSize: 14, fontWeight: "700", color: "#F1F5F9" }}>{trip.from} → {trip.to}</Text>
                              </View>
                              <View style={{ flexDirection: "row", gap: 16 }}>
                                {trip.departureTime && (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Ionicons name="time-outline" size={12} color="#475569" />
                                    <Text style={{ fontSize: 12, color: "#64748B" }}>Départ: {trip.departureTime}</Text>
                                  </View>
                                )}
                                {trip.passengerCount !== undefined && (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Ionicons name="people-outline" size={12} color="#475569" />
                                    <Text style={{ fontSize: 12, color: "#64748B" }}>{trip.passengerCount} passagers</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                  {tripsOther.length > 0 && (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: tripsActive.length > 0 ? 12 : 0 }}>
                        <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: "#D97706" }} />
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#E2E8F0", letterSpacing: 0.3 }}>PLANIFIÉS ({tripsOther.length})</Text>
                      </View>
                      {tripsOther.map(trip => (
                        <View key={trip.id} style={{ backgroundColor: CARD, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: BDR, marginBottom: 8 }}>
                          <View style={{ backgroundColor: "rgba(217,119,6,0.12)", padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                              <Ionicons name="bus-outline" size={13} color="#F59E0B" />
                              <Text style={{ fontWeight: "700", color: "#F59E0B", fontSize: 12 }}>{trip.busName ?? "Bus"}</Text>
                            </View>
                            <Text style={{ fontSize: 10, color: "#D97706", fontWeight: "700" }}>{(trip.status ?? "—").toUpperCase().replace("_", " ")}</Text>
                          </View>
                          <View style={{ padding: 10 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#CBD5E1" }}>{trip.from} → {trip.to}</Text>
                            {trip.departureTime && <Text style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>Départ: {trip.departureTime}</Text>}
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                  {tripsDone.length > 0 && (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 12 }}>
                        <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: OK }} />
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#E2E8F0", letterSpacing: 0.3 }}>TERMINÉS ({tripsDone.length})</Text>
                      </View>
                      {tripsDone.map(trip => (
                        <View key={trip.id} style={{ backgroundColor: "rgba(5,150,105,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(5,150,105,0.25)", marginBottom: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#6EE7B7" }}>{trip.from} → {trip.to}</Text>
                            <Text style={{ fontSize: 11, color: "#34D399", marginTop: 2 }}>{trip.busName}</Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="checkmark-circle" size={14} color={OK} />
                            <Text style={{ fontSize: 11, fontWeight: "700", color: OK }}>Terminé</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          </ScrollView>
        </>
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
          onClearAutoAlert={(id) => {
            autoAlertSent.current.delete(id);
            setAutoSpeedAlerts(prev => prev.filter(a => a.id !== id));
          }}
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

      {/* ── Camera Connect Modal ─────────────────────────────────── */}
      <Modal
        visible={showCamConnect}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCamConnect(false)}
      >
        <CameraConnectModal
          trips={data?.trips?.filter(t => ["en_route","en_cours","boarding","embarquement"].includes(t.status ?? "")) ?? []}
          token={token}
          preselectedTrip={connectTargetTrip}
          onClose={() => { setShowCamConnect(false); setConnectTargetTrip(null); }}
          onConnected={(trip) => {
            setShowCamConnect(false);
            setConnectTargetTrip(null);
            load(false);          // refresh data to pick up connected camera
            setCameraTrip(trip);  // immediately open the player
          }}
        />
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
  safe: { flex: 1, backgroundColor: BG },

  /* ── Header ─────────────────────────────────────────────────── */
  header:     { backgroundColor: "#0B1120",
                borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  headerTop:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, overflow: "hidden" },
  headerRight:{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${OK}18`,
                justifyContent: "center", alignItems: "center", flexShrink: 0,
                borderWidth: 1, borderColor: `${OK}35` },
  headerTitle:{ color: "#F1F5F9", fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  headerSub:  { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1, letterSpacing: 0.3 },

  /* ── Status bar opérationnel ────────────────────────────── */
  statusBar:      { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)",
                    backgroundColor: "rgba(0,0,0,0.25)" },
  statusTile:     { flex: 1, alignItems: "center", paddingVertical: 13, gap: 5 },
  statusTileAlert:{ backgroundColor: `${CRIT}10`, borderBottomWidth: 2, borderBottomColor: CRIT },
  statusBigNum:   { fontSize: 34, fontWeight: "900", lineHeight: 38, letterSpacing: -1.5 },
  statusNum:      { fontSize: 26, fontWeight: "900", lineHeight: 30, letterSpacing: -1, color: "#E2E8F0" },
  statusLblRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  statusLbl:      { fontSize: 8, fontWeight: "800", letterSpacing: 1.2, color: "#374151" },
  statusDiv:      { width: 1, backgroundColor: "rgba(255,255,255,0.07)", marginVertical: 8 },
  /* Garde les anciens noms pour compat interne */
  kpiTile:    { flex: 1, alignItems: "center", paddingVertical: 12, gap: 5 },
  kpiNum:     { color: "#F1F5F9", fontSize: 30, fontWeight: "900", lineHeight: 34, letterSpacing: -1 },
  kpiLbl:     { color: "rgba(255,255,255,0.35)", fontSize: 8, fontWeight: "700", letterSpacing: 1.2 },
  kpiRow:     { flexDirection: "row", alignItems: "center", gap: 4 },
  kpiDiv:     { width: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 4 },

  syncPill:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  syncDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR },
  syncTxt:    { color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  iconBtn:    { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.14)",
                justifyContent: "center", alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },

  /* Alarm bar — clean critical strip */
  alarmBar:        { flexDirection: "row", alignItems: "center", gap: 10,
                     backgroundColor: `${CRIT}14`,
                     paddingHorizontal: 16, paddingVertical: 11,
                     borderBottomWidth: 1, borderBottomColor: `${CRIT}30`,
                     borderLeftWidth: 4, borderLeftColor: CRIT },
  alarmPulse:      { width: 9, height: 9, borderRadius: 5, backgroundColor: CRIT, flexShrink: 0 },
  alarmBarTxt:     { color: CRIT, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  alarmBarBus:     { color: "#F1F5F9", fontSize: 11, fontWeight: "700", flex: 1 },
  alarmUrgentBadge:{ backgroundColor: CRIT, borderRadius: 6,
                     paddingHorizontal: 9, paddingVertical: 4 },
  alarmUrgentTxt:  { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },

  /* Center / Loading */
  center:     { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 36 },
  loadingTxt: { fontSize: 15, fontWeight: "700", color: "#E2E8F0" },
  loadingSub: { fontSize: 12, color: "#64748B", textAlign: "center", lineHeight: 18 },

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
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#E2E8F0", letterSpacing: -0.4, flex: 1 },
  sectionCount: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
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
  fixedAlerts:    { backgroundColor: `${CRIT}0D`, paddingVertical: 8, paddingHorizontal: 12, gap: 5,
                    borderBottomWidth: 1, borderBottomColor: `${CRIT}20` },
  fixedAlertRow:  { flexDirection: "row", alignItems: "center", gap: 8,
                    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 7,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  fixedAlertBus:  { color: "#E2E8F0", fontSize: 11, fontWeight: "900", flexShrink: 0 },
  fixedAlertMsg:  { color: "#64748B", fontSize: 11, fontWeight: "600", flex: 1 },
  fixedAlertTime: { color: "#475569", fontSize: 10, fontWeight: "700", flexShrink: 0 },

  /* ── Horloge header ── */
  clockPill:        { flexDirection: "row", alignItems: "center", gap: 4,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  clockTxt:         { fontSize: 12, fontWeight: "900", color: "#CBD5E1", letterSpacing: 0.5,
                      fontVariant: ["tabular-nums"] as any },

  /* ── Layout principal ── */
  scrollContent:    { paddingBottom: 48 },
  section:          { marginHorizontal: 14, marginTop: 16 },
  sectionHeader:    { flexDirection: "row", alignItems: "center", gap: 8,
                      paddingVertical: 10, marginBottom: 8,
                      borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  sectionTitleAlert:{ fontSize: 11, fontWeight: "900", color: CRIT, letterSpacing: 1.3,
                      flex: 1 },
  sectionTitleOk:   { fontSize: 11, fontWeight: "900", color: OK, letterSpacing: 1.3, flex: 1 },
  sectionTitleFleet:{ fontSize: 11, fontWeight: "900", color: "#374151", letterSpacing: 1.3, flex: 1 },

  /* ── Aucune alerte ── */
  noAlertBox:       { alignItems: "center", paddingVertical: 36, gap: 8 },
  noAlertTitle:     { fontSize: 16, fontWeight: "800", color: OK },
  noAlertSub:       { fontSize: 12, color: "#374151", fontWeight: "600" },

  /* ── Carte alerte (la principale) ── */
  alertCard:        { backgroundColor: "#080C14", borderRadius: 14, borderWidth: 1,
                      overflow: "hidden", marginBottom: 12,
                      ...(Platform.OS === "web"
                        ? { boxShadow: "0 2px 16px rgba(0,0,0,0.4)" }
                        : { elevation: 4, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10 }) },
  alertCardRow1:    { flexDirection: "row", alignItems: "center", gap: 8,
                      paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  alertBadge:       { flexDirection: "row", alignItems: "center", gap: 5,
                      borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1, flexShrink: 0 },
  alertBadgeTxt:    { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  alertTimeTxt:     { fontSize: 10, color: "#374151", fontWeight: "600", marginLeft: "auto" as any },
  alertBusName:     { fontSize: 18, fontWeight: "900", color: "#F1F5F9",
                      letterSpacing: -0.3, paddingHorizontal: 14, marginTop: 6 },
  alertMessage:     { fontSize: 13, color: "#64748B", fontWeight: "600",
                      lineHeight: 18, paddingHorizontal: 14, marginTop: 4, marginBottom: 12 },
  /* Caméra dans la carte alerte */
  alertCamBlock:    { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)", overflow: "hidden" },
  alertCamHeader:   { flexDirection: "row", alignItems: "center", gap: 7,
                      paddingHorizontal: 12, paddingVertical: 7,
                      backgroundColor: "rgba(0,0,0,0.35)" },
  alertCamTitleTxt: { fontSize: 9, fontWeight: "900", color: CRIT, letterSpacing: 1.2, flex: 1 },
  alertCamFeed:     { height: 110, overflow: "hidden", backgroundColor: "#060810" },
  /* Bouton TRAITER */
  alertTraiterBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                      margin: 12, marginTop: 10, paddingVertical: 13,
                      borderRadius: 10, borderWidth: 1.5 },
  alertTraiterTxt:  { fontSize: 14, fontWeight: "900", letterSpacing: 0.3 },
  /* Voir plus */
  showMoreBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                      paddingVertical: 12, borderRadius: 10, borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.07)",
                      backgroundColor: "rgba(255,255,255,0.02)", marginBottom: 4 },
  showMoreTxt:      { fontSize: 12, fontWeight: "700", color: "#374151" },

  /* ── Flotte : lignes compactes ── */
  fleetRow:         { flexDirection: "row", alignItems: "center", gap: 10,
                      paddingVertical: 12, paddingHorizontal: 12,
                      backgroundColor: "rgba(255,255,255,0.02)",
                      borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: BDR },
  fleetRowAlert:    { borderColor: `${CRIT}30`, backgroundColor: `${CRIT}06` },
  fleetDot:         { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  fleetRowText:     { flex: 1, minWidth: 0, gap: 2 },
  fleetRowName:     { fontSize: 13, fontWeight: "800", color: "#94A3B8", flexShrink: 1 },
  fleetRowRoute:    { fontSize: 11, fontWeight: "600", color: "#374151", flexShrink: 1 },
  fleetRowSpeed:    { fontSize: 12, fontWeight: "800", flexShrink: 0 },
  fleetEmpty:       { textAlign: "center" as any, color: "#374151", fontSize: 13,
                      fontWeight: "600", paddingVertical: 20 },

  /* ── Bus card extras (conservé pour BusDetailModal) ── */
  busCardPlateInline: { fontSize: 9, fontWeight: "700", color: "#374151", letterSpacing: 0.5 },
  busCardOccRow:    { flexDirection: "row", alignItems: "center", gap: 6,
                      paddingHorizontal: 14, paddingBottom: 10 },
  busCardOccTxt:    { fontSize: 10, fontWeight: "700", color: "#374151", minWidth: 60 },
  busCardOccBar:    { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.06)",
                      borderRadius: 2, overflow: "hidden" },
  busCardOccFill:   { height: 3, borderRadius: 2 },
  busCardOccPct:    { fontSize: 9, fontWeight: "800", color: "#374151", minWidth: 28, textAlign: "right" as any },
  busRow:         { flexDirection: "row", alignItems: "center", gap: 12,
                    paddingVertical: 13, paddingHorizontal: 14, marginBottom: 2,
                    backgroundColor: CARD, borderRadius: 12,
                    borderLeftWidth: 3, borderLeftColor: "transparent" },
  busRowName:     { fontSize: 13, fontWeight: "800", color: "#CBD5E1", letterSpacing: -0.2 },
  busRowRoute:    { fontSize: 11, color: "#374151", fontWeight: "600", marginTop: 1 },
  busRowSpeed:    { fontSize: 13, fontWeight: "900" },
  busRowSpeedBar: { height: 3, width: 48, backgroundColor: "rgba(255,255,255,0.07)",
                    borderRadius: 2, overflow: "hidden", marginTop: 3 },
  busRowSpeedFill:{ height: 3, borderRadius: 2 },
  busRowStatus:   { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
                    borderWidth: 1, flexShrink: 0 },
  busRowStatusTxt:{ fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  busRowIconBtn:  { padding: 6 },

  /* ── GRILLE BUS 2 COLONNES ───────────────────────────────────── */
  gridContent:  { padding: 12, gap: 10, paddingBottom: 24 },

  /* ── Bus card — pleine largeur (Zone 3) ────────────────── */
  busCard:              { backgroundColor: CARD, borderRadius: 14, overflow: "hidden",
                          borderWidth: 1, borderColor: BDR, marginBottom: 10,
                          ...(Platform.OS === "web"
                            ? { boxShadow: "0 2px 12px rgba(0,0,0,0.35)" }
                            : { elevation: 4, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8 }) },
  /* Ligne 1 header */
  busCardHeader:        { flexDirection: "row", alignItems: "flex-start",
                          paddingTop: 12, paddingBottom: 10, paddingHorizontal: 14, gap: 10 },
  busCardLeft:          { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8, minWidth: 0 },
  busCardTextBlock:     { flex: 1, minWidth: 0, gap: 2 },
  busCardName:          { fontSize: 14, fontWeight: "900", color: "#CBD5E1",
                          letterSpacing: -0.2, flexShrink: 1 },
  busCardRoute:         { fontSize: 11, color: "#374151", fontWeight: "600", flexShrink: 1 },
  busCardRight:         { alignItems: "flex-end", gap: 4, flexShrink: 0, minWidth: 60 },
  busCardSpeedBlock:    { alignItems: "flex-end", gap: 3 },
  busCardSpeedNum:      { fontSize: 15, fontWeight: "900", letterSpacing: -0.5 },
  busCardSpeedUnit:     { fontSize: 9, fontWeight: "600", color: "#374151" },
  busCardSpeedBar:      { width: 52, height: 3, backgroundColor: "rgba(255,255,255,0.07)",
                          borderRadius: 2, overflow: "hidden" },
  busCardSpeedFill:     { height: 3, borderRadius: 2 },
  busCardStatusBadge:   { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
                          borderWidth: 1, flexShrink: 0, maxWidth: 90 },
  busCardStatusTxt:     { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  /* Ligne 3 alerte */
  busCardAlertStrip:    { flexDirection: "row", alignItems: "center", gap: 7,
                          paddingHorizontal: 14, paddingVertical: 8,
                          backgroundColor: `${CRIT}10`,
                          borderTopWidth: 1, borderTopColor: `${CRIT}20` },
  busCardAlertTxt:      { flex: 1, minWidth: 0, fontSize: 11, color: "#F87171",
                          fontWeight: "600", flexShrink: 1 },
  busCardAlertAction:   { fontSize: 10, fontWeight: "900", color: CRIT,
                          letterSpacing: 0.5, flexShrink: 0 },
  /* Ligne 4 caméra */
  busCardCamWrap:       { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  busCardCamBar:        { flexDirection: "row", alignItems: "center", gap: 7,
                          paddingHorizontal: 12, paddingVertical: 7,
                          backgroundColor: "rgba(0,0,0,0.3)" },
  busCardCamLabel:      { fontSize: 9, fontWeight: "900", color: OK, letterSpacing: 1 },
  busCardCamView:       { height: 120, overflow: "hidden" },
  /* Carte critique — teinte rouge subtile + ombre plus forte */
  busCardCritical: { backgroundColor: "#130812",
                     ...(Platform.OS === "web"
                       ? { boxShadow: `0 0 0 1px ${CRIT}28, 0 4px 20px rgba(239,68,68,0.15)` }
                       : { elevation: 6, shadowColor: CRIT, shadowOpacity: 0.25, shadowRadius: 12 }) },
  /* Bandeau de tête critique */
  critBand:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2,
                     paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: `${CRIT}25` },
  critDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: CRIT, flexShrink: 0 },
  critLabel:       { flex: 1, fontSize: 10, fontWeight: "900", color: CRIT, letterSpacing: 1.2 },
  /* Étape flux opérationnel */
  flowStep:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                     borderWidth: 1, flexShrink: 0 },
  flowStepTxt:     { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  /* Bouton TRAITER — prioritaire, pleine largeur */
  critTraiterBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                     backgroundColor: CRIT, borderRadius: 10, paddingVertical: 13,
                     ...(Platform.OS === "web"
                       ? { boxShadow: `0 4px 14px ${CRIT}50` }
                       : { elevation: 4, shadowColor: CRIT, shadowOpacity: 0.4, shadowRadius: 8 }) },
  critTraiterTxt:  { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.4 },
  /* Boutons secondaires — discrètes, en ligne */
  secBtn:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                     gap: 5, paddingVertical: 9, borderRadius: 9,
                     backgroundColor: "rgba(255,255,255,0.04)",
                     borderWidth: 1, borderColor: BDR },
  secBtnTxt:       { fontSize: 11, fontWeight: "700", color: "#64748B" },

  busCardIcon:     { width: 36, height: 36, borderRadius: 10,
                     justifyContent: "center", alignItems: "center",
                     borderWidth: 1, flexShrink: 0 },
  busCardPlate:    { fontSize: 10, color: "#475569", fontWeight: "600", marginTop: 1, letterSpacing: 0.5 },
  busStatusBadge:  { flexDirection: "row", alignItems: "center", gap: 5,
                     borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
                     borderWidth: 1, flexShrink: 0 },
  busStatusTxt:    { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  busRouteRow:     { flexDirection: "row", alignItems: "center", gap: 7,
                     backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 8,
                     paddingHorizontal: 10, paddingVertical: 7,
                     borderWidth: 1, borderColor: BDR, marginTop: 8 },
  busRouteTxt:     { flex: 1, fontSize: 12, fontWeight: "700", color: "#94A3B8", letterSpacing: -0.2 },
  busDeptTime:     { fontSize: 11, fontWeight: "900", color: "#475569", flexShrink: 0 },
  busSpeedRow:     { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  busSpeedNum:     { fontSize: 22, fontWeight: "900", letterSpacing: -1, lineHeight: 26, minWidth: 46 },
  busSpeedUnit:    { fontSize: 10, fontWeight: "700", marginBottom: 2 },
  busSpeedBarWrap: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.07)",
                     borderRadius: 3, overflow: "hidden" },
  busSpeedBar:     { height: 4, borderRadius: 3 },
  busSpeedLimit:   { fontSize: 9, fontWeight: "800", flexShrink: 0, letterSpacing: 0.4 },
  busOccRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  busOccLabel:     { fontSize: 11, fontWeight: "700", color: "#475569", minWidth: 60 },
  busOccBarWrap:   { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.07)",
                     borderRadius: 3, overflow: "hidden" },
  busOccFill:      { height: 4, borderRadius: 3 },
  busOccPct:       { fontSize: 11, fontWeight: "900", minWidth: 34, textAlign: "right" as any },
  busAlertBanner:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10,
                     backgroundColor: `${CRIT}12`, borderRadius: 8,
                     paddingHorizontal: 10, paddingVertical: 8,
                     borderWidth: 1, borderColor: `${CRIT}25` },
  busAlertBannerTxt:{ flex: 1, fontSize: 11, color: CRIT, fontWeight: "700" },
  busActions:      { flexDirection: "row", alignItems: "center", marginTop: 12,
                     borderTopWidth: 1, borderTopColor: BDR, paddingTop: 10, gap: 0 },
  busActBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                     gap: 5, paddingVertical: 7, borderRadius: 8 },
  busActTxt:       { fontSize: 11, fontWeight: "700", color: "#64748B" },
  busActDiv:       { width: 1, height: 20, backgroundColor: BDR },

  /* ── BANDE CAMÉRAS (au-dessus de la grille bus) ───────────────── */
  camStrip:       { backgroundColor: "#080C12", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  camStripHdr:    { flexDirection: "row", alignItems: "center", gap: 8,
                    paddingHorizontal: 14, paddingVertical: 9 },
  camStripTitle:  { flex: 1, color: "#94A3B8", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  camStripCount:  { color: "#64748B", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
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
