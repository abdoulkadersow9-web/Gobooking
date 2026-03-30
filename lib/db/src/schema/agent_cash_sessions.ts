import { integer, jsonb, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const agentCashSessionsTable = pgTable("agent_cash_sessions", {
  id:               text("id").primaryKey(),
  agentId:          text("agent_id").notNull(),
  agentUserId:      text("agent_user_id").notNull(),
  agentName:        text("agent_name"),
  agentRole:        varchar("agent_role", { length: 50 }).notNull(),
  companyId:        text("company_id").notNull(),
  agenceId:         text("agence_id"),
  sessionType:      varchar("session_type", { length: 20 }).notNull().default("trip"),
  tripId:           text("trip_id"),
  sessionDate:      text("session_date"),
  tripFrom:         text("trip_from"),
  tripTo:           text("trip_to"),
  tripDeparture:    text("trip_departure"),
  status:           varchar("status", { length: 20 }).notNull().default("draft"),
  totalAmount:      real("total_amount").notNull().default(0),
  transactionCount: integer("transaction_count").notNull().default(0),
  breakdown:        jsonb("breakdown").$type<Record<string, any>>().default({}),
  transactions:     jsonb("transactions").$type<any[]>().default([]),
  agentComment:     text("agent_comment"),
  chefComment:      text("chef_comment"),
  chefId:           text("chef_id"),
  closedAt:         timestamp("closed_at"),
  sentAt:           timestamp("sent_at"),
  validatedAt:      timestamp("validated_at"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});

export type AgentCashSession    = typeof agentCashSessionsTable.$inferSelect;
export type NewAgentCashSession = typeof agentCashSessionsTable.$inferInsert;
