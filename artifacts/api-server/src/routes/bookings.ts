import { Router, type IRouter } from "express";
import { db, bookingsTable, tripsTable, seatsTable, usersTable, commissionSettingsTable } from "@workspace/db";
import { eq, desc, inArray, ne, and } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);
const generateRef = () => "GB" + Math.random().toString(36).toUpperCase().substr(2, 8);

function getUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  return tokenStore.get(token) || null;
}

async function getFullBooking(bookingId: string) {
  const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!bookings.length) return null;
  const booking = bookings[0];

  const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
  const trip = trips[0];

  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    userId: booking.userId,
    tripId: booking.tripId,
    trip: trip ? {
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
      availableSeats: 0,
      duration: trip.duration,
      amenities: trip.amenities,
    } : null,
    seatIds: booking.seatIds,
    seatNumbers: booking.seatNumbers,
    passengers: booking.passengers,
    totalAmount: booking.totalAmount,
    paymentMethod: booking.paymentMethod,
    paymentStatus: booking.paymentStatus,
    status: booking.status,
    contactEmail: booking.contactEmail,
    contactPhone: booking.contactPhone,
    createdAt: booking.createdAt?.toISOString() || new Date().toISOString(),
  };
}

/* ── Créer une réservation (statut: pending) ───────────────────────────────
   POST /bookings
   - Vérifie en transaction que chaque siège n'est PAS "booked"
   - Marque les sièges "booked" atomiquement (évite la double réservation)
   - Crée la réservation avec status:"pending" + paymentStatus:"pending"
   - Le client doit ensuite appeler POST /bookings/:id/confirm pour payer
─────────────────────────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { tripId, seatIds, passengers, paymentMethod, contactEmail, contactPhone } = req.body;

    if (!tripId || !seatIds?.length || !passengers?.length || !paymentMethod || !contactEmail || !contactPhone) {
      res.status(400).json({ error: "Champs requis manquants" });
      return;
    }

    /* ── Vérification atomique anti double-réservation ─────────────────────
       Pour chaque siège, on tente une mise à jour WHERE status != 'booked'.
       Si le nb de lignes mises à jour < nb de sièges demandés, un siège
       a été pris en simultané par un autre utilisateur → 409.
    ─────────────────────────────────────────────────────────────────────── */
    const seatsData = await db
      .select()
      .from(seatsTable)
      .where(and(eq(seatsTable.tripId, tripId), inArray(seatsTable.id, seatIds)));

    if (seatsData.length !== seatIds.length) {
      res.status(404).json({ error: "Un ou plusieurs sièges introuvables" });
      return;
    }

    const alreadyBooked = seatsData.filter((s) => s.status === "booked");
    if (alreadyBooked.length > 0) {
      res.status(409).json({
        error: `Double réservation impossible — siège(s) déjà pris : ${alreadyBooked.map((s) => s.number).join(", ")}`,
      });
      return;
    }

    // Marquer chaque siège comme "booked" de façon atomique (WHERE != booked)
    const bookedSeats: string[] = [];
    for (const seatId of seatIds) {
      const updated = await db
        .update(seatsTable)
        .set({ status: "booked" })
        .where(and(eq(seatsTable.id, seatId), ne(seatsTable.status, "booked")))
        .returning({ id: seatsTable.id });
      if (updated.length > 0) bookedSeats.push(seatId);
    }

    if (bookedSeats.length !== seatIds.length) {
      // Race condition : libérer les sièges déjà bloqués
      for (const seatId of bookedSeats) {
        await db.update(seatsTable).set({ status: "available" }).where(eq(seatsTable.id, seatId));
      }
      res.status(409).json({ error: "Un ou plusieurs sièges viennent d'être réservés simultanément. Veuillez recommencer." });
      return;
    }

    const totalAmount = seatsData.reduce((sum, s) => sum + s.price, 0);
    const seatNumbers = seatsData.map((s) => s.number);

    // ── Commission calculation ─────────────────────────────────────
    const commSettings = await db.select().from(commissionSettingsTable).where(eq(commissionSettingsTable.id, "default")).limit(1);
    let commissionAmount = 0;
    let commissionRate   = 0;
    if (commSettings.length) {
      const cfg = commSettings[0];
      if (cfg.type === "percentage") {
        commissionAmount = Math.round((totalAmount * cfg.value) / 100);
        commissionRate   = cfg.value;
      } else {
        commissionAmount = cfg.value;
        commissionRate   = totalAmount > 0 ? (cfg.value / totalAmount) * 100 : 0;
      }
    }

    const newBookingId = generateId();
    const newBookingRef = generateRef();

    await db
      .insert(bookingsTable)
      .values({
        id: newBookingId,
        bookingRef: newBookingRef,
        userId,
        tripId,
        seatIds,
        seatNumbers,
        passengers,
        totalAmount,
        commissionAmount,
        commissionRate,
        paymentMethod,
        paymentStatus: "pending",
        status: "pending",
        contactEmail,
        contactPhone,
      });

    const bookingResult = await getFullBooking(newBookingId);
    res.json(bookingResult);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Réservation échouée";
    const isConflict = msg.includes("Double réservation");
    res.status(isConflict ? 409 : 500).json({ error: msg });
  }
});

