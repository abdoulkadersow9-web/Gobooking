import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#1A56DB";
const DARK    = "#1340A8";

/* ─── Demo data ────────────────────────────────────────── */
const BUSES = [
  { id: "b1", name: "Express Abidjan 01", plate: "0258 AB 01", type: "Premium",  cap: 49, status: "active"      },
  { id: "b2", name: "Bouaké Direct 02",   plate: "0258 AB 02", type: "Standard", cap: 59, status: "active"      },
  { id: "b3", name: "Yamoussoukro 03",    plate: "0258 AB 03", type: "Standard", cap: 63, status: "maintenance" },
  { id: "b4", name: "Korhogo Express 04", plate: "0258 AB 04", type: "VIP",      cap: 49, status: "active"      },
  { id: "b5", name: "San Pedro 05",       plate: "0258 AB 05", type: "Standard", cap: 59, status: "active"      },
];

const TRIPS = [
  { id: "t1", from: "Abidjan",   to: "Bouaké",       date: "17/03/2026", dep: "08h00", bus: "Express Abidjan 01", seats: 49, price: 3500 },
  { id: "t2", from: "Abidjan",   to: "Yamoussoukro", date: "17/03/2026", dep: "09h00", bus: "Bouaké Direct 02",   seats: 59, price: 2000 },
  { id: "t3", from: "Abidjan",   to: "Korhogo",      date: "18/03/2026", dep: "07h00", bus: "Yamoussoukro 03",    seats: 63, price: 6000 },
  { id: "t4", from: "Bouaké",    to: "Korhogo",      date: "18/03/2026", dep: "10h00", bus: "Korhogo Express 04", seats: 49, price: 2500 },
  { id: "t5", from: "San Pedro", to: "Abidjan",      date: "19/03/2026", dep: "06h00", bus: "San Pedro 05",       seats: 59, price: 3000 },
];

const AGENTS = [
  { id: "a1", name: "Kouassi Jean",    code: "AGT-001", phone: "07 07 11 22 33", bus: "Express Abidjan 01", status: "active"   },
  { id: "a2", name: "Traoré Mamadou",  code: "AGT-002", phone: "05 05 44 55 66", bus: "Bouaké Direct 02",   status: "active"   },
  { id: "a3", name: "Bamba Fatima",    code: "AGT-003", phone: "01 01 77 88 99", bus: "Korhogo Express 04", status: "active"   },
  { id: "a4", name: "Diallo Seydou",   code: "AGT-004", phone: "07 07 22 33 44", bus: "Non assigné",        status: "inactive" },
  { id: "a5", name: "Coulibaly Koffi", code: "AGT-005", phone: "05 05 55 66 77", bus: "Yamoussoukro 03",    status: "active"   },
  { id: "a6", name: "Assiéta Koné",   code: "AGT-006", phone: "01 01 88 99 00", bus: "San Pedro 05",       status: "active"   },
];

/* 49 seats: 4 cols × ~12 rows */
function makeSeats(total: number, busId: string) {
  const letters = ["A","B","C","D"];
  const rows = Math.ceil(total / 4);
  const pct  = busId === "b1" ? 0.67 : busId === "b2" ? 0.55 : 0.40;
  const booked = Math.round(total * pct);
  return { rows, booked, avail: total - booked, total };
}

const BOOKINGS = [
  { ref: "GBB5AKZ8DZ", route: "Abidjan → Bouaké",       passengers: ["Kouassi Ama · A3","Traoré Youssouf · A4"], pay: "Orange Money", amount: 7000,  status: "confirmed" },
  { ref: "GBB9MNX2PL", route: "Abidjan → Bouaké",       passengers: ["Bamba Koffi · B1"],                        pay: "MTN MoMo",    amount: 3500,  status: "boarded"   },
  { ref: "GBBA1C3RQ7", route: "Abidjan → Yamoussoukro", passengers: ["Diallo Mariam · C2","Diallo Seydou · C3"], pay: "Wave",        amount: 4000,  status: "confirmed" },
  { ref: "GBB7FPV6NM", route: "Abidjan → Korhogo",      passengers: ["Coulibaly Jean · D5"],                     pay: "Orange Money", amount: 6000, status: "confirmed" },
  { ref: "GBBC5XK0TZ", route: "Abidjan → Yamoussoukro", passengers: ["Assiéta Koné · E1"],                      pay: "Visa/MC",     amount: 2000,  status: "cancelled" },
];

