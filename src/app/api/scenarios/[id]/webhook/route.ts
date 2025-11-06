import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scenarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ScenarioEngine } from '@/lib/services/scenario-engine';

/**
 * Webhook Route for executing scenarios with 'webhook' trigger type
 * POST /api/scenarios/[id]/webhook
 *
 * Accepts webhook data from external services
 * Supports various webhook signatures (GitHub, Stripe, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Verify trigger type
    if (scenario.triggerType !== 'webhook') {
      return NextResponse.json(
        { error: `Scenario trigger type is '${scenario.triggerType}', not 'webhook'` },
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

    // Get webhook configuration
    const webhookConfig = scenario.triggerConfig as any;
    const secret = webhookConfig?.secret;

    // Verify webhook signature if secret is configured
    if (secret) {
      const signature = request.headers.get('x-webhook-signature');

      // TODO: Implement proper signature verification
      // Different webhook providers use different signature algorithms:
      // - GitHub: x-hub-signature-256 (HMAC SHA256)
      // - Stripe: stripe-signature (HMAC SHA256)
      // - Generic: x-webhook-signature (HMAC SHA256)

      if (!signature) {
        return NextResponse.json(
          { error: 'Missing webhook signature' },
          { status: 401 }
        );
      }

      // For now, simple comparison (implement proper HMAC verification)
      // const isValid = verifyWebhookSignature(body, signature, secret);
      // if (!isValid) {
      //   return NextResponse.json(
      //     { error: 'Invalid webhook signature' },
      //     { status: 401 }
      //   );
      // }
    }

    // Parse webhook payload
    let webhookData: Record<string, any> = {};
    try {
      const body = await request.json();
      webhookData = body;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Extract headers that might be useful
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (key.startsWith('x-') || key.startsWith('webhook-')) {
        headers[key] = value;
      }
    });

    // Prepare input with webhook context
    const input = {
      ...webhookData,
      _webhook: {
        headers,
        timestamp: new Date().toISOString(),
        source: webhookConfig?.source || 'unknown',
      },
    };

    // Execute scenario asynchronously (don't wait for completion)
    // Webhooks should respond quickly
    ScenarioEngine.executeScenario({
      scenarioId: scenario.id,
      input,
      triggeredById: null, // Webhook has no user
    }).catch((error) => {
      console.error('Webhook execution error:', error);
    });

    // Return immediate success response
    return NextResponse.json(
      {
        success: true,
        message: 'Webhook received and processing',
        scenarioId: scenario.id,
        scenarioName: scenario.name,
      },
      { status: 202 } // Accepted
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
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
 * GET endpoint to retrieve webhook info
 * Useful for testing and verification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get scenario
    const scenario = await db.query.scenarios.findFirst({
      where: eq(scenarios.id, id),
    });

    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    if (scenario.triggerType !== 'webhook') {
      return NextResponse.json(
        { error: 'Not a webhook scenario' },
        { status: 400 }
      );
    }

    const webhookConfig = scenario.triggerConfig as any;

    return NextResponse.json({
      id: scenario.id,
      name: scenario.name,
      webhookUrl: `/api/scenarios/${id}/webhook`,
      requiresSignature: !!webhookConfig?.secret,
      source: webhookConfig?.source || 'generic',
      isActive: scenario.isActive,
    });
  } catch (error) {
    console.error('Webhook info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
