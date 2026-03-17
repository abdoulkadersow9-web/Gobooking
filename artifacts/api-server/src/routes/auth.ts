import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

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

const ALLOWED_ROLES = ["client", "agent", "compagnie", "admin"] as const;
type RegisterRole = typeof ALLOWED_ROLES[number];

router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Nom, email et mot de passe sont requis" });
      return;
    }

    const mappedRole: RegisterRole = ALLOWED_ROLES.includes(role) ? role : "client";

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
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = users[0];
    if (user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
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

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

export { tokenStore };
export default router;
