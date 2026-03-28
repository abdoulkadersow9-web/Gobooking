import React, { useState } from "react";

/* ── Couleurs identiques à suivi.tsx ───────────────────────── */
const CAM_BG  = "#0A0E1A";
const CAM_GR  = "#22C55E";
const RED     = "#E11D48";
const RED_D   = "#9F1239";
const RED_M   = "#FDA4AF";
const RED_L   = "#FFF1F2";

/* ── Données simulées (reflètent l'API réelle) ──────────────── */
const BUSES = [
  {
    id: "bus-001",
    busName: "Abidjan Express 03",
    plateNumber: "3412 CI 03",
    logisticStatus: "en_route",
    currentLocation: "Axe Abidjan-Yamoussoukro, km 87",
    issue: null,
  },
  {
    id: "bus-002",
    busName: "Daloa Express 07",
    plateNumber: "0258 AB 07",
    logisticStatus: "en_attente",
    currentLocation: null,
    issue: "Panne en route — transféré le 27/03/2026",
  },
  {
    id: "bus-003",
    busName: "Korhogo Night 12",
    plateNumber: "7891 KR 12",
    logisticStatus: "en_panne",
    currentLocation: "Bouaké",
    issue: null,
  },
];

const TRIPS = [
  {
    id: "trip-001",
    busId: "bus-001",
    from: "Abidjan",
    to: "Yamoussoukro",
    departureTime: "08:00",
    etaTime: "11:30",
    cameraStatus: "connected",
    cameraStreamUrl: "https://example.com/stream.m3u8",
    cameraPosition: "intérieur",
    passengerCount: 34,
    seatCount: 55,
  },
  {
    id: "trip-002",
    busId: "bus-003",
    from: "Bouaké",
    to: "Korhogo",
    departureTime: "14:00",
    etaTime: "17:00",
    cameraStatus: "disconnected",
    cameraStreamUrl: null,
    cameraPosition: "conducteur",
    passengerCount: 12,
    seatCount: 45,
  },
];

const ALERTS = [
  {
    id: "alert-001",
    busId: "bus-001",
    type: "retard",
    message: "🕐 Retard estimé de 25 minutes sur le trajet Abidjan → Yamoussoukro",
    createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
  },
];

const BUS_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  en_route:  { label: "En route",  color: "#16A34A", bg: "#DCFCE7", icon: "▶" },
  en_attente:{ label: "En attente",color: "#D97706", bg: "#FEF3C7", icon: "⏸" },
  en_panne:  { label: "En panne",  color: "#DC2626", bg: "#FEE2E2", icon: "⚠" },
  arrivé:    { label: "Arrivé",    color: "#2563EB", bg: "#DBEAFE", icon: "✓" },
};

