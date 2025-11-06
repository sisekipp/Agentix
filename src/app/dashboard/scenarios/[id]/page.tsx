import { ScenarioEditorClient } from './scenario-editor-client';
import { requireAuth } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { scenarios, agents, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function ScenarioEditorPage({
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
      versions: {
        where: (scenarioVersions, { eq }) => eq(scenarioVersions.isActive, true),
        limit: 1,
      },
    },
  });

  if (!scenario) {
    redirect('/dashboard');
  }

  // Verify user access
  const membership = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, scenario.teamId),
      eq(teamMembers.userId, user.id)
    ),
  });

  if (!membership) {
    redirect('/dashboard');
  }

  const activeVersion = scenario.versions[0];

  // Get team's agents for selection
  const teamAgents = await db.query.agents.findMany({
    where: eq(agents.teamId, scenario.teamId),
    with: {
      versions: {
        where: (agentVersions, { eq }) => eq(agentVersions.isActive, true),
        limit: 1,
      },
    },
  });

  // Format agents for client
  const agentsForClient = teamAgents.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description || '',
    icon: a.icon || '🤖',
    color: a.color || '#3b82f6',
  }));

  return (
    <ScenarioEditorClient
      scenario={scenario}
      version={activeVersion}
      user={user}
      agents={agentsForClient}
    />
  );
}
