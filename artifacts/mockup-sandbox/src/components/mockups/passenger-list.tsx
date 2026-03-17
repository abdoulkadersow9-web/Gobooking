import { useState, useMemo } from "react";

const GREEN   = "#059669";
const PRIMARY = "#1A56DB";
const ORANGE  = "#D97706";

interface Passenger {
  id: string;
  name: string;
  seat: string;
  phone: string;
  bookingRef: string;
  validated: boolean;
}

const INITIAL: Passenger[] = [
  { id:"p1",  name:"Kouassi Ama",       seat:"A3",  phone:"07 12 34 56 78", bookingRef:"GBB5AKZ8DZ", validated: true  },
  { id:"p2",  name:"Traoré Youssouf",   seat:"A4",  phone:"05 98 76 54 32", bookingRef:"GBB5AKZ8DZ", validated: true  },
  { id:"p3",  name:"Bamba Koffi",       seat:"B1",  phone:"01 23 45 67 89", bookingRef:"GBB9MNX2PL", validated: false },
  { id:"p4",  name:"Diallo Mariam",     seat:"B2",  phone:"07 65 43 21 09", bookingRef:"GBBA1C3RQ7", validated: false },
  { id:"p5",  name:"Coulibaly Jean",    seat:"C1",  phone:"05 11 22 33 44", bookingRef:"GBB7FPV6NM", validated: true  },
  { id:"p6",  name:"Assiéta Koné",      seat:"C3",  phone:"01 55 66 77 88", bookingRef:"GBBC5XK0TZ", validated: false },
  { id:"p7",  name:"Sanogo Ibrahim",    seat:"D2",  phone:"07 44 55 66 77", bookingRef:"GBB2QRT4HX", validated: false },
  { id:"p8",  name:"Ouattara Fatou",    seat:"D4",  phone:"05 33 22 11 00", bookingRef:"GBB8YWL3NV", validated: true  },
  { id:"p9",  name:"Dembélé Moussa",    seat:"E1",  phone:"01 99 88 77 66", bookingRef:"GBB4MXZ7KP", validated: false },
  { id:"p10", name:"Koné Adjoua",       seat:"E3",  phone:"07 22 33 44 55", bookingRef:"GBBF6TPB2R", validated: false },
  { id:"p11", name:"Bah Aminata",       seat:"F2",  phone:"05 77 88 99 00", bookingRef:"GBB1CSZ9WQ", validated: true  },
  { id:"p12", name:"Doumbia Seydou",    seat:"F4",  phone:"01 44 33 22 11", bookingRef:"GBB3VHK8DL", validated: false },
];

