import { db } from '../db';
import { workflowVersions, workflowExecutions } from '../db/schema/workflows';
import { eq } from 'drizzle-orm';
import { WorkflowConverter, ExecutableWorkflow } from './workflow-converter';
import type {
  WorkflowDefinition,
  WorkflowExecutionInput,
  WorkflowExecutionResult,
  ExecutionStatus,
  WorkflowNode,
} from '../types/workflow';

/**
 * Simplified Workflow Engine
 * Executes workflows step by step
 * Can be extended to use Mastra in the future
 */
export class WorkflowEngine {
  private static workflowCache = new Map<string, ExecutableWorkflow>();

  /**
   * Execute a workflow by version ID
   */
  static async executeWorkflow(
    input: WorkflowExecutionInput
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    let executionId: string | undefined;
    let status: ExecutionStatus = 'running';
    let output: Record<string, any> | undefined;
    let error: string | undefined;

    try {
      // Get workflow version
      const version = await this.getWorkflowVersion(input.workflowVersionId);

      if (!version) {
        throw new Error(
          `Workflow version not found: ${input.workflowVersionId}`
        );
      }

      // Create execution record
      const [execution] = await db
        .insert(workflowExecutions)
        .values({
          workflowVersionId: input.workflowVersionId,
          status: 'running',
          input: input.input || {},
          triggeredById: input.triggeredById,
          startedAt: new Date(),
        })
        .returning();

      executionId = execution.id;

      // Validate workflow definition
      const definition = version.definition as WorkflowDefinition;
      const validation = WorkflowConverter.validateDefinition(definition);

      if (!validation.valid) {
        throw new Error(
          `Invalid workflow definition: ${validation.errors.join(', ')}`
        );
      }

      // Convert to executable workflow
      const workflow = await this.getExecutableWorkflow(
        version.id,
        version.name || 'Unnamed Workflow',
        definition,
        version.description || undefined
      );

      // Execute workflow
      console.log(`Executing workflow: ${version.name}`, {
        executionId,
        input: input.input,
      });

      const result = await this.executeWorkflowSteps(
        workflow,
        input.input || {}
      );

      output = result;
      status = 'completed';

      console.log(`Workflow completed: ${version.name}`, {
        executionId,
        output,
      });
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);

      console.error('Workflow execution failed:', {
        executionId,
        error,
      });
    } finally {
      const duration = Date.now() - startTime;

      // Update execution record
      if (executionId) {
        await db
          .update(workflowExecutions)
          .set({
            status,
            output,
            error,
            completedAt: new Date(),
            duration,
          })
          .where(eq(workflowExecutions.id, executionId));
      }
    }

    return {
      executionId: executionId!,
      status,
      output,
      error,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute workflow steps
   */
  private static async executeWorkflowSteps(
    workflow: ExecutableWorkflow,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    const context: Record<string, any> = { input };
    const results: Record<string, any> = {};

    // Start from trigger node
    const nextNodes = workflow.adjacencyList.get(workflow.triggerNodeId) || [];

    // Execute nodes in order (simplified BFS)
    const queue = [...nextNodes];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      const node = workflow.nodeMap.get(nodeId);
      if (!node) {
        continue;
      }

      // Execute node
      const result = await this.executeNode(node, context);
      results[nodeId] = result;
      context[nodeId] = result;

      // Add next nodes to queue
      const nextNodeIds = workflow.adjacencyList.get(nodeId) || [];
      queue.push(...nextNodeIds);
    }

    return {
      results,
      finalContext: context,
    };
  }

