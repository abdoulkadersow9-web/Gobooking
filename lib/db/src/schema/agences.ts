import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const agencesTable = pgTable("agences", {
  id:        text("id").primaryKey(),
  name:      varchar("name", { length: 255 }).notNull(),
  city:      varchar("city", { length: 100 }).notNull(),
  address:   varchar("address", { length: 500 }),
  phone:     varchar("phone", { length: 50 }),
  companyId: text("company_id").notNull().references(() => companiesTable.id),
  status:    varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAgenceSchema = createInsertSchema(agencesTable).omit({ createdAt: true });
export type InsertAgence = z.infer<typeof insertAgenceSchema>;
export type Agence = typeof agencesTable.$inferSelect;
