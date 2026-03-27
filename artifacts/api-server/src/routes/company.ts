import { Router, type IRouter } from "express";
import { db, usersTable, companiesTable, busesTable, agentsTable, tripsTable, bookingsTable, parcelsTable, seatsTable, walletTransactionsTable, boardingRequestsTable, invoicesTable, scansTable, busPositionsTable, agentAlertsTable, smsLogsTable, marketingLogsTable, agencesTable, routesTable, stopsTable, colisLogsTable, fuelLogsTable, tripExpensesTable, agentReportsTable } from "@workspace/db";
import { eq, desc, and, inArray, gte, sql, lt } from "drizzle-orm";
import { sendBulkSMS } from "../lib/smsService";
import { tokenStore } from "./auth";
import { locationStore } from "../locationStore";

const router: IRouter = Router();

async function logColisAction(opts: {
  colisId: string; trackingRef: string | null | undefined;
  action: string; agentId: string; agentName: string; companyId: string | null | undefined; notes?: string;
}) {
  try {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await db.insert(colisLogsTable).values({ id, colisId: opts.colisId, trackingRef: opts.trackingRef ?? null,
      action: opts.action, agentId: opts.agentId, agentName: opts.agentName,
      companyId: opts.companyId ?? null, notes: opts.notes ?? null } as any);
  } catch (e) { console.error("[colisLog company] error:", e); }
}

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

async function requireCompanyWithCompanyId(authHeader: string | undefined): Promise<{ user: typeof usersTable.$inferSelect; companyId: string } | null> {
  const user = await requireCompanyAdmin(authHeader);
  if (!user) return null;
  const company = await getOrCreateCompany(user);
  return { user, companyId: company.id };
}

