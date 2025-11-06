"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ScenarioDefinition } from '@/lib/types/agent';

interface ExecutionDetailClientProps {
  scenario: any;
  execution: any;
  user: any;
}

// Custom Node Components with status visualization
const ScenarioTriggerNode = ({ data }: { data: any }) => {
  const status = data.status || 'pending';
  const statusColors = {
    pending: 'bg-gray-500 border-gray-700',
    running: 'bg-yellow-500 border-yellow-700 animate-pulse',
    completed: 'bg-green-500 border-green-700',
    failed: 'bg-red-500 border-red-700',
  };

  return (
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors]}`}>
      <div className="font-bold text-sm">🎯 {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.triggerType || 'trigger'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const ScenarioAgentNode = ({ data }: { data: any }) => {
  const icon = data.config?.agentIcon || '🤖';
  const status = data.status || 'pending';

  const statusColors = {
    pending: 'bg-gray-500 border-gray-700',
    running: 'bg-yellow-500 border-yellow-700 animate-pulse',
    completed: 'bg-green-500 border-green-700',
    failed: 'bg-red-500 border-red-700',
  };

  return (
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors]}`}>
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">{icon} {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.agentName || 'Select agent'}
      </div>
      {data.duration && (
        <div className="text-xs mt-1 opacity-75">
          {formatDuration(data.duration)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const ScenarioDecisionNode = ({ data }: { data: any }) => {
  const branches = data.config?.branches || [];
  const status = data.status || 'pending';

  const statusColors = {
    pending: 'bg-gray-500 border-gray-700',
    running: 'bg-yellow-500 border-yellow-700 animate-pulse',
    completed: 'bg-green-500 border-green-700',
    failed: 'bg-red-500 border-red-700',
  };

  return (
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors]}`}>
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">🔀 {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
      </div>
      {branches.map((_: any, i: number) => (
        <Handle
          key={i}
          type="source"
          position={Position.Bottom}
          id={`branch-${i}`}
          style={{ left: `${((i + 1) / (branches.length + 1)) * 100}%` }}
        />
      ))}
    </div>
  );
};

const ScenarioParallelNode = ({ data }: { data: any }) => {
  const agents = data.config?.agents || [];
  const status = data.status || 'pending';

  const statusColors = {
    pending: 'bg-gray-500 border-gray-700',
    running: 'bg-yellow-500 border-yellow-700 animate-pulse',
    completed: 'bg-green-500 border-green-700',
    failed: 'bg-red-500 border-red-700',
  };

  return (
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors]}`}>
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">⚡ {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {agents.length} parallel {agents.length === 1 ? 'agent' : 'agents'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const ScenarioTransformNode = ({ data }: { data: any }) => {
  const status = data.status || 'pending';

  const statusColors = {
    pending: 'bg-gray-500 border-gray-700',
    running: 'bg-yellow-500 border-yellow-700 animate-pulse',
    completed: 'bg-green-500 border-green-700',
    failed: 'bg-red-500 border-red-700',
  };

  return (
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors]}`}>
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">🔄 {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.transformType || 'transform'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const ScenarioEndNode = ({ data }: { data: any }) => {
  const status = data.status || 'pending';

  const statusColors = {
    pending: 'bg-gray-500 border-gray-700',
    running: 'bg-yellow-500 border-yellow-700 animate-pulse',
    completed: 'bg-green-500 border-green-700',
    failed: 'bg-red-500 border-red-700',
  };

  return (
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors]}`}>
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">✓ {data.label}</div>
      <div className="text-xs mt-1 opacity-90">End</div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  'scenario-trigger': ScenarioTriggerNode,
  'scenario-agent': ScenarioAgentNode,
  'scenario-decision': ScenarioDecisionNode,
  'scenario-parallel': ScenarioParallelNode,
  'scenario-transform': ScenarioTransformNode,
  'scenario-end': ScenarioEndNode,
};

