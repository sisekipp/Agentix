import { ExecutionDetailClient } from './execution-detail-client';
import { getCurrentUser } from '@/lib/auth-server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { scenarios, scenarioExecutions, agentExecutions, agentExecutionSteps } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string; executionId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { id, executionId } = await params;

  // Fetch scenario
  const scenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, id),
    with: {
      team: true,
    },
  });

  if (!scenario) {
    redirect('/dashboard/scenarios');
  }

  // Fetch execution details
  const execution = await db.query.scenarioExecutions.findFirst({
    where: eq(scenarioExecutions.id, executionId),
    with: {
      agentExecutions: {
        with: {
          steps: {
            orderBy: (steps, { asc }) => [asc(steps.stepIndex)],
          },
        },
        orderBy: (agentExecutions, { asc }) => [asc(agentExecutions.startedAt)],
      },
    },
  });

  if (!execution) {
    redirect(`/dashboard/scenarios/${id}/executions`);
  }

  return (
    <ExecutionDetailClient
      scenario={scenario}
      execution={execution}
      user={user}
    />
  );
}
