/**
 * RÉSERVATIONS EN LIGNE — DASHBOARD 3 NIVEAUX v5
 *
 * Logique métier terrain :
 *   NIVEAU 1 — Sélection agence (cartes avec badge)
 *   NIVEAU 2 — Départs de l'agence (groupés par état)
 *   NIVEAU 3 — Réservations du départ (expandables, actions)
 *
 * Auto-expand : les trajets avec des réservations EN ATTENTE sont
 *   ouverts automatiquement. Les autres sont refermés.
 */

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Image, Linking, Modal,
  Platform, Pressable, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth }  from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const IS_WEB = Platform.OS === "web";

/* ══════════════════════════════════════════
   PALETTE
══════════════════════════════════════════ */
const C = {
  teal:    "#0E7490", tealDk: "#0C6B82", tealLt: "#CFFAFE", tealSoft:"#F0FDFF",
  amber:   "#D97706", amberLt:"#FEF3C7", amberSoft:"#FFFBEB",
  purple:  "#7C3AED", purpleLt:"#EDE9FE",
  green:   "#059669", greenLt: "#D1FAE5", greenSoft:"#ECFDF5",
  slate:   "#64748B", slateLt: "#F1F5F9",
  red:     "#DC2626", redLt:   "#FEE2E2",
  ink:     "#0F172A", sub:     "#64748B",
  border:  "#E2E8F0", bg:      "#F1F5F9", white:"#FFFFFF",
};

/* ══════════════════════════════════════════
   TYPES
══════════════════════════════════════════ */
interface Agence { id:string; name:string; city:string }

interface TripInfo {
  id:string; from:string; to:string; date:string;
  departureTime:string; busName:string; status?:string;
  guichetSeats:number; onlineSeats:number; totalSeats:number;
  /* Real-time seat data enriched by API */
  totalConfirmed?:number;  totalPending?:number;
  onlineConfirmed?:number; onlinePending?:number;
  totalAvailable?:number;  onlineAvailable?:number;
  isEnRoute?:boolean;
  agenceName?:string|null; agenceCity?:string|null;
}

interface BagItem {
  photoUrl:string|null; type:string|null;
  description:string|null; status:string|null; price:number;
}

interface Booking {
  id:string; bookingRef:string; status:string;
  bookingSource:string|null; totalAmount:number;
  paymentMethod:string; contactPhone:string;
  passengers:{name:string;age?:number}[];
  seatNumbers:string[]; createdAt:string;
  baggageCount:number; baggageType:string|null;
  baggageDescription:string|null;
  bagageStatus:string|null; bagagePrice:number;
  bagageItems:BagItem[];
  trip:TripInfo|null;
}

type EtatF = "all"|"scheduled"|"boarding"|"active"|"done";

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
const isActive    = (s?:string) => s==="en_route"||s==="in_progress";
const isBoarding  = (s?:string) => s==="boarding";
const isScheduled = (s?:string) => !s||s==="scheduled";
const isDone      = (s?:string) => s==="arrived"||s==="completed"||s==="cancelled";

function etatOrder(s?:string){
  if(isActive(s))   return 0;
  if(isBoarding(s)) return 1;
  if(isScheduled(s))return 2;
  return 3;
}

interface EtatDef {
  fKey:EtatF; label:string; short:string; icon:string;
  color:string; softBg:string; grad:[string,string];
}
const ETATS:EtatDef[] = [
  {fKey:"active",    label:"En route", short:"EN ROUTE", icon:"navigation",  color:C.green,  softBg:C.greenSoft, grad:["#059669","#047857"]},
  {fKey:"boarding",  label:"En gare",  short:"EN GARE",  icon:"user-check",  color:C.purple, softBg:C.purpleLt,  grad:["#7C3AED","#6D28D9"]},
  {fKey:"scheduled", label:"À venir",  short:"À VENIR",  icon:"clock",       color:C.amber,  softBg:C.amberSoft, grad:["#D97706","#B45309"]},
  {fKey:"done",      label:"Terminés", short:"TERMINÉ",  icon:"check-circle",color:C.slate,  softBg:C.slateLt,   grad:["#64748B","#475569"]},
];

function getEtat(s?:string):EtatDef {
  if(isActive(s))   return ETATS[0];
  if(isBoarding(s)) return ETATS[1];
  if(isDone(s))     return ETATS[3];
  return ETATS[2];
}

function bkMeta(s:string){
  if(s==="pending")   return {label:"En attente",color:C.amber, bg:C.amberSoft};
  if(s==="confirmed") return {label:"Confirmé",  color:C.green, bg:C.greenLt  };
  if(s==="boarded")   return {label:"Embarqué",  color:C.purple,bg:C.purpleLt };
  if(s==="cancelled") return {label:"Annulé",    color:C.red,   bg:C.redLt    };
  return {label:s, color:C.sub, bg:"#F3F4F6"};
}

function payShort(p:string){ return p==="mobile_money"?"📱":p==="card"?"💳":p==="cash"?"💵":"—"; }
function payLabel(p:string){ return p==="mobile_money"?"📱 Mobile Money":p==="card"?"💳 Carte":p==="cash"?"💵 Espèces":p; }

function cityMatch(from?:string|null, city?:string){
  if(!from||!city) return false;
  return from.toLowerCase().includes(city.toLowerCase())||city.toLowerCase().includes(from.toLowerCase());
}

function fmtDate(iso:string){
  try{ return new Date(iso).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}); }
  catch{ return iso; }
}

