import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const referralsTable = pgTable("referrals", {
  id:          text("id").primaryKey(),
  referrerId:  text("referrer_id").notNull(),
  newUserId:   text("new_user_id").notNull(),
  reward:      integer("reward").notNull().default(500),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
