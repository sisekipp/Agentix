// Global type definitions

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workflow {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  name?: string;
  description?: string;
  definition: WorkflowDefinition;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'decision' | 'trigger' | 'action';
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  data?: Record<string, any>;
}

export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type DeploymentEnvironment = 'production' | 'staging' | 'testing';
export type DeploymentStatus = 'active' | 'inactive' | 'failed';
