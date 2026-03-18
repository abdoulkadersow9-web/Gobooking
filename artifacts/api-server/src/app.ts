import express, { type Express } from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import router from "./routes";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(join(__dirname, "../public")));

app.get("/", (_req, res) => {
  res.sendFile(join(__dirname, "../public/index.html"));
});

app.use("/api", router);

export default app;
