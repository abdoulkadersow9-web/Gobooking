import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pointsHistoryTable = pgTable("points_history", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => usersTable.id),
  type:      varchar("type", { length: 30 }).notNull(), // earn | redeem
  points:    integer("points").notNull(),               // positive = earn, negative = redeem
  balance:   integer("balance").notNull(),              // balance after operation
  reason:    varchar("reason", { length: 255 }),
  bookingId: text("booking_id"),
  rewardId:  varchar("reward_id", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PointsHistory    = typeof pointsHistoryTable.$inferSelect;
export type NewPointsHistory = typeof pointsHistoryTable.$inferInsert;