const PARCELS = [
  { ref: "GBX-A4F2-KM91", from: "Abidjan",   to: "Bouaké",       sender: "Assiéta Koné",  recv: "Diabaté Oumar",  kg: 4.5, amount: 4700, status: "en_transit"     },
  { ref: "GBX-B9C3-PL44", from: "San Pedro", to: "Abidjan",      sender: "Traoré Adama",  recv: "Koffi Ama",      kg: 1.2, amount: 6200, status: "livre"          },
  { ref: "GBX-C1E7-QR22", from: "Abidjan",   to: "Yamoussoukro", sender: "Bamba Sali",    recv: "Coulibaly Jean", kg: 2.1, amount: 3500, status: "en_attente"     },
  { ref: "GBX-D5F8-MN33", from: "Abidjan",   to: "Korhogo",      sender: "Koffi Ama",     recv: "Diallo Jean",    kg: 8.0, amount: 8100, status: "pris_en_charge" },
  { ref: "GBX-E2G9-XY77", from: "Bouaké",    to: "Abidjan",      sender: "Traoré Mamadou",recv: "Coulibaly Sali", kg: 3.0, amount: 5200, status: "en_livraison"  },
];

const BOOKING_STATUS: Record<string, {label:string;color:string;bg:string}> = {
  confirmed: { label:"Confirmé",  color:PRIMARY,   bg:"#EEF2FF" },
  boarded:   { label:"Embarqué",  color:"#065F46", bg:"#ECFDF5" },
  cancelled: { label:"Annulé",    color:"#DC2626", bg:"#FEF2F2" },
};
const PARCEL_STATUS: Record<string, {label:string;color:string;bg:string}> = {
  en_attente:     { label:"En attente",     color:"#B45309", bg:"#FFFBEB" },
  pris_en_charge: { label:"Pris en charge", color:"#1D4ED8", bg:"#EFF6FF" },
  en_transit:     { label:"En transit",     color:"#6D28D9", bg:"#F5F3FF" },
  en_livraison:   { label:"En livraison",   color:"#0E7490", bg:"#ECFEFF" },
  livre:          { label:"Livré",          color:"#065F46", bg:"#ECFDF5" },
};

