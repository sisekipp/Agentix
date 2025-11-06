import { ScenariosClient } from './scenarios-client';
import { getCurrentUser } from '@/lib/auth-server';
import { redirect } from 'next/navigation';
import {
  getUserOrganizations,
  getTeamsByOrganization,
} from '../actions';
import { db } from '@/lib/db';
import { scenarios, teamMembers } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Disable caching for this page to always show latest scenarios
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ScenariosPage({
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
  let scenariosList: any[] = [];

  if (currentOrgId) {
    const teamsResult = await getTeamsByOrganization(currentOrgId);
    teams = teamsResult.teams || [];

    // Get all team IDs user has access to
    const teamIds = teams.map((t) => t.id);

    if (teamIds.length > 0) {
      // Get all scenarios from all user teams
      scenariosList = await db
        .select({
          id: scenarios.id,
          name: scenarios.name,
          description: scenarios.description,
          triggerType: scenarios.triggerType,
          isActive: scenarios.isActive,
          teamId: scenarios.teamId,
          createdAt: scenarios.createdAt,
          updatedAt: scenarios.updatedAt,
        })
        .from(scenarios)
        .where(
          teamIds.length === 1
            ? eq(scenarios.teamId, teamIds[0])
            : sql`${scenarios.teamId} IN ${teamIds}`
        )
        .orderBy(scenarios.createdAt);
    }
  }

  return (
    <ScenariosClient
      user={user}
      organizations={organizations || []}
      currentOrganizationId={currentOrgId}
      teams={teams}
      scenarios={scenariosList}
    />
  );
}
