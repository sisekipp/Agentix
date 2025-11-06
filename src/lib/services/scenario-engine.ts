import { db } from '../db';
import {
  scenarioVersions,
  scenarioExecutions,
  agentExecutions,
  agentVersions,
  agents,
} from '../db/schema/agents';
import { eq, desc } from 'drizzle-orm';
import { AgentEngine } from './agent-engine';
import type {
  ScenarioDefinition,
  ScenarioNode,
  ScenarioExecutionInput,
  ScenarioExecutionResult,
  ExecutionStatus,
  ScenarioAgentConfig,
  ScenarioDecisionConfig,
  ScenarioParallelConfig,
  ScenarioTransformConfig,
  AgentExecutionSummary,
} from '../types/agent';

/**
 * Scenario Engine
 * Orchestrates multiple agents based on scenario definition
 * Handles different trigger types (chat, api, webhook, schedule)
 */
export class ScenarioEngine {
  /**
   * Execute a scenario
   */
  static async executeScenario(
    input: ScenarioExecutionInput
  ): Promise<ScenarioExecutionResult> {
    const startTime = Date.now();
    let scenarioExecutionId: string | undefined;
    let status: ExecutionStatus = 'running';
    let output: Record<string, any> | undefined;
    let error: string | undefined;
    const agentExecutionSummaries: AgentExecutionSummary[] = [];

    try {
      // Get active scenario version
      const version = await this.getActiveScenarioVersion(input.scenarioId);

      if (!version) {
        throw new Error(
          `No active scenario version found for: ${input.scenarioId}`
        );
      }

      // Debug: Log what was loaded from database
      const loadedDef = version.orchestrationDefinition as any;
      console.log('Loaded scenario version from database:', {
        versionId: version.id,
        versionName: version.name,
        loadedNodeCount: loadedDef?.nodes?.length || 0,
        loadedEdgeCount: loadedDef?.edges?.length || 0,
        loadedNodes: loadedDef?.nodes?.map((n: any) => ({ id: n.id, type: n.type })) || [],
      });

      // Create scenario execution record
      const [execution] = await db
        .insert(scenarioExecutions)
        .values({
          scenarioVersionId: version.id,
          conversationId: input.conversationId,
          status: 'running',
          input: input.input || {},
          triggeredById: input.triggeredById,
          startedAt: new Date(),
        })
        .returning();

      scenarioExecutionId = execution.id;

      // Validate scenario definition
      const definition = version.orchestrationDefinition as ScenarioDefinition;

      if (!definition.nodes || !definition.edges) {
        throw new Error('Invalid scenario definition: missing nodes or edges');
      }

      // Execute scenario orchestration
      console.log(`Executing scenario: ${version.name}`, {
        scenarioExecutionId,
        input: input.input,
      });

      const result = await this.executeScenarioSteps(
        scenarioExecutionId,
        definition,
        input.input || {}
      );

      output = result.output;
      agentExecutionSummaries.push(...result.agentExecutions);
      status = 'completed';

      console.log(`Scenario completed: ${version.name}`, {
        scenarioExecutionId,
        output,
      });
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);

      console.error('Scenario execution failed:', {
        scenarioExecutionId,
        error,
      });
    } finally {
      const duration = Date.now() - startTime;

      // Update scenario execution record
      if (scenarioExecutionId) {
        await db
          .update(scenarioExecutions)
          .set({
            status,
            output,
            error,
            completedAt: new Date(),
            duration,
          })
          .where(eq(scenarioExecutions.id, scenarioExecutionId));
      }
    }

