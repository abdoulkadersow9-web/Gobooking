/**
 * GoBooking — Marketing Automation Scheduler
 * Tourne toutes les heures :
 *  1. Re-engagement     — clients inactifs depuis > 7 jours → SMS promo -10%
 *  2. Post-voyage       — passager embarqué aujourd'hui → push "Merci"
 *  3. Bus peu rempli    — occupancy < 50% départ < 72h → SMS promo
 *  4. Anniversaire      — date de naissance = aujourd'hui → SMS
 *  5. Colis arrivé      — statut "arrivé" non encore notifié → push destinataire
 */

import { db, bookingsTable, tripsTable, usersTable, parcelsTable, notificationsTable, marketingLogsTable, agentsTable } from "@workspace/db";
import { eq, and, inArray, lt, gte, isNotNull, ne, sql } from "drizzle-orm";
import { sendExpoPush } from "./pushService";
import { sendSMS } from "./lib/smsService";

/* ─── Helpers ─────────────────────────────────────────────────── */
function nanoid(): string {
  return "mkt-" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

async function logMarketing(
  campaign: string, channel: string, userId: string | null,
  phone: string | null, message: string, status: "sent" | "failed" | "skipped",
  refId?: string, refType?: string
) {
  await db.insert(marketingLogsTable).values({
    id: nanoid(), campaign, channel, userId: userId ?? null,
    phone: phone ?? null, message, status,
    refId: refId ?? null, refType: refType ?? null,
  }).catch(() => {});
}

async function storePush(userId: string, type: string, title: string, message: string, refId?: string, refType?: string) {
  const id = nanoid();
  await db.insert(notificationsTable).values({
    id, userId, type, title, message,
    refId: refId ?? null, refType: refType ?? null,
  }).catch(() => {});
}

/* Dedup sets (in-memory, reset on restart) */
const sentReengagement   = new Set<string>(); // userId — resets daily on restart
const sentPostTrip       = new Set<string>(); // bookingId
const sentLowOccupancy   = new Set<string>(); // tripId
const sentBirthday       = new Set<string>(); // userId-YYYY-MM-DD
const sentStaffBirthday  = new Set<string>(); // agentId-YYYY-MM-DD
const sentHoliday        = new Set<string>(); // holiday-YYYY-MM-DD
const sentParcelArrived  = new Set<string>(); // parcelId

/* ─── Calendrier fêtes nationales Côte d'Ivoire (fixes) ──────── */
const IVOIRIAN_HOLIDAYS: { month: number; day: number; name: string; emoji: string }[] = [
  { month: 1,  day: 1,  name: "Bonne Année",                  emoji: "🎆" },
  { month: 5,  day: 1,  name: "Fête du Travail",              emoji: "👷" },
  { month: 8,  day: 7,  name: "Fête de l'Indépendance",       emoji: "🇨🇮" },
  { month: 8,  day: 15, name: "Fête de l'Assomption",         emoji: "✝️"  },
  { month: 11, day: 1,  name: "Toussaint",                    emoji: "🕯️" },
  { month: 11, day: 15, name: "Fête Nationale de la Paix",    emoji: "☮️" },
  { month: 12, day: 25, name: "Joyeux Noël",                  emoji: "🎄" },
];

/* ─── 1. Re-engagement — inactifs > 7 jours ─────────────────── */
async function checkReengagement() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Find users who haven't booked anything since cutoff
  const allUsers = await db.select({
    id: usersTable.id, name: usersTable.name, phone: usersTable.phone, pushToken: usersTable.pushToken,
  }).from(usersTable).where(eq(usersTable.status, "active"));

  const recentBookings = await db.select({ userId: bookingsTable.userId })
    .from(bookingsTable)
    .where(gte(bookingsTable.createdAt, cutoff));

  const recentUserIds = new Set(recentBookings.map(b => b.userId));

  let count = 0;
  for (const user of allUsers) {
    const dedup = `${user.id}-${todayStr}`;
    if (sentReengagement.has(dedup)) continue;
    if (recentUserIds.has(user.id)) continue; // active — skip

    sentReengagement.add(dedup);
    const msg = `Bonjour ${user.name.split(" ")[0]} ! 🚌 GoBooking vous offre -10% sur votre prochain trajet. Code : RETOUR10. Réservez maintenant !`;

    // SMS
    if (user.phone) {
      const smsResult = await sendSMS(user.phone, msg).catch(() => ({ success: false }));
      await logMarketing("reengagement", "sms", user.id, user.phone, msg,
        smsResult.success ? "sent" : "failed");
    }

    // Push
    if (user.pushToken) {
      sendExpoPush(user.pushToken, "🎁 Offre spéciale GoBooking", msg).catch(() => {});
    }
    await storePush(user.id, "marketing_reengagement", "🎁 Offre spéciale", msg);
    await logMarketing("reengagement", "push", user.id, null, msg, "sent");
    count++;
  }
  if (count > 0) console.log(`[Marketing] 📢 Re-engagement : ${count} client(s) contacté(s)`);
}

