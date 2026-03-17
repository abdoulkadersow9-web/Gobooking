import { useState } from "react";

const PRIMARY   = "#1A56DB";
const SUCCESS   = "#059669";
const DANGER    = "#DC2626";
const BLOCKED   = "#94A3B8";
const SELECTED  = "#F59E0B";

type SeatStatus = "available" | "booked" | "blocked" | "selected";

interface Seat {
  id: string;
  number: string;
  row: number;
  col: number;
  status: SeatStatus;
}

function buildSeats(rows: number): Seat[] {
  const letters = ["A", "B", "C", "D"];
  const seats: Seat[] = [];
  let bookedCount = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < 4; c++) {
      const id = `${letters[c]}${r}`;
      let status: SeatStatus = "available";
      if (bookedCount < Math.floor(rows * 4 * 0.45) && (r + c) % 3 !== 0) {
        status = "booked";
        bookedCount++;
      }
      if (id === "B2" || id === "C5" || id === "A8") status = "blocked";
      seats.push({ id, number: id, row: r, col: c, status });
    }
  }
  return seats;
}

const SEAT_ROWS = 13;
const INITIAL_SEATS = buildSeats(SEAT_ROWS);

function SeatCell({ seat, onPress }: { seat: Seat; onPress: () => void }) {
  const colors: Record<SeatStatus, { bg: string; border: string; text: string }> = {
    available: { bg: "#ECFDF5", border: "#34D399", text: SUCCESS },
    booked:    { bg: "#FEF2F2", border: "#FCA5A5", text: DANGER  },
    blocked:   { bg: "#F1F5F9", border: "#CBD5E1", text: BLOCKED },
    selected:  { bg: "#FFFBEB", border: SELECTED,  text: "#92400E" },
  };
  const c = colors[seat.status];
  const icon: Record<SeatStatus, string> = {
    available: "", booked: "", blocked: "🔒", selected: "",
  };

  return (
    <button
      onClick={onPress}
      title={seat.number}
      style={{
        width: 44, height: 40, borderRadius: 8, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: c.bg, border: `2px solid ${c.border}`, cursor: "pointer",
        gap: 1, transition: "transform 0.1s, box-shadow 0.1s",
        boxShadow: seat.status === "selected" ? `0 0 0 3px ${SELECTED}55` : "none",
        transform: seat.status === "selected" ? "scale(1.08)" : "scale(1)",
      }}
    >
      {icon[seat.status] && (
        <span style={{ fontSize: 9, lineHeight: 1 }}>{icon[seat.status]}</span>
      )}
      <span style={{ fontSize: 10, fontWeight: 700, color: c.text, lineHeight: 1 }}>{seat.number}</span>
    </button>
  );
}

