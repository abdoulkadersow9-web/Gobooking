import { Router, type IRouter } from "express";
import { db, usersTable, companiesTable, busesTable, agentsTable, citiesTable, tripsTable, bookingsTable, parcelsTable, paymentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { tokenStore } from "./auth";

const router: IRouter = Router();

async function requireSuperAdmin(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length || !["admin", "super_admin"].includes(users[0].role)) return null;
  if (users[0].status === "inactive") return null;
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
    const trips = await db.select().from(tripsTable).orderBy(desc(tripsTable.date));
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/trips", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { from, to, date, departureTime, arrivalTime, price, busType, busName, totalSeats, duration } = req.body;
    if (!from || !to || !date || !departureTime || !arrivalTime || !price || !busName) {
      res.status(400).json({ error: "Champs obligatoires manquants" }); return;
    }
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    const [trip] = await db.insert(tripsTable).values({
      id, from, to, date, departureTime, arrivalTime,
      price: parseFloat(price),
      busType: busType || "Standard",
      busName,
      totalSeats: parseInt(totalSeats) || 44,
      duration: duration || "",
      status: "scheduled",
    }).returning();
    res.json(trip);
  } catch (err) {
    console.error("Create trip error:", err);
    res.status(500).json({ error: "Échec de la création du trajet" });
  }
});

router.patch("/trips/:id", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { from, to, date, departureTime, arrivalTime, price, busType, busName, totalSeats, duration, status } = req.body;
    const updates: Record<string, unknown> = {};
    if (from)          updates.from          = from;
    if (to)            updates.to            = to;
    if (date)          updates.date          = date;
    if (departureTime) updates.departureTime = departureTime;
    if (arrivalTime)   updates.arrivalTime   = arrivalTime;
    if (price)         updates.price         = parseFloat(price);
    if (busType)       updates.busType       = busType;
    if (busName)       updates.busName       = busName;
    if (totalSeats)    updates.totalSeats    = parseInt(totalSeats);
    if (duration)      updates.duration      = duration;
    if (status)        updates.status        = status;
    const [trip] = await db.update(tripsTable).set(updates).where(eq(tripsTable.id, req.params.id)).returning();
    if (!trip) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: "Échec de la modification" });
  }
});

router.delete("/trips/:id", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    await db.delete(tripsTable).where(eq(tripsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression" });
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
      passengers: b.passengers, seatNumbers: b.seatNumbers,
      contactEmail: b.contactEmail, contactPhone: b.contactPhone,
      createdAt: b.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/bookings/:id/status", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { status } = req.body;
    if (!["confirmed", "pending", "cancelled"].includes(status)) {
      res.status(400).json({ error: "Statut invalide. Utilisez : confirmed, pending ou cancelled" }); return;
    }
    const [booking] = await db.update(bookingsTable).set({ status }).where(eq(bookingsTable.id, req.params.id)).returning();
    if (!booking) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    res.json({ id: booking.id, status: booking.status });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour" });
  }
});

/* ─── Création de compte staff (Agent / Compagnie / Admin) ─── */
const STAFF_ROLES = ["agent", "compagnie", "admin"] as const;
type StaffRole = typeof STAFF_ROLES[number];

function generateProvisionalPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "GB";
  for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += "!";
  pw += Math.floor(10 + Math.random() * 90).toString();
  return pw;
}

function hashPasswordSuper(password: string): string {
  return crypto.createHash("sha256").update(password + "gobooking_salt_2024").digest("hex");
}

router.post("/users", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Accès refusé" }); return; }

    const { name, email, phone, role, password } = req.body;
    if (!name || !email || !role) {
      res.status(400).json({ error: "Nom, email et rôle sont requis" });
      return;
    }
    if (!STAFF_ROLES.includes(role as StaffRole)) {
      res.status(400).json({ error: "Rôle invalide. Utilisez : agent, compagnie ou admin" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Cet email est déjà utilisé" });
      return;
    }

    const provisionalPassword = password || generateProvisionalPassword();
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const [user] = await db.insert(usersTable).values({
      id,
      name,
      email,
      phone: phone || "",
      passwordHash: hashPasswordSuper(provisionalPassword),
      role: role as StaffRole,
      status: "active",
    }).returning();

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      },
      provisionalPassword,
    });
  } catch (err) {
    console.error("Create staff error:", err);
    res.status(500).json({ error: "Échec de la création du compte" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Accès refusé" }); return; }

    const { name, email, phone, role } = req.body;
    if (!name && !email && !phone && !role) {
      res.status(400).json({ error: "Au moins un champ à modifier est requis" });
      return;
    }

    const updates: Record<string, string> = {};
    if (name)  updates.name  = name;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;
    if (role)  updates.role  = role;

    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.params.id)).returning();
    if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

    res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status, createdAt: user.createdAt?.toISOString() });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Échec de la modification" });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Accès refusé" }); return; }

    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) {
      res.status(400).json({ error: "Statut invalide. Utilisez : active ou inactive" });
      return;
    }

    const [user] = await db.update(usersTable).set({ status }).where(eq(usersTable.id, req.params.id)).returning();
    if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

    res.json({ id: user.id, status: user.status });
  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ error: "Échec de la modification du statut" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Accès refusé" }); return; }

    await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Échec de la suppression" });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Accès refusé" }); return; }

    const newPassword = generateProvisionalPassword();
    const [user] = await db.update(usersTable)
      .set({ passwordHash: hashPasswordSuper(newPassword) })
      .where(eq(usersTable.id, req.params.id))
      .returning();

    if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

    res.json({ success: true, provisionalPassword: newPassword, email: user.email, name: user.name });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Échec de la réinitialisation" });
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
    if (!["active", "inactive"].includes(status)) { res.status(400).json({ error: "status must be active or inactive" }); return; }
    const [company] = await db.update(companiesTable).set({ status }).where(eq(companiesTable.id, req.params.id)).returning();
    if (!company) { res.status(404).json({ error: "Compagnie introuvable" }); return; }
    res.json({ id: company.id, status: company.status });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/companies/:id", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { name, email, phone, city, address } = req.body;
    const updates: Record<string, string> = {};
    if (name)    updates.name    = name;
    if (email)   updates.email   = email;
    if (phone)   updates.phone   = phone;
    if (city)    updates.city    = city;
    if (address) updates.address = address;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Aucun champ à modifier" }); return; }
    const [company] = await db.update(companiesTable).set(updates).where(eq(companiesTable.id, req.params.id)).returning();
    if (!company) { res.status(404).json({ error: "Compagnie introuvable" }); return; }
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: "Échec de la modification" });
  }
});

router.delete("/companies/:id", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    await db.delete(companiesTable).where(eq(companiesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression" });
  }
});

export default router;
