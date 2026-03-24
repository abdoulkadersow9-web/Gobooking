/**
 * GoBooking — Moteur d'automatisation intelligent
 * Tourne toutes les 30 secondes :
 *  1. Places restantes < 5          → alerte passagers du trajet
 *  2. Départ imminent (≤ 30 min)    → notifie les passagers confirmés
 *  3. No-show client                → annule la réservation + libère le siège
 *  4. Colis non chargé au départ    → alerte l'agent du bus
 *  5. Mise à jour automatique du statut trajet
 *  6. Auto-confirmation en_attente → confirmed (si payé)
 */

import {
  db,
  bookingsTable,
  tripsTable,
  seatsTable,
  usersTable,
  parcelsTable,
  notificationsTable,
  agentsTable,
} from "@workspace/db";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { sendExpoPush } from "./pushService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tripDepartureDate(trip: { date: string; departureTime: string }): Date {
  return new Date(`${trip.date}T${trip.departureTime}:00`);
}

function minutesUntil(d: Date): number {
  return (d.getTime() - Date.now()) / 60_000;
}

function nanoid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

async function pushAndStore(
  userId: string,
  pushToken: string | null | undefined,
  type: string,
  title: string,
  message: string,
  refId?: string,
  refType?: string
) {
  try {
    await db.insert(notificationsTable).values({
      id: nanoid(),
      userId,
      type,
      title,
      message,
      refId: refId ?? null,
      refType: refType ?? null,
    });
  } catch { /* silently skip if dup */ }
  sendExpoPush(pushToken, title, message).catch(() => {});
}

// ─── In-memory dédup (évite les doublons de notifications) ───────────────────

const sentLowSeat     = new Set<string>(); // tripId
const sentDeparture   = new Set<string>(); // tripId
const sentParcelAlert = new Set<string>(); // parcelId
const sentNoShow      = new Set<string>(); // bookingId

// ─── 1. Alertes places restantes < 5 ─────────────────────────────────────────

async function checkLowSeats() {
  const today = new Date().toISOString().slice(0, 10);

  const trips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "scheduled")));

  for (const trip of trips) {
    if (sentLowSeat.has(trip.id)) continue;

    const bookingRows = await db
      .select({ id: bookingsTable.id, userId: bookingsTable.userId })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.tripId, trip.id),
          inArray(bookingsTable.status, ["confirmed", "embarqué"])
        )
      );

    const remaining = trip.totalSeats - bookingRows.length;
    if (remaining > 0 && remaining < 5) {
      sentLowSeat.add(trip.id);
      console.log(`[Scheduler] ⚠️  Places limitées trajet ${trip.id}: ${remaining} restantes`);

      for (const b of bookingRows) {
        const [userRow] = await db
          .select({ pushToken: usersTable.pushToken })
          .from(usersTable)
          .where(eq(usersTable.id, b.userId))
          .limit(1);

        await pushAndStore(
          b.userId,
          userRow?.pushToken,
          "low_seats",
          "⚠️ Places limitées !",
          `Plus que ${remaining} place${remaining > 1 ? "s" : ""} sur ${trip.from} → ${trip.to}. Réservez vite !`,
          trip.id,
          "trip"
        );
      }
    }
  }
}

// ─── 2. Départ imminent ≤ 30 min → notifier les passagers ────────────────────

async function checkDepartureImminent() {
  const today = new Date().toISOString().slice(0, 10);

  const trips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "scheduled")));

  for (const trip of trips) {
    if (sentDeparture.has(trip.id)) continue;

    const minsLeft = minutesUntil(tripDepartureDate(trip));
    if (minsLeft > 0 && minsLeft <= 30) {
      sentDeparture.add(trip.id);
      console.log(`[Scheduler] 🚌 Départ imminent trajet ${trip.id} dans ${Math.round(minsLeft)} min`);

      const bookingRows = await db
        .select({ id: bookingsTable.id, userId: bookingsTable.userId })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.tripId, trip.id),
            inArray(bookingsTable.status, ["confirmed", "embarqué"])
          )
        );

      for (const b of bookingRows) {
        const [userRow] = await db
          .select({ pushToken: usersTable.pushToken })
          .from(usersTable)
          .where(eq(usersTable.id, b.userId))
          .limit(1);

        await pushAndStore(
          b.userId,
          userRow?.pushToken,
          "departure_soon",
          "🚌 Départ imminent !",
          `Votre bus ${trip.from} → ${trip.to} part dans ${Math.round(minsLeft)} minutes. Présentez-vous en gare.`,
          trip.id,
          "trip"
        );
      }
    }
  }
}

// ─── 3. No-show : client non embarqué après départ → annulé + siège libéré ──

