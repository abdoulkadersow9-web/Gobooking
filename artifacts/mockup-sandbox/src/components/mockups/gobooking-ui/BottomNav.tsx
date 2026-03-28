export function BottomNav() {
  const tabs = [
    { icon: "🏠", label: "Accueil", active: true },
    { icon: "🗺️", label: "Trajets", active: false },
    { icon: "📦", label: "Colis", active: false },
    { icon: "📍", label: "Suivi", active: false },
    { icon: "👤", label: "Profil", active: false },
  ];

  return (
    <div className="min-h-screen bg-[#E5E8F5] flex flex-col items-center justify-end pb-8 gap-8">
      <p className="text-[#7A8FAA] text-sm font-semibold tracking-wide uppercase">Bottom Navigation</p>

      {/* Active = Accueil */}
      <div className="w-[390px] bg-white rounded-3xl shadow-2xl overflow-hidden" style={{ boxShadow: "0 -4px 16px rgba(22,80,208,0.10)" }}>
        <div className="border-t border-[#DDE4F5]" />
        <div className="flex items-center justify-around px-2 pt-3 pb-5 gap-0">
          {tabs.map((tab) => (
            <div key={tab.label} className="flex flex-col items-center gap-[5px] pt-1.5" style={{ minWidth: 56 }}>
              <div
                className="flex items-center justify-center text-lg"
                style={{
                  width: 64,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: tab.active ? "#1650D0" : "transparent",
                  boxShadow: tab.active ? "0 5px 14px rgba(22,80,208,0.42)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ filter: tab.active ? "brightness(0) invert(1)" : "none", fontSize: 18 }}>{tab.icon}</span>
              </div>
              <span
                className="text-center tracking-wide"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: tab.active ? "#1650D0" : "#94A3B8",
                  letterSpacing: "0.15px",
                }}
              >
                {tab.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Active = Trajets */}
      <div className="w-[390px] bg-white rounded-3xl overflow-hidden" style={{ boxShadow: "0 -4px 16px rgba(22,80,208,0.10)" }}>
        <div className="border-t border-[#DDE4F5]" />
        <div className="flex items-center justify-around px-2 pt-3 pb-5">
          {tabs.map((tab, i) => {
            const isActive = i === 1;
            return (
              <div key={tab.label} className="flex flex-col items-center gap-[5px] pt-1.5" style={{ minWidth: 56 }}>
                <div
                  className="flex items-center justify-center text-lg"
                  style={{
                    width: 64,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: isActive ? "#1650D0" : "transparent",
                    boxShadow: isActive ? "0 5px 14px rgba(22,80,208,0.42)" : "none",
                  }}
                >
                  <span style={{ filter: isActive ? "brightness(0) invert(1)" : "none", fontSize: 18 }}>{tab.icon}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "#1650D0" : "#94A3B8", letterSpacing: "0.15px" }}>
                  {tab.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[#A4B4C6] text-xs">Pill 64×40px · Ombre bleue 0.42 · Label 11px SemiBold</p>
    </div>
  );
}
