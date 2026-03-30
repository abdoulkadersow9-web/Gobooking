import { useState } from "react";

/* ── Couleurs sièges ── */
const STATUS_COLORS = {
  available: { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D", icon: "✓" },
  reserved:  { bg: "#FFFBEB", border: "#FCD34D", text: "#92400E", icon: "⏱" },
  occupied:  { bg: "#FEF2F2", border: "#FCA5A5", text: "#991B1B", icon: "✕" },
  sp:        { bg: "#F5F3FF", border: "#C4B5FD", text: "#5B21B6", icon: "◎" },
} as const;

type Status = keyof typeof STATUS_COLORS;

const STATUS_LABEL: Record<Status, string> = {
  available: "Libre",
  reserved:  "Réservé",
  occupied:  "Vendu",
  sp:        "SP",
};

/* ── Mock seats data ── */
interface Seat {
  id: string; number: string; row: number; col: number;
  status: Status; clientName?: string; clientPhone?: string; bookingRef?: string;
}

const MOCK_SEATS: Seat[] = [
  { id: "1",  number: "1A",  row: 1, col: 1, status: "available" },
  { id: "2",  number: "1B",  row: 1, col: 2, status: "occupied",  clientName: "Kouamé Jean",   clientPhone: "07 12 34 56 78", bookingRef: "BK-2024-001" },
  { id: "3",  number: "1C",  row: 1, col: 3, status: "reserved",  clientName: "Bamba Fatou",   clientPhone: "05 45 67 89 01", bookingRef: "BK-2024-002" },
  { id: "4",  number: "1D",  row: 1, col: 4, status: "available" },
  { id: "5",  number: "2A",  row: 2, col: 1, status: "available" },
  { id: "6",  number: "2B",  row: 2, col: 2, status: "available" },
  { id: "7",  number: "2C",  row: 2, col: 3, status: "occupied",  clientName: "Traoré Mamadou", clientPhone: "01 23 45 67 89", bookingRef: "BK-2024-003" },
  { id: "8",  number: "2D",  row: 2, col: 4, status: "sp",        clientName: "Directeur Adj." },
  { id: "9",  number: "3A",  row: 3, col: 1, status: "reserved",  clientName: "Coulibaly Aïcha", clientPhone: "07 98 76 54 32", bookingRef: "BK-2024-004" },
  { id: "10", number: "3B",  row: 3, col: 2, status: "available" },
  { id: "11", number: "3C",  row: 3, col: 3, status: "available" },
  { id: "12", number: "3D",  row: 3, col: 4, status: "occupied",  clientName: "Konan Paul",    clientPhone: "05 11 22 33 44", bookingRef: "BK-2024-005" },
  { id: "13", number: "4A",  row: 4, col: 1, status: "available" },
  { id: "14", number: "4B",  row: 4, col: 2, status: "available" },
  { id: "15", number: "4C",  row: 4, col: 3, status: "available" },
  { id: "16", number: "4D",  row: 4, col: 4, status: "reserved",  clientName: "Yao Marcelline", clientPhone: "07 33 44 55 66", bookingRef: "BK-2024-006" },
  { id: "17", number: "5A",  row: 5, col: 1, status: "occupied",  clientName: "Diallo Seydou",  clientPhone: "05 77 88 99 00", bookingRef: "BK-2024-007" },
  { id: "18", number: "5B",  row: 5, col: 2, status: "available" },
  { id: "19", number: "5C",  row: 5, col: 3, status: "available" },
  { id: "20", number: "5D",  row: 5, col: 4, status: "available" },
];

const PAYMENT_METHODS = [
  { id: "cash",   label: "Cash",   icon: "$" },
  { id: "wave",   label: "Wave",   icon: "~" },
  { id: "mtn",    label: "MTN",    icon: "M" },
  { id: "orange", label: "Orange", icon: "O" },
];

export default function AgentSeatPlan() {
  const [seats, setSeats] = useState<Seat[]>(MOCK_SEATS);
  const [selected, setSelected] = useState<Seat | null>(null);
  const [actionType, setActionType] = useState<"vendre" | "réserver" | "sp">("vendre");
  const [paxName, setPaxName] = useState("");
  const [paxPhone, setPaxPhone] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const G = "#16A34A";

  const rows = [1, 2, 3, 4, 5];
  const cntAvail = seats.filter(s => s.status === "available").length;
  const cntResvd = seats.filter(s => s.status === "reserved").length;
  const cntOccup = seats.filter(s => s.status === "occupied" || s.status === "sp").length;

  const onSeatClick = (seat: Seat) => {
    if (selected?.id === seat.id) { setSelected(null); return; }
    setSelected(seat);
    setPaxName(seat.status !== "available" ? (seat.clientName ?? "") : "");
    setPaxPhone(seat.status !== "available" ? (seat.clientPhone ?? "") : "");
    setActionType("vendre");
    setPayMethod("cash");
    setSuccessMsg("");
  };

  const handleSubmit = () => {
    if (!selected || selected.status !== "available") return;
    if (!paxName.trim()) { alert("Saisissez le nom du passager"); return; }
    setSubmitting(true);
    setTimeout(() => {
      const newStatus: Status = actionType === "sp" ? "sp" : actionType === "réserver" ? "reserved" : "occupied";
      setSeats(prev => prev.map(s => s.id === selected.id
        ? { ...s, status: newStatus, clientName: paxName.trim(), clientPhone: paxPhone.trim(), bookingRef: `BK-${Date.now()}` }
        : s
      ));
      const label = actionType === "sp" ? "SP créé" : actionType === "réserver" ? "Réservé" : "Vendu";
      setSuccessMsg(`✓ Siège ${selected.number} — ${label}`);
      setSelected(null);
      setPaxName(""); setPaxPhone("");
      setSubmitting(false);
    }, 800);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 max-w-md mx-auto relative font-sans">

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-5"
        style={{ background: "linear-gradient(135deg, #16A34A, #15803D)" }}
      >
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.18)" }}
        >
          <span className="text-white text-lg">←</span>
        </button>
        <div className="flex-1">
          <div className="text-white font-bold text-base">Abidjan → Bouaké</div>
          <div className="text-white/75 text-xs mt-0.5">30 Mar 2026 · 08:00 · VIP</div>
        </div>
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.18)" }}
        >
          <span className="text-white text-sm">↻</span>
        </button>
      </div>

      {/* ── Légende ── */}
      <div className="flex items-center justify-center gap-4 px-4 py-2.5 bg-white border-b border-slate-200 flex-wrap">
        {(Object.entries(STATUS_COLORS) as [Status, typeof STATUS_COLORS[Status]][]).map(([status, c]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ background: c.bg, border: `1.5px solid ${c.border}`, color: c.text }}
            >
              {c.icon}
            </div>
            <span className="text-xs font-semibold text-gray-600">{STATUS_LABEL[status]}</span>
          </div>
        ))}
      </div>

      {/* ── Plan de sièges ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center pt-5 px-5 pb-8" style={{ paddingBottom: selected ? 310 : 32 }}>

          {/* En-têtes colonnes */}
          <div className="flex items-center gap-1 mb-2 w-full max-w-[280px]">
            <div className="w-6" />
            <div className="flex gap-2">
              {["A", "B"].map(l => (
                <div key={l} className="w-12 text-center text-sm font-extrabold" style={{ color: G }}>{l}</div>
              ))}
            </div>
            <div className="w-7" />
            <div className="flex gap-2">
              {["C", "D"].map(l => (
                <div key={l} className="w-12 text-center text-sm font-extrabold" style={{ color: G }}>{l}</div>
              ))}
            </div>
          </div>

          {/* Bus front */}
          <div
            className="flex items-center justify-center gap-2.5 py-2.5 px-5 rounded-2xl mb-1.5 w-full max-w-[280px]"
            style={{ background: "#DCFCE7", border: "1px solid #86EFAC" }}
          >
            <div className="text-xl" style={{ color: G }}>⊙</div>
            <span className="text-sm font-bold" style={{ color: "#15803D" }}>Conducteur</span>
          </div>

          {/* Séparateur pointillé */}
          <div className="w-full max-w-[280px] border-t-2 border-dashed border-slate-300 mb-3" />

          {/* Rangées */}
          {rows.map(row => {
            const rowSeats = seats.filter(s => s.row === row).sort((a, b) => a.col - b.col);
            const left  = rowSeats.filter(s => s.col <= 2);
            const right = rowSeats.filter(s => s.col > 2);
            return (
              <div key={row} className="flex items-center gap-1 mb-2.5 w-full max-w-[280px]">
                <div className="w-6 text-center text-xs font-bold text-gray-400">{row}</div>
                <div className="flex gap-2">
                  {left.map(seat => {
                    const c = STATUS_COLORS[seat.status];
                    const isSelected = selected?.id === seat.id;
                    const initials = seat.clientName
                      ? seat.clientName.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()
                      : null;
                    return (
                      <button
                        key={seat.id}
                        onClick={() => onSeatClick(seat)}
                        className="w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 cursor-pointer"
                        style={{
                          background:   isSelected ? G : c.bg,
                          border:       `2px solid ${isSelected ? "#15803D" : c.border}`,
                          color:        isSelected ? "#fff" : c.text,
                          transform:    isSelected ? "scale(1.10)" : "scale(1)",
                          boxShadow:    isSelected ? `0 4px 12px ${G}55` : "0 1px 3px rgba(0,0,0,0.08)",
                        }}
                      >
                        <span className="text-xs leading-none">{isSelected ? "✓" : c.icon}</span>
                        <span className="text-xs font-bold leading-tight">{seat.number}</span>
                        {initials && !isSelected && (
                          <span className="text-[8px] font-bold opacity-80">{initials}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Allée */}
                <div className="w-7 flex items-center justify-center text-slate-300 text-lg leading-none">│</div>
                <div className="flex gap-2">
                  {right.map(seat => {
                    const c = STATUS_COLORS[seat.status];
                    const isSelected = selected?.id === seat.id;
                    const initials = seat.clientName
                      ? seat.clientName.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()
                      : null;
                    return (
                      <button
                        key={seat.id}
                        onClick={() => onSeatClick(seat)}
                        className="w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 cursor-pointer"
                        style={{
                          background:   isSelected ? G : c.bg,
                          border:       `2px solid ${isSelected ? "#15803D" : c.border}`,
                          color:        isSelected ? "#fff" : c.text,
                          transform:    isSelected ? "scale(1.10)" : "scale(1)",
                          boxShadow:    isSelected ? `0 4px 12px ${G}55` : "0 1px 3px rgba(0,0,0,0.08)",
                        }}
                      >
                        <span className="text-xs leading-none">{isSelected ? "✓" : c.icon}</span>
                        <span className="text-xs font-bold leading-tight">{seat.number}</span>
                        {initials && !isSelected && (
                          <span className="text-[8px] font-bold opacity-80">{initials}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Compteurs ── */}
      <div className="flex gap-2.5 bg-white border-t border-slate-200 px-4 py-2.5">
        {[
          { label: "Libres",   count: cntAvail, color: "#059669", bg: "#F0FDF4", border: "#BBF7D0" },
          { label: "Réservés", count: cntResvd, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
          { label: "Vendus",   count: cntOccup, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
        ].map(b => (
          <div
            key={b.label}
            className="flex-1 flex flex-col items-center rounded-xl py-2"
            style={{ background: b.bg, border: `1px solid ${b.border}` }}
          >
            <span className="text-2xl font-extrabold leading-none" style={{ color: b.color }}>{b.count}</span>
            <span className="text-[10px] text-gray-500 font-medium mt-0.5">{b.label}</span>
          </div>
        ))}
      </div>

      {/* ── Message succès ── */}
      {successMsg && (
        <div
          className="mx-4 mb-2 px-4 py-3 rounded-xl flex items-center gap-2"
          style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}
        >
          <span className="text-green-700 font-bold text-sm">{successMsg}</span>
        </div>
      )}

      {/* ══════════ Panneau réservation rapide ══════════ */}
      {selected && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-5 pt-3"
          style={{
            boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
            zIndex: 50,
            maxHeight: 460,
            paddingBottom: 24,
          }}
        >
          {/* Handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

          {/* Header badge + close */}
          <div className="flex items-center justify-between mb-4">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{
                background: STATUS_COLORS[selected.status].bg,
                border: `1.5px solid ${STATUS_COLORS[selected.status].border}`,
              }}
            >
              <span className="text-lg font-bold" style={{ color: STATUS_COLORS[selected.status].text }}>
                {STATUS_COLORS[selected.status].icon}
              </span>
              <span className="text-xl font-extrabold" style={{ color: STATUS_COLORS[selected.status].text }}>
                {selected.number}
              </span>
              <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[selected.status].text }}>
                {STATUS_LABEL[selected.status]}
              </span>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-bold"
            >
              ✕
            </button>
          </div>

          {/* ── Siège occupé : info passager ── */}
          {selected.status !== "available" ? (
            <div className="space-y-3 pb-2">
              <div className="flex items-center gap-3">
                <span className="text-gray-400">👤</span>
                <span className="text-gray-800 font-medium text-sm">{selected.clientName ?? "—"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-400">📞</span>
                <span className="text-gray-700 text-sm">{selected.clientPhone ?? "—"}</span>
              </div>
              {selected.bookingRef && (
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">#</span>
                  <span className="text-gray-600 text-sm font-mono">{selected.bookingRef}</span>
                </div>
              )}
            </div>
          ) : (
            /* ── Formulaire vente ── */
            <div className="space-y-3">

              {/* Action tabs */}
              <div className="flex gap-2">
                {(["vendre", "réserver", "sp"] as const).map(type => {
                  const active = actionType === type;
                  const tabColor = type === "sp" ? "#7C3AED" : G;
                  return (
                    <button
                      key={type}
                      onClick={() => setActionType(type)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: active ? tabColor : "#F9FAFB",
                        color:      active ? "#fff" : "#6B7280",
                        border:     `1.5px solid ${active ? tabColor : "#E5E7EB"}`,
                      }}
                    >
                      {type === "vendre" ? "🏷 Vendre" : type === "réserver" ? "⏱ Réserver" : "◎ SP"}
                    </button>
                  );
                })}
              </div>

              {/* Nom */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 block mb-1">Nom complet *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-500"
                  placeholder="Ex: Koné Mamadou"
                  value={paxName}
                  onChange={e => setPaxName(e.target.value)}
                />
              </div>

              {/* Téléphone */}
              {actionType !== "sp" && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1">Téléphone</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-500"
                    placeholder="+225 07 XX XX XX XX"
                    value={paxPhone}
                    onChange={e => setPaxPhone(e.target.value)}
                  />
                </div>
              )}

              {/* Mode paiement */}
              {actionType !== "sp" && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1.5">Mode de paiement *</label>
                  <div className="flex gap-2 flex-wrap">
                    {PAYMENT_METHODS.map(pm => {
                      const active = payMethod === pm.id;
                      return (
                        <button
                          key={pm.id}
                          onClick={() => setPayMethod(pm.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                          style={{
                            background: active ? G : "#F9FAFB",
                            color:      active ? "#fff" : "#6B7280",
                            border:     `1.5px solid ${active ? "#15803D" : "#E5E7EB"}`,
                          }}
                        >
                          <span>{pm.icon}</span> {pm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bouton valider */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
                style={{
                  background:    actionType === "sp" ? "#7C3AED" : G,
                  boxShadow:     `0 4px 12px ${actionType === "sp" ? "#7C3AED" : G}55`,
                  opacity:       submitting ? 0.7 : 1,
                }}
              >
                {submitting ? (
                  <span className="animate-spin">↻</span>
                ) : (
                  <>
                    <span>{actionType === "vendre" ? "✓" : actionType === "réserver" ? "⏱" : "◎"}</span>
                    {actionType === "vendre"   ? "Valider la vente"         :
                     actionType === "réserver" ? "Confirmer la réservation" :
                                                 "Créer billet SP"}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
