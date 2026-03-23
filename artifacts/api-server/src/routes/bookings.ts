import { Router, type IRouter } from "express";
import { db, bookingsTable, tripsTable, seatsTable, usersTable, commissionSettingsTable, companiesTable, busesTable, walletTransactionsTable } from "@workspace/db";
import { eq, desc, inArray, ne, and, sql, gte } from "drizzle-orm";
import { tokenStore } from "./auth";
import { auditLog, detectAnomalies, ACTIONS } from "../audit";

const router: IRouter = Router();

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);
const generateRef = () => "GB" + Math.random().toString(36).toUpperCase().substr(2, 8);

/* ── Credit company wallet after a confirmed booking ─────────────── */
async function creditCompanyWallet(bookingId: string) {
  try {
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!bookings.length) return;
    const booking = bookings[0];

    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
    if (!trips.length) return;
    const trip = trips[0];

    let companyId: string | null = null;

    if (trip.companyId) {
      companyId = trip.companyId;
    } else {
      const buses = await db.select().from(busesTable).where(eq(busesTable.busName, trip.busName)).limit(1);
      if (buses.length) companyId = buses[0].companyId;
    }

    if (!companyId) return;

    const gross      = booking.totalAmount;
    const commission = booking.commissionAmount || 0;
    const net        = gross - commission;

    const txId = generateId();
    await db.insert(walletTransactionsTable).values({
      id:               txId,
      companyId,
      bookingId:        booking.id,
      bookingRef:       booking.bookingRef,
      type:             "credit",
      grossAmount:      gross,
      commissionAmount: commission,
      netAmount:        net,
      description:      `Réservation ${booking.bookingRef} — ${trip.from} → ${trip.to}`,
    });

    await db.update(companiesTable)
      .set({ walletBalance: sql`wallet_balance + ${net}` })
      .where(eq(companiesTable.id, companyId));
  } catch (err) {
    console.error("creditCompanyWallet error:", err);
  }
}

function getUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  return tokenStore.get(token) || null;
}

