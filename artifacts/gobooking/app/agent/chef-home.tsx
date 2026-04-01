/**
 * Chef d'Agence — Page d'accueil
 *
 * Structure stricte (aucune répétition, aucun doublon) :
 *   A. Header   — Salutation + 4 KPIs + revenus du jour
 *   B. Urgences — Alertes agents + bordereaux sans carburant
 *   C. À valider — Caisses (action) + Colis (supervision lecture seule, JAMAIS /agent/colis)
 *   D. Supervision des départs — Statuts + trips actifs + programme
 *   E. Outils   — 4 raccourcis vers 4 destinations DISTINCTES
 *
 * Règle rôle : chef SUPERVISE et VALIDE — ne manipule JAMAIS les colis ni le terrain.
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

/* ─── Design tokens ──────────────────────────────────────── */
const C = {
  bg:         "#F5F6FA",
  white:      "#FFFFFF",
  indigo:     "#4F46E5",
  indigo2:    "#3730A3",
  text:       "#111827",
  textSub:    "#6B7280",
  border:     "#E5E7EB",
  red:        "#DC2626",
  redSoft:    "#FEF2F2",
  amber:      "#D97706",
  amberSoft:  "#FFFBEB",
  green:      "#059669",
  greenSoft:  "#ECFDF5",
  purple:     "#7C3AED",
  purpleSoft: "#F5F3FF",
  blue:       "#1D4ED8",
  blueSoft:   "#EFF6FF",
  teal:       "#0D9488",
  tealSoft:   "#F0FDFA",
};

/* ─── Types ───────────────────────────────────────────────── */
type DashData = {
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

/* ─── Composant : bannière urgence ───────────────────────── */
function UrgenceBanner({
  icon, title, sub, color, softBg, borderColor, ctaLabel, onPress,
}: {
  icon: string; title: string; sub: string;
  color: string; softBg: string; borderColor: string;
  ctaLabel: string; onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.urgenceBanner, { backgroundColor: softBg, borderColor }]}
      onPress={onPress}
    >
      <View style={[s.urgenceIcon, { backgroundColor: borderColor + "33" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.urgenceTitle, { color }]}>{title}</Text>
        <Text style={s.urgenceSub}>{sub}</Text>
      </View>
      <View style={[s.cta, { backgroundColor: color }]}>
        <Text style={s.ctaText}>{ctaLabel}</Text>
      </View>
    </Pressable>
  );
}

