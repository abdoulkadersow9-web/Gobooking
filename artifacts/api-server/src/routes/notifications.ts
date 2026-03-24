import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { tokenStore } from "./auth";

const router: IRouter = Router();

function getUserIdFromToken(auth: string | undefined): string | null {
  if (!auth) return null;
  const token = auth.replace("Bearer ", "");
  return tokenStore.get(token) ?? null;
}

/* ── GET /notifications — list user's notifications ─── */
router.get("/", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const rows = await db.execute(sql`
      SELECT id, user_id, type, title, message, data, read, created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json(rows.rows);
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /notifications/unread-count ─── */
router.get("/unread-count", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.json({ count: 0 }); return; }

    const rows = await db.execute(sql`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ${userId} AND read = false
    `);

    res.json({ count: Number((rows.rows[0] as any)?.count ?? 0) });
  } catch {
    res.json({ count: 0 });
  }
});

/* ── PATCH /notifications/read-all — mark all read ─── */
router.patch("/read-all", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    await db.execute(sql`
      UPDATE notifications SET read = true WHERE user_id = ${userId}
    `);

    res.json({ success: true });
  } catch (err) {
    console.error("Mark all read error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

/* ── PATCH /notifications/:id/read — mark single read ─── */
router.patch("/:id/read", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    await db.execute(sql`
      UPDATE notifications SET read = true
      WHERE id = ${req.params.id} AND user_id = ${userId}
    `);

    res.json({ success: true });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
