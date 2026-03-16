import { integer, pgTable, real, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { tripsTable } from "./trips";

export const seatsTable = pgTable("seats", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  number: varchar("number", { length: 10 }).notNull(),
  row: integer("row").notNull(),
  column: integer("column").notNull(),
  type: varchar("type", { length: 20 }).notNull().default("aisle"),
  status: varchar("status", { length: 20 }).notNull().default("available"),
  price: real("price").notNull(),
});

export const insertSeatSchema = createInsertSchema(seatsTable).omit({});
export type InsertSeat = z.infer<typeof insertSeatSchema>;
export type Seat = typeof seatsTable.$inferSelect;
