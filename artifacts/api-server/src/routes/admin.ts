import { Router, type IRouter } from "express";
import { db, bookingsTable, tripsTable, seatsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();

async function requireAdmin(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length || users[0].role !== "admin") return null;
  if (users[0].status === "inactive") return null;
  return users[0];
}

router.get("/stats", async (req, res) => {
  try {
    const admin = await requireAdmin(req.headers.authorization);
    if (!admin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const allBookings = await db.select().from(bookingsTable);
    const allUsers = await db.select().from(usersTable);
    const allTrips = await db.select().from(tripsTable);

    const today = new Date().toISOString().split("T")[0];
    const todayBookings = allBookings.filter((b) =>
      b.createdAt?.toISOString().startsWith(today)
    );

    const totalRevenue = allBookings
      .filter((b) => b.status !== "cancelled")
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const todayRevenue = todayBookings
      .filter((b) => b.status !== "cancelled")
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const activeTrips = allTrips.length;

    const recentBookings = await Promise.all(
      allBookings
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 10)
        .map(async (booking) => {
          const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
          const trip = trips[0];
          return {
            id: booking.id,
            bookingRef: booking.bookingRef,
            trip: trip ? {
              from: trip.from,
              to: trip.to,
              date: trip.date,
            } : { from: "N/A", to: "N/A", date: "N/A" },
            totalAmount: booking.totalAmount,
            status: booking.status,
            createdAt: booking.createdAt?.toISOString() || new Date().toISOString(),
          };
        })
    );

    res.json({
      totalBookings: allBookings.length,
      totalRevenue,
      totalUsers: allUsers.length,
      totalTrips: allTrips.length,
      activeTrips,
      todayBookings: todayBookings.length,
      todayRevenue,
      recentBookings,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const admin = await requireAdmin(req.headers.authorization);
    if (!admin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const allBookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));

    const enriched = await Promise.all(
      allBookings.map(async (booking) => {
        const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
        const trip = trips[0];
        return {
          id: booking.id,
          bookingRef: booking.bookingRef,
          trip: trip ? {
            from: trip.from,
            to: trip.to,
            date: trip.date,
          } : { from: "N/A", to: "N/A", date: "N/A" },
          totalAmount: booking.totalAmount,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          passengers: booking.passengers,
          createdAt: booking.createdAt?.toISOString() || new Date().toISOString(),
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("Admin bookings error:", err);
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

router.get("/trips", async (req, res) => {
  try {
    const admin = await requireAdmin(req.headers.authorization);
    if (!admin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const trips = await db.select().from(tripsTable);
    const enriched = await Promise.all(
      trips.map(async (trip) => {
        const allSeats = await db.select().from(seatsTable).where(eq(seatsTable.tripId, trip.id));
        const availableSeats = allSeats.filter((s) => s.status === "available").length;
        return {
          ...trip,
          from: trip.from,
          to: trip.to,
          availableSeats,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("Admin trips error:", err);
    res.status(500).json({ error: "Failed to get trips" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const admin = await requireAdmin(req.headers.authorization);
    if (!admin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const users = await db.select().from(usersTable);
    res.json(users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt?.toISOString() || new Date().toISOString(),
    })));
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ error: "Failed to get users" });
  }
});

export default router;
