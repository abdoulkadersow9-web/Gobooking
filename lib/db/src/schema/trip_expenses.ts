import { date, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { companiesTable } from "./companies";
import { tripsTable } from "./trips";

export const tripExpensesTable = pgTable("trip_expenses", {
  id:          text("id").primaryKey(),
  companyId:   text("company_id").notNull().references(() => companiesTable.id),
  tripId:      text("trip_id").notNull().references(() => tripsTable.id),
  type:        varchar("type", { length: 30 }).notNull().default("autre"),
  amount:      integer("amount").notNull(),
  description: text("description"),
  date:        date("date").notNull().defaultNow(),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type TripExpense    = typeof tripExpensesTable.$inferSelect;
export type NewTripExpense = typeof tripExpensesTable.$inferInsert;
