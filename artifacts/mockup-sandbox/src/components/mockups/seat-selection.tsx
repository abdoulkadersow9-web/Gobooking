import { useState, useMemo } from "react";

const PRIMARY  = "#1A56DB";
const SUCCESS  = "#059669";
const AVAIL_BG   = "#DCFCE7";
const AVAIL_TEXT = "#166534";
const TAKEN_BG   = "#FEE2E2";
const TAKEN_TEXT = "#991B1B";
const SEL_BG     = "#FEF08A";
const SEL_BORDER = "#CA8A04";
const SEL_TEXT   = "#713F12";

/* ── Trip info (from previous screen in real app) ── */
const TRIP = {
  company:       "UTB Express",
  companyInitial:"U",
  companyColor:  "#1A56DB",
  busType:       "Climatisé",
  from:          "Abidjan",
  to:            "Bouaké",
  departureTime: "06:00",
  arrivalTime:   "10:30",
  duration:      "4h30",
  date:          "Jeu. 20 mars 2026",
  pricePerSeat:  3500,
  totalSeats:    40,
  /* pre-occupied seats */
  occupied: [1,2,4,7,9,11,13,14,17,20,21,23,26,28,31,33,35,36,38,39],
};

const MAX_SELECT = 8;
const COLS       = 4; /* 2 left + aisle + 2 right → rendered as 2+2 */
const ROWS       = Math.ceil(TRIP.totalSeats / COLS);

type Screen = "seats" | "confirm";

