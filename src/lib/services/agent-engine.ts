import { db } from '../db';
import {
  agentVersions,
  agentExecutions,
  agentExecutionSteps
} from '../db/schema/agents';
import { eq } from 'drizzle-orm';
import { WorkflowConverter, ExecutableWorkflow } from './workflow-converter';
import { LLMProviderService } from './llm-provider';
import { ToolService } from './tool-service';
import type {
  AgentDefinition,
  AgentNode,
  AgentExecutionInput,
  AgentExecutionResult,
  ExecutionStatus,
} from '../types/agent';

/**
 * Agent Engine
 * Executes individual agents (atomic workflow units)
 * Tracks execution at the step level
 */
export class AgentEngine {
  private static agentCache = new Map<string, ExecutableWorkflow>();

  /**
   * Execute an agent
   */
  static async executeAgent(
    input: AgentExecutionInput
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    let agentExecutionId: string | undefined;
    let status: ExecutionStatus = 'running';
    let output: Record<string, any> | undefined;
    let error: string | undefined;

    try {
      // Get agent version
      const version = await this.getAgentVersion(input.agentVersionId);

      if (!version) {
        throw new Error(
          `Agent version not found: ${input.agentVersionId}`
        );
      }

      // Create agent execution record
      const [execution] = await db
        .insert(agentExecutions)
        .values({
          scenarioExecutionId: input.scenarioExecutionId,
          agentVersionId: input.agentVersionId,
          scenarioNodeId: input.scenarioNodeId,
          status: 'running',
          input: input.input || {},
          startedAt: new Date(),
        })
        .returning();

      agentExecutionId = execution.id;

      // Validate agent definition
      const definition = version.workflowDefinition as AgentDefinition;

      // Debug: Log the loaded workflow definition
      console.log(`Agent version loaded:`, {
        versionId: version.id,
        versionName: version.name,
        agentId: version.agentId,
        isActive: version.isActive,
        createdAt: version.createdAt,
        nodes: definition.nodes?.map(n => ({
          id: n.id,
          type: n.type,
          systemPrompt: n.data?.config?.systemPrompt?.substring(0, 50) + '...'
        }))
      });

      const validation = WorkflowConverter.validateDefinition(definition);

      if (!validation.valid) {
        throw new Error(
          `Invalid agent definition: ${validation.errors.join(', ')}`
        );
      }

      // Convert to executable workflow
      const agent = await this.getExecutableAgent(
        version.id,
        version.name || 'Unnamed Agent',
        definition,
        version.description || undefined
      );

      // Execute agent with step tracking
      console.log(`Executing agent: ${version.name}`, {
        agentExecutionId,
        input: input.input,
      });

      const result = await this.executeAgentSteps(
        agentExecutionId,
        agent,
        input.input || {}
      );

      output = result;
      status = 'completed';

      console.log(`Agent completed: ${version.name}`, {
        agentExecutionId,
        output,
      });
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);

      console.error('Agent execution failed:', {
        agentExecutionId,
        error,
      });
    } finally {
      const duration = Date.now() - startTime;

      // Update agent execution record
      if (agentExecutionId) {
        await db
          .update(agentExecutions)
          .set({
            status,
            output,
            error,
            completedAt: new Date(),
            duration,
          })
          .where(eq(agentExecutions.id, agentExecutionId));
      }
    }

