import { Router, type IRouter } from "express";
import { db, usersTable, referralsTable, promosTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();
const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

/* ── Auth helper ──────────────────────────────────────────────── */
async function requireUser(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return rows[0] ?? null;
}

async function requireAdmin(authHeader: string | undefined) {
  const user = await requireUser(authHeader);
  if (!user || user.role !== "admin") return null;
  return user;
}

/* ═══════════════════════════════════════════════════════════════
   WALLET & REFERRAL
   GET /growth/wallet  — wallet balance + referral code + loyalty
═══════════════════════════════════════════════════════════════ */

router.get("/growth/wallet", async (req, res) => {
  try {
    const user = await requireUser(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const referrals = await db
      .select()
      .from(referralsTable)
      .where(eq(referralsTable.referrerId, user.id))
      .orderBy(desc(referralsTable.createdAt));

    const loyalty = user.totalTrips >= 10
      ? { eligible: true, message: "1 voyage offert ! Contactez GoBooking pour en bénéficier." }
      : { eligible: false, tripsLeft: 10 - user.totalTrips };

    res.json({
      walletBalance:   user.walletBalance ?? 0,
      referralCode:    user.referralCode ?? user.id.slice(0, 6).toUpperCase(),
      totalTrips:      user.totalTrips ?? 0,
      totalReferrals:  referrals.length,
      referrals:       referrals.map(r => ({ id: r.id, reward: r.reward, createdAt: r.createdAt.toISOString() })),
      loyalty,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PROMO CODES
   GET  /growth/promo/:code        — validate a promo code
   GET  /superadmin/promos         — list all promos (admin)
   POST /superadmin/promos         — create promo (admin)
   PUT  /superadmin/promos/:id     — toggle valid (admin)
═══════════════════════════════════════════════════════════════ */

router.get("/growth/promo/:code", async (req, res) => {
  try {
    const user = await requireUser(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const code = req.params.code.toUpperCase().trim();
    const rows = await db.select().from(promosTable).where(eq(promosTable.code, code)).limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "Code promo introuvable" });
      return;
    }

    const promo = rows[0];

    if (!promo.valid) {
      res.status(400).json({ error: "Ce code promo n'est plus valide" });
      return;
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      res.status(400).json({ error: "Ce code promo a expiré" });
      return;
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      res.status(400).json({ error: "Ce code promo a atteint sa limite d'utilisation" });
      return;
    }

    res.json({
      id:         promo.id,
      code:       promo.code,
      discount:   promo.discount,
      minAmount:  promo.minAmount,
      valid:      promo.valid,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── Superadmin: list promos ── */
router.get("/superadmin/promos", async (req, res) => {
  try {
    const admin = await requireAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const promos = await db.select().from(promosTable).orderBy(desc(promosTable.createdAt));
    res.json(promos.map(p => ({
      id: p.id, code: p.code, discount: p.discount,
      minAmount: p.minAmount, valid: p.valid,
      maxUses: p.maxUses, usedCount: p.usedCount,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── Superadmin: create promo ── */
router.post("/superadmin/promos", async (req, res) => {
  try {
    const admin = await requireAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { code, discount, minAmount = 0, maxUses, expiresAt } = req.body;
    if (!code || !discount) {
      res.status(400).json({ error: "code et discount requis" });
      return;
    }

    const [promo] = await db.insert(promosTable).values({
      id:        genId(),
      code:      String(code).toUpperCase().trim(),
      discount:  Number(discount),
      minAmount: Number(minAmount),
      valid:     true,
      maxUses:   maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    res.status(201).json(promo);
  } catch (err: any) {
    const isUniq = err?.message?.includes("unique");
    res.status(isUniq ? 409 : 500).json({ error: isUniq ? "Ce code existe déjà" : "Erreur serveur" });
  }
});

/* ── Superadmin: toggle valid ── */
router.put("/superadmin/promos/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const rows = await db.select().from(promosTable).where(eq(promosTable.id, req.params.id)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Promo introuvable" }); return; }

    const [updated] = await db.update(promosTable)
      .set({ valid: !rows[0].valid })
      .where(eq(promosTable.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   INTERNAL HELPERS — exported for use in other routes
═══════════════════════════════════════════════════════════════ */

/** Credit user wallet + increment totalTrips */
export async function creditUserWallet(userId: string, amount: number, incTrips = false) {
  const updates: Record<string, unknown> = {
    walletBalance: sql`wallet_balance + ${amount}`,
  };
  if (incTrips) {
    updates.totalTrips = sql`total_trips + 1`;
  }
  await db.update(usersTable).set(updates as any).where(eq(usersTable.id, userId));
}

/** Record a referral and credit the referrer 500 FCFA */
export async function recordReferral(referrerCode: string, newUserId: string) {
  const referrers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.referralCode, referrerCode))
    .limit(1);

  if (!referrers.length) return;
  const referrer = referrers[0];

  // Avoid self-referral
  if (referrer.id === newUserId) return;

  await Promise.all([
    db.insert(referralsTable).values({
      id:         genId(),
      referrerId: referrer.id,
      newUserId,
      reward:     500,
    }),
    creditUserWallet(referrer.id, 500),
  ]);
}

/** Mark a promo code as used (increment counter) */
export async function usePromoCode(promoId: string) {
  await db.update(promosTable)
    .set({ usedCount: sql`used_count + 1` })
    .where(eq(promosTable.id, promoId));
}

export default router;
