import { Router, Request, Response } from "express";
import db from "../firebase.js";

const router = Router();

// GET /firebase/test-db
router.get("/test-db", async (_req: Request, res: Response) => {
  if (!db) {
    return res.status(503).send("Firebase non configuré — ajoutez les secrets FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
  }
  try {
    const snapshot = await db.collection("trajets").get();
    res.send("Trajets: " + snapshot.size);
  } catch (error) {
    console.error("[Firebase /test-db]", error);
    res.status(500).send("Erreur connexion Firestore");
  }
});

// Middleware : vérifie que Firebase est configuré
function requireFirebase(req: Request, res: Response, next: Function) {
  if (!db) {
    return res.status(503).json({
      error: "Firebase non configuré. Ajoutez FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY dans les secrets.",
    });
  }
  next();
}

// POST /firebase/reserver
router.post("/reserver", requireFirebase, async (req: Request, res: Response) => {
  try {
    const { user_id, trajet_id, siege_numero, prix } = req.body;

    const reservationRef = await db!.collection("reservations").add({
      user_id,
      trajet_id,
      siege_numero,
      prix,
      statut: "confirmé",
      date_reservation: new Date(),
    });

    res.send({
      success: true,
      reservation_id: reservationRef.id,
      message: "Réservation créée avec succès",
    });
  } catch (error) {
    console.error("[Firebase /reserver]", error);
    res.status(500).send("Erreur serveur");
  }
});

// POST /firebase/payer
router.post("/payer", requireFirebase, async (req: Request, res: Response) => {
  try {
    const { reservation_id, user_id, montant, methode } = req.body;

    const paiementRef = await db!.collection("paiements").add({
      reservation_id,
      user_id,
      montant,
      methode,
      statut: "payé",
      date_paiement: new Date(),
    });

    await db!.collection("reservations").doc(reservation_id).update({
      statut: "payé",
    });

    res.send({
      success: true,
      paiement_id: paiementRef.id,
      message: "Paiement effectué avec succès",
    });
  } catch (error) {
    console.error("[Firebase /payer]", error);
    res.status(500).send("Erreur paiement");
  }
});

// POST /firebase/ticket
router.post("/ticket", requireFirebase, async (req: Request, res: Response) => {
  try {
    const { reservation_id, user_id, trajet_id, siege_numero } = req.body;

    const code_ticket = "TICK-" + Date.now();

    const ticketRef = await db!.collection("tickets").add({
      reservation_id,
      user_id,
      trajet_id,
      siege_numero,
      code_ticket,
      statut: "valide",
      date_creation: new Date(),
    });

    res.send({
      success: true,
      ticket_id: ticketRef.id,
      code_ticket,
    });
  } catch (error) {
    console.error("[Firebase /ticket]", error);
    res.status(500).send("Erreur ticket");
  }
});

export default router;
