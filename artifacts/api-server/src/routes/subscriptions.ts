import { Router, type IRouter } from "express";
import { db, usersTable, companiesTable, subscriptionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

/* ─── Plans definition ──────────────────────────────────── */
export const PLANS = {
  free: {
    label:            "Gratuit",
    price:            0,
    maxReservations:  10,
    maxTrips:         3,
    analytics:        false,
    support:          "communautaire",
  },
  pro: {
    label:            "Pro",
    price:            25_000,
    maxReservations:  500,
    maxTrips:         50,
    analytics:        true,
    support:          "standard",
  },
  premium: {
    label:            "Premium",
    price:            75_000,
    maxReservations:  -1,
    maxTrips:         -1,
    analytics:        true,
    support:          "prioritaire",
  },
};

/* ─── Auth helpers ──────────────────────────────────────── */
async function requireCompanyAdmin(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length || !["admin", "company_admin", "compagnie"].includes(users[0].role)) return null;
  if (users[0].status === "inactive") return null;
  return users[0];
}

async function requireSuperAdmin(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length || !["admin", "super_admin"].includes(users[0].role)) return null;
  return users[0];
}

async function getCompanyId(userId: string) {
  const company = await db.select().from(companiesTable).where(eq(companiesTable.email,
    (await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0]?.email ?? ""
  )).limit(1);
  if (company.length) return company[0].id;
  const all = await db.select().from(companiesTable).limit(1);
  return all[0]?.id ?? null;
}

async function getActiveSub(companyId: string) {
  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.companyId, companyId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  if (!subs.length) return null;
  const sub = subs[0];
  if (sub.endDate && new Date() > sub.endDate && sub.status === "active") {
    await db.update(subscriptionsTable).set({ status: "expired" }).where(eq(subscriptionsTable.id, sub.id));
    return { ...sub, status: "expired" };
  }
  return sub;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPANY ENDPOINTS
   GET  /subscriptions/me       — current subscription + limits
   POST /subscriptions/activate — simulate payment & activate plan
═══════════════════════════════════════════════════════════════════════════ */

router.get("/company/subscription", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const companyId = await getCompanyId(user.id);
    if (!companyId) { res.status(404).json({ error: "Compagnie introuvable" }); return; }

    const sub = await getActiveSub(companyId);
    const plan = sub?.plan ?? "free";
    const planDef = PLANS[plan as keyof typeof PLANS] ?? PLANS.free;

    res.json({
      plan,
      planLabel:      planDef.label,
      status:         sub?.status ?? "active",
      endDate:        sub?.endDate?.toISOString() ?? null,
      amountPaid:     sub?.amountPaid ?? 0,
      paymentMethod:  sub?.paymentMethod ?? null,
      limits:         planDef,
    });
  } catch (err) {
    console.error("GET subscription error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/company/subscription/activate", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { plan, paymentMethod } = req.body as { plan: string; paymentMethod: string };

    if (!["pro", "premium"].includes(plan)) {
      res.status(400).json({ error: "Plan invalide. Choisissez 'pro' ou 'premium'." });
      return;
    }
    if (!["orange", "mtn", "wave", "card"].includes(paymentMethod)) {
      res.status(400).json({ error: "Méthode de paiement invalide." });
      return;
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) { res.status(404).json({ error: "Compagnie introuvable" }); return; }

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    const companyName = companies[0]?.name ?? "";
    const planDef = PLANS[plan as keyof typeof PLANS];
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.update(subscriptionsTable)
      .set({ status: "cancelled" })
      .where(eq(subscriptionsTable.companyId, companyId));

    const [created] = await db
      .insert(subscriptionsTable)
      .values({
        id:            genId(),
        companyId,
        companyName,
        plan,
        status:        "active",
        startDate:     new Date(),
        endDate,
        amountPaid:    planDef.price,
        paymentMethod,
      })
      .returning();

    res.json({
      plan:          created.plan,
      planLabel:     planDef.label,
      status:        created.status,
      endDate:       created.endDate?.toISOString() ?? null,
      amountPaid:    created.amountPaid,
      paymentMethod: created.paymentMethod,
      limits:        planDef,
    });
  } catch (err) {
    console.error("Activate subscription error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   SUPERADMIN ENDPOINTS
   GET   /superadmin/subscriptions               — all subscriptions
   PATCH /superadmin/subscriptions/:companyId    — activate or expire
   GET   /superadmin/subscriptions/revenue       — subscription revenue stats
═══════════════════════════════════════════════════════════════════════════ */

router.get("/superadmin/subscriptions", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const subs = await db
      .select()
      .from(subscriptionsTable)
      .orderBy(desc(subscriptionsTable.createdAt));

    const allCompanies = await db.select().from(companiesTable);
    const companyMap = new Map(allCompanies.map(c => [c.id, c]));

    const companyLatest = new Map<string, typeof subs[0]>();
    for (const s of subs) {
      if (!companyLatest.has(s.companyId)) companyLatest.set(s.companyId, s);
    }

    res.json(
      Array.from(companyLatest.values()).map(s => ({
        id:            s.id,
        companyId:     s.companyId,
        companyName:   s.companyName || companyMap.get(s.companyId)?.name || "—",
        plan:          s.plan,
        planLabel:     PLANS[s.plan as keyof typeof PLANS]?.label ?? s.plan,
        status:        s.status,
        startDate:     s.startDate.toISOString(),
        endDate:       s.endDate?.toISOString() ?? null,
        amountPaid:    s.amountPaid,
        paymentMethod: s.paymentMethod,
      }))
    );
  } catch (err) {
    console.error("Admin subscriptions error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/superadmin/subscriptions/revenue", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const subs = await db.select().from(subscriptionsTable);
    const totalRevenue = subs.reduce((s, sub) => s + sub.amountPaid, 0);
    const activeSubs   = subs.filter(s => s.status === "active");
    const proCount     = activeSubs.filter(s => s.plan === "pro").length;
    const premiumCount = activeSubs.filter(s => s.plan === "premium").length;
    const freeCount    = activeSubs.filter(s => s.plan === "free").length;
    const mrr          = proCount * PLANS.pro.price + premiumCount * PLANS.premium.price;

    res.json({ totalRevenue, mrr, activeSubs: activeSubs.length, proCount, premiumCount, freeCount });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/superadmin/subscriptions/:companyId", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { companyId } = req.params;
    const { action, plan } = req.body as { action: "activate" | "expire" | "upgrade"; plan?: string };

    const subs = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.companyId, companyId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (action === "expire") {
      if (subs.length) {
        await db.update(subscriptionsTable).set({ status: "expired" }).where(eq(subscriptionsTable.id, subs[0].id));
      }
      res.json({ status: "expired" });
      return;
    }

    if (action === "activate" || action === "upgrade") {
      const targetPlan = plan ?? subs[0]?.plan ?? "pro";
      const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
      const companyName = companies[0]?.name ?? "";
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const planDef = PLANS[targetPlan as keyof typeof PLANS] ?? PLANS.pro;

      if (subs.length) {
        await db.update(subscriptionsTable)
          .set({ status: "active", plan: targetPlan, endDate, amountPaid: planDef.price })
          .where(eq(subscriptionsTable.id, subs[0].id));
      } else {
        await db.insert(subscriptionsTable).values({
          id: genId(), companyId, companyName, plan: targetPlan,
          status: "active", startDate: new Date(), endDate, amountPaid: planDef.price, paymentMethod: "admin",
        });
      }
      res.json({ status: "active", plan: targetPlan });
      return;
    }

    res.status(400).json({ error: "Action invalide" });
  } catch (err) {
    console.error("Admin patch subscription error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
