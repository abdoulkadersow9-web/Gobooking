import { useState } from "react";

/* ─── Types ─────────────────────────────────── */
interface Passenger { name: string; age: number; gender: string; seatNumber: string }
interface ScanResult {
  id: string; bookingRef: string; status: string;
  passengers: Passenger[]; totalAmount: number; paymentMethod: string;
  trip: { from: string; to: string; date: string; departureTime: string; busName: string } | null;
}

/* ─── Demo bookings ─────────────────────────── */
const DEMO: Record<string, ScanResult> = {
  "GBB5AKZ8DZ": {
    id:"bk1", bookingRef:"GBB5AKZ8DZ", status:"confirmed", totalAmount:3500, paymentMethod:"Orange Money",
    passengers:[{name:"Kouassi Ama",age:34,gender:"F",seatNumber:"A3"}],
    trip:{from:"Abidjan",to:"Bouaké",date:"17/03/2026",departureTime:"08h00",busName:"Express Abidjan 01"},
  },
  "GBB9MNX2PL": {
    id:"bk2", bookingRef:"GBB9MNX2PL", status:"confirmed", totalAmount:7000, paymentMethod:"MTN MoMo",
    passengers:[{name:"Traoré Youssouf",age:28,gender:"M",seatNumber:"B1"},{name:"Traoré Fatoumata",age:25,gender:"F",seatNumber:"B2"}],
    trip:{from:"Abidjan",to:"Bouaké",date:"17/03/2026",departureTime:"08h00",busName:"Express Abidjan 01"},
  },
  "GBBA1C3RQ7": {
    id:"bk3", bookingRef:"GBBA1C3RQ7", status:"boarded", totalAmount:3500, paymentMethod:"Wave",
    passengers:[{name:"Bamba Koffi",age:45,gender:"M",seatNumber:"C4"}],
    trip:{from:"Abidjan",to:"Bouaké",date:"17/03/2026",departureTime:"08h00",busName:"Express Abidjan 01"},
  },
  "GBB7FPV6NM": {
    id:"bk4", bookingRef:"GBB7FPV6NM", status:"confirmed", totalAmount:3500, paymentMethod:"Visa/MC",
    passengers:[{name:"Diallo Mariam",age:22,gender:"F",seatNumber:"D2"}],
    trip:{from:"Abidjan",to:"Bouaké",date:"17/03/2026",departureTime:"08h00",busName:"Express Abidjan 01"},
  },
  "GBB3RKZ9QW": {
    id:"bk6", bookingRef:"GBB3RKZ9QW", status:"cancelled", totalAmount:3500, paymentMethod:"Orange Money",
    passengers:[{name:"Assiéta Koné",age:29,gender:"F",seatNumber:"F3"}],
    trip:{from:"Abidjan",to:"Bouaké",date:"17/03/2026",departureTime:"08h00",busName:"Express Abidjan 01"},
  },
};

const QUICK_REFS = Object.keys(DEMO);

/* ─── Status config ─────────────────────────── */
const STATUS: Record<string,{label:string;bg:string;color:string;icon:string}> = {
  confirmed: { label:"Confirmé",  bg:"#EFF6FF", color:"#1D4ED8", icon:"✓" },
  boarded:   { label:"Déjà embarqué", bg:"#ECFDF5", color:"#065F46", icon:"✓✓" },
  cancelled: { label:"Annulé",    bg:"#FEF2F2", color:"#DC2626", icon:"✗"  },
  pending:   { label:"En attente",bg:"#FFFBEB", color:"#B45309", icon:"⏳" },
};

type ViewState = "idle" | "scanning" | "result";

