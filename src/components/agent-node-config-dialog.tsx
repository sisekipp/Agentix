"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Plus, X } from 'lucide-react';
import type { Node } from '@xyflow/react';

interface AgentNodeConfigDialogProps {
  node: Node;
  availableTools: any[];
  availableProviders: any[];
  onSave: (nodeId: string, config: any, label: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export function AgentNodeConfigDialog({
  node,
  availableTools,
  availableProviders,
  onSave,
  onDelete,
  onClose,
}: AgentNodeConfigDialogProps) {
  const [label, setLabel] = useState(node.data.label || '');
  const [config, setConfig] = useState(node.data.config || {});

  const handleSave = () => {
    onSave(node.id, config, label);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id);
    }
  };

  const renderConfigForm = () => {
    switch (node.type) {
      case 'trigger':
        return (
          <div className="space-y-4">
            <div>
              <Label>Trigger Type</Label>
              <Select
                value={config.triggerType || 'manual'}
                onValueChange={(value) =>
                  setConfig({ ...config, triggerType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="input">Input Data</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.triggerType === 'input' && (
              <div>
                <Label>Input Schema</Label>
                <Textarea
                  value={config.inputSchema || ''}
                  onChange={(e) =>
                    setConfig({ ...config, inputSchema: e.target.value })
                  }
                  placeholder='{"field": "type"}'
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  JSON schema for expected input
                </p>
              </div>
            )}
          </div>
        );

      case 'agent/LLM':
        return (
          <div className="space-y-4">
            <div>
              <Label>LLM Provider</Label>
              <Select
                value={config.llmProviderId || ''}
                onValueChange={(value) => {
                  const selectedProvider = availableProviders.find((p) => p.id === value);
                  setConfig({
                    ...config,
                    llmProviderId: value,
                    model: selectedProvider?.model || config.model
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select LLM provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">
                      No LLM providers configured. Please add one in team settings.
                    </div>
                  ) : (
                    availableProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} ({provider.provider} - {provider.model})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Select which API key/provider to use for this LLM call
              </p>
            </div>

            <div>
              <Label>Model</Label>
              <Select
                value={config.model || 'gpt-4'}
                onValueChange={(value) => setConfig({ ...config, model: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prompt</Label>
              <Textarea
                value={config.prompt || ''}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="Enter the prompt for the LLM..."
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {'{{variable}}'} for dynamic values
              </p>
            </div>

            <div>
              <Label>Temperature</Label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature || 0.7}
                onChange={(e) =>
                  setConfig({ ...config, temperature: parseFloat(e.target.value) })
                }
              />
            </div>

            <div>
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min="1"
                max="8000"
                value={config.maxTokens || 1000}
                onChange={(e) =>
                  setConfig({ ...config, maxTokens: parseInt(e.target.value) })
                }
              />
            </div>
          </div>
        );

      case 'tool':
        return (
          <div className="space-y-4">
            <div>
              <Label>Select Tool</Label>
              <Select
                value={config.toolId || ''}
                onValueChange={(value) => {
                  const selectedTool = availableTools.find((t) => t.id === value);
                  setConfig({
                    ...config,
                    toolId: value,
                    toolName: selectedTool?.name || '',
                    toolIcon: selectedTool?.icon || '🔧',
                  });
                  if (selectedTool) {
                    setLabel(selectedTool.name);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tool..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTools.map((tool) => (
                    <SelectItem key={tool.id} value={tool.id}>
                      {tool.icon} {tool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tool Parameters</Label>
              <Textarea
                value={config.parameters || ''}
                onChange={(e) =>
                  setConfig({ ...config, parameters: e.target.value })
                }
                placeholder='{"param1": "{{value}}"}'
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                JSON object with tool parameters. Use {'{{variable}}'} for dynamic values.
              </p>
            </div>
          </div>
        );

      case 'decision':
        const branches = config.branches || [{ condition: '', label: 'Branch 1' }];
        return (
          <div className="space-y-4">
            <div>
              <Label>Decision Variable</Label>
              <Input
                value={config.variable || ''}
                onChange={(e) =>
                  setConfig({ ...config, variable: e.target.value })
                }
                placeholder="{{variable}}"
              />
              <p className="text-xs text-gray-500 mt-1">
                The variable to evaluate for branching
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Branches</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newBranches = [
                      ...branches,
                      { condition: '', label: `Branch ${branches.length + 1}` },
                    ];
                    setConfig({ ...config, branches: newBranches });
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Branch
                </Button>
              </div>

              <div className="space-y-2">
                {branches.map((branch: any, index: number) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Branch {index + 1}
                      </span>
                      {branches.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newBranches = branches.filter(
                              (_: any, i: number) => i !== index
                            );
                            setConfig({ ...config, branches: newBranches });
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      value={branch.label || ''}
                      onChange={(e) => {
                        const newBranches = [...branches];
                        newBranches[index].label = e.target.value;
                        setConfig({ ...config, branches: newBranches });
                      }}
                      placeholder="Branch label"
                      className="mb-2"
                    />
                    <Input
                      value={branch.condition || ''}
                      onChange={(e) => {
                        const newBranches = [...branches];
                        newBranches[index].condition = e.target.value;
                        setConfig({ ...config, branches: newBranches });
                      }}
                      placeholder="Condition (e.g., > 10, == 'yes')"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'action':
        return (
          <div className="space-y-4">
            <div>
              <Label>Action Type</Label>
              <Select
                value={config.actionType || 'custom'}
                onValueChange={(value) =>
                  setConfig({ ...config, actionType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="api-call">API Call</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.actionType === 'api-call' && (
              <>
                <div>
                  <Label>API Endpoint</Label>
                  <Input
                    value={config.endpoint || ''}
                    onChange={(e) =>
                      setConfig({ ...config, endpoint: e.target.value })
                    }
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
                <div>
                  <Label>Method</Label>
                  <Select
                    value={config.method || 'GET'}
                    onValueChange={(value) =>
                      setConfig({ ...config, method: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label>Parameters</Label>
              <Textarea
                value={config.parameters || ''}
                onChange={(e) =>
                  setConfig({ ...config, parameters: e.target.value })
                }
                placeholder='{"key": "{{value}}"}'
                rows={4}
              />
            </div>
          </div>
        );

      case 'transform':
        return (
          <div className="space-y-4">
            <div>
              <Label>Transform Type</Label>
              <Select
                value={config.transformType || 'map'}
                onValueChange={(value) =>
                  setConfig({ ...config, transformType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select transform type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="map">Map</SelectItem>
                  <SelectItem value="filter">Filter</SelectItem>
                  <SelectItem value="reduce">Reduce</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Transformation Code</Label>
              <Textarea
                value={config.code || ''}
                onChange={(e) => setConfig({ ...config, code: e.target.value })}
                placeholder="// JavaScript code to transform data"
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Write JavaScript to transform the input data
              </p>
            </div>
          </div>
        );

      case 'delay':
        return (
          <div className="space-y-4">
            <div>
              <Label>Duration</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={parseInt(config.duration) || 1}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    const unit = config.durationUnit || 's';
                    setConfig({
                      ...config,
                      duration: value,
                      durationUnit: unit,
                    });
                    setLabel(`Wait ${value}${unit}`);
                  }}
                  className="flex-1"
                />
                <Select
                  value={config.durationUnit || 's'}
                  onValueChange={(value) => {
                    const duration = parseInt(config.duration) || 1;
                    setConfig({
                      ...config,
                      durationUnit: value,
                    });
                    setLabel(`Wait ${duration}${value}`);
                  }}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ms">ms</SelectItem>
                    <SelectItem value="s">s</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="h">h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={config.description || ''}
                onChange={(e) =>
                  setConfig({ ...config, description: e.target.value })
                }
                placeholder="Why is this delay needed?"
              />
            </div>
          </div>
        );

      default:
        return <div>No configuration available for this node type.</div>;
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Node</DialogTitle>
          <DialogDescription>
            Configure the settings for this {node.type} node.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Node Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a label for this node"
            />
          </div>

          {renderConfigForm()}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Node
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