/* ── Legend pill ── */
function LegendDot({ bg, border, label }: { bg: string; border?: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4,
        background: bg,
        border: `1.5px solid ${border ?? bg}`,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export default function SeatSelection() {
  const [selected, setSelected] = useState<number[]>([]);
  const [screen,   setScreen]   = useState<Screen>("seats");

  const toggle = (n: number) => {
    if (TRIP.occupied.includes(n)) return;
    setSelected(prev =>
      prev.includes(n)
        ? prev.filter(s => s !== n)
        : prev.length < MAX_SELECT
          ? [...prev, n]
          : prev,
    );
  };

  const total = TRIP.pricePerSeat * selected.length;

  const availableCount = TRIP.totalSeats - TRIP.occupied.length;

  /* ── Confirmation screen ── */
  if (screen === "confirm") {
    return (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`,
          padding: "52px 20px 24px", position: "relative", textAlign: "center",
        }}>
          <button onClick={() => setScreen("seats")} style={{
            position: "absolute", top: 16, left: 16, width: 36, height: 36,
            borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)",
            color: "white", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🪑</div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white" }}>
            Sièges confirmés
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
            {selected.length} siège{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
          </p>
        </div>

        <div style={{ padding: "20px 16px 24px" }}>
          <div style={{
            background: "white", borderRadius: 16, padding: 18,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14,
          }}>
            {/* Trip line */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #F1F5F9" }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: TRIP.companyColor + "22",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 800, color: TRIP.companyColor,
              }}>{TRIP.companyInitial}</div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{TRIP.company}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>
                  {TRIP.from} → {TRIP.to} · {TRIP.departureTime} · {TRIP.date}
                </p>
              </div>
            </div>

            {/* Selected seats grid */}
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Sièges sélectionnés
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {selected.sort((a,b) => a-b).map(s => (
                <div key={s} style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: SEL_BG, border: `2px solid ${SEL_BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, color: SEL_TEXT,
                }}>{s}</div>
              ))}
            </div>

            <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 14, display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Passagers</p>
                <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                  {selected.length} personne{selected.length > 1 ? "s" : ""}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Prix total</p>
                <p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 900, color: SUCCESS }}>
                  {total.toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </div>
          </div>

          <button style={{
            width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
            background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
            color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(26,86,219,0.30)", marginBottom: 10,
          }}>💳 Continuer vers le paiement</button>

          <button onClick={() => setScreen("seats")} style={{
            width: "100%", padding: "14px 0", borderRadius: 16,
            border: "1.5px solid #CBD5E1", background: "white",
            color: "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>← Modifier les sièges</button>
        </div>
      </div>
    );
  }

  /* ── Seat grid screen ── */
  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
        padding: "52px 20px 22px", position: "relative",
      }}>
        <button onClick={() => {}} style={{
          position: "absolute", top: 16, left: 16, width: 36, height: 36,
          borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)",
          color: "white", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>

        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white", textAlign: "center" }}>
          Choisir mon siège
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>
          {TRIP.from} → {TRIP.to} · {TRIP.departureTime} · {TRIP.date}
        </p>

        {/* Trip badge */}
        <div style={{
          marginTop: 14,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "9px 20px",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "white",
          }}>{TRIP.companyInitial}</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{TRIP.company}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>· {TRIP.busType}</span>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        background: "white", borderBottom: "1px solid #F1F5F9",
        padding: "12px 20px",
        display: "flex", justifyContent: "space-around",
      }}>
        {[
          { emoji: "🟩", val: availableCount,     label: "Disponibles" },
          { emoji: "🟥", val: TRIP.occupied.length, label: "Réservés" },
          { emoji: "🟨", val: selected.length,     label: "Sélectionnés" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
              <span style={{ fontSize: 14, marginRight: 3 }}>{s.emoji}</span>{s.val}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "14px 16px 120px", flex: 1, overflowY: "auto" }}>
        {/* Legend */}
        <div style={{
          display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", padding: "0 2px",
        }}>
          <LegendDot bg={AVAIL_BG} label="Disponible" />
          <LegendDot bg={TAKEN_BG} label="Réservé" />
          <LegendDot bg={SEL_BG} border={SEL_BORDER} label="Mon choix" />
        </div>

        {/* Bus frame */}
        <div style={{
          background: "white", borderRadius: 20, padding: "18px 12px 14px",
          boxShadow: "0 3px 16px rgba(26,86,219,0.08), 0 1px 4px rgba(0,0,0,0.05)",
        }}>
          {/* Driver row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10, marginBottom: 16,
            paddingBottom: 12, borderBottom: "2px dashed #E2E8F0",
          }}>
            <div style={{
              background: "#F1F5F9", borderRadius: 10,
              padding: "7px 18px", fontSize: 20,
            }}>🚌</div>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Avant du bus
            </span>
          </div>

          {/* Seat grid — 2 cols | aisle | 2 cols */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: ROWS }, (_, row) => {
              const base  = row * COLS + 1;
              const seats = [base, base + 1, base + 2, base + 3].filter(n => n <= TRIP.totalSeats);
              return (
                <div key={row} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  {/* Row number */}
                  <span style={{
                    width: 22, fontSize: 10, color: "#CBD5E1", fontWeight: 700,
                    textAlign: "right", marginRight: 8, flexShrink: 0,
                  }}>{row + 1}</span>

                  {/* Left pair */}
                  <div style={{ display: "flex", gap: 6 }}>
                    {seats.slice(0, 2).map(n => <Seat key={n} n={n} onToggle={toggle} selected={selected} occupied={TRIP.occupied} />)}
                  </div>

                  {/* Aisle */}
                  <div style={{ width: 20, flexShrink: 0 }} />

                  {/* Right pair */}
                  <div style={{ display: "flex", gap: 6 }}>
                    {seats.slice(2, 4).map(n => <Seat key={n} n={n} onToggle={toggle} selected={selected} occupied={TRIP.occupied} />)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Back of bus */}
          <div style={{
            marginTop: 16, paddingTop: 12, borderTop: "2px dashed #E2E8F0",
            textAlign: "center",
          }}>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Arrière du bus
            </span>
          </div>
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "white", borderTop: "1px solid #E2E8F0",
        padding: "14px 16px 24px",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
      }}>
        {/* Selected seats chips */}
        {selected.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {selected.sort((a,b) => a-b).map(s => (
              <div key={s} onClick={() => toggle(s)} style={{
                padding: "4px 10px", borderRadius: 20,
                background: SEL_BG, border: `1.5px solid ${SEL_BORDER}`,
                fontSize: 12, fontWeight: 800, color: SEL_TEXT,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}>
                Siège {s} <span style={{ fontSize: 10, color: SEL_BORDER }}>✕</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
              {selected.length === 0
                ? "Aucun siège sélectionné"
                : `${selected.length} siège${selected.length > 1 ? "s" : ""} · ${TRIP.pricePerSeat.toLocaleString("fr-FR")} FCFA / siège`}
            </p>
            {selected.length > 0 && (
              <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 900, color: SUCCESS }}>
                {total.toLocaleString("fr-FR")} FCFA
              </p>
            )}
          </div>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} style={{
              padding: "8px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0",
              background: "white", color: "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>Tout effacer</button>
          )}
        </div>

        <button
          disabled={selected.length === 0}
          onClick={() => selected.length > 0 && setScreen("confirm")}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
            background: selected.length > 0
              ? `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`
              : "#E2E8F0",
            color: selected.length > 0 ? "white" : "#94A3B8",
            fontSize: 15, fontWeight: 800,
            cursor: selected.length > 0 ? "pointer" : "default",
            boxShadow: selected.length > 0 ? "0 4px 20px rgba(26,86,219,0.30)" : "none",
            transition: "all 0.2s",
          }}>
          {selected.length === 0
            ? "Sélectionnez un siège pour continuer"
            : `Continuer → ${selected.length} siège${selected.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

/* ── Individual seat cell ── */
function Seat({
  n, onToggle, selected, occupied,
}: {
  n: number;
  onToggle: (n: number) => void;
  selected: number[];
  occupied: number[];
}) {
  const isOccupied = occupied.includes(n);
  const isSelected = selected.includes(n);

  let bg     = AVAIL_BG;
  let color  = AVAIL_TEXT;
  let border = AVAIL_BG;
  let cursor = "pointer";

  if (isOccupied) { bg = TAKEN_BG; color = TAKEN_TEXT; border = TAKEN_BG; cursor = "default"; }
  if (isSelected) { bg = SEL_BG;   color = SEL_TEXT;   border = SEL_BORDER; }

  return (
    <div
      onClick={() => onToggle(n)}
      title={isOccupied ? "Déjà réservé" : `Siège ${n}`}
      style={{
        width: 46, height: 48, borderRadius: 10,
        background: bg, color,
        border: `2px solid ${border}`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor, userSelect: "none",
        transition: "all 0.12s",
        boxShadow: isSelected ? `0 2px 8px ${SEL_BORDER}44` : "none",
      }}
    >
      {/* Seat back (visual top strip) */}
      <div style={{
        width: 28, height: 6, borderRadius: "4px 4px 0 0",
        background: isOccupied ? "#FCA5A5" : isSelected ? "#FDE047" : "#86EFAC",
        marginBottom: 2,
      }} />
      <span style={{ fontSize: 11, fontWeight: 800 }}>{n}</span>
    </div>
  );
}
