import { Router, type IRouter } from "express";
import { db, parcelsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { tokenStore } from "./auth";
import { auditLog, ACTIONS } from "../audit";

const router: IRouter = Router();

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);
const generateTrackingRef = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "", part2 = "";
  for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
  return `GBX-${part1}-${part2}`;
};

function getUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  return tokenStore.get(token) || null;
}

// Distance matrix for pricing (1-10 scale)
const CITY_DISTANCES: Record<string, Record<string, number>> = {
  Abidjan: { Bouaké: 5, Yamoussoukro: 3, Korhogo: 9, "San Pedro": 4, Daloa: 5, Man: 7, Gagnoa: 4, Divo: 2, Abengourou: 3, Soubré: 5, Bondoukou: 7 },
  Bouaké: { Abidjan: 5, Korhogo: 4, Yamoussoukro: 2, Daloa: 3, Man: 5, Bondoukou: 4, Abengourou: 4 },
  Yamoussoukro: { Abidjan: 3, Bouaké: 2, Korhogo: 6, Daloa: 2, Gagnoa: 2 },
  Korhogo: { Abidjan: 9, Bouaké: 4, Yamoussoukro: 6, Man: 6 },
  "San Pedro": { Abidjan: 4, Daloa: 5, Gagnoa: 4, Soubré: 2 },
  Daloa: { Abidjan: 5, Bouaké: 3, Yamoussoukro: 2, Man: 3, Gagnoa: 2, Soubré: 3 },
  Man: { Abidjan: 7, Bouaké: 5, Daloa: 3, Korhogo: 6 },
  Gagnoa: { Abidjan: 4, Daloa: 2, Yamoussoukro: 2, "San Pedro": 4, Soubré: 2 },
  Divo: { Abidjan: 2, Gagnoa: 2, Daloa: 3 },
  Abengourou: { Abidjan: 3, Bouaké: 4, Bondoukou: 3 },
  Soubré: { "San Pedro": 2, Daloa: 3, Gagnoa: 2, Abidjan: 5 },
  Bondoukou: { Abidjan: 7, Bouaké: 4, Abengourou: 3 },
};

function getDistance(from: string, to: string): number {
  return CITY_DISTANCES[from]?.[to] ?? CITY_DISTANCES[to]?.[from] ?? 5;
}

export function calculateParcelPrice(
  fromCity: string,
  toCity: string,
  weight: number,
  deliveryType: string
): number {
  const distance = getDistance(fromCity, toCity);
  const base = 1500;
  const distanceExtra = distance * 300;
  const weightExtra = Math.ceil(weight) * 400;
  const deliveryExtra = deliveryType === "livraison_domicile" ? 1000 : 0;
  return base + distanceExtra + weightExtra + deliveryExtra;
}

// POST /parcels — create a parcel shipment
router.post("/", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      senderName,
      senderPhone,
      receiverName,
      receiverPhone,
      fromCity,
      toCity,
      parcelType,
      weight,
      description,
      deliveryType,
      paymentMethod,
      notes,
      trackingRef: clientTrackingRef,
    } = req.body;

    if (!senderName || !senderPhone || !receiverName || !receiverPhone ||
        !fromCity || !toCity || !parcelType || !weight || !deliveryType) {
      res.status(400).json({ error: "Champs obligatoires manquants" });
      return;
    }

    const amount = calculateParcelPrice(fromCity, toCity, parseFloat(weight), deliveryType);
    const commissionAmount = Math.round(amount * 0.05);

    // Use the client-supplied ref if it looks valid, otherwise generate one
    const trackingRef = (typeof clientTrackingRef === "string" && clientTrackingRef.startsWith("GBX-"))
      ? clientTrackingRef
      : generateTrackingRef();

    const parcel = await db.insert(parcelsTable).values({
      id: generateId(),
      trackingRef,
      userId,
      senderName,
      senderPhone,
      receiverName,
      receiverPhone,
      fromCity,
      toCity,
      parcelType,
      weight: parseFloat(weight),
      description: description || null,
      deliveryType,
      amount,
      commissionAmount,
      paymentMethod: paymentMethod || "orange",
      paymentStatus: "paid",
      status: "en_attente",
      notes: notes || null,
    }).returning();

    auditLog({ userId, userRole: "client", req }, ACTIONS.PARCEL_CREATE, parcel[0].id, "parcel", {
      trackingRef: parcel[0].trackingRef, fromCity, toCity, weight, amount,
    }).catch(() => {});

    res.status(201).json(parcel[0]);
  } catch (err) {
    console.error("Create parcel error:", err);
    res.status(500).json({ error: "Échec de la création du colis" });
  }
});

// GET /parcels — list user's parcels
router.get("/", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parcels = await db
      .select()
      .from(parcelsTable)
      .where(eq(parcelsTable.userId, userId))
      .orderBy(desc(parcelsTable.createdAt));

    res.json(parcels);
  } catch (err) {
    console.error("List parcels error:", err);
    res.status(500).json({ error: "Échec du chargement des colis" });
  }
});

// GET /parcels/:parcelId — get a single parcel (public by ID)
router.get("/:parcelId", async (req, res) => {
  try {
    const parcels = await db
      .select()
      .from(parcelsTable)
      .where(eq(parcelsTable.id, req.params.parcelId))
      .limit(1);

    if (!parcels.length) {
      res.status(404).json({ error: "Colis introuvable" });
      return;
    }

    res.json(parcels[0]);
  } catch (err) {
    console.error("Get parcel error:", err);
    res.status(500).json({ error: "Échec du chargement du colis" });
  }
});

// GET /parcels/track/:trackingRef — track by reference
router.get("/track/:trackingRef", async (req, res) => {
  try {
    const parcels = await db
      .select()
      .from(parcelsTable)
      .where(eq(parcelsTable.trackingRef, req.params.trackingRef))
      .limit(1);

    if (!parcels.length) {
      res.status(404).json({ error: "Référence de suivi introuvable" });
      return;
    }

    res.json(parcels[0]);
  } catch (err) {
    console.error("Track parcel error:", err);
    res.status(500).json({ error: "Échec du suivi" });
  }
});

// PATCH /parcels/:parcelId/status — update status (agent/admin)
router.patch("/:parcelId/status", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { status } = req.body;
    const validStatuses = [
      "en_attente", "confirme", "en_cours_ramassage",
      "arrive_gare_depart", "pris_en_charge", "en_transit",
      "arrive_destination", "en_livraison", "livre", "annule",
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "Statut invalide" });
      return;
    }

    await db
      .update(parcelsTable)
      .set({ status })
      .where(eq(parcelsTable.id, req.params.parcelId));

    const updated = await db
      .select()
      .from(parcelsTable)
      .where(eq(parcelsTable.id, req.params.parcelId))
      .limit(1);

    res.json(updated[0]);
  } catch (err) {
    console.error("Update parcel status error:", err);
    res.status(500).json({ error: "Échec de la mise à jour" });
  }
});

// GET /parcels/price/estimate — price estimation
router.get("/price/estimate", async (req, res) => {
  try {
    const { fromCity, toCity, weight, deliveryType } = req.query;
    if (!fromCity || !toCity || !weight || !deliveryType) {
      res.status(400).json({ error: "Paramètres manquants" });
      return;
    }
    const amount = calculateParcelPrice(
      fromCity as string,
      toCity as string,
      parseFloat(weight as string),
      deliveryType as string
    );
    res.json({ amount });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'estimation" });
  }
});

export default router;
