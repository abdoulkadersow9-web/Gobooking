import { useEffect, useState } from "react";

const PRIMARY = "#1A56DB";
const API = `https://${import.meta.env.VITE_DOMAIN ?? window.location.hostname}/api`;

async function loginDemo(): Promise<string | null> {
  try {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "compagnie@test.com", password: "test123" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.token ?? null;
  } catch { return null; }
}

async function apiFetch<T>(path: string, token: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${r.status}`); }
  return r.json();
}

interface SeatItem {
  id: string; number: string; row: number; column: number;
  type: string; status: string; price: number;
  bookingRef?: string | null; bookingStatus?: string | null;
  passenger?: { name: string; seatNumber: string } | null;
}

interface Trip { id: string; from: string; to: string; date: string; departureTime: string; totalSeats: number; busName: string }

const DEMO_TRIPS: Trip[] = [
  { id: "t1", from: "Abidjan", to: "Bouaké",       date: "17/03/2026", departureTime: "08h00", totalSeats: 49, busName: "Express Abidjan 01" },
  { id: "t2", from: "Abidjan", to: "Yamoussoukro", date: "17/03/2026", departureTime: "09h00", totalSeats: 59, busName: "Bouaké Direct 02" },
  { id: "t3", from: "Abidjan", to: "Korhogo",      date: "18/03/2026", departureTime: "07h00", totalSeats: 63, busName: "Yamoussoukro 03" },
];

const DEMO_PASSENGERS: Record<string, { name: string; bookingRef: string; bookingStatus: string }> = {
  "A3": { name: "Kouassi Ama",        bookingRef: "GBB5AKZ8DZ", bookingStatus: "confirmed" },
  "A4": { name: "Traoré Youssouf",    bookingRef: "GBB5AKZ8DZ", bookingStatus: "confirmed" },
  "B1": { name: "Bamba Koffi",        bookingRef: "GBB9MNX2PL", bookingStatus: "boarded"   },
  "B2": { name: "Diallo Mariam",      bookingRef: "GBBA1C3RQ7", bookingStatus: "confirmed" },
  "C1": { name: "Coulibaly Jean",     bookingRef: "GBB7FPV6NM", bookingStatus: "confirmed" },
  "C3": { name: "Assiéta Koné",       bookingRef: "GBBC5XK0TZ", bookingStatus: "boarded"   },
};

function genDemoSeats(tripId: string, total: number): SeatItem[] {
  const letters = ["A","B","C","D"];
  const rows = Math.ceil(total / 4);
  const seats: SeatItem[] = [];
  let idx = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < 4; c++) {
      idx++;
      if (idx > total) break;
      const num = `${letters[c]}${r}`;
      const pax = DEMO_PASSENGERS[num];
      let status: string = idx <= Math.floor(total * 0.63) ? "booked" : "available";
      if (num === "D1" || num === "D2") status = "blocked";
      seats.push({
        id: `${tripId}-${num}`, number: num, row: r, column: c,
        type: c === 1 ? "window" : "aisle", status: pax ? "booked" : status,
        price: 3500,
        passenger: pax ? { name: pax.name, seatNumber: num } : null,
        bookingRef: pax?.bookingRef ?? null,
        bookingStatus: pax?.bookingStatus ?? null,
      });
    }
  }
  return seats;
}

const BOOKING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmé",  color: PRIMARY  },
  boarded:   { label: "Embarqué",  color: "#059669" },
  cancelled: { label: "Annulé",    color: "#DC2626" },
};

export default function CompanySeats() {
  const [token, setToken] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip>(DEMO_TRIPS[0]);
  const [seats, setSeats]   = useState<SeatItem[]>(genDemoSeats("t1", 49));
  const [filter, setFilter] = useState<"all"|"available"|"booked"|"blocked">("all");
  const [selectedSeat, setSelectedSeat] = useState<SeatItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loginDemo().then(setToken); }, []);

  const loadSeats = (trip: Trip) => {
    setSelectedTrip(trip);
    setFilter("all");
    setSelectedSeat(null);
    const demo = genDemoSeats(trip.id, trip.totalSeats);
    setSeats(demo);
    if (token) {
      apiFetch<SeatItem[]>(`/company/seats/${trip.id}/detail`, token)
        .then(s => { if (s.length > 0) setSeats(s); })
        .catch(() => {});
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedSeat) return;
    const newStatus = selectedSeat.status === "blocked" ? "available" : "blocked";
    setActionLoading(true);
    try {
      if (token) {
        await apiFetch(`/company/seats/${selectedSeat.id}/status`, token, {
          method: "PATCH", body: JSON.stringify({ status: newStatus }),
        });
      }
    } catch {}
    setSeats(prev => prev.map(s => s.id === selectedSeat.id ? { ...s, status: newStatus } : s));
    setSelectedSeat(prev => prev ? { ...prev, status: newStatus } : null);
    setActionLoading(false);
  };

  const booked  = seats.filter(s => s.status === "booked").length;
  const avail   = seats.filter(s => s.status === "available").length;
  const blocked = seats.filter(s => s.status === "blocked").length;
  const revenue = seats.filter(s => s.status === "booked").reduce((sum, s) => sum + s.price, 0);
  const seatRows = Math.ceil(seats.length / 4);

  const getSeatStyle = (status: string) => {
    if (status === "booked")   return { bg: "#FEF2F2", border: "#FCA5A5", text: "#DC2626" };
    if (status === "blocked")  return { bg: "#F5F3FF", border: "#C4B5FD", text: "#7C3AED" };
    return { bg: "#ECFDF5", border: "#86EFAC", text: "#059669" };
  };

  return (
    <div style={{ fontFamily: "Inter,sans-serif", background: "#F8FAFC", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚌</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>Gestion des Sièges</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>TransCI — Tableau de bord compagnie</div>
        </div>
        <div style={{ marginLeft: "auto", background: "#EEF2FF", color: PRIMARY, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>Sièges</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", gap: 14 }}>

        {/* LEFT: Seat map */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
            {[
              { label: "Disponibles", count: avail,   color: "#059669", border: "#BBF7D0", bg: "#F0FDF4" },
              { label: "Réservés",    count: booked,  color: "#DC2626", border: "#FECACA", bg: "#FFF5F5" },
              { label: "Bloqués",     count: blocked, color: "#7C3AED", border: "#E9D5FF", bg: "#FAF5FF" },
              { label: "Taux",        count: `${Math.round((booked / Math.max(seats.length,1))*100)}%`, color: "#D97706", border: "#FDE68A", bg: "#FFFBEB" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Revenue */}
          <div style={{ background: "#ECFDF5", border: "1px solid #86EFAC", borderRadius: 12, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>📈</span>
            <span style={{ fontSize: 13, color: "#065F46", flex: 1 }}>Recettes sièges :</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>{revenue.toLocaleString("fr-CI")} FCFA</span>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
            {[
              { label: "Libre",   bg: "#ECFDF5", border: "#059669" },
              { label: "Réservé", bg: "#FEF2F2", border: "#DC2626" },
              { label: "Bloqué",  bg: "#F5F3FF", border: "#7C3AED" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: l.bg, border: `1.5px solid ${l.border}` }} />
                <span style={{ fontSize: 11, color: "#64748B" }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
            {(["all","available","booked","blocked"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid",
                  background: filter === f ? "#EEF2FF" : "#F8FAFC",
                  borderColor: filter === f ? PRIMARY : "#E2E8F0",
                  color: filter === f ? PRIMARY : "#64748B",
                }}>
                {f === "all" ? "Tous" : f === "available" ? "Disponibles" : f === "booked" ? "Réservés" : "Bloqués"}
              </button>
            ))}
          </div>

          {/* Trip switcher */}
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Changer de trajet</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 12 }}>
            {DEMO_TRIPS.map(t => (
              <button key={t.id} onClick={() => loadSeats(t)}
                style={{ minWidth: 120, padding: "7px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${selectedTrip.id === t.id ? PRIMARY : "#E2E8F0"}`,
                  background: selectedTrip.id === t.id ? "#EEF2FF" : "white",
                }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: selectedTrip.id === t.id ? PRIMARY : "#1E293B" }}>{t.from} → {t.to}</div>
                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{t.totalSeats} places</div>
              </button>
            ))}
          </div>

          {/* Seat map */}
          <div style={{ background: "white", borderRadius: 16, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ textAlign: "center", marginBottom: 12, fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              🚌 {selectedTrip.from} → {selectedTrip.to} · {selectedTrip.departureTime}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
              {Array.from({ length: seatRows }, (_, rowIdx) => (
                <div key={rowIdx} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 1].map(col => {
                    const s = seats.find(s => s.row === rowIdx + 1 && s.column === col);
                    if (!s) return <div key={col} style={{ width: 36, height: 32 }} />;
                    const isHidden = filter !== "all" && s.status !== filter;
                    const st = getSeatStyle(s.status);
                    const isSelected = selectedSeat?.id === s.id;
                    return (
                      <button key={col} onClick={() => setSelectedSeat(isSelected ? null : s)}
                        style={{ width: 36, height: 32, borderRadius: 7, background: isSelected ? st.border : st.bg,
                          border: `2px solid ${isSelected ? st.text : st.border}`,
                          color: st.text, fontSize: 9, fontWeight: 700, cursor: "pointer",
                          opacity: isHidden ? 0.2 : 1, transition: "all 0.15s",
                          transform: isSelected ? "scale(1.1)" : "scale(1)",
                        }}>
                        {s.number}
                      </button>
                    );
                  })}
                  <div style={{ width: 12 }} />
                  {[2, 3].map(col => {
                    const s = seats.find(s => s.row === rowIdx + 1 && s.column === col);
                    if (!s) return <div key={col} style={{ width: 36, height: 32 }} />;
                    const isHidden = filter !== "all" && s.status !== filter;
                    const st = getSeatStyle(s.status);
                    const isSelected = selectedSeat?.id === s.id;
                    return (
                      <button key={col} onClick={() => setSelectedSeat(isSelected ? null : s)}
                        style={{ width: 36, height: 32, borderRadius: 7, background: isSelected ? st.border : st.bg,
                          border: `2px solid ${isSelected ? st.text : st.border}`,
                          color: st.text, fontSize: 9, fontWeight: 700, cursor: "pointer",
                          opacity: isHidden ? 0.2 : 1, transition: "all 0.15s",
                          transform: isSelected ? "scale(1.1)" : "scale(1)",
                        }}>
                        {s.number}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Seat detail panel */}
        <div style={{ width: 200, flexShrink: 0 }}>
          {selectedSeat ? (
            <div style={{ background: "white", borderRadius: 16, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", position: "sticky", top: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>Siège {selectedSeat.number}</div>
                <button onClick={() => setSelectedSeat(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8", lineHeight: 1 }}>×</button>
              </div>

              {/* Status badge */}
              {(() => {
                const st = getSeatStyle(selectedSeat.status);
                const label = selectedSeat.status === "booked" ? "Réservé" : selectedSeat.status === "blocked" ? "Bloqué" : "Disponible";
                return (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: st.bg, border: `1px solid ${st.border}`, color: st.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, marginBottom: 14 }}>
                    {label}
                  </div>
                );
              })()}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#64748B" }}>Type</span>
                  <span style={{ fontWeight: 600, color: "#1E293B" }}>{selectedSeat.type === "window" ? "Fenêtre" : "Couloir"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#64748B" }}>Prix</span>
                  <span style={{ fontWeight: 600, color: "#1E293B" }}>{selectedSeat.price.toLocaleString("fr-CI")} F</span>
                </div>
              </div>

              {/* Passenger info */}
              {selectedSeat.status === "booked" && (
                <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 10, marginBottom: 14, border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{selectedSeat.passenger?.name ?? "Passager"}</span>
                  </div>
                  {selectedSeat.bookingRef && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: "#64748B" }}>Réf.</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#1E293B" }}>{selectedSeat.bookingRef}</span>
                    </div>
                  )}
                  {selectedSeat.bookingStatus && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: "#64748B" }}>Statut</span>
                      <span style={{ fontWeight: 700, color: BOOKING_STATUS_LABELS[selectedSeat.bookingStatus]?.color ?? PRIMARY }}>
                        {BOOKING_STATUS_LABELS[selectedSeat.bookingStatus]?.label ?? selectedSeat.bookingStatus}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action button */}
              {selectedSeat.status !== "booked" ? (
                <button onClick={handleToggleBlock} disabled={actionLoading}
                  style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", cursor: actionLoading ? "wait" : "pointer", fontWeight: 700, fontSize: 12,
                    background: selectedSeat.status === "blocked" ? "#059669" : "#7C3AED",
                    color: "white",
                  }}>
                  {actionLoading ? "En cours..." : selectedSeat.status === "blocked" ? "✓ Débloquer" : "⊘ Bloquer (maintenance)"}
                </button>
              ) : (
                <div style={{ padding: "10px", borderRadius: 10, background: "#F1F5F9", textAlign: "center", fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                  Siège réservé — non modifiable
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: "white", borderRadius: 16, padding: 16, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>Cliquez sur un siège pour voir ses détails</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
