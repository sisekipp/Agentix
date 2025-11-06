"use server";

import { db } from "@/lib/db";
import {
  agents,
  agentVersions,
  scenarios,
  scenarioVersions,
  scenarioExecutions,
  agentExecutions,
  agentExecutionSteps,
  conversations,
  conversationMessages,
  teamMembers,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-server";
import { eq, and, desc, ne } from "drizzle-orm";
import { AgentEngine } from "@/lib/services/agent-engine";
import { ScenarioEngine } from "@/lib/services/scenario-engine";
import type {
  AgentDefinition,
  ScenarioDefinition,
  AgentMetadata,
} from "@/lib/types/agent";

// ============================================
// AGENT ACTIONS
// ============================================

export async function createAgent(formData: FormData) {
  const session = await requireAuth();
  const user = session.user;

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const teamId = formData.get("teamId") as string;
  const icon = formData.get("icon") as string | null;
  const color = formData.get("color") as string | null;

  if (!name || !teamId) {
    return { error: "Name and team are required" };
  }

  try {
    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied - you are not a member of this team" };
    }

    // Use transaction to ensure agent and version are created atomically
    const result = await db.transaction(async (tx) => {
      // Create agent
      const [agent] = await tx
        .insert(agents)
        .values({
          teamId,
          name,
          description: description || null,
          workflowDefinition: { nodes: [], edges: [] }, // Empty agent definition
          icon: icon || "🤖",
          color: color || "#3b82f6",
          createdById: user.id,
        })
        .returning();

      // Create initial version
      await tx.insert(agentVersions).values({
        agentId: agent.id,
        version: 1,
        name: "Initial version",
        description: "Initial agent version",
        workflowDefinition: { nodes: [], edges: [] },
        isActive: true,
        createdById: user.id,
      });

      return agent;
    });

    return { success: true, agent: result };
  } catch (error) {
    console.error("Failed to create agent:", error);
    return { error: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function getAgentsByTeam(teamId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied", agents: [] };
    }

    const agentList = await db.query.agents.findMany({
      where: eq(agents.teamId, teamId),
      orderBy: [desc(agents.createdAt)],
      with: {
        createdBy: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { agents: agentList };
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return { error: "Failed to fetch agents", agents: [] };
  }
}

export async function getAgentById(agentId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get agent and verify access
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: {
        team: true,
        versions: {
          where: eq(agentVersions.isActive, true),
          limit: 1,
        },
      },
    });

    if (!agent) {
      return { error: "Agent not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, agent.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    return { agent };
  } catch (error) {
    console.error("Failed to fetch agent:", error);
    return { error: "Failed to fetch agent" };
  }
}

export async function updateAgent(formData: FormData) {
  const agentId = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const systemPrompt = formData.get("systemPrompt") as string | null;
  const workflowDefinitionStr = formData.get("workflowDefinition") as string;

  if (!agentId) {
    return { error: "Agent ID is required" };
  }

  const workflowDefinition = workflowDefinitionStr ? JSON.parse(workflowDefinitionStr) : undefined;

  const metadata: Partial<AgentMetadata> = {};
  if (name) metadata.name = name;
  if (description !== undefined) metadata.description = description;
  if (systemPrompt !== undefined) metadata.systemPrompt = systemPrompt;

  return updateAgentDefinition(agentId, workflowDefinition, metadata);
}

export async function updateAgentDefinition(
  agentId: string,
  definition: AgentDefinition,
  metadata?: Partial<AgentMetadata>
) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get agent and verify access
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: {
        team: true,
        versions: {
          where: eq(agentVersions.isActive, true),
          limit: 1,
        },
      },
    });

    if (!agent) {
      return { error: "Agent not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, agent.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Get active version
    let activeVersion = agent.versions[0];
    if (!activeVersion) {
      // DATA INTEGRITY ISSUE: Agent exists without active version
      // This should not happen with proper transaction handling in createAgent
      console.error(`DATA INTEGRITY ERROR: Agent ${agentId} (${agent.name}) has no active version!`);
      console.error('This indicates a database inconsistency. Creating repair version...');

      // Create a repair version to fix the inconsistency
      // This is a recovery mechanism, not normal operation
      const [newVersion] = await db.insert(agentVersions).values({
        agentId: agent.id,
        version: 1,
        name: "Recovery version",
        description: "Auto-created to repair data inconsistency",
        workflowDefinition: definition || { nodes: [], edges: [] },
        isActive: true,
        createdById: user.id,
      }).returning();

      activeVersion = newVersion;
      console.log(`✓ Created recovery version ${activeVersion.id} for agent ${agentId}`);

      // TODO: Investigate why this agent had no version and fix root cause
    }

    // Update agent definition in version
    const [updatedVersion] = await db
      .update(agentVersions)
      .set({
        workflowDefinition: definition,
      })
      .where(eq(agentVersions.id, activeVersion.id))
      .returning();

    // Update agent metadata if provided
    if (metadata) {
      await db
        .update(agents)
        .set({
          ...metadata,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));
    }

    // Clear agent cache
    AgentEngine.clearCache(activeVersion.id);

    return { success: true, version: updatedVersion };
  } catch (error) {
    console.error("Failed to update agent definition:", error);
    return { error: "Failed to update agent definition" };
  }
}

export async function deleteAgent(agentId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get agent to verify access
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: {
        team: true,
      },
    });

    if (!agent) {
      return { error: "Agent not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, agent.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Delete agent (cascade will handle versions and executions)
    await db.delete(agents).where(eq(agents.id, agentId));

    return { success: true };
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return { error: "Failed to delete agent" };
  }
}

