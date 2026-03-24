import { Router, type IRouter } from "express";
import { db, usersTable, agentsTable, busesTable, bookingsTable, parcelsTable, seatsTable, tripsTable, positionsTable, busPositionsTable, boardingRequestsTable, scansTable, agentAlertsTable, colisLogsTable } from "@workspace/db";
import { auditLog, ACTIONS } from "../audit";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { tokenStore } from "./auth";
import { locationStore, pruneStale } from "../locationStore";
import { requestStore, requestsForTrip, newRequestId, pruneOldRequests, type TripRequest } from "../requestStore";
import { sendExpoPush } from "../pushService";
import { calculateParcelPrice } from "./parcels";
import { awardPoints, POINTS_PER_TRIP } from "./loyalty";

const router: IRouter = Router();

/* ── Colis log helper ───────────────────────────────────────────────────────
   Insert an event into colis_logs whenever a parcel status changes.
─────────────────────────────────────────────────────────────────────────── */
async function logColisAction(opts: {
  colisId:     string;
  trackingRef: string | null | undefined;
  action:      string;
  agentId:     string;
  agentName:   string;
  companyId:   string | null | undefined;
  notes?:      string;
}) {
  try {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await db.insert(colisLogsTable).values({
      id,
      colisId:     opts.colisId,
      trackingRef: opts.trackingRef ?? null,
      action:      opts.action,
      agentId:     opts.agentId,
      agentName:   opts.agentName,
      companyId:   opts.companyId ?? null,
      notes:       opts.notes ?? null,
    } as any);
  } catch (e) {
    console.error("[colisLog] error:", e);
  }
}

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

    const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRecord = agents[0];

    let bookings;
    if (agentRecord?.tripId) {
      bookings = await db.select().from(bookingsTable)
        .where(eq(bookingsTable.tripId, agentRecord.tripId))
        .orderBy(desc(bookingsTable.createdAt));
    } else {
      bookings = await db.select().from(bookingsTable)
        .orderBy(desc(bookingsTable.createdAt))
        .limit(20);
    }

    res.json(bookings.map(b => ({
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

    const bookingId = req.params.bookingId;
    await db.update(bookingsTable).set({ status: "validated" }).where(eq(bookingsTable.id, bookingId));
    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.BOOKING_BOARD, bookingId, "booking").catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── PARCEL MANAGEMENT — Gestion professionnelle des colis ──────────────── */

const PARCEL_STATUSES = ["créé", "en_gare", "chargé_bus", "en_transit", "arrivé", "livré", "annulé"] as const;
type ParcelStatus = typeof PARCEL_STATUSES[number];

async function getAgentCompany(userId: string) {
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, userId)).limit(1);
  return agents[0] ?? null;
}

async function getParcelAndCheckAccess(parcelId: string, agentCompanyId: string | null | undefined) {
  const rows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, parcelId)).limit(1);
  if (!rows.length) return { error: "Colis introuvable", parcel: null };
  const parcel = rows[0];
  if (agentCompanyId && parcel.companyId && parcel.companyId !== agentCompanyId) {
    return { error: "Accès refusé — ce colis appartient à une autre compagnie", parcel: null };
  }
  return { error: null, parcel };
}

/* GET /agent/parcels — list company's parcels (with optional status filter) */
router.get("/parcels", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRecord = await getAgentCompany(user.id);
    const companyId = agentRecord?.companyId ?? null;

    const parcels = companyId
      ? await db.select().from(parcelsTable)
          .where(eq(parcelsTable.companyId, companyId))
          .orderBy(desc(parcelsTable.createdAt))
      : await db.select().from(parcelsTable).orderBy(desc(parcelsTable.createdAt)).limit(50);

    const { status } = req.query;
    const filtered = status ? parcels.filter(p => p.status === status) : parcels;

    res.json(filtered);
  } catch (err) {
    console.error("GET /agent/parcels error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* GET /agent/parcels/by-bus/:busId — parcels loaded on a specific bus */
router.get("/parcels/by-bus/:busId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRecord = await getAgentCompany(user.id);
    const companyId = agentRecord?.companyId ?? null;

    const parcels = await db.select().from(parcelsTable)
      .where(eq(parcelsTable.busId, req.params.busId))
      .orderBy(desc(parcelsTable.createdAt));

    const filtered = companyId ? parcels.filter(p => !p.companyId || p.companyId === companyId) : parcels;
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels — agent creates a parcel (status: "créé") */
router.post("/parcels", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRecord = await getAgentCompany(user.id);
    const {
      senderName, senderPhone, receiverName, receiverPhone,
      fromCity, toCity, parcelType, weight, description,
      deliveryType, paymentMethod, notes,
    } = req.body;

    if (!senderName || !senderPhone || !receiverName || !receiverPhone ||
        !fromCity || !toCity || !parcelType || !weight || !deliveryType) {
      res.status(400).json({ error: "Champs obligatoires manquants" });
      return;
    }

    const amount = calculateParcelPrice(fromCity, toCity, parseFloat(weight), deliveryType);
    const commissionAmount = Math.round(amount * 0.05);

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let part1 = "", part2 = "";
    for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
    const trackingRef = `GBX-${part1}-${part2}`;

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const parcel = await db.insert(parcelsTable).values({
      id, trackingRef, userId: user.id,
      senderName, senderPhone, receiverName, receiverPhone,
      fromCity, toCity, parcelType,
      weight: parseFloat(weight),
      description: description || null,
      deliveryType, amount, commissionAmount,
      paymentMethod: paymentMethod || "orange",
      paymentStatus: "paid",
      status: "créé",
      companyId: agentRecord?.companyId ?? null,
      notes: notes || null,
    } as any).returning();

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_CREATE, parcel[0].id, "parcel",
      { trackingRef, fromCity, toCity, weight, amount }).catch(() => {});

    logColisAction({
      colisId: parcel[0].id, trackingRef,
      action: "créé", agentId: user.id, agentName: user.name,
      companyId: agentRecord?.companyId,
    }).catch(() => {});

    res.status(201).json(parcel[0]);
  } catch (err) {
    console.error("Agent create parcel error:", err);
    res.status(500).json({ error: "Échec de la création du colis" });
  }
});