/* ─── 2. Post-voyage — embarqué aujourd'hui ─────────────────── */
async function checkPostTrip() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const boardedBookings = await db.select({
    id: bookingsTable.id, userId: bookingsTable.userId, tripId: bookingsTable.tripId,
  }).from(bookingsTable)
    .where(and(
      eq(bookingsTable.status, "boarded"),
      gte(bookingsTable.createdAt, since),
    ));

  let count = 0;
  for (const booking of boardedBookings) {
    if (sentPostTrip.has(booking.id)) continue;
    sentPostTrip.add(booking.id);

    const [user] = await db.select({ name: usersTable.name, phone: usersTable.phone, pushToken: usersTable.pushToken })
      .from(usersTable).where(eq(usersTable.id, booking.userId)).limit(1);
    if (!user) continue;

    const msg = `Merci d'avoir voyagé avec GoBooking, ${user.name.split(" ")[0]} ! 🙏 Votre avis compte — donnez-lui une note et gagnez 5 points fidélité.`;

    if (user.pushToken) {
      sendExpoPush(user.pushToken, "Bon voyage ! 🚌", msg).catch(() => {});
    }
    await storePush(booking.userId, "post_trip", "Bon voyage ! 🚌", msg, booking.id, "booking");
    await logMarketing("post_trip", "push", booking.userId, null, msg, "sent", booking.id, "booking");

    // SMS bonus
    if (user.phone) {
      const smsMsg = `GoBooking : Merci pour votre voyage ! Utilisez le code MERCI5 pour -5% sur la prochaine réservation.`;
      const smsResult = await sendSMS(user.phone, smsMsg).catch(() => ({ success: false }));
      await logMarketing("post_trip", "sms", booking.userId, user.phone, smsMsg,
        smsResult.success ? "sent" : "failed", booking.id, "booking");
    }
    count++;
  }
  if (count > 0) console.log(`[Marketing] ✈️  Post-voyage : ${count} client(s) remerciés`);
}

