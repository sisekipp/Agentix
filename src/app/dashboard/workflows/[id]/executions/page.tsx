import { ExecutionsClient } from './executions-client';
import { requireAuth } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { workflows, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getWorkflowExecutions } from '@/app/dashboard/actions';

export default async function WorkflowExecutionsPage({
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

  // Get executions
  const { executions = [] } = await getWorkflowExecutions(id);

  return (
    <ExecutionsClient workflow={workflow} executions={executions} user={user} />
  );
}
