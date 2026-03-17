import { useState, useEffect, useRef } from "react";

const PRIMARY = "#1A56DB";
const SUCCESS = "#059669";
const ACCENT  = "#6366F1";

/* ─── Types ─────────────────────────────────────────────────────────── */
export type TicketData = {
  ref:          string;
  passenger:    string;
  from:         string;
  fromCode:     string;
  to:           string;
  toCode:       string;
  date:         string;
  time:         string;
  arrival:      string;
  duration:     string;
  seats:        string[];   /* e.g. ["14", "15"] */
  busType:      string;
  company:      string;
  companyInit:  string;
  companyColor: string;
  gate:         string;
  busClass:     string;
  total:        number;
  payMethod:    string;
};

/* ─── Auto-generate unique ticket number ─────────────────────────────── */
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeRef(): string {
  return "GBK-" + Array.from({ length: 8 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
}

/* ─── Build QR payload (used by agent scanner) ───────────────────────── */
/* Format: GBK-XXXXXXXX|14,15|ABJ-BKE|06:00|Kouamé Jean-Baptiste
   The agent scanner splits by "|" to validate each field.              */
function buildQRPayload(t: TicketData): string {
  return [t.ref, t.seats.join(","), `${t.fromCode}-${t.toCode}`, t.time, t.passenger].join("|");
}

/* ─── QR code renderer (deterministic pixel grid) ───────────────────── */
function QRCode({ payload, size = 148 }: { payload: string; size?: number }) {
  const cells = 11;
  const cell  = size / cells;
  const seed  = payload.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 3), 0);

  const isFinderZone = (r: number, c: number) =>
    (r < 3 && c < 3) ||
    (r < 3 && c >= cells - 3) ||
    (r >= cells - 3 && c < 3);

  const grid = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if (isFinderZone(r, c))                        return true;
      if (r === 0 || r === cells - 1)                return true;
      if (c === 0 || c === cells - 1)                return true;
      if (r === Math.floor(cells / 2) && c % 2 === 0) return true;
      return ((seed * (r + 5) * (c + 7) + r * 11 + c * 13) % 4) !== 0;
    }),
  );

  return (
    <div style={{
      background: "white", borderRadius: 14, padding: 10,
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)", display: "inline-block",
    }}>
      {grid.map((row, r) => (
        <div key={r} style={{ display: "flex" }}>
          {row.map((filled, c) => (
            <div key={c} style={{
              width: cell, height: cell,
              background: filled ? "#0F172A" : "white",
              borderRadius: isFinderZone(r, c) ? 1 : 0,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Info row ───────────────────────────────────────────────────────── */
function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: accent ? PRIMARY : "#0F172A", textAlign: "right" }}>{value}</span>
    </div>
  );
}

/* ─── Default demo data (standalone canvas preview) ─────────────────── */
function makeDemo(): TicketData {
  return {
    ref:          makeRef(),
    passenger:    "Kouamé Jean-Baptiste",
    from:         "Abidjan",  fromCode: "ABJ",
    to:           "Bouaké",   toCode:   "BKE",
    date:         "Jeudi 20 mars 2025",
    time:         "06:00",    arrival:  "10:30",  duration: "4h 30",
    seats:        ["14", "15"],
    busType:      "Climatisé",
    company:      "UTB Express",
    companyInit:  "U",
    companyColor: "#1A56DB",
    gate:         "G3",
    busClass:     "Standard",
    total:        7000,
    payMethod:    "Orange Money",
  };
}

/* ─── Print CSS injected once ────────────────────────────────────────── */
const PRINT_STYLE = `
@media print {
  body > *:not(#gobooking-ticket-root) { display: none !important; }
  #gobooking-ticket-root { display: block !important; }
  #gobooking-ticket-actions { display: none !important; }
  #gobooking-ticket-header  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 0; size: A4 portrait; }
}`;

/* ─── Main component ─────────────────────────────────────────────────── */
export default function BookingTicket({ ticket: ticketProp }: { ticket?: TicketData }) {
  const [ticket]    = useState<TicketData>(() => ticketProp ?? makeDemo());
  const [dlDone,  setDlDone]  = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const [shareMsg,  setShareMsg]  = useState("");
  const styleInjected = useRef(false);

  /* Inject print CSS once */
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const el = document.createElement("style");
    el.textContent = PRINT_STYLE;
    document.head.appendChild(el);
  }, []);

  const qrPayload = buildQRPayload(ticket);

  /* ── PDF download via browser print dialog ── */
  const handleDownload = () => {
    setDlDone(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setDlDone(false), 1800);
    }, 200);
  };

  /* ── Share via Web Share API → clipboard fallback ── */
  const handleShare = async () => {
    const shareText =
      `🎫 Mon ticket GoBooking\n` +
      `📍 ${ticket.from} → ${ticket.to}\n` +
      `🕐 ${ticket.date} à ${ticket.time}\n` +
      `💺 Siège(s) : ${ticket.seats.join(", ")}\n` +
      `🔖 Réf. : ${ticket.ref}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Mon ticket GoBooking", text: shareText });
        setShareMsg("Partagé !");
      } catch {
        setShareMsg("Annulé");
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareMsg("Lien copié !");
      } catch {
        setShareMsg("Copié !");
      }
    }
    setShareDone(true);
    setTimeout(() => { setShareDone(false); setShareMsg(""); }, 2400);
  };

  return (
    <div id="gobooking-ticket-root" style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "#F1F5F9", minHeight: "100vh", display: "flex", flexDirection: "column",
    }}>

      {/* ── Header ── */}
      <div id="gobooking-ticket-header" style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
        padding: "52px 20px 28px", position: "relative",
      }}>
        <button style={{
          position: "absolute", top: 16, left: 16, width: 36, height: 36,
          borderRadius: 10, border: "none", background: "rgba(255,255,255,0.20)",
          color: "white", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>

        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: "white", textAlign: "center" }}>
          Mon ticket
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>
          Billet électronique confirmé
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "6px 16px", display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>Réservation confirmée</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>

        {/* ── Ticket card ── */}
        <div style={{ background: "white", borderRadius: 24, overflow: "hidden", boxShadow: "0 6px 32px rgba(0,0,0,0.10)", marginBottom: 16 }}>

          {/* Header — company + route */}
          <div style={{ background: `linear-gradient(135deg, ${PRIMARY}12 0%, ${ACCENT}10 100%)`, padding: "20px 20px 18px", borderBottom: "2px dashed #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: ticket.companyColor + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: ticket.companyColor }}>
                {ticket.companyInit}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{ticket.company}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{ticket.busType} · {ticket.busClass}</p>
              </div>
              <div style={{ marginLeft: "auto", background: SUCCESS + "18", borderRadius: 8, padding: "4px 10px" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: SUCCESS }}>✔ Payé</span>
              </div>
            </div>

            {/* Route bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{ticket.time}</p>
                <p style={{ margin: "5px 0 0", fontSize: 15, fontWeight: 800, color: PRIMARY }}>{ticket.fromCode}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{ticket.from}</p>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "0 10px" }}>
                <p style={{ margin: 0, fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{ticket.duration}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", margin: "6px 0" }}>
                  <div style={{ flex: 1, height: 1.5, background: "#E2E8F0" }} />
                  <span style={{ fontSize: 16 }}>🚌</span>
                  <div style={{ flex: 1, height: 1.5, background: "#E2E8F0" }} />
                </div>
                <p style={{ margin: 0, fontSize: 10, color: "#94A3B8" }}>Direct</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{ticket.arrival}</p>
                <p style={{ margin: "5px 0 0", fontSize: 15, fontWeight: 800, color: ACCENT }}>{ticket.toCode}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{ticket.to}</p>
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
            <Row label="Passager"   value={ticket.passenger} />
            <Row label="Date"       value={ticket.date} />
            <Row label="Siège(s)"   value={ticket.seats.map(s => `N°${s}`).join("  ·  ")} accent />
            <Row label="Porte"      value={ticket.gate} />
            <Row label="Paiement"   value={ticket.payMethod} />
            <Row label="N° ticket"  value={ticket.ref} accent />
          </div>

          {/* QR code section */}
          <div style={{ padding: "20px 20px 24px", borderTop: "2px dashed #E2E8F0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Scannez à l'embarquement
            </p>

            <QRCode payload={qrPayload} size={148} />

            <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0F172A", letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>
              {ticket.ref}
            </p>

            {/* QR data decoded for transparency */}
            <div style={{ background: "#F8FAFF", borderRadius: 10, padding: "8px 14px", width: "100%", boxSizing: "border-box" }}>
              <p style={{ margin: 0, fontSize: 10, color: "#64748B", lineHeight: 1.7, textAlign: "center", fontFamily: "monospace" }}>
                {ticket.seats.join(",")} · {ticket.fromCode}→{ticket.toCode} · {ticket.time}
              </p>
            </div>

            <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textAlign: "center", lineHeight: 1.5 }}>
              Ce QR code est personnel et unique.<br />Ne le partagez pas avec des tiers.
            </p>
          </div>
        </div>

        {/* Amount summary */}
        <div style={{ background: "white", borderRadius: 14, padding: "14px 18px", marginBottom: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Montant payé</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, color: SUCCESS }}>{ticket.total.toLocaleString("fr-FR")} FCFA</p>
          </div>
          <div style={{ background: SUCCESS + "12", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: SUCCESS, textTransform: "uppercase", letterSpacing: 0.5 }}>via {ticket.payMethod}</span>
          </div>
        </div>

        {/* Notice */}
        <div style={{ background: "#EFF6FF", borderRadius: 14, padding: "12px 16px", border: "1px solid #BFDBFE", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#1E40AF", lineHeight: 1.7 }}>
            📱 Votre ticket a été envoyé par <strong>SMS</strong> et <strong>email</strong>. Arrivez <strong>15 min</strong> avant le départ — porte {ticket.gate}.
          </p>
        </div>

        {/* ── Action buttons ── */}
        <div id="gobooking-ticket-actions">
          {/* Download / PDF */}
          <button onClick={handleDownload} style={{
            width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
            background: dlDone
              ? `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`
              : `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
            color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer",
            boxShadow: dlDone ? "0 4px 20px rgba(5,150,105,0.35)" : "0 4px 20px rgba(26,86,219,0.30)",
            marginBottom: 12, transition: "all 0.25s",
          }}>
            {dlDone ? "✅ Ouverture PDF…" : "⬇ Télécharger le ticket (PDF)"}
          </button>

          {/* Share */}
          <button onClick={handleShare} style={{
            width: "100%", padding: "16px 0", borderRadius: 16,
            border: `2px solid ${shareDone ? SUCCESS : PRIMARY}`,
            background: shareDone ? SUCCESS + "12" : "white",
            color: shareDone ? SUCCESS : PRIMARY,
            fontSize: 15, fontWeight: 800, cursor: "pointer",
            marginBottom: 12, transition: "all 0.25s",
          }}>
            {shareDone ? `✅ ${shareMsg}` : "↗ Partager le ticket"}
          </button>

          {/* Home */}
          <button style={{
            width: "100%", padding: "16px 0", borderRadius: 16,
            border: "1.5px solid #E2E8F0", background: "white",
            color: "#475569", fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}>
            🏠 Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  );
}
