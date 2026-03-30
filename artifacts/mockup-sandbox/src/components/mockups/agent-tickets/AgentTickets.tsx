import React, { useState } from "react";

const G       = "#D97706";
const G_DARK  = "#92400E";
const G_LIGHT = "#FEF3C7";

const TRIPS = [
  { id: "1", from: "Abidjan", to: "Bouaké",      departureTime: "07:00", date: "Lun 30 Mar", price: 5500,  guichetSeats: 8,  onlineSeats: 3, busType: "VIP" },
  { id: "2", from: "Abidjan", to: "Yamoussoukro", departureTime: "09:30", date: "Lun 30 Mar", price: 3500,  guichetSeats: 12, onlineSeats: 0, busType: "Classique" },
  { id: "3", from: "Abidjan", to: "San Pedro",   departureTime: "11:00", date: "Lun 30 Mar", price: 6500,  guichetSeats: 5,  onlineSeats: 7, busType: "VIP" },
  { id: "4", from: "Abidjan", to: "Korhogo",     departureTime: "14:00", date: "Lun 30 Mar", price: 8000,  guichetSeats: 0,  onlineSeats: 2, busType: "VIP" },
];

export default function AgentTickets() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"vente" | "depart" | "impression">("vente");

  return (
    <div style={styles.phone}>
      {/* Status bar */}
      <div style={styles.statusBar}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>09:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11 }}>●●●</span>
          <span style={{ fontSize: 11 }}>WiFi</span>
          <span style={{ fontSize: 11 }}>🔋</span>
        </div>
      </div>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerIcon}>
            <span style={{ fontSize: 18 }}>🎫</span>
          </div>
          <div>
            <div style={styles.headerTitle}>Espace Ticketing</div>
            <div style={styles.headerSub}>Vente guichet · En ligne</div>
          </div>
        </div>
        <button style={styles.logoutBtn}>⬡</button>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {(["vente", "depart", "impression"] as const).map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}>
            <span style={{ fontSize: 12 }}>
              {tab === "vente" ? "🎫" : tab === "depart" ? "🚌" : "🖨️"}
            </span>
            <span style={{ ...styles.tabTxt, ...(activeTab === tab ? styles.tabTxtActive : {}) }}>
              {tab === "vente" ? "Vente" : tab === "depart" ? "Départ" : "Impression"}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.scrollArea}>
        {/* Card: Sélectionner un trajet */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={{ fontSize: 16 }}>🚌</span>
            <span style={styles.cardTitle}>Sélectionner un trajet</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {TRIPS.map(trip => {
              const isSelected = selectedId === trip.id;
              const hasSeats   = trip.guichetSeats > 0;
              const hasOnline  = trip.onlineSeats > 0;

              return (
                <div
                  key={trip.id}
                  style={{ ...styles.tripCard, ...(isSelected ? styles.tripCardSel : {}) }}
                  onClick={() => setSelectedId(isSelected ? null : trip.id)}>

                  {/* Ligne 1 : Route + Prix */}
                  <div style={{ display: "flex", alignItems: "flex-start", cursor: "pointer" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={styles.tripCardRoute}>
                        {trip.from}
                        <span style={{ color: "#9CA3AF", fontSize: 14, margin: "0 6px" }}>→</span>
                        {trip.to}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>⏰</span>
                        <span style={styles.tripCardTime}>{trip.departureTime} · {trip.date}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", marginLeft: 12 }}>
                      <div style={styles.tripCardPrice}>{trip.price.toLocaleString()}</div>
                      <div style={styles.tripCardFcfa}>FCFA</div>
                    </div>
                  </div>

                  {/* Ligne 2 : Badges + icône sélection */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                    {hasSeats && (
                      <div style={styles.tripBadgeGreen}>
                        <span style={{ fontSize: 10 }}>🎫</span>
                        <span style={styles.tripBadgeGreenTxt}>{trip.guichetSeats} guichet</span>
                      </div>
                    )}
                    {hasOnline && (
                      <div style={styles.tripBadgeBlue}>
                        <span style={{ fontSize: 10 }}>📶</span>
                        <span style={styles.tripBadgeBlueTxt}>{trip.onlineSeats} en ligne</span>
                      </div>
                    )}
                    <div style={{ flex: 1 }} />
                    <div style={{ ...styles.tripSelIcon, ...(isSelected ? styles.tripSelIconActive : {}) }}>
                      <span style={{ fontSize: 11, color: isSelected ? "#fff" : "#9CA3AF" }}>
                        {isSelected ? "✓" : "▾"}
                      </span>
                    </div>
                  </div>

                  {/* Divider + bouton plan (visible quand sélectionné) */}
                  {isSelected && (
                    <>
                      <div style={styles.tripCardDivider} />
                      <button
                        style={styles.tripSeatPlanBtn}
                        onClick={e => { e.stopPropagation(); alert(`→ Plan des sièges : ${trip.from} → ${trip.to}`); }}>
                        <span style={{ fontSize: 14 }}>⊞</span>
                        <span style={styles.tripSeatPlanBtnTxt}>Voir le plan de sièges</span>
                        <span style={{ fontSize: 14, color: "#fff" }}>→</span>
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Card: Vente rapide (visible quand trajet sélectionné) */}
        {selectedId && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={{ fontSize: 16 }}>👤</span>
              <span style={styles.cardTitle}>Informations passager</span>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nom complet *</label>
              <input style={styles.input} placeholder="Ex: Kouamé Jean" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Téléphone *</label>
              <input style={styles.input} placeholder="Ex: 07 12 34 56 78" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Mode de paiement</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                {["Cash", "Wave", "MTN", "Orange"].map(m => (
                  <button key={m} style={styles.payChip}>{m}</button>
                ))}
              </div>
            </div>
            <button style={styles.submitBtn}>
              <span style={{ fontSize: 16 }}>✓</span>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Valider la vente</span>
            </button>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  phone: {
    width: 390,
    height: 844,
    borderRadius: 40,
    overflow: "hidden",
    background: "#FFFBEB",
    display: "flex",
    flexDirection: "column",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
    border: "10px solid #1a1a1a",
  },
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 20px 4px",
    background: "#92400E",
    color: "#fff",
  },
  header: {
    background: "linear-gradient(135deg, #92400E 0%, #D97706 100%)",
    padding: "14px 20px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRow: { display: "flex", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 42, height: 42, borderRadius: 12,
    background: "rgba(255,255,255,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: -0.3 },
  headerSub:   { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  logoutBtn: {
    background: "rgba(255,255,255,0.15)", border: "none",
    borderRadius: 10, padding: "8px 10px", color: "#fff", cursor: "pointer", fontSize: 16,
  },
  tabBar: {
    display: "flex",
    background: "#92400E",
    padding: "0 12px 10px",
    gap: 8,
  },
  tab: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    padding: "9px 4px", borderRadius: 10, border: "none",
    background: "rgba(255,255,255,0.1)", cursor: "pointer",
  },
  tabActive: { background: "#fff" },
  tabTxt: { fontSize: 12, fontWeight: 700, color: "#9CA3AF" },
  tabTxtActive: { color: "#92400E" },

  scrollArea: {
    flex: 1, overflowY: "auto", padding: "16px 16px 0",
    display: "flex", flexDirection: "column", gap: 14,
  },

  card: {
    background: "#fff", borderRadius: 16,
    padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    display: "flex", flexDirection: "column", gap: 10,
  },
  cardHeader: { display: "flex", alignItems: "center", gap: 8 },
  cardTitle:  { fontSize: 15, fontWeight: 700, color: "#111827" },

  tripCard: {
    border: "1.5px solid #E5E7EB", borderRadius: 14, padding: 16,
    background: "#fff", cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
  },
  tripCardSel: { borderColor: G, background: "#FFFBEB" },
  tripCardRoute: { fontSize: 16, fontWeight: 800, color: "#111827", letterSpacing: -0.2 },
  tripCardTime:  { fontSize: 12, color: "#6B7280" },
  tripCardPrice: { fontSize: 20, fontWeight: 800, color: G, letterSpacing: -0.5 },
  tripCardFcfa:  { fontSize: 11, color: "#9CA3AF", fontWeight: 600 },
  tripCardDivider: { height: 1, background: "#E5E7EB", margin: "14px 0" },

  tripBadgeGreen: {
    display: "flex", alignItems: "center", gap: 4,
    background: G_LIGHT, borderRadius: 8, padding: "5px 8px",
  },
  tripBadgeGreenTxt: { fontSize: 11, fontWeight: 700, color: G_DARK },
  tripBadgeBlue: {
    display: "flex", alignItems: "center", gap: 4,
    background: "#EFF6FF", borderRadius: 8, padding: "5px 8px",
  },
  tripBadgeBlueTxt: { fontSize: 11, fontWeight: 600, color: "#1D4ED8" },

  tripSelIcon: {
    width: 26, height: 26, borderRadius: 13,
    border: "1.5px solid #E5E7EB",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#F9FAFB",
  },
  tripSelIconActive: { borderColor: G, background: G },

  tripSeatPlanBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: G, borderRadius: 10, padding: "12px 16px",
    border: "none", cursor: "pointer",
    boxShadow: "0 4px 12px rgba(217,119,6,0.35)",
    width: "100%",
  },
  tripSeatPlanBtnTxt: { color: "#fff", fontWeight: 700, fontSize: 14 },

  formGroup: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 13, fontWeight: 500, color: "#374151" },
  input: {
    border: "1.5px solid #FDE68A", borderRadius: 10,
    padding: "11px 14px", fontSize: 14,
    background: G_LIGHT, color: "#111827", outline: "none",
  },
  payChip: {
    border: "2px solid #E5E7EB", borderRadius: 10,
    padding: "10px 18px", background: "#F9FAFB",
    fontSize: 13, color: "#6B7280", fontWeight: 500,
    cursor: "pointer",
  },
  submitBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    background: G, border: "none", borderRadius: 14,
    padding: "15px 20px", cursor: "pointer", marginTop: 4,
    boxShadow: "0 4px 16px rgba(217,119,6,0.35)",
    width: "100%",
  },
};
