import { WorkflowEditorClient } from './workflow-editor-client';
import { requireAuth } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { workflows, teamMembers, llmProviders, tools } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const user = session.user;
  const { id } = await params;

  // Get workflow
  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, id),
    with: {
      team: true,
      versions: {
        where: (workflowVersions, { eq }) => eq(workflowVersions.isActive, true),
        limit: 1,
      },
    },
  });

  if (!workflow) {
    redirect('/dashboard');
  }

  // Verify user access
  const membership = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, workflow.teamId),
      eq(teamMembers.userId, user.id)
    ),
  });

  if (!membership) {
    redirect('/dashboard');
  }

  const activeVersion = workflow.versions[0];

  // Get team's LLM providers
  const teamProviders = await db.query.llmProviders.findMany({
    where: and(
      eq(llmProviders.teamId, workflow.teamId),
      eq(llmProviders.isActive, true)
    ),
  });

  // Get team's tools
  const teamTools = await db.query.tools.findMany({
    where: and(
      eq(tools.teamId, workflow.teamId),
      eq(tools.isActive, true)
    ),
  });

  // Format providers for client (exclude API keys)
  const providersForClient = teamProviders.map((p) => ({
    id: p.id,
    name: p.name,
    provider: p.provider,
    model: p.model,
  }));

  // Format tools for client
  const toolsForClient = teamTools.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description || '',
    type: t.type,
  }));

  return (
    <WorkflowEditorClient
      workflow={workflow}
      version={activeVersion}
      user={user}
      providers={providersForClient}
      tools={toolsForClient}
    />
  );
}
