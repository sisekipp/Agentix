"use server";

import { db } from "@/lib/db";
import { organizations, teams, teamMembers, workflows, workflowVersions, users, llmProviders, tools } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-server";
import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { WorkflowEngine } from "@/lib/services/workflow-engine";
import type { WorkflowDefinition } from "@/lib/types/workflow";

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

  console.log("Creating workflow:", { name, teamId, userId: user.id });

  if (!name || !teamId) {
    console.log("Missing required fields:", { name: !!name, teamId: !!teamId });
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

    console.log("Team membership check:", {
      teamId,
      userId: user.id,
      isMember: !!teamMembership,
      membership: teamMembership
    });

    if (!teamMembership) {
      return { error: "Access denied - you are not a member of this team" };
    }

    // Create workflow
    console.log("Attempting to insert workflow into database...");
    const [workflow] = await db
      .insert(workflows)
      .values({
        teamId,
        name,
        description: description || null,
        createdById: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("Workflow created successfully:", workflow.id);

    // Create initial version
    console.log("Creating initial workflow version...");
    await db.insert(workflowVersions).values({
      workflowId: workflow.id,
      version: 1,
      name: "Initial version",
      description: "Initial workflow version",
      definition: { nodes: [], edges: [] }, // Empty workflow definition
      isActive: true,
      createdById: user.id,
      createdAt: new Date(),
    });

    console.log("Workflow version created successfully for:", workflow.id);

    return { success: true, workflow };
  } catch (error) {
    console.error("Failed to create workflow - FULL ERROR:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return { error: `Failed to create workflow: ${error instanceof Error ? error.message : String(error)}` };
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

    console.log("User teams in organization:", {
      organizationId,
      userId: user.id,
      teamCount: userTeams.length,
      teamIds: userTeams.map(t => t.teamId),
    });

    if (userTeams.length === 0) {
      return { workflows: [] };
    }

    const teamIds = userTeams.map((t) => t.teamId);

    // Get all workflows from ALL user teams (not just the first one)
    const workflowList = await db
      .select()
      .from(workflows)
      .where(
        teamIds.length === 1
          ? eq(workflows.teamId, teamIds[0])
          : // Use SQL IN clause for multiple teams
            sql`${workflows.teamId} IN ${teamIds}`
      )
      .orderBy(desc(workflows.createdAt));

    console.log("Workflows found:", {
      count: workflowList.length,
      workflows: workflowList.map(w => ({ id: w.id, name: w.name, teamId: w.teamId })),
    });

    // Fetch related data
    const workflowsWithRelations = await Promise.all(
      workflowList.map(async (workflow) => {
        const team = await db.query.teams.findFirst({
          where: eq(teams.id, workflow.teamId),
          columns: { id: true, name: true },
        });

        const createdBy = await db.query.users.findFirst({
          where: eq(users.id, workflow.createdById),
          columns: { id: true, name: true, email: true },
        });

        return {
          ...workflow,
          team,
          createdBy,
        };
      })
    );

    return { workflows: workflowsWithRelations };
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

export async function createTeam(formData: FormData) {
  const session = await requireAuth();
  const user = session.user;

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string | null;
  const organizationId = formData.get("organizationId") as string;

  if (!name || !slug || !organizationId) {
    return { error: "Name, slug, and organization are required" };
  }

  try {
    // Verify user has access to this organization
    const userOrgs = await getUserOrganizations();
    const hasAccess = userOrgs.organizations?.some((org) => org.id === organizationId);

    if (!hasAccess) {
      return { error: "Access denied" };
    }

    // Check if slug already exists in this organization
    const existingTeam = await db.query.teams.findFirst({
      where: and(
        eq(teams.organizationId, organizationId),
        eq(teams.slug, slug)
      ),
    });

    if (existingTeam) {
      return { error: "Team slug already exists in this organization" };
    }

    // Create team
    const [team] = await db
      .insert(teams)
      .values({
        organizationId,
        name,
        slug,
        description: description || null,
      })
      .returning();

    // Add user as team admin
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: "admin",
    });

    return { success: true, team };
  } catch (error) {
    console.error("Failed to create team:", error);
    return { error: "Failed to create team" };
  }
}

// Workflow Execution Actions

export async function executeWorkflow(workflowId: string, input?: Record<string, any>) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get workflow and verify access
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
      with: {
        team: true,
        versions: {
          where: eq(workflowVersions.isActive, true),
          limit: 1,
        },
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

    // Get active version
    const activeVersion = workflow.versions[0];
    if (!activeVersion) {
      return { error: "No active workflow version found" };
    }

    // Execute workflow
    const result = await WorkflowEngine.executeWorkflow({
      workflowVersionId: activeVersion.id,
      input: input || {},
      triggeredById: user.id,
    });

    return { success: true, execution: result };
  } catch (error) {
    console.error("Failed to execute workflow:", error);
    return { error: "Failed to execute workflow" };
  }
}

export async function getWorkflowExecutions(workflowId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get workflow and verify access
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
      with: {
        team: true,
        versions: true,
      },
    });

    if (!workflow) {
      return { error: "Workflow not found", executions: [] };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, workflow.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied", executions: [] };
    }

    // Get all executions for active version
    const activeVersion = workflow.versions.find((v) => v.isActive);
    if (!activeVersion) {
      return { executions: [] };
    }

    const executions = await WorkflowEngine.getExecutions(activeVersion.id);

    return { executions };
  } catch (error) {
    console.error("Failed to fetch workflow executions:", error);
    return { error: "Failed to fetch workflow executions", executions: [] };
  }
}

