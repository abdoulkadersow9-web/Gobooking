import { Router, type IRouter } from "express";
import { db, usersTable, agentsTable, agencesTable, busesTable, bookingsTable, parcelsTable, seatsTable, tripsTable, positionsTable, busPositionsTable, boardingRequestsTable, scansTable, agentAlertsTable, colisLogsTable, departuresTable, agentReportsTable, bagageItemsTable, tripExpensesTable, notificationsTable, tripWaypointsTable } from "@workspace/db";
import { auditLog, ACTIONS } from "../audit";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { tokenStore } from "./auth";
import { locationStore, pruneStale } from "../locationStore";
import { requestStore, requestsForTrip, newRequestId, pruneOldRequests, type TripRequest } from "../requestStore";
import { sendExpoPush } from "../pushService";
import { calculateParcelPrice } from "./parcels";
import { awardPoints, POINTS_PER_TRIP } from "./loyalty";
import { sendParcelNotification } from "../notificationService";
import { sendSMS } from "../lib/smsService";

const router: IRouter = Router();

/* ── Colis log helper ───────────────────────────────────────────────────────
   Insert an event into colis_logs whenever a parcel status changes.
─────────────────────────────────────────────────────────────────────────── */
/* ── Location helper ─────────────────────────────────────────────────────── */
function getLocationForStatus(status: string, fromCity: string, toCity: string): string {
  switch (status) {
    case "créé":       return `Agence de ${fromCity}`;
    case "en_attente": return `Agence de ${fromCity}`;
    case "en_gare":    return `Gare de ${fromCity}`;
    case "chargé_bus": return `En route vers ${toCity}`;
    case "en_transit": return `En transit`;
    case "arrivé":     return `Agence de ${toCity}`;
    case "livré":      return `Livré à ${toCity}`;
    default:           return fromCity;
  }
}

async function logColisAction(opts: {
  colisId:     string;
  trackingRef: string | null | undefined;
  action:      string;
  agentId:     string;
  agentName:   string;
  companyId:   string | null | undefined;
  notes?:      string;
}) {
  try {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await db.insert(colisLogsTable).values({
      id,
      colisId:     opts.colisId,
      trackingRef: opts.trackingRef ?? null,
      action:      opts.action,
      agentId:     opts.agentId,
      agentName:   opts.agentName,
      companyId:   opts.companyId ?? null,
      notes:       opts.notes ?? null,
    } as any);
  } catch (e) {
    console.error("[colisLog] error:", e);
  }
}

/* ── recordTripAgent — enregistre l'agent en service sur un départ ──────────
   Upsert dans trip_agents : si l'agent a déjà été enregistré sur ce trajet,
   met à jour rôle/contact (car un agent peut changer de poste en cours de journée).
   Appelé silencieusement (.catch(() => {})) → ne bloque jamais la réponse principale.
─────────────────────────────────────────────────────────────────────────── */
async function recordTripAgent(
  tripId: string | null | undefined,
  userId: number | string | null | undefined,
) {
  if (!tripId || !userId) return;
  try {
    const uid = String(userId); // IDs are text in the DB

    /* Récupère rôle + agence de l'agent via raw SQL (IDs textuels) */
    const agentRows = await db.execute(sql`
      SELECT a.agent_role, a.agence_id, ag.name as agence_name, ag.city as agence_city
      FROM agents a
      LEFT JOIN agences ag ON ag.id = a.agence_id
      WHERE a.user_id = ${uid}
      LIMIT 1
    `) as any;
    const agentRow  = agentRows?.rows?.[0];
    const agentRole = agentRow?.agent_role ?? "agent";
    const agenceId  = agentRow?.agence_id   ?? null;
    const agenceName = agentRow?.agence_name ?? null;
    const agenceCity = agentRow?.agence_city ?? null;

    const photoRow = await db.execute(sql`SELECT name, phone, email, photo_url FROM users WHERE id = ${uid} LIMIT 1`) as any;
    const userRow = photoRow?.rows?.[0];
    const name    = userRow?.name  ?? "Inconnu";
    const contact = (userRow?.phone && userRow.phone.trim()) ? userRow.phone.trim()
                  : (userRow?.email && userRow.email.trim()) ? userRow.email.trim()
                  : "";
    const photoUrl = userRow?.photo_url ?? null;

    await db.execute(sql`
      INSERT INTO trip_agents (trip_id, user_id, agent_role, name, contact, agence_id, agence_name, agence_city, photo_url)
      VALUES (${tripId}, ${uid}, ${agentRole}, ${name}, ${contact}, ${agenceId}, ${agenceName}, ${agenceCity}, ${photoUrl})
      ON CONFLICT (trip_id, user_id)
      DO UPDATE SET
        agent_role  = EXCLUDED.agent_role,
        name        = EXCLUDED.name,
        contact     = EXCLUDED.contact,
        agence_id   = EXCLUDED.agence_id,
        agence_name = EXCLUDED.agence_name,
        agence_city = EXCLUDED.agence_city,
        photo_url   = EXCLUDED.photo_url,
        recorded_at = NOW()
    `);
  } catch (e) {
    console.error("[recordTripAgent]", e);
  }
}

async function requireAgent(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length || !["admin", "agent"].includes(users[0].role)) return null;
  if (users[0].status === "inactive") return null;
  return users[0];
}

router.get("/info", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agent = agents[0];
    if (!agent) { res.status(404).json({ error: "Agent profile not found" }); return; }

    let bus = null;
    if (agent.busId) {
      const buses = await db.select().from(busesTable).where(eq(busesTable.id, agent.busId)).limit(1);
      bus = buses[0] || null;
    }

    const photoUrlRow = await db.execute(
      sql`SELECT photo_url FROM users WHERE id = ${user.id} LIMIT 1`
    ) as any;
    const photoUrl = photoUrlRow?.rows?.[0]?.photo_url ?? null;

    res.json({ agent, user: { id: user.id, name: user.name, email: user.email, photoUrl }, bus });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /agent/profile/photo — upload photo de profil agent ── */
router.post("/profile/photo", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { photoBase64 } = req.body;
    if (!photoBase64 || typeof photoBase64 !== "string" || photoBase64.length < 100) {
      res.status(400).json({ error: "Photo manquante ou invalide" });
      return;
    }

    const { uploadProfilePhoto } = await import("../lib/photoStorage");
    const photoUrl = await uploadProfilePhoto(photoBase64, user.id);
    if (!photoUrl) {
      res.status(500).json({ error: "Échec de l'upload de la photo" });
      return;
    }

    await db.execute(sql`UPDATE users SET photo_url = ${photoUrl} WHERE id = ${user.id}`);

    res.json({ success: true, photoUrl });
  } catch (err) {
    console.error("POST /agent/profile/photo error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/boarding", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRecord = agents[0];

    let bookings;
    if (agentRecord?.tripId) {
      bookings = await db.select().from(bookingsTable)
        .where(eq(bookingsTable.tripId, agentRecord.tripId))
        .orderBy(desc(bookingsTable.createdAt));
    } else {
      bookings = await db.select().from(bookingsTable)
        .orderBy(desc(bookingsTable.createdAt));
    }

    res.json(bookings.map(b => ({
      id: b.id,
      bookingRef: b.bookingRef,
      passengers: b.passengers,
      seatNumbers: b.seatNumbers,
      status: b.status,
      totalAmount: b.totalAmount,
      createdAt: b.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/boarding/:bookingId/validate", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const bookingId = req.params.bookingId;
    await db.update(bookingsTable).set({ status: "validated" }).where(eq(bookingsTable.id, bookingId));
    // Récupérer le tripId de la réservation pour enregistrer l'agent embarquement
    const bRows = await db.select({ tripId: bookingsTable.tripId }).from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    recordTripAgent(bRows[0]?.tripId, user.id).catch(() => {});
    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.BOOKING_BOARD, bookingId, "booking").catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── PARCEL MANAGEMENT — Gestion professionnelle des colis ──────────────── */

const PARCEL_STATUSES = ["créé", "en_gare", "chargé_bus", "en_transit", "arrivé", "livré", "annulé"] as const;
type ParcelStatus = typeof PARCEL_STATUSES[number];

async function getAgentCompany(userId: string) {
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, userId)).limit(1);
  return agents[0] ?? null;
}

async function getParcelAndCheckAccess(parcelId: string, agentCompanyId: string | null | undefined) {
  const rows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, parcelId)).limit(1);
  if (!rows.length) return { error: "Colis introuvable", parcel: null };
  const parcel = rows[0];
  if (agentCompanyId && parcel.companyId && parcel.companyId !== agentCompanyId) {
    return { error: "Accès refusé — ce colis appartient à une autre compagnie", parcel: null };
  }
  return { error: null, parcel };
}

/* GET /agent/parcels — list company's parcels (with optional status filter) */
router.get("/parcels", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRecord = await getAgentCompany(user.id);
    const companyId = agentRecord?.companyId ?? null;

    const parcels = companyId
      ? await db.select().from(parcelsTable)
          .where(eq(parcelsTable.companyId, companyId))
          .orderBy(desc(parcelsTable.createdAt))
      : await db.select().from(parcelsTable).orderBy(desc(parcelsTable.createdAt));

    const { status } = req.query;
    const filtered = status ? parcels.filter(p => p.status === status) : parcels;

    res.json(filtered);
  } catch (err) {
    console.error("GET /agent/parcels error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* GET /agent/parcels/by-bus/:busId — parcels loaded on a specific bus */
router.get("/parcels/by-bus/:busId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRecord = await getAgentCompany(user.id);
    const companyId = agentRecord?.companyId ?? null;

    const parcels = await db.select().from(parcelsTable)
      .where(eq(parcelsTable.busId, req.params.busId))
      .orderBy(desc(parcelsTable.createdAt));

    const filtered = companyId ? parcels.filter(p => !p.companyId || p.companyId === companyId) : parcels;
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels — agent creates a parcel (status: "créé") */
router.post("/parcels", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRecord = await getAgentCompany(user.id);
    const {
      senderName, senderPhone, receiverName, receiverPhone,
      fromCity, toCity, parcelType, weight, description,
      deliveryType, paymentMethod, notes, amount: customAmount,
      photoBase64,
    } = req.body;

    if (!senderName || !senderPhone || !receiverName || !receiverPhone ||
        !fromCity || !toCity || !parcelType || !deliveryType) {
      res.status(400).json({ error: "Champs obligatoires manquants" });
      return;
    }

    const parsedWeight = weight ? parseFloat(weight) : 1;
    const calculatedAmount = calculateParcelPrice(fromCity, toCity, isNaN(parsedWeight) ? 1 : parsedWeight, deliveryType);
    const amount = (customAmount && parseFloat(customAmount) > 0) ? parseFloat(customAmount) : calculatedAmount;
    const commissionAmount = Math.round(amount * 0.05);

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let part1 = "", part2 = "";
    for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
    const trackingRef = `GBX-${part1}-${part2}`;

    /* Generate a 4-digit secure pickup code for the receiver */
    const pickupCode = String(Math.floor(1000 + Math.random() * 9000));

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const parcel = await db.insert(parcelsTable).values({
      id, trackingRef, userId: user.id,
      senderName, senderPhone, receiverName, receiverPhone,
      fromCity, toCity, parcelType,
      weight: isNaN(parsedWeight) ? 1 : parsedWeight,
      description: description || null,
      deliveryType, amount, commissionAmount,
      paymentMethod: paymentMethod || "orange",
      paymentStatus: "paid",
      status: "créé",
      companyId: agentRecord?.companyId ?? null,
      notes: notes || null,
      createdByAgent: true,
    } as any).returning();

    /* Upload photo if provided */
    if (photoBase64 && typeof photoBase64 === "string" && photoBase64.length > 100) {
      const { uploadParcelPhoto } = await import("../lib/photoStorage");
      const photoUrl = await uploadParcelPhoto(photoBase64, parcel[0].id);
      if (photoUrl) {
        await db.execute(sql`UPDATE parcels SET photo_url = ${photoUrl} WHERE id = ${parcel[0].id}`);
        (parcel[0] as any).photoUrl = photoUrl;
      }
    }

    /* Store pickup code */
    await db.execute(sql`UPDATE parcels SET pickup_code = ${pickupCode}, pickup_code_sent_at = NOW(), created_by_agent = true WHERE id = ${parcel[0].id}`);

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_CREATE, parcel[0].id, "parcel",
      { trackingRef, fromCity, toCity, weight, amount }).catch(() => {});

    const locCree = getLocationForStatus("créé", fromCity, toCity);
    await db.update(parcelsTable).set({ location: locCree } as any).where(eq(parcelsTable.id, parcel[0].id));
    logColisAction({
      colisId: parcel[0].id, trackingRef,
      action: "créé", agentId: user.id, agentName: user.name,
      companyId: agentRecord?.companyId, notes: locCree,
    }).catch(() => {});

    /* SMS to sender with tracking ref */
    sendSMS(senderPhone,
      `📦 GoBooking : Colis ${trackingRef} enregistré de ${fromCity} → ${toCity}. Montant : ${amount.toLocaleString()} FCFA. Suivez votre colis sur l'app GoBooking.`
    ).catch(() => {});

    /* SMS to receiver with pickup code */
    sendSMS(receiverPhone,
      `📦 GoBooking : Un colis vous est envoyé (${trackingRef}) de ${fromCity} vers ${toCity}. Code de retrait sécurisé : ${pickupCode}. Conservez ce code pour retirer votre colis en gare.`
    ).catch(() => {});

    res.status(201).json({ ...parcel[0], pickupCode });
  } catch (err) {
    console.error("Agent create parcel error:", err);
    res.status(500).json({ error: "Échec de la création du colis" });
  }
});

/* POST /agent/parcels/:id/resend-pickup-code — resend pickup code by SMS */
router.post("/parcels/:parcelId/resend-pickup-code", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const rows = await db.execute(sql`SELECT id, tracking_ref, receiver_name, receiver_phone, pickup_code, from_city, to_city, status FROM parcels WHERE id = ${req.params.parcelId} LIMIT 1`);
    const parcel = (rows as any).rows?.[0];
    if (!parcel) { res.status(404).json({ error: "Colis introuvable" }); return; }

    if (parcel.status === "retiré" || parcel.status === "livré") {
      res.status(400).json({ error: "Ce colis a déjà été retiré ou livré" });
      return;
    }

    /* Generate new code if none exists */
    let code = parcel.pickup_code;
    if (!code) {
      code = String(Math.floor(1000 + Math.random() * 9000));
      await db.execute(sql`UPDATE parcels SET pickup_code = ${code}, pickup_code_sent_at = NOW() WHERE id = ${parcel.id}`);
    } else {
      await db.execute(sql`UPDATE parcels SET pickup_code_sent_at = NOW() WHERE id = ${parcel.id}`);
    }

    await sendSMS(parcel.receiver_phone,
      `📦 GoBooking : Rappel — Code de retrait pour le colis ${parcel.tracking_ref} de ${parcel.from_city} → ${parcel.to_city} : ${code}. Présentez ce code en gare pour retirer votre colis.`
    );

    res.json({ success: true, message: `SMS renvoyé au ${parcel.receiver_phone}` });
  } catch (err) {
    console.error("Resend pickup code error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/en-gare — parcel arrives at departure station */
router.post("/parcels/:parcelId/en-gare", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    const locEnGare = getLocationForStatus("en_gare", parcel.fromCity, parcel.toCity);
    await db.update(parcelsTable).set({ status: "en_gare", statusUpdatedAt: new Date(), location: locEnGare } as any)
      .where(eq(parcelsTable.id, parcel.id));

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_STATUS, parcel.id, "parcel", { status: "en_gare", trackingRef: parcel.trackingRef }).catch(() => {});
    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef, action: "en_gare",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId, notes: locEnGare }).catch(() => {});
    if (parcel.userId) {
      const uRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
      sendParcelNotification({ userId: parcel.userId, pushToken: uRows[0]?.pushToken, status: "en_gare",
        trackingRef: parcel.trackingRef ?? "", fromCity: parcel.fromCity, toCity: parcel.toCity }).catch(() => {});
    }
    res.json({ success: true, status: "en_gare" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/charge-bus — load parcel onto bus */
router.post("/parcels/:parcelId/charge-bus", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);

    const { busId, tripId } = req.body;
    const effectiveBusId = busId || agentRecord?.busId || null;
    const effectiveTripId = tripId || agentRecord?.tripId || null;

    if (!effectiveBusId) {
      res.status(400).json({ error: "busId requis pour charger dans un bus" });
      return;
    }

    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    await db.update(parcelsTable)
      .set({ status: "chargé_bus", busId: effectiveBusId, tripId: effectiveTripId, statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, parcel.id));

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_STATUS, parcel.id, "parcel",
      { status: "chargé_bus", busId: effectiveBusId, tripId: effectiveTripId, trackingRef: parcel.trackingRef }).catch(() => {});
    const locCharge = getLocationForStatus("chargé_bus", parcel.fromCity, parcel.toCity);
    await db.update(parcelsTable).set({ location: locCharge } as any).where(eq(parcelsTable.id, parcel.id));
    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef, action: "chargé_bus",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId,
      notes: locCharge }).catch(() => {});
    if (effectiveTripId) recordTripAgent(effectiveTripId, user.id).catch(() => {});
    res.json({ success: true, status: "chargé_bus", busId: effectiveBusId, tripId: effectiveTripId });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/arrive — old endpoint still supported via parcels route */
router.post("/parcels/:parcelId/arrive", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    await db.update(parcelsTable).set({ status: "arrivé", statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, parcel.id));

    const locArrive = getLocationForStatus("arrivé", parcel.fromCity, parcel.toCity);
    await db.update(parcelsTable).set({ location: locArrive } as any).where(eq(parcelsTable.id, parcel.id));

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_STATUS, parcel.id, "parcel", { status: "arrivé", trackingRef: parcel.trackingRef }).catch(() => {});
    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef, action: "arrivé",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId, notes: locArrive }).catch(() => {});
    if (parcel.userId) {
      const uRows2 = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
      sendParcelNotification({ userId: parcel.userId, pushToken: uRows2[0]?.pushToken, status: "arrivé",
        trackingRef: parcel.trackingRef ?? "", fromCity: parcel.fromCity, toCity: parcel.toCity }).catch(() => {});
    }
    res.json({ success: true, status: "arrivé" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/pickup — pris en charge (kept for backward compat) */
router.post("/parcels/:parcelId/pickup", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const pRows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, req.params.parcelId)).limit(1);
    const p = pRows[0] as any;
    const locTransit = getLocationForStatus("en_transit", p?.fromCity ?? "", p?.toCity ?? "");
    await db.update(parcelsTable).set({ status: "en_transit", statusUpdatedAt: new Date(), location: locTransit } as any)
      .where(eq(parcelsTable.id, req.params.parcelId));
    logColisAction({ colisId: req.params.parcelId, trackingRef: p?.trackingRef ?? null, action: "en_transit",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId, notes: locTransit }).catch(() => {});
    if (p?.userId) {
      const uRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      sendParcelNotification({ userId: p.userId, pushToken: uRows[0]?.pushToken, status: "en_transit",
        trackingRef: p.trackingRef ?? "", fromCity: p.fromCity, toCity: p.toCity }).catch(() => {});
    }
    res.json({ success: true, status: "en_transit" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/transit */
router.post("/parcels/:parcelId/transit", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const pRows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, req.params.parcelId)).limit(1);
    const p = pRows[0] as any;
    const locTransit2 = getLocationForStatus("en_transit", p?.fromCity ?? "", p?.toCity ?? "");
    await db.update(parcelsTable).set({ status: "en_transit", statusUpdatedAt: new Date(), location: locTransit2 } as any)
      .where(eq(parcelsTable.id, req.params.parcelId));
    logColisAction({ colisId: req.params.parcelId, trackingRef: p?.trackingRef ?? null, action: "en_transit",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId, notes: locTransit2 }).catch(() => {});
    if (p?.userId) {
      const uRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      sendParcelNotification({ userId: p.userId, pushToken: uRows[0]?.pushToken, status: "en_transit",
        trackingRef: p.trackingRef ?? "", fromCity: p.fromCity, toCity: p.toCity }).catch(() => {});
    }
    res.json({ success: true, status: "en_transit" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/deliver — livré */
router.post("/parcels/:parcelId/deliver", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    await db.update(parcelsTable).set({ status: "livré", statusUpdatedAt: new Date() } as any)
      .where(eq(parcelsTable.id, parcel.id));

    const locLivre = getLocationForStatus("livré", parcel.fromCity, parcel.toCity);
    await db.update(parcelsTable).set({ location: locLivre } as any).where(eq(parcelsTable.id, parcel.id));

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.PARCEL_STATUS, parcel.id, "parcel", { status: "livré", trackingRef: parcel.trackingRef }).catch(() => {});
    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef, action: "livré",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId, notes: locLivre }).catch(() => {});
    if (parcel.userId) {
      const uRowsL = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
      sendParcelNotification({ userId: parcel.userId, pushToken: uRowsL[0]?.pushToken, status: "livré",
        trackingRef: parcel.trackingRef ?? "", fromCity: parcel.fromCity, toCity: parcel.toCity,
        receiverName: parcel.receiverName }).catch(() => {});
    }
    res.json({ success: true, status: "livré" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/retirer — client picks up parcel at station (requires pickup code) */
router.post("/parcels/:parcelId/retirer", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    /* Validate pickup code if one exists */
    const pickupCodeRow = await db.execute(sql`SELECT pickup_code FROM parcels WHERE id = ${parcel.id} LIMIT 1`);
    const storedCode = (pickupCodeRow as any).rows?.[0]?.pickup_code;
    const { pickupCode } = req.body;

    if (storedCode) {
      if (!pickupCode) {
        res.status(400).json({ error: "Code de retrait requis", requiresCode: true });
        return;
      }
      if (String(pickupCode).trim() !== String(storedCode).trim()) {
        res.status(400).json({ error: "Code de retrait incorrect. Vérifiez le SMS envoyé au destinataire.", requiresCode: true, invalidCode: true });
        return;
      }
    }

    await db.update(parcelsTable).set({ status: "retiré", statusUpdatedAt: new Date(),
      location: `Retiré à la gare de ${parcel.toCity}` } as any)
      .where(eq(parcelsTable.id, parcel.id));

    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef ?? null, action: "retiré",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId,
      notes: `Retiré à la gare de ${parcel.toCity} — validé par ${user.name}` }).catch(() => {});

    /* SMS confirmation to receiver */
    sendSMS(parcel.receiverPhone,
      `✅ GoBooking : Votre colis ${parcel.trackingRef} a été retiré avec succès à la gare de ${parcel.toCity}. Merci d'avoir utilisé GoBooking !`
    ).catch(() => {});

    if (parcel.userId) {
      const uRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
      sendParcelNotification({ userId: parcel.userId, pushToken: uRows[0]?.pushToken, status: "retiré",
        trackingRef: parcel.trackingRef ?? "", fromCity: parcel.fromCity, toCity: parcel.toCity,
        receiverName: parcel.receiverName }).catch(() => {});
    }
    res.json({ success: true, status: "retiré" });
  } catch (err) {
    console.error("Agent retirer parcel error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/parcels/:id/lancer-livraison — agent starts home delivery */
router.post("/parcels/:parcelId/lancer-livraison", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const agentRecord = await getAgentCompany(user.id);
    const { error, parcel } = await getParcelAndCheckAccess(req.params.parcelId, agentRecord?.companyId);
    if (error || !parcel) { res.status(error === "Colis introuvable" ? 404 : 403).json({ error }); return; }

    await db.update(parcelsTable).set({ status: "en_livraison", statusUpdatedAt: new Date(),
      location: `En livraison à ${parcel.toCity}` } as any)
      .where(eq(parcelsTable.id, parcel.id));

    logColisAction({ colisId: parcel.id, trackingRef: parcel.trackingRef ?? null, action: "en_livraison",
      agentId: user.id, agentName: user.name, companyId: agentRecord?.companyId,
      notes: `Livraison lancée vers ${parcel.toCity}` }).catch(() => {});
    res.json({ success: true, status: "en_livraison" });
  } catch (err) {
    console.error("Agent lancer-livraison error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* POST /agent/reservations — agent guichet creates a ticket booking */
router.post("/reservations", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { clientName, clientPhone, tripId, seatCount, paymentMethod, boardingCity, alightingCity } = req.body as {
      clientName: string; clientPhone: string; tripId: string;
      seatCount: number; paymentMethod: string;
      boardingCity?: string; alightingCity?: string;
    };

    if (!clientName?.trim() || !tripId || !seatCount) {
      res.status(400).json({ error: "Champs obligatoires manquants (clientName, tripId, seatCount)" }); return;
    }

    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = trips[0];

    const count = Math.max(1, Math.min(10, Number(seatCount) || 1));

    /* ── Segment-aware capacity check ───────────────────────────────────── */
    const bCity = boardingCity?.trim()  || trip.fromCity;
    const aCity = alightingCity?.trim() || trip.toCity;

    if (trip.guichetSeats > 0) {
      let usedGuichet = 0;

      if (bCity !== trip.fromCity || aCity !== trip.toCity) {
        /* Segment partiel → comptage par chevauchement */
        const waypoints = await getOrCreateWaypoints(tripId);
        const bWp = waypoints.find(w => w.city === bCity);
        const aWp = waypoints.find(w => w.city === aCity);
        if (bWp && aWp && bWp.stopOrder < aWp.stopOrder) {
          usedGuichet = await countSegmentOccupancy(tripId, bWp.stopOrder, aWp.stopOrder);
        }
      } else {
        const guichetBookings = await db.select().from(bookingsTable).where(and(
          eq(bookingsTable.tripId, tripId),
          eq(bookingsTable.bookingSource, "guichet"),
          inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé"])
        ));
        usedGuichet = guichetBookings.reduce(
          (acc, b) => acc + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length || 1 : 1), 0
        );
      }

      if (usedGuichet + count > trip.guichetSeats) {
        res.status(400).json({
          error: `Plus de places guichet disponibles. Places restantes sur ce segment : ${Math.max(0, trip.guichetSeats - usedGuichet)}`,
          placesRestantes: Math.max(0, trip.guichetSeats - usedGuichet),
        });
        return;
      }
    }

    const amount = trip.price * count;
    const ref    = "GB" + Math.random().toString(36).toUpperCase().substr(2, 8);
    const id     = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const passengers = Array.from({ length: count }, (_, i) =>
      i === 0 ? { name: clientName.trim() } : { name: `Passager ${i + 1}` }
    );

    // Auto-assigner des sièges disponibles
    let assignedSeatIds: string[]    = [];
    let assignedSeatNumbers: string[] = [];
    try {
      const freeSeats = await db.execute(sql`
        SELECT id, number FROM seats
        WHERE trip_id = ${tripId} AND status = 'available'
        ORDER BY "row", "column"
        LIMIT ${count}
      `);
      assignedSeatIds    = (freeSeats.rows as any[]).map(s => s.id);
      assignedSeatNumbers = (freeSeats.rows as any[]).map(s => s.number);
      if (assignedSeatIds.length > 0) {
        await db.execute(sql`
          UPDATE seats SET status = 'occupied'
          WHERE id = ANY(${assignedSeatIds}::text[])
        `);
      }
    } catch {}

    const [booking] = await db.insert(bookingsTable).values({
      id,
      bookingRef:       ref,
      userId:           user.id,
      tripId,
      passengers,
      seatIds:          assignedSeatIds,
      seatNumbers:      assignedSeatNumbers,
      totalAmount:      amount,
      paymentMethod:    paymentMethod || "cash",
      paymentStatus:    "paid",
      status:           "confirmed",
      contactPhone:     clientPhone || "",
      contactEmail:     "",
      commissionAmount: Math.round(amount * 0.10),
      bookingSource:    "guichet",
      boardingCity:     bCity,
      alightingCity:    aCity,
    } as any).returning();

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.BOOKING_CREATE, booking.id, "booking",
      { bookingRef: ref, tripId, seatCount: count, clientName, paymentMethod, source: "guichet",
        seats: assignedSeatNumbers, boardingCity: bCity, alightingCity: aCity }).catch(() => {});
    recordTripAgent(tripId, user.id).catch(() => {});

    res.status(201).json({
      id: booking.id, bookingRef: booking.bookingRef, tripId: booking.tripId,
      totalAmount: booking.totalAmount, status: booking.status,
      paymentMethod: booking.paymentMethod, passengers: booking.passengers,
      seatNumbers: assignedSeatNumbers,
      seatIds: assignedSeatIds,
      boardingCity: bCity, alightingCity: aCity,
      bookingSource: "guichet",
      createdAt: booking.createdAt?.toISOString(),
    });
  } catch (err) {
    console.error("Agent create reservation error:", err);
    res.status(500).json({ error: "Échec de la création de la réservation" });
  }
});

/* ─── GET /agent/online-bookings — list online/mobile reservations ─── */
router.get("/online-bookings", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const companyId = agentRows[0]?.companyId ?? null;

    /* Only show mobile/online bookings (not guichet — those are agent-created) */
    const sourceFilter = inArray(bookingsTable.bookingSource, ["mobile", "online"]);

    const bookings = companyId
      ? await db.select().from(bookingsTable)
          .where(and(eq(bookingsTable.companyId, companyId), sourceFilter))
          .orderBy(desc(bookingsTable.createdAt))
      : await db.select().from(bookingsTable)
          .where(sourceFilter)
          .orderBy(desc(bookingsTable.createdAt));

    /* Batch-load all trip IDs at once to avoid N+1 queries */
    const tripIds = [...new Set(bookings.map(b => b.tripId).filter(Boolean))] as string[];
    const trips = tripIds.length > 0
      ? await db.select().from(tripsTable).where(inArray(tripsTable.id, tripIds))
      : [];
    const tripMap = Object.fromEntries(trips.map(t => [t.id, t]));

    const enriched = bookings.map((b) => {
      const trip = b.tripId ? tripMap[b.tripId] ?? null : null;
      return {
        id: b.id,
        bookingRef: b.bookingRef,
        status: b.status,
        bookingSource: b.bookingSource,
        totalAmount: b.totalAmount,
        paymentMethod: b.paymentMethod,
        contactPhone: b.contactPhone,
        passengers: b.passengers,
        seatNumbers: b.seatNumbers,
        createdAt: b.createdAt?.toISOString(),
        baggageCount: (b as any).baggageCount ?? 0,
        baggageType: (b as any).baggageType ?? null,
        baggageDescription: (b as any).baggageDescription ?? null,
        bagageStatus: (b as any).bagageStatus ?? null,
        bagagePrice: (b as any).bagagePrice ?? 0,
        trip: trip ? {
          id: trip.id,
          from: trip.from,
          to: trip.to,
          date: trip.date,
          departureTime: trip.departureTime,
          busName: trip.busName,
          guichetSeats: trip.guichetSeats,
          onlineSeats: trip.onlineSeats,
          totalSeats: trip.totalSeats,
        } : null,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("online-bookings error:", err);
    res.status(500).json({ error: "Erreur chargement réservations en ligne" });
  }
});

/* ─── POST /agent/online-bookings/:id/confirm — confirm an online booking ─── */
router.post("/online-bookings/:id/confirm", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const bookingId = req.params.id;
    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    const booking = rows[0];

    /* Check online seat capacity */
    if (booking.tripId) {
      const tripRows = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
      const trip = tripRows[0];
      if (trip && trip.onlineSeats > 0) {
        const onlineConfirmed = await db.select().from(bookingsTable).where(and(
          eq(bookingsTable.tripId, booking.tripId),
          inArray(bookingsTable.bookingSource, ["online", "mobile"]),
          inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé"])
        ));
        const usedOnline = onlineConfirmed.reduce(
          (acc, b) => acc + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length || 1 : 1), 0
        );
        const paxCount = Array.isArray(booking.passengers) ? booking.passengers.length : 1;
        if (usedOnline + paxCount > trip.onlineSeats) {
          res.status(400).json({
            error: `Plus de places en ligne disponibles. Places restantes : ${Math.max(0, trip.onlineSeats - usedOnline)}`,
          });
          return;
        }
      }
    }

    const hasBaggage = ((booking as any).baggageCount ?? 0) > 0;

    const [updated] = await db.update(bookingsTable)
      .set({
        status: "confirmed",
        paymentStatus: "paid",
        ...(hasBaggage ? { bagageStatus: "accepté" } as any : {}),
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.BOOKING_CREATE, bookingId, "booking",
      { action: "confirm_online", bookingRef: booking.bookingRef }).catch(() => {});

    if (booking.userId) {
      sendExpoPush(booking.userId, {
        title: "✅ Réservation confirmée",
        body: `Votre réservation ${booking.bookingRef} a été confirmée${hasBaggage ? " avec votre bagage" : ""} !`,
        data: { type: "booking_confirmed", bookingId: booking.id },
      }).catch(() => {});
    }

    /* ── Notify agent en route of that trip ── */
    if (booking.tripId) {
      try {
        const agentEnRoute = await db.select().from(agentsTable)
          .where(and(
            eq(agentsTable.tripId, booking.tripId),
            eq(agentsTable.agentRole, "agent_route")
          )).limit(1);
        if (agentEnRoute[0]) {
          const agentUser = await db.select().from(usersTable)
            .where(eq(usersTable.id, agentEnRoute[0].userId)).limit(1);
          if (agentUser[0]?.phone) {
            const trip = (await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1))[0];
            const paxNames = Array.isArray(booking.passengers) ? booking.passengers.map((p: any) => p.name).join(", ") : "Passager";
            sendSMS(agentUser[0].phone,
              `🚌 GoBooking [En route] : Nouvelle réservation confirmée sur votre trajet ${trip?.from ?? ""} → ${trip?.to ?? ""} (${trip?.departureTime ?? ""}). Passager(s) : ${paxNames}. Tél: ${booking.contactPhone ?? "?"}. Réf: ${booking.bookingRef}.`
            );
          }
        }
      } catch {} // non-blocking
    }

    res.json({
      id: updated.id, bookingRef: updated.bookingRef, status: updated.status,
      message: "Réservation confirmée avec succès",
    });
  } catch (err) {
    console.error("confirm online-booking error:", err);
    res.status(500).json({ error: "Erreur confirmation réservation" });
  }
});

