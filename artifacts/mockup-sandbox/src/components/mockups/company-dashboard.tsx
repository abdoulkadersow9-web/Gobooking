import { useState } from "react";

/* ─── Data ────────────────────────────────────────── */
const BUSES = [
  { id:"b1", name:"Express Abidjan 01", plate:"0258 AB 01", type:"Premium",  cap:49, status:"active"      },
  { id:"b2", name:"Bouaké Direct 02",   plate:"0258 AB 02", type:"Standard", cap:59, status:"active"      },
  { id:"b3", name:"Yamoussoukro 03",    plate:"0258 AB 03", type:"Standard", cap:63, status:"maintenance" },
  { id:"b4", name:"Korhogo Express 04", plate:"0258 AB 04", type:"VIP",      cap:49, status:"active"      },
  { id:"b5", name:"San Pedro 05",       plate:"0258 AB 05", type:"Standard", cap:59, status:"active"      },
];
const TRIPS = [
  { id:"t1", from:"Abidjan",   to:"Bouaké",       date:"17/03/2026", dep:"08h00", bus:"Express Abidjan 01", seats:49, price:3500 },
  { id:"t2", from:"Abidjan",   to:"Yamoussoukro", date:"17/03/2026", dep:"09h00", bus:"Bouaké Direct 02",   seats:59, price:2000 },
  { id:"t3", from:"Abidjan",   to:"Korhogo",      date:"18/03/2026", dep:"07h00", bus:"Yamoussoukro 03",    seats:63, price:6000 },
  { id:"t4", from:"Bouaké",    to:"Korhogo",      date:"18/03/2026", dep:"10h00", bus:"Korhogo Express 04", seats:49, price:2500 },
  { id:"t5", from:"San Pedro", to:"Abidjan",      date:"19/03/2026", dep:"06h00", bus:"San Pedro 05",       seats:59, price:3000 },
];
const AGENTS = [
  { id:"a1", name:"Kouassi Jean",    code:"AGT-001", phone:"07 07 11 22 33", bus:"Express Abidjan 01", busId:"b1", active:true  },
  { id:"a2", name:"Traoré Mamadou",  code:"AGT-002", phone:"05 05 44 55 66", bus:"Bouaké Direct 02",   busId:"b2", active:true  },
  { id:"a3", name:"Bamba Fatima",    code:"AGT-003", phone:"01 01 77 88 99", bus:"Korhogo Express 04", busId:"b4", active:true  },
  { id:"a4", name:"Diallo Seydou",   code:"AGT-004", phone:"07 07 22 33 44", bus:"Non assigné",        busId:"",   active:false },
  { id:"a5", name:"Coulibaly Koffi", code:"AGT-005", phone:"05 05 55 66 77", bus:"Yamoussoukro 03",    busId:"b3", active:true  },
  { id:"a6", name:"Assiéta Koné",   code:"AGT-006", phone:"01 01 88 99 00", bus:"San Pedro 05",       busId:"b5", active:true  },
];
const BOOKINGS = [
  { ref:"GBB5AKZ8DZ", route:"Abidjan → Bouaké",       passengers:[{name:"Kouassi Ama",    seat:"A3"},{name:"Traoré Youssouf",seat:"A4"}], pay:"Orange Money", amount:7000, status:"confirmed" },
  { ref:"GBB9MNX2PL", route:"Abidjan → Bouaké",       passengers:[{name:"Bamba Koffi",    seat:"B1"}],                                   pay:"MTN MoMo",    amount:3500, status:"boarded"   },
  { ref:"GBBA1C3RQ7", route:"Abidjan → Yamoussoukro", passengers:[{name:"Diallo Mariam",  seat:"C2"},{name:"Diallo Seydou",  seat:"C3"}], pay:"Wave",        amount:4000, status:"confirmed" },
  { ref:"GBB7FPV6NM", route:"Abidjan → Korhogo",      passengers:[{name:"Coulibaly Jean", seat:"D5"}],                                   pay:"Orange Money", amount:6000, status:"confirmed" },
  { ref:"GBBC5XK0TZ", route:"Abidjan → Yamoussoukro", passengers:[{name:"Assiéta Koné",  seat:"E1"}],                                   pay:"Visa/MC",     amount:2000, status:"cancelled" },
];
const PARCELS = [
  { ref:"GBX-A4F2-KM91", from:"Abidjan",   to:"Bouaké",       sender:"Assiéta Koné",   recv:"Diabaté Oumar",  kg:4.5, amount:4700, status:"en_transit"     },
  { ref:"GBX-B9C3-PL44", from:"San Pedro", to:"Abidjan",      sender:"Traoré Adama",   recv:"Koffi Ama",      kg:1.2, amount:6200, status:"livre"           },
  { ref:"GBX-C1E7-QR22", from:"Abidjan",   to:"Yamoussoukro", sender:"Bamba Sali",     recv:"Coulibaly Jean", kg:2.1, amount:3500, status:"en_attente"      },
  { ref:"GBX-D5F8-MN33", from:"Abidjan",   to:"Korhogo",      sender:"Koffi Ama",      recv:"Diallo Jean",    kg:8.0, amount:8100, status:"pris_en_charge"  },
  { ref:"GBX-E2G9-XY77", from:"Bouaké",    to:"Abidjan",      sender:"Traoré Mamadou", recv:"Coulibaly Sali", kg:3.0, amount:5200, status:"en_livraison"   },
];

