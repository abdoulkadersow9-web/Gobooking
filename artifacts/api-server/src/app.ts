import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import router from "./routes";
import db from "./firebase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app: Express = express();

/* ── Trust proxy (Replit reverse proxy) ─────────────────────── */
app.set("trust proxy", 1);

/* ── Security headers (helmet) ──────────────────────────────── */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

/* ── CORS ───────────────────────────────────────────────────── */
app.use(cors());

/* ── Global rate limiter (500 req / 15 min per IP) ──────────── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Veuillez réessayer dans quelques minutes." },
  skip: (req) => req.path === "/api/ping",
}));

/* ── Body parsers ───────────────────────────────────────────── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Request logger ─────────────────────────────────────────── */
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
    console.log(`[${level}] ${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

/* ── Quick health / ping ────────────────────────────────────── */
app.get("/api/ping", (_req: Request, res: Response) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get("/api/test", (_req: Request, res: Response) => {
  res.json({ status: "ok", server: "GoBooking API", ts: new Date().toISOString() });
});

/* ── Static files ───────────────────────────────────────────── */
app.use(express.static(join(__dirname, "../public")));

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(join(__dirname, "../public/index.html"));
});

/* ── Legacy Firestore route ─────────────────────────────────── */
app.get("/api/trajets", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db!.collection("trajets").get();
    const trajets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(trajets);
  } catch (error) {
    console.error("[trajets] Firestore error:", error);
    res.status(500).json({ error: "Impossible de récupérer les trajets" });
  }
});

/* ── Main router ────────────────────────────────────────────── */
app.use("/api", router);

/* ── 404 handler ────────────────────────────────────────────── */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route non trouvée" });
});

/* ── Global error handler ───────────────────────────────────── */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[SERVER ERROR]", err.stack ?? err.message);
  res.status(500).json({ error: err.message || "Erreur interne du serveur" });
});

export default app;
