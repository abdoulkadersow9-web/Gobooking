import { integer, json, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tripsTable = pgTable("trips", {
  id: text("id").primaryKey(),
  from: varchar("from_city", { length: 100 }).notNull(),
  to: varchar("to_city", { length: 100 }).notNull(),
  departureTime: varchar("departure_time", { length: 10 }).notNull(),
  arrivalTime: varchar("arrival_time", { length: 10 }).notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  price: real("price").notNull(),
  busType: varchar("bus_type", { length: 100 }).notNull(),
  busName: varchar("bus_name", { length: 100 }).notNull(),
  totalSeats: integer("total_seats").notNull(),
  duration: varchar("duration", { length: 20 }).notNull(),
  amenities: json("amenities").$type<string[]>().notNull().default([]),
  stops: json("stops").$type<{ name: string; time: string }[]>().notNull().default([]),
  policies: json("policies").$type<string[]>().notNull().default([]),
  status: varchar("status", { length: 30 }).notNull().default("scheduled"),
  startedAt: timestamp("started_at"),
  arrivedAt: timestamp("arrived_at"),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({});
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;
