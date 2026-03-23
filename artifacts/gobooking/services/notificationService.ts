/**
 * notificationService.ts
 * ─────────────────────
 * Façade unifiée pour toutes les notifications GoBooking.
 * Fournit des helpers typés pour chaque événement métier.
 *
 * Utilisation :
 *   import { notifyReservationConfirmee } from "@/services/notificationService";
 *   await notifyReservationConfirmee({ ref: "BK-2024", route: "Abidjan → Bouaké" });
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { BASE_URL } from "@/utils/api";
import {
  registerForPushNotifications,
  scheduleLocalNotification,
  sendPushNotification,
} from "@/utils/notifications";

/* ─── Gestionnaire global des notifications reçues ────────────── */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList:  true,
  }),
});

/* ─── Enregistrement du token push au démarrage ───────────────── */

/**
 * Demande la permission, récupère le token Expo Push,
 * et le persiste sur le serveur GoBooking.
 */
export async function initPushNotifications(authToken: string): Promise<void> {
  if (Platform.OS === "web") return;

  const expoPushToken = await registerForPushNotifications();
  if (!expoPushToken) return;

  try {
    await fetch(`${BASE_URL}/auth/push-token`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pushToken: expoPushToken }),
    });
  } catch {
    /* Silencieux — sera réessayé au prochain login */
  }
}

/* ─── Helper interne ───────────────────────────────────────────── */

async function localNotif(title: string, body: string): Promise<void> {
  await scheduleLocalNotification(title, body);
}

async function remotePush(token: string, title: string, body: string): Promise<void> {
  await sendPushNotification(token, title, body);
}

/* ══════════════════════════════════════════════════════════════════
   NOTIFICATIONS CLIENTS
══════════════════════════════════════════════════════════════════ */

/** Appelée après confirmation de paiement */
export async function notifyReservationConfirmee(params: {
  ref?:   string;
  route?: string;
  date?:  string;
}): Promise<void> {
  const ref   = params.ref   ? ` · Réf ${params.ref}` : "";
  const route = params.route ? `Trajet : ${params.route}` : "Votre billet a été validé.";
  const date  = params.date  ? ` (${params.date})`  : "";
  await localNotif(
    `✅ Réservation confirmée${ref}`,
    `${route}${date}`
  );
}

/** Appelée quand le billet est scanné / embarquement validé */
export async function notifyEmbarquementValide(params: {
  route?: string;
  remoteToken?: string;
}): Promise<void> {
  const msg = params.route
    ? `Trajet ${params.route} — bon voyage !`
    : "Votre embarquement a été validé. Bon voyage !";
  await localNotif("🚌 Embarquement validé", msg);
  if (params.remoteToken) {
    await remotePush(params.remoteToken, "GoBooking 🚌", msg);
  }
}

/** Appelée quand un colis est arrivé à destination */
export async function notifyColisArrive(params: {
  trackingRef?: string;
  gare?:        string;
  remoteToken?: string;
}): Promise<void> {
  const ref  = params.trackingRef ? ` · ${params.trackingRef}` : "";
  const gare = params.gare        ? ` à ${params.gare}`        : "";
  const msg  = `Votre colis${ref} est arrivé${gare}.`;
  await localNotif("📦 Colis arrivé", msg);
  if (params.remoteToken) {
    await remotePush(params.remoteToken, "GoBooking 📦", msg);
  }
}

/** Appelée quand un colis est livré / remis au destinataire */
export async function notifyColisLivre(params: {
  trackingRef?: string;
  remoteToken?: string;
}): Promise<void> {
  const ref = params.trackingRef ? ` (${params.trackingRef})` : "";
  const msg = `Votre colis${ref} a été livré avec succès.`;
  await localNotif("✅ Colis livré", msg);
  if (params.remoteToken) {
    await remotePush(params.remoteToken, "GoBooking ✅", msg);
  }
}

/* ══════════════════════════════════════════════════════════════════
   NOTIFICATIONS AGENTS
══════════════════════════════════════════════════════════════════ */

/** Appelée quand l'agent démarre un trajet */
export async function notifyAgentTrajetEnCours(route?: string): Promise<void> {
  const msg = route ? `Trajet ${route} démarré.` : "Votre trajet est en cours.";
  await localNotif("🚌 Trajet en cours", msg);
}

/** Rappel de validité de ticket avant expiration */
export async function notifyTicketExpirationBientot(ref?: string): Promise<void> {
  const r = ref ? ` ${ref}` : "";
  await localNotif(
    "⏰ Ticket bientôt expiré",
    `Votre ticket${r} doit être utilisé aujourd'hui.`
  );
}

/* ══════════════════════════════════════════════════════════════════
   NOTIFICATIONS COMPAGNIE / ADMIN
══════════════════════════════════════════════════════════════════ */

/** Nouveau colis enregistré pour une compagnie */
export async function notifyNouveauColis(params: {
  trackingRef?: string;
  expediteur?:  string;
  remoteToken?: string;
}): Promise<void> {
  const ref  = params.trackingRef ? ` ${params.trackingRef}` : "";
  const from = params.expediteur  ? ` de ${params.expediteur}` : "";
  const msg  = `Nouveau colis${ref} enregistré${from}.`;
  await localNotif("📦 Nouveau colis", msg);
  if (params.remoteToken) {
    await remotePush(params.remoteToken, "GoBooking 📦", msg);
  }
}

/** Alerte capacité / remplissage de bus */
export async function notifyAlertCapacite(params: {
  route?:   string;
  percent?: number;
}): Promise<void> {
  const route = params.route   ? ` (${params.route})`           : "";
  const pct   = params.percent ? ` — ${params.percent}% occupé` : "";
  await localNotif(
    "⚠️ Alerte capacité",
    `Bus presque plein${route}${pct}. Gérez les disponibilités.`
  );
}

/* ── Exports nommés consolidés pour import rapide ─────────────── */
export {
  scheduleLocalNotification as notifyLocal,
  sendPushNotification      as notifyRemote,
  registerForPushNotifications,
};
