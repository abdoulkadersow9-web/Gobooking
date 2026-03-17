import { useState, useEffect, useRef } from "react";

type TripStatus = "scheduled" | "en_route" | "arrived";

const BOARDING = [
  { id:"bk1", ref:"GBB5AKZ8DZ", name:"Kouassi Ama",      seat:"A3", status:"confirmed" },
  { id:"bk2", ref:"GBB9MNX2PL", name:"Traoré Youssouf",  seat:"B1", status:"boarded"   },
  { id:"bk3", ref:"GBBA1C3RQ7", name:"Bamba Koffi",       seat:"C4", status:"boarded"   },
  { id:"bk4", ref:"GBB7FPV6NM", name:"Diallo Mariam",     seat:"D2", status:"confirmed" },
  { id:"bk5", ref:"GBBC5XK0TZ", name:"Coulibaly Seydou",  seat:"E1", status:"boarded"   },
  { id:"bk6", ref:"GBB3RKZ9QW", name:"Assiéta Koné",      seat:"F3", status:"confirmed" },
];

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2,"0")}s`;
  return `${s}s`;
}

export default function AgentMission() {
  const [tripStatus,  setTripStatus]  = useState<TripStatus>("scheduled");
  const [elapsed,     setElapsed]     = useState(0);
  const [startedAt,   setStartedAt]   = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState<"start" | "arrive" | null>(null);
  const [loading,     setLoading]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (tripStatus === "en_route" && startedAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tripStatus, startedAt]);

  const doStart = () => {
    setLoading(true);
    setTimeout(() => {
      setTripStatus("en_route");
      setStartedAt(Date.now());
      setElapsed(0);
      setLoading(false);
      setShowConfirm(null);
    }, 900);
  };

  const doArrive = () => {
    setLoading(true);
    setTimeout(() => {
      setTripStatus("arrived");
      if (timerRef.current) clearInterval(timerRef.current);
      setLoading(false);
      setShowConfirm(null);
    }, 900);
  };

  const boarded  = BOARDING.filter(b => b.status === "boarded").length;
  const waiting  = BOARDING.filter(b => b.status === "confirmed").length;

  const busGradient = tripStatus === "en_route"
    ? "linear-gradient(135deg,#D97706,#B45309)"
    : tripStatus === "arrived"
    ? "linear-gradient(135deg,#059669,#047857)"
    : "linear-gradient(135deg,#1A56DB,#0F3BA0)";

  const busStatusLabel = tripStatus === "en_route" ? "En route 🚌"
    : tripStatus === "arrived" ? "Arrivé ✓"
    : "En service";

  return (
    <div className="min-h-screen bg-gray-50 font-sans" style={{maxWidth:450,margin:"0 auto"}}>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{background:"rgba(0,0,0,0.55)"}}>
          <div className="bg-white rounded-t-3xl w-full p-7 flex flex-col items-center gap-4" style={{maxWidth:450}}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${showConfirm==="start"?"bg-orange-50":"bg-green-50"}`}>
              {showConfirm === "start" ? "▶️" : "📍"}
            </div>
            <p className="text-lg font-black text-gray-900 text-center">
              {showConfirm === "start" ? "Démarrer le trajet ?" : "Confirmer l'arrivée ?"}
            </p>
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              {showConfirm === "start"
                ? `Abidjan → Bouaké\n${boarded} passagers embarqués · Départ 08h00`
                : `Déclarer l'arrivée à Bouaké\nDurée du trajet : ${fmtElapsed(elapsed)}`}
            </p>
            <div className="flex gap-3 w-full mt-1">
              <button onClick={() => setShowConfirm(null)} disabled={loading}
                className="flex-1 py-3.5 rounded-2xl bg-gray-100 font-semibold text-gray-600 transition-colors hover:bg-gray-200">
                Annuler
              </button>
              <button
                onClick={showConfirm === "start" ? doStart : doArrive}
                disabled={loading}
                className={`flex-[1.4] py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${loading?"opacity-70":""} ${showConfirm==="start"?"bg-orange-500 hover:bg-orange-600":"bg-green-600 hover:bg-green-700"}`}
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  : <span>{showConfirm === "start" ? "Démarrer" : "Confirmer arrivée"}</span>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-white px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10"
        style={{background:"linear-gradient(135deg,#059669,#047857)"}}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:"rgba(255,255,255,0.2)"}}>◀</div>
        <div className="flex-1">
          <p className="font-bold text-sm">Espace Agent</p>
          <p className="text-xs opacity-75">Kouassi Jean · AGT-001</p>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{background:"rgba(255,255,255,0.2)"}}>Agent</span>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-1 sticky top-[57px] z-10 overflow-x-auto">
        {[
          {id:"mission", label:"Mission", icon:"🗺️", active:true},
          {id:"scanner", label:"Scanner", icon:"📷", dot:true},
          {id:"emb",     label:"Embarquement", icon:"👥"},
          {id:"sieges",  label:"Sièges",  icon:"📋"},
          {id:"colis",   label:"Colis",   icon:"📦"},
        ].map(t=>(
          <button key={t.id} className={`relative flex items-center gap-1.5 px-3 py-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${t.active?"border-green-600 text-green-700":"border-transparent text-gray-400"}`}>
            <span>{t.icon}</span>{t.label}
            {t.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>}
          </button>
        ))}
      </div>

      <div className="p-4 flex flex-col gap-3">

        {/* Bus card */}
        <div className="rounded-2xl overflow-hidden" style={{background: busGradient}}>
          <div className="p-5 flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{background:"rgba(255,255,255,0.2)"}}>🚌</div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{background:"rgba(255,255,255,0.25)"}}>
                <div className={`w-2 h-2 rounded-full ${tripStatus==="en_route"?"bg-yellow-300":"bg-green-400"}`}/>
                {busStatusLabel}
              </div>
            </div>
            <p className="text-xl font-black text-white">Express Abidjan 01</p>
            <p className="text-xs text-white/75">0258 AB 01 · Premium · 44 places</p>
            {tripStatus === "en_route" && (
              <div className="flex items-center gap-1.5 self-start bg-black/20 rounded-xl px-3 py-1.5 mt-1">
                <span className="text-white/80 text-xs">⏱</span>
                <span className="text-xs font-bold text-white/90">En route depuis {fmtElapsed(elapsed)}</span>
              </div>
            )}
            {tripStatus === "arrived" && (
              <div className="flex items-center gap-1.5 self-start bg-black/15 rounded-xl px-3 py-1.5 mt-1">
                <span className="text-white/80 text-xs">✓</span>
                <span className="text-xs font-bold text-white/90">Trajet terminé · Arrivé à Bouaké</span>
              </div>
            )}
          </div>
        </div>

        {/* Trip card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-gray-800 text-sm mb-3">Trajet du jour</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 mb-1"/>
              <p className="font-black text-gray-800 text-base">Abidjan</p>
              <p className="text-xs text-gray-400">08h00</p>
            </div>
            <div className="flex items-center gap-1 flex-1 justify-center">
              <div className="flex-1 h-px border-t border-dashed border-gray-300"/>
              <span className="text-blue-600 text-sm">→</span>
              <div className="flex-1 h-px border-t border-dashed border-gray-300"/>
            </div>
            <div className="flex-1 text-right">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 mb-1 ml-auto"/>
              <p className="font-black text-gray-800 text-base">Bouaké</p>
              <p className="text-xs text-gray-400">17/03/2026</p>
            </div>
          </div>
        </div>

        {/* ── TRIP ACTION CARD ── */}
        {tripStatus === "scheduled" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-gray-100 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-xl flex-shrink-0">▶️</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 text-sm">Prêt au départ</p>
              <p className="text-xs text-gray-500 mt-0.5">{boarded}/{BOARDING.length} passagers embarqués</p>
            </div>
            <button
              onClick={() => setShowConfirm("start")}
              className="flex items-center gap-2 bg-orange-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-colors active:scale-95 whitespace-nowrap"
            >
              <span>▶</span> Démarrer le trajet
            </button>
          </div>
        )}

        {tripStatus === "en_route" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-orange-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-xl flex-shrink-0">🗺️</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-orange-700 text-sm">Trajet en cours</p>
                <p className="text-xs text-gray-500">{fmtElapsed(elapsed)} · Abidjan → Bouaké</p>
              </div>
              <button
                onClick={() => setShowConfirm("arrive")}
                className="flex items-center gap-2 bg-green-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors active:scale-95 whitespace-nowrap"
              >
                <span>📍</span> Arrivée
              </button>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-2 bg-orange-50 rounded-xl p-3">
              <span className="text-xs font-bold text-orange-600">Abidjan</span>
              <div className="flex-1 h-2 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full transition-all duration-1000" style={{width:`${Math.min((elapsed / 14400) * 100, 92)}%`}}/>
              </div>
              <span className="text-xs font-bold text-orange-600">Bouaké</span>
            </div>
          </div>
        )}

        {tripStatus === "arrived" && (
          <div className="bg-green-50 rounded-2xl p-4 border-2 border-green-200 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-xl flex-shrink-0">✅</div>
            <div>
              <p className="font-bold text-green-800 text-sm">Arrivé à destination</p>
              <p className="text-xs text-green-600 mt-0.5">Trajet terminé avec succès</p>
            </div>
          </div>
        )}

        {/* Summary grid */}
        <p className="font-bold text-gray-800 text-sm mt-1">Résumé de mission</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { num: boarded, label:"Embarqués",    color:"#059669", border:"#BBF7D0" },
            { num: waiting, label:"En attente",   color:"#B45309", border:"#FDE68A" },
            { num:`${boarded+waiting}/44`, label:"Réservés",  color:"#065F46", border:"#D1FAE5" },
            { num: 3,       label:"Colis actifs", color:"#6D28D9", border:"#E9D5FF" },
          ].map(c=>(
            <div key={c.label} className="bg-white rounded-2xl p-3.5 border" style={{borderColor:c.border}}>
              <p className="text-2xl font-black" style={{color:c.color}}>{c.num}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          {[
            { icon:"📷", label:"Scanner",      bg:"#F0FDF4", color:"#059669" },
            { icon:"👥", label:"Embarquement", bg:"#EEF2FF", color:"#1A56DB" },
            { icon:"📦", label:"Colis",        bg:"#FFFBEB", color:"#D97706" },
          ].map(a=>(
            <div key={a.label} className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl cursor-pointer hover:opacity-80 transition-opacity" style={{backgroundColor:a.bg}}>
              <span className="text-xl">{a.icon}</span>
              <span className="text-[11px] font-semibold" style={{color:a.color}}>{a.label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
