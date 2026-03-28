export function AppHeader() {
  const firstName = "Kouamé";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#E5E8F5", fontFamily: "Inter, -apple-system, sans-serif" }}>

      {/* ── Gradient Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #1650D0 0%, #1030B4 60%, #0A1C84 100%)",
        paddingTop: 48, paddingBottom: 36,
        paddingLeft: 20, paddingRight: 20,
      }}>

        {/* Header Row */}
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12 }}>
          {/* Left: Logo + Greeting */}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(255,255,255,0.3)" }}>
              <span style={{ fontSize: 20 }}>🚌</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: -0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Bonjour, {firstName}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>
                Que souhaitez-vous faire ?
              </div>
            </div>
          </div>
          {/* Right: Admin button */}
          <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", border: "1.5px solid rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "white", fontSize: 16 }}>🔔</span>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{ display: "flex", flexDirection: "row", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 16, padding: 5, marginBottom: 18, gap: 4 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 11, paddingBottom: 11, borderRadius: 12, backgroundColor: "white" }}>
            <span style={{ fontSize: 14, color: "#1650D0" }}>🗺️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1650D0" }}>Réserver un trajet</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 11, paddingBottom: 11, borderRadius: 12 }}>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>📦</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Envoyer un colis</span>
          </div>
        </div>

        {/* Search Card */}
        <div style={{
          backgroundColor: "white", borderRadius: 32, padding: 26,
          boxShadow: "0 16px 36px rgba(22,80,208,0.18)",
          borderTop: "4px solid #1650D0",
        }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#7A8FAA", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                DÉPART
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#06101F", borderBottom: "2px solid #C7D2FE", paddingBottom: 9 }}>Abidjan</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF4FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2, border: "1.5px solid #BFD0FF" }}>
              <span style={{ color: "#1650D0", fontSize: 16 }}>⇄</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#7A8FAA", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
                ARRIVÉE
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#06101F", borderBottom: "2px solid #C7D2FE", paddingBottom: 9 }}>Bouaké</div>
            </div>
          </div>

          {/* City chips */}
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {["Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pédro"].map(c => (
              <div key={c} style={{ backgroundColor: "#EEF4FF", borderRadius: 22, padding: "8px 15px", border: "1.5px solid #C4D7FF" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1650D0" }}>{c}</span>
              </div>
            ))}
          </div>

          {/* Date + Passengers */}
          <div style={{ display: "flex", flexDirection: "row", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F4F6FC", borderRadius: 14, padding: "13px 14px", border: "1.5px solid #DDE2F0" }}>
              <span style={{ fontSize: 12 }}>📅</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#06101F" }}>2026-03-28</span>
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F6FC", borderRadius: 14, padding: "13px 14px", border: "1.5px solid #DDE2F0" }}>
              <span style={{ fontSize: 12 }}>👥</span>
              <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#1650D0", fontSize: 14, fontWeight: 700 }}>−</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#06101F", minWidth: 18, textAlign: "center" }}>1</span>
              <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#1650D0", fontSize: 14, fontWeight: 700 }}>+</span>
              </div>
            </div>
          </div>

          {/* Search button */}
          <div style={{
            background: "linear-gradient(90deg, #F97316, #E05500)",
            borderRadius: 18, paddingTop: 18, paddingBottom: 18,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: "0 8px 18px rgba(249,115,22,0.42)",
          }}>
            <span style={{ color: "white", fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: "white" }}>Rechercher des bus</span>
          </div>
        </div>
      </div>

      {/* ── CTA Row ── */}
      <div style={{ padding: "22px 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { icon: "🗺️", title: "Rechercher un trajet", sub: "Tous les bus depuis Abidjan, Bouaké…", color: "#1650D0" },
          { icon: "📦", title: "Envoyer un colis", sub: "Livraison sécurisée partout en Côte d'Ivoire", color: "#059669" },
        ].map(cta => (
          <div key={cta.title} style={{
            display: "flex", flexDirection: "row", alignItems: "center", gap: 18,
            backgroundColor: "white", borderRadius: 26, padding: 22,
            boxShadow: "0 10px 28px rgba(22,80,208,0.10)",
            border: `1px solid #E8ECFA`, borderLeft: `5px solid ${cta.color}`,
          }}>
            <div style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: "#EEF4FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 26 }}>
              {cta.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#06101F", letterSpacing: -0.3 }}>{cta.title}</div>
              <div style={{ fontSize: 13, color: "#7A8FAA", marginTop: 4, lineHeight: 1.5 }}>{cta.sub}</div>
            </div>
            <span style={{ color: "#CBD5E1", fontSize: 20 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