/* ══════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════ */
export default function AgentReservation(){
  const {token, logoutIfActiveToken} = useAuth();

  const [agencies,   setAgencies]   = useState<Agence[]>([]);
  const [myAgence,   setMyAgence]   = useState<Agence|null>(null);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync,   setLastSync]   = useState<Date|null>(null);

  /* Navigation state */
  const [selAgence,    setSelAgence]    = useState<string|null>(null);  // null = toutes
  const [etatFilter,   setEtatFilter]   = useState<EtatF>("all");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  /* Detail / actions */
  const [detail,       setDetail]       = useState<Booking|null>(null);
  const [confirming,   setConfirming]   = useState<string|null>(null);
  const [cancelModal,  setCancelModal]  = useState<Booking|null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling,   setCancelling]   = useState<string|null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const pulse   = useRef(new Animated.Value(1)).current;

  /* ── Chargement ──────────────────────────────────────────── */
  const load = useCallback(async(silent=false)=>{
    if(!silent) setLoading(true);
    try{
      const data = await apiFetch<any>("/agent/online-bookings",{token:token??undefined});
      let ags:Agence[] = [], myAg:Agence|null = null, bks:Booking[] = [];
      if(Array.isArray(data)){
        bks = data;
      } else {
        ags  = Array.isArray(data?.agencies) ? data.agencies : [];
        myAg = data?.myAgence ?? null;
        bks  = Array.isArray(data?.bookings) ? data.bookings : [];
      }
      setAgencies(ags);
      setMyAgence(myAg);
      setBookings(bks);
      setLastSync(new Date());

      /* Auto-expand trajets avec des réservations en attente */
      const toExpand = new Set<string>();
      bks.forEach(b => {
        if(b.status==="pending" && b.trip?.id) toExpand.add(b.trip.id);
      });
      setExpandedKeys(toExpand);
    }catch(e:any){
      if(e?.httpStatus===401){ logoutIfActiveToken(token??""); return; }
      if(!silent) Alert.alert("Erreur", e?.message ?? "Impossible de charger");
    }finally{
      setLoading(false); setRefreshing(false);
    }
  },[token]);

  useEffect(()=>{
    load();
    pollRef.current = setInterval(()=>load(true), 30_000);
    return ()=>{ if(pollRef.current) clearInterval(pollRef.current); };
  },[load]);

  useEffect(()=>{
    if(myAgence && selAgence===null) setSelAgence(myAgence.id);
  },[myAgence]);

  /* ── Pulsation badge attente ─────────────────────────────── */
  const totalPending = bookings.filter(b=>b.status==="pending").length;
  useEffect(()=>{
    if(totalPending>0){
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse,{toValue:1.18,duration:700,useNativeDriver:true}),
        Animated.timing(pulse,{toValue:1,   duration:700,useNativeDriver:true}),
      ]));
      loop.start(); return ()=>loop.stop();
    }
    pulse.setValue(1);
  },[totalPending]);

  /* ── Calculs par agence ───────────────────────────────────── */
  function agCounts(ag:Agence|null){ // null = toutes
    const bks = ag ? bookings.filter(b=>cityMatch(b.trip?.from,ag.city)) : bookings;
    return {
      total:  bks.length,
      pending: bks.filter(b=>b.status==="pending").length,
    };
  }

  /* Bookings filtrés par agence sélectionnée */
  const agObj = agencies.find(a=>a.id===selAgence) ?? null;
  const scoped = selAgence&&agObj
    ? bookings.filter(b=>cityMatch(b.trip?.from,agObj.city))
    : bookings;

  /* Filtres d'état */
  const displayed = scoped.filter(b=>{
    const ts=b.trip?.status;
    if(etatFilter==="active"   &&!isActive(ts))   return false;
    if(etatFilter==="boarding" &&!isBoarding(ts)) return false;
    if(etatFilter==="scheduled"&&!isScheduled(ts))return false;
    if(etatFilter==="done"     &&!isDone(ts))     return false;
    return true;
  });

  /* Regroupement par trajet */
  type Group = {key:string; trip:TripInfo|null; bks:Booking[]};
  const groups:Group[] = [];
  displayed.forEach(b=>{
    const k = b.trip?.id ?? "__none__";
    let g = groups.find(x=>x.key===k);
    if(!g){ g={key:k,trip:b.trip??null,bks:[]}; groups.push(g); }
    g.bks.push(b);
  });
  groups.sort((a,b)=>{
    const d = etatOrder(a.trip?.status)-etatOrder(b.trip?.status);
    if(d!==0) return d;
    const aPend = a.bks.some(x=>x.status==="pending")?0:1;
    const bPend = b.bks.some(x=>x.status==="pending")?0:1;
    return aPend-bPend;
  });

  /* Compteurs état pour les chips */
  const etatCounts = ETATS.map(e=>({
    ...e, count: scoped.filter(b=>{
      const ts=b.trip?.status;
      if(e.fKey==="active")   return isActive(ts);
      if(e.fKey==="boarding") return isBoarding(ts);
      if(e.fKey==="scheduled")return isScheduled(ts);
      return isDone(ts);
    }).length,
  }));

  const syncStr = lastSync
    ? `Sync ${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}`
    : "";

  /* ── Actions ─────────────────────────────────────────────── */
  const toggleExpand = (key:string) => {
    setExpandedKeys(prev=>{
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const confirmBooking = (b:Booking) => {
    setDetail(null);
    Alert.alert(
      "Confirmer",
      `${b.passengers[0]?.name ?? "Client"}\n${b.bookingRef} · ${(b.totalAmount??0).toLocaleString()} FCFA`,
      [
        {text:"Annuler",style:"cancel"},
        {text:"✓ Confirmer",onPress:async()=>{
          setConfirming(b.id);
          try{
            await apiFetch(`/agent/online-bookings/${b.id}/confirm`,{token:token??undefined,method:"POST",body:{}});
            await load(true);
          }catch(e:any){ Alert.alert("Erreur",e?.message??"Impossible"); }
          finally{ setConfirming(null); }
        }},
      ]
    );
  };

  const doCancel = async () => {
    if(!cancelModal) return;
    setCancelling(cancelModal.id);
    try{
      await apiFetch(`/agent/online-bookings/${cancelModal.id}/cancel`,{
        token:token??undefined, method:"POST",
        body:{reason:cancelReason||undefined},
      });
      setCancelModal(null); setCancelReason(""); setDetail(null);
      await load(true);
    }catch(e:any){ Alert.alert("Erreur",e?.message??"Impossible"); }
    finally{ setCancelling(null); }
  };

  /* ══════════════════════════════════════════════════════════
     RENDU
  ═══════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDk}/>

      {/* ══════ HEADER ══════ */}
      <LinearGradient colors={[C.tealDk, C.teal]} style={s.header}>
        <Pressable style={s.hBack}
          onPress={()=>router.canGoBack()?router.back():router.replace("/agent/home" as never)}
          hitSlop={12}>
          <Feather name="arrow-left" size={20} color="#fff"/>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={s.hTitle}>Réservations en ligne</Text>
          <Text style={s.hSub}>{syncStr || "Chargement…"}</Text>
        </View>
        {totalPending>0&&(
          <Animated.View style={[s.hBadge,{transform:[{scale:pulse}]}]}>
            <Text style={s.hBadgeN}>{totalPending}</Text>
            <Text style={s.hBadgeL}>à traiter</Text>
          </Animated.View>
        )}
        <Pressable style={s.hRefBtn} onPress={()=>load()} hitSlop={8}>
          <Feather name="refresh-cw" size={14} color="#fff"/>
        </Pressable>
      </LinearGradient>

      {/* ══════ NIVEAU 1 : AGENCES ══════ */}
      <View style={s.agSection}>
        <Text style={s.lvlLabel}>AGENCES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.agRow}>

          {/* Carte "Toutes" */}
          {(()=>{
            const {total,pending} = agCounts(null);
            const on = selAgence===null;
            return (
              <Pressable key="__all__"
                style={[s.agCard, on&&{backgroundColor:C.teal,borderColor:C.teal}]}
                onPress={()=>setSelAgence(null)}>
                <View style={s.agCardTop}>
                  <View style={[s.agCardIcon,{backgroundColor:on?"rgba(255,255,255,0.2)":C.tealSoft}]}>
                    <Feather name="grid" size={14} color={on?"#fff":C.teal}/>
                  </View>
                  {pending>0&&(
                    <View style={[s.agCardBadge,{backgroundColor:on?"rgba(255,255,255,0.3)":"rgba(217,119,6,0.12)"}]}>
                      <Text style={[s.agCardBadgeTxt,{color:on?"#fff":C.amber}]}>{pending}⚡</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.agCardName,on&&{color:"#fff"}]} numberOfLines={1}>Toutes</Text>
                <Text style={[s.agCardCount,on&&{color:"rgba(255,255,255,0.75)"}]}>{total} rés.</Text>
              </Pressable>
            );
          })()}

          {agencies.map(ag=>{
            const {total,pending} = agCounts(ag);
            const on   = selAgence===ag.id;
            const mine = myAgence?.id===ag.id;
            return (
              <Pressable key={ag.id}
                style={[s.agCard, on&&{backgroundColor:C.teal,borderColor:C.teal}]}
                onPress={()=>setSelAgence(ag.id)}>
                <View style={s.agCardTop}>
                  <View style={[s.agCardIcon,{backgroundColor:on?"rgba(255,255,255,0.2)":C.tealSoft}]}>
                    <Feather name="map-pin" size={14} color={on?"#fff":C.teal}/>
                  </View>
                  {pending>0&&(
                    <Animated.View style={[s.agCardBadge,
                      {backgroundColor:on?"rgba(255,255,255,0.3)":"rgba(217,119,6,0.12)"},
                      mine&&{transform:[{scale:pulse}]}]}>
                      <Text style={[s.agCardBadgeTxt,{color:on?"#fff":C.amber}]}>{pending}⚡</Text>
                    </Animated.View>
                  )}
                </View>
                <Text style={[s.agCardName,on&&{color:"#fff"}]} numberOfLines={1}>{ag.name}</Text>
                <Text style={[s.agCardCount,on&&{color:"rgba(255,255,255,0.75)"}]}>
                  {ag.city} · {total} rés.
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ══════ NIVEAU 2 : DÉPARTS (filtre état) ══════ */}
      <View style={s.etatSection}>
        <Text style={s.lvlLabel}>ÉTAT DU DÉPART</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.etatRow}>
          <Pressable
            style={[s.etatChip, etatFilter==="all"&&{backgroundColor:C.teal,borderColor:C.teal}]}
            onPress={()=>setEtatFilter("all")}>
            <Text style={[s.etatChipTxt, etatFilter==="all"&&{color:"#fff"}]}>Tous · {scoped.length}</Text>
          </Pressable>
          {etatCounts.map(e=>{
            const on = etatFilter===e.fKey;
            return(
              <Pressable key={e.fKey}
                style={[s.etatChip, on&&{backgroundColor:e.color,borderColor:e.color}]}
                onPress={()=>setEtatFilter(etatFilter===e.fKey?"all":e.fKey)}>
                <Feather name={e.icon as any} size={11} color={on?"#fff":e.color}/>
                <Text style={[s.etatChipTxt, on&&{color:"#fff"}, !on&&{color:e.color}]}>
                  {e.label} · {e.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ══════ NIVEAU 3 : RÉSERVATIONS ══════ */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.teal}/>
          <Text style={s.centerTxt}>Chargement des réservations…</Text>
        </View>
      ) : groups.length===0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><Feather name="inbox" size={26} color={C.teal}/></View>
          <Text style={s.emptyTitle}>Aucune réservation</Text>
          <Text style={s.emptySub}>
            {etatFilter!=="all"
              ? "Pas de départ dans cet état pour cette agence"
              : "Aucune réservation pour l'agence sélectionnée"}
          </Text>
          <Pressable style={s.resetBtn}
            onPress={()=>{ setEtatFilter("all"); setSelAgence(null); }}>
            <Text style={s.resetBtnTxt}>Afficher tout</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={{flex:1}}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={C.teal}/>}>

          {/* Résumé */}
          <View style={s.summaryRow}>
            <Text style={s.summaryTxt}>
              {displayed.length} réservation{displayed.length>1?"s":""}
              {" · "}{groups.length} départ{groups.length>1?"s":""}
            </Text>
          </View>

          {/* ── BLOCS TRAJETS ── */}
          {groups.map(group=>{
            const trip     = group.trip;
            const etat     = getEtat(trip?.status);
            const expanded = expandedKeys.has(group.key);

            const gPend = group.bks.filter(b=>b.status==="pending").length;
            const gConf = group.bks.filter(b=>b.status==="confirmed"||b.status==="boarded").length;
            const gCan  = group.bks.filter(b=>b.status==="cancelled").length;

            /* Places disponibles — utilise les vraies données de l'API */
            const totalSeats       = trip?.totalSeats      ?? 0;
            const totalConfirmed   = trip?.totalConfirmed  ?? 0;
            const onlineAvailable  = trip?.onlineAvailable ?? 0;
            const totalAvailable   = trip?.totalAvailable  ?? (totalSeats - totalConfirmed);
            const enRoute          = trip?.isEnRoute       ?? false;

            return (
              <View key={group.key} style={[s.tripCard, gPend>0&&s.tripCardPend]}>

                {/* ── HEADER TRAJET (tapable) ── */}
                <Pressable
                  style={[s.tripHeader, {borderLeftColor:etat.color}]}
                  onPress={()=>toggleExpand(group.key)}>

                  <LinearGradient
                    colors={[etat.grad[0]+"22", "transparent"]}
                    style={s.tripHeaderGrad}>

                    {/* Ligne 1 : BADGE ÉTAT + VILLES + FLÈCHE EXPAND */}
                    <View style={s.th1}>
                      <View style={[s.etatBadge,{backgroundColor:etat.color}]}>
                        <Feather name={etat.icon as any} size={9} color="#fff"/>
                        <Text style={s.etatBadgeTxt}>{etat.short}</Text>
                      </View>
                      <Text style={s.thRoute} numberOfLines={1}>
                        {trip ? `${trip.from} → ${trip.to}` : "Trajet non précisé"}
                      </Text>
                      <Feather name={expanded?"chevron-up":"chevron-down"} size={16} color={C.sub}/>
                    </View>

                    {/* Ligne 2 : HEURE · BUS · AGENCE */}
                    {trip&&(
                      <View style={s.th2}>
                        <Feather name="clock" size={10} color={C.sub}/>
                        <Text style={s.thTime}>{trip.departureTime} · {fmtDate(trip.date)}</Text>
                        <View style={s.thDivider}/>
                        <Feather name="truck" size={10} color={etat.color}/>
                        <Text style={[s.thBus,{color:etat.color}]}>{trip.busName}</Text>
                        {trip.agenceName&&<>
                          <View style={s.thDivider}/>
                          <Feather name="map-pin" size={9} color={C.sub}/>
                          <Text style={s.thAgence}>{trip.agenceName}</Text>
                        </>}
                      </View>
                    )}

                    {/* Ligne 3 : COMPTEURS */}
                    <View style={s.th3}>
                      {/* Places — données temps réel */}
                      {totalSeats>0&&(
                        <View style={s.thCountBox}>
                          <Feather name="users" size={9} color={C.sub}/>
                          <Text style={s.thCountTxt}>
                            {totalConfirmed}/{totalSeats} places
                            {enRoute
                              ? <Text style={{color:C.green}}> · {totalAvailable} libres (tous canaux)</Text>
                              : onlineAvailable>0
                                ? <Text style={{color:C.teal}}> · {onlineAvailable} en ligne</Text>
                                : <Text style={{color:C.red}}> · Complet</Text>
                            }
                          </Text>
                        </View>
                      )}
                      {/* Badge "En route → toutes places online" */}
                      {enRoute&&totalAvailable>0&&(
                        <View style={[s.thCnt,{backgroundColor:"rgba(5,150,105,0.12)",borderColor:"rgba(5,150,105,0.3)"}]}>
                          <Text style={[s.thCntTxt,{color:C.green}]}>🌐 En ligne</Text>
                        </View>
                      )}
                      <View style={{flex:1}}/>
                      {gPend>0&&(
                        <View style={[s.thCnt,{backgroundColor:C.amberSoft,borderColor:C.amberLt}]}>
                          <Text style={[s.thCntTxt,{color:C.amber}]}>⚡ {gPend} att.</Text>
                        </View>
                      )}
                      {gConf>0&&(
                        <View style={[s.thCnt,{backgroundColor:C.greenSoft,borderColor:C.greenLt}]}>
                          <Text style={[s.thCntTxt,{color:C.green}]}>✓ {gConf} conf.</Text>
                        </View>
                      )}
                      {gCan>0&&(
                        <View style={[s.thCnt,{backgroundColor:C.redLt,borderColor:"#FECACA"}]}>
                          <Text style={[s.thCntTxt,{color:C.red}]}>✗ {gCan} ann.</Text>
                        </View>
                      )}
                    </View>

                  </LinearGradient>
                </Pressable>

                {/* ── LISTE PASSAGERS (visible si expanded) ── */}
                {expanded && (
                  <View style={s.bkList}>
                    {group.bks.map((b,idx)=>{
                      const bk     = bkMeta(b.status);
                      const isPend = b.status==="pending";
                      const isConf = confirming===b.id;
                      const name   = b.passengers?.[0]?.name ?? "Client";
                      const seat   = b.seatNumbers?.length ? b.seatNumbers.slice(0,2).join(", ") : "—";
                      const hasBag = b.baggageCount>0;

                      return (
                        <View key={b.id}>
                          {idx>0&&<View style={s.bkDiv}/>}
                          <Pressable
                            style={[s.bkRow, isPend&&{backgroundColor:"#FFFBEB"}]}
                            onPress={()=>setDetail(b)}>

                            {/* Initiale colorée */}
                            <View style={[s.bkAv,{backgroundColor:bk.bg}]}>
                              <Text style={[s.bkAvTxt,{color:bk.color}]}>
                                {name.charAt(0).toUpperCase()}
                              </Text>
                            </View>

                            {/* Infos passager */}
                            <View style={s.bkInfo}>
                              <View style={s.bkNameRow}>
                                <Text style={s.bkName} numberOfLines={1}>{name}</Text>
                                {hasBag&&<View style={s.bkBagDot}><Feather name="package" size={9} color={C.purple}/></View>}
                                {b.contactPhone&&<View style={s.bkPhoneDot}><Feather name="phone" size={9} color={C.teal}/></View>}
                              </View>
                              <Text style={s.bkSub}>{seat} · {payShort(b.paymentMethod)} · {b.bookingRef}</Text>
                            </View>

                            {/* Montant */}
                            <Text style={s.bkAmt}>{(b.totalAmount??0).toLocaleString()} F</Text>

                            {/* Action / statut */}
                            {isPend ? (
                              isConf ? (
                                <ActivityIndicator size="small" color={C.green}/>
                              ) : (
                                <View style={s.bkBtns}>
                                  <Pressable style={s.btnConf}
                                    onPress={e=>{e.stopPropagation?.();confirmBooking(b);}}>
                                    <Feather name="check" size={13} color="#fff"/>
                                  </Pressable>
                                  <Pressable style={s.btnCan}
                                    onPress={e=>{e.stopPropagation?.();setCancelModal(b);setCancelReason("");}}>
                                    <Feather name="x" size={13} color={C.red}/>
                                  </Pressable>
                                </View>
                              )
                            ) : (
                              <View style={[s.bkPill,{backgroundColor:bk.bg}]}>
                                <Text style={[s.bkPillTxt,{color:bk.color}]}>{bk.label}</Text>
                              </View>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          <View style={{height:60}}/>
        </ScrollView>
      )}

      {/* ══════ MODAL : DÉTAIL PASSAGER ══════ */}
      <Modal visible={!!detail} transparent animationType="slide"
        onRequestClose={()=>setDetail(null)}>
        <Pressable style={s.overlay} onPress={()=>setDetail(null)}>
          <Pressable style={s.detailSheet} onPress={e=>e.stopPropagation?.()}>
            {detail&&(
              <PassengerDetail
                booking={detail}
                onConfirm={()=>confirmBooking(detail)}
                onCancel={()=>{setDetail(null);setTimeout(()=>{setCancelModal(detail);setCancelReason("")},300);}}
                onClose={()=>setDetail(null)}
                confirming={confirming===detail.id}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════ MODAL : ANNULATION ══════ */}
      <Modal visible={!!cancelModal} transparent animationType="slide"
        onRequestClose={()=>setCancelModal(null)}>
        <View style={s.overlay}>
          <View style={s.cancelSheet}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>Annuler la réservation</Text>
            <Text style={s.cancelRef}>
              {cancelModal?.bookingRef} · {cancelModal?.passengers?.[0]?.name}
            </Text>
            <TextInput style={s.cancelInput}
              placeholder="Motif d'annulation (optionnel)"
              placeholderTextColor={C.sub}
              value={cancelReason} onChangeText={setCancelReason}
              multiline numberOfLines={2}/>
            <Pressable style={[s.cancelConfBtn, !!cancelling&&{opacity:0.6}]}
              onPress={doCancel} disabled={!!cancelling}>
              {cancelling===cancelModal?.id
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.cancelConfTxt}>Confirmer l'annulation</Text>}
            </Pressable>
            <Pressable style={s.cancelKeepBtn} onPress={()=>setCancelModal(null)}>
              <Text style={s.cancelKeepTxt}>Garder la réservation</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════
   DÉTAIL PASSAGER (bottom sheet)
══════════════════════════════════════════ */
function PassengerDetail({booking,onConfirm,onCancel,onClose,confirming}:{
  booking:Booking; onConfirm:()=>void; onCancel:()=>void;
  onClose:()=>void; confirming:boolean;
}){
  const bk     = bkMeta(booking.status);
  const isPend = booking.status==="pending";
  const name   = booking.passengers?.[0]?.name ?? "Client";
  const hasBag = booking.baggageCount>0;
  const items  = booking.bagageItems ?? [];
  const mainPh = items.find(i=>i.photoUrl)?.photoUrl ?? null;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={ds.handle}><View style={ds.handleBar}/></View>

      {/* En-tête */}
      <View style={ds.head}>
        <View style={[ds.av,{backgroundColor:bk.bg}]}>
          <Text style={[ds.avTxt,{color:bk.color}]}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={ds.name}>{name}</Text>
          <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
            <View style={[ds.pill,{backgroundColor:bk.bg}]}>
              <Text style={[ds.pillTxt,{color:bk.color}]}>{bk.label}</Text>
            </View>
            <Text style={ds.ref}>{booking.bookingRef}</Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Feather name="x-circle" size={22} color={C.sub}/>
        </Pressable>
      </View>

      {/* TRAJET */}
      {booking.trip&&(
        <View style={ds.section}>
          <Text style={ds.sLabel}>TRAJET</Text>
          <View style={ds.card}>
            <View style={ds.row}>
              <Feather name="navigation" size={13} color={C.teal}/>
              <Text style={ds.rowBold}>{booking.trip.from} → {booking.trip.to}</Text>
            </View>
            <View style={ds.row}>
              <Feather name="clock" size={12} color={C.sub}/>
              <Text style={ds.rowTxt}>{booking.trip.departureTime} · {booking.trip.date}</Text>
            </View>
            <View style={ds.row}>
              <Feather name="truck" size={12} color={C.sub}/>
              <Text style={ds.rowTxt}>{booking.trip.busName}
                {booking.trip.agenceName?` · ${booking.trip.agenceName}`:""}</Text>
            </View>
          </View>
        </View>
      )}

      {/* PASSAGER & SIÈGE */}
      <View style={ds.section}>
        <Text style={ds.sLabel}>PASSAGER & SIÈGE</Text>
        <View style={ds.card}>
          {booking.passengers.map((p,i)=>(
            <View key={i} style={ds.row}>
              <Feather name="user" size={12} color={C.sub}/>
              <Text style={ds.rowBold}>{p.name}</Text>
              {booking.seatNumbers[i]&&(
                <View style={ds.seatBadge}>
                  <Text style={ds.seatTxt}>Siège {booking.seatNumbers[i]}</Text>
                </View>
              )}
            </View>
          ))}
          {booking.contactPhone ? (
            <Pressable style={ds.phoneBtn}
              onPress={()=>Linking.openURL(`tel:${booking.contactPhone.replace(/\s/g,"")}`)} >
              <Feather name="phone" size={14} color={C.teal}/>
              <Text style={ds.phoneTxt}>{booking.contactPhone}</Text>
              <View style={ds.callBtn}><Text style={ds.callTxt}>Appeler</Text></View>
            </Pressable>
          ) : (
            <View style={ds.row}>
              <Feather name="phone-off" size={12} color={C.sub}/>
              <Text style={[ds.rowTxt,{color:C.sub}]}>Téléphone non renseigné</Text>
            </View>
          )}
        </View>
      </View>

      {/* PAIEMENT */}
      <View style={ds.section}>
        <Text style={ds.sLabel}>PAIEMENT</Text>
        <View style={[ds.card,{flexDirection:"row",alignItems:"center"}]}>
          <View style={{flex:1}}>
            <Text style={ds.amount}>{(booking.totalAmount??0).toLocaleString()} FCFA</Text>
            <Text style={ds.method}>{payLabel(booking.paymentMethod)}</Text>
          </View>
          <View style={[ds.pill,{backgroundColor:bk.bg}]}>
            <Text style={[ds.pillTxt,{color:bk.color}]}>{bk.label}</Text>
          </View>
        </View>
      </View>

      {/* BAGAGES */}
      {hasBag&&(
        <View style={ds.section}>
          <Text style={ds.sLabel}>BAGAGES — {booking.baggageCount} article{booking.baggageCount>1?"s":""}</Text>
          {mainPh ? (
            <View style={ds.photoWrap}>
              <Image source={{uri:mainPh}} style={ds.photo} resizeMode="cover"/>
              <View style={ds.photoOv}>
                <Feather name="package" size={12} color="#fff"/>
                <Text style={ds.photoLbl}>{booking.baggageType??"Bagage"}</Text>
                {booking.bagageStatus&&<Text style={ds.photoLbl}>· {booking.bagageStatus}</Text>}
              </View>
            </View>
          ):(
            <View style={ds.photoPlaceholder}>
              <Feather name="package" size={28} color={C.purple}/>
              <Text style={ds.photoPlaceholderTxt}>Aucune photo disponible</Text>
            </View>
          )}
          {booking.baggageDescription&&(
            <View style={ds.row}>
              <Feather name="info" size={12} color={C.sub}/>
              <Text style={ds.rowTxt}>{booking.baggageDescription}</Text>
            </View>
          )}
          {booking.bagagePrice>0&&(
            <View style={ds.row}>
              <Feather name="tag" size={12} color={C.sub}/>
              <Text style={ds.rowTxt}>Frais : {booking.bagagePrice.toLocaleString()} FCFA</Text>
            </View>
          )}
          {items.length>1&&items.map((it,i)=>(
            <View key={i} style={ds.bagItem}>
              {it.photoUrl
                ? <Image source={{uri:it.photoUrl}} style={ds.bagThumb} resizeMode="cover"/>
                : <View style={[ds.bagThumb,{backgroundColor:C.purpleLt,alignItems:"center",justifyContent:"center"}]}>
                    <Feather name="package" size={12} color={C.purple}/>
                  </View>
              }
              <View style={{flex:1}}>
                <Text style={ds.bagType}>{it.type??"Valise"}</Text>
                {it.description&&<Text style={ds.bagDesc} numberOfLines={1}>{it.description}</Text>}
                {it.status&&<Text style={[ds.bagStatus,{color:it.status==="chargé"?C.green:C.amber}]}>{it.status}</Text>}
              </View>
              {it.price>0&&<Text style={ds.bagPrice}>{it.price.toLocaleString()} F</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Source */}
      <View style={ds.foot}>
        <Text style={ds.footTxt}>
          {booking.bookingSource==="mobile"?"📱 App mobile":booking.bookingSource==="online"?"🌐 Web":"🏢 Guichet"}
          {"  ·  "}{fmtDate(booking.createdAt)}
        </Text>
      </View>

      {/* Actions */}
      {isPend&&(
        <View style={ds.actRow}>
          <Pressable style={[ds.actBtn,{backgroundColor:C.green}]}
            onPress={onConfirm} disabled={confirming}>
            {confirming
              ? <ActivityIndicator color="#fff" size="small"/>
              : <><Feather name="check" size={16} color="#fff"/><Text style={ds.actTxt}>Confirmer</Text></>}
          </Pressable>
          <Pressable style={[ds.actBtn,{backgroundColor:C.white,borderWidth:1.5,borderColor:C.red}]}
            onPress={onCancel}>
            <Feather name="x" size={16} color={C.red}/>
            <Text style={[ds.actTxt,{color:C.red}]}>Annuler</Text>
          </Pressable>
        </View>
      )}
      <View style={{height:34}}/>
    </ScrollView>
  );
}

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const elev = IS_WEB
  ? {boxShadow:"0 2px 10px rgba(0,0,0,0.09)"} as any
  : {shadowColor:"#000",shadowOffset:{width:0,height:2},shadowOpacity:0.08,shadowRadius:5,elevation:3};

const s = StyleSheet.create({
  root: {flex:1, backgroundColor:C.bg},

  /* Header */
  header:  {flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingVertical:10,gap:8},
  hBack:   {width:34,height:34,borderRadius:17,backgroundColor:"rgba(255,255,255,0.15)",alignItems:"center",justifyContent:"center"},
  hTitle:  {fontSize:15,fontWeight:"800",color:"#fff"},
  hSub:    {fontSize:10,color:"rgba(255,255,255,0.55)",marginTop:1},
  hBadge:  {borderRadius:10,paddingHorizontal:9,paddingVertical:4,backgroundColor:"rgba(217,119,6,0.9)",alignItems:"center"},
  hBadgeN: {fontSize:14,fontWeight:"900",color:"#fff"},
  hBadgeL: {fontSize:8,fontWeight:"700",color:"rgba(255,255,255,0.8)",textTransform:"uppercase"},
  hRefBtn: {width:32,height:32,borderRadius:16,backgroundColor:"rgba(255,255,255,0.15)",alignItems:"center",justifyContent:"center"},

  /* Niveau label */
  lvlLabel: {fontSize:9,fontWeight:"900",color:C.sub,letterSpacing:1.2,textTransform:"uppercase",paddingHorizontal:13,paddingTop:8,paddingBottom:5},

  /* ── NIVEAU 1 : Agences ── */
  agSection: {backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border,paddingBottom:10},
  agRow:     {flexDirection:"row",paddingHorizontal:10,gap:8},
  agCard:    {minWidth:88,maxWidth:110,borderRadius:14,borderWidth:1.5,borderColor:C.border,
              backgroundColor:C.white,padding:10,gap:4,...elev},
  agCardTop: {flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between"},
  agCardIcon:{width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center"},
  agCardBadge:{borderRadius:8,paddingHorizontal:5,paddingVertical:2},
  agCardBadgeTxt:{fontSize:9,fontWeight:"900"},
  agCardName:{fontSize:12,fontWeight:"800",color:C.ink,marginTop:4},
  agCardCount:{fontSize:10,color:C.sub},

  /* ── NIVEAU 2 : État filtres ── */
  etatSection: {backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border,paddingBottom:10},
  etatRow:     {flexDirection:"row",paddingHorizontal:10,gap:7,alignItems:"center"},
  etatChip:    {flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:11,paddingVertical:7,
               borderRadius:20,borderWidth:1.5,borderColor:C.border,backgroundColor:C.white},
  etatChipTxt: {fontSize:11,fontWeight:"700",color:C.ink},

  /* ── NIVEAU 3 : Liste ── */
  listContent: {padding:10,gap:8},
  summaryRow:  {flexDirection:"row",alignItems:"center",marginBottom:2},
  summaryTxt:  {fontSize:11,color:C.sub,fontWeight:"600"},

  /* Carte trajet */
  tripCard:     {borderRadius:14,overflow:"hidden",...elev,backgroundColor:C.white},
  tripCardPend: {borderWidth:1.5,borderColor:C.amberLt},
  tripHeader:   {borderLeftWidth:4},
  tripHeaderGrad:{paddingHorizontal:12,paddingVertical:10,gap:5},

  th1: {flexDirection:"row",alignItems:"center",gap:8},
  etatBadge:   {flexDirection:"row",alignItems:"center",gap:4,borderRadius:7,paddingHorizontal:7,paddingVertical:3},
  etatBadgeTxt:{fontSize:8,fontWeight:"900",color:"#fff",letterSpacing:0.6},
  thRoute:     {flex:1,fontSize:15,fontWeight:"900",color:C.ink},

  th2: {flexDirection:"row",alignItems:"center",gap:5},
  thTime:   {fontSize:10,color:C.sub,fontWeight:"500"},
  thBus:    {fontSize:10,fontWeight:"800"},
  thAgence: {fontSize:10,color:C.sub,flexShrink:1},
  thDivider:{width:1,height:12,backgroundColor:C.border},

  th3: {flexDirection:"row",alignItems:"center",gap:5},
  thCountBox:{flexDirection:"row",alignItems:"center",gap:4},
  thCountTxt:{fontSize:9,color:C.sub,fontWeight:"500"},
  thCnt:     {flexDirection:"row",alignItems:"center",borderRadius:7,paddingHorizontal:6,paddingVertical:2,borderWidth:1},
  thCntTxt:  {fontSize:9,fontWeight:"800"},

  /* Lignes passagers */
  bkList: {backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.border},
  bkDiv:  {height:1,backgroundColor:C.border,marginLeft:48},
  bkRow:  {flexDirection:"row",alignItems:"center",paddingHorizontal:10,paddingVertical:9,gap:8},
  bkAv:   {width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center"},
  bkAvTxt:{fontSize:13,fontWeight:"900"},
  bkInfo: {flex:1,minWidth:0},
  bkNameRow:{flexDirection:"row",alignItems:"center",gap:4},
  bkName: {fontSize:13,fontWeight:"700",color:C.ink,flexShrink:1},
  bkBagDot: {width:16,height:16,borderRadius:8,backgroundColor:C.purpleLt,alignItems:"center",justifyContent:"center"},
  bkPhoneDot:{width:16,height:16,borderRadius:8,backgroundColor:C.tealLt,alignItems:"center",justifyContent:"center"},
  bkSub:  {fontSize:9,color:C.sub,marginTop:1},
  bkAmt:  {fontSize:12,fontWeight:"800",color:C.teal,minWidth:58,textAlign:"right"},
  bkBtns: {flexDirection:"row",gap:5},
  btnConf:{width:30,height:30,borderRadius:10,backgroundColor:C.green,alignItems:"center",justifyContent:"center"},
  btnCan: {width:30,height:30,borderRadius:10,backgroundColor:C.redLt,borderWidth:1.5,borderColor:"#FECACA",alignItems:"center",justifyContent:"center"},
  bkPill: {borderRadius:7,paddingHorizontal:7,paddingVertical:3},
  bkPillTxt:{fontSize:9,fontWeight:"700"},

  /* États vides */
  center:     {flex:1,justifyContent:"center",alignItems:"center",gap:12,paddingHorizontal:40},
  centerTxt:  {fontSize:13,color:C.sub,marginTop:4},
  emptyIcon:  {width:56,height:56,borderRadius:28,backgroundColor:C.tealLt,alignItems:"center",justifyContent:"center"},
  emptyTitle: {fontSize:16,fontWeight:"900",color:C.ink},
  emptySub:   {fontSize:13,color:C.sub,textAlign:"center",lineHeight:18},
  resetBtn:   {paddingHorizontal:20,paddingVertical:10,backgroundColor:C.teal,borderRadius:10,marginTop:4},
  resetBtnTxt:{color:"#fff",fontWeight:"700",fontSize:13},

  /* Modals */
  overlay:      {flex:1,backgroundColor:"rgba(0,0,0,0.52)",justifyContent:"flex-end"},
  detailSheet:  {backgroundColor:C.white,borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:"92%",paddingHorizontal:16,...elev},
  cancelSheet:  {backgroundColor:C.white,borderTopLeftRadius:22,borderTopRightRadius:22,padding:16,gap:10,...elev},
  sheetHandle:  {width:40,height:4,borderRadius:2,backgroundColor:C.border,alignSelf:"center",marginBottom:10},
  sheetTitle:   {fontSize:16,fontWeight:"900",color:C.ink},
  cancelRef:    {fontSize:13,color:C.sub},
  cancelInput:  {backgroundColor:C.bg,borderRadius:10,borderWidth:1,borderColor:C.border,padding:12,fontSize:13,color:C.ink,minHeight:60,textAlignVertical:"top"},
  cancelConfBtn:{backgroundColor:C.red,borderRadius:12,paddingVertical:13,alignItems:"center"},
  cancelConfTxt:{color:"#fff",fontSize:14,fontWeight:"800"},
  cancelKeepBtn:{alignItems:"center",paddingVertical:10},
  cancelKeepTxt:{fontSize:13,color:C.sub,fontWeight:"600"},
});

/* ── Styles détail passager ──────────────────────────────── */
const ds = StyleSheet.create({
  handle:    {alignItems:"center",paddingTop:10,paddingBottom:6},
  handleBar: {width:36,height:4,borderRadius:2,backgroundColor:C.border},
  head:      {flexDirection:"row",alignItems:"flex-start",gap:12,paddingVertical:14,borderBottomWidth:1,borderBottomColor:C.border},
  av:        {width:50,height:50,borderRadius:25,alignItems:"center",justifyContent:"center"},
  avTxt:     {fontSize:20,fontWeight:"900"},
  name:      {fontSize:17,fontWeight:"900",color:C.ink,marginBottom:6},
  pill:      {borderRadius:8,paddingHorizontal:9,paddingVertical:3,alignSelf:"flex-start"},
  pillTxt:   {fontSize:10,fontWeight:"700"},
  ref:       {fontSize:11,color:C.sub},

  section:   {paddingTop:14,paddingBottom:4,borderBottomWidth:1,borderBottomColor:C.border},
  sLabel:    {fontSize:9,fontWeight:"900",color:C.sub,letterSpacing:1.1,textTransform:"uppercase",marginBottom:8},
  card:      {backgroundColor:C.bg,borderRadius:10,padding:11,gap:8},
  row:       {flexDirection:"row",alignItems:"center",gap:8},
  rowBold:   {fontSize:13,fontWeight:"700",color:C.ink,flex:1},
  rowTxt:    {fontSize:12,color:C.ink,flex:1},
  seatBadge: {backgroundColor:C.tealLt,borderRadius:6,paddingHorizontal:8,paddingVertical:2},
  seatTxt:   {fontSize:10,fontWeight:"700",color:C.teal},
  phoneBtn:  {flexDirection:"row",alignItems:"center",gap:8,backgroundColor:C.tealLt,borderRadius:9,paddingHorizontal:12,paddingVertical:10},
  phoneTxt:  {fontSize:13,fontWeight:"700",color:C.teal,flex:1},
  callBtn:   {backgroundColor:C.teal,borderRadius:7,paddingHorizontal:9,paddingVertical:3},
  callTxt:   {fontSize:10,fontWeight:"700",color:"#fff"},

  amount:    {fontSize:20,fontWeight:"900",color:C.ink},
  method:    {fontSize:12,color:C.sub,marginTop:2},

  photoWrap:    {borderRadius:12,overflow:"hidden",height:170,marginBottom:8},
  photo:        {width:"100%",height:170},
  photoOv:      {position:"absolute",bottom:0,left:0,right:0,flexDirection:"row",alignItems:"center",gap:6,padding:10,backgroundColor:"rgba(0,0,0,0.52)"},
  photoLbl:     {color:"#fff",fontWeight:"600",fontSize:12},
  photoPlaceholder:{height:110,borderRadius:12,backgroundColor:C.purpleLt,alignItems:"center",justifyContent:"center",gap:6,marginBottom:8},
  photoPlaceholderTxt:{fontSize:12,color:C.purple,fontWeight:"600"},
  bagItem:   {flexDirection:"row",alignItems:"center",gap:10,paddingTop:8,borderTopWidth:1,borderTopColor:C.border},
  bagThumb:  {width:44,height:44,borderRadius:8},
  bagType:   {fontSize:12,fontWeight:"700",color:C.ink},
  bagDesc:   {fontSize:11,color:C.sub},
  bagStatus: {fontSize:10,fontWeight:"700"},
  bagPrice:  {fontSize:12,fontWeight:"800",color:C.teal},

  foot:    {paddingTop:12,paddingBottom:4,alignItems:"center"},
  footTxt: {fontSize:11,color:C.sub},

  actRow:  {flexDirection:"row",gap:10,paddingTop:14},
  actBtn:  {flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,paddingVertical:14,borderRadius:13},
  actTxt:  {fontSize:14,fontWeight:"800",color:"#fff"},
});
