import { useEffect, useRef, useState } from "react";

/* ── Brand colours ──────────────────────────────────────── */
const PRIMARY  = "#1A56DB";
const SUCCESS  = "#059669";
const DANGER   = "#DC2626";
const BLOCKED  = "#64748B";
const SELECTED = "#F59E0B";

/* ── Types ──────────────────────────────────────────────── */
type SeatStatus = "available" | "booked" | "blocked" | "selected";
interface Seat { id: string; row: number; col: number; status: SeatStatus }

/* ── Toast ──────────────────────────────────────────────── */
interface Toast { id: number; message: string; kind: "info" | "warn" | "success" }

/* ── Seat builder ───────────────────────────────────────── */
const COLS    = 4;
const LETTERS = ["A", "B", "C", "D"];
const ROWS    = 13;

function seatId(r: number, c: number) { return `${LETTERS[c]}${r}`; }

function buildSeats(): Seat[] {
  const seats: Seat[] = [];
  const bookedIds = new Set(["A1","A2","A4","B1","B3","B4","B6","C1","C2","C4","C6","D1","D3","D5","D6",
                              "A7","B7","C8","D8","A9","B10","C10","D11","A11","B12","C12","D12","A12"]);
  const blockedIds = new Set(["B2","C5","A8"]);
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = seatId(r, c);
      const status: SeatStatus = blockedIds.has(id) ? "blocked" : bookedIds.has(id) ? "booked" : "available";
      seats.push({ id, row: r, col: c, status });
    }
  }
  return seats;
}

/* ── SeatCell ───────────────────────────────────────────── */
const SEAT_STYLES: Record<SeatStatus, { bg: string; border: string; text: string; cursor: string }> = {
  available: { bg: "#ECFDF5", border: "#34D399",  text: SUCCESS,   cursor: "pointer"     },
  booked:    { bg: "#FEF2F2", border: "#FCA5A5",  text: DANGER,    cursor: "not-allowed" },
  blocked:   { bg: "#F1F5F9", border: "#CBD5E1",  text: BLOCKED,   cursor: "not-allowed" },
  selected:  { bg: "#FFFBEB", border: SELECTED,   text: "#92400E", cursor: "pointer"     },
};

function SeatCell({ seat, onClick }: { seat: Seat; onClick: () => void }) {
  const s = SEAT_STYLES[seat.status];
  const isProtected = seat.status === "booked" || seat.status === "blocked";
  return (
    <button onClick={onClick} title={seat.id}
      style={{
        width: 44, height: 40, borderRadius: 8, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 1,
        background: s.bg, border: `2px solid ${s.border}`, cursor: s.cursor,
        transition: "transform 0.12s, box-shadow 0.12s",
        boxShadow: seat.status === "selected" ? `0 0 0 3px ${SELECTED}44` : "none",
        transform: seat.status === "selected" ? "scale(1.1)" : "scale(1)",
        outline: "none",
        opacity: isProtected ? 0.85 : 1,
      }}>
      {seat.status === "blocked" && <span style={{ fontSize: 9, lineHeight: 1 }}>🔒</span>}
      {seat.status === "booked"  && <span style={{ fontSize: 9, lineHeight: 1 }}>👤</span>}
      <span style={{ fontSize: 10, fontWeight: 700, color: s.text, lineHeight: 1 }}>{seat.id}</span>
    </button>
  );
}

