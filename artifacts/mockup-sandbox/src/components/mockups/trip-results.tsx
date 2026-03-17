import { useState, useMemo } from "react";

const PRIMARY = "#1A56DB";
const SUCCESS = "#059669";

/* ─── Types ─────────────────────────────────────────────────────────── */
type Trip = {
  id: string;
  company: string;
  companyInitial: string;
  companyColor: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  seatsLeft: number;
  totalSeats: number;
  busType: string;
  amenities: string[];
  occupiedSeats: number[];
};

type SortKey = "price_asc" | "price_desc" | "time_asc";
type Screen  = "results" | "seats" | "confirm";

/* ─── Demo data ──────────────────────────────────────────────────────── */
const TRIPS: Trip[] = [
  {
    id: "t1", company: "UTB Express",     companyInitial: "U", companyColor: "#1A56DB",
    from: "Abidjan", to: "Bouaké",
    departureTime: "06:00", arrivalTime: "10:30", duration: "4h30",
    price: 3500, seatsLeft: 18, totalSeats: 36, busType: "Climatisé",
    amenities: ["❄️", "📶"],
    occupiedSeats: [1,2,5,8,12,15,19,21,24,27,30,34,35,36,7,10],
  },
  {
    id: "t2", company: "TSR Voyage",      companyInitial: "T", companyColor: "#7C3AED",
    from: "Abidjan", to: "Bouaké",
    departureTime: "07:30", arrivalTime: "12:00", duration: "4h30",
    price: 4000, seatsLeft: 3, totalSeats: 36, busType: "VIP",
    amenities: ["❄️", "📶", "🔌", "🍱"],
    occupiedSeats: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,34],
  },
  {
    id: "t3", company: "Mondial Trans",   companyInitial: "M", companyColor: "#059669",
    from: "Abidjan", to: "Bouaké",
    departureTime: "09:00", arrivalTime: "13:45", duration: "4h45",
    price: 3000, seatsLeft: 22, totalSeats: 40, busType: "Standard",
    amenities: ["❄️"],
    occupiedSeats: [2,5,9,13,16,20,22,25,27,30,31,32,33,34,35,36,37,38],
  },
  {
    id: "t4", company: "GoLine Premium",  companyInitial: "G", companyColor: "#DC2626",
    from: "Abidjan", to: "Bouaké",
    departureTime: "11:00", arrivalTime: "15:30", duration: "4h30",
    price: 5500, seatsLeft: 7, totalSeats: 36, busType: "Premium",
    amenities: ["❄️", "📶", "🔌", "🎬", "🍱"],
    occupiedSeats: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29],
  },
  {
    id: "t5", company: "Inter City Bus",  companyInitial: "I", companyColor: "#EA580C",
    from: "Abidjan", to: "Bouaké",
    departureTime: "14:00", arrivalTime: "18:30", duration: "4h30",
    price: 3200, seatsLeft: 0, totalSeats: 36, busType: "Climatisé",
    amenities: ["❄️", "📶"],
    occupiedSeats: Array.from({ length: 36 }, (_, i) => i + 1),
  },
];

/* Search context (simulated from previous screen) */
const SEARCH = { from: "Abidjan", to: "Bouaké", date: "Jeu. 20 mars", seats: 2 };

