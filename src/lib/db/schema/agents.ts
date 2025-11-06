import { pgTable, uuid, varchar, timestamp, text, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { teams } from "./teams";
import { users } from "./users";

// ============================================
// AGENTS - Atomare, wiederverwendbare Workflow-Einheiten
// ============================================

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Workflow-Definition (Nodes + Edges)
  // Same structure as current workflows
  workflowDefinition: jsonb("workflow_definition").notNull(),

  // Agent-spezifische Konfiguration
  systemPrompt: text("system_prompt"), // Optional: Basis-Verhalten
  availableTools: jsonb("available_tools"), // Array von Tool-IDs die der Agent nutzen kann

  // Metadata
  icon: varchar("icon", { length: 50 }), // Emoji oder Icon-Name für UI
  color: varchar("color", { length: 50 }), // Hex-Color für UI

  createdById: text("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentVersions = pgTable("agent_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .notNull(),
  version: integer("version").notNull(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  workflowDefinition: jsonb("workflow_definition").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdById: text("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// SCENARIOS - Orchestrierung von Agents
// ============================================

export const scenarios = pgTable("scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Orchestrierung-Definition (Flow von Agents)
  // Structure: { nodes: [...], edges: [...] }
  // Node types: trigger, agent, decision, parallel, transform, end
  orchestrationDefinition: jsonb("orchestration_definition").notNull(),

  // Trigger-Konfiguration
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  // Possible values: 'chat', 'api', 'webhook', 'schedule'
  triggerConfig: jsonb("trigger_config"), // Trigger-spezifische Configs

  // Status
  isActive: boolean("is_active").default(true).notNull(),

  createdById: text("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scenarioVersions = pgTable("scenario_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioId: uuid("scenario_id")
    .references(() => scenarios.id, { onDelete: "cascade" })
    .notNull(),
  version: integer("version").notNull(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  orchestrationDefinition: jsonb("orchestration_definition").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdById: text("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// EXECUTIONS - Tracking auf allen Ebenen
// ============================================

// Top-Level: Szenario-Ausführungen
export const scenarioExecutions = pgTable("scenario_executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioVersionId: uuid("scenario_version_id")
    .references(() => scenarioVersions.id)
    .notNull(),

  // Für Chat-Trigger: Link zur Conversation
  conversationId: uuid("conversation_id"),

  status: varchar("status", { length: 50 }).notNull(), // running, completed, failed, cancelled
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),

  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in milliseconds

  triggeredById: text("triggered_by_id")
    .references(() => users.id),
});

// Mid-Level: Agent-Ausführungen (innerhalb eines Szenarios)
export const agentExecutions = pgTable("agent_executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioExecutionId: uuid("scenario_execution_id")
    .references(() => scenarioExecutions.id, { onDelete: "cascade" })
    .notNull(),
  agentVersionId: uuid("agent_version_id")
    .references(() => agentVersions.id)
    .notNull(),

  // Orchestrierung-Kontext
  scenarioNodeId: varchar("scenario_node_id", { length: 255 }).notNull(), // Node-ID im Szenario-Flow

  status: varchar("status", { length: 50 }).notNull(), // running, completed, failed, cancelled
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),

  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"),
});

// Low-Level: Step-Ausführungen (innerhalb eines Agents)
export const agentExecutionSteps = pgTable("agent_execution_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentExecutionId: uuid("agent_execution_id")
    .references(() => agentExecutions.id, { onDelete: "cascade" })
    .notNull(),

  // Node-Info aus dem Agent-Workflow
  nodeId: varchar("node_id", { length: 255 }).notNull(),
  nodeType: varchar("node_type", { length: 50 }).notNull(), // trigger, agent, tool, decision, etc.
  nodeLabel: varchar("node_label", { length: 255 }),

  status: varchar("status", { length: 50 }).notNull(), // running, completed, failed, skipped
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),

  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"),
});

// ============================================
// CONVERSATIONS - Für Chat-Trigger
// ============================================

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioId: uuid("scenario_id")
    .references(() => scenarios.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),

  status: varchar("status", { length: 50 }).notNull(), // active, ended, archived
  title: varchar("title", { length: 255 }), // Auto-generiert oder user-defined

  // Conversation-Metadata
  metadata: jsonb("metadata"), // Zusätzliche Kontext-Daten

  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at"),
  endedAt: timestamp("ended_at"),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),

  role: varchar("role", { length: 50 }).notNull(), // user, assistant, system
  content: text("content").notNull(),

  // Welche Szenario-Execution hat diese Nachricht erzeugt
  scenarioExecutionId: uuid("scenario_execution_id")
    .references(() => scenarioExecutions.id),

  // Welcher Agent hat diese Nachricht erzeugt (optional)
  agentExecutionId: uuid("agent_execution_id")
    .references(() => agentExecutions.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  // Token-Usage und andere Metadata
  metadata: jsonb("metadata"),
});

