/**
 * Cars en route — Carte en temps réel (Leaflet / OpenStreetMap)
 * Route : /cars-en-route-map   (publique, pas besoin de compte)
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/utils/api";
import { scheduleLocalNotification } from "@/utils/notifications";

const { width: SW, height: SH } = Dimensions.get("window");

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface LiveBus {
  id: string;
  companyName: string;
  busName: string;
  busType: string;
  fromCity: string;
  toCity: string;
  currentCity: string;
  mapX: number; mapY: number;
  lat?: number; lon?: number;
  availableSeats: number;
  totalSeats: number;
  departureTime: string;
  estimatedArrival: string;
  agentPhone: string;
  agentName: string;
  price: number;
  color: string;
  boardingPoints: string[];
  gpsLive?: boolean;
  speed?: number | null;
  distanceKm?: number;
}

interface ClientPos { lat: number; lon: number }

/* ─── City coords (Côte d'Ivoire) for ETA calculation ───────────────────── */
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "Abidjan":       { lat: 5.3600, lon: -4.0083 },
  "Bouaké":        { lat: 7.6972, lon: -5.0183 },
  "Yamoussoukro":  { lat: 6.8276, lon: -5.2893 },
  "Korhogo":       { lat: 9.4524, lon: -5.6253 },
  "San-Pédro":     { lat: 4.7481, lon: -6.6360 },
  "Man":           { lat: 7.4123, lon: -7.5554 },
  "Daloa":         { lat: 6.8740, lon: -6.4502 },
  "Divo":          { lat: 5.8380, lon: -5.3573 },
  "Gagnoa":        { lat: 6.1330, lon: -5.9483 },
  "Agboville":     { lat: 5.9240, lon: -4.2183 },
  "Bondoukou":     { lat: 8.0392, lon: -2.8009 },
  "Abengourou":    { lat: 6.7319, lon: -3.4964 },
  "Soubré":        { lat: 5.7913, lon: -6.5992 },
  "Odienné":       { lat: 9.5070, lon: -7.5651 },
};

function calcEta(bus: LiveBus): { distKm: number | null; etaStr: string | null } {
  const dest = CITY_COORDS[bus.toCity];
  if (!dest || !bus.lat || !bus.lon) return { distKm: null, etaStr: null };
  const distKm = haversine(bus.lat, bus.lon, dest.lat, dest.lon);
  if (bus.gpsLive && bus.speed && bus.speed > 5) {
    const etaH = distKm / bus.speed;
    const now = new Date();
    now.setTime(now.getTime() + etaH * 3600 * 1000);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return { distKm, etaStr: `${hh}:${mm} (${Math.round(etaH * 60)} min)` };
  }
  return { distKm, etaStr: null };
}

/* ─── Boarding landmarks (Côte d'Ivoire) ────────────────────────────────── */
const BOARDING_POINTS = [
  { id:"abi-1", name:"Gare routière d'Adjamé",   city:"Abidjan",      lat:5.3620, lon:-4.0195 },
  { id:"abi-2", name:"Gare de Port-Bouët",        city:"Abidjan",      lat:5.2546, lon:-3.9375 },
  { id:"abi-4", name:"Carrefour Palmeraie",       city:"Abidjan",      lat:5.3850, lon:-3.9780 },
  { id:"bou-1", name:"Gare routière Nord Bouaké", city:"Bouaké",       lat:7.6972, lon:-5.0183 },
  { id:"yam-1", name:"Gare centrale Yamoussoukro",city:"Yamoussoukro", lat:6.8276, lon:-5.2893 },
  { id:"kor-1", name:"Gare centrale Korhogo",     city:"Korhogo",      lat:9.4524, lon:-5.6253 },
  { id:"san-1", name:"Gare routière San-Pédro",   city:"San-Pédro",    lat:4.7481, lon:-6.6360 },
  { id:"man-1", name:"Gare centrale de Man",      city:"Man",          lat:7.4123, lon:-7.5554 },
  { id:"dal-1", name:"Gare routière de Daloa",    city:"Daloa",        lat:6.8740, lon:-6.4502 },
  { id:"gag-1", name:"Gare routière de Gagnoa",   city:"Gagnoa",       lat:6.1330, lon:-5.9483 },
];

