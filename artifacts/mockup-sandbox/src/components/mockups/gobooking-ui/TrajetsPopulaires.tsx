const routes = [
  { from: "Abidjan", to: "Bouaké", duration: "5h 30m", price: 3500 },
  { from: "Abidjan", to: "Yamoussoukro", duration: "2h 30m", price: 2000 },
  { from: "Abidjan", to: "Korhogo", duration: "9h", price: 6000 },
  { from: "Bouaké", to: "Korhogo", duration: "3h 30m", price: 2500 },
  { from: "San Pedro", to: "Abidjan", duration: "4h", price: 3000 },
];

export function TrajetsPopulaires() {
  return (
    <div className="min-h-screen bg-[#E5E8F5]" style={{ padding: 16, paddingTop: 32 }}>

      {/* Section title */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-shrink-0" style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: "#1650D0" }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#06101F", margin: 0, letterSpacing: -0.5 }}>
          Trajets populaires
        </h2>
      </div>

      {/* Cards */}
      {routes.map((route, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "white",
            borderRadius: 24,
            paddingTop: 18, paddingBottom: 18,
            paddingLeft: 18, paddingRight: 18,
            marginBottom: 16,
            boxShadow: "0 8px 24px rgba(22,80,208,0.10)",
            border: "1px solid #E8ECFA",
            borderLeft: "4px solid #1650D0",
          }}
        >
          {/* Left: icon + cities + meta */}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 14, flex: 1, minWidth: 0, paddingRight: 10 }}>
            <div
              style={{
                width: 50, height: 50, borderRadius: 18,
                backgroundColor: "#EEF4FF",
                border: "1.5px solid #C7D9FF",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 18 }}>🧭</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Cities row */}
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0, marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#06101F", letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>
                  {route.from}
                </span>
                <div style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#F4F6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: "#94A3B8" }}>→</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1650D0", letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>
                  {route.to}
                </span>
              </div>
              {/* Duration */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12, color: "#A4B4C6" }}>🕐</span>
                <span style={{ fontSize: 12, color: "#A4B4C6", fontWeight: 500 }}>{route.duration}</span>
              </div>
            </div>
          </div>

          {/* Right: price + chevron */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
            <div style={{
              backgroundColor: "#EEF4FF", borderRadius: 14,
              padding: "8px 14px",
              display: "flex", flexDirection: "row", alignItems: "center", gap: 2,
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#1650D0", letterSpacing: -0.4 }}>
                {route.price.toLocaleString("fr-FR")}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1650D0" }}> F</span>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: "#1650D0",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "white", fontSize: 16, fontWeight: 700, lineHeight: 1 }}>›</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