/* ── Main component ─────────────────────────────────────── */
export default function SeatManager() {
  const [seats,       setSeats]       = useState<Seat[]>(buildSeats());
  const [toasts,      setToasts]      = useState<Toast[]>([]);
  const [lastConfirm, setLastConfirm] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const toastId = useRef(0);

  /* ── counts ── */
  const counts = {
    available: seats.filter(s => s.status === "available").length,
    booked:    seats.filter(s => s.status === "booked").length,
    blocked:   seats.filter(s => s.status === "blocked").length,
    selected:  seats.filter(s => s.status === "selected").length,
  };
  const fillPct   = Math.round(((counts.booked) / seats.length) * 100);
  const selectedIds = seats.filter(s => s.status === "selected").map(s => s.id);

  /* ── toast helper ── */
  const addToast = (message: string, kind: Toast["kind"] = "info") => {
    const id = ++toastId.current;
    setToasts(prev => [...prev.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
  };

  /* ── seat click ── */
  const handleSeatClick = (seat: Seat) => {
    if (seat.status === "booked") {
      addToast("Siège déjà réservé — non modifiable", "warn");
      return;
    }
    if (seat.status === "blocked") {
      addToast("Siège bloqué — contactez un superviseur", "warn");
      return;
    }
    setSeats(prev => prev.map(s => {
      if (s.id !== seat.id) return s;
      return { ...s, status: s.status === "available" ? "selected" : "available" };
    }));
    setShowSuccess(false);
  };

  /* ── reset selection ── */
  const resetSelection = () => {
    setSeats(prev => prev.map(s => s.status === "selected" ? { ...s, status: "available" } : s));
    setShowSuccess(false);
  };

  /* ── confirm ── */
  const handleConfirm = () => {
    if (counts.selected === 0) {
      addToast("Aucun siège sélectionné", "warn");
      return;
    }
    const ids = [...selectedIds];
    setSeats(prev => prev.map(s => s.status === "selected" ? { ...s, status: "booked" } : s));
    setLastConfirm(ids);
    setShowSuccess(true);
    addToast(`${ids.length} siège${ids.length > 1 ? "s" : ""} confirmé${ids.length > 1 ? "s" : ""} ✓`, "success");
    setTimeout(() => setShowSuccess(false), 4000);
  };

  /* ── toast colours ── */
  const toastColors: Record<Toast["kind"], { bg: string; border: string; text: string; icon: string }> = {
    info:    { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8", icon: "ℹ️"  },
    warn:    { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "⚠️"  },
    success: { bg: "#ECFDF5", border: "#86EFAC", text: "#065F46", icon: "✅"  },
  };

  return (
    <div style={{
      fontFamily: "Inter, -apple-system, sans-serif", background: "#F8FAFC",
      minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Toast stack ── */}
      <div style={{
        position: "absolute", top: 80, left: 12, right: 12, zIndex: 100,
        display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none",
      }}>
        {toasts.map(t => {
          const tc = toastColors[t.kind];
          return (
            <div key={t.id} style={{
              background: tc.bg, border: `1.5px solid ${tc.border}`, color: tc.text,
              borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              animation: "fadeIn 0.2s ease",
            }}>
              <span>{tc.icon}</span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, #1e40af 100%)`,
        padding: "14px 16px 16px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 12px rgba(26,86,219,0.35)", flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>🚌</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>Gérer les sièges</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.78)", marginTop: 1 }}>
            Express Abidjan 01 · Abidjan → Bouaké
          </div>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.18)", color: "white", fontSize: 11, fontWeight: 700,
          padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.3)",
        }}>08h00</div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 6px" }}>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 12 }}>
          {[
            { label: "Disponibles", value: counts.available, color: SUCCESS,  bg: "#F0FDF4", border: "#86EFAC" },
            { label: "Réservés",    value: counts.booked,    color: DANGER,   bg: "#FFF5F5", border: "#FECACA" },
            { label: "Bloqués",     value: counts.blocked,   color: BLOCKED,  bg: "#F8FAFC", border: "#CBD5E1" },
            { label: "Taux",        value: `${fillPct}%`,    color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
          ].map(st => (
            <div key={st.label} style={{
              background: st.bg, border: `1.5px solid ${st.border}`,
              borderRadius: 12, padding: "8px 4px", textAlign: "center",
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: st.color, lineHeight: 1 }}>{st.value}</div>
              <div style={{ fontSize: 9, color: "#64748B", marginTop: 3, lineHeight: 1.2 }}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* ── Legend ── */}
        <div style={{
          background: "white", borderRadius: 12, padding: "9px 12px",
          display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid #F1F5F9",
        }}>
          {[
            { color: "#34D399", bg: "#ECFDF5", label: "Disponible",  icon: "" },
            { color: "#FCA5A5", bg: "#FEF2F2", label: "Réservé",     icon: "👤" },
            { color: "#CBD5E1", bg: "#F1F5F9", label: "Bloqué",      icon: "🔒" },
            { color: SELECTED,  bg: "#FFFBEB", label: "Sélectionné", icon: "" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 13, height: 13, borderRadius: 3, background: l.bg, border: `2px solid ${l.color}`, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {l.icon && <span>{l.icon}</span>}
              </div>
              <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* ── Selection banner ── */}
        {counts.selected > 0 && (
          <div style={{
            background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 12,
            padding: "10px 12px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#92400E", fontWeight: 700 }}>
                ✋ {counts.selected} siège{counts.selected > 1 ? "s" : ""} sélectionné{counts.selected > 1 ? "s" : ""}
              </span>
              <button onClick={resetSelection} style={{
                background: "none", border: "none", color: "#B45309", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0,
              }}>Réinitialiser ×</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {selectedIds.map(id => (
                <span key={id} style={{
                  background: SELECTED, color: "white", fontSize: 10, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 6,
                }}>{id}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Success banner ── */}
        {showSuccess && (
          <div style={{
            background: "#ECFDF5", border: "1.5px solid #6EE7B7", borderRadius: 12,
            padding: "10px 12px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#065F46", marginBottom: 6 }}>
              ✅ Réservation confirmée
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {lastConfirm.map(id => (
                <span key={id} style={{
                  background: SUCCESS, color: "white", fontSize: 10, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 6,
                }}>{id}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Seat bus frame ── */}
        <div style={{
          background: "white", borderRadius: 18, padding: "14px 10px 18px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #E2E8F0",
          marginBottom: 12,
        }}>
          {/* Front */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#F8FAFC", borderRadius: 10, padding: "5px 14px",
              border: "1px dashed #CBD5E1", fontSize: 10.5, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.5,
            }}>
              🚌 AVANT DU BUS 🚌
            </span>
          </div>

          {/* Column headers */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 5 }}>
            <div style={{ width: 18 }} />
            {["A","B","","C","D"].map((l, i) =>
              l === "" ? <div key={i} style={{ width: 14 }} /> : (
                <div key={l} style={{ width: 44, textAlign: "center", fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{l}</div>
              )
            )}
          </div>

          {/* Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            {Array.from({ length: ROWS }, (_, ri) => {
              const r = ri + 1;
              return (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 18, textAlign: "right", fontSize: 9, color: "#CBD5E1", fontWeight: 700 }}>{r}</div>
                  {[0, 1].map(c => {
                    const s = seats.find(s => s.row === r && s.col === c)!;
                    return <SeatCell key={c} seat={s} onClick={() => handleSeatClick(s)} />;
                  })}
                  <div style={{ width: 14 }} />
                  {[2, 3].map(c => {
                    const s = seats.find(s => s.row === r && s.col === c)!;
                    return <SeatCell key={c} seat={s} onClick={() => handleSeatClick(s)} />;
                  })}
                </div>
              );
            })}
          </div>

          {/* Back */}
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <span style={{
              display: "inline-block", background: "#F8FAFC", borderRadius: 8,
              padding: "4px 18px", border: "1px dashed #CBD5E1",
              fontSize: 9.5, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
            }}>Arrière</span>
          </div>
        </div>

        {/* ── Protection notice ── */}
        <div style={{
          background: "#F8FAFC", borderRadius: 10, padding: "9px 12px", marginBottom: 12,
          border: "1px solid #E2E8F0", display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ fontSize: 14, marginTop: 1 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 2 }}>Sièges protégés</div>
            <div style={{ fontSize: 10.5, color: "#94A3B8", lineHeight: 1.5 }}>
              Les sièges <span style={{ color: DANGER, fontWeight: 700 }}>réservés</span> et <span style={{ color: BLOCKED, fontWeight: 700 }}>bloqués</span> ne peuvent pas être modifiés depuis cet écran. Contactez un superviseur pour toute modification.
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        background: "white", borderTop: "1px solid #E2E8F0",
        padding: "11px 12px 15px", display: "flex", gap: 10,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.07)", flexShrink: 0,
      }}>
        <button style={{
          flex: 1, padding: "13px 0", borderRadius: 12,
          border: "1.5px solid #E2E8F0", background: "#F8FAFC",
          color: "#64748B", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>← Retour</button>

        <button onClick={handleConfirm}
          style={{
            flex: 2, padding: "13px 0", borderRadius: 12, border: "none",
            background: counts.selected === 0 ? "#E2E8F0" : showSuccess ? SUCCESS : PRIMARY,
            color: counts.selected === 0 ? "#94A3B8" : "white",
            fontWeight: 700, fontSize: 13,
            cursor: counts.selected === 0 ? "default" : "pointer",
            transition: "background 0.3s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
          {showSuccess ? "✓ Sièges confirmés" :
           counts.selected > 0 ? `Confirmer ${counts.selected} siège${counts.selected > 1 ? "s" : ""}` :
           "Confirmer les sièges"}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
