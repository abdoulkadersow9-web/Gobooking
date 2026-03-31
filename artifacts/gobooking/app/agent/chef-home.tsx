import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useOnSync } from "@/context/SyncContext";
import { apiFetch } from "@/utils/api";

/* ─── Design tokens ─── */
const C = {
  indigo:   "#4F46E5",
  indigo2:  "#3730A3",
  indigoBg: "#EEF2FF",
  red:      "#DC2626",
  redBg:    "#FEF2F2",
  redMid:   "#FCA5A5",
  amber:    "#D97706",
  amberBg:  "#FEF3C7",
  green:    "#059669",
  greenBg:  "#D1FAE5",
  blue:     "#1D4ED8",
  blueBg:   "#EFF6FF",
  purple:   "#7C3AED",
  purpleBg: "#F5F3FF",
  gray:     "#6B7280",
  grayBg:   "#F3F4F6",
  white:    "#FFFFFF",
  text:     "#111827",
  textSub:  "#6B7280",
  border:   "#E5E7EB",
  bg:       "#F4F6FB",
};

/* ─── HTML bordereau ─── */
function buildBordereauHtml(b: Bordereau, agenceName?: string): string {
  const fmt = (n: number) => n?.toLocaleString("fr-FR") ?? "0";
  const now = new Date().toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" });
  const stColor = b.status === "parti" ? "#059669" : b.status === "annulé" ? "#DC2626" : "#D97706";
  const stLabel = (b.status ?? "PROGRAMMÉ").toUpperCase();
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Bordereau</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f8fafc;color:#111827}
.page{max-width:680px;margin:0 auto;background:#fff}
.hd{background:linear-gradient(135deg,#3730A3,#4F46E5);padding:28px 32px 22px;color:#fff}
.hd-top{display:flex;justify-content:space-between;align-items:flex-start}
.co{font-size:22px;font-weight:900}.co-sub{font-size:11px;opacity:.7;margin-top:2px;text-transform:uppercase;letter-spacing:2px}
.dl{background:rgba(255,255,255,.18);border-radius:8px;padding:6px 14px;text-align:right}
.dl-t{font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px}.dl-n{font-size:16px;font-weight:800}
.rb{margin-top:18px;background:rgba(255,255,255,.12);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:12px}
.ci{font-size:26px;font-weight:900}.ar{font-size:22px;opacity:.6;flex:1;text-align:center}
.sp{background:${stColor};color:#fff;border-radius:20px;padding:4px 16px;font-size:12px;font-weight:800}
.mr{display:flex;border-bottom:1px solid #E5E7EB}
.mc{flex:1;padding:14px 18px;border-right:1px solid #E5E7EB}.mc:last-child{border-right:none}
.ml{font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}.mv{font-size:14px;font-weight:700}
.sc{padding:20px 24px 0}.st{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;border-bottom:2px solid #E5E7EB;padding-bottom:8px;margin-bottom:16px}
.rg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.rc{background:#F8FAFC;border-radius:10px;padding:14px;border-left:4px solid}
.rc.b{border-color:#1D4ED8}.rc.p{border-color:#7C3AED}.rc.g{border-color:#059669}
.rl{font-size:10px;color:#6B7280;margin-bottom:6px}.rv{font-size:18px;font-weight:900}
.rc.b .rv{color:#1D4ED8}.rc.p .rv{color:#7C3AED}.rc.g .rv{color:#059669}
.tb{background:#111827;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.tl{color:rgba(255,255,255,.65);font-size:12px}.tv{color:#fff;font-size:22px;font-weight:900}
.er{display:flex;gap:12px;margin-bottom:16px}
.ec{flex:1;border-radius:10px;padding:12px 16px;border-left:4px solid}
.ec.fu{background:#FEF3C7;border-color:#D97706}.ec.np{background:#ECFDF5;border-color:#059669}.ec.nn{background:#FEF2F2;border-color:#DC2626}
.el{font-size:10px;color:#6B7280;margin-bottom:4px}.ev{font-size:16px;font-weight:800}
.ev.fv{color:#D97706}.ev.pv{color:#059669}.ev.nv{color:#DC2626}
.nf{background:#FFFBEB;border:2px dashed #FCD34D;border-radius:10px;padding:14px;text-align:center;color:#92400E;font-size:13px;margin-bottom:16px}
.ft{background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 24px;display:flex;justify-content:space-between}
.fb{font-size:13px;font-weight:800;color:#3730A3}.fd{font-size:11px;color:#9CA3AF}
.sr{display:flex;gap:24px;padding:16px 24px 24px}
.sb{flex:1;border-top:1.5px solid #E5E7EB;padding-top:8px}
.sl{font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px}
</style></head><body><div class="page">
<div class="hd"><div class="hd-top"><div><div class="co">${agenceName?.toUpperCase() ?? "GOBOOKING"}</div><div class="co-sub">Transport Interurbain · Côte d'Ivoire</div></div>
<div class="dl"><div class="dl-t">Bordereau de départ</div><div class="dl-n">#${String(b.id).slice(-6).toUpperCase()}</div></div></div>
<div class="rb"><div class="ci">${b.from}</div><div class="ar">→</div><div class="ci">${b.to}</div><div class="sp">${stLabel}</div></div></div>
<div class="mr">
<div class="mc"><div class="ml">Date</div><div class="mv">${b.date}</div></div>
<div class="mc"><div class="ml">Départ</div><div class="mv">${b.departureTime}</div></div>
<div class="mc"><div class="ml">Bus</div><div class="mv">${b.busName}</div></div>
<div class="mc"><div class="ml">Passagers</div><div class="mv">${b.passengersCount ?? 0} pax</div></div>
</div>
<div class="sc" style="padding-top:20px"><div class="st">Détail des recettes</div>
<div class="rg">
<div class="rc b"><div class="rl">Billets</div><div class="rv">${fmt(b.ticketRevenue)}</div></div>
<div class="rc p"><div class="rl">Bagages</div><div class="rv">${fmt(b.bagageRevenue)}</div></div>
<div class="rc g"><div class="rl">Colis</div><div class="rv">${fmt(b.colisRevenue)}</div></div>
</div></div>
<div class="sc"><div class="tb"><div class="tl">RECETTES TOTALES</div><div class="tv">${fmt(b.totalRecettes)} FCFA</div></div></div>
<div class="sc"><div class="st">Dépenses &amp; Résultat net</div>
${b.hasFuel
  ? `<div class="er"><div class="ec fu"><div class="el">⛽ Carburant</div><div class="ev fv">${fmt(b.carburantAmount)} FCFA</div></div><div class="ec ${b.netRevenue >= 0 ? "np" : "nn"}"><div class="el">Résultat net</div><div class="ev ${b.netRevenue >= 0 ? "pv" : "nv"}">${b.netRevenue >= 0 ? "+" : ""}${fmt(b.netRevenue)} FCFA</div></div></div>`
  : `<div class="nf">⚠️ Coût carburant non renseigné — résultat net non calculable</div>`}
</div>
<div class="sc" style="margin-top:8px"><div class="st">Signatures</div></div>
<div class="sr"><div class="sb"><div class="sl">Agent guichet</div></div><div class="sb"><div class="sl">Chef d'agence</div></div><div class="sb"><div class="sl">Chauffeur</div></div></div>
<div class="ft"><div class="fb">GoBooking — Transport Ivoirien</div><div class="fd">Édité le ${now}</div></div>
</div></body></html>`;
}

/* ─── Types ─── */
type DashData = {
  agence: { id: string; name: string; city: string } | null;
  stats:  { tripsToday: number; agentsActive: number; passengersToday: number; busesAvailable: number };
};
type Trip = {
  id: string; from_city: string; to_city: string; date: string;
  departure_time: string; status: string; bus_name: string;
  total_seats: number; passenger_count: number;
};
type Bordereau = {
  id: string; from: string; to: string; date: string; departureTime: string;
  busName: string; status: string; passengersCount: number;
  ticketRevenue: number; bagageRevenue: number; colisRevenue: number;
  totalRecettes: number; carburantAmount: number; hasFuel: boolean; netRevenue: number;
};
type AgenceStats = {
  colis:   { aValider: number; enGare: number; enTransit: number; arrives: number };
  alertes: { active: number };
  revenue: { today: { billets: number; colis: number; bagages: number; total: number; net: number } };
};

/* ─── Helpers ─── */
function fmt(n: number) { return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n ?? 0); }

function SecHead({ title, accent, sub, right }: { title: string; accent: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:12 }}>
      <View style={{ width:3, height:18, borderRadius:2, backgroundColor:accent }} />
      <Text style={{ fontSize:14, fontWeight:"800", color:C.text, flex:1 }}>{title}</Text>
      {sub && <Text style={{ fontSize:11, color:C.textSub }}>{sub}</Text>}
      {right}
    </View>
  );
}

/* ─── Carte navigation (chef valide et navigue) ─── */
function NavCard({ icon, label, sub, accent, bg, badge, onPress }: {
  icon: string; label: string; sub: string;
  accent: string; bg: string; badge?: number; onPress?: () => void;
}) {
  return (
    <Pressable style={[s.navCard, { borderColor: bg }]} onPress={onPress}>
      <View style={[s.navIcon, { backgroundColor: bg }]}>
        <Feather name={icon as any} size={18} color={accent} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:13, fontWeight:"800", color:C.text }}>{label}</Text>
        <Text style={{ fontSize:11, color:C.textSub, marginTop:2 }}>{sub}</Text>
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={[s.navBadge, { backgroundColor: accent }]}>
          <Text style={{ color:"#fff", fontWeight:"900", fontSize:15 }}>{badge}</Text>
        </View>
      )}
      <Feather name="chevron-right" size={16} color={C.textSub} />
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════ */
export default function ChefHome() {
  const { user, token, logoutIfActiveToken } = useAuth();
  const auth = token ?? "";

  const [dash, setDash]             = useState<DashData | null>(null);
  const [trips, setTrips]           = useState<Trip[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [caisses, setCaisses]       = useState(0);
  const [bordereaux, setBordereaux] = useState<Bordereau[]>([]);
  const [agenceStats, setAgStats]   = useState<AgenceStats | null>(null);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [lastSync, setLastSync]     = useState<Date | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  /* ── impression ── */
  const printBordereau = async (b: Bordereau) => {
    setPrintingId(b.id);
    try {
      const html = buildBordereauHtml(b, dash?.agence?.name);
      if (Platform.OS === "web") {
        const w = window.open("", "_blank");
        if (w) { w.document.write(html); w.document.close(); w.print(); }
      } else { await Print.printAsync({ html }); }
    } catch { Alert.alert("Impression", "Impossible d'imprimer."); }
    finally { setPrintingId(null); }
  };

  /* ── chargement ── */
  const load = useCallback(async () => {
    if (!auth) { setLoading(false); return; }
    if (user?.agentRole && user.agentRole !== "chef_agence") {
      setLoading(false);
      setLoadError(`Rôle : ${user.agentRole}. Accès réservé au chef d'agence.`);
      return;
    }
    setLoadError(null);
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
      setLoadError(e?.message ?? "Impossible de charger le tableau de bord.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [auth, user, logoutIfActiveToken]);

  const loadBordereaux = useCallback(async () => {
    if (!auth) return;
    try {
      const r = await apiFetch<{ bordereaux: Bordereau[] }>("/agent/chef/bordereaux", { token: auth });
      setBordereaux(r.bordereaux ?? []);
    } catch { /* silencieux */ }
  }, [auth]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadBordereaux(); }, [loadBordereaux]);
  useEffect(() => { const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);
  useOnSync(["boarding", "ticket", "reservation"], load);

  /* ── animation live ── */
  const ND = Platform.OS !== "web";
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const lp = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.2, duration: 900, useNativeDriver: ND }),
      Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: ND }),
    ]));
    lp.start(); return () => lp.stop();
  }, [pulse, ND]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  /* ── données dérivées ── */
  const firstName  = user?.name?.split(" ")[0] ?? "Chef";
  const agence     = dash?.agence;
  const stats      = dash?.stats;
  const today      = new Date().toISOString().slice(0, 10);
  const todayTrips = trips.filter(t => t.date === today && t.status !== "cancelled");
  const upcoming   = trips.filter(t => t.date > today && t.status !== "cancelled").slice(0, 3);
  const active     = todayTrips.filter(t => ["boarding","en_route","in_progress"].includes(t.status));
  const scheduled  = todayTrips.filter(t => t.status === "scheduled");
  const done       = todayTrips.filter(t => ["arrived","completed"].includes(t.status));
  const noFuel     = bordereaux.filter(b => !b.hasFuel);
  const alerts     = agenceStats?.alertes.active ?? 0;
  const colisAVal  = agenceStats?.colis.aValider ?? 0;
  const rev        = agenceStats?.revenue.today;
  const syncTime   = lastSync ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}` : null;

  /* ─── Loading / Error ─── */
  if (loading) return (
    <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:C.bg }}>
      <ActivityIndicator size="large" color={C.indigo} />
      <Text style={{ marginTop:12, color:C.indigo, fontSize:14 }}>Chargement…</Text>
    </SafeAreaView>
  );
  if (loadError) return (
    <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:C.bg, padding:32 }}>
      <Feather name="alert-triangle" size={48} color={C.red} />
      <Text style={{ marginTop:16, fontSize:17, fontWeight:"800", color:C.text, textAlign:"center" }}>Tableau de bord indisponible</Text>
      <Text style={{ marginTop:8, fontSize:13, color:C.textSub, textAlign:"center", lineHeight:20 }}>{loadError}</Text>
      <Pressable onPress={() => { setLoading(true); load(); }} style={{ marginTop:20, backgroundColor:C.indigo, borderRadius:12, paddingHorizontal:28, paddingVertical:14 }}>
        <Text style={{ color:"#fff", fontWeight:"700" }}>Réessayer</Text>
      </Pressable>
    </SafeAreaView>
  );

  /* ════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.indigo2} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.indigo} />}
        contentContainerStyle={{ paddingBottom:110 }}
      >

        {/* ══ HEADER ══ */}
        <LinearGradient colors={[C.indigo2, C.indigo, "#6366F1"]} style={s.header}>
          <View style={s.headerRow}>
            <View style={{ flex:1 }}>
              <Text style={s.greeting}>Bonjour, {firstName} 👋</Text>
              <View style={{ flexDirection:"row", alignItems:"center", gap:5, marginTop:5 }}>
                <Feather name="map-pin" size={11} color="#A5B4FC" />
                <Text style={s.agText}>{agence ? `${agence.name} — ${agence.city}` : "Chef d'Agence"}</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push("/agent/home" as never)} style={s.homeBtn}>
              <Feather name="grid" size={18} color="#fff" />
            </Pressable>
          </View>

          {/* KPIs : Départs / Agents / À valider / Colis */}
          <View style={s.kpiRow}>
            {[
              { icon:"navigation",  val:stats?.tripsToday ?? 0,      label:"Départs",   color:C.indigo,  bg:"rgba(238,242,255,0.9)" },
              { icon:"users",       val:stats?.agentsActive ?? 0,     label:"Agents",    color:C.green,   bg:"rgba(209,250,229,0.9)" },
              { icon:"check-square",val:caisses,                       label:"À valider", color:C.amber,   bg:"rgba(254,243,199,0.9)" },
              { icon:"package",     val:colisAVal,                     label:"Colis",     color:C.purple,  bg:"rgba(245,243,255,0.9)" },
            ].map((k, i) => (
              <View key={i} style={[s.kpiCard, { backgroundColor:k.bg }]}>
                <Feather name={k.icon as any} size={14} color={k.color} />
                <Text style={[s.kpiVal, { color:k.color }]}>{k.val}</Text>
                <Text style={s.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>

          {/* Revenus + VS hier */}
          {rev && (
            <View style={s.revStrip}>
              {[
                { l:"Billets",  v:rev.billets,  c:"#93C5FD" },
                { l:"Colis",    v:rev.colis,     c:"#C4B5FD" },
                { l:"Bagages",  v:rev.bagages,   c:"#6EE7B7" },
              ].map((r, i) => (
                <React.Fragment key={i}>
                  <View style={{ flex:1, alignItems:"center" }}>
                    <Text style={{ fontSize:8, color:"rgba(255,255,255,0.55)", fontWeight:"700", marginBottom:2 }}>{r.l}</Text>
                    <Text style={{ fontSize:13, fontWeight:"800", color:r.c }}>{r.v > 0 ? `${fmt(r.v)}` : "—"}</Text>
                  </View>
                  <View style={{ width:1, height:24, backgroundColor:"rgba(255,255,255,0.2)" }} />
                </React.Fragment>
              ))}
              <View style={{ flex:1.4, alignItems:"center" }}>
                <Text style={{ fontSize:8, color:"rgba(255,255,255,0.55)", fontWeight:"700", marginBottom:2 }}>NET AUJOURD'HUI</Text>
                <Text style={{ fontSize:14, fontWeight:"900", color: rev.net >= 0 ? "#4ADE80" : "#FCA5A5" }}>
                  {rev.net >= 0 ? "+" : ""}{fmt(rev.net)}
                </Text>
              </View>
              <View style={{ width:1, height:24, backgroundColor:"rgba(255,255,255,0.2)" }} />
              {/* Live pill */}
              <View style={s.livePill}>
                <Animated.View style={[s.liveDot, { opacity:pulse }]} />
                <Text style={s.liveText}>{syncTime ?? "…"}</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* ══ ALERTE SIGNALEMENT ══ */}
        {alerts > 0 && (
          <Pressable
            style={s.alertBanner}
            onPress={() => router.push("/agent/chef-trips" as never)}
          >
            <View style={s.alertIcon}>
              <Feather name="alert-triangle" size={16} color={C.red} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={s.alertTitle}>{alerts} signalement{alerts > 1 ? "s" : ""} en attente</Text>
              <Text style={s.alertSub}>Consulter les alertes signalées par vos agents</Text>
            </View>
            <View style={s.alertBtn}>
              <Text style={{ color:"#fff", fontSize:11, fontWeight:"800" }}>Consulter</Text>
            </View>
          </Pressable>
        )}

        {/* ══ 1. À VALIDER — cœur du rôle chef ══ */}
        <View style={s.section}>
          <SecHead title="À valider" accent={C.amber} sub="Votre rôle principal" />
          <View style={{ gap:8 }}>
            <NavCard
              icon="dollar-sign" label={`${caisses} caisse${caisses !== 1 ? "s" : ""} en attente`}
              sub="Validez ou rejetez les soumissions agents"
              accent={C.amber} bg={C.amberBg} badge={caisses}
              onPress={() => router.push({ pathname:"/agent/chef-trips", params:{ tab:"caisses" } } as never)}
            />
            {colisAVal > 0 && (
              <NavCard
                icon="package" label={`${colisAVal} colis à valider`}
                sub={`En gare · En transit · Arrivés`}
                accent={C.purple} bg={C.purpleBg} badge={colisAVal}
                onPress={() => router.push("/agent/colis" as never)}
              />
            )}
          </View>
        </View>

        {/* ══ 2. POINTS D'ATTENTION (synthèse) ══ */}
        {noFuel.length > 0 && (
          <View style={s.section}>
            <SecHead title="Points d'attention" accent={C.red} />

            {/* Bordereaux sans carburant — vue synthétique, pas d'action inline */}
            <View style={s.attentionCard}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:12, padding:14 }}>
                <View style={[s.attIcon, { backgroundColor:"#FEF2F2" }]}>
                  <Feather name="zap" size={16} color={C.red} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.attTitle}>{noFuel.length} bordereau{noFuel.length > 1 ? "x" : ""} sans carburant renseigné</Text>
                  <Text style={s.attSub}>Résultat net non calculable — accès via Bordereaux</Text>
                </View>
                <Pressable
                  style={s.attAction}
                  onPress={() => router.push({ pathname:"/agent/chef-trips", params:{ tab:"bordereaux" } } as never)}
                >
                  <Text style={{ color:"#fff", fontSize:11, fontWeight:"800" }}>Gérer →</Text>
                </Pressable>
              </View>
              {/* Aperçu lecture seule (3 premiers) */}
              {noFuel.slice(0, 3).map((b, i) => (
                <View key={b.id} style={s.attRow}>
                  <View style={s.attDot} />
                  <View style={{ flex:1 }}>
                    <Text style={{ fontSize:12, fontWeight:"600", color:C.text }}>{b.from} → {b.to}</Text>
                    <Text style={{ fontSize:10, color:C.textSub }}>{b.date} · {b.departureTime}</Text>
                  </View>
                  <Text style={{ fontSize:11, fontWeight:"700", color:C.red }}>{fmt(b.totalRecettes)} FCFA</Text>
                </View>
              ))}
              {noFuel.length > 3 && (
                <Pressable
                  style={{ padding:10, alignItems:"center" }}
                  onPress={() => router.push({ pathname:"/agent/chef-trips", params:{ tab:"bordereaux" } } as never)}
                >
                  <Text style={{ fontSize:11, color:C.red, fontWeight:"700" }}>
                    + {noFuel.length - 3} autre{noFuel.length - 3 > 1 ? "s" : ""} — Voir tous →
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ══ 3. SUPERVISION DÉPARTS (lecture seule) ══ */}
        <View style={s.section}>
          <SecHead
            title="Supervision des départs"
            accent={C.indigo}
            right={
              <Pressable onPress={() => router.push("/agent/chef-trips" as never)}>
                <Text style={{ fontSize:12, color:C.indigo, fontWeight:"700" }}>Détails →</Text>
              </Pressable>
            }
          />

          {/* Actifs — proéminents, lecture seule */}
          {active.map(t => {
            const isBoarding = t.status === "boarding";
            const pct = t.total_seats > 0 ? (t.passenger_count / t.total_seats) * 100 : 0;
            return (
              <View key={t.id} style={[s.activeCard, { borderColor: isBoarding ? "#DDD6FE" : "#A7F3D0" }]}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:10 }}>
                  <View style={[s.activeDot, { backgroundColor: isBoarding ? C.purpleBg : C.greenBg }]}>
                    <Feather name={isBoarding ? "check-square" : "navigation"} size={14} color={isBoarding ? C.purple : C.green} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.activeRoute}>{t.from_city} → {t.to_city}</Text>
                    <Text style={[s.activeStatus, { color: isBoarding ? C.purple : C.green }]}>
                      {isBoarding ? "EMBARQUEMENT" : "EN ROUTE"} · {t.departure_time}
                    </Text>
                  </View>
                  <View style={{ alignItems:"flex-end" }}>
                    <Text style={s.activePax}>{t.passenger_count}<Text style={{ fontSize:11, color:C.textSub, fontWeight:"400" }}>/{t.total_seats}</Text></Text>
                    <Text style={{ fontSize:9, color:C.textSub }}>{t.bus_name}</Text>
                  </View>
                </View>
                <View style={s.fillBg}>
                  <View style={[s.fillBar, { width:`${Math.min(100,pct)}%` as any, backgroundColor: pct>=90 ? C.red : isBoarding ? C.purple : C.green }]} />
                </View>
              </View>
            );
          })}

          {/* Programme — liste compacte */}
          {scheduled.length > 0 && (
            <>
              <Text style={s.miniLabel}>PROGRAMME · {scheduled.length} À VENIR</Text>
              <View style={s.schedTable}>
                {scheduled.map((t, i) => (
                  <View key={t.id} style={[s.schedRow, i === 0 && { borderTopWidth:0 }]}>
                    <Feather name="clock" size={12} color={C.amber} />
                    <View style={{ flex:1 }}>
                      <Text style={s.schedRoute}>{t.from_city} → {t.to_city}</Text>
                      <Text style={s.schedMeta}>{t.departure_time}</Text>
                    </View>
                    <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                      <View style={s.fillMini}>
                        <View style={[s.fillMiniBar, { width:`${(t.passenger_count/t.total_seats)*100}%` as any }]} />
                      </View>
                      <Text style={{ fontSize:10, color:C.textSub }}>{t.passenger_count}/{t.total_seats}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Terminés */}
          {done.length > 0 && (
            <View style={s.doneRow}>
              <Feather name="check-circle" size={13} color={C.gray} />
              <Text style={{ fontSize:12, color:C.gray, fontWeight:"600", flex:1 }}>
                {done.length} départ{done.length > 1 ? "s" : ""} terminé{done.length > 1 ? "s" : ""} aujourd'hui
              </Text>
              <Pressable onPress={() => router.push("/agent/chef-trips" as never)}>
                <Text style={{ fontSize:11, color:C.indigo, fontWeight:"700" }}>Voir →</Text>
              </Pressable>
            </View>
          )}

          {/* Aucun départ */}
          {todayTrips.length === 0 && (
            <View style={s.empty}>
              <Feather name="calendar" size={22} color="#D1D5DB" />
              <Text style={{ color:"#9CA3AF", fontSize:13, marginTop:6 }}>Aucun départ aujourd'hui</Text>
            </View>
          )}

          {/* Prochains */}
          {upcoming.length > 0 && (
            <>
              <Text style={[s.miniLabel, { marginTop:14 }]}>PROCHAINS DÉPARTS</Text>
              <View style={s.schedTable}>
                {upcoming.map((t, i) => (
                  <View key={t.id} style={[s.schedRow, i === 0 && { borderTopWidth:0 }]}>
                    <Feather name="calendar" size={12} color={C.indigo} />
                    <View style={{ flex:1 }}>
                      <Text style={s.schedRoute}>{t.from_city} → {t.to_city}</Text>
                      <Text style={s.schedMeta}>{t.date} · {t.departure_time}</Text>
                    </View>
                    <View style={{ backgroundColor:C.indigoBg, borderRadius:20, paddingHorizontal:7, paddingVertical:2 }}>
                      <Text style={{ fontSize:9, fontWeight:"700", color:C.indigo }}>Programmé</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ══ 4. BORDEREAUX — synthèse financière (tableau) ══ */}
        {bordereaux.length > 0 && (
          <View style={s.section}>
            <SecHead
              title="Bordereaux du jour"
              accent={C.blue}
              right={
                <Pressable onPress={() => router.push({ pathname:"/agent/chef-trips", params:{ tab:"bordereaux" } } as never)}>
                  <Text style={{ fontSize:12, color:C.blue, fontWeight:"700" }}>Tout voir →</Text>
                </Pressable>
              }
            />
            <View style={s.bordTable}>
              {/* En-tête */}
              <View style={s.bordHeader}>
                {["Trajet","Pax","Recettes","Net",""].map((h, i) => (
                  <Text key={i} style={[s.bordHeaderTxt, i === 0 && { flex:2 }]}>{h}</Text>
                ))}
              </View>
              {bordereaux.slice(0, 6).map((b, i) => {
                const total = b.totalRecettes;
                return (
                  <View key={b.id} style={[s.bordDataRow, i === 0 && { borderTopWidth:0 }]}>
                    <View style={{ flex:2, minWidth:0 }}>
                      <Text style={{ fontSize:11, fontWeight:"700", color:C.text }} numberOfLines={1}>{b.from} → {b.to}</Text>
                      <Text style={{ fontSize:9, color:C.textSub }}>{b.date} · {b.departureTime}</Text>
                    </View>
                    <Text style={s.bordCell}>{b.passengersCount}</Text>
                    <Text style={[s.bordCell, { fontWeight:"700" }]}>{fmt(total)}</Text>
                    <Text style={[s.bordCell, { color: b.hasFuel ? (b.netRevenue >= 0 ? C.green : C.red) : C.amber, fontWeight:"800" }]}>
                      {b.hasFuel ? `${b.netRevenue >= 0 ? "+" : ""}${fmt(b.netRevenue)}` : "—"}
                    </Text>
                    <View>
                      {b.hasFuel
                        ? <View style={{ backgroundColor:C.greenBg, borderRadius:20, padding:3 }}><Feather name="check" size={9} color={C.green} /></View>
                        : <View style={{ backgroundColor:C.amberBg, borderRadius:20, padding:3 }}><Feather name="alert-circle" size={9} color={C.amber} /></View>
                      }
                    </View>
                  </View>
                );
              })}
              {/* Ligne total */}
              <View style={s.bordTotal}>
                <Text style={{ flex:2, fontSize:11, fontWeight:"800", color:C.text }}>TOTAL</Text>
                <Text style={s.bordCell}>{bordereaux.reduce((s,b)=>s+b.passengersCount,0)}</Text>
                <Text style={[s.bordCell, { color:C.indigo, fontWeight:"900" }]}>
                  {fmt(bordereaux.reduce((s,b)=>s+b.totalRecettes,0))}
                </Text>
                <Text style={[s.bordCell, { color:C.green, fontWeight:"900" }]}>
                  {fmt(bordereaux.filter(b=>b.hasFuel).reduce((s,b)=>s+b.netRevenue,0))}
                </Text>
                <View />
              </View>
            </View>

            {/* Imprimer rapport global */}
            <TouchableOpacity
              style={s.printBtn}
              onPress={() => router.push("/agent/rapport" as never)}
            >
              <Feather name="printer" size={14} color={C.indigo} />
              <Text style={{ fontSize:13, fontWeight:"700", color:C.indigo, flex:1, textAlign:"center" }}>Imprimer le rapport du jour</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ 5. ACCÈS RAPIDES ══ */}
        <View style={s.section}>
          <SecHead title="Accès rapides" accent={C.gray} />
          <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8 }}>
            {[
              { icon:"bar-chart-2", label:"Rapports",     color:C.indigo,  bg:C.indigoBg, to:"/agent/rapport"     },
              { icon:"eye",         label:"Bordereaux",   color:C.blue,    bg:C.blueBg,   to:"/agent/chef-trips"  },
              { icon:"users",       label:"Mes agents",   color:C.green,   bg:C.greenBg,  to:"/agent/chef-trips"  },
              { icon:"trending-up", label:"Statistiques", color:C.purple,  bg:C.purpleBg, to:"/agent/rapport"     },
            ].map((a, i) => (
              <Pressable
                key={i}
                onPress={() => router.push(a.to as never)}
                style={s.quickCard}
              >
                <View style={{ width:34, height:34, borderRadius:10, backgroundColor:a.bg, alignItems:"center", justifyContent:"center" }}>
                  <Feather name={a.icon as any} size={15} color={a.color} />
                </View>
                <Text style={{ fontSize:12, fontWeight:"700", color:C.text, flex:1 }}>{a.label}</Text>
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

/* ─── Styles ─── */
const s = StyleSheet.create({
  header:    { paddingHorizontal:18, paddingTop:14, paddingBottom:18 },
  headerRow: { flexDirection:"row", alignItems:"flex-start", marginBottom:14 },
  greeting:  { fontSize:20, fontWeight:"800", color:"#fff" },
  agText:    { fontSize:12, color:"#A5B4FC" },
  homeBtn:   { padding:9, backgroundColor:"rgba(255,255,255,0.15)", borderRadius:10 },
  kpiRow:    { flexDirection:"row", gap:8, marginBottom:12 },
  kpiCard:   { flex:1, borderRadius:12, paddingVertical:10, paddingHorizontal:6, alignItems:"center", gap:3 },
  kpiVal:    { fontSize:20, fontWeight:"900", letterSpacing:-0.5 },
  kpiLabel:  { fontSize:8, color:C.textSub, fontWeight:"600", textAlign:"center", lineHeight:11 },
  revStrip:  { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,255,255,0.12)", borderRadius:12, paddingHorizontal:14, paddingVertical:10, gap:0 },
  livePill:  { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"rgba(0,0,0,0.2)", borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  liveDot:   { width:6, height:6, borderRadius:3, backgroundColor:"#4ADE80" },
  liveText:  { color:"#A5B4FC", fontSize:10, fontWeight:"600" },

  alertBanner: { flexDirection:"row", alignItems:"center", gap:12, backgroundColor:C.redBg, borderBottomWidth:2, borderColor:"#FCA5A5", paddingHorizontal:16, paddingVertical:11 },
  alertIcon:   { width:36, height:36, borderRadius:10, backgroundColor:"#FECACA", alignItems:"center", justifyContent:"center" },
  alertTitle:  { fontSize:13, fontWeight:"800", color:"#991B1B" },
  alertSub:    { fontSize:11, color:C.red, marginTop:1 },
  alertBtn:    { backgroundColor:C.red, borderRadius:9, paddingHorizontal:11, paddingVertical:5 },

  section: { marginHorizontal:14, marginTop:22 },

  navCard:   { backgroundColor:C.white, borderRadius:14, padding:14, flexDirection:"row", alignItems:"center", gap:12, borderWidth:1.5 },
  navIcon:   { width:44, height:44, borderRadius:14, alignItems:"center", justifyContent:"center" },
  navBadge:  { borderRadius:12, minWidth:32, height:32, alignItems:"center", justifyContent:"center", paddingHorizontal:8 },

  attentionCard: { backgroundColor:C.white, borderRadius:14, borderWidth:1.5, borderColor:"#FEE2E2", overflow:"hidden" },
  attIcon:       { width:42, height:42, borderRadius:13, alignItems:"center", justifyContent:"center" },
  attTitle:      { fontSize:13, fontWeight:"800", color:C.text },
  attSub:        { fontSize:11, color:C.textSub, marginTop:2 },
  attAction:     { backgroundColor:C.red, borderRadius:9, paddingHorizontal:12, paddingVertical:6 },
  attRow:        { flexDirection:"row", alignItems:"center", gap:10, paddingHorizontal:14, paddingVertical:8, borderTopWidth:1, borderColor:"#FEE2E2" },
  attDot:        { width:6, height:6, borderRadius:3, backgroundColor:C.red, flexShrink:0 },

  activeCard:   { backgroundColor:C.white, borderRadius:14, padding:12, marginBottom:8, borderWidth:2 },
  activeDot:    { width:34, height:34, borderRadius:10, alignItems:"center", justifyContent:"center" },
  activeRoute:  { fontSize:13, fontWeight:"800", color:C.text },
  activeStatus: { fontSize:10, fontWeight:"700", marginTop:2, textTransform:"uppercase" as any },
  activePax:    { fontSize:16, fontWeight:"900", color:C.text },
  fillBg:       { height:3, backgroundColor:"#F3F4F6", borderRadius:2, marginTop:8, overflow:"hidden" },
  fillBar:      { height:3, borderRadius:2 },
  fillMini:     { height:3, width:36, backgroundColor:"#E5E7EB", borderRadius:2, overflow:"hidden" },
  fillMiniBar:  { height:3, backgroundColor:C.indigo, borderRadius:2 },

  miniLabel: { fontSize:9, fontWeight:"800", color:"#9CA3AF", letterSpacing:1.2, marginBottom:6 },
  schedTable:{ backgroundColor:C.white, borderRadius:12, borderWidth:1, borderColor:C.border, overflow:"hidden" },
  schedRow:  { flexDirection:"row", alignItems:"center", gap:10, paddingHorizontal:13, paddingVertical:9, borderTopWidth:1, borderColor:C.border },
  schedRoute:{ fontSize:12, fontWeight:"700", color:C.text },
  schedMeta: { fontSize:10, color:C.textSub },

  doneRow: { flexDirection:"row", alignItems:"center", gap:8, marginTop:8, paddingHorizontal:13, paddingVertical:8, backgroundColor:C.white, borderRadius:12, borderWidth:1, borderColor:C.border },
  empty:   { backgroundColor:C.white, borderRadius:14, padding:24, alignItems:"center", borderWidth:1, borderColor:C.border },

  bordTable:     { backgroundColor:C.white, borderRadius:14, borderWidth:1, borderColor:C.border, overflow:"hidden" },
  bordHeader:    { flexDirection:"row", paddingHorizontal:13, paddingVertical:7, backgroundColor:"#F9FAFB", borderBottomWidth:1, borderColor:C.border, gap:6 },
  bordHeaderTxt: { flex:1, fontSize:9, fontWeight:"800", color:C.textSub, textTransform:"uppercase", letterSpacing:0.5 },
  bordDataRow:   { flexDirection:"row", alignItems:"center", paddingHorizontal:13, paddingVertical:10, borderTopWidth:1, borderColor:C.border, gap:6 },
  bordCell:      { flex:1, fontSize:11, color:C.text },
  bordTotal:     { flexDirection:"row", alignItems:"center", paddingHorizontal:13, paddingVertical:10, borderTopWidth:2, borderColor:C.border, backgroundColor:"#F9FAFB", gap:6 },

  printBtn: { flexDirection:"row", alignItems:"center", gap:8, backgroundColor:C.white, borderRadius:12, borderWidth:1, borderColor:C.border, padding:12, marginTop:10 },

  quickCard: { flex:1, flexBasis:"48%", flexDirection:"row", alignItems:"center", gap:10, backgroundColor:C.white, borderRadius:12, paddingHorizontal:13, paddingVertical:12, borderWidth:1, borderColor:C.border },

  fab: { position:"absolute", bottom:26, right:18, width:54, height:54, borderRadius:27, backgroundColor:C.indigo, justifyContent:"center", alignItems:"center", elevation:6 },
});
