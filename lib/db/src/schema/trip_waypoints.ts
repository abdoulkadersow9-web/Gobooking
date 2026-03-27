import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { tripsTable } from "./trips";

export const tripWaypointsTable = pgTable("trip_waypoints", {
  id:            text("id").primaryKey(),
  tripId:        text("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  city:          varchar("city", { length: 100 }).notNull(),
  stopOrder:     integer("stop_order").notNull().default(0),
  scheduledTime: varchar("scheduled_time", { length: 10 }),
  arrivedAt:     timestamp("arrived_at"),
});

export type TripWaypoint = typeof tripWaypointsTable.$inferSelect;
