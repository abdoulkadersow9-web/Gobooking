type State = "confirmé" | "en_attente" | "payé" | "annulé" | "embarqué";

const STATES: Record<State, { color: string; bg: string; label: string }> = {
  confirmé:   { color: "#1650D0", bg: "#EEF4FF", label: "Confirmé ✓" },
  en_attente: { color: "#D97706", bg: "#FFFBEB", label: "En attente" },
  payé:       { color: "#047857", bg: "#ECFDF5", label: "Payé ✓" },
  annulé:     { color: "#DC2626", bg: "#FEF2F2", label: "Annulé" },
  embarqué:   { color: "#6D28D9", bg: "#F5F3FF", label: "Embarqué →" },
};

const STEPS = ["Réservé", "Confirmé", "Payé", "Embarqué"];
const STEP_COLORS = ["#D97706", "#1650D0", "#047857", "#6D28D9"];

function Timeline({ stepIdx }: { stepIdx: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", marginBottom: 24, paddingTop: 14 }}>
      {STEPS.map((step, i) => {
        const done = i <= stepIdx;
        const col = done ? STEP_COLORS[i] : "#CBD5E1";
        return (
          <div key={step} style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 60 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11,
                border: `2px solid ${col}`,
                backgroundColor: done ? col : "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "white", fontWeight: 700,
              }}>
                {done ? "✓" : ""}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, marginTop: 6, textAlign: "center", color: done ? col : "#94A3B8" }}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, marginTop: 10, backgroundColor: i < stepIdx ? STEP_COLORS[i + 1] : "#E2E8F0" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BookingCard({ state, from, to, dep, arr, ref_, amount, extra }: {
  state: State; from: string; to: string; dep: string; arr: string;
  ref_: string; amount: number; extra?: string;
}) {
  const cfg = STATES[state];
  const stepIdx = state === "en_attente" ? 0 : state === "confirmé" ? 1 : state === "payé" ? 2 : state === "embarqué" ? 3 : -1;
  const isCancelled = state === "annulé";

  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: 28, padding: 26, marginBottom: 24,
      boxShadow: "0 12px 34px rgba(22,80,208,0.12)",
      border: "1px solid #E8ECFA",
      borderLeft: `5px solid ${cfg.color}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#06101F", letterSpacing: -0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{ref_}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#7A8FAA", marginTop: 5 }}>28 mars 2026</div>
        </div>
        <div style={{
          display: "flex", flexDirection: "row", alignItems: "center", gap: 6,
          backgroundColor: cfg.bg, padding: "10px 16px", borderRadius: 26, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>

      {/* Route */}
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 24, paddingBottom: 24, borderBottom: "1.5px solid #ECEEF8" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#06101F", letterSpacing: -1.5 }}>{dep}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#7A8FAA", marginTop: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{from}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, padding: "0 4px" }}>
          <div style={{ width: 24, height: 2, backgroundColor: "#DDE2F0" }} />
          <div style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#EEF4FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#1650D0", fontSize: 13 }}>→</span>
          </div>
          <div style={{ width: 24, height: 2, backgroundColor: "#DDE2F0" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#06101F", letterSpacing: -1.5 }}>{arr}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#7A8FAA", marginTop: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{to}</div>
        </div>
      </div>

      {/* Info badge si applicable */}
      {extra && (
        <div style={{
          display: "flex", flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: state === "en_attente" ? "#FFFBEB" : "#FEF2F2",
          borderRadius: 14, padding: "11px 14px",
          border: `1.5px solid ${state === "en_attente" ? "#FDE68A" : "#FECACA"}`,
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 13 }}>{state === "en_attente" ? "⏱" : "🧳"}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: state === "en_attente" ? "#B45309" : "#DC2626" }}>{extra}</span>
        </div>
      )}

      {/* Timeline */}
      {!isCancelled && <Timeline stepIdx={stepIdx} />}

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 22, borderTop: "1px solid #F1F4FA" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#A4B4C6" }}>💳</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#A4B4C6" }}>Orange Money</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#7A8FAA" }}>📍</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#7A8FAA" }}>Sièges : A3, A4</span>
          </div>
        </div>
        <div style={{
          padding: "14px 22px", borderRadius: 22,
          backgroundColor: isCancelled ? "#F1F5F9" : state === "payé" || state === "embarqué" ? "#EEF4FF" : "#FFFBEB",
        }}>
          <span style={{
            fontSize: 26, fontWeight: 700, letterSpacing: -1,
            color: isCancelled ? "#9CA3AF" : state === "payé" || state === "embarqué" ? "#1650D0" : "#D97706",
          }}>
            {amount.toLocaleString("fr-FR")} F
          </span>
        </div>
      </div>
    </div>
  );
}

export function ReservationCard() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#E5E8F5", padding: 16, paddingTop: 32 }}>
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: "#1650D0", flexShrink: 0 }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#06101F", margin: 0, letterSpacing: -0.5 }}>Mes Réservations</h2>
      </div>

      <BookingCard state="payé"       from="Abidjan" to="Bouaké"       dep="06:30" arr="12:00" ref_="GBK-2841" amount={3500} />
      <BookingCard state="en_attente" from="Abidjan" to="Yamoussoukro" dep="14:00" arr="16:30" ref_="GBK-3109" amount={2000} extra="2h30 restant pour payer" />
      <BookingCard state="confirmé"   from="Bouaké"  to="Korhogo"      dep="08:00" arr="11:30" ref_="GBK-2990" amount={2500} extra="Bagages refusés — à régulariser en gare" />
      <BookingCard state="annulé"     from="Abidjan" to="San Pedro"    dep="07:30" arr="11:30" ref_="GBK-2761" amount={3000} />
    </div>
  );
}
