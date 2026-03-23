import { pgTable, real, text, timestamp, varchar, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const subscriptionsTable = pgTable("subscriptions", {
  id:            text("id").primaryKey(),
  companyId:     text("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  companyName:   varchar("company_name", { length: 255 }).notNull().default(""),
  plan:          varchar("plan", { length: 20 }).notNull().default("free"),
  status:        varchar("status", { length: 20 }).notNull().default("active"),
  startDate:     timestamp("start_date").notNull().defaultNow(),
  endDate:       timestamp("end_date"),
  amountPaid:    real("amount_paid").notNull().default(0),
  paymentMethod: varchar("payment_method", { length: 30 }).notNull().default("wave"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
