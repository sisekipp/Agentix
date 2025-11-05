// Workflow Definition Types
export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  data: NodeData;
  position: { x: number; y: number };
}

export type NodeType =
  | 'trigger'
  | 'agent'
  | 'tool'
  | 'decision'
  | 'action'
  | 'transform'
  | 'delay';

export interface NodeData {
  label: string;
  description?: string;
  config: Record<string, any>;
}

export interface WorkflowEdge {
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

// Execution Types
export interface WorkflowExecutionInput {
  workflowVersionId: string;
  input?: Record<string, any>;
  triggeredById?: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  output?: Record<string, any>;
  error?: string;
  duration?: number;
}

export type ExecutionStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Mastra Workflow Types
export interface MastraWorkflowStep {
  id: string;
  type: string;
  execute: (context: any) => Promise<any>;
  next?: string | string[] | ((result: any) => string);
}

export interface MastraWorkflowConfig {
  name: string;
  description?: string;
  steps: MastraWorkflowStep[];
  initialStep: string;
}