/* ─── 3. Bus peu rempli — occupancy < 50% dans les 72h ──────── */
async function checkLowOccupancy() {
  const now = new Date();
  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);
  const in72hStr = in72h.toISOString().slice(0, 10);

  const upcomingTrips = await db.select().from(tripsTable)
    .where(and(
      eq(tripsTable.status, "scheduled"),
      gte(tripsTable.date, todayStr),
      lt(tripsTable.date, in72hStr),
    ));

  for (const trip of upcomingTrips) {
    if (sentLowOccupancy.has(trip.id)) continue;

    const booked = await db.select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.tripId, trip.id),
        inArray(bookingsTable.status, ["confirmed", "boarded", "validated"]),
      ));

    const occupancy = trip.totalSeats > 0 ? booked.length / trip.totalSeats : 1;
    if (occupancy >= 0.5) continue;

    sentLowOccupancy.add(trip.id);
    const pctFilled = Math.round(occupancy * 100);
    const promoMsg = `🚌 GoBooking : Places disponibles ${trip.from} → ${trip.to} le ${trip.date} à ${trip.departureTime}. Seulement ${Math.round(trip.price * 0.9).toLocaleString("fr-FR")} FCFA (-10%). Réservez vite !`;

    // Notify users who have made past bookings (engaged users)
    const pastBookers = await db.select({ userId: bookingsTable.userId })
      .from(bookingsTable)
      .where(inArray(bookingsTable.status, ["confirmed", "boarded", "cancelled"]));

    const uniqueUserIds = [...new Set(pastBookers.map(b => b.userId))].slice(0, 50); // cap at 50

    if (uniqueUserIds.length > 0) {
      const users = await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, pushToken: usersTable.pushToken })
        .from(usersTable).where(inArray(usersTable.id, uniqueUserIds));

      for (const user of users) {
        if (user.pushToken) {
          sendExpoPush(user.pushToken, "🎟️ Promo départ imminent !", promoMsg).catch(() => {});
        }
        await storePush(user.id, "low_occupancy", "🎟️ Places dispo !", promoMsg, trip.id, "trip");
        if (user.phone) {
          await sendSMS(user.phone, promoMsg).catch(() => {});
        }
      }
      await logMarketing("low_occupancy", "both", null, null, promoMsg, "sent", trip.id, "trip");
      console.log(`[Marketing] 🎟️  Bus peu rempli ${trip.from}→${trip.to} (${pctFilled}%) : ${users.length} notifié(s)`);
    }
  }
}

/* ─── 4. Anniversaires ───────────────────────────────────────── */
async function checkBirthdays() {
  const now = new Date();
  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const yearStr = now.getFullYear().toString();
  const dedupKey = `${mmdd}-${yearStr}`;

  // Find users whose birthdate month-day matches today (birthdate stored as YYYY-MM-DD)
  const allUsers = await db.select({
    id: usersTable.id, name: usersTable.name, phone: usersTable.phone,
    pushToken: usersTable.pushToken, birthdate: usersTable.birthdate,
  }).from(usersTable).where(isNotNull(usersTable.birthdate));

  let count = 0;
  for (const user of allUsers) {
    if (!user.birthdate) continue;
    const bd = typeof user.birthdate === "string" ? user.birthdate : (user.birthdate as Date).toISOString().slice(0, 10);
    const userMmdd = bd.slice(5); // MM-DD
    if (userMmdd !== mmdd) continue;

    const key = `${user.id}-${dedupKey}`;
    if (sentBirthday.has(key)) continue;
    sentBirthday.add(key);

    const firstName = user.name.split(" ")[0];
    const msg = `Joyeux anniversaire ${firstName} ! 🎉🎂 GoBooking vous offre 50 points fidélité en cadeau. Profitez d'une réduction exclusive ce mois-ci. Bon voyage !`;

    if (user.phone) {
      const smsResult = await sendSMS(user.phone, msg).catch(() => ({ success: false }));
      await logMarketing("birthday", "sms", user.id, user.phone, msg,
        smsResult.success ? "sent" : "failed");
    }
    if (user.pushToken) {
      sendExpoPush(user.pushToken, "🎂 Joyeux Anniversaire !", msg).catch(() => {});
    }
    await storePush(user.id, "birthday", "🎂 Joyeux Anniversaire !", msg);
    await logMarketing("birthday", "push", user.id, null, msg, "sent");
    count++;
  }
  if (count > 0) console.log(`[Marketing] 🎂 Anniversaires : ${count} client(s) félicité(s)`);
}

