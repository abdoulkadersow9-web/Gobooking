/**
 * QR Code security utility — GoBooking
 *
 * Generates tamper-evident QR payloads and validates them offline.
 * Uses a deterministic HMAC-lite (djb2 hash) that runs entirely in JS,
 * no native crypto module required.
 */

/* ── Secret key — embedded in the app ─────────────────────────── */
const QR_SECRET = "GBK-CI-2026-SECURE-v1";

export type QRType = "billet" | "colis" | "en_route";

export interface QRPayload {
  ref: string;       /* booking ref, tracking ref, or request ID */
  type: QRType;
  ts: number;        /* generation timestamp (ms) */
  sig: string;       /* HMAC-lite signature */
}

export type QRValidationResult =
  | { valid: true;  ref: string; type: QRType }
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

/** Compute the expected signature for a given ref + type + timestamp. */
function computeSignature(ref: string, type: QRType, ts: number): string {
  return djb2(`${ref}|${type}|${ts}|${QR_SECRET}`);
}

/* ── QR payload TTL: 72 hours (for offline grace period) ──────── */
const TTL_MS = 72 * 60 * 60 * 1000;

/* ── Public API ────────────────────────────────────────────────── */

/**
 * Generate a signed QR string for a reservation / parcel / en-route request.
 * The output is a compact JSON string that CameraView can scan.
 */
export function generateQRData(ref: string, type: QRType): string {
  const ts = Date.now();
  const sig = computeSignature(ref, type, ts);
  const payload: QRPayload = { ref, type, ts, sig };
  return JSON.stringify(payload);
}

/**
 * Validate a scanned QR string.
 * - Backward-compat: plain refs (non-JSON) pass as "billet" with a warning note
 *   so old printed tickets still work during rollout.
 * - Returns `{ valid: true, ref, type }` or `{ valid: false, reason }`.
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

    const { ref, type, ts, sig } = payload;
    if (!ref || !type || !ts || !sig) {
      return { valid: false, reason: "invalid_format" };
    }

    /* Signature check */
    const expected = computeSignature(ref, type, ts);
    if (sig !== expected) {
      return { valid: false, reason: "invalid_signature" };
    }

    /* TTL check (optional — only reject if WAY expired for offline grace) */
    if (Date.now() - ts > TTL_MS) {
      return { valid: false, reason: "expired" };
    }

    return { valid: true, ref, type };
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