/* ─── POST /agent/online-bookings/:id/cancel — cancel an online booking ─── */
router.post("/online-bookings/:id/cancel", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const bookingId = req.params.id;
    const { reason } = req.body;

    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Réservation introuvable" }); return; }
    const booking = rows[0];

    if (["boarded", "cancelled"].includes(booking.status)) {
      res.status(400).json({ error: "Cette réservation ne peut pas être annulée" });
      return;
    }

    const seatIds: string[] = Array.isArray(booking.seatIds) ? (booking.seatIds as string[]) : [];
    for (const seatId of seatIds) {
      await db.update(seatsTable).set({ status: "available" }).where(eq(seatsTable.id, seatId));
    }

    const [updated] = await db.update(bookingsTable)
      .set({ status: "cancelled", paymentStatus: "failed" } as any)
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    if (booking.userId) {
      sendExpoPush(booking.userId, {
        title: "❌ Réservation annulée",
        body: `Votre réservation ${booking.bookingRef} a été annulée${reason ? ` : ${reason}` : ""}.`,
        data: { type: "booking_cancelled", bookingId: booking.id },
      }).catch(() => {});
    }

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.BOOKING_CREATE, bookingId, "booking",
      { action: "cancel_online", bookingRef: booking.bookingRef, reason }).catch(() => {});

    res.json({ id: updated.id, bookingRef: updated.bookingRef, status: updated.status, message: "Réservation annulée" });
  } catch (err) {
    console.error("cancel online-booking error:", err);
    res.status(500).json({ error: "Erreur annulation réservation" });
  }
});

/* ─── GET /agent/trips/capacity/:tripId — seats summary per trip ─── */
router.get("/trips/capacity/:tripId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;
    const tripRows = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!tripRows.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = tripRows[0];

    const allBookings = await db.select().from(bookingsTable).where(and(
      eq(bookingsTable.tripId, tripId),
      inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé"])
    ));

    const guichetUsed = allBookings
      .filter(b => b.bookingSource === "guichet" || !b.bookingSource)
      .reduce((acc, b) => acc + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length || 1 : 1), 0);

    const onlineUsed = allBookings
      .filter(b => b.bookingSource === "online" || b.bookingSource === "mobile")
      .reduce((acc, b) => acc + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length || 1 : 1), 0);

    res.json({
      tripId,
      totalSeats: trip.totalSeats,
      guichetSeats: trip.guichetSeats,
      onlineSeats: trip.onlineSeats,
      guichetUsed,
      onlineUsed,
      guichetRestant: Math.max(0, trip.guichetSeats - guichetUsed),
      onlineRestant: Math.max(0, trip.onlineSeats - onlineUsed),
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur capacité trajet" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   COLIS À DISTANCE — VALIDATION PAR AGENT
═══════════════════════════════════════════════════════════════════════════ */

/* GET /agent/parcels/pending-validation — list parcels awaiting agent validation */
router.get("/parcels/pending-validation", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const companyId = agentRows[0]?.companyId ?? null;

    const parcels = companyId
      ? await db.select().from(parcelsTable).where(and(
          inArray(parcelsTable.status, ["en_attente_validation"]),
          eq(parcelsTable.companyId, companyId)
        )).orderBy(desc(parcelsTable.createdAt))
      : await db.select().from(parcelsTable).where(
          inArray(parcelsTable.status, ["en_attente_validation"])
        ).orderBy(desc(parcelsTable.createdAt));

    res.json(parcels);
  } catch (err) {
    console.error("pending-validation error:", err);
    res.status(500).json({ error: "Erreur chargement colis à valider" });
  }
});

/* POST /agent/parcels/:id/validate — agent validates parcel + sets real price */
router.post("/parcels/:id/validate", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const colisId = req.params.id;
    const { prixReel, notes } = req.body as { prixReel?: number; notes?: string };

    const rows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, colisId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Colis introuvable" }); return; }
    const colis = rows[0];

    const isHomeDelivery = colis.deliveryType === "livraison_domicile";
    const nextStatus = isHomeDelivery ? "en_attente_ramassage" : "valide";

    const updateData: any = {
      status: nextStatus,
      statusUpdatedAt: new Date(),
    };
    if (prixReel && prixReel > 0) updateData.amount = prixReel;
    if (notes) updateData.notes = notes;

    const [updated] = await db.update(parcelsTable).set(updateData).where(eq(parcelsTable.id, colisId)).returning();

    console.log(`[SMS] → ${colis.senderPhone} : ✅ GoBooking : Votre colis ${colis.trackingRef} a été validé. Prix : ${Number(updated.amount).toLocaleString()} FCFA.`);

    res.json({ id: updated.id, status: updated.status, amount: updated.amount, message: "Colis validé" });
  } catch (err) {
    console.error("validate parcel error:", err);
    res.status(500).json({ error: "Erreur validation colis" });
  }
});

/* POST /agent/parcels/:id/refuse — agent refuses parcel */
router.post("/parcels/:id/refuse", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const colisId = req.params.id;
    const { reason } = req.body as { reason?: string };

    const rows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, colisId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Colis introuvable" }); return; }
    const colis = rows[0];

    const [updated] = await db.update(parcelsTable).set({
      status: "refuse",
      statusUpdatedAt: new Date(),
      notes: reason ? `Refusé : ${reason}` : "Refusé par l'agent",
    }).where(eq(parcelsTable.id, colisId)).returning();

    console.log(`[SMS] → ${colis.senderPhone} : ❌ GoBooking : Votre colis ${colis.trackingRef} a été refusé. ${reason ? `Motif : ${reason}` : ""}`);

    res.json({ id: updated.id, status: "refuse", message: "Colis refusé" });
  } catch (err) {
    console.error("refuse parcel error:", err);
    res.status(500).json({ error: "Erreur refus colis" });
  }
});

/* POST /agent/parcels/:id/send-livreur — agent sends delivery person (domicile) */
router.post("/parcels/:id/send-livreur", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const colisId = req.params.id;
    const rows = await db.select().from(parcelsTable).where(eq(parcelsTable.id, colisId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Colis introuvable" }); return; }
    const colis = rows[0];

    const [updated] = await db.update(parcelsTable).set({
      status: "ramassage_en_cours",
      statusUpdatedAt: new Date(),
    }).where(eq(parcelsTable.id, colisId)).returning();

    console.log(`[SMS] → ${colis.senderPhone} : 🛵 GoBooking : Un livreur est en route pour récupérer votre colis ${colis.trackingRef}.`);

    res.json({ id: updated.id, status: "ramassage_en_cours", message: "Livreur envoyé" });
  } catch (err) {
    console.error("send-livreur error:", err);
    res.status(500).json({ error: "Erreur envoi livreur" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   SYSTÈME DE RAPPORTS AGENTS
═══════════════════════════════════════════════════════════════════════════ */

/* POST /agent/reports — create a report */
router.post("/reports", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRecord = agentRows[0];

    const { reportType, description, relatedId } = req.body as {
      reportType: string; description: string; relatedId?: string;
    };

    if (!reportType || !description?.trim()) {
      res.status(400).json({ error: "Type et description du rapport obligatoires" }); return;
    }

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 8);
    const [report] = await db.insert(agentReportsTable).values({
      id,
      agentId: user.id,
      agentName: user.name,
      companyId: agentRecord?.companyId ?? null,
      agentRole: agentRecord?.agentRole ?? user.agentRole ?? null,
      reportType,
      description: description.trim(),
      relatedId: relatedId || null,
      statut: "soumis",
    }).returning();

    res.status(201).json(report);
  } catch (err) {
    console.error("create report error:", err);
    res.status(500).json({ error: "Erreur création rapport" });
  }
});

/* GET /agent/reports — list my reports */
router.get("/reports", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const reports = await db.select().from(agentReportsTable)
      .where(eq(agentReportsTable.agentId, user.id))
      .orderBy(desc(agentReportsTable.createdAt));

    res.json(reports);
  } catch (err) {
    console.error("list reports error:", err);
    res.status(500).json({ error: "Erreur chargement rapports" });
  }
});

