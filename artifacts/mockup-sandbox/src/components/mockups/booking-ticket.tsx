import { useState } from "react";

const PRIMARY    = "#1A56DB";
const SUCCESS    = "#059669";
const ACCENT     = "#6366F1";

/* ─── Demo ticket data ────────────────────────────────────────────────── */
const TICKET = {
  ref:         "GBK-4XR7M9KZ",
  passenger:   "Kouamé Jean-Baptiste",
  from:        "Abidjan",
  fromCode:    "ABJ",
  to:          "Bouaké",
  toCode:      "BKE",
  date:        "Jeudi 20 mars 2025",
  time:        "06:00",
  arrival:     "10:30",
  duration:    "4h 30",
  seat:        "14A",
  busType:     "Climatisé",
  company:     "UTB Express",
  companyInit: "U",
  companyColor:"#1A56DB",
  gate:        "G3",
  class:       "Standard",
};

/* ─── Minimal QR code (deterministic pixel grid) ─────────────────────── */
function QRCode({ value, size = 160 }: { value: string; size?: number }) {
  const cells  = 9;
  const cell   = size / cells;
  const seed   = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  const isCorner = (r: number, c: number) =>
    (r < 3 && c < 3) || (r < 3 && c >= cells - 3) || (r >= cells - 3 && c < 3);

  const grid = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if (isCorner(r, c)) return true;
      if (r === 0 || r === cells - 1 || c === 0 || c === cells - 1) return true;
      return ((seed * (r + 3) * (c + 7) + r * 13 + c * 17) % 3) !== 1;
    }),
  );

  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      padding: 10,
      boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
      display: "inline-block",
    }}>
      {grid.map((row, r) => (
        <div key={r} style={{ display: "flex" }}>
          {row.map((filled, c) => (
            <div key={c} style={{
              width: cell, height: cell,
              background: filled ? "#0F172A" : "white",
              borderRadius: (isCorner(r, c) && ((r + c) % 2 === 0)) ? 2 : 0,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Info row helper ─────────────────────────────────────────────────── */
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: accent ? PRIMARY : "#0F172A", textAlign: "right", maxWidth: "58%" }}>{value}</span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function BookingTicket() {
  const [downloaded, setDownloaded] = useState(false);
  const [shared,     setShared]     = useState(false);

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2200);
  };

  const handleShare = () => {
    setShared(true);
    setTimeout(() => setShared(false), 2200);
  };

  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "#F1F5F9",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
        padding: "52px 20px 28px",
        position: "relative",
      }}>
        <button style={{
          position: "absolute", top: 16, left: 16,
          width: 36, height: 36, borderRadius: 10,
          border: "none", background: "rgba(255,255,255,0.20)",
          color: "white", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>

        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: "white", textAlign: "center" }}>
          Mon ticket
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)", textAlign: "center" }}>
          Billet électronique confirmé
        </p>

        {/* Status badge */}
        <div style={{
          display: "flex", justifyContent: "center", marginTop: 14,
        }}>
          <div style={{
            background: "rgba(255,255,255,0.18)",
            borderRadius: 20, padding: "6px 16px",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>Réservation confirmée</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>

        {/* ── Ticket card ── */}
        <div style={{
          background: "white",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 6px 32px rgba(0,0,0,0.10)",
          marginBottom: 16,
        }}>

          {/* Card header — route + company */}
          <div style={{
            background: `linear-gradient(135deg, ${PRIMARY}12 0%, ${ACCENT}10 100%)`,
            padding: "20px 20px 16px",
            borderBottom: "2px dashed #E2E8F0",
          }}>
            {/* Company row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: TICKET.companyColor + "18",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900, color: TICKET.companyColor,
              }}>{TICKET.companyInit}</div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{TICKET.company}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{TICKET.busType} · {TICKET.class}</p>
              </div>
              <div style={{
                marginLeft: "auto",
                background: SUCCESS + "18", borderRadius: 8, padding: "4px 10px",
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: SUCCESS }}>✔ Payé</span>
              </div>
            </div>

            {/* Route bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{TICKET.time}</p>
                <p style={{ margin: "5px 0 0", fontSize: 15, fontWeight: 800, color: PRIMARY }}>{TICKET.fromCode}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{TICKET.from}</p>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "0 10px" }}>
                <p style={{ margin: 0, fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{TICKET.duration}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", margin: "6px 0" }}>
                  <div style={{ flex: 1, height: 1.5, background: "#E2E8F0" }} />
                  <span style={{ fontSize: 16 }}>🚌</span>
                  <div style={{ flex: 1, height: 1.5, background: "#E2E8F0" }} />
                </div>
                <p style={{ margin: 0, fontSize: 10, color: "#94A3B8" }}>Direct</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{TICKET.arrival}</p>
                <p style={{ margin: "5px 0 0", fontSize: 15, fontWeight: 800, color: ACCENT }}>{TICKET.toCode}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{TICKET.to}</p>
              </div>
            </div>
          </div>

          {/* ── Tear notches ── */}
          <div style={{ position: "relative", height: 0, overflow: "visible" }}>
            <div style={{ position: "absolute", left: -14, top: -14, width: 28, height: 28, borderRadius: "50%", background: "#F1F5F9" }} />
            <div style={{ position: "absolute", right: -14, top: -14, width: 28, height: 28, borderRadius: "50%", background: "#F1F5F9" }} />
          </div>

          {/* ── Info rows ── */}
          <div style={{ padding: "18px 20px 4px" }}>
            <InfoRow label="Passager"   value={TICKET.passenger} />
            <InfoRow label="Date"       value={TICKET.date} />
            <InfoRow label="Siège"      value={TICKET.seat} accent />
            <InfoRow label="Porte"      value={TICKET.gate} />
            <InfoRow label="N° ticket"  value={TICKET.ref} accent />
          </div>

          {/* ── QR code section ── */}
          <div style={{
            padding: "20px 20px 24px",
            borderTop: "2px dashed #E2E8F0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Scannez à l'embarquement
            </p>

            <QRCode value={TICKET.ref} size={144} />

            <p style={{
              margin: 0, fontSize: 14, fontWeight: 900, color: "#0F172A",
              letterSpacing: 2, fontVariantNumeric: "tabular-nums",
            }}>
              {TICKET.ref}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textAlign: "center", lineHeight: 1.5 }}>
              Ce QR code est personnel et unique.<br />Ne le partagez pas avec des tiers.
            </p>
          </div>
        </div>

        {/* ── Info notice ── */}
        <div style={{
          background: "#EFF6FF",
          borderRadius: 14, padding: "12px 16px",
          border: "1px solid #BFDBFE",
          marginBottom: 20,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#1E40AF", lineHeight: 1.7 }}>
            📱 Votre ticket a également été envoyé par <strong>SMS</strong> et <strong>email</strong>. Arrivez <strong>15 min</strong> avant le départ, porte {TICKET.gate}.
          </p>
        </div>

        {/* ── Action buttons ── */}
        {/* Download */}
        <button
          onClick={handleDownload}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 16,
            border: "none",
            background: downloaded
              ? `linear-gradient(135deg, ${SUCCESS} 0%, #047857 100%)`
              : `linear-gradient(135deg, ${PRIMARY} 0%, #1240a8 100%)`,
            color: "white", fontSize: 15, fontWeight: 800,
            cursor: "pointer",
            boxShadow: downloaded
              ? "0 4px 20px rgba(5,150,105,0.35)"
              : "0 4px 20px rgba(26,86,219,0.30)",
            marginBottom: 12,
            transition: "all 0.25s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {downloaded ? "✅ Ticket téléchargé !" : "⬇ Télécharger le ticket"}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 16,
            border: `2px solid ${shared ? SUCCESS : PRIMARY}`,
            background: shared ? SUCCESS + "12" : "white",
            color: shared ? SUCCESS : PRIMARY,
            fontSize: 15, fontWeight: 800,
            cursor: "pointer",
            marginBottom: 12,
            transition: "all 0.25s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {shared ? "✅ Lien copié !" : "↗ Partager le ticket"}
        </button>

        {/* Back to home */}
        <button style={{
          width: "100%", padding: "16px 0", borderRadius: 16,
          border: "1.5px solid #E2E8F0",
          background: "white",
          color: "#475569", fontSize: 15, fontWeight: 700,
          cursor: "pointer",
        }}>
          🏠 Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
