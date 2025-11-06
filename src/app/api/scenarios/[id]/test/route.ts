import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scenarios, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { ScenarioEngine } from '@/lib/services/scenario-engine';
import { getCurrentUser } from '@/lib/auth-server';

/**
 * Test Route for executing scenarios from the editor
 * POST /api/scenarios/[id]/test
 *
 * Requires authentication
 * Used by the "Test Run" button in scenario editor
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

    // Get scenario
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, id),
      with: {
        team: true,
      },
    });

    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this team
    const membership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, scenario.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
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

    // Execute scenario
    const result = await ScenarioEngine.executeScenario({
      scenarioId: scenario.id,
      input,
      triggeredById: user.id,
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
