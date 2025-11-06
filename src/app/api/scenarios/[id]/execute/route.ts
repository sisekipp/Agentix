import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scenarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ScenarioEngine } from '@/lib/services/scenario-engine';

/**
 * API Route for executing scenarios with 'api' trigger type
 * POST /api/scenarios/[id]/execute
 *
 * Requires API key authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get API key from header
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key. Include x-api-key header.' },
        { status: 401 }
      );
    }

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

    // Verify trigger type
    if (scenario.triggerType !== 'api') {
      return NextResponse.json(
        { error: `Scenario trigger type is '${scenario.triggerType}', not 'api'` },
        { status: 400 }
      );
    }

    // Verify scenario is active
    if (!scenario.isActive) {
      return NextResponse.json(
        { error: 'Scenario is not active' },
        { status: 403 }
      );
    }

    // TODO: Verify API key against team's API keys
    // For now, we accept any API key (implement proper validation)

    // Parse request body as input
    let input: Record<string, any> = {};
    try {
      const body = await request.json();
      input = body;
    } catch (error) {
      // Empty body is ok
    }

    // Execute scenario
    const result = await ScenarioEngine.executeScenario({
      scenarioId: scenario.id,
      input,
      triggeredById: null, // API trigger has no user
    });

    return NextResponse.json({
      success: true,
      executionId: result.executionId,
      status: result.status,
      output: result.output,
      duration: result.duration,
    });
  } catch (error) {
    console.error('API execution error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve scenario info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get API key from header
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

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

    // TODO: Verify API key

    return NextResponse.json({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      triggerType: scenario.triggerType,
      isActive: scenario.isActive,
      team: {
        id: scenario.team.id,
        name: scenario.team.name,
      },
    });
  } catch (error) {
    console.error('API info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
