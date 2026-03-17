import { useState, useEffect, useRef } from "react";

const GREEN   = "#059669";
const PRIMARY = "#1A56DB";
const ORANGE  = "#D97706";
const RED     = "#DC2626";

type ScanState = "idle" | "scanning" | "valid" | "used" | "invalid";

interface TicketResult {
  name:  string;
  seat:  string;
  ref:   string;
  route: string;
  status: "valid" | "used" | "invalid";
}

/* Cycling demo tickets: valid → used → invalid → valid … */
const DEMO_TICKETS: TicketResult[] = [
  { name: "Kouassi Ama",    seat: "A3", ref: "GBB5AKZ8DZ", route: "Abidjan → Bouaké", status: "valid"   },
  { name: "Bamba Koffi",    seat: "C4", ref: "GBBA1C3RQ7", route: "Abidjan → Bouaké", status: "used"    },
  { name: "Sanogo Ibrahim", seat: "D2", ref: "GBB2QRT4HX", route: "Abidjan → Bouaké", status: "invalid" },
  { name: "Diallo Mariam",  seat: "B2", ref: "GBB7FPV6NM", route: "Abidjan → Bouaké", status: "valid"   },
  { name: "Traoré Fatouma", seat: "B1", ref: "GBB9MNX2PL", route: "Abidjan → Bouaké", status: "used"    },
];

let demoIdx = 0;

/* ── Couleurs par statut ── */
const STATUS_CONFIG = {
  valid: {
    label:       "Ticket valide",
    badge:       "ACCÈS OK",
    icon:        "✅",
    color:       "#34D399",
    badgeBg:     "rgba(52,211,153,0.2)",
    badgeBorder: "rgba(52,211,153,0.3)",
    cardBg:      "linear-gradient(135deg, rgba(5,150,105,0.2) 0%, rgba(4,120,87,0.15) 100%)",
    cardBorder:  "rgba(52,211,153,0.35)",
    overlayBg:   "rgba(5,150,105,0.18)",
    circleBg:    "rgba(5,150,105,0.85)",
    overlaySymbol: "✓",
    frameColor:  GREEN,
    instructionColor: "#34D399",
    instructionText:  "✓ Ticket valide — Accès autorisé",
  },
  used: {
    label:       "Déjà utilisé",
    badge:       "DÉJÀ SCANNÉ",
    icon:        "🔁",
    color:       "#FCD34D",
    badgeBg:     "rgba(253,211,77,0.2)",
    badgeBorder: "rgba(253,211,77,0.35)",
    cardBg:      "linear-gradient(135deg, rgba(217,119,6,0.2) 0%, rgba(180,83,9,0.15) 100%)",
    cardBorder:  "rgba(253,211,77,0.35)",
    overlayBg:   "rgba(217,119,6,0.18)",
    circleBg:    "rgba(217,119,6,0.9)",
    overlaySymbol: "↩",
    frameColor:  ORANGE,
    instructionColor: "#FCD34D",
    instructionText:  "⚠ Ticket déjà utilisé — Vérifier le passager",
  },
  invalid: {
    label:       "Ticket invalide",
    badge:       "REFUSÉ",
    icon:        "❌",
    color:       "#FCA5A5",
    badgeBg:     "rgba(252,165,165,0.2)",
    badgeBorder: "rgba(252,165,165,0.3)",
    cardBg:      "linear-gradient(135deg, rgba(220,38,38,0.2) 0%, rgba(185,28,28,0.15) 100%)",
    cardBorder:  "rgba(252,165,165,0.35)",
    overlayBg:   "rgba(220,38,38,0.18)",
    circleBg:    "rgba(220,38,38,0.85)",
    overlaySymbol: "✕",
    frameColor:  RED,
    instructionColor: "#FCA5A5",
    instructionText:  "✕ Ticket invalide — Accès refusé",
  },
};

