import { Router, type IRouter } from "express";
import { db, tripsTable, seatsTable, positionsTable, agentsTable, usersTable, busesTable, busPositionsTable, boardingRequestsTable, companiesTable, stopsTable } from "@workspace/db";
import { eq, and, ilike, inArray, desc, sql } from "drizzle-orm";
import { locationStore, pruneStale } from "../locationStore";
import { requestStore, newRequestId } from "../requestStore";
import { tokenStore } from "./auth";
import { PRICE_GRID, ALL_CITIES, getTicketPrice } from "../lib/priceGrid";

/* Convert mapX%/mapY% back to approximate real-world lat/lon for demo buses.
   Bounding box: lat 4.3–10.7N, lon 8.4W–3.2W */
function mapXYtoLatLon(mapX: number, mapY: number) {
  const lat = 10.7 - (mapY / 100) * 6.4;
  const lon = -8.4 + (mapX / 100) * 5.2;
  return { lat, lon };
}

const router: IRouter = Router();

/* ── Simple in-memory cache for /live (30s TTL) ─────────────────── */
interface LiveCache {
  data: unknown[];
  expiresAt: number;
}
const liveCache = new Map<string, LiveCache>();

function getLiveCache(key: string): unknown[] | null {
  const entry = liveCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data;
}

