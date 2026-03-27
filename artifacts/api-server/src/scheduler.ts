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
  busPositionsTable,
} from "@workspace/db";
import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { sendExpoPush } from "./pushService";
import { locationStore } from "./locationStore";

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

const sentLowSeat         = new Set<string>(); // tripId
const sentDeparture       = new Set<string>(); // tripId
const sentParcelAlert     = new Set<string>(); // parcelId
const sentNoShow          = new Set<string>(); // bookingId
const sentAgentPreDepart  = new Set<string>(); // `${tripId}_${userId}`

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

// ─── 5. Moteur d'état complet des trajets ────────────────────────────────────
//
//  scheduled → boarding   (30 min avant départ, même jour)
//  boarding  → en_route   (à l'heure de départ)
//  en_route  → arrived    (à l'heure d'arrivée estimée)
//  arrived   → completed  (2 h après arrived_at)
//
//  Chaque transition met à jour les timestamps et notifie les passagers.

const sentBoardingAlert = new Set<string>(); // tripId

async function autoUpdateTripStatuses() {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);

  /* ── scheduled → boarding  (fenêtre 30 min avant départ) ── */
  const scheduledTrips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "scheduled")));

  for (const trip of scheduledTrips) {
    const minsUntil = minutesUntil(tripDepartureDate(trip));
    if (minsUntil <= 30 && minsUntil > -2) {
      await db.update(tripsTable).set({ status: "boarding" } as any).where(eq(tripsTable.id, trip.id));
      console.log(`[Scheduler] 🚪 Trajet ${trip.id} (${trip.from}→${trip.to}) → BOARDING`);

      if (!sentBoardingAlert.has(trip.id)) {
        sentBoardingAlert.add(trip.id);
        // Notifier les passagers confirmés
        const bookings = await db.select({ id: bookingsTable.id, userId: bookingsTable.userId })
          .from(bookingsTable)
          .where(and(eq(bookingsTable.tripId, trip.id), inArray(bookingsTable.status, ["confirmed", "payé"])));
        for (const b of bookings) {
          const [u] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
          await pushAndStore(b.userId, u?.pushToken, "boarding_started",
            "🚪 Embarquement ouvert !",
            `L'embarquement du bus ${trip.from} → ${trip.to} est ouvert. Départ dans ${Math.round(minsUntil)} min.`,
            trip.id, "trip");
        }
      }
    }
  }

  /* ── boarding → en_route  (heure de départ atteinte ou dépassée) ── */
  const boardingTrips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "boarding")));

  for (const trip of boardingTrips) {
    const minsOver = -minutesUntil(tripDepartureDate(trip)); // positif = passé
    if (minsOver >= 0) {
      const delayMins = Math.max(0, Math.round(minsOver));
      const etaStr = computeETA(trip.departureTime, trip.arrivalTime, delayMins);
      await db.execute(sql`
        UPDATE trips SET
          status = 'en_route',
          started_at = ${now.toISOString()},
          actual_departure_time = ${now.toTimeString().slice(0,5)},
          estimated_arrival_time = ${etaStr},
          delay_minutes = ${delayMins}
        WHERE id = ${trip.id}
      `);
      console.log(`[Scheduler] 🟢 Trajet ${trip.id} (${trip.from}→${trip.to}) → EN_ROUTE | retard ${delayMins} min | ETA ${etaStr}`);
    }
  }

  /* ── en_route → arrived  (ETA ou heure d'arrivée atteinte) ── */
  const enRouteRows = await db.execute(sql`
    SELECT id, from_city, to_city, date, departure_time, arrival_time,
           estimated_arrival_time, arrived_at, bus_id, status
    FROM trips
    WHERE date = ${today} AND status IN ('en_route', 'in_progress')
  `);

  for (const row of enRouteRows.rows as any[]) {
    const eta = row.estimated_arrival_time ?? row.arrival_time;
    if (!eta) continue;
    const etaMs = new Date(today + "T" + eta + ":00").getTime();
    if (now.getTime() >= etaMs) {
      await db.execute(sql`
        UPDATE trips SET status = 'arrived', arrived_at = ${now.toISOString()} WHERE id = ${row.id}
      `);
      console.log(`[Scheduler] 🏁 Trajet ${row.id} (${row.from_city}→${row.to_city}) → ARRIVED`);

      // Notifier les passagers
      const bookings = await db.select({ id: bookingsTable.id, userId: bookingsTable.userId })
        .from(bookingsTable)
        .where(and(eq(bookingsTable.tripId, row.id), inArray(bookingsTable.status, ["confirmed","embarqué","boarded","validated"])));
      for (const b of bookings) {
        const [u] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
        await pushAndStore(b.userId, u?.pushToken, "trip_arrived",
          "🏁 Vous êtes arrivé !",
          `Votre bus ${row.from_city} → ${row.to_city} est arrivé à destination. Bon séjour !`,
          row.id, "trip");
      }

      // Libérer le bus
      if (row.bus_id) {
        await db.execute(sql`UPDATE buses SET logistic_status = 'en_attente', current_trip_id = NULL WHERE id = ${row.bus_id}`).catch(() => {});
      }
    }
  }

  /* ── arrived → completed  (2 h après arrived_at) ── */
  const arrivedRows = await db.execute(sql`
    SELECT id, arrived_at FROM trips WHERE status = 'arrived' AND arrived_at IS NOT NULL
  `);
  for (const row of arrivedRows.rows as any[]) {
    const arrivedAt = new Date(row.arrived_at);
    const twoHoursAfter = new Date(arrivedAt.getTime() + 2 * 60 * 60 * 1000);
    if (now >= twoHoursAfter) {
      await db.execute(sql`UPDATE trips SET status = 'completed' WHERE id = ${row.id}`);
      console.log(`[Scheduler] ✅ Trajet ${row.id} → COMPLETED`);
    }
  }
}