    return {
      agentExecutionId: agentExecutionId!,
      status,
      output,
      error,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute agent steps with step-level tracking
   */
  private static async executeAgentSteps(
    agentExecutionId: string,
    agent: ExecutableWorkflow,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    const context: Record<string, any> = { input };
    const results: Record<string, any> = {};

    // Start from trigger node
    const nextNodes = agent.adjacencyList.get(agent.triggerNodeId) || [];

    // Execute nodes in order (simplified BFS)
    const queue = [...nextNodes];
    const visited = new Set<string>();
    let stepIndex = 0; // Track execution order

    while (queue.length > 0) {
      const nodeId = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      const node = agent.nodeMap.get(nodeId);
      if (!node) {
        continue;
      }

      // Track step execution
      const stepStartTime = Date.now();
      let stepStatus: ExecutionStatus = 'running';
      let stepOutput: any;
      let stepError: string | undefined;

      try {
        // Execute node
        stepOutput = await this.executeNode(node, context);
        results[nodeId] = stepOutput;
        context[nodeId] = stepOutput;
        stepStatus = 'completed';
      } catch (err) {
        stepStatus = 'failed';
        stepError = err instanceof Error ? err.message : String(err);
        console.error(`Step execution failed: ${nodeId}`, stepError);
      } finally {
        const stepDuration = Date.now() - stepStartTime;

        // Save step execution
        await db.insert(agentExecutionSteps).values({
          agentExecutionId,
          stepIndex, // Add step index for ordering
          nodeId,
          nodeType: node.type,
          nodeLabel: node.data.label,
          status: stepStatus,
          input: context,
          output: stepOutput,
          error: stepError,
          startedAt: new Date(stepStartTime),
          completedAt: new Date(),
          duration: stepDuration,
        });

        stepIndex++; // Increment for next step

        // If step failed, stop execution
        if (stepStatus === 'failed') {
          throw new Error(`Step ${node.data.label} failed: ${stepError}`);
        }
      }

      // Add next nodes to queue
      const nextNodeIds = agent.adjacencyList.get(nodeId) || [];
      queue.push(...nextNodeIds);
    }

    return {
      results,
      finalContext: context,
    };
  }

  /**
   * Execute a single agent node
   * (Reused from WorkflowEngine)
   */
  private static async executeNode(
    node: AgentNode,
    context: Record<string, any>
  ): Promise<any> {
    const { type, data } = node;

    console.log(`Executing node: ${node.id} (${type})`, data);

    switch (type) {
      case 'trigger':
        return { triggered: true, input: context.input };

      case 'agent/LLM':
      case 'agent':
        // Execute LLM Agent (note: "agent" here means LLM call)
        try {
          const agentConfig = data.config || {};
          // Support both llmProviderId (new) and providerId (legacy)
          const providerId = agentConfig.llmProviderId || agentConfig.providerId;
          const { prompt, systemPrompt, temperature, maxTokens } = agentConfig;

          if (!providerId) {
            throw new Error('Agent node requires an llmProviderId in config');
          }

          // Build messages
          const messages: any[] = [];

          if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
          }

          // Use prompt template with context substitution
          // If no prompt template, use input directly
          let userMessage: string;
          if (prompt && prompt.trim()) {
            userMessage = this.processPromptTemplate(prompt, context);
          } else {
            // Default: use input as-is (string) or as JSON
            userMessage = typeof context.input === 'string'
              ? context.input
              : JSON.stringify(context.input);
          }
          messages.push({ role: 'user', content: userMessage });

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
          throw error; // Let the caller handle the error
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

          if (!result.success) {
            throw new Error(result.error || 'Tool execution failed');
          }

          return {
            type: 'tool',
            label: data.label,
            success: result.success,
            result: result.output,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw error;
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
          throw error;
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
        throw new Error(`Unknown node type: ${type}`);
    }
  }

  /**
   * Get or create executable agent from definition
   */
  private static async getExecutableAgent(
    versionId: string,
    name: string,
    definition: AgentDefinition,
    description?: string
  ): Promise<ExecutableWorkflow> {
    // Check cache
    if (this.agentCache.has(versionId)) {
      return this.agentCache.get(versionId)!;
    }

    // Convert to executable workflow
    const agent = await WorkflowConverter.convertToExecutableWorkflow(
      definition,
      name,
      description
    );

    // Cache agent
    this.agentCache.set(versionId, agent);

    return agent;
  }

  /**
   * Get agent version from database
   */
  private static async getAgentVersion(versionId: string) {
    const [version] = await db
      .select()
      .from(agentVersions)
      .where(eq(agentVersions.id, versionId))
      .limit(1);

    return version;
  }

  /**
   * Get agent execution by ID
   */
  static async getExecution(executionId: string) {
    const [execution] = await db
      .select()
      .from(agentExecutions)
      .where(eq(agentExecutions.id, executionId))
      .limit(1);

    return execution;
  }

  /**
   * Get all steps for an agent execution
   */
  static async getExecutionSteps(executionId: string) {
    return await db
      .select()
      .from(agentExecutionSteps)
      .where(eq(agentExecutionSteps.agentExecutionId, executionId))
      .orderBy(agentExecutionSteps.startedAt);
  }

  /**
   * Clear agent cache
   */
  static clearCache(versionId?: string) {
    if (versionId) {
      this.agentCache.delete(versionId);
    } else {
      this.agentCache.clear();
    }
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
