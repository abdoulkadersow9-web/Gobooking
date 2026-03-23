import { Router, type IRouter } from "express";
import { db, usersTable, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { auditLog, ACTIONS } from "../audit";

const router: IRouter = Router();

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);
const generateToken = () => crypto.randomBytes(32).toString("hex");

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "gobooking_salt_2024").digest("hex");
}

function generateToken_simple(): string {
  return generateId() + generateId();
}

const tokenStore = new Map<string, string>();

const RESTRICTED_ROLES = ["agent", "compagnie", "company_admin", "admin", "super_admin"];

router.post("/register", async (req, res) => {
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

    const [user] = await db.insert(usersTable).values({
      id: generateId(),
      name,
      email,
      phone: phone || "",
      passwordHash: hashPassword(password),
      role: mappedRole,
    }).returning();

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
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Inscription échouée" });
  }
});

router.post("/login", async (req, res) => {
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
    if (user.role === "agent") {
      const agentRecord = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
      if (agentRecord.length > 0) agentRole = agentRecord[0].agentRole ?? null;
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
        status: user.status,
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
    if (user.role === "agent") {
      const agentRecord = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id)).limit(1);
      if (agentRecord.length > 0) agentRole = agentRecord[0].agentRole ?? null;
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      agentRole,
      status: user.status,
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
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

export { tokenStore };
export default router;
