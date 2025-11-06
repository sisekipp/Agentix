"use client";

import { useState, useTransition, useCallback } from 'react';
import { ScenarioBuilder } from '@/components/scenario-builder';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Save, MessageSquare, List } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  updateScenarioDefinition,
  executeScenario,
} from '../../agent-actions';
import type { ScenarioDefinition } from '@/lib/types/agent';
import { useToast } from '@/hooks/use-toast';

interface ScenarioEditorClientProps {
  scenario: any;
  version: any;
  user: any;
  agents?: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
  }>;
}

export function ScenarioEditorClient({
  scenario,
  version,
  user,
  agents = [],
}: ScenarioEditorClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [currentDefinition, setCurrentDefinition] = useState<ScenarioDefinition>(
    version?.orchestrationDefinition || { nodes: [], edges: [] }
  );

  const handleChange = useCallback((definition: ScenarioDefinition) => {
    setCurrentDefinition(definition);
  }, []);

  const handleSave = async () => {
    startTransition(async () => {
      const result = await updateScenarioDefinition(scenario.id, currentDefinition);

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Scenario saved',
          description: 'Your scenario has been saved successfully.',
        });
      }
    });
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      // Call test API endpoint
      const response = await fetch(`/api/scenarios/${scenario.id}/test`, {
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

      setExecutionResult(result);
      toast({
        title: 'Scenario executed',
        description: `Status: ${result.status}. Navigating to execution details...`,
      });

      // Navigate to execution details
      if (result.executionId) {
        router.push(`/dashboard/scenarios/${scenario.id}/executions/${result.executionId}`);
      }
    } catch (error: any) {
      console.error('Execution error:', error);
      toast({
        title: 'Execution failed',
        description: error.message || 'Failed to execute scenario',
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleChat = () => {
    // Navigate to chat interface
    router.push(`/dashboard/scenarios/${scenario.id}/chat`);
  };

  const handleExecutions = () => {
    // Navigate to executions list
    router.push(`/dashboard/scenarios/${scenario.id}/executions`);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">{scenario.name}</h1>
            <p className="text-sm text-gray-500">
              {scenario.description}
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                {scenario.triggerType}
              </span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {scenario.triggerType === 'chat' && (
            <Button
              onClick={handleChat}
              variant="outline"
              size="sm"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Open Chat
            </Button>
          )}

          <Button
            onClick={handleExecutions}
            variant="outline"
            size="sm"
          >
            <List className="w-4 h-4 mr-2" />
            Executions
          </Button>

          <Button
            onClick={handleExecute}
            disabled={isExecuting}
            variant="outline"
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" />
            {isExecuting ? 'Running...' : 'Test Run'}
          </Button>

          <Button
            onClick={handleSave}
            disabled={isPending}
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScenarioBuilder
          initialDefinition={currentDefinition}
          onChange={handleChange}
          agents={agents}
        />
      </div>

      {executionResult && (
        <div className="p-4 border-t bg-gray-50">
          <h3 className="font-semibold mb-2">Execution Result</h3>
          <div className="text-sm">
            <p>
              <strong>Status:</strong>{' '}
              <span
                className={`px-2 py-1 rounded ${
                  executionResult.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : executionResult.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {executionResult.status}
              </span>
            </p>
            <p>
              <strong>Duration:</strong> {executionResult.duration}ms
            </p>
            {executionResult.error && (
              <p className="text-red-600">
                <strong>Error:</strong> {executionResult.error}
              </p>
            )}
            {executionResult.agentExecutions && executionResult.agentExecutions.length > 0 && (
              <div className="mt-2">
                <strong>Agent Executions:</strong>
                <ul className="ml-4 mt-1">
                  {executionResult.agentExecutions.map((ae: any, i: number) => (
                    <li key={i} className="text-xs">
                      {ae.agentName}: {ae.status} ({ae.duration}ms)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
