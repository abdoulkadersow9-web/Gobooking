import { Router, type IRouter } from "express";
import { db, tripsTable, seatsTable } from "@workspace/db";
import { eq, and, ilike, inArray } from "drizzle-orm";
import { locationStore, pruneStale } from "../locationStore";
import { requestStore, newRequestId } from "../requestStore";

/* Convert mapX%/mapY% back to approximate real-world lat/lon for demo buses.
   Bounding box: lat 4.3–10.7N, lon 8.4W–3.2W */
function mapXYtoLatLon(mapX: number, mapY: number) {
  const lat = 10.7 - (mapY / 100) * 6.4;
  const lon = -8.4 + (mapX / 100) * 5.2;
  return { lat, lon };
}

const router: IRouter = Router();

router.get("/search", async (req, res) => {
  try {
    const { from, to, date } = req.query as { from: string; to: string; date: string };

    const trips = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          ilike(tripsTable.from, `%${from}%`),
          ilike(tripsTable.to, `%${to}%`),
          eq(tripsTable.date, date)
        )
      );

    const tripsWithSeats = await Promise.all(
      trips.map(async (trip) => {
        const seats = await db
          .select()
          .from(seatsTable)
          .where(and(eq(seatsTable.tripId, trip.id), eq(seatsTable.status, "available")));
        return {
          ...trip,
          availableSeats: seats.length,
        };
      })
    );

    res.json(tripsWithSeats.map((t) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      departureTime: t.departureTime,
      arrivalTime: t.arrivalTime,
      date: t.date,
      price: t.price,
      busType: t.busType,
      busName: t.busName,
      totalSeats: t.totalSeats,
      availableSeats: t.availableSeats,
      duration: t.duration,
      amenities: t.amenities,
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
      id: trip.id,
      from: trip.from,
      to: trip.to,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      date: trip.date,
      price: trip.price,
      busType: trip.busType,
      busName: trip.busName,
      totalSeats: trip.totalSeats,
      availableSeats: seats.length,
      duration: trip.duration,
      amenities: trip.amenities,
      stops: trip.stops,
      policies: trip.policies,
    });
  } catch (err) {
    console.error("Get trip error:", err);
    res.status(500).json({ error: "Failed to get trip" });
  }
});

router.get("/:tripId/seats", async (req, res) => {
  try {
    const { tripId } = req.params;
    const seats = await db.select().from(seatsTable).where(eq(seatsTable.tripId, tripId));

    res.json(seats.map((s) => ({
      id: s.id,
      number: s.number,
      row: s.row,
      column: s.column,
      type: s.type,
      status: s.status,
      price: s.price,
    })));
  } catch (err) {
    console.error("Get seats error:", err);
    res.status(500).json({ error: "Failed to get seats" });
  }
});

