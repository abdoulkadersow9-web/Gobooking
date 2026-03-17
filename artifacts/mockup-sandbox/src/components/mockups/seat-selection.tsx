import { useState } from "react";

/* ── Colors ── */
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

/* ── Trip data (passed from previous screen in real app) ── */
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
  pricePerSeat:   3_500,
  totalSeats:     40,
  occupied:       [1,2,4,7,9,11,13,14,17,20,21,23,26,28,31,33,35,36,38,39],
};

const MAX_SELECT = 8;
const COLS       = 4;
const ROWS       = Math.ceil(TRIP.totalSeats / COLS);

type Screen = "seats" | "confirm" | "payment" | "processing" | "success" | "error";
type PayMethod = "orange" | "mtn" | "wave" | "card" | null;

const PAY_METHODS = [
  { id: "orange" as PayMethod, label: "Orange Money", subtitle: "Via votre compte Orange",   icon: "🟠", color: "#FF6B00" },
  { id: "mtn"    as PayMethod, label: "MTN Money",    subtitle: "Via votre compte MTN",       icon: "🟡", color: "#EAB308" },
  { id: "wave"   as PayMethod, label: "Wave",         subtitle: "Paiement rapide via Wave",   icon: "🌊", color: "#0EA5E9" },
  { id: "card"   as PayMethod, label: "Carte bancaire", subtitle: "Visa, Mastercard, locale", icon: "💳", color: "#059669" },
];

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