/* ─── Haversine ─────────────────────────────────────────────────────────── */
function haversine(la1:number,lo1:number,la2:number,lo2:number){
  const R=6371,dL=(la2-la1)*(Math.PI/180),dO=(lo2-lo1)*(Math.PI/180);
  const a=Math.sin(dL/2)**2+Math.cos(la1*(Math.PI/180))*Math.cos(la2*(Math.PI/180))*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmtDist(km:number){
  if(km<1) return `${Math.round(km*1000)} m`;
  if(km<10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
function mapXYtoLatLon(mx:number,my:number){
  return { lat:10.7-(my/100)*6.4, lon:-8.4+(mx/100)*5.2 };
}

/* ─── Leaflet HTML template ─────────────────────────────────────────────── */
function buildLeafletHtml(initialLat:number, initialLon:number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body,html{width:100%;height:100%;overflow:hidden;background:#0f172a;}
  #map{width:100%;height:100%;}
  .bus-marker-icon{
    background:#D97706;border:3px solid #fff;border-radius:50%;
    width:36px;height:36px;display:flex;align-items:center;justify-content:center;
    font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;
    position:relative;
  }
  .bus-marker-icon.gps{background:#059669;}
  .bus-badge{
    position:absolute;top:-8px;right:-8px;
    background:#EF4444;color:#fff;border-radius:999px;
    font-size:10px;font-weight:700;padding:1px 5px;
    border:1.5px solid #fff;min-width:18px;text-align:center;
  }
  .boarding-icon{
    background:#1A56DB;border:3px solid #fff;border-radius:8px;
    width:30px;height:30px;display:flex;align-items:center;justify-content:center;
    font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;
  }
  .user-icon{
    background:#7C3AED;border:3px solid #fff;border-radius:50%;
    width:28px;height:28px;display:flex;align-items:center;justify-content:center;
    font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.4);
    animation:pulse 2s infinite;
  }
  @keyframes pulse{
    0%{box-shadow:0 0 0 0 rgba(124,58,237,0.5);}
    70%{box-shadow:0 0 0 12px rgba(124,58,237,0);}
    100%{box-shadow:0 0 0 0 rgba(124,58,237,0);}
  }
  .leaflet-popup-content-wrapper{
    background:#1e293b;color:#f1f5f9;border-radius:12px;
    border:1px solid rgba(255,255,255,0.1);
    box-shadow:0 4px 20px rgba(0,0,0,0.5);
  }
  .leaflet-popup-tip{background:#1e293b;}
  .popup-title{font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:4px;}
  .popup-sub{font-size:12px;color:#94a3b8;}
  .popup-badge{
    display:inline-block;background:#059669;color:#fff;
    border-radius:999px;font-size:11px;font-weight:600;
    padding:2px 8px;margin-top:6px;
  }
  .popup-btn{
    display:block;width:100%;margin-top:8px;
    background:#1A56DB;color:#fff;border:none;border-radius:8px;
    padding:8px;font-size:13px;font-weight:600;cursor:pointer;
  }
  .popup-btn:hover{background:#1447b0;}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map',{
  center:[${initialLat},${initialLon}],
  zoom:7,
  zoomControl:true,
  attributionControl:false
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:18,
  attribution:'© OpenStreetMap'
}).addTo(map);

function rn(msg){
  if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
}

var busMarkers={};
var boardingMarkers={};
var userMarker=null;

function makeBusIcon(seats,gps){
  return L.divIcon({
    className:'',
    html:'<div class="bus-marker-icon'+(gps?' gps':'')+'">🚌<span class="bus-badge">'+seats+'</span></div>',
    iconSize:[36,36],iconAnchor:[18,18]
  });
}
function makeBoardingIcon(){
  return L.divIcon({
    className:'',
    html:'<div class="boarding-icon">📍</div>',
    iconSize:[30,30],iconAnchor:[15,15]
  });
}
function makeUserIcon(){
  return L.divIcon({
    className:'',
    html:'<div class="user-icon">👤</div>',
    iconSize:[28,28],iconAnchor:[14,14]
  });
}

function fmtDist(km){
  if(km<1) return Math.round(km*1000)+' m';
  if(km<10) return km.toFixed(1)+' km';
  return Math.round(km)+' km';
}
function updateBuses(buses){
  var ids={};
  buses.forEach(function(b){
    ids[b.id]=true;
    var popup='<div class="popup-title">'+b.companyName+'</div>'+
      '<div class="popup-sub">'+b.fromCity+' → '+b.toCity+'</div>'+
      '<div class="popup-sub">Agent: '+b.agentName+'</div>'+
      (b.speed&&b.speed>0?'<div class="popup-sub">⚡ '+Math.round(b.speed)+' km/h</div>':'')+
      (b.distToDestKm?'<div class="popup-sub">📍 '+fmtDist(b.distToDestKm)+' restants</div>':'')+
      (b.etaStr?'<div class="popup-sub">🕐 Arrivée ~'+b.etaStr+'</div>':'')+
      (b.gpsLive?'<span class="popup-badge" style="background:#059669">🟢 GPS Live</span>':'<span class="popup-badge">'+b.availableSeats+' sièges</span>')+
      (!b.gpsLive?'':'<span class="popup-badge" style="margin-left:4px;background:#1A56DB">'+b.availableSeats+' sièges</span>')+
      '<button class="popup-btn" onclick="rn({type:\'selectBus\',busId:\''+b.id+'\'})">Réserver ce bus</button>';
    if(busMarkers[b.id]){
      busMarkers[b.id].setLatLng([b.lat,b.lon]);
      busMarkers[b.id].setIcon(makeBusIcon(b.availableSeats,b.gpsLive));
      busMarkers[b.id].setPopupContent(popup);
    } else {
      var m=L.marker([b.lat,b.lon],{icon:makeBusIcon(b.availableSeats,b.gpsLive)})
        .addTo(map).bindPopup(popup);
      m.on('click',function(){ rn({type:'selectBus',busId:b.id}); });
      busMarkers[b.id]=m;
    }
  });
  Object.keys(busMarkers).forEach(function(id){
    if(!ids[id]){ map.removeLayer(busMarkers[id]); delete busMarkers[id]; }
  });
}

function updateBoarding(points){
  points.forEach(function(p){
    if(!boardingMarkers[p.id]){
      var popup='<div class="popup-title">'+p.name+'</div>'+
        '<div class="popup-sub">'+p.city+'</div>'+
        '<button class="popup-btn" onclick="rn({type:\'selectBoarding\',id:\''+p.id+'\'})">Choisir ce point</button>';
      var m=L.marker([p.lat,p.lon],{icon:makeBoardingIcon()})
        .addTo(map).bindPopup(popup);
      m.on('click',function(){ rn({type:'selectBoarding',id:p.id}); });
      boardingMarkers[p.id]=m;
    }
  });
}

function updateUser(lat,lon){
  if(userMarker){ userMarker.setLatLng([lat,lon]); }
  else {
    userMarker=L.marker([lat,lon],{icon:makeUserIcon(),zIndexOffset:1000})
      .addTo(map).bindPopup('<div class="popup-title">Votre position</div>');
  }
}

function focusBus(lat,lon){
  map.flyTo([lat,lon],13,{duration:1.2});
}

window.addEventListener('message',function(e){
  try{
    var d=JSON.parse(e.data);
    if(d.type==='buses') updateBuses(d.payload);
    if(d.type==='boarding') updateBoarding(d.payload);
    if(d.type==='userPos') updateUser(d.lat,d.lon);
    if(d.type==='focusBus') focusBus(d.lat,d.lon);
    if(d.type==='fitAll' && d.bounds) map.flyToBounds(d.bounds,{padding:[40,40],duration:1});
  } catch(err){}
});
</script>
</body>
</html>`;
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function CarsEnRouteMap() {
  const insets = useSafeAreaInsets();

  /* State */
  const [buses, setBuses]               = useState<LiveBus[]>([]);
  const [loading, setLoading]           = useState(true);
  const [clientPos, setClientPos]       = useState<ClientPos | null>(null);
  const [selectedBus, setSelectedBus]   = useState<LiveBus | null>(null);
  const [showFilters, setShowFilters]   = useState(false);
  const [filterRoute, setFilterRoute]   = useState("");
  const [filterSeats, setFilterSeats]   = useState(false);
  const [showRequest, setShowRequest]   = useState(false);
  const [boardingPoint, setBoardingPoint] = useState("");
  const [clientName, setClientName]     = useState("");
  const [clientPhone, setClientPhone]   = useState("");
  const [seatsReq, setSeatsReq]         = useState(1);
  const [sending, setSending]           = useState(false);
  const [mapReady, setMapReady]         = useState(false);
  const [countdown, setCountdown]       = useState(5);
  const [successMsg, setSuccessMsg]     = useState("");

  /* ── En-route request tracking ── */
  const [activeRequest, setActiveRequest] = useState<{ requestId: string; tripId: string } | null>(null);
  const [requestStatus, setRequestStatus] = useState<"pending" | "accepted" | "rejected" | null>(null);
  const [showQR, setShowQR]               = useState(false);

  const webviewRef    = useRef<WebView>(null);
  const sheetY        = useRef(new Animated.Value(0)).current;
  const firstLoad     = useRef(true);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const reqPollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const nearbyNotifiedRef = useRef<Set<string>>(new Set());

  /* ── Load stored user info ── */
  useEffect(()=>{
    (async()=>{
      const raw = await AsyncStorage.getItem("auth_user");
      if(raw){
        try{
          const u = JSON.parse(raw);
          if(u.name) setClientName(u.name);
          if(u.phone) setClientPhone(u.phone);
        } catch{}
      }
    })();
  },[]);

  /* ── GPS ── */
  useEffect(()=>{
    (async()=>{
      const { status } = await Location.requestForegroundPermissionsAsync();
      if(status!=="granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.Balanced });
      const cp = { lat:pos.coords.latitude, lon:pos.coords.longitude };
      setClientPos(cp);
      sendToMap({ type:"userPos", lat:cp.lat, lon:cp.lon });
    })();
  },[mapReady]);

  /* ── Fetch buses ── */
  const fetchBuses = useCallback(async()=>{
    try{
      const data = await apiFetch("/trips/live");
      const arr: LiveBus[] = (data||[]).map((b:LiveBus)=>{
        let lat = b.lat, lon = b.lon;
        if(!lat || !lon){
          const ll = mapXYtoLatLon(b.mapX ?? 50, b.mapY ?? 50);
          lat = ll.lat; lon = ll.lon;
        }
        const dist = clientPos
          ? haversine(clientPos.lat,clientPos.lon,lat!,lon!)
          : 9999;
        return { ...b, lat, lon, distanceKm:dist };
      });
      arr.sort((a,b)=>(a.distanceKm??9999)-(b.distanceKm??9999));

      /* ── Proximity notifications (< 1 km) ── */
      if (Platform.OS !== "web") {
        arr.forEach(bus => {
          const dist = bus.distanceKm ?? 9999;
          if (dist < 1.0 && !nearbyNotifiedRef.current.has(bus.id)) {
            nearbyNotifiedRef.current.add(bus.id);
            scheduleLocalNotification(
              "🚌 Car à proximité !",
              `${bus.companyName} (${bus.fromCity} → ${bus.toCity}) est à ${fmtDist(dist)} de vous`,
            );
          }
        });
      }

      setBuses(arr);
      setLoading(false);
      sendToMap({ type:"buses", payload:arr.map(b=>{
        const eta = calcEta(b);
        return {
          id:b.id, companyName:b.companyName, fromCity:b.fromCity, toCity:b.toCity,
          agentName:b.agentName, availableSeats:b.availableSeats,
          lat:b.lat!, lon:b.lon!, gpsLive:b.gpsLive, speed:b.speed,
          distToDestKm: eta.distKm, etaStr: eta.etaStr,
        };
      })});
      if(firstLoad.current && arr.length>0){
        firstLoad.current=false;
        /* Show all buses on initial load */
        const lats=arr.map(b=>b.lat!), lons=arr.map(b=>b.lon!);
        const bounds=[[Math.min(...lats),Math.min(...lons)],[Math.max(...lats),Math.max(...lons)]];
        sendToMap({ type:"fitAll", bounds });
        /* Send boarding points once */
        sendToMap({ type:"boarding", payload:BOARDING_POINTS });
      }
      setCountdown(5);
    } catch(err){
      setLoading(false);
    }
  },[clientPos, mapReady]);

  /* ── Countdown & poll ── */
  useEffect(()=>{
    if(!mapReady) return;
    fetchBuses();
    pollRef.current = setInterval(fetchBuses, 5000);
    return ()=>{ if(pollRef.current) clearInterval(pollRef.current); };
  },[fetchBuses, mapReady]);

  useEffect(()=>{
    const t = setInterval(()=>setCountdown(c=>c<=1?5:c-1), 1000);
    return ()=>clearInterval(t);
  },[]);

  /* ── Send JSON to WebView ── */
  const sendToMap = useCallback((msg:object)=>{
    webviewRef.current?.injectJavaScript(
      `(function(){ window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(msg))}})); })(); true;`
    );
  },[]);

  /* ── Handle WebView → RN messages ── */
  const onWebMessage = useCallback((e:{nativeEvent:{data:string}})=>{
    try{
      const msg = JSON.parse(e.nativeEvent.data);
      if(msg.type==="selectBus"){
        const bus = buses.find(b=>b.id===msg.busId);
        if(bus){
          setSelectedBus(bus);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          sendToMap({ type:"focusBus", lat:bus.lat!, lon:bus.lon! });
          Animated.spring(sheetY,{toValue:1,useNativeDriver:false}).start();
        }
      }
      if(msg.type==="selectBoarding"){
        const bp = BOARDING_POINTS.find(p=>p.id===msg.id);
        if(bp) setBoardingPoint(bp.name);
      }
    } catch{}
  },[buses, sendToMap, sheetY]);

  /* ── Filtered buses ── */
  const filtered = useMemo(()=>{
    return buses.filter(b=>{
      if(filterSeats && b.availableSeats<=0) return false;
      if(filterRoute && !`${b.fromCity} ${b.toCity}`.toLowerCase().includes(filterRoute.toLowerCase())) return false;
      return true;
    });
  },[buses, filterRoute, filterSeats]);

  /* ── Call agent ── */
  const callAgent = (phone:string)=>Linking.openURL(`tel:${phone}`);
  const whatsApp  = (phone:string)=>{
    const text = encodeURIComponent("Bonjour, je suis client GoBooking, je suis à mon point de montée");
    Linking.openURL(`https://wa.me/${phone.replace(/\D/g,"")}?text=${text}`);
  };

  /* ── Stop request polling ── */
  const stopReqPoll = ()=>{
    if(reqPollRef.current){ clearInterval(reqPollRef.current); reqPollRef.current=null; }
  };

  /* ── Cleanup on unmount ── */
  useEffect(()=>()=>{
    stopReqPoll();
    if(pollRef.current) clearInterval(pollRef.current);
  },[]);

  /* ── Poll request status ── */
  const startReqPoll = (tripId:string, requestId:string)=>{
    stopReqPoll();
    reqPollRef.current = setInterval(async()=>{
      try{
        const data = await apiFetch(`/trips/${tripId}/request/${requestId}`);
        const status = (data as any)?.status as string | undefined;
        if(status==="accepted"){
          setRequestStatus("accepted");
          setShowQR(true);
          stopReqPoll();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if(status==="rejected"){
          setRequestStatus("rejected");
          stopReqPoll();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch{}
    }, 5000);
  };

  const sendRequest = async()=>{
    if(!selectedBus) return;
    if(!clientName.trim()||!clientPhone.trim()||!boardingPoint.trim()){
      Alert.alert("Champs requis","Remplissez votre nom, téléphone et point d'embarquement."); return;
    }
    setSending(true);
    try{
      const data = await apiFetch(`/trips/${selectedBus.id}/request`,{
        method:"POST",
        body:JSON.stringify({
          clientName:clientName.trim(),
          clientPhone:clientPhone.trim(),
          seatsRequested:seatsReq,
          boardingPoint:boardingPoint.trim(),
        }),
      });
      const requestId = (data as any)?.requestId as string | undefined;
      setShowRequest(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if(requestId){
        setActiveRequest({ requestId, tripId:selectedBus.id });
        setRequestStatus("pending");
        setShowQR(false);
        setSuccessMsg("⏳ Demande envoyée — en attente de confirmation...");
        startReqPoll(selectedBus.id, requestId);
      } else {
        setSuccessMsg("✅ Demande envoyée ! L'agent vous contactera.");
        setTimeout(()=>setSuccessMsg(""), 5000);
      }
    } catch(err){
      Alert.alert("Erreur","Impossible d'envoyer la demande. Réessayez.");
    } finally { setSending(false); }
  };

  const cancelActiveRequest = ()=>{
    stopReqPoll();
    setActiveRequest(null);
    setRequestStatus(null);
    setShowQR(false);
    setSuccessMsg("");
  };

  /* ── Unique routes for filter dropdown ── */
  const routes = useMemo(()=>{
    const set = new Set(buses.map(b=>`${b.fromCity} → ${b.toCity}`));
    return ["", ...Array.from(set)];
  },[buses]);

  /* ── Close bus sheet ── */
  const closeBusSheet = ()=>{
    Animated.spring(sheetY,{toValue:0,useNativeDriver:false}).start(()=>setSelectedBus(null));
  };

  /* ── Initial HTML ── */
  const mapHtml = useMemo(()=>buildLeafletHtml(7.5, -5.5),[]);

  /* ── Sheet height interpolation ── */
  const sheetHeight = sheetY.interpolate({ inputRange:[0,1], outputRange:[0, 340] });

  /* ─ Render ─ */
  return (
    <View style={[styles.root,{paddingTop:insets.top}]}>
      {/* ── Header ── */}
      <LinearGradient colors={["#0f172a","#1e293b"]} style={styles.header}>
        <TouchableOpacity onPress={()=>router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#f8fafc"/>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🚌 Cars en route</Text>
          <Text style={styles.headerSub}>
            {filtered.length} bus{filtered.length>1?"":""}
            {clientPos?" · Tri par distance":""}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={()=>setShowFilters(!showFilters)} style={styles.iconBtn}>
            <Feather name="filter" size={18} color={showFilters?"#60a5fa":"#94a3b8"}/>
          </TouchableOpacity>
          <View style={styles.countdownBadge}>
            <Text style={styles.countdownText}>{countdown}s</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Filter Bar ── */}
      {showFilters && (
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {/* Route chips */}
            {routes.map(r=>(
              <TouchableOpacity
                key={r||"all"}
                onPress={()=>setFilterRoute(r)}
                style={[styles.filterChip, filterRoute===r && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, filterRoute===r && styles.filterChipTextActive]}>
                  {r||"Tous les trajets"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={()=>setFilterSeats(!filterSeats)}
            style={[styles.seatToggle, filterSeats && styles.seatToggleActive]}
          >
            <Feather name="users" size={14} color={filterSeats?"#fff":"#94a3b8"}/>
            <Text style={[styles.seatToggleText, filterSeats && {color:"#fff"}]}>Sièges dispo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Map WebView ── */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          onLoad={()=>setMapReady(true)}
          onMessage={onWebMessage}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          originWhitelist={["*"]}
        />
        {loading && (
          <View style={styles.mapLoader}>
            <ActivityIndicator size="large" color="#1A56DB"/>
            <Text style={styles.mapLoaderText}>Chargement des cars…</Text>
          </View>
        )}
      </View>

      {/* ── Success banner ── */}
      {!!successMsg && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{successMsg}</Text>
        </View>
      )}

      {/* ── Request status panel ── */}
      {activeRequest && (
        <View style={[styles.successBanner, {
          backgroundColor: requestStatus==="accepted" ? "#065F46" : requestStatus==="rejected" ? "#7F1D1D" : "#1e3a5f",
          paddingVertical: 12, paddingHorizontal: 16, gap: 8, alignItems: "stretch",
        }]}>
          {requestStatus==="pending" && (
            <View style={{ flexDirection:"row", alignItems:"center", gap: 10 }}>
              <ActivityIndicator size="small" color="white" />
              <Text style={{ color:"white", fontWeight:"600", fontSize: 13 }}>En attente de confirmation...</Text>
              <TouchableOpacity onPress={cancelActiveRequest}>
                <Feather name="x-circle" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          )}
          {requestStatus==="accepted" && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection:"row", alignItems:"center", gap: 8 }}>
                <Feather name="check-circle" size={18} color="#6EE7B7" />
                <Text style={{ color:"#6EE7B7", fontWeight:"700", fontSize: 14 }}>Demande acceptée !</Text>
                <TouchableOpacity onPress={cancelActiveRequest} style={{ marginLeft:"auto" }}>
                  <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
              <Text style={{ color:"rgba(255,255,255,0.85)", fontSize: 12 }}>Montrez ce QR code à l'agent embarquement</Text>
              <TouchableOpacity onPress={()=>setShowQR(true)} style={{ alignSelf:"flex-start", backgroundColor:"white", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection:"row", alignItems:"center", gap: 6 }}>
                <Feather name="maximize" size={14} color="#065F46" />
                <Text style={{ color:"#065F46", fontWeight:"700", fontSize: 13 }}>Afficher QR Code</Text>
              </TouchableOpacity>
            </View>
          )}
          {requestStatus==="rejected" && (
            <View style={{ flexDirection:"row", alignItems:"center", gap: 8 }}>
              <Feather name="x-circle" size={18} color="#FCA5A5" />
              <Text style={{ color:"#FCA5A5", fontWeight:"600", fontSize: 13, flex:1 }}>Demande refusée — bus complet ou indisponible</Text>
              <TouchableOpacity onPress={cancelActiveRequest}>
                <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── QR Code Modal ── */}
      <Modal visible={showQR} transparent animationType="fade" onRequestClose={()=>setShowQR(false)}>
        <Pressable style={{ flex:1, backgroundColor:"rgba(0,0,0,0.85)", alignItems:"center", justifyContent:"center" }} onPress={()=>setShowQR(false)}>
          <Pressable style={{ backgroundColor:"white", borderRadius: 20, padding: 28, alignItems:"center", gap: 16, width: 300 }} onPress={e=>e.stopPropagation()}>
            <Text style={{ fontSize: 18, fontWeight:"700", color:"#0f172a" }}>QR d'embarquement</Text>
            <Text style={{ fontSize: 12, color:"#64748B", textAlign:"center" }}>Présentez ce code à l'agent pour monter à bord</Text>
            {activeRequest && (
              <View style={{ borderWidth: 3, borderColor:"#065F46", borderRadius: 12, padding: 8, backgroundColor:"#F0FDF4" }}>
                <Image
                  source={{ uri:`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(activeRequest.requestId)}&size=200x200&margin=4` }}
                  style={{ width: 200, height: 200 }}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={{ backgroundColor:"#ECFDF5", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, width:"100%" }}>
              <Text style={{ fontSize: 10, color:"#065F46", textAlign:"center", fontFamily: Platform.OS==="ios"?"Courier":"monospace" }}>
                {activeRequest?.requestId}
              </Text>
            </View>
            <TouchableOpacity style={{ backgroundColor:"#0f172a", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 }} onPress={()=>setShowQR(false)} activeOpacity={0.8}>
              <Text style={{ color:"white", fontWeight:"700", fontSize: 14 }}>Fermer</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Bus list (when no bus selected) ── */}
      {!selectedBus && !loading && (
        <View style={styles.busListPanel}>
          <View style={styles.panelHandle}/>
          <Text style={styles.panelLabel}>
            {filtered.length} car{filtered.length>1?"s":""} en route
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.busScroll}>
            {filtered.map(bus=>(
              <TouchableOpacity
                key={bus.id}
                style={styles.miniCard}
                onPress={()=>{
                  setSelectedBus(bus);
                  sendToMap({ type:"focusBus", lat:bus.lat!, lon:bus.lon! });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Animated.spring(sheetY,{toValue:1,useNativeDriver:false}).start();
                }}
              >
                <View style={styles.miniCardTop}>
                  <Text style={styles.miniRoute} numberOfLines={1}>
                    {bus.fromCity} → {bus.toCity}
                  </Text>
                  {bus.distanceKm && bus.distanceKm<9990 && (
                    <Text style={styles.miniDist}>{fmtDist(bus.distanceKm)}</Text>
                  )}
                </View>
                <Text style={styles.miniCompany} numberOfLines={1}>{bus.companyName}</Text>
                <View style={styles.miniBottom}>
                  <View style={[styles.seatBadge, bus.availableSeats<=5 && styles.seatBadgeLow]}>
                    <Text style={styles.seatBadgeText}>{bus.availableSeats} sièges</Text>
                  </View>
                  {bus.gpsLive && (
                    <View style={styles.gpsBadge}>
                      <Text style={styles.gpsBadgeText}>GPS 🟢</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            {filtered.length===0 && (
              <View style={styles.emptyMini}>
                <Text style={styles.emptyMiniText}>Aucun car trouvé avec ces filtres</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* ── Bus detail sheet ── */}
      {selectedBus && (
        <Animated.View style={[styles.busSheet, { height: sheetHeight, overflow:"hidden" }]}>
          <View style={styles.sheetDrag}/>

          {/* Close */}
          <TouchableOpacity style={styles.sheetClose} onPress={closeBusSheet} hitSlop={10}>
            <Feather name="x" size={20} color="#94a3b8"/>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Company & route */}
            <View style={styles.sheetTop}>
              <View style={styles.sheetRouteBox}>
                <Text style={styles.sheetCompany}>{selectedBus.companyName}</Text>
                <Text style={styles.sheetRoute}>
                  {selectedBus.fromCity} → {selectedBus.toCity}
                </Text>
                {selectedBus.distanceKm && selectedBus.distanceKm<9990 && (
                  <Text style={styles.sheetDist}>{fmtDist(selectedBus.distanceKm)} de vous</Text>
                )}
              </View>
              <View style={styles.sheetSeatsBox}>
                <Text style={styles.sheetSeatsNum}>{selectedBus.availableSeats}</Text>
                <Text style={styles.sheetSeatsLabel}>sièges{"\n"}libres</Text>
              </View>
            </View>

            {/* Meta */}
            {(() => {
              const eta = calcEta(selectedBus);
              return (
                <View style={styles.sheetMeta}>
                  <MetaItem icon="clock" label="Départ" value={selectedBus.departureTime}/>
                  <MetaItem
                    icon="flag"
                    label="Arrivée prévue"
                    value={eta.etaStr ?? selectedBus.estimatedArrival}
                  />
                  {eta.distKm !== null && (
                    <MetaItem
                      icon="map-pin"
                      label="Distance restante"
                      value={fmtDist(eta.distKm)}
                    />
                  )}
                  {selectedBus.speed && selectedBus.speed > 0 ? (
                    <MetaItem icon="zap" label="Vitesse" value={`${Math.round(selectedBus.speed)} km/h`}/>
                  ) : null}
                  <MetaItem icon="user" label="Agent" value={selectedBus.agentName}/>
                  {selectedBus.gpsLive && (
                    <View style={{ flexDirection:"row", alignItems:"center", gap:6,
                      backgroundColor:"#ECFDF5", borderRadius:8, paddingHorizontal:10,
                      paddingVertical:6, marginTop:2 }}>
                      <View style={{ width:8, height:8, borderRadius:4, backgroundColor:"#059669" }}/>
                      <Text style={{ fontSize:12, color:"#065F46", fontWeight:"700" }}>
                        Position GPS en direct
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Actions */}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.reserveBtn}
                onPress={()=>setShowRequest(true)}
              >
                <Feather name="check-circle" size={16} color="#fff"/>
                <Text style={styles.reserveBtnText}>Réserver ce bus</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sheetComms}>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={()=>callAgent(selectedBus.agentPhone)}
              >
                <Feather name="phone" size={15} color="#fff"/>
                <Text style={styles.callBtnText}>Appeler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.waBtn}
                onPress={()=>whatsApp(selectedBus.agentPhone)}
              >
                <Text style={styles.waBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* ── Boarding Request Modal ── */}
      <Modal visible={showRequest} transparent animationType="slide" onRequestClose={()=>setShowRequest(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Demande d'embarquement</Text>
              <TouchableOpacity onPress={()=>setShowRequest(false)} hitSlop={10}>
                <Feather name="x" size={20} color="#94a3b8"/>
              </TouchableOpacity>
            </View>

            {selectedBus && (
              <View style={styles.modalBusInfo}>
                <Text style={styles.modalBusRoute}>
                  {selectedBus.fromCity} → {selectedBus.toCity}
                </Text>
                <Text style={styles.modalBusCompany}>{selectedBus.companyName}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Votre nom *</Text>
            <TextInput
              style={styles.field}
              value={clientName}
              onChangeText={setClientName}
              placeholder="Ex: Konan Jean"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.fieldLabel}>Téléphone *</Text>
            <TextInput
              style={styles.field}
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="Ex: +225 07 00 00 00"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Point d'embarquement *</Text>
            <TextInput
              style={styles.field}
              value={boardingPoint}
              onChangeText={setBoardingPoint}
              placeholder="Ex: Gare d'Adjamé"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.fieldLabel}>Nombre de places</Text>
            <View style={styles.seatsRow}>
              {[1,2,3,4].map(n=>(
                <TouchableOpacity
                  key={n}
                  onPress={()=>setSeatsReq(n)}
                  style={[styles.seatPill, seatsReq===n && styles.seatPillActive]}
                >
                  <Text style={[styles.seatPillText, seatsReq===n && styles.seatPillTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick boarding points */}
            <Text style={styles.fieldLabel}>Points suggérés</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bpScroll}>
              {BOARDING_POINTS.slice(0,5).map(p=>(
                <TouchableOpacity
                  key={p.id}
                  onPress={()=>setBoardingPoint(p.name)}
                  style={[styles.bpChip, boardingPoint===p.name && styles.bpChipActive]}
                >
                  <Text style={[styles.bpChipText, boardingPoint===p.name && styles.bpChipTextActive]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.sendBtn, sending && {opacity:0.6}]}
              onPress={sendRequest}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={styles.sendBtnText}>Envoyer la demande</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ─── MetaItem helper ────────────────────────────────────────────────────── */
function MetaItem({icon,label,value}:{icon:string;label:string;value:string}){
  return (
    <View style={styles.metaItem}>
      <Feather name={icon as any} size={13} color="#64748b"/>
      <View style={{marginLeft:6}}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:          { flex:1, backgroundColor:"#0f172a" },
  header:        { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:12 },
  backBtn:       { padding:6, borderRadius:8, backgroundColor:"rgba(255,255,255,0.08)" },
  headerCenter:  { flex:1, marginHorizontal:12 },
  headerTitle:   { fontSize:17, fontWeight:"700", color:"#f8fafc" },
  headerSub:     { fontSize:11, color:"#64748b", marginTop:1 },
  headerRight:   { flexDirection:"row", alignItems:"center", gap:8 },
  iconBtn:       { padding:8, borderRadius:8, backgroundColor:"rgba(255,255,255,0.08)" },
  countdownBadge:{ backgroundColor:"#1A56DB", borderRadius:999, paddingHorizontal:8, paddingVertical:4 },
  countdownText: { fontSize:11, fontWeight:"700", color:"#fff" },

  filterBar:     { backgroundColor:"#1e293b", borderBottomWidth:1, borderBottomColor:"rgba(255,255,255,0.06)" },
  filterScroll:  { padding:8, gap:8 },
  filterChip:    { paddingHorizontal:12, paddingVertical:6, borderRadius:999, backgroundColor:"rgba(255,255,255,0.06)", borderWidth:1, borderColor:"rgba(255,255,255,0.1)" },
  filterChipActive:{ backgroundColor:"#1A56DB", borderColor:"#1A56DB" },
  filterChipText:{ fontSize:12, color:"#94a3b8" },
  filterChipTextActive:{ color:"#fff", fontWeight:"600" },
  seatToggle:    { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:12, paddingVertical:8, marginHorizontal:8, marginBottom:8, borderRadius:999, backgroundColor:"rgba(255,255,255,0.06)", borderWidth:1, borderColor:"rgba(255,255,255,0.1)", alignSelf:"flex-start" },
  seatToggleActive:{ backgroundColor:"#059669", borderColor:"#059669" },
  seatToggleText:{ fontSize:12, color:"#94a3b8" },

  mapContainer:  { flex:1, position:"relative" },
  map:           { flex:1 },
  mapLoader:     { ...StyleSheet.absoluteFillObject, justifyContent:"center", alignItems:"center", backgroundColor:"rgba(15,23,42,0.7)" },
  mapLoaderText: { color:"#94a3b8", marginTop:8, fontSize:13 },

  successBanner: { backgroundColor:"#059669", padding:12, alignItems:"center" },
  successText:   { color:"#fff", fontWeight:"600", fontSize:13 },

  /* Bus list panel */
  busListPanel:  { backgroundColor:"#1e293b", borderTopWidth:1, borderTopColor:"rgba(255,255,255,0.08)", paddingTop:8, paddingBottom:8, maxHeight:140 },
  panelHandle:   { width:40, height:4, borderRadius:2, backgroundColor:"rgba(255,255,255,0.15)", alignSelf:"center", marginBottom:6 },
  panelLabel:    { fontSize:12, color:"#64748b", paddingHorizontal:16, marginBottom:6 },
  busScroll:     { paddingHorizontal:12, gap:10 },
  miniCard:      { backgroundColor:"rgba(255,255,255,0.05)", borderRadius:12, padding:10, width:160, borderWidth:1, borderColor:"rgba(255,255,255,0.08)" },
  miniCardTop:   { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:2 },
  miniRoute:     { fontSize:12, fontWeight:"700", color:"#f1f5f9", flex:1 },
  miniDist:      { fontSize:10, color:"#60a5fa", marginLeft:4 },
  miniCompany:   { fontSize:10, color:"#94a3b8", marginBottom:6 },
  miniBottom:    { flexDirection:"row", gap:6 },
  seatBadge:     { backgroundColor:"rgba(5,150,105,0.2)", borderRadius:999, paddingHorizontal:6, paddingVertical:2 },
  seatBadgeLow:  { backgroundColor:"rgba(239,68,68,0.2)" },
  seatBadgeText: { fontSize:10, color:"#34d399", fontWeight:"600" },
  gpsBadge:      { backgroundColor:"rgba(5,150,105,0.15)", borderRadius:999, paddingHorizontal:5, paddingVertical:2 },
  gpsBadgeText:  { fontSize:9, color:"#34d399" },
  emptyMini:     { padding:16, width:SW-32, alignItems:"center" },
  emptyMiniText: { color:"#64748b", fontSize:13 },

  /* Bus detail sheet */
  busSheet:      { backgroundColor:"#1e293b", borderTopLeftRadius:20, borderTopRightRadius:20, borderTopWidth:1, borderTopColor:"rgba(255,255,255,0.1)", paddingHorizontal:16, paddingBottom:16 },
  sheetDrag:     { width:40, height:4, backgroundColor:"rgba(255,255,255,0.15)", borderRadius:2, alignSelf:"center", marginVertical:10 },
  sheetClose:    { position:"absolute", right:16, top:14, padding:6 },
  sheetTop:      { flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, paddingTop:4 },
  sheetRouteBox: { flex:1, marginRight:12 },
  sheetCompany:  { fontSize:13, color:"#60a5fa", fontWeight:"600", marginBottom:2 },
  sheetRoute:    { fontSize:17, fontWeight:"800", color:"#f8fafc", marginBottom:2 },
  sheetDist:     { fontSize:11, color:"#94a3b8" },
  sheetSeatsBox: { alignItems:"center", backgroundColor:"rgba(5,150,105,0.15)", borderRadius:12, padding:10, minWidth:64 },
  sheetSeatsNum: { fontSize:26, fontWeight:"900", color:"#34d399" },
  sheetSeatsLabel:{ fontSize:10, color:"#94a3b8", textAlign:"center" },
  sheetMeta:     { flexDirection:"row", flexWrap:"wrap", gap:12, marginBottom:14 },
  metaItem:      { flexDirection:"row", alignItems:"center", minWidth:130 },
  metaLabel:     { fontSize:10, color:"#64748b" },
  metaValue:     { fontSize:12, fontWeight:"600", color:"#e2e8f0" },
  sheetActions:  { marginBottom:10 },
  reserveBtn:    { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, backgroundColor:"#1A56DB", borderRadius:12, paddingVertical:12 },
  reserveBtnText:{ color:"#fff", fontWeight:"700", fontSize:14 },
  sheetComms:    { flexDirection:"row", gap:10 },
  callBtn:       { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, backgroundColor:"rgba(5,150,105,0.2)", borderRadius:10, paddingVertical:10, borderWidth:1, borderColor:"rgba(5,150,105,0.3)" },
  callBtnText:   { color:"#34d399", fontWeight:"600", fontSize:13 },
  waBtn:         { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"rgba(37,211,102,0.15)", borderRadius:10, paddingVertical:10, borderWidth:1, borderColor:"rgba(37,211,102,0.3)" },
  waBtnText:     { color:"#25D366", fontWeight:"600", fontSize:13 },

  /* Modal */
  modalOverlay:  { flex:1, backgroundColor:"rgba(0,0,0,0.7)", justifyContent:"flex-end" },
  modalCard:     { backgroundColor:"#1e293b", borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, maxHeight:SH*0.88 },
  modalHeader:   { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
  modalTitle:    { fontSize:16, fontWeight:"700", color:"#f8fafc" },
  modalBusInfo:  { backgroundColor:"rgba(26,86,219,0.12)", borderRadius:10, padding:10, marginBottom:14, borderWidth:1, borderColor:"rgba(26,86,219,0.2)" },
  modalBusRoute: { fontSize:14, fontWeight:"700", color:"#60a5fa" },
  modalBusCompany:{ fontSize:12, color:"#94a3b8", marginTop:2 },
  fieldLabel:    { fontSize:12, color:"#94a3b8", marginBottom:4, marginTop:10 },
  field:         { backgroundColor:"rgba(255,255,255,0.06)", borderRadius:10, padding:12, color:"#f1f5f9", borderWidth:1, borderColor:"rgba(255,255,255,0.1)", fontSize:14 },
  seatsRow:      { flexDirection:"row", gap:8, marginTop:2 },
  seatPill:      { flex:1, alignItems:"center", paddingVertical:10, borderRadius:10, backgroundColor:"rgba(255,255,255,0.06)", borderWidth:1, borderColor:"rgba(255,255,255,0.1)" },
  seatPillActive:{ backgroundColor:"#1A56DB", borderColor:"#1A56DB" },
  seatPillText:  { fontSize:16, fontWeight:"700", color:"#94a3b8" },
  seatPillTextActive:{ color:"#fff" },
  bpScroll:      { marginVertical:6 },
  bpChip:        { paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:"rgba(255,255,255,0.05)", borderWidth:1, borderColor:"rgba(255,255,255,0.1)", marginRight:8 },
  bpChipActive:  { backgroundColor:"rgba(26,86,219,0.2)", borderColor:"#1A56DB" },
  bpChipText:    { fontSize:11, color:"#94a3b8" },
  bpChipTextActive:{ color:"#60a5fa", fontWeight:"600" },
  sendBtn:       { backgroundColor:"#1A56DB", borderRadius:12, paddingVertical:14, alignItems:"center", marginTop:16 },
  sendBtnText:   { color:"#fff", fontWeight:"700", fontSize:15 },
});
