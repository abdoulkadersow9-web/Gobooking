import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  refId: text("ref_id").notNull(),
  refType: varchar("ref_type", { length: 20 }).notNull(),
  amount: real("amount").notNull(),
  method: varchar("method", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("paid"),
  transactionId: varchar("transaction_id", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
