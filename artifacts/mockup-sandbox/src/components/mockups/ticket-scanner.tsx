import { useState, useEffect, useRef } from "react";

const GREEN   = "#059669";
const PRIMARY = "#1A56DB";
const ORANGE  = "#D97706";
const RED     = "#DC2626";

type ScanState = "idle" | "scanning" | "valid" | "invalid";

const DEMO_RESULTS = [
  { name: "Kouassi Ama",     seat: "A3", ref: "GBB5AKZ8DZ", valid: true,  age: 34, route: "Abidjan → Bouaké" },
  { name: "Bamba Koffi",     seat: "C4", ref: "GBBA1C3RQ7", valid: true,  age: 45, route: "Abidjan → Bouaké" },
  { name: "Sanogo Ibrahim",  seat: "D2", ref: "GBB2QRT4HX", valid: false, age: 29, route: "Abidjan → Bouaké" },
];

let resultIdx = 0;

export default function TicketScanner() {
  const [state,       setState]       = useState<ScanState>("idle");
  const [scanLine,    setScanLine]    = useState(0);
  const [result,      setResult]      = useState<typeof DEMO_RESULTS[0] | null>(null);
  const [validated,   setValidated]   = useState<Set<string>>(new Set());
  const [flash,       setFlash]       = useState(false);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* animate scan line while scanning */
  useEffect(() => {
    if (state === "scanning") {
      let pos = 0;
      let dir = 1;
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
  }, [state]);

  const startScan = () => {
    if (state === "scanning") return;
    setState("scanning");
    setResult(null);
    animRef.current = setTimeout(() => {
      const res = DEMO_RESULTS[resultIdx % DEMO_RESULTS.length];
      resultIdx++;
      setResult(res);
      setFlash(true);
      setState(res.valid ? "valid" : "invalid");
      setTimeout(() => setFlash(false), 300);
    }, 2200);
  };

  const reset = () => {
    setState("idle");
    setResult(null);
    if (animRef.current) clearTimeout(animRef.current);
  };

  const markValidated = (ref: string) => {
    setValidated(prev => new Set([...prev, ref]));
  };

  const isAlreadyValidated = result ? validated.has(result.ref) : false;

  /* border color by state */
  const frameBorder =
    state === "valid"    ? GREEN  :
    state === "invalid"  ? RED    :
    state === "scanning" ? "#60A5FA" :
    "rgba(255,255,255,0.55)";

  return (
    <div style={{
      fontFamily: "Inter, -apple-system, sans-serif",
      background: "#0F172A",
      minHeight: "100vh", maxWidth: 430, margin: "0 auto",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Flash overlay on scan ── */}
      {flash && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(255,255,255,0.18)",
          pointerEvents: "none",
          transition: "opacity 0.3s",
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
        {/* Validated counter */}
        <div style={{
          background: validated.size > 0 ? "rgba(5,150,105,0.2)" : "rgba(255,255,255,0.08)",
          borderRadius: 20, paddingHorizontal: 12, padding: "5px 11px",
          border: `1px solid ${validated.size > 0 ? "rgba(5,150,105,0.4)" : "rgba(255,255,255,0.1)"}`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: validated.size > 0 ? "#34D399" : "rgba(255,255,255,0.5)" }}>
            {validated.size} validés
          </span>
        </div>
      </div>

      {/* ── Camera area ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "24px 24px 0",
        position: "relative",
      }}>

        {/* Camera simulation — dark gradient background */}
        <div style={{
          width: "100%", maxWidth: 340,
          aspectRatio: "1 / 1",
          borderRadius: 20, overflow: "hidden",
          position: "relative",
          background: "radial-gradient(ellipse at 40% 35%, #1e3a5f 0%, #0a1628 60%, #000 100%)",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.5)`,
        }}>
          {/* Simulated blurry camera content */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 55% 45%, rgba(30,90,150,0.4) 0%, transparent 60%)",
          }} />

          {/* Corner guides */}
          {[
            { top: 16, left: 16, borderTop: "3px solid", borderLeft: "3px solid", borderRight: "none", borderBottom: "none" },
            { top: 16, right: 16, borderTop: "3px solid", borderRight: "3px solid", borderLeft: "none", borderBottom: "none" },
            { bottom: 16, left: 16, borderBottom: "3px solid", borderLeft: "3px solid", borderRight: "none", borderTop: "none" },
            { bottom: 16, right: 16, borderBottom: "3px solid", borderRight: "3px solid", borderLeft: "none", borderTop: "none" },
          ].map((style, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 28, height: 28,
              borderColor: frameBorder,
              borderRadius: i === 0 ? "6px 0 0 0" : i === 1 ? "0 6px 0 0" : i === 2 ? "0 0 0 6px" : "0 0 6px 0",
              transition: "border-color 0.3s",
              ...style,
            }} />
          ))}

          {/* Scan target zone */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "65%", height: "65%",
            border: `1.5px solid ${frameBorder}33`,
            borderRadius: 8,
            transition: "border-color 0.3s",
          }} />

          {/* Moving scan line */}
          {state === "scanning" && (
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

          {/* State overlay */}
          {state === "valid" && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(5,150,105,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(5,150,105,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36,
                boxShadow: "0 0 0 12px rgba(5,150,105,0.2)",
              }}>✓</div>
            </div>
          )}
          {state === "invalid" && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(220,38,38,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(220,38,38,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36,
                boxShadow: "0 0 0 12px rgba(220,38,38,0.2)",
              }}>✕</div>
            </div>
          )}

          {/* Idle: QR code icon */}
          {state === "idle" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8,
            }}>
              {/* Mini QR illustration */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 12px)", gap: 3, opacity: 0.25 }}>
                {[1,1,1,1,1, 1,0,1,0,1, 1,1,0,1,1, 1,0,1,0,1, 1,1,1,1,1].map((v, i) => (
                  <div key={i} style={{ width: 12, height: 12, background: v ? "white" : "transparent", borderRadius: 2 }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instruction text */}
        <div style={{
          marginTop: 20, textAlign: "center",
          fontSize: state === "idle" ? 14 : 13,
          color: state === "scanning" ? "#93C5FD"
               : state === "valid"    ? "#34D399"
               : state === "invalid"  ? "#FCA5A5"
               : "rgba(255,255,255,0.6)",
          fontWeight: 600,
          transition: "color 0.3s",
        }}>
          {state === "idle"     && "Positionnez le ticket dans le cadre"}
          {state === "scanning" && "Scan en cours…"}
          {state === "valid"    && "✓ Ticket valide — Accès autorisé"}
          {state === "invalid"  && "✕ Ticket invalide — Accès refusé"}
        </div>

        {/* Supported formats */}
        {state === "idle" && (
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {["QR Code", "Code-barres", "Ref. manuelle"].map(f => (
              <span key={f} style={{
                fontSize: 10, fontWeight: 600, padding: "3px 10px",
                borderRadius: 20, color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}>{f}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Action button ── */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        {state === "idle" || state === "scanning" ? (
          <button
            onClick={startScan}
            disabled={state === "scanning"}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
              background: state === "scanning"
                ? "rgba(96,165,250,0.3)"
                : `linear-gradient(135deg, ${PRIMARY} 0%, #1e40af 100%)`,
              color: "white", fontSize: 15, fontWeight: 800, cursor: state === "scanning" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: state === "scanning" ? "none" : "0 4px 20px rgba(26,86,219,0.45)",
              transition: "all 0.2s",
            }}>
            <span style={{ fontSize: 20 }}>{state === "scanning" ? "⏳" : "📷"}</span>
            {state === "scanning" ? "Scan en cours…" : "Scanner maintenant"}
          </button>
        ) : (
          <button
            onClick={reset}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
              background: "rgba(255,255,255,0.1)",
              color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              border: "1.5px solid rgba(255,255,255,0.18)",
            }}>
            <span style={{ fontSize: 18 }}>🔄</span>
            Scanner un autre ticket
          </button>
        )}
      </div>

      {/* ── Result zone ── */}
      <div style={{
        margin: "16px 20px 20px",
        borderRadius: 20,
        overflow: "hidden",
        flexShrink: 0,
        minHeight: 130,
        transition: "all 0.3s",
      }}>
        {!result ? (
          /* Empty state */
          <div style={{
            background: "rgba(255,255,255,0.05)",
            border: "1.5px dashed rgba(255,255,255,0.12)",
            borderRadius: 20, padding: "28px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 28, opacity: 0.35 }}>🎫</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
              Le résultat s'affichera ici
            </span>
          </div>
        ) : (
          /* Result card */
          <div style={{
            background: result.valid
              ? "linear-gradient(135deg, rgba(5,150,105,0.2) 0%, rgba(4,120,87,0.15) 100%)"
              : "linear-gradient(135deg, rgba(220,38,38,0.2) 0%, rgba(185,28,28,0.15) 100%)",
            border: `1.5px solid ${result.valid ? "rgba(52,211,153,0.35)" : "rgba(252,165,165,0.35)"}`,
            borderRadius: 20, padding: "16px 18px",
          }}>
            {/* Status banner */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: result.valid ? "rgba(52,211,153,0.2)" : "rgba(252,165,165,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>
                  {result.valid ? "✅" : "❌"}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: result.valid ? "#34D399" : "#FCA5A5" }}>
                    {result.valid ? "Ticket valide" : "Ticket invalide"}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>
                    {result.ref}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                background: result.valid ? "rgba(52,211,153,0.2)" : "rgba(252,165,165,0.2)",
                color: result.valid ? "#34D399" : "#FCA5A5",
                border: `1px solid ${result.valid ? "rgba(52,211,153,0.3)" : "rgba(252,165,165,0.3)"}`,
              }}>
                {result.valid ? "ACCÈS OK" : "REFUSÉ"}
              </span>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 14 }} />

            {/* Passenger details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                { icon: "👤", label: "Passager",   value: result.name           },
                { icon: "🪑", label: "Siège",      value: result.seat           },
                { icon: "🗺️", label: "Trajet",     value: result.route          },
                { icon: "📋", label: "Statut",     value: result.valid
                    ? (isAlreadyValidated ? "Déjà validé ✓" : "Non encore validé")
                    : "Billet invalide / annulé"
                },
              ].map(row => (
                <div key={row.label} style={{
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{row.icon}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", width: 58, flexShrink: 0 }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", flex: 1 }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Validate button */}
            {result.valid && !isAlreadyValidated && (
              <button
                onClick={() => markValidated(result.ref)}
                style={{
                  width: "100%", marginTop: 14,
                  padding: "12px 0", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${GREEN} 0%, #047857 100%)`,
                  color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 16px rgba(5,150,105,0.35)",
                }}>
                ✓ &nbsp;Valider l'embarquement
              </button>
            )}
            {result.valid && isAlreadyValidated && (
              <div style={{
                marginTop: 12, textAlign: "center",
                fontSize: 12, fontWeight: 700, color: "#34D399",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                ✓ Embarquement validé
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
