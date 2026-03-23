/**
 * GoBooking — Audit & Security Logging
 * Centralise tous les logs d'actions critiques et la détection d'anomalies.
 */
import { db, auditLogsTable } from "@workspace/db";
import { eq, and, gte, count, desc } from "drizzle-orm";
import type { Request } from "express";

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

/* ─── Action constants ─────────────────────────────────── */
export const ACTIONS = {
  /* Réservations */
  BOOKING_CREATE:     "BOOKING_CREATE",
  BOOKING_CONFIRM:    "BOOKING_CONFIRM",
  BOOKING_CANCEL:     "BOOKING_CANCEL",
  BOOKING_BOARD:      "BOOKING_BOARD",
  /* QR */
  QR_SCAN:            "QR_SCAN",
  QR_SCAN_INVALID:    "QR_SCAN_INVALID",
  QR_DOUBLE_SCAN:     "QR_DOUBLE_SCAN",
  /* Colis */
  PARCEL_CREATE:      "PARCEL_CREATE",
  PARCEL_STATUS:      "PARCEL_STATUS",
  /* Paiement */
  PAYMENT_OK:         "PAYMENT_OK",
  PAYMENT_FAIL:       "PAYMENT_FAIL",
  /* En route */
  BOARDING_REQUEST:   "BOARDING_REQUEST",
  BOARDING_ACCEPT:    "BOARDING_ACCEPT",
  BOARDING_REJECT:    "BOARDING_REJECT",
  /* Trajet */
  TRIP_START:         "TRIP_START",
  TRIP_END:           "TRIP_END",
  /* Auth */
  LOGIN_OK:           "LOGIN_OK",
  LOGIN_FAIL:         "LOGIN_FAIL",
  /* Admin */
  INVOICE_GENERATE:   "INVOICE_GENERATE",
  INVOICE_PAY:        "INVOICE_PAY",
  SUB_ACTIVATE:       "SUB_ACTIVATE",
  /* Sécurité */
  ANOMALY_DETECTED:   "ANOMALY_DETECTED",
  PERMISSION_DENIED:  "PERMISSION_DENIED",
} as const;

export type AuditAction = typeof ACTIONS[keyof typeof ACTIONS];

export interface AuditCtx {
  userId:     string;
  userRole:   string;
  userName?:  string;
  req?:       Request;
}

/* ─── Core logger ──────────────────────────────────────── */
export async function auditLog(
  ctx:        AuditCtx,
  action:     AuditAction,
  targetId?:  string,
  targetType?: string,
  meta?:      Record<string, unknown>,
  flagged?:   boolean,
) {
  try {
    const ip =
      ctx.req?.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
      ?? ctx.req?.socket?.remoteAddress
      ?? "unknown";

    await db.insert(auditLogsTable).values({
      id:         genId(),
      userId:     ctx.userId,
      userRole:   ctx.userRole,
      userName:   ctx.userName ?? "",
      action,
      targetId:   targetId ?? null,
      targetType: targetType ?? null,
      metadata:   meta ? JSON.stringify(meta) : null,
      ipAddress:  ip,
      flagged:    flagged ?? false,
    });
  } catch (err) {
    /* Logging should never break the main flow */
    console.error("[Audit] logging error:", err);
  }
}

/* ─── Anomaly detection ─────────────────────────────────── */
const SCAN_THRESHOLD    = 50;
const SCAN_WINDOW_MS    = 60 * 60 * 1000;   /* 1 hour */
const BOOKING_THRESHOLD = 30;
const BOOKING_WINDOW_MS = 10 * 60 * 1000;   /* 10 min */

export async function detectAnomalies(ctx: AuditCtx, action: AuditAction) {
  try {
    const windowStart = new Date(Date.now() - SCAN_WINDOW_MS);
    const bookingWindow = new Date(Date.now() - BOOKING_WINDOW_MS);

    if (action === ACTIONS.QR_SCAN) {
      const rows = await db
        .select({ cnt: count() })
        .from(auditLogsTable)
        .where(
          and(
            eq(auditLogsTable.userId, ctx.userId),
            eq(auditLogsTable.action, ACTIONS.QR_SCAN),
            gte(auditLogsTable.createdAt, windowStart),
          )
        );
      const cnt = Number(rows[0]?.cnt ?? 0);
      if (cnt >= SCAN_THRESHOLD) {
        await auditLog(
          { ...ctx },
          ACTIONS.ANOMALY_DETECTED,
          ctx.userId,
          "user",
          { reason: "too_many_qr_scans", count: cnt, threshold: SCAN_THRESHOLD },
          true,
        );
        return { anomaly: true, reason: "Activité suspecte : trop de scans QR", count: cnt };
      }
    }

    if (action === ACTIONS.BOOKING_CREATE) {
      const rows = await db
        .select({ cnt: count() })
        .from(auditLogsTable)
        .where(
          and(
            eq(auditLogsTable.userId, ctx.userId),
            eq(auditLogsTable.action, ACTIONS.BOOKING_CREATE),
            gte(auditLogsTable.createdAt, bookingWindow),
          )
        );
      const cnt = Number(rows[0]?.cnt ?? 0);
      if (cnt >= BOOKING_THRESHOLD) {
        await auditLog(
          { ...ctx },
          ACTIONS.ANOMALY_DETECTED,
          ctx.userId,
          "user",
          { reason: "too_many_bookings", count: cnt, threshold: BOOKING_THRESHOLD },
          true,
        );
        return { anomaly: true, reason: "Activité suspecte : trop de réservations", count: cnt };
      }
    }

    return { anomaly: false };
  } catch {
    return { anomaly: false };
  }
}

/* ─── Admin: fetch logs ─────────────────────────────────── */
export async function getAuditLogs(opts: {
  action?:   string;
  userId?:   string;
  flagged?:  boolean;
  limit?:    number;
  offset?:   number;
}) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (opts.action)  conditions.push(eq(auditLogsTable.action,  opts.action));
  if (opts.userId)  conditions.push(eq(auditLogsTable.userId,  opts.userId));
  if (opts.flagged !== undefined) conditions.push(eq(auditLogsTable.flagged, opts.flagged));

  const query = db
    .select()
    .from(auditLogsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);

  return query;
}