/* ─── 5. Colis arrivé — notifier le destinataire ────────────── */
async function checkParcelArrived() {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // parcel arrived in last 2h

  const arrivedParcels = await db.select({
    id: parcelsTable.id, trackingRef: parcelsTable.trackingRef,
    receiverName: parcelsTable.receiverName, receiverPhone: parcelsTable.receiverPhone,
    userId: parcelsTable.userId, fromCity: parcelsTable.fromCity, toCity: parcelsTable.toCity,
    statusUpdatedAt: parcelsTable.statusUpdatedAt,
  }).from(parcelsTable)
    .where(and(
      eq(parcelsTable.status, "arrivé"),
      isNotNull(parcelsTable.statusUpdatedAt),
    ));

  let count = 0;
  for (const parcel of arrivedParcels) {
    if (sentParcelArrived.has(parcel.id)) continue;

    // Only process if statusUpdatedAt is recent (within 2h)
    const updatedAt = parcel.statusUpdatedAt ? new Date(parcel.statusUpdatedAt) : null;
    if (!updatedAt || updatedAt < since) continue;

    sentParcelArrived.add(parcel.id);

    const msg = `GoBooking 📦 Votre colis (${parcel.trackingRef}) est arrivé à ${parcel.toCity} ! Venez le retirer à la gare routière. Merci.`;

    // SMS to receiver
    if (parcel.receiverPhone) {
      const smsResult = await sendSMS(parcel.receiverPhone, msg).catch(() => ({ success: false }));
      await logMarketing("parcel_arrived", "sms", parcel.userId, parcel.receiverPhone, msg,
        smsResult.success ? "sent" : "failed", parcel.id, "parcel");
    }

    // Push to sender (userId)
    const [sender] = await db.select({ pushToken: usersTable.pushToken })
      .from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);

    if (sender?.pushToken) {
      const pushMsg = `Votre colis ${parcel.trackingRef} est arrivé à ${parcel.toCity}. Le destinataire a été notifié.`;
      sendExpoPush(sender.pushToken, "📦 Colis arrivé !", pushMsg).catch(() => {});
      await storePush(parcel.userId, "parcel_arrived", "📦 Colis arrivé !", pushMsg, parcel.id, "parcel");
      await logMarketing("parcel_arrived", "push", parcel.userId, null, pushMsg, "sent", parcel.id, "parcel");
    }
    count++;
  }
  if (count > 0) console.log(`[Marketing] 📦 Colis arrivés : ${count} destinataire(s) notifié(s)`);
}

/* ─── 6. Anniversaires du personnel (agents) ─────────────────── */
async function checkStaffBirthdays() {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = today.toISOString().slice(0, 10);

  const staffResult = await db.execute(
    sql`
      SELECT a.id as agent_id, u.id as user_id, u.name, u.phone, u.push_token, u.birthdate
      FROM agents a
      JOIN users u ON u.id = a.user_id
      WHERE u.birthdate IS NOT NULL
        AND TO_CHAR(u.birthdate, 'MM-DD') = ${`${mm}-${dd}`}
        AND u.status = 'active'
    `
  );

  let count = 0;
  for (const staff of (staffResult.rows as any[])) {
    const key = `${staff.agent_id}-${todayStr}`;
    if (sentStaffBirthday.has(key)) continue;
    sentStaffBirthday.add(key);

    const firstName = staff.name.split(" ")[0];
    const msg = `GoBooking 🎂 Toute l'équipe vous souhaite un joyeux anniversaire, ${firstName} ! Merci pour votre engagement et votre dévouement. Bonne fête !`;

    if (staff.phone) {
      const smsResult = await sendSMS(staff.phone, msg).catch(() => ({ success: false }));
      await logMarketing("staff_birthday", "sms", staff.user_id, staff.phone, msg,
        smsResult.success ? "sent" : "failed");
    }

    if (staff.push_token) {
      sendExpoPush(staff.push_token, `🎂 Joyeux anniversaire ${firstName} !`, msg).catch(() => {});
      await storePush(staff.user_id, "staff_birthday", `🎂 Joyeux anniversaire !`, msg);
    }
    count++;
  }
  if (count > 0) console.log(`[Marketing] 🎂 Anniversaires personnel : ${count} agent(s) souhaité(s)`);
}