/* POST /agent/parcels/:id/en-gare — parcel arrives at departure station */
router.post("/parcels/:parcelId/en-gare", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    await db.update(parcelsTable).set({ status: "en_gare", statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, parcel.id));

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_STATUS, parcel.id, "parcel", { status: "en_gare", trackingRef: parcel.trackingRef }).catch(() => {});
    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef, action: "en_gare",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId }).catch(() => {});
    res.json({ success: true, status: "en_gare" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/charge-bus — load parcel onto bus */
router.post("/parcels/:parcelId/charge-bus", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);

    const { busId, tripId } = req.body;
    const effectiveBusId = busId || agentRecord?.busId || null;
    const effectiveTripId = tripId || agentRecord?.tripId || null;

    if (!effectiveBusId) {
      res.status(400).json({ error: "busId requis pour charger dans un bus" });
      return;
    }

    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    await db.update(parcelsTable)
      .set({ status: "chargé_bus", busId: effectiveBusId, tripId: effectiveTripId, statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, parcel.id));

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_STATUS, parcel.id, "parcel",
      { status: "chargé_bus", busId: effectiveBusId, tripId: effectiveTripId, trackingRef: parcel.trackingRef }).catch(() => {});
    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef, action: "chargé_bus",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId,
      notes: effectiveBusId ? `Bus: ${effectiveBusId}` : undefined }).catch(() => {});
    res.json({ success: true, status: "chargé_bus", busId: effectiveBusId, tripId: effectiveTripId });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/arrive — old endpoint still supported via parcels route */
