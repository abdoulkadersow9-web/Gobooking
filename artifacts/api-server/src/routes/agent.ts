import { Router, type IRouter } from "express";
import { db, usersTable, agentsTable, busesTable, bookingsTable, parcelsTable, seatsTable, tripsTable, positionsTable, busPositionsTable, boardingRequestsTable } from "@workspace/db";
import { auditLog, ACTIONS } from "../audit";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { tokenStore } from "./auth";
import { locationStore, pruneStale } from "../locationStore";
import { requestStore, requestsForTrip, newRequestId, pruneOldRequests, type TripRequest } from "../requestStore";
import { sendExpoPush } from "../pushService";

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

    const bookingId = req.params.bookingId;
    await db.update(bookingsTable).set({ status: "validated" }).where(eq(bookingsTable.id, bookingId));
    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.BOOKING_BOARD, bookingId, "booking").catch(() => {});
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

    /* ── Notify sender ── */
    const parcels = await db.select().from(parcelsTable).where(eq(parcelsTable.id, req.params.parcelId)).limit(1);
    if (parcels.length) {
      const userRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, parcels[0].userId)).limit(1);
      sendExpoPush(userRows[0]?.pushToken, "GoBooking 📦", `Votre colis a été livré à destination.`).catch(() => {});
    }

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

    const { qrData } = req.body as { qrData?: string };
    if (!qrData) {
      res.status(400).json({ error: "qrData requis", code: "MISSING_DATA" });
      return;
    }

    /* ── 1. Validate QR signature (mirrors utils/qr.ts djb2 logic) ── */
    const QR_SECRET = "GBK-CI-2026-SECURE-v1";
    const TTL_MS    = 72 * 60 * 60 * 1000;

    function djb2(str: string): string {
      let h = 5381;
      for (let i = 0; i < str.length; i++) {
        h = (h * 33) ^ str.charCodeAt(i);
        h = h >>> 0;
      }
      return h.toString(36).padStart(7, "0");
    }

    let ref: string;
    const raw = qrData.trim();

    if (raw.startsWith("{")) {
      let payload: { ref?: string; type?: string; ts?: number; sig?: string };
      try { payload = JSON.parse(raw); }
      catch { res.status(400).json({ error: "QR invalide — format incorrect", code: "INVALID_FORMAT" }); return; }

      const { ref: r, type, ts, sig } = payload;
      if (!r || !type || !ts || !sig) {
        res.status(400).json({ error: "QR invalide — champs manquants", code: "INVALID_FORMAT" }); return;
      }
      const expected = djb2(`${r}|${type}|${ts}|${QR_SECRET}`);
      if (sig !== expected) {
        res.status(400).json({ error: "QR invalide — billet potentiellement falsifié", code: "INVALID_SIGNATURE" }); return;
      }
      if (Date.now() - ts > TTL_MS) {
        res.status(400).json({ error: "QR expiré — billet trop ancien (> 72h)", code: "EXPIRED" }); return;
      }
      ref = r;
    } else if (/^(GBB|GBX|GBK|OFFLINE-)/i.test(raw) || /^[A-Z0-9]{6,20}$/i.test(raw)) {
      ref = raw.toUpperCase();
    } else {
      res.status(400).json({ error: "QR non reconnu — format invalide", code: "INVALID_FORMAT" }); return;
    }

    /* ── 2. Look up booking ── */
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.bookingRef, ref.toUpperCase())).limit(1);

    if (!bookings.length) {
      res.status(404).json({ error: "Billet introuvable — référence inconnue", code: "NOT_FOUND" }); return;
    }

    const booking = bookings[0];

    /* ── 3. Anti double-scan ── */
    if (booking.status === "boarded" || booking.status === "validated") {
      auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_DOUBLE_SCAN, booking.id, "booking", {
        bookingRef: booking.bookingRef, status: booking.status,
      }, true).catch(() => {});
      const firstP = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
      res.status(409).json({
        error:      "Billet déjà utilisé — passager déjà embarqué",
        code:       "DOUBLE_SCAN",
        bookingRef: booking.bookingRef,
        passenger:  { name: firstP?.name ?? "—", seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—" },
      });
      return;
    }

    if (booking.status === "cancelled") {
      res.status(422).json({ error: "Réservation annulée — embarquement refusé", code: "CANCELLED" }); return;
    }

    /* ── 4. Fetch trip info ── */
    let trip = null;
    if (booking.tripId) {
      const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
      trip = trips[0] ?? null;
    }

    /* ── 5. Mark as boarded ── */
    await db.update(bookingsTable)
      .set({ status: "boarded" })
      .where(eq(bookingsTable.id, booking.id));

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_SCAN, booking.id, "booking", {
      bookingRef: booking.bookingRef, newStatus: "boarded",
    }).catch(() => {});

    /* ── 6. Push notification to passenger ── */
    const userRows = await db.select({ pushToken: usersTable.pushToken, name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, booking.userId)).limit(1);
    sendExpoPush(
      userRows[0]?.pushToken,
      "GoBooking 🚌",
      "Votre embarquement a été validé ! Bon voyage."
    ).catch(() => {});

    /* ── 7. Build response ── */
    const firstPassenger = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
    res.json({
      success:    true,
      bookingRef: booking.bookingRef,
      passenger: {
        name:  firstPassenger?.name ?? userRows[0]?.name ?? "Passager",
        seat:  (booking.seatNumbers as string[] ?? [])[0] ?? "—",
        seats: booking.seatNumbers ?? [],
        count: (booking.seatNumbers as string[] ?? []).length,
        from:  trip?.from ?? "—",
        to:    trip?.to   ?? "—",
        departureTime: trip?.departureTime ?? "—",
        date:  trip?.date ?? "—",
        busName: trip?.busName ?? "—",
        totalAmount: booking.totalAmount,
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

export default router;
