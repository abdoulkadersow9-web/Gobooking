type State = "confirmé" | "en_attente" | "payé" | "annulé" | "embarqué";

const STATES: Record<State, { color: string; bg: string; label: string; icon: string }> = {
  confirmé:   { color: "#1650D0", bg: "#EEF4FF",  label: "Confirmé",   icon: "✓" },
  en_attente: { color: "#D97706", bg: "#FFFBEB",  label: "En attente", icon: "⏱" },
  payé:       { color: "#047857", bg: "#ECFDF5",  label: "Payé ✓",     icon: "✓" },
  annulé:     { color: "#DC2626", bg: "#FEF2F2",  label: "Annulé",     icon: "✗" },
  embarqué:   { color: "#6D28D9", bg: "#F5F3FF",  label: "Embarqué",   icon: "→" },
};

const STEPS = ["Réservé", "Confirmé", "Payé", "Embarqué"];
const STEP_COLORS = ["#D97706", "#1650D0", "#047857", "#6D28D9"];

function BookingCard({ state, from, to, dep, arr, ref_, amount }: {
  state: State; from: string; to: string; dep: string; arr: string; ref_: string; amount: number;
}) {
  const cfg = STATES[state];
  const stepIdx = state === "en_attente" ? 0 : state === "confirmé" ? 1 : state === "payé" ? 2 : state === "embarqué" ? 3 : -1;
  const isCancelled = state === "annulé";

  return (
    <div
      className="bg-white rounded-[28px] p-[26px] mb-[24px]"
      style={{
        borderWidth: 1,
        borderColor: "#E8ECFA",
        borderLeftWidth: 5,
        borderLeftColor: cfg.color,
        boxShadow: "0 12px 34px rgba(22,80,208,0.12)",
      }}
    >
      {/* Header */}
      <div className="flex flex-row justify-between items-start mb-[26px]">
        <div>
          <div className="text-[17px] font-bold text-[#06101F] tracking-tight">#{ref_}</div>
          <div className="text-[12px] font-medium text-[#7A8FAA] mt-[5px]">28 mars 2026</div>
        </div>
        <div
          className="flex flex-row items-center gap-[6px]"
          style={{
            backgroundColor: cfg.bg,
            paddingLeft: 16, paddingRight: 16,
            paddingTop: 10, paddingBottom: 10,
            borderRadius: 26,
          }}
        >
          <span style={{ color: cfg.color, fontSize: 13 }}>{cfg.icon}</span>
          <span className="text-[13px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>

      {/* Route horaires */}
      <div
        className="flex flex-row items-center mb-[28px] pb-[28px]"
        style={{ borderBottom: "1.5px solid #ECEEF8" }}
      >
        <div className="flex-1">
          <div className="text-[36px] font-bold text-[#06101F]" style={{ letterSpacing: -2 }}>{dep}</div>
          <div className="text-[14px] font-semibold text-[#7A8FAA] mt-[9px]">{from}</div>
        </div>
        <div className="flex flex-row items-center gap-1 px-2">
          <div style={{ width: 32, height: 2, backgroundColor: "#DDE2F0" }} />
          <span style={{ color: "#A4B4C6", fontSize: 14 }}>→</span>
          <div style={{ width: 32, height: 2, backgroundColor: "#DDE2F0" }} />
        </div>
        <div className="flex-1 text-right">
          <div className="text-[36px] font-bold text-[#06101F]" style={{ letterSpacing: -2 }}>{arr}</div>
          <div className="text-[14px] font-semibold text-[#7A8FAA] mt-[9px]">{to}</div>
        </div>
      </div>

      {/* Badge countdown si en_attente */}
      {state === "en_attente" && (
        <div
          className="flex flex-row items-center gap-2 mb-[14px]"
          style={{
            backgroundColor: "#FFFBEB", borderRadius: 14,
            paddingLeft: 14, paddingRight: 14,
            paddingTop: 11, paddingBottom: 11,
            border: "1.5px solid #FDE68A",
          }}
        >
          <span style={{ fontSize: 13 }}>⏱</span>
          <span className="text-[13px] font-bold text-[#B45309]">2h30 restant pour payer</span>
        </div>
      )}

      {/* Badge bagage refusé si confirmé */}
      {state === "confirmé" && (
        <div
          className="flex flex-row items-center gap-2 mb-[14px]"
          style={{
            backgroundColor: "#FEF2F2", borderRadius: 14,
            paddingLeft: 14, paddingRight: 14,
            paddingTop: 11, paddingBottom: 11,
            border: "1.5px solid #FECACA",
          }}
        >
          <span style={{ fontSize: 13 }}>🧳</span>
          <span className="text-[13px] font-bold text-[#DC2626]">Bagages refusés — à régulariser en gare</span>
        </div>
      )}

      {/* Timeline (si pas annulé) */}
      {!isCancelled && (
        <div className="flex flex-row items-start mb-[26px] pt-[14px]">
          {STEPS.map((step, i) => {
            const done = i <= stepIdx;
            const col = done ? STEP_COLORS[i] : "#CBD5E1";
            return (
              <div key={step} className="flex flex-row items-start flex-1">
                <div className="flex flex-col items-center" style={{ minWidth: 60 }}>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 22, height: 22, borderRadius: 11,
                      border: `2px solid ${col}`,
                      backgroundColor: done ? col : "white",
                      color: "white", fontSize: 10, fontWeight: 700,
                    }}
                  >
                    {done ? "✓" : ""}
                  </div>
                  <span className="text-[10px] font-semibold mt-[6px] text-center" style={{ color: done ? col : "#94A3B8" }}>
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mt-[10px]" style={{ height: 2, backgroundColor: i < stepIdx ? STEP_COLORS[i + 1] : "#E2E8F0" }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div
        className="flex flex-row justify-between items-center pt-[22px]"
        style={{ borderTop: "1px solid #F1F4FA" }}
      >
        <div>
          <div className="flex items-center gap-[6px] mb-[6px]">
            <span style={{ fontSize: 11, color: "#A4B4C6" }}>💳</span>
            <span className="text-[12px] font-medium text-[#A4B4C6]">Orange Money</span>
          </div>
          <div className="flex items-center gap-[6px]">
            <span style={{ fontSize: 11, color: "#7A8FAA" }}>📍</span>
            <span className="text-[12px] font-medium text-[#7A8FAA]">Sièges : A3, A4</span>
          </div>
        </div>
        <div
          style={{
            paddingLeft: 22, paddingRight: 22,
            paddingTop: 14, paddingBottom: 14,
            borderRadius: 22,
            backgroundColor: state === "annulé" ? "#F1F5F9" : state === "payé" || state === "embarqué" ? "#EEF4FF" : "#FFFBEB",
          }}
        >
          <span
            className="text-[26px] font-bold"
            style={{
              color: state === "annulé" ? "#9CA3AF" : state === "payé" || state === "embarqué" ? "#1650D0" : "#D97706",
              letterSpacing: -1,
            }}
          >
            {amount.toLocaleString("fr-FR")} F
          </span>
        </div>
      </div>
    </div>
  );
}

export function ReservationCard() {
  return (
    <div className="min-h-screen bg-[#E5E8F5] px-5 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-6 rounded-full bg-[#1650D0]" />
        <h2 className="text-[22px] font-bold text-[#06101F] tracking-tight">Mes Réservations</h2>
      </div>
      <BookingCard state="payé"       from="Abidjan" to="Bouaké"       dep="06:30" arr="12:00" ref_="GBK-2841" amount={3500} />
      <BookingCard state="en_attente" from="Abidjan" to="Yamoussoukro" dep="14:00" arr="16:30" ref_="GBK-3109" amount={2000} />
      <BookingCard state="confirmé"   from="Bouaké"  to="Korhogo"      dep="08:00" arr="11:30" ref_="GBK-2990" amount={2500} />
      <BookingCard state="annulé"     from="Abidjan" to="San Pedro"    dep="07:30" arr="11:30" ref_="GBK-2761" amount={3000} />
    </div>
  );
}
