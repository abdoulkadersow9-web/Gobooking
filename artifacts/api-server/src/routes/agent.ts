import { Router, type IRouter } from "express";
import { db, usersTable, agentsTable, busesTable, bookingsTable, parcelsTable, seatsTable, tripsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();

async function requireAgent(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length || !["admin", "agent"].includes(users[0].role)) return null;
  if (users[0].status === "inactive") return null;
  return users[0];
}

router.get("/info", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agent = agents[0];
    if (!agent) { res.status(404).json({ error: "Agent profile not found" }); return; }

    let bus = null;
    if (agent.busId) {
      const buses = await db.select().from(busesTable).where(eq(busesTable.id, agent.busId)).limit(1);
      bus = buses[0] || null;
    }

    res.json({ agent, user: { id: user.id, name: user.name, email: user.email }, bus });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/boarding", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const today = new Date().toISOString().split("T")[0];
    const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
    const todayBookings = bookings.slice(0, 20);

    res.json(todayBookings.map(b => ({
      id: b.id,
      bookingRef: b.bookingRef,
      passengers: b.passengers,
      seatNumbers: b.seatNumbers,
      status: b.status,
      totalAmount: b.totalAmount,
      createdAt: b.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/boarding/:bookingId/validate", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(bookingsTable).set({ status: "validated" }).where(eq(bookingsTable.id, req.params.bookingId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/parcels", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const parcels = await db.select().from(parcelsTable).orderBy(desc(parcelsTable.createdAt)).limit(30);
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parcels/:parcelId/pickup", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    await db.update(parcelsTable).set({ status: "pris_en_charge" }).where(eq(parcelsTable.id, req.params.parcelId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parcels/:parcelId/transit", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    await db.update(parcelsTable).set({ status: "en_transit" }).where(eq(parcelsTable.id, req.params.parcelId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parcels/:parcelId/deliver", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    await db.update(parcelsTable).set({ status: "livre" }).where(eq(parcelsTable.id, req.params.parcelId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/seats/:tripId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const seats = await db.select().from(seatsTable).where(eq(seatsTable.tripId, req.params.tripId));
    res.json(seats);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/trips", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const trips = await db.select().from(tripsTable).orderBy(desc(tripsTable.date)).limit(10);
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── Start / Arrive trip ───────────────────────────────── */
router.post("/trip/:tripId/start", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const trips = await db.select().from(tripsTable)
      .where(eq(tripsTable.id, req.params.tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }

    if (trips[0].status === "en_route") {
      res.status(409).json({ error: "Trajet déjà démarré", code: "ALREADY_STARTED" }); return;
    }

    await db.update(tripsTable)
      .set({ status: "en_route", startedAt: new Date() })
      .where(eq(tripsTable.id, req.params.tripId));

    res.json({ success: true, status: "en_route", startedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/trip/:tripId/arrive", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(tripsTable)
      .set({ status: "arrived", arrivedAt: new Date() })
      .where(eq(tripsTable.id, req.params.tripId));

    res.json({ success: true, status: "arrived", arrivedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── Ticket scan by booking reference ─────────────────── */
router.get("/scan/:ref", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const ref = req.params.ref.trim().toUpperCase();
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.bookingRef, ref))
      .limit(1);

    if (!bookings.length) {
      res.status(404).json({ error: "Aucun billet trouvé pour cette référence", code: "NOT_FOUND" });
      return;
    }

    const booking = bookings[0];

    let trip = null;
    if (booking.tripId) {
      const trips = await db.select().from(tripsTable)
        .where(eq(tripsTable.id, booking.tripId))
        .limit(1);
      trip = trips[0] ?? null;
    }

    res.json({
      id: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      passengers: booking.passengers ?? [],
      seatNumbers: booking.seatNumbers ?? [],
      totalAmount: booking.totalAmount,
      paymentMethod: booking.paymentMethod,
      createdAt: booking.createdAt?.toISOString(),
      trip: trip ? {
        from: trip.from, to: trip.to,
        date: trip.date, departureTime: trip.departureTime,
        busName: trip.busName,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
