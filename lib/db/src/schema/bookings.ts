import { json, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { tripsTable } from "./trips";
import { usersTable } from "./users";

export interface Passenger {
  name: string;
  age: number;
  gender: string;
  idType: string;
  idNumber: string;
  seatNumber: string;
}

export type BagageType = "valise" | "sac" | "colis" | "autre";
export type BagageStatus = "en_attente" | "accepté" | "refusé";

export interface Bagage {
  id: string;
  type: BagageType;
  poids: number;
  imageUrl?: string;
  prix: number;
}

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey(),
  bookingRef: varchar("booking_ref", { length: 20 }).notNull().unique(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  tripId: text("trip_id").notNull().references(() => tripsTable.id),
  seatIds: json("seat_ids").$type<string[]>().notNull().default([]),
  seatNumbers: json("seat_numbers").$type<string[]>().notNull().default([]),
  passengers: json("passengers").$type<Passenger[]>().notNull().default([]),
  totalAmount: real("total_amount").notNull(),
  commissionAmount: real("commission_amount").notNull().default(0),
  commissionRate: real("commission_rate").notNull().default(0),
  paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("paid"),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }).notNull(),
  bagages: json("bagages").$type<Bagage[]>().default([]),
  bagageStatus: varchar("bagage_status", { length: 20 }).default("en_attente"),
  bagagePrice: real("bagage_price").notNull().default(0),
  bagageNote: text("bagage_note"),
  fromStopId: text("from_stop_id"),
  toStopId:   text("to_stop_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
