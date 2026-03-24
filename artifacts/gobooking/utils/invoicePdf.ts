/**
 * GoBooking — Générateur de factures/reçus PDF
 * Utilise expo-print (natif) + expo-sharing
 * Sur web : ouvre une fenêtre d'impression
 */

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

export interface ReceiptData {
  bookingRef: string;
  transactionId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  trip: {
    from: string;
    to: string;
    date: string;
    departureTime: string;
    arrivalTime: string;
    busName: string;
    busType: string;
  };
  passengers: { name: string; seatNumber: string; age?: number }[];
  seatNumbers: string[];
  baseAmount: number;
  bagageAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  companyName?: string;
}

export interface CompanyInvoiceData {
  invoiceId: string;
  companyName: string;
  period: string;
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  transactionCount: number;
  status: string;
  paidAt?: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function fmt(n: number) { return n.toLocaleString("fr-FR") + " FCFA"; }

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function fmtMethod(method: string) {
  const M: Record<string, string> = {
    orange: "Orange Money",
    mtn: "MTN MoMo",
    wave: "Wave",
    card: "Carte bancaire",
    cash: "Espèces",
  };
  return M[method] ?? method;
}

// ─── Template HTML reçu client ────────────────────────────────────────────────

function receiptHtml(d: ReceiptData): string {
  const passRows = d.passengers
    .map(p => `<tr><td>${p.name}</td><td>${p.seatNumber}</td></tr>`)
    .join("");

  const bagLine = d.bagageAmount > 0
    ? `<tr><td>Suppléments bagages</td><td class="right">${fmt(d.bagageAmount)}</td></tr>` : "";

  const now = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const createdLabel = fmtDate(d.createdAt);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color:#1E293B; background:#F8FAFC; }
  .page { max-width:680px; margin:0 auto; background:#fff; padding:0 0 40px; }

  /* Header */
  .header { background:linear-gradient(135deg,#0B3C5D 0%,#1565A8 100%); padding:32px 40px; position:relative; }
  .header-brand { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
  .logo-circle { width:48px; height:48px; border-radius:12px; background:#FF6B00; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:900; color:#fff; }
  .brand-text { color:#fff; }
  .brand-name { font-size:20px; font-weight:800; letter-spacing:-0.5px; }
  .brand-sub { font-size:11px; opacity:0.7; margin-top:2px; }
  .header-title { color:#fff; font-size:28px; font-weight:800; }
  .header-ref { color:rgba(255,255,255,0.7); font-size:13px; margin-top:6px; }
  .paid-badge { position:absolute; top:32px; right:40px; background:#10B981; color:#fff; padding:6px 16px; border-radius:20px; font-size:13px; font-weight:700; letter-spacing:1px; }

  /* Content */
  .body { padding:32px 40px; }
  .section { margin-bottom:28px; }
  .section-title { font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:14px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .info-item label { font-size:11px; color:#94A3B8; display:block; margin-bottom:3px; }
  .info-item value, .info-item span { font-size:14px; font-weight:600; color:#1E293B; }

  /* Trip card */
  .trip-card { background:#F0F7FF; border-radius:12px; padding:20px; display:flex; align-items:center; gap:20px; }
  .city { text-align:center; }
  .city-name { font-size:18px; font-weight:800; color:#0B3C5D; }
  .city-time { font-size:12px; color:#64748B; margin-top:2px; }
  .arrow { flex:1; text-align:center; font-size:24px; color:#94A3B8; }
  .bus-tag { background:#0B3C5D; color:#fff; border-radius:8px; padding:8px 14px; text-align:center; margin-top:12px; font-size:12px; }

  /* Table */
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:1px; padding:0 0 8px; border-bottom:1px solid #E2E8F0; }
  td { padding:10px 0; border-bottom:1px solid #F1F5F9; font-size:14px; }
  td.right { text-align:right; }

  /* Totals */
  .total-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; }
  .total-row.main { border-top:2px solid #0B3C5D; margin-top:8px; padding-top:14px; }
  .total-label { font-size:14px; color:#64748B; }
  .total-label.bold { font-weight:700; color:#1E293B; font-size:16px; }
  .total-value { font-size:14px; font-weight:600; color:#1E293B; }
  .total-value.main { font-size:20px; font-weight:800; color:#0B3C5D; }

  /* Footer */
  .footer { margin-top:32px; padding-top:24px; border-top:1px solid #E2E8F0; text-align:center; }
  .footer p { font-size:11px; color:#94A3B8; line-height:1.6; }
  .watermark { font-size:10px; color:#CBD5E1; margin-top:8px; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-brand">
      <div class="logo-circle">G</div>
      <div class="brand-text">
        <div class="brand-name">GoBooking</div>
        <div class="brand-sub">Transport Interurbain — Côte d'Ivoire</div>
      </div>
    </div>
    <div class="header-title">Reçu de Paiement</div>
    <div class="header-ref">Réf. #${d.bookingRef} · Émis le ${createdLabel}</div>
    ${d.paymentStatus === "paid" || d.status === "confirmed" || d.status === "embarqué" ? '<div class="paid-badge">✓ PAYÉ</div>' : ""}
  </div>

  <div class="body">

    <!-- Infos client -->
    <div class="section">
      <div class="section-title">Informations client</div>
      <div class="info-grid">
        <div class="info-item"><label>Nom complet</label><span>${d.clientName}</span></div>
        ${d.clientPhone ? `<div class="info-item"><label>Téléphone</label><span>${d.clientPhone}</span></div>` : ""}
        ${d.clientEmail ? `<div class="info-item"><label>Email</label><span>${d.clientEmail}</span></div>` : ""}
        <div class="info-item"><label>Mode de paiement</label><span>${fmtMethod(d.paymentMethod)}</span></div>
      </div>
    </div>

    <!-- Trajet -->
    <div class="section">
      <div class="section-title">Détails du trajet</div>
      <div class="trip-card">
        <div class="city">
          <div class="city-name">${d.trip.from}</div>
          <div class="city-time">${d.trip.departureTime}</div>
        </div>
        <div class="arrow">→</div>
        <div class="city">
          <div class="city-name">${d.trip.to}</div>
          <div class="city-time">${d.trip.arrivalTime}</div>
        </div>
      </div>
      <div class="bus-tag">${d.trip.busName} · ${d.trip.busType} · ${fmtDate(d.trip.date)}</div>
    </div>

    <!-- Passagers -->
    ${d.passengers.length > 0 ? `
    <div class="section">
      <div class="section-title">Passagers (${d.passengers.length})</div>
      <table>
        <tr><th>Nom</th><th>Siège</th></tr>
        ${passRows}
      </table>
    </div>` : ""}

    <!-- Montants -->
    <div class="section">
      <div class="section-title">Récapitulatif financier</div>
      <div class="total-row">
        <span class="total-label">Billet(s) × ${d.passengers.length || 1}</span>
        <span class="total-value">${fmt(d.baseAmount)}</span>
      </div>
      ${d.bagageAmount > 0 ? `
      <div class="total-row">
        <span class="total-label">Supplément bagages</span>
        <span class="total-value">${fmt(d.bagageAmount)}</span>
      </div>` : ""}
      <div class="total-row main">
        <span class="total-label bold">Total payé</span>
        <span class="total-value main">${fmt(d.totalAmount)}</span>
      </div>
    </div>

    <!-- ID Transaction -->
    ${d.transactionId ? `
    <div class="section">
      <div class="section-title">Référence de transaction</div>
      <div style="background:#F8FAFC;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:13px;color:#475569;word-break:break-all;">${d.transactionId}</div>
    </div>` : ""}

    <div class="footer">
      <p>Ce document est votre reçu officiel de paiement GoBooking.<br/>
         Conservez-le pour tout litige ou remboursement.</p>
      <p class="watermark">Généré le ${now} · GoBooking SAS · Abidjan, Côte d'Ivoire</p>
    </div>

  </div>
</div>
</body>
</html>`;
}

// ─── Template HTML facture compagnie ─────────────────────────────────────────

function companyInvoiceHtml(d: CompanyInvoiceData): string {
  const [yr, mo] = d.period.split("-");
  const moLabel = `${MONTHS_FR[parseInt(mo, 10) - 1]} ${yr}`;
  const now = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  const isPaid = d.status === "paid";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,'Helvetica Neue',Arial,sans-serif; color:#1E293B; background:#F8FAFC; }
  .page { max-width:680px; margin:0 auto; background:#fff; padding:0 0 40px; }
  .header { background:linear-gradient(135deg,#92400E 0%,#D97706 100%); padding:32px 40px; position:relative; }
  .brand-name { font-size:20px; font-weight:800; color:#fff; }
  .header-title { color:#fff; font-size:26px; font-weight:800; margin-top:20px; }
  .header-sub { color:rgba(255,255,255,0.8); font-size:13px; margin-top:6px; }
  .badge { position:absolute; top:32px; right:40px; background:${isPaid ? "#10B981" : "#F59E0B"}; color:#fff; padding:6px 16px; border-radius:20px; font-size:13px; font-weight:700; }
  .body { padding:32px 40px; }
  .section { margin-bottom:28px; }
  .section-title { font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:14px; }
  .row { display:flex; justify-content:space-between; align-items:center; padding:11px 0; border-bottom:1px solid #F1F5F9; }
  .row label { font-size:14px; color:#64748B; }
  .row span { font-size:14px; font-weight:600; color:#1E293B; }
  .row.total { border-top:2px solid #D97706; border-bottom:none; padding-top:16px; margin-top:6px; }
  .row.total label { font-size:16px; font-weight:700; color:#1E293B; }
  .row.total span { font-size:22px; font-weight:800; color:#059669; }
  .footer { margin-top:32px; padding-top:24px; border-top:1px solid #E2E8F0; text-align:center; font-size:11px; color:#94A3B8; line-height:1.6; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand-name">GoBooking — Espace Compagnie</div>
    <div class="header-title">Facture mensuelle</div>
    <div class="header-sub">${d.companyName} · Période : ${moLabel}</div>
    <div class="badge">${isPaid ? "✓ PAYÉE" : "EN ATTENTE"}</div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Résumé de la période</div>
      <div class="row"><label>Compagnie</label><span>${d.companyName}</span></div>
      <div class="row"><label>Période</label><span>${moLabel}</span></div>
      <div class="row"><label>Nombre de transactions</label><span>${d.transactionCount}</span></div>
      <div class="row"><label>Référence facture</label><span>${d.invoiceId}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Détail financier</div>
      <div class="row"><label>Chiffre d'affaires brut</label><span>${fmt(d.totalGross)}</span></div>
      <div class="row"><label>Commission GoBooking</label><span style="color:#DC2626">− ${fmt(d.totalCommission)}</span></div>
      <div class="row total"><label>Net à reverser</label><span>${fmt(d.totalNet)}</span></div>
    </div>
    ${isPaid && d.paidAt ? `<div class="section"><div class="section-title">Paiement</div><div class="row"><label>Date de paiement</label><span>${fmtDate(d.paidAt)}</span></div></div>` : ""}
    <div class="footer">
      Facture officielle GoBooking · Généré le ${now}<br/>
      GoBooking SAS · Abidjan, Côte d'Ivoire
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── Génération + partage ─────────────────────────────────────────────────────

export async function downloadReceipt(data: ReceiptData): Promise<void> {
  if (Platform.OS === "web") {
    const w = window.open("", "_blank");
    if (w) { w.document.write(receiptHtml(data)); w.document.close(); w.print(); }
    return;
  }
  try {
    const { uri } = await Print.printToFileAsync({ html: receiptHtml(data), base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Reçu GoBooking — ${data.bookingRef}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("PDF généré", `Fichier enregistré : ${uri}`);
    }
  } catch (err: any) {
    Alert.alert("Erreur PDF", err?.message ?? "Impossible de générer le PDF.");
  }
}

export async function downloadCompanyInvoice(data: CompanyInvoiceData): Promise<void> {
  if (Platform.OS === "web") {
    const w = window.open("", "_blank");
    if (w) { w.document.write(companyInvoiceHtml(data)); w.document.close(); w.print(); }
    return;
  }
  try {
    const { uri } = await Print.printToFileAsync({ html: companyInvoiceHtml(data), base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Facture GoBooking — ${data.period}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("PDF généré", `Fichier enregistré : ${uri}`);
    }
  } catch (err: any) {
    Alert.alert("Erreur PDF", err?.message ?? "Impossible de générer le PDF.");
  }
}
