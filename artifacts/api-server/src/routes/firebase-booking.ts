import { Router, Request, Response } from "express";
import db from "../firebase.js";

const router = Router();

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
    const { user_id, trajet_id, siege_numero } = req.body;

    if (!user_id || !trajet_id || siege_numero === undefined) {
      return res.status(400).json({ error: "user_id, trajet_id et siege_numero sont requis" });
    }

    const trajetRef = db!.collection("trajets").doc(trajet_id);
    const trajetDoc = await trajetRef.get();

    if (!trajetDoc.exists) {
      return res.status(404).json({ error: "Trajet introuvable" });
    }

    const trajet = trajetDoc.data()!;

    if (trajet.places_disponibles <= 0) {
      return res.status(400).json({ error: "Plus de places disponibles" });
    }

    const check = await db!.collection("reservations")
      .where("trajet_id", "==", trajet_id)
      .where("siege_numero", "==", siege_numero)
      .get();

    if (!check.empty) {
      return res.status(400).json({ error: "Siège déjà réservé" });
    }

    const reservationRef = await db!.collection("reservations").add({
      user_id,
      trajet_id,
      bus_id: trajet.bus_id,
      compagnie_id: trajet.compagnie_id,
      siege_numero,
      prix: trajet.prix,
      statut: "en_attente",
      date_reservation: new Date(),
    });

    await trajetRef.update({
      places_disponibles: trajet.places_disponibles - 1,
    });

    res.json({
      success: true,
      reservation_id: reservationRef.id,
      message: "Réservation créée",
    });
  } catch (error) {
    console.error("[Firebase /reserver]", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /firebase/payer
router.post("/payer", requireFirebase, async (req: Request, res: Response) => {
  try {
    const { reservation_id, methode } = req.body;

    if (!reservation_id || !methode) {
      return res.status(400).json({ error: "reservation_id et methode sont requis" });
    }

    const reservationRef = db!.collection("reservations").doc(reservation_id);
    const reservationDoc = await reservationRef.get();

    if (!reservationDoc.exists) {
      return res.status(404).json({ error: "Réservation introuvable" });
    }

    const reservation = reservationDoc.data()!;

    await db!.collection("paiements").add({
      reservation_id,
      user_id: reservation.user_id,
      montant: reservation.prix,
      methode,
      statut: "payé",
      date_paiement: new Date(),
    });

    await reservationRef.update({ statut: "confirmé" });

    const codeTicket = "GB-" + Date.now();

    await db!.collection("tickets").add({
      reservation_id,
      user_id: reservation.user_id,
      trajet_id: reservation.trajet_id,
      bus_id: reservation.bus_id,
      compagnie_id: reservation.compagnie_id,
      siege_numero: reservation.siege_numero,
      code_ticket: codeTicket,
      statut: "valide",
      date_creation: new Date(),
    });

    res.json({
      success: true,
      message: "Paiement effectué et ticket généré",
      code_ticket: codeTicket,
    });
  } catch (error) {
    console.error("[Firebase /payer]", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
