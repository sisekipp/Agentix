import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agents, agentVersions, teamMembers } from '@/lib/db/schema';
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

    // Execute agent as standalone (no scenario required)
    // AgentEngine will create the execution record with null scenarioExecutionId
    const result = await AgentEngine.executeAgent({
      scenarioExecutionId: null, // Standalone test, no scenario
      agentVersionId: activeVersion.id,
      scenarioNodeId: null, // No scenario node for standalone tests
      input,
    });

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
