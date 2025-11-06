// ============================================
// AGENT TYPES
// Agents sind atomare Workflow-Einheiten
// ============================================

// Agent verwendet dieselbe Workflow-Struktur wie bisher
export interface AgentDefinition {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

export interface AgentNode {
  id: string;
  type: AgentNodeType;
  data: NodeData;
  position: { x: number; y: number };
}

// Node-Types die INNERHALB eines Agents verfügbar sind
export type AgentNodeType =
  | 'trigger'      // Agent-Start
  | 'agent'        // LLM-Call (ehemals "agent", jetzt vielleicht umbenennen zu "llm"?)
  | 'tool'         // Tool-Ausführung
  | 'decision'     // Conditional Branching
  | 'action'       // Custom Action
  | 'transform'    // Data Transformation
  | 'delay';       // Time Delay

export interface NodeData {
  label: string;
  description?: string;
  config: Record<string, any>;
}

export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: EdgeData;
}

export interface EdgeData {
  condition?: string;
  label?: string;
}

// Agent-Metadata
export interface AgentMetadata {
  icon?: string;        // Emoji oder Icon-Name
  color?: string;       // Hex-Color für UI
  systemPrompt?: string; // Basis-Verhalten
  availableTools?: string[]; // Tool-IDs
}

// ============================================
// SCENARIO TYPES
// Scenarios orchestrieren mehrere Agents
// ============================================

export interface ScenarioDefinition {
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
}

export interface ScenarioNode {
  id: string;
  type: ScenarioNodeType;
  data: ScenarioNodeData;
  position: { x: number; y: number };
}

// Node-Types die auf SZENARIO-Ebene verfügbar sind
export type ScenarioNodeType =
  | 'scenario-trigger'    // Szenario-Start (Chat, API, Webhook, Schedule)
  | 'scenario-agent'      // Agent ausführen
  | 'scenario-decision'   // Conditional Branching
  | 'scenario-parallel'   // Mehrere Agents parallel ausführen
  | 'scenario-transform'  // Daten-Transformation
  | 'scenario-end';       // Szenario beenden

export interface ScenarioNodeData {
  label: string;
  description?: string;
  config: ScenarioNodeConfig;
}

// Verschiedene Configs für verschiedene Node-Types
export type ScenarioNodeConfig =
  | ScenarioTriggerConfig
  | ScenarioAgentConfig
  | ScenarioDecisionConfig
  | ScenarioParallelConfig
  | ScenarioTransformConfig
  | ScenarioEndConfig;

export interface ScenarioTriggerConfig {
  triggerType: TriggerType;
  triggerConfig?: Record<string, any>; // Trigger-spezifische Configs
}

export interface ScenarioAgentConfig {
  agentId: string;          // UUID des Agents
  agentName: string;        // Display-Name
  agentIcon?: string;       // Icon für UI
  input: Record<string, any>; // Input-Mapping mit Template-Variables
}

export interface ScenarioDecisionConfig {
  branches: DecisionBranch[];
}

export interface DecisionBranch {
  condition: string;  // z.B. "{{agent-1.output.category}} == 'billing'"
  label: string;      // Display-Name
}

export interface ScenarioParallelConfig {
  agents: {
    agentId: string;
    agentName: string;
    input: Record<string, any>;
  }[];
}

export interface ScenarioTransformConfig {
  transformType: 'map' | 'filter' | 'select' | 'merge';
  transformConfig: Record<string, any>;
}

export interface ScenarioEndConfig {
  output: Record<string, any>; // Output-Mapping
}

export interface ScenarioEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: ScenarioEdgeData;
}

export interface ScenarioEdgeData {
  label?: string;
  branchIndex?: number; // Für Decision-Nodes
  condition?: string;
}

// Trigger-Types
export type TriggerType = 'chat' | 'api' | 'webhook' | 'schedule';

export interface TriggerConfig {
  chat?: ChatTriggerConfig;
  api?: ApiTriggerConfig;
  webhook?: WebhookTriggerConfig;
  schedule?: ScheduleTriggerConfig;
}

export interface ChatTriggerConfig {
  welcomeMessage?: string;
  systemPrompt?: string;
  enableStreaming?: boolean;
}

export interface ApiTriggerConfig {
  authRequired?: boolean;
  rateLimit?: number;
  timeout?: number;
}

export interface WebhookTriggerConfig {
  secret?: string;
  verifySignature?: boolean;
  allowedOrigins?: string[];
}

export interface ScheduleTriggerConfig {
  cronExpression: string;
  timezone?: string;
  enabled?: boolean;
}

// ============================================
// EXECUTION TYPES
// ============================================

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Szenario-Execution
export interface ScenarioExecutionInput {
  scenarioId: string;
  input?: Record<string, any>;
  conversationId?: string; // Für Chat-Trigger
  triggeredById?: string;
}

export interface ScenarioExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  output?: Record<string, any>;
  error?: string;
  duration?: number;
  agentExecutions?: AgentExecutionSummary[];
}

export interface AgentExecutionSummary {
  agentExecutionId: string;
  agentId: string;
  agentName: string;
  status: ExecutionStatus;
  duration?: number;
  error?: string;
}

// Agent-Execution (innerhalb eines Szenarios)
export interface AgentExecutionInput {
  scenarioExecutionId: string;
  agentVersionId: string;
  scenarioNodeId: string;
  input: Record<string, any>;
}

export interface AgentExecutionResult {
  agentExecutionId: string;
  status: ExecutionStatus;
  output?: Record<string, any>;
  error?: string;
  duration?: number;
  steps?: AgentStepSummary[];
}

export interface AgentStepSummary {
  stepId: string;
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;
  status: ExecutionStatus;
  duration?: number;
  error?: string;
}

// Step-Execution (innerhalb eines Agents)
export interface AgentStepExecution {
  id: string;
  agentExecutionId: string;
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;
  status: ExecutionStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

// ============================================
// CONVERSATION TYPES (für Chat-Trigger)
// ============================================

export interface Conversation {
  id: string;
  scenarioId: string;
  userId: string;
  status: ConversationStatus;
  title?: string;
  metadata?: Record<string, any>;
  startedAt: Date;
  lastMessageAt?: Date;
  endedAt?: Date;
}

export type ConversationStatus = 'active' | 'ended' | 'archived';

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  scenarioExecutionId?: string;
  agentExecutionId?: string;
  createdAt: Date;
  metadata?: MessageMetadata;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageMetadata {
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  agentName?: string;
}

// ============================================
// UI/DISPLAY TYPES
// ============================================

// Für Flow-Visualisierung während Execution
export interface ExecutionFlowState {
  scenarioExecutionId: string;
  status: ExecutionStatus;
  currentNodeId?: string;
  nodeStates: Record<string, NodeExecutionState>;
  agentExecutions: Record<string, AgentExecutionState>;
}

export interface NodeExecutionState {
  status: ExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
}

export interface AgentExecutionState {
  agentExecutionId: string;
  agentId: string;
  agentName: string;
  status: ExecutionStatus;
  steps: Record<string, NodeExecutionState>;
  duration?: number;
}

// Für Agent-Auswahl im Szenario-Editor
export interface AgentOption {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}