function SectionHeader({ title, icon, onAdd, addLabel }: { title:string; icon:string; onAdd?:()=>void; addLabel?:string }) {
  return (
    <View style={S.sectionHeader}>
      <View style={S.sectionTitleRow}>
        <Feather name={icon as never} size={16} color={PRIMARY} />
        <Text style={S.sectionTitle}>{title}</Text>
      </View>
      {onAdd && (
        <TouchableOpacity style={S.addBtn} onPress={onAdd} activeOpacity={0.8}>
          <Feather name="plus" size={13} color="white" />
          <Text style={S.addBtnText}>{addLabel ?? "Ajouter"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CompanyPreview() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const seats49 = makeSeats(49, "b1");
  const seats59 = makeSeats(59, "b2");
  const seats63 = makeSeats(63, "b3");

  function SeatGrid({ total, booked, busName }: { total:number; booked:number; busName:string }) {
    const rows = Math.ceil(total / 4);
    const letters = ["A","B","C","D"];
    const avail = total - booked;
    let idx = 0;
    return (
      <View style={S.seatCard}>
        <View style={S.seatCardHeader}>
          <Text style={S.seatBusName}>{busName}</Text>
          <View style={S.seatStats}>
            <Text style={S.seatStatG}>{avail} libres</Text>
            <Text style={S.seatStatR}>{booked} réservés</Text>
            <Text style={S.seatStatB}>{total} total</Text>
          </View>
        </View>
        <View style={S.busFrame}>
          <View style={S.busNose}><Feather name="truck" size={14} color="#94A3B8" /></View>
          <View style={S.seatGrid}>
            {Array.from({length: rows}, (_, r) => (
              <View key={r} style={S.seatRow}>
                {[0,1].map(c => {
                  idx++;
                  if (idx > total) return <View key={c} style={S.seatEmpty} />;
                  const isBooked = idx <= booked;
                  return (
                    <View key={c} style={[S.seat, isBooked ? S.seatBooked : S.seatAvail]}>
                      <Text style={[S.seatNum, {color: isBooked ? "#DC2626" : "#059669"}]}>{letters[c]}{r+1}</Text>
                    </View>
                  );
                })}
                <View style={S.seatAisle} />
                {[2,3].map(c => {
                  idx++;
                  if (idx > total) return <View key={c} style={S.seatEmpty} />;
                  const isBooked = idx <= booked;
                  return (
                    <View key={c} style={[S.seat, isBooked ? S.seatBooked : S.seatAvail]}>
                      <Text style={[S.seatNum, {color: isBooked ? "#DC2626" : "#059669"}]}>{letters[c]}{r+1}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[S.container, {paddingTop: topPad}]}>
      {/* Header */}
      <LinearGradient colors={[PRIMARY, DARK]} style={S.header}>
        <View style={S.headerIcon}><Feather name="briefcase" size={18} color="white" /></View>
        <View style={{flex:1}}>
          <Text style={S.headerTitle}>Tableau de bord Entreprise</Text>
          <Text style={S.headerSub}>SOTRAL — Société de Transport CI</Text>
        </View>
        <View style={S.badge}><Text style={S.badgeText}>Entreprise</Text></View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{padding:16, paddingBottom: botPad + 40, gap:0}}
        showsVerticalScrollIndicator={false}
      >

        {/* ══ KPI ══════════════════════════════════════════ */}
        <View style={S.kpiRow}>
          {[
            {icon:"truck",      label:"Bus actifs",   value:"9/12",        color:"#1D4ED8", bg:"#EFF6FF"},
            {icon:"users",      label:"Agents",       value:"18",          color:"#7C3AED", bg:"#F5F3FF"},
            {icon:"navigation", label:"Trajets",      value:"284",         color:PRIMARY,   bg:"#EEF2FF"},
            {icon:"bookmark",   label:"Réservations", value:"1 420",       color:"#059669", bg:"#ECFDF5"},
            {icon:"package",    label:"Colis",        value:"638",         color:"#D97706", bg:"#FFFBEB"},
            {icon:"trending-up",label:"Revenus",      value:"8.8 M FCFA",  color:"#0891B2", bg:"#ECFEFF"},
          ].map((k,i) => (
            <View key={i} style={[S.kpiCard, {borderLeftColor: k.color}]}>
              <View style={[S.kpiIcon, {backgroundColor: k.bg}]}><Feather name={k.icon as never} size={14} color={k.color} /></View>
              <Text style={S.kpiValue}>{k.value}</Text>
              <Text style={S.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* ══ 1. BUS ═══════════════════════════════════════ */}
        <View style={S.section}>
          <SectionHeader title={`Bus (${BUSES.length})`} icon="truck" addLabel="Ajouter un bus" onAdd={() => {}} />
          <View style={S.legend}>
            <View style={S.legendItem}><View style={[S.legendDot, {backgroundColor:"#ECFDF5",borderColor:"#059669"}]}/><Text style={S.legendTxt}>Actif</Text></View>
            <View style={S.legendItem}><View style={[S.legendDot, {backgroundColor:"#FFFBEB",borderColor:"#D97706"}]}/><Text style={S.legendTxt}>Maintenance</Text></View>
          </View>
          {BUSES.map(bus => (
            <View key={bus.id} style={S.card}>
              <View style={[S.cardIcon, {backgroundColor: bus.status==="active" ? "#EFF6FF" : "#FFF7ED"}]}>
                <Feather name="truck" size={18} color={bus.status==="active" ? "#1D4ED8" : "#D97706"} />
              </View>
              <View style={{flex:1}}>
                <Text style={S.cardTitle}>{bus.name}</Text>
                <Text style={S.cardSub}>{bus.plate} · {bus.type}</Text>
                <View style={S.capBadge}>
                  <Feather name="users" size={10} color={PRIMARY} />
                  <Text style={S.capText}>{bus.cap} places</Text>
                </View>
              </View>
              <View style={[S.statusBadge, {backgroundColor: bus.status==="active" ? "#ECFDF5" : "#FFFBEB"}]}>
                <Text style={[S.statusText, {color: bus.status==="active" ? "#065F46" : "#B45309"}]}>
                  {bus.status==="active" ? "Actif" : "Maintenance"}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ══ 2. TRIPS ═════════════════════════════════════ */}
        <View style={S.section}>
          <SectionHeader title={`Trajets (${TRIPS.length})`} icon="navigation" addLabel="Nouveau trajet" onAdd={() => {}} />
          {TRIPS.map(trip => (
            <View key={trip.id} style={S.tripCard}>
              <View style={S.tripIconWrap}><Feather name="navigation" size={14} color={PRIMARY} /></View>
              <View style={{flex:1}}>
                <Text style={S.tripRoute}>{trip.from} → {trip.to}</Text>
                <Text style={S.cardSub}>{trip.date} · {trip.dep} · {trip.bus}</Text>
                <Text style={S.cardSub}>{trip.seats} places · {(trip.price ?? 0).toLocaleString()} FCFA/place</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ══ 3. AGENTS ════════════════════════════════════ */}
        <View style={S.section}>
          <SectionHeader title={`Agents (${AGENTS.length})`} icon="users" addLabel="Ajouter agent" onAdd={() => {}} />
          {AGENTS.map(ag => (
            <View key={ag.id} style={S.card}>
              <View style={S.avatar}><Text style={S.avatarTxt}>{ag.name.charAt(0)}</Text></View>
              <View style={{flex:1}}>
                <Text style={S.cardTitle}>{ag.name}</Text>
                <Text style={S.cardSub}>{ag.code} · {ag.phone}</Text>
                <View style={{flexDirection:"row",alignItems:"center",gap:4,marginTop:2}}>
                  <Feather name="truck" size={10} color={ag.bus!=="Non assigné" ? PRIMARY : "#94A3B8"} />
                  <Text style={[S.cardSub, {color: ag.bus!=="Non assigné" ? PRIMARY : "#94A3B8"}]}>{ag.bus}</Text>
                </View>
              </View>
              <View style={{alignItems:"flex-end",gap:5}}>
                <View style={[S.statusBadge, {backgroundColor: ag.status==="active" ? "#ECFDF5" : "#F1F5F9"}]}>
                  <Text style={[S.statusText, {color: ag.status==="active" ? "#065F46" : "#94A3B8"}]}>
                    {ag.status==="active" ? "Actif" : "Inactif"}
                  </Text>
                </View>
                <View style={S.assignBadge}>
                  <Feather name="link" size={9} color="#7C3AED" />
                  <Text style={S.assignText}>Assigner</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ══ 4. SEATS ═════════════════════════════════════ */}
        <View style={S.section}>
          <SectionHeader title="Disponibilité des sièges" icon="grid" />
          <Text style={S.sectionNote}>Plan de siège par bus · Vert = libre · Rouge = réservé</Text>
          <SeatGrid total={49} booked={seats49.booked} busName="Express Abidjan 01 (49 places)" />
          <SeatGrid total={59} booked={seats59.booked} busName="Bouaké Direct 02 (59 places)" />
          <SeatGrid total={63} booked={seats63.booked} busName="Yamoussoukro 03 (63 places)" />
        </View>

        {/* ══ 5. RESERVATIONS ══════════════════════════════ */}
        <View style={S.section}>
          <SectionHeader title={`Réservations (${BOOKINGS.length})`} icon="bookmark" />
          {BOOKINGS.map((b, i) => {
            const st = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.confirmed;
            return (
              <View key={i} style={S.reservCard}>
                <View style={S.reservTop}>
                  <Text style={S.reservRef}>#{b.ref}</Text>
                  <View style={[S.chip, {backgroundColor:st.bg}]}><Text style={[S.chipTxt,{color:st.color}]}>{st.label}</Text></View>
                </View>
                <Text style={[S.cardSub, {marginBottom:4}]}>{b.route}</Text>
                {(b.passengers ?? []).map((p,j) => (
                  <View key={j} style={S.paxRow}>
                    <View style={S.seatTag}><Text style={S.seatTagTxt}>{p.split(" · ")[1]}</Text></View>
                    <Text style={S.paxName}>{p.split(" · ")[0]}</Text>
                  </View>
                ))}
                <View style={S.reservBottom}>
                  <Text style={S.cardSub}>{b.pay}</Text>
                  <Text style={S.reservAmt}>{(b.amount ?? 0).toLocaleString()} FCFA</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ══ 6. PARCELS ═══════════════════════════════════ */}
        <View style={S.section}>
          <SectionHeader title={`Colis (${PARCELS.length})`} icon="package" />
          {PARCELS.map((p, i) => {
            const st = PARCEL_STATUS[p.status] ?? PARCEL_STATUS.en_attente;
            return (
              <View key={i} style={S.card}>
                <View style={[S.cardIcon, {backgroundColor:st.bg}]}><Feather name="package" size={16} color={st.color} /></View>
                <View style={{flex:1}}>
                  <Text style={S.cardTitle}>{p.ref}</Text>
                  <Text style={S.cardSub}>{p.from} → {p.to} · {p.kg} kg</Text>
                  <Text style={S.cardSub}>{p.sender} → {p.recv}</Text>
                </View>
                <View style={{alignItems:"flex-end",gap:4}}>
                  <View style={[S.chip, {backgroundColor:st.bg}]}><Text style={[S.chipTxt,{color:st.color}]}>{st.label}</Text></View>
                  <Text style={[S.chipTxt, {color:PRIMARY, fontWeight:"700"}]}>{(p.amount ?? 0).toLocaleString()} F</Text>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  container:      { flex:1, backgroundColor:"#F1F5F9" },
  header:         { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:14, gap:12 },
  headerIcon:     { width:36, height:36, borderRadius:12, backgroundColor:"rgba(255,255,255,0.2)", alignItems:"center", justifyContent:"center" },
  headerTitle:    { color:"white", fontWeight:"700", fontSize:15 },
  headerSub:      { color:"rgba(255,255,255,0.75)", fontSize:11, marginTop:1 },
  badge:          { backgroundColor:"rgba(255,255,255,0.2)", borderRadius:12, paddingHorizontal:10, paddingVertical:5 },
  badgeText:      { color:"white", fontSize:11, fontWeight:"700" },

  kpiRow:         { flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:16 },
  kpiCard:        { backgroundColor:"white", borderRadius:10, padding:10, flex:1, minWidth:"44%", borderLeftWidth:3, gap:3, elevation:2, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:3 },
  kpiIcon:        { width:28, height:28, borderRadius:7, alignItems:"center", justifyContent:"center", marginBottom:2 },
  kpiValue:       { fontSize:16, fontWeight:"800", color:"#1E293B" },
  kpiLabel:       { fontSize:10, color:"#64748B" },

  section:        { marginBottom:20 },
  sectionHeader:  { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:10 },
  sectionTitleRow:{ flexDirection:"row", alignItems:"center", gap:8 },
  sectionTitle:   { fontSize:15, fontWeight:"700", color:"#1E293B" },
  sectionNote:    { fontSize:11, color:"#64748B", marginBottom:10 },
  addBtn:         { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:PRIMARY, paddingHorizontal:11, paddingVertical:7, borderRadius:8 },
  addBtnText:     { color:"white", fontSize:11, fontWeight:"600" },

  legend:         { flexDirection:"row", gap:12, marginBottom:8 },
  legendItem:     { flexDirection:"row", alignItems:"center", gap:5 },
  legendDot:      { width:12, height:12, borderRadius:3, borderWidth:1.5 },
  legendTxt:      { fontSize:11, color:"#64748B" },

  card:           { backgroundColor:"white", borderRadius:12, padding:13, flexDirection:"row", alignItems:"center", gap:11, marginBottom:8, elevation:2, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:3 },
  cardIcon:       { width:40, height:40, borderRadius:10, alignItems:"center", justifyContent:"center" },
  cardTitle:      { fontSize:13, fontWeight:"600", color:"#1E293B" },
  cardSub:        { fontSize:11, color:"#64748B", marginTop:2 },
  capBadge:       { flexDirection:"row", alignItems:"center", gap:3, backgroundColor:"#EEF2FF", paddingHorizontal:6, paddingVertical:2, borderRadius:5, marginTop:4, alignSelf:"flex-start" },
  capText:        { fontSize:10, fontWeight:"700", color:PRIMARY },
  statusBadge:    { paddingHorizontal:8, paddingVertical:3, borderRadius:20 },
  statusText:     { fontSize:10, fontWeight:"600" },
  assignBadge:    { flexDirection:"row", alignItems:"center", gap:3, backgroundColor:"#F5F3FF", paddingHorizontal:7, paddingVertical:3, borderRadius:6 },
  assignText:     { fontSize:10, color:"#7C3AED", fontWeight:"600" },

  tripCard:       { backgroundColor:"white", borderRadius:12, padding:13, flexDirection:"row", alignItems:"flex-start", gap:10, marginBottom:8, elevation:2, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:3 },
  tripIconWrap:   { width:32, height:32, borderRadius:8, backgroundColor:"#EEF2FF", alignItems:"center", justifyContent:"center", marginTop:2 },
  tripRoute:      { fontSize:13, fontWeight:"700", color:"#1E293B" },

  avatar:         { width:40, height:40, borderRadius:20, backgroundColor:"#EEF2FF", alignItems:"center", justifyContent:"center" },
  avatarTxt:      { fontSize:15, fontWeight:"700", color:PRIMARY },

  /* Seat grid */
  seatCard:       { backgroundColor:"white", borderRadius:12, padding:13, marginBottom:14, elevation:2, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:3 },
  seatCardHeader: { marginBottom:10 },
  seatBusName:    { fontSize:13, fontWeight:"700", color:"#1E293B", marginBottom:4 },
  seatStats:      { flexDirection:"row", gap:10 },
  seatStatG:      { fontSize:11, fontWeight:"600", color:"#059669" },
  seatStatR:      { fontSize:11, fontWeight:"600", color:"#DC2626" },
  seatStatB:      { fontSize:11, fontWeight:"600", color:PRIMARY },
  busFrame:       { alignItems:"center" },
  busNose:        { marginBottom:8 },
  seatGrid:       { gap:4, width:"100%" },
  seatRow:        { flexDirection:"row", gap:3, justifyContent:"center" },
  seat:           { width:32, height:28, borderRadius:6, alignItems:"center", justifyContent:"center", borderWidth:1.5 },
  seatBooked:     { backgroundColor:"#FEF2F2", borderColor:"#FCA5A5" },
  seatAvail:      { backgroundColor:"#ECFDF5", borderColor:"#86EFAC" },
  seatEmpty:      { width:32, height:28 },
  seatAisle:      { width:10 },
  seatNum:        { fontSize:8, fontWeight:"700" },

  /* Reservations */
  reservCard:     { backgroundColor:"white", borderRadius:12, padding:13, marginBottom:8, elevation:2, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:3 },
  reservTop:      { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:6 },
  reservRef:      { fontWeight:"700", color:"#1E293B", fontSize:12 },
  chip:           { paddingHorizontal:8, paddingVertical:3, borderRadius:20 },
  chipTxt:        { fontSize:10, fontWeight:"600" },
  paxRow:         { flexDirection:"row", alignItems:"center", gap:7, marginBottom:4 },
  seatTag:        { backgroundColor:"#EEF2FF", paddingHorizontal:6, paddingVertical:2, borderRadius:4 },
  seatTagTxt:     { fontSize:10, fontWeight:"700", color:PRIMARY },
  paxName:        { fontSize:12, color:"#334155" },
  reservBottom:   { flexDirection:"row", justifyContent:"space-between", alignItems:"center", borderTopWidth:1, borderTopColor:"#F1F5F9", paddingTop:7, marginTop:6 },
  reservAmt:      { fontSize:13, fontWeight:"700", color:"#059669" },
});
