import { WorkflowEditorClient } from './workflow-editor-client';
import { requireAuth } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { workflows, teamMembers } from '@/lib/db/schema';
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

  return (
    <WorkflowEditorClient
      workflow={workflow}
      version={activeVersion}
      user={user}
    />
  );
}
