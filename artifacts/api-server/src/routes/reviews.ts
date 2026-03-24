import { Router, type IRouter } from "express";
import { db, bookingsTable, tripsTable, usersTable, reviewsTable } from "@workspace/db";
import { eq, desc, avg, count, sql } from "drizzle-orm";
import { getAuthUser } from "../middleware/auth";

const router: IRouter = Router();

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

/* ─── POST /reviews — submit a review ──────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req.headers.authorization);
    if (!user) { res.status(401).json({ error: "Non authentifié" }); return; }

    const { bookingId, tripId, companyId, rating, comment } = req.body;

    if (!bookingId || !tripId || !companyId || !rating) {
      res.status(400).json({ error: "Champs obligatoires manquants" }); return;
    }
    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: "La note doit être entre 1 et 5" }); return;
    }

    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!bookings.length) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    const booking = bookings[0];
    if (booking.userId !== user.id) { res.status(403).json({ error: "Accès refusé" }); return; }

    const validStatuses = ["boarded", "completed"];
    if (!validStatuses.includes(booking.status)) {
      res.status(403).json({ error: "Le trajet doit être terminé pour laisser un avis" }); return;
    }

    const existing = await db.select({ id: reviewsTable.id }).from(reviewsTable)
      .where(eq(reviewsTable.bookingId, bookingId)).limit(1);
    if (existing.length) { res.status(409).json({ error: "Vous avez déjà laissé un avis pour ce trajet" }); return; }

    const [review] = await db.insert(reviewsTable).values({
      id:        genId(),
      userId:    user.id,
      companyId,
      tripId,
      bookingId,
      rating:    ratingNum,
      comment:   comment?.trim() || null,
    } as any).returning();

    res.status(201).json(review);
  } catch (err) {
    console.error("POST /reviews error:", err);
    res.status(500).json({ error: "Échec de l'enregistrement de l'avis" });
  }
});

/* ─── GET /reviews/company/:companyId — avg + list for company ── */
router.get("/company/:companyId", async (req, res) => {
  try {
    const rows = await db
      .select({
        id:         reviewsTable.id,
        rating:     reviewsTable.rating,
        comment:    reviewsTable.comment,
        createdAt:  reviewsTable.createdAt,
        userName:   usersTable.name,
        tripId:     reviewsTable.tripId,
        userId:     reviewsTable.userId,
      })
      .from(reviewsTable)
      .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
      .where(eq(reviewsTable.companyId, req.params.companyId))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(100);

    const total  = rows.length;
    const avgRating = total
      ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
      : 0;

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach(r => { dist[r.rating] = (dist[r.rating] ?? 0) + 1; });

    res.json({ averageRating: avgRating, total, distribution: dist, reviews: rows });
  } catch (err) {
    console.error("GET /reviews/company error:", err);
    res.status(500).json({ error: "Échec de la récupération des avis" });
  }
});

/* ─── GET /reviews/my-reviews — reviews already posted by user ─── */
router.get("/my-reviews", async (req, res) => {
  try {
    const user = await getAuthUser(req.headers.authorization);
    if (!user) { res.status(401).json({ error: "Non authentifié" }); return; }

    const rows = await db.select({ bookingId: reviewsTable.bookingId })
      .from(reviewsTable).where(eq(reviewsTable.userId, user.id));

    res.json(rows.map(r => r.bookingId));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
