import { DashboardClient } from "./dashboard-client";
import { getCurrentUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import {
  getUserOrganizations,
  getTeamsByOrganization,
  getWorkflowsByOrganization,
} from "./actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { org?: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's organizations
  const { organizations } = await getUserOrganizations();

  // Select current organization (from URL param or first available)
  const currentOrgId = searchParams.org || organizations?.[0]?.id;

  // Get teams and workflows for current organization
  let teams: any[] = [];
  let workflows: any[] = [];

  if (currentOrgId) {
    const teamsResult = await getTeamsByOrganization(currentOrgId);
    teams = teamsResult.teams || [];

    const workflowsResult = await getWorkflowsByOrganization(currentOrgId);
    workflows = workflowsResult.workflows || [];
  }

  return (
    <DashboardClient
      user={user}
      organizations={organizations || []}
      currentOrganizationId={currentOrgId}
      teams={teams}
      workflows={workflows}
    />
  );
}
