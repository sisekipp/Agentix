"use client";

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { AgentDefinition, AgentNodeType } from '@/lib/types/agent';
import { AgentNodeConfigDialog } from './agent-node-config-dialog';

interface AgentBuilderProps {
  definition: AgentDefinition;
  onChange: (definition: AgentDefinition) => void;
  availableTools: any[];
  availableProviders: any[];
}

// Custom Node Components
const TriggerNode = ({ data }: { data: any }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md bg-blue-500 text-white border-2 border-blue-700">
      <div className="font-bold text-sm">🎯 {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.triggerType || 'Manual'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const AgentLLMNode = ({ data }: { data: any }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md bg-purple-500 text-white border-2 border-purple-700">
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">🤖 {data.label}</div>
      <div className="text-xs mt-1 opacity-90">LLM</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const ToolNode = ({ data }: { data: any }) => {
  const icon = data.config?.toolIcon || '🔧';
  return (
    <div className="px-4 py-2 shadow-lg rounded-md bg-green-500 text-white border-2 border-green-700">
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">{icon} {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.toolName || 'Select tool'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const DecisionNode = ({ data }: { data: any }) => {
  const branches = data.config?.branches || [];
  return (
    <div className="px-4 py-2 shadow-lg rounded-md bg-yellow-500 text-white border-2 border-yellow-700">
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

const ActionNode = ({ data }: { data: any }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md bg-orange-500 text-white border-2 border-orange-700">
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">⚡ {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.actionType || 'Action'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const TransformNode = ({ data }: { data: any }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md bg-indigo-500 text-white border-2 border-indigo-700">
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">🔄 {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.transformType || 'Transform'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const DelayNode = ({ data }: { data: any }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md bg-gray-500 text-white border-2 border-gray-700">
      <Handle type="target" position={Position.Top} />
      <div className="font-bold text-sm">⏱️ {data.label}</div>
      <div className="text-xs mt-1 opacity-90">
        {data.config?.duration || '1s'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  'agent/LLM': AgentLLMNode,
  tool: ToolNode,
  decision: DecisionNode,
  action: ActionNode,
  transform: TransformNode,
  delay: DelayNode,
};

const NODE_TYPE_INFO: Record<
  AgentNodeType,
  { label: string; icon: string; description: string }
> = {
  trigger: {
    label: 'Trigger',
    icon: '🎯',
    description: 'Start of the agent workflow',
  },
  'agent/LLM': {
    label: 'LLM',
    icon: '🤖',
    description: 'AI model processing',
  },
  tool: {
    label: 'Tool',
    icon: '🔧',
    description: 'Execute a tool or API',
  },
  decision: {
    label: 'Decision',
    icon: '🔀',
    description: 'Conditional branching',
  },
  action: {
    label: 'Action',
    icon: '⚡',
    description: 'Execute an action',
  },
  transform: {
    label: 'Transform',
    icon: '🔄',
    description: 'Transform data',
  },
  delay: {
    label: 'Delay',
    icon: '⏱️',
    description: 'Wait for a duration',
  },
};

export function AgentBuilder({
  definition,
  onChange,
  availableTools,
  availableProviders,
}: AgentBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(definition.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(definition.edges as Edge[]);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge(params, edges);
      setEdges(newEdges);
      onChange({ nodes, edges: newEdges as any });
    },
    [edges, nodes, onChange, setEdges]
  );

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      // Update definition after a short delay to batch changes
      setTimeout(() => {
        onChange({ nodes, edges });
      }, 100);
    },
    [onNodesChange, nodes, edges, onChange]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      // Update definition after a short delay to batch changes
      setTimeout(() => {
        onChange({ nodes, edges });
      }, 100);
    },
    [onEdgesChange, nodes, edges, onChange]
  );

  const addNode = (type: AgentNodeType) => {
    const info = NODE_TYPE_INFO[type];
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: {
        label: info.label,
        config: {},
      },
    };

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    onChange({ nodes: newNodes, edges });
    setShowNodeMenu(false);
  };

  const handleNodeDoubleClick = (_: any, node: Node) => {
    setSelectedNode(node);
    setShowConfigDialog(true);
  };

  const handleConfigSave = (nodeId: string, config: any, label: string) => {
    const updatedNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, config, label } } : n
    );
    setNodes(updatedNodes);
    onChange({ nodes: updatedNodes, edges });
    setShowConfigDialog(false);
    setSelectedNode(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    const updatedNodes = nodes.filter((n) => n.id !== nodeId);
    const updatedEdges = edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId
    );
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    onChange({ nodes: updatedNodes, edges: updatedEdges });
    setShowConfigDialog(false);
    setSelectedNode(null);
  };

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Add Node Button */}
      <div className="absolute top-4 left-4 z-10">
        <Button onClick={() => setShowNodeMenu(!showNodeMenu)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Node
        </Button>

        {showNodeMenu && (
          <div className="mt-2 p-2 bg-white rounded-lg shadow-xl border max-w-md">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(NODE_TYPE_INFO) as AgentNodeType[]).map((type) => {
                const info = NODE_TYPE_INFO[type];
                return (
                  <button
                    key={type}
                    onClick={() => addNode(type)}
                    className="p-3 text-left hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                  >
                    <div className="font-medium text-sm">
                      {info.icon} {info.label}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {info.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Node Configuration Dialog */}
      {showConfigDialog && selectedNode && (
        <AgentNodeConfigDialog
          node={selectedNode}
          availableTools={availableTools}
          availableProviders={availableProviders}
          onSave={handleConfigSave}
          onDelete={handleDeleteNode}
          onClose={() => {
            setShowConfigDialog(false);
            setSelectedNode(null);
          }}
        />
      )}
    </div>
  );
}