router.get("/stats", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId } = ctx;

    const [buses, agents, trips, bookings, parcels] = await Promise.all([
      db.select().from(busesTable).where(eq(busesTable.companyId, companyId)),
      db.select().from(agentsTable).where(eq(agentsTable.companyId, companyId)),
      db.select().from(tripsTable).where(eq(tripsTable.companyId, companyId)),
      db.select().from(bookingsTable),
      db.select().from(parcelsTable),
    ]);

    const tripIds = new Set(trips.map(t => t.id));
    const companyBookings = bookings.filter(b => tripIds.has(b.tripId));
    const revenue = companyBookings.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.totalAmount, 0)
      + parcels.reduce((s, p) => s + p.amount, 0);

    res.json({
      totalBuses: buses.length,
      totalAgents: agents.length,
      totalTrips: trips.length,
      totalReservations: companyBookings.length,
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
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const buses = await db.select().from(busesTable)
      .where(eq(busesTable.companyId, ctx.companyId))
      .orderBy(desc(busesTable.createdAt));
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

/* ─── GET /company/profile — company info ─── */
router.get("/profile", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const company = await db.select().from(companiesTable).where(eq(companiesTable.id, ctx.companyId)).limit(1);
    if (!company.length) { res.status(404).json({ error: "Company not found" }); return; }
    const agences = await db.select().from(agencesTable).where(eq(agencesTable.companyId, ctx.companyId));
    res.json({ ...company[0], agences });
  } catch (err) {
    console.error("[GET /company/profile]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── PATCH /company/profile — update company info ─── */
router.patch("/profile", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { name, phone, address, city, licenseNumber } = req.body;
    const updated = await db.update(companiesTable)
      .set({
        ...(name          ? { name }                          : {}),
        ...(phone         ? { phone }                         : {}),
        ...(address       ? { address }                       : {}),
        ...(city          ? { city }                          : {}),
        ...(licenseNumber !== undefined ? { licenseNumber } : {}),
      })
      .where(eq(companiesTable.id, ctx.companyId))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    console.error("[PATCH /company/profile]", err);
    res.status(500).json({ error: "Failed" });
  }
});

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

router.patch("/buses/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const bus = await db.select().from(busesTable).where(eq(busesTable.id, req.params.id)).limit(1);
    if (!bus.length || bus[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }
    const { busName, plateNumber, busType, capacity, status } = req.body;
    const updates: Partial<typeof busesTable.$inferInsert> = {};
    if (busName)      updates.busName     = busName;
    if (plateNumber)  updates.plateNumber = plateNumber;
    if (busType)      updates.busType     = busType;
    if (capacity)     updates.capacity    = Number(capacity);
    if (status)       updates.status      = status;
    const updated = await db.update(busesTable).set(updates).where(eq(busesTable.id, req.params.id)).returning();
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update bus" });
  }
});

/* ─── GET /company/buses/suivi — logistics tracking view ─── */
router.get("/buses/suivi", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const buses = await db.select({
      id: busesTable.id,
      busName: busesTable.busName,
      plateNumber: busesTable.plateNumber,
      busType: busesTable.busType,
      capacity: busesTable.capacity,
      status: busesTable.status,
      logisticStatus: (busesTable as any).logisticStatus,
      currentLocation: (busesTable as any).currentLocation,
      currentTripId: (busesTable as any).currentTripId,
      tripFrom: tripsTable.from,
      tripTo: tripsTable.to,
      tripDate: tripsTable.date,
      tripDepartureTime: tripsTable.departureTime,
      tripStatus: tripsTable.status,
    })
    .from(busesTable)
    .leftJoin(tripsTable, eq((busesTable as any).currentTripId, tripsTable.id))
    .where(eq(busesTable.companyId, ctx.companyId))
    .orderBy(desc(busesTable.createdAt));

    res.json(buses);
  } catch (err) {
    console.error("[buses/suivi]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── PATCH /company/buses/:id/suivi — update logistic status + location ─── */
router.patch("/buses/:id/suivi", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const bus = await db.select().from(busesTable).where(eq(busesTable.id, req.params.id)).limit(1);
    if (!bus.length || bus[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }

    const { logisticStatus, currentLocation, currentTripId } = req.body;
    const existing = bus[0] as any;

    await db.execute(sql`
      UPDATE buses SET
        logistic_status  = ${logisticStatus   ?? existing.logistic_status ?? "en_attente"},
        current_location = ${currentLocation  ?? null},
        current_trip_id  = ${currentTripId    ?? null}
      WHERE id = ${req.params.id}
    `);

    const rows = await db.execute(sql`SELECT * FROM buses WHERE id = ${req.params.id}`);
    res.json((rows as any).rows?.[0] ?? rows[0]);
  } catch (err) {
    console.error("[buses/suivi PATCH]", err);
    res.status(500).json({ error: "Failed to update bus tracking" });
  }
});

/* ─── GET /company/buses/maintenance — maintenance status view ─── */
router.get("/buses/maintenance", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const rows = await db.execute(sql`
      SELECT id, bus_name, plate_number, bus_type, capacity, status,
             condition, issue, last_maintenance_date, created_at
      FROM buses
      WHERE company_id = ${ctx.companyId}
      ORDER BY created_at DESC
    `);
    res.json((rows as any).rows ?? rows);
  } catch (err) {
    console.error("[buses/maintenance GET]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── PATCH /company/buses/:id/maintenance — update condition, issue, lastMaintenanceDate ─── */
router.patch("/buses/:id/maintenance", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const bus = await db.select().from(busesTable).where(eq(busesTable.id, req.params.id)).limit(1);
    if (!bus.length || bus[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }

    const { condition, issue, lastMaintenanceDate } = req.body;
    const existing = bus[0] as any;

    await db.execute(sql`
      UPDATE buses SET
        condition              = ${condition ?? existing.condition ?? "bon"},
        issue                  = ${issue !== undefined ? (issue || null) : (existing.issue ?? null)},
        last_maintenance_date  = ${lastMaintenanceDate ?? existing.last_maintenance_date ?? null}
      WHERE id = ${req.params.id}
    `);

    const rows = await db.execute(sql`SELECT * FROM buses WHERE id = ${req.params.id}`);
    res.json((rows as any).rows?.[0] ?? rows[0]);
  } catch (err) {
    console.error("[buses/maintenance PATCH]", err);
    res.status(500).json({ error: "Failed to update maintenance" });
  }
});

/* ═══════════════════════════════════════════════════════
   FUEL LOGS
═══════════════════════════════════════════════════════ */

/* GET /company/fuel-logs — list all fuel logs with bus info & totals */
router.get("/fuel-logs", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const rows = await db.execute(sql`
      SELECT
        fl.id, fl.bus_id, fl.amount, fl.cost, fl.date, fl.notes, fl.created_at,
        b.bus_name, b.plate_number, b.bus_type
      FROM fuel_logs fl
      JOIN buses b ON b.id = fl.bus_id
      WHERE fl.company_id = ${ctx.companyId}
      ORDER BY fl.date DESC, fl.created_at DESC
    `);

    const logs = (rows as any).rows ?? rows;

    const totalLitres  = logs.reduce((s: number, r: any) => s + parseFloat(r.amount  ?? 0), 0);
    const totalCost    = logs.reduce((s: number, r: any) => s + parseInt(r.cost      ?? 0), 0);

    res.json({ logs, totalLitres, totalCost });
  } catch (err) {
    console.error("[fuel-logs GET]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /company/fuel-logs — add a fuel entry */
router.post("/fuel-logs", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { busId, amount, cost, date, notes } = req.body;
    if (!busId || !amount || !cost) {
      res.status(400).json({ error: "busId, amount et cost sont obligatoires" }); return;
    }

    const bus = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
    if (!bus.length || bus[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Bus introuvable ou non autorisé" }); return;
    }

    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    const logDate = date || new Date().toISOString().split("T")[0];

    await db.insert(fuelLogsTable).values({
      id, companyId: ctx.companyId, busId,
      amount: String(amount), cost: Number(cost),
      date: logDate, notes: notes || null,
    } as any);

    const created = await db.execute(sql`
      SELECT fl.*, b.bus_name, b.plate_number FROM fuel_logs fl
      JOIN buses b ON b.id = fl.bus_id WHERE fl.id = ${id}
    `);
    res.status(201).json(((created as any).rows ?? created)[0]);
  } catch (err) {
    console.error("[fuel-logs POST]", err);
    res.status(500).json({ error: "Failed to save fuel log" });
  }
});

/* DELETE /company/fuel-logs/:id */
router.delete("/fuel-logs/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const log = await db.select().from(fuelLogsTable).where(eq(fuelLogsTable.id, req.params.id)).limit(1);
    if (!log.length || (log[0] as any).companyId !== ctx.companyId) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }
    await db.delete(fuelLogsTable).where(eq(fuelLogsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.delete("/buses/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const bus = await db.select().from(busesTable).where(eq(busesTable.id, req.params.id)).limit(1);
    if (!bus.length || bus[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Accès refusé — ce bus n'appartient pas à votre compagnie" }); return;
    }
    await db.delete(busesTable).where(eq(busesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/agents", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const rows = await db
      .select({
        id:         agentsTable.id,
        userId:     agentsTable.userId,
        companyId:  agentsTable.companyId,
        busId:      agentsTable.busId,
        tripId:     agentsTable.tripId,
        agentCode:  agentsTable.agentCode,
        agentRole:  agentsTable.agentRole,
        agenceId:   agentsTable.agenceId,
        status:     agentsTable.status,
        createdAt:  agentsTable.createdAt,
        name:       usersTable.name,
        email:      usersTable.email,
        phone:      usersTable.phone,
        busName:    busesTable.busName,
        tripFrom:   tripsTable.from,
        tripTo:     tripsTable.to,
        tripDate:   tripsTable.date,
        tripTime:   tripsTable.departureTime,
        agenceName: agencesTable.name,
        agenceCity: agencesTable.city,
      })
      .from(agentsTable)
      .leftJoin(usersTable,   eq(agentsTable.userId,    usersTable.id))
      .leftJoin(busesTable,   eq(agentsTable.busId,     busesTable.id))
      .leftJoin(tripsTable,   eq(agentsTable.tripId,    tripsTable.id))
      .leftJoin(agencesTable, eq(agentsTable.agenceId,  agencesTable.id))
      .where(eq(agentsTable.companyId, ctx.companyId))
      .orderBy(desc(agentsTable.createdAt));

    res.json(rows.map(r => ({
      ...r,
      bus:       r.busName  ?? "Non assigné",
      tripName:  r.tripFrom && r.tripTo
        ? `${r.tripFrom} → ${r.tripTo}${r.tripDate ? " · " + r.tripDate : ""}`
        : "",
      agenceName: r.agenceName ?? null,
      agenceCity: r.agenceCity ?? null,
    })));
  } catch (err) {
    console.error("GET /company/agents error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ═══════════════════════════════════════════════════════
   ALERTES AUTOMATIQUES
═══════════════════════════════════════════════════════ */

/* GET /company/alertes — bus en panne, colis bloqués, trajets vides */
router.get("/alertes", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const cid = ctx.companyId;

    /* 1. Bus en panne */
    const busPanne = await db
      .select({ id: busesTable.id, busName: busesTable.busName, busType: busesTable.busType })
      .from(busesTable)
      .where(and(eq(busesTable.companyId, cid), eq(busesTable.condition, "panne")));

    /* 2. Colis en transit > 48h (status_updated_at or created_at) */
    const threshold48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const colisBloqués = await db
      .select({
        id: parcelsTable.id,
        tracking: parcelsTable.trackingRef,
        from: parcelsTable.fromCity,
        to: parcelsTable.toCity,
        statusUpdatedAt: parcelsTable.statusUpdatedAt,
        createdAt: parcelsTable.createdAt,
      })
      .from(parcelsTable)
      .where(
        and(
          eq(parcelsTable.companyId, cid),
          eq(parcelsTable.status, "en_transit"),
          sql`COALESCE(${parcelsTable.statusUpdatedAt}, ${parcelsTable.createdAt}) < ${threshold48h.toISOString()}`
        )
      );

    /* 3. Trajets peu remplis (fill < 30%) — dans les 7 prochains jours */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingTrips = await db
      .select({
        id: tripsTable.id,
        from: tripsTable.from,
        to: tripsTable.to,
        date: tripsTable.date,
        departureTime: tripsTable.departureTime,
        busName: tripsTable.busName,
        totalSeats: tripsTable.totalSeats,
      })
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.companyId, cid),
          sql`${tripsTable.date} >= ${today.toISOString().split("T")[0]}`,
          sql`${tripsTable.date} <= ${in7days.toISOString().split("T")[0]}`
        )
      );

    let trajetsVides: typeof upcomingTrips = [];
    if (upcomingTrips.length) {
      const tripIds = upcomingTrips.map(t => t.id);
      const bookingCounts = await db
        .select({ tripId: bookingsTable.tripId, passengers: bookingsTable.passengers })
        .from(bookingsTable)
        .where(and(inArray(bookingsTable.tripId, tripIds), eq(bookingsTable.paymentStatus, "paid")));

      const bookedMap: Record<string, number> = {};
      for (const b of bookingCounts) {
        if (!b.tripId) continue;
        const pax = Array.isArray(b.passengers) ? b.passengers.length : 0;
        bookedMap[b.tripId] = (bookedMap[b.tripId] ?? 0) + pax;
      }

      trajetsVides = upcomingTrips.filter(t => {
        const booked = bookedMap[t.id] ?? 0;
        const fill = t.totalSeats > 0 ? booked / t.totalSeats : 0;
        return fill < 0.3;
      });
    }

    const alertes = [
      ...busPanne.map(b => ({
        type: "bus",
        severity: "critical" as const,
        message: `Bus en panne : ${b.busName}`,
        detail: b.busType ?? "",
        id: b.id,
      })),
      ...colisBloqués.map(p => {
        const since = p.statusUpdatedAt ?? p.createdAt;
        const hours = since ? Math.round((Date.now() - new Date(since).getTime()) / 3_600_000) : null;
        return {
          type: "colis",
          severity: "warning" as const,
          message: `Colis bloqué en transit : ${p.tracking ?? p.id.slice(0, 8)}`,
          detail: `${p.from} → ${p.to}${hours ? ` (${hours}h)` : ""}`,
          id: p.id,
        };
      }),
      ...trajetsVides.map(t => ({
        type: "trajet",
        severity: "warning" as const,
        message: `Trajet peu rempli (< 30%) : ${t.from} → ${t.to}`,
        detail: `${t.date} à ${t.departureTime}`,
        id: t.id,
      })),
    ];

    res.json({ alertes, count: alertes.length });
  } catch (err) {
    console.error("[alertes GET]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ═══════════════════════════════════════════════════════
   RENTABILITÉ PAR TRAJET
═══════════════════════════════════════════════════════ */

/* GET /company/rentabilite — recettes, dépenses, bénéfice par trajet */
router.get("/rentabilite", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripList = await db.select().from(tripsTable)
      .where(eq(tripsTable.companyId, ctx.companyId))
      .orderBy(desc(tripsTable.date));

    const tripIds = tripList.map(t => t.id);
    if (!tripIds.length) {
      res.json({ trips: [], summary: { totalRecettes: 0, totalDepenses: 0, totalBenefice: 0, tripCount: 0 } });
      return;
    }

    /* Recettes réservations + passenger count per trip */
    const allBookings = await db.select({
      tripId: bookingsTable.tripId,
      totalAmount: bookingsTable.totalAmount,
      paymentStatus: bookingsTable.paymentStatus,
      passengers: bookingsTable.passengers,
    }).from(bookingsTable).where(and(inArray(bookingsTable.tripId, tripIds), eq(bookingsTable.paymentStatus, "paid")));

    const bookingRev: Record<string, number> = {};
    const bookedSeatsMap: Record<string, number> = {};
    for (const b of allBookings) {
      if (!b.tripId) continue;
      bookingRev[b.tripId] = (bookingRev[b.tripId] ?? 0) + (b.totalAmount ?? 0);
      const pax = Array.isArray(b.passengers) ? b.passengers.length : 0;
      bookedSeatsMap[b.tripId] = (bookedSeatsMap[b.tripId] ?? 0) + pax;
    }

    /* Recettes colis */
    const allParcels = await db.select({
      tripId: parcelsTable.tripId,
      amount: parcelsTable.amount,
      status: parcelsTable.status,
    }).from(parcelsTable).where(inArray(parcelsTable.tripId as any, tripIds));

    const colisRev: Record<string, number> = {};
    for (const p of allParcels) {
      if (!p.tripId || p.status === "annulé") continue;
      colisRev[p.tripId] = (colisRev[p.tripId] ?? 0) + (p.amount ?? 0);
    }

    /* Dépenses */
    const expRows = await db.select().from(tripExpensesTable)
      .where(eq(tripExpensesTable.companyId, ctx.companyId))
      .orderBy(desc(tripExpensesTable.createdAt));

    const expByTrip: Record<string, typeof expRows> = {};
    for (const e of expRows) {
      if (!expByTrip[e.tripId]) expByTrip[e.tripId] = [];
      expByTrip[e.tripId].push(e);
    }

    let sumRec = 0, sumDep = 0;
    const trips = tripList.map(t => {
      const recBil = bookingRev[t.id] ?? 0;
      const recCol = colisRev[t.id] ?? 0;
      const totalRecettes = recBil + recCol;
      const expenses = expByTrip[t.id] ?? [];
      const totalDepenses = expenses.reduce((s, e) => s + e.amount, 0);
      const benefice = totalRecettes - totalDepenses;
      sumRec += totalRecettes;
      sumDep += totalDepenses;
      return {
        tripId: t.id,
        from: t.from,
        to: t.to,
        date: t.date,
        departureTime: t.departureTime,
        busName: t.busName,
        busType: t.busType,
        status: t.status,
        totalRecettes, recettesReservations: recBil, recettesColis: recCol,
        totalDepenses, benefice,
        bookedSeats: bookedSeatsMap[t.id] ?? 0,
        totalSeats: t.totalSeats ?? 0,
        expenses: expenses.map(e => ({ id: e.id, type: e.type, amount: e.amount, description: e.description, date: e.date })),
      };
    });

    res.json({
      trips,
      summary: { totalRecettes: sumRec, totalDepenses: sumDep, totalBenefice: sumRec - sumDep, tripCount: trips.length },
    });
  } catch (err) {
    console.error("[rentabilite GET]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /company/trips/:tripId/expenses — add expense to a trip */
router.post("/trips/:tripId/expenses", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const trip = await db.select().from(tripsTable).where(eq(tripsTable.id, req.params.tripId)).limit(1);
    if (!trip.length || trip[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Trajet non autorisé" }); return;
    }

    const { type, amount, description, date } = req.body;
    if (!amount) { res.status(400).json({ error: "amount requis" }); return; }

    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    await db.insert(tripExpensesTable).values({
      id, companyId: ctx.companyId, tripId: req.params.tripId,
      type: type ?? "autre", amount: Number(amount),
      description: description ?? null,
      date: date ?? new Date().toISOString().split("T")[0],
    } as any);

    const created = await db.select().from(tripExpensesTable).where(eq(tripExpensesTable.id, id)).limit(1);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error("[trips/expenses POST]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* DELETE /company/expenses/:id — delete a trip expense */
router.delete("/expenses/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const exp = await db.select().from(tripExpensesTable).where(eq(tripExpensesTable.id, req.params.id)).limit(1);
    if (!exp.length || exp[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }
    await db.delete(tripExpensesTable).where(eq(tripExpensesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ═══════════════════════════════════════════════════════
   BUS ↔ AGENT ASSIGNMENT
═══════════════════════════════════════════════════════ */

/* GET /company/buses/agents — all buses with their agents + list of free agents */
router.get("/buses/agents", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const busList = await db.select().from(busesTable)
      .where(eq(busesTable.companyId, ctx.companyId))
      .orderBy(busesTable.busName);

    const allAgents = await db.select({
      agentId:   agentsTable.id,
      busId:     agentsTable.busId,
      agentCode: agentsTable.agentCode,
      agentRole: agentsTable.agentRole,
      name:      usersTable.name,
      email:     usersTable.email,
    })
      .from(agentsTable)
      .leftJoin(usersTable, eq(agentsTable.userId, usersTable.id))
      .where(and(eq(agentsTable.companyId, ctx.companyId), eq(agentsTable.status, "active")));

    const buses = busList.map(b => ({
      id: b.id, busName: b.busName, plateNumber: b.plateNumber, busType: b.busType,
      agents: allAgents
        .filter(a => a.busId === b.id)
        .map(a => ({ agentId: a.agentId, agentCode: a.agentCode, agentRole: a.agentRole, name: a.name, email: a.email })),
    }));

    const freeAgents = allAgents
      .filter(a => !a.busId)
      .map(a => ({ agentId: a.agentId, agentCode: a.agentCode, agentRole: a.agentRole, name: a.name, email: a.email }));

    res.json({ buses, freeAgents });
  } catch (err) {
    console.error("[buses/agents GET]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /company/buses/:busId/agents/:agentId — assign agent to bus */
router.post("/buses/:busId/agents/:agentId", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const bus = await db.select().from(busesTable).where(eq(busesTable.id, req.params.busId)).limit(1);
    if (!bus.length || bus[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Bus non autorisé" }); return;
    }

    const agent = await db.select().from(agentsTable).where(eq(agentsTable.id, req.params.agentId)).limit(1);
    if (!agent.length || agent[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Agent non autorisé" }); return;
    }

    await db.update(agentsTable)
      .set({ busId: req.params.busId } as any)
      .where(eq(agentsTable.id, req.params.agentId));

    res.json({ success: true });
  } catch (err) {
    console.error("[buses/:busId/agents POST]", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* DELETE /company/buses/:busId/agents/:agentId — unassign agent from bus */
router.delete("/buses/:busId/agents/:agentId", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agent = await db.select().from(agentsTable).where(eq(agentsTable.id, req.params.agentId)).limit(1);
    if (!agent.length || agent[0].companyId !== ctx.companyId) {
      res.status(403).json({ error: "Agent non autorisé" }); return;
    }

    await db.update(agentsTable)
      .set({ busId: null } as any)
      .where(eq(agentsTable.id, req.params.agentId));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ── Créer un agent avec rôle ─────────────────────────────────────────────
   POST /company/agents
   Crée un compte utilisateur (role=agent) + enregistrement agent
   avec le rôle spécifique (embarquement, vente, reception_colis, route, validation)
─────────────────────────────────────────────────────────────────────────── */
router.post("/agents", async (req, res) => {
  try {
    const admin = await requireCompanyAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { name, email, password, phone, agentRole, agentCode, busId, agenceId } = req.body as {
      name: string; email: string; password: string; phone?: string;
      agentRole: string; agentCode?: string; busId?: string; agenceId?: string;
    };

    const VALID_AGENT_ROLES = [
      "agent_ticket", "agent_embarquement", "agent_colis", "agent_guichet",
      "agent_reception", "agent_route",
      "embarquement", "reception_colis", "vente", "validation", "route",
    ];

    if (!name || !email || !password || !agentRole) {
      res.status(400).json({ error: "Nom, email, mot de passe et rôle sont requis" });
      return;
    }
    if (!VALID_AGENT_ROLES.includes(agentRole)) {
      res.status(400).json({ error: "Rôle d'agent invalide" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Cet email est déjà utilisé" });
      return;
    }

    const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const crypto = await import("crypto");
    const pwHash = crypto.createHash("sha256").update(password + "gobooking_salt_2024").digest("hex");

    const company = await db.select().from(companiesTable).where(eq(companiesTable.email, admin.email)).limit(1);
    const companyId = company[0]?.id ?? "default";

    const userId = generateId();
    const [newUser] = await db.insert(usersTable).values({
      id: userId,
      name,
      email,
      phone: phone ?? "",
      passwordHash: pwHash,
      role: "agent",
    }).returning();

    const code = agentCode || `AGT-${Date.now().toString().slice(-5)}`;
    const agentId = generateId();
    const [newAgent] = await db.insert(agentsTable).values({
      id: agentId,
      userId: newUser.id,
      companyId,
      agenceId: agenceId ?? null,
      agentCode: code,
      agentRole,
      busId: busId ?? null,
      status: "active",
    }).returning();

    res.json({
      id: newAgent.id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      agentCode: newAgent.agentCode,
      agentRole: newAgent.agentRole,
      busId: newAgent.busId,
      status: newAgent.status,
    });
  } catch (err) {
    console.error("Create agent error:", err);
    res.status(500).json({ error: "Impossible de créer l'agent" });
  }
});

/* ── Assigner un agent à un bus et/ou trajet ──────────────────────────────
   PUT /company/agents/:id/assign
   Body : { busId?, tripId? }
─────────────────────────────────────────────────────────────────────────── */
router.put("/agents/:id/assign", async (req, res) => {
  try {
    const admin = await requireCompanyAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentId = req.params.id;
    const { busId, tripId } = req.body as { busId?: string | null; tripId?: string | null };

    const updates: Record<string, string | null> = {};
    if (busId  !== undefined) updates.busId  = busId  || null;
    if (tripId !== undefined) updates.tripId = tripId || null;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "busId ou tripId requis" });
      return;
    }

    const result = await db
      .update(agentsTable)
      .set(updates as any)
      .where(eq(agentsTable.id, agentId))
      .returning();

    if (!result.length) {
      res.status(404).json({ error: "Agent introuvable" });
      return;
    }

    res.json({ success: true, agent: result[0] });
  } catch (err) {
    console.error("Assign agent error:", err);
    res.status(500).json({ error: "Impossible d'assigner l'agent" });
  }
});

router.get("/trips", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const trips = await db.select({
      id:            tripsTable.id,
      from:          tripsTable.from,
      to:            tripsTable.to,
      date:          tripsTable.date,
      departureTime: tripsTable.departureTime,
      arrivalTime:   tripsTable.arrivalTime,
      price:         tripsTable.price,
      totalSeats:    tripsTable.totalSeats,
      duration:      tripsTable.duration,
      status:        tripsTable.status,
      busId:         tripsTable.busId,
      busNameFk:     busesTable.busName,
      busPlate:      busesTable.plateNumber,
      busType:       busesTable.busType,
      busCapacity:   busesTable.capacity,
      busNameText:   tripsTable.busName,
      busTypeText:   tripsTable.busType,
      routeId:       tripsTable.routeId,
    })
      .from(tripsTable)
      .leftJoin(busesTable, eq(tripsTable.busId, busesTable.id))
      .where(eq(tripsTable.companyId, ctx.companyId))
      .orderBy(desc(tripsTable.date), desc(tripsTable.departureTime));

    const tripsWithSeats = await Promise.all(trips.map(async (t) => {
      const available = await db.select({ count: seatsTable.id })
        .from(seatsTable)
        .where(and(eq(seatsTable.tripId, t.id), eq(seatsTable.status, "available")));
      const booked = await db.select({ count: seatsTable.id })
        .from(seatsTable)
        .where(and(eq(seatsTable.tripId, t.id), eq(seatsTable.status, "booked")));
      return {
        ...t,
        busDisplayName: t.busNameFk ?? t.busNameText,
        busDisplayType: t.busType ?? t.busTypeText,
        availableSeats: available.length,
        bookedSeats:    booked.length,
      };
    }));

    res.json(tripsWithSeats);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /company/trips/:id/audit-log — historique des contrôles ─── */
router.get("/trips/:id/audit-log", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.id;
    const [trip] = await db.select({ id: tripsTable.id }).from(tripsTable)
      .where(and(eq(tripsTable.id, tripId), eq(tripsTable.companyId, ctx.companyId))).limit(1);
    if (!trip) { res.status(404).json({ error: "Trajet introuvable" }); return; }

    const result = await db.execute(sql`
      SELECT id, validated_by, validated_at, has_errors, has_warnings, has_critique,
             override_confirmed, items, total_revenue, net_balance
      FROM trip_audit_logs
      WHERE trip_id = ${tripId}
      ORDER BY validated_at DESC
    `);
    res.json((result as any).rows ?? []);
  } catch (err) {
    console.error("[company/trips/:id/audit-log]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── GET /company/trips/:id/agents — agents en service sur un départ ─── */
router.get("/trips/:id/agents", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.id;
    // Vérifier que le trajet appartient à cette compagnie
    const [trip] = await db.select({ id: tripsTable.id }).from(tripsTable)
      .where(and(eq(tripsTable.id, tripId), eq(tripsTable.companyId, ctx.companyId))).limit(1);
    if (!trip) { res.status(404).json({ error: "Trajet introuvable" }); return; }

    const result = await db.execute(sql`
      SELECT user_id, agent_role, name, contact, recorded_at,
             agence_id, agence_name, agence_city
      FROM trip_agents
      WHERE trip_id = ${tripId}
      ORDER BY recorded_at ASC
    `);
    res.json((result as any).rows ?? []);
  } catch (err) {
    console.error("[company/trips/:id/agents]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const companyTrips = await db.select({
      id: tripsTable.id,
      from: tripsTable.from,
      to: tripsTable.to,
      departureTime: tripsTable.departureTime,
      date: tripsTable.date,
    }).from(tripsTable).where(eq(tripsTable.companyId, ctx.companyId));
    const tripIds = companyTrips.map(t => t.id);
    if (!tripIds.length) { res.json([]); return; }
    const tripMap = Object.fromEntries(companyTrips.map(t => [t.id, t]));
    const bookings = await db.select().from(bookingsTable)
      .where(inArray(bookingsTable.tripId, tripIds))
      .orderBy(desc(bookingsTable.createdAt));
    res.json(bookings.map(b => {
      const trip = tripMap[b.tripId] ?? {};
      const pax = (b.passengers as any[]) ?? [];
      return {
        id: b.id,
        bookingRef: b.bookingRef,
        tripId: b.tripId,
        totalAmount: b.totalAmount ?? 0,
        total_price: b.totalAmount ?? 0,
        status: b.status,
        passengers: pax,
        passenger_name: pax[0]?.name || "—",
        departure_city: trip.from || "—",
        arrival_city: trip.to || "—",
        departure_time: trip.date && trip.departureTime
          ? `${trip.date}T${trip.departureTime}:00`
          : b.createdAt?.toISOString() ?? new Date().toISOString(),
        createdAt: b.createdAt?.toISOString(),
      };
    }));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/parcels", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const parcels = await db.select().from(parcelsTable)
      .where(eq(parcelsTable.companyId, ctx.companyId))
      .orderBy(desc(parcelsTable.createdAt));
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/parcels/stats", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const today = new Date().toISOString().split("T")[0];
    const parcels = await db.select().from(parcelsTable)
      .where(eq(parcelsTable.companyId, ctx.companyId))
      .orderBy(desc(parcelsTable.createdAt));

    const todayParcels = parcels.filter(p => p.createdAt?.toISOString().startsWith(today));

    res.json({
      total: parcels.length,
      createdToday: todayParcels.length,
      byStatus: {
        créé:        parcels.filter(p => p.status === "créé").length,
        en_gare:     parcels.filter(p => p.status === "en_gare").length,
        chargé_bus:  parcels.filter(p => p.status === "chargé_bus").length,
        en_transit:  parcels.filter(p => p.status === "en_transit").length,
        arrivé:      parcels.filter(p => p.status === "arrivé").length,
        livré:       parcels.filter(p => p.status === "livré").length,
        annulé:      parcels.filter(p => p.status === "annulé").length,
      },
      recent: parcels.slice(0, 10).map(p => ({
        id: p.id, trackingRef: p.trackingRef, status: p.status,
        fromCity: p.fromCity, toCity: p.toCity,
        senderName: p.senderName, receiverName: p.receiverName,
        busId: p.busId, tripId: p.tripId, amount: p.amount,
        createdAt: p.createdAt?.toISOString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/trips", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    if (ctx.user.role !== "compagnie") {
      res.status(403).json({ error: "Accès refusé — seules les compagnies peuvent créer des trajets" });
      return;
    }
    const { from, to, date, departureTime, arrivalTime, price, busName, busType, totalSeats, duration, busId } = req.body;
    if (!from || !to || !date || !departureTime || !price) { res.status(400).json({ error: "Required fields missing" }); return; }
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);

    let resolvedBusName = busName || "Bus GoBooking";
    let resolvedBusType = busType || "Standard";
    let resolvedSeats   = Number(totalSeats) || 44;
    if (busId) {
      const busRows = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
      if (busRows.length) {
        resolvedBusName = busRows[0].busName;
        resolvedBusType = busRows[0].busType;
        resolvedSeats   = busRows[0].capacity;
      }
    }

    const trip = await db.insert(tripsTable).values({
      id, from, to, date, departureTime: departureTime || "08:00", arrivalTime: arrivalTime || "12:00",
      price: Number(price), busName: resolvedBusName, busType: resolvedBusType,
      totalSeats: resolvedSeats, duration: duration || "4h00", amenities: [], stops: [], policies: [],
      companyId: ctx.companyId,
      busId: busId || null,
    } as any).returning();

    /* Générer les sièges automatiquement */
    const colLabels = ["A", "B", "C", "D"];
    const numRows = Math.ceil(resolvedSeats / 4);
    const seatRows: any[] = [];
    for (let row = 1; row <= numRows; row++) {
      for (let col = 1; col <= 4; col++) {
        if ((row - 1) * 4 + col > resolvedSeats) break;
        seatRows.push({
          id:     `${id}-r${row}c${col}`,
          tripId: id,
          number: `${row}${colLabels[col - 1]}`,
          row,
          column: col,
          type:   col === 1 || col === 4 ? "window" : "aisle",
          status: "available",
          price:  Number(price),
        });
      }
    }
    if (seatRows.length > 0) {
      await db.insert(seatsTable).values(seatRows).onConflictDoNothing();
    }

    res.json(trip[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create trip" });
  }
});

router.delete("/trips/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const trips = await db.select().from(tripsTable).where(and(eq(tripsTable.id, req.params.id), eq(tripsTable.companyId, ctx.companyId))).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    if (trips[0].status === "en_route") { res.status(400).json({ error: "Impossible de supprimer un trajet en cours" }); return; }
    await db.delete(tripsTable).where(eq(tripsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Impossible de supprimer le trajet" });
  }
});

router.post("/trips/:id/start", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { id } = req.params;
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, id)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    if (trips[0].status === "en_route") { res.json({ success: true, status: "en_route" }); return; }
    await db.update(tripsTable).set({ status: "en_route" }).where(eq(tripsTable.id, id));
    res.json({ success: true, status: "en_route" });
  } catch (err) {
    res.status(500).json({ error: "Impossible de démarrer le trajet" });
  }
});

router.post("/trips/:id/end", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { id } = req.params;
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, id)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    await db.update(tripsTable).set({ status: "completed" }).where(eq(tripsTable.id, id));
    res.json({ success: true, status: "completed" });
  } catch (err) {
    res.status(500).json({ error: "Impossible de terminer le trajet" });
  }
});

/* ── Créer une réservation manuelle en gare (compagnie uniquement) ────────
   POST /company/reservations
   Permet à la compagnie d'enregistrer une réservation pour un client
   qui se présente directement au guichet.
─────────────────────────────────────────────────────────────────────────── */
router.post("/reservations", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    if (!["compagnie", "admin", "company_admin"].includes(user.role)) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }

    const { clientName, clientPhone, tripId, seatCount, paymentMethod } = req.body as {
      clientName: string; clientPhone: string; tripId: string;
      seatCount: number; paymentMethod: string;
    };

    if (!clientName?.trim() || !tripId || !seatCount) {
      res.status(400).json({ error: "Champs obligatoires manquants (clientName, tripId, seatCount)" }); return;
    }

    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = trips[0];

    const count   = Math.max(1, Math.min(10, Number(seatCount) || 1));
    const amount  = trip.price * count;
    const ref     = "GB" + Math.random().toString(36).toUpperCase().substr(2, 8);
    const id      = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const passengers = Array.from({ length: count }, (_, i) =>
      i === 0 ? { name: clientName.trim() } : { name: `Passager ${i + 1}` }
    );

    const [booking] = await db.insert(bookingsTable).values({
      id,
      bookingRef:    ref,
      userId:        user.id,
      tripId,
      passengers,
      seatIds:       [],
      seatNumbers:   [],
      totalAmount:   amount,
      paymentMethod: paymentMethod || "cash",
      paymentStatus: "paid",
      status:        "confirmed",
      contactPhone:  clientPhone || null,
      commissionAmount: Math.round(amount * 0.10),
    }).returning();

    res.status(201).json({
      id: booking.id, bookingRef: booking.bookingRef, tripId: booking.tripId,
      totalAmount: booking.totalAmount, status: booking.status,
      paymentMethod: booking.paymentMethod, passengers: booking.passengers,
      seatNumbers: booking.seatNumbers, createdAt: booking.createdAt?.toISOString(),
    });
  } catch (err) {
    console.error("Company create reservation error:", err);
    res.status(500).json({ error: "Échec de la création de la réservation" });
  }
});

/* ── Lister les réservations de la compagnie (données enrichies) ──────────
   GET /company/reservations
   Retourne les réservations avec infos client, trajet et paiement
─────────────────────────────────────────────────────────────────────────── */
router.get("/reservations", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    /* Récupérer tous les trajets de la compagnie */
    const companyTrips = await db.select().from(tripsTable)
      .where(eq(tripsTable.companyId, ctx.companyId));
    const tripIds = companyTrips.map(t => t.id);
    const tripMap = new Map(companyTrips.map(t => [t.id, t]));

    if (!tripIds.length) { res.json([]); return; }

    /* Récupérer les réservations pour ces trajets */
    const bookings = await db.select().from(bookingsTable)
      .where(inArray(bookingsTable.tripId, tripIds))
      .orderBy(desc(bookingsTable.createdAt));

    if (!bookings.length) { res.json([]); return; }

    /* Récupérer les infos utilisateurs */
    const userIds = [...new Set(bookings.map(b => b.userId))];
    const users = await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, email: usersTable.email })
      .from(usersTable).where(inArray(usersTable.id, userIds));
    const userMap = new Map(users.map(u => [u.id, u]));

    const enriched = bookings.map(b => {
      const trip = tripMap.get(b.tripId);
      const user = userMap.get(b.userId);
      const firstPassenger = Array.isArray(b.passengers) && b.passengers.length > 0
        ? (b.passengers[0] as any) : null;
      const clientName = user?.name || firstPassenger?.name || "Client";
      const clientPhone = b.contactPhone || user?.phone || "";
      const clientEmail = b.contactEmail || user?.email || "";

      return {
        id:            b.id,
        bookingRef:    b.bookingRef,
        clientName,
        clientPhone,
        clientEmail,
        tripId:        b.tripId,
        tripFrom:      trip?.from ?? "",
        tripTo:        trip?.to ?? "",
        tripDate:      trip?.date ?? "",
        tripDeparture: trip?.departureTime ?? "",
        totalAmount:   b.totalAmount,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
        status:        b.status,
        seatNumbers:   b.seatNumbers,
        passengers:    b.passengers,
        createdAt:     b.createdAt?.toISOString(),
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("GET /company/reservations error:", err);
    res.status(500).json({ error: "Échec de la récupération des réservations" });
  }
});

/* ── Créer un colis (compagnie uniquement) ────────────────────────────────
   POST /company/parcels
   Permet à la compagnie d'enregistrer un colis au guichet.
─────────────────────────────────────────────────────────────────────────── */
router.post("/parcels", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    if (!["compagnie", "admin", "company_admin"].includes(user.role)) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }

    const { senderName, senderPhone, receiverName, receiverPhone, fromCity, toCity, weight, paymentMethod } = req.body as {
      senderName: string; senderPhone: string; receiverName: string; receiverPhone: string;
      fromCity: string; toCity: string; weight: string | number; paymentMethod?: string;
    };

    if (!senderName?.trim() || !receiverName?.trim() || !fromCity || !toCity || !weight) {
      res.status(400).json({ error: "Champs obligatoires manquants" }); return;
    }

    const kg = parseFloat(String(weight)) || 1;
    const base = 1500;
    const weightExtra = Math.ceil(kg) * 400;
    const amount = base + weightExtra + 1500;

    const trackingRef = "GBX-" +
      Math.random().toString(36).toUpperCase().substr(2, 4) + "-" +
      Math.random().toString(36).toUpperCase().substr(2, 4);
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const company = await db.select({ id: companiesTable.id })
      .from(companiesTable).where(eq(companiesTable.userId, user.id)).limit(1);
    const companyId = company[0]?.id ?? null;

    const [parcel] = await db.insert(parcelsTable).values({
      id,
      trackingRef,
      userId:        user.id,
      senderName:    senderName.trim(),
      senderPhone:   senderPhone || "",
      receiverName:  receiverName.trim(),
      receiverPhone: receiverPhone || "",
      fromCity,
      toCity,
      parcelType:    "standard",
      weight:        kg,
      deliveryType:  "en_gare",
      amount,
      paymentMethod: paymentMethod || "cash",
      paymentStatus: "paid",
      status:        "créé",
      companyId,
    }).returning();

    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef,
      action: "créé", agentId: user.id, agentName: user.name, companyId }).catch(() => {});

    res.status(201).json(parcel);
  } catch (err) {
    console.error("Company create parcel error:", err);
    res.status(500).json({ error: "Échec de la création du colis" });
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

/* ─── En-route boarding request management ─────────────────────────────────
   Company sees and manages boarding requests for their active trips
──────────────────────────────────────────────────────────────────────────── */

/* GET /company/boarding-requests — pending/accepted boarding requests for company's trips */
router.get("/boarding-requests", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const company = await getOrCreateCompany(user);

    /* Find all active trips for this company */
    const activeTrips = await db
      .select({ id: tripsTable.id })
      .from(tripsTable)
      .where(and(
        eq(tripsTable.companyId, company.id),
        inArray(tripsTable.status, ["en_route", "en_cours"])
      ));

    if (activeTrips.length === 0) { res.json([]); return; }

    const tripIds = activeTrips.map(t => t.id);

    const rows = await db
      .select()
      .from(boardingRequestsTable)
      .where(inArray(boardingRequestsTable.tripId, tripIds))
      .orderBy(desc(boardingRequestsTable.createdAt))
      .limit(100);

    res.json(rows.map(r => ({
      id:             r.id,
      tripId:         r.tripId,
      clientName:     r.clientName,
      clientPhone:    r.clientPhone,
      boardingPoint:  r.boardingPoint,
      seatsRequested: parseInt(r.seatsRequested ?? "1", 10),
      status:         r.status,
      createdAt:      r.createdAt?.toISOString(),
      respondedAt:    r.respondedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    console.error("company boarding-requests error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /company/boarding-requests/:id/accept */
router.post("/boarding-requests/:id/accept", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const rows = await db
      .select()
      .from(boardingRequestsTable)
      .where(eq(boardingRequestsTable.id, req.params.id))
      .limit(1);

    if (!rows.length) { res.status(404).json({ error: "Demande introuvable" }); return; }
    const request = rows[0];

    if (request.status !== "pending") {
      res.status(409).json({ error: "Demande déjà traitée" }); return;
    }

    const n = parseInt(request.seatsRequested ?? "1", 10);
    let seatsBooked = 0;

    /* Deduct available seats if real trip */
    const isDemoTrip = request.tripId.startsWith("t-") || request.tripId.startsWith("live-");
    if (!isDemoTrip) {
      const availableSeats = await db
        .select({ id: seatsTable.id })
        .from(seatsTable)
        .where(and(eq(seatsTable.tripId, request.tripId), eq(seatsTable.status, "available")))
        .limit(n);

      if (availableSeats.length < n) {
        res.status(409).json({ error: "Plus assez de sièges disponibles", code: "NOT_ENOUGH_SEATS" });
        return;
      }

      if (availableSeats.length > 0) {
        await db
          .update(seatsTable)
          .set({ status: "booked" })
          .where(inArray(seatsTable.id, availableSeats.map(s => s.id)));
        seatsBooked = availableSeats.length;
      }
    } else {
      seatsBooked = n;
    }

    await db
      .update(boardingRequestsTable)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(boardingRequestsTable.id, req.params.id));

    res.json({ success: true, seatsBooked });
  } catch (err) {
    console.error("company accept boarding error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /company/boarding-requests/:id/reject */
router.post("/boarding-requests/:id/reject", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db
      .update(boardingRequestsTable)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(boardingRequestsTable.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* GET /company/analytics — Analytics avancées avec filtres de période */
router.get("/analytics", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const period = (req.query.period as string) || "week";
    const now    = new Date();
    let startDate: Date;

    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    }

    const cid = ctx.companyId;

    /* ─── Fetch data ──────────────────────────────────────────────── */
    const [trips, allBookings, parcels, scans, agents] = await Promise.all([
      db.select().from(tripsTable).where(eq(tripsTable.companyId, cid)),
      db.select().from(bookingsTable),
      db.select().from(parcelsTable).where(eq(parcelsTable.companyId, cid)),
      db.select().from(scansTable).where(eq(scansTable.companyId, cid)),
      db.select({
        id: agentsTable.id, agentRole: agentsTable.agentRole,
        agentName: usersTable.name,
      }).from(agentsTable)
        .leftJoin(usersTable, eq(agentsTable.userId, usersTable.id))
        .where(eq(agentsTable.companyId, cid)),
    ]);

    const tripIds = new Set(trips.map(t => t.id));
    const bookings = allBookings.filter(b => b.tripId && tripIds.has(b.tripId));

    const inPeriod = (d: Date | null | undefined) => d != null && d >= startDate && d <= now;
    const periodBookings = bookings.filter(b => inPeriod(b.createdAt));
    const periodParcels  = parcels.filter(p => inPeriod(p.createdAt));
    const periodScans    = scans.filter(s => inPeriod(s.createdAt));

    /* ─── Revenue ─────────────────────────────────────────────────── */
    const isPaid = (s: string | null) => s === "paid" || s === "payé";
    const bookingRevenue = periodBookings.filter(b => isPaid(b.paymentStatus)).reduce((s, b) => s + (b.totalAmount ?? 0), 0);
    const parcelRevenue  = periodParcels.filter(p => isPaid(p.paymentStatus)).reduce((s, p) => s + (p.amount ?? 0), 0);
    const totalRevenue   = Math.round(bookingRevenue + parcelRevenue);

    /* ─── Occupancy ───────────────────────────────────────────────── */
    const periodTrips = trips.filter(t => { const d = new Date(t.date); return d >= startDate && d <= now; });
    const totalSeats  = periodTrips.reduce((s, t) => s + (t.totalSeats ?? 0), 0);
    const bookedSeats = bookings.filter(b => periodTrips.some(t => t.id === b.tripId) && !["annulé","cancelled"].includes(b.status)).length;
    const occupancyRate = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;

    /* ─── Parcel stats ────────────────────────────────────────────── */
    const parcelDelivered = periodParcels.filter(p => ["livré","delivered"].includes(p.status)).length;

    /* ─── Agent performance ───────────────────────────────────────── */
    const agentStats = agents.map(a => {
      const agScans = periodScans.filter(s => s.agentId === a.id);
      return {
        agentId: a.id, agentName: a.agentName ?? "Agent", agentRole: a.agentRole,
        scans: agScans.length,
        ventes: agScans.filter(s => ["billet","passager","vente"].includes(s.type)).length,
        colis: agScans.filter(s => s.type === "colis").length,
      };
    }).sort((a, b) => b.scans - a.scans);

    /* ─── Payment method breakdown ────────────────────────────────── */
    const methodMap: Record<string, { count: number; revenue: number }> = {};
    for (const b of periodBookings.filter(bk => bk.status !== "cancelled" && bk.status !== "annulé")) {
      const m = b.paymentMethod || "unknown";
      if (!methodMap[m]) methodMap[m] = { count: 0, revenue: 0 };
      methodMap[m].count++;
      methodMap[m].revenue += b.totalAmount ?? 0;
    }
    const byMethod = Object.entries(methodMap).map(([method, d]) => ({ method, ...d })).sort((a, b) => b.revenue - a.revenue);

    /* ─── Daily chart ─────────────────────────────────────────────── */
    const dayCount = period === "today" ? 1 : period === "week" ? 7 : 30;
    const dailyChart: { date: string; revenue: number; bookings: number }[] = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const dd = new Date(now); dd.setDate(dd.getDate() - i);
      const key = dd.toISOString().slice(0, 10);
      const dStart = new Date(key); const dEnd = new Date(key); dEnd.setHours(23, 59, 59, 999);
      const dayBk  = periodBookings.filter(b => b.createdAt && b.createdAt >= dStart && b.createdAt <= dEnd);
      const dayPar = periodParcels.filter(p => p.createdAt && p.createdAt >= dStart && p.createdAt <= dEnd);
      const rev = Math.round(
        dayBk.filter(b => isPaid(b.paymentStatus)).reduce((s, b) => s + (b.totalAmount ?? 0), 0) +
        dayPar.filter(p => isPaid(p.paymentStatus)).reduce((s, p) => s + (p.amount ?? 0), 0)
      );
      dailyChart.push({ date: key, revenue: rev, bookings: dayBk.length });
    }

    /* ─── Booking status breakdown ────────────────────────────────── */
    const byStatus = {
      confirmed: periodBookings.filter(b => b.status === "confirmed").length,
      boarded:   periodBookings.filter(b => b.status === "boarded").length,
      cancelled: periodBookings.filter(b => ["cancelled","annulé"].includes(b.status)).length,
      pending:   periodBookings.filter(b => !["confirmed","boarded","cancelled","annulé"].includes(b.status)).length,
    };

    res.json({
      period,
      revenue:   { total: totalRevenue, booking: Math.round(bookingRevenue), parcel: Math.round(parcelRevenue) },
      occupancy: { rate: occupancyRate, booked: bookedSeats, total: totalSeats },
      parcels:   { total: periodParcels.length, delivered: parcelDelivered, pending: periodParcels.length - parcelDelivered },
      bookings:  { total: periodBookings.length, paid: periodBookings.filter(b => isPaid(b.paymentStatus)).length },
      trips:     { total: periodTrips.length },
      agents:    agentStats,
      dailyChart,
      byStatus,
      byMethod,
    });
  } catch (err) {
    console.error("Company analytics error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD — Statistiques consolidées (filtrées par companyId)
   GET /company/dashboard
═══════════════════════════════════════════════════════════════════════════ */

router.get("/dashboard", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId } = ctx;

    // ── Fetch raw data filtered by company ─────────────────────────────
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.companyId, companyId));
    const tripIds = trips.map(t => t.id);

    const [bookings, parcels, buses] = await Promise.all([
      tripIds.length
        ? db.select().from(bookingsTable).where(inArray(bookingsTable.tripId, tripIds))
        : Promise.resolve([] as (typeof bookingsTable.$inferSelect)[]),
      db.select().from(parcelsTable).where(eq(parcelsTable.companyId, companyId)),
      db.select().from(busesTable).where(eq(busesTable.companyId, companyId)),
    ]);

    // ── Booking stats ─────────────────────────────────────────────────
    const bookingStats = {
      total:     bookings.length,
      confirmed: bookings.filter(b => b.status === "confirmed").length,
      paid:      bookings.filter(b => b.paymentStatus === "payé" || b.paymentStatus === "paid").length,
      boarded:   bookings.filter(b => b.status === "boarded").length,
      cancelled: bookings.filter(b => b.status === "cancelled").length,
      pending:   bookings.filter(b => b.status === "pending").length,
    };

    // ── Parcel stats ──────────────────────────────────────────────────
    const parcelStats = {
      total:       parcels.length,
      créé:        parcels.filter(p => p.status === "créé").length,
      en_gare:     parcels.filter(p => p.status === "en_gare").length,
      chargé_bus:  parcels.filter(p => p.status === "chargé_bus").length,
      en_transit:  parcels.filter(p => p.status === "en_transit").length,
      arrivé:      parcels.filter(p => p.status === "arrivé").length,
      livré:       parcels.filter(p => p.status === "livré").length,
      annulé:      parcels.filter(p => p.status === "annulé").length,
    };

    // ── Revenue ───────────────────────────────────────────────────────
    const paidBookings = bookings.filter(b =>
      b.paymentStatus === "payé" || b.paymentStatus === "paid"
    );
    const bookingRevenue = paidBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const parcelRevenue  = parcels.filter(p => p.status !== "annulé").reduce((s, p) => s + (p.amount || 0), 0);
    const totalRevenue   = bookingRevenue + parcelRevenue;

    // ── Active trips (en_cours) ───────────────────────────────────────
    const activeTrips = trips
      .filter(t => t.status === "en_cours")
      .map(t => ({
        id: t.id,
        from: t.from,
        to: t.to,
        date: t.date,
        departureTime: t.departureTime,
        busName: t.busName,
        status: t.status,
        totalSeats: t.totalSeats,
      }));

    // ── Daily data: last 7 days ───────────────────────────────────────
    const today = new Date();
    const dailyData: { date: string; count: number; revenue: number; parcels: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);

      const dayBooks = bookings.filter(b => {
        const bd = b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : "";
        return bd === key;
      });
      const dayParcels = parcels.filter(p => {
        const pd = p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : "";
        return pd === key;
      });

      dailyData.push({
        date: key,
        count: dayBooks.length,
        revenue: dayBooks
          .filter(b => b.paymentStatus === "payé" || b.paymentStatus === "paid")
          .reduce((s, b) => s + (b.totalAmount || 0), 0),
        parcels: dayParcels.length,
      });
    }

    res.json({
      bookingStats,
      parcelStats,
      revenue: { totalRevenue, bookingRevenue, parcelRevenue },
      activeTrips,
      dailyData,
      summary: {
        totalBuses: buses.length,
        activeBuses: buses.filter(b => b.status === "active").length,
        totalTrips: trips.length,
        activeTripsCount: activeTrips.length,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   FACTURATION — Invoices
   GET  /company/invoices          — list company invoices
   POST /company/invoices/generate — generate/refresh invoice for a period
═══════════════════════════════════════════════════════════════════════════ */

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

/* Construire une période YYYY-MM à partir d'une date (ou now) */
function getPeriod(date?: string): string {
  return date ? date.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

/* GET /company/invoices */
router.get("/invoices", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const company = await getOrCreateCompany(user);

    const invs = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.companyId, company.id))
      .orderBy(desc(invoicesTable.period));

    res.json(invs.map(i => ({
      id:               i.id,
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
    console.error("List invoices error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /company/invoices/generate
   Body (optionnel): { period: "2026-03" }
   Génère ou rafraîchit la facture du mois donné en agrégeant les wallet_transactions.
*/
router.post("/invoices/generate", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const company = await getOrCreateCompany(user);

    const period = getPeriod(req.body?.period);

    /* Transactions du mois */
    const allTx = await db
      .select()
      .from(walletTransactionsTable)
      .where(and(
        eq(walletTransactionsTable.companyId, company.id),
        eq(walletTransactionsTable.type, "credit"),
      ));

    const monthTx = allTx.filter(t => t.createdAt.toISOString().slice(0, 7) === period);

    const totalGross      = monthTx.reduce((s, t) => s + t.grossAmount, 0);
    const totalCommission = monthTx.reduce((s, t) => s + t.commissionAmount, 0);
    const totalNet        = monthTx.reduce((s, t) => s + t.netAmount, 0);
    const transactionCount = monthTx.length;

    /* Upsert : update si existant, sinon insert */
    const existing = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.companyId, company.id), eq(invoicesTable.period, period)))
      .limit(1);

    let invoice;
    if (existing.length) {
      /* Ne pas rétrograder status "paid" → "pending" si déjà payé */
      const newStatus = existing[0].status === "paid" ? "paid" : "pending";
      const updated = await db
        .update(invoicesTable)
        .set({ totalGross, totalCommission, totalNet, transactionCount, status: newStatus })
        .where(eq(invoicesTable.id, existing[0].id))
        .returning();
      invoice = updated[0];
    } else {
      const inserted = await db
        .insert(invoicesTable)
        .values({
          id: generateId(),
          companyId:    company.id,
          companyName:  company.name || user.name || "Compagnie",
          period,
          totalGross,
          totalCommission,
          totalNet,
          transactionCount,
          status: "pending",
        })
        .returning();
      invoice = inserted[0];
    }

    res.json({
      id:               invoice.id,
      period:           invoice.period,
      totalGross:       invoice.totalGross,
      totalCommission:  invoice.totalCommission,
      totalNet:         invoice.totalNet,
      transactionCount: invoice.transactionCount,
      status:           invoice.status,
      paidAt:           invoice.paidAt?.toISOString() ?? null,
      createdAt:        invoice.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Generate invoice error:", err);
    res.status(500).json({ error: "Erreur génération facture" });
  }
});

/* ── GET /company/live-buses — bus positions en temps réel ──────────── */
router.get("/live-buses", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId } = ctx;

    const activeTrips = await db.select({
      id:            tripsTable.id,
      from:          tripsTable.from,
      to:            tripsTable.to,
      date:          tripsTable.date,
      departureTime: tripsTable.departureTime,
      status:        tripsTable.status,
      busId:         tripsTable.busId,
      busName:       busesTable.busName,
      busPlate:      busesTable.plateNumber,
      busType:       busesTable.busType,
    })
      .from(tripsTable)
      .leftJoin(busesTable, eq(tripsTable.busId, busesTable.id))
      .where(and(eq(tripsTable.companyId, companyId), eq(tripsTable.status, "en_route")));

    const tripIds = activeTrips.map(t => t.id);
    const dbPositions = tripIds.length > 0
      ? await db.select().from(busPositionsTable).where(inArray(busPositionsTable.tripId, tripIds))
      : [];
    const dbPosMap = new Map(dbPositions.map(p => [p.tripId, p]));

    const now = Date.now();
    const result = activeTrips.map(trip => {
      const memPos = locationStore.get(trip.id);
      const dbPos  = dbPosMap.get(trip.id);

      let gps: { lat: number; lon: number; speed: number | null; heading: number | null } | null = null;
      let lastUpdated: number | null = null;
      let isOffline = true;
      let isStopped = false;

      if (memPos) {
        gps = { lat: memPos.lat, lon: memPos.lon, speed: memPos.speed ?? null, heading: memPos.heading ?? null };
        lastUpdated = memPos.updatedAt;
        isOffline   = (now - memPos.updatedAt) > 30_000;
        isStopped   = (memPos.speed ?? 1) === 0;
      } else if (dbPos) {
        gps = { lat: dbPos.latitude, lon: dbPos.longitude, speed: dbPos.speed ?? null, heading: dbPos.heading ?? null };
        lastUpdated = dbPos.updatedAt?.getTime() ?? null;
        isOffline   = !lastUpdated || (now - lastUpdated) > 30_000;
        isStopped   = (dbPos.speed ?? 1) === 0;
      }

      return {
        tripId:        trip.id,
        from:          trip.from,
        to:            trip.to,
        date:          trip.date,
        departureTime: trip.departureTime,
        busName:       trip.busName ?? "Bus",
        busPlate:      trip.busPlate ?? null,
        busType:       trip.busType ?? null,
        gps,
        lastUpdated,
        isOffline,
        isStopped,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("live-buses error:", err);
    res.status(500).json({ error: "Erreur suivi temps réel" });
  }
});

/* ── GET /company/trip/:tripId/history — historique GPS ─────────────── */
router.get("/trip/:tripId/history", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const positionsTable = (await import("@workspace/db")).positionsTable;
    const positions = await db.select({
      lat:        positionsTable.lat,
      lon:        positionsTable.lon,
      speed:      positionsTable.speed,
      recordedAt: positionsTable.recordedAt,
    })
      .from(positionsTable)
      .where(eq(positionsTable.tripId, req.params.tripId))
      .orderBy(positionsTable.recordedAt)
      .limit(500);

    res.json(positions.map(p => ({
      lat: p.lat, lon: p.lon,
      speed: p.speed,
      recordedAt: p.recordedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    res.status(500).json({ error: "Erreur historique" });
  }
});

/* ── GET /company/alerts — alertes sécurité des agents ──────────────── */
router.get("/alerts", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const status = req.query.status as string | undefined;
    const limit  = Math.min(Number(req.query.limit) || 100, 200);

    const conditions = [eq(agentAlertsTable.companyId, ctx.companyId)];
    if (status === "active")   conditions.push(eq(agentAlertsTable.status, "active"));
    if (status === "resolved") conditions.push(eq(agentAlertsTable.status, "resolved"));

    const alerts = await db.select().from(agentAlertsTable)
      .where(and(...conditions))
      .orderBy(desc(agentAlertsTable.createdAt))
      .limit(limit);

    res.json(alerts.map(a => ({
      id: a.id, type: a.type, status: a.status,
      agentName: a.agentName, busName: a.busName,
      tripId: a.tripId, lat: a.lat, lon: a.lon,
      message: a.message,
      createdAt: a.createdAt?.toISOString() ?? null,
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    console.error("Company alerts error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── PATCH /company/alerts/:id/resolve — résoudre une alerte ─────────── */
router.patch("/alerts/:id/resolve", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(agentAlertsTable)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: ctx.user.id })
      .where(and(
        eq(agentAlertsTable.id, req.params.id),
        eq(agentAlertsTable.companyId, ctx.companyId),
      ));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── GET /company/scan-stats — unified scan counters for current day ── */
router.get("/scan-stats", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const companyId = ctx.companyId;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tripId = req.query.tripId as string | undefined;

    const whereBase = and(
      eq(scansTable.companyId, companyId),
      gte(scansTable.createdAt, todayStart),
      ...(tripId ? [eq(scansTable.trajetId, tripId)] : []),
    );

    const scans = await db.select({
      type:      scansTable.type,
      count:     sql<number>`count(*)::int`,
    })
      .from(scansTable)
      .where(whereBase)
      .groupBy(scansTable.type);

    const stats = { passager: 0, colis: 0, bagage: 0 };
    for (const s of scans) {
      if (s.type === "passager" || s.type === "billet") stats.passager += s.count;
      else if (s.type === "colis") stats.colis += s.count;
      else if (s.type === "bagage") stats.bagage += s.count;
    }

    /* Recent scan history (last 50) */
    const history = await db.select({
      id: scansTable.id, type: scansTable.type, ref: scansTable.ref,
      agentName: scansTable.agentName, trajetId: scansTable.trajetId,
      createdAt: scansTable.createdAt,
    })
      .from(scansTable)
      .where(whereBase)
      .orderBy(desc(scansTable.createdAt))
      .limit(50);

    res.json({
      stats,
      history: history.map(h => ({
        id: h.id, type: h.type, ref: h.ref,
        agentName: h.agentName, trajetId: h.trajetId,
        createdAt: h.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error("Scan stats error:", err);
    res.status(500).json({ error: "Erreur stats scan" });
  }
});

/* ─────────────── CUSTOMERS (base clients fidélité) ─────────────── */

router.get("/customers", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId } = ctx;

    /* Trajets de la compagnie */
    const trips = await db.select({ id: tripsTable.id })
      .from(tripsTable).where(eq(tripsTable.companyId, companyId));
    const tripIds = trips.map(t => t.id);

    if (tripIds.length === 0) { res.json([]); return; }

    /* Réservations sur ces trajets */
    const bookings = await db.select({
      userId:       bookingsTable.userId,
      totalAmount:  bookingsTable.totalAmount,
      status:       bookingsTable.status,
      createdAt:    bookingsTable.createdAt,
      tripId:       bookingsTable.tripId,
      contactPhone: bookingsTable.contactPhone,
    }).from(bookingsTable).where(inArray(bookingsTable.tripId, tripIds));

    /* Agréger par userId */
    const map = new Map<string, {
      userId: string; tripCount: number; totalSpent: number;
      lastTrip: Date; phones: Set<string>;
    }>();

    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const existing = map.get(b.userId);
      if (existing) {
        existing.tripCount++;
        existing.totalSpent += b.totalAmount;
        if (b.createdAt > existing.lastTrip) existing.lastTrip = b.createdAt;
        if (b.contactPhone) existing.phones.add(b.contactPhone);
      } else {
        map.set(b.userId, {
          userId: b.userId, tripCount: 1, totalSpent: b.totalAmount,
          lastTrip: b.createdAt, phones: new Set(b.contactPhone ? [b.contactPhone] : []),
        });
      }
    }

    /* Enrichir avec les données utilisateur */
    const userIds = [...map.keys()];
    const users = userIds.length
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone })
          .from(usersTable).where(inArray(usersTable.id, userIds))
      : [];

    const usersById = new Map(users.map(u => [u.id, u]));
    const now = new Date();
    const cutoffRecent  = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000); // 30 jours
    const cutoffInactive = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 jours

    const customers = [...map.values()].map(c => {
      const user = usersById.get(c.userId);
      const phone = user?.phone ?? [...c.phones][0] ?? "";
      let segment = "recent";
      if (c.tripCount >= 5) segment = "loyal";
      else if (c.lastTrip < cutoffInactive) segment = "inactive";
      else if (c.lastTrip >= cutoffRecent) segment = "recent";
      else segment = "inactive";

      return {
        userId:     c.userId,
        name:       user?.name ?? "Client inconnu",
        email:      user?.email ?? "",
        phone,
        tripCount:  c.tripCount,
        totalSpent: Math.round(c.totalSpent),
        lastTrip:   c.lastTrip,
        segment,
      };
    });

    customers.sort((a, b) => b.tripCount - a.tripCount);
    res.json(customers);
  } catch (err) {
    console.error("Customers error:", err);
    res.status(500).json({ error: "Erreur chargement clients" });
  }
});

/* ─────────────── SMS — ENVOI ─────────────── */

router.post("/sms/send", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId, user } = ctx;

    const { message, segment } = req.body as { message: string; segment: string };
    if (!message?.trim()) { res.status(400).json({ error: "Message requis" }); return; }
    if (!["all", "loyal", "recent", "inactive"].includes(segment)) {
      res.status(400).json({ error: "Segment invalide" }); return;
    }

    /* Charger la base clients */
    const trips = await db.select({ id: tripsTable.id })
      .from(tripsTable).where(eq(tripsTable.companyId, companyId));
    const tripIds = trips.map(t => t.id);

    let phones: string[] = [];
    if (tripIds.length > 0) {
      const bookings = await db.select({
        userId: bookingsTable.userId, contactPhone: bookingsTable.contactPhone,
        totalAmount: bookingsTable.totalAmount, status: bookingsTable.status, createdAt: bookingsTable.createdAt,
      }).from(bookingsTable).where(inArray(bookingsTable.tripId, tripIds));

      const now = new Date();
      const cutoffRecent   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const cutoffInactive = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const map = new Map<string, { count: number; lastTrip: Date; phone: string }>();
      for (const b of bookings) {
        if (b.status === "cancelled" || !b.contactPhone) continue;
        const ex = map.get(b.userId);
        if (ex) {
          ex.count++;
          if (b.createdAt > ex.lastTrip) ex.lastTrip = b.createdAt;
        } else {
          map.set(b.userId, { count: 1, lastTrip: b.createdAt, phone: b.contactPhone });
        }
      }

      const filtered = [...map.values()].filter(c => {
        if (segment === "all") return true;
        if (segment === "loyal") return c.count >= 5;
        if (segment === "recent") return c.count < 5 && c.lastTrip >= cutoffRecent;
        if (segment === "inactive") return c.lastTrip < cutoffInactive;
        return false;
      });

      phones = [...new Set(filtered.map(c => c.phone))];
    }

    /* Envoyer les SMS */
    const { sent, failed } = phones.length > 0
      ? await sendBulkSMS(phones, message)
      : { sent: 0, failed: 0 };

    /* Récupérer le nom de la compagnie */
    const [company] = await db.select({ name: companiesTable.name })
      .from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

    /* Logger */
    await db.insert(smsLogsTable).values({
      id:          `sms-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      companyId,
      companyName: company?.name ?? null,
      segment,
      message:     message.trim(),
      recipients:  sent,
      status:      failed > 0 && sent === 0 ? "failed" : "sent",
      sentBy:      user.id,
    });

    res.json({ sent, failed, total: phones.length });
  } catch (err) {
    console.error("SMS send error:", err);
    res.status(500).json({ error: "Erreur envoi SMS" });
  }
});

/* ─────────────── MARKETING LOGS ─────────────── */

router.get("/marketing/logs", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId } = ctx;

    /* Marketing logs are global (not per-company in MVP) — filter by recent */
    const limit = Math.min(parseInt(req.query.limit as string || "100"), 500);
    const campaign = req.query.campaign as string | undefined;

    let query = db.select().from(marketingLogsTable).$dynamic();
    if (campaign) query = query.where(eq(marketingLogsTable.campaign, campaign));
    const logs = await query.orderBy(desc(marketingLogsTable.createdAt)).limit(limit);

    /* Aggregate stats */
    const all = await db.select().from(marketingLogsTable).orderBy(desc(marketingLogsTable.createdAt)).limit(1000);
    const stats = {
      total:        all.length,
      sent:         all.filter(l => l.status === "sent").length,
      byCampaign: {
        reengagement:   all.filter(l => l.campaign === "reengagement").length,
        post_trip:      all.filter(l => l.campaign === "post_trip").length,
        low_occupancy:  all.filter(l => l.campaign === "low_occupancy").length,
        birthday:       all.filter(l => l.campaign === "birthday").length,
        parcel_arrived: all.filter(l => l.campaign === "parcel_arrived").length,
      },
    };

    res.json({ logs, stats });
  } catch (err) {
    console.error("Marketing logs error:", err);
    res.status(500).json({ error: "Erreur historique marketing" });
  }
});

/* ─────────────── SMS — HISTORIQUE ─────────────── */

router.get("/sms/logs", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId } = ctx;

    const logs = await db.select().from(smsLogsTable)
      .where(eq(smsLogsTable.companyId, companyId))
      .orderBy(desc(smsLogsTable.createdAt))
      .limit(100);

    res.json(logs);
  } catch (err) {
    console.error("SMS logs error:", err);
    res.status(500).json({ error: "Erreur historique SMS" });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   AGENCES — CRUD
   GET    /company/agences            liste les agences de la compagnie
   POST   /company/agences            créer une agence
   PUT    /company/agences/:id        modifier une agence
   DELETE /company/agences/:id        supprimer (désactiver) une agence
   GET    /company/agences/:id/agents liste les agents d'une agence
══════════════════════════════════════════════════════════════════════════ */

router.get("/agences", async (req, res) => {
  try {
    const admin = await requireCompanyAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const company = await db.select().from(companiesTable).where(eq(companiesTable.email, admin.email)).limit(1);
    const companyId = company[0]?.id;
    if (!companyId) { res.status(404).json({ error: "Compagnie introuvable" }); return; }

    const agences = await db.select().from(agencesTable)
      .where(eq(agencesTable.companyId, companyId))
      .orderBy(agencesTable.city, agencesTable.name);

    const allAgents = await db.select({
      id:        agentsTable.id,
      userId:    agentsTable.userId,
      agenceId:  agentsTable.agenceId,
      agentCode: agentsTable.agentCode,
      agentRole: agentsTable.agentRole,
      status:    agentsTable.status,
      name:      usersTable.name,
      email:     usersTable.email,
      phone:     usersTable.phone,
    })
      .from(agentsTable)
      .leftJoin(usersTable, eq(agentsTable.userId, usersTable.id))
      .where(eq(agentsTable.companyId, companyId));

    const agentsById: Record<string, typeof allAgents> = {};
    for (const a of allAgents) {
      if (a.agenceId) {
        agentsById[a.agenceId] = agentsById[a.agenceId] || [];
        agentsById[a.agenceId].push(a);
      }
    }

    res.json(agences.map(a => ({
      ...a,
      agentCount: (agentsById[a.id] || []).length,
      agents: agentsById[a.id] || [],
    })));
  } catch (err) {
    console.error("GET /company/agences error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/agences", async (req, res) => {
  try {
    const admin = await requireCompanyAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const company = await db.select().from(companiesTable).where(eq(companiesTable.email, admin.email)).limit(1);
    const companyId = company[0]?.id;
    if (!companyId) { res.status(404).json({ error: "Compagnie introuvable" }); return; }

    const { name, city, address, phone } = req.body as { name: string; city: string; address?: string; phone?: string };
    if (!name || !city) { res.status(400).json({ error: "Nom et ville sont requis" }); return; }

    const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const [agence] = await db.insert(agencesTable).values({
      id: generateId(),
      name,
      city,
      address: address ?? null,
      phone: phone ?? null,
      companyId,
      status: "active",
    }).returning();

    res.json(agence);
  } catch (err) {
    console.error("POST /company/agences error:", err);
    res.status(500).json({ error: "Erreur création agence" });
  }
});

router.put("/agences/:id", async (req, res) => {
  try {
    const admin = await requireCompanyAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const company = await db.select().from(companiesTable).where(eq(companiesTable.email, admin.email)).limit(1);
    const companyId = company[0]?.id;
    if (!companyId) { res.status(404).json({ error: "Compagnie introuvable" }); return; }

    const agenceId = req.params.id;
    const [existing] = await db.select().from(agencesTable)
      .where(and(eq(agencesTable.id, agenceId), eq(agencesTable.companyId, companyId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Agence introuvable" }); return; }

    const { name, city, address, phone, status } = req.body;
    const [updated] = await db.update(agencesTable)
      .set({ ...(name && { name }), ...(city && { city }), address: address ?? existing.address, phone: phone ?? existing.phone, ...(status && { status }) })
      .where(eq(agencesTable.id, agenceId))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("PUT /company/agences/:id error:", err);
    res.status(500).json({ error: "Erreur modification agence" });
  }
});

router.delete("/agences/:id", async (req, res) => {
  try {
    const admin = await requireCompanyAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const company = await db.select().from(companiesTable).where(eq(companiesTable.email, admin.email)).limit(1);
    const companyId = company[0]?.id;
    if (!companyId) { res.status(404).json({ error: "Compagnie introuvable" }); return; }

    const agenceId = req.params.id;
    const [existing] = await db.select().from(agencesTable)
      .where(and(eq(agencesTable.id, agenceId), eq(agencesTable.companyId, companyId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Agence introuvable" }); return; }

    await db.update(agencesTable).set({ status: "inactive" }).where(eq(agencesTable.id, agenceId));
    res.json({ ok: true, id: agenceId });
  } catch (err) {
    console.error("DELETE /company/agences/:id error:", err);
    res.status(500).json({ error: "Erreur suppression agence" });
  }
});

router.get("/agences/:id/agents", async (req, res) => {
  try {
    const admin = await requireCompanyAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const company = await db.select().from(companiesTable).where(eq(companiesTable.email, admin.email)).limit(1);
    const companyId = company[0]?.id;
    if (!companyId) { res.status(404).json({ error: "Compagnie introuvable" }); return; }

    const agenceId = req.params.id;
    const agents = await db.select({
      id:        agentsTable.id,
      userId:    agentsTable.userId,
      agenceId:  agentsTable.agenceId,
      agentCode: agentsTable.agentCode,
      agentRole: agentsTable.agentRole,
      status:    agentsTable.status,
      createdAt: agentsTable.createdAt,
      name:      usersTable.name,
      email:     usersTable.email,
      phone:     usersTable.phone,
    })
      .from(agentsTable)
      .leftJoin(usersTable, eq(agentsTable.userId, usersTable.id))
      .where(and(eq(agentsTable.companyId, companyId), eq(agentsTable.agenceId, agenceId)))
      .orderBy(desc(agentsTable.createdAt));

    res.json(agents);
  } catch (err) {
    console.error("GET /company/agences/:id/agents error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── GET /company/agences/performance — stats de performance par agence ── */
router.get("/agences/performance", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agences = await db.select().from(agencesTable)
      .where(eq(agencesTable.companyId, ctx.companyId));

    const stats = await db.execute(sql`
      SELECT
        ta.agence_id,
        ta.agence_name,
        ta.agence_city,
        COUNT(DISTINCT ta.trip_id)  AS trips_count,
        COUNT(DISTINCT ta.user_id)  AS agents_count,
        COUNT(*)                    AS operations_count,
        MAX(t.date)                 AS last_trip_date,
        json_agg(DISTINCT ta.agent_role) FILTER (WHERE ta.agent_role IS NOT NULL) AS roles
      FROM trip_agents ta
      INNER JOIN trips t ON t.id = ta.trip_id
      WHERE t.company_id = ${ctx.companyId}
        AND ta.agence_id IS NOT NULL
      GROUP BY ta.agence_id, ta.agence_name, ta.agence_city
      ORDER BY trips_count DESC
    `);

    const statsRows: any[] = (stats as any).rows ?? [];
    const activeIds = new Set(statsRows.map(r => r.agence_id));
    const inactive  = agences
      .filter(ag => !activeIds.has(ag.id))
      .map(ag => ({
        agence_id:        ag.id,
        agence_name:      ag.name,
        agence_city:      ag.city,
        trips_count:      0,
        agents_count:     0,
        operations_count: 0,
        last_trip_date:   null,
        roles:            [],
      }));

    res.json([...statsRows, ...inactive]);
  } catch (err) {
    console.error("[company/agences/performance]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── GET /company/trips/by-agence/:agenceId — trajets gérés par une agence ── */
router.get("/trips/by-agence/:agenceId", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agenceId = req.params.agenceId;
    const result = await db.execute(sql`
      SELECT DISTINCT t.id, t.from, t.to, t.date, t.departure_time AS "departureTime",
             t.status, b.name AS "busName"
      FROM trips t
      INNER JOIN trip_agents ta ON ta.trip_id = t.id AND ta.agence_id = ${agenceId}
      LEFT JOIN buses b ON b.id = t.bus_id
      WHERE t.company_id = ${ctx.companyId}
      ORDER BY t.date DESC, t.departure_time DESC
      LIMIT 100
    `);
    res.json((result as any).rows ?? []);
  } catch (err) {
    console.error("[company/trips/by-agence]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   ROUTES & STOPS
═══════════════════════════════════════════════════════════════════════ */

/** GET /company/routes – list routes with stops for current company */
router.get("/routes", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const routes = await db.select().from(routesTable)
      .where(eq(routesTable.companyId, ctx.companyId))
      .orderBy(routesTable.name);

    const stops = await db.select().from(stopsTable)
      .where(inArray(stopsTable.routeId, routes.map(r => r.id)))
      .orderBy(stopsTable.order);

    const result = routes.map(r => ({
      ...r,
      stops: stops.filter(s => s.routeId === r.id),
    }));
    res.json(result);
  } catch (err) {
    console.error("GET /company/routes error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/** POST /company/routes – create a route */
router.post("/routes", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { name } = req.body;
    if (!name) { res.status(400).json({ error: "Le nom est requis" }); return; }

    const id = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const [route] = await db.insert(routesTable).values({
      id, name, companyId: ctx.companyId, status: "active",
    }).returning();
    res.json(route);
  } catch (err) {
    console.error("POST /company/routes error:", err);
    res.status(500).json({ error: "Erreur création route" });
  }
});

/** PUT /company/routes/:id – update route name/status */
router.put("/routes/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { name, status } = req.body;
    const updates: Record<string, unknown> = {};
    if (name)   updates.name   = name;
    if (status) updates.status = status;

    const [updated] = await db.update(routesTable)
      .set(updates)
      .where(and(eq(routesTable.id, req.params.id), eq(routesTable.companyId, ctx.companyId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Route introuvable" }); return; }
    res.json(updated);
  } catch (err) {
    console.error("PUT /company/routes/:id error:", err);
    res.status(500).json({ error: "Erreur mise à jour" });
  }
});

/** DELETE /company/routes/:id – deactivate route */
router.delete("/routes/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(routesTable)
      .set({ status: "inactive" })
      .where(and(eq(routesTable.id, req.params.id), eq(routesTable.companyId, ctx.companyId)));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /company/routes/:id error:", err);
    res.status(500).json({ error: "Erreur suppression" });
  }
});

/** GET /company/routes/:id/stops – stops ordered for a route */
router.get("/routes/:id/stops", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const stops = await db.select().from(stopsTable)
      .where(eq(stopsTable.routeId, req.params.id))
      .orderBy(stopsTable.order);
    res.json(stops);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/** POST /company/routes/:id/stops – add a stop to a route */
router.post("/routes/:id/stops", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { name, city, latitude, longitude, order } = req.body;
    if (!name || !city) { res.status(400).json({ error: "name et city requis" }); return; }

    const existing = await db.select().from(stopsTable)
      .where(eq(stopsTable.routeId, req.params.id))
      .orderBy(desc(stopsTable.order))
      .limit(1);
    const nextOrder = order ?? ((existing[0]?.order ?? -1) + 1);

    const id = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const [stop] = await db.insert(stopsTable).values({
      id, routeId: req.params.id, name, city,
      latitude:  latitude  ?? null,
      longitude: longitude ?? null,
      order:     nextOrder,
    }).returning();
    res.json(stop);
  } catch (err) {
    console.error("POST /company/routes/:id/stops error:", err);
    res.status(500).json({ error: "Erreur ajout arrêt" });
  }
});

/** PUT /company/stops/:id – update a stop */
router.put("/stops/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { name, city, latitude, longitude, order } = req.body;
    const updates: Record<string, unknown> = {};
    if (name      !== undefined) updates.name      = name;
    if (city      !== undefined) updates.city      = city;
    if (latitude  !== undefined) updates.latitude  = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (order     !== undefined) updates.order     = order;

    const [updated] = await db.update(stopsTable).set(updates)
      .where(eq(stopsTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Arrêt introuvable" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erreur mise à jour arrêt" });
  }
});

/** DELETE /company/stops/:id – remove a stop */
router.delete("/stops/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.delete(stopsTable).where(eq(stopsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur suppression arrêt" });
  }
});

/** GET /company/trips/:id/stop-passengers
 * Returns each stop with count/list of passengers boarding there.
 * Used by agent-bus screen.
 */
router.get("/trips/:id/stop-passengers", async (req, res) => {
  try {
    const admin = await requireCompanyAdmin(req.headers.authorization);
    if (!admin) { res.status(403).json({ error: "Unauthorized" }); return; }

    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, req.params.id)).limit(1);
    if (!trip) { res.status(404).json({ error: "Trajet introuvable" }); return; }

    const bookings = await db.select({
      id:         bookingsTable.id,
      bookingRef: bookingsTable.bookingRef,
      passengers: bookingsTable.passengers,
      fromStopId: bookingsTable.fromStopId,
      toStopId:   bookingsTable.toStopId,
      status:     bookingsTable.status,
      userName:   usersTable.name,
    }).from(bookingsTable)
      .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
      .where(and(eq(bookingsTable.tripId, req.params.id), eq(bookingsTable.status, "confirmed")));

    let stops: Array<typeof stopsTable.$inferSelect> = [];
    if (trip.routeId) {
      stops = await db.select().from(stopsTable)
        .where(eq(stopsTable.routeId, trip.routeId))
        .orderBy(stopsTable.order);
    }

    const stopMap = stops.map(s => ({
      ...s,
      passengers: bookings.filter(b => b.fromStopId === s.id),
    }));

    const noStop = bookings.filter(b => !b.fromStopId);

    res.json({ trip, stops: stopMap, noStopPassengers: noStop });
  } catch (err) {
    console.error("GET /company/trips/:id/stop-passengers error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /company/colis-historique ──────────────────────────────────────────
   Returns the complete parcel event timeline for the company.
   Optional filters:  ?trackingRef=GBX-XXXX-XXXX   ?date=YYYY-MM-DD
─────────────────────────────────────────────────────────────────────────── */
router.get("/colis-historique", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId } = ctx;
    const { trackingRef, date } = req.query as { trackingRef?: string; date?: string };

    /* ── 1. Base query: logs for this company ── */
    let baseWhere = eq(colisLogsTable.companyId, companyId);

    if (trackingRef) {
      const rows = await db
        .select({ id: parcelsTable.id })
        .from(parcelsTable)
        .where(
          and(
            eq(parcelsTable.companyId, companyId),
            eq(parcelsTable.trackingRef, trackingRef.toUpperCase()),
          )
        )
        .limit(1);
      const targetColisId = rows[0]?.id;
      if (!targetColisId) { res.json({ logs: [], total: 0 }); return; }
      const logs = await db.select().from(colisLogsTable)
        .where(and(eq(colisLogsTable.companyId, companyId), eq(colisLogsTable.colisId, targetColisId)))
        .orderBy(desc(colisLogsTable.createdAt))
        .limit(500);
      const enriched = await enrichLogs(logs);
      res.json({ logs: enriched, total: enriched.length });
      return;
    }

    /* ── 2. Fetch logs (optionally filtered by date prefix) ── */
    const rawLogs = await db.select().from(colisLogsTable)
      .where(baseWhere)
      .orderBy(desc(colisLogsTable.createdAt))
      .limit(500);

    /* ── 3. Date filter (client-side — ISO string starts with date) ── */
    const filtered = date
      ? rawLogs.filter(l => l.createdAt.toISOString().startsWith(date))
      : rawLogs;

    const enriched = await enrichLogs(filtered);
    res.json({ logs: enriched, total: enriched.length });
  } catch (err) {
    console.error("GET /company/colis-historique error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── Enrich logs with parcel data (sender, receiver, route) ── */
async function enrichLogs(logs: typeof colisLogsTable.$inferSelect[]) {
  if (!logs.length) return [];
  const colisIds = [...new Set(logs.map(l => l.colisId).filter(Boolean))];
  const parcels = colisIds.length
    ? await db.select({
        id:           parcelsTable.id,
        trackingRef:  parcelsTable.trackingRef,
        senderName:   parcelsTable.senderName,
        receiverName: parcelsTable.receiverName,
        fromCity:     parcelsTable.fromCity,
        toCity:       parcelsTable.toCity,
      }).from(parcelsTable).where(inArray(parcelsTable.id, colisIds))
    : [];
  const pm = Object.fromEntries(parcels.map(p => [p.id, p]));
  return logs.map(l => ({
    ...l,
    trackingRef:  l.trackingRef ?? pm[l.colisId]?.trackingRef ?? null,
    senderName:   pm[l.colisId]?.senderName   ?? null,
    receiverName: pm[l.colisId]?.receiverName ?? null,
    fromCity:     pm[l.colisId]?.fromCity     ?? null,
    toCity:       pm[l.colisId]?.toCity       ?? null,
  }));
}

/* ─── GET /company/boarding-logs ─────────────────────────────────────────────
   Returns the list of validated passenger scans for the company.
   Optional query param: ?tripId=xxx to filter by a specific trip.
   Enriches each scan with booking passenger names, seat numbers, and trip route.
─────────────────────────────────────────────────────────────────────────── */
router.get("/boarding-logs", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { companyId } = ctx;
    const { tripId } = req.query as { tripId?: string };

    /* ── 1. Fetch passager scans for this company ── */
    const scans = await db
      .select()
      .from(scansTable)
      .where(
        and(
          eq(scansTable.companyId, companyId),
          eq(scansTable.type, "passager"),
          ...(tripId ? [eq(scansTable.trajetId, tripId)] : []),
        )
      )
      .orderBy(desc(scansTable.createdAt))
      .limit(500);

    /* ── 2. Enrich with booking + trip data ── */
    const bookingIds = [...new Set(scans.map(s => s.targetId).filter(Boolean))];
    const tripIds    = [...new Set(scans.map(s => s.trajetId).filter(Boolean) as string[])];

    const [bookings, trips] = await Promise.all([
      bookingIds.length
        ? db.select({
            id:           bookingsTable.id,
            passengers:   bookingsTable.passengers,
            seatNumbers:  bookingsTable.seatNumbers,
            contactPhone: bookingsTable.contactPhone,
          }).from(bookingsTable).where(inArray(bookingsTable.id, bookingIds))
        : Promise.resolve([]),
      tripIds.length
        ? db.select({
            id:            tripsTable.id,
            from:          tripsTable.from,
            to:            tripsTable.to,
            date:          tripsTable.date,
            departureTime: tripsTable.departureTime,
            busName:       tripsTable.busName,
          }).from(tripsTable).where(inArray(tripsTable.id, tripIds))
        : Promise.resolve([]),
    ]);

    const bookingMap = Object.fromEntries(bookings.map(b => [b.id, b]));
    const tripMap    = Object.fromEntries(trips.map(t => [t.id, t]));

    /* ── 3. Build enriched log entries ── */
    const logs = scans.map(s => {
      const bk   = bookingMap[s.targetId] as typeof bookings[0] | undefined;
      const tr   = s.trajetId ? tripMap[s.trajetId] : undefined;
      const pax  = (bk?.passengers as { name?: string }[] | null)?.[0];
      const allPax = (bk?.passengers as { name?: string }[] | null)?.map(p => p.name).filter(Boolean).join(", ");

      return {
        id:           s.id,
        ref:          s.ref,
        bookingId:    s.targetId,
        agentId:      s.agentId,
        agentName:    s.agentName || "Agent",
        tripId:       s.trajetId,
        passengerName: allPax || pax?.name || s.ref,
        seats:        (bk?.seatNumbers as string[] | null)?.join(", ") || "—",
        route:        tr ? `${tr.from} → ${tr.to}` : "—",
        tripDate:     tr?.date || "—",
        departureTime: tr?.departureTime || "—",
        busName:      tr?.busName || "—",
        validatedAt:  s.createdAt,
      };
    });

    /* ── 4. Return trips list for filter UI ── */
    const companyTrips = await db
      .select({ id: tripsTable.id, from: tripsTable.from, to: tripsTable.to,
                date: tripsTable.date, departureTime: tripsTable.departureTime })
      .from(tripsTable)
      .where(eq(tripsTable.companyId, companyId))
      .orderBy(desc(tripsTable.date))
      .limit(50);

    res.json({ logs, trips: companyTrips, total: logs.length });
  } catch (err) {
    console.error("GET /company/boarding-logs error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   RAPPORTS AGENTS — VUE COMPAGNIE
═══════════════════════════════════════════════════════════════════════════ */

/* GET /company/reports — list agent reports for this company */
router.get("/reports", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const reports = await db.select().from(agentReportsTable)
      .where(eq(agentReportsTable.companyId, ctx.companyId))
      .orderBy(desc(agentReportsTable.createdAt))
      .limit(100);

    res.json(reports);
  } catch (err) {
    console.error("GET /company/reports error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* PATCH /company/reports/:id — update report status */
router.patch("/reports/:id", async (req, res) => {
  try {
    const ctx = await requireCompanyWithCompanyId(req.headers.authorization);
    if (!ctx) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { statut } = req.body as { statut: string };
    const validStatuts = ["soumis", "lu", "en_cours", "traite", "rejete"];
    if (!statut || !validStatuts.includes(statut)) {
      res.status(400).json({ error: "Statut invalide" }); return;
    }

    const rows = await db.select().from(agentReportsTable)
      .where(eq(agentReportsTable.id, req.params.id)).limit(1);
    if (!rows.length || rows[0].companyId !== ctx.companyId) {
      res.status(404).json({ error: "Rapport introuvable" }); return;
    }

    const [updated] = await db.update(agentReportsTable)
      .set({ statut })
      .where(eq(agentReportsTable.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("PATCH /company/reports/:id error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
