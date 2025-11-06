"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Play, History, Settings } from 'lucide-react';
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

export function AgentEditorClient({
  agent,
  activeVersion,
  availableTools,
  user,
}: AgentEditorClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Agent metadata
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');

  // Workflow definition from active version
  const [workflowDefinition, setWorkflowDefinition] = useState<AgentDefinition>(
    activeVersion?.workflowDefinition || { nodes: [], edges: [] }
  );

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

  const handleTest = async () => {
    try {
      setIsTesting(true);

      // Call test API endpoint
      const response = await fetch(`/api/agents/${agent.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {}, // Can be customized with a test input dialog
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || 'Test execution failed');
      }

      toast({
        title: 'Test Run Completed',
        description: `Status: ${result.status}. Execution ID: ${result.executionId}`,
      });

      // Optionally show results in a dialog
      console.log('Test execution result:', result);
    } catch (error: any) {
      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to test agent',
        variant: 'destructive',
      });
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
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
              <Play className="w-4 h-4 mr-2" />
              {isTesting ? 'Testing...' : 'Test Run'}
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

      {/* Right Sidebar - Settings */}
      {showSettings && (
        <div className="w-96 border-l bg-white overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Agent Settings</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </Button>
            </div>

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
                    {new Date(agent.updatedAt).toLocaleDateString()}
                  </p>
                  <p>Created By: {user.name || user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
