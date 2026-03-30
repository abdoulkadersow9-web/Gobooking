/**
 * Routes CAISSE — Logique de caisse par rôle agent
 *
 * Rôles avec caisse:
 *   - agent_ticket / guichet / vente  → caisse par départ (bookings)
 *   - agent_bagage / bagage           → caisse par départ (bagage_items)
 *   - agent_route  / route            → caisse par départ (route bookings)
 *   - agent_colis  / colis            → caisse journalière (parcels)
 *
 * Rôles sans caisse:
 *   - agent_embarquement, logistique
 */

import { Router } from "express";
import { eq, desc, and, gte, lte, inArray, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  agentsTable,
  tripsTable,
  bookingsTable,
  bagageItemsTable,
  parcelsTable,
  agentCashSessionsTable,
} from "@workspace/db";
import { tokenStore } from "./auth";

const router = Router();

/* ── helpers ────────────────────────────────────────────────────────── */
function generateId(): string {
  return "cs-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TICKET_ROLES   = ["agent_ticket", "guichet", "vente", "agent_guichet"];
const BAGAGE_ROLES   = ["agent_bagage", "bagage"];
const ROUTE_ROLES    = ["agent_route", "route"];
const COLIS_ROLES    = ["agent_colis", "colis", "reception_colis"];
const NO_CAISSE_ROLES = ["agent_embarquement", "embarquement", "logistique", "suivi", "securite"];

function roleCategory(role: string): "ticket" | "bagage" | "route" | "colis" | "none" {
  if (TICKET_ROLES.includes(role)) return "ticket";
  if (BAGAGE_ROLES.includes(role)) return "bagage";
  if (ROUTE_ROLES.includes(role))  return "route";
  if (COLIS_ROLES.includes(role))  return "colis";
  return "none";
}

/* ── Auth middleware ─────────────────────────────────────────────────── */
async function getAgent(req: any) {
  const header = req.headers.authorization ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const userId = tokenStore.get(token);
  if (!userId)  return null;

  const users  = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user   = users[0];
  if (!user)    return null;

  const agents = await db.select().from(agentsTable).where(eq(agentsTable.userId, userId)).limit(1);
  const agent  = agents[0];

  return { user, agent };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GET /agent/caisse/summary?tripId=X&date=YYYY-MM-DD
   Calcule la caisse en temps réel depuis les données existantes
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
router.get("/caisse/summary", async (req, res) => {
  try {
    const ctx = await getAgent(req);
    if (!ctx) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { user, agent } = ctx;

    const agentRole = (agent?.agentRole ?? user.agentRole ?? "") as string;
    const category  = roleCategory(agentRole);
    const tripId    = req.query.tripId as string | undefined;
    const dateParam = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const companyId = agent?.companyId ?? (user as any).companyId ?? "";

    if (category === "none") {
      res.json({ category: "none", message: "Cet agent n'a pas de caisse" });
      return;
    }

    // ── TICKET ────────────────────────────────────────────────────────
    if (category === "ticket") {
      if (!tripId) { res.status(400).json({ error: "tripId requis pour agent ticket" }); return; }

      const rows = await db.select({
        id:            bookingsTable.id,
        bookingRef:    bookingsTable.bookingRef,
        totalAmount:   bookingsTable.totalAmount,
        seatNumbers:   bookingsTable.seatNumbers,
        passengers:    bookingsTable.passengers,
        paymentMethod: bookingsTable.paymentMethod,
        status:        bookingsTable.status,
        createdAt:     bookingsTable.createdAt,
        bookingSource: bookingsTable.bookingSource,
        contactPhone:  bookingsTable.contactPhone,
      }).from(bookingsTable)
        .where(and(
          eq(bookingsTable.tripId, tripId),
          inArray(bookingsTable.status, ["confirmed", "validated", "boarded"]),
          sql`${bookingsTable.bookingSource} NOT IN ('mobile', 'online')`,
        ))
        .orderBy(desc(bookingsTable.createdAt));

      const tripRows = await db.select({
        from:          tripsTable.from,
        to:            tripsTable.to,
        departureTime: tripsTable.departureTime,
        date:          tripsTable.date,
        status:        tripsTable.status,
      }).from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
      const trip = tripRows[0] ?? null;

      const byPayment: Record<string, number> = {};
      for (const b of rows) {
        const pm = b.paymentMethod ?? "espèces";
        byPayment[pm] = (byPayment[pm] ?? 0) + (b.totalAmount ?? 0);
      }

      const totalAmount    = rows.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
      const passCount      = rows.reduce((s, b) => {
        const pax = b.passengers as any[];
        return s + (Array.isArray(pax) ? pax.length : 1);
      }, 0);

      const transactions = rows.map(b => ({
        id:         b.id,
        ref:        b.bookingRef,
        label:      (() => {
          const pax = b.passengers as any[];
          return Array.isArray(pax) && pax[0]?.name ? pax[0].name : "Passager";
        })(),
        seatNumbers: b.seatNumbers,
        amount:     b.totalAmount ?? 0,
        payment:    b.paymentMethod ?? "espèces",
        phone:      b.contactPhone,
        status:     b.status,
        date:       b.createdAt,
        type:       "billet",
      }));

      res.json({
        category:      "ticket",
        sessionType:   "trip",
        tripId,
        trip,
        totalAmount,
        transactionCount: rows.length,
        passengerCount:   passCount,
        byPayment,
        transactions,
        canClose:      true,
      });
      return;
    }

    // ── BAGAGE ────────────────────────────────────────────────────────
    if (category === "bagage") {
      if (!tripId) { res.status(400).json({ error: "tripId requis pour agent bagage" }); return; }

      const agentRows = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
      const agentRecord = agentRows[0];

      const rows = await db.select({
        id:            bagageItemsTable.id,
        trackingRef:   bagageItemsTable.trackingRef,
        passengerName: bagageItemsTable.passengerName,
        passengerPhone:bagageItemsTable.passengerPhone,
        bagageType:    bagageItemsTable.bagageType,
        weightKg:      bagageItemsTable.weightKg,
        price:         bagageItemsTable.price,
        paymentMethod: bagageItemsTable.paymentMethod,
        paymentStatus: bagageItemsTable.paymentStatus,
        status:        bagageItemsTable.status,
        createdAt:     bagageItemsTable.createdAt,
      }).from(bagageItemsTable)
        .where(and(
          eq(bagageItemsTable.tripId, tripId),
          agentRecord ? eq(bagageItemsTable.agentId, agentRecord.id) : sql`true`,
        ))
        .orderBy(desc(bagageItemsTable.createdAt));

      const tripRows = await db.select({
        from:          tripsTable.from,
        to:            tripsTable.to,
        departureTime: tripsTable.departureTime,
        date:          tripsTable.date,
        status:        tripsTable.status,
      }).from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
      const trip = tripRows[0] ?? null;

      const byPayment: Record<string, number> = {};
      for (const b of rows) {
        const pm = b.paymentMethod ?? "espèces";
        byPayment[pm] = (byPayment[pm] ?? 0) + (b.price ?? 0);
      }

      const transactions = rows.map(b => ({
        id:      b.id,
        ref:     b.trackingRef,
        label:   b.passengerName,
        type:    b.bagageType ?? "valise",
        weight:  b.weightKg,
        amount:  b.price ?? 0,
        payment: b.paymentMethod ?? "espèces",
        phone:   b.passengerPhone,
        status:  b.status,
        date:    b.createdAt,
      }));

      res.json({
        category:         "bagage",
        sessionType:      "trip",
        tripId,
        trip,
        totalAmount:      rows.reduce((s, b) => s + (b.price ?? 0), 0),
        transactionCount: rows.length,
        byPayment,
        transactions,
        canClose:         true,
      });
      return;
    }

    // ── ROUTE ─────────────────────────────────────────────────────────
    if (category === "route") {
      if (!tripId) { res.status(400).json({ error: "tripId requis pour agent route" }); return; }

      const rows = await db.select({
        id:            bookingsTable.id,
        bookingRef:    bookingsTable.bookingRef,
        totalAmount:   bookingsTable.totalAmount,
        seatNumbers:   bookingsTable.seatNumbers,
        passengers:    bookingsTable.passengers,
        paymentMethod: bookingsTable.paymentMethod,
        status:        bookingsTable.status,
        createdAt:     bookingsTable.createdAt,
        contactPhone:  bookingsTable.contactPhone,
      }).from(bookingsTable)
        .where(and(
          eq(bookingsTable.tripId, tripId),
          eq(bookingsTable.bookingSource, "route"),
          inArray(bookingsTable.status, ["confirmed", "validated", "boarded"]),
        ))
        .orderBy(desc(bookingsTable.createdAt));

      const tripRows = await db.select({
        from:          tripsTable.from,
        to:            tripsTable.to,
        departureTime: tripsTable.departureTime,
        date:          tripsTable.date,
        status:        tripsTable.status,
      }).from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
      const trip = tripRows[0] ?? null;

      const byPayment: Record<string, number> = {};
      for (const b of rows) {
        const pm = b.paymentMethod ?? "espèces";
        byPayment[pm] = (byPayment[pm] ?? 0) + (b.totalAmount ?? 0);
      }

      const transactions = rows.map(b => ({
        id:          b.id,
        ref:         b.bookingRef,
        label:       (() => {
          const pax = b.passengers as any[];
          return Array.isArray(pax) && pax[0]?.name ? pax[0].name : "Passager route";
        })(),
        seatNumbers: b.seatNumbers,
        amount:      b.totalAmount ?? 0,
        payment:     b.paymentMethod ?? "espèces",
        phone:       b.contactPhone,
        status:      b.status,
        date:        b.createdAt,
        type:        "billet_route",
      }));

      res.json({
        category:         "route",
        sessionType:      "trip",
        tripId,
        trip,
        totalAmount:      rows.reduce((s, b) => s + (b.totalAmount ?? 0), 0),
        transactionCount: rows.length,
        byPayment,
        transactions,
        canClose:         true,
      });
      return;
    }

    // ── COLIS ─────────────────────────────────────────────────────────
    if (category === "colis") {
      const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
      const endOfDay   = new Date(`${dateParam}T23:59:59.999Z`);

      const rows = await db.select({
        id:            parcelsTable.id,
        trackingRef:   parcelsTable.trackingRef,
        senderName:    parcelsTable.senderName,
        senderPhone:   parcelsTable.senderPhone,
        receiverName:  parcelsTable.receiverName,
        fromCity:      parcelsTable.fromCity,
        toCity:        parcelsTable.toCity,
        amount:        parcelsTable.amount,
        paymentMethod: parcelsTable.paymentMethod,
        paymentStatus: parcelsTable.paymentStatus,
        status:        parcelsTable.status,
        tripId:        parcelsTable.tripId,
        parcelType:    parcelsTable.parcelType,
        weight:        parcelsTable.weight,
        createdAt:     parcelsTable.createdAt,
      }).from(parcelsTable)
        .where(and(
          eq(parcelsTable.userId, user.id),
          gte(parcelsTable.createdAt, startOfDay),
          lte(parcelsTable.createdAt, endOfDay),
        ))
        .orderBy(desc(parcelsTable.createdAt));

      const byStatus: Record<string, number> = {};
      const byPayment: Record<string, number> = {};
      for (const p of rows) {
        const st = p.status ?? "créé";
        byStatus[st]  = (byStatus[st]  ?? 0) + 1;
        const pm = p.paymentMethod ?? "espèces";
        byPayment[pm] = (byPayment[pm] ?? 0) + (p.amount ?? 0);
      }

      const enAttente  = rows.filter(p => !p.tripId || p.status === "créé" || p.status === "en_attente");
      const embarqués  = rows.filter(p => p.tripId && p.status !== "créé" && p.status !== "en_attente");
      const livrés     = rows.filter(p => p.status === "livré" || p.status === "retiré");

      const transactions = rows.map(p => ({
        id:       p.id,
        ref:      p.trackingRef,
        label:    `${p.senderName} → ${p.receiverName}`,
        route:    `${p.fromCity} → ${p.toCity}`,
        amount:   p.amount ?? 0,
        payment:  p.paymentMethod ?? "espèces",
        status:   p.status,
        type:     p.parcelType ?? "colis",
        weight:   p.weight,
        tripId:   p.tripId,
        date:     p.createdAt,
      }));

      res.json({
        category:         "colis",
        sessionType:      "daily",
        sessionDate:      dateParam,
        totalAmount:      rows.reduce((s, p) => s + (p.amount ?? 0), 0),
        transactionCount: rows.length,
        byStatus,
        byPayment,
        enAttenteCount:  enAttente.length,
        embarquésCount:  embarqués.length,
        livrésCount:     livrés.length,
        transactions,
        canClose:        true,
      });
      return;
    }

    res.json({ category: "none" });
  } catch (err: any) {
    console.error("[caisse/summary]", err?.message ?? err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GET /agent/caisse/history
   Historique des sessions fermées pour cet agent
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
router.get("/caisse/history", async (req, res) => {
  try {
    const ctx = await getAgent(req);
    if (!ctx) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { user } = ctx;

    const sessions = await db.select().from(agentCashSessionsTable)
      .where(eq(agentCashSessionsTable.agentUserId, user.id))
      .orderBy(desc(agentCashSessionsTable.createdAt))
      .limit(50);

    res.json({ sessions });
  } catch (err: any) {
    console.error("[caisse/history]", err?.message ?? err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   POST /agent/caisse/close
   Fermer et envoyer la caisse au chef d'agence
   Body: { tripId?, date?, comment, summary (from /caisse/summary) }
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
router.post("/caisse/close", async (req, res) => {
  try {
    const ctx = await getAgent(req);
    if (!ctx) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { user, agent } = ctx;

    const agentRole = (agent?.agentRole ?? (user as any).agentRole ?? "") as string;
    const category  = roleCategory(agentRole);
    if (category === "none") {
      res.status(403).json({ error: "Cet agent n'a pas de caisse à fermer" });
      return;
    }

    const {
      tripId,
      sessionDate,
      comment,
      totalAmount,
      transactionCount,
      breakdown,
      transactions,
      tripFrom,
      tripTo,
      tripDeparture,
    } = req.body;

    const companyId = agent?.companyId ?? (user as any).companyId ?? "";
    const sessionType = category === "colis" ? "daily" : "trip";

    /* Check for duplicate (already closed for same trip/date) */
    if (sessionType === "trip" && tripId) {
      const existing = await db.select({ id: agentCashSessionsTable.id })
        .from(agentCashSessionsTable)
        .where(and(
          eq(agentCashSessionsTable.agentUserId, user.id),
          eq(agentCashSessionsTable.tripId, tripId),
          inArray(agentCashSessionsTable.status, ["sent", "validated"]),
        ))
        .limit(1);
      if (existing.length > 0) {
        res.status(409).json({ error: "Caisse déjà soumise pour ce départ" });
        return;
      }
    }

    const id = generateId();
    const now = new Date();

    await db.insert(agentCashSessionsTable).values({
      id,
      agentId:          agent?.id ?? user.id,
      agentUserId:      user.id,
      agentName:        user.name ?? null,
      agentRole,
      companyId,
      agenceId:         agent?.agenceId ?? null,
      sessionType,
      tripId:           tripId ?? null,
      sessionDate:      sessionDate ?? null,
      tripFrom:         tripFrom ?? null,
      tripTo:           tripTo   ?? null,
      tripDeparture:    tripDeparture ?? null,
      status:           "sent",
      totalAmount:      Number(totalAmount ?? 0),
      transactionCount: Number(transactionCount ?? 0),
      breakdown:        breakdown ?? {},
      transactions:     transactions ?? [],
      agentComment:     comment ?? null,
      closedAt:         now,
      sentAt:           now,
    });

    res.status(201).json({ id, message: "Caisse soumise au chef d'agence" });
  } catch (err: any) {
    console.error("[caisse/close]", err?.message ?? err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ── CHEF D'AGENCE ──────────────────────────────────────────────────
   GET /agent/chef/caisses?status=sent&role=agent_ticket
   Liste les sessions de caisse pour le chef
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
router.get("/chef/caisses", async (req, res) => {
  try {
    const ctx = await getAgent(req);
    if (!ctx) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { user, agent } = ctx;

    const agentRole = (agent?.agentRole ?? (user as any).agentRole ?? "") as string;
    if (agentRole !== "chef_agence") {
      res.status(403).json({ error: "Accès réservé au chef d'agence" });
      return;
    }

    const companyId  = agent?.companyId ?? (user as any).companyId ?? "";
    const statusFilt = req.query.status as string | undefined;
    const roleFilt   = req.query.role   as string | undefined;

    let query = db.select().from(agentCashSessionsTable)
      .where(eq(agentCashSessionsTable.companyId, companyId))
      .orderBy(desc(agentCashSessionsTable.createdAt))
      .limit(100)
      .$dynamic();

    const sessions = await db.select().from(agentCashSessionsTable)
      .where(and(
        eq(agentCashSessionsTable.companyId, companyId),
        statusFilt ? eq(agentCashSessionsTable.status, statusFilt) : sql`true`,
        roleFilt   ? eq(agentCashSessionsTable.agentRole, roleFilt) : sql`true`,
      ))
      .orderBy(desc(agentCashSessionsTable.createdAt))
      .limit(100);

    /* Group by agent role */
    const grouped: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      const cat = roleCategory(s.agentRole);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }

    const pending   = sessions.filter(s => s.status === "sent").length;
    const validated = sessions.filter(s => s.status === "validated").length;
    const rejected  = sessions.filter(s => s.status === "rejected").length;

    res.json({ sessions, grouped, stats: { pending, validated, rejected } });
  } catch (err: any) {
    console.error("[chef/caisses]", err?.message ?? err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   POST /agent/chef/caisses/:id/validate
   Chef: valider ou rejeter une caisse
   Body: { decision: "validated" | "rejected", comment? }
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
router.post("/chef/caisses/:id/validate", async (req, res) => {
  try {
    const ctx = await getAgent(req);
    if (!ctx) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { user, agent } = ctx;

    const agentRole = (agent?.agentRole ?? (user as any).agentRole ?? "") as string;
    if (agentRole !== "chef_agence") {
      res.status(403).json({ error: "Accès réservé au chef d'agence" });
      return;
    }

    const sessionId = req.params.id;
    const { decision, comment } = req.body;

    if (!["validated", "rejected"].includes(decision)) {
      res.status(400).json({ error: "decision doit être 'validated' ou 'rejected'" });
      return;
    }

    const rows = await db.select().from(agentCashSessionsTable)
      .where(eq(agentCashSessionsTable.id, sessionId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Session introuvable" }); return; }

    await db.update(agentCashSessionsTable)
      .set({
        status:      decision,
        chefId:      user.id,
        chefComment: comment ?? null,
        validatedAt: new Date(),
      })
      .where(eq(agentCashSessionsTable.id, sessionId));

    res.json({ message: `Caisse ${decision === "validated" ? "validée" : "rejetée"}` });
  } catch (err: any) {
    console.error("[chef/caisses/validate]", err?.message ?? err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GET /agent/caisse/trips
   Liste les trajets disponibles pour fermer une caisse (ticket/bagage/route)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
router.get("/caisse/trips", async (req, res) => {
  try {
    const ctx = await getAgent(req);
    if (!ctx) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { user, agent } = ctx;
    const companyId = agent?.companyId ?? (user as any).companyId ?? "";

    const trips = await db.select({
      id:            tripsTable.id,
      from:          tripsTable.from,
      to:            tripsTable.to,
      date:          tripsTable.date,
      departureTime: tripsTable.departureTime,
      status:        tripsTable.status,
    }).from(tripsTable)
      .where(and(
        eq(tripsTable.companyId, companyId),
        inArray(tripsTable.status, ["scheduled", "in_progress", "completed", "arrived"]),
      ))
      .orderBy(desc(tripsTable.date), desc(tripsTable.departureTime))
      .limit(20);

    /* Enrichir avec les sessions déjà soumises */
    const submitted = await db.select({
      tripId: agentCashSessionsTable.tripId,
      status: agentCashSessionsTable.status,
    }).from(agentCashSessionsTable)
      .where(and(
        eq(agentCashSessionsTable.agentUserId, user.id),
        inArray(agentCashSessionsTable.status, ["sent", "validated"]),
      ));

    const submittedIds = new Set(submitted.map(s => s.tripId));

    res.json({
      trips: trips.map(t => ({
        ...t,
        caisseAlreadySent: submittedIds.has(t.id),
      })),
    });
  } catch (err: any) {
    console.error("[caisse/trips]", err?.message ?? err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