async function getUserRole(userId: string): Promise<string | null> {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    return users[0]?.role || null;
  } catch {
    return null;
  }
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
    commissionAmount: booking.commissionAmount || 0,
    commissionRate: booking.commissionRate || 0,
    netAmount: booking.totalAmount - (booking.commissionAmount || 0),
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

    /* ── Audit log + anomaly detection ─────────────────────────────── */
    const userRows = await db.select({ name: usersTable.name, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const ctx = { userId, userRole: userRows[0]?.role ?? "client", userName: userRows[0]?.name ?? "" };
    auditLog(ctx, ACTIONS.BOOKING_CREATE, newBookingId, "booking", {
      bookingRef: newBookingRef, tripId, totalAmount, paymentMethod,
    }).catch(() => {});
    detectAnomalies(ctx, ACTIONS.BOOKING_CREATE).catch(() => {});

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

    await creditCompanyWallet(bookingId);

    const full = await getFullBooking(bookingId);

    auditLog({ userId, userRole: "client", req }, ACTIONS.BOOKING_CONFIRM, bookingId, "booking", {
      bookingRef: booking.bookingRef, paymentMethod: paymentMethod ?? booking.paymentMethod,
    }).catch(() => {});

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

/* ── Recommandations personnalisées (IA simple) ────────────────────────────
   GET /bookings/recommendations
   Analyse l'historique du client pour trouver :
   - Sa route favorite (la plus fréquente)
   - Son heure habituelle de départ (mode)
   - Son jour habituel de voyage (mode)
   Puis note chaque trajet futur disponible et retourne les 5 meilleurs.
─────────────────────────────────────────────────────────────────────────── */
router.get("/recommendations", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    /* ── 1. Historique du client ─────────────────────────── */
    const pastBookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.userId, userId))
      .orderBy(desc(bookingsTable.createdAt));

    /* ── 2. Analyser les routes + heures + jours ─────────── */
    type RouteStats = { count: number; hours: number[]; days: number[] };
    const routeMap: Record<string, RouteStats> = {};

    for (const bk of pastBookings) {
      if (!bk.tripId) continue;
      const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, bk.tripId)).limit(1);
      const trip = trips[0];
      if (!trip) continue;

      const key = `${trip.from}|||${trip.to}`;
      if (!routeMap[key]) routeMap[key] = { count: 0, hours: [], days: [] };
      routeMap[key].count++;

      if (trip.departureTime) {
        const hour = parseInt(trip.departureTime.split(":")[0], 10);
        if (!isNaN(hour)) routeMap[key].hours.push(hour);
      }

      if (trip.date) {
        const d = new Date(trip.date);
        if (!isNaN(d.getTime())) routeMap[key].days.push(d.getDay());
      }
    }

    const mode = (arr: number[]): number | null => {
      if (!arr.length) return null;
      const freq: Record<number, number> = {};
      for (const v of arr) freq[v] = (freq[v] || 0) + 1;
      return parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0], 10);
    };

    /* ── Top-3 routes par fréquence ──────────────────────── */
    const sortedRoutes = Object.entries(routeMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);

    const favoriteFrom = sortedRoutes[0]?.[0].split("|||")[0] ?? null;
    const favoriteTo   = sortedRoutes[0]?.[0].split("|||")[1] ?? null;
    const preferredHour = mode(sortedRoutes[0]?.[1].hours ?? []);
    const preferredDay  = mode(sortedRoutes[0]?.[1].days ?? []);

    /* ── 3. Trajets futurs disponibles ───────────────────── */
    const today = new Date().toISOString().slice(0, 10);
    const futureTrips = await db
      .select()
      .from(tripsTable)
      .where(gte(tripsTable.date, today))
      .orderBy(tripsTable.date, tripsTable.departureTime);

    /* ── 4. Enrichir avec sièges disponibles ─────────────── */
    const enriched = await Promise.all(
      futureTrips.map(async (trip) => {
        const seats = await db
          .select()
          .from(seatsTable)
          .where(and(eq(seatsTable.tripId, trip.id), eq(seatsTable.status, "available")));

        let companyName = trip.companyId ?? trip.busName ?? "";
        if (trip.companyId) {
          const cos = await db.select().from(companiesTable).where(eq(companiesTable.id, trip.companyId)).limit(1);
          if (cos[0]) companyName = cos[0].companyName;
        }

        return { ...trip, availableSeats: seats.length, companyName };
      })
    );

    /* ── 5. Scorer chaque trajet ─────────────────────────── */
    type ScoredTrip = typeof enriched[0] & {
      score: number;
      reasons: string[];
      routeRank: number;
    };

    const dayNames = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

    const scored: ScoredTrip[] = enriched
      .filter(t => t.availableSeats > 0)
      .map(trip => {
        let score = 0;
        const reasons: string[] = [];
        let routeRank = 0;

        /* Route match */
        sortedRoutes.forEach(([key], idx) => {
          const [f, t2] = key.split("|||");
          if (
            trip.from.toLowerCase().includes(f.toLowerCase()) ||
            f.toLowerCase().includes(trip.from.toLowerCase())
          ) {
            if (
              trip.to.toLowerCase().includes(t2.toLowerCase()) ||
              t2.toLowerCase().includes(trip.to.toLowerCase())
            ) {
              routeRank = idx + 1;
              const pts = [3, 2, 1][idx];
              score += pts;
              if (idx === 0) reasons.push("Route habituelle");
              else reasons.push("Route connue");
            }
          }
        });

        /* Heure habituelle */
        if (preferredHour !== null && trip.departureTime) {
          const tripHour = parseInt(trip.departureTime.split(":")[0], 10);
          if (!isNaN(tripHour) && Math.abs(tripHour - preferredHour) <= 1) {
            score += 2;
            reasons.push(`Heure habituelle (~${preferredHour}h)`);
          }
        }

        /* Jour habituel */
        if (preferredDay !== null && trip.date) {
          const tripDay = new Date(trip.date).getDay();
          if (tripDay === preferredDay) {
            score += 1;
            reasons.push(`Jour habituel (${dayNames[preferredDay]})`);
          }
        }

        /* Bonus places disponibles */
        if (trip.availableSeats >= 5) {
          score += 1;
        }

        return { ...trip, score, reasons, routeRank };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({
      profile: {
        totalBookings: pastBookings.length,
        favoriteRoute: favoriteFrom && favoriteTo ? { from: favoriteFrom, to: favoriteTo } : null,
        preferredHour,
        preferredDay,
        preferredDayName: preferredDay !== null ? dayNames[preferredDay] : null,
      },
      suggestions: scored.map(t => ({
        id: t.id,
        from: t.from,
        to: t.to,
        date: t.date,
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        duration: t.duration,
        price: t.price,
        busType: t.busType,
        busName: t.busName,
        availableSeats: t.availableSeats,
        companyName: t.companyName,
        score: t.score,
        reasons: t.reasons,
        routeRank: t.routeRank,
      })),
    });
  } catch (err) {
    console.error("Recommendations error:", err);
    res.status(500).json({ error: "Recommandations indisponibles" });
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

/* ── Confirmer une réservation (compagnie uniquement) ─────────────────────
   POST /bookings/:bookingId/company-confirm
   Seul un utilisateur avec role "compagnie" peut accéder à cette route.
─────────────────────────────────────────────────────────────────────────── */
router.post("/:bookingId/company-confirm", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const role = await getUserRole(userId);
    if (role !== "compagnie") {
      res.status(403).json({ error: "Accès refusé — réservé aux compagnies" });
      return;
    }

    const { bookingId } = req.params;
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!bookings.length) { res.status(404).json({ error: "Réservation introuvable" }); return; }

    const booking = bookings[0];
    if (booking.status === "confirmed") {
      const full = await getFullBooking(bookingId);
      res.json(full);
      return;
    }
    if (booking.status === "cancelled") {
      res.status(400).json({ error: "Impossible de confirmer une réservation annulée" });
      return;
    }

    await db.update(bookingsTable)
      .set({ status: "confirmed", paymentStatus: "paid" })
      .where(eq(bookingsTable.id, bookingId));

    await creditCompanyWallet(bookingId);

    const full = await getFullBooking(bookingId);
    res.json(full);
  } catch (err) {
    console.error("Company confirm booking error:", err);
    res.status(500).json({ error: "Échec de la confirmation" });
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
    const role = await getUserRole(userId);
    if (booking.userId !== userId && role !== "compagnie") {
      res.status(403).json({ error: "Non autorisé" });
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

    auditLog({ userId, userRole: role ?? "client", req }, ACTIONS.BOOKING_CANCEL, bookingId, "booking", {
      bookingRef: booking.bookingRef, previousStatus: booking.status,
    }).catch(() => {});

    res.json(full);
  } catch (err) {
    console.error("Cancel booking error:", err);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export { getFullBooking };
export default router;
