import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

export const parcelsTable = pgTable("parcels", {
  id: text("id").primaryKey(),
  trackingRef: varchar("tracking_ref", { length: 20 }).notNull().unique(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  senderName: varchar("sender_name", { length: 255 }).notNull(),
  senderPhone: varchar("sender_phone", { length: 50 }).notNull(),
  receiverName: varchar("receiver_name", { length: 255 }).notNull(),
  receiverPhone: varchar("receiver_phone", { length: 50 }).notNull(),
  fromCity: varchar("from_city", { length: 100 }).notNull(),
  toCity: varchar("to_city", { length: 100 }).notNull(),
  parcelType: varchar("parcel_type", { length: 50 }).notNull(),
  weight: real("weight").notNull(),
  description: text("description"),
  deliveryType: varchar("delivery_type", { length: 50 }).notNull(),
  amount: real("amount").notNull(),
  commissionAmount: real("commission_amount").notNull().default(0),
  paymentMethod: varchar("payment_method", { length: 30 }).notNull().default("orange"),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("paid"),
  status: varchar("status", { length: 30 }).notNull().default("en_attente"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertParcelSchema = createInsertSchema(parcelsTable).omit({ createdAt: true });
export type InsertParcel = z.infer<typeof insertParcelSchema>;
export type Parcel = typeof parcelsTable.$inferSelect;
