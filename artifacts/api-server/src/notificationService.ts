import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sendExpoPush } from "./pushService";

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

/* ─── Parcel notification config ─────────────────────────────────────────── */
const PARCEL_NOTIF: Record<string, { title: string; icon: string; color: string; buildMsg: (ref: string, extra?: string) => string }> = {
  créé: {
    title: "Colis enregistré",
    icon: "package",
    color: "#6366F1",
    buildMsg: (ref, from) => `Votre colis ${ref} a été enregistré en agence de ${from ?? "départ"}. Nous le préparons pour l'expédition.`,
  },
  en_gare: {
    title: "Colis reçu en gare",
    icon: "home",
    color: "#0284C7",
    buildMsg: (ref, from) => `Votre colis ${ref} est arrivé à la gare de ${from ?? "départ"}. Expédition prochainement.`,
  },
  chargé_bus: {
    title: "Colis chargé dans le bus",
    icon: "truck",
    color: "#7C3AED",
    buildMsg: (ref, to) => `Votre colis ${ref} a été chargé dans le bus en direction de ${to ?? "la destination"}.`,
  },
  en_transit: {
    title: "Colis en transit",
    icon: "navigation",
    color: "#D97706",
    buildMsg: (ref, to) => `Votre colis ${ref} est en cours d'acheminement vers ${to ?? "la destination"}.`,
  },
  arrivé: {
    title: "Colis arrivé à destination",
    icon: "map-pin",
    color: "#059669",
    buildMsg: (ref, to) => `Votre colis ${ref} est arrivé à l'agence de ${to ?? "destination"}. Prêt pour le retrait ou la livraison.`,
  },
  livré: {
    title: "Colis livré ✓",
    icon: "check-circle",
    color: "#16A34A",
    buildMsg: (ref, to) => `Votre colis ${ref} a été remis à ${to ?? "la destination"}. Merci de votre confiance !`,
  },
};

/* ─── sendNotification ────────────────────────────────────────────────────── */
export async function sendNotification(opts: {
  userId:     string;
  type:       string;
  title:      string;
  message:    string;
  data?:      Record<string, unknown>;
  pushToken?: string | null;
}) {
  const id = generateId();
  try {
    await db.execute(sql`
      INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at)
      VALUES (
        ${id},
        ${opts.userId},
        ${opts.type},
        ${opts.title},
        ${opts.message},
        ${opts.data ? JSON.stringify(opts.data) : null},
        false,
        NOW()
      )
    `);

    if (opts.pushToken) {
      sendExpoPush(opts.pushToken, opts.title, opts.message).catch(() => {});
    }
  } catch (err) {
    console.error("[Notification] Insert error:", err);
  }
}

/* ─── sendParcelNotification ─────────────────────────────────────────────── */
export async function sendParcelNotification(opts: {
  userId:       string;
  pushToken?:   string | null;
  status:       string;
  trackingRef:  string;
  fromCity?:    string;
  toCity?:      string;
  receiverName?: string;
}) {
  const cfg = PARCEL_NOTIF[opts.status];
  if (!cfg) return;

  const extraText =
    ["créé", "en_gare"].includes(opts.status)
      ? opts.fromCity
      : opts.status === "livré"
      ? (opts.receiverName ?? opts.toCity)
      : opts.toCity;

  const message = cfg.buildMsg(opts.trackingRef, extraText);

  await sendNotification({
    userId:    opts.userId,
    type:      "parcel",
    title:     cfg.title,
    message,
    data:      { trackingRef: opts.trackingRef, status: opts.status },
    pushToken: opts.pushToken,
  });
}
