"use client";

import { useState, useTransition } from 'react';
import { WorkflowBuilder } from '@/components/workflow-builder';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  updateWorkflowDefinition,
  executeWorkflow,
} from '../../actions';
import type { WorkflowDefinition } from '@/lib/types/workflow';

interface WorkflowEditorClientProps {
  workflow: any;
  version: any;
  user: any;
}

export function WorkflowEditorClient({
  workflow,
  version,
  user,
}: WorkflowEditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [currentDefinition, setCurrentDefinition] = useState<WorkflowDefinition>(
    version?.definition || { nodes: [], edges: [] }
  );

  const handleSave = async (definition: WorkflowDefinition) => {
    setCurrentDefinition(definition);

    startTransition(async () => {
      const result = await updateWorkflowDefinition(workflow.id, definition);

      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        alert('Workflow saved successfully!');
      }
    });
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await executeWorkflow(workflow.id, {
        // Add any input data here
      });

      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        setExecutionResult(result.execution);
        alert(
          `Workflow executed! Status: ${result.execution?.status}\nExecution ID: ${result.execution?.executionId}`
        );
      }
    } catch (error) {
      console.error('Execution error:', error);
      alert('Failed to execute workflow');
    } finally {
      setIsExecuting(false);
    }
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
            <h1 className="text-xl font-bold">{workflow.name}</h1>
            <p className="text-sm text-gray-500">{workflow.description}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleExecute}
            disabled={isExecuting}
            variant="outline"
          >
            <Play className="w-4 h-4 mr-2" />
            {isExecuting ? 'Running...' : 'Run Workflow'}
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <WorkflowBuilder
          initialDefinition={currentDefinition}
          onSave={handleSave}
        />
      </div>

      {executionResult && (
        <div className="p-4 border-t bg-gray-50">
          <h3 className="font-bold mb-2">Last Execution Result:</h3>
          <div className="text-sm space-y-1">
            <p>
              <strong>Status:</strong> {executionResult.status}
            </p>
            <p>
              <strong>Duration:</strong> {executionResult.duration}ms
            </p>
            {executionResult.error && (
              <p className="text-red-600">
                <strong>Error:</strong> {executionResult.error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
