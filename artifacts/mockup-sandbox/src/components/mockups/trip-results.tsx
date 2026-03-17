import { useState } from "react";

const PRIMARY  = "#1A56DB";
const SUCCESS  = "#059669";
const WARNING  = "#D97706";

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
  busType: string;
  amenities: string[];
};

const TRIPS: Trip[] = [
  {
    id: "t1",
    company: "UTB Express",
    companyInitial: "U",
    companyColor: "#1A56DB",
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "06:00",
    arrivalTime: "10:30",
    duration: "4h30",
    price: 3500,
    seatsLeft: 18,
    busType: "Climatisé",
    amenities: ["❄️", "📶"],
  },
  {
    id: "t2",
    company: "TSR Voyage",
    companyInitial: "T",
    companyColor: "#7C3AED",
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "07:30",
    arrivalTime: "12:00",
    duration: "4h30",
    price: 4000,
    seatsLeft: 3,
    busType: "VIP",
    amenities: ["❄️", "📶", "🔌", "🍱"],
  },
  {
    id: "t3",
    company: "Mondial Trans",
    companyInitial: "M",
    companyColor: "#059669",
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "09:00",
    arrivalTime: "13:45",
    duration: "4h45",
    price: 3000,
    seatsLeft: 22,
    busType: "Standard",
    amenities: ["❄️"],
  },
  {
    id: "t4",
    company: "GoLine Premium",
    companyInitial: "G",
    companyColor: "#DC2626",
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "11:00",
    arrivalTime: "15:30",
    duration: "4h30",
    price: 5500,
    seatsLeft: 7,
    busType: "Premium",
    amenities: ["❄️", "📶", "🔌", "🎬", "🍱"],
  },
  {
    id: "t5",
    company: "Inter City Bus",
    companyInitial: "I",
    companyColor: "#EA580C",
    from: "Abidjan",
    to: "Bouaké",
    departureTime: "14:00",
    arrivalTime: "18:30",
    duration: "4h30",
    price: 3200,
    seatsLeft: 0,
    busType: "Climatisé",
    amenities: ["❄️", "📶"],
  },
];

type Screen = "results" | "confirm";

