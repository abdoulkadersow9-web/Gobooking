import { integer, pgTable, real, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { companiesTable } from "./companies";

export const routesTable = pgTable("routes", {
  id:        text("id").primaryKey(),
  name:      varchar("name", { length: 150 }).notNull(),
  companyId: text("company_id").references(() => companiesTable.id),
  status:    varchar("status", { length: 20 }).notNull().default("active"),
});

export const stopsTable = pgTable("stops", {
  id:        text("id").primaryKey(),
  routeId:   text("route_id").notNull().references(() => routesTable.id),
  name:      varchar("name", { length: 150 }).notNull(),
  city:      varchar("city", { length: 100 }).notNull(),
  latitude:  real("latitude"),
  longitude: real("longitude"),
  order:     integer("order").notNull().default(0),
});

export const insertRouteSchema = createInsertSchema(routesTable);
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routesTable.$inferSelect;

export const insertStopSchema = createInsertSchema(stopsTable);
export type InsertStop = z.infer<typeof insertStopSchema>;
export type Stop = typeof stopsTable.$inferSelect;
