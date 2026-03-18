import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// ✅ ROUTE SIMPLE TEST (IMPORTANT)
app.get("/api/trajets", (req, res) => {
  res.json([
    {
      id: "1",
      ville_depart: "Abidjan",
      ville_arrivee: "Bouaké",
      prix: 5000,
    },
  ]);
});

export default app;