/* ─── Helper ETA ──────────────────────────────────────────────── */
function computeETA(departureTime: string, arrivalTime: string, delayMins: number): string {
  const [dh, dm] = departureTime.split(":").map(Number);
  const [ah, am] = arrivalTime.split(":").map(Number);
  const durationMins = (ah * 60 + am) - (dh * 60 + dm);
  const nowMins      = new Date().getHours() * 60 + new Date().getMinutes();
  const etaMins      = nowMins + Math.max(0, durationMins) + delayMins;
  const h = Math.floor(etaMins / 60) % 24;
  const m = etaMins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
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

// ─── 7. Expiration 45 min : pending non payées → expiré + siège libéré ───────

const sentExpiry = new Set<string>(); // bookingId déjà traité

async function checkPendingExpiry() {
  const today = new Date().toISOString().slice(0, 10);

  // Trajets schedulés d'aujourd'hui
  const trips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "scheduled")));

  for (const trip of trips) {
    const minsLeft = minutesUntil(tripDepartureDate(trip));
    // Seuil: ≤ 45 min avant départ
    if (minsLeft > 45) continue;

    // Réservations en attente de paiement pour ce trajet
    const expiredBookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.tripId, trip.id),
          eq(bookingsTable.status, "pending"),
          eq(bookingsTable.paymentStatus, "pending")
        )
      );

    for (const booking of expiredBookings) {
      if (sentExpiry.has(booking.id)) continue;
      sentExpiry.add(booking.id);

      // Libérer les sièges
      if (booking.seatIds && booking.seatIds.length > 0) {
        await db
          .update(seatsTable)
          .set({ status: "available" })
          .where(inArray(seatsTable.id, booking.seatIds));
      }

      // Marquer la réservation comme expirée
      await db
        .update(bookingsTable)
        .set({ status: "expiré" } as any)
        .where(eq(bookingsTable.id, booking.id));

      console.log(`[Scheduler] ⏱️  Réservation ${booking.bookingRef} expirée (départ dans ${Math.round(minsLeft)} min)`);

      // Notifier le client
      const [userRow] = await db
        .select({ pushToken: usersTable.pushToken })
        .from(usersTable)
        .where(eq(usersTable.id, booking.userId))
        .limit(1);

      await pushAndStore(
        booking.userId,
        userRow?.pushToken,
        "booking_expired",
        "⏱️ Réservation expirée",
        `Votre réservation ${booking.bookingRef} (${trip.from} → ${trip.to}) a expiré faute de paiement dans les 45 min. Le siège a été libéré.`,
        booking.id,
        "booking"
      );
    }
  }
}

