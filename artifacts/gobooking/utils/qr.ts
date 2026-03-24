/**
 * QR Code security utility — GoBooking
 *
 * Generates tamper-evident QR payloads and validates them offline.
 * Uses a deterministic HMAC-lite (djb2 hash) that runs entirely in JS,
 * no native crypto module required.
 */

/* ── Secret key — embedded in the app ─────────────────────────── */
const QR_SECRET = "GBK-CI-2026-SECURE-v1";

/**
 * QR type:
 *   - "passager" — billet voyageur (embarquement)
 *   - "billet"   — alias rétro-compatible de "passager"
 *   - "colis"    — colis / parcel
 *   - "bagage"   — bagage lié à une réservation
 *   - "en_route" — demande de voyage en cours de route
 */
export type QRType = "billet" | "passager" | "colis" | "bagage" | "en_route";

export interface QRPayload {
  ref:      string;      /* booking ref, tracking ref, or request ID */
  type:     QRType;
  ts:       number;      /* generation timestamp (ms) */
  sig:      string;      /* HMAC-lite signature */
  trajetId?: string;     /* optional trip ID for trip-mismatch guard */
}

export type QRValidationResult =
  | { valid: true;  ref: string; type: QRType; trajetId?: string }
  | { valid: false; reason: "invalid_format" | "invalid_signature" | "expired" };

/* ── Hash (djb2 variant — pure JS, no crypto library needed) ─── */
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
    h = h >>> 0; /* keep unsigned 32-bit */
  }
  return h.toString(36).padStart(7, "0");
}

/** Compute the expected signature for a given ref + type + timestamp (+optional trajetId). */
function computeSignature(ref: string, type: QRType, ts: number, trajetId?: string): string {
  const base = trajetId ? `${ref}|${type}|${ts}|${trajetId}|${QR_SECRET}` : `${ref}|${type}|${ts}|${QR_SECRET}`;
  return djb2(base);
}

/* ── QR payload TTL: 72 hours (for offline grace period) ──────── */
const TTL_MS = 72 * 60 * 60 * 1000;

/* ── Public API ────────────────────────────────────────────────── */

/**
 * Generate a signed QR string for a reservation / parcel / bagage / en-route request.
 * The output is a compact JSON string that CameraView can scan.
 *
 * @param ref      Booking reference, tracking ref, or request ID
 * @param type     QR type ("passager" | "colis" | "bagage" | "en_route")
 * @param trajetId Optional trip ID to enforce trip-mismatch guard at scan time
 */
export function generateQRData(ref: string, type: QRType, trajetId?: string): string {
  const ts  = Date.now();
  const sig = computeSignature(ref, type, ts, trajetId);
  const payload: QRPayload = trajetId
    ? { ref, type, ts, sig, trajetId }
    : { ref, type, ts, sig };
  return JSON.stringify(payload);
}

/**
 * Validate a scanned QR string.
 * - Backward-compat: plain refs (non-JSON) pass as "billet" with a warning note
 *   so old printed tickets still work during rollout.
 * - Returns `{ valid: true, ref, type, trajetId? }` or `{ valid: false, reason }`.
 */
export function validateQR(raw: string): QRValidationResult {
  const str = raw.trim();

  /* ── Try signed JSON format ── */
  if (str.startsWith("{")) {
    let payload: QRPayload;
    try {
      payload = JSON.parse(str) as QRPayload;
    } catch {
      return { valid: false, reason: "invalid_format" };
    }

    const { ref, type, ts, sig, trajetId } = payload;
    if (!ref || !type || !ts || !sig) {
      return { valid: false, reason: "invalid_format" };
    }

    /* Signature check — try with trajetId first (new format), fallback to old format */
    const expectedNew = computeSignature(ref, type, ts, trajetId);
    const expectedOld = computeSignature(ref, type, ts, undefined);
    if (sig !== expectedNew && sig !== expectedOld) {
      return { valid: false, reason: "invalid_signature" };
    }

    /* TTL check (optional — only reject if WAY expired for offline grace) */
    if (Date.now() - ts > TTL_MS) {
      return { valid: false, reason: "expired" };
    }

    return { valid: true, ref, type, trajetId };
  }

  /* ── Backward-compat: plain booking ref (old printed tickets) ── */
  /* Accept refs that look like GoBooking references (GBB-*, GBX-*) or short alphanumeric */
  if (/^(GBB|GBX|GBK|OFFLINE-)/i.test(str) || /^[A-Z0-9]{6,20}$/i.test(str)) {
    return { valid: true, ref: str, type: "billet" };
  }

  return { valid: false, reason: "invalid_format" };
}

/**
 * Human-readable description of a validation failure reason.
 */
export function qrErrorMessage(reason: "invalid_format" | "invalid_signature" | "expired"): string {
  switch (reason) {
    case "invalid_signature": return "QR invalide — ce billet semble avoir été modifié.";
    case "expired":           return "QR expiré — billet trop ancien (> 72h).";
    case "invalid_format":    return "QR non reconnu — format invalide.";
  }
}

/**
 * Human-readable label for a QR type.
 */
export function qrTypeLabel(type: QRType): string {
  switch (type) {
    case "passager":  return "Passager";
    case "billet":    return "Passager";
    case "colis":     return "Colis";
    case "bagage":    return "Bagage";
    case "en_route":  return "En Route";
  }
}
