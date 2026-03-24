/**
 * GoBooking — Centralized Auth Middleware
 * Provides reusable guards for all API routes.
 */
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { tokenStore } from "../routes/auth";
import { auditLog, ACTIONS } from "../audit";

export type AuthUser = typeof usersTable.$inferSelect;

/* ─── Extract raw userId from Bearer token ────────────────────────────────── */
export function getUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  return tokenStore.get(token) || null;
}

/* ─── Full user lookup from Bearer token ─────────────────────────────────── */
export async function getAuthUser(authHeader: string | undefined): Promise<AuthUser | null> {
  const userId = getUserIdFromToken(authHeader);
  if (!userId) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length) return null;
  if (users[0].status === "inactive") return null;
  return users[0];
}

/* ─── Express middleware: require any authenticated user ──────────────────── */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getUserIdFromToken(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  next();
}

/* ─── Express middleware: require specific role(s) ────────────────────────── */
export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await getAuthUser(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    if (!roles.includes(user.role)) {
      auditLog(
        { userId: user.id, userRole: user.role, userName: user.name ?? "", req },
        ACTIONS.PERMISSION_DENIED,
        undefined,
        undefined,
        { requiredRoles: roles, actualRole: user.role, path: req.path, method: req.method },
        true,
      ).catch(() => {});
      res.status(403).json({
        error: "Accès refusé",
        detail: `Cette action requiert le rôle : ${roles.join(" ou ")}`,
      });
      return;
    }
    next();
  };
}

/* ─── Express middleware: require user owns resource OR is admin ───────────── */
export function requireSelf(getUserId: (req: Request) => string | undefined) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await getAuthUser(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    const targetId = getUserId(req);
    const isAdmin = ["admin", "super_admin"].includes(user.role);
    if (!isAdmin && targetId !== user.id) {
      auditLog(
        { userId: user.id, userRole: user.role, userName: user.name ?? "", req },
        ACTIONS.PERMISSION_DENIED,
        targetId,
        "user",
        { reason: "self_only", path: req.path },
        true,
      ).catch(() => {});
      res.status(403).json({ error: "Accès refusé — vous ne pouvez accéder qu'à vos propres données" });
      return;
    }
    next();
  };
}
