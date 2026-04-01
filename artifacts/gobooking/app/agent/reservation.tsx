/**
 * RÉSERVATIONS EN LIGNE — DASHBOARD OPÉRATIONNEL v4
 *
 * Architecture visuelle :
 *   ① Header gradient : titre + AGENCE visible en permanence + compteur attente
 *   ② Barre ÉTAT (4 chips larges, étiquetées, colorées)
 *   ③ Barre STATUT (4 onglets pleine largeur)
 *   ④ Liste : blocs trajets (header 2 lignes + passagers 36px)
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

/* ── Palette ─────────────────────────────────────────────── */
const C = {
  teal:   "#0E7490", tealDk: "#0C6B82", tealLt: "#E0F7FA", tealSoft:"#F0FDFF",
  amber:  "#D97706", amberLt:"#FEF3C7", amberSoft:"#FFFBEB",
  purple: "#7C3AED", purpleLt:"#EDE9FE",
  green:  "#059669", greenLt: "#D1FAE5",
  slate:  "#64748B", slateLt: "#F1F5F9", slateSoft:"#F8FAFC",
  red:    "#DC2626", redLt:   "#FEE2E2",
  ink:    "#0F172A", sub:     "#64748B", border: "#E2E8F0",
  bg:     "#F1F5F9", white:   "#FFFFFF",
};

/* ── Types ───────────────────────────────────────────────── */
interface Agence { id:string; name:string; city:string }
interface TripInfo {
  id:string; from:string; to:string; date:string;
  departureTime:string; busName:string; status?:string;
  guichetSeats:number; onlineSeats:number; totalSeats:number;
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
type DepartF = "all"|"scheduled"|"boarding"|"active"|"done";
type StatusF = "all"|"pending"|"confirmed"|"cancelled";

/* ── Helpers ─────────────────────────────────────────────── */
const isActive    = (s?:string) => s==="en_route"||s==="in_progress";
const isBoarding  = (s?:string) => s==="boarding";
const isScheduled = (s?:string) => !s||s==="scheduled";
const isDone      = (s?:string) => s==="arrived"||s==="completed"||s==="cancelled";

function cycleOrder(s?:string):number {
  if(isActive(s))   return 0;
  if(isBoarding(s)) return 1;
  if(isScheduled(s))return 2;
  return 3;
}

interface CycleDef {
  fKey:DepartF; label:string; shortLabel:string; icon:string;
  color:string; softBg:string; lightBg:string;
  grad:[string,string];
}
const CYCLES:CycleDef[] = [
  { fKey:"scheduled", label:"À venir",  shortLabel:"VENIR", icon:"clock",        color:C.amber,  softBg:C.amberSoft,  lightBg:C.amberLt,  grad:["#D97706","#B45309"] },
  { fKey:"boarding",  label:"En gare",  shortLabel:"GARE",  icon:"user-check",   color:C.purple, softBg:C.purpleLt,   lightBg:C.purpleLt, grad:["#7C3AED","#6D28D9"] },
  { fKey:"active",    label:"En route", shortLabel:"ROUTE", icon:"navigation",   color:C.green,  softBg:C.greenLt,    lightBg:C.greenLt,  grad:["#059669","#047857"] },
  { fKey:"done",      label:"Terminés", shortLabel:"DONE",  icon:"check-circle", color:C.slate,  softBg:C.slateSoft,  lightBg:C.slateLt,  grad:["#64748B","#475569"] },
];

function getCycle(s?:string):CycleDef {
  if(isActive(s))   return CYCLES[2];
  if(isBoarding(s)) return CYCLES[1];
  if(isDone(s))     return CYCLES[3];
  return CYCLES[0];
}

function bkMeta(s:string){
  if(s==="pending")   return { label:"En attente", color:C.amber,  bg:C.amberSoft };
  if(s==="confirmed") return { label:"Confirmé",   color:C.green,  bg:C.greenLt   };
  if(s==="boarded")   return { label:"Embarqué",   color:C.purple, bg:C.purpleLt  };
  if(s==="cancelled") return { label:"Annulé",     color:C.red,    bg:C.redLt     };
  return { label:s, color:C.sub, bg:"#F3F4F6" };
}
function payShort(p:string){
  if(p==="mobile_money") return "📱";
  if(p==="card")         return "💳";
  if(p==="cash")         return "💵";
  return "—";
}
function payLabel(p:string){
  if(p==="mobile_money") return "💱 Mobile Money";
  if(p==="card")         return "💳 Carte bancaire";
  if(p==="cash")         return "💵 Espèces";
  return p;
}
function cityMatch(from?:string|null,city?:string):boolean{
  if(!from||!city) return false;
  const f=from.toLowerCase(), c=city.toLowerCase();
  return f.includes(c)||c.includes(f);
}
function fmtDate(iso:string){
  try{ return new Date(iso).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); }
  catch{ return iso; }
}

