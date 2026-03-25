import { useCallback, useEffect, useRef, useState } from "react";

/* ─── API ─────────────────────────────────────────── */
const API = `https://${import.meta.env.VITE_DOMAIN ?? window.location.hostname}/api`;

async function loginDemo(): Promise<string | null> {
  try {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "compagnie@test.com", password: "test123" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.token ?? null;
  } catch { return null; }
}

async function apiFetch<T>(path: string, token: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${r.status}`); }
  return r.json();
}

/* ─── Types ───────────────────────────────────────── */
interface Bus { id: string; busName: string; plateNumber: string; busType: string; capacity: number; status: string; companyId?: string; createdAt?: string }

/* ─── Demo Data (shown while loading or when API is unavailable) ── */
const DEMO_BUSES: Bus[] = [
  { id:"b1", busName:"Express Abidjan 01", plateNumber:"0258 AB 01", busType:"Premium",  capacity:49, status:"active"      },
  { id:"b2", busName:"Bouaké Direct 02",   plateNumber:"0258 AB 02", busType:"Standard", capacity:59, status:"active"      },
  { id:"b3", busName:"Yamoussoukro 03",    plateNumber:"0258 AB 03", busType:"Standard", capacity:63, status:"maintenance" },
];
const DEMO_TRIPS = [
  { id:"t1", from:"Abidjan",   to:"Bouaké",       date:"17/03/2026", dep:"08h00", seats:49, price:3500 },
  { id:"t2", from:"Abidjan",   to:"Yamoussoukro", date:"17/03/2026", dep:"09h00", seats:59, price:2000 },
  { id:"t3", from:"Abidjan",   to:"Korhogo",      date:"18/03/2026", dep:"07h00", seats:63, price:6000 },
];
const DEMO_AGENTS = [
  { id:"a1", name:"Kouassi Jean",   code:"AGT-001", phone:"07 07 11 22 33", bus:"Express Abidjan 01", active:true  },
  { id:"a2", name:"Traoré Mamadou", code:"AGT-002", phone:"05 05 44 55 66", bus:"Bouaké Direct 02",   active:true  },
  { id:"a3", name:"Diallo Seydou",  code:"AGT-004", phone:"07 07 22 33 44", bus:"Non assigné",        active:false },
];
const DEMO_BOOKINGS = [
  { ref:"GBB5AKZ8DZ", route:"Abidjan → Bouaké",      passengers:[{name:"Kouassi Ama",seat:"A3"},{name:"Traoré Youssouf",seat:"A4"}], pay:"Orange Money", amount:7000, status:"confirmed" },
  { ref:"GBB9MNX2PL", route:"Abidjan → Bouaké",      passengers:[{name:"Bamba Koffi",seat:"B1"}],                                  pay:"MTN MoMo",     amount:3500, status:"boarded"   },
  { ref:"GBBC5XK0TZ", route:"Abidjan → Yamoussoukro", passengers:[{name:"Assiéta Koné",seat:"E1"}],                               pay:"Wave",         amount:2000, status:"cancelled" },
];
const DEMO_PARCELS = [
  { ref:"GBX-A4F2-KM91", from:"Abidjan", to:"Bouaké",       sender:"Assiéta Koné",  recv:"Diabaté Oumar", kg:4.5, amount:4700, status:"en_transit"   },
  { ref:"GBX-B9C3-PL44", from:"San Pedro",to:"Abidjan",     sender:"Traoré Adama",  recv:"Koffi Ama",     kg:1.2, amount:6200, status:"livre"         },
  { ref:"GBX-C1E7-QR22", from:"Abidjan", to:"Yamoussoukro", sender:"Bamba Sali",    recv:"Coulibaly Jean",kg:2.1, amount:3500, status:"en_attente"    },
];

const BOOKING_STATUS: Record<string,{label:string;cls:string;dot:string}> = {
  confirmed:{ label:"Confirmé",cls:"bg-blue-50 text-blue-700",  dot:"bg-blue-500"  },
  boarded:  { label:"Embarqué",cls:"bg-green-50 text-green-700",dot:"bg-green-500" },
  cancelled:{ label:"Annulé",  cls:"bg-red-50 text-red-600",    dot:"bg-red-500"   },
};
const PARCEL_STATUS: Record<string,{label:string;cls:string}> = {
  en_attente:     { label:"En attente",     cls:"bg-amber-50 text-amber-700"  },
  en_transit:     { label:"En transit",     cls:"bg-violet-50 text-violet-700"},
  livre:          { label:"Livré",          cls:"bg-green-50 text-green-700" },
  pris_en_charge: { label:"Pris en charge", cls:"bg-blue-50 text-blue-700"   },
  en_livraison:   { label:"En livraison",   cls:"bg-cyan-50 text-cyan-700"   },
};

const CI_CITIES = ["Abidjan","Bouaké","Yamoussoukro","Korhogo","San Pedro","Man","Daloa","Gagnoa"];

/* ─── Seat Grid ───────────────────────────────────── */
function SeatGrid({ cap, busName, pct }: { cap:number; busName:string; pct:number }) {
  const booked = Math.round(cap * pct);
  const avail  = cap - booked;
  const rows   = Math.ceil(cap / 4);
  const COLS   = ["A","B","C","D"];
  let idx = 0;
  return (
    <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-800">{busName}</p>
          <p className="text-xs text-gray-400 mt-0.5">{cap} places au total</p>
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <span className="text-green-600">{avail} libres</span>
          <span className="text-red-500">{booked} réservés</span>
        </div>
      </div>
      <p className="text-center text-gray-300 text-xs mb-2">🚌 Avant</p>
      <div className="flex flex-col gap-1 items-center">
        {Array.from({length: rows}, (_, r) => (
          <div key={r} className="flex gap-1 items-center">
            {[0,1].map(c => { idx++; if (idx > cap) return <div key={c} className="w-7 h-6"/>; const t=idx<=booked; return <div key={c} className={`w-7 h-6 rounded flex items-center justify-center text-[9px] font-bold border ${t?"bg-red-50 border-red-300 text-red-600":"bg-green-50 border-green-300 text-green-700"}`}>{COLS[c]}{r+1}</div>; })}
            <div className="w-3"/>
            {[2,3].map(c => { idx++; if (idx > cap) return <div key={c} className="w-7 h-6"/>; const t=idx<=booked; return <div key={c} className={`w-7 h-6 rounded flex items-center justify-center text-[9px] font-bold border ${t?"bg-red-50 border-red-300 text-red-600":"bg-green-50 border-green-300 text-green-700"}`}>{COLS[c]}{r+1}</div>; })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section Header ─────────────────────────────── */
function SH({ title, count, onAdd, addLabel }: { title:string; count:number; onAdd?:()=>void; addLabel?:string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-gray-800">{title} <span className="text-gray-400 font-normal">({count})</span></h2>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
          <span className="text-base leading-none">+</span> {addLabel}
        </button>
      )}
    </div>
  );
}

/* ─── Add Bus Modal ──────────────────────────────── */
function AddBusModal({
  onClose, onCreated, token,
}: {
  onClose: () => void;
  onCreated: (bus: Bus) => void;
  token: string | null;
}) {
  const [name,   setName]   = useState("");
  const [plate,  setPlate]  = useState("");
  const [type,   setType]   = useState("Standard");
  const [cap,    setCap]    = useState(49);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const submit = useCallback(async () => {
    if (!name || !plate) return;
    setSaving(true);
    setError("");
    try {
      let tok = token;
      if (!tok) { tok = await loginDemo(); }
      if (!tok) throw new Error("Non authentifié");
      const bus = await apiFetch<Bus>("/company/buses", tok, {
        method: "POST",
        body: JSON.stringify({ busName: name, plateNumber: plate, busType: type, capacity: cap }),
      });
      onCreated(bus);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Erreur serveur");
    } finally {
      setSaving(false);
    }
  }, [name, plate, type, cap, token, onCreated, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl w-full max-w-[450px] p-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-gray-800">Ajouter un bus</h3>
          <button onClick={() => !saving && onClose()} className="text-gray-400 text-xl">&times;</button>
        </div>

        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-blue-400"
          placeholder="Nom du bus (ex: Express Abidjan 06)" value={name}
          onChange={e => setName(e.target.value)} disabled={saving}
        />
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-blue-400"
          placeholder="Plaque d'immatriculation (ex: 0258 AB 06)" value={plate}
          onChange={e => setPlate(e.target.value)} disabled={saving}
        />

        <p className="text-xs font-semibold text-gray-600 mb-2">Type de bus</p>
        <div className="flex gap-2 mb-4">
          {["Standard","Premium","VIP"].map(t => (
            <button key={t} onClick={() => setType(t)} disabled={saving}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${type===t?"bg-blue-600 text-white border-blue-600":"bg-gray-50 text-gray-600 border-gray-200"}`}>{t}</button>
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-600 mb-2">Capacité (places)</p>
        <div className="flex gap-2 mb-4">
          {[49,59,63].map(c => (
            <button key={c} onClick={() => setCap(c)} disabled={saving}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${cap===c?"bg-blue-600 text-white border-blue-600":"bg-gray-50 text-gray-600 border-gray-200"}`}>
              {c} places
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 mb-4">
          <span className="text-blue-500 text-sm">🗄️</span>
          <p className="text-xs text-blue-700 font-medium">Sauvegardé en base de données · Liste mise à jour instantanément</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2 mb-4">
            <span className="text-red-500 text-sm">⚠️</span>
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => !saving && onClose()} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={submit} disabled={!name || !plate || saving}
            className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-colors ${(!name||!plate||saving)?"bg-blue-300 cursor-not-allowed":"bg-blue-600 hover:bg-blue-700"}`}>
            {saving ? "Enregistrement…" : "Ajouter le bus"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Trip Modal (local-only for preview) ─── */
function AddTripModal({ buses, onClose, onCreated }: { buses:Bus[]; onClose:()=>void; onCreated:(t:any)=>void }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [date, setDate] = useState(""); const [price, setPrice] = useState("");
  const [busId, setBusId] = useState("");
  const sel = buses.find(b => b.id === busId);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-[450px] p-6 pb-10 max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-gray-800">Nouveau trajet</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <p className="text-xs font-semibold text-gray-600 mb-1">Départ</p>
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 focus:outline-none focus:border-blue-400" placeholder="Ville de départ" value={from} onChange={e=>setFrom(e.target.value)}/>
        <div className="flex flex-wrap gap-1 mb-3">{CI_CITIES.map(c=><button key={c} onClick={()=>setFrom(c)} className={`px-2.5 py-1 rounded-full text-xs border ${from===c?"bg-blue-600 text-white border-blue-600":"bg-gray-50 text-gray-500 border-gray-200"}`}>{c}</button>)}</div>
        <p className="text-xs font-semibold text-gray-600 mb-1">Arrivée</p>
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 focus:outline-none focus:border-blue-400" placeholder="Ville d'arrivée" value={to} onChange={e=>setTo(e.target.value)}/>
        <div className="flex flex-wrap gap-1 mb-3">{CI_CITIES.map(c=><button key={c} onClick={()=>setTo(c)} className={`px-2.5 py-1 rounded-full text-xs border ${to===c?"bg-blue-600 text-white border-blue-600":"bg-gray-50 text-gray-500 border-gray-200"}`}>{c}</button>)}</div>
        <div className="flex gap-2 mb-3">
          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none" placeholder="Date (17/03/2026)" value={date} onChange={e=>setDate(e.target.value)}/>
          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none" placeholder="Prix FCFA" type="number" value={price} onChange={e=>setPrice(e.target.value)}/>
        </div>
        {buses.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            <p className="text-xs font-semibold text-gray-600">Bus</p>
            {buses.map(bus=><button key={bus.id} onClick={()=>setBusId(bus.id)} className={`flex items-center gap-3 p-3 rounded-xl border text-left ${busId===bus.id?"border-blue-500 bg-blue-50":"border-gray-200 bg-gray-50"}`}><div className={`w-2.5 h-2.5 rounded-full ${busId===bus.id?"bg-blue-600":"bg-gray-300"}`}/><p className={`text-xs font-bold ${busId===bus.id?"text-blue-700":"text-gray-700"}`}>{bus.busName} · {bus.capacity} places</p></button>)}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">Annuler</button>
          <button onClick={()=>{ if(!from||!to||!date||!price) return; onCreated({id:Date.now().toString(),from,to,date,dep:"08h00",seats:sel?.capacity??49,price:Number(price)}); onClose(); }} className={`flex-1 py-3 rounded-xl text-sm font-bold text-white ${(!from||!to||!date||!price)?"bg-blue-300 cursor-not-allowed":"bg-blue-600 hover:bg-blue-700"}`}>Créer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────── */
export default function CompanyDashboard() {
  const [token,    setToken]    = useState<string | null>(null);
  const [buses,    setBuses]    = useState<Bus[]>([]);
  const [trips,    setTrips]    = useState(DEMO_TRIPS);
  const [apiState, setApiState] = useState<"loading"|"live"|"demo">("loading");
  const [modal,    setModal]    = useState<"bus"|"trip"|null>(null);
  const didInit = useRef(false);

  /* Auto-login + load buses from real API */
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      const tok = await loginDemo();
      if (!tok) { setBuses(DEMO_BUSES); setApiState("demo"); return; }
      setToken(tok);
      try {
        const live = await apiFetch<Bus[]>("/company/buses", tok);
        setBuses(live.length > 0 ? live : DEMO_BUSES);
        setApiState("live");
      } catch {
        setBuses(DEMO_BUSES);
        setApiState("demo");
      }
    })();
  }, []);

  const totalBuses  = buses.length;
  const activeBuses = buses.filter(b => b.status === "active").length;

  const KPI = [
    { icon:"🚌", label:"Bus actifs",    value:`${activeBuses}/${totalBuses}`, color:"#1D4ED8", bg:"#EFF6FF" },
    { icon:"🗺️", label:"Trajets",       value:trips.length,                  color:"#1A56DB", bg:"#EEF2FF" },
    { icon:"📌", label:"Réservations",  value:"1 420",                       color:"#059669", bg:"#ECFDF5" },
    { icon:"📦", label:"Colis",         value:"638",                         color:"#D97706", bg:"#FFFBEB" },
    { icon:"👥", label:"Agents",        value:DEMO_AGENTS.length,            color:"#7C3AED", bg:"#F5F3FF" },
    { icon:"📈", label:"Revenus",       value:"8.8 M FCFA",                 color:"#0891B2", bg:"#ECFEFF" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans" style={{maxWidth:450,margin:"0 auto"}}>
      {/* Header */}
      <div className="text-white px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10" style={{background:"linear-gradient(135deg,#1A56DB,#1340A8)"}}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{background:"rgba(255,255,255,0.2)"}}>💼</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Tableau de bord Entreprise</p>
          <p className="text-xs opacity-75 truncate">SOTRAL — Société de Transport CI</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${apiState==="live"?"bg-green-400":apiState==="demo"?"bg-amber-400":"bg-gray-400"}`}/>
          <span className="text-[10px] font-bold opacity-90">{apiState==="live"?"Base de données":apiState==="demo"?"Démo":"Connexion…"}</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-5">

        {/* KPI */}
        <div className="grid grid-cols-2 gap-2.5">
          {KPI.map((k,i) => (
            <div key={i} className="bg-white rounded-xl p-3 shadow-sm flex flex-col gap-1.5" style={{borderLeft:`3px solid ${k.color}`}}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:k.bg}}>{k.icon}</div>
              <p className="text-lg font-extrabold text-gray-800 leading-tight">{k.value}</p>
              <p className="text-[10px] text-gray-500">{k.label}</p>
            </div>
          ))}
        </div>

        {/* ── 1. BUSES (LIVE DATA) ── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">Bus <span className="text-gray-400 font-normal">({totalBuses})</span></h2>
              {apiState === "live" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">BD LIVE</span>}
              {apiState === "loading" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Chargement…</span>}
            </div>
            <button onClick={()=>setModal("bus")} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
              <span className="text-base leading-none">+</span> Ajouter un bus
            </button>
          </div>

          {apiState === "loading" ? (
            <div className="flex flex-col gap-2.5">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"/>)}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {buses.map(bus => (
                <div key={bus.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${bus.status==="active"?"bg-blue-50":"bg-amber-50"}`}>🚌</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{bus.busName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{bus.plateNumber} · {bus.busType}</p>
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md mt-1">
                      👥 {bus.capacity} places
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${bus.status==="active"?"bg-green-50 text-green-700":"bg-amber-50 text-amber-700"}`}>
                    {bus.status==="active"?"Actif":"Maintenance"}
                  </span>
                </div>
              ))}
              {buses.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Aucun bus enregistré</div>
              )}
            </div>
          )}
        </section>

        {/* ── 2. TRIPS ── */}
        <section>
          <SH title="Trajets" count={trips.length} onAdd={()=>setModal("trip")} addLabel="Nouveau trajet" />
          <div className="flex flex-col gap-2.5">
            {trips.map(t => (
              <div key={t.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-base flex-shrink-0 mt-0.5">🗺️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{t.from} → {t.to}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.date} · {t.dep}</p>
                  <p className="text-xs text-gray-400">{t.seats} places · {Number(t.price).toLocaleString("fr")} FCFA/passager</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. AGENTS ── */}
        <section>
          <SH title="Agents" count={DEMO_AGENTS.length} />
          <div className="flex flex-col gap-2.5">
            {DEMO_AGENTS.map(ag => (
              <div key={ag.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">{ag.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{ag.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ag.code} · {ag.phone}</p>
                  <p className={`text-xs mt-0.5 ${ag.bus!=="Non assigné"?"text-blue-600 font-medium":"text-gray-400"}`}>🚌 {ag.bus}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ag.active?"bg-green-50 text-green-700":"bg-gray-100 text-gray-500"}`}>
                  {ag.active?"Actif":"Inactif"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. SEATS ── */}
        <section>
          <SH title="Disponibilité des sièges" count={3} />
          <p className="text-xs text-gray-400 mb-3">
            <span className="text-green-600 font-semibold">Vert = libre</span> · <span className="text-red-500 font-semibold">Rouge = réservé</span>
          </p>
          <SeatGrid cap={49} busName="Express Abidjan 01 — 49 places" pct={0.65} />
          <SeatGrid cap={59} busName="Bouaké Direct 02 — 59 places"   pct={0.52} />
          <SeatGrid cap={63} busName="Yamoussoukro 03 — 63 places"    pct={0.38} />
        </section>

        {/* ── 5. RESERVATIONS ── */}
        <section>
          <SH title="Réservations" count={DEMO_BOOKINGS.length} />
          <div className="flex flex-col gap-2.5">
            {DEMO_BOOKINGS.map((b,i) => {
              const st = BOOKING_STATUS[b.status];
              return (
                <div key={i} className="bg-white rounded-xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">#{b.ref}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${st.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{b.route}</p>
                  <div className="flex flex-col gap-1.5 mb-3">
                    {b.passengers.map((p,j) => (
                      <div key={j} className="flex items-center gap-2">
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{p.seat}</span>
                        <span className="text-xs text-gray-600">{p.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <span className="text-xs text-gray-400">{b.pay}</span>
                    <span className="text-sm font-bold text-green-600">{b.amount.toLocaleString("fr")} FCFA</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 6. PARCELS ── */}
        <section>
          <SH title="Colis" count={DEMO_PARCELS.length} />
          <div className="flex flex-col gap-2.5">
            {DEMO_PARCELS.map((p,i) => {
              const st = PARCEL_STATUS[p.status] ?? PARCEL_STATUS.en_attente;
              return (
                <div key={i} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg flex-shrink-0">📦</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{p.ref}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.from} → {p.to} · {p.kg} kg</p>
                    <p className="text-xs text-gray-400">{p.sender} → {p.recv}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    <span className="text-xs font-bold text-blue-600">{p.amount.toLocaleString("fr")} F</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* Modals */}
      {modal === "bus" && (
        <AddBusModal
          token={token}
          onClose={() => setModal(null)}
          onCreated={bus => {
            setBuses(prev => [bus, ...prev]);
          }}
        />
      )}
      {modal === "trip" && (
        <AddTripModal
          buses={buses}
          onClose={() => setModal(null)}
          onCreated={trip => setTrips(prev => [trip, ...prev])}
        />
      )}
    </div>
  );
}