    return {
      executionId: scenarioExecutionId!,
      status,
      output,
      error,
      duration: Date.now() - startTime,
      agentExecutions: agentExecutionSummaries,
    };
  }

  /**
   * Execute scenario orchestration steps
   */
  private static async executeScenarioSteps(
    scenarioExecutionId: string,
    definition: ScenarioDefinition,
    input: Record<string, any>
  ): Promise<{ output: Record<string, any>; agentExecutions: AgentExecutionSummary[] }> {
    const context: Record<string, any> = { input };
    const results: Record<string, any> = {};
    const agentExecutionSummaries: AgentExecutionSummary[] = [];

    // Build adjacency list from edges
    const adjacencyList = new Map<string, string[]>();
    for (const edge of definition.edges) {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, []);
      }
      adjacencyList.get(edge.source)!.push(edge.target);
    }

    // Build node map
    const nodeMap = new Map<string, ScenarioNode>();
    for (const node of definition.nodes) {
      nodeMap.set(node.id, node);
    }

    // Debug: Log definition structure
    console.log('Scenario definition:', {
      nodeCount: definition.nodes.length,
      edgeCount: definition.edges.length,
      nodes: definition.nodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label })),
      edges: definition.edges.map(e => ({ source: e.source, target: e.target })),
    });

    // Find trigger node
    const triggerNode = definition.nodes.find(
      (n) => n.type === 'scenario-trigger'
    );

    if (!triggerNode) {
      console.error('No trigger node found! Available nodes:', definition.nodes);
      throw new Error('Scenario must have a trigger node');
    }

    // Start from trigger node
    const nextNodes = adjacencyList.get(triggerNode.id) || [];

    // Execute nodes in order (simplified BFS)
    const queue = [...nextNodes];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) {
        continue;
      }

      // Execute node
      const result = await this.executeScenarioNode(
        scenarioExecutionId,
        node,
        context,
        definition.edges
      );

      results[nodeId] = result;
      context[nodeId] = result;

      // Track agent executions
      if (node.type === 'scenario-agent' && result.agentExecution) {
        agentExecutionSummaries.push(result.agentExecution);
      }

      // Handle decision nodes - determine which branch to take
      if (node.type === 'scenario-decision' && result.selectedBranch !== undefined) {
        const branchEdges = definition.edges.filter(
          (e) => e.source === nodeId && e.data?.branchIndex === result.selectedBranch
        );
        const branchTargets = branchEdges.map((e) => e.target);
        queue.push(...branchTargets);
      } else {
        // Add next nodes to queue
        const nextNodeIds = adjacencyList.get(nodeId) || [];
        queue.push(...nextNodeIds);
      }
    }

    return {
      output: {
        results,
        finalContext: context,
      },
      agentExecutions: agentExecutionSummaries,
    };
  }

  /**
   * Execute a single scenario node
   */
  private static async executeScenarioNode(
    scenarioExecutionId: string,
    node: ScenarioNode,
    context: Record<string, any>,
    edges: any[]
  ): Promise<any> {
    const { type, data } = node;

    console.log(`Executing scenario node: ${node.id} (${type})`, data);

    switch (type) {
      case 'scenario-trigger':
        // Trigger node just passes through the input
        return {
          type: 'scenario-trigger',
          label: data.label,
          triggered: true,
          input: context.input,
          timestamp: new Date().toISOString(),
        };

      case 'scenario-agent':
        // Execute an agent
        try {
          const config = data.config as ScenarioAgentConfig;

          if (!config.agentId) {
            throw new Error('scenario-agent node requires agentId in config');
          }

          // Get active agent version
          const agentVersion = await this.getActiveAgentVersion(config.agentId);

          if (!agentVersion) {
            throw new Error(`No active agent version found for: ${config.agentId}`);
          }

          // Process input with context substitution
          const processedInput = this.processTemplateObject(config.input || {}, context);

          // Execute agent
          const agentResult = await AgentEngine.executeAgent({
            scenarioExecutionId,
            agentVersionId: agentVersion.id,
            scenarioNodeId: node.id,
            input: processedInput,
          });

          // Create summary
          const agentSummary: AgentExecutionSummary = {
            agentExecutionId: agentResult.agentExecutionId,
            agentId: config.agentId,
            agentName: config.agentName,
            status: agentResult.status,
            duration: agentResult.duration,
            error: agentResult.error,
          };

          return {
            type: 'scenario-agent',
            label: data.label,
            agentId: config.agentId,
            agentName: config.agentName,
            output: agentResult.output,
            agentExecution: agentSummary,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw error;
        }

      case 'scenario-decision':
        // Evaluate conditions and choose branch
        try {
          const config = data.config as ScenarioDecisionConfig;

          if (!config.branches || config.branches.length === 0) {
            throw new Error('scenario-decision node requires branches in config');
          }

          // Evaluate each branch condition
          let selectedBranch = 0; // Default to first branch

          for (let i = 0; i < config.branches.length; i++) {
            const branch = config.branches[i];

            if (branch.condition === 'default') {
              // Default branch - always matches if reached
              selectedBranch = i;
              break;
            }

            // Evaluate condition
            const conditionMet = this.evaluateCondition(branch.condition, context);

            if (conditionMet) {
              selectedBranch = i;
              break;
            }
          }

          return {
            type: 'scenario-decision',
            label: data.label,
            selectedBranch,
            selectedLabel: config.branches[selectedBranch]?.label,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw error;
        }

      case 'scenario-parallel':
        // Execute multiple agents in parallel
        try {
          const config = data.config as ScenarioParallelConfig;

          if (!config.agents || config.agents.length === 0) {
            throw new Error('scenario-parallel node requires agents in config');
          }

          // Execute all agents in parallel
          const agentPromises = config.agents.map(async (agentConfig) => {
            const agentVersion = await this.getActiveAgentVersion(agentConfig.agentId);

            if (!agentVersion) {
              throw new Error(`No active agent version found for: ${agentConfig.agentId}`);
            }

            const processedInput = this.processTemplateObject(agentConfig.input || {}, context);

            return AgentEngine.executeAgent({
              scenarioExecutionId,
              agentVersionId: agentVersion.id,
              scenarioNodeId: node.id,
              input: processedInput,
            });
          });

          const agentResults = await Promise.all(agentPromises);

          // Create summaries
          const agentSummaries: AgentExecutionSummary[] = agentResults.map((result, i) => ({
            agentExecutionId: result.agentExecutionId,
            agentId: config.agents[i].agentId,
            agentName: config.agents[i].agentName,
            status: result.status,
            duration: result.duration,
            error: result.error,
          }));

          return {
            type: 'scenario-parallel',
            label: data.label,
            results: agentResults.map((r) => r.output),
            agentExecutions: agentSummaries,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw error;
        }

      case 'scenario-transform':
        // Transform data
        try {
          const config = data.config as ScenarioTransformConfig;

          // Simple transformation implementation
          let transformed = context;

          if (config.transformType === 'select') {
            // Select specific fields
            const fields = config.transformConfig.fields || [];
            transformed = {};
            for (const field of fields) {
              const value = this.getNestedValue(context, field);
              if (value !== undefined) {
                transformed[field] = value;
              }
            }
          } else if (config.transformType === 'map') {
            // Remap fields
            const mapping = config.transformConfig.mapping || {};
            transformed = {};
            for (const [fromKey, toKey] of Object.entries(mapping)) {
              const value = this.getNestedValue(context, fromKey);
              if (value !== undefined) {
                transformed[toKey as string] = value;
              }
            }
          }
          // Add more transform types as needed

          return {
            type: 'scenario-transform',
            label: data.label,
            result: transformed,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw error;
        }

      case 'scenario-end':
        // End node - finalize output
        const config = data.config as any;
        const finalOutput = this.processTemplateObject(config.output || {}, context);

        return {
          type: 'scenario-end',
          label: data.label,
          output: finalOutput,
          timestamp: new Date().toISOString(),
        };

      default:
        throw new Error(`Unknown scenario node type: ${type}`);
    }
  }

  /**
   * Get active scenario version
   */
  private static async getActiveScenarioVersion(scenarioId: string) {
    // Debug: Check how many active versions exist
    const allActiveVersions = await db
      .select()
      .from(scenarioVersions)
      .where(eq(scenarioVersions.scenarioId, scenarioId))
      .where(eq(scenarioVersions.isActive, true));

    console.log('getActiveScenarioVersion query:', {
      scenarioId,
      totalActiveVersions: allActiveVersions.length,
      versionIds: allActiveVersions.map(v => ({ id: v.id, name: v.name, createdAt: v.createdAt })),
    });

    // CRITICAL FIX: Get the NEWEST active version with ORDER BY createdAt DESC
    // Without this, PostgreSQL returns versions in arbitrary order (usually oldest first)
    const [version] = await db
      .select()
      .from(scenarioVersions)
      .where(eq(scenarioVersions.scenarioId, scenarioId))
      .where(eq(scenarioVersions.isActive, true))
      .orderBy(desc(scenarioVersions.createdAt))
      .limit(1);

    console.log('Selected version for execution:', {
      versionId: version?.id,
      versionName: version?.name,
      createdAt: version?.createdAt,
    });

    return version;
  }

  /**
   * Get active agent version
   */
  private static async getActiveAgentVersion(agentId: string) {
    const [version] = await db
      .select()
      .from(agentVersions)
      .where(eq(agentVersions.agentId, agentId))
      .where(eq(agentVersions.isActive, true))
      .limit(1);

    return version;
  }

  /**
   * Get scenario execution by ID
   */
  static async getExecution(executionId: string) {
    const [execution] = await db
      .select()
      .from(scenarioExecutions)
      .where(eq(scenarioExecutions.id, executionId))
      .limit(1);

    return execution;
  }

  /**
   * Get all agent executions for a scenario execution
   */
  static async getAgentExecutions(scenarioExecutionId: string) {
    return await db
      .select()
      .from(agentExecutions)
      .where(eq(agentExecutions.scenarioExecutionId, scenarioExecutionId))
      .orderBy(agentExecutions.startedAt);
  }

  /**
   * Process template object with context substitution
   */
  private static processTemplateObject(
    obj: any,
    context: Record<string, any>
  ): any {
    if (typeof obj === 'string') {
      return this.processTemplate(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.processTemplateObject(item, context));
    }

    if (typeof obj === 'object' && obj !== null) {
      const processed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = this.processTemplateObject(value, context);
      }
      return processed;
    }

    return obj;
  }

  /**
   * Process template string with context substitution
   */
  private static processTemplate(
    template: string,
    context: Record<string, any>
  ): string {
    let processed = template;

    // Replace {{variable}} with context values
    const regex = /\{\{([^}]+)\}\}/g;
    processed = processed.replace(regex, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedValue(context, trimmedKey);

      if (value !== undefined) {
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      }

      return match;
    });

    return processed;
  }

  /**
   * Evaluate a condition expression
   * Simple implementation - can be extended
   */
  private static evaluateCondition(
    condition: string,
    context: Record<string, any>
  ): boolean {
    try {
      // Replace template variables
      let processed = condition;

      const regex = /\{\{([^}]+)\}\}/g;
      processed = processed.replace(regex, (match, key) => {
        const trimmedKey = key.trim();
        const value = this.getNestedValue(context, trimmedKey);

        if (value !== undefined) {
          return typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
        }

        return 'undefined';
      });

      // Evaluate the condition (simple eval - in production use a safe parser)
      // For now, support basic comparisons
      // Example: "billing" == "billing"
      const match = processed.match(/^"?([^"]*)"?\s*(==|!=|>|<|>=|<=)\s*"?([^"]*)"?$/);

      if (match) {
        const [, left, operator, right] = match;

        switch (operator) {
          case '==':
            return left === right;
          case '!=':
            return left !== right;
          case '>':
            return parseFloat(left) > parseFloat(right);
          case '<':
            return parseFloat(left) < parseFloat(right);
          case '>=':
            return parseFloat(left) >= parseFloat(right);
          case '<=':
            return parseFloat(left) <= parseFloat(right);
          default:
            return false;
        }
      }

      return false;
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
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
