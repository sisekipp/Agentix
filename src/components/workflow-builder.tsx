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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { NodeConfigDialog } from '@/components/node-config-dialog';
import type { WorkflowDefinition } from '@/lib/types/workflow';

// Custom Node Components
const TriggerNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-blue-500 text-white border-2 border-blue-700">
    <div className="font-bold">🚀 {data.label}</div>
    <div className="text-xs">{data.description}</div>
  </div>
);

const AgentNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-purple-500 text-white border-2 border-purple-700">
    <div className="font-bold">🤖 {data.label}</div>
    <div className="text-xs">{data.description}</div>
  </div>
);

const ToolNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-green-500 text-white border-2 border-green-700">
    <div className="font-bold">🔧 {data.label}</div>
    <div className="text-xs">{data.description}</div>
  </div>
);

const DecisionNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-yellow-500 text-white border-2 border-yellow-700">
    <div className="font-bold">🔀 {data.label}</div>
    <div className="text-xs">{data.description}</div>
  </div>
);

const ActionNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-red-500 text-white border-2 border-red-700">
    <div className="font-bold">⚡ {data.label}</div>
    <div className="text-xs">{data.description}</div>
  </div>
);

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  tool: ToolNode,
  decision: DecisionNode,
  action: ActionNode,
};

interface WorkflowBuilderProps {
  initialDefinition?: WorkflowDefinition;
  onSave?: (definition: WorkflowDefinition) => void;
  readOnly?: boolean;
  providers?: Array<{ id: string; name: string; provider: string; model: string }>;
  tools?: Array<{ id: string; name: string; description: string; type: string }>;
}

export function WorkflowBuilder({
  initialDefinition,
  onSave,
  readOnly = false,
  providers = [],
  tools = [],
}: WorkflowBuilderProps) {
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
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position: {
          x: Math.random() * 400,
          y: Math.random() * 400,
        },
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          description: 'Configure this node',
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const handleSave = useCallback(() => {
    const definition: WorkflowDefinition = {
      nodes: nodes as unknown as WorkflowDefinition['nodes'],
      edges: edges as unknown as WorkflowDefinition['edges'],
    };

    onSave?.(definition);
  }, [nodes, edges, onSave]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  return (
    <div className="flex flex-col h-full">
      {!readOnly && (
        <div className="flex gap-2 p-4 bg-gray-50 border-b">
          <Button onClick={() => addNode('trigger')} size="sm">
            Add Trigger
          </Button>
          <Button onClick={() => addNode('agent')} size="sm" variant="outline">
            Add Agent
          </Button>
          <Button onClick={() => addNode('tool')} size="sm" variant="outline">
            Add Tool
          </Button>
          <Button
            onClick={() => addNode('decision')}
            size="sm"
            variant="outline"
          >
            Add Decision
          </Button>
          <Button
            onClick={() => addNode('action')}
            size="sm"
            variant="outline"
          >
            Add Action
          </Button>
          <div className="flex-1" />
          <Button onClick={handleClear} size="sm" variant="destructive">
            Clear
          </Button>
          <Button onClick={handleSave} size="sm">
            Save Workflow
          </Button>
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
          className="bg-gray-100"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      <NodeConfigDialog
        open={configDialog.open}
        onOpenChange={(open) =>
          setConfigDialog((prev) => ({ ...prev, open }))
        }
        nodeType={configDialog.nodeType}
        nodeData={configDialog.nodeData}
        onSave={handleConfigSave}
        providers={providers}
        tools={tools}
      />
    </div>
  );
}
