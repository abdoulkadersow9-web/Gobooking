import { Router, type IRouter } from "express";
import { db, pool, usersTable, agentsTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { auditLog, ACTIONS } from "../audit";
import { recordReferral } from "./growth";

const router: IRouter = Router();

/* ── Rate limiter: max 100 login attempts / 15 min per IP ──────── */
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
  keyGenerator: (req) =>
    (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ?? req.socket?.remoteAddress ?? "unknown"),
});

/* ── Rate limiter: max 5 register attempts / 15 min per IP ───── */
const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de créations de compte. Réessayez dans 15 minutes." },
});

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);
const generateToken = () => crypto.randomBytes(32).toString("hex");

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "gobooking_salt_2024").digest("hex");
}

function generateToken_simple(): string {
  return generateId() + generateId();
}

/* ── PersistentTokenStore ─────────────────────────────────────────
   Token store backed by PostgreSQL so sessions survive server
   restarts and hot-reloads. Uses an in-memory Map as a fast read
   cache; PostgreSQL is the source of truth.
   ───────────────────────────────────────────────────────────────── */
class PersistentTokenStore {
  private cache = new Map<string, string>();
  private ready = false;

  /** Load existing sessions from DB into the in-memory cache. */
  async init(): Promise<void> {
    try {
      const res = await pool.query<{ token: string; user_id: string }>(
        "SELECT token, user_id FROM sessions"
      );
      for (const row of res.rows) {
        this.cache.set(row.token, row.user_id);
      }
      this.ready = true;
      console.log(`[auth] Loaded ${res.rows.length} session(s) from DB`);
    } catch (err) {
      console.error("[auth] Failed to load sessions from DB:", err);
      this.ready = true;
    }
  }

  get(token: string): string | undefined {
    return this.cache.get(token);
  }

  has(token: string): boolean {
    return this.cache.has(token);
  }

  set(token: string, userId: string): void {
    this.cache.set(token, userId);
    pool.query(
      "INSERT INTO sessions (token, user_id) VALUES ($1, $2) ON CONFLICT (token) DO UPDATE SET user_id = $2, created_at = NOW()",
      [token, userId]
    ).catch((err) => console.error("[auth] Failed to persist session:", err));
  }

  delete(token: string): void {
    this.cache.delete(token);
    pool.query("DELETE FROM sessions WHERE token = $1", [token])
      .catch((err) => console.error("[auth] Failed to delete session:", err));
  }
}

const tokenStore = new PersistentTokenStore();

/* Initialize immediately — loads DB sessions into memory cache */
tokenStore.init().catch(console.error);

const RESTRICTED_ROLES = ["agent", "compagnie", "company_admin", "admin", "super_admin"];

router.post("/register", registerRateLimit, async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Nom, email et mot de passe sont requis" });
      return;
    }

    // Bloquer toute tentative de créer un compte agent/compagnie/admin via l'API publique
    if (role && RESTRICTED_ROLES.includes(role)) {
      res.status(403).json({ error: "La création de comptes agent, compagnie ou admin est réservée aux administrateurs" });
      return;
    }

    // L'inscription publique crée uniquement des comptes Client
    const mappedRole = "client" as const;

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Cet email est déjà utilisé" });
      return;
    }

    const newId = generateId();
    const generatedReferralCode = newId.slice(0, 6).toUpperCase();

    const [user] = await db.insert(usersTable).values({
      id: newId,
      name,
      email,
      phone: phone || "",
      passwordHash: hashPassword(password),
      role: mappedRole,
      referralCode: generatedReferralCode,
    }).returning();

    // Process referral if provided
    const { referralCode: inputCode } = req.body;
    if (inputCode) {
      recordReferral(String(inputCode).toUpperCase().trim(), user.id).catch(() => {});
    }

    const token = generateToken_simple();
    tokenStore.set(token, user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        referralCode: user.referralCode,
        walletBalance: user.walletBalance ?? 0,
        totalTrips: user.totalTrips ?? 0,
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Inscription échouée" });
  }
});

