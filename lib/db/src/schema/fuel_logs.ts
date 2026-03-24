import { date, integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { companiesTable } from "./companies";
import { busesTable } from "./buses";

export const fuelLogsTable = pgTable("fuel_logs", {
  id:        text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companiesTable.id),
  busId:     text("bus_id").notNull().references(() => busesTable.id),
  amount:    numeric("amount", { precision: 10, scale: 2 }).notNull(),
  cost:      integer("cost").notNull(),
  date:      date("date").notNull().defaultNow(),
  notes:     text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FuelLog    = typeof fuelLogsTable.$inferSelect;
export type NewFuelLog = typeof fuelLogsTable.$inferInsert;
