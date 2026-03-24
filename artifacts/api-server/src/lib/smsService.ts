/**
 * SMS Service — GoBooking
 * En production, remplacer sendSMS() par l'appel API de votre opérateur
 * (Orange CI, Infobip, Twilio, etc.). En développement, les SMS sont loggués.
 */

export interface SmsResult {
  phone: string;
  success: boolean;
  error?: string;
}

/**
 * Envoie un SMS à un numéro de téléphone.
 * Remplacez le corps par l'appel réel à votre gateway SMS.
 */
export async function sendSMS(phone: string, message: string): Promise<SmsResult> {
  try {
    // === INTEGRATION REAL GATEWAY ===
    // Exemple Infobip :
    // const res = await fetch("https://api.infobip.com/sms/2/text/advanced", { ... })
    // Exemple Orange CI (API officielle) :
    // const res = await fetch("https://api.orange.com/smsmessaging/v1/outbound/...", { ... })
    //
    // Pour la démo, on simule un envoi réussi avec un log console
    console.log(`[SMS] → ${phone} : ${message}`);

    // Simulation latence réseau
    await new Promise(r => setTimeout(r, 30));

    return { phone, success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[SMS] ✗ ${phone} : ${msg}`);
    return { phone, success: false, error: msg };
  }
}

/**
 * Envoie un SMS à une liste de numéros en parallèle (max 10 simultanés).
 */
export async function sendBulkSMS(
  phones: string[],
  message: string
): Promise<{ sent: number; failed: number; results: SmsResult[] }> {
  const BATCH = 10;
  const results: SmsResult[] = [];

  for (let i = 0; i < phones.length; i += BATCH) {
    const batch = phones.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(p => sendSMS(p, message)));
    results.push(...batchResults);
  }

  const sent   = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  return { sent, failed, results };
}