async function checkNoShows() {
  const activeTrips = await db
    .select({ id: tripsTable.id, from: tripsTable.from, to: tripsTable.to })
    .from(tripsTable)
    .where(
      and(
        inArray(tripsTable.status, ["en_route", "boarding"]),
        isNotNull(tripsTable.startedAt)
      )
    );

  for (const trip of activeTrips) {
    const noShows = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.tripId, trip.id),
          eq(bookingsTable.status, "confirmed")
        )
      );

    for (const booking of noShows) {
      if (sentNoShow.has(booking.id)) continue;
      sentNoShow.add(booking.id);

      console.log(`[Scheduler] ❌ No-show: ${booking.bookingRef}`);

      // Libérer les sièges
      if (booking.seatIds && booking.seatIds.length > 0) {
        await db
          .update(seatsTable)
          .set({ status: "available" })
          .where(inArray(seatsTable.id, booking.seatIds));
      }

      // Annuler la réservation
      await db
        .update(bookingsTable)
        .set({ status: "annulé" } as any)
        .where(eq(bookingsTable.id, booking.id));

      const [userRow] = await db
        .select({ pushToken: usersTable.pushToken })
        .from(usersTable)
        .where(eq(usersTable.id, booking.userId))
        .limit(1);

      await pushAndStore(
        booking.userId,
        userRow?.pushToken,
        "no_show",
        "❌ Réservation annulée",
        `Votre réservation ${booking.bookingRef} (${trip.from} → ${trip.to}) a été annulée car vous n'étiez pas présent à l'embarquement.`,
        booking.id,
        "booking"
      );
    }
  }
}

// ─── 4. Colis non chargé à ≤10 min du départ → alerter l'agent ──────────────

async function checkUnloadedParcels() {
  const today = new Date().toISOString().slice(0, 10);

  const trips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "scheduled")));

  for (const trip of trips) {
    const minsLeft = minutesUntil(tripDepartureDate(trip));
    if (minsLeft > 10 || minsLeft < -5) continue;

    // Colis assignés à ce trajet et encore en gare
    const unloaded = await db
      .select({ id: parcelsTable.id, trackingRef: parcelsTable.trackingRef })
      .from(parcelsTable)
      .where(
        and(
          eq(parcelsTable.tripId, trip.id),
          eq(parcelsTable.status, "en_gare")
        )
      );

    for (const parcel of unloaded) {
      if (sentParcelAlert.has(parcel.id)) continue;
      sentParcelAlert.add(parcel.id);

      console.log(`[Scheduler] 📦 Colis non chargé ${parcel.trackingRef} → trajet ${trip.id}`);

      // Chercher l'agent assigné à ce trajet
      const [agentRow] = await db
        .select({ userId: agentsTable.userId })
        .from(agentsTable)
        .where(eq(agentsTable.tripId, trip.id))
        .limit(1);

      if (agentRow) {
        const [userRow] = await db
          .select({ pushToken: usersTable.pushToken })
          .from(usersTable)
          .where(eq(usersTable.id, agentRow.userId))
          .limit(1);

        await pushAndStore(
          agentRow.userId,
          userRow?.pushToken,
          "parcel_unloaded",
          "📦 Colis non chargé !",
          `Le colis ${parcel.trackingRef} est en gare mais pas encore chargé. Départ dans ${Math.round(minsLeft)} min !`,
          parcel.id,
          "parcel"
        );
      }
    }
  }
}

// ─── 5. Mise à jour automatique statut trajet ─────────────────────────────────

async function autoUpdateTripStatuses() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Trajet "scheduled" dont le départ est passé depuis > 2 min → en_route
  const scheduled = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "scheduled")));

  for (const trip of scheduled) {
    const minsOver = -minutesUntil(tripDepartureDate(trip)); // positif = passé
    if (minsOver > 2) {
      await db
        .update(tripsTable)
        .set({ status: "en_route", startedAt: now } as any)
        .where(eq(tripsTable.id, trip.id));
      console.log(`[Scheduler] 🟢 Trajet ${trip.id} → en_route (auto)`);
    }
  }
}

// ─── 6. Auto-confirmation réservations en_attente (payées) ──────────────────

async function autoConfirmBookings() {
  const pendingPaid = await db
    .select({ id: bookingsTable.id, bookingRef: bookingsTable.bookingRef })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.status, "en_attente"),
        eq(bookingsTable.paymentStatus, "paid")
      )
    );

  for (const b of pendingPaid) {
    await db
      .update(bookingsTable)
      .set({ status: "confirmed" } as any)
      .where(eq(bookingsTable.id, b.id));
    console.log(`[Scheduler] ✅ Réservation ${b.bookingRef} auto-confirmée`);
  }
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export function startScheduler(intervalMs = 30_000) {
  console.log(`[Scheduler] ⚙️  Démarré — vérification toutes les ${intervalMs / 1000}s`);

  const run = async () => {
    try {
      await Promise.all([
        checkLowSeats(),
        checkDepartureImminent(),
        checkNoShows(),
        checkUnloadedParcels(),
        autoUpdateTripStatuses(),
        autoConfirmBookings(),
      ]);
    } catch (err) {
      console.error("[Scheduler] Erreur générale:", err);
    }
  };

  run(); // exécution immédiate au démarrage
  setInterval(run, intervalMs);
}