/* ════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export default function AgentReservation() {
  const { token, logoutIfActiveToken } = useAuth();

  const [agencies,   setAgencies]   = useState<Agence[]>([]);
  const [myAgence,   setMyAgence]   = useState<Agence|null>(null);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync,   setLastSync]   = useState<Date|null>(null);

  const [selAgence,     setSelAgence]     = useState<string|null>(null);
  const [departFilter,  setDepartFilter]  = useState<DepartF>("all");
  const [statusFilter,  setStatusFilter]  = useState<StatusF>("all");
  const [agenceModal,   setAgenceModal]   = useState(false);
  const [detail,        setDetail]        = useState<Booking|null>(null);
  const [confirming,    setConfirming]    = useState<string|null>(null);
  const [cancelModal,   setCancelModal]   = useState<Booking|null>(null);
  const [cancelReason,  setCancelReason]  = useState("");
  const [cancelling,    setCancelling]    = useState<string|null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const pulse   = useRef(new Animated.Value(1)).current;

  /* ── Chargement ────────────────────────────────────────── */
  const load = useCallback(async(silent=false)=>{
    if(!silent) setLoading(true);
    try{
      const data = await apiFetch<any>("/agent/online-bookings",{token:token??undefined});
      if(Array.isArray(data)){
        setBookings(data);
      } else {
        setAgencies(Array.isArray(data?.agencies) ? data.agencies : []);
        setMyAgence(data?.myAgence ?? null);
        setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
      }
      setLastSync(new Date());
    }catch(e:any){
      if(e?.httpStatus===401){ logoutIfActiveToken(token??""); return; }
      if(!silent) Alert.alert("Erreur", e?.message ?? "Impossible de charger");
    }finally{
      setLoading(false);
      setRefreshing(false);
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

  /* ── Derivations ───────────────────────────────────────── */
  const agenceObj = agencies.find(a=>a.id===selAgence) ?? null;

  const scoped = selAgence && agenceObj
    ? bookings.filter(b=>cityMatch(b.trip?.from, agenceObj.city))
    : bookings;

  const pendingCount   = scoped.filter(b=>b.status==="pending").length;
  const confirmedCount = scoped.filter(b=>b.status==="confirmed"||b.status==="boarded").length;
  const cancelledCount = scoped.filter(b=>b.status==="cancelled").length;

  /* Pulsation sur les réservations en attente */
  useEffect(()=>{
    if(pendingCount>0){
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse,{toValue:1.15,duration:700,useNativeDriver:true}),
        Animated.timing(pulse,{toValue:1,   duration:700,useNativeDriver:true}),
      ]));
      loop.start();
      return ()=>loop.stop();
    }
    pulse.setValue(1);
  },[pendingCount]);

  /* Compteurs par état (cycle) */
  const cycleCounts = CYCLES.map(cy=>({
    ...cy,
    count: scoped.filter(b=>{
      const ts = b.trip?.status;
      if(cy.fKey==="scheduled") return isScheduled(ts);
      if(cy.fKey==="boarding")  return isBoarding(ts);
      if(cy.fKey==="active")    return isActive(ts);
      return isDone(ts);
    }).length,
  }));

  /* Filtrage + regroupement */
  const displayed = scoped.filter(b=>{
    const ts = b.trip?.status;
    if(departFilter==="active"    && !isActive(ts))   return false;
    if(departFilter==="boarding"  && !isBoarding(ts)) return false;
    if(departFilter==="scheduled" && !isScheduled(ts))return false;
    if(departFilter==="done"      && !isDone(ts))     return false;
    if(statusFilter==="pending")   return b.status==="pending";
    if(statusFilter==="confirmed") return b.status==="confirmed"||b.status==="boarded";
    if(statusFilter==="cancelled") return b.status==="cancelled";
    return true;
  });

  type Group = {key:string; trip:TripInfo|null; bks:Booking[]};
  const groups:Group[] = [];
  displayed.forEach(b=>{
    const k = b.trip?.id ?? "__none__";
    let g = groups.find(x=>x.key===k);
    if(!g){ g={key:k,trip:b.trip??null,bks:[]}; groups.push(g); }
    g.bks.push(b);
  });
  groups.sort((a,b)=>{
    const d = cycleOrder(a.trip?.status) - cycleOrder(b.trip?.status);
    if(d!==0) return d;
    return (a.bks.some(x=>x.status==="pending")?0:1)-(b.bks.some(x=>x.status==="pending")?0:1);
  });

  const syncStr = lastSync
    ? `Mis à jour ${String(lastSync.getHours()).padStart(2,"0")}:${String(lastSync.getMinutes()).padStart(2,"0")}`
    : "Chargement…";

  /* ── Actions ───────────────────────────────────────────── */
  const confirmBooking = (b:Booking) => {
    setDetail(null);
    Alert.alert(
      "Confirmer la réservation",
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

  /* ── Agence label ─────────────────────────────────────── */
  const agenceShort = agenceObj
    ? (agenceObj.name.length > 14 ? agenceObj.name.substring(0,14)+"…" : agenceObj.name)
    : "Toutes les agences";

  /* ════════════════════════════════════════════════════════
     RENDU
  ═════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDk}/>

      {/* ══════════════════════════════
          ① HEADER
          Titre + Agence visible + Compteur attente
      ════════════════════════════════ */}
      <LinearGradient colors={[C.tealDk, C.teal]} style={s.header}>
        <Pressable style={s.hBack}
          onPress={()=>router.canGoBack()?router.back():router.replace("/agent/home" as never)}
          hitSlop={12}>
          <Feather name="arrow-left" size={20} color="#fff"/>
        </Pressable>

        <View style={s.hCenter}>
          <Text style={s.hTitle}>Réservations en ligne</Text>
          <Text style={s.hSub}>{syncStr}</Text>
        </View>

        {/* Badge attente pulsé */}
        {pendingCount>0 && (
          <Animated.View style={[s.hBadge,{backgroundColor:"rgba(217,119,6,0.92)",transform:[{scale:pulse}]}]}>
            <Text style={s.hBadgeN}>{pendingCount}</Text>
            <Text style={s.hBadgeL}>att.</Text>
          </Animated.View>
        )}

        {/* Bouton agence — TOUJOURS VISIBLE */}
        <Pressable style={s.hAgenceBtn} onPress={()=>setAgenceModal(true)}>
          <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)"/>
          <Text style={s.hAgenceTxt} numberOfLines={1}>{agenceShort}</Text>
          <Feather name="chevron-down" size={11} color="rgba(255,255,255,0.6)"/>
        </Pressable>

        <Pressable style={s.hRefreshBtn} onPress={()=>load()} hitSlop={8}>
          <Feather name="refresh-cw" size={14} color="#fff"/>
        </Pressable>
      </LinearGradient>

      {/* ══════════════════════════════
          ② BARRE ÉTAT DU DÉPART
          4 chips larges, colorées, avec compteurs
      ════════════════════════════════ */}
      <View style={s.etatSection}>
        <Text style={s.sectionLabel}>ÉTAT DU DÉPART</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.etatRow}>
          {cycleCounts.map((cy)=>{
            const on = departFilter === cy.fKey;
            return (
              <Pressable key={cy.fKey}
                style={[s.etatChip, on&&{backgroundColor:cy.color,borderColor:cy.color}]}
                onPress={()=>setDepartFilter(departFilter===cy.fKey?"all":cy.fKey)}>
                <View style={[s.etatChipTop]}>
                  <View style={[s.etatIcon, {backgroundColor: on?"rgba(255,255,255,0.2)":cy.lightBg}]}>
                    <Feather name={cy.icon as any} size={13} color={on?"#fff":cy.color}/>
                  </View>
                  <Text style={[s.etatCount, {color: on?"#fff":C.ink}]}>{cy.count}</Text>
                </View>
                <Text style={[s.etatLabel, {color: on?"rgba(255,255,255,0.9)":C.sub}]}>{cy.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ══════════════════════════════
          ③ ONGLETS STATUT RÉSERVATION
          4 onglets pleine largeur
      ════════════════════════════════ */}
      <View style={s.statutSection}>
        <Text style={s.sectionLabel}>STATUT RÉSERVATION</Text>
        <View style={s.statutTabs}>
          {([
            {k:"all"       as StatusF, lbl:"Toutes",      n:scoped.length,  col:C.teal  },
            {k:"pending"   as StatusF, lbl:"En attente",  n:pendingCount,   col:C.amber },
            {k:"confirmed" as StatusF, lbl:"Confirmés",   n:confirmedCount, col:C.green },
            {k:"cancelled" as StatusF, lbl:"Annulés",     n:cancelledCount, col:C.red   },
          ]).map((t,i)=>{
            const on = statusFilter === t.k;
            return (
              <Pressable key={t.k}
                style={[s.stTab, on&&{backgroundColor:t.col}, i===0&&s.stTabFirst, i===3&&s.stTabLast]}
                onPress={()=>setStatusFilter(t.k)}>
                <Text style={[s.stTabLbl, on&&{color:"#fff"}]} numberOfLines={1}>{t.lbl}</Text>
                <View style={[s.stTabBadge, on&&{backgroundColor:"rgba(255,255,255,0.25)"}]}>
                  <Text style={[s.stTabBadgeTxt, on&&{color:"#fff"}]}>{t.n}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ══════════════════════════════
          ④ LISTE DES TRAJETS + PASSAGERS
      ════════════════════════════════ */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.teal}/>
          <Text style={s.centerTxt}>Chargement des réservations…</Text>
        </View>
      ) : displayed.length===0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><Feather name="inbox" size={24} color={C.teal}/></View>
          <Text style={s.emptyTitle}>Aucune réservation</Text>
          <Text style={s.emptySub}>Aucun résultat avec les filtres sélectionnés</Text>
          <Pressable style={s.resetBtn}
            onPress={()=>{setDepartFilter("all");setStatusFilter("all");setSelAgence(null);}}>
            <Text style={s.resetBtnTxt}>Effacer les filtres</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={{flex:1}} contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={C.teal}/>}>

          {/* Résumé */}
          <View style={s.summaryRow}>
            <Text style={s.summaryTxt}>
              {displayed.length} réservation{displayed.length>1?"s":""} · {groups.length} départ{groups.length>1?"s":""}
            </Text>
            {departFilter!=="all"&&(
              <View style={s.activeFilterBadge}>
                <Text style={s.activeFilterTxt}>
                  {CYCLES.find(c=>c.fKey===departFilter)?.label}
                </Text>
                <Pressable onPress={()=>setDepartFilter("all")} hitSlop={8}>
                  <Feather name="x" size={10} color={C.teal}/>
                </Pressable>
              </View>
            )}
          </View>

          {/* Blocs trajets */}
          {groups.map(group=>{
            const trip = group.trip;
            const cy   = getCycle(trip?.status);
            const gPend= group.bks.filter(b=>b.status==="pending").length;
            const gConf= group.bks.filter(b=>b.status==="confirmed"||b.status==="boarded").length;
            const gCan = group.bks.filter(b=>b.status==="cancelled").length;

            return (
              <View key={group.key} style={s.tripCard}>

                {/* ─── HEADER TRAJET ─── */}
                <LinearGradient
                  colors={[cy.grad[0]+"28", cy.grad[0]+"08"]}
                  style={[s.tripHeader, {borderLeftColor:cy.color}]}>

                  {trip ? (
                    <>
                      {/* Ligne 1 : VILLES + BADGE ÉTAT */}
                      <View style={s.th1}>
                        <Text style={s.thFrom}>{trip.from}</Text>
                        <View style={s.thArrow}>
                          <View style={[s.thArrowLine,{backgroundColor:cy.color}]}/>
                          <Feather name="chevron-right" size={12} color={cy.color}/>
                        </View>
                        <Text style={s.thTo}>{trip.to}</Text>
                        <View style={{flex:1}}/>
                        <View style={[s.etatBadge,{backgroundColor:cy.color}]}>
                          <Feather name={cy.icon as any} size={9} color="#fff"/>
                          <Text style={s.etatBadgeTxt}>{cy.shortLabel}</Text>
                        </View>
                      </View>

                      {/* Ligne 2 : DÉTAILS + COMPTEURS */}
                      <View style={s.th2}>
                        <Text style={s.thTime}>{trip.departureTime}</Text>
                        <Text style={s.thDot}>·</Text>
                        <Text style={[s.thBus,{color:cy.color}]}>{trip.busName}</Text>
                        {trip.agenceName && <>
                          <Text style={s.thDot}>·</Text>
                          <Text style={s.thAgence}>{trip.agenceName}</Text>
                        </>}
                        <View style={{flex:1}}/>
                        {gPend>0 && (
                          <View style={[s.thCount,{backgroundColor:C.amberSoft}]}>
                            <Text style={[s.thCountTxt,{color:C.amber}]}>{gPend} att.</Text>
                          </View>
                        )}
                        {gConf>0 && (
                          <View style={[s.thCount,{backgroundColor:C.greenLt}]}>
                            <Text style={[s.thCountTxt,{color:C.green}]}>{gConf} conf.</Text>
                          </View>
                        )}
                        {gCan>0 && (
                          <View style={[s.thCount,{backgroundColor:C.redLt}]}>
                            <Text style={[s.thCountTxt,{color:C.red}]}>{gCan} ann.</Text>
                          </View>
                        )}
                      </View>
                    </>
                  ) : (
                    <Text style={[s.thFrom,{color:C.sub}]}>Trajet non précisé</Text>
                  )}
                </LinearGradient>

                {/* ─── LIGNES PASSAGERS ─── */}
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
                        {idx>0 && <View style={s.bkSep}/>}
                        <Pressable
                          style={[s.bkRow, isPend&&{backgroundColor:C.amberSoft}]}
                          onPress={()=>setDetail(b)}>

                          {/* Initiale */}
                          <View style={[s.bkAvatar,{backgroundColor:bk.bg}]}>
                            <Text style={[s.bkAvatarTxt,{color:bk.color}]}>
                              {name.charAt(0).toUpperCase()}
                            </Text>
                          </View>

                          {/* Nom + détails */}
                          <View style={s.bkBody}>
                            <View style={s.bkNameRow}>
                              <Text style={s.bkName} numberOfLines={1}>{name}</Text>
                              {hasBag && (
                                <View style={s.bkBagIcon}>
                                  <Feather name="package" size={9} color={C.purple}/>
                                </View>
                              )}
                            </View>
                            <Text style={s.bkDetail}>{seat} · {payShort(b.paymentMethod)} · {b.bookingRef}</Text>
                          </View>

                          {/* Montant */}
                          <Text style={s.bkAmount}>
                            {(b.totalAmount??0).toLocaleString()} F
                          </Text>

                          {/* Action ou statut */}
                          {isPend ? (
                            isConf ? (
                              <ActivityIndicator size="small" color={C.green}/>
                            ) : (
                              <View style={s.bkActions}>
                                <Pressable style={s.actConf}
                                  onPress={e=>{e.stopPropagation?.();confirmBooking(b);}}>
                                  <Feather name="check" size={13} color="#fff"/>
                                </Pressable>
                                <Pressable style={s.actCan}
                                  onPress={e=>{e.stopPropagation?.();setCancelModal(b);setCancelReason("");}}>
                                  <Feather name="x" size={13} color={C.red}/>
                                </Pressable>
                              </View>
                            )
                          ) : (
                            <View style={[s.bkStatusPill,{backgroundColor:bk.bg}]}>
                              <Text style={[s.bkStatusTxt,{color:bk.color}]}>{bk.label}</Text>
                            </View>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <View style={{height:50}}/>
        </ScrollView>
      )}

      {/* ══════ MODAL : SÉLECTION AGENCE ══════ */}
      <Modal visible={agenceModal} transparent animationType="slide"
        onRequestClose={()=>setAgenceModal(false)}>
        <Pressable style={s.overlay} onPress={()=>setAgenceModal(false)}>
          <Pressable style={s.agSheet} onPress={e=>e.stopPropagation?.()}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>Sélectionner l'agence</Text>

            {/* Toutes */}
            <Pressable style={[s.agRow, selAgence===null&&{backgroundColor:C.teal}]}
              onPress={()=>{setSelAgence(null);setAgenceModal(false);}}>
              <View style={[s.agRowIcon,{backgroundColor:selAgence===null?"rgba(255,255,255,0.2)":C.tealSoft}]}>
                <Feather name="grid" size={14} color={selAgence===null?"#fff":C.teal}/>
              </View>
              <View style={{flex:1}}>
                <Text style={[s.agRowName,selAgence===null&&{color:"#fff"}]}>Toutes les agences</Text>
                <Text style={[s.agRowSub,selAgence===null&&{color:"rgba(255,255,255,0.7)"}]}>
                  {bookings.length} réservation{bookings.length>1?"s":""}
                </Text>
              </View>
              {selAgence===null&&<Feather name="check" size={16} color="#fff"/>}
            </Pressable>

            {agencies.map(a=>{
              const on   = selAgence===a.id;
              const mine = myAgence?.id===a.id;
              const cnt  = bookings.filter(b=>cityMatch(b.trip?.from,a.city)).length;
              return (
                <Pressable key={a.id}
                  style={[s.agRow, on&&{backgroundColor:C.teal}]}
                  onPress={()=>{setSelAgence(a.id);setAgenceModal(false);}}>
                  <View style={[s.agRowIcon,{backgroundColor:on?"rgba(255,255,255,0.2)":C.tealSoft}]}>
                    <Feather name="map-pin" size={14} color={on?"#fff":C.teal}/>
                  </View>
                  <View style={{flex:1}}>
                    <View style={{flexDirection:"row",alignItems:"center",gap:6}}>
                      <Text style={[s.agRowName,on&&{color:"#fff"}]}>{a.name}</Text>
                      {mine&&<View style={[s.mineDot,on&&{backgroundColor:"rgba(255,255,255,0.7)"}]}/>}
                    </View>
                    <Text style={[s.agRowSub,on&&{color:"rgba(255,255,255,0.7)"}]}>
                      {a.city} · {cnt} rés.
                    </Text>
                  </View>
                  {on&&<Feather name="check" size={16} color="#fff"/>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════ MODAL : DÉTAIL PASSAGER ══════ */}
      <Modal visible={!!detail} transparent animationType="slide"
        onRequestClose={()=>setDetail(null)}>
        <Pressable style={s.overlay} onPress={()=>setDetail(null)}>
          <Pressable style={s.detailSheet} onPress={e=>e.stopPropagation?.()}>
            {detail && (
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
            <Text style={s.cancelRef}>{cancelModal?.bookingRef} · {cancelModal?.passengers?.[0]?.name}</Text>
            <TextInput style={s.cancelInput}
              placeholder="Motif d'annulation (optionnel)"
              placeholderTextColor={C.sub}
              value={cancelReason} onChangeText={setCancelReason}
              multiline numberOfLines={2}/>
            <Pressable style={[s.cancelConfirmBtn, !!cancelling&&{opacity:0.6}]}
              onPress={doCancel} disabled={!!cancelling}>
              {cancelling===cancelModal?.id
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.cancelConfirmTxt}>Confirmer l'annulation</Text>}
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
   BOTTOM SHEET : DÉTAIL PASSAGER
═══════════════════════════════════════════ */
function PassengerDetail({
  booking,onConfirm,onCancel,onClose,confirming,
}:{
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

      {/* En-tête passager */}
      <View style={ds.head}>
        <View style={[ds.avatar,{backgroundColor:bk.bg}]}>
          <Text style={[ds.avatarTxt,{color:bk.color}]}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={ds.headMid}>
          <Text style={ds.headName} numberOfLines={2}>{name}</Text>
          <View style={ds.headRow}>
            <View style={[ds.statusPill,{backgroundColor:bk.bg}]}>
              <Text style={[ds.statusPillTxt,{color:bk.color}]}>{bk.label}</Text>
            </View>
            <Text style={ds.headRef}>{booking.bookingRef}</Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Feather name="x-circle" size={22} color={C.sub}/>
        </Pressable>
      </View>

      {/* TRAJET */}
      {booking.trip && (
        <View style={ds.section}>
          <Text style={ds.sLabel}>TRAJET</Text>
          <View style={ds.infoCard}>
            <View style={ds.row}>
              <Feather name="map" size={13} color={C.teal}/>
              <Text style={ds.rowVal}>{booking.trip.from} → {booking.trip.to}</Text>
            </View>
            <View style={ds.row}>
              <Feather name="clock" size={13} color={C.sub}/>
              <Text style={ds.rowTxt}>{booking.trip.departureTime} · {booking.trip.date}</Text>
            </View>
            <View style={ds.row}>
              <Feather name="truck" size={13} color={C.sub}/>
              <Text style={ds.rowTxt}>{booking.trip.busName}
                {booking.trip.agenceName?` · ${booking.trip.agenceName}`:""}</Text>
            </View>
          </View>
        </View>
      )}

      {/* PASSAGER & SIÈGE */}
      <View style={ds.section}>
        <Text style={ds.sLabel}>PASSAGER & SIÈGE</Text>
        <View style={ds.infoCard}>
          {booking.passengers.map((p,i)=>(
            <View key={i} style={ds.row}>
              <Feather name="user" size={13} color={C.sub}/>
              <Text style={ds.rowVal}>{p.name}</Text>
              {booking.seatNumbers[i] && (
                <View style={ds.seatBadge}>
                  <Text style={ds.seatBadgeTxt}>Siège {booking.seatNumbers[i]}</Text>
                </View>
              )}
            </View>
          ))}
          {booking.contactPhone ? (
            <Pressable style={ds.phoneRow}
              onPress={()=>Linking.openURL(`tel:${booking.contactPhone.replace(/\s/g,"")}`)} >
              <Feather name="phone" size={14} color={C.teal}/>
              <Text style={ds.phoneTxt}>{booking.contactPhone}</Text>
              <View style={ds.callBadge}><Text style={ds.callBadgeTxt}>Appeler</Text></View>
            </Pressable>
          ) : (
            <View style={ds.row}>
              <Feather name="phone-off" size={13} color={C.sub}/>
              <Text style={[ds.rowTxt,{color:C.sub}]}>Pas de téléphone</Text>
            </View>
          )}
        </View>
      </View>

      {/* PAIEMENT */}
      <View style={ds.section}>
        <Text style={ds.sLabel}>PAIEMENT</Text>
        <View style={[ds.infoCard,{flexDirection:"row",alignItems:"center"}]}>
          <View style={{flex:1}}>
            <Text style={ds.amountTxt}>{(booking.totalAmount??0).toLocaleString()} FCFA</Text>
            <Text style={ds.methodTxt}>{payLabel(booking.paymentMethod)}</Text>
          </View>
          <View style={[ds.statusPill,{backgroundColor:bk.bg}]}>
            <Text style={[ds.statusPillTxt,{color:bk.color}]}>{bk.label}</Text>
          </View>
        </View>
      </View>

      {/* BAGAGES */}
      {hasBag && (
        <View style={ds.section}>
          <Text style={ds.sLabel}>BAGAGES — {booking.baggageCount} article{booking.baggageCount>1?"s":""}</Text>
          {mainPh ? (
            <View style={ds.photoWrap}>
              <Image source={{uri:mainPh}} style={ds.photo} resizeMode="cover"/>
              <View style={ds.photoOverlay}>
                <Feather name="package" size={12} color="#fff"/>
                <Text style={ds.photoLbl}>{booking.baggageType ?? "Bagage"}</Text>
                {booking.bagageStatus && (
                  <Text style={[ds.photoLbl,{fontWeight:"700"}]}>· {booking.bagageStatus}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={ds.photoPlaceholder}>
              <Feather name="package" size={26} color={C.purple}/>
              <Text style={ds.photoPlaceholderTxt}>Aucune photo</Text>
            </View>
          )}
          {booking.baggageDescription && (
            <View style={ds.row}>
              <Feather name="info" size={12} color={C.sub}/>
              <Text style={ds.rowTxt}>{booking.baggageDescription}</Text>
            </View>
          )}
          {booking.bagagePrice>0 && (
            <View style={ds.row}>
              <Feather name="tag" size={12} color={C.sub}/>
              <Text style={ds.rowTxt}>Frais bagage : {booking.bagagePrice.toLocaleString()} FCFA</Text>
            </View>
          )}
          {items.length>1 && items.map((it,i)=>(
            <View key={i} style={ds.bagItem}>
              {it.photoUrl ? (
                <Image source={{uri:it.photoUrl}} style={ds.bagThumb} resizeMode="cover"/>
              ) : (
                <View style={[ds.bagThumb,{backgroundColor:C.purpleLt,alignItems:"center",justifyContent:"center"}]}>
                  <Feather name="package" size={12} color={C.purple}/>
                </View>
              )}
              <View style={{flex:1}}>
                <Text style={ds.bagType}>{it.type ?? "Valise"}</Text>
                {it.description&&<Text style={ds.bagDesc} numberOfLines={1}>{it.description}</Text>}
                {it.status&&<Text style={[ds.bagStatus,{color:it.status==="chargé"?C.green:C.amber}]}>{it.status}</Text>}
              </View>
              {it.price>0&&<Text style={ds.bagPrice}>{it.price.toLocaleString()} F</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Source et date */}
      <View style={ds.footRow}>
        <Text style={ds.footTxt}>
          {booking.bookingSource==="mobile"?"📱 App mobile":booking.bookingSource==="online"?"🌐 Web":"🏢 Guichet"}
          {"  ·  "}{fmtDate(booking.createdAt)}
        </Text>
      </View>

      {/* Boutons d'action */}
      {isPend && (
        <View style={ds.actRow}>
          <Pressable style={[ds.actBtn,{backgroundColor:C.green}]}
            onPress={onConfirm} disabled={confirming}>
            {confirming
              ? <ActivityIndicator color="#fff" size="small"/>
              : <><Feather name="check" size={16} color="#fff"/><Text style={ds.actBtnTxt}>Confirmer</Text></>}
          </Pressable>
          <Pressable style={[ds.actBtn,{backgroundColor:C.white,borderWidth:1.5,borderColor:C.red}]}
            onPress={onCancel}>
            <Feather name="x" size={16} color={C.red}/>
            <Text style={[ds.actBtnTxt,{color:C.red}]}>Annuler</Text>
          </Pressable>
        </View>
      )}
      <View style={{height:30}}/>
    </ScrollView>
  );
}

/* ══════════════════════════════════════════
   STYLES
═══════════════════════════════════════════ */
const sh = IS_WEB
  ? {boxShadow:"0 2px 12px rgba(0,0,0,0.09)"} as any
  : {shadowColor:"#000",shadowOffset:{width:0,height:2},shadowOpacity:0.08,shadowRadius:6,elevation:3};

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:C.bg },

  /* Header */
  header:      { flexDirection:"row", alignItems:"center", paddingHorizontal:12, paddingVertical:10, gap:8 },
  hBack:       { width:34, height:34, borderRadius:17, backgroundColor:"rgba(255,255,255,0.15)", alignItems:"center", justifyContent:"center" },
  hCenter:     { flex:1 },
  hTitle:      { fontSize:15, fontWeight:"800", color:"#fff", letterSpacing:0.2 },
  hSub:        { fontSize:10, color:"rgba(255,255,255,0.55)", marginTop:1 },
  hBadge:      { borderRadius:10, paddingHorizontal:8, paddingVertical:4, alignItems:"center", minWidth:38 },
  hBadgeN:     { fontSize:13, fontWeight:"900", color:"#fff" },
  hBadgeL:     { fontSize:8, fontWeight:"700", color:"rgba(255,255,255,0.8)", textTransform:"uppercase" },
  hAgenceBtn:  { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"rgba(255,255,255,0.18)", borderRadius:14, paddingHorizontal:10, paddingVertical:6, maxWidth:150 },
  hAgenceTxt:  { fontSize:11, fontWeight:"700", color:"rgba(255,255,255,0.9)", flexShrink:1 },
  hRefreshBtn: { width:32, height:32, borderRadius:16, backgroundColor:"rgba(255,255,255,0.15)", alignItems:"center", justifyContent:"center" },

  /* Section label */
  sectionLabel: { fontSize:9, fontWeight:"900", color:C.sub, letterSpacing:1.2, textTransform:"uppercase", paddingHorizontal:13, paddingTop:8, paddingBottom:4 },

  /* ② État du départ */
  etatSection:  { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border },
  etatRow:      { flexDirection:"row", paddingHorizontal:10, paddingBottom:9, gap:7 },
  etatChip:     { minWidth:76, paddingHorizontal:10, paddingVertical:8, borderRadius:12, borderWidth:1.5, borderColor:C.border, backgroundColor:C.white, gap:4 },
  etatChipTop:  { flexDirection:"row", alignItems:"center", gap:6 },
  etatIcon:     { width:24, height:24, borderRadius:12, alignItems:"center", justifyContent:"center" },
  etatCount:    { fontSize:18, fontWeight:"900", flex:1 },
  etatLabel:    { fontSize:10, fontWeight:"600" },

  /* ③ Statut réservation */
  statutSection: { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border, paddingBottom:9 },
  statutTabs:    { flexDirection:"row", paddingHorizontal:10, gap:5 },
  stTab:         { flex:1, alignItems:"center", paddingVertical:7, borderRadius:10, borderWidth:1.5, borderColor:C.border, backgroundColor:C.white, gap:2 },
  stTabFirst:    {},
  stTabLast:     {},
  stTabLbl:      { fontSize:9, fontWeight:"700", color:C.ink, textAlign:"center" },
  stTabBadge:    { backgroundColor:C.slateLt, borderRadius:6, paddingHorizontal:5, paddingVertical:1, minWidth:18, alignItems:"center" },
  stTabBadgeTxt: { fontSize:9, fontWeight:"800", color:C.sub },

  /* Liste */
  listContent:   { padding:10, gap:10 },
  summaryRow:    { flexDirection:"row", alignItems:"center", marginBottom:2, gap:8 },
  summaryTxt:    { fontSize:11, color:C.sub, fontWeight:"600" },
  activeFilterBadge: { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:C.tealSoft, borderRadius:8, paddingHorizontal:7, paddingVertical:3 },
  activeFilterTxt:   { fontSize:10, color:C.teal, fontWeight:"700" },

  /* Bloc trajet */
  tripCard:   { borderRadius:14, overflow:"hidden", backgroundColor:C.white, ...sh },
  tripHeader: { paddingHorizontal:12, paddingVertical:10, borderLeftWidth:4, borderWidth:1, borderColor:C.border, borderRadius:14, borderBottomLeftRadius:0, borderBottomRightRadius:0 },
  th1: { flexDirection:"row", alignItems:"center", marginBottom:6 },
  thFrom: { fontSize:17, fontWeight:"900", color:C.ink },
  thArrow: { flexDirection:"row", alignItems:"center", marginHorizontal:6 },
  thArrowLine: { width:16, height:2, borderRadius:1 },
  thTo: { fontSize:17, fontWeight:"900", color:C.ink, flex:1 },
  etatBadge:    { flexDirection:"row", alignItems:"center", gap:4, borderRadius:8, paddingHorizontal:8, paddingVertical:4 },
  etatBadgeTxt: { fontSize:9, fontWeight:"900", color:"#fff", letterSpacing:0.6 },
  th2: { flexDirection:"row", alignItems:"center", gap:5 },
  thTime:   { fontSize:11, fontWeight:"700", color:C.ink },
  thDot:    { fontSize:11, color:C.border },
  thBus:    { fontSize:11, fontWeight:"800" },
  thAgence: { fontSize:10, color:C.sub, flexShrink:1 },
  thCount:  { borderRadius:7, paddingHorizontal:6, paddingVertical:2 },
  thCountTxt:{ fontSize:9, fontWeight:"800" },

  /* Lignes passagers */
  bkList:   { backgroundColor:C.white, borderWidth:1, borderTopWidth:0, borderColor:C.border, borderBottomLeftRadius:14, borderBottomRightRadius:14 },
  bkSep:    { height:1, backgroundColor:C.border, marginLeft:50 },
  bkRow:    { flexDirection:"row", alignItems:"center", paddingHorizontal:10, paddingVertical:9, gap:8 },
  bkAvatar: { width:30, height:30, borderRadius:15, alignItems:"center", justifyContent:"center" },
  bkAvatarTxt:{ fontSize:13, fontWeight:"900" },
  bkBody:   { flex:1, minWidth:0 },
  bkNameRow:{ flexDirection:"row", alignItems:"center", gap:4 },
  bkName:   { fontSize:13, fontWeight:"700", color:C.ink, flexShrink:1 },
  bkBagIcon:{ width:16, height:16, borderRadius:8, backgroundColor:C.purpleLt, alignItems:"center", justifyContent:"center" },
  bkDetail: { fontSize:9, color:C.sub, marginTop:1, fontWeight:"500" },
  bkAmount: { fontSize:12, fontWeight:"800", color:C.teal, minWidth:58, textAlign:"right" },
  bkActions:{ flexDirection:"row", gap:5 },
  actConf:  { width:30, height:30, borderRadius:10, backgroundColor:C.green, alignItems:"center", justifyContent:"center" },
  actCan:   { width:30, height:30, borderRadius:10, backgroundColor:C.redLt, borderWidth:1.5, borderColor:"#FECACA", alignItems:"center", justifyContent:"center" },
  bkStatusPill:{ borderRadius:7, paddingHorizontal:7, paddingVertical:3 },
  bkStatusTxt: { fontSize:9, fontWeight:"700" },

  /* États vides */
  center:     { flex:1, justifyContent:"center", alignItems:"center", gap:12, paddingHorizontal:40 },
  centerTxt:  { fontSize:13, color:C.sub, marginTop:4 },
  emptyIcon:  { width:56, height:56, borderRadius:28, backgroundColor:C.tealLt, alignItems:"center", justifyContent:"center" },
  emptyTitle: { fontSize:16, fontWeight:"900", color:C.ink },
  emptySub:   { fontSize:13, color:C.sub, textAlign:"center", lineHeight:18 },
  resetBtn:   { paddingHorizontal:20, paddingVertical:10, backgroundColor:C.teal, borderRadius:10, marginTop:4 },
  resetBtnTxt:{ color:"#fff", fontWeight:"700", fontSize:13 },

  /* Overlay */
  overlay: { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },

  /* Sheet agence */
  agSheet:   { backgroundColor:C.white, borderTopLeftRadius:22, borderTopRightRadius:22, paddingHorizontal:16, paddingBottom:36, paddingTop:8, ...sh },
  sheetHandle:{ width:40, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:"center", marginBottom:12 },
  sheetTitle: { fontSize:16, fontWeight:"900", color:C.ink, marginBottom:12 },
  agRow:     { flexDirection:"row", alignItems:"center", gap:12, padding:12, borderRadius:12, marginBottom:6 },
  agRowIcon: { width:38, height:38, borderRadius:19, alignItems:"center", justifyContent:"center" },
  agRowName: { fontSize:14, fontWeight:"700", color:C.ink },
  agRowSub:  { fontSize:11, color:C.sub, marginTop:2 },
  mineDot:   { width:6, height:6, borderRadius:3, backgroundColor:C.green },

  /* Sheet détail */
  detailSheet: { backgroundColor:C.white, borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:"92%", paddingHorizontal:16, ...sh },

  /* Sheet annulation */
  cancelSheet: { backgroundColor:C.white, borderTopLeftRadius:22, borderTopRightRadius:22, padding:16, gap:10, ...sh },
  cancelRef:   { fontSize:13, color:C.sub, marginBottom:4 },
  cancelInput: { backgroundColor:C.bg, borderRadius:10, borderWidth:1, borderColor:C.border, padding:12, fontSize:13, color:C.ink, minHeight:60, textAlignVertical:"top" },
  cancelConfirmBtn: { backgroundColor:C.red, borderRadius:12, paddingVertical:13, alignItems:"center" },
  cancelConfirmTxt: { color:"#fff", fontSize:14, fontWeight:"800" },
  cancelKeepBtn:    { alignItems:"center", paddingVertical:10 },
  cancelKeepTxt:    { fontSize:13, color:C.sub, fontWeight:"600" },
});

/* ── Styles détail passager ──────────────────────────────── */
const ds = StyleSheet.create({
  handle:    { alignItems:"center", paddingTop:10, paddingBottom:6 },
  handleBar: { width:36, height:4, borderRadius:2, backgroundColor:C.border },

  head:      { flexDirection:"row", alignItems:"flex-start", gap:12, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border },
  avatar:    { width:48, height:48, borderRadius:24, alignItems:"center", justifyContent:"center" },
  avatarTxt: { fontSize:20, fontWeight:"900" },
  headMid:   { flex:1, gap:6 },
  headName:  { fontSize:17, fontWeight:"900", color:C.ink },
  headRow:   { flexDirection:"row", alignItems:"center", gap:8 },
  headRef:   { fontSize:11, color:C.sub },
  statusPill:{ borderRadius:8, paddingHorizontal:9, paddingVertical:3 },
  statusPillTxt:{ fontSize:10, fontWeight:"700" },

  section:   { paddingTop:14, paddingBottom:4, borderBottomWidth:1, borderBottomColor:C.border },
  sLabel:    { fontSize:9, fontWeight:"900", color:C.sub, letterSpacing:1.1, textTransform:"uppercase", marginBottom:8 },
  infoCard:  { backgroundColor:C.slateSoft, borderRadius:10, padding:11, gap:7 },
  row:       { flexDirection:"row", alignItems:"center", gap:8 },
  rowVal:    { fontSize:13, fontWeight:"700", color:C.ink, flex:1 },
  rowTxt:    { fontSize:12, color:C.ink, flex:1 },
  seatBadge: { backgroundColor:C.tealLt, borderRadius:6, paddingHorizontal:8, paddingVertical:2 },
  seatBadgeTxt:{ fontSize:10, fontWeight:"700", color:C.teal },
  phoneRow:  { flexDirection:"row", alignItems:"center", gap:8, backgroundColor:C.tealLt, borderRadius:9, paddingHorizontal:12, paddingVertical:10 },
  phoneTxt:  { fontSize:13, fontWeight:"700", color:C.teal, flex:1 },
  callBadge: { backgroundColor:C.teal, borderRadius:7, paddingHorizontal:9, paddingVertical:3 },
  callBadgeTxt:{ fontSize:10, fontWeight:"700", color:"#fff" },

  amountTxt: { fontSize:20, fontWeight:"900", color:C.ink },
  methodTxt: { fontSize:12, color:C.sub, marginTop:2 },

  photoWrap:    { borderRadius:12, overflow:"hidden", height:170, marginBottom:8 },
  photo:        { width:"100%", height:170 },
  photoOverlay: { position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", alignItems:"center", gap:6, padding:10, backgroundColor:"rgba(0,0,0,0.5)" },
  photoLbl:     { color:"#fff", fontWeight:"600", fontSize:12 },
  photoPlaceholder:    { height:100, borderRadius:12, backgroundColor:C.purpleLt, alignItems:"center", justifyContent:"center", gap:6, marginBottom:8 },
  photoPlaceholderTxt: { fontSize:12, color:C.purple, fontWeight:"600" },
  bagItem:   { flexDirection:"row", alignItems:"center", gap:10, paddingTop:8, borderTopWidth:1, borderTopColor:C.border },
  bagThumb:  { width:44, height:44, borderRadius:8 },
  bagType:   { fontSize:12, fontWeight:"700", color:C.ink },
  bagDesc:   { fontSize:11, color:C.sub },
  bagStatus: { fontSize:10, fontWeight:"700" },
  bagPrice:  { fontSize:12, fontWeight:"800", color:C.teal },

  footRow:   { paddingTop:12, paddingBottom:4, alignItems:"center" },
  footTxt:   { fontSize:11, color:C.sub },

  actRow:    { flexDirection:"row", gap:10, paddingTop:14 },
  actBtn:    { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, paddingVertical:14, borderRadius:13 },
  actBtnTxt: { fontSize:14, fontWeight:"800", color:"#fff" },
});
