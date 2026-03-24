import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(rows.map((n) => ({
      id:        n.id,
      type:      n.type,
      title:     n.title,
      message:   n.message,
      read:      n.read,
      refId:     n.refId,
      refType:   n.refType,
      createdAt: n.createdAt?.toISOString() ?? new Date().toISOString(),
    })));
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

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId));

    const count = rows.filter((n) => !n.read).length;
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
});

/* ── PATCH /notifications/read-all — mark all read ─── */
router.patch("/read-all", async (req, res) => {
  try {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, userId));

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

    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
