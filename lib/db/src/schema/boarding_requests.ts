/**
 * boarding_requests — persistent live boarding requests.
 * Replaces / supplements the in-memory requestStore for durability.
 * Status flow: pending → accepted | rejected
 */
import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const boardingRequestsTable = pgTable("boarding_requests", {
  id:            text("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:        text("trip_id").notNull(),
  userId:        text("user_id"),                         /* nullable — anonymous clients allowed */
  clientName:    varchar("client_name",  { length: 100 }).notNull(),
  clientPhone:   varchar("client_phone", { length: 30 }).notNull(),
  boardingPoint: text("boarding_point").notNull(),
  seatsRequested: text("seats_requested").notNull().default("1"),
  status:        varchar("status", { length: 20 }).notNull().default("pending"),
  respondedAt:   timestamp("responded_at"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

export type BoardingRequest    = typeof boardingRequestsTable.$inferSelect;
export type NewBoardingRequest = typeof boardingRequestsTable.$inferInsert;