function BusCard({ bus }: { bus: typeof BUSES[0] }) {
  const st      = BUS_STATUS[bus.logisticStatus] ?? { label: bus.logisticStatus, color: "#64748B", bg: "#F1F5F9", icon: "🚌" };
  const trip    = TRIPS.find(t => t.busId === bus.id);
  const alerts  = ALERTS.filter(a => a.busId === bus.id);
  const camOk   = !!(trip?.cameraStatus === "connected" && trip?.cameraStreamUrl);
  const eta     = trip?.etaTime ?? null;
  const [watching, setWatching] = useState(false);

  return (
    <div style={{
      backgroundColor: "#fff",
      borderRadius: 14,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      borderLeft: alerts.length > 0 ? `3px solid ${RED}` : "none",
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          backgroundColor: st.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>
          {st.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{bus.busName}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{bus.plateNumber}</div>
        </div>
        <div style={{
          backgroundColor: st.bg, borderRadius: 8,
          padding: "4px 8px", alignSelf: "flex-start",
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: st.color }}>{st.label}</span>
        </div>
      </div>

      {/* Route row */}
      {trip && (
        <div style={{
          backgroundColor: "#F8FAFC", borderRadius: 10,
          padding: "8px 10px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
            <span style={{ fontSize: 13, color: "#1D4ED8" }}>⬡</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{trip.from}</span>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{trip.to}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ backgroundColor: "#E2E8F0", borderRadius: 6, padding: "4px 7px", display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11 }}>⏱</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>{trip.departureTime}</span>
            </div>
            {eta && (
              <div style={{ backgroundColor: "#F0FDF4", borderRadius: 6, padding: "4px 7px", display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 11 }}>🏁</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#15803D" }}>{eta}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GPS row */}
      {bus.currentLocation && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, paddingInline: 4 }}>
          <span style={{ color: "#7C3AED", fontSize: 13 }}>📍</span>
          <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600, flex: 1 }}>{bus.currentLocation}</span>
          <div style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: CAM_GR, marginLeft: 4 }} />
          <span style={{ fontSize: 10, color: CAM_GR, fontWeight: 700 }}>GPS actif</span>
        </div>
      )}

      {/* Camera panel */}
      <div style={{
        backgroundColor: CAM_BG,
        borderRadius: 12,
        padding: 12,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10,
        border: camOk ? "1px solid #166534" : "1px solid #1E293B",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          {/* Cam icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            backgroundColor: camOk ? "rgba(34,197,94,0.15)" : "#1E293B",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <span style={{ fontSize: 22 }}>📹</span>
            {camOk && (
              <div style={{
                position: "absolute", top: 4, right: 4,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: CAM_GR,
                border: `1.5px solid ${CAM_BG}`,
              }} />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 800,
                color: camOk ? CAM_GR : "#94A3B8",
                letterSpacing: "0.3px",
              }}>
                {camOk ? "CAMÉRA EMBARQUÉE · EN DIRECT" : "CAMÉRA EMBARQUÉE"}
              </span>
              {camOk && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  backgroundColor: "#DC2626", borderRadius: 5,
                  padding: "2px 6px",
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" }} />
                  <span style={{ color: "#fff", fontSize: 8, fontWeight: 900, letterSpacing: 1 }}>LIVE</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
              {camOk
                ? `Position : ${trip?.cameraPosition ?? "intérieur"} · Flux HLS actif`
                : trip
                  ? `Position prévue : ${trip.cameraPosition ?? "intérieur"} · Non connectée`
                  : "Aucun trajet actif · Caméra en veille"}
            </div>
          </div>
        </div>
        {camOk && trip ? (
          <button
            onClick={() => setWatching(!watching)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              backgroundColor: "rgba(34,197,94,0.12)",
              borderRadius: 8, padding: "8px 10px",
              border: "1px solid #166534", cursor: "pointer",
              color: CAM_GR, fontSize: 12, fontWeight: 800,
            }}
          >
            ▶ Voir
          </button>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            backgroundColor: "#1E293B", borderRadius: 8, padding: "6px 10px",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#475569" }} />
            <span style={{ color: "#475569", fontSize: 11, fontWeight: 600 }}>Hors ligne</span>
          </div>
        )}
      </div>

      {/* Inline alert */}
      {alerts.length > 0 && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          backgroundColor: RED_L, borderRadius: 10, padding: 10,
          border: `1px solid ${RED_M}`,
        }}>
          <span style={{ fontSize: 14, color: RED }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: RED_D, fontWeight: 700, lineHeight: 1.4 }}>{alerts[0].message}</div>
            <div style={{ fontSize: 10, color: RED, marginTop: 2 }}>
              {new Date(alerts[0].createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      )}

      {/* Issue badge */}
      {bus.issue && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8,
        }}>
          <span style={{ color: "#DC2626", fontSize: 14 }}>⚡</span>
          <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, flex: 1 }}>{bus.issue}</span>
        </div>
      )}

      {/* Trigger alert button */}
      <button style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "10px", borderRadius: 10,
        border: `1.5px solid ${RED_M}`, backgroundColor: RED_L, cursor: "pointer",
      }}>
        <span style={{ color: RED }}>⚠</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>Déclencher une alerte</span>
      </button>
    </div>
  );
}

export default function SuiviTCPreview() {
  const activeCamCount = TRIPS.filter(t => t.cameraStatus === "connected").length;
  const hasCameras = activeCamCount > 0;

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#E5E8F5",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #9F1239 0%, #E11D48 100%)",
        padding: "20px 16px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>🚦</div>
          <div>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>Tour de contrôle</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 1 }}>
              Suivi en temps réel
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasCameras && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              backgroundColor: "#052E16", borderRadius: 6,
              padding: "3px 8px",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR }} />
              <span style={{ color: CAM_GR, fontSize: 9, fontWeight: 900 }}>{activeCamCount} CAM LIVE</span>
            </div>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8,
            padding: "5px 8px",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CAM_GR }} />
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: 700 }}>Sync 10s</span>
          </div>
        </div>
      </div>

      {/* Alerte banner */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{
          backgroundColor: RED, borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: 14,
          boxShadow: `0 8px 24px ${RED}66`,
        }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: 0.5 }}>
            1 ALERTE ACTIVE — INTERVENTION REQUISE
          </span>
        </div>
      </div>

      {/* Bus cards section */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
            Bus en temps réel ({BUSES.length})
          </span>
          {hasCameras && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              backgroundColor: "#052E16", borderRadius: 8,
              padding: "4px 8px",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CAM_GR }} />
              <span style={{ color: CAM_GR, fontSize: 10, fontWeight: 800 }}>
                {activeCamCount} CAM LIVE
              </span>
            </div>
          )}
        </div>

        {BUSES.map(bus => <BusCard key={bus.id} bus={bus} />)}
      </div>

      {/* Legend */}
      <div style={{
        margin: "0 16px 24px",
        backgroundColor: "#fff",
        borderRadius: 12, padding: 12,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
          LÉGENDE — PANNEAU CAMÉRA
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 20, backgroundColor: CAM_BG, borderRadius: 4, border: "1px solid #166534", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: CAM_GR, fontSize: 8 }}>▶ LIVE</span>
          </div>
          <span style={{ fontSize: 11, color: "#374151" }}>Caméra connectée — flux HLS actif · bouton "Voir" disponible</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 20, backgroundColor: CAM_BG, borderRadius: 4, border: "1px solid #1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#475569", fontSize: 8 }}>● off</span>
          </div>
          <span style={{ fontSize: 11, color: "#374151" }}>Caméra déconnectée — panneau toujours affiché, état "Hors ligne"</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 32, backgroundColor: RED, borderRadius: 2 }} />
          <span style={{ fontSize: 11, color: "#374151" }}>Bordure rouge gauche = alerte active sur ce bus</span>
        </div>
      </div>
    </div>
  );
}
