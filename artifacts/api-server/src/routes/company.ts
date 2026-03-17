import { Router, type IRouter } from "express";
import { db, usersTable, companiesTable, busesTable, agentsTable, tripsTable, bookingsTable, parcelsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();

async function requireCompanyAdmin(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length || !["admin", "company_admin"].includes(users[0].role)) return null;
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

router.post("/buses", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { plateNumber, busName, busType, capacity, companyId } = req.body;
    if (!plateNumber || !busName || !companyId) { res.status(400).json({ error: "Required fields missing" }); return; }
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const bus = await db.insert(busesTable).values({ id, companyId, plateNumber, busName, busType: busType || "Standard", capacity: capacity || 44, status: "active" }).returning();
    res.json(bus[0]);
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

export default router;