// ─── 8. Alertes pré-départ pour les agents (≤ 5 min avant départ) ────────────
//
//  Agents concernés : agent_ticket | bagage | agent_colis | agent_embarquement | validation_depart
//  Message : "Agent, veuillez valider votre départ" ou "L'agent de validation attend…"
//  Envoyé 1 seule fois par agent/trajet (dédup mémoire sentAgentPreDepart).

const PRE_DEPART_ROLES = [
  "agent_ticket", "bagage", "agent_colis",
  "agent_embarquement", "validation_depart",
];

async function checkPreDepartureAgentAlerts() {
  const today = new Date().toISOString().slice(0, 10);

  const trips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "scheduled")));

  for (const trip of trips) {
    if (!trip.companyId) continue;
    const minsLeft = minutesUntil(tripDepartureDate(trip));

    // Fenêtre : entre 0 et 5 min avant le départ
    if (minsLeft > 5 || minsLeft < -1) continue;

    const companyAgents = await db
      .select({ userId: agentsTable.userId, agentRole: agentsTable.agentRole })
      .from(agentsTable)
      .where(and(
        eq(agentsTable.companyId, trip.companyId),
        inArray(agentsTable.agentRole, PRE_DEPART_ROLES),
      ));

    for (const agent of companyAgents) {
      const dedupKey = `${trip.id}_${agent.userId}`;
      if (sentAgentPreDepart.has(dedupKey)) continue;
      sentAgentPreDepart.add(dedupKey);

      const [userRow] = await db
        .select({ pushToken: usersTable.pushToken })
        .from(usersTable)
        .where(eq(usersTable.id, agent.userId))
        .limit(1);

      const minsLabel = Math.max(0, Math.round(minsLeft));
      const isValidation = agent.agentRole === "validation_depart";

      const title   = `🚨 Départ dans ${minsLabel} min — ${trip.from} → ${trip.to}`;
      const message = isValidation
        ? `L'agent de validation attend validation pour le départ de ${trip.from} → ${trip.to} à ${trip.departureTime}.`
        : `Agent, veuillez valider votre départ ${trip.from} → ${trip.to} prévu à ${trip.departureTime}.`;

      await pushAndStore(agent.userId, userRow?.pushToken, "pre_departure_alert", title, message, trip.id, "trip");
      console.log(`[Scheduler] 🚨 Alerte pré-départ → ${agent.agentRole} (${agent.userId}) | trajet ${trip.id}`);
    }
  }
}

// ─── 9. Mise à jour indicateurs de capacité ──────────────────────────────────
//  Met à jour `capacity_status` pour tous les trajets actifs :
//  normal (0-69%) | almost_full (70-89%) | full (90-99%) | overloaded (100%+)

async function updateCapacityStatus() {
  const rows = await db.execute(sql`
    SELECT t.id, t.total_seats,
           COUNT(b.id) FILTER (WHERE b.status NOT IN ('cancelled','refunded','annulé','expiré')) AS booked,
           COUNT(b.id) FILTER (WHERE b.passenger_status = 'alighted') AS alighted
    FROM trips t
    LEFT JOIN bookings b ON b.trip_id = t.id
    WHERE t.status IN ('scheduled', 'boarding', 'en_route', 'in_progress', 'arrived')
    GROUP BY t.id, t.total_seats
  `);

  for (const row of rows.rows as any[]) {
    const total    = Number(row.total_seats) || 0;
    const booked   = Number(row.booked) || 0;
    const alighted = Number(row.alighted) || 0;
    const active   = booked - alighted; // passagers actuellement à bord
    const pct      = total > 0 ? (active / total) * 100 : 0;

    const status = pct >= 100 ? "overloaded"
                 : pct >= 90  ? "full"
                 : pct >= 70  ? "almost_full"
                 : "normal";

    const delayRisk = total > 0 && pct >= 70; // bus chargé → risque retard au départ
    const intel = JSON.stringify({
      booked, alighted, active, pct: Math.round(pct),
      delay_risk: delayRisk,
      overloaded: pct >= 100,
    });

    await db.execute(sql`
      UPDATE trips SET capacity_status = ${status}, intelligence = ${intel}::jsonb WHERE id = ${row.id}
    `).catch(() => {});
  }
}