/* ── Mini QR ── */
function QRCode({ value }: { value: string }) {
  const sz = 80, cells = 7, cell = sz / cells;
  const seed = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const grid = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if ((r < 2 && c < 2) || (r < 2 && c >= cells - 2) || (r >= cells - 2 && c < 2)) return true;
      return ((seed * (r + 1) * (c + 3) + r * c) % 3) === 0;
    })
  );
  return (
    <div style={{ width: sz + 12, height: sz + 12, background: "white", borderRadius: 8, padding: 6, boxShadow: "0 1px 6px rgba(0,0,0,0.10)" }}>
      {grid.map((row, r) => (
        <div key={r} style={{ display: "flex" }}>
          {row.map((filled, c) => (
            <div key={c} style={{ width: cell, height: cell, background: filled ? "#0F172A" : "white" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Legend dot ── */
function LegendDot({ bg, border, label }: { bg: string; border?: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, background: bg, border: `1.5px solid ${border ?? bg}` }} />
      <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

/* ── Individual seat ── */
function Seat({ n, onToggle, selected, occupied }: { n: number; onToggle: (n: number) => void; selected: number[]; occupied: number[] }) {
  const isOccupied = occupied.includes(n);
  const isSelected = selected.includes(n);
  let bg = AVAIL_BG, color = AVAIL_TEXT, border = AVAIL_BG, cursor = "pointer";
  if (isOccupied) { bg = TAKEN_BG; color = TAKEN_TEXT; border = TAKEN_BG; cursor = "default"; }
  if (isSelected) { bg = SEL_BG;   color = SEL_TEXT;   border = SEL_BORDER; }
  return (
    <div onClick={() => onToggle(n)} title={isOccupied ? "Déjà réservé" : `Siège ${n}`} style={{
      width: 46, height: 48, borderRadius: 10,
      background: bg, color, border: `2px solid ${border}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      cursor, userSelect: "none", transition: "all 0.12s",
      boxShadow: isSelected ? `0 2px 8px ${SEL_BORDER}44` : "none",
    }}>
      <div style={{ width: 28, height: 6, borderRadius: "4px 4px 0 0", background: isOccupied ? "#FCA5A5" : isSelected ? "#FDE047" : "#86EFAC", marginBottom: 2 }} />
      <span style={{ fontSize: 11, fontWeight: 800 }}>{n}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function SeatSelection() {
  const [screen,       setScreen]       = useState<Screen>("seats");
  const [selected,     setSelected]     = useState<number[]>([]);
  const [method,       setMethod]       = useState<PayMethod>(null);
  const [paySubmitted, setPaySubmitted] = useState(false);
  const [simulateFail, setSimulateFail] = useState(false);
  const [bookingRef]                    = useState(() => makeRef());

  const total = TRIP.pricePerSeat * selected.length;
  const pm    = PAY_METHODS.find(p => p.id === method);
  const availableCount = TRIP.totalSeats - TRIP.occupied.length;

  const toggle = (n: number) => {
    if (TRIP.occupied.includes(n)) return;
    setSelected(prev =>
      prev.includes(n) ? prev.filter(s => s !== n)
      : prev.length < MAX_SELECT ? [...prev, n]
      : prev,
    );
  };

  const handlePay = () => {
    setPaySubmitted(true);
    if (!method) return;
    setScreen("processing");
    setTimeout(() => setScreen(simulateFail ? "error" : "success"), 2400);
  };

  /* ══ PROCESSING ══ */
  if (screen === "processing") return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 24, boxShadow: "0 4px 20px rgba(26,86,219,0.15)" }}>⏳</div>
      <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#0F172A" }}>Traitement en cours…</h2>
      <p style={{ margin: "0 0 10px", fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>Votre paiement est en cours.<br/>Merci de patienter.</p>
      {pm && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", borderRadius: 12, padding: "8px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <span style={{ fontSize: 18 }}>{pm.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{pm.label}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 28 }}>
        {[PRIMARY, "#CBD5E1", "#CBD5E1"].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
      </div>
    </div>
  );

  /* ══ ERROR ══ */
  if (screen === "error") return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(135deg,${DANGER} 0%,#b91c1c 100%)`, padding: "60px 24px 32px", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.2)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>❌</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "white" }}>Paiement échoué</h2>
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>Votre réservation n'a pas été confirmée</p>
      </div>
      <div style={{ padding: "20px 16px 24px" }}>
        <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14, border: "1px solid #FEE2E2" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FEE2E2", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚠️</div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: DANGER }}>Erreur de paiement</p>
              <p style={{ margin: 0, fontSize: 13, color: "#64748B", lineHeight: 1.55 }}>{method ? ERROR_MSGS[method] : "Erreur inattendue."}</p>
            </div>
          </div>
          <div style={{ background: "#FFF5F5", borderRadius: 10, padding: "10px 14px", border: "1px solid #FECACA" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#7F1D1D", lineHeight: 1.55 }}>
              💡 <strong>Aucun montant n'a été débité.</strong> Réessayez avec un autre moyen de paiement.
            </p>
          </div>
        </div>
        {/* Recap */}
        <div style={{ background: "white", borderRadius: 14, padding: "12px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{TRIP.from} → {TRIP.to}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>Sièges {selected.sort((a,b)=>a-b).join(", ")}</p>
          </div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#94A3B8" }}>{total.toLocaleString("fr-FR")} FCFA</p>
        </div>
        <button onClick={() => { setScreen("payment"); setPaySubmitted(false); setMethod(null); }} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: `linear-gradient(135deg,${PRIMARY} 0%,#1240a8 100%)`, color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(26,86,219,0.30)", marginBottom: 10 }}>
          🔄 Réessayer avec un autre moyen
        </button>
        <button onClick={() => setScreen("seats")} style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "1.5px solid #CBD5E1", background: "white", color: "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Retour aux sièges</button>
      </div>
    </div>
  );

  /* ══ SUCCESS ══ */
  if (screen === "success") return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(135deg,${SUCCESS} 0%,#047857 100%)`, padding: "60px 20px 28px", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.2)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>✅</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "white" }}>Réservation confirmée !</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Paiement accepté — Billet généré</p>
        <div style={{ display: "inline-block", background: "rgba(255,255,255,0.20)", borderRadius: 10, padding: "6px 16px" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "white", letterSpacing: 1.5 }}>{bookingRef}</span>
        </div>
      </div>

      <div style={{ padding: "20px 16px 24px" }}>
        {/* Ticket */}
        <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 6px 28px rgba(0,0,0,0.10)", marginBottom: 14 }}>
          <div style={{ background: TRIP.companyColor + "10", borderBottom: "2px dashed #E2E8F0", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: TRIP.companyColor + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: TRIP.companyColor }}>{TRIP.companyInitial}</div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{TRIP.company}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>{TRIP.busType}</p>
              </div>
            </div>
            <div style={{ background: "#DCFCE7", color: SUCCESS, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>✓ Confirmé</div>
          </div>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{TRIP.departureTime}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: "#64748B" }}>{TRIP.from}</p>
              </div>
              <div style={{ textAlign: "center", flex: 1, padding: "0 10px" }}>
                <p style={{ margin: "0 0 5px", fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{TRIP.duration}</p>
                <div style={{ height: 2, background: "#E2E8F0" }} />
                <p style={{ margin: "5px 0 0", fontSize: 10, color: "#CBD5E1" }}>🚌 Direct</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{TRIP.arrivalTime}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: "#64748B" }}>{TRIP.to}</p>
              </div>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>📅 {TRIP.date}</p>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Sièges réservés</p>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", maxWidth: 140 }}>
                {selected.sort((a,b)=>a-b).map(s => (
                  <div key={s} style={{ width: 32, height: 32, borderRadius: 8, background: SUCCESS, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{s}</div>
                ))}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Montant payé</p>
              <p style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 900, color: SUCCESS }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <QRCode value={bookingRef} />
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "#94A3B8", letterSpacing: 0.5, fontWeight: 600 }}>{bookingRef}</p>
            </div>
          </div>
          <div style={{ background: "#F8FAFC", borderTop: "1px solid #F1F5F9", padding: "10px 18px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{pm?.icon ?? "💳"}</span>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Payé via {pm?.label ?? "carte bancaire"}</span>
          </div>
        </div>
        <div style={{ background: "#EFF6FF", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid #BFDBFE" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#1E40AF", lineHeight: 1.65 }}>
            📱 Billet envoyé au <strong>+225 07 XX XX XX XX</strong><br/>
            📧 Confirmation à <strong>k.jean@email.com</strong>
          </p>
        </div>
        <button onClick={() => { setScreen("seats"); setSelected([]); setMethod(null); setPaySubmitted(false); }} style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: `linear-gradient(135deg,${PRIMARY} 0%,#1240a8 100%)`, color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(26,86,219,0.25)" }}>
          🏠 Retour à l'accueil
        </button>
      </div>
    </div>
  );

  /* ══ PAYMENT ══ */
  if (screen === "payment") return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(135deg,${PRIMARY} 0%,#1240a8 100%)`, padding: "52px 20px 24px", position: "relative" }}>
        <button onClick={() => setScreen("confirm")} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white" }}>Paiement</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)" }}>Finalisez votre réservation en toute sécurité</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 16px" }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Paiement sécurisé SSL 256 bits</span>
        </div>
      </div>

      <div style={{ padding: "16px 16px 24px", flex: 1, overflowY: "auto" }}>
        {/* Demo toggle */}
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>🧪 Mode démo : simuler un échec</span>
          <button onClick={() => setSimulateFail(p => !p)} style={{ padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800, background: simulateFail ? DANGER : "#E2E8F0", color: simulateFail ? "white" : "#64748B", transition: "all 0.15s" }}>
            {simulateFail ? "Échec activé" : "Désactivé"}
          </button>
        </div>

        {/* Trip recap */}
        <p style={{ margin: "0 0 8px 2px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Résumé de la réservation</p>
        <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <div style={{ background: TRIP.companyColor + "0D", padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: TRIP.companyColor + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: TRIP.companyColor }}>{TRIP.companyInitial}</div>
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
            {/* Selected seats + total — DYNAMIC from user's choice */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFF", borderRadius: 12, padding: "10px 14px" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Sièges choisis</p>
                <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                  {selected.sort((a,b)=>a-b).map(s => (
                    <span key={s} style={{ width: 30, height: 30, borderRadius: 8, background: PRIMARY, color: "white", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{s}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>{selected.length} × {TRIP.pricePerSeat.toLocaleString("fr-FR")} FCFA</p>
                <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900, color: SUCCESS }}>{total.toLocaleString("fr-FR")} FCFA</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <p style={{ margin: "0 0 8px 2px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Moyen de paiement</p>
        {paySubmitted && !method && (
          <div style={{ marginBottom: 10, padding: "9px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <p style={{ margin: 0, fontSize: 12, color: DANGER, fontWeight: 600 }}>⚠ Veuillez sélectionner un moyen de paiement</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {PAY_METHODS.map(p => {
            const isSel = method === p.id;
            return (
              <div key={p.id} onClick={() => setMethod(p.id)} style={{ background: isSel ? p.color + "10" : "white", borderRadius: 14, padding: "13px 16px", border: `2px solid ${isSel ? p.color : "#E2E8F0"}`, cursor: "pointer", transition: "all 0.15s", boxShadow: isSel ? `0 2px 12px ${p.color}22` : "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: isSel ? p.color + "22" : "#F8FAFC", border: `1.5px solid ${isSel ? p.color + "44" : "#E2E8F0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{p.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: isSel ? p.color : "#0F172A" }}>{p.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>{p.subtitle}</p>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isSel ? p.color : "#CBD5E1"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSel && <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />}
                  </div>
                </div>
                {isSel && p.id !== "card" && (
                  <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 10, background: p.color + "10", border: `1px solid ${p.color}22` }}>
                    <p style={{ margin: 0, fontSize: 12, color: p.color, fontWeight: 600, lineHeight: 1.5 }}>
                      📱 Notification pour confirmer <strong>{total.toLocaleString("fr-FR")} FCFA</strong>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div style={{ background: "white", borderRadius: 14, padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>{selected.length} siège{selected.length > 1 ? "s" : ""} · {TRIP.from} → {TRIP.to}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>Toutes taxes comprises</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Total</p>
            <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: SUCCESS }}>{total.toLocaleString("fr-FR")} <span style={{ fontSize: 12, fontWeight: 700 }}>FCFA</span></p>
          </div>
        </div>

        <button onClick={handlePay} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: `linear-gradient(135deg,${SUCCESS} 0%,#047857 100%)`, color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 20px rgba(5,150,105,0.35)", marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>💳</span> Payer {total.toLocaleString("fr-FR")} FCFA
        </button>
        <button onClick={() => setScreen("confirm")} style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "1.5px solid #CBD5E1", background: "white", color: "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Retour</button>
      </div>
    </div>
  );

  /* ══ CONFIRM (between seats and payment) ══ */
  if (screen === "confirm") return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(135deg,${SUCCESS} 0%,#047857 100%)`, padding: "52px 20px 24px", position: "relative", textAlign: "center" }}>
        <button onClick={() => setScreen("seats")} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🪑</div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white" }}>Sièges confirmés</h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{selected.length} siège{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</p>
      </div>
      <div style={{ padding: "20px 16px 24px" }}>
        <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: TRIP.companyColor + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: TRIP.companyColor }}>{TRIP.companyInitial}</div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{TRIP.company}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>{TRIP.from} → {TRIP.to} · {TRIP.departureTime} · {TRIP.date}</p>
            </div>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>Sièges sélectionnés</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {selected.sort((a,b)=>a-b).map(s => (
              <div key={s} style={{ width: 42, height: 42, borderRadius: 10, background: SEL_BG, border: `2px solid ${SEL_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: SEL_TEXT }}>{s}</div>
            ))}
          </div>
          <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 14, display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Passagers</p>
              <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{selected.length} personne{selected.length > 1 ? "s" : ""}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>Prix total</p>
              <p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 900, color: SUCCESS }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
          </div>
        </div>
        {/* Key CTA: goes to payment WITH the selected seats */}
        <button onClick={() => setScreen("payment")} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: `linear-gradient(135deg,${PRIMARY} 0%,#1240a8 100%)`, color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(26,86,219,0.30)", marginBottom: 10 }}>
          💳 Continuer vers le paiement
        </button>
        <button onClick={() => setScreen("seats")} style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "1.5px solid #CBD5E1", background: "white", color: "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Modifier les sièges</button>
      </div>
    </div>
  );

  /* ══ SEAT GRID ══ */
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${PRIMARY} 0%,#1240a8 100%)`, padding: "52px 20px 22px", position: "relative" }}>
        <button onClick={() => {}} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "white", textAlign: "center" }}>Choisir mon siège</h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>{TRIP.from} → {TRIP.to} · {TRIP.departureTime} · {TRIP.date}</p>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "9px 20px" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "white" }}>{TRIP.companyInitial}</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{TRIP.company}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>· {TRIP.busType}</span>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: "white", borderBottom: "1px solid #F1F5F9", padding: "12px 20px", display: "flex", justifyContent: "space-around" }}>
        {[
          { emoji: "🟩", val: TRIP.totalSeats - TRIP.occupied.length, label: "Disponibles" },
          { emoji: "🟥", val: TRIP.occupied.length,                   label: "Réservés" },
          { emoji: "🟨", val: selected.length,                        label: "Sélectionnés" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
              <span style={{ fontSize: 14, marginRight: 3 }}>{s.emoji}</span>{s.val}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: "14px 16px 130px", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", padding: "0 2px" }}>
          <LegendDot bg={AVAIL_BG}  label="Disponible" />
          <LegendDot bg={TAKEN_BG}  label="Réservé" />
          <LegendDot bg={SEL_BG} border={SEL_BORDER} label="Mon choix" />
        </div>

        <div style={{ background: "white", borderRadius: 20, padding: "18px 12px 14px", boxShadow: "0 3px 16px rgba(26,86,219,0.08), 0 1px 4px rgba(0,0,0,0.05)" }}>
          {/* Front */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: "2px dashed #E2E8F0" }}>
            <div style={{ background: "#F1F5F9", borderRadius: 10, padding: "7px 18px", fontSize: 20 }}>🚌</div>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Avant du bus</span>
          </div>
          {/* Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: ROWS }, (_, row) => {
              const base = row * COLS + 1;
              const seats = [base, base+1, base+2, base+3].filter(n => n <= TRIP.totalSeats);
              return (
                <div key={row} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <span style={{ width: 22, fontSize: 10, color: "#CBD5E1", fontWeight: 700, textAlign: "right", marginRight: 8, flexShrink: 0 }}>{row + 1}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {seats.slice(0,2).map(n => <Seat key={n} n={n} onToggle={toggle} selected={selected} occupied={TRIP.occupied} />)}
                  </div>
                  <div style={{ width: 20, flexShrink: 0 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    {seats.slice(2,4).map(n => <Seat key={n} n={n} onToggle={toggle} selected={selected} occupied={TRIP.occupied} />)}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Back */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "2px dashed #E2E8F0", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Arrière du bus</span>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid #E2E8F0", padding: "14px 16px 24px", boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
        {selected.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {selected.sort((a,b)=>a-b).map(s => (
              <div key={s} onClick={() => toggle(s)} style={{ padding: "4px 10px", borderRadius: 20, background: SEL_BG, border: `1.5px solid ${SEL_BORDER}`, fontSize: 12, fontWeight: 800, color: SEL_TEXT, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                Siège {s} <span style={{ fontSize: 10, color: SEL_BORDER }}>✕</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
              {selected.length === 0 ? "Aucun siège sélectionné" : `${selected.length} siège${selected.length > 1 ? "s" : ""} · ${TRIP.pricePerSeat.toLocaleString("fr-FR")} FCFA / siège`}
            </p>
            {selected.length > 0 && <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 900, color: SUCCESS }}>{total.toLocaleString("fr-FR")} FCFA</p>}
          </div>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", color: "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Tout effacer</button>
          )}
        </div>
        <button
          disabled={selected.length === 0}
          onClick={() => selected.length > 0 && setScreen("confirm")}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: selected.length > 0 ? `linear-gradient(135deg,${PRIMARY} 0%,#1240a8 100%)` : "#E2E8F0", color: selected.length > 0 ? "white" : "#94A3B8", fontSize: 15, fontWeight: 800, cursor: selected.length > 0 ? "pointer" : "default", boxShadow: selected.length > 0 ? "0 4px 20px rgba(26,86,219,0.30)" : "none", transition: "all 0.2s" }}>
          {selected.length === 0 ? "Sélectionnez un siège pour continuer" : `Continuer → ${selected.length} siège${selected.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