  /**
   * Execute a single workflow node
   */
  private static async executeNode(
    node: WorkflowNode,
    context: Record<string, any>
  ): Promise<any> {
    const { type, data } = node;

    console.log(`Executing node: ${node.id} (${type})`, data);

    switch (type) {
      case 'trigger':
        return { triggered: true, input: context.input };

      case 'agent':
        // TODO: Integrate with LLM providers
        return {
          type: 'agent',
          label: data.label,
          result: `Agent ${data.label} executed`,
          timestamp: new Date().toISOString(),
        };

      case 'tool':
        // TODO: Integrate with tools
        return {
          type: 'tool',
          label: data.label,
          result: `Tool ${data.label} executed`,
          timestamp: new Date().toISOString(),
        };

      case 'decision':
        const condition = data.config?.condition || 'true';
        try {
          // Simple condition evaluation
          const result = condition === 'true' || context.input?.proceed === true;
          return {
            type: 'decision',
            label: data.label,
            result: result ? 'true' : 'false',
            branch: result ? 'true' : 'false',
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          console.error('Error evaluating condition:', error);
          return {
            type: 'decision',
            label: data.label,
            result: 'false',
            branch: 'false',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          };
        }

      case 'action':
        return {
          type: 'action',
          label: data.label,
          result: `Action ${data.label} executed`,
          timestamp: new Date().toISOString(),
        };

      case 'transform':
        // TODO: Implement data transformation
        return {
          type: 'transform',
          label: data.label,
          result: context,
          timestamp: new Date().toISOString(),
        };

      case 'delay':
        const delayMs = data.config?.delayMs || 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return {
          type: 'delay',
          label: data.label,
          result: `Delayed ${delayMs}ms`,
          timestamp: new Date().toISOString(),
        };

      default:
        return {
          type: 'unknown',
          label: data.label,
          result: `Unknown node type: ${type}`,
          timestamp: new Date().toISOString(),
        };
    }
  }

  /**
   * Get or create executable workflow from definition
   */
  private static async getExecutableWorkflow(
    versionId: string,
    name: string,
    definition: WorkflowDefinition,
    description?: string
  ): Promise<ExecutableWorkflow> {
    // Check cache
    if (this.workflowCache.has(versionId)) {
      return this.workflowCache.get(versionId)!;
    }

    // Convert to executable workflow
    const workflow = await WorkflowConverter.convertToExecutableWorkflow(
      definition,
      name,
      description
    );

    // Cache workflow
    this.workflowCache.set(versionId, workflow);

    return workflow;
  }

  /**
   * Get workflow version from database
   */
  private static async getWorkflowVersion(versionId: string) {
    const [version] = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.id, versionId))
      .limit(1);

    return version;
  }

  /**
   * Get workflow execution by ID
   */
  static async getExecution(executionId: string) {
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId))
      .limit(1);

    return execution;
  }

  /**
   * Get all executions for a workflow version
   */
  static async getExecutions(workflowVersionId: string) {
    return await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowVersionId, workflowVersionId))
      .orderBy(workflowExecutions.startedAt);
  }

  /**
   * Cancel a running workflow execution
   */
  static async cancelExecution(executionId: string): Promise<boolean> {
    try {
      const [execution] = await db
        .update(workflowExecutions)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
          error: 'Execution cancelled by user',
        })
        .where(eq(workflowExecutions.id, executionId))
        .returning();

      return !!execution;
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      return false;
    }
  }

  /**
   * Clear workflow cache
   */
  static clearCache(versionId?: string) {
    if (versionId) {
      this.workflowCache.delete(versionId);
    } else {
      this.workflowCache.clear();
    }
  }

  /**
   * Watch workflow execution in real-time
   */
  static async watchExecution(
    executionId: string,
    callback: (status: ExecutionStatus, data?: any) => void
  ): Promise<void> {
    // Poll for status updates
    const pollInterval = 1000; // 1 second
    const maxPolls = 300; // 5 minutes max
    let polls = 0;

    const poll = async () => {
      const execution = await this.getExecution(executionId);

      if (!execution) {
        callback('failed', { error: 'Execution not found' });
        return;
      }

      callback(execution.status as ExecutionStatus, {
        output: execution.output,
        error: execution.error,
      });

      if (
        execution.status === 'completed' ||
        execution.status === 'failed' ||
        execution.status === 'cancelled' ||
        polls >= maxPolls
      ) {
        return; // Stop polling
      }

      polls++;
      setTimeout(poll, pollInterval);
    };

    await poll();
  }
}