// ─── 10. Libération automatique des places aux escales ────────────────────────
//  Quand un trajet passe une escale (waypoints_passed contient la ville)
//  → les passagers avec alighting_city = cette_ville sont marqués "alighted"
//  → leurs sièges deviennent disponibles pour les passagers suivants

async function releaseWaypointSeats() {
  const activeTrips = await db.execute(sql`
    SELECT id, from_city, to_city, waypoints_passed
    FROM trips
    WHERE status IN ('en_route', 'in_progress', 'boarding')
      AND waypoints_passed IS NOT NULL
      AND jsonb_array_length(waypoints_passed) > 0
  `);

  for (const trip of activeTrips.rows as any[]) {
    let waypoints: string[] = [];
    try { waypoints = JSON.parse(typeof trip.waypoints_passed === "string" ? trip.waypoints_passed : JSON.stringify(trip.waypoints_passed)); }
    catch { continue; }
    if (!waypoints.length) continue;

    for (const city of waypoints) {
      // Trouver les passagers qui descendent à cette escale et ne sont pas encore marqués alighted
      const passengerRows = await db.execute(sql`
        SELECT b.id, b.seat_ids, b.seat_numbers, b.user_id, b.booking_ref
        FROM bookings b
        WHERE b.trip_id = ${trip.id}
          AND LOWER(b.alighting_city) = LOWER(${city})
          AND b.status NOT IN ('cancelled','refunded','annulé','expiré')
          AND (b.passenger_status IS NULL OR b.passenger_status != 'alighted')
      `);

      for (const b of passengerRows.rows as any[]) {
        // Marquer passager comme descendu
        await db.execute(sql`
          UPDATE bookings SET passenger_status = 'alighted' WHERE id = ${b.id}
        `);

        // Libérer les sièges dans la table seats
        let seatIds: string[] = [];
        try { seatIds = Array.isArray(b.seat_ids) ? b.seat_ids : JSON.parse(b.seat_ids ?? "[]"); }
        catch {}
        if (seatIds.length > 0) {
          await db.execute(sql`
            UPDATE seats SET status = 'available' WHERE id = ANY(${seatIds}::text[])
          `).catch(() => {});
        }

        console.log(`[Scheduler] 🪑 Escale ${city} — siège libéré pour réservation ${b.booking_ref} (trajet ${trip.id})`);

        // Notifier le passager descendu
        const [u] = await db.select({ pushToken: usersTable.pushToken, id: usersTable.id })
          .from(usersTable).where(eq(usersTable.id, b.user_id)).limit(1);
        if (u) {
          await pushAndStore(u.id, u.pushToken, "alighted_at_stop",
            "🛑 Fin de votre trajet",
            `Votre descente à ${city} a été enregistrée. Votre siège a été libéré. Bon séjour !`,
            b.id, "booking");
        }
      }
    }
  }
}

// ─── Notifications intelligentes ──────────────────────────────────────────────

/** Garde la mémoire des alertes envoyées pour éviter les doublons */
const sentPreAlighting = new Map<string, number>();  // `${tripId}|${bookingId}|${city}` → timestamp
const sentDelayAlert   = new Map<string, number>();  // `${tripId}|${delayMinutes}` → timestamp
const lastDelayPerTrip = new Map<string, number>();  // tripId → dernier délai connu

/**
 * sendPreAlightingNotifications — alerte passagers ~30 min avant leur descente
 * Basé sur l'ETA calculée depuis departure_time + fraction du trajet par escale
 */
