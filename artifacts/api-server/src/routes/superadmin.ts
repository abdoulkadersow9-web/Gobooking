import { Router, type IRouter } from "express";
import { db, usersTable, companiesTable, busesTable, agentsTable, citiesTable, tripsTable, bookingsTable, parcelsTable, paymentsTable, commissionSettingsTable, walletTransactionsTable, invoicesTable, auditLogsTable } from "@workspace/db";
import { eq, desc, sql, and, count, gte, lte, between } from "drizzle-orm";
import { getAuditLogs } from "../audit";
import crypto from "crypto";
import { tokenStore } from "./auth";

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

async function creditWalletIfNeeded(bookingId: string) {
  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!booking) return;
    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
    if (!trip) return;
    let companyId: string | null = trip.companyId ?? null;
    if (!companyId) {
      const [bus] = await db.select().from(busesTable).where(eq(busesTable.busName, trip.busName)).limit(1);
      if (bus) companyId = bus.companyId;
    }
    if (!companyId) return;
    const alreadyCredited = await db.select().from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.bookingId, bookingId)).limit(1);
    if (alreadyCredited.length) return;
    const gross = booking.totalAmount;
    const commission = booking.commissionAmount || 0;
    const net = gross - commission;
    await db.insert(walletTransactionsTable).values({
      id: genId(), companyId, bookingId: booking.id, bookingRef: booking.bookingRef,
      type: "credit", grossAmount: gross, commissionAmount: commission, netAmount: net,
      description: `Réservation ${booking.bookingRef} — ${trip.from} → ${trip.to}`,
    });
    await db.update(companiesTable).set({ walletBalance: sql`wallet_balance + ${net}` }).where(eq(companiesTable.id, companyId));
  } catch (err) {
    console.error("creditWalletIfNeeded error:", err);
  }
}

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

/* Routes POST /superadmin/trips, PATCH /superadmin/trips/:id et DELETE /superadmin/trips/:id
   supprimées — la gestion des trajets est réservée aux compagnies (/company/trips). */
router.post("/trips", async (_req, res) => {
  res.status(403).json({ error: "Accès refusé — la création de trajets est réservée aux compagnies" });
});
router.patch("/trips/:id", async (_req, res) => {
  res.status(403).json({ error: "Accès refusé — la modification de trajets est réservée aux compagnies" });
});
router.delete("/trips/:id", async (_req, res) => {
  res.status(403).json({ error: "Accès refusé — la suppression de trajets est réservée aux compagnies" });
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

/* ─── Statistiques de réservations groupées par compagnie (admin uniquement) ─
   GET /superadmin/bookings/stats
   Retourne les compteurs par statut par compagnie — sans détails individuels
   ni prix.
────────────────────────────────────────────────────────────────────────────── */
router.get("/bookings/stats", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const rows = await db
      .select({
        status:      bookingsTable.status,
        tripId:      bookingsTable.tripId,
        busName:     tripsTable.busName,
        companyId:   tripsTable.companyId,
        companyName: companiesTable.name,
      })
      .from(bookingsTable)
      .leftJoin(tripsTable,    eq(bookingsTable.tripId, tripsTable.id))
      .leftJoin(companiesTable, eq(tripsTable.companyId, companiesTable.id));

    const map: Record<string, { name: string; total: number; confirmed: number; pending: number; cancelled: number }> = {};
    for (const r of rows) {
      const key  = r.companyId  || r.busName  || "Autre";
      const name = r.companyName || r.busName || "Compagnie inconnue";
      if (!map[key]) map[key] = { name, total: 0, confirmed: 0, pending: 0, cancelled: 0 };
      map[key].total++;
      if (r.status === "confirmed")  map[key].confirmed++;
      else if (r.status === "pending")   map[key].pending++;
      else if (r.status === "cancelled") map[key].cancelled++;
    }

    const byCompany = Object.values(map).sort((a, b) => b.total - a.total);
    res.json({
      total:     rows.length,
      confirmed: rows.filter(r => r.status === "confirmed").length,
      pending:   rows.filter(r => r.status === "pending").length,
      cancelled: rows.filter(r => r.status === "cancelled").length,
      byCompany,
    });
  } catch (err) {
    console.error("Booking stats error:", err);
    res.status(500).json({ error: "Failed to get booking stats" });
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
    const prev = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    const [booking] = await db.update(bookingsTable).set({ status }).where(eq(bookingsTable.id, req.params.id)).returning();
    if (!booking) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    if (status === "confirmed" && prev[0]?.status !== "confirmed") {
      await creditWalletIfNeeded(booking.id);
    }
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

/* ─── Commission settings ─────────────────────────────────────────────── */

router.get("/commission", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const rows = await db.select().from(commissionSettingsTable).where(eq(commissionSettingsTable.id, "default")).limit(1);
    if (!rows.length) {
      res.json({ id: "default", type: "percentage", value: 10, updatedAt: new Date().toISOString() });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to get commission settings" });
  }
});

router.put("/commission", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { type, value } = req.body;
    if (!type || !["percentage", "fixed"].includes(type)) { res.status(400).json({ error: "type must be 'percentage' or 'fixed'" }); return; }
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) { res.status(400).json({ error: "value must be a positive number" }); return; }
    const existing = await db.select().from(commissionSettingsTable).where(eq(commissionSettingsTable.id, "default")).limit(1);
    let result;
    if (existing.length) {
      [result] = await db.update(commissionSettingsTable)
        .set({ type, value: v, updatedAt: new Date() })
        .where(eq(commissionSettingsTable.id, "default"))
        .returning();
    } else {
      [result] = await db.insert(commissionSettingsTable)
        .values({ id: "default", type, value: v, updatedAt: new Date() })
        .returning();
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to update commission settings" });
  }
});

