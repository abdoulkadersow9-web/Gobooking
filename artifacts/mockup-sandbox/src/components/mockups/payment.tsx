import { useState } from "react";

const PRIMARY = "#1A56DB";
const SUCCESS = "#059669";

type PayMethod = "orange" | "mtn" | "wave" | "card" | null;
type Screen    = "payment" | "processing" | "success";

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
  seats:         [5, 6],
  pricePerSeat:  3500,
};

const TOTAL = TRIP.pricePerSeat * TRIP.seats.length;

const PAY_METHODS = [
  {
    id: "orange" as PayMethod,
    label: "Orange Money",
    subtitle: "Paiement via votre compte Orange",
    bg: "#FFF7ED",
    border: "#FED7AA",
    activeBg: "#FF6B00",
    icon: "🟠",
    color: "#EA580C",
  },
  {
    id: "mtn" as PayMethod,
    label: "MTN Money",
    subtitle: "Paiement via votre compte MTN",
    bg: "#FEFCE8",
    border: "#FDE68A",
    activeBg: "#EAB308",
    icon: "🟡",
    color: "#CA8A04",
  },
  {
    id: "wave" as PayMethod,
    label: "Wave",
    subtitle: "Paiement rapide via Wave",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    activeBg: "#0EA5E9",
    icon: "🌊",
    color: "#0284C7",
  },
  {
    id: "card" as PayMethod,
    label: "Carte bancaire",
    subtitle: "Visa, Mastercard, carte locale",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    activeBg: "#059669",
    icon: "💳",
    color: "#059669",
  },
];

