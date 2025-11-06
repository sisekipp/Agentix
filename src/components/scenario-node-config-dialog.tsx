"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AgentOption } from '@/lib/types/agent';
import { Plus, Trash2 } from 'lucide-react';

interface ScenarioNodeConfigDialogProps {
  open: boolean;
  nodeType: string;
  nodeData: any;
  onSave: (data: any) => void;
  onClose: () => void;
  agents?: AgentOption[];
}

export function ScenarioNodeConfigDialog({
  open,
  nodeType,
  nodeData,
  onSave,
  onClose,
  agents = [],
}: ScenarioNodeConfigDialogProps) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    if (nodeData) {
      setLabel(nodeData.label || '');
      setDescription(nodeData.description || '');
      setConfig(nodeData.config || {});
    }
  }, [nodeData]);

  const handleSave = () => {
    onSave({
      label,
      description,
      config,
    });
  };

  const renderConfigFields = () => {
    switch (nodeType) {
      case 'scenario-trigger':
        return (
          <div className="space-y-4">
            <div>
              <Label>Trigger Type</Label>
              <Select
                value={config.triggerType || 'chat'}
                onValueChange={(value) =>
                  setConfig({ ...config, triggerType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">💬 Chat</SelectItem>
                  <SelectItem value="api">🔌 API Call</SelectItem>
                  <SelectItem value="webhook">🔗 Webhook</SelectItem>
                  <SelectItem value="schedule">⏰ Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.triggerType === 'chat' && (
              <div>
                <Label>Welcome Message</Label>
                <Textarea
                  value={config.welcomeMessage || ''}
                  onChange={(e) =>
                    setConfig({ ...config, welcomeMessage: e.target.value })
                  }
                  placeholder="Hello! How can I help you today?"
                />
              </div>
            )}

            {config.triggerType === 'schedule' && (
              <div>
                <Label>Cron Expression</Label>
                <Input
                  value={config.cronExpression || ''}
                  onChange={(e) =>
                    setConfig({ ...config, cronExpression: e.target.value })
                  }
                  placeholder="0 0 * * *"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: 0 0 * * * (daily at midnight)
                </p>
              </div>
            )}
          </div>
        );

      case 'scenario-agent':
        return (
          <div className="space-y-4">
            <div>
              <Label>Select Agent</Label>
              <Select
                value={config.agentId || ''}
                onValueChange={(value) => {
                  const selectedAgent = agents.find((a) => a.id === value);
                  setConfig({
                    ...config,
                    agentId: value,
                    agentName: selectedAgent?.name || '',
                    agentIcon: selectedAgent?.icon || '🤖',
                  });
                  // Update label to match agent name
                  if (selectedAgent) {
                    setLabel(selectedAgent.name);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">
                      No agents available. Create one first!
                    </div>
                  ) : (
                    agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.icon} {agent.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {config.agentId && (
              <div>
                <Label>Input Mapping (JSON)</Label>
                <Textarea
                  value={
                    typeof config.input === 'string'
                      ? config.input
                      : JSON.stringify(config.input || { message: '{{trigger.input}}' }, null, 2)
                  }
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setConfig({ ...config, input: parsed });
                    } catch {
                      // Keep as string if invalid JSON
                      setConfig({ ...config, input: e.target.value });
                    }
                  }}
                  placeholder='{"message": "{{trigger.input}}"}'
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use {`{{variable}}`} for template variables (e.g., {`{{trigger.input}}`})
                </p>
              </div>
            )}
          </div>
        );

      case 'scenario-decision':
        const branches = config.branches || [
          { condition: 'default', label: 'Default' },
        ];

        return (
          <div className="space-y-4">
            <div>
              <Label>Decision Branches</Label>
              <div className="space-y-2 mt-2">
                {branches.map((branch: any, index: number) => (
                  <div key={index} className="flex gap-2 items-start p-2 border rounded">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={branch.label || ''}
                        onChange={(e) => {
                          const newBranches = [...branches];
                          newBranches[index] = {
                            ...newBranches[index],
                            label: e.target.value,
                          };
                          setConfig({ ...config, branches: newBranches });
                        }}
                        placeholder="Branch label"
                      />
                      <Input
                        value={branch.condition || ''}
                        onChange={(e) => {
                          const newBranches = [...branches];
                          newBranches[index] = {
                            ...newBranches[index],
                            condition: e.target.value,
                          };
                          setConfig({ ...config, branches: newBranches });
                        }}
                        placeholder='{{agent-1.output.category}} == "billing"'
                        className="font-mono text-xs"
                      />
                    </div>
                    {branches.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newBranches = branches.filter(
                            (_: any, i: number) => i !== index
                          );
                          setConfig({ ...config, branches: newBranches });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  const newBranches = [
                    ...branches,
                    { condition: '', label: `Branch ${branches.length + 1}` },
                  ];
                  setConfig({ ...config, branches: newBranches });
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Branch
              </Button>
            </div>
          </div>
        );

      case 'scenario-parallel':
        const parallelAgents = config.agents || [];

        return (
          <div className="space-y-4">
            <div>
              <Label>Parallel Agents</Label>
              <div className="space-y-2 mt-2">
                {parallelAgents.map((agentConfig: any, index: number) => (
                  <div key={index} className="flex gap-2 items-center p-2 border rounded">
                    <Select
                      value={agentConfig.agentId || ''}
                      onValueChange={(value) => {
                        const selectedAgent = agents.find((a) => a.id === value);
                        const newAgents = [...parallelAgents];
                        newAgents[index] = {
                          ...newAgents[index],
                          agentId: value,
                          agentName: selectedAgent?.name || '',
                        };
                        setConfig({ ...config, agents: newAgents });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.icon} {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const newAgents = parallelAgents.filter(
                          (_: any, i: number) => i !== index
                        );
                        setConfig({ ...config, agents: newAgents });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  const newAgents = [
                    ...parallelAgents,
                    { agentId: '', agentName: '', input: {} },
                  ];
                  setConfig({ ...config, agents: newAgents });
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Agent
              </Button>
            </div>
          </div>
        );

      case 'scenario-transform':
        return (
          <div className="space-y-4">
            <div>
              <Label>Transform Type</Label>
              <Select
                value={config.transformType || 'select'}
                onValueChange={(value) =>
                  setConfig({ ...config, transformType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">Select Fields</SelectItem>
                  <SelectItem value="map">Map/Rename Fields</SelectItem>
                  <SelectItem value="filter">Filter Array</SelectItem>
                  <SelectItem value="merge">Merge Objects</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Transform Config (JSON)</Label>
              <Textarea
                value={
                  typeof config.transformConfig === 'string'
                    ? config.transformConfig
                    : JSON.stringify(config.transformConfig || {}, null, 2)
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setConfig({ ...config, transformConfig: parsed });
                  } catch {
                    setConfig({ ...config, transformConfig: e.target.value });
                  }
                }}
                placeholder='{"fields": ["id", "name"]}'
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          </div>
        );

      case 'scenario-end':
        return (
          <div className="space-y-4">
            <div>
              <Label>Output Mapping (JSON)</Label>
              <Textarea
                value={
                  typeof config.output === 'string'
                    ? config.output
                    : JSON.stringify(config.output || {}, null, 2)
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setConfig({ ...config, output: parsed });
                  } catch {
                    setConfig({ ...config, output: e.target.value });
                  }
                }}
                placeholder='{"result": "{{agent-1.output}}"}'
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Define the final output structure
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-500">
            No additional configuration needed for this node type.
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {nodeType} Node</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Node label"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Node description"
            />
          </div>

          {renderConfigFields()}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
