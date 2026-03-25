import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const agentAlertsTable = pgTable("agent_alerts", {
  id:          text("id").primaryKey(),
  type:        varchar("type", { length: 30 }).notNull(), // urgence | panne | controle | sos | alerte
  agentId:     text("agent_id").notNull(),
  agentName:   varchar("agent_name", { length: 255 }),
  companyId:   text("company_id"),
  tripId:      text("trip_id"),
  busId:       text("bus_id"),
  busName:     varchar("bus_name", { length: 255 }),
  lat:         real("lat"),
  lon:         real("lon"),
  message:     text("message"),
  status:      varchar("status", { length: 20 }).notNull().default("active"), // active | resolue
  response:    varchar("response", { length: 30 }),   // panne | controle | pause (bus agent reply)
  respondedAt: timestamp("responded_at"),
  resolvedAt:  timestamp("resolved_at"),
  resolvedBy:  text("resolved_by"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type AgentAlert    = typeof agentAlertsTable.$inferSelect;
export type NewAgentAlert = typeof agentAlertsTable.$inferInsert;
