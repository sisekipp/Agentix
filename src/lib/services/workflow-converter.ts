import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from '../types/workflow';

export interface ExecutableWorkflow {
  name: string;
  description?: string;
  triggerNodeId: string;
  nodeMap: Map<string, WorkflowNode>;
  adjacencyList: Map<string, string[]>;
  definition: WorkflowDefinition;
}

/**
 * Converts UI workflow definition to executable workflow
 * This is a simplified implementation that can be extended to use Mastra in the future
 */
export class WorkflowConverter {
  /**
   * Convert workflow definition to executable format
   */
  static async convertToExecutableWorkflow(
    definition: WorkflowDefinition,
    name: string,
    description?: string
  ): Promise<ExecutableWorkflow> {
    const { nodes, edges } = definition;

    if (!nodes || nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    // Find trigger node (starting point)
    const triggerNode = nodes.find((n) => n.type === 'trigger');
    if (!triggerNode) {
      throw new Error('Workflow must have a trigger node');
    }

    // Build node map for quick lookup
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Build adjacency list for execution flow
    const adjacencyList = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, []);
      }
      adjacencyList.get(edge.source)!.push(edge.target);
    }

    return {
      name,
      description,
      triggerNodeId: triggerNode.id,
      nodeMap,
      adjacencyList,
      definition,
    };
  }

  /**
   * Validate workflow definition
   */
  static validateDefinition(definition: WorkflowDefinition): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!definition.nodes || definition.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    const triggerNodes = definition.nodes.filter((n) => n.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have a trigger node');
    }
    if (triggerNodes.length > 1) {
      errors.push('Workflow can only have one trigger node');
    }

    // Validate edges reference existing nodes
    const nodeIds = new Set(definition.nodes.map((n) => n.id));
    for (const edge of definition.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge references non-existent source node: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge references non-existent target node: ${edge.target}`);
      }
    }

    // Check for cycles (basic check)
    // TODO: Implement more sophisticated cycle detection

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