export default function AgentScanner() {
  const [view,      setView]      = useState<ViewState>("idle");
  const [manualRef, setManualRef] = useState("");
  const [result,    setResult]    = useState<ScanResult | null>(null);
  const [error,     setError]     = useState("");
  const [validated, setValidated] = useState(false);
  const [localStatus, setLocalStatus] = useState<string>("");

  const lookup = (ref: string) => {
    const key = ref.trim().toUpperCase();
    const found = DEMO[key];
    if (found) {
      setResult({ ...found, status: localStatus && found.id === result?.id ? localStatus : found.status });
      setError(""); setView("result");
    } else {
      setError(`Aucun billet trouvé pour « ${key} »`);
      setResult(null);
    }
  };

  const validate = () => {
    if (!result) return;
    setValidated(true);
    setLocalStatus("boarded");
    setResult(r => r ? { ...r, status: "boarded" } : r);
    setTimeout(() => setValidated(false), 2000);
  };

  const reset = () => { setView("idle"); setResult(null); setError(""); setManualRef(""); setLocalStatus(""); };

  const status = result ? STATUS[result.status] ?? STATUS.pending : null;
  const canBoard = result && result.status === "confirmed";

  return (
    <div className="min-h-screen bg-gray-50 font-sans" style={{maxWidth:450,margin:"0 auto"}}>

      {/* Header */}
      <div className="text-white px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10"
        style={{background:"linear-gradient(135deg,#059669,#047857)"}}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
          style={{background:"rgba(255,255,255,0.2)"}}>👤</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Espace Agent</p>
          <p className="text-xs opacity-75">Kouassi Jean · AGT-001</p>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{background:"rgba(255,255,255,0.2)"}}>Agent</span>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-1 sticky top-[57px] z-10">
        {[{id:"mission",label:"Mission",icon:"🗺️"},{id:"scanner",label:"Scanner",icon:"📷",dot:true},{id:"embarquement",label:"Embarquement",icon:"👥"},{id:"sieges",label:"Sièges",icon:"📋"},{id:"colis",label:"Colis",icon:"📦"}].map(t=>(
          <button key={t.id} className={`relative flex items-center gap-1.5 px-3 py-3.5 text-xs font-semibold border-b-2 transition-colors ${t.id==="scanner"?"border-green-600 text-green-700":"border-transparent text-gray-400 hover:text-gray-600"}`}>
            <span className="text-sm">{t.icon}</span>{t.label}
            {t.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5"/>}
          </button>
        ))}
      </div>

      <div className="p-4 flex flex-col gap-4">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">Scanner un billet</h2>
            <p className="text-xs text-gray-400 mt-0.5">QR code · Code-barres · Référence manuelle</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 flex items-center gap-1">
            📷 QR · Code-barres
          </span>
        </div>

        {/* ── IDLE + SCANNING view ── */}
        {view !== "result" && (
          <>
            {/* Camera frame (simulated) */}
            {view === "scanning" ? (
              <div
                className="relative rounded-2xl overflow-hidden flex items-center justify-center"
                style={{height:300,background:"linear-gradient(135deg,#0f172a,#1e293b)"}}
              >
                {/* Simulated viewfinder */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-52 h-52 border-4 border-white rounded-2xl opacity-90 relative">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-xl"/>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-xl"/>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-xl"/>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-xl"/>
                    {/* Scan line animation */}
                    <div className="absolute inset-x-0 h-0.5 bg-green-400 opacity-80 animate-bounce" style={{top:"45%"}}/>
                    {/* QR code placeholder */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                      <div className="w-28 h-28 grid grid-cols-3 gap-1">
                        {Array.from({length:9}).map((_,i)=><div key={i} className={`rounded-sm ${[0,2,6,8].includes(i)?"bg-white":"bg-transparent border border-white/30"}`}/>)}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="absolute bottom-4 text-white text-xs font-semibold text-center px-4" style={{textShadow:"0 1px 4px rgba(0,0,0,0.5)"}}>
                  Pointez vers le QR code du billet
                </p>
                <button onClick={()=>setView("idle")} className="absolute top-3 right-3 flex items-center gap-1 text-white text-xs font-semibold bg-black/40 rounded-lg px-3 py-2">
                  ✕ Fermer
                </button>
                {/* Simulate scanning demo refs */}
                <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-2">
                  {QUICK_REFS.slice(0,3).map(r=>(
                    <button key={r} onClick={()=>lookup(r)} className="bg-green-500/80 text-white text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-green-500 transition-colors">
                      Simuler scan
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={()=>setView("scanning")}
                className="w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-white font-bold text-base transition-all hover:opacity-90 active:scale-95"
                style={{background:"linear-gradient(135deg,#059669,#047857)"}}
              >
                <span className="text-2xl">📷</span>
                Scanner un billet QR
              </button>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200"/>
              <span className="text-xs text-gray-400">ou entrer manuellement</span>
              <div className="flex-1 h-px bg-gray-200"/>
            </div>

            {/* Manual input */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Référence du billet</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold tracking-widest text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="Ex: GBB5AKZ8DZ"
                  value={manualRef}
                  onChange={e => setManualRef(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && manualRef && lookup(manualRef)}
                />
                <button
                  onClick={() => manualRef && lookup(manualRef)}
                  disabled={!manualRef}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg transition-all ${manualRef?"bg-green-600 hover:bg-green-700":"bg-gray-200 cursor-not-allowed"}`}
                >
                  🔍
                </button>
              </div>

              {/* Quick-fill chips */}
              <div>
                <p className="text-[10px] text-gray-400 mb-1.5">Références de démo :</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REFS.map(r => (
                    <button key={r} onClick={() => { setManualRef(r); lookup(r); }}
                      className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors tracking-wide">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-red-500 text-base">⚠️</span>
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}
          </>
        )}

        {/* ── RESULT view ── */}
        {view === "result" && result && status && (
          <div className="flex flex-col gap-3">
            {/* Status banner */}
            <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${status.bg}`}>
              <span className="text-2xl font-black" style={{color:status.color}}>{status.icon}</span>
              <div className="flex-1">
                <p className="font-bold text-sm" style={{color:status.color}}>{status.label}</p>
                <p className="text-xs opacity-70" style={{color:status.color}}>Billet vérifié · GoBooking</p>
              </div>
              <button onClick={reset} className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-sm font-bold" style={{color:status.color}}>✕</button>
            </div>

            {/* Main card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-4">
              {/* Ref */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 font-medium">Référence</p>
                <p className="text-base font-black text-gray-800 tracking-widest">{result.bookingRef}</p>
              </div>

              {/* Trip */}
              {result.trip && (
                <div className="bg-green-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <span className="text-green-600 text-sm">🗺️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-green-800">{result.trip.from} → {result.trip.to}</p>
                    <p className="text-xs text-green-600">{result.trip.date} · {result.trip.departureTime} · {result.trip.busName}</p>
                  </div>
                </div>
              )}

              {/* Passengers */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  Passagers ({result.passengers.length})
                </p>
                <div className="flex flex-col gap-2">
                  {result.passengers.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-black">{p.seatNumber}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.age} ans · {p.gender === "M" ? "Homme" : "Femme"}</p>
                      </div>
                      <span className="text-xs text-green-600 font-semibold">Siège {p.seatNumber}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                <div>
                  <p className="text-xs text-gray-400">Montant payé</p>
                  <p className="text-xs text-gray-500 mt-0.5">{result.paymentMethod}</p>
                </div>
                <p className="text-xl font-black text-green-600">{result.totalAmount.toLocaleString("fr")} FCFA</p>
              </div>
            </div>

            {/* Action */}
            {canBoard && (
              <button
                onClick={validate}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-white font-bold text-base transition-all ${validated?"bg-green-700 scale-95":"hover:opacity-90 active:scale-95"}`}
                style={{background:validated?"#065F46":"linear-gradient(135deg,#059669,#047857)"}}
              >
                <span className="text-xl">{validated ? "✓✓" : "✓"}</span>
                {validated ? "Embarquement validé !" : "Valider l'embarquement"}
              </button>
            )}
            {result.status === "boarded" && (
              <div className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 bg-green-50 border-2 border-green-200">
                <span className="text-green-700 font-bold text-sm">✓✓ Passager déjà embarqué</span>
              </div>
            )}
            {result.status === "cancelled" && (
              <div className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 bg-red-50 border-2 border-red-200">
                <span className="text-red-700 font-bold text-sm">⚠️ Billet annulé — Accès refusé</span>
              </div>
            )}

            <button onClick={reset} className="text-sm text-gray-500 text-center py-2 hover:text-gray-700 transition-colors">
              ← Scanner un autre billet
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