export default function SeatManager() {
  const [seats, setSeats] = useState<Seat[]>(INITIAL_SEATS);
  const [confirmed, setConfirmed] = useState(false);

  const counts = {
    available: seats.filter(s => s.status === "available").length,
    booked:    seats.filter(s => s.status === "booked").length,
    blocked:   seats.filter(s => s.status === "blocked").length,
    selected:  seats.filter(s => s.status === "selected").length,
  };
  const total   = seats.length;
  const fillPct = Math.round(((counts.booked + counts.selected) / total) * 100);

  const toggleSeat = (id: string) => {
    setSeats(prev => prev.map(s => {
      if (s.id !== id) return s;
      if (s.status === "booked")   return s;
      if (s.status === "blocked")  return s;
      if (s.status === "available") return { ...s, status: "selected" };
      if (s.status === "selected")  return { ...s, status: "available" };
      return s;
    }));
    setConfirmed(false);
  };

  const handleConfirm = () => {
    if (counts.selected === 0) return;
    setSeats(prev => prev.map(s => s.status === "selected" ? { ...s, status: "booked" } : s));
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 2500);
  };

  const seatRows = SEAT_ROWS;

  return (
    <div style={{
      fontFamily: "Inter, -apple-system, sans-serif",
      background: "#F8FAFC", minHeight: "100vh",
      display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto",
    }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, #1e40af 100%)`,
        padding: "14px 16px 16px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 12px rgba(26,86,219,0.35)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>🚌</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>Gérer les sièges</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>
            Express Abidjan 01 · Abidjan → Bouaké
          </div>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.15)", color: "white",
          fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.3)",
        }}>08h00</div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Disponibles", value: counts.available, color: SUCCESS,  bg: "#F0FDF4", border: "#86EFAC" },
            { label: "Réservés",    value: counts.booked,    color: DANGER,   bg: "#FFF5F5", border: "#FECACA" },
            { label: "Bloqués",     value: counts.blocked,   color: BLOCKED,  bg: "#F8FAFC", border: "#CBD5E1" },
            { label: "Taux",        value: `${fillPct}%`,    color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
          ].map(stat => (
            <div key={stat.label} style={{
              background: stat.bg, border: `1.5px solid ${stat.border}`,
              borderRadius: 12, padding: "9px 6px", textAlign: "center",
            }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 9.5, color: "#64748B", marginTop: 4, lineHeight: 1.2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── Legend ── */}
        <div style={{
          background: "white", borderRadius: 12, padding: "10px 14px",
          display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9",
        }}>
          {[
            { color: "#34D399", bg: "#ECFDF5", label: "Disponible" },
            { color: "#FCA5A5", bg: "#FEF2F2", label: "Réservé"    },
            { color: "#CBD5E1", bg: "#F1F5F9", label: "Bloqué"     },
            { color: SELECTED,  bg: "#FFFBEB", label: "Sélectionné" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 14, height: 14, borderRadius: 4,
                background: l.bg, border: `2px solid ${l.color}`,
              }} />
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* ── Selection hint ── */}
        {counts.selected > 0 && (
          <div style={{
            background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 10,
            padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 15 }}>✋</span>
            <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>
              {counts.selected} siège{counts.selected > 1 ? "s" : ""} sélectionné{counts.selected > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* ── Seat bus frame ── */}
        <div style={{
          background: "white", borderRadius: 18, padding: "16px 12px 20px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.07)", border: "1px solid #E2E8F0",
          marginBottom: 14,
        }}>
          {/* Front of bus */}
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#F8FAFC", borderRadius: 10, padding: "6px 16px",
              border: "1px dashed #CBD5E1", fontSize: 11, color: "#94A3B8", fontWeight: 600,
            }}>
              <span>🚌</span>
              <span style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>Avant du bus</span>
              <span>🚌</span>
            </div>
          </div>

          {/* Column headers */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 4, marginBottom: 6,
          }}>
            {["A", "", "B", "", "C", "", "D"].map((l, i) =>
              l === "" ? (
                <div key={i} style={{ width: i === 1 ? 14 : 8 }} />
              ) : (
                <div key={l} style={{
                  width: 44, textAlign: "center", fontSize: 10,
                  fontWeight: 700, color: "#94A3B8", textTransform: "uppercase",
                }}>{l}</div>
              )
            )}
          </div>

          {/* Seat rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
            {Array.from({ length: seatRows }, (_, rowIdx) => {
              const r = rowIdx + 1;
              return (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {/* Row number */}
                  <div style={{ width: 16, textAlign: "right", fontSize: 9, color: "#CBD5E1", fontWeight: 600 }}>{r}</div>

                  {/* Left pair */}
                  {[0, 1].map(c => {
                    const s = seats.find(s => s.row === r && s.col === c);
                    return s
                      ? <SeatCell key={c} seat={s} onPress={() => toggleSeat(s.id)} />
                      : <div key={c} style={{ width: 44, height: 40 }} />;
                  })}

                  {/* Aisle */}
                  <div style={{ width: 14 }} />

                  {/* Right pair */}
                  {[2, 3].map(c => {
                    const s = seats.find(s => s.row === r && s.col === c);
                    return s
                      ? <SeatCell key={c} seat={s} onPress={() => toggleSeat(s.id)} />
                      : <div key={c} style={{ width: 44, height: 40 }} />;
                  })}
                </div>
              );
            })}
          </div>

          {/* Back of bus */}
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <div style={{
              display: "inline-block", background: "#F8FAFC", borderRadius: 8,
              padding: "5px 20px", border: "1px dashed #CBD5E1", fontSize: 10,
              color: "#94A3B8", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
            }}>
              Arrière
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div style={{
        background: "white", borderTop: "1px solid #E2E8F0",
        padding: "12px 14px 16px", display: "flex", gap: 10,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}>
        {/* Retour */}
        <button style={{
          flex: 1, padding: "13px 0", borderRadius: 12, border: "1.5px solid #E2E8F0",
          background: "#F8FAFC", color: "#64748B", fontWeight: 700, fontSize: 14,
          cursor: "pointer",
        }}>
          ← Retour
        </button>

        {/* Confirmer */}
        <button
          onClick={handleConfirm}
          disabled={counts.selected === 0}
          style={{
            flex: 2, padding: "13px 0", borderRadius: 12, border: "none",
            background: counts.selected === 0
              ? "#E2E8F0"
              : confirmed
                ? SUCCESS
                : PRIMARY,
            color: counts.selected === 0 ? "#94A3B8" : "white",
            fontWeight: 700, fontSize: 14, cursor: counts.selected === 0 ? "not-allowed" : "pointer",
            transition: "background 0.3s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {confirmed ? (
            <>✓ Confirmé</>
          ) : counts.selected > 0 ? (
            <>Confirmer {counts.selected} siège{counts.selected > 1 ? "s" : ""}</>
          ) : (
            <>Confirmer les sièges</>
          )}
        </button>
      </div>
    </div>
  );
}