/* ─── Seat picker ────────────────────────────────────────────────────── */
function SeatPicker({
  trip, needed, onBack, onConfirm,
}: {
  trip: Trip;
  needed: number;
  onBack: () => void;
  onConfirm: (seats: number[]) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const cols   = 4;
  const rows   = Math.ceil(trip.totalSeats / cols);

  const toggle = (n: number) => {
    if (trip.occupiedSeats.includes(n)) return;
    setSelected(prev =>
      prev.includes(n)
        ? prev.filter(s => s !== n)
        : prev.length < needed
          ? [...prev, n]
          : prev,
    );
  };

  const seatColor = (n: number) => {
    if (trip.occupiedSeats.includes(n)) return { bg: "#CBD5E1", text: "#94A3B8", cursor: "default" };
    if (selected.includes(n))           return { bg: PRIMARY,   text: "white",   cursor: "pointer" };
    return { bg: "#F1F5F9", text: "#475569", cursor: "pointer" };
  };

  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
        padding: "52px 20px 24px", position: "relative",
      }}>
        <button onClick={onBack} style={{
          position: "absolute", top: 16, left: 16, width: 36, height: 36,
          borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)",
          color: "white", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white", textAlign: "center" }}>
          Choisir vos sièges
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>
          {trip.company} · {trip.departureTime} → {trip.arrivalTime}
        </p>
      </div>

      <div style={{ padding: "16px 16px 24px", flex: 1, overflowY: "auto" }}>
        {/* Progress */}
        <div style={{
          background: "white", borderRadius: 14, padding: "14px 16px", marginBottom: 14,
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>Sièges sélectionnés</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 900, color: PRIMARY }}>
              {selected.length} / {needed}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>Total estimé</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: SUCCESS }}>
              {(trip.price * needed).toLocaleString("fr-FR")} FCFA
            </p>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 14, marginBottom: 16, padding: "0 4px" }}>
          {[
            { bg: "#F1F5F9", text: "#475569", label: "Disponible" },
            { bg: PRIMARY,   text: "white",   label: "Sélectionné" },
            { bg: "#CBD5E1", text: "#94A3B8", label: "Occupé" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, background: l.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
              }} />
              <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Bus outline */}
        <div style={{
          background: "white", borderRadius: 20, padding: "16px 12px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 16,
        }}>
          {/* Driver row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12, gap: 8,
          }}>
            <div style={{
              width: 44, height: 28, borderRadius: 8, background: "#E2E8F0",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>🚌</div>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>AVANT DU BUS</span>
          </div>

          {/* Seat grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {Array.from({ length: cols }, (_, col) => {
                  const seatNum = row * cols + col + 1;
                  if (seatNum > trip.totalSeats) return <div key={col} style={{ width: 46, height: 40 }} />;
                  const { bg, text, cursor } = seatColor(seatNum);
                  /* aisle gap after col 1 */
                  const marginRight = col === 1 ? 16 : 0;
                  return (
                    <div
                      key={col}
                      onClick={() => toggle(seatNum)}
                      style={{
                        width: 46, height: 40, borderRadius: 8,
                        background: bg, color: text,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, cursor,
                        marginRight, transition: "all 0.12s",
                        border: selected.includes(seatNum) ? `2px solid #1240a8` : "2px solid transparent",
                        userSelect: "none",
                      }}
                    >
                      {seatNum}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Hint if not enough seats selected */}
        {selected.length < needed && (
          <p style={{
            margin: "0 0 14px", fontSize: 12, color: "#D97706", fontWeight: 600,
            textAlign: "center", background: "#FEF3C7", borderRadius: 10, padding: "10px 14px",
          }}>
            ⚠ Sélectionnez encore {needed - selected.length} siège{needed - selected.length > 1 ? "s" : ""}
          </p>
        )}

        <button
          disabled={selected.length < needed}
          onClick={() => selected.length >= needed && onConfirm(selected)}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
            background: selected.length >= needed
              ? `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`
              : "#E2E8F0",
            color: selected.length >= needed ? "white" : "#94A3B8",
            fontSize: 15, fontWeight: 800,
            cursor: selected.length >= needed ? "pointer" : "default",
            boxShadow: selected.length >= needed ? "0 4px 20px rgba(26,86,219,0.30)" : "none",
            transition: "all 0.2s",
          }}>
          Confirmer les sièges →
        </button>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function TripResults() {
  const [screen,       setScreen]       = useState<Screen>("results");
  const [chosen,       setChosen]       = useState<Trip | null>(null);
  const [chosenSeats,  setChosenSeats]  = useState<number[]>([]);
  const [sortKey,      setSortKey]      = useState<SortKey>("price_asc");

  /* Filter: only trips with enough available seats matching the route */
  const available = useMemo(() => {
    const filtered = TRIPS.filter(
      t => t.from === SEARCH.from && t.to === SEARCH.to && t.seatsLeft >= SEARCH.seats,
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === "price_asc")  return a.price - b.price;
      if (sortKey === "price_desc") return b.price - a.price;
      /* time_asc */
      return a.departureTime.localeCompare(b.departureTime);
    });
  }, [sortKey]);

  /* Full trip list for display (includes unavailable, greyed out) */
  const allTrips = useMemo(() => {
    const full = TRIPS.filter(t => t.from === SEARCH.from && t.to === SEARCH.to);
    return [...full].sort((a, b) => {
      if (sortKey === "price_asc")  return a.price - b.price;
      if (sortKey === "price_desc") return b.price - a.price;
      return a.departureTime.localeCompare(b.departureTime);
    });
  }, [sortKey]);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "price_asc",  label: "Prix ↑" },
    { key: "price_desc", label: "Prix ↓" },
    { key: "time_asc",   label: "Horaire" },
  ];

  /* ── Seat picker screen ── */
  if (screen === "seats" && chosen) {
    return (
      <SeatPicker
        trip={chosen}
        needed={SEARCH.seats}
        onBack={() => setScreen("results")}
        onConfirm={seats => { setChosenSeats(seats); setScreen("confirm"); }}
      />
    );
  }

  /* ── Confirmation screen ── */
  if (screen === "confirm" && chosen) {
    return (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`,
          padding: "52px 20px 24px", position: "relative",
        }}>
          <button onClick={() => setScreen("seats")} style={{
            position: "absolute", top: 16, left: 16, width: 36, height: 36,
            borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)",
            color: "white", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "white" }}>
              Trajet &amp; sièges sélectionnés
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              Vérifiez les détails avant de confirmer
            </p>
          </div>
        </div>

        <div style={{ padding: "20px 16px", flex: 1 }}>
          {/* Trip card */}
          <div style={{
            background: "white", borderRadius: 16, padding: 18,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: chosen.companyColor + "18",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 800, color: chosen.companyColor,
              }}>{chosen.companyInitial}</div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{chosen.company}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>{chosen.busType}</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{chosen.departureTime}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B", fontWeight: 600 }}>{chosen.from}</p>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "0 12px" }}>
                <div style={{ height: 2, background: "#E2E8F0", position: "relative", margin: "0 12px" }}>
                  <span style={{
                    position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
                    fontSize: 11, color: "#94A3B8", background: "white", padding: "0 6px", fontWeight: 600,
                  }}>{chosen.duration}</span>
                </div>
                <p style={{ margin: "14px 0 0", fontSize: 11, color: "#94A3B8" }}>🚌 Direct</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{chosen.arrivalTime}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B", fontWeight: 600 }}>{chosen.to}</p>
              </div>
            </div>

            {/* Selected seats row */}
            <div style={{
              background: "#F8FAFF", borderRadius: 12, padding: "12px 14px", marginBottom: 14,
            }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
                Sièges réservés
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {chosenSeats.map(s => (
                  <div key={s} style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: PRIMARY, color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                  }}>{s}</div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 14, display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Passagers</p>
                <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                  {SEARCH.seats} personne{SEARCH.seats > 1 ? "s" : ""}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</p>
                <p style={{ margin: "3px 0 0", fontSize: 20, fontWeight: 900, color: SUCCESS }}>
                  {(chosen.price * SEARCH.seats).toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </div>
          </div>

          <div style={{
            background: "#EFF6FF", borderRadius: 14, padding: 14, marginBottom: 20,
            border: "1px solid #BFDBFE",
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#1E40AF", lineHeight: 1.6 }}>
              ℹ️ En cliquant sur <strong>Confirmer la réservation</strong>, vous serez redirigé vers le paiement sécurisé. Votre billet sera envoyé par SMS et email.
            </p>
          </div>

          <button style={{
            width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
            background: `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`,
            color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(5,150,105,0.35)",
          }}>
            ✅ Confirmer la réservation
          </button>
        </div>
      </div>
    );
  }

  /* ── Results screen ── */
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
          Trajets disponibles
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>
          {SEARCH.from} → {SEARCH.to} · {SEARCH.date} · {SEARCH.seats} places
        </p>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, marginTop: 14,
          background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 20px",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{SEARCH.from}</span>
          <span style={{ fontSize: 18, color: "rgba(255,255,255,0.7)" }}>→</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{SEARCH.to}</span>
        </div>
      </div>

      {/* Sort + count bar */}
      <div style={{ padding: "12px 16px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B", fontWeight: 600 }}>
            <span style={{ color: PRIMARY, fontWeight: 800 }}>{available.length}</span> trajet{available.length > 1 ? "s" : ""} pour {SEARCH.seats} place{SEARCH.seats > 1 ? "s" : ""}
          </p>
        </div>
        {/* Sort pills */}
        <div style={{ display: "flex", gap: 8 }}>
          {SORT_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setSortKey(o.key)}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700,
                background: sortKey === o.key ? PRIMARY : "white",
                color: sortKey === o.key ? "white" : "#64748B",
                boxShadow: sortKey === o.key
                  ? "0 2px 8px rgba(26,86,219,0.25)"
                  : "0 1px 3px rgba(0,0,0,0.07)",
                transition: "all 0.15s",
              }}
            >{o.label}</button>
          ))}
        </div>
      </div>

      {/* Trip cards */}
      <div style={{ padding: "6px 16px 24px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {allTrips.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Aucun trajet trouvé</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>
              Essayez une autre date ou un autre itinéraire.
            </p>
          </div>
        )}

        {allTrips.map(trip => {
          const isFull    = trip.seatsLeft < SEARCH.seats;
          const isLow     = !isFull && trip.seatsLeft <= 5;

          return (
            <div key={trip.id} style={{
              background: "white", borderRadius: 18,
              boxShadow: isFull
                ? "0 1px 4px rgba(0,0,0,0.04)"
                : "0 2px 14px rgba(26,86,219,0.07), 0 1px 4px rgba(0,0,0,0.04)",
              overflow: "hidden",
              opacity: isFull ? 0.55 : 1,
              border: `1.5px solid ${isFull ? "#F1F5F9" : "transparent"}`,
            }}>
              {/* Card header */}
              <div style={{
                background: isFull ? "#F8FAFC" : trip.companyColor + "0D",
                padding: "11px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid #F1F5F9",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: isFull ? "#E2E8F0" : trip.companyColor + "22",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 800, color: isFull ? "#94A3B8" : trip.companyColor,
                  }}>{trip.companyInitial}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: isFull ? "#94A3B8" : "#0F172A" }}>
                      {trip.company}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "#94A3B8" }}>{trip.busType}</p>
                  </div>
                </div>

                {/* Seats badge */}
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                  background: isFull ? "#FEE2E2" : isLow ? "#FEF3C7" : "#DCFCE7",
                  color:      isFull ? "#DC2626" : isLow ? "#D97706" : "#059669",
                }}>
                  {isFull
                    ? trip.seatsLeft === 0 ? "Complet" : `Seulement ${trip.seatsLeft} place${trip.seatsLeft > 1 ? "s" : ""}`
                    : `${trip.seatsLeft} places`}
                </div>
              </div>

              {/* Times row */}
              <div style={{ padding: "14px 16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: -0.5 }}>
                      {trip.departureTime}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B", fontWeight: 600 }}>{trip.from}</p>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "0 12px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{trip.duration}</p>
                    <div style={{ position: "relative", height: 2, background: "#E2E8F0" }}>
                      <div style={{
                        position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)",
                        width: 10, height: 10, borderRadius: "50%",
                        background: isFull ? "#CBD5E1" : PRIMARY,
                      }} />
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 10, color: "#CBD5E1" }}>🚌 Direct</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: -0.5 }}>
                      {trip.arrivalTime}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B", fontWeight: 600 }}>{trip.to}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: "12px 16px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {trip.amenities.map((a, i) => <span key={i} style={{ fontSize: 14 }}>{a}</span>)}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: isFull ? "#94A3B8" : SUCCESS }}>
                      {trip.price.toLocaleString("fr-FR")} <span style={{ fontSize: 11, fontWeight: 600 }}>FCFA</span>
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: "#94A3B8" }}>par personne</p>
                  </div>

                  <button
                    disabled={isFull}
                    onClick={() => { if (!isFull) { setChosen(trip); setScreen("seats"); } }}
                    style={{
                      padding: "10px 14px", borderRadius: 12, border: "none",
                      background: isFull
                        ? "#E2E8F0"
                        : `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
                      color: isFull ? "#94A3B8" : "white",
                      fontSize: 12, fontWeight: 800, cursor: isFull ? "default" : "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: isFull ? "none" : "0 3px 12px rgba(26,86,219,0.28)",
                    }}>
                    {isFull ? "Indisponible" : "Choisir →"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
