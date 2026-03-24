import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const marketingLogsTable = pgTable("marketing_logs", {
  id:        text("id").primaryKey(),
  campaign:  varchar("campaign", { length: 50 }).notNull(), // reengagement | post_trip | low_occupancy | birthday | parcel_arrived
  channel:   varchar("channel", { length: 20 }).notNull(),  // sms | push | both
  userId:    text("user_id"),
  phone:     varchar("phone", { length: 50 }),
  message:   text("message").notNull(),
  status:    varchar("status", { length: 20 }).notNull().default("sent"), // sent | failed | skipped
  refId:     text("ref_id"),
  refType:   varchar("ref_type", { length: 30 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MarketingLog    = typeof marketingLogsTable.$inferSelect;
export type NewMarketingLog = typeof marketingLogsTable.$inferInsert;
