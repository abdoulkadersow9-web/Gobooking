import { pgTable, boolean, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id:         text("id").primaryKey(),
  userId:     text("user_id").notNull(),
  userRole:   varchar("user_role", { length: 40 }).notNull().default("unknown"),
  userName:   varchar("user_name", { length: 255 }).notNull().default(""),
  action:     varchar("action", { length: 100 }).notNull(),
  targetId:   text("target_id"),
  targetType: varchar("target_type", { length: 60 }),
  metadata:   text("metadata"),
  ipAddress:  varchar("ip_address", { length: 60 }),
  flagged:    boolean("flagged").notNull().default(false),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