async function sendPreAlightingNotifications() {
  const activeTrips = await db.execute(sql`
    SELECT t.id, t.from_city, t.to_city, t.date, t.departure_time, t.arrival_time,
           t.estimated_arrival_time, t.stops, t.delay_minutes, t.waypoints_passed
    FROM trips t
    WHERE t.status IN ('en_route', 'in_progress', 'boarding')
  `);

  for (const trip of activeTrips.rows as any[]) {
    let stops: any[] = [];
    try { stops = typeof trip.stops === "string" ? JSON.parse(trip.stops) : (trip.stops ?? []); } catch {}
    if (!stops.length) continue;

    let waypoints: string[] = [];
    try { waypoints = typeof trip.waypoints_passed === "string" ? JSON.parse(trip.waypoints_passed) : (trip.waypoints_passed ?? []); } catch {}

    // Calculer le temps total du trajet en minutes
    const [dh, dm] = trip.departure_time.split(":").map(Number);
    const [ah, am] = (trip.estimated_arrival_time ?? trip.arrival_time).split(":").map(Number);
    const totalTripMin = ((ah * 60 + am) - (dh * 60 + dm) + 1440) % 1440;
    if (totalTripMin <= 0) continue;

    const delay = Number(trip.delay_minutes) || 0;
    const baseDate = new Date(`${trip.date}T${trip.departure_time}:00`);

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const cityName = stop.city ?? stop.name ?? stop.location ?? "";
      if (!cityName) continue;

      // Fraction du trajet : arrêt i sur N arrêts
      const fraction = (i + 1) / (stops.length + 1);
      const etaAtStopMin = Math.round(totalTripMin * fraction) + delay;
      const etaAtStop = new Date(baseDate.getTime() + etaAtStopMin * 60_000);
      const minsUntilStop = (etaAtStop.getTime() - Date.now()) / 60_000;

      // Seulement si dans 15–45 min ET pas encore passée
      if (minsUntilStop < 15 || minsUntilStop > 45) continue;
      if (waypoints.includes(cityName)) continue; // déjà passée

      // Trouver les passagers qui descendent à cette escale
      const passengers = await db.execute(sql`
        SELECT b.id, b.user_id, b.booking_ref, b.contact_phone
        FROM bookings b
        WHERE b.trip_id = ${trip.id}
          AND LOWER(b.alighting_city) = LOWER(${cityName})
          AND b.status NOT IN ('cancelled','refunded','annulé','expiré')
          AND (b.passenger_status IS NULL OR b.passenger_status = 'booked')
      `);

      for (const b of passengers.rows as any[]) {
        const key = `${trip.id}|${b.id}|${cityName}`;
        const lastSent = sentPreAlighting.get(key) ?? 0;
        if (Date.now() - lastSent < 30 * 60_000) continue; // cooldown 30 min

        const [u] = await db.select({ pushToken: usersTable.pushToken })
          .from(usersTable).where(eq(usersTable.id, b.user_id)).limit(1);

        const etaStr = `${String(etaAtStop.getHours()).padStart(2,"0")}:${String(etaAtStop.getMinutes()).padStart(2,"0")}`;
        await pushAndStore(b.user_id, u?.pushToken, "pre_alighting_alert",
          `🛑 Arrivée à ${cityName} dans ~${Math.round(minsUntilStop)} min`,
          `Votre trajet ${trip.from_city} → ${trip.to_city} arrive à ${cityName} vers ${etaStr}. Préparez-vous à descendre !`,
          b.id, "booking");

        sentPreAlighting.set(key, Date.now());
        console.log(`[Scheduler] 📍 Alerte descente : ${b.booking_ref} → ${cityName} dans ~${Math.round(minsUntilStop)} min`);
      }
    }
  }
}

/**
 * sendDelayNotifications — notifie tous les passagers d'un trajet si le délai augmente
 */
