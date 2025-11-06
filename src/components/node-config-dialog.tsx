"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeType: string;
  nodeData: any;
  onSave: (data: any) => void;
  providers?: Array<{ id: string; name: string; provider: string; model: string }>;
  tools?: Array<{ id: string; name: string; description: string; type: string }>;
}

export function NodeConfigDialog({
  open,
  onOpenChange,
  nodeType,
  nodeData,
  onSave,
  providers = [],
  tools = [],
}: NodeConfigDialogProps) {
  const [config, setConfig] = useState(nodeData?.config || {});
  const [label, setLabel] = useState(nodeData?.label || '');
  const [description, setDescription] = useState(nodeData?.description || '');

  const handleSave = () => {
    onSave({
      label,
      description,
      config,
    });
    onOpenChange(false);
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const renderAgentConfig = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="provider">LLM Provider</Label>
        <Select
          value={config.providerId || ''}
          onValueChange={(value) => updateConfig('providerId', value)}
        >
          <SelectTrigger id="provider">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name} ({provider.provider}/{provider.model})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="systemPrompt">System Prompt (Optional)</Label>
        <textarea
          id="systemPrompt"
          className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
          placeholder="You are a helpful assistant..."
          value={config.systemPrompt || ''}
          onChange={(e) => updateConfig('systemPrompt', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">User Prompt</Label>
        <textarea
          id="prompt"
          className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md"
          placeholder="Process the following: {{input}}"
          value={config.prompt || ''}
          onChange={(e) => updateConfig('prompt', e.target.value)}
        />
        <p className="text-xs text-gray-500">
          Use {'{'}{'{'} variable {'}'}{'}'} to reference context values
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="temperature">Temperature</Label>
          <Input
            id="temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature || 0.7}
            onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxTokens">Max Tokens</Label>
          <Input
            id="maxTokens"
            type="number"
            min="1"
            max="4000"
            value={config.maxTokens || 1000}
            onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
          />
        </div>
      </div>
    </>
  );

  const renderToolConfig = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="tool">Tool</Label>
        <Select
          value={config.toolId || ''}
          onValueChange={(value) => updateConfig('toolId', value)}
        >
          <SelectTrigger id="tool">
            <SelectValue placeholder="Select tool" />
          </SelectTrigger>
          <SelectContent>
            {tools.map((tool) => (
              <SelectItem key={tool.id} value={tool.id}>
                {tool.name} ({tool.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="toolInput">Tool Input (JSON)</Label>
        <textarea
          id="toolInput"
          className="w-full min-h-[120px] px-3 py-2 text-sm border rounded-md font-mono"
          placeholder='{"url": "{{input.url}}", "method": "GET"}'
          value={
            typeof config.input === 'string'
              ? config.input
              : JSON.stringify(config.input || {}, null, 2)
          }
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              updateConfig('input', parsed);
            } catch {
              updateConfig('input', e.target.value);
            }
          }}
        />
        <p className="text-xs text-gray-500">
          Use {'{'}{'{'} variable {'}'}{'}'} to reference context values
        </p>
      </div>
    </>
  );

  const renderDecisionConfig = () => (
    <div className="space-y-2">
      <Label htmlFor="condition">Condition</Label>
      <Input
        id="condition"
        placeholder="input.value > 10"
        value={config.condition || ''}
        onChange={(e) => updateConfig('condition', e.target.value)}
      />
      <p className="text-xs text-gray-500">
        JavaScript expression evaluated in context
      </p>
    </div>
  );

  const renderDelayConfig = () => (
    <div className="space-y-2">
      <Label htmlFor="delayMs">Delay (milliseconds)</Label>
      <Input
        id="delayMs"
        type="number"
        min="0"
        value={config.delayMs || 1000}
        onChange={(e) => updateConfig('delayMs', parseInt(e.target.value))}
      />
    </div>
  );

  const renderConfig = () => {
    switch (nodeType) {
      case 'agent':
        return renderAgentConfig();
      case 'tool':
        return renderToolConfig();
      case 'decision':
        return renderDecisionConfig();
      case 'delay':
        return renderDelayConfig();
      default:
        return (
          <p className="text-sm text-gray-500">
            No configuration available for this node type
          </p>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configure {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node
          </DialogTitle>
          <DialogDescription>
            Set up the configuration for this workflow node
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="label">Node Label</Label>
            <Input
              id="label"
              placeholder="My Node"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="What does this node do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium text-sm">Node Configuration</h4>
            {renderConfig()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