export default function TripResults() {
  const [screen, setScreen]     = useState<Screen>("results");
  const [chosen, setChosen]     = useState<Trip | null>(null);
  const [seats]                 = useState(2);

  const handleChoose = (trip: Trip) => {
    setChosen(trip);
    setScreen("confirm");
  };

  /* ── Confirmation screen ── */
  if (screen === "confirm" && chosen) {
    return (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`,
          padding: "52px 20px 24px", position: "relative",
        }}>
          <button
            onClick={() => setScreen("results")}
            style={{
              position: "absolute", top: 16, left: 16, width: 36, height: 36,
              borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)",
              color: "white", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>←</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "white" }}>Trajet sélectionné</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              Vérifiez les détails avant de confirmer
            </p>
          </div>
        </div>

        <div style={{ padding: "20px 16px", flex: 1 }}>
          {/* Trip summary card */}
          <div style={{
            background: "white", borderRadius: 16, padding: 18,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: chosen.companyColor + "18",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 800, color: chosen.companyColor,
              }}>{chosen.companyInitial}</div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{chosen.company}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>{chosen.busType}</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{chosen.departureTime}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B", fontWeight: 600 }}>{chosen.from}</p>
              </div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ height: 2, background: "#E2E8F0", position: "relative", margin: "0 12px" }}>
                  <span style={{
                    position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
                    fontSize: 11, color: "#94A3B8", background: "white", padding: "0 6px",
                    fontWeight: 600,
                  }}>{chosen.duration}</span>
                </div>
                <p style={{ margin: "14px 0 0", fontSize: 11, color: "#94A3B8" }}>🚌 Direct</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{chosen.arrivalTime}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B", fontWeight: 600 }}>{chosen.to}</p>
              </div>
            </div>

            <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 14, display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Places</p>
                <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{seats} passager{seats > 1 ? "s" : ""}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Total à payer</p>
                <p style={{ margin: "3px 0 0", fontSize: 20, fontWeight: 900, color: SUCCESS }}>
                  {(chosen.price * seats).toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </div>
          </div>

          {/* Info card */}
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
        padding: "52px 20px 28px", position: "relative",
      }}>
        <button
          onClick={() => {}}
          style={{
            position: "absolute", top: 16, left: 16, width: 36, height: 36,
            borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)",
            color: "white", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>

        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white", textAlign: "center" }}>
          Trajets disponibles
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>
          Abidjan → Bouaké · Jeu. 20 mars · 2 places
        </p>

        {/* Route badge */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, marginTop: 16,
          background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 20px",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Abidjan</span>
          <span style={{ fontSize: 18, color: "rgba(255,255,255,0.7)" }}>→</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Bouaké</span>
        </div>
      </div>

      {/* Results count */}
      <div style={{ padding: "14px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B", fontWeight: 600 }}>
          {TRIPS.filter(t => t.seatsLeft > 0).length} trajets trouvés
        </p>
        <div style={{
          fontSize: 11, fontWeight: 700, color: PRIMARY, background: "#EFF6FF",
          padding: "4px 10px", borderRadius: 20, border: "1px solid #BFDBFE",
        }}>Triés par prix ↑</div>
      </div>

      {/* Trip cards */}
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {TRIPS.map(trip => {
          const isFull   = trip.seatsLeft === 0;
          const isLow    = trip.seatsLeft > 0 && trip.seatsLeft <= 5;

          return (
            <div key={trip.id} style={{
              background: "white", borderRadius: 18,
              boxShadow: isFull
                ? "0 1px 4px rgba(0,0,0,0.05)"
                : "0 2px 14px rgba(26,86,219,0.07), 0 1px 4px rgba(0,0,0,0.05)",
              overflow: "hidden",
              opacity: isFull ? 0.6 : 1,
              border: `1.5px solid ${isFull ? "#F1F5F9" : "transparent"}`,
            }}>
              {/* Card header */}
              <div style={{
                background: isFull ? "#F8FAFC" : trip.companyColor + "0D",
                padding: "12px 16px",
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
                  color: isFull ? "#DC2626" : isLow ? "#D97706" : "#059669",
                }}>
                  {isFull ? "Complet" : `${trip.seatsLeft} places`}
                </div>
              </div>

              {/* Times row */}
              <div style={{ padding: "14px 16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {/* Departure */}
                  <div>
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: -0.5 }}>
                      {trip.departureTime}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                      {trip.from}
                    </p>
                  </div>

                  {/* Duration line */}
                  <div style={{ flex: 1, textAlign: "center", padding: "0 12px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>
                      {trip.duration}
                    </p>
                    <div style={{ position: "relative", height: 2, background: "#E2E8F0" }}>
                      <div style={{
                        position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)",
                        width: 10, height: 10, borderRadius: "50%",
                        background: isFull ? "#CBD5E1" : PRIMARY,
                      }} />
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 10, color: "#CBD5E1" }}>🚌 Direct</p>
                  </div>

                  {/* Arrival */}
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: -0.5 }}>
                      {trip.arrivalTime}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                      {trip.to}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer: amenities + price + button */}
              <div style={{
                padding: "12px 16px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {trip.amenities.map((a, i) => (
                    <span key={i} style={{ fontSize: 14 }}>{a}</span>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: isFull ? "#94A3B8" : SUCCESS }}>
                      {trip.price.toLocaleString("fr-FR")} <span style={{ fontSize: 11, fontWeight: 600 }}>FCFA</span>
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: "#94A3B8" }}>par personne</p>
                  </div>

                  <button
                    disabled={isFull}
                    onClick={() => !isFull && handleChoose(trip)}
                    style={{
                      padding: "10px 14px", borderRadius: 12, border: "none",
                      background: isFull
                        ? "#E2E8F0"
                        : `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
                      color: isFull ? "#94A3B8" : "white",
                      fontSize: 12, fontWeight: 800, cursor: isFull ? "default" : "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: isFull ? "none" : "0 3px 12px rgba(26,86,219,0.30)",
                    }}>
                    {isFull ? "Complet" : "Choisir"}
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
