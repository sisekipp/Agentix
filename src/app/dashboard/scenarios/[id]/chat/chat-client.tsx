"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Plus, MessageSquare, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startConversation, sendMessage } from '@/app/dashboard/agent-actions';
import { useToast } from '@/hooks/use-toast';

interface ChatClientProps {
  scenario: any;
  conversation: any | null;
  initialMessages: any[];
  userConversations: any[];
  user: any;
}

export function ChatClient({
  scenario,
  conversation,
  initialMessages,
  userConversations,
  user,
}: ChatClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debug: Log initial messages count
  useEffect(() => {
    console.log('ChatClient mounted with messages:', {
      count: messages.length,
      messageIds: messages.map((m: any) => m.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStartNewConversation = async () => {
    try {
      const result = await startConversation(scenario.id);
      if (result.success && result.conversation) {
        router.push(`/dashboard/scenarios/${scenario.id}/chat?conversationId=${result.conversation.id}`);
      } else {
        throw new Error(result.error || 'Failed to start conversation');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start conversation',
        variant: 'destructive',
      });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return; // Prevent double submission

    // If no conversation exists, start one first
    if (!conversation) {
      try {
        const result = await startConversation(scenario.id, input.trim());
        if (result.success && result.conversation) {
          router.push(`/dashboard/scenarios/${scenario.id}/chat?conversationId=${result.conversation.id}`);
        } else {
          throw new Error(result.error || 'Failed to start conversation');
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to start conversation',
          variant: 'destructive',
        });
      }
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message optimistically
    const optimisticUserMessage = {
      id: `temp-${Date.now()}`,
      conversationId: conversation.id,
      role: 'user',
      content: userMessage,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      const result = await sendMessage(conversation.id, userMessage);

      if (result.success && result.messages) {
        // Replace optimistic message with real messages from server
        setMessages((prev) => {
          // Remove the optimistic message
          const filtered = prev.filter((m) => m.id !== optimisticUserMessage.id);
          // Add the real user and assistant messages (they already have unique IDs)
          return [...filtered, ...result.messages];
        });
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = (message: any) => {
    const isUser = message.role === 'user';

    let content = message.content;
    if (message.role === 'assistant' && typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        content = JSON.stringify(parsed, null, 2);
      } catch {
        // Keep as is if not JSON
      }
    }

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-[70%] rounded-lg p-4 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-900 border border-gray-200'
          }`}
        >
          <div className="text-sm font-medium mb-1">
            {isUser ? 'You' : scenario.name}
          </div>
          <div className="whitespace-pre-wrap break-words">
            {content}
          </div>
          <div
            className={`text-xs mt-2 ${
              isUser ? 'text-blue-100' : 'text-gray-500'
            }`}
          >
            {formatDate(message.createdAt)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Conversation List */}
      <div className="w-80 border-r bg-white overflow-y-auto">
        <div className="p-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/scenarios/${scenario.id}`)}
            className="mb-4 w-full justify-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Scenario
          </Button>
          <Button onClick={handleStartNewConversation} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            New Conversation
          </Button>
        </div>

        <div className="p-2">
          <h3 className="text-sm font-semibold text-gray-500 px-2 mb-2">
            Your Conversations
          </h3>
          {userConversations.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1">
              {userConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() =>
                    router.push(
                      `/dashboard/scenarios/${scenario.id}/chat?conversationId=${conv.id}`
                    )
                  }
                  className={`w-full p-3 text-left rounded hover:bg-gray-100 transition-colors ${
                    conversation?.id === conv.id ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-sm truncate">
                      {conv.title || 'Untitled'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(conv.lastMessageAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div
                    className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                      conv.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {conv.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <h1 className="text-xl font-bold">{scenario.name}</h1>
          {scenario.description && (
            <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {!conversation ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  Start a Conversation
                </h2>
                <p className="text-gray-500 mb-6">
                  Send a message to begin chatting with {scenario.name}
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  No messages yet
                </h2>
                <p className="text-gray-500 mb-6">
                  Start the conversation by sending a message below
                </p>
              </div>
            </div>
          ) : (
            <div>
              {messages.map(renderMessage)}
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="max-w-[70%] rounded-lg p-4 bg-gray-100 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-gray-600">
                        {scenario.name} is thinking...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t bg-white p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                conversation
                  ? 'Type your message...'
                  : 'Type a message to start a conversation...'
              }
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
