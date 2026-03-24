import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const scansTable = pgTable("scans", {
  id:         text("id").primaryKey(),
  type:       varchar("type", { length: 20 }).notNull(),
  ref:        varchar("ref", { length: 50 }).notNull(),
  targetId:   text("target_id").notNull(),
  trajetId:   text("trajet_id"),
  agentId:    text("agent_id").notNull(),
  agentName:  varchar("agent_name", { length: 120 }),
  companyId:  text("company_id"),
  status:     varchar("status", { length: 20 }).notNull().default("validé"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});
