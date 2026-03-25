import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const departuresTable = pgTable("departures", {
  id:             text("id").primaryKey(),
  busId:          text("bus_id"),
  villeDepart:    varchar("ville_depart", { length: 100 }).notNull().default(""),
  villeArrivee:   varchar("ville_arrivee", { length: 100 }).notNull().default(""),
  heureDepart:    varchar("heure_depart", { length: 10 }).notNull().default(""),
  chauffeurNom:   varchar("chauffeur_nom", { length: 255 }),
  agentRouteNom:  varchar("agent_route_nom", { length: 255 }),
  agentRouteId:   text("agent_route_id"),
  companyId:      text("company_id"),
  statut:         varchar("statut", { length: 20 }).notNull().default("programmé"),
  notes:          text("notes"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").defaultNow(),
});

export type Departure    = typeof departuresTable.$inferSelect;
export type NewDeparture = typeof departuresTable.$inferInsert;
