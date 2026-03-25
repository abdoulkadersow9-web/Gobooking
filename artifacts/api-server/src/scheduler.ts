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
import { eq, and, inArray, isNotNull } from "drizzle-orm";
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
