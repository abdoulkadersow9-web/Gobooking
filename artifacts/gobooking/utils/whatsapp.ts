import { Linking, Platform } from "react-native";

function encodeWA(text: string): string {
  return encodeURIComponent(text);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return "225" + digits.slice(1);
  }
  if (!digits.startsWith("225") && digits.length === 8) {
    return "225" + digits;
  }
  return digits;
}

export function buildWALink(phone: string, message: string): string {
  const number = normalizePhone(phone);
  const text = encodeWA(message);
  return `https://wa.me/${number}?text=${text}`;
}

export function openWhatsApp(phone: string, message: string): void {
  const url = buildWALink(phone, message);
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://web.whatsapp.com/send?phone=${normalizePhone(phone)}&text=${encodeWA(message)}`);
  });
}

export const WA_TEMPLATES = {
  reservationConfirmee: (params: {
    clientName: string;
    bookingRef: string;
    from: string;
    to: string;
    date: string;
    heure: string;
    montant: number;
  }) =>
    `✅ *GoBooking – Réservation confirmée*\n\n` +
    `Bonjour ${params.clientName},\n\n` +
    `Votre réservation *#${params.bookingRef}* est confirmée !\n\n` +
    `🚌 *Trajet :* ${params.from} → ${params.to}\n` +
    `📅 *Date :* ${params.date}\n` +
    `⏰ *Heure :* ${params.heure}\n` +
    `💰 *Montant :* ${params.montant.toLocaleString("fr-CI")} FCFA\n\n` +
    `Présentez votre QR code à l'embarquement.\n` +
    `Bon voyage ! 🙏`,

  busEnApproche: (params: {
    clientName: string;
    busName: string;
    from: string;
    to: string;
    minutes?: number;
  }) =>
    `🚌 *GoBooking – Bus en approche*\n\n` +
    `Bonjour ${params.clientName},\n\n` +
    `Votre bus *${params.busName}* est en approche${params.minutes ? ` (dans ~${params.minutes} min)` : ""} !\n\n` +
    `📍 Trajet : ${params.from} → ${params.to}\n\n` +
    `Merci de vous rendre au point d'embarquement. 🏃‍♂️`,

  colisArrive: (params: {
    clientName: string;
    reference: string;
    destination: string;
  }) =>
    `📦 *GoBooking – Votre colis est arrivé*\n\n` +
    `Bonjour ${params.clientName},\n\n` +
    `Votre colis *${params.reference}* est arrivé à *${params.destination}* !\n\n` +
    `Vous pouvez venir le récupérer muni de votre bon de livraison.\n\n` +
    `GoBooking vous remercie de votre confiance. 🙏`,

  rappelDepart: (params: {
    clientName: string;
    from: string;
    to: string;
    date: string;
    heure: string;
    bookingRef: string;
  }) =>
    `⏰ *GoBooking – Rappel de départ*\n\n` +
    `Bonjour ${params.clientName},\n\n` +
    `Rappel : votre bus *${params.from} → ${params.to}* part le *${params.date} à ${params.heure}*.\n\n` +
    `Réf : *#${params.bookingRef}*\n\n` +
    `Soyez à l'heure ! 👍`,

  contactAgent: (params: {
    bookingRef: string;
  }) =>
    `Bonjour, je suis client GoBooking.\n` +
    `Ma réservation : *#${params.bookingRef}*\n` +
    `Je souhaite obtenir de l'aide.`,
};
