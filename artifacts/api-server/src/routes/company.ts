import { Router, type IRouter } from "express";
import { db, usersTable, companiesTable, busesTable, agentsTable, tripsTable, bookingsTable, parcelsTable, seatsTable, walletTransactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();

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

router.get("/stats", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const [buses, agents, trips, bookings, parcels] = await Promise.all([
      db.select().from(busesTable),
      db.select().from(agentsTable),
      db.select().from(tripsTable),
      db.select().from(bookingsTable),
      db.select().from(parcelsTable),
    ]);

    const revenue = bookings.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.totalAmount, 0)
      + parcels.reduce((s, p) => s + p.amount, 0);

    res.json({
      totalBuses: buses.length,
      totalAgents: agents.length,
      totalTrips: trips.length,
      totalReservations: bookings.length,
      totalParcels: parcels.length,
      totalRevenue: revenue,
      activeBuses: buses.filter(b => b.status === "active").length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/buses", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const buses = await db.select().from(busesTable).orderBy(desc(busesTable.createdAt));
    res.json(buses);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

async function getOrCreateCompany(user: { id: string; name: string; email: string; phone: string }) {
  const existing = await db.select().from(companiesTable).where(eq(companiesTable.email, user.email)).limit(1);
  if (existing.length > 0) return existing[0];
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
  const created = await db.insert(companiesTable).values({
    id, name: user.name, email: user.email, phone: user.phone,
    address: "Abidjan, Côte d'Ivoire", city: "Abidjan", status: "active",
  }).returning();
  return created[0];
}

router.post("/buses", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { plateNumber, busName, busType, capacity } = req.body;
    if (!plateNumber || !busName) { res.status(400).json({ error: "plateNumber and busName are required" }); return; }
    const company = await getOrCreateCompany(user);
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const bus = await db.insert(busesTable).values({
      id, companyId: company.id, plateNumber, busName,
      busType: busType || "Standard", capacity: Number(capacity) || 49, status: "active",
    }).returning();
    res.json(bus[0]);
  } catch (err: any) {
    if (err?.message?.includes("unique")) {
      res.status(409).json({ error: "Cette plaque est déjà enregistrée" });
    } else {
      res.status(500).json({ error: String(err?.message || "Erreur serveur") });
    }
  }
});

router.delete("/buses/:id", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    await db.delete(busesTable).where(eq(busesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/agents", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agents = await db.select().from(agentsTable).orderBy(desc(agentsTable.createdAt));
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/trips", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const trips = await db.select().from(tripsTable).orderBy(desc(tripsTable.date));
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
    res.json(bookings.map(b => ({ id: b.id, bookingRef: b.bookingRef, tripId: b.tripId, totalAmount: b.totalAmount, status: b.status, passengers: b.passengers, createdAt: b.createdAt?.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/parcels", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const parcels = await db.select().from(parcelsTable).orderBy(desc(parcelsTable.createdAt));
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/trips", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { from, to, date, departureTime, arrivalTime, price, busName, busType, totalSeats, duration } = req.body;
    if (!from || !to || !date || !departureTime || !price) { res.status(400).json({ error: "Required fields missing" }); return; }
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const trip = await db.insert(tripsTable).values({
      id, from, to, date, departureTime: departureTime || "08:00", arrivalTime: arrivalTime || "12:00",
      price: Number(price), busName: busName || "Bus GoBooking", busType: busType || "Standard",
      totalSeats: totalSeats || 44, duration: duration || "4h00", amenities: [], stops: [], policies: [],
    }).returning();
    res.json(trip[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create trip" });
  }
});

router.get("/reservations", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
    res.json(bookings.map(b => ({
      id: b.id, bookingRef: b.bookingRef, tripId: b.tripId, totalAmount: b.totalAmount,
      status: b.status, paymentMethod: b.paymentMethod, passengers: b.passengers,
      seatNumbers: b.seatNumbers, createdAt: b.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/seats/:tripId", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const seats = await db.select().from(seatsTable).where(eq(seatsTable.tripId, req.params.tripId));
    res.json(seats);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── Seats with passenger info for a trip ──────────────── */
router.get("/seats/:tripId/detail", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const seats    = await db.select().from(seatsTable).where(eq(seatsTable.tripId, req.params.tripId));
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.tripId, req.params.tripId));

    const enriched = seats.map(s => {
      const booking = bookings.find(b =>
        b.seatNumbers?.includes(s.number) && b.status !== "cancelled"
      );
      const passenger = booking?.passengers?.find((p: any) => p.seatNumber === s.number) ?? null;
      return {
        ...s,
        bookingRef: booking?.bookingRef ?? null,
        bookingStatus: booking?.status ?? null,
        passenger: passenger,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── Block / unblock a seat ────────────────────────────── */
router.patch("/seats/:seatId/status", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { status } = req.body as { status: string };
    const allowed = ["available", "blocked"];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: "Statut invalide. Valeurs acceptées : available, blocked" }); return;
    }

    const seats = await db.select().from(seatsTable).where(eq(seatsTable.id, req.params.seatId)).limit(1);
    if (!seats.length) { res.status(404).json({ error: "Siège introuvable" }); return; }
    if (seats[0].status === "booked") {
      res.status(409).json({ error: "Impossible de modifier un siège déjà réservé" }); return;
    }

    await db.update(seatsTable).set({ status }).where(eq(seatsTable.id, req.params.seatId));
    res.json({ success: true, seatId: req.params.seatId, status });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── Wallet endpoints ───────────────────────────────────────────── */

router.get("/wallet", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const company = await getOrCreateCompany(user);

    const transactions = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.companyId, company.id))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(100);

    const totalGross      = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.grossAmount, 0);
    const totalCommission = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.commissionAmount, 0);
    const totalNet        = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.netAmount, 0);

    res.json({
      balance:          company.walletBalance,
      totalGross,
      totalCommission,
      totalNet,
      transactions:     transactions.map(t => ({
        id:               t.id,
        bookingRef:       t.bookingRef,
        type:             t.type,
        grossAmount:      t.grossAmount,
        commissionAmount: t.commissionAmount,
        netAmount:        t.netAmount,
        description:      t.description,
        createdAt:        t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Wallet error:", err);
    res.status(500).json({ error: "Failed to get wallet" });
  }
});

export default router;