function setLiveCache(key: string, data: unknown[], ttlMs = 30_000) {
  liveCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/* ── GET /trips/price-grid — grille tarifaire publique ────────────────────────
   ?from=Abidjan&to=Bouaké  →  { price: 3500 }
   (sans paramètres)         →  { grid: PRICE_GRID, cities: ALL_CITIES }
──────────────────────────────────────────────────────────────────────────── */
router.get("/price-grid", (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (from && to) {
    const price = getTicketPrice(from, to);
    res.json({ from, to, price });
    return;
  }
  res.json({ grid: PRICE_GRID, cities: ALL_CITIES });
});

router.get("/search", async (req, res) => {
  try {
    const { from, to, date, companyId } = req.query as {
      from: string; to: string; date: string; companyId?: string;
    };

    const conditions: ReturnType<typeof and>[] = [
      ilike(tripsTable.from, `%${from}%`),
      ilike(tripsTable.to, `%${to}%`),
      eq(tripsTable.date, date),
    ];
    if (companyId) conditions.push(eq(tripsTable.companyId, companyId));

    /* Join with companies to get real company names */
    const trips = await db
      .select({
        id:            tripsTable.id,
        from:          tripsTable.from,
        to:            tripsTable.to,
        departureTime: tripsTable.departureTime,
        arrivalTime:   tripsTable.arrivalTime,
        date:          tripsTable.date,
        price:         tripsTable.price,
        busType:       tripsTable.busType,
        busName:       tripsTable.busName,
        totalSeats:    tripsTable.totalSeats,
        duration:      tripsTable.duration,
        amenities:     tripsTable.amenities,
        companyId:     tripsTable.companyId,
        status:        tripsTable.status,
        companyName:   companiesTable.name,
        companyCity:   companiesTable.city,
        companyPhone:  companiesTable.phone,
      })
      .from(tripsTable)
      .leftJoin(companiesTable, eq(tripsTable.companyId, companiesTable.id))
      .where(and(...conditions));

    const tripsWithSeats = await Promise.all(
      trips.map(async (trip) => {
        const seats = await db
          .select()
          .from(seatsTable)
          .where(and(eq(seatsTable.tripId, trip.id), eq(seatsTable.status, "available")));
        return { ...trip, availableSeats: seats.length };
      })
    );

    res.json(tripsWithSeats.map((t) => ({
      id:            t.id,
      from:          t.from,
      to:            t.to,
      departureTime: t.departureTime,
      arrivalTime:   t.arrivalTime,
      date:          t.date,
      price:         t.price,
      busType:       t.busType,
      busName:       t.busName,
      totalSeats:    t.totalSeats,
      availableSeats: t.availableSeats,
      duration:      t.duration,
      amenities:     t.amenities,
      companyId:     t.companyId ?? null,
      companyName:   t.companyName ?? t.busName,
      companyCity:   t.companyCity ?? null,
      companyPhone:  t.companyPhone ?? null,
    })));
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

/* ── Réservation temporaire de sièges (hold) ──────────────────────────────
   POST /trips/:tripId/seats/hold
   Body: { seatIds: string[] }
   - Vérifie que chaque siège est disponible (status !== "booked")
   - Marque les sièges comme "selected" pour bloquer les autres utilisateurs
   - Retourne 409 si un siège est déjà "booked"
─────────────────────────────────────────────────────────────────────────── */
router.post("/:tripId/seats/hold", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token || !tokenStore.has(token)) {
      res.status(401).json({ error: "Authentification requise pour réserver des sièges" });
      return;
    }

    const { tripId } = req.params;
    const { seatIds } = req.body as { seatIds: string[] };

    if (!seatIds?.length) {
      res.status(400).json({ error: "seatIds requis" });
      return;
    }

    const seats = await db
      .select()
      .from(seatsTable)
      .where(and(eq(seatsTable.tripId, tripId), inArray(seatsTable.id, seatIds)));

    if (seats.length !== seatIds.length) {
      res.status(404).json({ error: "Un ou plusieurs sièges introuvables" });
      return;
    }

    const alreadyBooked = seats.filter((s) => s.status === "booked");
    if (alreadyBooked.length > 0) {
      res.status(409).json({
        error: `Siège(s) déjà réservé(s) : ${alreadyBooked.map((s) => s.number).join(", ")}`,
        bookedSeats: alreadyBooked.map((s) => s.id),
      });
      return;
    }

    for (const seatId of seatIds) {
      await db
        .update(seatsTable)
        .set({ status: "selected" })
        .where(and(eq(seatsTable.id, seatId), eq(seatsTable.status, "available")));
    }

    const updated = await db
      .select()
      .from(seatsTable)
      .where(and(eq(seatsTable.tripId, tripId), inArray(seatsTable.id, seatIds)));

    res.json(updated.map((s) => ({ id: s.id, number: s.number, status: s.status })));
  } catch (err) {
    console.error("Hold seats error:", err);
    res.status(500).json({ error: "Erreur lors du blocage des sièges" });
  }
});

/* ── Cars en route (live positions) — MUST be before /:tripId ─────────── */
router.get("/live", async (req, res) => {
  try {
    /* Authenticated users see real GPS positions; unauthenticated see no GPS */
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isAuthenticated = token ? tokenStore.has(token) : false;
    const cacheKey = `live-${isAuthenticated ? "auth" : "anon"}`;

    pruneStale();

    /* ── Cache hit ─────────────────────────────────────────────────── */
    const cached = getLiveCache(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    /* ── Fetch active trips from DB (status = "en_route") ──────────── */
    const dbTrips = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.status, "en_route")
        )
      );

    if (dbTrips.length > 0) {
      /* ── Fetch latest bus_positions for all active trips in one query ── */
      const tripIds = dbTrips.map(t => t.id);
      const busPosList = await db
        .select()
        .from(busPositionsTable)
        .where(inArray(busPositionsTable.tripId, tripIds));
      const busPosMap = new Map(busPosList.map(p => [p.tripId, p]));

      /* ── Fetch agent + user info via agents table ── */
      const agentIdList = dbTrips.map(t => t.agentId).filter(Boolean) as string[];
      const agentRows = agentIdList.length > 0
        ? await db
            .select({
              agentId:    agentsTable.id,
              agentName:  usersTable.name,
              agentPhone: usersTable.phone,
              companyId:  agentsTable.companyId,
            })
            .from(agentsTable)
            .leftJoin(usersTable, eq(agentsTable.userId, usersTable.id))
            .where(inArray(agentsTable.id, agentIdList))
        : [];
      const agentById = new Map(agentRows.map(a => [a.agentId, a]));

      /* Fallback: also support bus-based agent lookup for older trips */
      const busIds = dbTrips.map(t => (t as any).busId).filter(Boolean) as string[];
      const agentByBusRows = busIds.length > 0
        ? await db
            .select({
              busId:      agentsTable.busId,
              agentId:    agentsTable.id,
              agentName:  usersTable.name,
              agentPhone: usersTable.phone,
              companyId:  agentsTable.companyId,
            })
            .from(agentsTable)
            .leftJoin(usersTable, eq(agentsTable.userId, usersTable.id))
            .where(inArray(agentsTable.busId, busIds))
        : [];
      const agentByBus = new Map(agentByBusRows.map(a => [a.busId, a]));

      const result = await Promise.all(
        dbTrips.map(async (trip) => {
          /* Available seats = count of seats with status "available" */
          const availSeats = await db
            .select()
            .from(seatsTable)
            .where(and(eq(seatsTable.tripId, trip.id), eq(seatsTable.status, "available")));

          /* GPS priority:
             1) in-memory store (< 60s)  — real-time broadcasting agent
             2) bus_positions table       — most recent persisted position
             3) positions trail table     — fallback to most recent trail entry
             4) Map center default        */
          const memGps     = isAuthenticated ? locationStore.get(trip.id) : undefined;
          const busPos     = busPosMap.get(trip.id);
          const freshSecs  = memGps ? (Date.now() - memGps.updatedAt) / 1000 : Infinity;
          const useMemGps  = !!memGps && freshSecs < 60;
          const useBusPos  = !useMemGps && !!busPos;

          const defaultCoords = mapXYtoLatLon(50, 50);
          const lat  = useMemGps ? memGps!.lat       : useBusPos ? busPos!.latitude  : defaultCoords.lat;
          const lon  = useMemGps ? memGps!.lon       : useBusPos ? busPos!.longitude : defaultCoords.lon;
          const speed = useMemGps ? (memGps!.speed ?? null) : useBusPos ? (busPos!.speed ?? null) : null;
          const lastUpdate = useMemGps
            ? memGps!.updatedAt
            : useBusPos ? busPos!.updatedAt?.getTime() ?? null : null;
          const mapX = Math.max(2, Math.min(98, ((lon - (-8.4)) / 5.2) * 100));
          const mapY = Math.max(2, Math.min(98, ((10.7 - lat) / 6.4) * 100));

          /* Agent lookup: try by agentId first, then by busId */
          const agentByIdResult = trip.agentId ? agentById.get(trip.agentId) : null;
          const agentByBusResult = (trip as any).busId ? agentByBus.get((trip as any).busId) : null;
          const agent      = agentByIdResult ?? agentByBusResult;
          const agentName  = agent?.agentName  ?? "Agent GoBooking";
          const agentPhone = agent?.agentPhone ?? "+225 07 00 00 00";

          return {
            id:               trip.id,
            companyName:      "GoBooking",
            busName:          trip.busName,
            busType:          trip.busType,
            fromCity:         trip.from,
            toCity:           trip.to,
            currentCity:      trip.from,
            lat, lon, mapX, mapY,
            availableSeats:   availSeats.length,
            totalSeats:       trip.totalSeats,
            departureTime:    trip.departureTime,
            estimatedArrival: trip.arrivalTime ?? "—",
            agentPhone,
            agentName,
            price:            trip.price,
            color:            "#1A56DB",
            boardingPoints:   [trip.from],
            gpsLive:          useMemGps || useBusPos,
            lastGpsUpdate:    lastUpdate,
            speed,
          };
        })
      );
      setLiveCache(cacheKey, result, 15_000);
      res.json(result);
      return;
    }

    /* Demo data — realistic buses en route in Côte d'Ivoire */
    const now = new Date();
    const hhmm = (h: number, m: number) => `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
    /* Build demo entries — compute real lat/lon from mapX/mapY */
    const demoRaw = [
      { id:"live-1", companyName:"SOTRAL",   busName:"SOTRAL Express 04", busType:"Standard", fromCity:"Abidjan",  toCity:"Bouaké",      currentCity:"Yamoussoukro", mapX:72, mapY:70, availableSeats:12, totalSeats:59, departureTime:hhmm(now.getHours()-3,15), estimatedArrival:hhmm(now.getHours()+2,30), agentPhone:"+22507123456", agentName:"Kouassi Rémi",    price:2500, color:"#1A56DB", boardingPoints:["Abidjan (Gare Adjamé)","Divo","Yamoussoukro","Bouaké"],                          speed:87 },
      { id:"live-2", companyName:"UTB",      busName:"UTB Comfort 12",    busType:"Standard", fromCity:"Abidjan",  toCity:"Yamoussoukro",currentCity:"Agboville",     mapX:78, mapY:76, availableSeats:5,  totalSeats:49, departureTime:hhmm(now.getHours()-1,45), estimatedArrival:hhmm(now.getHours()+1, 0), agentPhone:"+22505987654", agentName:"Diomandé Salif", price:2000, color:"#059669", boardingPoints:["Abidjan (Gare Bassam)","Agboville","Tiébissou","Yamoussoukro"],          speed:72 },
      { id:"live-3", companyName:"TSR",      busName:"TSR Rapide 07",     busType:"Standard", fromCity:"Bouaké",   toCity:"Korhogo",     currentCity:"Katiola",      mapX:59, mapY:33, availableSeats:18, totalSeats:63, departureTime:hhmm(now.getHours()-2, 0), estimatedArrival:hhmm(now.getHours()+3,45), agentPhone:"+22501567890", agentName:"Traoré Moussa",  price:3000, color:"#7C3AED", boardingPoints:["Bouaké (Gare Nord)","Katiola","Niakaramandougou","Korhogo"],          speed:95 },
      { id:"live-4", companyName:"SOTRA CI", busName:"SOTRA 501",         busType:"Standard", fromCity:"Abidjan",  toCity:"San-Pédro",   currentCity:"Lakota",       mapX:48, mapY:83, availableSeats:23, totalSeats:59, departureTime:hhmm(now.getHours()-4, 0), estimatedArrival:hhmm(now.getHours()+1,20), agentPhone:"+22507456789", agentName:"Aka Jean-Marie", price:3500, color:"#D97706", boardingPoints:["Abidjan (Gare Yopougon)","Gagnoa","Lakota","Soubré","San-Pédro"],       speed:68 },
      { id:"live-5", companyName:"CTM",      busName:"CTM Man 03",        busType:"Standard", fromCity:"Man",      toCity:"Abidjan",     currentCity:"Daloa",        mapX:38, mapY:60, availableSeats:8,  totalSeats:49, departureTime:hhmm(now.getHours()-5,30), estimatedArrival:hhmm(now.getHours()+4, 0), agentPhone:"+22505234567", agentName:"Bamba Sékou",    price:5000, color:"#DC2626", boardingPoints:["Man (Gare centrale)","Danané","Daloa","Divo","Abidjan (Adjamé)"],        speed:80 },
    ];

    const demo = demoRaw.map(d => {
      /* Real GPS only exposed to authenticated users */
      const gps = isAuthenticated ? locationStore.get(d.id) : undefined;
      const coords = gps ? { lat: gps.lat, lon: gps.lon } : mapXYtoLatLon(d.mapX, d.mapY);
      const mapX   = gps ? Math.max(2, Math.min(98, ((coords.lon - (-8.4)) / 5.2) * 100)) : d.mapX;
      const mapY   = gps ? Math.max(2, Math.min(98, ((10.7 - coords.lat) / 6.4) * 100))   : d.mapY;
      return {
        ...d,
        lat:          coords.lat,
        lon:          coords.lon,
        mapX,
        mapY,
        gpsLive:      !!gps,
        lastGpsUpdate: gps?.updatedAt ?? null,
        speed:        gps?.speed ?? d.speed,
      };
    });
    setLiveCache(cacheKey, demo, 30_000);
    res.json(demo);
  } catch (err) {
    console.error("Live trips error:", err);
    res.status(500).json({ error: "Erreur récupération cars en route" });
  }
});

/* ─── Single trip detail ─────────────────────────────────────────────────── */
router.get("/:tripId", async (req, res) => {
  try {
    const { tripId } = req.params;
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);

    if (!trips.length) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    const trip = trips[0];
    const seats = await db
      .select()
      .from(seatsTable)
      .where(and(eq(seatsTable.tripId, tripId), eq(seatsTable.status, "available")));

    res.json({
      id:             trip.id,
      from:           trip.from,
      to:             trip.to,
      departureTime:  trip.departureTime,
      arrivalTime:    trip.arrivalTime,
      date:           trip.date,
      price:          trip.price,
      busType:        trip.busType,
      busName:        trip.busName,
      totalSeats:     trip.totalSeats,
      availableSeats: seats.length,
      duration:       trip.duration,
      amenities:      trip.amenities,
      stops:          trip.stops,
      policies:       trip.policies,
    });
  } catch (err) {
    console.error("Get trip error:", err);
    res.status(500).json({ error: "Failed to get trip" });
  }
});

/* ─── Trip seats ─────────────────────────────────────────────────────────── */
router.get("/:tripId/seats", async (req, res) => {
  try {
    const { tripId } = req.params;
    let seats = await db.select().from(seatsTable).where(eq(seatsTable.tripId, tripId));

    /* Si aucun siège n'existe pour ce trajet, les générer automatiquement */
    if (seats.length === 0) {
      const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
      if (trips.length) {
        const trip = trips[0];
        const totalSeats = trip.totalSeats || 44;
        const colLabels = ["A", "B", "C", "D"];
        const numRows = Math.ceil(totalSeats / 4);
        const seatRows: any[] = [];
        for (let row = 1; row <= numRows; row++) {
          for (let col = 1; col <= 4; col++) {
            if ((row - 1) * 4 + col > totalSeats) break;
            seatRows.push({
              id:     `${tripId}-r${row}c${col}`,
              tripId,
              number: `${row}${colLabels[col - 1]}`,
              row,
              column: col,
              type:   col === 1 || col === 4 ? "window" : "aisle",
              status: "available",
              price:  trip.price || 0,
            });
          }
        }
        if (seatRows.length > 0) {
          await db.insert(seatsTable).values(seatRows).onConflictDoNothing();
          seats = await db.select().from(seatsTable).where(eq(seatsTable.tripId, tripId));
        }
      }
    }

    res.json(seats.map((s) => ({
      id:     s.id,
      number: s.number,
      row:    s.row,
      column: s.column,
      type:   s.type,
      status: s.status,
      price:  s.price,
    })));
  } catch (err) {
    console.error("Get seats error:", err);
    res.status(500).json({ error: "Failed to get seats" });
  }
});

/* ─── Client polls their boarding request status ─────────────────────────── */
router.get("/:tripId/request/:requestId", async (req, res) => {
  /* 1. Check in-memory store first (fastest) */
  const entry = requestStore.get(req.params.requestId);
  if (entry && entry.tripId === req.params.tripId) {
    res.json({
      id:          entry.id,
      status:      entry.status,
      createdAt:   entry.createdAt,
      respondedAt: entry.respondedAt ?? null,
    });
    return;
  }
  /* 2. Fallback: check boarding_requests table in DB */
  try {
    const rows = await db
      .select()
      .from(boardingRequestsTable)
      .where(
        and(
          eq(boardingRequestsTable.id,     req.params.requestId),
          eq(boardingRequestsTable.tripId, req.params.tripId)
        )
      )
      .limit(1);
    if (!rows.length) { res.status(404).json({ error: "Demande introuvable" }); return; }
    const r = rows[0];
    res.json({
      id:          r.id,
      status:      r.status,
      createdAt:   r.createdAt?.getTime() ?? Date.now(),
      respondedAt: r.respondedAt?.getTime() ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── Client sends a boarding request for a live bus ─────────────────────── */
router.post("/:tripId/request", async (req, res) => {
  try {
    const {
      clientName, clientPhone, seatsRequested = 1, boardingPoint,
      userId,
      /* Pickup location fields */
      pickupType, pickupLat, pickupLon, pickupLabel, pickupCity,
    } = req.body ?? {};

    if (!clientName || typeof clientName !== "string" || clientName.trim().length < 2) {
      res.status(400).json({ error: "Nom requis (min. 2 caractères)" }); return;
    }
    if (!clientPhone || typeof clientPhone !== "string" || clientPhone.trim().length < 8) {
      res.status(400).json({ error: "Numéro de téléphone invalide" }); return;
    }
    if (!boardingPoint || typeof boardingPoint !== "string") {
      res.status(400).json({ error: "Point de montée requis" }); return;
    }
    const seats = Math.max(1, Math.min(9, parseInt(seatsRequested, 10) || 1));

    const id = newRequestId();
    const entry = {
      id,
      tripId:         req.params.tripId,
      clientName:     clientName.trim(),
      clientPhone:    clientPhone.trim(),
      seatsRequested: seats,
      boardingPoint:  boardingPoint.trim(),
      status:         "pending" as const,
      createdAt:      Date.now(),
      /* Pickup location — optional */
      pickupType:    (pickupType === "gps" || pickupType === "landmark") ? pickupType : undefined,
      pickupLat:     typeof pickupLat  === "number" ? pickupLat  : undefined,
      pickupLon:     typeof pickupLon  === "number" ? pickupLon  : undefined,
      pickupLabel:   typeof pickupLabel === "string" ? pickupLabel.trim()  : undefined,
      pickupCity:    typeof pickupCity  === "string" ? pickupCity.trim()   : undefined,
    };

    /* 1. Store in memory (for fast agent reads) */
    requestStore.set(id, entry);

    /* 2. Persist to boarding_requests table (fire-and-forget) */
    db.insert(boardingRequestsTable).values({
      id,
      tripId:         req.params.tripId,
      userId:         typeof userId === "string" ? userId : null,
      clientName:     clientName.trim(),
      clientPhone:    clientPhone.trim(),
      boardingPoint:  boardingPoint.trim(),
      seatsRequested: String(seats),
      status:         "pending",
    }).then(() => {
      /* Store GPS pickup location (extra columns added via SQL migration) */
      if (typeof pickupLat === "number" && typeof pickupLon === "number") {
        return db.execute(
          sql`UPDATE boarding_requests SET pickup_lat = ${pickupLat}, pickup_lon = ${pickupLon} WHERE id = ${id}`
        );
      }
    }).catch(err => console.error("boarding_requests insert error:", err));

    res.status(201).json({ success: true, requestId: id });
  } catch (err) {
    console.error("Trip request error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/** GET /trips/:id/stops – public: get ordered stops for a trip (for client stop selection) */
router.get("/:id/stops", async (req, res) => {
  try {
    const [trip] = await db.select({ id: tripsTable.id, routeId: tripsTable.routeId })
      .from(tripsTable).where(eq(tripsTable.id, req.params.id)).limit(1);
    if (!trip) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    if (!trip.routeId) { res.json([]); return; }

    const stops = await db.select().from(stopsTable)
      .where(eq(stopsTable.routeId, trip.routeId))
      .orderBy(stopsTable.order);
    res.json(stops);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
