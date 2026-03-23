import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const promosTable = pgTable("promos", {
  id:          text("id").primaryKey(),
  code:        varchar("code", { length: 30 }).notNull().unique(),
  discount:    integer("discount").notNull(),
  minAmount:   integer("min_amount").notNull().default(0),
  valid:       boolean("valid").notNull().default(true),
  maxUses:     integer("max_uses"),
  usedCount:   integer("used_count").notNull().default(0),
  expiresAt:   timestamp("expires_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type Promo = typeof promosTable.$inferSelect;
