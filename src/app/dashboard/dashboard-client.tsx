"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Building2, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { OrganizationSelector } from "@/components/organization-selector";
import { CreateOrganizationDialog } from "@/components/create-organization-dialog";
import { CreateTeamDialog } from "@/components/create-team-dialog";
import { CreateWorkflowDialog } from "@/components/create-workflow-dialog";
import { TeamsList } from "@/components/teams-list";
import { WorkflowsList } from "@/components/workflows-list";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  team?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface DashboardClientProps {
  user: User;
  organizations: Organization[];
  currentOrganizationId?: string;
  teams: Team[];
  workflows: Workflow[];
}

export function DashboardClient({
  user,
  organizations,
  currentOrganizationId,
  teams,
  workflows,
}: DashboardClientProps) {
  const router = useRouter();
  const [showCreateOrgDialog, setShowCreateOrgDialog] = React.useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = React.useState(false);
  const [showCreateWorkflowDialog, setShowCreateWorkflowDialog] = React.useState(false);

  const currentOrganization = organizations.find((org) => org.id === currentOrganizationId);

  function handleOrganizationChange(organizationId: string) {
    router.push(`/dashboard?org=${organizationId}`);
  }

  function handleOrgCreated() {
    router.refresh();
  }

  function handleTeamCreated() {
    router.refresh();
  }

  function handleWorkflowCreated() {
    router.refresh();
  }

  function handleWorkflowDeleted() {
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-zinc-900">Agentix</h1>
              <div className="h-6 w-px bg-zinc-300" />
              <div className="w-64">
                <OrganizationSelector
                  organizations={organizations}
                  currentOrganizationId={currentOrganizationId}
                  onOrganizationChange={handleOrganizationChange}
                  onCreateNew={() => setShowCreateOrgDialog(true)}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600">{user.name}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {!currentOrganization ? (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Agentix!</CardTitle>
              <CardDescription>
                Get started by creating your first organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowCreateOrgDialog(true)}>
                <Building2 className="mr-2 h-4 w-4" />
                Create Organization
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Organization Info */}
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">
                {currentOrganization.name}
              </h2>
              {currentOrganization.description && (
                <p className="mt-1 text-zinc-600">{currentOrganization.description}</p>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-600">
                    Teams
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{teams.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-600">
                    Total Workflows
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{workflows.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-600">
                    Active Deployments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button onClick={() => setShowCreateTeamDialog(true)} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
                <Button
                  onClick={() => router.push(`/dashboard/providers?org=${currentOrganizationId}`)}
                  variant="outline"
                  disabled={teams.length === 0}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage LLM Providers
                </Button>
              </CardContent>
            </Card>

            {/* Teams Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Teams</h3>
                  <p className="text-sm text-zinc-600">
                    Organize your workflows and collaborate with team members
                  </p>
                </div>
              </div>
              <TeamsList teams={teams} />
            </div>

            {/* Workflows Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Workflows</h3>
                  <p className="text-sm text-zinc-600">
                    Manage and monitor your AI agent workflows
                  </p>
                </div>
                <Button
                  onClick={() => setShowCreateWorkflowDialog(true)}
                  disabled={teams.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workflow
                </Button>
              </div>

              {teams.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No Teams Available</CardTitle>
                    <CardDescription>
                      You need to create a team first. Teams help you organize workflows and collaborate with members.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => setShowCreateTeamDialog(true)}>
                      <Users className="mr-2 h-4 w-4" />
                      Create Your First Team
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <WorkflowsList
                  workflows={workflows}
                  onWorkflowDeleted={handleWorkflowDeleted}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateOrganizationDialog
        open={showCreateOrgDialog}
        onOpenChange={setShowCreateOrgDialog}
        onSuccess={handleOrgCreated}
      />
      {currentOrganizationId && (
        <CreateTeamDialog
          open={showCreateTeamDialog}
          onOpenChange={setShowCreateTeamDialog}
          onSuccess={handleTeamCreated}
          organizationId={currentOrganizationId}
        />
      )}
      <CreateWorkflowDialog
        open={showCreateWorkflowDialog}
        onOpenChange={setShowCreateWorkflowDialog}
        onSuccess={handleWorkflowCreated}
        teams={teams}
      />
    </div>
  );
}
