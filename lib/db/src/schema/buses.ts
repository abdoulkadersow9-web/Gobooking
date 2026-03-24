import { date, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { companiesTable } from "./companies";

export const busesTable = pgTable("buses", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companiesTable.id),
  plateNumber: varchar("plate_number", { length: 30 }).notNull().unique(),
  busName: varchar("bus_name", { length: 100 }).notNull(),
  busType: varchar("bus_type", { length: 50 }).notNull().default("Standard"),
  capacity: integer("capacity").notNull().default(44),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  logisticStatus: varchar("logistic_status", { length: 30 }).notNull().default("en_attente"),
  currentLocation: text("current_location"),
  currentTripId: text("current_trip_id"),
  condition: varchar("condition", { length: 20 }).notNull().default("bon"),
  issue: text("issue"),
  lastMaintenanceDate: date("last_maintenance_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBusSchema = createInsertSchema(busesTable).omit({ createdAt: true });
export type InsertBus = z.infer<typeof insertBusSchema>;
export type Bus = typeof busesTable.$inferSelect;
