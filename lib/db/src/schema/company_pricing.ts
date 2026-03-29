import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const companyPricingTable = pgTable("company_pricing", {
  id:        text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companiesTable.id),
  fromCity:  varchar("from_city", { length: 100 }).notNull(),
  toCity:    varchar("to_city",   { length: 100 }).notNull(),
  tripType:  varchar("trip_type", { length: 20 }).notNull().default("standard"),
  price:     real("price").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CompanyPricing = typeof companyPricingTable.$inferSelect;
export type InsertCompanyPricing = typeof companyPricingTable.$inferInsert;
