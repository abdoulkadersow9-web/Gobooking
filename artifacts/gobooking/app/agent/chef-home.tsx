/**
 * Chef d'Agence — Page d'accueil
 * Structure : A. Header  B. Urgences  C. Supervision  D. Accès rapides
 * Principe   : 1 info = 1 seule fois · max 5 items · zéro répétition
 */
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
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth }   from "@/context/AuthContext";
import { useOnSync } from "@/context/SyncContext";
import { apiFetch }  from "@/utils/api";

/* ─── Tokens ─────────────────────────────────────────────── */
const C = {
  bg:        "#F5F6FA",
  white:     "#FFFFFF",
  indigo:    "#4F46E5",
  indigo2:   "#3730A3",
  text:      "#111827",
  textSub:   "#6B7280",
  border:    "#E5E7EB",
  red:       "#DC2626",
  redSoft:   "#FEF2F2",
  amber:     "#D97706",
  amberSoft: "#FFFBEB",
  green:     "#059669",
  greenSoft: "#ECFDF5",
  purple:    "#7C3AED",
  purpleSoft:"#F5F3FF",
  blue:      "#1D4ED8",
  blueSoft:  "#EFF6FF",
};

/* ─── Types ───────────────────────────────────────────────── */
type DashData  = {
  agence: { id: string; name: string; city: string } | null;
  stats:  { tripsToday: number; agentsActive: number; passengersToday: number };
};
type Trip = {
  id: string; from_city: string; to_city: string; date: string;
  departure_time: string; status: string; bus_name: string;
  total_seats: number; passenger_count: number;
};
type AgenceStats = {
  colis:   { aValider: number; enGare: number; enTransit: number };
  alertes: { active: number };
  revenue: { today: { billets: number; bagages: number; colis: number; net: number } };
  bordereaux_no_fuel?: number;
};

