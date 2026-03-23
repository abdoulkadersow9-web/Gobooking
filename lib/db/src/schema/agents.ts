import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";
import { companiesTable } from "./companies";
import { busesTable } from "./buses";

export const agentsTable = pgTable("agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  companyId: text("company_id").notNull().references(() => companiesTable.id),
  busId: text("bus_id").references(() => busesTable.id),
  agentCode: varchar("agent_code", { length: 20 }).notNull().unique(),
  agentRole: varchar("agent_role", { length: 30 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({ createdAt: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