/* ── Cars en route (live positions) ─────────────────────────────────────── */
router.get("/live", async (_req, res) => {
  try {
    pruneStale();

    /* Try DB trips with status "en_route" first */
    const dbTrips = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.status, "en_route"));

    if (dbTrips.length > 0) {
      const result = await Promise.all(
        dbTrips.map(async (trip) => {
          const availSeats = await db
            .select()
            .from(seatsTable)
            .where(and(eq(seatsTable.tripId, trip.id), eq(seatsTable.status, "available")));

          /* Merge real GPS if agent is broadcasting */
          const gps = locationStore.get(trip.id);
          const defaultCoords = mapXYtoLatLon(50, 50);
          const lat = gps?.lat ?? defaultCoords.lat;
          const lon = gps?.lon ?? defaultCoords.lon;
          const mapX = ((lon - (-8.4)) / 5.2) * 100;
          const mapY = ((10.7 - lat) / 6.4) * 100;

          return {
            id:               trip.id,
            companyName:      "GoBooking",
            busName:          trip.busName,
            busType:          trip.busType,
            fromCity:         trip.from,
            toCity:           trip.to,
            currentCity:      trip.from,
            lat,  lon,
            mapX: Math.max(2, Math.min(98, mapX)),
            mapY: Math.max(2, Math.min(98, mapY)),
            availableSeats:   availSeats.length,
            totalSeats:       trip.totalSeats,
            departureTime:    trip.departureTime,
            estimatedArrival: trip.arrivalTime ?? "—",
            agentPhone:       "+225 07 00 00 00 00",
            agentName:        "Agent GoBooking",
            price:            trip.price,
            color:            "#1A56DB",
            boardingPoints:   [trip.from],
            gpsLive:          !!gps,
            lastGpsUpdate:    gps?.updatedAt ?? null,
            speed:            gps?.speed ?? null,
          };
        })
      );
      res.json(result);
      return;
    }

    /* Demo data — realistic buses en route in Côte d'Ivoire */
    const now = new Date();
    const hhmm = (h: number, m: number) => `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
    /* Build demo entries — compute real lat/lon from mapX/mapY */
    const demoRaw = [
      { id:"live-1", companyName:"SOTRAL",   busName:"SOTRAL Express 04", busType:"Premium",  fromCity:"Abidjan",  toCity:"Bouaké",      currentCity:"Yamoussoukro", mapX:72, mapY:70, availableSeats:12, totalSeats:59, departureTime:hhmm(now.getHours()-3,15), estimatedArrival:hhmm(now.getHours()+2,30), agentPhone:"+22507123456", agentName:"Kouassi Rémi",    price:3500, color:"#1A56DB", boardingPoints:["Abidjan (Gare Adjamé)","Divo","Yamoussoukro","Bouaké"],                          speed:87 },
      { id:"live-2", companyName:"UTB",      busName:"UTB Comfort 12",    busType:"Standard", fromCity:"Abidjan",  toCity:"Yamoussoukro",currentCity:"Agboville",     mapX:78, mapY:76, availableSeats:5,  totalSeats:49, departureTime:hhmm(now.getHours()-1,45), estimatedArrival:hhmm(now.getHours()+1, 0), agentPhone:"+22505987654", agentName:"Diomandé Salif", price:2000, color:"#059669", boardingPoints:["Abidjan (Gare Bassam)","Agboville","Tiébissou","Yamoussoukro"],          speed:72 },
      { id:"live-3", companyName:"TSR",      busName:"TSR Rapide 07",     busType:"VIP",      fromCity:"Bouaké",   toCity:"Korhogo",     currentCity:"Katiola",      mapX:59, mapY:33, availableSeats:18, totalSeats:63, departureTime:hhmm(now.getHours()-2, 0), estimatedArrival:hhmm(now.getHours()+3,45), agentPhone:"+22501567890", agentName:"Traoré Moussa",  price:2500, color:"#7C3AED", boardingPoints:["Bouaké (Gare Nord)","Katiola","Niakaramandougou","Korhogo"],          speed:95 },
      { id:"live-4", companyName:"SOTRA CI", busName:"SOTRA 501",         busType:"Standard", fromCity:"Abidjan",  toCity:"San-Pédro",   currentCity:"Lakota",       mapX:48, mapY:83, availableSeats:23, totalSeats:59, departureTime:hhmm(now.getHours()-4, 0), estimatedArrival:hhmm(now.getHours()+1,20), agentPhone:"+22507456789", agentName:"Aka Jean-Marie", price:3000, color:"#D97706", boardingPoints:["Abidjan (Gare Yopougon)","Gagnoa","Lakota","Soubré","San-Pédro"],       speed:68 },
      { id:"live-5", companyName:"CTM",      busName:"CTM Man 03",        busType:"Premium",  fromCity:"Man",      toCity:"Abidjan",     currentCity:"Daloa",        mapX:38, mapY:60, availableSeats:8,  totalSeats:49, departureTime:hhmm(now.getHours()-5,30), estimatedArrival:hhmm(now.getHours()+4, 0), agentPhone:"+22505234567", agentName:"Bamba Sékou",    price:5500, color:"#DC2626", boardingPoints:["Man (Gare centrale)","Danané","Daloa","Divo","Abidjan (Adjamé)"],        speed:80 },
    ];

    const demo = demoRaw.map(d => {
      /* Check for real GPS from locationStore */
      const gps = locationStore.get(d.id);
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
    res.json(demo);
  } catch (err) {
    console.error("Live trips error:", err);
    res.status(500).json({ error: "Erreur récupération cars en route" });
  }
});

/* ─── Client sends a boarding request for a live bus ─────────────────────── */
router.post("/:tripId/request", async (req, res) => {
  try {
    const { clientName, clientPhone, seatsRequested = 1, boardingPoint } = req.body ?? {};

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
    };
    requestStore.set(id, entry);

    res.status(201).json({ success: true, requestId: id });
  } catch (err) {
    console.error("Trip request error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