export default function PassengerList() {
  const [passengers, setPassengers] = useState<Passenger[]>(INITIAL);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<"all" | "validated" | "pending">("all");
  const [toast,      setToast]      = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const validate = (id: string) => {
    setPassengers(prev => prev.map(p => p.id === id ? { ...p, validated: true } : p));
    const p = passengers.find(p => p.id === id);
    if (p) showToast(`✅ Ticket de ${p.name} validé`);
  };

  const filtered = useMemo(() => {
    let list = passengers;
    if (filter === "validated") list = list.filter(p => p.validated);
    if (filter === "pending")   list = list.filter(p => !p.validated);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.seat.toLowerCase().includes(q) ||
        p.bookingRef.toLowerCase().includes(q)
      );
    }
    return list;
  }, [passengers, search, filter]);

  const totalValidated = passengers.filter(p => p.validated).length;
  const total          = passengers.length;
  const pct            = Math.round((totalValidated / total) * 100);

  return (
    <div style={{
      fontFamily: "Inter, -apple-system, sans-serif",
      background: "#F8FAFC", minHeight: "100vh",
      display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto",
      position: "relative",
    }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "absolute", top: 76, left: 12, right: 12, zIndex: 100,
          background: "#ECFDF5", border: "1.5px solid #6EE7B7", borderRadius: 12,
          padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#065F46",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 8,
        }}>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${GREEN} 0%, #047857 100%)`,
        padding: "14px 16px 16px", flexShrink: 0,
        boxShadow: "0 2px 12px rgba(5,150,105,0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{
            width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.2)",
            border: "none", cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 16, color: "white", fontWeight: 700,
          }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>
              Liste des voyageurs
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.78)", marginTop: 1 }}>
              Abidjan → Bouaké · 17/03/2026 · 08h00
            </div>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.18)", color: "white",
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.3)",
          }}>
            {totalValidated}/{total}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
              Embarquement
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.25)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: "white", borderRadius: 99,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      </div>

      {/* ── Search + filters ── */}
      <div style={{ padding: "12px 12px 0", flexShrink: 0 }}>
        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "white", borderRadius: 14, padding: "10px 14px",
          border: "1.5px solid #E2E8F0", marginBottom: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            type="text"
            placeholder="Rechercher un passager, siège, réf…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, border: "none", outline: "none", fontSize: 13,
              color: "#1E293B", background: "transparent",
              fontFamily: "inherit",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94A3B8", lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {([
            { key: "all",       label: `Tous (${total})` },
            { key: "validated", label: `✓ Validés (${totalValidated})` },
            { key: "pending",   label: `⏳ En attente (${total - totalValidated})` },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: "pointer", border: "1.5px solid",
                background:   filter === f.key ? (f.key === "validated" ? "#ECFDF5" : f.key === "pending" ? "#FFFBEB" : "#EEF2FF") : "#F8FAFC",
                borderColor:  filter === f.key ? (f.key === "validated" ? GREEN : f.key === "pending" ? ORANGE : PRIMARY) : "#E2E8F0",
                color:        filter === f.key ? (f.key === "validated" ? GREEN : f.key === "pending" ? ORANGE : PRIMARY) : "#64748B",
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Passenger list ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#94A3B8" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Aucun passager trouvé</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((p, idx) => (
              <div key={p.id} style={{
                background: "white", borderRadius: 14, padding: "13px 14px",
                border: `1.5px solid ${p.validated ? "#D1FAE5" : "#E2E8F0"}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: p.validated ? "#ECFDF5" : "#EEF2FF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 800,
                  color: p.validated ? GREEN : PRIMARY,
                }}>
                  {p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "#1E293B",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginBottom: 3,
                  }}>
                    {p.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {/* Seat badge */}
                    <span style={{
                      background: "#EEF2FF", color: PRIMARY,
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                    }}>
                      🪑 {p.seat}
                    </span>
                    {/* Status badge */}
                    <span style={{
                      background: p.validated ? "#ECFDF5" : "#FFFBEB",
                      color:      p.validated ? GREEN      : ORANGE,
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                      border: `1px solid ${p.validated ? "#6EE7B7" : "#FDE68A"}`,
                    }}>
                      {p.validated ? "✓ Validé" : "⏳ Non validé"}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, fontFamily: "monospace" }}>
                    {p.bookingRef}
                  </div>
                </div>

                {/* Action */}
                {p.validated ? (
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: "#ECFDF5",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>✓</div>
                ) : (
                  <button onClick={() => validate(p.id)}
                    style={{
                      padding: "8px 12px", borderRadius: 10, border: "none",
                      background: GREEN, color: "white", fontSize: 11, fontWeight: 700,
                      cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                      boxShadow: "0 2px 6px rgba(5,150,105,0.35)",
                    }}>
                    Valider
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom summary bar ── */}
      <div style={{
        background: "white", borderTop: "1px solid #E2E8F0",
        padding: "11px 14px 15px", flexShrink: 0,
        boxShadow: "0 -2px 10px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ flex: 1, display: "flex", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>{totalValidated}</div>
            <div style={{ fontSize: 9, color: "#64748B", marginTop: 1 }}>Validés</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: ORANGE }}>{total - totalValidated}</div>
            <div style={{ fontSize: 9, color: "#64748B", marginTop: 1 }}>En attente</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#64748B" }}>{total}</div>
            <div style={{ fontSize: 9, color: "#64748B", marginTop: 1 }}>Total</div>
          </div>
        </div>
        <button style={{
          padding: "11px 18px", borderRadius: 12, border: "none",
          background: totalValidated === total ? GREEN : PRIMARY,
          color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
          transition: "background 0.3s",
        }}>
          {totalValidated === total ? "✓ Tous validés" : "Clore l'embarquement"}
        </button>
      </div>
    </div>
  );
}
