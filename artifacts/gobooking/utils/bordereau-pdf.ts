/**
 * Module 4 — Bordereau Auto PDF
 * Génération HTML → PDF via expo-print
 *
 * 2 versions :
 *  - "entreprise" : avec tous les montants, résumé financier complet
 *  - "route"      : sans aucun montant, pour impression agent route
 */

export interface PdfPassenger {
  bookingRef: string;
  name: string;
  phone: string;
  status: string;
  seatNums: string[];
  price: number;
}

export interface PdfBagage {
  id: string;
  trackingRef: string;
  passengerName: string;
  bagageType: string;
  weightKg: number | null;
  price: number;
  photoUrl: string | null;
  status: string;
}

export interface PdfColis {
  id: string;
  trackingRef: string;
  senderName: string;
  receiverName: string;
  fromCity: string;
  toCity: string;
  parcelType: string;
  weight: number;
  amount: number;
  photoUrl: string | null;
  status: string;
}

export interface PdfExpense {
  id: string;
  type: string;
  amount: number;
  description: string | null;
}

export interface PdfAgent {
  user_id: number;
  agent_role: string;
  name: string;
  contact: string;
  recorded_at: string;
}

export interface PdfTrip {
  from: string;
  to: string;
  date: string;
  departureTime: string;
  busName: string;
  busType?: string;
}

export interface PdfSummary {
  totalPassengers: number;
  boardedCount: number;
  absentCount: number;
  bagageCount: number;
  colisCount: number;
  totalPassengerRevenue: number;
  totalBagageRevenue: number;
  totalColisRevenue: number;
  totalExpenses: number;
  netRevenue: number;
}

export interface BordereauData {
  trip: PdfTrip;
  boarded: PdfPassenger[];
  absents: PdfPassenger[];
  bagages: PdfBagage[];
  colis: PdfColis[];
  expenses: PdfExpense[];
  summary: PdfSummary;
  agents?: PdfAgent[];
  validatedBy?: string;
  validatedAt?: string;
}

/* ─── helpers ─── */
const formatFcfa = (n: number) => n.toLocaleString("fr-CI") + " FCFA";
const today = () => new Date().toLocaleDateString("fr-CI", { day: "2-digit", month: "long", year: "numeric" });
const nowTime = () => new Date().toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit" });