/* ── Confirmer le paiement d'une réservation ──────────────────────────────
   POST /bookings/:bookingId/confirm
   Body: { paymentMethod?: string }
   - Réservation doit être "pending" et appartenir à l'utilisateur connecté
   - Passe status → "confirmed", paymentStatus → "paid"
─────────────────────────────────────────────────────────────────────────── */
router.post("/:bookingId/confirm", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { bookingId } = req.params;
    const { paymentMethod } = req.body as { paymentMethod?: string };

    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!bookings.length) {
      res.status(404).json({ error: "Réservation introuvable" });
      return;
    }

    const booking = bookings[0];
    if (booking.userId !== userId) {
      res.status(403).json({ error: "Non autorisé" });
      return;
    }
    if (booking.status === "confirmed") {
      const full = await getFullBooking(bookingId);
      res.json(full);
      return;
    }
    if (booking.status !== "pending") {
      res.status(400).json({ error: `Impossible de confirmer une réservation "${booking.status}"` });
      return;
    }

    await db
      .update(bookingsTable)
      .set({
        status: "confirmed",
        paymentStatus: "paid",
        ...(paymentMethod ? { paymentMethod } : {}),
      })
      .where(eq(bookingsTable.id, bookingId));

    const full = await getFullBooking(bookingId);
    res.json(full);
  } catch (err) {
    console.error("Confirm booking error:", err);
    res.status(500).json({ error: "Échec de la confirmation" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.userId, userId))
      .orderBy(desc(bookingsTable.createdAt));

    const fullBookings = await Promise.all(bookings.map((b) => getFullBooking(b.id)));
    res.json(fullBookings.filter(Boolean));
  } catch (err) {
    console.error("Get bookings error:", err);
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

router.get("/:bookingId", async (req, res) => {
  try {
    const full = await getFullBooking(req.params.bookingId);
    if (!full) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
    res.json(full);
  } catch (err) {
    console.error("Get booking error:", err);
    res.status(500).json({ error: "Failed to get booking" });
  }
});

router.post("/:bookingId/cancel", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { bookingId } = req.params;
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!bookings.length) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const booking = bookings[0];
    if (booking.userId !== userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    if (booking.status === "cancelled") {
      res.status(400).json({ error: "Booking already cancelled" });
      return;
    }

    await db.update(bookingsTable)
      .set({ status: "cancelled", paymentStatus: "refunded" })
      .where(eq(bookingsTable.id, bookingId));

    for (const seatId of booking.seatIds) {
      await db.update(seatsTable).set({ status: "available" }).where(eq(seatsTable.id, seatId));
    }

    const full = await getFullBooking(bookingId);
    res.json(full);
  } catch (err) {
    console.error("Cancel booking error:", err);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export { getFullBooking };
export default router;