/* ─── Carte action navigation (chef valide, ne manipule pas) ─ */
function ActionCard({
  icon, label, sub, accent, softBg, badge, onPress,
}: {
  icon: string; label: string; sub: string;
  accent: string; softBg: string; badge: number; onPress: () => void;
}) {
  return (
    <Pressable style={[s.actionCard, { borderColor: softBg }]} onPress={onPress}>
      <View style={[s.actionIcon, { backgroundColor: softBg }]}>
        <Feather name={icon as any} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.actionLabel}>{label}</Text>
        <Text style={s.actionSub}>{sub}</Text>
      </View>
      <View style={[s.actionBadge, { backgroundColor: accent }]}>
        <Text style={s.actionBadgeText}>{badge}</Text>
      </View>
      <Feather name="chevron-right" size={15} color={C.textSub} />
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════ */
export default function ChefHome() {
  const { user, token, logout, logoutIfActiveToken } = useAuth();
  const auth = token ?? "";

  const [dash, setDash]           = useState<DashData | null>(null);
  const [trips, setTrips]         = useState<Trip[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [caisses, setCaisses]     = useState(0);
  const [agStats, setAgStats]     = useState<AgenceStats | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [lastSync, setLastSync]   = useState<Date | null>(null);

  /* ── données dérivées ── */
  const firstName = user?.name?.split(" ")[0] ?? "Chef";
  const agence    = dash?.agence;
  const stats     = dash?.stats;
  const today     = new Date().toISOString().slice(0, 10);
  const todayT    = trips.filter(t => t.date === today && t.status !== "cancelled");
  const upcoming  = trips.filter(t => t.date > today && t.status !== "cancelled").slice(0, 3);
  const active    = todayT.filter(t => ["boarding","en_route","in_progress"].includes(t.status)).slice(0, 2);
  const sched     = todayT.filter(t => t.status === "scheduled").slice(0, 3);
  const done      = todayT.filter(t => ["arrived","completed"].includes(t.status)).length;
  const rev       = agStats?.revenue.today;
  const alerts    = agStats?.alertes.active ?? 0;
  const colisAV   = agStats?.colis.aValider ?? 0;
  const noFuel    = agStats?.bordereaux_no_fuel ?? 0;
  const syncTime  = lastSync ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}` : null;

  /* ── chargement ── */
  const load = useCallback(async () => {
    if (!auth) { setLoading(false); return; }
    if (user?.agentRole && user.agentRole !== "chef_agence") {
      setLoading(false);
      setError(`Rôle ${user.agentRole} — accès réservé au chef d'agence.`);
      return;
    }
    setError(null);
    try {
      const [d, t, cs, as_] = await Promise.all([
        apiFetch<DashData>("/agent/chef/dashboard", { token: auth }),
        apiFetch<{ trips: Trip[] }>("/agent/chef/trips", { token: auth }),
        apiFetch<any>("/agent/chef/caisses", { token: auth }),
        apiFetch<AgenceStats>("/agent/chef/stats-agence", { token: auth }).catch(() => null),
      ]);
      setDash(d);
      setTrips(t.trips ?? []);
      setCaisses(cs?.stats?.pending ?? 0);
      if (as_) setAgStats(as_);
      setLastSync(new Date());
    } catch (e: any) {
      if (e?.httpStatus === 401) { logoutIfActiveToken(auth); return; }
      setError(e?.message ?? "Impossible de charger.");
    } finally { setLoading(false); setRefresh(false); }
  }, [auth, user, logoutIfActiveToken]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);
  useOnSync(["boarding", "ticket", "reservation"], load);

  /* ── animation dot live ── */
  const ND    = Platform.OS !== "web";
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.2, duration: 800, useNativeDriver: ND }),
      Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: ND }),
    ]));
    loop.start(); return () => loop.stop();
  }, [pulse, ND]);

  const onRefresh = useCallback(() => { setRefresh(true); load(); }, [load]);

  /* ── Loading ── */
  if (loading) return (
    <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:C.bg }}>
      <ActivityIndicator size="large" color={C.indigo} />
      <Text style={{ marginTop:12, color:C.indigo }}>Chargement…</Text>
    </SafeAreaView>
  );

  /* ── Error ── */
  if (error) return (
    <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:C.bg, padding:32 }}>
      <Feather name="alert-circle" size={44} color={C.red} />
      <Text style={{ marginTop:16, fontSize:16, fontWeight:"800", color:C.text, textAlign:"center" }}>{error}</Text>
      <Pressable onPress={() => { setLoading(true); load(); }}
        style={{ marginTop:20, backgroundColor:C.indigo, borderRadius:12, paddingHorizontal:28, paddingVertical:13 }}>
        <Text style={{ color:"#fff", fontWeight:"700" }}>Réessayer</Text>
      </Pressable>
    </SafeAreaView>
  );

  /* ════════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.indigo2} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.indigo} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >

        {/* ══ A. HEADER ══════════════════════════════════════ */}
        <LinearGradient colors={[C.indigo2, C.indigo, "#818CF8"]} style={s.header}>
          {/* Greeting */}
          <View style={s.hRow}>
            <View style={{ flex:1 }}>
              <Text style={s.hTitle}>Bonjour, {firstName} 👋</Text>
              <View style={{ flexDirection:"row", alignItems:"center", gap:5, marginTop:5 }}>
                <Feather name="map-pin" size={11} color="#A5B4FC" />
                <Text style={s.hSub}>{agence ? `${agence.name} — ${agence.city}` : "Chef d'Agence"}</Text>
              </View>
            </View>
            {/* Logout + Live pill */}
            <View style={{ alignItems:"flex-end", gap:8 }}>
              <Pressable
                onPress={() => logout?.()}
                style={{ width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.12)", alignItems:"center", justifyContent:"center" }}
                hitSlop={8}
              >
                <Feather name="log-out" size={17} color="rgba(255,255,255,0.85)" />
              </Pressable>
              <View style={s.livePill}>
                <Animated.View style={[s.liveDot, { opacity: pulse }]} />
                <Text style={s.liveText}>{syncTime ?? "–"}</Text>
              </View>
            </View>
          </View>

          {/* KPIs 4 tiles */}
          <View style={s.kpiGrid}>
            {[
              { v: stats?.tripsToday ?? 0,   l:"Départs",   c:"#818CF8", bg:"rgba(129,140,248,.2)" },
              { v: stats?.agentsActive ?? 0,  l:"Agents",    c:"#6EE7B7", bg:"rgba(110,231,183,.2)" },
              { v: caisses,                   l:"À valider", c:"#FCD34D", bg:"rgba(252,211,77,.2)"  },
              { v: colisAV,                   l:"Colis",     c:"#C4B5FD", bg:"rgba(196,181,253,.2)" },
            ].map((k, i) => (
              <View key={i} style={[s.kpiCard, { backgroundColor: k.bg }]}>
                <Text style={[s.kpiVal, { color: k.c }]}>{k.v}</Text>
                <Text style={s.kpiLabel}>{k.l}</Text>
              </View>
            ))}
          </View>

          {/* Revenue strip */}
          {rev && (
            <View style={s.revStrip}>
              {[
                { l:"Billets",  v:rev.billets, c:"#93C5FD" },
                { l:"Bagages",  v:rev.bagages, c:"#6EE7B7" },
                { l:"Colis",    v:rev.colis,   c:"#C4B5FD" },
              ].map((r, i) => (
                <React.Fragment key={i}>
                  <View style={{ flex:1, alignItems:"center" }}>
                    <Text style={s.revLabel}>{r.l}</Text>
                    <Text style={[s.revVal, { color: r.c }]}>{r.v > 0 ? `${Math.round(r.v/1000)}k` : "—"}</Text>
                  </View>
                  <View style={s.revDiv} />
                </React.Fragment>
              ))}
              <View style={{ flex:1.3, alignItems:"center" }}>
                <Text style={s.revLabel}>NET / JOUR</Text>
                <Text style={[s.revVal, { fontSize:16, color: rev.net >= 0 ? "#4ADE80" : "#FCA5A5" }]}>
                  {rev.net >= 0 ? "+" : ""}{Math.round(rev.net/1000)}k
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>

        <View style={s.body}>

          {/* ══ B. URGENCES & VALIDATIONS ═════════════════════
              Alertes + Caisses + Colis + Carburant
              Tout en une seule section, sans répétition
          ════════════════════════════════════════════════════ */}
          <Text style={s.sectionTitle}>Urgences & validations</Text>

          {/* Alertes signalées */}
          {alerts > 0 && (
            <Pressable
              style={s.alertBanner}
              onPress={() => router.push({ pathname:"/agent/chef-trips", params:{ tab:"alertes" } } as never)}
            >
              <View style={s.alertIconBox}>
                <Feather name="alert-triangle" size={16} color={C.red} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.alertTitle}>{alerts} alerte{alerts > 1 ? "s" : ""} en attente</Text>
                <Text style={s.alertSub}>Signalements agents à consulter</Text>
              </View>
              <View style={s.alertCta}>
                <Text style={{ color:"#fff", fontSize:11, fontWeight:"800" }}>Consulter</Text>
              </View>
            </Pressable>
          )}

          {/* Caisses à valider */}
          <View style={{ marginBottom:10 }}>
            <ActionCard
              icon="dollar-sign"
              label={`${caisses} caisse${caisses !== 1 ? "s" : ""} à valider`}
              sub="Soumissions agents en attente d'approbation"
              accent={C.amber} softBg={C.amberSoft} badge={caisses}
              onPress={() => router.push({ pathname:"/agent/chef-trips", params:{ tab:"caisses" } } as never)}
            />
          </View>

          {/* Colis à valider */}
          {colisAV > 0 && (
            <View style={{ marginBottom:10 }}>
              <ActionCard
                icon="package"
                label={`${colisAV} colis à valider`}
                sub="En gare · en transit · arrivés"
                accent={C.purple} softBg={C.purpleSoft} badge={colisAV}
                onPress={() => router.push("/agent/colis" as never)}
              />
            </View>
          )}

          {/* Carburant manquant — synthèse uniquement, pas de liste */}
          {noFuel > 0 && (
            <Pressable
              style={s.fuelCard}
              onPress={() => router.push({ pathname:"/agent/chef-trips", params:{ tab:"bordereaux" } } as never)}
            >
              <View style={[s.actionIcon, { backgroundColor:C.redSoft }]}>
                <Feather name="zap" size={18} color={C.red} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.actionLabel}>{noFuel} départ{noFuel > 1 ? "s" : ""} sans carburant</Text>
                <Text style={s.actionSub}>Résultat net non calculable — gérer via Bordereaux</Text>
              </View>
              <View style={[s.alertCta, { backgroundColor:C.red }]}>
                <Text style={{ color:"#fff", fontSize:11, fontWeight:"800" }}>Gérer →</Text>
              </View>
            </Pressable>
          )}

          <View style={s.divider} />

          {/* ══ C. SUPERVISION ════════════════════════════════
              Lecture seule — pas d'actions terrain
          ════════════════════════════════════════════════════ */}
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <Text style={s.sectionTitle}>Supervision des départs</Text>
            <Pressable onPress={() => router.push("/agent/chef-trips" as never)}>
              <Text style={{ fontSize:12, color:C.indigo, fontWeight:"700" }}>Voir tout →</Text>
            </Pressable>
          </View>

          {/* Status pills */}
          <View style={s.statusRow}>
            {[
              { l:"En cours",  n: active.length,          c:C.green,  bg:C.greenSoft  },
              { l:"Programme", n: sched.length,            c:C.amber,  bg:C.amberSoft  },
              { l:"Terminés",  n: done,                    c:C.textSub,bg:C.border     },
            ].map((p, i) => (
              <View key={i} style={[s.statusPill, { backgroundColor: p.bg }]}>
                <Text style={[s.statusNum, { color: p.c }]}>{p.n}</Text>
                <Text style={s.statusLabel}>{p.l}</Text>
              </View>
            ))}
          </View>

          {/* Actifs (max 2) */}
          {active.map(t => {
            const isBoarding = t.status === "boarding";
            const color      = isBoarding ? C.purple : C.green;
            const pct        = t.total_seats > 0 ? (t.passenger_count / t.total_seats) * 100 : 0;
            return (
              <View key={t.id} style={[s.activeCard, { borderColor:`${color}33` }]}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:10 }}>
                  <View style={[s.activeIcon, { backgroundColor:`${color}18` }]}>
                    <Feather name={isBoarding ? "check-square" : "navigation"} size={14} color={color} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.activeRoute}>{t.from_city} → {t.to_city}</Text>
                    <Text style={[s.activeStatus, { color }]}>
                      {isBoarding ? "Embarquement" : "En route"} · {t.departure_time}
                    </Text>
                  </View>
                  <Text style={s.activePax}>
                    {t.passenger_count}<Text style={{ fontSize:11, color:C.textSub, fontWeight:"400" }}>/{t.total_seats}</Text>
                  </Text>
                </View>
                <View style={s.bar}>
                  <View style={[s.barFill, { width:`${Math.min(100,pct)}%` as any, backgroundColor:pct>=90 ? C.red : color }]} />
                </View>
              </View>
            );
          })}

          {/* Programme compact (max 3) */}
          {(sched.length > 0 || upcoming.length > 0) && (
            <View style={s.schedTable}>
              {[...sched, ...upcoming].slice(0, 4).map((t, i) => (
                <View key={t.id} style={[s.schedRow, i === 0 && { borderTopWidth:0 }]}>
                  <Feather name="clock" size={12} color={C.amber} />
                  <View style={{ flex:1 }}>
                    <Text style={s.schedRoute}>{t.from_city} → {t.to_city}</Text>
                    <Text style={s.schedMeta}>{t.departure_time}{t.date !== today ? ` · ${t.date}` : ""}</Text>
                  </View>
                  <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                    <View style={s.miniBar}>
                      <View style={[s.miniBarFill, { width:`${(t.passenger_count/t.total_seats)*100}%` as any }]} />
                    </View>
                    <Text style={{ fontSize:10, color:C.textSub }}>{t.passenger_count}/{t.total_seats}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Aucun départ */}
          {todayT.length === 0 && upcoming.length === 0 && (
            <View style={s.empty}>
              <Feather name="calendar" size={22} color="#D1D5DB" />
              <Text style={{ color:"#9CA3AF", fontSize:13, marginTop:6 }}>Aucun départ programmé</Text>
            </View>
          )}

          <View style={s.divider} />

          {/* ══ D. ACCÈS RAPIDES ══════════════════════════════ */}
          <Text style={s.sectionTitle}>Accès rapides</Text>
          <View style={s.quickGrid}>
            {[
              { icon:"bar-chart-2", label:"Rapports",     c:C.indigo,  bg:"#EEF2FF",     to:"/agent/rapport"     },
              { icon:"file-text",   label:"Bordereaux",   c:C.blue,    bg:C.blueSoft,    to:"/agent/chef-trips"  },
              { icon:"users",       label:"Mes agents",   c:C.green,   bg:C.greenSoft,   to:"/agent/chef-trips"  },
              { icon:"trending-up", label:"Statistiques", c:C.purple,  bg:C.purpleSoft,  to:"/agent/rapport"     },
            ].map((a, i) => (
              <Pressable key={i} style={s.quickCard} onPress={() => router.push(a.to as never)}>
                <View style={[s.quickIcon, { backgroundColor:a.bg }]}>
                  <Feather name={a.icon as any} size={16} color={a.c} />
                </View>
                <Text style={s.quickLabel}>{a.label}</Text>
                <Feather name="chevron-right" size={13} color={C.textSub} />
              </Pressable>
            ))}
          </View>

        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable style={s.fab} onPress={() => router.push("/agent/chef-trips" as never)}>
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */
const s = StyleSheet.create({
  /* Header */
  header: { paddingHorizontal:18, paddingTop:16, paddingBottom:20 },
  hRow:   { flexDirection:"row", alignItems:"flex-start", marginBottom:16 },
  hTitle: { fontSize:21, fontWeight:"900", color:"#fff" },
  hSub:   { fontSize:12, color:"#A5B4FC" },
  livePill:{ flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"rgba(0,0,0,0.22)", borderRadius:20, paddingHorizontal:12, paddingVertical:6 },
  liveDot: { width:7, height:7, borderRadius:3.5, backgroundColor:"#4ADE80" },
  liveText:{ fontSize:11, color:"#C7D2FE", fontWeight:"600" },
  kpiGrid: { flexDirection:"row", gap:8, marginBottom:14 },
  kpiCard: { flex:1, borderRadius:13, paddingVertical:11, paddingHorizontal:6, alignItems:"center", gap:3 },
  kpiVal:  { fontSize:26, fontWeight:"900", lineHeight:28 },
  kpiLabel:{ fontSize:8.5, color:"rgba(255,255,255,0.65)", fontWeight:"700", textAlign:"center" },
  revStrip:{ flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,255,255,0.1)", borderRadius:13, paddingHorizontal:14, paddingVertical:11 },
  revLabel:{ fontSize:8.5, color:"rgba(255,255,255,0.5)", fontWeight:"700", marginBottom:3, textTransform:"uppercase", letterSpacing:0.5 },
  revVal:  { fontSize:14, fontWeight:"800" },
  revDiv:  { width:1, height:26, backgroundColor:"rgba(255,255,255,0.15)" },

  /* Body */
  body:        { paddingHorizontal:16, paddingTop:24 },
  sectionTitle:{ fontSize:16, fontWeight:"900", color:C.text, marginBottom:14 },
  divider:     { height:1, backgroundColor:C.border, marginVertical:26 },

  /* Alerte banner */
  alertBanner: { flexDirection:"row", alignItems:"center", gap:12, backgroundColor:C.redSoft, borderWidth:1.5, borderColor:"#FCA5A5", borderRadius:16, paddingHorizontal:16, paddingVertical:13, marginBottom:10 },
  alertIconBox:{ width:40, height:40, borderRadius:12, backgroundColor:"#FECACA", alignItems:"center", justifyContent:"center" },
  alertTitle:  { fontSize:14, fontWeight:"800", color:"#991B1B" },
  alertSub:    { fontSize:11, color:C.red, marginTop:3 },
  alertCta:    { backgroundColor:C.red, borderRadius:10, paddingHorizontal:13, paddingVertical:6 },

  /* Action cards */
  actionCard:  { flexDirection:"row", alignItems:"center", gap:14, backgroundColor:C.white, borderRadius:16, paddingHorizontal:16, paddingVertical:14, borderWidth:1.5 },
  actionIcon:  { width:44, height:44, borderRadius:13, alignItems:"center", justifyContent:"center" },
  actionLabel: { fontSize:14, fontWeight:"800", color:C.text },
  actionSub:   { fontSize:11, color:C.textSub, marginTop:3 },
  actionBadge: { borderRadius:12, minWidth:34, height:34, alignItems:"center", justifyContent:"center", paddingHorizontal:10 },
  actionBadgeText: { color:"#fff", fontWeight:"900", fontSize:16 },

  /* Fuel card */
  fuelCard: { flexDirection:"row", alignItems:"center", gap:14, backgroundColor:C.white, borderRadius:16, paddingHorizontal:16, paddingVertical:14, borderWidth:1.5, borderColor:"#FEE2E2" },

  /* Status pills */
  statusRow:  { flexDirection:"row", gap:8, marginBottom:14 },
  statusPill: { flex:1, borderRadius:12, paddingVertical:10, alignItems:"center" },
  statusNum:  { fontSize:22, fontWeight:"900", lineHeight:24 },
  statusLabel:{ fontSize:9, color:C.textSub, marginTop:2, fontWeight:"600" },

  /* Active trips */
  activeCard:   { backgroundColor:C.white, borderRadius:16, padding:13, marginBottom:8, borderWidth:2 },
  activeIcon:   { width:36, height:36, borderRadius:11, alignItems:"center", justifyContent:"center" },
  activeRoute:  { fontSize:13, fontWeight:"800", color:C.text },
  activeStatus: { fontSize:11, fontWeight:"700", marginTop:2 },
  activePax:    { fontSize:17, fontWeight:"900", color:C.text },
  bar:          { height:3, backgroundColor:"#F3F4F6", borderRadius:2, marginTop:10, overflow:"hidden" },
  barFill:      { height:3, borderRadius:2 },

  /* Schedule table */
  schedTable: { backgroundColor:C.white, borderRadius:14, borderWidth:1, borderColor:C.border, overflow:"hidden" },
  schedRow:   { flexDirection:"row", alignItems:"center", gap:10, paddingHorizontal:14, paddingVertical:10, borderTopWidth:1, borderColor:C.border },
  schedRoute: { fontSize:12, fontWeight:"700", color:C.text },
  schedMeta:  { fontSize:10, color:C.textSub },
  miniBar:    { width:38, height:3, backgroundColor:"#E5E7EB", borderRadius:2, overflow:"hidden" },
  miniBarFill:{ height:3, backgroundColor:C.indigo, borderRadius:2 },

  /* Empty */
  empty: { backgroundColor:C.white, borderRadius:14, padding:24, alignItems:"center", borderWidth:1, borderColor:C.border },

  /* Quick access */
  quickGrid: { flexDirection:"row", flexWrap:"wrap", gap:10 },
  quickCard: { width:"47.5%", flexDirection:"row", alignItems:"center", gap:12, backgroundColor:C.white, borderRadius:14, paddingHorizontal:13, paddingVertical:14, borderWidth:1, borderColor:C.border },
  quickIcon: { width:38, height:38, borderRadius:11, alignItems:"center", justifyContent:"center" },
  quickLabel:{ fontSize:13, fontWeight:"700", color:C.text, flex:1 },

  /* FAB */
  fab: { position:"absolute", bottom:26, right:18, width:54, height:54, borderRadius:27, backgroundColor:C.indigo, justifyContent:"center", alignItems:"center", elevation:6 },
});
