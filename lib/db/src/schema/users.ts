import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id:           text("id").primaryKey(),
  name:         varchar("name", { length: 255 }).notNull(),
  email:        varchar("email", { length: 255 }).notNull().unique(),
  phone:        varchar("phone", { length: 50 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role:         varchar("role", { length: 20 }).notNull().default("user"),
  status:       varchar("status", { length: 20 }).notNull().default("active"),
  pushToken:    text("push_token"),
  referralCode: varchar("referral_code", { length: 20 }).unique(),
  walletBalance: integer("wallet_balance").notNull().default(0),
  totalTrips:   integer("total_trips").notNull().default(0),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
