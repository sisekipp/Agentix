"use client";

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeTypes,
  NodeMouseHandler,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { ScenarioNodeConfigDialog } from '@/components/scenario-node-config-dialog';
import type { ScenarioDefinition, AgentOption } from '@/lib/types/agent';

// Custom Node Components for Scenarios

const ScenarioTriggerNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-lg rounded-md bg-blue-500 text-white border-2 border-blue-700">
    <div className="font-bold text-sm">🎯 {data.label}</div>
    <div className="text-xs mt-1 opacity-90">
      {data.config?.triggerType || 'trigger'}
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

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
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors] || statusColors.pending}`}>
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">{icon} {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.agentName || 'Select agent'}
      </div>
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
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors] || statusColors.pending}`}>
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">🔀 {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
      </div>
      {/* Create handles for each branch */}
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
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors] || statusColors.pending}`}>
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
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors] || statusColors.pending}`}>
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
    <div className={`px-4 py-2 shadow-lg rounded-md text-white border-2 ${statusColors[status as keyof typeof statusColors] || statusColors.pending}`}>
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

interface ScenarioBuilderProps {
  initialDefinition?: ScenarioDefinition;
  onSave?: (definition: ScenarioDefinition) => void;
  onChange?: (definition: ScenarioDefinition) => void;
  readOnly?: boolean;
  agents?: AgentOption[];
}

export function ScenarioBuilder({
  initialDefinition,
  onSave,
  onChange,
  readOnly = false,
  agents = [],
}: ScenarioBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    (initialDefinition?.nodes || []) as unknown as Node[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (initialDefinition?.edges || []) as unknown as Edge[]
  );
  const [configDialog, setConfigDialog] = useState<{
    open: boolean;
    nodeId: string | null;
    nodeType: string;
    nodeData: any;
  }>({
    open: false,
    nodeId: null,
    nodeType: '',
    nodeData: null,
  });

  // Notify parent of changes whenever nodes or edges update
  React.useEffect(() => {
    if (onChange) {
      const definition: ScenarioDefinition = {
        nodes: nodes as unknown as ScenarioDefinition['nodes'],
        edges: edges as unknown as ScenarioDefinition['edges'],
      };
      onChange(definition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback((event, node) => {
    setConfigDialog({
      open: true,
      nodeId: node.id,
      nodeType: node.type || '',
      nodeData: node.data,
    });
  }, []);

  const handleConfigSave = useCallback(
    (data: any) => {
      if (!configDialog.nodeId) return;

      setNodes((nds) =>
        nds.map((node) =>
          node.id === configDialog.nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      );

      setConfigDialog({ open: false, nodeId: null, nodeType: '', nodeData: null });
    },
    [configDialog.nodeId, setNodes]
  );

  const addNode = useCallback(
    (type: string) => {
      const labels: Record<string, string> = {
        'scenario-trigger': 'Trigger',
        'scenario-agent': 'Agent',
        'scenario-decision': 'Decision',
        'scenario-parallel': 'Parallel',
        'scenario-transform': 'Transform',
        'scenario-end': 'End',
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 400 + 100,
        },
        data: {
          label: labels[type] || type,
          description: 'Configure this node',
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const handleSave = useCallback(() => {
    const definition: ScenarioDefinition = {
      nodes: nodes as unknown as ScenarioDefinition['nodes'],
      edges: edges as unknown as ScenarioDefinition['edges'],
    };

    onSave?.(definition);
  }, [nodes, edges, onSave]);

  const handleClear = useCallback(() => {
    if (confirm('Are you sure you want to clear the entire scenario?')) {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  return (
    <div className="flex flex-col h-full">
      {!readOnly && (
        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 border-b">
          <div className="text-xs font-semibold text-gray-600 w-full mb-1">
            Scenario Nodes
          </div>
          <Button onClick={() => addNode('scenario-trigger')} size="sm" variant="outline">
            🎯 Trigger
          </Button>
          <Button onClick={() => addNode('scenario-agent')} size="sm" variant="outline">
            🤖 Agent
          </Button>
          <Button
            onClick={() => addNode('scenario-decision')}
            size="sm"
            variant="outline"
          >
            🔀 Decision
          </Button>
          <Button
            onClick={() => addNode('scenario-parallel')}
            size="sm"
            variant="outline"
          >
            ⚡ Parallel
          </Button>
          <Button
            onClick={() => addNode('scenario-transform')}
            size="sm"
            variant="outline"
          >
            🔄 Transform
          </Button>
          <Button onClick={() => addNode('scenario-end')} size="sm" variant="outline">
            ✓ End
          </Button>

          <div className="ml-auto flex gap-2">
            <Button onClick={handleClear} size="sm" variant="ghost">
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      <ScenarioNodeConfigDialog
        open={configDialog.open}
        nodeType={configDialog.nodeType}
        nodeData={configDialog.nodeData}
        onSave={handleConfigSave}
        onClose={() =>
          setConfigDialog({ open: false, nodeId: null, nodeType: '', nodeData: null })
        }
        agents={agents}
      />
    </div>
  );
}
