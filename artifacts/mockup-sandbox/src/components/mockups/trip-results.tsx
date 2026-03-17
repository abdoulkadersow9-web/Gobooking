import { useState, useMemo, useEffect } from "react";

const PRIMARY    = "#1A56DB";
const SUCCESS    = "#059669";
const DANGER     = "#DC2626";
const AVAIL_BG   = "#DCFCE7";
const AVAIL_TEXT = "#166534";
const TAKEN_BG   = "#FEE2E2";
const TAKEN_TEXT = "#991B1B";
const SEL_BG     = "#FEF08A";
const SEL_BORDER = "#CA8A04";
const SEL_TEXT   = "#713F12";

const PAY_METHODS = [
  { id: "orange", label: "Orange Money", subtitle: "Via votre compte Orange", icon: "🟠", color: "#FF6B00" },
  { id: "mtn",    label: "MTN Money",    subtitle: "Via votre compte MTN",    icon: "🟡", color: "#EAB308" },
  { id: "wave",   label: "Wave",         subtitle: "Paiement rapide via Wave",icon: "🌊", color: "#0EA5E9" },
  { id: "card",   label: "Carte bancaire", subtitle: "Visa, Mastercard",      icon: "💳", color: "#059669" },
] as const;

type PayMethod = (typeof PAY_METHODS)[number]["id"] | null;

const ERROR_MSGS: Record<string, string> = {
  orange: "Solde Orange Money insuffisant. Rechargez votre compte et réessayez.",
  mtn:    "Transaction MTN Money refusée. Vérifiez votre PIN ou contactez le service client.",
  wave:   "Échec de connexion Wave. Réessayez dans quelques instants.",
  card:   "Carte refusée. Vérifiez les informations ou contactez votre banque.",
};

function makeRef() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "GBK-" + Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