export default function TicketScanner() {
  const [scanState,   setScanState]   = useState<ScanState>("idle");
  const [scanLine,    setScanLine]    = useState(0);
  const [result,      setResult]      = useState<TicketResult | null>(null);
  const [validated,   setValidated]   = useState<Set<string>>(new Set());
  const [flash,       setFlash]       = useState(false);
  const [justValidated, setJustValidated] = useState(false);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Animate scan line */
  useEffect(() => {
    if (scanState === "scanning") {
      let pos = 0, dir = 1;
      lineRef.current = setInterval(() => {
        pos += dir * 2;
        if (pos >= 100) { pos = 100; dir = -1; }
        if (pos <= 0)   { pos = 0;   dir =  1; }
        setScanLine(pos);
      }, 16);
    } else {
      if (lineRef.current) clearInterval(lineRef.current);
      setScanLine(0);
    }
    return () => { if (lineRef.current) clearInterval(lineRef.current); };
  }, [scanState]);

  const startScan = () => {
    if (scanState === "scanning") return;
    setScanState("scanning");
    setResult(null);
    setJustValidated(false);
    animRef.current = setTimeout(() => {
      const ticket = DEMO_TICKETS[demoIdx % DEMO_TICKETS.length];
      demoIdx++;
      setResult(ticket);
      setFlash(true);
      setScanState(ticket.status);
      setTimeout(() => setFlash(false), 300);
    }, 2000);
  };

  const reset = () => {
    setScanState("idle");
    setResult(null);
    setJustValidated(false);
    if (animRef.current) clearTimeout(animRef.current);
  };

  const validateTicket = () => {
    if (!result || result.status !== "valid") return;
    setValidated(prev => new Set([...prev, result.ref]));
    setJustValidated(true);
  };

  const isValidated   = result ? validated.has(result.ref) : false;
  const cfg           = result ? STATUS_CONFIG[result.status] : null;

  const frameBorder =
    scanState === "valid"    ? GREEN  :
    scanState === "used"     ? ORANGE :
    scanState === "invalid"  ? RED    :
    scanState === "scanning" ? "#60A5FA" :
    "rgba(255,255,255,0.55)";

  return (
    <div style={{
      fontFamily: "Inter, -apple-system, sans-serif",
      background: "#0F172A",
      minHeight: "100vh", maxWidth: 430, margin: "0 auto",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Flash ── */}
      {flash && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(255,255,255,0.15)",
          pointerEvents: "none",
        }} />
      )}

      {/* ── Header ── */}
      <div style={{
        padding: "16px 16px 12px",
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <button style={{
          width: 38, height: 38, borderRadius: 10,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "white", fontSize: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>
            Scanner un ticket
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
            Abidjan → Bouaké · 17/03/2026 · 08h00
          </div>
        </div>
        <div style={{
          background: validated.size > 0 ? "rgba(5,150,105,0.2)" : "rgba(255,255,255,0.08)",
          borderRadius: 20, padding: "5px 11px",
          border: `1px solid ${validated.size > 0 ? "rgba(5,150,105,0.4)" : "rgba(255,255,255,0.1)"}`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: validated.size > 0 ? "#34D399" : "rgba(255,255,255,0.45)" }}>
            {validated.size} validés
          </span>
        </div>
      </div>

      {/* ── Camera area ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "20px 24px 0",
      }}>
        {/* Camera box */}
        <div style={{
          width: "100%", maxWidth: 320,
          aspectRatio: "1 / 1",
          borderRadius: 20, overflow: "hidden",
          position: "relative",
          background: "radial-gradient(ellipse at 40% 35%, #1e3a5f 0%, #0a1628 60%, #000 100%)",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.5)`,
        }}>
          {/* Camera ambiance */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 55% 45%, rgba(30,90,150,0.35) 0%, transparent 60%)" }} />

          {/* Corner guides */}
          {([
            { top: 14, left: 14,   bT: "3px solid", bL: "3px solid" },
            { top: 14, right: 14,  bT: "3px solid", bR: "3px solid" },
            { bottom: 14, left: 14,  bB: "3px solid", bL: "3px solid" },
            { bottom: 14, right: 14, bB: "3px solid", bR: "3px solid" },
          ] as any[]).map((c, i) => (
            <div key={i} style={{
              position: "absolute", width: 26, height: 26,
              borderTopWidth:    c.bT ? 3 : 0,
              borderLeftWidth:   c.bL ? 3 : 0,
              borderRightWidth:  c.bR ? 3 : 0,
              borderBottomWidth: c.bB ? 3 : 0,
              borderStyle: "solid",
              borderColor: frameBorder,
              borderRadius: i===0?"6px 0 0 0":i===1?"0 6px 0 0":i===2?"0 0 0 6px":"0 0 6px 0",
              top: c.top, left: c.left, right: c.right, bottom: c.bottom,
              transition: "border-color 0.3s",
            }} />
          ))}

          {/* Scan target zone */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "66%", height: "66%",
            border: `1.5px solid ${frameBorder}30`,
            borderRadius: 8, transition: "border-color 0.3s",
          }} />

          {/* Animated scan line */}
          {scanState === "scanning" && (
            <div style={{
              position: "absolute",
              left: "17%", right: "17%",
              top: `calc(17% + ${scanLine * 0.66}%)`,
              height: 2,
              background: "linear-gradient(90deg, transparent, #60A5FA 20%, #93C5FD 50%, #60A5FA 80%, transparent)",
              borderRadius: 2,
              boxShadow: "0 0 8px 2px rgba(96,165,250,0.5)",
            }} />
          )}

          {/* Result overlays */}
          {cfg && scanState !== "scanning" && (
            <div style={{
              position: "absolute", inset: 0,
              background: cfg.overlayBg,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 70, height: 70, borderRadius: "50%",
                background: cfg.circleBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, color: "white", fontWeight: 900,
                boxShadow: `0 0 0 14px ${cfg.circleBg.replace("0.9","0.18").replace("0.85","0.18")}`,
              }}>
                {cfg.overlaySymbol}
              </div>
            </div>
          )}

          {/* Idle QR illustration */}
          {scanState === "idle" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 11px)", gap: 3, opacity: 0.2 }}>
                {[1,1,1,1,1, 1,0,1,0,1, 1,1,0,1,1, 1,0,1,0,1, 1,1,1,1,1].map((v, i) => (
                  <div key={i} style={{ width: 11, height: 11, background: v ? "white" : "transparent", borderRadius: 2 }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instruction */}
        <div style={{
          marginTop: 16, textAlign: "center",
          fontSize: 13, fontWeight: 600,
          color: scanState === "scanning" ? "#93C5FD"
               : cfg ? cfg.instructionColor
               : "rgba(255,255,255,0.55)",
          transition: "color 0.3s",
        }}>
          {scanState === "idle"     && "Positionnez le ticket dans le cadre"}
          {scanState === "scanning" && "Scan en cours…"}
          {cfg && scanState !== "idle" && scanState !== "scanning" && cfg.instructionText}
        </div>

        {/* Format chips */}
        {scanState === "idle" && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {["QR Code", "Code-barres"].map(f => (
              <span key={f} style={{
                fontSize: 10, fontWeight: 600, padding: "3px 10px",
                borderRadius: 20, color: "rgba(255,255,255,0.35)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}>{f}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Main action button ── */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        {(scanState === "idle" || scanState === "scanning") ? (
          <button onClick={startScan} disabled={scanState === "scanning"}
            style={{
              width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
              background: scanState === "scanning"
                ? "rgba(96,165,250,0.25)"
                : `linear-gradient(135deg, ${PRIMARY} 0%, #1e40af 100%)`,
              color: "white", fontSize: 15, fontWeight: 800,
              cursor: scanState === "scanning" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: scanState === "scanning" ? "none" : "0 4px 20px rgba(26,86,219,0.4)",
              transition: "all 0.2s",
            }}>
            <span style={{ fontSize: 18 }}>{scanState === "scanning" ? "⏳" : "📷"}</span>
            {scanState === "scanning" ? "Scan en cours…" : "Scanner maintenant"}
          </button>
        ) : (
          <button onClick={reset}
            style={{
              width: "100%", padding: "15px 0", borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            <span style={{ fontSize: 16 }}>🔄</span>
            Scanner un autre ticket
          </button>
        )}
      </div>

      {/* ── Result zone ── */}
      <div style={{ margin: "14px 20px 18px", flexShrink: 0 }}>
        {!result || !cfg ? (
          /* Empty state */
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1.5px dashed rgba(255,255,255,0.1)",
            borderRadius: 18, padding: "24px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
          }}>
            <span style={{ fontSize: 26, opacity: 0.3 }}>🎫</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontWeight: 600 }}>
              Le résultat s'affichera ici
            </span>
          </div>
        ) : (
          /* Result card */
          <div style={{
            background: cfg.cardBg,
            border: `1.5px solid ${cfg.cardBorder}`,
            borderRadius: 18, padding: "15px 17px",
          }}>

            {/* ── Status header ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: cfg.badgeBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>
                  {cfg.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1, fontFamily: "monospace" }}>
                    {result.ref}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 20,
                background: cfg.badgeBg, color: cfg.color,
                border: `1px solid ${cfg.badgeBorder}`,
                letterSpacing: 0.5,
              }}>
                {cfg.badge}
              </span>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 13 }} />

            {/* ── Passenger details ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, width: 22, textAlign: "center" }}>👤</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 60, flexShrink: 0 }}>Passager</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "white", flex: 1 }}>{result.name}</span>
              </div>

              {/* Seat */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, width: 22, textAlign: "center" }}>🪑</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 60, flexShrink: 0 }}>Siège</span>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  background: "rgba(26,86,219,0.3)", color: "#93C5FD",
                  padding: "2px 10px", borderRadius: 8,
                  border: "1px solid rgba(147,197,253,0.2)",
                }}>{result.seat}</span>
              </div>

              {/* Route */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, width: 22, textAlign: "center" }}>🗺️</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 60, flexShrink: 0 }}>Trajet</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", flex: 1 }}>{result.route}</span>
              </div>

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, width: 22, textAlign: "center" }}>📋</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 60, flexShrink: 0 }}>Statut</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, flex: 1 }}>
                  {result.status === "valid"
                    ? (isValidated ? "✓ Validé — embarquement confirmé" : "Valide — en attente de validation")
                    : result.status === "used"
                    ? "⚠ Déjà utilisé — ticket pré-scanné"
                    : "✕ Invalide — billet annulé ou inconnu"
                  }
                </span>
              </div>
            </div>

            {/* ── Validate button (valid + not yet validated) ── */}
            {result.status === "valid" && !isValidated && (
              <button onClick={validateTicket}
                style={{
                  width: "100%", marginTop: 14,
                  padding: "13px 0", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${GREEN} 0%, #047857 100%)`,
                  color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 16px rgba(5,150,105,0.4)",
                }}>
                ✓ &nbsp;Valider le ticket
              </button>
            )}

            {/* Already validated confirmation */}
            {result.status === "valid" && isValidated && (
              <div style={{
                marginTop: 12,
                background: "rgba(52,211,153,0.12)",
                border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#34D399" }}>
                  {justValidated ? "Ticket validé avec succès !" : "Embarquement déjà confirmé"}
                </span>
              </div>
            )}

            {/* Used — warning message */}
            {result.status === "used" && (
              <div style={{
                marginTop: 12,
                background: "rgba(217,119,6,0.15)",
                border: "1px solid rgba(253,211,77,0.25)",
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#FCD34D", flex: 1 }}>
                  Ce ticket a déjà été scanné. Vérifiez l'identité du passager.
                </span>
              </div>
            )}

            {/* Invalid — refusal message */}
            {result.status === "invalid" && (
              <div style={{
                marginTop: 12,
                background: "rgba(220,38,38,0.15)",
                border: "1px solid rgba(252,165,165,0.25)",
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>🚫</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#FCA5A5", flex: 1 }}>
                  Accès refusé. Billet inconnu, annulé ou non autorisé.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
