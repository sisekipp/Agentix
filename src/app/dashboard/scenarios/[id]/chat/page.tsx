import { ChatClient } from './chat-client';
import { getCurrentUser } from '@/lib/auth-server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { scenarios, conversations } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export default async function ScenarioChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const { conversationId } = await searchParams;

  // Fetch scenario
  const scenario = await db.query.scenarios.findFirst({
    where: eq(scenarios.id, id),
    with: {
      team: true,
    },
  });

  if (!scenario) {
    redirect('/dashboard/scenarios');
  }

  // Verify it's a chat scenario
  if (scenario.triggerType !== 'chat') {
    redirect(`/dashboard/scenarios/${id}`);
  }

  // Fetch conversation if provided
  let conversation = null;
  let messages: any[] = [];

  if (conversationId) {
    conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, user.id)
      ),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });

    if (conversation) {
      messages = conversation.messages || [];
    }
  }

  // Fetch all user's conversations for this scenario
  const userConversations = await db.query.conversations.findMany({
    where: and(
      eq(conversations.scenarioId, id),
      eq(conversations.userId, user.id)
    ),
    orderBy: [desc(conversations.lastMessageAt)],
    limit: 20,
  });

  return (
    <ChatClient
      scenario={scenario}
      conversation={conversation}
      initialMessages={messages}
      userConversations={userConversations}
      user={user}
    />
  );
}