export async function cancelWorkflowExecution(executionId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get execution details
    const execution = await WorkflowEngine.getExecution(executionId);
    if (!execution) {
      return { error: "Execution not found" };
    }

    // Get workflow version and workflow to verify access
    const version = await db.query.workflowVersions.findFirst({
      where: eq(workflowVersions.id, execution.workflowVersionId),
      with: {
        workflow: {
          with: {
            team: true,
          },
        },
      },
    });

    if (!version) {
      return { error: "Workflow version not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, version.workflow.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Cancel execution
    const success = await WorkflowEngine.cancelExecution(executionId);

    return { success };
  } catch (error) {
    console.error("Failed to cancel workflow execution:", error);
    return { error: "Failed to cancel workflow execution" };
  }
}

export async function getWorkflowVersion(workflowId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get workflow and verify access
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
      with: {
        team: true,
        versions: {
          where: eq(workflowVersions.isActive, true),
          limit: 1,
        },
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

    const activeVersion = workflow.versions[0];
    if (!activeVersion) {
      return { error: "No active workflow version found" };
    }

    return { version: activeVersion };
  } catch (error) {
    console.error("Failed to fetch workflow version:", error);
    return { error: "Failed to fetch workflow version" };
  }
}

export async function updateWorkflowDefinition(
  workflowId: string,
  definition: WorkflowDefinition
) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get workflow and verify access
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
      with: {
        team: true,
        versions: {
          where: eq(workflowVersions.isActive, true),
          limit: 1,
        },
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

    // Get active version
    const activeVersion = workflow.versions[0];
    if (!activeVersion) {
      return { error: "No active workflow version found" };
    }

    // Update workflow definition
    const [updatedVersion] = await db
      .update(workflowVersions)
      .set({
        definition,
      })
      .where(eq(workflowVersions.id, activeVersion.id))
      .returning();

    // Clear workflow cache
    WorkflowEngine.clearCache(activeVersion.id);

    return { success: true, version: updatedVersion };
  } catch (error) {
    console.error("Failed to update workflow definition:", error);
    return { error: "Failed to update workflow definition" };
  }
}

// Provider Actions

