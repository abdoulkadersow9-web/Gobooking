import { Router, type IRouter } from "express";
import { db, usersTable, companiesTable, busesTable, agentsTable, tripsTable, bookingsTable, parcelsTable, seatsTable, walletTransactionsTable, boardingRequestsTable, invoicesTable } from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
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

    const rows = await db
      .select({
        id:        agentsTable.id,
        userId:    agentsTable.userId,
        companyId: agentsTable.companyId,
        busId:     agentsTable.busId,
        tripId:    agentsTable.tripId,
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
      .orderBy(desc(agentsTable.createdAt));

    res.json(rows);
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

    const { name, email, password, phone, agentRole, agentCode, busId } = req.body as {
      name: string; email: string; password: string; phone?: string;
      agentRole: string; agentCode?: string; busId?: string;
    };

    const VALID_AGENT_ROLES = ["embarquement", "reception_colis", "vente", "validation", "route"];

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
    if (user.role !== "compagnie") {
      res.status(403).json({ error: "Accès refusé — seules les compagnies peuvent créer des trajets" });
      return;
    }
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
      status:        "en_attente",
    }).returning();

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

/* GET /company/analytics — Tableau analytique détaillé */
router.get("/analytics", async (req, res) => {
  try {
    const user = await requireCompanyAdmin(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const [bookings, parcels] = await Promise.all([
      db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt)),
      db.select().from(parcelsTable).orderBy(desc(parcelsTable.createdAt)),
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

    // ── Parcel status breakdown ───────────────────────────────────────
    const parcelByStatus: Record<string, number> = {};
    for (const p of parcels) {
      parcelByStatus[p.status] = (parcelByStatus[p.status] || 0) + 1;
    }

    // ── KPIs ──────────────────────────────────────────────────────────
    const totalRevenue = bookings.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.totalAmount, 0)
      + parcels.reduce((s, p) => s + p.amount, 0);
    const parcelRevenue = parcels.reduce((s, p) => s + p.amount, 0);
    const bookingRevenue = bookings.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.totalAmount, 0);

    res.json({
      kpis: {
        totalBookings: bookings.length,
        totalRevenue,
        bookingRevenue,
        parcelRevenue,
        totalParcels: parcels.length,
      },
      byStatus,
      byMethod,
      dailyBookings,
      parcelByStatus,
    });
  } catch (err) {
    console.error("Company analytics error:", err);
    res.status(500).json({ error: "Failed" });
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

export default router;
