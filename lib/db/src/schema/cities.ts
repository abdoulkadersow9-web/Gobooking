import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const citiesTable = pgTable("cities", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  region: varchar("region", { length: 100 }),
  country: varchar("country", { length: 100 }).notNull().default("Côte d'Ivoire"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCitySchema = createInsertSchema(citiesTable).omit({ createdAt: true });
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof citiesTable.$inferSelect;
