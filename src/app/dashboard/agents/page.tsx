import { AgentsClient } from './agents-client';
import { getCurrentUser } from '@/lib/auth-server';
import { redirect } from 'next/navigation';
import {
  getUserOrganizations,
  getTeamsByOrganization,
} from '../actions';
import { db } from '@/lib/db';
import { agents, teamMembers } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Disable caching for this page to always show latest agents
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's organizations
  const { organizations } = await getUserOrganizations();

  // Await searchParams (Next.js 16 requirement)
  const params = await searchParams;

  // Select current organization (from URL param or first available)
  const currentOrgId = params.org || organizations?.[0]?.id;

  // Get teams for current organization
  let teams: any[] = [];
  let agentsList: any[] = [];

  if (currentOrgId) {
    const teamsResult = await getTeamsByOrganization(currentOrgId);
    teams = teamsResult.teams || [];

    // Get all team IDs user has access to
    const teamIds = teams.map((t) => t.id);

    if (teamIds.length > 0) {
      // Get all agents from all user teams
      agentsList = await db
        .select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          icon: agents.icon,
          color: agents.color,
          teamId: agents.teamId,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
        })
        .from(agents)
        .where(
          teamIds.length === 1
            ? eq(agents.teamId, teamIds[0])
            : sql`${agents.teamId} IN ${teamIds}`
        )
        .orderBy(agents.createdAt);
    }
  }

  return (
    <AgentsClient
      user={user}
      organizations={organizations || []}
      currentOrganizationId={currentOrgId}
      teams={teams}
      agents={agentsList}
    />
  );
}