export async function getAgentVersion(agentId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get agent and verify access
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: {
        team: true,
        versions: {
          where: eq(agentVersions.isActive, true),
          limit: 1,
        },
      },
    });

    if (!agent) {
      return { error: "Agent not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, agent.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    const activeVersion = agent.versions[0];
    if (!activeVersion) {
      return { error: "No active agent version found" };
    }

    return { version: activeVersion };
  } catch (error) {
    console.error("Failed to fetch agent version:", error);
    return { error: "Failed to fetch agent version" };
  }
}

// ============================================
// SCENARIO ACTIONS
// ============================================

export async function createScenario(formData: FormData) {
  const session = await requireAuth();
  const user = session.user;

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const teamId = formData.get("teamId") as string;
  const triggerType = formData.get("triggerType") as string;

  if (!name || !teamId || !triggerType) {
    return { error: "Name, team, and trigger type are required" };
  }

  // Validate trigger type
  if (!['chat', 'api', 'webhook', 'schedule'].includes(triggerType)) {
    return { error: "Invalid trigger type" };
  }

  try {
    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied - you are not a member of this team" };
    }

    // Create initial orchestration with trigger node
    const initialOrchestration = {
      nodes: [
        {
          id: 'trigger-node',
          type: 'scenario-trigger',
          position: { x: 250, y: 100 },
          data: {
            label: 'Trigger',
            config: {
              triggerType,
            },
          },
        },
      ],
      edges: [],
    };

    // Use transaction to ensure scenario and version are created atomically
    const result = await db.transaction(async (tx) => {
      // Create scenario
      const [scenario] = await tx
        .insert(scenarios)
        .values({
          teamId,
          name,
          description: description || null,
          orchestrationDefinition: initialOrchestration,
          triggerType,
          triggerConfig: {},
          isActive: true,
          createdById: user.id,
        })
        .returning();

      // Create initial version
      await tx.insert(scenarioVersions).values({
        scenarioId: scenario.id,
        version: 1,
        name: "Initial version",
        description: "Initial scenario version",
        orchestrationDefinition: initialOrchestration,
        isActive: true,
        createdById: user.id,
      });

      return scenario;
    });

    return { success: true, scenario: result };
  } catch (error) {
    console.error("Failed to create scenario:", error);
    return { error: `Failed to create scenario: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function getScenariosByTeam(teamId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied", scenarios: [] };
    }

    const scenarioList = await db.query.scenarios.findMany({
      where: eq(scenarios.teamId, teamId),
      orderBy: [desc(scenarios.createdAt)],
      with: {
        createdBy: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { scenarios: scenarioList };
  } catch (error) {
    console.error("Failed to fetch scenarios:", error);
    return { error: "Failed to fetch scenarios", scenarios: [] };
  }
}

export async function getScenarioById(scenarioId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get scenario and verify access
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, scenarioId),
      with: {
        team: true,
        versions: {
          where: eq(scenarioVersions.isActive, true),
          limit: 1,
        },
      },
    });

    if (!scenario) {
      return { error: "Scenario not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    return { scenario };
  } catch (error) {
    console.error("Failed to fetch scenario:", error);
    return { error: "Failed to fetch scenario" };
  }
}

export async function updateScenarioDefinition(
  scenarioId: string,
  definition: ScenarioDefinition
) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get scenario and verify access
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, scenarioId),
      with: {
        team: true,
        versions: {
          where: eq(scenarioVersions.isActive, true),
          limit: 1,
        },
      },
    });

    if (!scenario) {
      return { error: "Scenario not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Get active version
    const activeVersion = scenario.versions[0];
    if (!activeVersion) {
      return { error: "No active scenario version found" };
    }

    // Debug: Log what we're trying to save
    console.log('updateScenarioDefinition called:', {
      scenarioId,
      activeVersionId: activeVersion.id,
      activeVersionName: activeVersion.name,
      totalActiveVersions: scenario.versions.length,
      nodeCount: definition?.nodes?.length || 0,
      edgeCount: definition?.edges?.length || 0,
      nodes: definition?.nodes?.map(n => ({ id: n.id, type: n.type })) || [],
    });

    // Validate definition - prevent saving empty scenarios
    if (!definition || !definition.nodes || definition.nodes.length === 0) {
      console.warn('Attempted to save scenario with no nodes, rejecting update');
      return { error: "Cannot save scenario with no nodes. Please add at least a trigger node." };
    }

    // DATA INTEGRITY FIX: Deactivate all other versions for this scenario
    // This ensures only ONE version is active at a time
    console.log('Deactivating other versions for scenario...');
    await db
      .update(scenarioVersions)
      .set({ isActive: false })
      .where(
        and(
          eq(scenarioVersions.scenarioId, scenarioId),
          ne(scenarioVersions.id, activeVersion.id)
        )
      );

    // Update scenario definition
    console.log('Saving scenario definition to database...');
    const [updatedVersion] = await db
      .update(scenarioVersions)
      .set({
        orchestrationDefinition: definition,
      })
      .where(eq(scenarioVersions.id, activeVersion.id))
      .returning();

    console.log('Database update result:', {
      versionId: updatedVersion.id,
      savedNodeCount: (updatedVersion.orchestrationDefinition as any)?.nodes?.length || 0,
      savedEdgeCount: (updatedVersion.orchestrationDefinition as any)?.edges?.length || 0,
    });

    return { success: true, version: updatedVersion };
  } catch (error) {
    console.error("Failed to update scenario definition:", error);
    return { error: "Failed to update scenario definition" };
  }
}

export async function deleteScenario(scenarioId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get scenario to verify access
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, scenarioId),
      with: {
        team: true,
      },
    });

    if (!scenario) {
      return { error: "Scenario not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Delete scenario (cascade will handle versions, executions, conversations)
    await db.delete(scenarios).where(eq(scenarios.id, scenarioId));

    return { success: true };
  } catch (error) {
    console.error("Failed to delete scenario:", error);
    return { error: "Failed to delete scenario" };
  }
}

export async function getScenarioVersion(scenarioId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get scenario and verify access
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, scenarioId),
      with: {
        team: true,
        versions: {
          where: eq(scenarioVersions.isActive, true),
          limit: 1,
        },
      },
    });

    if (!scenario) {
      return { error: "Scenario not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    const activeVersion = scenario.versions[0];
    if (!activeVersion) {
      return { error: "No active scenario version found" };
    }

    return { version: activeVersion };
  } catch (error) {
    console.error("Failed to fetch scenario version:", error);
    return { error: "Failed to fetch scenario version" };
  }
}

// ============================================
// EXECUTION ACTIONS
// ============================================

export async function executeScenario(scenarioId: string, input?: Record<string, any>) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get scenario and verify access
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, scenarioId),
      with: {
        team: true,
      },
    });

    if (!scenario) {
      return { error: "Scenario not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Execute scenario
    const result = await ScenarioEngine.executeScenario({
      scenarioId: scenario.id,
      input: input || {},
      triggeredById: user.id,
    });

    return { success: true, execution: result };
  } catch (error) {
    console.error("Failed to execute scenario:", error);
    return { error: "Failed to execute scenario" };
  }
}

export async function getScenarioExecutions(scenarioId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get scenario and verify access
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, scenarioId),
      with: {
        team: true,
        versions: true,
      },
    });

    if (!scenario) {
      return { error: "Scenario not found", executions: [] };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied", executions: [] };
    }

    // Get all executions for active version
    const activeVersion = scenario.versions.find((v) => v.isActive);
    if (!activeVersion) {
      return { executions: [] };
    }

    const executionList = await db.query.scenarioExecutions.findMany({
      where: eq(scenarioExecutions.scenarioVersionId, activeVersion.id),
      orderBy: [desc(scenarioExecutions.startedAt)],
    });

    return { executions: executionList };
  } catch (error) {
    console.error("Failed to fetch scenario executions:", error);
    return { error: "Failed to fetch scenario executions", executions: [] };
  }
}

export async function getScenarioExecutionDetails(executionId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get execution
    const execution = await ScenarioEngine.getExecution(executionId);
    if (!execution) {
      return { error: "Execution not found" };
    }

    // Get scenario version and scenario to verify access
    const version = await db.query.scenarioVersions.findFirst({
      where: eq(scenarioVersions.id, execution.scenarioVersionId),
      with: {
        scenario: {
          with: {
            team: true,
          },
        },
      },
    });

    if (!version) {
      return { error: "Scenario version not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, version.scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Get all agent executions for this scenario execution
    const agentExecutionList = await ScenarioEngine.getAgentExecutions(executionId);

    // Get steps for each agent execution
    const agentExecutionsWithSteps = await Promise.all(
      agentExecutionList.map(async (agentExec) => {
        const steps = await AgentEngine.getExecutionSteps(agentExec.id);
        return {
          ...agentExec,
          steps,
        };
      })
    );

    return {
      execution,
      agentExecutions: agentExecutionsWithSteps,
    };
  } catch (error) {
    console.error("Failed to fetch execution details:", error);
    return { error: "Failed to fetch execution details" };
  }
}

// ============================================
// CONVERSATION ACTIONS (for Chat Trigger)
// ============================================

export async function startConversation(scenarioId: string, initialMessage?: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get scenario and verify access
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, scenarioId),
      with: {
        team: true,
      },
    });

    if (!scenario) {
      return { error: "Scenario not found" };
    }

    // Verify it's a chat trigger
    if (scenario.triggerType !== 'chat') {
      return { error: "Scenario is not configured for chat" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Create conversation
    const [conversation] = await db
      .insert(conversations)
      .values({
        scenarioId: scenario.id,
        userId: user.id,
        status: 'active',
        title: initialMessage ? initialMessage.substring(0, 100) : 'New Conversation',
        startedAt: new Date(),
        lastMessageAt: new Date(),
      })
      .returning();

    // Add initial user message if provided
    if (initialMessage) {
      await db.insert(conversationMessages).values({
        conversationId: conversation.id,
        role: 'user',
        content: initialMessage,
        createdAt: new Date(),
      });
    }

    return { success: true, conversation };
  } catch (error) {
    console.error("Failed to start conversation:", error);
    return { error: "Failed to start conversation" };
  }
}

export async function sendMessage(conversationId: string, message: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get conversation and verify access
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        scenario: {
          with: {
            team: true,
          },
        },
      },
    });

    if (!conversation) {
      return { error: "Conversation not found" };
    }

    // Verify user owns this conversation
    if (conversation.userId !== user.id) {
      return { error: "Access denied" };
    }

    // Add user message
    const [userMsg] = await db.insert(conversationMessages).values({
      conversationId: conversation.id,
      role: 'user',
      content: message,
      createdAt: new Date(),
    }).returning();

    // Execute scenario with conversation context
    const result = await ScenarioEngine.executeScenario({
      scenarioId: conversation.scenarioId,
      input: { message },
      conversationId: conversation.id,
      triggeredById: user.id,
    });

    // Add assistant response
    let assistantContent: string;

    if (result.error) {
      // If execution failed, store error message
      assistantContent = `Sorry, I encountered an error: ${result.error}`;
    } else if (result.output?.results) {
      // Extract LLM responses from nested scenario/agent structure
      const llmResponses: string[] = [];

      // Iterate through scenario nodes
      for (const [nodeId, nodeResult] of Object.entries(result.output.results)) {
        // Check if this is a scenario-agent node with agent output
        if ((nodeResult as any)?.output?.results) {
          const agentResults = (nodeResult as any).output.results;

          // Iterate through agent nodes (LLM nodes)
          for (const [agentNodeId, agentNodeResult] of Object.entries(agentResults)) {
            if ((agentNodeResult as any)?.result) {
              llmResponses.push((agentNodeResult as any).result);
            }
          }
        }
      }

      // Use collected LLM responses, or fallback to JSON
      assistantContent = llmResponses.length > 0
        ? llmResponses.join('\n\n')
        : JSON.stringify(result.output.results);
    } else {
      // Fallback: no output available
      assistantContent = "Execution completed but no output was generated.";
    }

    const [assistantMsg] = await db.insert(conversationMessages).values({
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
      scenarioExecutionId: result.executionId,
      createdAt: new Date(),
    }).returning();

    // Update conversation last message time
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return {
      success: true,
      execution: result,
      messages: [userMsg, assistantMsg]  // Return new messages for instant UI update
    };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { error: "Failed to send message" };
  }
}

export async function getConversationMessages(conversationId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get conversation and verify access
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      return { error: "Conversation not found", messages: [] };
    }

    // Verify user owns this conversation
    if (conversation.userId !== user.id) {
      return { error: "Access denied", messages: [] };
    }

    // Get all messages
    const messageList = await db.query.conversationMessages.findMany({
      where: eq(conversationMessages.conversationId, conversationId),
      orderBy: [conversationMessages.createdAt],
    });

    return { messages: messageList };
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return { error: "Failed to fetch messages", messages: [] };
  }
}

export async function endConversation(conversationId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get conversation and verify access
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      return { error: "Conversation not found" };
    }

    // Verify user owns this conversation
    if (conversation.userId !== user.id) {
      return { error: "Access denied" };
    }

    // End conversation
    await db
      .update(conversations)
      .set({
        status: 'ended',
        endedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return { success: true };
  } catch (error) {
    console.error("Failed to end conversation:", error);
    return { error: "Failed to end conversation" };
  }
}

export async function getConversationsByScenario(scenarioId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get scenario and verify access
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, scenarioId),
      with: {
        team: true,
      },
    });

    if (!scenario) {
      return { error: "Scenario not found", conversations: [] };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied", conversations: [] };
    }

    // Get all conversations for this scenario
    const conversationList = await db.query.conversations.findMany({
      where: eq(conversations.scenarioId, scenarioId),
      orderBy: [desc(conversations.lastMessageAt)],
    });

    return { conversations: conversationList };
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return { error: "Failed to fetch conversations", conversations: [] };
  }
}