/* ── Shared CSS ── */
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: #fff; color: #0F172A; font-size: 11px; }
  .page { padding: 20px 24px; max-width: 800px; margin: 0 auto; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #4338CA; margin-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-dot { width: 36px; height: 36px; border-radius: 10px; background: #4338CA; display: flex; align-items: center; justify-content: center; }
  .brand-dot span { color: #fff; font-size: 18px; font-weight: 900; }
  .brand-name { font-size: 20px; font-weight: 900; color: #4338CA; letter-spacing: -0.5px; }
  .brand-sub { font-size: 10px; color: #64748B; margin-top: 1px; }
  .header-right { text-align: right; font-size: 10px; color: #64748B; }
  .doc-title { font-size: 13px; font-weight: 800; color: #0F172A; }

  /* Trip banner */
  .trip-banner { background: linear-gradient(135deg, #4338CA 0%, #6366F1 100%); color: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
  .trip-route { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
  .trip-meta { font-size: 11px; opacity: 0.8; margin-top: 3px; }
  .trip-status { background: #10B981; color: #fff; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; }

  /* Stats row */
  .stats-row { display: flex; gap: 10px; margin-bottom: 16px; }
  .stat-card { flex: 1; border-radius: 10px; padding: 12px; text-align: center; border-top: 3px solid; }
  .stat-val { font-size: 20px; font-weight: 900; }
  .stat-label { font-size: 9px; font-weight: 600; color: #64748B; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Section */
  .section { margin-bottom: 18px; }
  .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid; }
  .section-icon { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
  .section-title { font-size: 13px; font-weight: 800; }
  .section-count { margin-left: auto; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #F8FAFC; font-weight: 700; text-align: left; padding: 7px 10px; color: #64748B; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #E2E8F0; }
  td { padding: 7px 10px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #FAFAFA; }
  .ref { font-family: monospace; font-size: 10px; background: #F1F5F9; padding: 2px 5px; border-radius: 4px; color: #4338CA; }
  .status-badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 9px; font-weight: 700; }
  .absent-badge { background: #FEF3C7; color: #92400E; }

  /* Colis photo */
  .colis-photo { width: 38px; height: 38px; border-radius: 6px; object-fit: cover; border: 1px solid #E2E8F0; }
  .no-photo { width: 38px; height: 38px; border-radius: 6px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px solid #E2E8F0; }

  /* Financial (entreprise only) */
  .financial-card { background: #F8FAFC; border-radius: 12px; padding: 16px; border: 1px solid #E2E8F0; }
  .financial-row { display: flex; justify-content: space-between; padding: 5px 0; }
  .financial-label { color: #64748B; font-weight: 600; }
  .financial-value { font-weight: 700; }
  .financial-divider { border: none; border-top: 1px solid #E2E8F0; margin: 8px 0; }
  .financial-total { display: flex; justify-content: space-between; background: #EEF2FF; border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
  .financial-total-label { font-size: 13px; font-weight: 800; }
  .financial-total-value { font-size: 15px; font-weight: 900; color: #4338CA; }

  /* Footer */
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; color: #94A3B8; font-size: 9px; }
  .signature-box { border: 1px dashed #CBD5E1; border-radius: 8px; padding: 16px 24px; margin-top: 16px; display: flex; gap: 40px; }
  .sig-line { flex: 1; }
  .sig-label { font-size: 10px; font-weight: 600; color: #64748B; margin-bottom: 24px; }
  .sig-underline { border-bottom: 1px solid #94A3B8; height: 20px; }
  .watermark-route { position: fixed; bottom: 60px; right: 30px; opacity: 0.06; font-size: 72px; font-weight: 900; color: #059669; transform: rotate(-20deg); pointer-events: none; }
  .watermark-ent   { position: fixed; bottom: 60px; right: 30px; opacity: 0.06; font-size: 72px; font-weight: 900; color: #4338CA; transform: rotate(-20deg); pointer-events: none; }
`;

/* ── Build a passenger row ── */
const passengerRow = (p: PdfPassenger, showPrice: boolean) => `
  <tr>
    <td><span class="ref">${p.bookingRef}</span></td>
    <td style="font-weight:700">${p.name}</td>
    <td>${p.phone}</td>
    <td>${(p.seatNums ?? []).join(", ") || "—"}</td>
    ${showPrice ? `<td style="font-weight:700;text-align:right">${formatFcfa(p.price ?? 0)}</td>` : ""}
  </tr>`;

/* ── Build a bagage row ── */
const bagageRow = (b: PdfBagage, showPrice: boolean) => `
  <tr>
    <td><span class="ref">${b.trackingRef}</span></td>
    <td style="font-weight:700">${b.passengerName}</td>
    <td>${b.bagageType}</td>
    <td>${b.weightKg != null ? b.weightKg + " kg" : "—"}</td>
    <td><span class="status-badge" style="background:#D1FAE5;color:#065F46">${b.status}</span></td>
    ${showPrice ? `<td style="font-weight:700;text-align:right">${formatFcfa(b.price ?? 0)}</td>` : ""}
  </tr>`;

/* ── Build a colis row ── */
const colisRow = (c: PdfColis, showPrice: boolean) => `
  <tr>
    <td>${c.photoUrl ? `<img src="${c.photoUrl}" class="colis-photo" />` : `<div class="no-photo">📦</div>`}</td>
    <td><span class="ref">${c.trackingRef}</span></td>
    <td style="font-weight:700">${c.senderName}</td>
    <td>${c.receiverName}</td>
    <td>${c.fromCity} → ${c.toCity}</td>
    <td>${c.parcelType} · ${c.weight}kg</td>
    ${showPrice ? `<td style="font-weight:700;text-align:right">${formatFcfa(c.amount ?? 0)}</td>` : ""}
  </tr>`;

/* ═══════════════════════════════════════════════════════
   VERSION ENTREPRISE — avec tous les montants
═══════════════════════════════════════════════════════ */
/* ── Helper : bloc agents en service ── */
const ROLE_LABELS: Record<string, string> = {
  agent_ticket:          "Agent Ticket",
  bagage:                "Agent Bagage",
  agent_colis:           "Agent Colis",
  agent_embarquement:    "Agent Embarquement",
  validation_depart:     "Agent Validation",
  guichet:               "Guichet",
  vente:                 "Vente",
};
function agentsSection(agents: PdfAgent[] | undefined, accentColor: string): string {
  if (!agents || agents.length === 0) return "";
  return `
  <div class="section">
    <div class="section-header" style="border-color:${accentColor};">
      <div class="section-icon" style="background:${accentColor}22;">👷</div>
      <span class="section-title" style="color:${accentColor}">Équipe en service (${agents.length})</span>
    </div>
    <table>
      <thead>
        <tr><th>#</th><th>Nom</th><th>Rôle</th><th>Contact</th><th>Enregistré à</th></tr>
      </thead>
      <tbody>${agents.map((a, i) => `
        <tr>
          <td style="color:#94A3B8;font-size:9px">${i + 1}</td>
          <td style="font-weight:700">${a.name}</td>
          <td><span style="background:${accentColor}18;color:${accentColor};padding:2px 7px;border-radius:8px;font-size:9px;font-weight:700">${ROLE_LABELS[a.agent_role] ?? a.agent_role}</span></td>
          <td style="color:#475569">${a.contact || "—"}</td>
          <td style="color:#94A3B8;font-size:9px">${a.recorded_at ? new Date(a.recorded_at).toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

export function generateBordereauEntreprise(data: BordereauData): string {
  const { trip, boarded, absents, bagages, colis, expenses, summary, agents, validatedBy, validatedAt } = data;
  const s = summary;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bordereau Départ — ${trip.from} → ${trip.to}</title>
  <style>${BASE_CSS}
    /* Entreprise specific */
    .ent-label { display: inline-block; background: #EEF2FF; color: #4338CA; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 20px; margin-left: 8px; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-dot"><span>G</span></div>
      <div>
        <div class="brand-name">GoBooking</div>
        <div class="brand-sub">Plateforme de transport Côte d'Ivoire</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">BORDEREAU DE DÉPART <span class="ent-label">ENTREPRISE</span></div>
      <div>Généré le ${today()} à ${nowTime()}</div>
      ${validatedBy ? `<div>Validé par : <strong>${validatedBy}</strong></div>` : ""}
    </div>
  </div>

  <!-- Trip banner -->
  <div class="trip-banner">
    <div>
      <div class="trip-route">${trip.from} &nbsp;→&nbsp; ${trip.to}</div>
      <div class="trip-meta">${trip.date} · Départ ${trip.departureTime} · ${trip.busName}${trip.busType ? ` (${trip.busType})` : ""}</div>
    </div>
    <div class="trip-status">✓ En route</div>
  </div>

  <!-- Stats cards -->
  <div class="stats-row">
    <div class="stat-card" style="background:#F0FDF4;border-color:#059669;">
      <div class="stat-val" style="color:#059669">${s.boardedCount}</div>
      <div class="stat-label">Embarqués</div>
    </div>
    <div class="stat-card" style="background:#FFFBEB;border-color:#D97706;">
      <div class="stat-val" style="color:#D97706">${s.absentCount}</div>
      <div class="stat-label">Absents</div>
    </div>
    <div class="stat-card" style="background:#FEF3C7;border-color:#92400E;">
      <div class="stat-val" style="color:#92400E">${s.bagageCount}</div>
      <div class="stat-label">Bagages</div>
    </div>
    <div class="stat-card" style="background:#EEF2FF;border-color:#4338CA;">
      <div class="stat-val" style="color:#4338CA">${s.colisCount}</div>
      <div class="stat-label">Colis</div>
    </div>
    <div class="stat-card" style="background:#F8FAFC;border-color:#64748B;">
      <div class="stat-val" style="color:#4338CA">${formatFcfa(s.netRevenue)}</div>
      <div class="stat-label">Net total</div>
    </div>
  </div>

  <!-- Passagers embarqués -->
  <div class="section">
    <div class="section-header" style="border-color:#059669;">
      <div class="section-icon" style="background:#D1FAE5;">👥</div>
      <span class="section-title" style="color:#059669">Passagers embarqués</span>
      <span class="section-count" style="background:#D1FAE5;color:#065F46">${s.boardedCount} pax</span>
      <span style="margin-left:auto;font-weight:700;color:#059669">${formatFcfa(s.totalPassengerRevenue)}</span>
    </div>
    ${boarded.length === 0 ? '<p style="color:#94A3B8;font-style:italic;font-size:10px">Aucun passager embarqué</p>' : `
    <table>
      <thead>
        <tr><th>Réf. billet</th><th>Nom</th><th>Téléphone</th><th>Siège(s)</th><th style="text-align:right">Montant</th></tr>
      </thead>
      <tbody>${boarded.map(p => passengerRow(p, true)).join("")}</tbody>
    </table>`}
  </div>

  <!-- Absents -->
  ${absents.length > 0 ? `
  <div class="section">
    <div class="section-header" style="border-color:#D97706;">
      <div class="section-icon" style="background:#FEF3C7;">🚫</div>
      <span class="section-title" style="color:#D97706">Passagers absents</span>
      <span class="section-count" style="background:#FEF3C7;color:#92400E">${s.absentCount}</span>
    </div>
    <table>
      <thead>
        <tr><th>Réf. billet</th><th>Nom</th><th>Téléphone</th><th>Siège(s)</th><th style="text-align:right">Montant</th></tr>
      </thead>
      <tbody>${absents.map(p => `
        <tr>
          <td><span class="ref">${p.bookingRef}</span></td>
          <td style="font-weight:700;opacity:0.6">${p.name}</td>
          <td style="opacity:0.6">${p.phone}</td>
          <td style="opacity:0.6">${(p.seatNums ?? []).join(", ") || "—"}</td>
          <td style="text-align:right;opacity:0.6"><span class="status-badge absent-badge">Absent</span></td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  <!-- Bagages -->
  <div class="section">
    <div class="section-header" style="border-color:#92400E;">
      <div class="section-icon" style="background:#FEF3C7;">🧳</div>
      <span class="section-title" style="color:#92400E">Bagages</span>
      <span class="section-count" style="background:#FEF3C7;color:#92400E">${s.bagageCount}</span>
      <span style="margin-left:auto;font-weight:700;color:#92400E">${formatFcfa(s.totalBagageRevenue)}</span>
    </div>
    ${bagages.length === 0 ? '<p style="color:#94A3B8;font-style:italic;font-size:10px">Aucun bagage enregistré</p>' : `
    <table>
      <thead>
        <tr><th>Référence</th><th>Passager</th><th>Type</th><th>Poids</th><th>Statut</th><th style="text-align:right">Montant</th></tr>
      </thead>
      <tbody>${bagages.map(b => bagageRow(b, true)).join("")}</tbody>
    </table>`}
  </div>

  <!-- Colis -->
  <div class="section">
    <div class="section-header" style="border-color:#4338CA;">
      <div class="section-icon" style="background:#EEF2FF;">📦</div>
      <span class="section-title" style="color:#4338CA">Colis</span>
      <span class="section-count" style="background:#EEF2FF;color:#4338CA">${s.colisCount}</span>
      <span style="margin-left:auto;font-weight:700;color:#4338CA">${formatFcfa(s.totalColisRevenue)}</span>
    </div>
    ${colis.length === 0 ? '<p style="color:#94A3B8;font-style:italic;font-size:10px">Aucun colis chargé</p>' : `
    <table>
      <thead>
        <tr><th>Photo</th><th>Référence</th><th>Expéditeur</th><th>Destinataire</th><th>Trajet</th><th>Type · Poids</th><th style="text-align:right">Montant</th></tr>
      </thead>
      <tbody>${colis.map(c => colisRow(c, true)).join("")}</tbody>
    </table>`}
  </div>

  <!-- Dépenses -->
  ${expenses.length > 0 ? `
  <div class="section">
    <div class="section-header" style="border-color:#DC2626;">
      <div class="section-icon" style="background:#FEE2E2;">💸</div>
      <span class="section-title" style="color:#DC2626">Dépenses</span>
      <span class="section-count" style="background:#FEE2E2;color:#DC2626">${expenses.length}</span>
      <span style="margin-left:auto;font-weight:700;color:#DC2626">− ${formatFcfa(s.totalExpenses)}</span>
    </div>
    <table>
      <thead><tr><th>Type</th><th>Description</th><th style="text-align:right">Montant</th></tr></thead>
      <tbody>${expenses.map(e => `
        <tr>
          <td style="font-weight:700;text-transform:capitalize">${e.type}</td>
          <td>${e.description ?? "—"}</td>
          <td style="font-weight:700;color:#DC2626;text-align:right">− ${formatFcfa(e.amount ?? 0)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  <!-- Résumé financier -->
  <div class="section">
    <div class="section-header" style="border-color:#4338CA;">
      <div class="section-icon" style="background:#EEF2FF;">📊</div>
      <span class="section-title" style="color:#4338CA">Résumé financier</span>
    </div>
    <div class="financial-card">
      <div class="financial-row">
        <span class="financial-label">Billets passagers (${s.boardedCount} pax)</span>
        <span class="financial-value">${formatFcfa(s.totalPassengerRevenue)}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">Bagages (${s.bagageCount})</span>
        <span class="financial-value" style="color:#92400E">${formatFcfa(s.totalBagageRevenue)}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">Colis (${s.colisCount})</span>
        <span class="financial-value" style="color:#4338CA">${formatFcfa(s.totalColisRevenue)}</span>
      </div>
      <hr class="financial-divider" />
      <div class="financial-row">
        <span class="financial-label">Sous-total recettes</span>
        <span class="financial-value">${formatFcfa(s.totalPassengerRevenue + s.totalBagageRevenue + s.totalColisRevenue)}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">Dépenses (${expenses.length})</span>
        <span class="financial-value" style="color:#DC2626">− ${formatFcfa(s.totalExpenses)}</span>
      </div>
      <div class="financial-total">
        <span class="financial-total-label">RECETTE NETTE</span>
        <span class="financial-total-value">${formatFcfa(s.netRevenue)}</span>
      </div>
    </div>
  </div>

  ${agentsSection(agents, "#4338CA")}

  <!-- Signatures -->
  <div class="signature-box">
    <div class="sig-line">
      <div class="sig-label">Agent Validation — Signature</div>
      <div class="sig-underline"></div>
    </div>
    <div class="sig-line">
      <div class="sig-label">Responsable Compagnie — Signature</div>
      <div class="sig-underline"></div>
    </div>
    <div class="sig-line">
      <div class="sig-label">Cachet / Tampon</div>
      <div class="sig-underline"></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>GoBooking — Plateforme de transport Côte d'Ivoire</span>
    <span>Document confidentiel — Usage interne entreprise</span>
    <span>${trip.from} → ${trip.to} · ${trip.date}</span>
  </div>

  <div class="watermark-ent">ENTREPRISE</div>
</div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════
   VERSION AGENT ROUTE — sans aucun montant
═══════════════════════════════════════════════════════ */
export function generateBordereauRoute(data: BordereauData): string {
  const { trip, boarded, absents, bagages, colis, summary: s, agents, validatedBy } = data;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bordereau Route — ${trip.from} → ${trip.to}</title>
  <style>${BASE_CSS}
    .route-label { display: inline-block; background: #D1FAE5; color: #065F46; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 20px; margin-left: 8px; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-dot"><span>G</span></div>
      <div>
        <div class="brand-name">GoBooking</div>
        <div class="brand-sub">Plateforme de transport Côte d'Ivoire</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">FEUILLE DE ROUTE <span class="route-label">CHAUFFEUR / AGENT</span></div>
      <div>Généré le ${today()} à ${nowTime()}</div>
      ${validatedBy ? `<div>Validé par : <strong>${validatedBy}</strong></div>` : ""}
    </div>
  </div>

  <!-- Trip banner -->
  <div class="trip-banner" style="background:linear-gradient(135deg,#059669 0%,#10B981 100%)">
    <div>
      <div class="trip-route">${trip.from} &nbsp;→&nbsp; ${trip.to}</div>
      <div class="trip-meta">${trip.date} · Départ ${trip.departureTime} · ${trip.busName}${trip.busType ? ` (${trip.busType})` : ""}</div>
    </div>
    <div class="trip-status" style="background:#fff;color:#059669">✓ En route</div>
  </div>

  <!-- Stats cards (no financial) -->
  <div class="stats-row">
    <div class="stat-card" style="background:#F0FDF4;border-color:#059669;">
      <div class="stat-val" style="color:#059669">${s.boardedCount}</div>
      <div class="stat-label">Passagers à bord</div>
    </div>
    <div class="stat-card" style="background:#FFFBEB;border-color:#D97706;">
      <div class="stat-val" style="color:#D97706">${s.absentCount}</div>
      <div class="stat-label">Absents</div>
    </div>
    <div class="stat-card" style="background:#FEF3C7;border-color:#92400E;">
      <div class="stat-val" style="color:#92400E">${s.bagageCount}</div>
      <div class="stat-label">Bagages</div>
    </div>
    <div class="stat-card" style="background:#EEF2FF;border-color:#4338CA;">
      <div class="stat-val" style="color:#4338CA">${s.colisCount}</div>
      <div class="stat-label">Colis</div>
    </div>
    <div class="stat-card" style="background:#F8FAFC;border-color:#64748B;">
      <div class="stat-val" style="color:#0F172A">${s.boardedCount + s.bagageCount + s.colisCount}</div>
      <div class="stat-label">Total items</div>
    </div>
  </div>

  <!-- Passagers embarqués -->
  <div class="section">
    <div class="section-header" style="border-color:#059669;">
      <div class="section-icon" style="background:#D1FAE5;">👥</div>
      <span class="section-title" style="color:#059669">Passagers à bord (${s.boardedCount})</span>
    </div>
    ${boarded.length === 0 ? '<p style="color:#94A3B8;font-style:italic;font-size:10px">Aucun passager embarqué</p>' : `
    <table>
      <thead>
        <tr><th>Réf. billet</th><th>Nom complet</th><th>Téléphone</th><th>Siège(s)</th></tr>
      </thead>
      <tbody>${boarded.map(p => passengerRow(p, false)).join("")}</tbody>
    </table>`}
  </div>

  <!-- Absents -->
  ${absents.length > 0 ? `
  <div class="section">
    <div class="section-header" style="border-color:#D97706;">
      <div class="section-icon" style="background:#FEF3C7;">🚫</div>
      <span class="section-title" style="color:#D97706">Absents (${s.absentCount})</span>
    </div>
    <table>
      <thead><tr><th>Réf. billet</th><th>Nom complet</th><th>Téléphone</th><th>Siège(s)</th></tr></thead>
      <tbody>${absents.map(p => passengerRow(p, false)).join("")}</tbody>
    </table>
  </div>` : ""}

  <!-- Bagages (sans montant) -->
  <div class="section">
    <div class="section-header" style="border-color:#92400E;">
      <div class="section-icon" style="background:#FEF3C7;">🧳</div>
      <span class="section-title" style="color:#92400E">Bagages chargés (${s.bagageCount})</span>
    </div>
    ${bagages.length === 0 ? '<p style="color:#94A3B8;font-style:italic;font-size:10px">Aucun bagage</p>' : `
    <table>
      <thead>
        <tr><th>Référence</th><th>Passager</th><th>Type</th><th>Poids</th><th>Statut</th></tr>
      </thead>
      <tbody>${bagages.map(b => bagageRow(b, false)).join("")}</tbody>
    </table>`}
  </div>

  <!-- Colis (sans montant) -->
  <div class="section">
    <div class="section-header" style="border-color:#4338CA;">
      <div class="section-icon" style="background:#EEF2FF;">📦</div>
      <span class="section-title" style="color:#4338CA">Colis à livrer (${s.colisCount})</span>
    </div>
    ${colis.length === 0 ? '<p style="color:#94A3B8;font-style:italic;font-size:10px">Aucun colis</p>' : `
    <table>
      <thead>
        <tr><th>Photo</th><th>Référence</th><th>Expéditeur</th><th>Destinataire</th><th>Destination</th><th>Type · Poids</th></tr>
      </thead>
      <tbody>${colis.map(c => colisRow(c, false)).join("")}</tbody>
    </table>`}
  </div>

  ${agentsSection(agents, "#059669")}

  <!-- Signatures -->
  <div class="signature-box">
    <div class="sig-line">
      <div class="sig-label">Chauffeur — Nom &amp; Signature</div>
      <div class="sig-underline"></div>
    </div>
    <div class="sig-line">
      <div class="sig-label">Agent Route — Signature</div>
      <div class="sig-underline"></div>
    </div>
    <div class="sig-line">
      <div class="sig-label">Heure départ effectif</div>
      <div class="sig-underline"></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>GoBooking — Feuille de route (sans données financières)</span>
    <span>Document pour usage chauffeur / agent route uniquement</span>
    <span>${trip.from} → ${trip.to} · ${trip.date}</span>
  </div>

  <div class="watermark-route">ROUTE</div>
</div>
</body>
</html>`;
}