const BOOKING_STATUS: Record<string,{label:string;cls:string;dot:string}> = {
  confirmed:{ label:"Confirmé",  cls:"bg-blue-50 text-blue-700",   dot:"bg-blue-500"  },
  boarded:  { label:"Embarqué",  cls:"bg-green-50 text-green-700", dot:"bg-green-500" },
  cancelled:{ label:"Annulé",    cls:"bg-red-50 text-red-600",     dot:"bg-red-500"   },
};
const PARCEL_STATUS: Record<string,{label:string;cls:string}> = {
  en_attente:     { label:"En attente",     cls:"bg-amber-50 text-amber-700"  },
  pris_en_charge: { label:"Pris en charge", cls:"bg-blue-50 text-blue-700"   },
  en_transit:     { label:"En transit",     cls:"bg-violet-50 text-violet-700"},
  en_livraison:   { label:"En livraison",   cls:"bg-cyan-50 text-cyan-700"   },
  livre:          { label:"Livré",          cls:"bg-green-50 text-green-700" },
};

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
      <div className="flex items-center justify-center mb-2">
        <span className="text-gray-300 text-xs">🚌 Avant</span>
      </div>
      <div className="flex flex-col gap-1 items-center">
        {Array.from({length: rows}, (_, r) => (
          <div key={r} className="flex gap-1 items-center">
            {[0,1].map(c => {
              idx++;
              if (idx > cap) return <div key={c} className="w-7 h-6" />;
              const taken = idx <= booked;
              return (
                <div key={c} className={`w-7 h-6 rounded flex items-center justify-center text-[9px] font-bold border ${taken ? "bg-red-50 border-red-300 text-red-600" : "bg-green-50 border-green-300 text-green-700"}`}>
                  {COLS[c]}{r+1}
                </div>
              );
            })}
            <div className="w-3" />
            {[2,3].map(c => {
              idx++;
              if (idx > cap) return <div key={c} className="w-7 h-6" />;
              const taken = idx <= booked;
              return (
                <div key={c} className={`w-7 h-6 rounded flex items-center justify-center text-[9px] font-bold border ${taken ? "bg-red-50 border-red-300 text-red-600" : "bg-green-50 border-green-300 text-green-700"}`}>
                  {COLS[c]}{r+1}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section header ─────────────────────────────── */
function SH({ title, count, onAdd, addLabel }: { title:string; count:number; onAdd?:()=>void; addLabel?:string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-gray-800">{title} <span className="text-gray-400 font-normal">({count})</span></h2>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
          <span className="text-sm leading-none">+</span> {addLabel}
        </button>
      )}
    </div>
  );
}

/* ─── Add Bus Modal ──────────────────────────────── */
function AddBusModal({ buses, setBuses, onClose }: { buses:typeof BUSES; setBuses:(b:typeof BUSES)=>void; onClose:()=>void }) {
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [type, setType] = useState("Standard");
  const [cap, setCap] = useState(49);
  const submit = () => {
    if (!name || !plate) return;
    setBuses([...buses, { id: Date.now().toString(), name, plate, type, cap, status:"active" }]);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-[450px] p-6 pb-10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-gray-800">Ajouter un bus</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-blue-400" placeholder="Nom du bus" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-blue-400" placeholder="Plaque d'immatriculation" value={plate} onChange={e=>setPlate(e.target.value)} />
        <p className="text-xs font-semibold text-gray-600 mb-2">Type de bus</p>
        <div className="flex gap-2 mb-4">
          {["Standard","Premium","VIP"].map(t => (
            <button key={t} onClick={()=>setType(t)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${type===t ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{t}</button>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Capacité (places)</p>
        <div className="flex gap-2 mb-6">
          {[49,59,63].map(c => (
            <button key={c} onClick={()=>setCap(c)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${cap===c ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{c} places</button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Annuler</button>
          <button onClick={submit} className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-colors ${(!name||!plate) ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Trip Modal ─────────────────────────────── */
function AddTripModal({ buses, trips, setTrips, onClose }: { buses:typeof BUSES; trips:typeof TRIPS; setTrips:(t:typeof TRIPS)=>void; onClose:()=>void }) {
  const CI_CITIES = ["Abidjan","Bouaké","Yamoussoukro","Korhogo","San Pedro","Man","Daloa","Gagnoa"];
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [date, setDate] = useState("");
  const [dep, setDep]   = useState("");
  const [price, setPrice] = useState("");
  const [busId, setBusId] = useState("");
  const sel = buses.find(b => b.id === busId);
  const submit = () => {
    if (!from||!to||!date||!price) return;
    setTrips([{ id: Date.now().toString(), from, to, date, dep: dep||"08h00", bus: sel?.name||"Bus GoBooking", seats: sel?.cap||49, price: Number(price) }, ...trips]);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-[450px] p-6 pb-10 max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-gray-800">Nouveau trajet</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <p className="text-xs font-semibold text-gray-600 mb-1">Ville de départ</p>
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 focus:outline-none focus:border-blue-400" placeholder="Départ" value={from} onChange={e=>setFrom(e.target.value)} />
        <div className="flex flex-wrap gap-1 mb-3">{CI_CITIES.map(c=><button key={c} onClick={()=>setFrom(c)} className={`px-2.5 py-1 rounded-full text-xs border ${from===c?"bg-blue-600 text-white border-blue-600":"bg-gray-50 text-gray-500 border-gray-200"}`}>{c}</button>)}</div>
        <p className="text-xs font-semibold text-gray-600 mb-1">Ville d'arrivée</p>
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 focus:outline-none focus:border-blue-400" placeholder="Arrivée" value={to} onChange={e=>setTo(e.target.value)} />
        <div className="flex flex-wrap gap-1 mb-3">{CI_CITIES.map(c=><button key={c} onClick={()=>setTo(c)} className={`px-2.5 py-1 rounded-full text-xs border ${to===c?"bg-blue-600 text-white border-blue-600":"bg-gray-50 text-gray-500 border-gray-200"}`}>{c}</button>)}</div>
        <div className="flex gap-2 mb-3">
          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="Date (17/03/2026)" value={date} onChange={e=>setDate(e.target.value)} />
          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="Heure (08h00)" value={dep} onChange={e=>setDep(e.target.value)} />
        </div>
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-blue-400" placeholder="Prix/place (FCFA)" type="number" value={price} onChange={e=>setPrice(e.target.value)} />
        <p className="text-xs font-semibold text-gray-600 mb-2">Assigner un bus</p>
        <div className="flex flex-col gap-2 mb-6">
          {buses.map(bus=>(
            <button key={bus.id} onClick={()=>setBusId(bus.id)} className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${busId===bus.id?"border-blue-500 bg-blue-50":"border-gray-200 bg-gray-50"}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${busId===bus.id?"bg-blue-600":"bg-gray-300"}`}/>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${busId===bus.id?"text-blue-700":"text-gray-700"}`}>{bus.name}</p>
                <p className="text-[10px] text-gray-400">{bus.plate} · {bus.type} · {bus.cap} places</p>
              </div>
              {busId===bus.id && <span className="text-blue-600 text-sm">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">Annuler</button>
          <button onClick={submit} className={`flex-1 py-3 rounded-xl text-sm font-bold text-white ${(!from||!to||!date||!price)?"bg-blue-300 cursor-not-allowed":"bg-blue-600 hover:bg-blue-700"}`}>Créer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Agent Modal ────────────────────────────── */
function AddAgentModal({ buses, agents, setAgents, onClose }: { buses:typeof BUSES; agents:typeof AGENTS; setAgents:(a:typeof AGENTS)=>void; onClose:()=>void }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [busId, setBusId] = useState("");
  const sel = buses.find(b=>b.id===busId);
  const submit = () => {
    if (!name||!phone) return;
    const code = `AGT-${String(agents.length+1).padStart(3,"0")}`;
    setAgents([...agents, { id:Date.now().toString(), name, code, phone, bus: sel?.name||"Non assigné", busId, active:true }]);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-[450px] p-6 pb-10 max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-gray-800">Ajouter un agent</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-blue-400" placeholder="Nom complet" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-blue-400" placeholder="Téléphone" value={phone} onChange={e=>setPhone(e.target.value)} />
        <p className="text-xs font-semibold text-gray-600 mb-2">Assigner à un bus</p>
        <div className="flex flex-col gap-2 mb-6">
          {buses.map(bus=>(
            <button key={bus.id} onClick={()=>setBusId(bus.id)} className={`flex items-center gap-3 p-3 rounded-xl border text-left ${busId===bus.id?"border-blue-500 bg-blue-50":"border-gray-200 bg-gray-50"}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${busId===bus.id?"bg-blue-600":"bg-gray-300"}`}/>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${busId===bus.id?"text-blue-700":"text-gray-700"}`}>{bus.name}</p>
                <p className="text-[10px] text-gray-400">{bus.cap} places · {bus.type}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">Annuler</button>
          <button onClick={submit} className={`flex-1 py-3 rounded-xl text-sm font-bold text-white ${(!name||!phone)?"bg-blue-300 cursor-not-allowed":"bg-blue-600 hover:bg-blue-700"}`}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────── */
export default function CompanyDashboard() {
  const [buses,   setBuses]   = useState(BUSES);
  const [trips,   setTrips]   = useState(TRIPS);
  const [agents,  setAgents]  = useState(AGENTS);
  const [modal, setModal]     = useState<"bus"|"trip"|"agent"|null>(null);

  const KPI = [
    { icon:"🚌", label:"Bus actifs",   value:`${buses.filter(b=>b.status==="active").length}/${buses.length}`, color:"#1D4ED8", bg:"#EFF6FF" },
    { icon:"👥", label:"Agents",       value:agents.length,               color:"#7C3AED", bg:"#F5F3FF" },
    { icon:"🗺️", label:"Trajets",      value:trips.length,                color:"#1A56DB", bg:"#EEF2FF" },
    { icon:"📌", label:"Réservations", value:"1 420",                     color:"#059669", bg:"#ECFDF5" },
    { icon:"📦", label:"Colis",        value:"638",                       color:"#D97706", bg:"#FFFBEB" },
    { icon:"📈", label:"Revenus",      value:"8.8 M FCFA",               color:"#0891B2", bg:"#ECFEFF" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans" style={{maxWidth:450,margin:"0 auto"}}>
      {/* Header */}
      <div className="text-white px-4 py-3.5 flex items-center gap-3" style={{background:"linear-gradient(135deg,#1A56DB,#1340A8)"}}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:"rgba(255,255,255,0.2)"}}>
          <span className="text-base">💼</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Tableau de bord Entreprise</p>
          <p className="text-xs opacity-75 truncate">SOTRAL — Société de Transport CI</p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:"rgba(255,255,255,0.2)"}}>Entreprise</span>
      </div>

      <div className="p-4 flex flex-col gap-5">

        {/* ── KPI ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {KPI.map((k,i) => (
            <div key={i} className="bg-white rounded-xl p-3 shadow-sm flex flex-col gap-1.5" style={{borderLeft:`3px solid ${k.color}`}}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:k.bg}}>{k.icon}</div>
              <p className="text-lg font-extrabold text-gray-800 leading-tight">{k.value}</p>
              <p className="text-[10px] text-gray-500">{k.label}</p>
            </div>
          ))}
        </div>

        {/* ── 1. BUSES ── */}
        <section>
          <SH title="Bus" count={buses.length} onAdd={()=>setModal("bus")} addLabel="Ajouter un bus" />
          <div className="flex gap-3 mb-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"/>Actif</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"/>Maintenance</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {buses.map(bus => (
              <div key={bus.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${bus.status==="active"?"bg-blue-50":"bg-amber-50"}`}>🚌</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{bus.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{bus.plate} · {bus.type}</p>
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md mt-1">
                    👥 {bus.cap} places
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${bus.status==="active"?"bg-green-50 text-green-700":"bg-amber-50 text-amber-700"}`}>
                  {bus.status==="active"?"Actif":"Maintenance"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 2. TRIPS ── */}
        <section>
          <SH title="Trajets" count={trips.length} onAdd={()=>setModal("trip")} addLabel="Nouveau trajet" />
          <div className="flex flex-col gap-2.5">
            {trips.map(t => (
              <div key={t.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mt-0.5 text-base flex-shrink-0">🗺️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{t.from} → {t.to}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.date} · {t.dep} · {t.bus}</p>
                  <p className="text-xs text-gray-400">{t.seats} places · {t.price.toLocaleString("fr")} FCFA/place</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. AGENTS ── */}
        <section>
          <SH title="Agents" count={agents.length} onAdd={()=>setModal("agent")} addLabel="Ajouter agent" />
          <div className="flex flex-col gap-2.5">
            {agents.map(ag => (
              <div key={ag.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {ag.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{ag.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ag.code} · {ag.phone}</p>
                  <p className={`text-xs mt-0.5 ${ag.busId?"text-blue-600 font-medium":"text-gray-400"}`}>🚌 {ag.bus}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ag.active?"bg-green-50 text-green-700":"bg-gray-100 text-gray-500"}`}>
                    {ag.active?"Actif":"Inactif"}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 cursor-pointer">🔗 Assigner</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. SEATS ── */}
        <section>
          <SH title="Disponibilité des sièges" count={3} />
          <p className="text-xs text-gray-400 mb-3">Plan par bus · <span className="text-green-600 font-semibold">Vert = libre</span> · <span className="text-red-500 font-semibold">Rouge = réservé</span></p>
          <SeatGrid cap={49} busName="Express Abidjan 01 — 49 places" pct={0.65} />
          <SeatGrid cap={59} busName="Bouaké Direct 02 — 59 places"   pct={0.52} />
          <SeatGrid cap={63} busName="Yamoussoukro 03 — 63 places"    pct={0.38} />
        </section>

        {/* ── 5. RESERVATIONS ── */}
        <section>
          <SH title="Réservations" count={BOOKINGS.length} />
          <div className="flex flex-col gap-2.5">
            {BOOKINGS.map((b,i) => {
              const st = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.confirmed;
              return (
                <div key={i} className="bg-white rounded-xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">#{b.ref}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${st.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>
                      {st.label}
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
          <SH title="Colis" count={PARCELS.length} />
          <div className="flex flex-col gap-2.5">
            {PARCELS.map((p,i) => {
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
      {modal==="bus"   && <AddBusModal  buses={buses}  setBuses={setBuses}  onClose={()=>setModal(null)} />}
      {modal==="trip"  && <AddTripModal buses={buses}  trips={trips}  setTrips={setTrips}   onClose={()=>setModal(null)} />}
      {modal==="agent" && <AddAgentModal buses={buses} agents={agents} setAgents={setAgents} onClose={()=>setModal(null)} />}
    </div>
  );
}