router.post("/parcels/:parcelId/arrive", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    await db.update(parcelsTable).set({ status: "arrivé", statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, parcel.id));

    const userRows = await db.select({ pushToken: usersTable.pushToken })
      .from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
    sendExpoPush(userRows[0]?.pushToken, "GoBooking 📦", `Votre colis ${parcel.trackingRef} est arrivé à destination.`).catch(() => {});

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_STATUS, parcel.id, "parcel", { status: "arrivé", trackingRef: parcel.trackingRef }).catch(() => {});
    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef, action: "arrivé",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId }).catch(() => {});
    res.json({ success: true, status: "arrivé" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/pickup — pris en charge (kept for backward compat) */
router.post("/parcels/:parcelId/pickup", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    await db.update(parcelsTable).set({ status: "en_transit", statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, req.params.parcelId));
    logColisAction({ colisId: req.params.parcelId, trackingRef: null, action: "en_transit",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId }).catch(() => {});
    res.json({ success: true, status: "en_transit" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/transit */
router.post("/parcels/:parcelId/transit", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    await db.update(parcelsTable).set({ status: "en_transit", statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, req.params.parcelId));
    logColisAction({ colisId: req.params.parcelId, trackingRef: null, action: "en_transit",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId }).catch(() => {});
    res.json({ success: true, status: "en_transit" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/deliver — livré */
router.post("/parcels/:parcelId/deliver", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    await db.update(parcelsTable).set({ status: "livré", statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, parcel.id));

    const userRows = await db.select({ pushToken: usersTable.pushToken })
      .from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
    sendExpoPush(userRows[0]?.pushToken, "GoBooking 📦", `Votre colis ${parcel.trackingRef} a été livré. Merci !`).catch(() => {});

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_STATUS, parcel.id, "parcel", { status: "livré", trackingRef: parcel.trackingRef }).catch(() => {});
    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef, action: "livré",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId }).catch(() => {});
    res.json({ success: true, status: "livré" });
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

/* ─── GET /agent/trips/today — today's trips for the company ─── */
router.get("/trips/today", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRecord = agentRows[0];
    const companyId = agentRecord?.companyId ?? null;

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    /* Include today + yesterday (for late departures) */
    let trips = companyId
      ? await db.select().from(tripsTable)
          .where(and(eq(tripsTable.companyId, companyId)))
          .orderBy(desc(tripsTable.date))
          .limit(30)
      : await db.select().from(tripsTable)
          .orderBy(desc(tripsTable.date))
          .limit(20);

    /* Filter client-side to today/yesterday + only actionable statuses */
    trips = trips.filter(t =>
      (t.date === today || t.date === yesterday) &&
      !["arrived", "cancelled"].includes(t.status ?? "")
    );

    /* For each trip, count bookings */
    const enriched = await Promise.all(trips.map(async (trip) => {
      const bookings = await db.select().from(bookingsTable)
        .where(and(
          eq(bookingsTable.tripId, trip.id),
          inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé"])
        ));
      const totalPax = bookings.reduce((acc, b) => acc + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length : 1), 0);
      const boardedPax = bookings
        .filter(b => b.status === "boarded" || b.status === "validated")
        .reduce((acc, b) => acc + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length : 1), 0);

      return {
        id: trip.id,
        from: trip.from,
        to: trip.to,
        date: trip.date,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        busName: trip.busName,
        busType: trip.busType,
        status: trip.status,
        totalSeats: trip.totalSeats,
        busId: (trip as any).busId ?? null,
        totalPassengers: totalPax,
        boardedPassengers: boardedPax,
        absentPassengers: totalPax - boardedPax,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("trips/today error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── GET /agent/trip/:tripId/boarding-status — full passenger list ─── */
router.get("/trip/:tripId/boarding-status", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = trips[0];

    const bookings = await db.select().from(bookingsTable)
      .where(and(
        eq(bookingsTable.tripId, tripId),
        inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé", "pending"])
      ))
      .orderBy(desc(bookingsTable.createdAt));

    const passengers: {
      bookingId: string;
      bookingRef: string;
      name: string;
      phone: string;
      seats: string[];
      status: string;
      boarded: boolean;
      amount: number;
    }[] = [];

    for (const b of bookings) {
      const pList = Array.isArray(b.passengers) ? (b.passengers as any[]) : [];
      const seatNums = Array.isArray(b.seatNumbers) ? (b.seatNumbers as string[]) : [];
      const isBoarded = b.status === "boarded" || b.status === "validated";

      passengers.push({
        bookingId: b.id,
        bookingRef: b.bookingRef ?? "",
        name: pList[0]?.name ?? "Passager",
        phone: pList[0]?.phone ?? b.contactPhone ?? "—",
        seats: seatNums,
        status: b.status ?? "confirmed",
        boarded: isBoarded,
        amount: b.totalAmount ?? 0,
      });
    }

    const boarded = passengers.filter(p => p.boarded);
    const absent = passengers.filter(p => !p.boarded);

    res.json({
      trip: {
        id: trip.id, from: trip.from, to: trip.to,
        date: trip.date, departureTime: trip.departureTime,
        busName: trip.busName, status: trip.status,
        totalSeats: trip.totalSeats,
      },
      passengers,
      stats: {
        total: passengers.length,
        boarded: boarded.length,
        absent: absent.length,
        totalSeats: passengers.reduce((acc, p) => acc + p.seats.length, 0),
        boardedSeats: boarded.reduce((acc, p) => acc + p.seats.length, 0),
        absentSeats: absent.reduce((acc, p) => acc + p.seats.length, 0),
      },
    });
  } catch (err) {
    console.error("boarding-status error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/trips/:tripId/close-departure — cancel absents + free seats ─── */
router.post("/trips/:tripId/close-departure", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = trips[0];

    /* Find all non-boarded bookings */
    const absentBookings = await db.select().from(bookingsTable).where(and(
      eq(bookingsTable.tripId, tripId),
      inArray(bookingsTable.status, ["confirmed", "pending", "payé"])
    ));

    let cancelledCount = 0;
    let freedSeats = 0;
    const cancelledRefs: string[] = [];

    for (const b of absentBookings) {
      await db.update(bookingsTable)
        .set({ status: "cancelled" })
        .where(eq(bookingsTable.id, b.id));

      const seatCount = Array.isArray(b.seatNumbers) ? b.seatNumbers.length : 1;
      freedSeats += seatCount;
      cancelledCount++;
      cancelledRefs.push(b.bookingRef ?? b.id);

      /* Free seats in seats table */
      if (Array.isArray(b.seatNumbers) && b.seatNumbers.length > 0) {
        for (const seatNum of b.seatNumbers as string[]) {
          await db.update(seatsTable)
            .set({ status: "available", bookingId: null } as any)
            .where(and(eq(seatsTable.tripId, tripId), eq(seatsTable.seatNumber, seatNum)))
            .catch(() => {});
        }
      }

      /* Notify absent passengers */
      const userRows = await db.select({ pushToken: usersTable.pushToken })
        .from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
      sendExpoPush(
        userRows[0]?.pushToken,
        "GoBooking — Réservation annulée",
        `Votre réservation ${b.bookingRef} a été annulée (départ clôturé sans présentation).`
      ).catch(() => {});
    }

    auditLog(
      { userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.BOOKING_CANCEL, tripId, "trip",
      { cancelledCount, freedSeats, cancelledRefs, tripFrom: trip.from, tripTo: trip.to }
    ).catch(() => {});

    res.json({
      success: true,
      cancelledCount,
      freedSeats,
      cancelledRefs,
      message: `${cancelledCount} réservation(s) annulée(s), ${freedSeats} siège(s) libéré(s)`,
    });
  } catch (err) {
    console.error("close-departure error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── Passengers for a given trip (route agent) ─────────── */
router.get("/trip/:tripId/passengers", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;

    // Fetch confirmed bookings for this trip
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.tripId, tripId));

    // Also fetch accepted boarding requests (for boarding-point info)
    const bRequests = await db.select().from(boardingRequestsTable)
      .where(
        and(
          eq(boardingRequestsTable.tripId, tripId),
          inArray(boardingRequestsTable.status, ["accepted", "embarqué"])
        )
      );

    // Build passenger list from bookings
    const result: { name: string; seatNumber: string; status: string; phone?: string; boardingPoint?: string }[] = [];

    for (const b of bookings) {
      if (!["confirmed", "boarded", "validated"].includes(b.status ?? "")) continue;
      const passengers = Array.isArray(b.passengers) ? b.passengers : [];
      const seats = Array.isArray(b.seatNumbers) ? b.seatNumbers : [];
      passengers.forEach((p: any, i: number) => {
        result.push({
          name: p.name ?? "Passager",
          seatNumber: seats[i] ?? "?",
          status: b.status === "boarded" ? "boarded" : "confirmed",
        });
      });
    }

    // Merge boarding request passengers (add phone + boardingPoint)
    for (const r of bRequests) {
      result.push({
        name: r.clientName,
        seatNumber: "—",
        status: "boarded",
        phone: r.clientPhone ?? undefined,
        boardingPoint: r.boardingPoint ?? undefined,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
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

    /* ── Clear live GPS — trip is over ── */
    locationStore.delete(req.params.tripId);

    res.json({ success: true, status: "arrived", arrivedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GPS position push (agent → server) ───────────────── */
router.post("/trip/:tripId/location", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { lat, lon, accuracy, speed, heading } = req.body as {
      lat: number; lon: number;
      accuracy?: number; speed?: number; heading?: number;
    };

    if (typeof lat !== "number" || typeof lon !== "number") {
      res.status(400).json({ error: "lat et lon requis" }); return;
    }

    /* ── Security: only allow GPS push when trip is actually en_route ── */
    /* Demo trips (id starts with "t-" or "live-") bypass the DB check   */
    const isDemoTrip = /^(t-|live-)/.test(req.params.tripId);
    if (!isDemoTrip) {
      const trips = await db.select().from(tripsTable)
        .where(eq(tripsTable.id, req.params.tripId)).limit(1);
      if (!trips.length) {
        res.status(404).json({ error: "Trajet introuvable" }); return;
      }
      if (trips[0].status !== "en_route") {
        /* Trip ended or not started — clear stale position and refuse */
        locationStore.delete(req.params.tripId);
        res.status(403).json({ error: "GPS non autorisé : trajet non actif", code: "TRIP_NOT_ACTIVE" }); return;
      }
    }

    pruneStale();

    /* ── 1. Update in-memory store for real-time reads ── */
    locationStore.set(req.params.tripId, {
      tripId:    req.params.tripId,
      lat, lon,
      accuracy:  accuracy ?? undefined,
      speed:     speed    ?? undefined,
      heading:   heading  ?? undefined,
      updatedAt: Date.now(),
      agentId:   user.id,
    });

    /* ── 2. Persist GPS trail to positions table (fire-and-forget) ── */
    db.insert(positionsTable).values({
      tripId:   req.params.tripId,
      agentId:  user.id,
      lat,
      lon,
      speed:    typeof speed    === "number" ? speed    : null,
      accuracy: typeof accuracy === "number" ? accuracy : null,
      heading:  typeof heading  === "number" ? heading  : null,
    }).catch(err => console.error("positions insert error:", err));

    /* ── 3. Upsert latest position to bus_positions (one row per trip) ── */
    db.insert(busPositionsTable).values({
      tripId:    req.params.tripId,
      latitude:  lat,
      longitude: lon,
      speed:     typeof speed   === "number" ? speed   : null,
      heading:   typeof heading === "number" ? heading : null,
    })
    .onConflictDoUpdate({
      target: busPositionsTable.tripId,
      set: {
        latitude:  lat,
        longitude: lon,
        speed:     typeof speed   === "number" ? speed   : null,
        heading:   typeof heading === "number" ? heading : null,
        updatedAt: sql`now()`,
      },
    })
    .catch(err => console.error("bus_positions upsert error:", err));

    /* ── 4. Proximity notifications — "Bus proche" ───────────────────────
       After persisting the position, check if any pending boarding_requests
       for this trip have a pickup location (pickup_lat / pickup_lon) within
       NEARBY_KM km. If so, send a push notification once (notified_nearby).
    ──────────────────────────────────────────────────────────────────────── */
    const NEARBY_KM = 5;
    const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
              + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
              * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    /* Run proximity check asynchronously — don't block the response */
    const tripIdForProx = req.params.tripId;
    (async () => {
      try {
        /* Get pending boarding_requests with a pickup location, not yet notified */
        const nearby = await db.execute(
          sql`SELECT br.id, br.user_id, br.client_name, br.boarding_point,
                     br.pickup_lat, br.pickup_lon, u.push_token
              FROM boarding_requests br
              LEFT JOIN users u ON u.id = br.user_id
              WHERE br.trip_id = ${tripIdForProx}
                AND br.status IN ('pending', 'accepted')
                AND br.notified_nearby IS NOT TRUE
                AND br.pickup_lat IS NOT NULL
                AND br.pickup_lon IS NOT NULL`
        );
        const rows = (nearby as any).rows ?? nearby ?? [];
        for (const row of (Array.isArray(rows) ? rows : [])) {
          const pLat = Number(row.pickup_lat);
          const pLon = Number(row.pickup_lon);
          if (isNaN(pLat) || isNaN(pLon)) continue;
          const dist = haversineKm(lat, lon, pLat, pLon);
          if (dist <= NEARBY_KM) {
            /* Mark as notified first (prevents duplicate sends on rapid GPS) */
            await db.execute(
              sql`UPDATE boarding_requests SET notified_nearby = true WHERE id = ${row.id}`
            );
            /* Send push notification if user has a push token */
            if (row.push_token) {
              sendExpoPush(
                row.push_token,
                "GoBooking 🚌 Bus proche !",
                `Votre bus arrive dans environ ${Math.round(dist * 10) / 10} km de votre position. Préparez-vous !`
              ).catch(() => {});
            }
          }
        }
      } catch {
        /* Proximity check is best-effort — never block the GPS response */
      }
    })();

    res.json({ success: true, updatedAt: Date.now() });
  } catch (err) {
    console.error("GPS push error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GPS position read for agent ─────────────────────── */
router.get("/trip/:tripId/location", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const loc = locationStore.get(req.params.tripId);
    res.json(loc ?? null);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GPS trail — last N positions from DB for a trip ───── */
/* Used by the map to draw a breadcrumb trail behind the bus  */
router.get("/trip/:tripId/trail", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit ?? "20"), 10)));
    /* Last 30 minutes of positions */
    const since = new Date(Date.now() - 30 * 60 * 1000);

    const rows = await db
      .select({
        lat:        positionsTable.lat,
        lon:        positionsTable.lon,
        speed:      positionsTable.speed,
        recordedAt: positionsTable.recordedAt,
      })
      .from(positionsTable)
      .where(and(
        eq(positionsTable.tripId, req.params.tripId),
        gte(positionsTable.recordedAt, since),
      ))
      .orderBy(desc(positionsTable.recordedAt))
      .limit(limit);

    res.json(rows.reverse()); /* chronological order */
  } catch (err) {
    console.error("Trail fetch error:", err);
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

    /* ── Anti double-scan ── */
    if (booking.status === "boarded") {
      auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_DOUBLE_SCAN, booking.id, "booking", {
        bookingRef: booking.bookingRef, status: booking.status,
      }, true).catch(() => {});
      res.status(409).json({
        error: "Billet déjà utilisé — embarquement déjà enregistré",
        code:  "DOUBLE_SCAN",
        bookingRef: booking.bookingRef,
      });
      return;
    }

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_SCAN, booking.id, "booking", {
      bookingRef: booking.bookingRef, currentStatus: booking.status,
    }).catch(() => {});

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

/* ───────────────────────────────────────────────────────────────────────────
   TRIP REQUEST ROUTES  (agent reads / responds to client requests)
─────────────────────────────────────────────────────────────────────────── */

/* GET /agent/requests?tripId=live-1  — pending + recent requests for trip */
router.get("/requests", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    pruneOldRequests();
    const tripId = (req.query.tripId as string) || "live-1";

    /* 1. Get from in-memory store (fast path) */
    const memRequests = requestsForTrip(tripId);

    if (memRequests.length > 0) {
      res.json(memRequests);
      return;
    }

    /* 2. Fallback: read from boarding_requests DB (e.g. after server restart) */
    try {
      const dbRows = await db
        .select()
        .from(boardingRequestsTable)
        .where(eq(boardingRequestsTable.tripId, tripId))
        .orderBy(desc(boardingRequestsTable.createdAt))
        .limit(50);

      /* Rehydrate in-memory store from DB (pending only) */
      for (const row of dbRows) {
        if (!requestStore.has(row.id)) {
          requestStore.set(row.id, {
            id:             row.id,
            tripId:         row.tripId,
            clientName:     row.clientName,
            clientPhone:    row.clientPhone,
            seatsRequested: parseInt(row.seatsRequested ?? "1", 10),
            boardingPoint:  row.boardingPoint,
            status:         row.status as "pending" | "accepted" | "rejected",
            createdAt:      row.createdAt?.getTime() ?? Date.now(),
            respondedAt:    row.respondedAt?.getTime() ?? undefined,
          });
        }
      }

      const result = dbRows.map(row => ({
        id:             row.id,
        tripId:         row.tripId,
        clientName:     row.clientName,
        clientPhone:    row.clientPhone,
        seatsRequested: parseInt(row.seatsRequested ?? "1", 10),
        boardingPoint:  row.boardingPoint,
        status:         row.status,
        createdAt:      row.createdAt?.getTime() ?? Date.now(),
        respondedAt:    row.respondedAt?.getTime() ?? null,
      }));

      res.json(result);
    } catch (dbErr) {
      res.json([]); /* return empty if DB also fails */
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/requests/:id/accept */
router.post("/requests/:id/accept", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const req_ = requestStore.get(req.params.id);
    if (!req_) { res.status(404).json({ error: "Demande introuvable" }); return; }
    if (req_.status !== "pending") { res.status(409).json({ error: "Demande déjà traitée" }); return; }

    /* ── Deduct seats from DB in real time ── */
    const n = req_.seatsRequested ?? 1;
    const isDemoTrip = req_.tripId.startsWith("t-") || req_.tripId.startsWith("live-");
    let seatsBooked = 0;

    if (!isDemoTrip) {
      const availableSeats = await db
        .select({ id: seatsTable.id })
        .from(seatsTable)
        .where(and(eq(seatsTable.tripId, req_.tripId), eq(seatsTable.status, "available")))
        .limit(n);

      if (availableSeats.length < n) {
        res.status(409).json({ error: "Plus assez de sièges disponibles", code: "NOT_ENOUGH_SEATS" });
        return;
      }

      /* Mark those seats as booked */
      if (availableSeats.length > 0) {
        await db
          .update(seatsTable)
          .set({ status: "booked" })
          .where(inArray(seatsTable.id, availableSeats.map(s => s.id)));
        seatsBooked = availableSeats.length;
      }
    } else {
      seatsBooked = n; /* demo trips: count as booked without DB update */
    }

    req_.status      = "accepted";
    req_.respondedAt = Date.now();
    requestStore.set(req_.id, req_);

    /* Sync to boarding_requests DB table (fire-and-forget) */
    db.update(boardingRequestsTable)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(boardingRequestsTable.id, req_.id))
      .catch(err => console.error("boarding_requests accept sync error:", err));

    res.json({ success: true, request: req_, seatsBooked });
  } catch (err) {
    console.error("Accept request error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/requests/:id/board  — agent scans QR, marks passenger as boarded */
router.post("/requests/:id/board", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    /* Update in-memory store if present */
    const req_ = requestStore.get(req.params.id);
    if (req_) {
      (req_ as any).status = "embarqué";
      (req_ as any).boardedAt = Date.now();
      requestStore.set(req_.id, req_);
    }

    /* Sync to DB */
    await db.update(boardingRequestsTable)
      .set({ status: "embarqué", respondedAt: new Date() })
      .where(eq(boardingRequestsTable.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* GET /agent/requests/confirmed?tripId=XXX  — accepted passengers for current trip */
router.get("/requests/confirmed", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = (req.query.tripId as string) || "";
    if (!tripId) { res.json([]); return; }

    const rows = await db
      .select()
      .from(boardingRequestsTable)
      .where(
        and(
          eq(boardingRequestsTable.tripId, tripId),
          inArray(boardingRequestsTable.status, ["accepted", "embarqué"])
        )
      )
      .orderBy(desc(boardingRequestsTable.createdAt))
      .limit(50);

    res.json(rows.map(r => ({
      id:             r.id,
      tripId:         r.tripId,
      clientName:     r.clientName,
      clientPhone:    r.clientPhone,
      boardingPoint:  r.boardingPoint,
      seatsRequested: parseInt(r.seatsRequested ?? "1", 10),
      status:         r.status,
      createdAt:      r.createdAt?.getTime() ?? Date.now(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/requests/:id/reject */
router.post("/requests/:id/reject", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const req_ = requestStore.get(req.params.id);
    if (!req_) { res.status(404).json({ error: "Demande introuvable" }); return; }
    if (req_.status !== "pending") { res.status(409).json({ error: "Demande déjà traitée" }); return; }

    req_.status      = "rejected";
    req_.respondedAt = Date.now();
    requestStore.set(req_.id, req_);

    /* Sync to boarding_requests DB table (fire-and-forget) */
    db.update(boardingRequestsTable)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(boardingRequestsTable.id, req_.id))
      .catch(err => console.error("boarding_requests reject sync error:", err));

    res.json({ success: true, request: req_ });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ───────────────────────────────────────────────────────────────────────────
   SUB-ROLE AGENT ENDPOINTS (embarquement, vente, validation, reception_colis)
─────────────────────────────────────────────────────────────────────────── */

/* GET /agent/reservation/:ref  — lookup booking by ref or id */
router.get("/reservation/:ref", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const ref = req.params.ref.trim().toUpperCase();
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.bookingRef, ref))
      .limit(1);

    if (!bookings.length) {
      res.status(404).json({ error: "Réservation introuvable", code: "NOT_FOUND" });
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

    const firstPassenger = Array.isArray(booking.passengers) ? booking.passengers[0] : null;
    res.json({
      id: booking.id,
      bookingRef: booking.bookingRef,
      reservationId: booking.id,
      name: (firstPassenger as any)?.name ?? "—",
      passengerName: (firstPassenger as any)?.name ?? "—",
      phone: (firstPassenger as any)?.phone ?? booking.contactPhone ?? "—",
      passengerPhone: (firstPassenger as any)?.phone ?? booking.contactPhone ?? "—",
      seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—",
      status: booking.status,
      price: booking.totalAmount ?? 0,
      departureCity: trip?.from ?? "—",
      arrivalCity: trip?.to ?? "—",
      departureTime: trip?.departureTime ?? "—",
      tripId: booking.tripId,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/reservation/:id/board  — mark passenger as boarded */
router.post("/reservation/:id/board", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(bookingsTable)
      .set({ status: "validated" })
      .where(eq(bookingsTable.id, req.params.id));

    /* ── Notify passenger ── */
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    if (bookings.length) {
      const userRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, bookings[0].userId)).limit(1);
      sendExpoPush(userRows[0]?.pushToken, "GoBooking 🚌", "Votre embarquement a été validé ! Bon voyage.").catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/reservation/:id/confirm  — confirm a reservation */
router.post("/reservation/:id/confirm", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(bookingsTable)
      .set({ status: "confirmed" })
      .where(eq(bookingsTable.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ───────────────────────────────────────────────────────────────────────────
   POST /agent/scan
   Unified QR scan → validate → board in one request.
   Accepts the raw signed QR JSON string generated by generateQRData() on the
   client. Validates signature, checks booking status, marks as boarded, and
   sends a push notification — all in one round-trip.
─────────────────────────────────────────────────────────────────────────── */
router.post("/scan", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { qrData, selectedTripId } = req.body as { qrData?: string | Record<string, unknown>; selectedTripId?: string };
    if (!qrData) { res.status(400).json({ error: "qrData requis", code: "MISSING_DATA" }); return; }

    /* ── 1. Parse + validate QR signature ── */
    const QR_SECRET = "GBK-CI-2026-SECURE-v1";
    const TTL_MS    = 72 * 60 * 60 * 1000;

    function djb2(str: string): string {
      let h = 5381;
      for (let i = 0; i < str.length; i++) { h = (h * 33) ^ str.charCodeAt(i); h = h >>> 0; }
      return h.toString(36).padStart(7, "0");
    }

    let ref: string;
    let qrType: string = "passager"; /* default — backward compat */

    const raw = typeof qrData === "object" ? JSON.stringify(qrData) : String(qrData).trim();

    if (raw.startsWith("{")) {
      let payload: { ref?: string; type?: string; ts?: number; sig?: string; trajetId?: string };
      try { payload = typeof qrData === "object" ? (qrData as typeof payload) : JSON.parse(raw); }
      catch { res.status(400).json({ error: "QR invalide — format incorrect", code: "INVALID_FORMAT" }); return; }

      const { ref: r, type, ts, sig, trajetId } = payload;
      if (!r || !type || !ts || !sig) {
        res.status(400).json({ error: "QR invalide — champs manquants", code: "INVALID_FORMAT" }); return;
      }
      /* Verify signature — support both new format (with trajetId) and old format */
      const sigNew = djb2(`${r}|${type}|${ts}|${trajetId ?? ""}|${QR_SECRET}`);
      const sigOld = djb2(`${r}|${type}|${ts}|${QR_SECRET}`);
      if (sig !== sigNew && sig !== sigOld) {
        res.status(400).json({ error: "QR invalide — billet potentiellement falsifié", code: "INVALID_SIGNATURE" }); return;
      }
      if (Date.now() - ts > TTL_MS) {
        res.status(400).json({ error: "QR expiré — billet trop ancien (> 72h)", code: "EXPIRED" }); return;
      }
      ref     = r;
      qrType  = type;
    } else if (/^(GBB|GBX|GBK|OFFLINE-)/i.test(raw) || /^[A-Z0-9]{6,20}$/i.test(raw)) {
      ref = raw.toUpperCase();
    } else {
      res.status(400).json({ error: "QR non reconnu — format invalide", code: "INVALID_FORMAT" }); return;
    }

    /* ── Helper: record scan to scansTable ── */
    const recordScan = async (type: string, targetId: string, scanRef: string, tripId?: string | null) => {
      try {
        const agentRows = await db.select({ companyId: agentsTable.companyId, name: agentsTable.name })
          .from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
        await db.insert(scansTable).values({
          id:        `SCN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type, ref: scanRef, targetId,
          trajetId:  selectedTripId ?? tripId ?? null,
          agentId:   user.id,
          agentName: agentRows[0]?.name ?? user.name ?? "Agent",
          companyId: agentRows[0]?.companyId ?? null,
          status:    "validé",
        });
      } catch {}
    };

    /* ══════════════════════════════════════════════════════════════
       ROUTE A: "colis" — scan colis, mark as chargé_bus
    ══════════════════════════════════════════════════════════════ */
    if (qrType === "colis") {
      const parcels = await db.select().from(parcelsTable)
        .where(eq(parcelsTable.trackingRef, ref.toUpperCase())).limit(1);
      if (!parcels.length) {
        res.status(404).json({ error: "Colis introuvable — référence inconnue", code: "NOT_FOUND", scanType: "colis" }); return;
      }
      const parcel = parcels[0];

      /* Trip mismatch */
      if (selectedTripId && parcel.tripId && parcel.tripId !== selectedTripId) {
        res.status(422).json({ error: "Ce colis est enregistré pour un autre trajet.", code: "WRONG_TRIP", scanType: "colis", ref: parcel.trackingRef }); return;
      }

      /* Anti double-scan */
      if (["chargé_bus", "en_transit", "arrivé", "livré"].includes(parcel.status ?? "")) {
        res.status(409).json({
          error:  "Ce colis a déjà été chargé ou est déjà en transit.",
          code:   "DOUBLE_SCAN", scanType: "colis", ref: parcel.trackingRef,
          parcel: { sender: parcel.senderName, receiver: parcel.receiverName, from: parcel.fromCity, to: parcel.toCity },
        }); return;
      }

      await db.update(parcelsTable).set({ status: "chargé_bus" }).where(eq(parcelsTable.id, parcel.id));
      await recordScan("colis", parcel.id, parcel.trackingRef, parcel.tripId);

      const senderRows = await db.select({ pushToken: usersTable.pushToken })
        .from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
      sendExpoPush(senderRows[0]?.pushToken, "GoBooking 📦", `Votre colis (${parcel.trackingRef}) a été chargé dans le bus.`).catch(() => {});

      res.json({
        success: true, scanType: "colis", ref: parcel.trackingRef,
        parcel: {
          trackingRef: parcel.trackingRef,
          sender:      parcel.senderName,
          receiver:    parcel.receiverName,
          from:        parcel.fromCity,
          to:          parcel.toCity,
          weight:      parcel.weight,
          newStatus:   "chargé_bus",
        },
      });
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       ROUTES B + C: "passager" / "billet" / "bagage" — need booking
    ══════════════════════════════════════════════════════════════ */
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.bookingRef, ref.toUpperCase())).limit(1);

    if (!bookings.length) {
      res.status(404).json({ error: "Billet introuvable — référence inconnue", code: "NOT_FOUND" }); return;
    }
    const booking = bookings[0];

    /* ── Trip mismatch guard ── */
    if (selectedTripId && booking.tripId && booking.tripId !== selectedTripId) {
      auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_SCAN, booking.id, "booking", {
        bookingRef: booking.bookingRef, reason: "WRONG_TRIP", bookingTripId: booking.tripId, selectedTripId,
      }, true).catch(() => {});
      const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
      const bTrip = trips[0];
      res.status(422).json({
        error: `Ce billet est pour le trajet ${bTrip?.from ?? "?"} → ${bTrip?.to ?? "?"} (départ ${bTrip?.departureTime ?? "?"}), pas pour le trajet sélectionné.`,
        code: "WRONG_TRIP", bookingRef: booking.bookingRef,
        bookingTrip: bTrip ? { from: bTrip.from, to: bTrip.to, departureTime: bTrip.departureTime, busName: bTrip.busName } : null,
      }); return;
    }

    /* ══════════════════════════════════════════════════════════════
       ROUTE B: "bagage" — confirm physical bagage loaded on bus
    ══════════════════════════════════════════════════════════════ */
    if (qrType === "bagage") {
      if (!(booking as any).bagages?.length) {
        res.status(422).json({ error: "Aucun bagage enregistré pour cette réservation.", code: "NO_BAGAGES", scanType: "bagage", bookingRef: booking.bookingRef }); return;
      }
      if ((booking as any).bagageStatus === "refusé") {
        const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
        res.status(422).json({
          error: "Bagages refusés par la compagnie — scan bloqué.", code: "BAGAGE_REFUS", scanType: "bagage",
          bookingRef: booking.bookingRef, passenger: { name: fp?.name ?? "—" }, bagageNote: (booking as any).bagageNote || null,
        }); return;
      }

      /* Anti double-scan: check if already scanned today */
      const existingScan = await db.select({ id: scansTable.id }).from(scansTable)
        .where(and(eq(scansTable.ref, booking.bookingRef), eq(scansTable.type, "bagage")))
        .orderBy(desc(scansTable.createdAt)).limit(1);
      if (existingScan.length) {
        const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
        res.status(409).json({
          error: "Bagages déjà validés — scan déjà effectué.", code: "DOUBLE_SCAN", scanType: "bagage",
          bookingRef: booking.bookingRef, passenger: { name: fp?.name ?? "—" },
        }); return;
      }

      await recordScan("bagage", booking.id, booking.bookingRef, booking.tripId);
      const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
      res.json({
        success: true, scanType: "bagage", bookingRef: booking.bookingRef,
        passenger:    { name: fp?.name ?? "—", seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—" },
        bagages:      (booking as any).bagages ?? [],
        bagageStatus: (booking as any).bagageStatus,
      });
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       ROUTE C: "passager" / "billet" — standard boarding
    ══════════════════════════════════════════════════════════════ */

    /* Anti double-scan */
    if (booking.status === "boarded" || booking.status === "validated") {
      auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_DOUBLE_SCAN, booking.id, "booking", {
        bookingRef: booking.bookingRef, status: booking.status,
      }, true).catch(() => {});
      const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
      res.status(409).json({
        error: "Billet déjà utilisé — passager déjà embarqué", code: "DOUBLE_SCAN",
        bookingRef: booking.bookingRef,
        passenger:  { name: fp?.name ?? "—", seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—" },
      }); return;
    }

    if (booking.status === "cancelled") {
      res.status(422).json({ error: "Réservation annulée — embarquement refusé", code: "CANCELLED" }); return;
    }

    if (booking.paymentStatus !== "paid") {
      res.status(402).json({
        error: "Paiement requis — ce billet n'a pas encore été payé", code: "NOT_PAID",
        bookingRef: booking.bookingRef,
        passenger:  { name: (Array.isArray(booking.passengers) ? (booking.passengers as any[])[0]?.name : null) ?? "—" },
      }); return;
    }

    if ((booking as any).bagageStatus === "refusé") {
      const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
      res.status(422).json({
        error: "Embarquement refusé — les bagages de ce passager ont été refusés par la compagnie.",
        code:  "BAGAGE_REFUS", bookingRef: booking.bookingRef,
        passenger:  { name: fp?.name ?? "—", seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—" },
        bagageNote: (booking as any).bagageNote || null,
      }); return;
    }

    /* Fetch trip info */
    let trip = null;
    if (booking.tripId) {
      const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
      trip = trips[0] ?? null;
    }

    /* Mark as boarded */
    await db.update(bookingsTable).set({ status: "boarded" }).where(eq(bookingsTable.id, booking.id));
    await recordScan("passager", booking.id, booking.bookingRef, booking.tripId);
    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_SCAN, booking.id, "booking", {
      bookingRef: booking.bookingRef, newStatus: "boarded",
    }).catch(() => {});

    /* Award loyalty points */
    const loyaltyResult = await awardPoints(
      booking.userId, POINTS_PER_TRIP,
      `Embarquement validé — billet ${booking.bookingRef}`,
      booking.id
    ).catch(() => null);

    /* Push notification */
    const userRows = await db.select({ pushToken: usersTable.pushToken, name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, booking.userId)).limit(1);
    sendExpoPush(userRows[0]?.pushToken, "GoBooking 🚌", "Votre embarquement a été validé ! Bon voyage.").catch(() => {});
    if (loyaltyResult) {
      sendExpoPush(
        userRows[0]?.pushToken,
        "🎁 Bonus fidélité",
        `+${POINTS_PER_TRIP} points gagnés ! Total : ${loyaltyResult.newBalance} pts`
      ).catch(() => {});
    }

    const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
    res.json({
      success:    true,
      scanType:   "passager",
      bookingRef: booking.bookingRef,
      passenger: {
        name:          fp?.name ?? userRows[0]?.name ?? "Passager",
        seat:          (booking.seatNumbers as string[] ?? [])[0] ?? "—",
        seats:         booking.seatNumbers ?? [],
        count:         (booking.seatNumbers as string[] ?? []).length,
        from:          trip?.from ?? "—",
        to:            trip?.to   ?? "—",
        departureTime: trip?.departureTime ?? "—",
        date:          trip?.date ?? "—",
        busName:       trip?.busName ?? "—",
        totalAmount:   booking.totalAmount,
        paymentMethod: booking.paymentMethod,
      },
    });
  } catch (err) {
    console.error("Scan error:", err);
    res.status(500).json({ error: "Erreur serveur lors du scan", code: "SERVER_ERROR" });
  }
});

/* POST /agent/parcels/:id/arrive  — confirm parcel arrival at departure station */
router.post("/parcels/:parcelId/arrive", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(parcelsTable)
      .set({ status: "arrive_gare_depart" })
      .where(eq(parcelsTable.id, req.params.parcelId));

    /* ── Notify sender ── */
    const parcels = await db.select().from(parcelsTable).where(eq(parcelsTable.id, req.params.parcelId)).limit(1);
    if (parcels.length) {
      const userRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, parcels[0].userId)).limit(1);
      sendExpoPush(userRows[0]?.pushToken, "GoBooking 📦", `Votre colis est arrivé à la gare de destination.`).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/alert — Envoi alerte sécurité (panne/urgence/contrôle/sos) */
router.post("/alert", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { type, tripId, busId, lat, lon, message } = req.body as {
      type: string; tripId?: string; busId?: string;
      lat?: number; lon?: number; message?: string;
    };

    const VALID_TYPES = ["urgence", "panne", "controle", "sos"];
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: "Type invalide. Valeurs acceptées: urgence, panne, controle, sos" }); return;
    }

    /* Récupère les infos de l'agent (companyId, busName) */
    const agentRows = await db.select({
      companyId: agentsTable.companyId,
      busId:     agentsTable.busId,
    }).from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRow = agentRows[0];

    /* Récupère le nom du bus si dispo */
    const resolvedBusId = busId ?? agentRow?.busId;
    let busName: string | undefined;
    if (resolvedBusId) {
      const buses = await db.select({ name: busesTable.name }).from(busesTable).where(eq(busesTable.id, resolvedBusId)).limit(1);
      busName = buses[0]?.name;
    }

    const alertId = Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

    await db.insert(agentAlertsTable).values({
      id:        alertId,
      type,
      agentId:   user.id,
      agentName: user.name,
      companyId: agentRow?.companyId ?? null,
      tripId:    tripId ?? null,
      busId:     resolvedBusId ?? null,
      busName:   busName ?? null,
      lat:       typeof lat === "number" ? lat : null,
      lon:       typeof lon === "number" ? lon : null,
      message:   message ?? null,
      status:    "active",
    });

    /* Notifie les admins de la compagnie */
    if (agentRow?.companyId) {
      const agentAdmins = await db.select({
        userId: agentsTable.userId,
        companyId: agentsTable.companyId,
      }).from(agentsTable).where(and(
        eq(agentsTable.companyId, agentRow.companyId),
      ));
      const adminUserIds = [...new Set(agentAdmins.map(a => a.userId))];
      if (adminUserIds.length > 0) {
        const admins = await db.select({ id: usersTable.id, pushToken: usersTable.pushToken })
          .from(usersTable)
          .where(and(inArray(usersTable.id, adminUserIds), inArray(usersTable.role, ["compagnie", "company_admin"])));

        const TITLES: Record<string, string> = {
          urgence:  "🚨 URGENCE — Intervention requise",
          panne:    "⚠️  PANNE bus signalée",
          controle: "🔵 Contrôle de routine",
          sos:      "🆘 SOS — DANGER IMMÉDIAT",
        };
        const title   = TITLES[type] ?? "Alerte agent";
        const msgBody = `Agent: ${user.name} · ${busName ?? "Bus"} · ${type.toUpperCase()}`;

        for (const admin of admins) {
          if (admin.pushToken) {
            await sendExpoPush(admin.pushToken, title, msgBody);
          }
          await db.insert((await import("@workspace/db")).notificationsTable).values({
            id:       Math.random().toString(36).slice(2, 11) + Date.now().toString(36),
            userId:   admin.id,
            type:     "agent_alert",
            title,
            message:  msgBody,
            refId:    alertId,
            refType:  "agent_alert",
          });
        }
      }
    }

    console.log(`[Alert] 🚨 ${type.toUpperCase()} — agent: ${user.name}`);
    res.json({ success: true, alertId });
  } catch (err) {
    console.error("Alert error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/alerts — Historique des alertes de l'agent ── */
router.get("/alerts", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const alerts = await db.select().from(agentAlertsTable)
      .where(eq(agentAlertsTable.agentId, user.id))
      .orderBy(desc(agentAlertsTable.createdAt))
      .limit(50);

    res.json(alerts.map(a => ({
      id: a.id, type: a.type, status: a.status,
      tripId: a.tripId, busName: a.busName,
      lat: a.lat, lon: a.lon, message: a.message,
      createdAt: a.createdAt?.toISOString() ?? null,
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* GET /agent/earnings — scan stats + estimated commissions */
router.get("/earnings", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agent = agents[0];

    const now = new Date();
    const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const allScans = await db.select().from(scansTable)
      .where(and(eq(scansTable.agentId, user.id), gte(scansTable.createdAt, startOfMonth)))
      .orderBy(desc(scansTable.createdAt));

    const todayScans = allScans.filter(s => new Date(s.createdAt) >= startOfDay);
    const weekScans  = allScans.filter(s => new Date(s.createdAt) >= startOfWeek);

    const COMMISSION_PER_BOARDING = 200;
    const todayEarnings = todayScans.length * COMMISSION_PER_BOARDING;
    const weekEarnings  = weekScans.length  * COMMISSION_PER_BOARDING;
    const monthEarnings = allScans.length   * COMMISSION_PER_BOARDING;

    const byDay: Record<string, number> = {};
    for (const s of allScans) {
      const day = new Date(s.createdAt).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + COMMISSION_PER_BOARDING;
    }
    const dailyChart = Object.entries(byDay).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);

    res.json({
      agentName: user.name,
      agentRole: agent?.agentRole ?? "agent",
      today:     { scans: todayScans.length, earnings: todayEarnings },
      week:      { scans: weekScans.length,  earnings: weekEarnings  },
      month:     { scans: allScans.length,   earnings: monthEarnings },
      recentScans: allScans.slice(0, 20).map(s => ({
        id: s.id, type: s.type, ref: s.ref, status: s.status,
        commission: COMMISSION_PER_BOARDING, createdAt: s.createdAt,
      })),
      dailyChart,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/validate-qr ───────────────────────────────────────────────
   Simplified QR scan validation endpoint called by the mobile scan screen.
   Accepts { qrCode } — either a signed JSON payload or a plain bookingRef.
   Returns { valid, passenger, route, departure_time, message }.
   Records scan in scansTable and updates booking status to "validated".
─────────────────────────────────────────────────────────────────────────── */
router.post("/validate-qr", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { qrCode } = req.body as { qrCode?: string };
    if (!qrCode) { res.status(400).json({ error: "qrCode requis" }); return; }

    /* ── 1. Parse QR payload ── */
    const QR_SECRET = "GBK-CI-2026-SECURE-v1";
    const TTL_MS    = 72 * 60 * 60 * 1000;

    function djb2(str: string): string {
      let h = 5381;
      for (let i = 0; i < str.length; i++) { h = (h * 33) ^ str.charCodeAt(i); h = h >>> 0; }
      return h.toString(36).padStart(7, "0");
    }

    const raw = String(qrCode).trim();
    let ref: string;

    if (raw.startsWith("{")) {
      let payload: { ref?: string; type?: string; ts?: number; sig?: string; trajetId?: string };
      try { payload = JSON.parse(raw); } catch { res.status(400).json({ valid: false, message: "QR invalide — format incorrect" }); return; }

      const { ref: r, type, ts, sig, trajetId } = payload;
      if (!r || !type || !ts || !sig) { res.status(400).json({ valid: false, message: "QR invalide — données manquantes" }); return; }

      const sigNew = djb2(`${r}|${type}|${ts}|${trajetId ?? ""}|${QR_SECRET}`);
      const sigOld = djb2(`${r}|${type}|${ts}|${QR_SECRET}`);
      if (sig !== sigNew && sig !== sigOld) { res.status(400).json({ valid: false, message: "QR invalide — billet potentiellement falsifié" }); return; }
      if (Date.now() - ts > TTL_MS) { res.status(400).json({ valid: false, message: "QR expiré — billet trop ancien (> 72h)" }); return; }
      ref = r;
    } else {
      ref = raw.toUpperCase();
    }

    /* ── 2. Find booking by bookingRef ── */
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.bookingRef, ref)).limit(1);
    if (!bookings.length) { res.status(404).json({ valid: false, message: "Billet introuvable — référence inconnue" }); return; }

    const booking = bookings[0];

    /* ── 3. Check already used ── */
    if (booking.status === "boarded" || booking.status === "validated" as any) {
      res.status(200).json({ valid: false, message: "Billet déjà utilisé — passager déjà embarqué" });
      return;
    }

    if (booking.status === "cancelled") {
      res.status(200).json({ valid: false, message: "Billet annulé — réservation invalide" });
      return;
    }

    if (booking.paymentStatus !== "paid") {
      res.status(200).json({ valid: false, message: "Paiement non confirmé — billet non valide" });
      return;
    }

    /* ── 4. Fetch trip info ── */
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
    const trip  = trips[0];

    /* ── 5. Mark booking as validated ── */
    await db.update(bookingsTable).set({ status: "validated" as any }).where(eq(bookingsTable.id, booking.id));

    /* ── 6. Record scan ── */
    try {
      const agentRows = await db.select({ companyId: agentsTable.companyId, name: agentsTable.name })
        .from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
      await db.insert(scansTable).values({
        id:        `SCN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type:      "passager",
        ref,
        targetId:  booking.id,
        trajetId:  booking.tripId,
        agentId:   user.id,
        agentName: agentRows[0]?.name ?? user.name ?? "Agent",
        companyId: agentRows[0]?.companyId ?? null,
        status:    "validé",
      });
    } catch {}

    /* ── 7. Return success ── */
    const passengerNames = (booking.passengers as any[])?.map((p: any) => p.name).join(", ") || "Passager";
    res.json({
      valid:          true,
      type:           "passager",
      passenger:      passengerNames,
      route:          trip ? `${trip.from} → ${trip.to}` : "",
      departure_time: trip ? `${trip.date} ${trip.departureTime}` : "",
      seats:          (booking.seatNumbers as string[])?.join(", ") || "",
      message:        "Embarquement validé",
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: "Erreur serveur lors de la validation" });
  }
});

export default router;
