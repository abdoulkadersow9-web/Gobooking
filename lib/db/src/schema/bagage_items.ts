import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { bookingsTable } from "./bookings";

export const bagageItemsTable = pgTable("bagage_items", {
  id:             text("id").primaryKey(),
  trackingRef:    varchar("tracking_ref", { length: 20 }).notNull().unique(),
  bookingId:      text("booking_id").notNull().references(() => bookingsTable.id),
  tripId:         text("trip_id").notNull(),
  agentId:        text("agent_id").notNull(),
  companyId:      text("company_id"),
  passengerName:  varchar("passenger_name",  { length: 255 }).notNull(),
  passengerPhone: varchar("passenger_phone", { length: 50 }),
  bookingRef:     varchar("booking_ref",     { length: 20 }),
  bagageType:     varchar("bagage_type",     { length: 50 }).notNull().default("valise"),
  description:    text("description"),
  weightKg:       real("weight_kg"),
  price:          real("price").notNull().default(0),
  paymentMethod:  varchar("payment_method",  { length: 30 }).notNull().default("espèces"),
  paymentStatus:  varchar("payment_status",  { length: 20 }).notNull().default("payé"),
  photoUrl:       text("photo_url"),
  status:         varchar("status",          { length: 30 }).notNull().default("accepté"),
  notes:          text("notes"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

export const insertBagageItemSchema = createInsertSchema(bagageItemsTable).omit({ createdAt: true });
export type InsertBagageItem = z.infer<typeof insertBagageItemSchema>;
export type BagageItem = typeof bagageItemsTable.$inferSelect;
