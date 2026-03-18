import express, { type Express } from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import router from "./routes";
import db from "./firebase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(join(__dirname, "../public")));

app.get("/", (_req, res) => {
  res.sendFile(join(__dirname, "../public/index.html"));
});

app.get("/api/trajets", async (_req, res) => {
  try {
    const snapshot = await db!.collection("trajets").get();
    const trajets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(trajets);
  } catch (error) {
    console.error("Erreur récupération trajets:", error);
    res.status(500).json({ error: "Impossible de récupérer les trajets" });
  }
});

app.use("/api", router);

export default app;
