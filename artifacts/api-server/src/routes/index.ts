import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tripsRouter from "./trips";
import bookingsRouter from "./bookings";
import adminRouter from "./admin";
import parcelsRouter from "./parcels";
import superadminRouter from "./superadmin";
import companyRouter from "./company";
import agentRouter from "./agent";
import firebaseBookingRouter from "./firebase-booking";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/trips", tripsRouter);
router.use("/bookings", bookingsRouter);
router.use("/admin", adminRouter);
router.use("/parcels", parcelsRouter);
router.use("/superadmin", superadminRouter);
router.use("/company", companyRouter);
router.use("/agent", agentRouter);
router.use("/firebase", firebaseBookingRouter);

export default router;
