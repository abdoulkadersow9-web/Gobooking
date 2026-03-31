import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useOnSync } from "@/context/SyncContext";
import { apiFetch } from "@/utils/api";

/* ─── Design tokens ─── */
const C = {
  indigo:  "#4F46E5",
  indigo2: "#3730A3",
  red:     "#DC2626",
  redBg:   "#FEE2E2",
  redMid:  "#FCA5A5",
  amber:   "#D97706",
  amberBg: "#FEF3C7",
  green:   "#059669",
  greenBg: "#D1FAE5",
  blue:    "#1D4ED8",
  blueBg:  "#EFF6FF",
  purple:  "#7C3AED",
  purpleBg:"#F5F3FF",
  gray:    "#6B7280",
  grayBg:  "#F3F4F6",
  white:   "#FFFFFF",
  text:    "#111827",
  textSub: "#6B7280",
  border:  "#E5E7EB",
  bg:      "#F4F6FB",
};

/* ─── HTML bordereau ─── */
function buildBordereauHtml(b: Bordereau, agenceName?: string): string {
  const fmt = (n: number) => n?.toLocaleString("fr-FR") ?? "0";
  const stColor = b.status === "parti" ? "#059669" : b.status === "annulé" ? "#DC2626" : "#D97706";
  const stLabel = b.status === "parti" ? "PARTI" : b.status === "annulé" ? "ANNULÉ" : (b.status ?? "PROGRAMMÉ").toUpperCase();
  const now = new Date().toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" });
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Bordereau</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f8fafc;color:#111827}
.page{max-width:680px;margin:0 auto;background:#fff}
.hd{background:linear-gradient(135deg,#3730A3,#4F46E5);padding:28px 32px 22px;color:#fff}
.hd-top{display:flex;justify-content:space-between;align-items:flex-start}
.co{font-size:22px;font-weight:900;letter-spacing:1px}.co-sub{font-size:11px;opacity:.7;margin-top:2px;letter-spacing:2px;text-transform:uppercase}
.dl{background:rgba(255,255,255,.18);border-radius:8px;padding:6px 14px;text-align:right}
.dl-t{font-size:10px;opacity:.75;letter-spacing:1px;text-transform:uppercase}.dl-n{font-size:16px;font-weight:800}
.rb{margin-top:18px;background:rgba(255,255,255,.12);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:12px}
.ci{font-size:26px;font-weight:900}.ar{font-size:22px;opacity:.6;flex:1;text-align:center}
.sp{background:${stColor};color:#fff;border-radius:20px;padding:4px 16px;font-size:12px;font-weight:800;white-space:nowrap}
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
<div class="hd"><div class="hd-top"><div><div class="co">${agenceName ? agenceName.toUpperCase() : "GOBOOKING"}</div><div class="co-sub">Transport Interurbain • Côte d'Ivoire</div></div>
<div class="dl"><div class="dl-t">Bordereau de départ</div><div class="dl-n">#${String(b.id ?? "").slice(-6).toUpperCase() || "------"}</div></div></div>
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
${b.hasFuel ? `<div class="er"><div class="ec fu"><div class="el">⛽ Carburant${b.fuelDesc ? " — " + b.fuelDesc : ""}</div><div class="ev fv">${fmt(b.carburantAmount)} FCFA</div></div><div class="ec ${b.netRevenue >= 0 ? "np" : "nn"}"><div class="el">Résultat net</div><div class="ev ${b.netRevenue >= 0 ? "pv" : "nv"}">${b.netRevenue >= 0 ? "+" : ""}${fmt(b.netRevenue)} FCFA</div></div></div>` : `<div class="nf">⚠️ Coût carburant non renseigné — résultat net non calculable</div>`}
</div>
<div class="sc" style="margin-top:8px"><div class="st">Signatures</div></div>
<div class="sr"><div class="sb"><div class="sl">Agent guichet</div></div><div class="sb"><div class="sl">Chef d'agence</div></div><div class="sb"><div class="sl">Chauffeur</div></div></div>
<div class="ft"><div class="fb">GoBooking — Transport Ivoirien</div><div class="fd">Édité le ${now}</div></div>
</div></body></html>`;
}

/* ─── Types ─── */
type DashData = {
  agence: { id: string; name: string; city: string } | null;
  stats: { tripsToday: number; agentsActive: number; passengersToday: number; busesAvailable: number };
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
  totalRecettes: number; carburantAmount: number;
  hasFuel: boolean; netRevenue: number; fuelDesc?: string;
};
type AgenceStats = {
  colis:   { aValider: number; enGare: number; enTransit: number; arrives: number; total: number };
  alertes: { active: number };
  revenue: { today: { billets: number; colis: number; bagages: number; total: number; net: number } };
};

/* ─── Helpers ─── */
function tripSt(s: string): { label: string; color: string; bg: string } {
  const M: Record<string, { label: string; color: string; bg: string }> = {
    boarding:    { label: "Embarquement", color: C.purple, bg: C.purpleBg },
    en_route:    { label: "En route",     color: C.green,  bg: C.greenBg  },
    in_progress: { label: "En route",     color: C.green,  bg: C.greenBg  },
    arrived:     { label: "Arrivé",       color: C.blue,   bg: C.blueBg   },
    completed:   { label: "Terminé",      color: C.gray,   bg: C.grayBg   },
    cancelled:   { label: "Annulé",       color: C.red,    bg: C.redBg    },
    scheduled:   { label: "Programmé",    color: C.amber,  bg: C.amberBg  },
  };
  return M[s] ?? { label: s, color: C.gray, bg: C.grayBg };
}

/* ─── Composant : mini pill de badge ─── */
function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color }}>{label}</Text>
    </View>
  );
}

/* ─── Composant : en-tête de section ─── */
function SecHead({ title, accent, right }: { title: string; accent: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 }}>
      <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: accent }} />
      <Text style={{ fontSize: 14, fontWeight: "800", color: C.text, flex: 1, letterSpacing: -0.2 }}>{title}</Text>
      {right}
    </View>
  );
}

/* ════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════ */
export default function ChefHome() {
  const { user, token, logoutIfActiveToken } = useAuth();
  const auth = token ?? "";

  const [dash, setDash]               = useState<DashData | null>(null);
  const [trips, setTrips]             = useState<Trip[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [pendingCaisses, setCaisses]  = useState(0);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [lastSync, setLastSync]       = useState<Date | null>(null);
  const [bordereaux, setBordereaux]   = useState<Bordereau[]>([]);
  const [agenceStats, setAgenceStats] = useState<AgenceStats | null>(null);
  const [fuelModal, setFuelModal]     = useState<{ visible: boolean; trip: Bordereau | null }>({ visible: false, trip: null });
  const [fuelAmount, setFuelAmount]   = useState("");
  const [fuelDesc, setFuelDesc]       = useState("");
  const [fuelLoading, setFuelLoading] = useState(false);
  const [printingId, setPrintingId]   = useState<string | null>(null);

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
        apiFetch<{ stats: { pending: number } }>("/agent/chef/caisses", { token: auth }),
        apiFetch<AgenceStats>("/agent/chef/stats-agence", { token: auth }).catch(() => null),
      ]);
      setDash(d);
      setTrips(t.trips ?? []);
      setCaisses((cs as any).stats?.pending ?? 0);
      if (as_) setAgenceStats(as_);
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

  const submitFuel = useCallback(async () => {
    if (!fuelModal.trip) return;
    const amt = parseInt(fuelAmount);
    if (!fuelAmount || isNaN(amt) || amt <= 0) { Alert.alert("Erreur", "Montant invalide."); return; }
    setFuelLoading(true);
    try {
      await apiFetch(`/agent/chef/bordereaux/${fuelModal.trip.id}/fuel`, {
        token: auth, method: "POST",
        body: { amount: amt, description: fuelDesc || "Carburant" },
      });
      setFuelModal({ visible: false, trip: null });
      setFuelAmount(""); setFuelDesc("");
      loadBordereaux();
    } catch (e: any) { Alert.alert("Erreur", e?.message ?? "Impossible d'enregistrer."); }
    finally { setFuelLoading(false); }
  }, [fuelModal, fuelAmount, fuelDesc, auth, loadBordereaux]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadBordereaux(); }, [loadBordereaux]);
  useEffect(() => { const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);
  useOnSync(["boarding", "ticket", "reservation"], load);

  /* ── animation live ── */
  const ND = Platform.OS !== "web";
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const lp = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.25, duration: 900, useNativeDriver: ND }),
      Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: ND }),
    ]));
    lp.start(); return () => lp.stop();
  }, [pulse, ND]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  /* ── données dérivées ── */
  const firstName    = user?.name?.split(" ")[0] ?? "Chef";
  const agence       = dash?.agence;
  const stats        = dash?.stats;
  const today        = new Date().toISOString().slice(0, 10);
  const tripsToday   = trips.filter(t => t.date === today && t.status !== "cancelled");
  const upcoming     = trips.filter(t => t.date > today && t.status !== "cancelled").slice(0, 3);
  const active       = tripsToday.filter(t => ["boarding","en_route","in_progress"].includes(t.status));
  const scheduled    = tripsToday.filter(t => t.status === "scheduled");
  const done         = tripsToday.filter(t => ["arrived","completed"].includes(t.status));
  const noFuel       = bordereaux.filter(b => !b.hasFuel);
  const alerts       = agenceStats?.alertes.active ?? 0;
  const hasUrgent    = pendingCaisses > 0 || noFuel.length > 0 || alerts > 0;
  const rev          = agenceStats?.revenue.today;
  const syncTime     = lastSync ? `${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}` : null;

  /* ─── Loading / Error ─── */
  if (loading) return (
    <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.indigo} />
      <Text style={{ marginTop: 12, color: C.indigo, fontSize: 14 }}>Chargement…</Text>
    </SafeAreaView>
  );
  if (loadError) return (
    <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor: C.bg, padding:32 }}>
      <Feather name="alert-triangle" size={48} color={C.red} />
      <Text style={{ marginTop:16, fontSize:17, fontWeight:"800", color:C.text, textAlign:"center" }}>Tableau de bord indisponible</Text>
      <Text style={{ marginTop:8, fontSize:13, color:C.textSub, textAlign:"center", lineHeight:20 }}>{loadError}</Text>
      <Pressable onPress={() => { setLoading(true); load(); }} style={{ marginTop:20, backgroundColor:C.indigo, borderRadius:12, paddingHorizontal:28, paddingVertical:14 }}>
        <Text style={{ color:"#fff", fontWeight:"700", fontSize:14 }}>Réessayer</Text>
      </Pressable>
    </SafeAreaView>
  );

  /* ════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={{ flex:1, backgroundColor: C.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.indigo2} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.indigo} />}
        contentContainerStyle={{ paddingBottom: 110 }}
      >

        {/* ══ HEADER ══ */}
        <LinearGradient colors={[C.indigo2, C.indigo, "#6366F1"]} style={s.header}>
          <View style={s.headerRow}>
            <View style={{ flex:1 }}>
              <Text style={s.greeting}>Bonjour, {firstName} 👋</Text>
              <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginTop:4 }}>
                <Feather name="map-pin" size={11} color="#A5B4FC" />
                <Text style={s.agenceText}>{agence ? `${agence.name} — ${agence.city}` : "Chef d'Agence"}</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push("/agent/home" as never)} style={s.homeBtn}>
              <Feather name="grid" size={18} color="white" />
            </Pressable>
          </View>
          {/* Barre live + revenus */}
          <View style={s.headerBottom}>
            <View style={s.livePill}>
              <Animated.View style={[s.liveDot, { opacity: pulse }]} />
              <Text style={s.liveText}>{syncTime ? `Synchro ${syncTime}` : "Connexion…"}</Text>
            </View>
            {rev && rev.total > 0 && (
              <View style={s.revPill}>
                <Feather name="trending-up" size={11} color="#A5B4FC" />
                <Text style={s.revPillText}>{Math.round(rev.total / 1000)}k FCFA du jour</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ══ 1. ALERTE CRITIQUE (priorité maximale) ══ */}
        {alerts > 0 && (
          <Pressable style={s.alertBanner} onPress={() => router.push("/agent/suivi" as never)}>
            <View style={s.alertIcon}>
              <Feather name="alert-triangle" size={18} color={C.red} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={s.alertTitle}>{alerts} alerte{alerts > 1 ? "s" : ""} active{alerts > 1 ? "s" : ""} — intervention requise</Text>
              <Text style={s.alertSub}>Appuyer pour accéder au centre de suivi</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.red} />
          </Pressable>
        )}

        {/* ══ 2. KPIs — vue rapide (ligne compacte) ══ */}
        <View style={s.kpiRow}>
          {[
            { icon:"navigation" as const, val: stats?.tripsToday ?? 0,      label:"Départs",  color: C.indigo,  bg:"#EEF2FF" },
            { icon:"users"      as const, val: stats?.agentsActive ?? 0,     label:"Agents",   color: C.green,   bg: C.greenBg },
            { icon:"user"       as const, val: stats?.passengersToday ?? 0,  label:"Passagers",color: C.amber,   bg: C.amberBg },
            { icon:"truck"      as const, val: stats?.busesAvailable ?? 0,   label:"Cars dispo",color:C.blue,    bg: C.blueBg  },
          ].map((k, i) => (
            <View key={i} style={[s.kpiCard, { backgroundColor: k.bg }]}>
              <Feather name={k.icon} size={14} color={k.color} />
              <Text style={[s.kpiVal, { color: k.color }]}>{k.val}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Revenus du jour — bande synthétique */}
        {rev && (
          <View style={s.revStrip}>
            {[
              { l:"Billets",  v: rev.billets,  c: C.blue   },
              { l:"Colis",    v: rev.colis,     c: C.purple },
              { l:"Bagages",  v: rev.bagages,   c: C.green  },
            ].map((r, i) => (
              <React.Fragment key={i}>
                <View style={{ flex:1, alignItems:"center" }}>
                  <Text style={{ fontSize:9, color: C.textSub, fontWeight:"700", marginBottom:2 }}>{r.l}</Text>
                  <Text style={{ fontSize:13, fontWeight:"800", color: r.c }}>
                    {r.v > 0 ? `${Math.round(r.v/1000)}k` : "—"}
                  </Text>
                </View>
                {i < 2 && <View style={{ width:1, height:28, backgroundColor: C.border }} />}
              </React.Fragment>
            ))}
            <View style={{ width:1, height:28, backgroundColor: C.border }} />
            <View style={{ flex:1.2, alignItems:"center" }}>
              <Text style={{ fontSize:9, color: C.textSub, fontWeight:"700", marginBottom:2 }}>NET DU JOUR</Text>
              <Text style={{ fontSize:14, fontWeight:"900", color: rev.net >= 0 ? C.green : C.red }}>
                {rev.net >= 0 ? "+" : ""}{Math.round(rev.net/1000)}k
              </Text>
            </View>
          </View>
        )}

        {/* ══ 3. ACTIONS URGENTES (si présentes) ══ */}
        {hasUrgent && (
          <View style={s.section}>
            <SecHead title="Actions urgentes" accent={C.red} />

            {/* Caisses à valider */}
            {pendingCaisses > 0 && (
              <Pressable
                style={s.urgentCard}
                onPress={() => router.push({ pathname: "/agent/chef-trips", params: { tab: "caisses" } } as never)}
              >
                <View style={[s.urgentIcon, { backgroundColor: C.amberBg }]}>
                  <Feather name="dollar-sign" size={18} color={C.amber} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.urgentTitle}>{pendingCaisses} caisse{pendingCaisses > 1 ? "s" : ""} en attente de validation</Text>
                  <Text style={s.urgentSub}>Valider ou rejeter les soumissions agents</Text>
                </View>
                <View style={[s.urgentBadge, { backgroundColor: C.amber }]}>
                  <Text style={{ color:"#fff", fontWeight:"900", fontSize:14 }}>{pendingCaisses}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={C.textSub} style={{ marginLeft:4 }} />
              </Pressable>
            )}

            {/* Colis à valider */}
            {(agenceStats?.colis.aValider ?? 0) > 0 && (
              <Pressable style={[s.urgentCard, { marginTop: 8 }]} onPress={() => router.push("/agent/colis" as never)}>
                <View style={[s.urgentIcon, { backgroundColor: C.purpleBg }]}>
                  <Feather name="package" size={18} color={C.purple} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.urgentTitle}>{agenceStats!.colis.aValider} colis à valider</Text>
                  <Text style={s.urgentSub}>En gare: {agenceStats!.colis.enGare} · En transit: {agenceStats!.colis.enTransit}</Text>
                </View>
                <View style={[s.urgentBadge, { backgroundColor: C.purple }]}>
                  <Text style={{ color:"#fff", fontWeight:"900", fontSize:14 }}>{agenceStats!.colis.aValider}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={C.textSub} style={{ marginLeft:4 }} />
              </Pressable>
            )}

            {/* Bordereaux sans carburant — liste compacte */}
            {noFuel.length > 0 && (
              <View style={[s.urgentCard, { flexDirection:"column", padding:0, overflow:"hidden" }]}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:10, padding:14, paddingBottom:10 }}>
                  <View style={[s.urgentIcon, { backgroundColor:"#FFFBEB" }]}>
                    <Feather name="zap" size={18} color={C.amber} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.urgentTitle}>{noFuel.length} bordereau{noFuel.length > 1 ? "x" : ""} sans carburant</Text>
                    <Text style={s.urgentSub}>Coût carburant non renseigné — net non calculable</Text>
                  </View>
                </View>
                {noFuel.slice(0,4).map((b, i) => (
                  <View key={b.id} style={[s.fuelRow, i === 0 && { borderTopWidth:1 }]}>
                    <View style={{ flex:1 }}>
                      <Text style={s.fuelRoute}>{b.from} → {b.to}</Text>
                      <Text style={s.fuelMeta}>{b.date} · {b.departureTime} · {b.busName}</Text>
                    </View>
                    <Text style={s.fuelAmt}>{Math.round(b.totalRecettes/1000)}k FCFA</Text>
                    <Pressable
                      style={s.fuelBtn}
                      onPress={() => { setFuelModal({ visible:true, trip:b }); setFuelAmount(""); setFuelDesc(""); }}
                    >
                      <Feather name="plus" size={12} color={C.white} />
                      <Text style={s.fuelBtnText}>Carburant</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ══ 4. SUPERVISION DES OPÉRATIONS ══ */}
        <View style={s.section}>
          <SecHead
            title="Opérations du jour"
            accent={C.indigo}
            right={
              <Pressable onPress={() => router.push("/agent/chef-trips" as never)}>
                <Text style={{ fontSize:12, color: C.indigo, fontWeight:"700" }}>Gérer →</Text>
              </Pressable>
            }
          />

          {/* Départs en cours */}
          {active.length > 0 && active.map(t => {
            const pct = t.total_seats > 0 ? (t.passenger_count / t.total_seats) * 100 : 0;
            const isBoarding = t.status === "boarding";
            return (
              <View key={t.id} style={[s.activeTrip, { borderColor: isBoarding ? "#DDD6FE" : "#A7F3D0" }]}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:10 }}>
                  <View style={[s.activeDot, { backgroundColor: isBoarding ? C.purpleBg : C.greenBg }]}>
                    <Feather name={isBoarding ? "check-square" : "navigation"} size={16} color={isBoarding ? C.purple : C.green} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.activeTripRoute}>{t.from_city} → {t.to_city}</Text>
                    <Text style={[s.activeTripStatus, { color: isBoarding ? C.purple : C.green }]}>
                      {isBoarding ? "EMBARQUEMENT" : "EN ROUTE"} · {t.departure_time}
                    </Text>
                  </View>
                  <Text style={s.activeTripCount}>{t.passenger_count}<Text style={{ color: C.textSub, fontWeight:"400" }}>/{t.total_seats}</Text></Text>
                </View>
                <View style={s.fillBg}>
                  <View style={[s.fillBar, { width:`${Math.min(100,pct)}%` as any, backgroundColor: pct>=90 ? C.red : isBoarding ? C.purple : C.green }]} />
                </View>
                <Text style={{ fontSize:9, color:C.textSub, marginTop:3 }}>{t.bus_name}</Text>
              </View>
            );
          })}

          {/* Programme du jour */}
          {scheduled.length > 0 && (
            <>
              <Text style={s.miniLabel}>EN ATTENTE · {scheduled.length}</Text>
              {scheduled.map(t => (
                <View key={t.id} style={s.schedRow}>
                  <Feather name="clock" size={13} color={C.amber} />
                  <View style={{ flex:1 }}>
                    <Text style={s.schedRoute}>{t.from_city} → {t.to_city}</Text>
                    <Text style={s.schedMeta}>{t.departure_time} · {t.bus_name}</Text>
                  </View>
                  <Text style={s.schedPax}>{t.passenger_count}/{t.total_seats} pax</Text>
                </View>
              ))}
            </>
          )}

          {/* Terminés */}
          {done.length > 0 && (
            <>
              <Text style={[s.miniLabel, { marginTop:12 }]}>TERMINÉS · {done.length}</Text>
              {done.map(t => (
                <View key={t.id} style={[s.schedRow, { opacity:0.65 }]}>
                  <Feather name="check-circle" size={13} color={C.gray} />
                  <View style={{ flex:1 }}>
                    <Text style={[s.schedRoute, { color:C.gray }]}>{t.from_city} → {t.to_city}</Text>
                    <Text style={s.schedMeta}>{t.departure_time} · {t.passenger_count} pax</Text>
                  </View>
                  <Pill label="Terminé" color={C.gray} bg={C.grayBg} />
                </View>
              ))}
            </>
          )}

          {/* Aucun départ */}
          {tripsToday.length === 0 && (
            <View style={s.emptyBox}>
              <Feather name="calendar" size={24} color="#D1D5DB" />
              <Text style={s.emptyText}>Aucun départ aujourd'hui</Text>
            </View>
          )}

          {/* Prochains départs */}
          {upcoming.length > 0 && (
            <>
              <Text style={[s.miniLabel, { marginTop:14 }]}>PROCHAINS DÉPARTS</Text>
              {upcoming.map(t => (
                <View key={t.id} style={s.schedRow}>
                  <Feather name="calendar" size={13} color={C.indigo} />
                  <View style={{ flex:1 }}>
                    <Text style={s.schedRoute}>{t.from_city} → {t.to_city}</Text>
                    <Text style={s.schedMeta}>{t.date} · {t.departure_time}</Text>
                  </View>
                  <Pill label="Programmé" color={C.indigo} bg="#EEF2FF" />
                </View>
              ))}
            </>
          )}
        </View>

        {/* ══ 5. HISTORIQUE BORDEREAUX (compact) ══ */}
        {bordereaux.length > 0 && (
          <View style={s.section}>
            <SecHead
              title="Bordereaux de départ"
              accent={C.blue}
              right={
                <Text style={{ fontSize:11, color: C.textSub, fontWeight:"600" }}>{bordereaux.length} départ{bordereaux.length !== 1 ? "s" : ""}</Text>
              }
            />
            <View style={s.bordTable}>
              {bordereaux.slice(0,8).map((b, idx) => (
                <View key={b.id} style={[s.bordRow, idx === 0 && { borderTopWidth:0 }]}>
                  {/* Gauche : trajet + infos */}
                  <View style={{ flex:1, gap:3 }}>
                    <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                      <Text style={s.bordRoute}>{b.from} → {b.to}</Text>
                      {b.hasFuel
                        ? <View style={s.bordOk}><Feather name="check-circle" size={9} color={C.green} /><Text style={[s.bordPillTxt, { color:C.green }]}>Clôturé</Text></View>
                        : <View style={s.bordWarn}><Feather name="alert-circle" size={9} color={C.amber} /><Text style={[s.bordPillTxt, { color:C.amber }]}>Carburant manquant</Text></View>
                      }
                    </View>
                    <Text style={s.bordMeta}>{b.date} · {b.departureTime} · {b.busName} · {b.passengersCount} pax</Text>
                    {/* Revenus inline */}
                    <View style={{ flexDirection:"row", gap:8, marginTop:1 }}>
                      <Text style={{ fontSize:10, color:C.blue,   fontWeight:"700" }}>B {Math.round(b.ticketRevenue/1000)}k</Text>
                      <Text style={{ fontSize:10, color:C.purple, fontWeight:"700" }}>Ba {Math.round(b.bagageRevenue/1000)}k</Text>
                      <Text style={{ fontSize:10, color:C.green,  fontWeight:"700" }}>C {Math.round(b.colisRevenue/1000)}k</Text>
                      <Text style={{ fontSize:10, color:C.text,   fontWeight:"800" }}>= {Math.round(b.totalRecettes/1000)}k FCFA</Text>
                      {b.hasFuel && (
                        <Text style={{ fontSize:10, color: b.netRevenue >= 0 ? C.green : C.red, fontWeight:"800" }}>
                          · Net {b.netRevenue >= 0 ? "+" : ""}{Math.round(b.netRevenue/1000)}k
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* Droite : actions */}
                  <View style={{ gap:5, marginLeft:10, alignItems:"flex-end" }}>
                    {!b.hasFuel && (
                      <Pressable
                        style={s.bordFuelBtn}
                        onPress={() => { setFuelModal({ visible:true, trip:b }); setFuelAmount(""); setFuelDesc(""); }}
                      >
                        <Feather name="zap" size={10} color="#fff" />
                        <Text style={s.bordFuelBtnTxt}>Carburant</Text>
                      </Pressable>
                    )}
                    <Pressable style={s.bordPrintBtn} onPress={() => printBordereau(b)} disabled={printingId === b.id}>
                      {printingId === b.id
                        ? <ActivityIndicator size="small" color={C.indigo} />
                        : <Feather name="printer" size={11} color={C.indigo} />}
                      <Text style={s.bordPrintBtnTxt}>{printingId === b.id ? "…" : "Imprimer"}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Accès rapide rapport */}
        <TouchableOpacity style={s.reportBtn} onPress={() => router.push("/agent/rapport" as never)}>
          <Feather name="bar-chart-2" size={14} color={C.indigo} />
          <Text style={s.reportBtnText}>Voir les rapports de l'agence</Text>
          <Feather name="chevron-right" size={14} color={C.indigo} />
        </TouchableOpacity>

      </ScrollView>

      {/* ══ MODAL CARBURANT ══ */}
      <Modal visible={fuelModal.visible} transparent animationType="slide" onRequestClose={() => setFuelModal({ visible:false, trip:null })}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex:1, justifyContent:"flex-end" }}>
          <View style={s.modal}>
            <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <View>
                <Text style={{ fontSize:17, fontWeight:"800", color:C.text }}>⛽ Coût carburant</Text>
                {fuelModal.trip && (
                  <Text style={{ fontSize:12, color:C.textSub, marginTop:2 }}>
                    {fuelModal.trip.from} → {fuelModal.trip.to} · {fuelModal.trip.date} · {fuelModal.trip.departureTime}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setFuelModal({ visible:false, trip:null })} style={s.modalClose}>
                <Feather name="x" size={17} color={C.textSub} />
              </Pressable>
            </View>
            {fuelModal.trip && (
              <View style={{ backgroundColor:"#F8FAFF", borderRadius:10, padding:12, marginBottom:14, flexDirection:"row", justifyContent:"space-between" }}>
                <Text style={{ fontSize:13, color:C.textSub }}>Recettes à couvrir</Text>
                <Text style={{ fontSize:14, fontWeight:"800", color:C.indigo }}>{fuelModal.trip.totalRecettes.toLocaleString()} FCFA</Text>
              </View>
            )}
            <Text style={s.inputLabel}>Montant carburant (FCFA) *</Text>
            <TextInput style={s.input} placeholder="Ex: 45 000" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={fuelAmount} onChangeText={setFuelAmount} />
            <Text style={[s.inputLabel, { marginTop:12 }]}>Description (optionnel)</Text>
            <TextInput style={s.input} placeholder="Ex: Plein gasoil Bouaké" placeholderTextColor="#9CA3AF" value={fuelDesc} onChangeText={setFuelDesc} />
            <Pressable onPress={submitFuel} disabled={fuelLoading} style={[s.modalBtn, fuelLoading && { opacity:0.6 }]}>
              {fuelLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color:"#fff", fontSize:15, fontWeight:"800" }}>Valider</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ FAB ══ */}
      <Pressable style={s.fab} onPress={() => router.push("/agent/chef-trips" as never)}>
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  /* Header */
  header: { paddingHorizontal:18, paddingTop:14, paddingBottom:20 },
  headerRow: { flexDirection:"row", alignItems:"flex-start", marginBottom:10 },
  greeting: { fontSize:20, fontWeight:"800", color:"#fff" },
  agenceText: { fontSize:12, color:"#A5B4FC" },
  homeBtn: { padding:9, backgroundColor:"rgba(255,255,255,0.15)", borderRadius:10 },
  headerBottom: { flexDirection:"row", alignItems:"center", gap:10 },
  livePill: { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"rgba(255,255,255,0.12)", borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  liveDot: { width:6, height:6, borderRadius:3, backgroundColor:"#4ADE80" },
  liveText: { color:"#C7D2FE", fontSize:11, fontWeight:"600" },
  revPill: { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"rgba(255,255,255,0.12)", borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  revPillText: { color:"#C7D2FE", fontSize:11, fontWeight:"600" },

  /* Alert banner */
  alertBanner: {
    flexDirection:"row", alignItems:"center", gap:12,
    backgroundColor: C.redBg, borderBottomWidth:2, borderColor: C.redMid,
    paddingHorizontal:16, paddingVertical:12,
  },
  alertIcon: { width:36, height:36, borderRadius:10, backgroundColor:"#FECACA", alignItems:"center", justifyContent:"center" },
  alertTitle: { fontSize:13, fontWeight:"800", color:"#991B1B" },
  alertSub: { fontSize:11, color: C.red, marginTop:1 },

  /* KPIs */
  kpiRow: { flexDirection:"row", gap:8, paddingHorizontal:14, marginTop:14 },
  kpiCard: { flex:1, borderRadius:14, paddingVertical:12, alignItems:"center", gap:3 },
  kpiVal: { fontSize:22, fontWeight:"900", letterSpacing:-0.5 },
  kpiLabel: { fontSize:9, color: C.textSub, fontWeight:"600", textAlign:"center" },

  /* Revenue strip */
  revStrip: {
    flexDirection:"row", alignItems:"center",
    backgroundColor: C.white, marginHorizontal:14, marginTop:10,
    borderRadius:12, paddingVertical:12, paddingHorizontal:10,
    borderWidth:1, borderColor: C.border,
  },

  /* Section */
  section: { marginHorizontal:14, marginTop:24 },

  /* Urgent */
  urgentCard: {
    backgroundColor: C.white, borderRadius:14, padding:14,
    flexDirection:"row", alignItems:"center", gap:12,
    borderWidth:1.5, borderColor: C.amberBg,
    marginBottom:0,
  },
  urgentIcon: { width:40, height:40, borderRadius:12, alignItems:"center", justifyContent:"center" },
  urgentTitle: { fontSize:13, fontWeight:"800", color:C.text },
  urgentSub: { fontSize:11, color:C.textSub, marginTop:2 },
  urgentBadge: { borderRadius:12, minWidth:28, height:28, alignItems:"center", justifyContent:"center", paddingHorizontal:7 },

  /* Fuel rows inside urgent card */
  fuelRow: { flexDirection:"row", alignItems:"center", gap:10, paddingHorizontal:14, paddingVertical:10, borderTopWidth:1, borderColor:"#FDE68A" },
  fuelRoute: { fontSize:12, fontWeight:"700", color:C.text },
  fuelMeta: { fontSize:10, color:C.textSub, marginTop:1 },
  fuelAmt: { fontSize:12, fontWeight:"700", color:C.text },
  fuelBtn: { flexDirection:"row", alignItems:"center", gap:3, backgroundColor:C.amber, borderRadius:8, paddingHorizontal:8, paddingVertical:5 },
  fuelBtnText: { fontSize:10, fontWeight:"700", color:"#fff" },

  /* Active trips */
  activeTrip: {
    backgroundColor: C.white, borderRadius:14, padding:13, marginBottom:8,
    borderWidth:2,
  },
  activeDot: { width:34, height:34, borderRadius:10, alignItems:"center", justifyContent:"center" },
  activeTripRoute: { fontSize:14, fontWeight:"800", color:C.text },
  activeTripStatus: { fontSize:10, fontWeight:"700", marginTop:2 },
  activeTripCount: { fontSize:16, fontWeight:"900", color:C.text },
  fillBg: { height:4, backgroundColor:"#F3F4F6", borderRadius:2, marginTop:8, overflow:"hidden" },
  fillBar: { height:4, borderRadius:2 },

  /* Scheduled rows */
  miniLabel: { fontSize:9, fontWeight:"800", color:"#9CA3AF", letterSpacing:1.2, marginBottom:6 },
  schedRow: {
    flexDirection:"row", alignItems:"center", gap:10,
    backgroundColor: C.white, borderRadius:12, paddingHorizontal:13, paddingVertical:10, marginBottom:5,
    borderWidth:1, borderColor: C.border,
  },
  schedRoute: { fontSize:13, fontWeight:"700", color:C.text },
  schedMeta: { fontSize:10, color:C.textSub, marginTop:1 },
  schedPax: { fontSize:11, color:C.textSub, fontWeight:"600" },

  /* Empty */
  emptyBox: { backgroundColor:C.white, borderRadius:14, padding:24, alignItems:"center", gap:8, borderWidth:1, borderColor: C.border },
  emptyText: { color:"#9CA3AF", fontSize:13 },

  /* Bordereaux table */
  bordTable: { backgroundColor:C.white, borderRadius:14, borderWidth:1, borderColor: C.border, overflow:"hidden" },
  bordRow: { flexDirection:"row", alignItems:"center", paddingHorizontal:14, paddingVertical:12, borderTopWidth:1, borderColor: C.border },
  bordRoute: { fontSize:13, fontWeight:"700", color:C.text },
  bordMeta: { fontSize:10, color:C.textSub, marginTop:1 },
  bordOk: { flexDirection:"row", alignItems:"center", gap:3, backgroundColor:C.greenBg, borderRadius:20, paddingHorizontal:6, paddingVertical:2 },
  bordWarn: { flexDirection:"row", alignItems:"center", gap:3, backgroundColor:C.amberBg, borderRadius:20, paddingHorizontal:6, paddingVertical:2 },
  bordPillTxt: { fontSize:9, fontWeight:"700" },
  bordFuelBtn: { flexDirection:"row", alignItems:"center", gap:3, backgroundColor:C.amber, borderRadius:8, paddingHorizontal:8, paddingVertical:5 },
  bordFuelBtnTxt: { fontSize:10, fontWeight:"700", color:"#fff" },
  bordPrintBtn: { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"#EEF2FF", borderRadius:8, paddingHorizontal:8, paddingVertical:5 },
  bordPrintBtnTxt: { fontSize:10, fontWeight:"700", color:C.indigo },

  /* Report */
  reportBtn: {
    flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8,
    marginHorizontal:14, marginTop:10, paddingVertical:13,
    backgroundColor:C.white, borderRadius:12, borderWidth:1, borderColor: C.border,
  },
  reportBtnText: { fontSize:13, fontWeight:"700", color:C.indigo, flex:1, textAlign:"center" },

  /* Modal */
  modal: { backgroundColor:C.white, borderTopLeftRadius:22, borderTopRightRadius:22, padding:22 },
  modalClose: { width:34, height:34, borderRadius:9, backgroundColor: C.grayBg, alignItems:"center", justifyContent:"center" },
  inputLabel: { fontSize:13, fontWeight:"600", color:C.text, marginBottom:6 },
  input: { borderWidth:1.5, borderColor: C.border, borderRadius:12, padding:13, fontSize:15, fontWeight:"700", color:C.text },
  modalBtn: { backgroundColor:C.indigo, borderRadius:14, paddingVertical:15, alignItems:"center", marginTop:14 },

  /* FAB */
  fab: { position:"absolute", bottom:26, right:18, width:54, height:54, borderRadius:27, backgroundColor:C.indigo, justifyContent:"center", alignItems:"center", elevation:6 },
});