router.post("/login", loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!users.length) {
      auditLog({ userId: "anonymous", userRole: "unknown", req }, ACTIONS.LOGIN_FAIL, undefined, undefined, { email, reason: "user_not_found" }, false).catch(() => {});
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = users[0];
    if (user.passwordHash !== hashPassword(password)) {
      auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.LOGIN_FAIL, user.id, "user", { reason: "wrong_password" }, false).catch(() => {});
      res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return;
    }

    // Bloquer la connexion des comptes désactivés
    if (user.status === "inactive") {
      res.status(403).json({ error: "Votre compte a été désactivé. Contactez l'administrateur pour le réactiver." });
      return;
    }

    const token = generateToken_simple();
    tokenStore.set(token, user.id);

    let agentRole: string | null = null;
    let extraRoles: string[] = [];
    let busId: string | null = null;
    let tripId: string | null = null;
    let companyId: string | null = null;
    if (user.role === "agent") {
      const agentRecord = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
      if (agentRecord.length > 0) {
        agentRole  = agentRecord[0].agentRole  ?? null;
        busId      = agentRecord[0].busId      ?? null;
        tripId     = agentRecord[0].tripId     ?? null;
        companyId  = agentRecord[0].companyId  ?? null;
        const raw  = (agentRecord[0] as any).extra_roles ?? agentRecord[0].extraRoles ?? null;
        extraRoles = raw ? raw.split(",").map((r: string) => r.trim()).filter(Boolean) : [];
      }
    }

    auditLog({ userId: user.id, userRole: user.role, userName: user.name, req }, ACTIONS.LOGIN_OK, user.id, "user", { email: user.email }).catch(() => {});

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        agentRole,
        extraRoles,
        busId,
        tripId,
        companyId,
        status: user.status,
        photoUrl: (user as any).photo_url ?? null,
        referralCode: user.referralCode ?? user.id.slice(0, 6).toUpperCase(),
        walletBalance: user.walletBalance ?? 0,
        totalTrips: user.totalTrips ?? 0,
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = auth.replace("Bearer ", "");
    const userId = tokenStore.get(token);
    if (!userId) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0];

    // Si le compte a été désactivé depuis la dernière connexion → invalider le token
    if (user.status === "inactive") {
      tokenStore.delete(token);
      res.status(403).json({ error: "Compte désactivé" });
      return;
    }

    let agentRole: string | null = null;
    let extraRoles: string[] = [];
    let busId: string | null = null;
    let tripId: string | null = null;
    let companyId: string | null = null;
    if (user.role === "agent") {
      const agentRecord = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
      if (agentRecord.length > 0) {
        agentRole  = agentRecord[0].agentRole  ?? null;
        busId      = agentRecord[0].busId      ?? null;
        tripId     = agentRecord[0].tripId     ?? null;
        companyId  = agentRecord[0].companyId  ?? null;
        const raw  = (agentRecord[0] as any).extra_roles ?? agentRecord[0].extraRoles ?? null;
        extraRoles = raw ? raw.split(",").map((r: string) => r.trim()).filter(Boolean) : [];
      }
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      agentRole,
      extraRoles,
      busId,
      tripId,
      companyId,
      status: user.status,
      photoUrl: (user as any).photo_url ?? null,
      referralCode: user.referralCode ?? user.id.slice(0, 6).toUpperCase(),
      walletBalance: user.walletBalance ?? 0,
      totalTrips: user.totalTrips ?? 0,
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

/* ── POST /logout ─────────────────────────────────────────────────
   Invalidates the session token server-side.
   Client should also clear AsyncStorage and local state.
   ──────────────────────────────────────────────────────────────── */
router.post("/logout", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.replace("Bearer ", "");
      tokenStore.delete(token);
    }
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

router.post("/push-token", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
    const token = auth.replace("Bearer ", "");
    const userId = tokenStore.get(token);
    if (!userId) { res.status(401).json({ error: "Invalid token" }); return; }

    const { pushToken } = req.body;
    if (!pushToken) { res.status(400).json({ error: "pushToken requis" }); return; }

    await db.update(usersTable).set({ pushToken }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ── GET /demo-roles ─────────────────────────────────────────────
   Retourne dynamiquement depuis la DB tous les comptes démo
   disponibles avec leurs rôles, pour l'accès rapide de la page login.
   ──────────────────────────────────────────────────────────────── */
router.get("/demo-roles", async (_req, res) => {
  try {
    /* Comptes démo connus avec leurs mots de passe */
    const DEMO_CREDS: Record<string, string> = {
      "admin@test.com":                 "test123",
      "admin@gobooking.com":            "admin123",
      "compagnie@test.com":             "test123",
      "chef.test@gobooking.ci":         "chef1234",
      "agent@test.com":                 "test123",       /* guichet */
      "reservation@test.com":           "test123",       /* réservation en ligne */
      "embarquement@test.com":          "test123",
      "colis@test.com":                 "test123",
      "bagage@test.com":                "test123",       /* agent bagage */
      "validepart@test.com":            "test123",
      "logistique@test.com":            "test123",
      "suivi@test.com":                 "test123",
      "route@test.com":                 "test123",
      "user@test.com":                  "test123",
    };

    const demoEmailsList = Object.keys(DEMO_CREDS);

    /* Requête DB via Drizzle querybuilder
       — on trie pour préférer les @test.com/@gobooking.ci aux autres */
    const rows = await db
      .select({
        email:     usersTable.email,
        userRole:  usersTable.role,
        agentRole: agentsTable.agentRole,
      })
      .from(usersTable)
      .leftJoin(agentsTable, eq(agentsTable.userId, usersTable.id))
      .where(inArray(usersTable.email, demoEmailsList))
      .orderBy(
        usersTable.role,
        sql`${agentsTable.agentRole} NULLS LAST`,
        /* @test.com et @gobooking.ci en premier pour la déduplication */
        sql`CASE WHEN ${usersTable.email} LIKE '%@test.com' OR ${usersTable.email} LIKE '%@gobooking.ci' THEN 0 ELSE 1 END`,
        usersTable.email,
      );

    /* Déduplique par rôle (agent_role ?? user_role) — un seul compte par rôle */
    const seen = new Set<string>();
    const result: Array<{
      email: string; password: string;
      userRole: string; agentRole: string | null;
    }> = [];

    for (const row of rows) {
      const key = row.agentRole ?? row.userRole;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        email:     row.email,
        password:  DEMO_CREDS[row.email] ?? "test123",
        userRole:  row.userRole,
        agentRole: row.agentRole ?? null,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("[demo-roles]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export { tokenStore };
export default router;
