import { useState } from "react";

const PRIMARY = "#1A56DB";
const GREEN   = "#059669";
const LIGHT   = "#EEF2FF";

const CITIES = [
  "Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "Daloa",
  "San-Pédro", "Man", "Gagnoa", "Abengourou", "Divo",
  "Soubré", "Odienné", "Bondoukou", "Touba", "Séguéla",
];

interface Trip {
  id: string;
  company: string;
  companyInitials: string;
  busType: string;
  departure: string;
  arrival: string;
  duration: string;
  seats: number;
  price: number;
  amenities: string[];
}

const TRIPS: Trip[] = [
  { id:"t1", company:"UTB Express",     companyInitials:"UE", busType:"Climatisé",  departure:"06h00", arrival:"10h30", duration:"4h30", seats:12, price:4500,  amenities:["❄️","📶","🔌"] },
  { id:"t2", company:"TSR Voyage",      companyInitials:"TS", busType:"Premium",    departure:"08h00", arrival:"12h00", duration:"4h00", seats:5,  price:6500,  amenities:["❄️","📶","🔌","🎬"] },
  { id:"t3", company:"Mondial Trans",   companyInitials:"MT", busType:"Standard",   departure:"10h00", arrival:"15h00", duration:"5h00", seats:18, price:3500,  amenities:["❄️"] },
  { id:"t4", company:"GoLine Premium",  companyInitials:"GL", busType:"VIP",        departure:"14h00", arrival:"18h00", duration:"4h00", seats:3,  price:8000,  amenities:["❄️","📶","🔌","🎬","🍱"] },
];

type Screen = "search" | "results";

