import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const colisLogsTable = pgTable("colis_logs", {
  id:           text("id").primaryKey(),
  colisId:      text("colis_id").notNull(),
  trackingRef:  varchar("tracking_ref", { length: 30 }),
  action:       varchar("action", { length: 30 }).notNull(),
  agentId:      text("agent_id"),
  agentName:    varchar("agent_name", { length: 120 }),
  companyId:    text("company_id"),
  agenceId:     text("agence_id"),
  notes:        text("notes"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export type ColisLog = typeof colisLogsTable.$inferSelect;