/* ─── Revenue / Commission stats ──────────────────────────────────────── */

router.get("/revenue", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const [allBookings, allTrips, commSettings] = await Promise.all([
      db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt)),
      db.select().from(tripsTable),
      db.select().from(commissionSettingsTable).where(eq(commissionSettingsTable.id, "default")).limit(1),
    ]);

    const paidBookings = allBookings.filter(b => b.status !== "cancelled");

    const allParcels = await db.select().from(parcelsTable);
    const paidParcels = allParcels.filter(p => p.paymentStatus === "paid");
    const parcelCommission = paidParcels.reduce((s, p) => s + (p.commissionAmount || 0), 0);
    const parcelRevenue    = paidParcels.reduce((s, p) => s + p.amount, 0);

    const bookingCommission = paidBookings.reduce((s, b) => s + (b.commissionAmount || 0), 0);
    const totalCommission = bookingCommission + parcelCommission;
    const totalRevenue    = paidBookings.reduce((s, b) => s + b.totalAmount, 0) + parcelRevenue;

    // Daily commissions — last 30 days
    const dailyMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, 0);
    }
    for (const b of paidBookings) {
      const key = b.createdAt.toISOString().slice(0, 10);
      if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) || 0) + (b.commissionAmount || 0));
    }
    for (const p of paidParcels) {
      const key = p.createdAt.toISOString().slice(0, 10);
      if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) || 0) + (p.commissionAmount || 0));
    }
    const dailyCommissions = Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount }));

    // Per-company commissions using busName from trips
    const tripMap = new Map(allTrips.map(t => [t.id, t]));
    const companyMap = new Map<string, { name: string; commission: number; bookings: number; revenue: number }>();
    for (const b of paidBookings) {
      const trip = tripMap.get(b.tripId);
      const companyName = trip?.busName || "Inconnu";
      const existing = companyMap.get(companyName) || { name: companyName, commission: 0, bookings: 0, revenue: 0 };
      existing.commission += (b.commissionAmount || 0);
      existing.bookings   += 1;
      existing.revenue    += b.totalAmount;
      companyMap.set(companyName, existing);
    }
    const byCompany = Array.from(companyMap.values())
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 10);

    const settings = commSettings.length ? commSettings[0] : { type: "percentage", value: 10 };

    res.json({
      totalCommission,
      bookingCommission,
      parcelCommission,
      totalRevenue,
      dailyCommissions,
      byCompany,
      settings,
    });
  } catch (err) {
    console.error("Revenue stats error:", err);
    res.status(500).json({ error: "Failed to get revenue stats" });
  }
});