/* ─── 7. Fêtes nationales ivoiriennes ───────────────────────── */
async function checkIvoirianHolidays() {
  const today = new Date();
  const monthDay = today.getMonth() + 1; // 1-12
  const dayOfMonth = today.getDate();
  const todayStr = today.toISOString().slice(0, 10);

  const holiday = IVOIRIAN_HOLIDAYS.find(h => h.month === monthDay && h.day === dayOfMonth);
  if (!holiday) return;

  const key = `${holiday.name}-${todayStr}`;
  if (sentHoliday.has(key)) return;
  sentHoliday.add(key);

  const holidayMsg = `${holiday.emoji} GoBooking vous souhaite une belle fête de la ${holiday.name} ! Nos équipes sont à votre service toute la journée. Bon voyage !`;

  // Envoyer aux clients actifs ayant voyagé au cours des 60 derniers jours
  const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const recentUsers = await db.execute(
    sql`
      SELECT DISTINCT u.id, u.name, u.phone, u.push_token
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      WHERE b.created_at >= ${since60.toISOString()}
        AND b.status IN ('confirmed','boarded','validated','completed')
        AND u.status = 'active'
      LIMIT 200
    `
  );

  let count = 0;
  for (const u of (recentUsers.rows as any[])) {
    if (u.phone) {
      sendSMS(u.phone, holidayMsg).catch(() => {});
      await logMarketing("holiday", "sms", u.id, u.phone, holidayMsg, "sent");
    }
    if (u.push_token) {
      sendExpoPush(u.push_token, `${holiday.emoji} ${holiday.name}`, holidayMsg).catch(() => {});
      await storePush(u.id, "holiday", `${holiday.emoji} ${holiday.name}`, holidayMsg);
    }
    count++;
  }

  // Notifier aussi les agents
  const staffUsers = await db.execute(
    sql`
      SELECT DISTINCT u.id, u.name, u.phone, u.push_token
      FROM agents a JOIN users u ON u.id = a.user_id
      WHERE u.status = 'active'
    `
  );
  const staffMsg = `${holiday.emoji} Bonne fête de la ${holiday.name} à toute l'équipe GoBooking ! Continuez à faire la fierté du transport ivoirien. 🚌`;
  for (const s of (staffUsers.rows as any[])) {
    if (s.push_token) sendExpoPush(s.push_token, `${holiday.emoji} ${holiday.name}`, staffMsg).catch(() => {});
    await storePush(s.id, "holiday_staff", `${holiday.emoji} ${holiday.name}`, staffMsg);
    count++;
  }

  console.log(`[Marketing] ${holiday.emoji} Fête nationale "${holiday.name}" — ${count} personnes notifiées`);
}

/* ─── Orchestrateur principal ────────────────────────────────── */
async function runMarketing() {
  try { await checkReengagement();       } catch (err) { console.error("[Marketing] ❌ Re-engagement:", err); }
  try { await checkPostTrip();           } catch (err) { console.error("[Marketing] ❌ Post-voyage:", err); }
  try { await checkLowOccupancy();       } catch (err) { console.error("[Marketing] ❌ Occupancy:", err); }
  try { await checkBirthdays();          } catch (err) { console.error("[Marketing] ❌ Anniversaires clients:", err); }
  try { await checkStaffBirthdays();     } catch (err) { console.error("[Marketing] ❌ Anniversaires personnel:", err); }
  try { await checkIvoirianHolidays();   } catch (err) { console.error("[Marketing] ❌ Fêtes nationales CI:", err); }
  try { await checkParcelArrived();      } catch (err) { console.error("[Marketing] ❌ Colis arrivés:", err); }
}

/* ─── Export ─────────────────────────────────────────────────── */
export function startMarketingScheduler(intervalMs = 60 * 60 * 1000) {
  console.log(`[Marketing] 🚀 Scheduler démarré — vérification toutes les ${intervalMs / 60_000} min`);
  runMarketing(); // run immediately at startup
  setInterval(runMarketing, intervalMs);
}
