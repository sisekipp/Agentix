import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agents, agentVersions, teamMembers, scenarios, scenarioVersions, scenarioExecutions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AgentEngine } from '@/lib/services/agent-engine';
import { getCurrentUser } from '@/lib/auth-server';

/**
 * Test Route for executing agents from the editor
 * POST /api/agents/[id]/test
 *
 * Requires authentication
 * Used by the "Test Run" button in agent editor
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get agent
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, id),
      with: {
        team: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this team
    const membership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, agent.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get active version
    const activeVersion = await db.query.agentVersions.findFirst({
      where: and(
        eq(agentVersions.agentId, id),
        eq(agentVersions.isActive, true)
      ),
      orderBy: [desc(agentVersions.version)],
    });

    if (!activeVersion) {
      return NextResponse.json(
        { error: 'No active agent version found' },
        { status: 404 }
      );
    }

    // Parse test input
    let input: Record<string, any> = {};
    try {
      const body = await request.json();
      input = body.input || {};
    } catch (error) {
      // Empty input is ok for test
    }

    // Find or create a test scenario for this agent
    // We create a dummy scenario to satisfy the foreign key constraint
    const testScenarioName = `[Test] ${agent.name}`;
    let testScenario = await db.query.scenarios.findFirst({
      where: and(
        eq(scenarios.teamId, agent.teamId),
        eq(scenarios.name, testScenarioName)
      ),
    });

    if (!testScenario) {
      [testScenario] = await db.insert(scenarios).values({
        teamId: agent.teamId,
        name: testScenarioName,
        description: `Test scenario for agent: ${agent.name}`,
        orchestrationDefinition: { nodes: [], edges: [] },
        triggerType: 'api',
        isActive: false, // Not a real scenario, just for testing
        createdById: user.id,
      }).returning();
    }

    // Find or create a test scenario version
    let testScenarioVersion = await db.query.scenarioVersions.findFirst({
      where: and(
        eq(scenarioVersions.scenarioId, testScenario.id),
        eq(scenarioVersions.version, 1)
      ),
    });

    if (!testScenarioVersion) {
      [testScenarioVersion] = await db.insert(scenarioVersions).values({
        scenarioId: testScenario.id,
        version: 1,
        name: testScenarioName,
        description: `Test version for agent: ${agent.name}`,
        orchestrationDefinition: { nodes: [], edges: [] },
        isActive: true,
        createdById: user.id,
      }).returning();
    }

    // Create a test scenario execution
    const [testScenarioExecution] = await db.insert(scenarioExecutions).values({
      scenarioVersionId: testScenarioVersion.id,
      status: 'running',
      input,
      triggeredById: user.id,
      startedAt: new Date(),
    }).returning();

    // Execute agent
    const result = await AgentEngine.executeAgent({
      scenarioExecutionId: testScenarioExecution.id,
      agentVersionId: activeVersion.id,
      scenarioNodeId: 'test-node', // Test node ID
      input,
    });

    // Update test scenario execution status
    await db
      .update(scenarioExecutions)
      .set({
        status: result.status,
        output: result.output,
        error: result.error,
        completedAt: new Date(),
        duration: Date.now() - testScenarioExecution.startedAt.getTime(),
      })
      .where(eq(scenarioExecutions.id, testScenarioExecution.id));

    return NextResponse.json({
      success: true,
      executionId: result.executionId,
      status: result.status,
      output: result.output,
      duration: result.duration,
      error: result.error,
    });
  } catch (error) {
    console.error('Test execution error:', error);
    return NextResponse.json(
      {
        error: 'Execution failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
