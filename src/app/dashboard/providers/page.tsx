import { requireAuth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { getTeamsByOrganization, getProvidersByTeam } from "../actions";
import { ProvidersClient } from "./providers-client";

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: { org?: string; team?: string };
}) {
  const session = await requireAuth();

  if (!session) {
    redirect("/login");
  }

  const organizationId = searchParams.org;
  const teamId = searchParams.team;

  if (!organizationId) {
    redirect("/dashboard");
  }

  // Get teams for the organization
  const teamsResult = await getTeamsByOrganization(organizationId);
  const teams = teamsResult.teams || [];

  // If no specific team is selected, use the first team
  const selectedTeamId = teamId || teams[0]?.id;

  // Get providers for the selected team
  const providersResult = selectedTeamId
    ? await getProvidersByTeam(selectedTeamId)
    : { providers: [] };

  return (
    <ProvidersClient
      organizationId={organizationId}
      teams={teams}
      selectedTeamId={selectedTeamId || ""}
      providers={providersResult.providers || []}
    />
  );
}