async function sendDelayNotifications() {
  const delayedTrips = await db.execute(sql`
    SELECT t.id, t.from_city, t.to_city, t.date, t.departure_time, t.delay_minutes, t.delay_reason
    FROM trips t
    WHERE t.status IN ('scheduled','boarding','en_route','in_progress')
      AND t.delay_minutes > 0
  `);

  for (const trip of delayedTrips.rows as any[]) {
    const delay = Number(trip.delay_minutes);
    const lastDelay = lastDelayPerTrip.get(trip.id) ?? 0;

    // Notifier seulement si le délai a augmenté d'au moins 10 min
    if (delay <= lastDelay || delay - lastDelay < 10) {
      lastDelayPerTrip.set(trip.id, delay);
      continue;
    }

    const key = `${trip.id}|${delay}`;
    if (sentDelayAlert.has(key)) { lastDelayPerTrip.set(trip.id, delay); continue; }

    // Récupérer tous les passagers actifs du trajet
    const passengers = await db.execute(sql`
      SELECT DISTINCT b.user_id, b.booking_ref
      FROM bookings b
      WHERE b.trip_id = ${trip.id}
        AND b.status NOT IN ('cancelled','refunded','annulé','expiré')
        AND (b.passenger_status IS NULL OR b.passenger_status != 'alighted')
    `);

    for (const p of passengers.rows as any[]) {
      const [u] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, p.user_id)).limit(1);
      await pushAndStore(p.user_id, u?.pushToken, "trip_delay",
        `⏱️ Retard sur votre trajet`,
        `Votre bus ${trip.from_city} → ${trip.to_city} du ${trip.date} accuse un retard de ${delay} minutes.${trip.delay_reason ? " Motif : " + trip.delay_reason : ""} Merci de votre patience.`,
        trip.id, "trip");
    }

    sentDelayAlert.set(key, Date.now());
    lastDelayPerTrip.set(trip.id, delay);
    if (passengers.rows.length > 0)
      console.log(`[Scheduler] ⏱️  Alerte retard +${delay} min → trajet ${trip.id} (${passengers.rows.length} pax notifiés)`);
  }
}

/**
 * updateTripPositionIntelligence — met à jour le champ `intelligence` avec position actuelle + prochaine escale
 */
