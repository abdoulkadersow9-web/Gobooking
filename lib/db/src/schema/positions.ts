import { pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const positionsTable = pgTable("positions", {
  id:         text("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:     text("trip_id").notNull(),
  agentId:    text("agent_id").notNull(),
  lat:        real("lat").notNull(),
  lon:        real("lon").notNull(),
  speed:      real("speed"),
  accuracy:   real("accuracy"),
  heading:    real("heading"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export type Position    = typeof positionsTable.$inferSelect;
export type NewPosition = typeof positionsTable.$inferInsert;
