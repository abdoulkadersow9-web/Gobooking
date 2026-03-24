import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

export const reviewsTable = pgTable("reviews", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => usersTable.id),
  companyId: text("company_id").notNull(),
  tripId:    text("trip_id").notNull(),
  bookingId: text("booking_id").notNull().unique(),
  rating:    integer("rating").notNull(),
  comment:   text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
