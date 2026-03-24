import app from "./app.js";
import { startScheduler } from "./scheduler";

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`GoBooking API démarré sur le port ${PORT}`);
  startScheduler(30_000);
});