/* GET /superadmin/analytics — Tableau analytique global */
router.get("/analytics", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const [bookings, parcels, companies, allTrips] = await Promise.all([
      db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt)),
      db.select().from(parcelsTable).orderBy(desc(parcelsTable.createdAt)),
      db.select().from(companiesTable),
      db.select().from(tripsTable),
    ]);

    // ── Status breakdown ──────────────────────────────────────────────
    const byStatus = {
      confirmed: bookings.filter(b => b.status === "confirmed").length,
      boarded:   bookings.filter(b => b.status === "boarded").length,
      cancelled: bookings.filter(b => b.status === "cancelled").length,
      pending:   bookings.filter(b => !["confirmed","boarded","cancelled"].includes(b.status)).length,
    };

    // ── Revenue by payment method ─────────────────────────────────────
    const methodMap: Record<string, { count: number; revenue: number }> = {};
    for (const b of bookings.filter(bk => bk.status !== "cancelled")) {
      const m = b.paymentMethod || "unknown";
      if (!methodMap[m]) methodMap[m] = { count: 0, revenue: 0 };
      methodMap[m].count++;
      methodMap[m].revenue += b.totalAmount;
    }
    const byMethod = Object.entries(methodMap).map(([method, d]) => ({ method, ...d }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Bookings per day (last 14 days) ───────────────────────────────
    const today = new Date();
    const dailyBookings: { date: string; count: number; revenue: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayBooks = bookings.filter(b => {
        const bd = b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : "";
        return bd === key;
      });
      dailyBookings.push({
        date: key,
        count: dayBooks.length,
        revenue: dayBooks.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.totalAmount, 0),
      });
    }

    // ── Per-company breakdown ─────────────────────────────────────────
    const tripMap = new Map(allTrips.map(t => [t.id, t]));
    const companyIdMap = new Map(companies.map(c => [c.id, c.name]));

    const compMap: Record<string, { id: string; name: string; total: number; confirmed: number; cancelled: number; revenue: number }> = {};
    for (const b of bookings) {
      const trip = tripMap.get(b.tripId);
      const compId = trip?.companyId || "unknown";
      const compName = companyIdMap.get(compId) || trip?.busName || "Indépendant";
      if (!compMap[compId]) {
        compMap[compId] = { id: compId, name: compName, total: 0, confirmed: 0, cancelled: 0, revenue: 0 };
      }
      compMap[compId].total++;
      if (b.status === "confirmed" || b.status === "boarded") {
        compMap[compId].confirmed++;
        compMap[compId].revenue += b.totalAmount;
      }
      if (b.status === "cancelled") compMap[compId].cancelled++;
    }
    const byCompany = Object.values(compMap).sort((a, b) => b.total - a.total).slice(0, 10);

    // ── KPIs ──────────────────────────────────────────────────────────
    const bookingRevenue = bookings.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.totalAmount, 0);
    const parcelRevenue  = parcels.reduce((s, p) => s + p.amount, 0);

    res.json({
      kpis: {
        totalBookings: bookings.length,
        totalRevenue: bookingRevenue + parcelRevenue,
        bookingRevenue,
        parcelRevenue,
        totalParcels: parcels.length,
        totalCompanies: companies.length,
      },
      byStatus,
      byMethod,
      dailyBookings,
      byCompany,
    });
  } catch (err) {
    console.error("Superadmin analytics error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT LOGS
   GET /superadmin/audit-logs        — paginated logs with optional filters
   GET /superadmin/audit-logs/stats  — counts per action + flagged alerts
═══════════════════════════════════════════════════════════════════════════ */

router.get("/audit-logs/stats", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const [total, flagged, recent] = await Promise.all([
      db.select({ cnt: count() }).from(auditLogsTable),
      db.select({ cnt: count() }).from(auditLogsTable).where(eq(auditLogsTable.flagged, true)),
      db.select({ cnt: count() }).from(auditLogsTable).where(gte(auditLogsTable.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),
    ]);

    const byAction = await db
      .select({ action: auditLogsTable.action, cnt: count() })
      .from(auditLogsTable)
      .groupBy(auditLogsTable.action)
      .orderBy(desc(count()));

    res.json({
      total:   Number(total[0]?.cnt ?? 0),
      flagged: Number(flagged[0]?.cnt ?? 0),
      last24h: Number(recent[0]?.cnt ?? 0),
      byAction: byAction.map(r => ({ action: r.action, count: Number(r.cnt) })),
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/audit-logs", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const action  = req.query.action  as string | undefined;
    const userId  = req.query.userId  as string | undefined;
    const flagged = req.query.flagged === "true" ? true : req.query.flagged === "false" ? false : undefined;
    const limit   = Math.min(parseInt(req.query.limit  as string ?? "100", 10), 200);
    const offset  = parseInt(req.query.offset as string ?? "0",   10);

    const logs = await getAuditLogs({ action, userId, flagged, limit, offset });

    res.json(logs.map(l => ({
      id:         l.id,
      userId:     l.userId,
      userRole:   l.userRole,
      userName:   l.userName,
      action:     l.action,
      targetId:   l.targetId,
      targetType: l.targetType,
      metadata:   l.metadata ? JSON.parse(l.metadata) : null,
      ipAddress:  l.ipAddress,
      flagged:    l.flagged,
      createdAt:  l.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("Audit logs error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   FACTURATION ADMIN
   GET /superadmin/invoices         — toutes les factures de toutes les compagnies
   PUT /superadmin/invoices/:id/pay — marquer une facture comme payée
═══════════════════════════════════════════════════════════════════════════ */

router.get("/invoices", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const invs = await db
      .select()
      .from(invoicesTable)
      .orderBy(desc(invoicesTable.period), desc(invoicesTable.createdAt));

    res.json(invs.map(i => ({
      id:               i.id,
      companyId:        i.companyId,
      companyName:      i.companyName,
      period:           i.period,
      totalGross:       i.totalGross,
      totalCommission:  i.totalCommission,
      totalNet:         i.totalNet,
      transactionCount: i.transactionCount,
      status:           i.status,
      paidAt:           i.paidAt?.toISOString() ?? null,
      createdAt:        i.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("Admin invoices error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/invoices/:id/pay", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    const updated = await db
      .update(invoicesTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(invoicesTable.id, id))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "Facture introuvable" });
      return;
    }

    const i = updated[0];
    res.json({
      id:               i.id,
      companyName:      i.companyName,
      period:           i.period,
      totalCommission:  i.totalCommission,
      totalNet:         i.totalNet,
      status:           i.status,
      paidAt:           i.paidAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("Pay invoice error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── Financial Dashboard ─────────────────────────────────────────────────── */
router.get("/financial", async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Super admin access required" }); return; }

    const period = (req.query.period as string) || "month";
    const now = new Date();
    let startDate: Date;
    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [allPayments, allBookings, allParcels, allCompanies, allTrips] = await Promise.all([
      db.select().from(paymentsTable).where(and(eq(paymentsTable.status, "paid"), gte(paymentsTable.createdAt, startDate))),
      db.select().from(bookingsTable).where(gte(bookingsTable.createdAt, startDate)),
      db.select().from(parcelsTable).where(gte(parcelsTable.createdAt, startDate)),
      db.select().from(companiesTable),
      db.select().from(tripsTable),
    ]);

    const totalRevenue = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalCommissions = Math.round(totalRevenue * 0.1);
    const bookingsCount = allBookings.filter(b => b.paymentStatus === "paid").length;
    const parcelsCount = allParcels.filter(p => p.paymentStatus === "paid").length;

    const dayMap: Record<string, { revenue: number; commissions: number; bookings: number; parcels: number }> = {};
    const daysBack = period === "today" ? 1 : period === "week" ? 7 : 30;
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      dayMap[key] = { revenue: 0, commissions: 0, bookings: 0, parcels: 0 };
    }
    for (const p of allPayments) {
      const d = new Date(p.createdAt!);
      const key = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      if (dayMap[key]) {
        dayMap[key].revenue += Number(p.amount);
        dayMap[key].commissions += Math.round(Number(p.amount) * 0.1);
        if (p.refType === "booking") dayMap[key].bookings++;
        if (p.refType === "parcel") dayMap[key].parcels++;
      }
    }
    const dailyData = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }));

    const growthData = dailyData.map((d, i) => ({
      date: d.date,
      revenue: d.revenue,
      growth: i === 0 ? 0 : dailyData[i - 1].revenue > 0
        ? Math.round(((d.revenue - dailyData[i - 1].revenue) / dailyData[i - 1].revenue) * 100)
        : 0,
    }));

    const tripCompanyMap: Record<string, string> = {};
    for (const t of allTrips) {
      if (t.companyId) tripCompanyMap[t.id] = t.companyId;
    }
    const bookingCompanyMap: Record<string, string> = {};
    for (const b of allBookings) {
      const companyId = tripCompanyMap[b.tripId] || null;
      if (companyId) bookingCompanyMap[b.id] = companyId;
    }
    const parcelCompanyMap: Record<string, string> = {};
    for (const p of allParcels) {
      if (p.companyId) parcelCompanyMap[p.id] = p.companyId;
    }

    const companyRevMap: Record<string, { revenue: number; commissions: number; bookings: number; parcels: number }> = {};
    for (const c of allCompanies) {
      companyRevMap[c.id] = { revenue: 0, commissions: 0, bookings: 0, parcels: 0 };
    }
    for (const p of allPayments) {
      let companyId: string | null = null;
      if (p.refType === "booking" && bookingCompanyMap[p.refId]) companyId = bookingCompanyMap[p.refId];
      else if (p.refType === "parcel" && parcelCompanyMap[p.refId]) companyId = parcelCompanyMap[p.refId];
      if (companyId && companyRevMap[companyId]) {
        companyRevMap[companyId].revenue += Number(p.amount);
        companyRevMap[companyId].commissions += Math.round(Number(p.amount) * 0.1);
        if (p.refType === "booking") companyRevMap[companyId].bookings++;
        if (p.refType === "parcel") companyRevMap[companyId].parcels++;
      }
    }

    const companyBreakdown = allCompanies
      .map(c => ({
        id: c.id,
        name: c.name,
        city: c.city,
        ...(companyRevMap[c.id] || { revenue: 0, commissions: 0, bookings: 0, parcels: 0 }),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const paymentMethodMap: Record<string, number> = {};
    for (const p of allPayments) {
      const m = p.method || "other";
      paymentMethodMap[m] = (paymentMethodMap[m] || 0) + Number(p.amount);
    }
    const paymentMethods = Object.entries(paymentMethodMap).map(([method, amount]) => ({ method, amount }));

    res.json({
      period,
      totalRevenue,
      totalCommissions,
      netRevenue: totalRevenue - totalCommissions,
      bookingsCount,
      parcelsCount,
      totalTransactions: allPayments.length,
      dailyData,
      growthData,
      companyBreakdown,
      paymentMethods,
    });
  } catch (err) {
    console.error("Financial dashboard error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
