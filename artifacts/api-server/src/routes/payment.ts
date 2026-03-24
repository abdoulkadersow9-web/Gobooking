import { Router, type IRouter, type Request, type Response } from "express";
import { db, bookingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { tokenStore } from "./auth";
import { auditLog, ACTIONS } from "../audit";
import { creditCompanyWallet } from "./bookings";

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

function generateTxId(): string {
  return "CP" + Date.now().toString() + Math.random().toString(36).substr(2, 6).toUpperCase();
}

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/init
   Body: { bookingId, paymentMethod }
   Returns: { paymentUrl, transactionId, demo }
   In demo mode: returns a fake payment URL for simulation.
   In production: calls CinetPay API and returns the real redirect URL.
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

    if (booking.paymentStatus === "paid") {
      res.status(400).json({ error: "Cette réservation est déjà payée" }); return;
    }
    if (["cancelled"].includes(booking.status)) {
      res.status(400).json({ error: "Impossible de payer une réservation annulée" }); return;
    }
    if (booking.status === "boarded") {
      res.status(400).json({ error: "Cette réservation est déjà embarquée" }); return;
    }

    /* ── DEMO MODE ── */
    if (DEMO_MODE) {
      const txId = generateTxId();
      /* Persist the pending tx reference so webhook can match it */
      await db.update(bookingsTable)
        .set({ paymentMethod })
        .where(eq(bookingsTable.id, bookingId));

      /* In demo mode the "payment URL" is just our own demo endpoint */
      const domain  = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost:8080";
      const payUrl  = `https://${domain}/api/payment/demo-redirect?txId=${txId}&bookingId=${bookingId}&amount=${booking.totalAmount}`;
      console.log(`[PAYMENT DEMO] booking=${booking.bookingRef} tx=${txId} amount=${booking.totalAmount} FCFA`);

      res.json({
        demo:          true,
        transactionId: txId,
        paymentUrl:    payUrl,
        amount:        booking.totalAmount,
        currency:      "XOF",
        bookingRef:    booking.bookingRef,
      });
      return;
    }

    /* ── PRODUCTION MODE — CinetPay API ── */
    const txId    = generateTxId();
    const domain  = process.env.EXPO_PUBLIC_DOMAIN ?? "";
    const notifyUrl = `https://${domain}/api/payment/notify`;
    const returnUrl = `https://${domain}/api/payment/return?bookingId=${bookingId}`;

    /* Map internal method names to CinetPay channels */
    const channelMap: Record<string, string> = {
      wave:   "WAVE_CI",
      orange: "ORANGE_MONEY_CI",
      mtn:    "MTN_MONEY_CI",
      card:   "CARD",
    };
    const channel = channelMap[paymentMethod] ?? "ALL";

    const body: Record<string, unknown> = {
      apikey:         CINETPAY_API_KEY,
      site_id:        CINETPAY_SITE_ID,
      transaction_id: txId,
      amount:         booking.totalAmount,
      currency:       "XOF",
      description:    `GoBooking - Billet ${booking.bookingRef}`,
      return_url:     returnUrl,
      notify_url:     notifyUrl,
      customer_id:    userId,
      channels:       channel,
    };

    const cpRes = await fetch(`${CINETPAY_BASE_URL}/payment`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    const cpData = await cpRes.json() as { code: string; message: string; data?: { payment_url?: string } };

    if (cpData.code !== "201") {
      console.error("[PAYMENT PROD] CinetPay error:", cpData);
      res.status(502).json({ error: "CinetPay: " + (cpData.message ?? "Erreur inconnue") }); return;
    }

    await db.update(bookingsTable)
      .set({ paymentMethod })
      .where(eq(bookingsTable.id, bookingId));

    console.log(`[PAYMENT PROD] booking=${booking.bookingRef} tx=${txId} url=${cpData.data?.payment_url}`);

    res.json({
      demo:          false,
      transactionId: txId,
      paymentUrl:    cpData.data?.payment_url ?? "",
      amount:        booking.totalAmount,
      currency:      "XOF",
      bookingRef:    booking.bookingRef,
    });
  } catch (err) {
    console.error("[PAYMENT] init error:", err);
    res.status(500).json({ error: "Erreur lors de l'initialisation du paiement" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /payment/demo-redirect?txId=&bookingId=&amount=
   Only active in demo mode — simulates the payer landing on the payment page.
   Immediately confirms the booking (simulating a successful payment).
──────────────────────────────────────────────────────────────────────── */
router.get("/demo-redirect", async (req: Request, res: Response) => {
  if (!DEMO_MODE) { res.status(404).json({ error: "Disponible en mode démo uniquement" }); return; }

  const { bookingId, txId, amount } = req.query as { bookingId?: string; txId?: string; amount?: string };
  if (!bookingId || !txId) { res.status(400).send("Paramètres manquants"); return; }

  try {
    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!rows.length) { res.status(404).send("Réservation introuvable"); return; }
    const booking = rows[0];

    /* Confirm the booking */
    await db.update(bookingsTable)
      .set({ status: "confirmed", paymentStatus: "paid" })
      .where(eq(bookingsTable.id, bookingId));

    await creditCompanyWallet(bookingId).catch(() => {});

    auditLog({ userId: booking.userId ?? "unknown", userRole: "client", req }, ACTIONS.BOOKING_CONFIRM, bookingId, "booking", {
      bookingRef: booking.bookingRef, paymentMethod: booking.paymentMethod, transactionId: txId, demo: true,
    }).catch(() => {});

    console.log(`[PAYMENT DEMO] ✅ Booking ${booking.bookingRef} confirmed via demo redirect`);

    /* Return a simple HTML page the WebView will show */
    res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paiement réussi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#F0FDF4;padding:24px}h1{color:#065F46;font-size:26px;margin:16px 0 8px}p{color:#374151;text-align:center;font-size:15px;line-height:1.5}.circle{width:80px;height:80px;border-radius:50%;background:#D1FAE5;display:flex;align-items:center;justify-content:center;font-size:40px}.ref{background:#ECFDF5;border:1px solid #6EE7B7;border-radius:12px;padding:12px 24px;margin:16px 0;font-weight:700;color:#065F46;font-size:18px}.amount{color:#6B7280;font-size:13px;margin-bottom:24px}.btn{background:#059669;color:white;border:none;padding:14px 32px;border-radius:14px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}</style></head><body><div class="circle">✅</div><h1>Paiement réussi !</h1><p>Votre réservation est confirmée.</p><div class="ref">${booking.bookingRef}</div><p class="amount">${Number(amount || booking.totalAmount).toLocaleString()} FCFA</p><a href="gobooking://booking/${bookingId}" class="btn">Voir mon billet →</a></body></html>`);
  } catch (err) {
    console.error("[PAYMENT DEMO] redirect error:", err);
    res.status(500).send("Erreur lors de la confirmation");
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/notify
   CinetPay webhook — called server-to-server after a real payment succeeds.
   Verifies the transaction with CinetPay, then confirms the booking.
──────────────────────────────────────────────────────────────────────── */
router.post("/notify", async (req: Request, res: Response) => {
  const { cpm_trans_id, cpm_custom, cpm_site_id } = req.body as {
    cpm_trans_id?: string;
    cpm_custom?: string;
    cpm_site_id?: string;
    cpm_trans_status?: string;
  };

  if (!CINETPAY_API_KEY) { res.status(503).json({ error: "Mode démo — webhook non actif" }); return; }
  if (cpm_site_id !== CINETPAY_SITE_ID) { res.status(400).json({ error: "site_id invalide" }); return; }

  try {
    /* Verify the transaction with CinetPay */
    const verifyRes = await fetch(`${CINETPAY_BASE_URL}/payment/check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ apikey: CINETPAY_API_KEY, site_id: CINETPAY_SITE_ID, transaction_id: cpm_trans_id }),
    });
    const verifyData = await verifyRes.json() as { code: string; data?: { status?: string; amount?: number; customer_id?: string } };

    if (verifyData.code !== "00" || verifyData.data?.status !== "ACCEPTED") {
      console.warn("[PAYMENT NOTIFY] Transaction not accepted:", verifyData);
      res.status(200).json({ ok: false, reason: "not_accepted" });
      return;
    }

    /* customer_id = userId; cpm_custom can hold extra info */
    const userId    = verifyData.data.customer_id ?? (cpm_custom ?? "");
    const amount    = verifyData.data.amount ?? 0;

    /* Find the booking by userId + matching amount that is pending payment */
    const pendingRows = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.userId, userId))
      .limit(20);

    const booking = pendingRows.find(
      (b) => b.paymentStatus !== "paid" && b.totalAmount === amount
    );

    if (!booking) {
      console.warn("[PAYMENT NOTIFY] No matching pending booking for userId:", userId, "amount:", amount);
      res.status(200).json({ ok: false, reason: "no_matching_booking" });
      return;
    }

    await db.update(bookingsTable)
      .set({ status: "confirmed", paymentStatus: "paid" })
      .where(eq(bookingsTable.id, booking.id));

    await creditCompanyWallet(booking.id).catch(() => {});

    auditLog({ userId, userRole: "client", req }, ACTIONS.BOOKING_CONFIRM, booking.id, "booking", {
      bookingRef: booking.bookingRef, transactionId: cpm_trans_id, source: "cinetpay_webhook",
    }).catch(() => {});

    console.log(`[PAYMENT NOTIFY] ✅ Booking ${booking.bookingRef} confirmed via CinetPay webhook`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[PAYMENT NOTIFY] error:", err);
    res.status(500).json({ error: "Erreur de vérification" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /payment/verify
   Mobile client polls this after returning from the payment page to check
   if the booking was confirmed (by webhook or demo redirect).
   Body: { bookingId }
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

    res.json({
      bookingId:     booking.id,
      bookingRef:    booking.bookingRef,
      status:        booking.status,
      paymentStatus: booking.paymentStatus,
      paid:          booking.paymentStatus === "paid",
    });
  } catch (err) {
    console.error("[PAYMENT] verify error:", err);
    res.status(500).json({ error: "Erreur de vérification" });
  }
});

export default router;