/* ─── Card form (shown when card is selected) ───────────────────────── */
function CardForm() {
  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Numéro de carte
        </label>
        <input
          placeholder="0000 0000 0000 0000"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E2E8F0",
            fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            letterSpacing: 1.5, color: "#0F172A",
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Expiration
          </label>
          <input
            placeholder="MM / AA"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E2E8F0",
              fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              color: "#0F172A",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
            CVV
          </label>
          <input
            placeholder="•••"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E2E8F0",
              fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              color: "#0F172A", letterSpacing: 3,
            }}
          />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Nom sur la carte
        </label>
        <input
          placeholder="KOUASSI JEAN"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E2E8F0",
            fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            color: "#0F172A", textTransform: "uppercase",
          }}
        />
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function Payment() {
  const [screen,    setScreen]    = useState<Screen>("payment");
  const [method,    setMethod]    = useState<PayMethod>(null);
  const [submitted, setSubmitted] = useState(false);

  const handlePay = () => {
    setSubmitted(true);
    if (!method) return;
    setScreen("processing");
    setTimeout(() => setScreen("success"), 2200);
  };

  /* ── Processing screen ── */
  if (screen === "processing") {
    return (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#F1F5F9", minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "40px 24px", textAlign: "center",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, marginBottom: 24,
          boxShadow: "0 4px 20px rgba(26,86,219,0.15)",
          animation: "pulse 1.2s infinite",
        }}>⏳</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: "#0F172A" }}>
          Traitement en cours…
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>
          Votre paiement est en cours de traitement.<br />
          Merci de patienter quelques instants.
        </p>
        <div style={{ marginTop: 32, display: "flex", gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: "50%",
              background: i === 0 ? PRIMARY : "#CBD5E1",
            }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Success screen ── */
  if (screen === "success") {
    return (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`,
          padding: "60px 24px 32px", textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}>✅</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "white" }}>
            Paiement réussi !
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
            Votre billet a été envoyé par SMS et email
          </p>
        </div>

        <div style={{ padding: "20px 16px 24px" }}>
          {/* Ticket stub */}
          <div style={{
            background: "white", borderRadius: 20,
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)", overflow: "hidden", marginBottom: 14,
          }}>
            <div style={{ background: SUCCESS + "12", padding: "16px 18px", borderBottom: "1px dashed #D1FAE5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: SUCCESS + "22",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 800, color: SUCCESS,
                }}>{TRIP.companyInitial}</div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{TRIP.company}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>{TRIP.busType} · {TRIP.date}</p>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div style={{
                    background: "#DCFCE7", color: SUCCESS,
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                  }}>Confirmé ✓</div>
                </div>
              </div>
            </div>

            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{TRIP.departureTime}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B", fontWeight: 600 }}>{TRIP.from}</p>
                </div>
                <div style={{ textAlign: "center", paddingTop: 4 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94A3B8" }}>{TRIP.duration}</p>
                  <div style={{ width: 80, height: 2, background: "#E2E8F0" }} />
                  <p style={{ margin: "4px 0 0", fontSize: 10, color: "#CBD5E1" }}>🚌 Direct</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{TRIP.arrivalTime}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B", fontWeight: 600 }}>{TRIP.to}</p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", background: "#F8FAFC", borderRadius: 12, padding: "12px 14px" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Sièges</p>
                  <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                    {TRIP.seats.map(s => (
                      <span key={s} style={{
                        width: 28, height: 28, borderRadius: 7, background: SUCCESS,
                        color: "white", fontSize: 12, fontWeight: 800,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Montant payé</p>
                  <p style={{ margin: "5px 0 0", fontSize: 18, fontWeight: 900, color: SUCCESS }}>
                    {TOTAL.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: "#EFF6FF", borderRadius: 14, padding: 14, border: "1px solid #BFDBFE" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#1E40AF", lineHeight: 1.6 }}>
              📱 Votre billet a été envoyé au <strong>+225 07 XX XX XX XX</strong>.<br />
              📧 Un email de confirmation a été envoyé à <strong>k.jean@email.com</strong>.
            </p>
          </div>

          <button
            onClick={() => setScreen("payment")}
            style={{
              marginTop: 16, width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
              background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
              color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(26,86,219,0.25)",
            }}>
            🏠 Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  /* ── Payment screen ── */
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
        <button onClick={() => {}} style={{
          position: "absolute", top: 16, left: 16, width: 36, height: 36,
          borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)",
          color: "white", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white" }}>Paiement</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)" }}>
            Finalisez votre réservation en toute sécurité
          </p>
        </div>

        {/* Security badge */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          marginTop: 14, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 16px",
        }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
            Paiement sécurisé SSL 256 bits
          </span>
        </div>
      </div>

      <div style={{ padding: "16px 16px 24px", flex: 1, overflowY: "auto" }}>

        {/* ── Trip summary ── */}
        <p style={{ margin: "0 0 8px 2px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Résumé du trajet
        </p>
        <div style={{
          background: "white", borderRadius: 16, overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: 16,
        }}>
          <div style={{
            background: TRIP.companyColor + "0D", padding: "12px 16px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: TRIP.companyColor + "22",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: TRIP.companyColor,
            }}>{TRIP.companyInitial}</div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{TRIP.company}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>{TRIP.busType} · {TRIP.date}</p>
            </div>
          </div>

          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{TRIP.departureTime}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B", fontWeight: 600 }}>{TRIP.from}</p>
              </div>
              <div style={{ textAlign: "center", flex: 1, padding: "0 12px" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{TRIP.duration}</p>
                <div style={{ height: 2, background: "#E2E8F0" }} />
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "#CBD5E1" }}>🚌 Direct</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{TRIP.arrivalTime}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B", fontWeight: 600 }}>{TRIP.to}</p>
              </div>
            </div>

            {/* Seats + price row */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#F8FAFF", borderRadius: 12, padding: "10px 14px",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Sièges</p>
                <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                  {TRIP.seats.map(s => (
                    <span key={s} style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: PRIMARY, color: "white",
                      fontSize: 12, fontWeight: 800,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>{s}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {TRIP.seats.length} × {TRIP.pricePerSeat.toLocaleString("fr-FR")} FCFA
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900, color: SUCCESS }}>
                  {TOTAL.toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Payment methods ── */}
        <p style={{ margin: "0 0 8px 2px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Moyen de paiement
        </p>
        {submitted && !method && (
          <div style={{
            marginBottom: 10, padding: "9px 14px", borderRadius: 10,
            background: "#FEF2F2", border: "1px solid #FECACA",
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
              ⚠ Veuillez sélectionner un moyen de paiement
            </p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {PAY_METHODS.map(pm => {
            const isSelected = method === pm.id;
            return (
              <div
                key={pm.id}
                onClick={() => setMethod(pm.id)}
                style={{
                  background: isSelected ? pm.activeBg + "12" : "white",
                  borderRadius: 14, padding: "13px 16px",
                  border: `2px solid ${isSelected ? pm.activeBg : "#E2E8F0"}`,
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: isSelected ? `0 2px 12px ${pm.activeBg}22` : "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Icon circle */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: isSelected ? pm.activeBg + "22" : pm.bg,
                    border: `1.5px solid ${isSelected ? pm.activeBg + "44" : pm.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, flexShrink: 0,
                  }}>{pm.icon}</div>

                  <div style={{ flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 14, fontWeight: 800,
                      color: isSelected ? pm.activeBg : "#0F172A",
                    }}>{pm.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>{pm.subtitle}</p>
                  </div>

                  {/* Radio */}
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: `2px solid ${isSelected ? pm.activeBg : "#CBD5E1"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {isSelected && (
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%", background: pm.activeBg,
                      }} />
                    )}
                  </div>
                </div>

                {/* Card form — expanded when card is selected */}
                {isSelected && pm.id === "card" && <CardForm />}

                {/* Mobile money hint */}
                {isSelected && pm.id !== "card" && (
                  <div style={{
                    marginTop: 12, padding: "10px 12px", borderRadius: 10,
                    background: pm.activeBg + "10", border: `1px solid ${pm.activeBg}22`,
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: pm.activeBg, fontWeight: 600, lineHeight: 1.5 }}>
                      📱 Vous recevrez une notification sur votre téléphone pour confirmer le paiement de{" "}
                      <strong>{TOTAL.toLocaleString("fr-FR")} FCFA</strong>.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Total recap ── */}
        <div style={{
          background: "white", borderRadius: 14, padding: "14px 16px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
              {TRIP.seats.length} siège{TRIP.seats.length > 1 ? "s" : ""} · {TRIP.from} → {TRIP.to}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>Toutes taxes comprises</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Total</p>
            <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: SUCCESS }}>
              {TOTAL.toLocaleString("fr-FR")} <span style={{ fontSize: 12, fontWeight: 700 }}>FCFA</span>
            </p>
          </div>
        </div>

        {/* ── Buttons ── */}
        <button
          onClick={handlePay}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
            background: `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`,
            color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: "0 4px 20px rgba(5,150,105,0.35)",
            marginBottom: 10,
          }}>
          <span style={{ fontSize: 18 }}>💳</span>
          Payer {TOTAL.toLocaleString("fr-FR")} FCFA
        </button>

        <button
          onClick={() => {}}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 16, border: "1.5px solid #CBD5E1",
            background: "white", color: "#64748B", fontSize: 14, fontWeight: 700,
            cursor: "pointer",
          }}>
          ← Retour
        </button>
      </div>
    </div>
  );
}