async function updateTripPositionIntelligence() {
  const activeTrips = await db.execute(sql`
    SELECT t.id, t.from_city, t.to_city, t.date, t.departure_time, t.arrival_time,
           t.estimated_arrival_time, t.stops, t.delay_minutes, t.waypoints_passed,
           t.status
    FROM trips t
    WHERE t.status IN ('en_route', 'in_progress', 'boarding')
  `);

  for (const trip of activeTrips.rows as any[]) {
    let stops: any[] = [];
    try { stops = typeof trip.stops === "string" ? JSON.parse(trip.stops) : (trip.stops ?? []); } catch {}

    let waypoints: string[] = [];
    try { waypoints = typeof trip.waypoints_passed === "string" ? JSON.parse(trip.waypoints_passed) : (trip.waypoints_passed ?? []); } catch {}

    // Dernière ville passée = position actuelle
    const currentCity = waypoints.length > 0
      ? waypoints[waypoints.length - 1]
      : trip.from_city;

    // Prochaine escale = premier arrêt pas encore passé
    const stopCities = stops.map((s: any) => s.city ?? s.name ?? s.location ?? "").filter(Boolean);
    const nextStop = stopCities.find((c: string) => !waypoints.includes(c)) ?? trip.to_city;

    // Progression : nombre d'étapes passées / total
    const totalSteps = stopCities.length + 2; // from + stops + to
    const passedSteps = waypoints.length + 1; // +1 pour from_city
    const progressPct = Math.min(99, Math.round((passedSteps / totalSteps) * 100));

    const intelligence = {
      currentCity,
      nextStop,
      progressPct,
      waypointsPassed: waypoints,
      allStops: [trip.from_city, ...stopCities, trip.to_city],
      updatedAt: new Date().toISOString(),
    };

    await db.execute(sql`
      UPDATE trips SET intelligence = ${JSON.stringify(intelligence)}::jsonb
      WHERE id = ${trip.id}
    `).catch(() => {});
  }
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export function startScheduler(intervalMs = 30_000) {
  console.log(`[Scheduler] ⚙️  Démarré — vérification toutes les ${intervalMs / 1000}s`);

  const run = async () => {
    try {
      tickSimGps();
      await Promise.all([
        checkLowSeats(),
        checkDepartureImminent(),
        checkNoShows(),
        checkUnloadedParcels(),
        autoUpdateTripStatuses(),
        autoConfirmBookings(),
        checkPendingExpiry(),
        checkBusAnomalies(),
        checkPreDepartureAgentAlerts(),
        updateCapacityStatus(),
        releaseWaypointSeats(),
        sendPreAlightingNotifications(),
        sendDelayNotifications(),
        updateTripPositionIntelligence(),
      ]);
    } catch (err) {
      console.error("[Scheduler] Erreur générale:", err);
    }
  };

  run(); // exécution immédiate au démarrage
  setInterval(run, intervalMs);
}

/* ─── Suivi temps réel — détection arrêt et hors-ligne ───────────────────────
   - Bus arrêté : vitesse == 0 pendant ≥ 2 min → notif compagnie
   - Bus hors-ligne : pas de mise à jour GPS depuis > 30 s → notif compagnie
────────────────────────────────────────────────────────────────────────────── */

const stoppedSince   = new Map<string, number>(); // tripId → timestamp du premier speed=0
const sentStopAlert  = new Set<string>();          // tripId déjà alerté (arrêt)
const sentOffline    = new Set<string>();          // tripId déjà alerté (hors-ligne)

async function checkBusAnomalies() {
  const now = Date.now();

  /* 1. Récupère tous les trajets en_route */
  const activeTrips = await db.select({
    id:        tripsTable.id,
    from:      tripsTable.from,
    to:        tripsTable.to,
    companyId: tripsTable.companyId,
  }).from(tripsTable).where(eq(tripsTable.status, "en_route"));

  if (!activeTrips.length) return;

  /* 2. Récupère les positions DB pour les trajets sans entrée mémoire */
  const dbPositions = await db.select().from(busPositionsTable)
    .where(inArray(busPositionsTable.tripId, activeTrips.map(t => t.id)));
  const dbPosMap = new Map(dbPositions.map(p => [p.tripId, p]));

  /* 3. Récupère les agents liés aux compagnies des trajets actifs */
  const companyIds = [...new Set(activeTrips.map(t => t.companyId).filter(Boolean) as string[])];
  const companyAgentRows = companyIds.length > 0
    ? await db.select({ userId: agentsTable.userId, companyId: agentsTable.companyId })
        .from(agentsTable)
        .where(inArray(agentsTable.companyId, companyIds))
    : [];

  /* 4. Récupère les pushTokens des utilisateurs admins compagnie */
  const agentUserIds = [...new Set(companyAgentRows.map(a => a.userId))];
  const adminUsers = agentUserIds.length > 0
    ? await db.select({ id: usersTable.id, pushToken: usersTable.pushToken, role: usersTable.role })
        .from(usersTable)
        .where(and(
          inArray(usersTable.id, agentUserIds),
          inArray(usersTable.role, ["compagnie", "company_admin"]),
        ))
    : [];

  /* helper: trouver les admins d'une compagnie */
  const adminsForCompany = (companyId: string) => {
    const userIds = new Set(companyAgentRows.filter(a => a.companyId === companyId).map(a => a.userId));
    return adminUsers.filter(u => userIds.has(u.id));
  };

  for (const trip of activeTrips) {
    if (!trip.companyId) continue;
    const memPos = locationStore.get(trip.id);
    const dbPos  = dbPosMap.get(trip.id);

    const lastUpdated = memPos?.updatedAt ?? dbPos?.updatedAt?.getTime() ?? null;
    const speed       = memPos?.speed ?? dbPos?.speed ?? null;

    /* Hors-ligne : pas de mise à jour depuis > 30 s */
    if (!lastUpdated || (now - lastUpdated) > 30_000) {
      if (!sentOffline.has(trip.id)) {
        sentOffline.add(trip.id);
        for (const admin of adminsForCompany(trip.companyId)) {
          if (admin.pushToken) {
            await sendExpoPush(admin.pushToken, "🚌 Bus hors ligne", `Bus ${trip.from}→${trip.to} ne répond plus`);
          }
          await db.insert(notificationsTable).values({
            id: nanoid(), userId: admin.id, type: "bus_offline",
            title: "Bus hors ligne",
            message: `Bus ${trip.from}→${trip.to} : pas de signal GPS depuis plus de 30 secondes.`,
            refId: trip.id, refType: "trip",
          });
        }
        console.log(`[Scheduler] 📡 Bus hors-ligne : trajet ${trip.id}`);
      }
      stoppedSince.delete(trip.id);
      continue;
    }

    /* Bus en ligne → reset alerte hors-ligne */
    sentOffline.delete(trip.id);

    /* Bus arrêté : vitesse == 0 */
    if (speed === 0) {
      if (!stoppedSince.has(trip.id)) stoppedSince.set(trip.id, now);
      const stoppedMs = now - (stoppedSince.get(trip.id) ?? now);
      if (stoppedMs >= 2 * 60_000 && !sentStopAlert.has(trip.id)) {
        sentStopAlert.add(trip.id);
        for (const admin of adminsForCompany(trip.companyId)) {
          if (admin.pushToken) {
            await sendExpoPush(admin.pushToken, "🛑 Bus arrêté", `Bus ${trip.from}→${trip.to} immobile depuis 2 min`);
          }
          await db.insert(notificationsTable).values({
            id: nanoid(), userId: admin.id, type: "bus_stopped",
            title: "Bus arrêté",
            message: `Bus ${trip.from}→${trip.to} est immobile depuis plus de 2 minutes.`,
            refId: trip.id, refType: "trip",
          });
        }
        console.log(`[Scheduler] 🛑 Bus arrêté : trajet ${trip.id}`);
      }
    } else {
      stoppedSince.delete(trip.id);
      sentStopAlert.delete(trip.id);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   SIMULATION GPS — maintient trip-sim-001 actif dans le locationStore
   Simule le mouvement du bus Abidjan → Bouaké avec coordonnées réalistes
──────────────────────────────────────────────────────────────────────────── */
const SIM_TRIP_ID  = "trip-sim-001";
const SIM_AGENT_ID = "1773709474755uplf5hky7";

/* Points clés de la route Abidjan → Bouaké (approximation) */
const SIM_ROUTE = [
  { lat: 5.3480, lon: -4.0138, label: "Adjamé" },
  { lat: 5.5642, lon: -4.3251, label: "Anyama" },
  { lat: 6.0823, lon: -4.8102, label: "Tiassalé" },
  { lat: 6.4120, lon: -5.0340, label: "Yamoussoukro" },
  { lat: 6.8276, lon: -5.2893, label: "Toumodi" },
  { lat: 7.2351, lon: -5.5021, label: "Dimbokro" },
  { lat: 7.6919, lon: -5.0338, label: "Bouaké" },
];

let simRouteIdx = 2; /* démarrer au milieu du trajet pour paraître "en route" */
let simLat = SIM_ROUTE[simRouteIdx].lat;
let simLon = SIM_ROUTE[simRouteIdx].lon;

function advanceSimGps() {
  const target = SIM_ROUTE[Math.min(simRouteIdx + 1, SIM_ROUTE.length - 1)];
  const dLat = (target.lat - simLat) * 0.05;
  const dLon = (target.lon - simLon) * 0.05;
  simLat += dLat + (Math.random() - 0.5) * 0.002;
  simLon += dLon + (Math.random() - 0.5) * 0.002;

  const dist = Math.sqrt(
    Math.pow(simLat - target.lat, 2) + Math.pow(simLon - target.lon, 2)
  );
  if (dist < 0.01 && simRouteIdx < SIM_ROUTE.length - 2) simRouteIdx++;

  const speed = 70 + Math.random() * 20;

  locationStore.set(SIM_TRIP_ID, {
    tripId:    SIM_TRIP_ID,
    lat:       parseFloat(simLat.toFixed(5)),
    lon:       parseFloat(simLon.toFixed(5)),
    speed:     parseFloat(speed.toFixed(1)),
    heading:   315,
    updatedAt: Date.now(),
    agentId:   SIM_AGENT_ID,
  });
}

/* Initialiser immédiatement */
advanceSimGps();

/* Mettre à jour toutes les 30 secondes (synchronisé avec le scheduler principal) */
export function tickSimGps() {
  advanceSimGps();
}
