import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, pointsHistoryTable } from "@workspace/db";
import { tokenStore } from "./auth";

const router: IRouter = Router();

/* ─── Constants ──────────────────────────────────────────────── */
export const POINTS_PER_TRIP = 10;

export const REWARDS = [
  { id: "wallet_1000", points: 100, type: "wallet",  value: 1000,  label: "1 000 FCFA offerts",        desc: "Crédit portefeuille GoBooking" },
  { id: "wallet_2500", points: 200, type: "wallet",  value: 2500,  label: "2 500 FCFA offerts",        desc: "Crédit portefeuille GoBooking" },
  { id: "wallet_5000", points: 300, type: "wallet",  value: 5000,  label: "Trajet offert (~5 000 FCFA)",desc: "Crédit équivalent trajet standard" },
] as const;

export type RewardId = typeof REWARDS[number]["id"];

/* ─── Status thresholds ──────────────────────────────────────── */
export function getLoyaltyStatus(points: number): { status: string; next: string | null; needed: number } {
  if (points >= 300) return { status: "Gold",   next: null,     needed: 0 };
  if (points >= 100) return { status: "Silver", next: "Gold",   needed: 300 - points };
  return               { status: "Bronze", next: "Silver", needed: 100 - points };
}

/* ─── Helper: get authenticated user ──────────────────────────── */
async function requireUser(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = tokenStore.get(token);
  if (!userId) return null;
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return rows[0] ?? null;
}

/* ─── Helper: award points (used by agent boarding hook too) ─── */
export async function awardPoints(
  userId: string, points: number, reason: string, bookingId?: string
): Promise<{ newBalance: number }> {
  const rows = await db.select({ loyaltyPoints: usersTable.loyaltyPoints })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const current = rows[0]?.loyaltyPoints ?? 0;
  const newBalance = current + points;

  await db.update(usersTable).set({ loyaltyPoints: newBalance }).where(eq(usersTable.id, userId));
  await db.insert(pointsHistoryTable).values({
    id:        `pts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    type:      "earn",
    points,
    balance:   newBalance,
    reason,
    bookingId: bookingId ?? null,
  });

  return { newBalance };
}

/* ─────────────────────────────────────────────────────────────── */

/* GET /loyalty/profile */
router.get("/profile", async (req, res) => {
  try {
    const user = await requireUser(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const history = await db.select().from(pointsHistoryTable)
      .where(eq(pointsHistoryTable.userId, user.id))
      .orderBy(desc(pointsHistoryTable.createdAt))
      .limit(50);

    const { status, next, needed } = getLoyaltyStatus(user.loyaltyPoints);

    res.json({
      points:   user.loyaltyPoints,
      status,
      nextStatus: next,
      pointsNeeded: needed,
      rewards:  REWARDS,
      history,
    });
  } catch (err) {
    console.error("loyalty/profile error:", err);
    res.status(500).json({ error: "Erreur profil fidélité" });
  }
});

/* POST /loyalty/redeem — échanger des points contre une récompense */
router.post("/redeem", async (req, res) => {
  try {
    const user = await requireUser(req.headers.authorization);
    if (!user) { res.status(403).json({ error: "Unauthorized" }); return; }

    const { rewardId } = req.body as { rewardId: string };
    const reward = REWARDS.find(r => r.id === rewardId);
    if (!reward) { res.status(400).json({ error: "Récompense invalide" }); return; }

    if (user.loyaltyPoints < reward.points) {
      res.status(400).json({
        error: `Points insuffisants — il vous faut ${reward.points} pts (vous en avez ${user.loyaltyPoints})`,
      });
      return;
    }

    const newPoints = user.loyaltyPoints - reward.points;
    const newWallet = user.walletBalance + reward.value;

    await db.update(usersTable).set({
      loyaltyPoints: newPoints,
      walletBalance: newWallet,
    }).where(eq(usersTable.id, user.id));

    await db.insert(pointsHistoryTable).values({
      id:       `pts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId:   user.id,
      type:     "redeem",
      points:   -reward.points,
      balance:  newPoints,
      reason:   `Échange récompense : ${reward.label}`,
      rewardId: reward.id,
    });

    res.json({
      success:       true,
      pointsSpent:   reward.points,
      newPoints,
      walletCredited: reward.value,
      newWallet,
      reward:        { label: reward.label, value: reward.value },
    });
  } catch (err) {
    console.error("loyalty/redeem error:", err);
    res.status(500).json({ error: "Erreur échange points" });
  }
});

export default router;
