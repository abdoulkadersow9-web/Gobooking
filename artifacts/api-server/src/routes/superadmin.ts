import { Router, type IRouter } from "express";
import { db, usersTable, companiesTable, busesTable, agentsTable, citiesTable, tripsTable, bookingsTable, parcelsTable, paymentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();

async function requireSuperAdmin(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length || !["admin", "super_admin"].includes(users[0].role)) return null;
  return users[0];
}

router.get("/stats", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Super admin access required" }); return; }

    const [users, companies, agents, trips, parcels, bookings, cities] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(companiesTable),
      db.select().from(agentsTable),
      db.select().from(tripsTable),
      db.select().from(parcelsTable),
      db.select().from(bookingsTable),
      db.select().from(citiesTable),
    ]);

    const totalRevenue = bookings
      .filter(b => b.status !== "cancelled")
      .reduce((s, b) => s + b.totalAmount, 0)
      + parcels.reduce((s, p) => s + p.amount, 0);

    res.json({
      totalUsers: users.length,
      totalCompanies: companies.length,
      totalAgents: agents.length,
      totalTrips: trips.length,
      totalParcels: parcels.length,
      totalBookings: bookings.length,
      totalCities: cities.length,
      totalRevenue,
      recentUsers: users.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, 5).map(u => ({
        id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt?.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Superadmin stats error:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/companies", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const companies = await db.select().from(companiesTable).orderBy(desc(companiesTable.createdAt));
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: "Failed to get companies" });
  }
});

router.post("/companies", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { name, email, phone, address, city } = req.body;
    if (!name || !email || !phone) { res.status(400).json({ error: "name, email, phone required" }); return; }
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const company = await db.insert(companiesTable).values({ id, name, email, phone, address, city, status: "active" }).returning();
    res.json(company[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create company" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, createdAt: u.createdAt?.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Failed to get users" });
  }
});

router.get("/cities", async (req, res) => {
  try {
    const cities = await db.select().from(citiesTable).orderBy(citiesTable.name);
    res.json(cities);
  } catch (err) {
    res.status(500).json({ error: "Failed to get cities" });
  }
});

router.post("/cities", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { name, region } = req.body;
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const city = await db.insert(citiesTable).values({ id, name, region, country: "Côte d'Ivoire", status: "active" }).returning();
    res.json(city[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create city" });
  }
});

router.delete("/cities/:id", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    await db.delete(citiesTable).where(eq(citiesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete city" });
  }
});

router.get("/trips", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const trips = await db.select().from(tripsTable);
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/parcels", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const parcels = await db.select().from(parcelsTable).orderBy(desc(parcelsTable.createdAt));
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const payments = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt));
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
    res.json(bookings.map(b => ({
      id: b.id, bookingRef: b.bookingRef, tripId: b.tripId,
      totalAmount: b.totalAmount, status: b.status, paymentMethod: b.paymentMethod,
      passengers: b.passengers, seatNumbers: b.seatNumbers, createdAt: b.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { role } = req.body;
    if (!role) { res.status(400).json({ error: "role required" }); return; }
    await db.update(usersTable).set({ role }).where(eq(usersTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/companies/:id/status", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { status } = req.body;
    if (!status) { res.status(400).json({ error: "status required" }); return; }
    await db.update(companiesTable).set({ status }).where(eq(companiesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
