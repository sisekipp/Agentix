import { pgTable, uuid, varchar, timestamp, text, jsonb, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const llmProviders = pgTable("llm_providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(), // openai, anthropic, google, etc.
  model: varchar("model", { length: 255 }).notNull(),
  apiKey: text("api_key").notNull(), // Should be encrypted
  configuration: jsonb("configuration"), // Additional provider-specific settings
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 100 }).notNull(), // api, function, webhook, etc.
  configuration: jsonb("configuration").notNull(),
  schema: jsonb("schema"), // JSON Schema for tool parameters
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