export async function getProvidersByTeam(teamId: string) {
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
      return { error: "Access denied", providers: [] };
    }

    const providerList = await db.query.llmProviders.findMany({
      where: eq(llmProviders.teamId, teamId),
      orderBy: [desc(llmProviders.createdAt)],
    });

    // Don't return API keys to client
    const providersWithoutKeys = providerList.map((p) => ({
      id: p.id,
      teamId: p.teamId,
      name: p.name,
      provider: p.provider,
      model: p.model,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return { providers: providersWithoutKeys };
  } catch (error) {
    console.error("Failed to fetch providers:", error);
    return { error: "Failed to fetch providers", providers: [] };
  }
}

export async function createProvider(formData: FormData) {
  const session = await requireAuth();
  const user = session.user;

  const teamId = formData.get("teamId") as string;
  const name = formData.get("name") as string;
  const provider = formData.get("provider") as string;
  const model = formData.get("model") as string;
  const apiKey = formData.get("apiKey") as string;

  if (!teamId || !name || !provider || !model || !apiKey) {
    return { error: "All fields are required" };
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

    // Create provider
    const [newProvider] = await db
      .insert(llmProviders)
      .values({
        teamId,
        name,
        provider,
        model,
        apiKey, // TODO: Encrypt this
        configuration: {},
        isActive: true,
      })
      .returning();

    return {
      success: true,
      provider: {
        id: newProvider.id,
        teamId: newProvider.teamId,
        name: newProvider.name,
        provider: newProvider.provider,
        model: newProvider.model,
        isActive: newProvider.isActive,
      }
    };
  } catch (error) {
    console.error("Failed to create provider:", error);
    return { error: "Failed to create provider" };
  }
}

export async function updateProvider(providerId: string, formData: FormData) {
  const session = await requireAuth();
  const user = session.user;

  const name = formData.get("name") as string;
  const model = formData.get("model") as string;
  const apiKey = formData.get("apiKey") as string | null;

  if (!name || !model) {
    return { error: "Name and model are required" };
  }

  try {
    // Get provider to verify access
    const provider = await db.query.llmProviders.findFirst({
      where: eq(llmProviders.id, providerId),
    });

    if (!provider) {
      return { error: "Provider not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, provider.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Update provider
    const updateData: any = {
      name,
      model,
      updatedAt: new Date(),
    };

    // Only update API key if provided
    if (apiKey) {
      updateData.apiKey = apiKey; // TODO: Encrypt this
    }

    const [updatedProvider] = await db
      .update(llmProviders)
      .set(updateData)
      .where(eq(llmProviders.id, providerId))
      .returning();

    return {
      success: true,
      provider: {
        id: updatedProvider.id,
        teamId: updatedProvider.teamId,
        name: updatedProvider.name,
        provider: updatedProvider.provider,
        model: updatedProvider.model,
        isActive: updatedProvider.isActive,
      }
    };
  } catch (error) {
    console.error("Failed to update provider:", error);
    return { error: "Failed to update provider" };
  }
}

export async function deleteProvider(providerId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get provider to verify access
    const provider = await db.query.llmProviders.findFirst({
      where: eq(llmProviders.id, providerId),
    });

    if (!provider) {
      return { error: "Provider not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, provider.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Delete provider
    await db.delete(llmProviders).where(eq(llmProviders.id, providerId));

    return { success: true };
  } catch (error) {
    console.error("Failed to delete provider:", error);
    return { error: "Failed to delete provider" };
  }
}

export async function toggleProviderActive(providerId: string) {
  const session = await requireAuth();
  const user = session.user;

  try {
    // Get provider to verify access
    const provider = await db.query.llmProviders.findFirst({
      where: eq(llmProviders.id, providerId),
    });

    if (!provider) {
      return { error: "Provider not found" };
    }

    // Verify user is a member of the team
    const teamMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, provider.teamId),
        eq(teamMembers.userId, user.id)
      ),
    });

    if (!teamMembership) {
      return { error: "Access denied" };
    }

    // Toggle active status
    const [updatedProvider] = await db
      .update(llmProviders)
      .set({
        isActive: !provider.isActive,
        updatedAt: new Date(),
      })
      .where(eq(llmProviders.id, providerId))
      .returning();

    return {
      success: true,
      isActive: updatedProvider.isActive,
    };
  } catch (error) {
    console.error("Failed to toggle provider status:", error);
    return { error: "Failed to toggle provider status" };
  }
}
