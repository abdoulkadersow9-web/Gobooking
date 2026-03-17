/**
 * bus_positions — one row per trip, updated in-place (upsert).
 * Stores the LATEST real-time position of each running bus.
 * Use positionsTable for the full GPS trail.
 */
import { pgTable, real, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const busPositionsTable = pgTable("bus_positions", {
  id:        text("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:    text("trip_id").notNull().unique(),
  latitude:  real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  speed:     real("speed"),
  heading:   real("heading"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BusPosition    = typeof busPositionsTable.$inferSelect;
export type NewBusPosition = typeof busPositionsTable.$inferInsert;
