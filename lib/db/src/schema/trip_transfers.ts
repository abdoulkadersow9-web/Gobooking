import { integer, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { busesTable } from "./buses";
import { tripsTable } from "./trips";

export const tripTransfersTable = pgTable("trip_transfers", {
  id:              text("id").primaryKey(),
  tripId:          text("trip_id").notNull().references(() => tripsTable.id),
  oldBusId:        text("old_bus_id"),
  oldBusPlate:     text("old_bus_plate"),
  oldBusName:      text("old_bus_name"),
  newBusId:        text("new_bus_id").references(() => busesTable.id),
  newBusPlate:     text("new_bus_plate"),
  newBusName:      text("new_bus_name"),
  reason:          text("reason").notNull(),
  detail:          text("detail"),
  transferLocation: text("transfer_location"),
  transferredAt:   timestamp("transferred_at").notNull().defaultNow(),
  oldAgentIds:     json("old_agent_ids").$type<string[]>().default([]),
  newAgentIds:     json("new_agent_ids").$type<string[]>().default([]),
  passengersCount: integer("passengers_count").default(0),
  createdBy:       text("created_by"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
});

export type TripTransfer = typeof tripTransfersTable.$inferSelect;
