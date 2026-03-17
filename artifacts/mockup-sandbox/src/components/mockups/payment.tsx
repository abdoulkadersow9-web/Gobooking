import { useState, useMemo } from "react";

const PRIMARY = "#1A56DB";
const SUCCESS = "#059669";
const DANGER  = "#DC2626";

type PayMethod = "orange" | "mtn" | "wave" | "card" | null;
type Screen    = "payment" | "processing" | "success" | "error";

/* ── Demo trip data (would come from previous screen in real app) ── */
const TRIP = {
  company:        "UTB Express",
  companyInitial: "U",
  companyColor:   "#1A56DB",
  busType:        "Climatisé",
  from:           "Abidjan",
  to:             "Bouaké",
  departureTime:  "06:00",
  arrivalTime:    "10:30",
  duration:       "4h30",
  date:           "Jeu. 20 mars 2026",
  seats:          [5, 6],
  pricePerSeat:   3500,
};
const TOTAL = TRIP.pricePerSeat * TRIP.seats.length;

/* ── Payment methods config ── */
const PAY_METHODS = [
  {
    id:        "orange" as PayMethod,
    label:     "Orange Money",
    subtitle:  "Paiement via votre compte Orange",
    icon:      "🟠",
    activeBg:  "#FF6B00",
    bg:        "#FFF7ED",
    border:    "#FED7AA",
  },
  {
    id:        "mtn" as PayMethod,
    label:     "MTN Money",
    subtitle:  "Paiement via votre compte MTN",
    icon:      "🟡",
    activeBg:  "#EAB308",
    bg:        "#FEFCE8",
    border:    "#FDE68A",
  },
  {
    id:        "wave" as PayMethod,
    label:     "Wave",
    subtitle:  "Paiement rapide via Wave",
    icon:      "🌊",
    activeBg:  "#0EA5E9",
    bg:        "#EFF6FF",
    border:    "#BFDBFE",
  },
  {
    id:        "card" as PayMethod,
    label:     "Carte bancaire",
    subtitle:  "Visa, Mastercard, carte locale",
    icon:      "💳",
    activeBg:  "#059669",
    bg:        "#F0FDF4",
    border:    "#BBF7D0",
  },
];

/* ── Error messages per method (realistic for Côte d'Ivoire) ── */
const ERROR_MSGS: Record<string, string> = {
  orange: "Solde Orange Money insuffisant. Veuillez recharger votre compte et réessayer.",
  mtn:    "La transaction MTN Money a été refusée. Vérifiez votre PIN ou contactez le service client.",
  wave:   "Échec de connexion au service Wave. Veuillez réessayer dans quelques instants.",
  card:   "Votre carte a été refusée. Vérifiez les informations saisies ou contactez votre banque.",
};

/* ── Card form ── */
function CardForm() {
  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      {[
        { label: "Numéro de carte", placeholder: "0000  0000  0000  0000", col: 1 },
      ].map(f => (
        <div key={f.label}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
            {f.label}
          </label>
          <input placeholder={f.placeholder} style={{
            width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E2E8F0",
            fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            letterSpacing: 1.5, color: "#0F172A",
          }} />
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Expiration", placeholder: "MM / AA" },
          { label: "CVV",        placeholder: "•••" },
        ].map(f => (
          <div key={f.label}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {f.label}
            </label>
            <input placeholder={f.placeholder} style={{
              width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E2E8F0",
              fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#0F172A",
            }} />
          </div>
        ))}
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Nom sur la carte
        </label>
        <input placeholder="KOUASSI JEAN" style={{
          width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E2E8F0",
          fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
          color: "#0F172A", textTransform: "uppercase",
        }} />
      </div>
    </div>
  );
}