router.get("/seats/:tripId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const seats = await db.select().from(seatsTable).where(eq(seatsTable.tripId, req.params.tripId));
    res.json(seats);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/trips", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRecord = agentRows[0];
    const companyId = agentRecord?.companyId ?? null;

    const trips = companyId
      ? await db.select().from(tripsTable)
          .where(and(eq(tripsTable.companyId, companyId)))
          .orderBy(desc(tripsTable.date))
      : await db.select().from(tripsTable)
          .orderBy(desc(tripsTable.date));

    const enriched = await Promise.all(trips.map(async (trip) => {
      const availableCount = await db.select().from(seatsTable)
        .where(and(eq(seatsTable.tripId, trip.id), eq(seatsTable.status, "available")));
      // Build ordered city list (from → stops → to)
      let stopCities: string[] = [];
      try {
        const stopsRaw = (trip as any).stops;
        const parsedStops = Array.isArray(stopsRaw) ? stopsRaw
          : (typeof stopsRaw === "string" ? JSON.parse(stopsRaw) : []);
        stopCities = parsedStops.map((s: any) => s.city ?? s.name ?? s).filter(Boolean);
      } catch {}
      const allCities = [trip.fromCity ?? trip.from, ...stopCities, trip.toCity ?? trip.to].filter(Boolean);
      return {
        id: trip.id,
        from: trip.from ?? trip.fromCity,
        to: trip.to ?? trip.toCity,
        fromCity: trip.fromCity ?? trip.from,
        toCity: trip.toCity ?? trip.to,
        date: trip.date,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        price: trip.price,
        busName: trip.busName,
        busType: trip.busType,
        status: trip.status,
        totalSeats: trip.totalSeats,
        availableSeats: availableCount.length,
        guichetSeats: trip.guichetSeats ?? 0,
        onlineSeats: trip.onlineSeats ?? 0,
        stops: stopCities,
        allCities,
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── GET /agent/trips/today — today's trips for the company ─── */
router.get("/trips/today", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRecord = agentRows[0];
    const companyId = agentRecord?.companyId ?? null;

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    /* Include today + yesterday (for late departures) */
    let trips = companyId
      ? await db.select().from(tripsTable)
          .where(and(eq(tripsTable.companyId, companyId)))
          .orderBy(desc(tripsTable.date))
          .limit(30)
      : await db.select().from(tripsTable)
          .orderBy(desc(tripsTable.date))
          .limit(20);

    /* Filter client-side to today/yesterday + only actionable statuses */
    trips = trips.filter(t =>
      (t.date === today || t.date === yesterday) &&
      !["arrived", "cancelled"].includes(t.status ?? "")
    );

    /* For each trip, count bookings */
    const enriched = await Promise.all(trips.map(async (trip) => {
      const bookings = await db.select().from(bookingsTable)
        .where(and(
          eq(bookingsTable.tripId, trip.id),
          inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé"])
        ));
      const totalPax = bookings.reduce((acc, b) => acc + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length : 1), 0);
      const boardedPax = bookings
        .filter(b => b.status === "boarded" || b.status === "validated")
        .reduce((acc, b) => acc + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length : 1), 0);

      return {
        id: trip.id,
        from: trip.from,
        to: trip.to,
        date: trip.date,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        busName: trip.busName,
        busType: trip.busType,
        status: trip.status,
        totalSeats: trip.totalSeats,
        busId: (trip as any).busId ?? null,
        totalPassengers: totalPax,
        boardedPassengers: boardedPax,
        absentPassengers: totalPax - boardedPax,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("trips/today error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── GET /agent/trip/:tripId/boarding-status — full passenger list ─── */
router.get("/trip/:tripId/boarding-status", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = trips[0];

    const bookings = await db.select().from(bookingsTable)
      .where(and(
        eq(bookingsTable.tripId, tripId),
        inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé", "pending"])
      ))
      .orderBy(desc(bookingsTable.createdAt));

    const passengers: {
      bookingId: string;
      bookingRef: string;
      name: string;
      phone: string;
      seats: string[];
      status: string;
      boarded: boolean;
      amount: number;
    }[] = [];

    for (const b of bookings) {
      const pList = Array.isArray(b.passengers) ? (b.passengers as any[]) : [];
      const seatNums = Array.isArray(b.seatNumbers) ? (b.seatNumbers as string[]) : [];
      const isBoarded = b.status === "boarded" || b.status === "validated";

      passengers.push({
        bookingId: b.id,
        bookingRef: b.bookingRef ?? "",
        name: pList[0]?.name ?? "Passager",
        phone: pList[0]?.phone ?? b.contactPhone ?? "—",
        seats: seatNums,
        status: b.status ?? "confirmed",
        boarded: isBoarded,
        amount: b.totalAmount ?? 0,
      });
    }

    const boarded = passengers.filter(p => p.boarded);
    const absent = passengers.filter(p => !p.boarded);

    res.json({
      trip: {
        id: trip.id, from: trip.from, to: trip.to,
        date: trip.date, departureTime: trip.departureTime,
        busName: trip.busName, status: trip.status,
        totalSeats: trip.totalSeats,
      },
      passengers,
      stats: {
        total: passengers.length,
        boarded: boarded.length,
        absent: absent.length,
        totalSeats: passengers.reduce((acc, p) => acc + p.seats.length, 0),
        boardedSeats: boarded.reduce((acc, p) => acc + p.seats.length, 0),
        absentSeats: absent.reduce((acc, p) => acc + p.seats.length, 0),
      },
    });
  } catch (err) {
    console.error("boarding-status error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/trips/:tripId/close-departure — cancel absents + free seats ─── */
router.post("/trips/:tripId/close-departure", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = trips[0];

    /* Find all non-boarded bookings */
    const absentBookings = await db.select().from(bookingsTable).where(and(
      eq(bookingsTable.tripId, tripId),
      inArray(bookingsTable.status, ["confirmed", "pending", "payé"])
    ));

    let cancelledCount = 0;
    let freedSeats = 0;
    const cancelledRefs: string[] = [];

    for (const b of absentBookings) {
      await db.update(bookingsTable)
        .set({ status: "cancelled" })
        .where(eq(bookingsTable.id, b.id));

      const seatCount = Array.isArray(b.seatNumbers) ? b.seatNumbers.length : 1;
      freedSeats += seatCount;
      cancelledCount++;
      cancelledRefs.push(b.bookingRef ?? b.id);

      /* Free seats in seats table */
      if (Array.isArray(b.seatNumbers) && b.seatNumbers.length > 0) {
        for (const seatNum of b.seatNumbers as string[]) {
          await db.update(seatsTable)
            .set({ status: "available", bookingId: null } as any)
            .where(and(eq(seatsTable.tripId, tripId), eq(seatsTable.seatNumber, seatNum)))
            .catch(() => {});
        }
      }

      /* Notify absent passengers */
      const userRows = await db.select({ pushToken: usersTable.pushToken })
        .from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
      sendExpoPush(
        userRows[0]?.pushToken,
        "GoBooking — Réservation annulée",
        `Votre réservation ${b.bookingRef} a été annulée (départ clôturé sans présentation).`
      ).catch(() => {});
    }

    auditLog(
      { userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.BOOKING_CANCEL, tripId, "trip",
      { cancelledCount, freedSeats, cancelledRefs, tripFrom: trip.from, tripTo: trip.to }
    ).catch(() => {});

    res.json({
      success: true,
      cancelledCount,
      freedSeats,
      cancelledRefs,
      message: `${cancelledCount} réservation(s) annulée(s), ${freedSeats} siège(s) libéré(s)`,
    });
  } catch (err) {
    console.error("close-departure error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── Passengers for a given trip (route agent) ─────────── */
router.get("/trip/:tripId/passengers", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;

    // Fetch confirmed bookings for this trip
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.tripId, tripId));

    // Also fetch accepted boarding requests (for boarding-point info)
    const bRequests = await db.select().from(boardingRequestsTable)
      .where(
        and(
          eq(boardingRequestsTable.tripId, tripId),
          inArray(boardingRequestsTable.status, ["accepted", "embarqué"])
        )
      );

    // Build passenger list from bookings
    const result: { name: string; seatNumber: string; status: string; phone?: string; boardingPoint?: string }[] = [];

    for (const b of bookings) {
      if (!["confirmed", "boarded", "validated", "payé"].includes(b.status ?? "")) continue;
      const passengers = Array.isArray(b.passengers) ? b.passengers : [];
      const seats = Array.isArray(b.seatNumbers) ? b.seatNumbers : [];
      passengers.forEach((p: any, i: number) => {
        result.push({
          name: p.name ?? "Passager",
          seatNumber: seats[i] ?? "?",
          status: b.status === "boarded" ? "boarded" : "confirmed",
          phone: (p.phone ?? b.contactPhone) || undefined,
          boardingPoint: (b as any).boardingPoint ?? (b as any).boarding_point ?? undefined,
          bookingRef: b.bookingRef ?? undefined,
          bookingSource: b.bookingSource ?? undefined,
        });
      });
    }

    // Merge boarding request passengers (add phone + boardingPoint)
    for (const r of bRequests) {
      result.push({
        name: r.clientName,
        seatNumber: "—",
        status: "boarded",
        phone: r.clientPhone ?? undefined,
        boardingPoint: r.boardingPoint ?? undefined,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── Start / Arrive trip ───────────────────────────────── */
router.post("/trip/:tripId/start", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const trips = await db.select().from(tripsTable)
      .where(eq(tripsTable.id, req.params.tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }

    if (trips[0].status === "en_route") {
      res.status(409).json({ error: "Trajet déjà démarré", code: "ALREADY_STARTED" }); return;
    }

    await db.update(tripsTable)
      .set({ status: "en_route", startedAt: new Date() })
      .where(eq(tripsTable.id, req.params.tripId));

    res.json({ success: true, status: "en_route", startedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/trip/:tripId/arrive", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(tripsTable)
      .set({ status: "arrived", arrivedAt: new Date() })
      .where(eq(tripsTable.id, req.params.tripId));

    /* ── Clear live GPS — trip is over ── */
    locationStore.delete(req.params.tripId);

    res.json({ success: true, status: "arrived", arrivedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GPS position push (agent → server) ───────────────── */
router.post("/trip/:tripId/location", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { lat, lon, accuracy, speed, heading } = req.body as {
      lat: number; lon: number;
      accuracy?: number; speed?: number; heading?: number;
    };

    if (typeof lat !== "number" || typeof lon !== "number") {
      res.status(400).json({ error: "lat et lon requis" }); return;
    }

    /* ── Security: only allow GPS push when trip is actually en_route ── */
    /* Demo trips (id starts with "t-" or "live-") bypass the DB check   */
    const isDemoTrip = /^(t-|live-)/.test(req.params.tripId);
    if (!isDemoTrip) {
      const trips = await db.select().from(tripsTable)
        .where(eq(tripsTable.id, req.params.tripId)).limit(1);
      if (!trips.length) {
        res.status(404).json({ error: "Trajet introuvable" }); return;
      }
      if (trips[0].status !== "en_route") {
        /* Trip ended or not started — clear stale position and refuse */
        locationStore.delete(req.params.tripId);
        res.status(403).json({ error: "GPS non autorisé : trajet non actif", code: "TRIP_NOT_ACTIVE" }); return;
      }
    }

    pruneStale();

    /* ── 1. Update in-memory store for real-time reads ── */
    locationStore.set(req.params.tripId, {
      tripId:    req.params.tripId,
      lat, lon,
      accuracy:  accuracy ?? undefined,
      speed:     speed    ?? undefined,
      heading:   heading  ?? undefined,
      updatedAt: Date.now(),
      agentId:   user.id,
    });

    /* ── 2. Persist GPS trail to positions table (fire-and-forget) ── */
    db.insert(positionsTable).values({
      tripId:   req.params.tripId,
      agentId:  user.id,
      lat,
      lon,
      speed:    typeof speed    === "number" ? speed    : null,
      accuracy: typeof accuracy === "number" ? accuracy : null,
      heading:  typeof heading  === "number" ? heading  : null,
    }).catch(err => console.error("positions insert error:", err));

    /* ── 3. Upsert latest position to bus_positions (one row per trip) ── */
    db.insert(busPositionsTable).values({
      tripId:    req.params.tripId,
      latitude:  lat,
      longitude: lon,
      speed:     typeof speed   === "number" ? speed   : null,
      heading:   typeof heading === "number" ? heading : null,
    })
    .onConflictDoUpdate({
      target: busPositionsTable.tripId,
      set: {
        latitude:  lat,
        longitude: lon,
        speed:     typeof speed   === "number" ? speed   : null,
        heading:   typeof heading === "number" ? heading : null,
        updatedAt: sql`now()`,
      },
    })
    .catch(err => console.error("bus_positions upsert error:", err));

    /* ── 4. Proximity notifications — "Bus proche" ───────────────────────
       After persisting the position, check if any pending boarding_requests
       for this trip have a pickup location (pickup_lat / pickup_lon) within
       NEARBY_KM km. If so, send a push notification once (notified_nearby).
    ──────────────────────────────────────────────────────────────────────── */
    const NEARBY_KM = 5;
    const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
              + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
              * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    /* Run proximity check asynchronously — don't block the response */
    const tripIdForProx = req.params.tripId;
    (async () => {
      try {
        /* Get pending boarding_requests with a pickup location, not yet notified */
        const nearby = await db.execute(
          sql`SELECT br.id, br.user_id, br.client_name, br.boarding_point,
                     br.pickup_lat, br.pickup_lon, u.push_token
              FROM boarding_requests br
              LEFT JOIN users u ON u.id = br.user_id
              WHERE br.trip_id = ${tripIdForProx}
                AND br.status IN ('pending', 'accepted')
                AND br.notified_nearby IS NOT TRUE
                AND br.pickup_lat IS NOT NULL
                AND br.pickup_lon IS NOT NULL`
        );
        const rows = (nearby as any).rows ?? nearby ?? [];
        for (const row of (Array.isArray(rows) ? rows : [])) {
          const pLat = Number(row.pickup_lat);
          const pLon = Number(row.pickup_lon);
          if (isNaN(pLat) || isNaN(pLon)) continue;
          const dist = haversineKm(lat, lon, pLat, pLon);
          if (dist <= NEARBY_KM) {
            /* Mark as notified first (prevents duplicate sends on rapid GPS) */
            await db.execute(
              sql`UPDATE boarding_requests SET notified_nearby = true WHERE id = ${row.id}`
            );
            /* Send push notification if user has a push token */
            if (row.push_token) {
              sendExpoPush(
                row.push_token,
                "GoBooking 🚌 Bus proche !",
                `Votre bus arrive dans environ ${Math.round(dist * 10) / 10} km de votre position. Préparez-vous !`
              ).catch(() => {});
            }
          }
        }
      } catch {
        /* Proximity check is best-effort — never block the GPS response */
      }
    })();

    res.json({ success: true, updatedAt: Date.now() });
  } catch (err) {
    console.error("GPS push error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GPS position read for agent ─────────────────────── */
router.get("/trip/:tripId/location", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const loc = locationStore.get(req.params.tripId);
    res.json(loc ?? null);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GPS trail — last N positions from DB for a trip ───── */
/* Used by the map to draw a breadcrumb trail behind the bus  */
router.get("/trip/:tripId/trail", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit ?? "20"), 10)));
    /* Last 30 minutes of positions */
    const since = new Date(Date.now() - 30 * 60 * 1000);

    const rows = await db
      .select({
        lat:        positionsTable.lat,
        lon:        positionsTable.lon,
        speed:      positionsTable.speed,
        recordedAt: positionsTable.recordedAt,
      })
      .from(positionsTable)
      .where(and(
        eq(positionsTable.tripId, req.params.tripId),
        gte(positionsTable.recordedAt, since),
      ))
      .orderBy(desc(positionsTable.recordedAt))
      .limit(limit);

    res.json(rows.reverse()); /* chronological order */
  } catch (err) {
    console.error("Trail fetch error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── Ticket scan by booking reference ─────────────────── */
router.get("/scan/:ref", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const ref = req.params.ref.trim().toUpperCase();
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.bookingRef, ref))
      .limit(1);

    if (!bookings.length) {
      res.status(404).json({ error: "Aucun billet trouvé pour cette référence", code: "NOT_FOUND" });
      return;
    }

    const booking = bookings[0];

    let trip = null;
    if (booking.tripId) {
      const trips = await db.select().from(tripsTable)
        .where(eq(tripsTable.id, booking.tripId))
        .limit(1);
      trip = trips[0] ?? null;
    }

    /* ── Anti double-scan ── */
    if (booking.status === "boarded") {
      auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_DOUBLE_SCAN, booking.id, "booking", {
        bookingRef: booking.bookingRef, status: booking.status,
      }, true).catch(() => {});
      res.status(409).json({
        error: "Billet déjà utilisé — embarquement déjà enregistré",
        code:  "DOUBLE_SCAN",
        bookingRef: booking.bookingRef,
      });
      return;
    }

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_SCAN, booking.id, "booking", {
      bookingRef: booking.bookingRef, currentStatus: booking.status,
    }).catch(() => {});

    res.json({
      id: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      passengers: booking.passengers ?? [],
      seatNumbers: booking.seatNumbers ?? [],
      totalAmount: booking.totalAmount,
      paymentMethod: booking.paymentMethod,
      createdAt: booking.createdAt?.toISOString(),
      trip: trip ? {
        from: trip.from, to: trip.to,
        date: trip.date, departureTime: trip.departureTime,
        busName: trip.busName,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ───────────────────────────────────────────────────────────────────────────
   TRIP REQUEST ROUTES  (agent reads / responds to client requests)
─────────────────────────────────────────────────────────────────────────── */

/* GET /agent/requests?tripId=live-1  — pending + recent requests for trip */
router.get("/requests", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    pruneOldRequests();
    const tripId = (req.query.tripId as string) || "live-1";

    /* 1. Get from in-memory store (fast path) */
    const memRequests = requestsForTrip(tripId);

    if (memRequests.length > 0) {
      res.json(memRequests);
      return;
    }

    /* 2. Fallback: read from boarding_requests DB (e.g. after server restart) */
    try {
      const dbRows = await db
        .select()
        .from(boardingRequestsTable)
        .where(eq(boardingRequestsTable.tripId, tripId))
        .orderBy(desc(boardingRequestsTable.createdAt))
        .limit(50);

      /* Rehydrate in-memory store from DB (pending only) */
      for (const row of dbRows) {
        if (!requestStore.has(row.id)) {
          requestStore.set(row.id, {
            id:             row.id,
            tripId:         row.tripId,
            clientName:     row.clientName,
            clientPhone:    row.clientPhone,
            seatsRequested: parseInt(row.seatsRequested ?? "1", 10),
            boardingPoint:  row.boardingPoint,
            status:         row.status as "pending" | "accepted" | "rejected",
            createdAt:      row.createdAt?.getTime() ?? Date.now(),
            respondedAt:    row.respondedAt?.getTime() ?? undefined,
          });
        }
      }

      const result = dbRows.map(row => ({
        id:             row.id,
        tripId:         row.tripId,
        clientName:     row.clientName,
        clientPhone:    row.clientPhone,
        seatsRequested: parseInt(row.seatsRequested ?? "1", 10),
        boardingPoint:  row.boardingPoint,
        status:         row.status,
        createdAt:      row.createdAt?.getTime() ?? Date.now(),
        respondedAt:    row.respondedAt?.getTime() ?? null,
      }));

      res.json(result);
    } catch (dbErr) {
      res.json([]); /* return empty if DB also fails */
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/requests/:id/accept */
router.post("/requests/:id/accept", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const req_ = requestStore.get(req.params.id);
    if (!req_) { res.status(404).json({ error: "Demande introuvable" }); return; }
    if (req_.status !== "pending") { res.status(409).json({ error: "Demande déjà traitée" }); return; }

    /* ── Deduct seats from DB in real time ── */
    const n = req_.seatsRequested ?? 1;
    const isDemoTrip = req_.tripId.startsWith("t-") || req_.tripId.startsWith("live-");
    let seatsBooked = 0;

    if (!isDemoTrip) {
      const availableSeats = await db
        .select({ id: seatsTable.id })
        .from(seatsTable)
        .where(and(eq(seatsTable.tripId, req_.tripId), eq(seatsTable.status, "available")))
        .limit(n);

      if (availableSeats.length < n) {
        res.status(409).json({ error: "Plus assez de sièges disponibles", code: "NOT_ENOUGH_SEATS" });
        return;
      }

      /* Mark those seats as booked */
      if (availableSeats.length > 0) {
        await db
          .update(seatsTable)
          .set({ status: "booked" })
          .where(inArray(seatsTable.id, availableSeats.map(s => s.id)));
        seatsBooked = availableSeats.length;
      }
    } else {
      seatsBooked = n; /* demo trips: count as booked without DB update */
    }

    req_.status      = "accepted";
    req_.respondedAt = Date.now();
    requestStore.set(req_.id, req_);

    /* Sync to boarding_requests DB table (fire-and-forget) */
    db.update(boardingRequestsTable)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(boardingRequestsTable.id, req_.id))
      .catch(err => console.error("boarding_requests accept sync error:", err));

    res.json({ success: true, request: req_, seatsBooked });
  } catch (err) {
    console.error("Accept request error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/requests/:id/board  — agent scans QR, marks passenger as boarded */
router.post("/requests/:id/board", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    /* Update in-memory store if present */
    const req_ = requestStore.get(req.params.id);
    if (req_) {
      (req_ as any).status = "embarqué";
      (req_ as any).boardedAt = Date.now();
      requestStore.set(req_.id, req_);
    }

    /* Sync to DB */
    await db.update(boardingRequestsTable)
      .set({ status: "embarqué", respondedAt: new Date() })
      .where(eq(boardingRequestsTable.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* GET /agent/requests/confirmed?tripId=XXX  — accepted passengers for current trip */
router.get("/requests/confirmed", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = (req.query.tripId as string) || "";
    if (!tripId) { res.json([]); return; }

    const rows = await db
      .select()
      .from(boardingRequestsTable)
      .where(
        and(
          eq(boardingRequestsTable.tripId, tripId),
          inArray(boardingRequestsTable.status, ["accepted", "embarqué"])
        )
      )
      .orderBy(desc(boardingRequestsTable.createdAt))
      .limit(50);

    res.json(rows.map(r => ({
      id:             r.id,
      tripId:         r.tripId,
      clientName:     r.clientName,
      clientPhone:    r.clientPhone,
      boardingPoint:  r.boardingPoint,
      seatsRequested: parseInt(r.seatsRequested ?? "1", 10),
      status:         r.status,
      createdAt:      r.createdAt?.getTime() ?? Date.now(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/requests/:id/reject */
router.post("/requests/:id/reject", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const req_ = requestStore.get(req.params.id);
    if (!req_) { res.status(404).json({ error: "Demande introuvable" }); return; }
    if (req_.status !== "pending") { res.status(409).json({ error: "Demande déjà traitée" }); return; }

    req_.status      = "rejected";
    req_.respondedAt = Date.now();
    requestStore.set(req_.id, req_);

    /* Sync to boarding_requests DB table (fire-and-forget) */
    db.update(boardingRequestsTable)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(boardingRequestsTable.id, req_.id))
      .catch(err => console.error("boarding_requests reject sync error:", err));

    res.json({ success: true, request: req_ });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ───────────────────────────────────────────────────────────────────────────
   SUB-ROLE AGENT ENDPOINTS (embarquement, vente, validation, reception_colis)
─────────────────────────────────────────────────────────────────────────── */

/* GET /agent/reservation/:ref  — lookup booking by ref or id */
router.get("/reservation/:ref", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const ref = req.params.ref.trim().toUpperCase();
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.bookingRef, ref))
      .limit(1);

    if (!bookings.length) {
      res.status(404).json({ error: "Réservation introuvable", code: "NOT_FOUND" });
      return;
    }

    const booking = bookings[0];
    let trip = null;
    if (booking.tripId) {
      const trips = await db.select().from(tripsTable)
        .where(eq(tripsTable.id, booking.tripId))
        .limit(1);
      trip = trips[0] ?? null;
    }

    const firstPassenger = Array.isArray(booking.passengers) ? booking.passengers[0] : null;
    res.json({
      id: booking.id,
      bookingRef: booking.bookingRef,
      reservationId: booking.id,
      name: (firstPassenger as any)?.name ?? "—",
      passengerName: (firstPassenger as any)?.name ?? "—",
      phone: (firstPassenger as any)?.phone ?? booking.contactPhone ?? "—",
      passengerPhone: (firstPassenger as any)?.phone ?? booking.contactPhone ?? "—",
      seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—",
      status: booking.status,
      price: booking.totalAmount ?? 0,
      departureCity: trip?.from ?? "—",
      arrivalCity: trip?.to ?? "—",
      departureTime: trip?.departureTime ?? "—",
      tripId: booking.tripId,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/reservation/:id/board  — mark passenger as boarded */
router.post("/reservation/:id/board", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(bookingsTable)
      .set({ status: "validated" })
      .where(eq(bookingsTable.id, req.params.id));

    /* ── Notify passenger ── */
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    if (bookings.length) {
      const userRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, bookings[0].userId)).limit(1);
      sendExpoPush(userRows[0]?.pushToken, "GoBooking 🚌", "Votre embarquement a été validé ! Bon voyage.").catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* POST /agent/reservation/:id/confirm  — confirm a reservation */
router.post("/reservation/:id/confirm", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(bookingsTable)
      .set({ status: "confirmed" })
      .where(eq(bookingsTable.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ───────────────────────────────────────────────────────────────────────────
   POST /agent/scan
   Unified QR scan → validate → board in one request.
   Accepts the raw signed QR JSON string generated by generateQRData() on the
   client. Validates signature, checks booking status, marks as boarded, and
   sends a push notification — all in one round-trip.
─────────────────────────────────────────────────────────────────────────── */
router.post("/scan", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { qrData, selectedTripId } = req.body as { qrData?: string | Record<string, unknown>; selectedTripId?: string };
    if (!qrData) { res.status(400).json({ error: "qrData requis", code: "MISSING_DATA" }); return; }

    /* ── 1. Parse + validate QR signature ── */
    const QR_SECRET = "GBK-CI-2026-SECURE-v1";
    const TTL_MS    = 72 * 60 * 60 * 1000;

    function djb2(str: string): string {
      let h = 5381;
      for (let i = 0; i < str.length; i++) { h = (h * 33) ^ str.charCodeAt(i); h = h >>> 0; }
      return h.toString(36).padStart(7, "0");
    }

    let ref: string;
    let qrType: string = "passager"; /* default — backward compat */

    const raw = typeof qrData === "object" ? JSON.stringify(qrData) : String(qrData).trim();

    if (raw.startsWith("{")) {
      let payload: { ref?: string; type?: string; ts?: number; sig?: string; trajetId?: string };
      try { payload = typeof qrData === "object" ? (qrData as typeof payload) : JSON.parse(raw); }
      catch { res.status(400).json({ error: "QR invalide — format incorrect", code: "INVALID_FORMAT" }); return; }

      const { ref: r, type, ts, sig, trajetId } = payload;
      if (!r || !type || !ts || !sig) {
        res.status(400).json({ error: "QR invalide — champs manquants", code: "INVALID_FORMAT" }); return;
      }
      /* Verify signature — support both new format (with trajetId) and old format */
      const sigNew = djb2(`${r}|${type}|${ts}|${trajetId ?? ""}|${QR_SECRET}`);
      const sigOld = djb2(`${r}|${type}|${ts}|${QR_SECRET}`);
      if (sig !== sigNew && sig !== sigOld) {
        res.status(400).json({ error: "QR invalide — billet potentiellement falsifié", code: "INVALID_SIGNATURE" }); return;
      }
      if (Date.now() - ts > TTL_MS) {
        res.status(400).json({ error: "QR expiré — billet trop ancien (> 72h)", code: "EXPIRED" }); return;
      }
      ref     = r;
      qrType  = type;
    } else if (/^(GBB|GBX|GBK|OFFLINE-)/i.test(raw) || /^[A-Z0-9]{6,20}$/i.test(raw)) {
      ref = raw.toUpperCase();
    } else {
      res.status(400).json({ error: "QR non reconnu — format invalide", code: "INVALID_FORMAT" }); return;
    }

    /* ── Helper: record scan to scansTable ── */
    const recordScan = async (type: string, targetId: string, scanRef: string, tripId?: string | null) => {
      try {
        const agentRows = await db.select({ companyId: agentsTable.companyId, name: agentsTable.name })
          .from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
        await db.insert(scansTable).values({
          id:        `SCN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type, ref: scanRef, targetId,
          trajetId:  selectedTripId ?? tripId ?? null,
          agentId:   user.id,
          agentName: agentRows[0]?.name ?? user.name ?? "Agent",
          companyId: agentRows[0]?.companyId ?? null,
          status:    "validé",
        });
      } catch {}
    };

    /* ══════════════════════════════════════════════════════════════
       ROUTE A: "colis" — scan colis, mark as chargé_bus
    ══════════════════════════════════════════════════════════════ */
    if (qrType === "colis") {
      const parcels = await db.select().from(parcelsTable)
        .where(eq(parcelsTable.trackingRef, ref.toUpperCase())).limit(1);
      if (!parcels.length) {
        res.status(404).json({ error: "Colis introuvable — référence inconnue", code: "NOT_FOUND", scanType: "colis" }); return;
      }
      const parcel = parcels[0];

      /* Trip mismatch */
      if (selectedTripId && parcel.tripId && parcel.tripId !== selectedTripId) {
        res.status(422).json({ error: "Ce colis est enregistré pour un autre trajet.", code: "WRONG_TRIP", scanType: "colis", ref: parcel.trackingRef }); return;
      }

      /* Anti double-scan */
      if (["chargé_bus", "en_transit", "arrivé", "livré"].includes(parcel.status ?? "")) {
        res.status(409).json({
          error:  "Ce colis a déjà été chargé ou est déjà en transit.",
          code:   "DOUBLE_SCAN", scanType: "colis", ref: parcel.trackingRef,
          parcel: { sender: parcel.senderName, receiver: parcel.receiverName, from: parcel.fromCity, to: parcel.toCity },
        }); return;
      }

      await db.update(parcelsTable).set({ status: "chargé_bus" }).where(eq(parcelsTable.id, parcel.id));
      await recordScan("colis", parcel.id, parcel.trackingRef, parcel.tripId);

      const senderRows = await db.select({ pushToken: usersTable.pushToken })
        .from(usersTable).where(eq(usersTable.id, parcel.userId)).limit(1);
      sendExpoPush(senderRows[0]?.pushToken, "GoBooking 📦", `Votre colis (${parcel.trackingRef}) a été chargé dans le bus.`).catch(() => {});

      res.json({
        success: true, scanType: "colis", ref: parcel.trackingRef,
        parcel: {
          trackingRef: parcel.trackingRef,
          sender:      parcel.senderName,
          receiver:    parcel.receiverName,
          from:        parcel.fromCity,
          to:          parcel.toCity,
          weight:      parcel.weight,
          newStatus:   "chargé_bus",
        },
      });
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       ROUTES B + C: "passager" / "billet" / "bagage" — need booking
    ══════════════════════════════════════════════════════════════ */
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.bookingRef, ref.toUpperCase())).limit(1);

    if (!bookings.length) {
      res.status(404).json({ error: "Billet introuvable — référence inconnue", code: "NOT_FOUND" }); return;
    }
    const booking = bookings[0];

    /* ── Trip mismatch guard ── */
    if (selectedTripId && booking.tripId && booking.tripId !== selectedTripId) {
      auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_SCAN, booking.id, "booking", {
        bookingRef: booking.bookingRef, reason: "WRONG_TRIP", bookingTripId: booking.tripId, selectedTripId,
      }, true).catch(() => {});
      const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
      const bTrip = trips[0];
      res.status(422).json({
        error: `Ce billet est pour le trajet ${bTrip?.from ?? "?"} → ${bTrip?.to ?? "?"} (départ ${bTrip?.departureTime ?? "?"}), pas pour le trajet sélectionné.`,
        code: "WRONG_TRIP", bookingRef: booking.bookingRef,
        bookingTrip: bTrip ? { from: bTrip.from, to: bTrip.to, departureTime: bTrip.departureTime, busName: bTrip.busName } : null,
      }); return;
    }

    /* ══════════════════════════════════════════════════════════════
       ROUTE B: "bagage" — confirm physical bagage loaded on bus
    ══════════════════════════════════════════════════════════════ */
    if (qrType === "bagage") {
      if (!(booking as any).bagages?.length) {
        res.status(422).json({ error: "Aucun bagage enregistré pour cette réservation.", code: "NO_BAGAGES", scanType: "bagage", bookingRef: booking.bookingRef }); return;
      }
      if ((booking as any).bagageStatus === "refusé") {
        const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
        res.status(422).json({
          error: "Bagages refusés par la compagnie — scan bloqué.", code: "BAGAGE_REFUS", scanType: "bagage",
          bookingRef: booking.bookingRef, passenger: { name: fp?.name ?? "—" }, bagageNote: (booking as any).bagageNote || null,
        }); return;
      }

      /* Anti double-scan: check if already scanned today */
      const existingScan = await db.select({ id: scansTable.id }).from(scansTable)
        .where(and(eq(scansTable.ref, booking.bookingRef), eq(scansTable.type, "bagage")))
        .orderBy(desc(scansTable.createdAt)).limit(1);
      if (existingScan.length) {
        const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
        res.status(409).json({
          error: "Bagages déjà validés — scan déjà effectué.", code: "DOUBLE_SCAN", scanType: "bagage",
          bookingRef: booking.bookingRef, passenger: { name: fp?.name ?? "—" },
        }); return;
      }

      await recordScan("bagage", booking.id, booking.bookingRef, booking.tripId);
      const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
      res.json({
        success: true, scanType: "bagage", bookingRef: booking.bookingRef,
        passenger:    { name: fp?.name ?? "—", seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—" },
        bagages:      (booking as any).bagages ?? [],
        bagageStatus: (booking as any).bagageStatus,
      });
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       ROUTE C: "passager" / "billet" — standard boarding
    ══════════════════════════════════════════════════════════════ */

    /* Anti double-scan */
    if (booking.status === "boarded" || booking.status === "validated") {
      auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_DOUBLE_SCAN, booking.id, "booking", {
        bookingRef: booking.bookingRef, status: booking.status,
      }, true).catch(() => {});
      const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
      res.status(409).json({
        error: "Billet déjà utilisé — passager déjà embarqué", code: "DOUBLE_SCAN",
        bookingRef: booking.bookingRef,
        passenger:  { name: fp?.name ?? "—", seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—" },
      }); return;
    }

    if (booking.status === "cancelled") {
      res.status(422).json({ error: "Réservation annulée — embarquement refusé", code: "CANCELLED" }); return;
    }

    if (booking.paymentStatus !== "paid") {
      res.status(402).json({
        error: "Paiement requis — ce billet n'a pas encore été payé", code: "NOT_PAID",
        bookingRef: booking.bookingRef,
        passenger:  { name: (Array.isArray(booking.passengers) ? (booking.passengers as any[])[0]?.name : null) ?? "—" },
      }); return;
    }

    if ((booking as any).bagageStatus === "refusé") {
      const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
      res.status(422).json({
        error: "Embarquement refusé — les bagages de ce passager ont été refusés par la compagnie.",
        code:  "BAGAGE_REFUS", bookingRef: booking.bookingRef,
        passenger:  { name: fp?.name ?? "—", seat: (booking.seatNumbers as string[] ?? [])[0] ?? "—" },
        bagageNote: (booking as any).bagageNote || null,
      }); return;
    }

    /* Fetch trip info */
    let trip = null;
    if (booking.tripId) {
      const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
      trip = trips[0] ?? null;
    }

    /* Mark as boarded */
    await db.update(bookingsTable).set({ status: "boarded" }).where(eq(bookingsTable.id, booking.id));
    await recordScan("passager", booking.id, booking.bookingRef, booking.tripId);
    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.QR_SCAN, booking.id, "booking", {
      bookingRef: booking.bookingRef, newStatus: "boarded",
    }).catch(() => {});

    /* Award loyalty points */
    const loyaltyResult = await awardPoints(
      booking.userId, POINTS_PER_TRIP,
      `Embarquement validé — billet ${booking.bookingRef}`,
      booking.id
    ).catch(() => null);

    /* Push notification */
    const userRows = await db.select({ pushToken: usersTable.pushToken, name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, booking.userId)).limit(1);
    sendExpoPush(userRows[0]?.pushToken, "GoBooking 🚌", "Votre embarquement a été validé ! Bon voyage.").catch(() => {});
    if (loyaltyResult) {
      sendExpoPush(
        userRows[0]?.pushToken,
        "🎁 Bonus fidélité",
        `+${POINTS_PER_TRIP} points gagnés ! Total : ${loyaltyResult.newBalance} pts`
      ).catch(() => {});
    }

    const fp = Array.isArray(booking.passengers) ? (booking.passengers as any[])[0] : null;
    res.json({
      success:    true,
      scanType:   "passager",
      bookingRef: booking.bookingRef,
      passenger: {
        name:          fp?.name ?? userRows[0]?.name ?? "Passager",
        seat:          (booking.seatNumbers as string[] ?? [])[0] ?? "—",
        seats:         booking.seatNumbers ?? [],
        count:         (booking.seatNumbers as string[] ?? []).length,
        from:          trip?.from ?? "—",
        to:            trip?.to   ?? "—",
        departureTime: trip?.departureTime ?? "—",
        date:          trip?.date ?? "—",
        busName:       trip?.busName ?? "—",
        totalAmount:   booking.totalAmount,
        paymentMethod: booking.paymentMethod,
      },
    });
  } catch (err) {
    console.error("Scan error:", err);
    res.status(500).json({ error: "Erreur serveur lors du scan", code: "SERVER_ERROR" });
  }
});

/* POST /agent/parcels/:id/arrive  — confirm parcel arrival at departure station */
router.post("/parcels/:parcelId/arrive", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    await db.update(parcelsTable)
      .set({ status: "arrive_gare_depart" })
      .where(eq(parcelsTable.id, req.params.parcelId));

    /* ── Notify sender ── */
    const parcels = await db.select().from(parcelsTable).where(eq(parcelsTable.id, req.params.parcelId)).limit(1);
    if (parcels.length) {
      const userRows = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, parcels[0].userId)).limit(1);
      sendExpoPush(userRows[0]?.pushToken, "GoBooking 📦", `Votre colis est arrivé à la gare de destination.`).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/alert — Envoi alerte sécurité (panne/urgence/contrôle/sos) */
router.post("/alert", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { type, tripId, busId, lat, lon, message } = req.body as {
      type: string; tripId?: string; busId?: string;
      lat?: number; lon?: number; message?: string;
    };

    const VALID_TYPES = ["urgence", "panne", "controle", "sos"];
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: "Type invalide. Valeurs acceptées: urgence, panne, controle, sos" }); return;
    }

    /* Récupère les infos de l'agent (companyId, busName) */
    const agentRows = await db.select({
      companyId: agentsTable.companyId,
      busId:     agentsTable.busId,
    }).from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRow = agentRows[0];

    /* Récupère le nom du bus si dispo */
    const resolvedBusId = busId ?? agentRow?.busId;
    let busName: string | undefined;
    if (resolvedBusId) {
      const buses = await db.select({ busName: busesTable.busName }).from(busesTable).where(eq(busesTable.id, resolvedBusId)).limit(1);
      busName = buses[0]?.busName;
    }

    const alertId = Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

    await db.insert(agentAlertsTable).values({
      id:        alertId,
      type,
      agentId:   user.id,
      agentName: user.name,
      companyId: agentRow?.companyId ?? null,
      tripId:    tripId ?? null,
      busId:     resolvedBusId ?? null,
      busName:   busName ?? null,
      lat:       typeof lat === "number" ? lat : null,
      lon:       typeof lon === "number" ? lon : null,
      message:   message ?? null,
      status:    "active",
    });

    /* Notifie les admins de la compagnie */
    if (agentRow?.companyId) {
      const agentAdmins = await db.select({
        userId: agentsTable.userId,
        companyId: agentsTable.companyId,
      }).from(agentsTable).where(and(
        eq(agentsTable.companyId, agentRow.companyId),
      ));
      const adminUserIds = [...new Set(agentAdmins.map(a => a.userId))];
      if (adminUserIds.length > 0) {
        const admins = await db.select({ id: usersTable.id, pushToken: usersTable.pushToken })
          .from(usersTable)
          .where(and(inArray(usersTable.id, adminUserIds), inArray(usersTable.role, ["compagnie", "company_admin"])));

        const TITLES: Record<string, string> = {
          urgence:  "🚨 URGENCE — Intervention requise",
          panne:    "⚠️  PANNE bus signalée",
          controle: "🔵 Contrôle de routine",
          sos:      "🆘 SOS — DANGER IMMÉDIAT",
        };
        const title   = TITLES[type] ?? "Alerte agent";
        const msgBody = `Agent: ${user.name} · ${busName ?? "Bus"} · ${type.toUpperCase()}`;

        for (const admin of admins) {
          if (admin.pushToken) {
            await sendExpoPush(admin.pushToken, title, msgBody);
          }
          await db.insert((await import("@workspace/db")).notificationsTable).values({
            id:       Math.random().toString(36).slice(2, 11) + Date.now().toString(36),
            userId:   admin.id,
            type:     "agent_alert",
            title,
            message:  msgBody,
            refId:    alertId,
            refType:  "agent_alert",
          });
        }
      }
    }

    console.log(`[Alert] 🚨 ${type.toUpperCase()} — agent: ${user.name}`);
    res.json({ success: true, alertId });
  } catch (err) {
    console.error("Alert error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/incident — Signalement incident en route (accident/panne/obstacle/controle) */
router.post("/incident", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { tripId, type, lat, lon, description } = req.body as {
      tripId?: string; type: string;
      lat?: number; lon?: number; description?: string;
    };

    if (!type) { res.status(400).json({ error: "Type requis" }); return; }

    const agentRows = await db.select({
      companyId: agentsTable.companyId,
      busId:     agentsTable.busId,
    }).from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentRow = agentRows[0];

    const incidentId = Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

    await db.insert(agentAlertsTable).values({
      id:        incidentId,
      type:      "urgence",
      agentId:   user.id,
      agentName: user.name,
      companyId: agentRow?.companyId ?? null,
      tripId:    tripId ?? null,
      busId:     agentRow?.busId ?? null,
      busName:   null,
      lat:       typeof lat === "number" ? lat : null,
      lon:       typeof lon === "number" ? lon : null,
      message:   `Incident [${type}]${description ? `: ${description}` : ""}`,
      status:    "active",
    });

    console.log(`[Incident] 🚨 ${type.toUpperCase()} — agent: ${user.name} tripId: ${tripId}`);
    res.json({ success: true, incidentId });
  } catch (err) {
    console.error("Incident error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/alerts — Historique des alertes de l'agent ── */
router.get("/alerts", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const alerts = await db.select().from(agentAlertsTable)
      .where(eq(agentAlertsTable.agentId, user.id))
      .orderBy(desc(agentAlertsTable.createdAt))
      .limit(50);

    res.json(alerts.map(a => ({
      id: a.id, type: a.type, status: a.status,
      tripId: a.tripId, busName: a.busName,
      lat: a.lat, lon: a.lon, message: a.message,
      createdAt: a.createdAt?.toISOString() ?? null,
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* GET /agent/earnings — scan stats + estimated commissions */
router.get("/earnings", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agent = agents[0];

    const now = new Date();
    const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const allScans = await db.select().from(scansTable)
      .where(and(eq(scansTable.agentId, user.id), gte(scansTable.createdAt, startOfMonth)))
      .orderBy(desc(scansTable.createdAt));

    const todayScans = allScans.filter(s => new Date(s.createdAt) >= startOfDay);
    const weekScans  = allScans.filter(s => new Date(s.createdAt) >= startOfWeek);

    const COMMISSION_PER_BOARDING = 200;
    const todayEarnings = todayScans.length * COMMISSION_PER_BOARDING;
    const weekEarnings  = weekScans.length  * COMMISSION_PER_BOARDING;
    const monthEarnings = allScans.length   * COMMISSION_PER_BOARDING;

    const byDay: Record<string, number> = {};
    for (const s of allScans) {
      const day = new Date(s.createdAt).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + COMMISSION_PER_BOARDING;
    }
    const dailyChart = Object.entries(byDay).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);

    res.json({
      agentName: user.name,
      agentRole: agent?.agentRole ?? "agent",
      today:     { scans: todayScans.length, earnings: todayEarnings },
      week:      { scans: weekScans.length,  earnings: weekEarnings  },
      month:     { scans: allScans.length,   earnings: monthEarnings },
      recentScans: allScans.slice(0, 20).map(s => ({
        id: s.id, type: s.type, ref: s.ref, status: s.status,
        commission: COMMISSION_PER_BOARDING, createdAt: s.createdAt,
      })),
      dailyChart,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/validate-qr ───────────────────────────────────────────────
   Simplified QR scan validation endpoint called by the mobile scan screen.
   Accepts { qrCode } — either a signed JSON payload or a plain bookingRef.
   Returns { valid, passenger, route, departure_time, message }.
   Records scan in scansTable and updates booking status to "validated".
─────────────────────────────────────────────────────────────────────────── */
router.post("/validate-qr", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { qrCode } = req.body as { qrCode?: string };
    if (!qrCode) { res.status(400).json({ error: "qrCode requis" }); return; }

    /* ── 1. Parse QR payload ── */
    const QR_SECRET = "GBK-CI-2026-SECURE-v1";
    const TTL_MS    = 72 * 60 * 60 * 1000;

    function djb2(str: string): string {
      let h = 5381;
      for (let i = 0; i < str.length; i++) { h = (h * 33) ^ str.charCodeAt(i); h = h >>> 0; }
      return h.toString(36).padStart(7, "0");
    }

    const raw = String(qrCode).trim();
    let ref: string;

    if (raw.startsWith("{")) {
      let payload: { ref?: string; type?: string; ts?: number; sig?: string; trajetId?: string };
      try { payload = JSON.parse(raw); } catch { res.status(400).json({ valid: false, message: "QR invalide — format incorrect" }); return; }

      const { ref: r, type, ts, sig, trajetId } = payload;
      if (!r || !type || !ts || !sig) { res.status(400).json({ valid: false, message: "QR invalide — données manquantes" }); return; }

      const sigNew = djb2(`${r}|${type}|${ts}|${trajetId ?? ""}|${QR_SECRET}`);
      const sigOld = djb2(`${r}|${type}|${ts}|${QR_SECRET}`);
      if (sig !== sigNew && sig !== sigOld) { res.status(400).json({ valid: false, message: "QR invalide — billet potentiellement falsifié" }); return; }
      if (Date.now() - ts > TTL_MS) { res.status(400).json({ valid: false, message: "QR expiré — billet trop ancien (> 72h)" }); return; }
      ref = r;
    } else {
      ref = raw.toUpperCase();
    }

    /* ── 2. Find booking by bookingRef ── */
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.bookingRef, ref)).limit(1);
    if (!bookings.length) { res.status(404).json({ valid: false, message: "Billet introuvable — référence inconnue" }); return; }

    const booking = bookings[0];

    /* ── 3. Check already used ── */
    if (booking.status === "boarded" || booking.status === "validated" as any) {
      res.status(200).json({ valid: false, message: "Billet déjà utilisé — passager déjà embarqué" });
      return;
    }

    if (booking.status === "cancelled") {
      res.status(200).json({ valid: false, message: "Billet annulé — réservation invalide" });
      return;
    }

    if (booking.paymentStatus !== "paid") {
      res.status(200).json({ valid: false, message: "Paiement non confirmé — billet non valide" });
      return;
    }

    /* ── 4. Fetch trip info ── */
    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)).limit(1);
    const trip  = trips[0];

    /* ── 5. Mark booking as validated ── */
    await db.update(bookingsTable).set({ status: "validated" as any }).where(eq(bookingsTable.id, booking.id));

    /* ── 6. Record scan ── */
    try {
      const agentRows = await db.select({ companyId: agentsTable.companyId, name: agentsTable.name })
        .from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
      await db.insert(scansTable).values({
        id:        `SCN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type:      "passager",
        ref,
        targetId:  booking.id,
        trajetId:  booking.tripId,
        agentId:   user.id,
        agentName: agentRows[0]?.name ?? user.name ?? "Agent",
        companyId: agentRows[0]?.companyId ?? null,
        status:    "validé",
      });
    } catch {}

    /* ── 7. Return success ── */
    const passengerNames = (booking.passengers as any[])?.map((p: any) => p.name).join(", ") || "Passager";
    res.json({
      valid:          true,
      type:           "passager",
      passenger:      passengerNames,
      route:          trip ? `${trip.from} → ${trip.to}` : "",
      departure_time: trip ? `${trip.date} ${trip.departureTime}` : "",
      seats:          (booking.seatNumbers as string[])?.join(", ") || "",
      message:        "Embarquement validé",
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: "Erreur serveur lors de la validation" });
  }
});

/* ══════════════════════════════════════════════════════════════════
   LOGISTIQUE MODULE — Bus management & trip tracking
   ══════════════════════════════════════════════════════════════════ */

/* ─── GET /logistique/overview ─── */
router.get("/logistique/overview", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const today = new Date().toISOString().slice(0, 10);

    // Buses — filter by company if agent has one
    const busesList = user.companyId
      ? await db.select().from(busesTable).where(eq(busesTable.companyId, user.companyId))
      : await db.select().from(busesTable).limit(100);

    // Trips today — filter by company
    const tripsRaw = user.companyId
      ? await db.select().from(tripsTable).where(and(eq(tripsTable.companyId, user.companyId), eq(tripsTable.date, today)))
      : await db.select().from(tripsTable).where(eq(tripsTable.date, today)).limit(50);

    // Parcels stats — pending/undelivered
    const allParcels = await db.execute(sql`
      SELECT status FROM parcels
      ${user.companyId ? sql`WHERE company_id = ${user.companyId}` : sql``}
    `);
    const parcelsRows = (allParcels as any).rows ?? allParcels;
    const pendingParcels = parcelsRows.filter((p: any) =>
      ["créé", "en_gare", "chargé_bus", "en_transit"].includes(p.status)
    ).length;

    // Tickets sold today
    const ticketsToday = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM bookings
      WHERE DATE(created_at) = ${today}::date
      AND status = 'confirmed'
      ${user.companyId ? sql`AND company_id = ${user.companyId}` : sql``}
    `);
    const ticketsTodayCount = Number(((ticketsToday as any).rows?.[0] ?? ticketsToday[0])?.cnt ?? 0);

    // Active alerts
    const alertsRaw = await db.select().from(agentAlertsTable)
      .where(and(
        eq(agentAlertsTable.status, "active"),
        user.companyId ? eq(agentAlertsTable.companyId, user.companyId) : sql`1=1`
      ))
      .orderBy(desc(agentAlertsTable.createdAt))
      .limit(10);

    // Auto-generate alerts for broken buses
    const brokenBuses = busesList.filter((b: any) => b.logistic_status === "en_panne" || b.logisticStatus === "en_panne");
    const generatedAlerts = brokenBuses.map((b: any) => ({
      id: `auto-panne-${b.id}`,
      type: "panne",
      busId: b.id,
      busName: b.bus_name ?? b.busName,
      message: `🚨 Bus ${b.bus_name ?? b.busName ?? b.plate_number ?? b.plateNumber} est en panne`,
      status: "active",
      createdAt: new Date().toISOString(),
    }));

    // Auto-alert for uncollected parcels (arrived > 3 days)
    const oldParcels = await db.execute(sql`
      SELECT tracking_ref, receiver_name FROM parcels
      WHERE status = 'arrivé'
      AND created_at < NOW() - INTERVAL '3 days'
      ${user.companyId ? sql`AND company_id = ${user.companyId}` : sql``}
      LIMIT 5
    `);
    const oldParcelsRows = (oldParcels as any).rows ?? oldParcels;
    const parcelAlerts = oldParcelsRows.map((p: any) => ({
      id: `auto-colis-${p.tracking_ref}`,
      type: "colis",
      message: `📦 Colis ${p.tracking_ref} non retiré depuis 3j (${p.receiver_name})`,
      status: "active",
      createdAt: new Date().toISOString(),
    }));

    // Stats
    const busStats = {
      enRoute:     busesList.filter((b: any) => (b.logistic_status ?? b.logisticStatus) === "en_route").length,
      enAttente:   busesList.filter((b: any) => (b.logistic_status ?? b.logisticStatus) === "en_attente").length,
      arrive:      busesList.filter((b: any) => (b.logistic_status ?? b.logisticStatus) === "arrivé").length,
      enPanne:     busesList.filter((b: any) => (b.logistic_status ?? b.logisticStatus) === "en_panne").length,
      total:       busesList.length,
    };

    res.json({
      stats: {
        busesEnRoute:      busStats.enRoute,
        busesEnAttente:    busStats.enAttente,
        busesEnPanne:      busStats.enPanne,
        colisEnAttente:    pendingParcels,
        ticketsVendusAuj:  ticketsTodayCount,
      },
      buses: busesList.map((b: any) => ({
        id:              b.id,
        busName:         b.bus_name ?? b.busName,
        plateNumber:     b.plate_number ?? b.plateNumber,
        busType:         b.bus_type ?? b.busType,
        capacity:        b.capacity,
        logisticStatus:  b.logistic_status ?? b.logisticStatus,
        currentLocation: b.current_location ?? b.currentLocation,
        condition:       b.condition,
        companyId:       b.company_id ?? b.companyId,
      })),
      trips: tripsRaw.map((t: any) => ({
        id:            t.id,
        from:          t.from,
        to:            t.to,
        departureTime: t.departure_time ?? t.departureTime,
        date:          t.date,
        status:        t.status,
        busId:         t.bus_id ?? t.busId,
        busName:       t.bus_name ?? t.busName,
        price:         t.price,
      })),
      alerts: [
        ...generatedAlerts,
        ...parcelAlerts,
        ...alertsRaw.map((a: any) => ({
          id:        a.id,
          type:      a.type,
          busId:     a.busId,
          busName:   a.busName,
          message:   a.message,
          status:    a.status,
          createdAt: a.createdAt?.toISOString?.() ?? a.createdAt,
        })),
      ].slice(0, 10),
    });
  } catch (err) {
    console.error("[logistique/overview]", err);
    res.status(500).json({ error: "Erreur chargement logistique" });
  }
});

/* ─── POST /logistique/buses/:busId/mettre-en-route ─── */
router.post("/logistique/buses/:busId/mettre-en-route", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { busId } = req.params;
    const { location } = req.body;

    await db.execute(sql`
      UPDATE buses SET logistic_status = 'en_route',
        current_location = ${location ?? null}
      WHERE id = ${busId}
    `);
    res.json({ success: true, busId, logisticStatus: "en_route" });
  } catch (err) {
    console.error("[logistique/mettre-en-route]", err);
    res.status(500).json({ error: "Erreur mise en route" });
  }
});

/* ─── POST /logistique/buses/:busId/marquer-arrive ─── */
router.post("/logistique/buses/:busId/marquer-arrive", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { busId } = req.params;

    await db.execute(sql`
      UPDATE buses SET logistic_status = 'arrivé',
        current_location = NULL
      WHERE id = ${busId}
    `);
    res.json({ success: true, busId, logisticStatus: "arrivé" });
  } catch (err) {
    console.error("[logistique/marquer-arrive]", err);
    res.status(500).json({ error: "Erreur marquage arrivée" });
  }
});

/* ─── POST /logistique/buses/:busId/signaler-panne ─── */
router.post("/logistique/buses/:busId/signaler-panne", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { busId } = req.params;
    const { issue, location } = req.body;

    await db.execute(sql`
      UPDATE buses SET logistic_status = 'en_panne',
        condition = 'panne',
        issue = ${issue ?? "Panne signalée par l'agent"},
        current_location = ${location ?? null}
      WHERE id = ${busId}
    `);

    // Create alert
    const alertId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    const buses = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
    const busName = (buses[0] as any)?.busName ?? busId;
    await db.insert(agentAlertsTable).values({
      id: alertId,
      type: "panne",
      agentId: user.id,
      agentName: user.name,
      companyId: user.companyId ?? undefined,
      busId,
      busName,
      message: `🚨 Panne signalée pour ${busName}${issue ? ` : ${issue}` : ""}`,
      status: "active",
    });

    res.json({ success: true, busId, logisticStatus: "en_panne", alertId });
  } catch (err) {
    console.error("[logistique/signaler-panne]", err);
    res.status(500).json({ error: "Erreur signalement panne" });
  }
});

/* ─── POST /logistique/buses/:busId/remettre-en-attente ─── */
router.post("/logistique/buses/:busId/remettre-en-attente", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }
    const { busId } = req.params;

    await db.execute(sql`
      UPDATE buses SET logistic_status = 'en_attente',
        condition = 'bon', issue = NULL
      WHERE id = ${busId}
    `);
    res.json({ success: true, busId, logisticStatus: "en_attente" });
  } catch (err) {
    console.error("[logistique/remettre-en-attente]", err);
    res.status(500).json({ error: "Erreur" });
  }
});

/* ══════════════════════════════════════════════════════════════════
   SUIVI MODULE — Real-time bus monitoring & alert system
   ══════════════════════════════════════════════════════════════════ */

/* ─── GET /suivi/overview ─── */
router.get("/suivi/overview", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const busesList = user.companyId
      ? await db.select().from(busesTable).where(eq(busesTable.companyId, user.companyId))
      : await db.select().from(busesTable).limit(100);

    const today = new Date().toISOString().slice(0, 10);
    const tripsRaw = user.companyId
      ? await db.select().from(tripsTable).where(and(eq(tripsTable.companyId, user.companyId), eq(tripsTable.date, today)))
      : await db.select().from(tripsTable).where(eq(tripsTable.date, today)).limit(50);

    const alertsRaw = await db.select().from(agentAlertsTable)
      .where(and(
        eq(agentAlertsTable.status, "active"),
        user.companyId ? eq(agentAlertsTable.companyId, user.companyId) : sql`1=1`
      ))
      .orderBy(desc(agentAlertsTable.createdAt))
      .limit(20);

    res.json({
      buses: busesList.map((b: any) => ({
        id:              b.id,
        busName:         b.bus_name ?? b.busName,
        plateNumber:     b.plate_number ?? b.plateNumber,
        logisticStatus:  b.logistic_status ?? b.logisticStatus,
        currentLocation: b.current_location ?? b.currentLocation,
        currentTripId:   b.current_trip_id ?? b.currentTripId,
        condition:       b.condition,
        issue:           b.issue,
      })),
      trips: tripsRaw.map((t: any) => ({
        id:            t.id,
        from:          t.from,
        to:            t.to,
        departureTime: t.departure_time ?? t.departureTime,
        status:        t.status,
        busId:         t.bus_id ?? t.busId,
        busName:       t.bus_name ?? t.busName,
      })),
      alerts: alertsRaw.map((a: any) => ({
        id:               a.id,
        type:             a.type,
        busId:            a.busId,
        busName:          a.busName,
        agentId:          a.agentId,
        agentName:        a.agentName,
        message:          a.message,
        status:           a.status,
        response:         a.response ?? null,
        respondedAt:      a.respondedAt?.toISOString?.() ?? null,
        responseRequested: !!(a.responseRequested ?? a.response_requested),
        createdAt:        a.createdAt?.toISOString?.() ?? a.createdAt,
      })),
    });
  } catch (err) {
    console.error("[suivi/overview]", err);
    res.status(500).json({ error: "Erreur suivi overview" });
  }
});

/* ─── POST /suivi/alerts/trigger — any agent triggers an alert for a bus ─── */
router.post("/suivi/alerts/trigger", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { busId, message } = req.body as { busId: string; message?: string };
    if (!busId) { res.status(400).json({ error: "busId requis" }); return; }

    const buses = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
    const busName = (buses[0] as any)?.busName ?? (buses[0] as any)?.bus_name ?? busId;

    const alertId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await db.insert(agentAlertsTable).values({
      id: alertId,
      type: "alerte",
      agentId: user.id,
      agentName: user.name,
      companyId: user.companyId ?? undefined,
      busId,
      busName,
      message: message ?? `⚠️ Alerte déclenchée par ${user.name} pour ${busName}`,
      status: "active",
    });

    res.status(201).json({ success: true, alertId, busId, busName });
  } catch (err) {
    console.error("[suivi/alerts/trigger]", err);
    res.status(500).json({ error: "Erreur déclenchement alerte" });
  }
});

/* ─── POST /suivi/alerts/:id/respond — bus agent responds to alert ─── */
router.post("/suivi/alerts/:id/respond", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    const { response } = req.body as { response: "panne" | "controle" | "pause" };
    if (!["panne", "controle", "pause"].includes(response)) {
      res.status(400).json({ error: "Réponse invalide (panne | controle | pause)" }); return;
    }

    await db.execute(sql`
      UPDATE agent_alerts
      SET response = ${response}, responded_at = NOW()
      WHERE id = ${id}
    `);

    // If panne, update bus status
    if (response === "panne") {
      const alertRow = await db.select().from(agentAlertsTable).where(eq(agentAlertsTable.id, id)).limit(1);
      if (alertRow[0]?.busId) {
        await db.execute(sql`
          UPDATE buses SET logistic_status = 'en_panne', condition = 'panne'
          WHERE id = ${alertRow[0].busId}
        `);
      }
    }

    res.json({ success: true, alertId: id, response });
  } catch (err) {
    console.error("[suivi/alerts/respond]", err);
    res.status(500).json({ error: "Erreur réponse alerte" });
  }
});

/* ─── POST /suivi/alerts/:id/confirm — suivi agent confirms/resolves alert ─── */
router.post("/suivi/alerts/:id/confirm", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    await db.execute(sql`
      UPDATE agent_alerts
      SET status = 'resolue', resolved_at = NOW(), resolved_by = ${user.name}
      WHERE id = ${id}
    `);

    res.json({ success: true, alertId: id, status: "resolue" });
  } catch (err) {
    console.error("[suivi/alerts/confirm]", err);
    res.status(500).json({ error: "Erreur confirmation alerte" });
  }
});

/* ══════════════════════════════════════════════════════════════════
   DÉPARTS — Programmation et gestion des départs (logistique)
   ══════════════════════════════════════════════════════════════════ */

/* ─── GET /agent/logistique/departures — list departures for company ─── */
router.get("/logistique/departures", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const rows = user.companyId
      ? await db.select().from(departuresTable).where(eq(departuresTable.companyId, user.companyId)).orderBy(desc(departuresTable.createdAt)).limit(50)
      : await db.select().from(departuresTable).orderBy(desc(departuresTable.createdAt)).limit(50);

    // Enrich with bus info
    const busIds = [...new Set(rows.map(r => r.busId).filter(Boolean))] as string[];
    const buses = busIds.length
      ? await db.select().from(busesTable).where(inArray(busesTable.id, busIds))
      : [];
    const busMap = Object.fromEntries(buses.map((b: any) => [b.id, b]));

    res.json(rows.map(r => ({
      id:            r.id,
      busId:         r.busId,
      busName:       (r.busId && busMap[r.busId] as any)?.busName ?? (r.busId && busMap[r.busId] as any)?.bus_name ?? "—",
      plateNumber:   (r.busId && busMap[r.busId] as any)?.plateNumber ?? (r.busId && busMap[r.busId] as any)?.plate_number ?? "—",
      villeDepart:   r.villeDepart,
      villeArrivee:  r.villeArrivee,
      heureDepart:   r.heureDepart,
      chauffeurNom:  r.chauffeurNom,
      agentRouteNom: r.agentRouteNom,
      statut:        r.statut,
      notes:         r.notes,
      createdAt:     r.createdAt?.toISOString?.() ?? r.createdAt,
    })));
  } catch (err) {
    console.error("[logistique/departures GET]", err);
    res.status(500).json({ error: "Erreur chargement départs" });
  }
});

/* ─── POST /agent/logistique/departures — create a new departure ─── */
router.post("/logistique/departures", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { busId, villeDepart, villeArrivee, heureDepart, chauffeurNom, agentRouteNom, notes } = req.body as {
      busId?: string; villeDepart: string; villeArrivee: string; heureDepart: string;
      chauffeurNom?: string; agentRouteNom?: string; notes?: string;
    };

    if (!villeDepart || !villeArrivee || !heureDepart) {
      res.status(400).json({ error: "villeDepart, villeArrivee et heureDepart sont requis" }); return;
    }

    const id = `dep_${Date.now()}${Math.random().toString(36).substr(2, 5)}`;
    await db.insert(departuresTable).values({
      id,
      busId: busId ?? null,
      villeDepart,
      villeArrivee,
      heureDepart,
      chauffeurNom: chauffeurNom ?? null,
      agentRouteNom: agentRouteNom ?? null,
      companyId: user.companyId ?? undefined,
      statut: "programmé",
      notes: notes ?? null,
    });

    // Update bus status to "programmé" if busId provided
    if (busId) {
      await db.execute(sql`
        UPDATE buses SET logistic_status = 'programmé' WHERE id = ${busId}
      `);
    }

    res.status(201).json({ success: true, id, villeDepart, villeArrivee, heureDepart });
  } catch (err) {
    console.error("[logistique/departures POST]", err);
    res.status(500).json({ error: "Erreur création départ" });
  }
});

/* ─── PATCH /agent/logistique/departures/:id — update departure status ─── */
router.patch("/logistique/departures/:id", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    const { statut, notes } = req.body as { statut?: string; notes?: string };

    const updates: Record<string, any> = { updated_at: new Date() };
    if (statut) updates.statut = statut;
    if (notes)  updates.notes  = notes;

    await db.execute(sql`
      UPDATE departures SET
        statut = COALESCE(${statut ?? null}, statut),
        notes  = COALESCE(${notes  ?? null}, notes),
        updated_at = NOW()
      WHERE id = ${id}
    `);

    // Sync bus status
    if (statut) {
      const dep = await db.select().from(departuresTable).where(eq(departuresTable.id, id)).limit(1);
      if (dep[0]?.busId) {
        const busStatut = statut === "en route" ? "en_route" : statut === "terminé" ? "arrivé" : null;
        if (busStatut) {
          await db.execute(sql`UPDATE buses SET logistic_status = ${busStatut} WHERE id = ${dep[0].busId}`);
        }
      }
    }

    res.json({ success: true, id, statut });
  } catch (err) {
    console.error("[logistique/departures PATCH]", err);
    res.status(500).json({ error: "Erreur mise à jour départ" });
  }
});

/* ─── PATCH /agent/logistique/buses/:id/statut — directly change bus status ─── */
router.patch("/logistique/buses/:id/statut", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    const { statut } = req.body as { statut: string };
    const allowed = ["disponible", "en_attente", "programmé", "en_route", "arrivé", "en_panne", "en_maintenance"];
    if (!allowed.includes(statut)) {
      res.status(400).json({ error: "Statut invalide" }); return;
    }

    await db.execute(sql`UPDATE buses SET logistic_status = ${statut} WHERE id = ${id}`);
    res.json({ success: true, busId: id, statut });
  } catch (err) {
    console.error("[logistique/buses/statut]", err);
    res.status(500).json({ error: "Erreur changement statut" });
  }
});

/* ══════════════════════════════════════════════════════════════════
   GUICHET — créer des départs (trips) avec quotas de places
   ══════════════════════════════════════════════════════════════════ */

/* ─── GET /agent/guichet/buses — fleet buses accessible au guichet ─── */
router.get("/guichet/buses", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agent = agentRows[0];
    if (!agent?.companyId) { res.json([]); return; }

    const buses = await db.select().from(busesTable).where(eq(busesTable.companyId, agent.companyId));
    res.json(buses.map(b => ({
      id: b.id,
      busName: b.busName,
      plateNumber: b.plateNumber,
      busType: b.busType,
      capacity: b.capacity,
      logisticStatus: b.logisticStatus,
    })));
  } catch (err) {
    console.error("[guichet/buses]", err);
    res.status(500).json({ error: "Erreur chargement bus" });
  }
});

/* ─── POST /agent/guichet/departures — guichet crée un départ (trip) ─── */
router.post("/guichet/departures", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agent = agentRows[0];

    const { busId, from, to, date, departureTime, price, guichetSeats, onlineSeats, chauffeurNom, agentRouteNom } = req.body as {
      busId?: string; from: string; to: string; date: string;
      departureTime: string; price: number; guichetSeats?: number;
      onlineSeats?: number; chauffeurNom?: string; agentRouteNom?: string;
    };

    if (!from || !to || !date || !departureTime || !price) {
      res.status(400).json({ error: "Champs requis : from, to, date, departureTime, price" }); return;
    }

    const busRows = busId ? await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1) : [];
    const bus = busRows[0];

    const gSeats = parseInt(String(guichetSeats ?? 0)) || 0;
    const oSeats = parseInt(String(onlineSeats ?? 0)) || 0;
    const totalSeats = gSeats + oSeats || bus?.capacity || 44;

    if (bus && (gSeats + oSeats) > bus.capacity) {
      res.status(400).json({ error: `Total places (${gSeats + oSeats}) dépasse la capacité du bus (${bus.capacity})` }); return;
    }

    const id = `trip_${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
    await db.insert(tripsTable).values({
      id,
      from: from.trim(),
      to: to.trim(),
      date: date.trim(),
      departureTime: departureTime.trim(),
      arrivalTime: "—",
      price: parseFloat(String(price)),
      busType: bus?.busType ?? "Standard",
      busName: bus?.busName ?? (chauffeurNom ?? "—"),
      totalSeats,
      guichetSeats: gSeats,
      onlineSeats: oSeats,
      busId: busId ?? null,
      companyId: agent?.companyId ?? null,
      agentId: agent?.id ?? null,
      status: "scheduled",
      duration: "—",
    });

    res.status(201).json({ success: true, id, message: "Départ programmé avec succès" });
  } catch (err) {
    console.error("[guichet/departures POST]", err);
    res.status(500).json({ error: "Erreur création départ" });
  }
});

/* ══════════════════════════════════════════════════════════════════
   SUIVI — demander réponse à l'agent en route
   ══════════════════════════════════════════════════════════════════ */

/* ─── POST /suivi/alerts/:id/demander-reponse ─── */
router.post("/suivi/alerts/:id/demander-reponse", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    await db.execute(sql`
      UPDATE agent_alerts
      SET response_requested = TRUE, response_requested_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ success: true, alertId: id, responseRequested: true });
  } catch (err) {
    console.error("[suivi/alerts/demander-reponse]", err);
    res.status(500).json({ error: "Erreur demande réponse" });
  }
});

/* ══════════════════════════════════════════════════════════════════
   AGENT EN ROUTE — voir son départ + alertes + répondre
   ══════════════════════════════════════════════════════════════════ */

/* ─── POST /agent/route/manual-booking — en-route agent creates a manual reservation ─── */
router.post("/route/manual-booking", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { passengerName, passengerPhone, boardingPoint, seatCount } = req.body as {
      passengerName: string;
      passengerPhone: string;
      boardingPoint?: string;
      seatCount?: number;
    };

    if (!passengerName?.trim()) { res.status(400).json({ error: "Nom du passager requis" }); return; }
    if (!passengerPhone?.trim()) { res.status(400).json({ error: "Téléphone du passager requis" }); return; }

    const count = Math.max(1, Math.min(seatCount ?? 1, 10));

    /* Find agent's assigned trip */
    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agent = agentRows[0];
    const tripId = agent?.tripId ?? null;
    if (!tripId) { res.status(400).json({ error: "Aucun trajet assigné à cet agent en route. Contactez votre compagnie." }); return; }

    const tripRows = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    const trip = tripRows[0];
    if (!trip) { res.status(404).json({ error: "Trajet introuvable" }); return; }

    /* Generate booking reference */
    const bookingRef = `MAN-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    /* Build passengers array */
    const passengers = Array.from({ length: count }, (_, i) =>
      i === 0 ? { name: passengerName.trim(), phone: passengerPhone.trim() } : { name: `${passengerName.trim()} +${i}` }
    );

    /* Create the booking */
    const bookingId = `MAN${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const [booking] = await db.insert(bookingsTable).values({
      id: bookingId,
      bookingRef,
      tripId,
      companyId: agent.companyId ?? trip.companyId ?? null,
      userId: user.id,
      status: "confirmed",
      bookingSource: "guichet",
      paymentStatus: "paid",
      paymentMethod: "cash",
      totalAmount: (trip.price ?? 0) * count,
      contactPhone: passengerPhone.trim(),
      contactEmail: "",
      passengers: passengers as any,
      seatNumbers: [],
    } as any).returning();

    /* SMS to passenger */
    sendSMS(passengerPhone.trim(),
      `🚌 GoBooking : Bienvenue à bord ! Votre réservation ${bookingRef} a été enregistrée sur le trajet ${trip.from} → ${trip.to}. Bon voyage !`
    );

    /* Notify agent réservation (push or SMS via company) */
    try {
      const companyId = agent.companyId ?? trip.companyId;
      if (companyId) {
        const resAgents = await db.select().from(agentsTable).where(and(
          eq(agentsTable.companyId, companyId),
          eq(agentsTable.agentRole, "agent_reservation")
        )).limit(3);
        for (const ra of resAgents) {
          const raUser = await db.select().from(usersTable).where(eq(usersTable.id, ra.userId)).limit(1);
          if (raUser[0]?.phone) {
            sendSMS(raUser[0].phone,
              `🚌 GoBooking [Réservation] : Montée en cours de route — ${passengerName} (${count} pax). Trajet ${trip.from} → ${trip.to}. Tél: ${passengerPhone}. Réf: ${bookingRef}.`
            );
          }
        }
      }
    } catch {} // non-blocking

    res.json({
      success: true,
      bookingRef: booking.bookingRef,
      bookingId: booking.id,
      trip: { from: trip.from, to: trip.to, departureTime: trip.departureTime },
      passengerName: passengerName.trim(),
      passengerPhone: passengerPhone.trim(),
      boardingPoint: boardingPoint?.trim() ?? null,
      seatCount: count,
      totalAmount: (trip.price ?? 0) * count,
    });
  } catch (err) {
    console.error("[route/manual-booking]", err);
    res.status(500).json({ error: "Erreur création réservation manuelle" });
  }
});

/* ─── GET /agent/route/manual-bookings — list manual bookings for agent's trip ─── */
router.get("/route/manual-bookings", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const tripId = agentRows[0]?.tripId ?? null;
    if (!tripId) { res.json([]); return; }

    const bookings = await db.select().from(bookingsTable)
      .where(and(
        eq(bookingsTable.tripId, tripId),
        eq(bookingsTable.bookingSource, "guichet")
      ))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(30);

    res.json(bookings.map(b => ({
      id: b.id,
      bookingRef: b.bookingRef,
      passengers: b.passengers,
      contactPhone: b.contactPhone,
      seatNumbers: b.seatNumbers,
      totalAmount: b.totalAmount,
      status: b.status,
      boardingPoint: (b as any).boardingPoint ?? null,
      createdAt: b.createdAt?.toISOString?.() ?? b.createdAt,
    })));
  } catch (err) {
    console.error("[route/manual-bookings]", err);
    res.status(500).json({ error: "Erreur" });
  }
});

/* ─── GET /agent/route/my-departure — route agent sees their departure ─── */
router.get("/route/my-departure", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    // Find departure for this agent (by agentRouteId) or by bus assigned to user
    const busId = user.busId ?? null;

    let departure: any = null;

    // First try: find by agentRouteId
    const byAgent = await db.select().from(departuresTable)
      .where(eq(departuresTable.agentRouteId, user.id))
      .orderBy(desc(departuresTable.createdAt)).limit(1);
    if (byAgent.length) departure = byAgent[0];

    // Second try: find by busId
    if (!departure && busId) {
      const byBus = await db.select().from(departuresTable)
        .where(and(eq(departuresTable.busId, busId), sql`statut NOT IN ('terminé')`))
        .orderBy(desc(departuresTable.createdAt)).limit(1);
      if (byBus.length) departure = byBus[0];
    }

    // Third try: find by companyId (latest active)
    if (!departure && user.companyId) {
      const byCompany = await db.select().from(departuresTable)
        .where(and(eq(departuresTable.companyId, user.companyId), sql`statut NOT IN ('terminé')`))
        .orderBy(desc(departuresTable.createdAt)).limit(1);
      if (byCompany.length) departure = byCompany[0];
    }

    // Get bus info
    let bus: any = null;
    if (departure?.busId) {
      const buses = await db.select().from(busesTable).where(eq(busesTable.id, departure.busId)).limit(1);
      bus = buses[0] ?? null;
    } else if (busId) {
      const buses = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
      bus = buses[0] ?? null;
    }

    // Get active alerts for this bus
    const alertBusId = departure?.busId ?? busId;
    const alerts = alertBusId
      ? await db.select().from(agentAlertsTable)
          .where(and(eq(agentAlertsTable.busId, alertBusId), eq(agentAlertsTable.status, "active")))
          .orderBy(desc(agentAlertsTable.createdAt)).limit(10)
      : [];

    res.json({
      departure: departure ? {
        id:            departure.id,
        busId:         departure.busId,
        busName:       (bus as any)?.busName ?? (bus as any)?.bus_name ?? "—",
        plateNumber:   (bus as any)?.plateNumber ?? (bus as any)?.plate_number ?? "—",
        villeDepart:   departure.villeDepart,
        villeArrivee:  departure.villeArrivee,
        heureDepart:   departure.heureDepart,
        chauffeurNom:  departure.chauffeurNom,
        agentRouteNom: departure.agentRouteNom,
        statut:        departure.statut,
        notes:         departure.notes,
        createdAt:     departure.createdAt?.toISOString?.() ?? departure.createdAt,
      } : null,
      bus: bus ? {
        id:             bus.id,
        busName:        (bus as any).busName ?? (bus as any).bus_name,
        plateNumber:    (bus as any).plateNumber ?? (bus as any).plate_number,
        logisticStatus: (bus as any).logisticStatus ?? (bus as any).logistic_status,
        currentLocation:(bus as any).currentLocation ?? (bus as any).current_location,
      } : null,
      alerts: alerts.map((a: any) => ({
        id:               a.id,
        type:             a.type,
        message:          a.message,
        status:           a.status,
        response:         a.response ?? null,
        responseRequested: (a as any).responseRequested ?? (a as any).response_requested ?? false,
        respondedAt:      a.respondedAt?.toISOString?.() ?? null,
        createdAt:        a.createdAt?.toISOString?.() ?? a.createdAt,
      })),
    });
  } catch (err) {
    console.error("[route/my-departure]", err);
    res.status(500).json({ error: "Erreur chargement départ" });
  }
});

/* ─── POST /agent/route/alerts/:id/respond — route agent responds to alert ─── */
router.post("/route/alerts/:id/respond", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    const { response } = req.body as { response: "panne" | "controle" | "pause" };
    if (!["panne", "controle", "pause"].includes(response)) {
      res.status(400).json({ error: "Réponse invalide (panne | controle | pause)" }); return;
    }

    await db.execute(sql`
      UPDATE agent_alerts
      SET response = ${response}, responded_at = NOW()
      WHERE id = ${id}
    `);

    if (response === "panne") {
      const alertRow = await db.select().from(agentAlertsTable).where(eq(agentAlertsTable.id, id)).limit(1);
      if (alertRow[0]?.busId) {
        await db.execute(sql`UPDATE buses SET logistic_status = 'en_panne', condition = 'panne' WHERE id = ${alertRow[0].busId}`);
      }
    }

    res.json({ success: true, alertId: id, response });
  } catch (err) {
    console.error("[route/alerts/respond]", err);
    res.status(500).json({ error: "Erreur réponse alerte" });
  }
});

/* ─── PATCH /agent/buses/:busId/update — agent updates bus logistic status & location ─── */
router.patch("/buses/:busId/update", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { busId } = req.params;
    const { logisticStatus, currentLocation, currentTripId } = req.body;

    const bus = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
    if (!bus.length) { res.status(404).json({ error: "Bus introuvable" }); return; }

    if (!logisticStatus && currentLocation === undefined && currentTripId === undefined) {
      res.status(400).json({ error: "Aucune donnée à mettre à jour" }); return;
    }

    const existingBus = bus[0] as any;
    await db.execute(sql`
      UPDATE buses SET
        logistic_status  = ${logisticStatus   ?? existingBus.logistic_status ?? "en_attente"},
        current_location = ${currentLocation  ?? null},
        current_trip_id  = ${currentTripId    ?? null}
      WHERE id = ${busId}
    `);

    res.json({ success: true, busId, updated: { logisticStatus, currentLocation, currentTripId } });
  } catch (err) {
    console.error("[agent/buses/update]", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE AGENT BAGAGE
   GET  /agent/bagage/trips         — départs d'aujourd'hui avec nb bagages
   GET  /agent/bagage/booking/:ref  — lookup passager par booking ref
   GET  /agent/bagage/items/:tripId — liste des bagages pour un départ
   POST /agent/bagage/items         — créer un bagage item + photo optionnelle
   PATCH /agent/bagage/items/:id    — mettre à jour status
═══════════════════════════════════════════════════════════════════════════ */

/* ─── GET /agent/bagage/trips ─── */
router.get("/bagage/trips", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const companyId = agentRows[0]?.companyId ?? null;

    const today     = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

    let trips = companyId
      ? await db.select().from(tripsTable).where(eq(tripsTable.companyId, companyId)).orderBy(desc(tripsTable.date)).limit(40)
      : await db.select().from(tripsTable).orderBy(desc(tripsTable.date)).limit(20);

    trips = trips.filter(t =>
      (t.date === today || t.date === yesterday) &&
      !["arrived", "cancelled"].includes(t.status ?? "")
    );

    const enriched = await Promise.all(trips.map(async (trip) => {
      const bookings = await db.select().from(bookingsTable)
        .where(and(
          eq(bookingsTable.tripId, trip.id),
          inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé"])
        ));
      const withBagage  = bookings.filter(b => (b as any).baggage_count > 0 || ((b.bagages as any[] ?? []).length > 0));
      const bagageItems = await db.select().from(bagageItemsTable).where(eq(bagageItemsTable.tripId, trip.id));
      return {
        id:              trip.id,
        from:            trip.from,
        to:              trip.to,
        date:            trip.date,
        departureTime:   trip.departureTime,
        busName:         trip.busName,
        busType:         trip.busType,
        status:          trip.status,
        totalPassengers: bookings.length,
        passengersWithBagage: withBagage.length,
        bagageItemCount: bagageItems.length,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("[bagage/trips]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/bagage/booking/:ref ─── */
router.get("/bagage/booking/:ref", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const ref = req.params.ref?.trim().toUpperCase();
    const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.bookingRef, ref)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Réservation non trouvée" }); return; }
    const b = rows[0];

    const userRow = await db.select().from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
    const tripRow = await db.select().from(tripsTable).where(eq(tripsTable.id, b.tripId)).limit(1);

    const existingBagages = await db.select().from(bagageItemsTable)
      .where(eq(bagageItemsTable.bookingId, b.id))
      .orderBy(desc(bagageItemsTable.createdAt));

    res.json({
      bookingId:       b.id,
      bookingRef:      b.bookingRef,
      passengerName:   userRow[0]?.name ?? "Inconnu",
      passengerPhone:  userRow[0]?.phone ?? "",
      tripId:          b.tripId,
      from:            tripRow[0]?.from ?? "",
      to:              tripRow[0]?.to ?? "",
      departureTime:   tripRow[0]?.departureTime ?? "",
      date:            tripRow[0]?.date ?? "",
      status:          b.status,
      bagageStatus:    (b as any).bagage_status ?? "en_attente",
      existingBagages: existingBagages,
      declaresOnline:  (b as any).baggage_count > 0,
      declarationType: (b as any).baggage_type ?? null,
    });
  } catch (err) {
    console.error("[bagage/booking/:ref]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/bagage/items/:tripId ─── */
router.get("/bagage/items/:tripId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const items = await db.select().from(bagageItemsTable)
      .where(eq(bagageItemsTable.tripId, req.params.tripId))
      .orderBy(desc(bagageItemsTable.createdAt));

    res.json(items);
  } catch (err) {
    console.error("[bagage/items/:tripId]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/bagage/items ─── */
router.post("/bagage/items", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { bookingId, tripId, passengerName, passengerPhone, bookingRef,
            bagageType, description, weightKg, price, paymentMethod,
            notes, photoBase64 } = req.body;

    if (!bookingId || !tripId || !passengerName) {
      res.status(400).json({ error: "bookingId, tripId, passengerName requis" });
      return;
    }

    const agentRows  = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const companyId  = agentRows[0]?.companyId ?? null;
    const agentId    = user.id;

    // Generate tracking ref
    const prefix    = "BG";
    const random    = Math.random().toString(36).toUpperCase().substr(2, 8);
    const trackingRef = `${prefix}${random}`;

    // Upload photo if provided
    let photoUrl: string | null = null;
    if (photoBase64) {
      try {
        const { uploadParcelPhoto } = await import("../lib/photoStorage");
        photoUrl = await uploadParcelPhoto(photoBase64, `bagage_${trackingRef}`);
      } catch (e) {
        console.error("[bagage photo upload]", e);
      }
    }

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await db.insert(bagageItemsTable).values({
      id,
      trackingRef,
      bookingId,
      tripId,
      agentId,
      companyId,
      passengerName,
      passengerPhone:   passengerPhone ?? null,
      bookingRef:       bookingRef ?? null,
      bagageType:       bagageType ?? "valise",
      description:      description ?? null,
      weightKg:         weightKg ?? null,
      price:            price ?? 0,
      paymentMethod:    paymentMethod ?? "espèces",
      paymentStatus:    "payé",
      photoUrl,
      status:           "accepté",
      notes:            notes ?? null,
    } as any);

    // Update booking bagage_status
    await db.execute(sql`
      UPDATE bookings SET bagage_status = 'accepté', bagage_price = ${price ?? 0}
      WHERE id = ${bookingId}
    `);
    recordTripAgent(tripId, user.id).catch(() => {});

    res.json({ success: true, id, trackingRef, photoUrl });
  } catch (err) {
    console.error("[bagage/items POST]", err);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du bagage" });
  }
});

/* ─── PATCH /agent/bagage/items/:id ─── */
router.patch("/bagage/items/:id", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { status, notes } = req.body;
    await db.execute(sql`
      UPDATE bagage_items
      SET status = ${status ?? "accepté"},
          notes  = ${notes ?? null}
      WHERE id = ${req.params.id}
    `);

    res.json({ success: true });
  } catch (err) {
    console.error("[bagage/items PATCH]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE AGENT VALIDATION DÉPART
   GET  /agent/validation-depart/trips          — départs du jour à valider
   GET  /agent/validation-depart/trip/:tripId   — bordereau complet
   POST /agent/validation-depart/expenses       — ajouter dépense
   POST /agent/validation-depart/validate/:id   — valider le départ
═══════════════════════════════════════════════════════════════════════════ */

/* ─── GET /agent/validation-depart/trips ─── */
router.get("/validation-depart/trips", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const companyId = agentRows[0]?.companyId ?? null;

    const today     = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

    let trips = companyId
      ? await db.select().from(tripsTable).where(eq(tripsTable.companyId, companyId)).orderBy(desc(tripsTable.date)).limit(50)
      : await db.select().from(tripsTable).orderBy(desc(tripsTable.date)).limit(30);

    trips = trips.filter(t =>
      (t.date === today || t.date === yesterday) &&
      !["arrived", "cancelled"].includes(t.status ?? "")
    );

    const enriched = await Promise.all(trips.map(async (trip) => {
      const bookings = await db.select().from(bookingsTable).where(and(
        eq(bookingsTable.tripId, trip.id),
        inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé", "absent"])
      ));
      const boarded   = bookings.filter(b => ["boarded", "validated"].includes(b.status ?? ""));
      const absents   = bookings.filter(b => ["confirmed", "payé", "absent"].includes(b.status ?? ""));
      const bagages   = await db.select().from(bagageItemsTable).where(eq(bagageItemsTable.tripId, trip.id));
      const colis     = await db.select().from(parcelsTable).where(and(
        eq(parcelsTable.tripId, trip.id),
        inArray(parcelsTable.status as any, ["en_gare", "chargé_bus", "en_transit"])
      ));
      const expenses  = await db.select().from(tripExpensesTable).where(eq(tripExpensesTable.tripId, trip.id));
      const totalExp  = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

      return {
        id: trip.id, from: trip.from, to: trip.to,
        date: trip.date, departureTime: trip.departureTime,
        busName: trip.busName, busType: trip.busType,
        status: trip.status,
        totalPassengers: bookings.length,
        boardedCount:    boarded.length,
        absentCount:     absents.length,
        bagageCount:     bagages.length,
        colisCount:      colis.length,
        expenseTotal:    totalExp,
        isValidated:     trip.status === "en_route",
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("[validation-depart/trips]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/validation-depart/trip/:tripId ─── */
router.get("/validation-depart/trip/:tripId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;
    const tripRows = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!tripRows.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = tripRows[0];

    const bookings = await db.select().from(bookingsTable).where(and(
      eq(bookingsTable.tripId, tripId),
      inArray(bookingsTable.status, ["confirmed", "boarded", "validated", "payé", "absent"])
    ));

    const passengerDetails = await Promise.all(bookings.map(async (b) => {
      const uRows = await db.select({ name: usersTable.name, phone: usersTable.phone })
        .from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
      return {
        bookingId:  b.id,
        bookingRef: b.bookingRef,
        name:       uRows[0]?.name ?? "Inconnu",
        phone:      uRows[0]?.phone ?? "",
        status:     b.status,
        seatNums:   b.seatNumbers ?? [],
        price:      (b as any).total_price ?? (b as any).totalPrice ?? 0,
        bagageStatus: (b as any).bagage_status ?? null,
      };
    }));

    const bagages = await db.select().from(bagageItemsTable).where(eq(bagageItemsTable.tripId, tripId));
    const colis   = await db.select().from(parcelsTable).where(and(
      eq(parcelsTable.tripId, tripId),
      inArray(parcelsTable.status as any, ["en_gare", "chargé_bus", "en_transit"])
    ));
    const expenses = await db.select().from(tripExpensesTable).where(eq(tripExpensesTable.tripId, tripId));

    // Agents en service sur ce départ
    const agentsResult = await db.execute(sql`
      SELECT user_id, agent_role, name, contact, recorded_at
      FROM trip_agents
      WHERE trip_id = ${tripId}
      ORDER BY recorded_at ASC
    `);
    const tripAgents = (agentsResult as any).rows ?? [];

    const boarded  = passengerDetails.filter(p => ["boarded","validated"].includes(p.status ?? ""));
    const absents  = passengerDetails.filter(p => ["confirmed","payé","absent"].includes(p.status ?? ""));
    const totalBagageRevenue = bagages.reduce((s, b) => s + (b.price ?? 0), 0);
    const totalColisRevenue  = colis.reduce((s, c) => s + (c.amount ?? 0), 0);
    const totalExpenses      = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
    const totalPassengerRevenue = boarded.reduce((s, p) => s + (p.price ?? 0), 0);

    res.json({
      trip: {
        id: trip.id, from: trip.from, to: trip.to,
        date: trip.date, departureTime: trip.departureTime,
        busName: trip.busName, busType: trip.busType, status: trip.status,
      },
      passengers:    passengerDetails,
      boarded,
      absents,
      bagages,
      colis,
      expenses,
      agents: tripAgents,
      summary: {
        totalPassengers:       passengerDetails.length,
        boardedCount:          boarded.length,
        absentCount:           absents.length,
        bagageCount:           bagages.length,
        colisCount:            colis.length,
        totalPassengerRevenue,
        totalBagageRevenue,
        totalColisRevenue,
        totalExpenses,
        netRevenue: totalPassengerRevenue + totalBagageRevenue + totalColisRevenue - totalExpenses,
      },
    });
  } catch (err) {
    console.error("[validation-depart/trip/:id]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/validation-depart/expenses ─── */
router.post("/validation-depart/expenses", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { tripId, type, amount, description } = req.body;
    if (!tripId || !amount) { res.status(400).json({ error: "tripId et amount requis" }); return; }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const companyId = agentRows[0]?.companyId;
    if (!companyId) { res.status(400).json({ error: "Agent sans compagnie" }); return; }

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await db.insert(tripExpensesTable).values({
      id, companyId, tripId,
      type:        type ?? "autre",
      amount:      parseInt(amount),
      description: description ?? null,
    } as any);
    recordTripAgent(tripId, user.id).catch(() => {});

    res.json({ success: true, id });
  } catch (err) {
    console.error("[validation-depart/expenses]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/trips/:tripId/transit-join — Prise en charge d'un trajet en route par une autre agence ─── */
router.post("/trips/:tripId/transit-join", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { tripId } = req.params;
    const tripRows = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!tripRows.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = tripRows[0];

    if (!["en_route", "scheduled", "confirmed"].includes(trip.status ?? "")) {
      res.status(400).json({ error: "Ce trajet n'est pas actif ou en route" }); return;
    }

    const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agent = agentRows[0];

    await recordTripAgent(tripId, user.id);

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      "TRANSIT_JOIN", tripId, "trip",
      { tripId, agenceId: agent?.agenceId, agenceName: agent?.agenceName, agenceCity: agent?.agenceCity }
    ).catch(() => {});

    res.json({
      success: true,
      message: "Prise en charge enregistrée avec succès",
      tripId,
      from: trip.from,
      to: trip.to,
      status: trip.status,
      agentName: user.name,
    });
  } catch (err) {
    console.error("[transit-join]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/validation-depart/validate/:tripId ─── */
router.post("/validation-depart/validate/:tripId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;
    const tripRows = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!tripRows.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = tripRows[0];

    if (trip.status === "en_route") {
      res.status(400).json({ error: "Ce départ est déjà validé" }); return;
    }

    /* 0. Enregistrer l'agent validation départ */
    recordTripAgent(tripId, user.id).catch(() => {});

    /* 1. Set trip en_route */
    await db.execute(sql`UPDATE trips SET status = 'en_route', started_at = NOW() WHERE id = ${tripId}`);

    /* 2. Mark absent passengers (confirmed but not boarded) */
    await db.execute(sql`
      UPDATE bookings SET status = 'absent'
      WHERE trip_id = ${tripId}
        AND status IN ('confirmed', 'payé')
    `);

    /* 3. Transition colis en_gare → en_transit */
    await db.execute(sql`
      UPDATE parcels SET status = 'en_transit', status_updated_at = NOW()
      WHERE trip_id = ${tripId}
        AND status IN ('en_gare', 'chargé_bus')
    `);

    /* 4. Mark bagage items as chargé */
    await db.execute(sql`
      UPDATE bagage_items SET status = 'chargé'
      WHERE trip_id = ${tripId}
        AND status = 'accepté'
    `);

    /* 5. Build bordereau for response */
    const bookings  = await db.select().from(bookingsTable).where(eq(bookingsTable.tripId, tripId));
    const bagages   = await db.select().from(bagageItemsTable).where(eq(bagageItemsTable.tripId, tripId));
    const colis     = await db.select().from(parcelsTable).where(eq(parcelsTable.tripId, tripId));
    const expenses  = await db.select().from(tripExpensesTable).where(eq(tripExpensesTable.tripId, tripId));

    const boarded   = bookings.filter(b => ["boarded","validated"].includes(b.status ?? ""));
    const absents   = bookings.filter(b => b.status === "absent");

    /* 6. Notify boarded passengers */
    for (const b of boarded) {
      const uRows = await db.select({ pushToken: usersTable.pushToken })
        .from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
      sendExpoPush(
        uRows[0]?.pushToken,
        `🚌 GoBooking — Départ en cours`,
        `Votre bus ${trip.from} → ${trip.to} est en route ! Bon voyage.`
      ).catch(() => {});
    }

    /* 6b. Notify agent_ticket agents of the company → "Impression prête" */
    if (trip.companyId) {
      const ticketAgents = await db
        .select({ userId: agentsTable.userId })
        .from(agentsTable)
        .where(and(
          eq(agentsTable.companyId, trip.companyId),
          inArray(agentsTable.agentRole, ["agent_ticket", "guichet", "vente"]),
        ));
      for (const ta of ticketAgents) {
        const [taUser] = await db.select({ pushToken: usersTable.pushToken })
          .from(usersTable).where(eq(usersTable.id, ta.userId)).limit(1);
        const nid = Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
        await db.insert(notificationsTable).values({
          id: nid, userId: ta.userId,
          type: "validation_complete",
          title: `✅ Départ validé — Impression prête`,
          message: `${trip.from} → ${trip.to} (${trip.departureTime}) validé. Feuille de route disponible dans l'onglet Impression.`,
          refId: tripId, refType: "trip",
        }).catch(() => {});
        sendExpoPush(taUser?.pushToken, `✅ Départ validé — Impression prête`,
          `${trip.from} → ${trip.to} est en route. Imprimez la feuille de route.`).catch(() => {});
      }
    }

    /* 7. Audit */
    auditLog(
      { userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.BOOKING_VALIDATE ?? "DEPARTURE_VALIDATED", tripId, "trip",
      { from: trip.from, to: trip.to, boardedCount: boarded.length, absentCount: absents.length,
        bagageCount: bagages.length, colisCount: colis.length }
    ).catch(() => {});

    const totalBagageRevenue = bagages.reduce((s, b) => s + (b.price ?? 0), 0);
    const totalColisRevenue  = colis.reduce((s, c) => s + (c.amount ?? 0), 0);
    const totalExpenses      = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

    res.json({
      success: true,
      message: `Départ ${trip.from} → ${trip.to} validé`,
      bordereau: {
        tripId, from: trip.from, to: trip.to,
        date: trip.date, departureTime: trip.departureTime,
        busName: trip.busName,
        boardedCount: boarded.length,
        absentCount:  absents.length,
        bagageCount:  bagages.length,
        colisCount:   colis.length,
        totalBagageRevenue,
        totalColisRevenue,
        totalExpenses,
        validatedAt: new Date().toISOString(),
        validatedBy: user.name,
      }
    });
  } catch (err) {
    console.error("[validation-depart/validate]", err);
    res.status(500).json({ error: "Erreur lors de la validation" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   Module 6 — Temps réel & Alertes
   GET  /agent/realtime/alerts         — alertes actives pour l'agent courant
   GET  /agent/realtime/trip/:tripId   — données live d'un trajet (polling 30s)
═══════════════════════════════════════════════════════════════════════════ */

/* ─── GET /agent/realtime/alerts ─── */
router.get("/realtime/alerts", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const agentRows = await db.select({ companyId: agentsTable.companyId, agentRole: agentsTable.agentRole })
      .from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
    const agentInfo = agentRows[0];

    // 1. Départs imminent (≤ 10 min) de la compagnie de l'agent
    const today = new Date().toISOString().slice(0, 10);
    const upcomingTrips = await db.select({
      id: tripsTable.id, from: tripsTable.from, to: tripsTable.to,
      date: tripsTable.date, departureTime: tripsTable.departureTime, status: tripsTable.status,
    })
    .from(tripsTable)
    .where(and(
      eq(tripsTable.date, today),
      inArray(tripsTable.status, ["scheduled"]),
      agentInfo?.companyId ? eq(tripsTable.companyId, agentInfo.companyId) : sql`true`,
    ));

    const preDepartureAlerts = upcomingTrips
      .map(t => {
        const dep = new Date(`${t.date}T${t.departureTime}:00`);
        const minsLeft = (dep.getTime() - Date.now()) / 60_000;
        return { ...t, minutesLeft: Math.round(minsLeft) };
      })
      .filter(t => t.minutesLeft >= -2 && t.minutesLeft <= 10)
      .sort((a, b) => a.minutesLeft - b.minutesLeft);

    // 2. Notifications récentes non lues (type: pre_departure_alert | validation_complete)
    const recentNotifs = await db.select()
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, user.id),
        inArray(notificationsTable.type, ["pre_departure_alert", "validation_complete"]),
      ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(10);

    res.json({ preDepartureAlerts, recentNotifs, agentRole: agentInfo?.agentRole ?? null });
  } catch (err) {
    console.error("[realtime/alerts]", err);
    res.status(500).json({ error: "Erreur" });
  }
});

/* ─── GET /agent/realtime/trip/:tripId ─── */
router.get("/realtime/trip/:tripId", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const tripId = req.params.tripId;

    const [trip] = await db.select({
      id: tripsTable.id, from: tripsTable.from, to: tripsTable.to,
      date: tripsTable.date, departureTime: tripsTable.departureTime, status: tripsTable.status,
    }).from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);

    if (!trip) { res.status(404).json({ error: "Trajet introuvable" }); return; }

    const bookings = await db.select({ status: bookingsTable.status }).from(bookingsTable)
      .where(eq(bookingsTable.tripId, tripId));
    const bagages  = await db.select({ id: bagageItemsTable.id }).from(bagageItemsTable)
      .where(eq(bagageItemsTable.tripId, tripId));
    const colis    = await db.select({ id: parcelsTable.id }).from(parcelsTable)
      .where(eq(parcelsTable.tripId, tripId));
    const expenses = await db.select({ amount: tripExpensesTable.amount }).from(tripExpensesTable)
      .where(eq(tripExpensesTable.tripId, tripId));

    const boardedCount = bookings.filter(b => ["boarded","validated"].includes(b.status ?? "")).length;
    const absentCount  = bookings.filter(b => b.status === "absent").length;
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

    res.json({
      tripId,
      from: trip.from, to: trip.to,
      date: trip.date, departureTime: trip.departureTime, status: trip.status,
      boardedCount,
      absentCount,
      bagageCount:  bagages.length,
      colisCount:   colis.length,
      expenseCount: expenses.length,
      totalExpenses,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[realtime/trip]", err);
    res.status(500).json({ error: "Erreur" });
  }
});

/* ── POST /agent/trips/:tripId/audit-log — save audit report at validation ── */
router.post("/trips/:tripId/audit-log", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(403).json({ error: "Unauthorized" }); return; }
    const [agent] = await db.select({ id: users.id, name: users.name })
      .from(users).where(eq(users.sessionToken, token)).limit(1);
    if (!agent) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { tripId } = req.params;
    const {
      has_errors, has_warnings, has_critique, override_confirmed,
      items, total_revenue, net_balance, validated_by,
    } = req.body;

    await db.execute(sql`
      INSERT INTO trip_audit_logs (trip_id, validated_by, has_errors, has_warnings, has_critique, override_confirmed, items, total_revenue, net_balance)
      VALUES (
        ${tripId},
        ${validated_by ?? agent.name ?? "Agent"},
        ${has_errors ?? false},
        ${has_warnings ?? false},
        ${has_critique ?? false},
        ${override_confirmed ?? false},
        ${JSON.stringify(items ?? [])}::jsonb,
        ${total_revenue ?? 0},
        ${net_balance ?? 0}
      )
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error("[agent/audit-log]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   SEGMENTATION DES PLACES PAR TRAJET (Waypoints)
   ═══════════════════════════════════════════════════════════════ */

/* ── Helpers ────────────────────────────────────────────────── */

async function getOrCreateWaypoints(tripId: string) {
  const existing = await db.select().from(tripWaypointsTable)
    .where(eq(tripWaypointsTable.tripId, tripId))
    .orderBy(tripWaypointsTable.stopOrder);
  if (existing.length > 0) return existing;

  const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
  if (!trips.length) return [];
  const trip = trips[0];

  type StopJson = { name?: string; city?: string; time?: string };
  const stopsJson: StopJson[] = Array.isArray(trip.stops) ? trip.stops as StopJson[] : [];

  const waypoints = [
    { tripId, city: trip.fromCity, stopOrder: 0, scheduledTime: trip.departureTime },
    ...stopsJson.map((s, i) => ({
      tripId,
      city: (s.name ?? s.city ?? "Escale").trim(),
      stopOrder: i + 1,
      scheduledTime: s.time ?? null,
    })),
    { tripId, city: trip.toCity, stopOrder: stopsJson.length + 1, scheduledTime: trip.arrivalTime },
  ];

  const ts = Date.now();
  const inserted: (typeof tripWaypointsTable.$inferSelect)[] = [];
  for (const w of waypoints) {
    const id = `wp-${ts}-${w.stopOrder}-${Math.random().toString(36).substr(2, 6)}`;
    try {
      const [row] = await db.insert(tripWaypointsTable).values({ id, ...w }).onConflictDoNothing().returning();
      if (row) inserted.push(row);
    } catch { /* duplicate = already exists */ }
  }

  if (inserted.length === 0) {
    return db.select().from(tripWaypointsTable)
      .where(eq(tripWaypointsTable.tripId, tripId))
      .orderBy(tripWaypointsTable.stopOrder);
  }
  return inserted.sort((a, b) => a.stopOrder - b.stopOrder);
}

/** Count bookings that overlap segment [boardingOrder, alightingOrder) on this trip */
async function countSegmentOccupancy(tripId: string, boardingOrder: number, alightingOrder: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS cnt
    FROM bookings b
    JOIN trip_waypoints wp_from ON wp_from.trip_id = b.trip_id AND wp_from.city = b.boarding_city
    JOIN trip_waypoints wp_to   ON wp_to.trip_id   = b.trip_id AND wp_to.city   = b.alighting_city
    WHERE b.trip_id = ${tripId}
      AND b.status IN ('confirmed','boarded','validated','payé')
      AND wp_from.stop_order < ${alightingOrder}
      AND wp_to.stop_order   > ${boardingOrder}
  `);
  return Number((result.rows[0] as { cnt: string })?.cnt ?? 0);
}

/* ─── GET /agent/trips/:tripId/waypoints — liste des escales + stats passagers ── */
router.get("/trips/:tripId/waypoints", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { tripId } = req.params;
    const waypoints = await getOrCreateWaypoints(tripId);

    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = trips[0];

    const bookings = await db.select().from(bookingsTable).where(
      and(eq(bookingsTable.tripId, tripId), inArray(bookingsTable.status, ["confirmed","boarded","validated","payé"]))
    );

    const waypointStats = waypoints.map(wp => {
      const boarding  = bookings.filter(b => (b as { boardingCity?: string | null }).boardingCity  === wp.city);
      const alighting = bookings.filter(b => (b as { alightingCity?: string | null }).alightingCity === wp.city);
      const boardingSeatCount  = boarding.reduce( (s, b) => s + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length || 1 : 1), 0);
      const alightingSeatCount = alighting.reduce((s, b) => s + (Array.isArray(b.seatNumbers) ? b.seatNumbers.length || 1 : 1), 0);
      return {
        ...wp,
        passengersBoarding:  boardingSeatCount,
        passengersAlighting: alightingSeatCount,
        isOrigin:      wp.stopOrder === 0,
        isDestination: wp.stopOrder === waypoints[waypoints.length - 1]?.stopOrder,
      };
    });

    res.json({ tripId, totalSeats: trip.totalSeats, waypoints: waypointStats });
  } catch (err) {
    console.error("[waypoints]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/trips/:tripId/waypoint-arrive — marquer arrivée → libérer places ── */
router.post("/trips/:tripId/waypoint-arrive", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { tripId } = req.params;
    const { city } = req.body as { city: string };
    if (!city?.trim()) { res.status(400).json({ error: "city requis" }); return; }

    const waypoints = await getOrCreateWaypoints(tripId);
    const wp = waypoints.find(w => w.city.toLowerCase() === city.trim().toLowerCase());
    if (!wp) { res.status(404).json({ error: "Escale introuvable pour ce trajet" }); return; }

    /* 1. Enregistrer l'arrivée */
    await db.update(tripWaypointsTable)
      .set({ arrivedAt: new Date() })
      .where(and(eq(tripWaypointsTable.tripId, tripId), eq(tripWaypointsTable.city, wp.city)));

    /* 2. Trouver les réservations dont alightingCity = cette ville */
    const alightingBookings = await db.execute(sql`
      SELECT id, seat_ids FROM bookings
      WHERE trip_id = ${tripId}
        AND alighting_city = ${wp.city}
        AND status IN ('confirmed','boarded','validated','payé')
    `);
    const rows = alightingBookings.rows as { id: string; seat_ids: string[] | null }[];

    let seatsFreed = 0;
    for (const row of rows) {
      const seatIds: string[] = Array.isArray(row.seat_ids) ? row.seat_ids : [];
      if (seatIds.length > 0) {
        await db.update(seatsTable)
          .set({ status: "available", boardingCity: null, alightingCity: null })
          .where(inArray(seatsTable.id, seatIds));
        seatsFreed += seatIds.length;
      }
    }

    /* 3. Libérer les guichetSeats / onlineSeats si le trip a des compteurs séparés */
    const bookingIds = rows.map(r => r.id);
    const seatCountFreed = await db.execute(sql`
      SELECT COALESCE(SUM(
        CASE WHEN seat_numbers IS NOT NULL AND jsonb_array_length(seat_numbers::jsonb) > 0
             THEN jsonb_array_length(seat_numbers::jsonb) ELSE 1 END
      ), 0) AS cnt
      FROM bookings
      WHERE id = ANY(${bookingIds}::text[])
        AND booking_source = 'guichet'
    `);
    const guichetFreed = Number((seatCountFreed.rows[0] as { cnt: string })?.cnt ?? 0);
    if (guichetFreed > 0) {
      await db.execute(sql`
        UPDATE trips SET guichet_seats = guichet_seats + ${guichetFreed}
        WHERE id = ${tripId} AND guichet_seats IS NOT NULL
      `);
    }

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req },
      ACTIONS.TRIP_UPDATE, tripId, "trip",
      { action: "waypoint_arrive", city: wp.city, passengersAlighted: rows.length, seatsFreed }).catch(() => {});

    res.json({
      ok: true,
      city: wp.city,
      passengersAlighted: rows.length,
      seatsFreed: Math.max(seatsFreed, rows.length),
    });
  } catch (err) {
    console.error("[waypoint-arrive]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/trips/:tripId/segment-seats — places disponibles par segment ── */
router.get("/trips/:tripId/segment-seats", async (req, res) => {
  try {
    const user = await requireAgent(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { tripId } = req.params;
    const { boardingCity, alightingCity } = req.query as { boardingCity?: string; alightingCity?: string };

    const trips = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trips.length) { res.status(404).json({ error: "Trajet introuvable" }); return; }
    const trip = trips[0];

    const waypoints = await getOrCreateWaypoints(tripId);

    const segmentList = waypoints.map((wp, idx) => ({
      city:      wp.city,
      order:     wp.stopOrder,
      arrivedAt: wp.arrivedAt,
    }));

    if (boardingCity && alightingCity) {
      const bWp = waypoints.find(w => w.city === boardingCity);
      const aWp = waypoints.find(w => w.city === alightingCity);
      if (!bWp || !aWp || bWp.stopOrder >= aWp.stopOrder) {
        res.status(400).json({ error: "Segment invalide" }); return;
      }
      const occupied = await countSegmentOccupancy(tripId, bWp.stopOrder, aWp.stopOrder);
      const available = Math.max(0, trip.totalSeats - occupied);
      res.json({ tripId, boardingCity, alightingCity, totalSeats: trip.totalSeats, occupied, available });
      return;
    }

    const allSegments = await Promise.all(
      waypoints.slice(0, -1).map(async (from, i) => {
        const to = waypoints[i + 1];
        const occupied = await countSegmentOccupancy(tripId, from.stopOrder, to.stopOrder);
        return {
          from: from.city,
          to:   to.city,
          totalSeats: trip.totalSeats,
          occupied,
          available: Math.max(0, trip.totalSeats - occupied),
        };
      })
    );
    res.json({ tripId, totalSeats: trip.totalSeats, segments: allSegments, waypoints: segmentList });
  } catch (err) {
    console.error("[segment-seats]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   CHEF D'AGENCE — middleware + helpers + endpoints
   ═══════════════════════════════════════════════════════════════ */

async function requireChefAgence(authHeader: string | undefined) {
  const user = await requireAgent(authHeader);
  if (!user) return null;
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
  if (!agents.length) return null;
  const agent = agents[0];
  if (agent.agentRole !== "chef_agence") return null;
  if (!agent.agenceId) return null;
  return { user, agent };
}

async function chefAudit(params: {
  userId: string; userName: string; agenceId: string;
  action: string; targetId?: string; targetType?: string;
  oldData?: object; newData?: object; reason?: string;
}) {
  const id = "chefaudit-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const meta = JSON.stringify({
    agence_id:  params.agenceId,
    old_data:   params.oldData   ?? null,
    new_data:   params.newData   ?? null,
    reason:     params.reason    ?? null,
  });
  await db.execute(sql`
    INSERT INTO audit_logs (id, user_id, user_role, user_name, action, target_id, target_type, metadata, created_at)
    VALUES (
      ${id}, ${params.userId}, 'chef_agence', ${params.userName},
      ${params.action}, ${params.targetId ?? null}, ${params.targetType ?? null},
      ${meta}, NOW()
    )
  `).catch(e => console.error("[chef audit]", e));
}

/* ─── GET /agent/chef/dashboard ──────────────────────────────── */
router.get("/chef/dashboard", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé — rôle Chef d'Agence requis" });
    const { agent } = ctx;

    const todayStr = new Date().toISOString().slice(0, 10);

    const [tripsToday, agentsInAgence, paxToday, busesAvail] = await Promise.all([
      // Trajets prévus ou en route aujourd'hui pour cette agence
      db.execute(sql`
        SELECT COUNT(*) as cnt FROM trips
        WHERE company_id = ${agent.companyId}
          AND date = ${todayStr}
          AND status IN ('scheduled','en_route')
      `),
      // Agents dans cette agence
      db.execute(sql`
        SELECT COUNT(*) as cnt FROM agents WHERE agence_id = ${agent.agenceId} AND status = 'active'
      `),
      // Passagers embarqués aujourd'hui pour les trajets de cette compagnie
      db.execute(sql`
        SELECT COUNT(*) as cnt FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        WHERE t.company_id = ${agent.companyId}
          AND t.date = ${todayStr}
          AND b.status IN ('boarded','validated','confirmed')
      `),
      // Cars disponibles (pas en service, status actif)
      db.execute(sql`
        SELECT COUNT(*) as cnt FROM buses
        WHERE company_id = ${agent.companyId}
          AND status = 'active'
          AND (logistic_status != 'en_service' OR logistic_status IS NULL)
          AND (current_trip_id IS NULL)
      `),
    ]);

    // Info agence
    const agences = await db.execute(sql`
      SELECT * FROM agences WHERE id = ${agent.agenceId} LIMIT 1
    `);
    const agenceInfo = agences.rows[0] ?? null;

    res.json({
      agence: agenceInfo,
      stats: {
        tripsToday:     Number((tripsToday.rows[0] as any)?.cnt ?? 0),
        agentsActive:   Number((agentsInAgence.rows[0] as any)?.cnt ?? 0),
        passengersToday: Number((paxToday.rows[0] as any)?.cnt ?? 0),
        busesAvailable: Number((busesAvail.rows[0] as any)?.cnt ?? 0),
      },
    });
  } catch (err) {
    console.error("[chef/dashboard]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/chef/available-buses ─────────────────────────
   Retourne UNIQUEMENT les cars de l'agence :
   - home_agence_id = agenceId  (affectés définitivement)
   - OU current_location ILIKE agenceCity  (présents physiquement)
   Si aucun match → fallback sur tous les cars de la compagnie
   ─────────────────────────────────────────────────────────────── */
router.get("/chef/available-buses", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { agent } = ctx;

    // Récupérer le nom de la ville de l'agence
    const agenceRows = await db.execute(sql`SELECT city FROM agences WHERE id = ${agent.agenceId} LIMIT 1`);
    const agenceCity: string = (agenceRows.rows[0] as any)?.city ?? "";

    const buses = await db.execute(sql`
      SELECT b.*,
        CASE
          WHEN b.current_trip_id IS NOT NULL AND b.logistic_status = 'en_service' THEN 'en_service'
          WHEN b.logistic_status = 'en_panne'       THEN 'en_panne'
          WHEN b.logistic_status = 'en_maintenance' THEN 'en_maintenance'
          WHEN b.logistic_status = 'affecté'         THEN 'affecté'
          WHEN b.current_trip_id IS NULL             THEN 'disponible'
          ELSE b.logistic_status
        END AS availability_status,
        t.from_city, t.to_city, t.date, t.departure_time, t.status as trip_status,
        CASE
          WHEN b.home_agence_id = ${agent.agenceId}                          THEN 'affecté_agence'
          WHEN LOWER(b.current_location) = LOWER(${agenceCity})             THEN 'présent'
          ELSE 'autre'
        END AS location_source
      FROM buses b
      LEFT JOIN trips t ON t.id = b.current_trip_id
      WHERE b.company_id = ${agent.companyId}
        AND b.status = 'active'
        AND (
          b.home_agence_id = ${agent.agenceId}
          OR LOWER(b.current_location) = LOWER(${agenceCity})
          /* fallback : si aucun car n'est dans l'agence, afficher tous */
          OR NOT EXISTS (
            SELECT 1 FROM buses b2
            WHERE b2.company_id = ${agent.companyId}
              AND b2.status = 'active'
              AND (b2.home_agence_id = ${agent.agenceId} OR LOWER(b2.current_location) = LOWER(${agenceCity}))
          )
        )
      ORDER BY
        CASE WHEN b.home_agence_id = ${agent.agenceId} THEN 0
             WHEN LOWER(b.current_location) = LOWER(${agenceCity}) THEN 1
             ELSE 2 END,
        CASE WHEN b.current_trip_id IS NULL AND b.logistic_status NOT IN ('en_panne','en_maintenance') THEN 0 ELSE 1 END,
        b.bus_name ASC
    `);

    res.json({ buses: buses.rows, agenceCity });
  } catch (err) {
    console.error("[chef/available-buses]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/chef/trips ──────────────────────────────────── */
router.get("/chef/trips", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { agent } = ctx;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const threeDaysAhead = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const trips = await db.execute(sql`
      SELECT t.*,
        COUNT(b.id) FILTER (WHERE b.status IN ('confirmed','boarded','validated','payé')) as passenger_count,
        COUNT(b.id) FILTER (WHERE b.passenger_status = 'alighted') as alighted_count,
        COUNT(p.id) FILTER (WHERE p.status NOT IN ('cancelled')) as parcel_count,
        a.agence_id as agent_agence_id,
        COALESCE(t.estimated_arrival_time, t.arrival_time) as eta,
        COALESCE(t.intelligence, '{}'::jsonb)               as intel
      FROM trips t
      LEFT JOIN bookings b ON b.trip_id = t.id
      LEFT JOIN parcels p ON p.trip_id = t.id
      LEFT JOIN agents a ON a.id::text = t.agent_id
      WHERE t.company_id = ${agent.companyId}
        AND t.date >= ${sevenDaysAgo}
        AND t.date <= ${threeDaysAhead}
      GROUP BY t.id, a.agence_id
      ORDER BY t.date ASC, t.departure_time ASC
      LIMIT 50
    `);

    res.json({ trips: trips.rows });
  } catch (err) {
    console.error("[chef/trips]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/chef/trips — créer un départ ───────────────── */
router.post("/chef/trips", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { user, agent } = ctx;

    const { from, to, date, departureTime, arrivalTime, price, busId } = req.body as {
      from: string; to: string; date: string;
      departureTime: string; arrivalTime: string;
      price: number; busId?: string;
    };

    if (!from || !to || !date || !departureTime) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    // Vérifier disponibilité du bus si fourni
    if (busId) {
      const [busCheck] = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
      if (!busCheck) return res.status(404).json({ error: "Car introuvable" });
      if (busCheck.companyId !== agent.companyId) return res.status(403).json({ error: "Ce car n'appartient pas à votre compagnie" });
      if (busCheck.currentTripId) return res.status(409).json({ error: `Ce car est déjà affecté au trajet ${busCheck.currentTripId}` });
    }

    const tripId = "trip-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    let busName = "À définir";
    let busType = "Standard";
    let totalSeats = 44;

    if (busId) {
      const [bus] = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
      if (bus) { busName = bus.busName; busType = bus.busType; totalSeats = bus.capacity; }
    }

    await db.execute(sql`
      INSERT INTO trips (id, company_id, agent_id, bus_id, from_city, to_city, date,
        departure_time, arrival_time, price, bus_type, bus_name, total_seats,
        guichet_seats, online_seats, duration, amenities, stops, policies, status)
      VALUES (
        ${tripId}, ${agent.companyId}, ${agent.id}, ${busId ?? null},
        ${from}, ${to}, ${date}, ${departureTime}, ${arrivalTime ?? "—"},
        ${price ?? 0}, ${busType}, ${busName}, ${totalSeats},
        ${Math.floor(totalSeats * 0.7)}, ${Math.floor(totalSeats * 0.3)},
        '?', '[]'::json, '[]'::json, '[]'::json, 'scheduled'
      )
    `);

    // Générer les sièges pour ce trajet
    try {
      const seatPrice = price ?? 0;
      const cols = 4;
      const seatRows = Math.ceil(totalSeats / cols);
      const colLetters = ["A","B","C","D"];
      const seatInserts: string[] = [];
      for (let r = 1; r <= seatRows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r - 1) * cols + c >= totalSeats) break;
          const seatNum = `${r}${colLetters[c]}`;
          const seatId  = `${tripId}-s${r}${colLetters[c]}`;
          seatInserts.push(`('${seatId}','${tripId}','${seatNum}',${r},${c},'guichet','available',${seatPrice})`);
        }
      }
      if (seatInserts.length > 0) {
        await db.execute(sql.raw(
          `INSERT INTO seats (id, trip_id, number, "row", "column", type, status, price) VALUES ${seatInserts.join(",")} ON CONFLICT DO NOTHING`
        ));
      }
    } catch (e) { console.error("[chef/trips] seat gen:", e); }

    // Marquer le bus comme affecté
    if (busId) {
      await db.execute(sql`
        UPDATE buses SET current_trip_id = ${tripId}, logistic_status = 'affecté'
        WHERE id = ${busId}
      `);
    }

    // Notifier les agents de l'agence
    const agenceAgents = await db.execute(sql`
      SELECT u.push_token, u.id as user_id, u.name FROM agents a
      JOIN users u ON u.id = a.user_id
      WHERE a.agence_id = ${agent.agenceId}
        AND a.agent_role != 'chef_agence'
        AND u.status = 'active'
    `);

    const notifMsg = `Nouveau départ programmé : ${from} → ${to} le ${date} à ${departureTime}. Car : ${busName}.`;
    for (const ag of (agenceAgents.rows as any[])) {
      if (ag.push_token) {
        const { sendExpoPush } = await import("../pushService");
        sendExpoPush(ag.push_token, "🚌 Nouveau départ", notifMsg).catch(() => {});
      }
      await db.execute(sql`
        INSERT INTO notifications (id, user_id, type, title, message, ref_id, ref_type)
        VALUES (
          ${"notif-" + Date.now().toString(36) + Math.random().toString(36).slice(2,6)},
          ${ag.user_id}, 'new_trip', '🚌 Nouveau départ', ${notifMsg}, ${tripId}, 'trip'
        )
      `).catch(() => {});
    }

    // Audit trail — création
    await chefAudit({
      userId: user.id, userName: user.name, agenceId: agent.agenceId!,
      action: "chef_create_trip", targetId: tripId, targetType: "trip",
      newData: { from, to, date, departureTime, arrivalTime: req.body.arrivalTime, price: price ?? 0, busId: busId ?? null, busName },
    });

    console.log(`[Chef] Départ créé ${tripId} : ${from}→${to} ${date} ${departureTime} par chef ${user.name}`);
    res.json({ success: true, tripId, from, to, date, departureTime, busName });
  } catch (err) {
    console.error("[chef/trips POST]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── PUT /agent/chef/trips/:tripId — modifier un départ ─────── */
router.put("/chef/trips/:tripId", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { user, agent } = ctx;
    const { tripId } = req.params;

    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trip) return res.status(404).json({ error: "Trajet introuvable" });
    if (trip.companyId !== agent.companyId) return res.status(403).json({ error: "Accès refusé" });
    if (trip.status !== "scheduled") return res.status(400).json({ error: "Seuls les trajets 'programmés' peuvent être modifiés" });

    const { departureTime, arrivalTime, price, busId, reason } = req.body as {
      departureTime?: string; arrivalTime?: string; price?: number; busId?: string; reason?: string;
    };

    // Snapshot ancienne valeur pour l'audit
    const oldData = {
      departureTime: trip.departureTime, arrivalTime: trip.arrivalTime,
      price: trip.price, busId: trip.busId,
    };

    if (busId && busId !== trip.busId) {
      const [busCheck] = await db.select().from(busesTable).where(eq(busesTable.id, busId)).limit(1);
      if (!busCheck) return res.status(404).json({ error: "Car introuvable" });
      if (busCheck.currentTripId && busCheck.currentTripId !== tripId)
        return res.status(409).json({ error: "Ce car est déjà affecté à un autre trajet" });

      // Libérer l'ancien bus
      if (trip.busId) {
        await db.execute(sql`UPDATE buses SET current_trip_id = NULL, logistic_status = 'en_attente' WHERE id = ${trip.busId}`);
      }
      // Affecter le nouveau
      await db.execute(sql`UPDATE buses SET current_trip_id = ${tripId}, logistic_status = 'affecté' WHERE id = ${busId}`);
    }

    await db.execute(sql`
      UPDATE trips SET
        departure_time = COALESCE(${departureTime ?? null}, departure_time),
        arrival_time   = COALESCE(${arrivalTime   ?? null}, arrival_time),
        price          = COALESCE(${price         ?? null}::real, price),
        bus_id         = COALESCE(${busId         ?? null}, bus_id)
      WHERE id = ${tripId}
    `);

    // Audit trail — modification
    await chefAudit({
      userId: user.id, userName: user.name, agenceId: agent.agenceId!,
      action: "chef_modify_trip", targetId: tripId, targetType: "trip",
      oldData, newData: { departureTime, arrivalTime, price, busId }, reason,
    });

    res.json({ success: true, tripId });
  } catch (err) {
    console.error("[chef/trips PUT]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── DELETE /agent/chef/trips/:tripId — annuler un départ ───── */
router.delete("/chef/trips/:tripId", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { user, agent } = ctx;
    const { tripId } = req.params;
    const { reason } = req.body as { reason?: string };

    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trip) return res.status(404).json({ error: "Trajet introuvable" });
    if (trip.companyId !== agent.companyId) return res.status(403).json({ error: "Accès refusé" });
    if (trip.status === "en_route" || trip.status === "completed")
      return res.status(400).json({ error: "Impossible d'annuler un trajet en cours ou terminé" });

    // Libérer le bus
    if (trip.busId) {
      await db.execute(sql`UPDATE buses SET current_trip_id = NULL, logistic_status = 'en_attente' WHERE id = ${trip.busId}`);
    }

    await db.execute(sql`UPDATE trips SET status = 'cancelled' WHERE id = ${tripId}`);

    // Notifier les passagers qui ont déjà réservé
    const passengers = await db.execute(sql`
      SELECT DISTINCT u.phone, u.name, u.push_token, b.id as booking_id FROM bookings b
      JOIN users u ON u.id = b.user_id
      WHERE b.trip_id = ${tripId} AND b.status IN ('confirmed','en_attente')
    `);
    const cancelMsg = `GoBooking : Le départ ${trip.fromCity} → ${trip.toCity} du ${trip.date} à ${trip.departureTime} a été annulé. Notre équipe vous contactera pour un remboursement.`;
    for (const p of (passengers.rows as any[])) {
      if (p.phone) {
        const { sendSMS } = await import("../lib/smsService");
        sendSMS(p.phone, cancelMsg).catch(() => {});
      }
    }

    // Audit trail — annulation
    await chefAudit({
      userId: user.id, userName: user.name, agenceId: agent.agenceId!,
      action: "chef_cancel_trip", targetId: tripId, targetType: "trip",
      oldData: { status: trip.status, from: trip.fromCity, to: trip.toCity, date: trip.date, departureTime: trip.departureTime },
      newData: { status: "cancelled" }, reason,
    });

    res.json({ success: true, tripId });
  } catch (err) {
    console.error("[chef/trips DELETE]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/chef/trips/:tripId/emergency-transfer ─────────
   Cas panne en route : déclarer le vieux car en panne,
   sélectionner un car de remplacement, transférer tout
   ─────────────────────────────────────────────────────────────── */
router.post("/chef/trips/:tripId/emergency-transfer", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { user, agent } = ctx;
    const { tripId } = req.params;
    const { newBusId, location, detail } = req.body as {
      newBusId: string; location?: string; detail?: string;
    };

    if (!newBusId) return res.status(400).json({ error: "newBusId requis" });

    // Charger le trajet
    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trip) return res.status(404).json({ error: "Trajet introuvable" });
    if (trip.companyId !== agent.companyId) return res.status(403).json({ error: "Accès refusé" });

    // Vérifier le nouveau car
    const [newBus] = await db.select().from(busesTable).where(eq(busesTable.id, newBusId)).limit(1);
    if (!newBus) return res.status(404).json({ error: "Car de remplacement introuvable" });
    if (newBus.companyId !== agent.companyId) return res.status(403).json({ error: "Car n'appartient pas à votre compagnie" });
    if (newBus.currentTripId && newBus.currentTripId !== tripId)
      return res.status(409).json({ error: `Ce car est déjà affecté au trajet ${newBus.currentTripId}` });

    const oldBusId   = trip.busId;
    const oldBusPlate = trip.busId ? (await db.execute(sql`SELECT plate_number FROM buses WHERE id = ${trip.busId} LIMIT 1`)).rows[0] as any : null;
    const oldBusName  = trip.busName;

    // 1. Marquer l'ancien car en panne et libérer
    if (oldBusId) {
      await db.execute(sql`
        UPDATE buses SET
          logistic_status = 'en_panne',
          current_trip_id = NULL,
          condition = 'mauvais',
          issue = ${`Panne en route — transféré le ${new Date().toLocaleDateString("fr-CI")} sur trajet ${tripId} (${trip.fromCity}→${trip.toCity})`}
        WHERE id = ${oldBusId}
      `);
    }

    // 2. Affecter le nouveau car au trajet
    await db.execute(sql`
      UPDATE buses SET
        logistic_status = 'en_service',
        current_trip_id = ${tripId},
        current_location = ${location ?? null}
      WHERE id = ${newBusId}
    `);

    // 3. Mettre à jour le trajet avec le nouveau car
    await db.execute(sql`
      UPDATE trips SET
        bus_id   = ${newBusId},
        bus_name = ${newBus.busName},
        bus_type = ${newBus.busType},
        total_seats = ${newBus.capacity}
      WHERE id = ${tripId}
    `);

    // 4. Compter passagers + colis concernés
    const countRes = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM bookings WHERE trip_id = ${tripId} AND status NOT IN ('cancelled','refunded')) as pax,
        (SELECT COUNT(*) FROM parcels   WHERE trip_id = ${tripId} AND status NOT IN ('cancelled'))          as colis
    `);
    const paxCount  = Number((countRes.rows[0] as any)?.pax  ?? 0);
    const colisCount = Number((countRes.rows[0] as any)?.colis ?? 0);

    // 5. Enregistrer le transfert dans trip_transfers
    const transferId = "xfer-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await db.execute(sql`
      INSERT INTO trip_transfers (id, trip_id, old_bus_id, old_bus_plate, old_bus_name,
        new_bus_id, new_bus_plate, new_bus_name, reason, detail, transfer_location,
        passengers_count, created_by)
      VALUES (
        ${transferId}, ${tripId},
        ${oldBusId ?? null}, ${oldBusPlate?.plate_number ?? null}, ${oldBusName ?? null},
        ${newBusId}, ${newBus.plateNumber}, ${newBus.busName},
        'panne', ${detail ?? null}, ${location ?? null},
        ${paxCount}, ${user.id}
      )
    `);

    // 6. SMS + push à tous les passagers confirmés
    const passengers = await db.execute(sql`
      SELECT DISTINCT u.phone, u.push_token, u.name FROM bookings b
      JOIN users u ON u.id = b.user_id
      WHERE b.trip_id = ${tripId} AND b.status IN ('confirmed','boarded','validated','payé')
    `);
    const transferMsg = `GoBooking : Suite à une panne, votre trajet ${trip.fromCity}→${trip.toCity} continue avec le car ${newBus.busName} (${newBus.plateNumber}). Veuillez vous présenter au point de transfert. Merci pour votre compréhension.`;
    for (const p of (passengers.rows as any[])) {
      if (p.phone) {
        const { sendSMS } = await import("../lib/smsService");
        sendSMS(p.phone, transferMsg).catch(() => {});
      }
      if (p.push_token) {
        const { sendExpoPush } = await import("../pushService");
        sendExpoPush(p.push_token, "🚨 Changement de car", transferMsg).catch(() => {});
      }
    }

    // 7. Notifier les agents de l'agence
    const agentsNotif = await db.execute(sql`
      SELECT u.push_token, u.name FROM agents a
      JOIN users u ON u.id = a.user_id
      WHERE a.agence_id = ${agent.agenceId} AND a.agent_role != 'chef_agence' AND u.status = 'active'
    `);
    const agentMsg = `🚨 Panne signalée — ${oldBusName ?? "Car"} HS. Car de remplacement : ${newBus.busName} pour trajet ${trip.fromCity}→${trip.toCity}.`;
    for (const ag of (agentsNotif.rows as any[])) {
      if (ag.push_token) {
        const { sendExpoPush } = await import("../pushService");
        sendExpoPush(ag.push_token, "Panne signalée", agentMsg).catch(() => {});
      }
    }

    // 8. Audit trail
    await chefAudit({
      userId: user.id, userName: user.name, agenceId: agent.agenceId!,
      action: "chef_emergency_transfer", targetId: tripId, targetType: "trip",
      oldData: { busId: oldBusId, busName: oldBusName, plate: oldBusPlate?.plate_number },
      newData: { busId: newBusId, busName: newBus.busName, plate: newBus.plateNumber, location },
      reason: `Panne — ${detail ?? "aucun détail"}`,
    });

    console.log(`[Chef Emergency] ${user.name} → transfert ${tripId} : ${oldBusName ?? "?"} → ${newBus.busName}, ${paxCount} pax, ${colisCount} colis`);

    res.json({
      success: true, transferId, tripId,
      oldBus: { id: oldBusId, name: oldBusName, plate: oldBusPlate?.plate_number },
      newBus: { id: newBusId, name: newBus.busName, plate: newBus.plateNumber },
      passengersNotified: passengers.rows.length, colisTransferred: colisCount,
    });
  } catch (err) {
    console.error("[chef/emergency-transfer]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/chef/trips/:tripId/transfers — historique transferts ── */
router.get("/chef/trips/:tripId/transfers", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { agent } = ctx;
    const { tripId } = req.params;

    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trip) return res.status(404).json({ error: "Trajet introuvable" });
    if (trip.companyId !== agent.companyId) return res.status(403).json({ error: "Accès refusé" });

    const transfers = await db.execute(sql`
      SELECT tt.*, u.name as created_by_name, u.email as created_by_email
      FROM trip_transfers tt
      LEFT JOIN users u ON u.id = tt.created_by
      WHERE tt.trip_id = ${tripId}
      ORDER BY tt.transferred_at DESC
    `);

    res.json({ tripId, transfers: transfers.rows });
  } catch (err) {
    console.error("[chef/trips/transfers GET]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── POST /agent/chef/trips/:tripId/waypoint ──────────────────
   Marquer une escale comme passée → libère les sièges automatiquement
   via le scheduler (releaseWaypointSeats) au prochain tick
   ─────────────────────────────────────────────────────────────── */
router.post("/chef/trips/:tripId/waypoint", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { user, agent } = ctx;
    const { tripId } = req.params;
    const { city } = req.body as { city: string };
    if (!city) return res.status(400).json({ error: "city requis" });

    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trip) return res.status(404).json({ error: "Trajet introuvable" });
    if (trip.companyId !== agent.companyId) return res.status(403).json({ error: "Accès refusé" });
    if (!["en_route","in_progress","boarding"].includes(trip.status))
      return res.status(400).json({ error: `Impossible de marquer une escale sur un trajet '${trip.status}'` });

    // Ajouter la ville aux waypoints_passed (sans dupliquer)
    await db.execute(sql`
      UPDATE trips
      SET waypoints_passed = COALESCE(waypoints_passed, '[]'::jsonb) || to_jsonb(${city}::text)
      WHERE id = ${tripId}
        AND NOT (waypoints_passed @> to_jsonb(${city}::text))
    `);

    // Libération immédiate des sièges (n'attend pas le scheduler)
    const passengerRows = await db.execute(sql`
      SELECT b.id, b.seat_ids, b.user_id, b.booking_ref
      FROM bookings b
      WHERE b.trip_id = ${tripId}
        AND LOWER(b.alighting_city) = LOWER(${city})
        AND b.status NOT IN ('cancelled','refunded','annulé','expiré')
        AND (b.passenger_status IS NULL OR b.passenger_status != 'alighted')
    `);

    let seatsReleased = 0;
    for (const b of passengerRows.rows as any[]) {
      await db.execute(sql`UPDATE bookings SET passenger_status = 'alighted' WHERE id = ${b.id}`);
      let seatIds: string[] = [];
      try { seatIds = Array.isArray(b.seat_ids) ? b.seat_ids : JSON.parse(b.seat_ids ?? "[]"); } catch {}
      if (seatIds.length > 0) {
        await db.execute(sql`UPDATE seats SET status = 'available' WHERE id = ANY(${seatIds}::text[])`).catch(() => {});
        seatsReleased += seatIds.length;
      }
    }

    // Audit
    await chefAudit({
      userId: user.id, userName: user.name, agenceId: agent.agenceId!,
      action: "chef_mark_waypoint", targetId: tripId, targetType: "trip",
      newData: { city, passengersAlighted: passengerRows.rows.length, seatsReleased },
    });

    console.log(`[Chef Waypoint] ${user.name} → escale "${city}" sur trajet ${tripId} | ${passengerRows.rows.length} passagers descendus | ${seatsReleased} sièges libérés`);
    res.json({
      success: true, tripId, city,
      passengersAlighted: passengerRows.rows.length,
      seatsReleased,
    });
  } catch (err) {
    console.error("[chef/waypoint]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/chef/trips/:tripId/intelligence ─── prévisions ─ */
router.get("/chef/trips/:tripId/intelligence", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { agent } = ctx;
    const { tripId } = req.params;

    const rows = await db.execute(sql`
      SELECT t.id, t.from_city, t.to_city, t.date, t.departure_time, t.arrival_time,
             t.estimated_arrival_time, t.actual_departure_time, t.delay_minutes,
             t.status, t.capacity_status, t.total_seats, t.waypoints_passed,
             t.intelligence, t.bus_name, t.stops,
             COUNT(b.id) FILTER (WHERE b.status NOT IN ('cancelled','refunded','annulé','expiré')) as booked,
             COUNT(b.id) FILTER (WHERE b.passenger_status = 'alighted') as alighted,
             COUNT(b.id) FILTER (WHERE b.alighting_city IS NOT NULL AND b.alighting_city != '') as segmented
      FROM trips t
      LEFT JOIN bookings b ON b.trip_id = t.id
      WHERE t.id = ${tripId} AND t.company_id = ${agent.companyId}
      GROUP BY t.id
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "Trajet introuvable" });
    const t = rows.rows[0] as any;

    const booked   = Number(t.booked)   || 0;
    const alighted = Number(t.alighted) || 0;
    const total    = Number(t.total_seats) || 1;
    const active   = booked - alighted;
    const pct      = Math.round((active / total) * 100);
    const delay    = Number(t.delay_minutes) || 0;

    let delayRisk: "none" | "low" | "medium" | "high" = "none";
    if (delay > 60) delayRisk = "high";
    else if (delay > 30) delayRisk = "medium";
    else if (delay > 0 || pct >= 90) delayRisk = "low";

    // Verrouillage
    const locks = {
      canEdit:     t.status === "scheduled",
      canCancel:   t.status === "scheduled",
      canTransfer: ["en_route","in_progress","boarding","scheduled"].includes(t.status),
      canWaypoint: ["en_route","in_progress","boarding"].includes(t.status),
      reason: t.status === "en_route" ? "Trajet en cours — modifications bloquées"
            : t.status === "arrived"  ? "Trajet arrivé — actions terminées"
            : t.status === "completed"? "Trajet terminé"
            : null,
    };

    res.json({
      tripId, status: t.status,
      eta: t.estimated_arrival_time ?? t.arrival_time,
      actualDeparture: t.actual_departure_time,
      delayMinutes: delay, delayRisk,
      capacityStatus: t.capacity_status ?? "normal",
      pct, active, booked, alighted, total,
      segmented: Number(t.segmented) || 0,
      waypointsPassed: (() => { try { return JSON.parse(typeof t.waypoints_passed === "string" ? t.waypoints_passed : JSON.stringify(t.waypoints_passed ?? "[]")); } catch { return []; } })(),
      locks,
    });
  } catch (err) {
    console.error("[chef/intelligence]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/chef/trips/:tripId/seats — carte des sièges ─── */
router.get("/chef/trips/:tripId/seats", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { agent } = ctx;
    const { tripId } = req.params;

    // Vérif accès compagnie
    const tripRows = await db.execute(sql`
      SELECT id, bus_id, from_city, to_city, total_seats, status, stops, waypoints_passed, company_id
      FROM trips WHERE id = ${tripId} LIMIT 1
    `);
    if (!tripRows.rows.length) return res.status(404).json({ error: "Trajet introuvable" });
    const trip = tripRows.rows[0] as any;
    if (trip.company_id !== agent.companyId) return res.status(403).json({ error: "Accès refusé" });

    // Tous les sièges du trajet
    const seats = await db.execute(sql`
      SELECT id, number, "row", "column", type, status, boarding_city, alighting_city
      FROM seats WHERE trip_id = ${tripId} ORDER BY "row", "column"
    `);

    // Toutes les réservations actives du trajet avec leur statut passager
    const bookings = await db.execute(sql`
      SELECT b.id, b.booking_ref, b.seat_ids, b.seat_numbers, b.passengers,
             b.boarding_city, b.alighting_city, b.passenger_status, b.contact_phone,
             b.total_amount, b.status as booking_status
      FROM bookings b
      WHERE b.trip_id = ${tripId}
        AND b.status NOT IN ('cancelled','refunded','annulé','expiré')
      ORDER BY b.created_at
    `);

    // Construire un index seatId → {bookingRef, passengerStatus, alightingCity}
    const seatIndex = new Map<string, {
      bookingId: string; bookingRef: string; bookingStatus: string;
      passengerStatus: string; alightingCity: string; boardingCity: string;
    }>();
    for (const b of bookings.rows as any[]) {
      let seatIds: string[] = [];
      try { seatIds = Array.isArray(b.seat_ids) ? b.seat_ids : JSON.parse(b.seat_ids ?? "[]"); } catch {}
      for (const sid of seatIds) {
        seatIndex.set(sid, {
          bookingId: b.id, bookingRef: b.booking_ref, bookingStatus: b.booking_status,
          passengerStatus: b.passenger_status ?? "booked",
          alightingCity: b.alighting_city ?? "", boardingCity: b.boarding_city ?? "",
        });
      }
    }

    // Enrichir chaque siège avec son statut effectif
    const enrichedSeats = (seats.rows as any[]).map(seat => {
      const booking = seatIndex.get(seat.id);
      let effectiveStatus: "free" | "occupied" | "released" | "reserved" = "free";
      if (booking) {
        if (booking.passengerStatus === "alighted") effectiveStatus = "released";
        else effectiveStatus = "occupied";
      } else if (seat.status === "reserved") {
        effectiveStatus = "reserved";
      }
      return {
        id: seat.id, number: seat.number, row: seat.row, col: seat.column, type: seat.type,
        status: effectiveStatus,
        booking: booking ? {
          ref: booking.bookingRef,
          alightingCity: booking.alightingCity, boardingCity: booking.boardingCity,
          passengerStatus: booking.passengerStatus,
        } : null,
      };
    });

    // Stats globales
    const stats = {
      total: enrichedSeats.length,
      free:     enrichedSeats.filter(s => s.status === "free").length,
      occupied: enrichedSeats.filter(s => s.status === "occupied").length,
      released: enrichedSeats.filter(s => s.status === "released").length,
      reserved: enrichedSeats.filter(s => s.status === "reserved").length,
    };

    // Passagers par escale de descente
    const byAlighting: Record<string, { count: number; seats: string[] }> = {};
    for (const s of enrichedSeats.filter(s => s.booking?.alightingCity)) {
      const city = s.booking!.alightingCity;
      if (!byAlighting[city]) byAlighting[city] = { count: 0, seats: [] };
      byAlighting[city].count++;
      byAlighting[city].seats.push(s.number);
    }

    res.json({ tripId, seats: enrichedSeats, stats, byAlighting });
  } catch (err) {
    console.error("[chef/seats]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/chef/trips/:tripId/passengers ── liste passagers ─ */
router.get("/chef/trips/:tripId/passengers", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { agent } = ctx;
    const { tripId } = req.params;

    // Vérif accès
    const tripPassRows = await db.execute(sql`
      SELECT id, from_city, to_city, status, company_id FROM trips WHERE id = ${tripId} LIMIT 1
    `);
    if (!tripPassRows.rows.length) return res.status(404).json({ error: "Trajet introuvable" });
    const trip = tripPassRows.rows[0] as any;

    const rows = await db.execute(sql`
      SELECT b.id, b.booking_ref, b.contact_phone, b.seat_numbers, b.passengers,
             b.boarding_city, b.alighting_city, b.passenger_status, b.total_amount,
             b.status as booking_status, b.created_at
      FROM bookings b
      WHERE b.trip_id = ${tripId}
        AND b.status NOT IN ('cancelled','refunded')
      ORDER BY b.alighting_city, b.created_at
    `);

    // Parser les passagers individuels
    const passengers: any[] = [];
    for (const b of rows.rows as any[]) {
      let paxList: any[] = [];
      let seatNums: string[] = [];
      try { paxList = typeof b.passengers === "string" ? JSON.parse(b.passengers) : (b.passengers ?? []); } catch {}
      try { seatNums = typeof b.seat_numbers === "string" ? JSON.parse(b.seat_numbers) : (b.seat_numbers ?? []); } catch {}

      if (paxList.length === 0) {
        // Réservation sans passagers individuels → une entrée par siège
        passengers.push({
          bookingRef: b.booking_ref, bookingId: b.id,
          name: "Passager", phone: b.contact_phone,
          seatNumber: seatNums[0] ?? "?",
          boardingCity: b.boarding_city ?? trip.fromCity,
          alightingCity: b.alighting_city ?? trip.toCity,
          passengerStatus: b.passenger_status ?? "booked",
          bookingStatus: b.booking_status,
        });
      } else {
        paxList.forEach((pax: any, i: number) => {
          passengers.push({
            bookingRef: b.booking_ref, bookingId: b.id,
            name: pax.nom ?? pax.name ?? `Passager ${i + 1}`,
            phone: pax.telephone ?? pax.phone ?? b.contact_phone,
            idNumber: pax.cni ?? pax.id_number ?? null,
            seatNumber: seatNums[i] ?? "?",
            boardingCity: b.boarding_city ?? trip.fromCity,
            alightingCity: b.alighting_city ?? trip.toCity,
            passengerStatus: b.passenger_status ?? "booked",
            bookingStatus: b.booking_status,
          });
        });
      }
    }

    // Grouper par ville de descente
    const grouped: Record<string, any[]> = {};
    for (const p of passengers) {
      const city = p.alightingCity || trip.to_city;
      if (!grouped[city]) grouped[city] = [];
      grouped[city].push(p);
    }

    const summary = {
      total: passengers.length,
      onBoard:  passengers.filter(p => p.passengerStatus !== "alighted").length,
      alighted: passengers.filter(p => p.passengerStatus === "alighted").length,
    };

    res.json({ tripId, passengers, grouped, summary });
  } catch (err) {
    console.error("[chef/passengers]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/chef/audit-log — historique des actions chef ── */
router.get("/chef/audit-log", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { user } = ctx;

    const limit = Math.min(Number(req.query.limit ?? 50), 100);

    const logs = await db.execute(sql`
      SELECT id, action, target_id, target_type, metadata, created_at
      FROM audit_logs
      WHERE user_id = ${user.id}
        AND user_role = 'chef_agence'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    const parsed = (logs.rows as any[]).map(row => {
      let meta = {};
      try { meta = JSON.parse(row.metadata ?? "{}"); } catch {}
      return { ...row, ...meta };
    });

    res.json({ logs: parsed, total: parsed.length });
  } catch (err) {
    console.error("[chef/audit-log]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─── GET /agent/chef/agents — agents de l'agence ────────────── */
router.get("/chef/agents", async (req, res) => {
  try {
    const ctx = await requireChefAgence(req.headers.authorization);
    if (!ctx) return res.status(403).json({ error: "Accès refusé" });
    const { agent } = ctx;

    const agentsInAgence = await db.execute(sql`
      SELECT a.id, a.agent_code, a.agent_role, a.status, a.trip_id, a.bus_id,
        u.name, u.email, u.phone, u.push_token,
        t.from_city, t.to_city, t.date, t.departure_time, t.status as trip_status
      FROM agents a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN trips t ON t.id = a.trip_id
      WHERE a.agence_id = ${agent.agenceId}
        AND u.status = 'active'
      ORDER BY u.name ASC
    `);

    res.json({ agents: agentsInAgence.rows });
  } catch (err) {
    console.error("[chef/agents]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;

