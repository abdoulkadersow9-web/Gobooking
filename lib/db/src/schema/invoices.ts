import { pgTable, real, text, timestamp, varchar, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const invoicesTable = pgTable("invoices", {
  id:               text("id").primaryKey(),
  companyId:        text("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  companyName:      varchar("company_name", { length: 255 }).notNull().default(""),
  period:           varchar("period", { length: 7 }).notNull(),
  totalGross:       real("total_gross").notNull().default(0),
  totalCommission:  real("total_commission").notNull().default(0),
  totalNet:         real("total_net").notNull().default(0),
  transactionCount: integer("transaction_count").notNull().default(0),
  status:           varchar("status", { length: 20 }).notNull().default("pending"),
  paidAt:           timestamp("paid_at"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});

export type Invoice = typeof invoicesTable.$inferSelect;