function formatDuration(duration?: number) {
  if (!duration) return '-';
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ExecutionDetailClient({
  scenario,
  execution,
  user,
}: ExecutionDetailClientProps) {
  const router = useRouter();
  const [selectedAgentExecution, setSelectedAgentExecution] = useState<any>(null);

  // Parse orchestration definition
  const definition: ScenarioDefinition = scenario.orchestrationDefinition as ScenarioDefinition;

  // Build a map of node statuses based on agent executions
  const nodeStatusMap = new Map<string, { status: string; duration?: number }>();

  // Mark trigger as completed (it always runs first)
  const triggerNode = definition.nodes.find(n => n.type === 'scenario-trigger');
  if (triggerNode) {
    nodeStatusMap.set(triggerNode.id, { status: 'completed' });
  }

  // Map agent executions to their scenario nodes
  execution.agentExecutions?.forEach((agentExec: any) => {
    if (agentExec.scenarioNodeId) {
      nodeStatusMap.set(agentExec.scenarioNodeId, {
        status: agentExec.status,
        duration: agentExec.duration,
      });
    }
  });

  // Update nodes with execution status
  const nodesWithStatus: Node[] = definition.nodes.map((node) => {
    const statusInfo = nodeStatusMap.get(node.id);
    return {
      ...node,
      data: {
        ...node.data,
        status: statusInfo?.status || 'pending',
        duration: statusInfo?.duration,
      },
    } as Node;
  });

  const edges: Edge[] = definition.edges as unknown as Edge[];

  // Get status icon and color
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'running':
        return <PlayCircle className="w-5 h-5 text-yellow-600 animate-pulse" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      running: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      pending: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Flow Visualization */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/dashboard/scenarios/${scenario.id}/executions`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Executions
            </Button>
            <div>
              <h1 className="text-xl font-bold">{scenario.name}</h1>
              <p className="text-sm text-gray-500">
                Execution from {formatDate(execution.startedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {getStatusIcon(execution.status)}
            {getStatusBadge(execution.status)}
            {execution.duration && (
              <span className="text-sm text-gray-600">
                Duration: {formatDuration(execution.duration)}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1">
          <ReactFlow
            nodes={nodesWithStatus}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            onNodeClick={(_, node) => {
              // Find agent execution for this node
              const agentExec = execution.agentExecutions?.find(
                (ae: any) => ae.scenarioNodeId === node.id
              );
              if (agentExec) {
                setSelectedAgentExecution(agentExec);
              }
            }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>

      {/* Right Panel - Agent Execution Details */}
      <div className="w-96 border-l bg-white overflow-y-auto">
        {selectedAgentExecution ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Agent Execution</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAgentExecution(null)}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className="mt-1">{getStatusBadge(selectedAgentExecution.status)}</div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Started</p>
                <p className="text-sm mt-1">{formatDate(selectedAgentExecution.startedAt)}</p>
              </div>

              {selectedAgentExecution.completedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-sm mt-1">
                    {formatDate(selectedAgentExecution.completedAt)}
                  </p>
                </div>
              )}

              {selectedAgentExecution.duration && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Duration</p>
                  <p className="text-sm mt-1">
                    {formatDuration(selectedAgentExecution.duration)}
                  </p>
                </div>
              )}

              {selectedAgentExecution.error && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Error</p>
                  <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    {selectedAgentExecution.error}
                  </div>
                </div>
              )}

              {selectedAgentExecution.input && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Input</p>
                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedAgentExecution.input, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAgentExecution.output && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Output</p>
                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedAgentExecution.output, null, 2)}
                  </pre>
                </div>
              )}

              {/* Execution Steps */}
              {selectedAgentExecution.steps && selectedAgentExecution.steps.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Execution Steps</p>
                  <div className="space-y-2">
                    {selectedAgentExecution.steps.map((step: any) => (
                      <div
                        key={step.id}
                        className="p-3 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">
                            Step {step.stepIndex + 1}: {step.nodeType}
                          </span>
                          {getStatusBadge(step.status)}
                        </div>

                        {step.nodeId && (
                          <p className="text-xs text-gray-600 mb-1">Node: {step.nodeId}</p>
                        )}

                        {step.duration && (
                          <p className="text-xs text-gray-600">
                            Duration: {formatDuration(step.duration)}
                          </p>
                        )}

                        {step.error && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                            {step.error}
                          </div>
                        )}

                        {step.output && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer">
                              View Output
                            </summary>
                            <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                              {JSON.stringify(step.output, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h2 className="text-lg font-bold mb-4">Agent Executions</h2>

            {execution.agentExecutions && execution.agentExecutions.length > 0 ? (
              <div className="space-y-2">
                {execution.agentExecutions.map((agentExec: any) => (
                  <button
                    key={agentExec.id}
                    onClick={() => setSelectedAgentExecution(agentExec)}
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {agentExec.scenarioNodeId || 'Unknown Agent'}
                      </span>
                      {getStatusIcon(agentExec.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{formatDate(agentExec.startedAt)}</span>
                      {agentExec.duration && (
                        <span>{formatDuration(agentExec.duration)}</span>
                      )}
                    </div>
                    {agentExec.steps && (
                      <p className="text-xs text-gray-500 mt-1">
                        {agentExec.steps.length} {agentExec.steps.length === 1 ? 'step' : 'steps'}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">No agent executions yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
