"use server";

import { db } from "@/lib/db";
import { organizations, teams, teamMembers, workflows, workflowVersions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-server";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

// Organization Actions

export async function createOrganization(formData: FormData) {
  const session = await requireAuth();
  const user = session.user;

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string | null;

  if (!name || !slug) {
    return { error: "Name and slug are required" };
  }

  try {
    // Check if slug already exists
    const existingOrg = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });

    if (existingOrg) {
      return { error: "Organization slug already exists" };
    }

    // Create organization
    const [organization] = await db
      .insert(organizations)
      .values({
        name,
        slug,
        description: description || null,
      })
      .returning();

    // Create default team
    const [team] = await db
      .insert(teams)
      .values({
        organizationId: organization.id,
        name: "Default Team",
        slug: "default",
        description: "Default team for the organization",
      })
      .returning();

    // Add user as team admin
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: "admin",
    });

    return { success: true, organization };
  } catch (error) {
    console.error("Failed to create organization:", error);
    return { error: "Failed to create organization" };
  }
}

export async function getUserOrganizations() {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get all organizations where user is a team member
    const userOrgs = await db
      .selectDistinct({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        description: organizations.description,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .innerJoin(teams, eq(teams.organizationId, organizations.id))
      .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, user.id))
      .orderBy(desc(organizations.createdAt));

    return { organizations: userOrgs };
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    return { error: "Failed to fetch organizations", organizations: [] };
  }
}

export async function getOrganizationById(organizationId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Verify user has access to this organization
    const userOrgs = await getUserOrganizations();
    const hasAccess = userOrgs.organizations?.some((org) => org.id === organizationId);

    if (!hasAccess) {
      return { error: "Access denied" };
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      return { error: "Organization not found" };
    }

    return { organization: org };
  } catch (error) {
    console.error("Failed to fetch organization:", error);
    return { error: "Failed to fetch organization" };
  }
}

// Workflow Actions

export async function createWorkflow(formData: FormData) {
  const session = await requireAuth();
  const user = session.user;

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const teamId = formData.get("teamId") as string;

  if (!name || !teamId) {
    return { error: "Name and team are required" };
  }

  try {
    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Create workflow
    const [workflow] = await db
      .insert(workflows)
      .values({
        teamId,
        name,
        description: description || null,
        createdById: user.id,
      })
      .returning();

    // Create initial version
    await db.insert(workflowVersions).values({
      workflowId: workflow.id,
      version: 1,
      name: "Initial version",
      description: "Initial workflow version",
      definition: { nodes: [], edges: [] }, // Empty workflow definition
      isActive: true,
      createdById: user.id,
    });

    return { success: true, workflow };
  } catch (error) {
    console.error("Failed to create workflow:", error);
    return { error: "Failed to create workflow" };
  }
}

export async function getWorkflowsByTeam(teamId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied", workflows: [] };
    }

    const workflowList = await db.query.workflows.findMany({
      where: eq(workflows.teamId, teamId),
      orderBy: [desc(workflows.createdAt)],
      with: {
        createdBy: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { workflows: workflowList };
  } catch (error) {
    console.error("Failed to fetch workflows:", error);
    return { error: "Failed to fetch workflows", workflows: [] };
  }
}

export async function getWorkflowsByOrganization(organizationId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get all teams in the organization where user is a member
    const userTeams = await db
      .select({
        teamId: teams.id,
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .where(
        and(
          eq(teams.organizationId, organizationId),
          eq(teamMembers.userId, user.id)
        )
      );

    if (userTeams.length === 0) {
      return { workflows: [] };
    }

    const teamIds = userTeams.map((t) => t.teamId);

    // Get all workflows from these teams
    const workflowList = await db.query.workflows.findMany({
      where: eq(workflows.teamId, teamIds[0]), // This needs to be improved for multiple teams
      orderBy: [desc(workflows.createdAt)],
      with: {
        team: {
          columns: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { workflows: workflowList };
  } catch (error) {
    console.error("Failed to fetch workflows:", error);
    return { error: "Failed to fetch workflows", workflows: [] };
  }
}

export async function deleteWorkflow(workflowId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get workflow to verify access
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
      with: {
        team: true,
      },
    });

    if (!workflow) {
      return { error: "Workflow not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, workflow.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Delete workflow (cascade will handle versions, deployments, executions)
    await db.delete(workflows).where(eq(workflows.id, workflowId));

    return { success: true };
  } catch (error) {
    console.error("Failed to delete workflow:", error);
    return { error: "Failed to delete workflow" };
  }
}

export async function getTeamsByOrganization(organizationId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get teams where user is a member
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        description: teams.description,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .where(
        and(
          eq(teams.organizationId, organizationId),
          eq(teamMembers.userId, user.id)
        )
      )
      .orderBy(desc(teams.createdAt));

    return { teams: userTeams };
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return { error: "Failed to fetch teams", teams: [] };
  }
}
