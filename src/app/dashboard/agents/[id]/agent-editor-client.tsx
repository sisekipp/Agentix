"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Play, History, Settings, MessageSquare, Send, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AgentBuilder } from '@/components/agent-builder';
import type { AgentDefinition } from '@/lib/types/agent';
import { updateAgent } from '@/app/dashboard/agent-actions';
import { useToast } from '@/hooks/use-toast';

interface AgentEditorClientProps {
  agent: any;
  activeVersion: any;
  availableTools: any[];
  user: any;
}

type TestMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  executionId?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  currentStep?: string;
};

export function AgentEditorClient({
  agent,
  activeVersion,
  availableTools,
  user,
}: AgentEditorClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'test'>('settings');

  // Agent metadata
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');

  // Test chat state
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState('');

  // Workflow definition from active version
  const [workflowDefinition, setWorkflowDefinition] = useState<AgentDefinition>(
    activeVersion?.workflowDefinition || { nodes: [], edges: [] }
  );

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [testMessages]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const formData = new FormData();
      formData.append('id', agent.id);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('systemPrompt', systemPrompt);
      formData.append('workflowDefinition', JSON.stringify(workflowDefinition));

      const result = await updateAgent(formData);

      if (result.success) {
        toast({
          title: 'Agent saved',
          description: 'Your agent has been saved successfully.',
        });
        router.refresh();
      } else {
        throw new Error(result.error || 'Failed to save agent');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save agent',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testInput.trim()) return;

    const userMessage: TestMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: testInput,
      timestamp: new Date(),
    };

    setTestMessages((prev) => [...prev, userMessage]);
    setTestInput('');
    setIsTesting(true);

    // Add a pending assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const pendingMessage: TestMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: 'Starting execution...',
      timestamp: new Date(),
      status: 'pending',
    };

    setTestMessages((prev) => [...prev, pendingMessage]);

    try {
      // Call test API endpoint
      const response = await fetch(`/api/agents/${agent.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { message: testInput },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || 'Test execution failed');
      }

      // Update the assistant message with results
      setTestMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Execution completed!\n\nStatus: ${result.status}\nExecution ID: ${result.executionId}`,
                status: 'completed',
                executionId: result.executionId,
              }
            : msg
        )
      );
    } catch (error: any) {
      // Update the assistant message with error
      setTestMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Execution failed: ${error.message}`,
                status: 'failed',
              }
            : msg
        )
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/agents')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-lg"
                style={{ backgroundColor: agent.color || '#3b82f6' }}
              >
                {agent.icon || '🤖'}
              </div>
              <div>
                <h1 className="text-xl font-bold">{name}</h1>
                <p className="text-sm text-gray-500">Agent Editor</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab('settings');
                setShowPanel(!showPanel);
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab('test');
                setShowPanel(true);
              }}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Test Chat
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="flex-1">
          <AgentBuilder
            definition={workflowDefinition}
            onChange={setWorkflowDefinition}
            availableTools={availableTools}
          />
        </div>
      </div>

      {/* Right Sidebar - Settings & Test */}
      {showPanel && (
        <div className="w-96 border-l bg-white flex flex-col">
          {/* Panel Header with Tabs */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <Button
                  variant={activeTab === 'settings' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('settings')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button
                  variant={activeTab === 'test' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('test')}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Test
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPanel(false)}
              >
                ✕
              </Button>
            </div>
          </div>

          {/* Settings Tab Content */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Agent name"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this agent do?"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Textarea
                    id="systemPrompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Define the agent's behavior, personality, and capabilities..."
                    rows={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This prompt defines how the LLM should behave when executing this agent.
                  </p>
                </div>

                <div>
                  <Label>Available Tools</Label>
                  <div className="mt-2 space-y-2">
                    {availableTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="p-3 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{tool.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{tool.name}</p>
                            <p className="text-xs text-gray-600">{tool.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label>Version Info</Label>
                  <div className="mt-2 space-y-2 text-sm text-gray-600">
                    <p>Current Version: {activeVersion?.version || 1}</p>
                    <p>
                      Last Updated:{' '}
                      {new Date(agent.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <p>Created By: {user.name || user.email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test Chat Tab Content */}
          {activeTab === 'test' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {testMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">Start a conversation to test your agent</p>
                    <p className="text-xs mt-1">Send a message to see how the agent responds</p>
                  </div>
                ) : (
                  testMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : message.status === 'failed'
                            ? 'bg-red-50 text-red-900 border border-red-200'
                            : message.status === 'pending'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                        {/* Show execution status and current step */}
                        {message.role === 'assistant' && message.status && (
                          <div className="mt-2 pt-2 border-t border-gray-300/50">
                            <div className="flex items-center gap-2 text-xs">
                              {message.status === 'pending' && (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Pending...</span>
                                </>
                              )}
                              {message.status === 'running' && (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Running{message.currentStep ? `: ${message.currentStep}` : ''}</span>
                                </>
                              )}
                              {message.status === 'completed' && (
                                <span className="text-green-600">✓ Completed</span>
                              )}
                              {message.status === 'failed' && (
                                <span className="text-red-600">✗ Failed</span>
                              )}
                            </div>
                            {message.executionId && (
                              <div className="text-xs opacity-60 mt-1">
                                ID: {message.executionId}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="text-xs opacity-60 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Area */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendTestMessage();
                      }
                    }}
                    placeholder="Type a message to test the agent..."
                    disabled={isTesting}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendTestMessage}
                    disabled={isTesting || !testInput.trim()}
                  >
                    {isTesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
