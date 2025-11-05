import { pgTable, uuid, varchar, timestamp, text, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { teams } from "./teams";
import { users } from "./users";

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdById: uuid("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowVersions = pgTable("workflow_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  version: integer("version").notNull(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  definition: jsonb("definition").notNull(), // Workflow graph/definition
  isActive: boolean("is_active").default(false).notNull(),
  createdById: uuid("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowDeployments = pgTable("workflow_deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowVersionId: uuid("workflow_version_id")
    .references(() => workflowVersions.id, { onDelete: "cascade" })
    .notNull(),
  environment: varchar("environment", { length: 50 }).notNull(), // production, staging, testing
  status: varchar("status", { length: 50 }).notNull(), // active, inactive, failed
  deployedById: uuid("deployed_by_id")
    .references(() => users.id)
    .notNull(),
  deployedAt: timestamp("deployed_at").defaultNow().notNull(),
  rollbackVersionId: uuid("rollback_version_id")
    .references(() => workflowVersions.id),
});

export const workflowExecutions = pgTable("workflow_executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowVersionId: uuid("workflow_version_id")
    .references(() => workflowVersions.id)
    .notNull(),
  status: varchar("status", { length: 50 }).notNull(), // running, completed, failed, cancelled
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in milliseconds
  triggeredById: uuid("triggered_by_id")
    .references(() => users.id),
});