/* ─── Composant : carte validation (action chef) ─────────── */
function ValidationCard({
  icon, label, sub, accent, softBg, badge, readonly, onPress,
}: {
  icon: string; label: string; sub: string;
  accent: string; softBg: string; badge: number;
  readonly?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.valCard, { borderColor: softBg }]}
      onPress={onPress}
    >
      <View style={[s.valIcon, { backgroundColor: softBg }]}>
        <Feather name={icon as any} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.valLabel}>{label}</Text>
          {readonly && (
            <View style={[s.readonlyBadge, { backgroundColor: softBg }]}>
              <Feather name="eye" size={9} color={accent} />
              <Text style={[s.readonlyText, { color: accent }]}>Lecture</Text>
            </View>
          )}
        </View>
        <Text style={s.valSub}>{sub}</Text>
      </View>
      <View style={[s.countBubble, { backgroundColor: accent }]}>
        <Text style={s.countText}>{badge}</Text>
      </View>
      <Feather name="chevron-right" size={15} color={C.textSub} />
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════ */
export default function ChefHome() {
  const { user, token, logout, logoutIfActiveToken } = useAuth();
  const auth = token ?? "";

  const [dash, setDash]          = useState<DashData | null>(null);
  const [trips, setTrips]        = useState<Trip[]>([]);
  const [loading, setLoading]    = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [caisses, setCaisses]    = useState(0);
  const [agStats, setAgStats]    = useState<AgenceStats | null>(null);
  const [error, setError]        = useState<string | null>(null);
  const [lastSync, setLastSync]  = useState<Date | null>(null);

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
  const syncTime  = lastSync
    ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}`
    : null;

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
        apiFetch<DashData>("/agent/chef/dashboard",     { token: auth }),
        apiFetch<{ trips: Trip[] }>("/agent/chef/trips", { token: auth }),
        apiFetch<any>("/agent/chef/caisses",             { token: auth }),
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

  /* ── pulse dot live ── */
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

  /* ── chargement ── */
  if (loading) return (
    <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:C.bg }}>
      <ActivityIndicator size="large" color={C.indigo} />
      <Text style={{ marginTop:12, color:C.indigo, fontSize:14 }}>Chargement…</Text>
    </SafeAreaView>
  );

  /* ── erreur ── */
  if (error) return (
    <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:C.bg, padding:32 }}>
      <Feather name="alert-circle" size={44} color={C.red} />
      <Text style={{ marginTop:16, fontSize:16, fontWeight:"800", color:C.text, textAlign:"center" }}>{error}</Text>
      <Pressable
        onPress={() => { setLoading(true); load(); }}
        style={{ marginTop:20, backgroundColor:C.indigo, borderRadius:12, paddingHorizontal:28, paddingVertical:13 }}
      >
        <Text style={{ color:"#fff", fontWeight:"700" }}>Réessayer</Text>
      </Pressable>
    </SafeAreaView>
  );

  /* ── nombre total d'urgences (pour décider d'afficher la section) ── */
  const urgenceCount = (alerts > 0 ? 1 : 0) + (noFuel > 0 ? 1 : 0);

  /* ════════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.indigo2} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.indigo} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >

        {/* ══ A. HEADER ══════════════════════════════════════════ */}
        <LinearGradient colors={[C.indigo2, C.indigo, "#6366F1"]} style={s.header}>

          {/* Salutation + live pill */}
          <View style={s.hRow}>
            <View style={{ flex:1 }}>
              <Text style={s.hTitle}>Bonjour, {firstName} 👋</Text>
              <View style={{ flexDirection:"row", alignItems:"center", gap:5, marginTop:4 }}>
                <Feather name="map-pin" size={11} color="#A5B4FC" />
                <Text style={s.hSub}>
                  {agence ? `${agence.name} · ${agence.city}` : "Chef d'Agence"}
                </Text>
              </View>
            </View>
            <View style={{ alignItems:"flex-end", gap:8 }}>
              <Pressable
                onPress={() => logout?.()}
                style={s.logoutBtn}
                hitSlop={8}
              >
                <Feather name="log-out" size={17} color="rgba(255,255,255,0.85)" />
              </Pressable>
              <View style={s.livePill}>
                <Animated.View style={[s.liveDot, { opacity: pulse }]} />
                <Text style={s.liveText}>{syncTime ?? "––"}</Text>
              </View>
            </View>
          </View>

          {/* 4 KPIs — données de supervision (pas de liens vers modules terrain) */}
          <View style={s.kpiGrid}>
            {[
              { v: stats?.tripsToday    ?? 0, l:"Départs",   c:"#93C5FD", bg:"rgba(147,197,253,.18)" },
              { v: stats?.agentsActive  ?? 0, l:"Agents",    c:"#6EE7B7", bg:"rgba(110,231,183,.18)" },
              { v: caisses,                   l:"À valider", c:"#FCD34D", bg:"rgba(252,211,77,.18)"  },
              { v: colisAV,                   l:"Colis sup.", c:"#C4B5FD", bg:"rgba(196,181,253,.18)" },
            ].map((k, i) => (
              <View key={i} style={[s.kpiCard, { backgroundColor: k.bg }]}>
                <Text style={[s.kpiVal, { color: k.c }]}>{k.v}</Text>
                <Text style={s.kpiLabel}>{k.l}</Text>
              </View>
            ))}
          </View>

          {/* Revenus du jour */}
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
                    <Text style={[s.revVal, { color: r.c }]}>
                      {r.v > 0 ? `${Math.round(r.v/1000)}k` : "—"}
                    </Text>
                  </View>
                  {i < 2 && <View style={s.revDivider} />}
                </React.Fragment>
              ))}
              <View style={s.revDivider} />
              <View style={{ flex:1.2, alignItems:"center" }}>
                <Text style={s.revLabel}>NET JOUR</Text>
                <Text style={[s.revVal, { fontSize:15, color: rev.net >= 0 ? "#4ADE80" : "#FCA5A5" }]}>
                  {rev.net >= 0 ? "+" : ""}{Math.round(rev.net/1000)}k
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>

        <View style={s.body}>

          {/* ══ B. URGENCES ═══════════════════════════════════════
              Items en rouge/orange = DANGER immédiat
              Seule section avec couleur "alarme"
          ════════════════════════════════════════════════════════ */}
          {urgenceCount > 0 && (
            <>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: C.red }]} />
                <Text style={[s.sectionTitle, { color: C.red }]}>Urgences</Text>
                <View style={[s.sectionCount, { backgroundColor: C.redSoft }]}>
                  <Text style={[s.sectionCountText, { color: C.red }]}>{urgenceCount}</Text>
                </View>
              </View>

              {alerts > 0 && (
                <UrgenceBanner
                  icon="alert-triangle"
                  title={`${alerts} alerte${alerts > 1 ? "s" : ""} signalée${alerts > 1 ? "s" : ""}`}
                  sub="Signalements agents · à consulter immédiatement"
                  color={C.red}
                  softBg={C.redSoft}
                  borderColor="#FCA5A5"
                  ctaLabel="Consulter"
                  onPress={() => router.push("/agent/chef-trips" as never)}
                />
              )}

              {noFuel > 0 && (
                <UrgenceBanner
                  icon="zap"
                  title={`${noFuel} départ${noFuel > 1 ? "s" : ""} sans carburant`}
                  sub="Résultat net non calculable · saisie bordereaux requise"
                  color={C.amber}
                  softBg={C.amberSoft}
                  borderColor="#FDE68A"
                  ctaLabel="Gérer"
                  onPress={() => router.push({
                    pathname: "/agent/chef-trips",
                    params: { tab: "bordereaux" },
                  } as never)}
                />
              )}

              <View style={s.divider} />
            </>
          )}

          {/* ══ C. À VALIDER ══════════════════════════════════════
              Actions réservées au chef : valider caisses + superviser colis.
              ⚠️  Le chef ne navigue JAMAIS vers /agent/colis (module terrain).
              La supervision colis redirige vers chef-trips (lecture seule).
          ════════════════════════════════════════════════════════ */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: C.amber }]} />
            <Text style={s.sectionTitle}>À valider</Text>
          </View>

          <ValidationCard
            icon="dollar-sign"
            label={`${caisses} caisse${caisses !== 1 ? "s" : ""} à valider`}
            sub="Soumissions agents en attente d'approbation"
            accent={C.amber}
            softBg={C.amberSoft}
            badge={caisses}
            onPress={() => router.push({
              pathname: "/agent/chef-trips",
              params: { tab: "caisses" },
            } as never)}
          />

          <View style={{ height: 10 }} />

          {/* Colis : supervision UNIQUEMENT — chef voit le compte, ne traite pas */}
          <ValidationCard
            icon="package"
            label={`${colisAV} colis en attente`}
            sub="Vue de supervision · traitement par l'agent colis"
            accent={C.purple}
            softBg={C.purpleSoft}
            badge={colisAV}
            readonly
            onPress={() => router.push("/agent/chef-trips" as never)}
          />

          <View style={s.divider} />

          {/* ══ D. SUPERVISION DES DÉPARTS ════════════════════════
              Lecture seule — le chef observe, ne déclenche pas
          ════════════════════════════════════════════════════════ */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: C.green }]} />
            <Text style={s.sectionTitle}>Supervision des départs</Text>
            <Pressable
              style={{ marginLeft:"auto" }}
              onPress={() => router.push("/agent/chef-trips" as never)}
            >
              <Text style={{ fontSize:12, color:C.indigo, fontWeight:"700" }}>Tout voir →</Text>
            </Pressable>
          </View>

          {/* Pastilles statuts */}
          <View style={s.pillRow}>
            {[
              { l:"En cours",   n: active.length, c: C.green,   bg: C.greenSoft  },
              { l:"Programmés", n: sched.length,  c: C.amber,   bg: C.amberSoft  },
              { l:"Terminés",   n: done,           c: C.textSub, bg: C.border     },
            ].map((p, i) => (
              <View key={i} style={[s.pill, { backgroundColor: p.bg }]}>
                <Text style={[s.pillNum, { color: p.c }]}>{p.n}</Text>
                <Text style={s.pillLabel}>{p.l}</Text>
              </View>
            ))}
          </View>

          {/* Trips actifs (max 2) */}
          {active.map(t => {
            const boarding = t.status === "boarding";
            const color    = boarding ? C.purple : C.green;
            const pct      = t.total_seats > 0 ? (t.passenger_count / t.total_seats) * 100 : 0;
            return (
              <View key={t.id} style={[s.tripCard, { borderColor: color + "33" }]}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:10 }}>
                  <View style={[s.tripIcon, { backgroundColor: color + "18" }]}>
                    <Feather
                      name={boarding ? "user-check" : "navigation"}
                      size={14}
                      color={color}
                    />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.tripRoute}>{t.from_city} → {t.to_city}</Text>
                    <Text style={[s.tripStatus, { color }]}>
                      {boarding ? "Embarquement" : "En route"} · {t.departure_time}
                    </Text>
                  </View>
                  <Text style={s.tripPax}>
                    {t.passenger_count}
                    <Text style={{ fontSize:11, color:C.textSub, fontWeight:"400" }}>/{t.total_seats}</Text>
                  </Text>
                </View>
                <View style={s.tripBar}>
                  <View style={[
                    s.tripBarFill,
                    { width:`${Math.min(100,pct)}%` as any, backgroundColor: pct>=90 ? C.red : color },
                  ]} />
                </View>
              </View>
            );
          })}

          {/* Programme (max 4) */}
          {(sched.length > 0 || upcoming.length > 0) && (
            <View style={s.schedTable}>
              {[...sched, ...upcoming].slice(0, 4).map((t, i) => (
                <View key={t.id} style={[s.schedRow, i === 0 && { borderTopWidth:0 }]}>
                  <Feather name="clock" size={12} color={C.amber} />
                  <View style={{ flex:1 }}>
                    <Text style={s.schedRoute}>{t.from_city} → {t.to_city}</Text>
                    <Text style={s.schedMeta}>
                      {t.departure_time}{t.date !== today ? ` · ${t.date}` : ""}
                    </Text>
                  </View>
                  <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                    <View style={s.miniBar}>
                      <View style={[
                        s.miniBarFill,
                        { width:`${t.total_seats > 0 ? (t.passenger_count/t.total_seats)*100 : 0}%` as any },
                      ]} />
                    </View>
                    <Text style={{ fontSize:10, color:C.textSub }}>
                      {t.passenger_count}/{t.total_seats}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Aucun départ */}
          {todayT.length === 0 && upcoming.length === 0 && (
            <View style={s.emptyBox}>
              <Feather name="calendar" size={24} color="#D1D5DB" />
              <Text style={{ color:"#9CA3AF", fontSize:13, marginTop:8 }}>
                Aucun départ programmé aujourd'hui
              </Text>
            </View>
          )}

          <View style={s.divider} />

          {/* ══ E. OUTILS ══════════════════════════════════════════
              4 raccourcis vers 4 destinations DISTINCTES.
              Chaque icône = une seule fonction. Aucun doublon.
              ─────────────────────────────────────────────────────
              1. Rapports    → /agent/rapport           (financier)
              2. Bordereaux  → /agent/chef-trips?tab=bordereaux
              3. Historique  → /agent/chef-trips?tab=historique
              4. Équipe      → /agent/chef-trips?tab=agents
          ════════════════════════════════════════════════════════ */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: C.indigo }]} />
            <Text style={s.sectionTitle}>Outils</Text>
          </View>

          <View style={s.toolGrid}>
            {[
              {
                icon:"trending-up", label:"Rapports financiers",
                sub:"Revenus & performances",
                c:C.indigo, bg:"#EEF2FF",
                to:"/agent/rapport", params: undefined,
              },
              {
                icon:"clipboard", label:"Bordereaux",
                sub:"Saisie carburant & bilan",
                c:C.blue, bg:C.blueSoft,
                to:"/agent/chef-trips", params:{ tab:"bordereaux" },
              },
              {
                icon:"clock", label:"Historique",
                sub:"Départs passés & archives",
                c:C.teal, bg:C.tealSoft,
                to:"/agent/chef-trips", params:{ tab:"historique" },
              },
              {
                icon:"users", label:"Équipe",
                sub:"Agents & activité",
                c:C.green, bg:C.greenSoft,
                to:"/agent/chef-trips", params:{ tab:"agents" },
              },
            ].map((a, i) => (
              <Pressable
                key={i}
                style={s.toolCard}
                onPress={() => router.push({ pathname: a.to, params: a.params } as never)}
              >
                <View style={[s.toolIcon, { backgroundColor: a.bg }]}>
                  <Feather name={a.icon as any} size={18} color={a.c} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.toolLabel}>{a.label}</Text>
                  <Text style={s.toolSub}>{a.sub}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={C.textSub} />
              </Pressable>
            ))}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */
const s = StyleSheet.create({
  /* ── Header ── */
  header:   { paddingHorizontal:18, paddingTop:18, paddingBottom:22 },
  hRow:     { flexDirection:"row", alignItems:"flex-start", marginBottom:18 },
  hTitle:   { fontSize:22, fontWeight:"900", color:"#fff" },
  hSub:     { fontSize:12, color:"#A5B4FC" },
  logoutBtn:{ width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.12)", alignItems:"center", justifyContent:"center" },
  livePill: { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"rgba(0,0,0,0.22)", borderRadius:20, paddingHorizontal:12, paddingVertical:6 },
  liveDot:  { width:7, height:7, borderRadius:3.5, backgroundColor:"#4ADE80" },
  liveText: { fontSize:11, color:"#C7D2FE", fontWeight:"600" },

  /* KPIs */
  kpiGrid:  { flexDirection:"row", gap:8, marginBottom:16 },
  kpiCard:  { flex:1, borderRadius:12, paddingVertical:12, paddingHorizontal:6, alignItems:"center", gap:3 },
  kpiVal:   { fontSize:24, fontWeight:"900", lineHeight:26 },
  kpiLabel: { fontSize:8, color:"rgba(255,255,255,0.6)", fontWeight:"700", textAlign:"center", textTransform:"uppercase" },

  /* Revenus */
  revStrip:   { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,255,255,0.1)", borderRadius:12, paddingHorizontal:14, paddingVertical:12 },
  revLabel:   { fontSize:8, color:"rgba(255,255,255,0.5)", fontWeight:"700", marginBottom:3, textTransform:"uppercase", letterSpacing:0.4 },
  revVal:     { fontSize:13, fontWeight:"800" },
  revDivider: { width:1, height:24, backgroundColor:"rgba(255,255,255,0.15)" },

  /* ── Body ── */
  body: { paddingHorizontal:16, paddingTop:22 },

  /* Section header */
  sectionRow:      { flexDirection:"row", alignItems:"center", gap:8, marginBottom:14 },
  sectionDot:      { width:8, height:8, borderRadius:4 },
  sectionTitle:    { fontSize:15, fontWeight:"900", color:C.text },
  sectionCount:    { borderRadius:10, paddingHorizontal:8, paddingVertical:2 },
  sectionCountText:{ fontSize:12, fontWeight:"800" },

  divider: { height:1, backgroundColor:C.border, marginVertical:22 },

  /* ── Urgence banner ── */
  urgenceBanner: { flexDirection:"row", alignItems:"center", gap:12, borderWidth:1.5, borderRadius:16, paddingHorizontal:14, paddingVertical:13, marginBottom:10 },
  urgenceIcon:   { width:42, height:42, borderRadius:13, alignItems:"center", justifyContent:"center" },
  urgenceTitle:  { fontSize:14, fontWeight:"800" },
  urgenceSub:    { fontSize:11, color:C.textSub, marginTop:2 },
  cta:           { borderRadius:10, paddingHorizontal:13, paddingVertical:7 },
  ctaText:       { color:"#fff", fontSize:11, fontWeight:"800" },

  /* ── Validation card ── */
  valCard:       { flexDirection:"row", alignItems:"center", gap:14, backgroundColor:C.white, borderRadius:16, paddingHorizontal:16, paddingVertical:14, borderWidth:1.5 },
  valIcon:       { width:44, height:44, borderRadius:13, alignItems:"center", justifyContent:"center" },
  valLabel:      { fontSize:14, fontWeight:"800", color:C.text },
  valSub:        { fontSize:11, color:C.textSub, marginTop:3 },
  readonlyBadge: { flexDirection:"row", alignItems:"center", gap:3, borderRadius:8, paddingHorizontal:6, paddingVertical:2 },
  readonlyText:  { fontSize:9, fontWeight:"700" },
  countBubble:   { borderRadius:12, minWidth:34, height:34, alignItems:"center", justifyContent:"center", paddingHorizontal:10 },
  countText:     { color:"#fff", fontWeight:"900", fontSize:15 },

  /* ── Supervision pills ── */
  pillRow:  { flexDirection:"row", gap:8, marginBottom:14 },
  pill:     { flex:1, borderRadius:12, paddingVertical:11, alignItems:"center" },
  pillNum:  { fontSize:22, fontWeight:"900", lineHeight:24 },
  pillLabel:{ fontSize:8.5, color:C.textSub, marginTop:2, fontWeight:"600" },

  /* ── Trip cards ── */
  tripCard:    { backgroundColor:C.white, borderRadius:16, padding:14, marginBottom:8, borderWidth:2 },
  tripIcon:    { width:36, height:36, borderRadius:11, alignItems:"center", justifyContent:"center" },
  tripRoute:   { fontSize:13, fontWeight:"800", color:C.text },
  tripStatus:  { fontSize:11, fontWeight:"700", marginTop:2 },
  tripPax:     { fontSize:17, fontWeight:"900", color:C.text },
  tripBar:     { height:3, backgroundColor:"#F3F4F6", borderRadius:2, marginTop:10, overflow:"hidden" },
  tripBarFill: { height:3, borderRadius:2 },

  /* ── Schedule table ── */
  schedTable: { backgroundColor:C.white, borderRadius:14, borderWidth:1, borderColor:C.border, overflow:"hidden", marginBottom:4 },
  schedRow:   { flexDirection:"row", alignItems:"center", gap:10, paddingHorizontal:14, paddingVertical:10, borderTopWidth:1, borderColor:C.border },
  schedRoute: { fontSize:12, fontWeight:"700", color:C.text },
  schedMeta:  { fontSize:10, color:C.textSub },
  miniBar:    { width:40, height:3, backgroundColor:"#E5E7EB", borderRadius:2, overflow:"hidden" },
  miniBarFill:{ height:3, backgroundColor:C.indigo, borderRadius:2 },

  /* ── Empty state ── */
  emptyBox: { backgroundColor:C.white, borderRadius:14, padding:28, alignItems:"center", borderWidth:1, borderColor:C.border },

  /* ── Outils grid ── */
  toolGrid: { gap:10 },
  toolCard: { flexDirection:"row", alignItems:"center", gap:14, backgroundColor:C.white, borderRadius:16, paddingHorizontal:16, paddingVertical:15, borderWidth:1, borderColor:C.border },
  toolIcon: { width:44, height:44, borderRadius:13, alignItems:"center", justifyContent:"center" },
  toolLabel:{ fontSize:14, fontWeight:"800", color:C.text },
  toolSub:  { fontSize:11, color:C.textSub, marginTop:3 },
});
