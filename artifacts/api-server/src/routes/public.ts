/**
 * Public routes — no auth required
 * GET /api/companies   — liste des compagnies actives pour les clients
 */
import { Router, type IRouter } from "express";
import { db, companiesTable, tripsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

/* ─── GET /companies — liste publique des compagnies actives ─────────── */
router.get("/companies", async (req, res) => {
  try {
    /* Récupérer toutes les compagnies actives */
    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.status, "active"))
      .orderBy(companiesTable.name);

    /* Compter les trajets à venir par compagnie */
    const today = new Date().toISOString().slice(0, 10);

    const tripCounts = await db
      .select({
        companyId: tripsTable.companyId,
        count:     sql<number>`cast(count(*) as int)`,
      })
      .from(tripsTable)
      .where(gte(tripsTable.date, today))
      .groupBy(tripsTable.companyId);

    const countMap = new Map(tripCounts.map(r => [r.companyId, r.count]));

    res.json(companies.map(c => ({
      id:            c.id,
      name:          c.name,
      city:          c.city ?? "Côte d'Ivoire",
      phone:         c.phone,
      address:       c.address ?? null,
      licenseNumber: c.licenseNumber ?? null,
      upcomingTrips: countMap.get(c.id) ?? 0,
      initials:      c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
    })));
  } catch (err) {
    console.error("GET /companies error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