function QRCode({ value }: { value: string }) {
  const sz = 72, cells = 7, cell = sz / cells;
  const seed = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const grid = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if ((r < 2 && c < 2) || (r < 2 && c >= cells - 2) || (r >= cells - 2 && c < 2)) return true;
      return ((seed * (r + 1) * (c + 3) + r * c) % 3) === 0;
    })
  );
  return (
    <div style={{ width: sz + 10, height: sz + 10, background: "white", borderRadius: 7, padding: 5, boxShadow: "0 1px 6px rgba(0,0,0,0.10)" }}>
      {grid.map((row, r) => (
        <div key={r} style={{ display: "flex" }}>
          {row.map((f, c) => <div key={c} style={{ width: cell, height: cell, background: f ? "#0F172A" : "white" }} />)}
        </div>
      ))}
    </div>
  );
}

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
type Screen  = "results" | "seats" | "confirm" | "payment" | "processing" | "success" | "error" | "ticket";

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
    if (trip.occupiedSeats.includes(n)) return { bg: TAKEN_BG, text: TAKEN_TEXT, border: TAKEN_BG,   cursor: "default",  strip: "#FCA5A5" };
    if (selected.includes(n))           return { bg: SEL_BG,   text: SEL_TEXT,   border: SEL_BORDER, cursor: "pointer",  strip: "#FDE047" };
    return                                     { bg: AVAIL_BG, text: AVAIL_TEXT,  border: AVAIL_BG,   cursor: "pointer",  strip: "#86EFAC" };
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
        <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: "0 4px", flexWrap: "wrap" }}>
          {[
            { bg: AVAIL_BG, border: AVAIL_BG,   label: "Disponible" },
            { bg: TAKEN_BG, border: TAKEN_BG,   label: "Réservé" },
            { bg: SEL_BG,   border: SEL_BORDER, label: "Mon choix" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: l.bg, border: `1.5px solid ${l.border}` }} />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} style={{ display: "flex", alignItems: "center" }}>
                {/* Row number */}
                <span style={{ width: 20, fontSize: 10, color: "#CBD5E1", fontWeight: 700, textAlign: "right", marginRight: 8, flexShrink: 0 }}>{row + 1}</span>
                {/* Left pair */}
                <div style={{ display: "flex", gap: 5 }}>
                  {[0, 1].map(col => {
                    const n = row * cols + col + 1;
                    if (n > trip.totalSeats) return <div key={col} style={{ width: 44, height: 46 }} />;
                    const { bg, text, border, cursor, strip } = seatColor(n);
                    return (
                      <div key={col} onClick={() => toggle(n)} style={{ width: 44, height: 46, borderRadius: 9, background: bg, color: text, border: `2px solid ${border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor, userSelect: "none", transition: "all 0.12s" }}>
                        <div style={{ width: 26, height: 5, borderRadius: "4px 4px 0 0", background: strip, marginBottom: 2 }} />
                        <span style={{ fontSize: 11, fontWeight: 800 }}>{n}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Aisle */}
                <div style={{ width: 18, flexShrink: 0 }} />
                {/* Right pair */}
                <div style={{ display: "flex", gap: 5 }}>
                  {[2, 3].map(col => {
                    const n = row * cols + col + 1;
                    if (n > trip.totalSeats) return <div key={col} style={{ width: 44, height: 46 }} />;
                    const { bg, text, border, cursor, strip } = seatColor(n);
                    return (
                      <div key={col} onClick={() => toggle(n)} style={{ width: 44, height: 46, borderRadius: 9, background: bg, color: text, border: `2px solid ${border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor, userSelect: "none", transition: "all 0.12s" }}>
                        <div style={{ width: 26, height: 5, borderRadius: "4px 4px 0 0", background: strip, marginBottom: 2 }} />
                        <span style={{ fontSize: 11, fontWeight: 800 }}>{n}</span>
                      </div>
                    );
                  })}
                </div>
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
  const [method,       setMethod]       = useState<PayMethod>(null);
  const [paySubmitted, setPaySubmitted] = useState(false);
  const [simulateFail, setSimulateFail] = useState(false);
  const [bookingRef]                    = useState(() => makeRef());
  const [dlDone,       setDlDone]       = useState(false);
  const [shareDone,    setShareDone]    = useState(false);
  const [shareMsg,     setShareMsg]     = useState("");

  const total   = chosen ? chosen.price * chosenSeats.length : 0;
  const pm      = PAY_METHODS.find(p => p.id === method) ?? null;

  const handlePay = () => {
    setPaySubmitted(true);
    if (!method) return;
    setScreen("processing");
    setTimeout(() => setScreen(simulateFail ? "error" : "success"), 2400);
  };

  /* Auto-redirect success → ticket after 2s */
  useEffect(() => {
    if (screen !== "success") return;
    const t = setTimeout(() => setScreen("ticket"), 2000);
    return () => clearTimeout(t);
  }, [screen]);

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

          <button onClick={() => setScreen("payment")} style={{
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

  /* ── Payment screen ── */
  if (screen === "payment" && chosen) {
    return (
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`, padding: "52px 20px 24px", position: "relative" }}>
          <button onClick={() => setScreen("confirm")} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white", textAlign: "center" }}>Paiement sécurisé</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>Choisissez votre mode de paiement</p>
        </div>
        <div style={{ padding: "20px 16px", flex: 1, overflowY: "auto" }}>
          {/* Amount card */}
          <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>À payer</p>
              <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 900, color: SUCCESS }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>{chosen.from} → {chosen.to}</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{chosen.departureTime} · {chosenSeats.length} siège{chosenSeats.length > 1 ? "s" : ""} ({chosenSeats.join(", ")})</p>
            </div>
          </div>
          {/* Method list */}
          <p style={{ margin: "0 0 12px", fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Mode de paiement</p>
          {PAY_METHODS.map(pm => {
            const sel = method === pm.id;
            return (
              <div key={pm.id} onClick={() => { setMethod(pm.id as PayMethod); setPaySubmitted(false); }} style={{ background: "white", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 8px rgba(0,0,0,0.05)", border: `2px solid ${sel ? pm.color : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: pm.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{pm.icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{pm.label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>{pm.subtitle}</p>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${sel ? pm.color : "#CBD5E1"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {sel && <div style={{ width: 10, height: 10, borderRadius: "50%", background: pm.color }} />}
                </div>
              </div>
            );
          })}
          {paySubmitted && !method && (
            <p style={{ margin: "4px 0 16px", fontSize: 12, color: DANGER, fontWeight: 700, textAlign: "center" }}>⚠ Veuillez sélectionner un mode de paiement</p>
          )}
          {/* Demo toggle */}
          <div style={{ background: "#FEF9C3", borderRadius: 12, padding: "10px 14px", marginBottom: 20, border: "1px solid #FDE047", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#713F12", fontWeight: 700 }}>🧪 Simuler un échec (démo)</p>
            <button onClick={() => setSimulateFail(f => !f)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: simulateFail ? DANGER : "#CBD5E1", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, left: simulateFail ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
            </button>
          </div>
          <button onClick={handlePay} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`, color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(26,86,219,0.30)" }}>
            🔒 Payer {total.toLocaleString("fr-FR")} FCFA
          </button>
        </div>
      </div>
    );
  }

  /* ── Processing screen ── */
  if (screen === "processing") {
    return (
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ background: "white", borderRadius: 24, padding: 40, width: "100%", maxWidth: 320, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: (pm?.color ?? PRIMARY) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>{pm?.icon ?? "💳"}</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Traitement en cours…</h2>
          <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748B" }}>{pm?.label}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: pm?.color ?? PRIMARY, opacity: 0.3 + i * 0.35, animation: "pulse 1.2s ease-in-out infinite" }} />
            ))}
          </div>
          <p style={{ margin: "18px 0 0", fontSize: 11, color: "#94A3B8" }}>Ne fermez pas cette fenêtre</p>
        </div>
      </div>
    );
  }

  /* ── Success (brief transition) ── */
  if (screen === "success") {
    return (
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <div style={{ width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, marginBottom: 22 }}>✅</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 900, color: "white" }}>Paiement réussi !</h2>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "rgba(255,255,255,0.90)" }}>
          {total.toLocaleString("fr-FR")} FCFA · {pm?.label}
        </p>
        <p style={{ margin: "0 0 32px", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
          📱 Billet envoyé par SMS et email
        </p>
        {/* Progress bar */}
        <div style={{ width: 200, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.25)", marginBottom: 24, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 2, background: "white", animation: "growBar 2s linear forwards" }} />
        </div>
        <p style={{ margin: "0 0 28px", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>Redirection vers votre ticket…</p>
        <button onClick={() => setScreen("ticket")} style={{ padding: "14px 32px", borderRadius: 16, border: "2px solid white", background: "transparent", color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          Voir mon ticket →
        </button>
        <style>{`@keyframes growBar { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

  /* ── Ticket screen ── */
  if (screen === "ticket" && chosen) {
    const seatStrs  = chosenSeats.map(String);
    const fromCode  = chosen.from.slice(0, 3).toUpperCase();
    const toCode    = chosen.to.slice(0, 3).toUpperCase();
    const qrPayload = [bookingRef, seatStrs.join(","), `${fromCode}-${toCode}`, chosen.departureTime, "Passager GoBooking"].join("|");

    const handleDownload = () => {
      setDlDone(true);
      setTimeout(() => { window.print(); setTimeout(() => setDlDone(false), 1600); }, 150);
    };
    const handleShare = async () => {
      const text = `🎫 GoBooking\n📍 ${chosen.from} → ${chosen.to}\n🕐 ${SEARCH.date} à ${chosen.departureTime}\n💺 Siège(s) : ${seatStrs.join(", ")}\n🔖 ${bookingRef}`;
      if (typeof navigator.share === "function") {
        try { await navigator.share({ title: "Mon ticket GoBooking", text }); setShareMsg("Partagé !"); }
        catch { setShareMsg("Annulé"); }
      } else {
        try { await navigator.clipboard.writeText(text); setShareMsg("Copié !"); }
        catch { setShareMsg("Copié !"); }
      }
      setShareDone(true);
      setTimeout(() => { setShareDone(false); setShareMsg(""); }, 2400);
    };

    return (
      <div id="gobooking-ticket-root" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`, padding: "52px 20px 28px", position: "relative" }}>
          <button onClick={() => setScreen("success")} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.20)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: "white", textAlign: "center" }}>Mon ticket</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>Billet électronique confirmé</p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "6px 16px", display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>Réservation confirmée</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>

          {/* Ticket card */}
          <div style={{ background: "white", borderRadius: 24, overflow: "hidden", boxShadow: "0 6px 32px rgba(0,0,0,0.10)", marginBottom: 16 }}>
            {/* Company + route */}
            <div style={{ background: `${PRIMARY}10`, padding: "20px 20px 18px", borderBottom: "2px dashed #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: chosen.companyColor + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: chosen.companyColor }}>{chosen.companyInitial}</div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{chosen.company}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{chosen.busType}</p>
                </div>
                <div style={{ marginLeft: "auto", background: SUCCESS + "18", borderRadius: 8, padding: "4px 10px" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: SUCCESS }}>✔ Payé</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{chosen.departureTime}</p>
                  <p style={{ margin: "5px 0 0", fontSize: 14, fontWeight: 800, color: PRIMARY }}>{fromCode}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{chosen.from}</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: "0 10px" }}>
                  <p style={{ margin: 0, fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{chosen.duration}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", margin: "6px 0" }}>
                    <div style={{ flex: 1, height: 1.5, background: "#E2E8F0" }} />
                    <span style={{ fontSize: 14 }}>🚌</span>
                    <div style={{ flex: 1, height: 1.5, background: "#E2E8F0" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: "#94A3B8" }}>Direct</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{chosen.arrivalTime}</p>
                  <p style={{ margin: "5px 0 0", fontSize: 14, fontWeight: 800, color: "#7C3AED" }}>{toCode}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{chosen.to}</p>
                </div>
              </div>
            </div>

            {/* Tear notches */}
            <div style={{ position: "relative", height: 0, overflow: "visible" }}>
              <div style={{ position: "absolute", left: -14, top: -14, width: 28, height: 28, borderRadius: "50%", background: "#F1F5F9" }} />
              <div style={{ position: "absolute", right: -14, top: -14, width: 28, height: 28, borderRadius: "50%", background: "#F1F5F9" }} />
            </div>

            {/* Info rows */}
            <div style={{ padding: "18px 20px 4px" }}>
              {[
                { label: "Date",      value: SEARCH.date },
                { label: "Siège(s)",  value: seatStrs.map(s => `N°${s}`).join("  ·  "), accent: true },
                { label: "Paiement",  value: pm?.label ?? "" },
                { label: "N° ticket", value: bookingRef, accent: true },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: r.accent ? PRIMARY : "#0F172A" }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* QR code */}
            <div style={{ padding: "20px 20px 24px", borderTop: "2px dashed #E2E8F0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Scannez à l'embarquement</p>
              <QRCode value={qrPayload} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0F172A", letterSpacing: 2 }}>{bookingRef}</p>
              <div style={{ background: "#F8FAFF", borderRadius: 10, padding: "8px 14px", width: "100%", boxSizing: "border-box" as const }}>
                <p style={{ margin: 0, fontSize: 10, color: "#64748B", textAlign: "center", fontFamily: "monospace" }}>
                  {seatStrs.join(",")} · {fromCode}→{toCode} · {chosen.departureTime}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textAlign: "center", lineHeight: 1.5 }}>Ce QR code est personnel et unique.<br />Ne le partagez pas avec des tiers.</p>
            </div>
          </div>

          {/* Amount */}
          <div style={{ background: "white", borderRadius: 14, padding: "14px 18px", marginBottom: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Montant payé</p>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, color: SUCCESS }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <div style={{ background: SUCCESS + "12", borderRadius: 10, padding: "8px 12px" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: SUCCESS, textTransform: "uppercase", letterSpacing: 0.5 }}>via {pm?.label}</span>
            </div>
          </div>

          {/* Notice */}
          <div style={{ background: "#EFF6FF", borderRadius: 14, padding: "12px 16px", border: "1px solid #BFDBFE", marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#1E40AF", lineHeight: 1.7 }}>
              📱 Ticket envoyé par <strong>SMS</strong> et <strong>email</strong>. Arrivez <strong>15 min</strong> avant le départ.
            </p>
          </div>

          {/* Actions */}
          <button onClick={handleDownload} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: dlDone ? `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)` : `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`, color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 12, transition: "all 0.25s", boxShadow: "0 4px 20px rgba(26,86,219,0.30)" }}>
            {dlDone ? "✅ Ouverture PDF…" : "⬇ Télécharger le ticket (PDF)"}
          </button>
          <button onClick={handleShare} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: `2px solid ${shareDone ? SUCCESS : PRIMARY}`, background: shareDone ? SUCCESS + "12" : "white", color: shareDone ? SUCCESS : PRIMARY, fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 12, transition: "all 0.25s" }}>
            {shareDone ? `✅ ${shareMsg}` : "↗ Partager le ticket"}
          </button>
          <button onClick={() => { setScreen("results"); setChosen(null); setChosenSeats([]); setMethod(null); setPaySubmitted(false); }} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "1.5px solid #E2E8F0", background: "white", color: "#475569", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            🏠 Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  /* ── Error screen ── */
  if (screen === "error") {
    return (
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ background: "white", borderRadius: 24, padding: 36, width: "100%", maxWidth: 320, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px" }}>❌</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Échec du paiement</h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{method ? ERROR_MSGS[method] : "Une erreur est survenue."}</p>
          <p style={{ margin: "0 0 24px", fontSize: 11, color: "#94A3B8" }}>Aucun montant n'a été débité de votre compte.</p>
          <button onClick={() => { setScreen("payment"); setPaySubmitted(false); }} style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`, color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", marginBottom: 12 }}>
            Réessayer
          </button>
          <button onClick={() => { setScreen("results"); setChosen(null); setChosenSeats([]); setMethod(null); setPaySubmitted(false); }} style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1.5px solid #E2E8F0", background: "white", color: "#475569", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Changer de trajet
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