// ============================================
// RELATIONS
// ============================================

export const agentsRelations = relations(agents, ({ one, many }) => ({
  team: one(teams, {
    fields: [agents.teamId],
    references: [teams.id],
  }),
  createdBy: one(users, {
    fields: [agents.createdById],
    references: [users.id],
  }),
  versions: many(agentVersions),
}));

export const agentVersionsRelations = relations(agentVersions, ({ one, many }) => ({
  agent: one(agents, {
    fields: [agentVersions.agentId],
    references: [agents.id],
  }),
  createdBy: one(users, {
    fields: [agentVersions.createdById],
    references: [users.id],
  }),
  executions: many(agentExecutions),
}));

export const scenariosRelations = relations(scenarios, ({ one, many }) => ({
  team: one(teams, {
    fields: [scenarios.teamId],
    references: [teams.id],
  }),
  createdBy: one(users, {
    fields: [scenarios.createdById],
    references: [users.id],
  }),
  versions: many(scenarioVersions),
  conversations: many(conversations),
}));

export const scenarioVersionsRelations = relations(scenarioVersions, ({ one, many }) => ({
  scenario: one(scenarios, {
    fields: [scenarioVersions.scenarioId],
    references: [scenarios.id],
  }),
  createdBy: one(users, {
    fields: [scenarioVersions.createdById],
    references: [users.id],
  }),
  executions: many(scenarioExecutions),
}));

export const scenarioExecutionsRelations = relations(scenarioExecutions, ({ one, many }) => ({
  scenarioVersion: one(scenarioVersions, {
    fields: [scenarioExecutions.scenarioVersionId],
    references: [scenarioVersions.id],
  }),
  triggeredBy: one(users, {
    fields: [scenarioExecutions.triggeredById],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [scenarioExecutions.conversationId],
    references: [conversations.id],
  }),
  agentExecutions: many(agentExecutions),
  messages: many(conversationMessages),
}));

export const agentExecutionsRelations = relations(agentExecutions, ({ one, many }) => ({
  scenarioExecution: one(scenarioExecutions, {
    fields: [agentExecutions.scenarioExecutionId],
    references: [scenarioExecutions.id],
  }),
  agentVersion: one(agentVersions, {
    fields: [agentExecutions.agentVersionId],
    references: [agentVersions.id],
  }),
  steps: many(agentExecutionSteps),
  messages: many(conversationMessages),
}));

export const agentExecutionStepsRelations = relations(agentExecutionSteps, ({ one }) => ({
  agentExecution: one(agentExecutions, {
    fields: [agentExecutionSteps.agentExecutionId],
    references: [agentExecutions.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  scenario: one(scenarios, {
    fields: [conversations.scenarioId],
    references: [scenarios.id],
  }),
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(conversationMessages),
  executions: many(scenarioExecutions),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id],
  }),
  scenarioExecution: one(scenarioExecutions, {
    fields: [conversationMessages.scenarioExecutionId],
    references: [scenarioExecutions.id],
  }),
  agentExecution: one(agentExecutions, {
    fields: [conversationMessages.agentExecutionId],
    references: [agentExecutions.id],
  }),
}));
