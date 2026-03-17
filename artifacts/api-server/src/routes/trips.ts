import { Router, type IRouter } from "express";
import { db, tripsTable, seatsTable } from "@workspace/db";
import { eq, and, ilike, inArray } from "drizzle-orm";

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

export default router;
