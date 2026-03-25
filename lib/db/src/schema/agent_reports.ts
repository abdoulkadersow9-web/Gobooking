import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentReportsTable = pgTable("agent_reports", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  agentName: varchar("agent_name", { length: 255 }).notNull(),
  companyId: text("company_id"),
  agentRole: varchar("agent_role", { length: 50 }),
  reportType: varchar("report_type", { length: 50 }).notNull(),
  description: text("description").notNull(),
  relatedId: text("related_id"),
  statut: varchar("statut", { length: 20 }).notNull().default("soumis"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAgentReportSchema = createInsertSchema(agentReportsTable).omit({ createdAt: true });
export type InsertAgentReport = z.infer<typeof insertAgentReportSchema>;
export type AgentReport = typeof agentReportsTable.$inferSelect;