/* ── QR Code placeholder ── */
function QRCode({ value }: { value: string }) {
  const size = 80;
  const cells = 7;
  const cell = size / cells;
  const seed = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const grid = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if ((r < 2 && c < 2) || (r < 2 && c >= cells - 2) || (r >= cells - 2 && c < 2)) return true;
      return ((seed * (r + 1) * (c + 3) + r * c) % 3) === 0;
    })
  );
  return (
    <div style={{
      width: size + 12, height: size + 12, background: "white",
      borderRadius: 8, padding: 6, display: "inline-block",
      boxShadow: "0 1px 6px rgba(0,0,0,0.10)",
    }}>
      {grid.map((row, r) => (
        <div key={r} style={{ display: "flex" }}>
          {row.map((filled, c) => (
            <div key={c} style={{
              width: cell, height: cell,
              background: filled ? "#0F172A" : "white",
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Booking reference generator ── */
function makeRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "GBK-" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/* ════════════════════════════════════════════════════════════════════ */
export default function Payment() {
  const [screen,      setScreen]      = useState<Screen>("payment");
  const [method,      setMethod]      = useState<PayMethod>(null);
  const [submitted,   setSubmitted]   = useState(false);
  const [simulateFail,setSimulateFail]= useState(false);
  const [bookingRef]                  = useState(() => makeRef());

  const pm = PAY_METHODS.find(p => p.id === method);

  const handlePay = () => {
    setSubmitted(true);
    if (!method) return;
    setScreen("processing");
    setTimeout(() => setScreen(simulateFail ? "error" : "success"), 2400);
  };

  /* ── Processing ── */
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
        }}>⏳</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: "#0F172A" }}>
          Traitement en cours…
        </h2>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>
          Votre paiement est en cours de traitement.<br />
          Merci de patienter quelques instants.
        </p>
        {pm && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "white", borderRadius: 12, padding: "8px 16px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.07)", marginTop: 10,
          }}>
            <span style={{ fontSize: 18 }}>{pm.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{pm.label}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 28 }}>
          {[PRIMARY, "#CBD5E1", "#CBD5E1"].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error screen ── */
  if (screen === "error") {
    const errMsg = method ? ERROR_MSGS[method] : "Une erreur inattendue s'est produite.";
    return (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${DANGER} 0%, #b91c1c 100%)`,
          padding: "60px 24px 32px", textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}>❌</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "white" }}>
            Paiement échoué
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
            Votre réservation n'a pas été confirmée
          </p>
        </div>

        <div style={{ padding: "20px 16px 24px" }}>
          {/* Error card */}
          <div style={{
            background: "white", borderRadius: 16, padding: 18,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14,
            border: `1px solid #FEE2E2`,
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: "#FEE2E2", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>⚠️</div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: DANGER }}>Erreur de paiement</p>
                <p style={{ margin: 0, fontSize: 13, color: "#64748B", lineHeight: 1.55 }}>{errMsg}</p>
              </div>
            </div>

            <div style={{
              background: "#FFF5F5", borderRadius: 10, padding: "10px 14px",
              border: "1px solid #FECACA",
            }}>
              <p style={{ margin: 0, fontSize: 12, color: "#7F1D1D", lineHeight: 1.55 }}>
                💡 <strong>Aucun montant n'a été débité.</strong> Votre réservation n'a pas été confirmée. Vous pouvez réessayer avec un autre moyen de paiement.
              </p>
            </div>
          </div>

          {/* Trip recap (still visible) */}
          <div style={{
            background: "white", borderRadius: 14, padding: "12px 16px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)", marginBottom: 20,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                {TRIP.from} → {TRIP.to}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>
                {TRIP.date} · Sièges {TRIP.seats.join(", ")}
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#94A3B8" }}>
              {TOTAL.toLocaleString("fr-FR")} FCFA
            </p>
          </div>

          <button
            onClick={() => { setScreen("payment"); setSubmitted(false); setMethod(null); }}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
              background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
              color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(26,86,219,0.30)", marginBottom: 10,
            }}>
            🔄 Réessayer avec un autre moyen
          </button>

          <button onClick={() => {}} style={{
            width: "100%", padding: "14px 0", borderRadius: 16,
            border: "1.5px solid #CBD5E1", background: "white",
            color: "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>← Annuler la réservation</button>
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
          padding: "60px 20px 28px", textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}>✅</div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "white" }}>
            Réservation confirmée !
          </h2>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
            Paiement accepté — Billet généré avec succès
          </p>
          <div style={{
            display: "inline-block", background: "rgba(255,255,255,0.20)",
            borderRadius: 10, padding: "6px 16px",
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "white", letterSpacing: 1.5 }}>
              {bookingRef}
            </span>
          </div>
        </div>

        <div style={{ padding: "20px 16px 24px" }}>
          {/* ─── TICKET ─── */}
          <div style={{
            background: "white", borderRadius: 20, overflow: "hidden",
            boxShadow: "0 6px 28px rgba(0,0,0,0.10)", marginBottom: 14,
          }}>
            {/* Ticket header */}
            <div style={{
              background: TRIP.companyColor + "10",
              borderBottom: "2px dashed #E2E8F0",
              padding: "14px 18px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: TRIP.companyColor + "22",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, fontWeight: 800, color: TRIP.companyColor,
                }}>{TRIP.companyInitial}</div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{TRIP.company}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>{TRIP.busType}</p>
                </div>
              </div>
              <div style={{
                background: "#DCFCE7", color: SUCCESS,
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
              }}>✓ Confirmé</div>
            </div>

            {/* Route + times */}
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{TRIP.departureTime}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: "#64748B" }}>{TRIP.from}</p>
                </div>
                <div style={{ textAlign: "center", flex: 1, padding: "0 10px" }}>
                  <p style={{ margin: "0 0 5px", fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{TRIP.duration}</p>
                  <div style={{ height: 2, background: "#E2E8F0", position: "relative" }}>
                    <div style={{
                      position: "absolute", top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 8, height: 8, borderRadius: "50%", background: SUCCESS,
                    }} />
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 10, color: "#CBD5E1" }}>🚌 Direct</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{TRIP.arrivalTime}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: "#64748B" }}>{TRIP.to}</p>
                </div>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>📅 {TRIP.date}</p>
            </div>

            {/* Seats + QR */}
            <div style={{
              padding: "14px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
                  Sièges réservés
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {TRIP.seats.map(s => (
                    <div key={s} style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: SUCCESS, color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 900,
                    }}>{s}</div>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
                  Montant payé
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 900, color: SUCCESS }}>
                  {TOTAL.toLocaleString("fr-FR")} FCFA
                </p>
              </div>

              {/* QR code */}
              <div style={{ textAlign: "center" }}>
                <QRCode value={bookingRef} />
                <p style={{ margin: "6px 0 0", fontSize: 10, color: "#94A3B8", letterSpacing: 0.5, fontWeight: 600 }}>
                  {bookingRef}
                </p>
              </div>
            </div>

            {/* Payment method used */}
            <div style={{
              background: "#F8FAFC", borderTop: "1px solid #F1F5F9",
              padding: "10px 18px", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>{pm?.icon ?? "💳"}</span>
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                Payé via {pm?.label ?? "carte bancaire"}
              </span>
            </div>
          </div>

          {/* Notification info */}
          <div style={{ background: "#EFF6FF", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid #BFDBFE" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#1E40AF", lineHeight: 1.65 }}>
              📱 Billet envoyé au <strong>+225 07 XX XX XX XX</strong><br />
              📧 Confirmation envoyée à <strong>k.jean@email.com</strong>
            </p>
          </div>

          <button onClick={() => setScreen("payment")} style={{
            width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
            background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
            color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(26,86,219,0.25)",
          }}>🏠 Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  /* ════════ PAYMENT FORM ════════ */
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

        {/* ── Demo toggle (simulate failure) ── */}
        <div style={{
          background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12,
          padding: "10px 14px", marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>
            🧪 Mode démo : simuler un échec
          </span>
          <button
            onClick={() => setSimulateFail(p => !p)}
            style={{
              padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 800,
              background: simulateFail ? DANGER : "#E2E8F0",
              color: simulateFail ? "white" : "#64748B",
              transition: "all 0.15s",
            }}>
            {simulateFail ? "Échec activé" : "Désactivé"}
          </button>
        </div>

        {/* ── Trip summary ── */}
        <p style={{ margin: "0 0 8px 2px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Résumé de la réservation
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
              width: 36, height: 36, borderRadius: 10, background: TRIP.companyColor + "22",
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

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#F8FAFF", borderRadius: 12, padding: "10px 14px",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Sièges</p>
                <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                  {TRIP.seats.map(s => (
                    <span key={s} style={{
                      width: 30, height: 30, borderRadius: 8, background: PRIMARY,
                      color: "white", fontSize: 12, fontWeight: 800,
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
            <p style={{ margin: 0, fontSize: 12, color: DANGER, fontWeight: 600 }}>
              ⚠ Veuillez sélectionner un moyen de paiement
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {PAY_METHODS.map(p => {
            const isSelected = method === p.id;
            return (
              <div key={p.id} onClick={() => setMethod(p.id)} style={{
                background: isSelected ? p.activeBg + "0F" : "white",
                borderRadius: 14, padding: "13px 16px",
                border: `2px solid ${isSelected ? p.activeBg : "#E2E8F0"}`,
                cursor: "pointer", transition: "all 0.15s",
                boxShadow: isSelected ? `0 2px 12px ${p.activeBg}22` : "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: isSelected ? p.activeBg + "22" : p.bg,
                    border: `1.5px solid ${isSelected ? p.activeBg + "44" : p.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
                  }}>{p.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: isSelected ? p.activeBg : "#0F172A" }}>{p.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>{p.subtitle}</p>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: `2px solid ${isSelected ? p.activeBg : "#CBD5E1"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {isSelected && <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.activeBg }} />}
                  </div>
                </div>

                {isSelected && p.id === "card" && <CardForm />}
                {isSelected && p.id !== "card" && (
                  <div style={{
                    marginTop: 12, padding: "10px 12px", borderRadius: 10,
                    background: p.activeBg + "10", border: `1px solid ${p.activeBg}22`,
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: p.activeBg, fontWeight: 600, lineHeight: 1.5 }}>
                      📱 Vous recevrez une notification pour confirmer le paiement de <strong>{TOTAL.toLocaleString("fr-FR")} FCFA</strong>.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Total ── */}
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
        <button onClick={handlePay} style={{
          width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
          background: `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`,
          color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: "0 4px 20px rgba(5,150,105,0.35)", marginBottom: 10,
        }}>
          <span style={{ fontSize: 18 }}>💳</span>
          Payer {TOTAL.toLocaleString("fr-FR")} FCFA
        </button>

        <button onClick={() => {}} style={{
          width: "100%", padding: "14px 0", borderRadius: 16,
          border: "1.5px solid #CBD5E1", background: "white",
          color: "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>← Retour</button>
      </div>
    </div>
  );
}
