const routes = [
  { from: "Abidjan", to: "Bouaké", duration: "5h 30m", price: 3500 },
  { from: "Abidjan", to: "Yamoussoukro", duration: "2h 30m", price: 2000 },
  { from: "Abidjan", to: "Korhogo", duration: "9h", price: 6000 },
  { from: "Bouaké", to: "Korhogo", duration: "3h 30m", price: 2500 },
  { from: "San Pedro", to: "Abidjan", duration: "4h", price: 3000 },
];

export function TrajetsPopulaires() {
  return (
    <div className="min-h-screen bg-[#E5E8F5] px-5 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-6 rounded-full bg-[#1650D0]" />
        <h2 className="text-[22px] font-bold text-[#06101F] tracking-tight">Trajets populaires</h2>
      </div>

      <div className="flex flex-col gap-0">
        {routes.map((route, i) => (
          <div
            key={i}
            className="flex flex-row items-center justify-between bg-white rounded-[28px] px-[22px] py-[22px] mb-[22px]"
            style={{
              borderWidth: 1,
              borderColor: "#E8ECFA",
              borderLeftWidth: 5,
              borderLeftColor: "#1650D0",
              boxShadow: "0 10px 30px rgba(22,80,208,0.12)",
            }}
          >
            {/* Left side */}
            <div className="flex flex-row items-center gap-4 flex-1 pr-3">
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 54, height: 54, borderRadius: 20,
                  backgroundColor: "#EEF4FF",
                  border: "1.5px solid #C7D9FF",
                }}
              >
                <span style={{ fontSize: 18 }}>🧭</span>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                {/* Cities row */}
                <div className="flex flex-row items-center gap-[6px]">
                  <span className="text-[16px] font-bold text-[#06101F] tracking-tight">{route.from}</span>
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#F4F6FF" }}
                  >
                    <span style={{ fontSize: 10 }}>→</span>
                  </div>
                  <span className="text-[16px] font-bold text-[#1650D0] tracking-tight">{route.to}</span>
                </div>

                {/* Duration meta */}
                <div className="flex flex-row items-center gap-[5px]">
                  <span style={{ fontSize: 12, color: "#A4B4C6" }}>🕐</span>
                  <span className="text-[12px] font-medium text-[#A4B4C6]">{route.duration}</span>
                </div>
              </div>
            </div>

            {/* Right side — prix + chevron */}
            <div className="flex flex-col items-end gap-[10px] flex-shrink-0">
              <div
                className="flex flex-row items-center gap-[2px]"
                style={{
                  backgroundColor: "#EEF4FF",
                  borderRadius: 14,
                  paddingLeft: 14, paddingRight: 14,
                  paddingTop: 8, paddingBottom: 8,
                }}
              >
                <span className="text-[18px] font-bold text-[#1650D0] tracking-tight">
                  {route.price.toLocaleString("fr-FR")}
                </span>
                <span className="text-[11px] font-bold text-[#1650D0]"> FCFA</span>
              </div>

              <div
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#1650D0" }}
              >
                <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>›</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
