import { Router, type IRouter, type Request, type Response } from "express";
import { db, bookingsTable, paymentsTable, notificationsTable, usersTable, tripsTable, parcelsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { tokenStore } from "./auth";
import { auditLog, ACTIONS } from "../audit";
import { creditCompanyWallet } from "./bookings";
import { sendExpoPush } from "../pushService";

const router: IRouter = Router();

/* ── Config CinetPay ──────────────────────────────────────────────────── */
const CINETPAY_API_KEY  = process.env.CINETPAY_API_KEY  ?? "";
const CINETPAY_SITE_ID  = process.env.CINETPAY_SITE_ID  ?? "";
const CINETPAY_BASE_URL = "https://api-checkout.cinetpay.com/v2";
const DEMO_MODE         = !CINETPAY_API_KEY || !CINETPAY_SITE_ID;

function getUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return tokenStore.get(authHeader.replace("Bearer ", "")) ?? null;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function generateTxId(): string {
  return "CP" + Date.now().toString() + Math.random().toString(36).substr(2, 6).toUpperCase();
}

/* ── Record a payment receipt into the payments table ─────────────────── */
async function recordPayment(
  userId: string,
  bookingId: string,
  amount: number,
  method: string,
  transactionId: string
): Promise<string> {
  const id = generateId();
  await db.insert(paymentsTable).values({
    id,
    userId,
    refId:         bookingId,
    refType:       "booking",
    amount,
    method,
    status:        "paid",
    transactionId,
  });
  return id;
}

/* ── Create an in-app notification + send push ────────────────────────── */
async function notifyPaymentSuccess(
  userId: string,
  bookingRef: string,
  amount: number,
  paymentId: string
): Promise<void> {
  try {
    /* In-app notification */
    await db.insert(notificationsTable).values({
      id:      generateId(),
      userId,
      type:    "payment_success",
      title:   "Paiement confirmé ✅",
      message: `Votre billet ${bookingRef} est confirmé. Montant payé : ${amount.toLocaleString()} FCFA.`,
      read:    false,
      refId:   paymentId,
      refType: "payment",
    });

    /* Expo push notification */
    const userRows = await db.select({ pushToken: usersTable.pushToken })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (userRows[0]?.pushToken) {
      sendExpoPush(
        userRows[0].pushToken,
        "Paiement réussi 🎉",
        `Votre billet ${bookingRef} est confirmé. Montant : ${amount.toLocaleString()} FCFA`
      ).catch(() => {});
    }
  } catch (err) {
    console.error("[PAYMENT] notification error:", err);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/init
   Body: { bookingId, paymentMethod }
──────────────────────────────────────────────────────────────────────── */
router.post("/init", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

    const { bookingId, paymentMethod } = req.body as { bookingId?: string; paymentMethod?: string };
    if (!bookingId || !paymentMethod) {
      res.status(400).json({ error: "bookingId et paymentMethod requis" }); return;
    }

    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    const booking = rows[0];

    if (booking.userId !== userId) { res.status(403).json({ error: "Non autorisé" }); return; }
    if (booking.paymentStatus === "paid") { res.status(400).json({ error: "Cette réservation est déjà payée" }); return; }
    if (booking.status === "cancelled")   { res.status(400).json({ error: "Impossible de payer une réservation annulée" }); return; }
    if (booking.status === "boarded")     { res.status(400).json({ error: "Cette réservation est déjà embarquée" }); return; }

    await db.update(bookingsTable).set({ paymentMethod }).where(eq(bookingsTable.id, bookingId));

    /* ── DEMO MODE ── */
    if (DEMO_MODE) {
      const txId    = generateTxId();
      const domain  = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost:8080";
      const payUrl  = `https://${domain}/api/payment/demo-redirect?txId=${txId}&bookingId=${bookingId}&amount=${booking.totalAmount}&method=${paymentMethod}`;
      console.log(`[PAYMENT DEMO] booking=${booking.bookingRef} tx=${txId} amount=${booking.totalAmount} FCFA`);
      res.json({ demo: true, transactionId: txId, paymentUrl: payUrl, amount: booking.totalAmount, currency: "XOF", bookingRef: booking.bookingRef });
      return;
    }

    /* ── PRODUCTION MODE — CinetPay API ── */
    const txId      = generateTxId();
    const domain    = process.env.EXPO_PUBLIC_DOMAIN ?? "";
    const notifyUrl = `https://${domain}/api/payment/notify`;
    const returnUrl = `https://${domain}/api/payment/return?bookingId=${bookingId}`;
    const channelMap: Record<string, string> = { wave: "WAVE_CI", orange: "ORANGE_MONEY_CI", mtn: "MTN_MONEY_CI", card: "CARD" };

    const cpRes = await fetch(`${CINETPAY_BASE_URL}/payment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: CINETPAY_API_KEY, site_id: CINETPAY_SITE_ID, transaction_id: txId, amount: booking.totalAmount, currency: "XOF", description: `GoBooking - Billet ${booking.bookingRef}`, return_url: returnUrl, notify_url: notifyUrl, customer_id: userId, channels: channelMap[paymentMethod] ?? "ALL" }),
    });
    const cpData = await cpRes.json() as { code: string; message: string; data?: { payment_url?: string } };
    if (cpData.code !== "201") { res.status(502).json({ error: "CinetPay: " + (cpData.message ?? "Erreur inconnue") }); return; }

    console.log(`[PAYMENT PROD] booking=${booking.bookingRef} tx=${txId}`);
    res.json({ demo: false, transactionId: txId, paymentUrl: cpData.data?.payment_url ?? "", amount: booking.totalAmount, currency: "XOF", bookingRef: booking.bookingRef });
  } catch (err) {
    console.error("[PAYMENT] init error:", err);
    res.status(500).json({ error: "Erreur lors de l'initialisation du paiement" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /payment/demo-redirect?txId=&bookingId=&amount=&method=
──────────────────────────────────────────────────────────────────────── */
router.get("/demo-redirect", async (req: Request, res: Response) => {
  if (!DEMO_MODE) { res.status(404).json({ error: "Disponible en mode démo uniquement" }); return; }
  const { bookingId, txId, amount, method } = req.query as { bookingId?: string; txId?: string; amount?: string; method?: string };
  if (!bookingId || !txId) { res.status(400).send("Paramètres manquants"); return; }

  try {
    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!rows.length) { res.status(404).send("Réservation introuvable"); return; }
    const booking = rows[0];

    if (booking.paymentStatus === "paid") {
      /* Already paid — show success page but do not double-record */
      const existingPayments = await db.select().from(paymentsTable)
        .where(and(eq(paymentsTable.refId, bookingId), eq(paymentsTable.status, "paid"))).limit(1);
      const payId = existingPayments[0]?.id ?? "";
      res.send(buildSuccessHtml(booking.bookingRef, Number(amount || booking.totalAmount), txId, payId, true));
      return;
    }

    await db.update(bookingsTable).set({ status: "confirmed", paymentStatus: "paid" }).where(eq(bookingsTable.id, bookingId));
    await creditCompanyWallet(bookingId).catch(() => {});

    const payId = await recordPayment(booking.userId ?? "", bookingId, Number(amount || booking.totalAmount), method || booking.paymentMethod || "wave", txId);
    await notifyPaymentSuccess(booking.userId ?? "", booking.bookingRef, Number(amount || booking.totalAmount), payId).catch(() => {});

    auditLog({ userId: booking.userId ?? "unknown", userRole: "client", req }, ACTIONS.BOOKING_CONFIRM, bookingId, "booking", {
      bookingRef: booking.bookingRef, paymentMethod: method || booking.paymentMethod, transactionId: txId, paymentId: payId, demo: true,
    }).catch(() => {});

    console.log(`[PAYMENT DEMO] ✅ Booking ${booking.bookingRef} confirmed — paymentId: ${payId}`);
    res.send(buildSuccessHtml(booking.bookingRef, Number(amount || booking.totalAmount), txId, payId, false));
  } catch (err) {
    console.error("[PAYMENT DEMO] redirect error:", err);
    res.status(500).send("Erreur lors de la confirmation");
  }
});

function buildSuccessHtml(bookingRef: string, amount: number, txId: string, payId: string, alreadyPaid: boolean): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paiement réussi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%);padding:24px}.card{background:white;border-radius:24px;padding:40px 32px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.12);text-align:center}.circle{width:88px;height:88px;border-radius:50%;background:#D1FAE5;display:flex;align-items:center;justify-content:center;font-size:44px;margin:0 auto 20px}h1{color:#065F46;font-size:24px;margin-bottom:8px}p{color:#4B5563;font-size:14px;line-height:1.5;margin-bottom:20px}.ref{background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:14px 20px;margin-bottom:8px}.ref-label{font-size:10px;color:#6B7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}.ref-value{font-size:22px;font-weight:700;color:#065F46}.amount{font-size:16px;font-weight:600;color:#6B7280;margin-bottom:8px}.tx{font-size:10px;color:#9CA3AF;margin-bottom:24px;word-break:break-all}.btn{display:block;background:#059669;color:white;border:none;padding:14px 28px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;margin-bottom:10px;width:100%}.btn2{display:block;background:#F1F5F9;color:#0B3C5D;border:none;padding:12px 28px;border-radius:14px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;width:100%}</style></head><body><div class="card"><div class="circle">${alreadyPaid ? '✅' : '🎉'}</div><h1>Paiement ${alreadyPaid ? 'déjà confirmé' : 'réussi !'}</h1><p>Votre réservation est confirmée. Votre billet est prêt.</p><div class="ref"><div class="ref-label">Référence</div><div class="ref-value">#${bookingRef}</div></div><div class="amount">${amount.toLocaleString()} FCFA</div><div class="tx">Transaction : ${txId}</div><a href="gobooking://payment/receipt/${payId}" class="btn">🧾 Voir le reçu</a><a href="gobooking://booking" class="btn2">Mes réservations</a></div></body></html>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/notify — CinetPay webhook (production)
──────────────────────────────────────────────────────────────────────── */
router.post("/notify", async (req: Request, res: Response) => {
  const { cpm_trans_id, cpm_custom, cpm_site_id } = req.body as { cpm_trans_id?: string; cpm_custom?: string; cpm_site_id?: string };
  if (!CINETPAY_API_KEY) { res.status(503).json({ error: "Mode démo — webhook non actif" }); return; }
  if (cpm_site_id !== CINETPAY_SITE_ID) { res.status(400).json({ error: "site_id invalide" }); return; }

  try {
    const verifyRes = await fetch(`${CINETPAY_BASE_URL}/payment/check`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: CINETPAY_API_KEY, site_id: CINETPAY_SITE_ID, transaction_id: cpm_trans_id }),
    });
    const verifyData = await verifyRes.json() as { code: string; data?: { status?: string; amount?: number; customer_id?: string } };
    if (verifyData.code !== "00" || verifyData.data?.status !== "ACCEPTED") { res.status(200).json({ ok: false, reason: "not_accepted" }); return; }

    const userId = verifyData.data?.customer_id ?? (cpm_custom ?? "");
    const amount = verifyData.data?.amount ?? 0;

    const pendingRows = await db.select().from(bookingsTable).where(eq(bookingsTable.userId, userId)).limit(20);
    const booking = pendingRows.find((b) => b.paymentStatus !== "paid" && b.totalAmount === amount);
    if (!booking) { res.status(200).json({ ok: false, reason: "no_matching_booking" }); return; }

    await db.update(bookingsTable).set({ status: "confirmed", paymentStatus: "paid" }).where(eq(bookingsTable.id, booking.id));
    await creditCompanyWallet(booking.id).catch(() => {});

    const payId = await recordPayment(userId, booking.id, amount, booking.paymentMethod || "card", cpm_trans_id ?? "");
    await notifyPaymentSuccess(userId, booking.bookingRef, amount, payId).catch(() => {});

    auditLog({ userId, userRole: "client", req }, ACTIONS.BOOKING_CONFIRM, booking.id, "booking", {
      bookingRef: booking.bookingRef, transactionId: cpm_trans_id, paymentId: payId, source: "cinetpay_webhook",
    }).catch(() => {});

    console.log(`[PAYMENT NOTIFY] ✅ Booking ${booking.bookingRef} confirmed — paymentId: ${payId}`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[PAYMENT NOTIFY] error:", err);
    res.status(500).json({ error: "Erreur de vérification" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/verify
   Mobile polls this after returning from payment page.
   Returns: { paid, paymentId, bookingRef, status, paymentStatus }
──────────────────────────────────────────────────────────────────────── */
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

    const { bookingId } = req.body as { bookingId?: string };
    if (!bookingId) { res.status(400).json({ error: "bookingId requis" }); return; }

    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    const booking = rows[0];
    if (booking.userId !== userId) { res.status(403).json({ error: "Non autorisé" }); return; }

    /* Get the associated payment record if it exists */
    let paymentId: string | null = null;
    if (booking.paymentStatus === "paid") {
      const payments = await db.select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.refId, bookingId), eq(paymentsTable.status, "paid")))
        .orderBy(desc(paymentsTable.createdAt))
        .limit(1);
      paymentId = payments[0]?.id ?? null;
    }

    res.json({
      bookingId:     booking.id,
      bookingRef:    booking.bookingRef,
      status:        booking.status,
      paymentStatus: booking.paymentStatus,
      paid:          booking.paymentStatus === "paid",
      paymentId,
    });
  } catch (err) {
    console.error("[PAYMENT] verify error:", err);
    res.status(500).json({ error: "Erreur de vérification" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/failed
   Called by the mobile client when payment times out or user cancels.
   Marks the booking as paymentStatus=failed so it won't block the user.
──────────────────────────────────────────────────────────────────────── */
router.post("/failed", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

    const { bookingId, reason } = req.body as { bookingId?: string; reason?: string };
    if (!bookingId) { res.status(400).json({ error: "bookingId requis" }); return; }

    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    const booking = rows[0];
    if (booking.userId !== userId) { res.status(403).json({ error: "Non autorisé" }); return; }
    if (booking.paymentStatus === "paid") { res.status(400).json({ error: "Cette réservation est déjà payée" }); return; }

    await db.update(bookingsTable)
      .set({ paymentStatus: "failed" })
      .where(eq(bookingsTable.id, bookingId));

    /* In-app notification */
    await db.insert(notificationsTable).values({
      id: generateId(), userId, type: "payment_failed",
      title: "Paiement échoué ❌",
      message: `Le paiement pour la réservation #${booking.bookingRef} a échoué. ${reason ? reason : "Veuillez réessayer."}`,
      read: false, refId: bookingId, refType: "booking",
    }).catch(() => {});

    console.log(`[PAYMENT] ❌ Booking ${booking.bookingRef} marked as failed`);
    res.json({ ok: true, bookingId, paymentStatus: "failed" });
  } catch (err) {
    console.error("[PAYMENT] failed error:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour du statut" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/simulate
   Directly simulate a successful payment without opening a browser.
   Useful for testing and for agents processing walk-in cash payments.
   Body: { bookingId, paymentMethod? }
──────────────────────────────────────────────────────────────────────── */
router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

    const { bookingId, paymentMethod = "wave" } = req.body as { bookingId?: string; paymentMethod?: string };
    if (!bookingId) { res.status(400).json({ error: "bookingId requis" }); return; }

    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    const booking = rows[0];
    if (booking.userId !== userId) { res.status(403).json({ error: "Non autorisé" }); return; }
    if (booking.paymentStatus === "paid") {
      const existing = await db.select({ id: paymentsTable.id })
        .from(paymentsTable).where(and(eq(paymentsTable.refId, bookingId), eq(paymentsTable.status, "paid"))).limit(1);
      res.json({ ok: true, already: true, paymentId: existing[0]?.id ?? null, bookingRef: booking.bookingRef, amount: booking.totalAmount });
      return;
    }

    const txId = generateTxId();
    await db.update(bookingsTable)
      .set({ status: "confirmed", paymentStatus: "paid", paymentMethod })
      .where(eq(bookingsTable.id, bookingId));
    await creditCompanyWallet(bookingId).catch(() => {});

    const payId = await recordPayment(booking.userId ?? "", bookingId, booking.totalAmount, paymentMethod, txId);
    await notifyPaymentSuccess(booking.userId ?? "", booking.bookingRef, booking.totalAmount, payId).catch(() => {});

    const commission = Math.round(booking.totalAmount * 0.1);
    console.log(`[PAYMENT SIMULATE] ✅ Booking ${booking.bookingRef} — amount: ${booking.totalAmount} FCFA, commission: ${commission} FCFA, txId: ${txId}`);
    res.json({ ok: true, paymentId: payId, transactionId: txId, bookingRef: booking.bookingRef, amount: booking.totalAmount, commission, paymentStatus: "paid" });
  } catch (err) {
    console.error("[PAYMENT] simulate error:", err);
    res.status(500).json({ error: "Erreur lors de la simulation du paiement" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/init-parcel
   Initiates CinetPay payment for a parcel (same flow as booking).
   Body: { parcelId, paymentMethod }
──────────────────────────────────────────────────────────────────────── */
router.post("/init-parcel", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

    const { parcelId, paymentMethod } = req.body as { parcelId?: string; paymentMethod?: string };
    if (!parcelId || !paymentMethod) { res.status(400).json({ error: "parcelId et paymentMethod requis" }); return; }

    const rows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, parcelId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Colis introuvable" }); return; }
    const parcel = rows[0];
    if (parcel.userId !== userId) { res.status(403).json({ error: "Non autorisé" }); return; }
    if (parcel.paymentStatus === "paid") { res.status(400).json({ error: "Ce colis est déjà payé" }); return; }

    await db.update(parcelsTable).set({ paymentMethod, paymentStatus: "pending" }).where(eq(parcelsTable.id, parcelId));

    /* ── DEMO MODE ── */
    if (DEMO_MODE) {
      const txId    = generateTxId();
      const domain  = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost:8080";
      const payUrl  = `https://${domain}/api/payment/demo-redirect-parcel?txId=${txId}&parcelId=${parcelId}&amount=${parcel.amount}&method=${paymentMethod}`;
      console.log(`[PAYMENT DEMO] parcel=${parcel.trackingRef} tx=${txId} amount=${parcel.amount} FCFA`);
      res.json({ demo: true, transactionId: txId, paymentUrl: payUrl, amount: parcel.amount, currency: "XOF", trackingRef: parcel.trackingRef });
      return;
    }

    /* ── PRODUCTION MODE ── */
    const txId      = generateTxId();
    const domain    = process.env.EXPO_PUBLIC_DOMAIN ?? "";
    const notifyUrl = `https://${domain}/api/payment/notify-parcel`;
    const returnUrl = `https://${domain}/api/payment/demo-redirect-parcel?parcelId=${parcelId}&txId=${txId}`;
    const channelMap: Record<string, string> = { wave: "WAVE_CI", orange: "ORANGE_MONEY_CI", mtn: "MTN_MONEY_CI", card: "CARD" };

    const cpRes = await fetch(`${CINETPAY_BASE_URL}/payment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: CINETPAY_API_KEY, site_id: CINETPAY_SITE_ID, transaction_id: txId, amount: parcel.amount, currency: "XOF", description: `GoBooking - Colis ${parcel.trackingRef}`, return_url: returnUrl, notify_url: notifyUrl, customer_id: userId, channels: channelMap[paymentMethod] ?? "ALL" }),
    });
    const cpData = await cpRes.json() as { code: string; message: string; data?: { payment_url?: string } };
    if (cpData.code !== "201") { res.status(502).json({ error: "CinetPay: " + (cpData.message ?? "Erreur inconnue") }); return; }

    res.json({ demo: false, transactionId: txId, paymentUrl: cpData.data?.payment_url ?? "", amount: parcel.amount, currency: "XOF", trackingRef: parcel.trackingRef });
  } catch (err) {
    console.error("[PAYMENT] init-parcel error:", err);
    res.status(500).json({ error: "Erreur lors de l'initialisation du paiement colis" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /payment/demo-redirect-parcel
──────────────────────────────────────────────────────────────────────── */
router.get("/demo-redirect-parcel", async (req: Request, res: Response) => {
  if (!DEMO_MODE) { res.status(404).json({ error: "Disponible en mode démo uniquement" }); return; }
  const { parcelId, txId, amount, method } = req.query as { parcelId?: string; txId?: string; amount?: string; method?: string };
  if (!parcelId || !txId) { res.status(400).send("Paramètres manquants"); return; }

  try {
    const rows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, parcelId)).limit(1);
    if (!rows.length) { res.status(404).send("Colis introuvable"); return; }
    const parcel = rows[0];

    if (parcel.paymentStatus === "paid") {
      res.send(buildParcelSuccessHtml(parcel.trackingRef, Number(amount || parcel.amount), txId, true));
      return;
    }

    const commission = Math.round(parcel.amount * 0.1);
    await db.update(parcelsTable)
      .set({ paymentStatus: "paid", commissionAmount: commission, paymentMethod: method || parcel.paymentMethod })
      .where(eq(parcelsTable.id, parcelId));

    /* Record in payments table */
    const payId = generateId();
    await db.insert(paymentsTable).values({
      id: payId, userId: parcel.userId, refId: parcelId, refType: "parcel",
      amount: Number(amount || parcel.amount), method: method || parcel.paymentMethod,
      status: "paid", transactionId: txId,
    }).catch(() => {});

    /* Notification */
    await db.insert(notificationsTable).values({
      id: generateId(), userId: parcel.userId, type: "payment_success",
      title: "Colis confirmé ✅",
      message: `Votre colis ${parcel.trackingRef} (${parcel.fromCity} → ${parcel.toCity}) est confirmé. Montant payé : ${Number(amount || parcel.amount).toLocaleString()} FCFA.`,
      read: false, refId: payId, refType: "payment",
    }).catch(() => {});

    const userRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
    if (userRows[0]?.pushToken) {
      sendExpoPush(userRows[0].pushToken, "Colis confirmé ✅", `Votre colis ${parcel.trackingRef} est enregistré. Bon envoi !`).catch(() => {});
    }

    console.log(`[PAYMENT DEMO] ✅ Parcel ${parcel.trackingRef} confirmed — commission: ${commission} FCFA`);
    res.send(buildParcelSuccessHtml(parcel.trackingRef, Number(amount || parcel.amount), txId, false));
  } catch (err) {
    console.error("[PAYMENT DEMO] parcel redirect error:", err);
    res.status(500).send("Erreur lors de la confirmation");
  }
});

function buildParcelSuccessHtml(trackingRef: string, amount: number, txId: string, alreadyPaid: boolean): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colis confirmé</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%);padding:24px}.card{background:white;border-radius:24px;padding:40px 32px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.12);text-align:center}.circle{width:88px;height:88px;border-radius:50%;background:#DBEAFE;display:flex;align-items:center;justify-content:center;font-size:44px;margin:0 auto 20px}h1{color:#1E3A8A;font-size:24px;margin-bottom:8px}p{color:#4B5563;font-size:14px;line-height:1.5;margin-bottom:20px}.ref{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px 20px;margin-bottom:8px}.ref-label{font-size:10px;color:#6B7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}.ref-value{font-size:22px;font-weight:700;color:#1E3A8A}.amount{font-size:16px;font-weight:600;color:#6B7280;margin-bottom:24px}.btn{display:block;background:#0369A1;color:white;border:none;padding:14px 28px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;width:100%}</style></head><body><div class="card"><div class="circle">${alreadyPaid ? "📦" : "🎉"}</div><h1>Colis ${alreadyPaid ? "déjà confirmé" : "confirmé !"}</h1><p>Votre colis est enregistré et sera pris en charge prochainement.</p><div class="ref"><div class="ref-label">Référence de suivi</div><div class="ref-value">${trackingRef}</div></div><div class="amount">${amount.toLocaleString()} FCFA · ${txId}</div></div></body></html>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/verify-parcel
   Mobile polls this after returning from parcel payment page.
──────────────────────────────────────────────────────────────────────── */
router.post("/verify-parcel", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

    const { parcelId } = req.body as { parcelId?: string };
    if (!parcelId) { res.status(400).json({ error: "parcelId requis" }); return; }

    const rows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, parcelId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Colis introuvable" }); return; }
    const parcel = rows[0];
    if (parcel.userId !== userId) { res.status(403).json({ error: "Non autorisé" }); return; }

    let paymentId: string | null = null;
    if (parcel.paymentStatus === "paid") {
      const payments = await db.select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.refId, parcelId), eq(paymentsTable.status, "paid")))
        .orderBy(desc(paymentsTable.createdAt)).limit(1);
      paymentId = payments[0]?.id ?? null;
    }

    res.json({ parcelId: parcel.id, trackingRef: parcel.trackingRef, paymentStatus: parcel.paymentStatus, paid: parcel.paymentStatus === "paid", paymentId });
  } catch (err) {
    console.error("[PAYMENT] verify-parcel error:", err);
    res.status(500).json({ error: "Erreur de vérification" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /payment/receipts
   List all payment receipts for the authenticated user.
──────────────────────────────────────────────────────────────────────── */
router.get("/receipts", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

    const payments = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.userId, userId))
      .orderBy(desc(paymentsTable.createdAt));

    /* Enrich with booking/parcel details */
    const enriched = await Promise.all(payments.map(async (p) => {
      if (p.refType === "booking") {
        const bookings = await db
          .select({ bookingRef: bookingsTable.bookingRef, seatNumbers: bookingsTable.seatNumbers, totalAmount: bookingsTable.totalAmount, status: bookingsTable.status, paymentStatus: bookingsTable.paymentStatus, tripId: bookingsTable.tripId })
          .from(bookingsTable).where(eq(bookingsTable.id, p.refId)).limit(1);

        if (!bookings.length) return { ...p, booking: null, parcel: null };
        const b = bookings[0];
        const trips = await db
          .select({ from: tripsTable.from, to: tripsTable.to, date: tripsTable.date, departureTime: tripsTable.departureTime })
          .from(tripsTable).where(eq(tripsTable.id, b.tripId ?? "")).limit(1);
        const t = trips[0] ?? null;
        return { ...p, booking: { bookingRef: b.bookingRef, seatNumbers: b.seatNumbers, status: b.status, paymentStatus: b.paymentStatus, from: t?.from ?? "—", to: t?.to ?? "—", date: t?.date ?? "—", departureTime: t?.departureTime ?? "—" }, parcel: null };
      }

      if (p.refType === "parcel") {
        const parcels = await db.select({ trackingRef: parcelsTable.trackingRef, fromCity: parcelsTable.fromCity, toCity: parcelsTable.toCity, status: parcelsTable.status, paymentStatus: parcelsTable.paymentStatus, parcelType: parcelsTable.parcelType })
          .from(parcelsTable).where(eq(parcelsTable.id, p.refId)).limit(1);
        if (!parcels.length) return { ...p, booking: null, parcel: null };
        const c = parcels[0];
        return { ...p, booking: null, parcel: { trackingRef: c.trackingRef, from: c.fromCity, to: c.toCity, status: c.status, paymentStatus: c.paymentStatus, parcelType: c.parcelType } };
      }

      return { ...p, booking: null, parcel: null };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("[PAYMENT] receipts list error:", err);
    res.status(500).json({ error: "Erreur lors du chargement de l'historique" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /payment/receipts/:id
   Single receipt with full details (user, booking, trip).
──────────────────────────────────────────────────────────────────────── */
router.get("/receipts/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

    const { id } = req.params;
    const payments = await db.select().from(paymentsTable)
      .where(and(eq(paymentsTable.id, id), eq(paymentsTable.userId, userId))).limit(1);
    if (!payments.length) { res.status(404).json({ error: "Reçu introuvable" }); return; }
    const p = payments[0];

    /* User info */
    const userRows = await db.select({ name: usersTable.name, email: usersTable.email, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = userRows[0] ?? { name: "—", email: "—", phone: "—" };

    /* Booking + trip */
    let bookingDetail = null;
    if (p.refType === "booking") {
      const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, p.refId)).limit(1);
      if (bookings.length) {
        const b = bookings[0];
        const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, b.tripId ?? "")).limit(1);
        const t = trips[0] ?? null;
        bookingDetail = {
          bookingRef:    b.bookingRef,
          seatNumbers:   b.seatNumbers,
          passengers:    b.passengers,
          totalAmount:   b.totalAmount,
          status:        b.status,
          paymentStatus: b.paymentStatus,
          from:          t?.from ?? "—",
          to:            t?.to ?? "—",
          date:          t?.date ?? "—",
          departureTime: t?.departureTime ?? "—",
          arrivalTime:   t?.arrivalTime ?? "—",
        };
      }
    }

    res.json({
      id:            p.id,
      transactionId: p.transactionId,
      amount:        p.amount,
      method:        p.method,
      status:        p.status,
      createdAt:     p.createdAt,
      user,
      booking:       bookingDetail,
    });
  } catch (err) {
    console.error("[PAYMENT] receipt detail error:", err);
    res.status(500).json({ error: "Erreur lors du chargement du reçu" });
  }
});

export default router;
