import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const commissionSettingsTable = pgTable("commission_settings", {
  id:        text("id").primaryKey().default("default"),
  type:      varchar("type", { length: 20 }).notNull().default("percentage"),
  value:     real("value").notNull().default(10),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CommissionSettings = typeof commissionSettingsTable.$inferSelect;
