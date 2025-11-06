import { ScenarioExecutionsClient } from './scenario-executions-client';
import { requireAuth } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { scenarios, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getScenarioExecutions } from '@/app/dashboard/agent-actions';

export default async function ScenarioExecutionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const user = session.user;
  const { id } = await params;

  // Get scenario
  const scenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, id),
    with: {
      team: true,
    },
  });

  if (!scenario) {
    redirect('/dashboard/scenarios');
  }

  // Verify user access
  const membership = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, scenario.teamId),
      eq(teamMembers.userId, user.id)
    ),
  });

  if (!membership) {
    redirect('/dashboard/scenarios');
  }

  // Get executions
  const { executions = [] } = await getScenarioExecutions(id);

  return (
    <ScenarioExecutionsClient scenario={scenario} executions={executions} user={user} />
  );
}
