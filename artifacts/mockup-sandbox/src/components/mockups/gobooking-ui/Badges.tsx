const STATUS_BADGES = [
  { label: "En attente",  color: "#D97706", bg: "#FFFBEB", border: "#FDE68A",  icon: "⏱" },
  { label: "Confirmé",    color: "#1650D0", bg: "#EEF4FF", border: "#BFDBFE",  icon: "✓" },
  { label: "Payé ✓",      color: "#047857", bg: "#ECFDF5", border: "#6EE7B7",  icon: "✓" },
  { label: "Embarqué",    color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE",  icon: "→" },
  { label: "Annulé",      color: "#DC2626", bg: "#FEF2F2", border: "#FECACA",  icon: "✗" },
  { label: "Expiré",      color: "#DC2626", bg: "#FEF2F2", border: "#FECACA",  icon: "⚠" },
  { label: "Bon émis",    color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE",  icon: "🎁" },
];

const INFO_BADGES = [
  { label: "2h30 restant pour payer", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A",  icon: "⏱" },
  { label: "45 min restant pour payer", color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", icon: "⏱" },
  { label: "Délai expiré",              color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: "⚠" },
  { label: "Bagages en attente de validation", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", icon: "🧳" },
  { label: "Bagages refusés — à régulariser en gare", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: "🧳" },
];

export function Badges() {
  return (
    <div className="min-h-screen bg-[#E5E8F5] px-5 py-8">
      {/* Statuts principaux */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 rounded-full bg-[#1650D0]" />
        <h2 className="text-[22px] font-bold text-[#06101F] tracking-tight">Badges statut</h2>
      </div>

      <div className="bg-white rounded-[28px] p-6 mb-6" style={{ boxShadow: "0 10px 30px rgba(22,80,208,0.11)", border: "1px solid #E8ECFA" }}>
        <div className="flex flex-wrap gap-3">
          {STATUS_BADGES.map((b) => (
            <div
              key={b.label}
              className="flex flex-row items-center gap-[6px]"
              style={{
                backgroundColor: b.bg,
                paddingLeft: 16, paddingRight: 16,
                paddingTop: 10, paddingBottom: 10,
                borderRadius: 26,
                border: `1.5px solid ${b.border}`,
              }}
            >
              <span style={{ color: b.color, fontSize: 13 }}>{b.icon}</span>
              <span className="text-[13px] font-bold" style={{ color: b.color }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Badges d'info / countdown */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 rounded-full bg-[#1650D0]" />
        <h2 className="text-[20px] font-bold text-[#06101F] tracking-tight">Badges d'information</h2>
      </div>

      <div className="bg-white rounded-[28px] p-6" style={{ boxShadow: "0 10px 30px rgba(22,80,208,0.11)", border: "1px solid #E8ECFA" }}>
        <div className="flex flex-col gap-3">
          {INFO_BADGES.map((b) => (
            <div
              key={b.label}
              className="flex flex-row items-center gap-[8px]"
              style={{
                backgroundColor: b.bg,
                paddingLeft: 14, paddingRight: 14,
                paddingTop: 11, paddingBottom: 11,
                borderRadius: 14,
                border: `1.5px solid ${b.border}`,
              }}
            >
              <span style={{ fontSize: 15 }}>{b.icon}</span>
              <span className="text-[13px] font-bold" style={{ color: b.color }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[#A4B4C6] text-xs mt-6">
        Statut: padding 16×10 · borderRadius 26 · font 13px Bold
        <br />
        Info: padding 14×11 · borderRadius 14 · borderWidth 1.5
      </p>
    </div>
  );
}
