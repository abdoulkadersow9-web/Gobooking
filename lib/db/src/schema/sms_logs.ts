import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const smsLogsTable = pgTable("sms_logs", {
  id:          text("id").primaryKey(),
  companyId:   text("company_id").notNull(),
  companyName: varchar("company_name", { length: 255 }),
  segment:     varchar("segment", { length: 50 }).notNull(), // all | loyal | recent | inactive
  message:     text("message").notNull(),
  recipients:  integer("recipients").notNull().default(0),
  status:      varchar("status", { length: 20 }).notNull().default("sent"), // sent | failed
  sentBy:      text("sent_by"), // userId
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type SmsLog    = typeof smsLogsTable.$inferSelect;
export type NewSmsLog = typeof smsLogsTable.$inferInsert;
