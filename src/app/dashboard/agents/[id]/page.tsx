import { AgentEditorClient } from './agent-editor-client';
import { getCurrentUser } from '@/lib/auth-server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { agents, agentVersions } from '@/lib/db/schema/agents';
import { eq, and, desc } from 'drizzle-orm';

export default async function AgentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { id } = await params;

  // Fetch agent
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, id),
    with: {
      team: true,
    },
  });

  if (!agent) {
    redirect('/dashboard/agents');
  }

  // Fetch active version
  const activeVersion = await db.query.agentVersions.findFirst({
    where: and(
      eq(agentVersions.agentId, id),
      eq(agentVersions.isActive, true)
    ),
    orderBy: [desc(agentVersions.version)],
  });

  // Fetch available tools (we'll use the existing tools from the system)
  // For now, we'll pass a static list, but this could be fetched from a tools table
  const availableTools = [
    { id: 'web-search', name: 'Web Search', icon: '🔍', description: 'Search the web for information' },
    { id: 'calculator', name: 'Calculator', icon: '🔢', description: 'Perform mathematical calculations' },
    { id: 'send-email', name: 'Send Email', icon: '📧', description: 'Send emails to recipients' },
    { id: 'create-task', name: 'Create Task', icon: '✅', description: 'Create tasks in project management' },
    { id: 'fetch-data', name: 'Fetch Data', icon: '📊', description: 'Fetch data from external APIs' },
    { id: 'file-operations', name: 'File Operations', icon: '📁', description: 'Read and write files' },
  ];

  return (
    <AgentEditorClient
      agent={agent}
      activeVersion={activeVersion}
      availableTools={availableTools}
      user={user}
    />
  );
}
