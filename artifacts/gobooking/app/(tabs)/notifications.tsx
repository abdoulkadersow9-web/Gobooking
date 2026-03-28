import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ─── Types ──────────────────────────────────────────────────────── */
type NotifType = "parcel" | "trip" | "promo" | "system";

interface ApiNotif {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: { trackingRef?: string; status?: string } | null;
  read: boolean;
  created_at: string;
}

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  date: Date;
  read: boolean;
  trackingRef?: string;
}

/* ─── Status config for parcel notifications ─────────────────────── */
const PARCEL_CFG: Record<string, { icon: string; color: string; bg: string }> = {
  créé:       { icon: "package",      color: "#6366F1", bg: "#EEF2FF" },
  en_gare:    { icon: "home",         color: "#0284C7", bg: "#E0F2FE" },
  chargé_bus: { icon: "truck",        color: "#7C3AED", bg: "#F5F3FF" },
  en_transit: { icon: "navigation",   color: "#D97706", bg: "#FFFBEB" },
  arrivé:     { icon: "map-pin",      color: "#059669", bg: "#ECFDF5" },
  livré:      { icon: "check-circle", color: "#16A34A", bg: "#F0FDF4" },
};

const TYPE_CFG: Record<NotifType, { label: string; icon: string; color: string; bg: string }> = {
  parcel: { label: "Colis",   icon: "package",   color: "#7C3AED", bg: "#F5F3FF" },
  trip:   { label: "Trajet",  icon: "navigation", color: Colors.light.primary, bg: "#EEF2FF" },
  promo:  { label: "Promo",   icon: "tag",        color: "#D97706", bg: "#FFFBEB" },
  system: { label: "Système", icon: "bell",       color: "#0891B2", bg: "#ECFEFF" },
};

function getNotifCfg(notif: Notif) {
  if (notif.type === "parcel") {
    const status = (notif as any)._status as string | undefined;
    const cfg = status ? PARCEL_CFG[status] : null;
    if (cfg) return cfg;
  }
  const tc = TYPE_CFG[notif.type] ?? TYPE_CFG.system;
  return { icon: tc.icon, color: tc.color, bg: tc.bg };
}

/* ─── Demo data (shown when not logged in) ───────────────────────── */
const now = Date.now();
const DEMO: Notif[] = [
  { id: "d1", type: "parcel", title: "Colis en transit", message: "Votre colis GBX-A4F2-KM91 est en route vers Bouaké.", date: new Date(now - 2 * 3600000), read: false, trackingRef: "GBX-A4F2-KM91" },
  { id: "d2", type: "trip",   title: "Départ imminent",  message: "Votre bus Abidjan → Bouaké part dans 30 min.", date: new Date(now - 5 * 3600000), read: false },
  { id: "d3", type: "parcel", title: "Colis livré ✓",    message: "Votre colis GBX-B9C3-PL44 a été remis à destination.", date: new Date(now - 18 * 3600000), read: false, trackingRef: "GBX-B9C3-PL44" },
  { id: "d4", type: "parcel", title: "Colis reçu en gare", message: "Votre colis GBX-D5F8-MN33 est à la gare de départ.", date: new Date(now - 2 * 86400000), read: true, trackingRef: "GBX-D5F8-MN33" },
  { id: "d5", type: "promo",  title: "Offre week-end",   message: "10% de réduction. Code : GOBCI10. Valable jusqu'au dimanche.", date: new Date(now - 3 * 86400000), read: true },
];

/* ─── Helpers ─────────────────────────────────────────────────────── */
function mapApiNotif(n: ApiNotif): Notif & { _status?: string } {
  const type = (["parcel", "trip", "promo", "system"].includes(n.type) ? n.type : "system") as NotifType;
  return {
    id: n.id,
    type,
    title: n.title,
    message: n.message,
    date: new Date(n.created_at),
    read: n.read,
    trackingRef: n.data?.trackingRef,
    _status: n.data?.status,
  } as any;
}

function timeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH / 24);
  if (diffMin < 1)   return "À l'instant";
  if (diffMin < 60)  return `Il y a ${diffMin} min`;
  if (diffH   < 24)  return `Il y a ${diffH}h`;
  if (diffD   === 1) return "Hier";
  return `Il y a ${diffD} jours`;
}
function fmtDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

type Filter = "Tous" | "Colis" | "Trajet" | "Promo";
const FILTER_TYPE: Record<Filter, NotifType | null> = {
  Tous: null, Colis: "parcel", Trajet: "trip", Promo: "promo",
};

/* ═══════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════ */
export default function NotificationsScreen() {
  const insets  = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad  = Platform.OS === "web" ? 24 : insets.top;
  const botPad  = Platform.OS === "web" ? 34 : insets.bottom;

  const [items, setItems]         = useState<Notif[]>(DEMO);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefresh]  = useState(false);
  const [filter, setFilter]       = useState<Filter>("Tous");
  const [isReal, setIsReal]       = useState(false);

  const fadeAnims = useRef<Map<string, Animated.Value>>(new Map()).current;
  function getFade(id: string) {
    if (!fadeAnims.has(id)) fadeAnims.set(id, new Animated.Value(0));
    return fadeAnims.get(id)!;
  }

  /* ── Load real notifications ── */
  const load = useCallback(async () => {
    if (!token) { setItems(DEMO); setIsReal(false); return; }
    try {
      const data = await apiFetch<ApiNotif[]>("/notifications", { token });
      const mapped = data.map(mapApiNotif);
      setItems(mapped.length > 0 ? mapped : DEMO);
      setIsReal(mapped.length > 0);

      mapped.forEach((n, i) => {
        const anim = getFade(n.id);
        anim.setValue(0);
        Animated.timing(anim, {
          toValue: 1, duration: 300, delay: i * 40, useNativeDriver: true,
        }).start();
      });
    } catch {
      setItems(DEMO);
      setIsReal(false);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load();
    const poll = setInterval(load, 30000);
    return () => clearInterval(poll);
  }, [load]);

  /* ── Actions ── */
  const markAllRead = async () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    if (token && isReal) {
      apiFetch("/notifications/read-all", { token, method: "PATCH" }).catch(() => {});
    }
  };

  const handlePress = async (notif: Notif) => {
    setItems(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    if (token && isReal) {
      apiFetch(`/notifications/${notif.id}/read`, { token, method: "PATCH" }).catch(() => {});
    }
    if (notif.trackingRef) {
      router.push({ pathname: "/client/colis-suivi", params: { ref: notif.trackingRef } });
    }
  };

  const unread = items.filter(n => !n.read).length;

  const displayed = items.filter(n => {
    const tf = FILTER_TYPE[filter];
    return tf === null || n.type === tf;
  });

  const counts: Record<Filter, number> = {
    Tous: items.length,
    Colis: items.filter(n => n.type === "parcel").length,
    Trajet: items.filter(n => n.type === "trip").length,
    Promo: items.filter(n => n.type === "promo").length,
  };

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <View style={[S.root, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={S.header}>
        <View style={S.headerLeft}>
          <Text style={S.headerTitle}>Notifications</Text>
          <Text style={S.headerSub}>
            {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}
          </Text>
        </View>
        <View style={S.headerRight}>
          {loading && <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" style={{ marginRight: 8 }} />}
          {unread > 0 && (
            <TouchableOpacity style={S.markAllBtn} onPress={markAllRead}>
              <Feather name="check-circle" size={14} color="white" />
              <Text style={S.markAllTxt}>Tout lire</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Filter chips */}
      <View style={S.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterScroll}>
          {(["Tous", "Colis", "Trajet", "Promo"] as Filter[]).map(f => {
            const active = filter === f;
            return (
              <Pressable key={f} style={[S.chip, active && S.chipActive]} onPress={() => setFilter(f)}>
                <Text style={[S.chipTxt, active && S.chipTxtActive]}>{f}</Text>
                <View style={[S.chipBadge, active && S.chipBadgeActive]}>
                  <Text style={[S.chipBadgeTxt, active && S.chipBadgeTxtActive]}>{counts[f]}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={[S.list, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} colors={[Colors.light.primary]} />}
      >
        {displayed.length === 0 ? (
          <View style={S.empty}>
            <View style={S.emptyIcon}>
              <Feather name="bell-off" size={36} color={Colors.light.primary} />
            </View>
            <Text style={S.emptyTitle}>Aucune notification</Text>
            <Text style={S.emptyDesc}>Vos alertes apparaîtront ici</Text>
          </View>
        ) : (
          displayed.map((notif, idx) => {
            const prev = displayed[idx - 1];
            const showDate = !prev || fmtDate(prev.date) !== fmtDate(notif.date);
            const cfg = getNotifCfg(notif as any);
            const typeCfg = TYPE_CFG[notif.type] ?? TYPE_CFG.system;
            const isParcel = notif.type === "parcel" && notif.trackingRef;
            const fadeAnim = getFade(notif.id);

            return (
              <Animated.View key={notif.id} style={{ opacity: isReal ? fadeAnim : 1 }}>
                {showDate && <Text style={S.dateSep}>{fmtDate(notif.date)}</Text>}

                <Pressable
                  style={({ pressed }) => [
                    S.card,
                    !notif.read && S.cardUnread,
                    pressed && S.cardPressed,
                  ]}
                  onPress={() => handlePress(notif)}
                >
                  {!notif.read && <View style={[S.strip, { backgroundColor: cfg.color }]} />}

                  <View style={[S.iconWrap, { backgroundColor: cfg.bg }]}>
                    <Feather name={cfg.icon as any} size={22} color={cfg.color} />
                  </View>

                  <View style={S.content}>
                    <View style={S.cardTop}>
                      <View style={[S.typePill, { backgroundColor: typeCfg.bg }]}>
                        <Text style={[S.typePillTxt, { color: cfg.color }]}>{typeCfg.label}</Text>
                      </View>
                      <Text style={S.timeAgo}>{timeAgo(notif.date)}</Text>
                    </View>

                    <View style={S.titleRow}>
                      <Text style={[S.title, !notif.read && S.titleUnread]} numberOfLines={1}>
                        {notif.title}
                      </Text>
                      {!notif.read && <View style={[S.dot, { backgroundColor: cfg.color }]} />}
                    </View>

                    <Text style={S.msg} numberOfLines={2}>{notif.message}</Text>

                    {isParcel && (
                      <View style={S.actionRow}>
                        <Text style={[S.actionTxt, { color: cfg.color }]}>Voir le suivi</Text>
                        <Feather name="arrow-right" size={12} color={cfg.color} />
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20,
  },
  headerLeft:  { gap: 2 },
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.78)" },
  markAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  markAllTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },

  filterBar: { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  filterScroll: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#F1F5F9", borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  chipActive:     { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipTxt:        { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  chipTxtActive:  { color: "white" },
  chipBadge:      { backgroundColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, minWidth: 22, alignItems: "center" },
  chipBadgeActive: { backgroundColor: "rgba(255,255,255,0.28)" },
  chipBadgeTxt:   { fontSize: 11, fontFamily: "Inter_700Bold", color: "#64748B" },
  chipBadgeTxtActive: { color: "white" },

  list: { padding: 14, gap: 10 },
  dateSep: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#94A3B8",
    textTransform: "uppercase", letterSpacing: 0.8,
    marginTop: 8, marginBottom: 4, paddingHorizontal: 4,
  },

  card: {
    flexDirection: "row", gap: 12, backgroundColor: "white",
    borderRadius: 16, padding: 14, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardUnread: { backgroundColor: "#FAFBFF", borderWidth: 1, borderColor: "#C7D2FE" },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },

  strip: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
    borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
  },

  iconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center", flexShrink: 0 },

  content: { flex: 1, gap: 4 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  typePillTxt: { fontSize: 10, fontFamily: "Inter_700Bold" },
  timeAgo: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#334155" },
  titleUnread: { color: "#0F172A", fontFamily: "Inter_700Bold" },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },

  msg: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", lineHeight: 18 },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  actionTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8" },
});
