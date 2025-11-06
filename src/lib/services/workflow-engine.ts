import { db } from '../db';
import { workflowVersions, workflowExecutions } from '../db/schema/workflows';
import { eq } from 'drizzle-orm';
import { WorkflowConverter, ExecutableWorkflow } from './workflow-converter';
import { LLMProviderService } from './llm-provider';
import { ToolService } from './tool-service';
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
        // Execute LLM Agent
        try {
          const agentConfig = data.config || {};
          const { providerId, prompt, systemPrompt, temperature, maxTokens } = agentConfig;

          if (!providerId) {
            throw new Error('Agent node requires a providerId in config');
          }

          // Build messages
          const messages: any[] = [];

          if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
          }

          // Use prompt template with context substitution
          const processedPrompt = this.processPromptTemplate(
            prompt || 'Process the following input: {{input}}',
            context
          );
          messages.push({ role: 'user', content: processedPrompt });

          // Generate response
          const result = await LLMProviderService.generate(providerId, {
            messages,
            temperature: temperature || 0.7,
            maxTokens: maxTokens || 1000,
          });

          return {
            type: 'agent',
            label: data.label,
            result: result.text,
            usage: result.usage,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          console.error('Agent execution error:', error);
          return {
            type: 'agent',
            label: data.label,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          };
        }

      case 'tool':
        // Execute Tool
        try {
          const toolConfig = data.config || {};
          const { toolId, input: toolInput } = toolConfig;

          if (!toolId) {
            throw new Error('Tool node requires a toolId in config');
          }

          // Process input with context
          const processedInput = this.processToolInput(toolInput || {}, context);

          // Execute tool
          const result = await ToolService.executeTool(toolId, {
            input: processedInput,
            workflowContext: context,
          });

          return {
            type: 'tool',
            label: data.label,
            success: result.success,
            result: result.output,
            error: result.error,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          console.error('Tool execution error:', error);
          return {
            type: 'tool',
            label: data.label,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          };
        }

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

  /**
   * Process prompt template with context substitution
   */
  private static processPromptTemplate(
    template: string,
    context: Record<string, any>
  ): string {
    let processed = template;

    // Replace {{variable}} with context values
    const regex = /\{\{([^}]+)\}\}/g;
    processed = processed.replace(regex, (match, key) => {
      const trimmedKey = key.trim();

      // Support nested paths like {{input.name}}
      const value = this.getNestedValue(context, trimmedKey);

      if (value !== undefined) {
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      }

      return match; // Keep original if not found
    });

    return processed;
  }

  /**
   * Process tool input with context substitution
   */
  private static processToolInput(
    input: any,
    context: Record<string, any>
  ): any {
    if (typeof input === 'string') {
      return this.processPromptTemplate(input, context);
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.processToolInput(item, context));
    }

    if (typeof input === 'object' && input !== null) {
      const processed: any = {};
      for (const [key, value] of Object.entries(input)) {
        processed[key] = this.processToolInput(value, context);
      }
      return processed;
    }

    return input;
  }

  /**
   * Get nested value from object by path
   */
  private static getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