function CityDropdown({ value, onChange, placeholder, cities }: {
  value: string; onChange: (v: string) => void;
  placeholder: string; cities: string[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = cities.filter(c => c.toLowerCase().includes(q.toLowerCase()) && c !== value);

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 15px", borderRadius: 14, cursor: "pointer",
          border: `1.5px solid ${open ? PRIMARY : "#E2E8F0"}`,
          background: open ? "#F8FAFF" : "white",
          transition: "all 0.15s",
        }}>
        <span style={{ fontSize: 14, color: value ? "#0F172A" : "#94A3B8", fontWeight: value ? 600 : 400 }}>
          {value || placeholder}
        </span>
        <span style={{ fontSize: 12, color: "#94A3B8", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
          background: "white", borderRadius: 14,
          border: "1.5px solid #E2E8F0",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          overflow: "hidden",
          maxHeight: 240,
        }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9" }}>
            <input
              autoFocus
              placeholder="Rechercher une ville…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%", border: "1px solid #E2E8F0", borderRadius: 8,
                padding: "7px 10px", fontSize: 12, outline: "none",
                background: "#F8FAFC", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", maxHeight: 185 }}>
            {filtered.length === 0
              ? <div style={{ padding: "14px", textAlign: "center", fontSize: 12, color: "#94A3B8" }}>Aucune ville trouvée</div>
              : filtered.map(c => (
                  <div key={c} onClick={() => { onChange(c); setOpen(false); setQ(""); }}
                    style={{
                      padding: "11px 16px", fontSize: 14, fontWeight: 500,
                      cursor: "pointer", color: "#334155",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFF")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >{c}</div>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingSearch() {
  const [screen,    setScreen]    = useState<Screen>("search");
  const [from,      setFrom]      = useState("");
  const [to,        setTo]        = useState("");
  const [date,      setDate]      = useState("");
  const [seats,     setSeats]     = useState(1);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSearch = !!(from && to && date && from !== to && seats >= 1);

  /* Validation errors (shown after first submit attempt) */
  const errors = submitted ? {
    from:  !from            ? "Veuillez choisir une ville de départ"          : null,
    to:    !to              ? "Veuillez choisir une ville d'arrivée"          : null,
    same:  from && to && from === to ? "Le départ et l'arrivée doivent être différents" : null,
    date:  !date            ? "Veuillez choisir une date de voyage"           : null,
    seats: seats < 1        ? "Le nombre de places doit être au moins 1"     : null,
  } : { from: null, to: null, same: null, date: null, seats: null };

  const handleSearch = () => {
    setSubmitted(true);
    if (canSearch) setScreen("results");
  };

  const swapCities = () => { const tmp = from; setFrom(to); setTo(tmp); };

  const today = new Date().toISOString().split("T")[0];

  /* ── SEARCH SCREEN ── */
  if (screen === "search") {
    return (
      <div style={{
        fontFamily: "Inter, -apple-system, sans-serif",
        background: "#F8FAFC", minHeight: "100vh",
        maxWidth: 430, margin: "0 auto",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>

        {/* Hero header */}
        <div style={{
          background: `linear-gradient(145deg, ${PRIMARY} 0%, #1240a8 55%, #0e2f7f 100%)`,
          padding: "28px 20px 80px",
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

          {/* Logo + greeting */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>GoBooking</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginTop: 3 }}>Réserver mon trajet 🚌</div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, border: "1px solid rgba(255,255,255,0.2)",
            }}>🔔</div>
          </div>

          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5 }}>
            Voyagez en toute sérénité à travers la Côte d'Ivoire
          </p>
        </div>

        {/* Search form card — overlaps hero */}
        <div style={{ margin: "0 16px", marginTop: -52, zIndex: 10, position: "relative" }}>
          <div style={{
            background: "white", borderRadius: 20, padding: "20px 18px",
            boxShadow: "0 8px 32px rgba(26,86,219,0.13), 0 2px 8px rgba(0,0,0,0.06)",
          }}>
            {/* From / To with swap */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: errors.from ? "#DC2626" : "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    🟢 Départ
                  </label>
                  <CityDropdown value={from} onChange={v => { setFrom(v); setSubmitted(false); }} placeholder="Choisir une ville" cities={CITIES} />
                  {errors.from && <p style={{ margin: "5px 0 0 2px", fontSize: 11, color: "#DC2626", fontWeight: 600 }}>⚠ {errors.from}</p>}
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: (errors.to || errors.same) ? "#DC2626" : "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    🔴 Arrivée
                  </label>
                  <CityDropdown value={to} onChange={v => { setTo(v); setSubmitted(false); }} placeholder="Choisir une ville" cities={CITIES} />
                  {errors.to   && <p style={{ margin: "5px 0 0 2px", fontSize: 11, color: "#DC2626", fontWeight: 600 }}>⚠ {errors.to}</p>}
                  {errors.same && <p style={{ margin: "5px 0 0 2px", fontSize: 11, color: "#DC2626", fontWeight: 600 }}>⚠ {errors.same}</p>}
                </div>
              </div>
              {/* Swap button */}
              <button onClick={swapCities} style={{
                width: 40, height: 40, borderRadius: 12, border: "1.5px solid #E2E8F0",
                background: "white", cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, marginTop: 22,
                transition: "all 0.15s",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
              }}>
                ⇅
              </button>
            </div>

            {/* Date + Seats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: errors.date ? "#DC2626" : "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  📅 Date du voyage
                </label>
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={e => { setDate(e.target.value); setSubmitted(false); }}
                  style={{
                    width: "100%", padding: "12px 12px", borderRadius: 14,
                    border: `1.5px solid ${errors.date ? "#DC2626" : date ? PRIMARY : "#E2E8F0"}`,
                    fontSize: 13, fontFamily: "inherit", outline: "none",
                    color: date ? "#0F172A" : "#94A3B8",
                    background: errors.date ? "#FEF2F2" : date ? "#F8FAFF" : "white",
                    boxSizing: "border-box", cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                />
                {errors.date && <p style={{ margin: "5px 0 0 2px", fontSize: 11, color: "#DC2626", fontWeight: 600 }}>⚠ {errors.date}</p>}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  🪑 Nombre de places
                </label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
                  <button onClick={() => setSeats(s => Math.max(1, s - 1))}
                    style={{ width: 42, height: 46, border: "none", background: "#F8FAFC", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#64748B", flexShrink: 0 }}>
                    −
                  </button>
                  <span style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{seats}</span>
                  <button onClick={() => setSeats(s => Math.min(8, s + 1))}
                    style={{ width: 42, height: 46, border: "none", background: "#F8FAFC", cursor: "pointer", fontSize: 18, fontWeight: 700, color: PRIMARY, flexShrink: 0 }}>
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              style={{
                width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
                background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
                color: "white",
                fontSize: 15, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: "0 4px 20px rgba(26,86,219,0.35)",
                transition: "all 0.2s",
              }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              Rechercher les trajets
            </button>
          </div>
        </div>

        {/* Popular routes */}
        <div style={{ padding: "24px 16px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 12 }}>🔥 Trajets populaires</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { from: "Abidjan",       to: "Bouaké",     price: "3 500 FCFA", duration: "4h30", icon: "🟢" },
              { from: "Abidjan",       to: "Yamoussoukro",price:"4 000 FCFA",duration: "3h00", icon: "🟡" },
              { from: "Abidjan",       to: "San-Pédro",  price: "5 500 FCFA", duration: "6h00", icon: "🔵" },
              { from: "Bouaké",        to: "Korhogo",    price: "3 000 FCFA", duration: "3h30", icon: "🟠" },
            ].map(r => (
              <div key={r.from+r.to}
                onClick={() => { setFrom(r.from); setTo(r.to); }}
                style={{
                  background: "white", borderRadius: 14, padding: "13px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: "pointer", border: "1.5px solid #E2E8F0",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = PRIMARY)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                    {r.icon} {r.from} → {r.to}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{r.duration}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: PRIMARY }}>À partir de</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>{r.price}</div>
                </div>
                <span style={{ color: "#94A3B8", fontSize: 14 }}>›</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom padding */}
        <div style={{ height: 32 }} />
      </div>
    );
  }

  /* ── RESULTS SCREEN ── */
  return (
    <div style={{
      fontFamily: "Inter, -apple-system, sans-serif",
      background: "#F8FAFC", minHeight: "100vh",
      maxWidth: 430, margin: "0 auto",
      display: "flex", flexDirection: "column",
    }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
        padding: "16px 16px 20px", flexShrink: 0,
        boxShadow: "0 2px 12px rgba(26,86,219,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={() => setScreen("search")} style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "white", fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>
              {from} → {to}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              {date ? new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" }) : ""} · {seats} place{seats > 1 ? "s" : ""}
            </div>
          </div>
        </div>
        {/* Summary chips */}
        <div style={{ display: "flex", gap: 8 }}>
          {[`${TRIPS.length} trajet${TRIPS.length>1?"s":""}`, "Dès 3 500 FCFA", "Paiement mobile"].map(c => (
            <span key={c} style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
              background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}>{c}</span>
          ))}
        </div>
      </div>

      {/* Trip cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {TRIPS.map(trip => {
          const isSel = selected === trip.id;
          return (
            <div key={trip.id}
              onClick={() => setSelected(isSel ? null : trip.id)}
              style={{
                background: "white", borderRadius: 18,
                border: `2px solid ${isSel ? PRIMARY : "#E2E8F0"}`,
                padding: "16px 16px", cursor: "pointer",
                boxShadow: isSel ? `0 4px 20px rgba(26,86,219,0.15)` : "0 1px 6px rgba(0,0,0,0.05)",
                transition: "all 0.2s",
              }}>
              {/* Company + bus type */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: isSel ? LIGHT : "#F1F5F9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, color: isSel ? PRIMARY : "#334155",
                  }}>{trip.companyInitials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{trip.company}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{trip.busType}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: PRIMARY }}>{trip.price.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>FCFA / place</div>
                </div>
              </div>

              {/* Time route */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{trip.departure}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>{from}</div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{trip.duration}</div>
                  <div style={{ height: 2, width: "100%", background: "linear-gradient(90deg, #BBF7D0, #DBEAFE)", borderRadius: 99, position: "relative" }}>
                    <div style={{ position: "absolute", left: "50%", top: -4, transform: "translateX(-50%)", fontSize: 10 }}>🚌</div>
                  </div>
                </div>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{trip.arrival}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>{to}</div>
                </div>
              </div>

              {/* Amenities + seats */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {trip.amenities.map(a => (
                    <span key={a} style={{
                      fontSize: 13, width: 28, height: 28, borderRadius: 8,
                      background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1px solid #E2E8F0",
                    }}>{a}</span>
                  ))}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                  background: trip.seats <= 5 ? "#FEF2F2" : "#ECFDF5",
                  color: trip.seats <= 5 ? "#DC2626" : GREEN,
                  border: `1px solid ${trip.seats <= 5 ? "#FECACA" : "#BBF7D0"}`,
                }}>
                  {trip.seats <= 5 ? `⚠ ${trip.seats} places` : `${trip.seats} places dispo`}
                </span>
              </div>

              {/* Expanded: reserve button */}
              {isSel && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: "#64748B" }}>{seats} place{seats > 1 ? "s" : ""} × {trip.price.toLocaleString()} FCFA</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: PRIMARY }}>
                      {(seats * trip.price).toLocaleString()} FCFA
                    </span>
                  </div>
                  <button style={{
                    width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                    background: `linear-gradient(135deg, ${GREEN} 0%, #047857 100%)`,
                    color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 16px rgba(5,150,105,0.35)",
                  }}>
                    ✓ &nbsp;Réserver ce trajet
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
