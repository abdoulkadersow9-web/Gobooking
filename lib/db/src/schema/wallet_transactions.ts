import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id:               text("id").primaryKey(),
  companyId:        text("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  bookingId:        text("booking_id"),
  bookingRef:       varchar("booking_ref", { length: 30 }),
  type:             varchar("type", { length: 20 }).notNull().default("credit"),
  grossAmount:      real("gross_amount").notNull().default(0),
  commissionAmount: real("commission_amount").notNull().default(0),
  netAmount:        real("net_amount").notNull().default(0),
  description:      text("description"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});

export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
