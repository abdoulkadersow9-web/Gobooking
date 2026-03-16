import { Router, type IRouter } from "express";
import { db, bookingsTable, tripsTable, seatsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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

router.post("/", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { tripId, seatIds, passengers, paymentMethod, contactEmail, contactPhone } = req.body;

    if (!tripId || !seatIds?.length || !passengers?.length || !paymentMethod || !contactEmail || !contactPhone) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const seats = await db.select().from(seatsTable).where(eq(seatsTable.tripId, tripId));
    const selectedSeats = seats.filter((s) => seatIds.includes(s.id));
    const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);
    const seatNumbers = selectedSeats.map((s) => s.number);

    // Mark seats as booked
    for (const seatId of seatIds) {
      await db.update(seatsTable).set({ status: "booked" }).where(eq(seatsTable.id, seatId));
    }

    const booking = await db.insert(bookingsTable).values({
      id: generateId(),
      bookingRef: generateRef(),
      userId,
      tripId,
      seatIds,
      seatNumbers,
      passengers,
      totalAmount,
      paymentMethod,
      paymentStatus: "paid",
      status: "confirmed",
      contactEmail,
      contactPhone,
    }).returning();

    const full = await getFullBooking(booking[0].id);
    res.json(full);
  } catch (err) {
    console.error("Create booking error:", err);
    res.status(500).json({ error: "Booking failed" });
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
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

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
