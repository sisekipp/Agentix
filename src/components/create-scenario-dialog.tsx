"use client";

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { createScenario } from '@/app/dashboard/agent-actions';
import { useRouter } from 'next/navigation';
import { MessageSquare, Zap, Webhook, Clock } from 'lucide-react';

interface CreateScenarioDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  teams: any[];
}

const TRIGGER_TYPES = [
  {
    value: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    description: 'Interactive conversation with message history',
  },
  {
    value: 'api',
    label: 'API Call',
    icon: Zap,
    description: 'One-time execution via API endpoint',
  },
  {
    value: 'webhook',
    label: 'Webhook',
    icon: Webhook,
    description: 'Triggered by external webhook events',
  },
  {
    value: 'schedule',
    label: 'Schedule',
    icon: Clock,
    description: 'Automated execution on schedule (cron)',
  },
];

export function CreateScenarioDialog({
  open,
  onClose,
  onSuccess,
  teams,
}: CreateScenarioDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [triggerType, setTriggerType] = useState('chat');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !teamId || !triggerType) {
      alert('Name, team, and trigger type are required');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('teamId', teamId);
      formData.append('triggerType', triggerType);

      const result = await createScenario(formData);

      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        // Reset form
        setName('');
        setDescription('');
        setTriggerType('chat');

        // Navigate to scenario editor
        if (result.scenario?.id) {
          router.push(`/dashboard/scenarios/${result.scenario.id}`);
        }

        onSuccess?.();
      }
    });
  };

  const selectedTrigger = TRIGGER_TYPES.find((t) => t.value === triggerType);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Scenario</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">Name*</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Scenario"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this scenario do?"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="team">Team*</Label>
            <Select value={teamId} onValueChange={setTeamId} required>
              <SelectTrigger id="team">
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Trigger Type*</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {TRIGGER_TYPES.map((trigger) => {
                const Icon = trigger.icon;
                const isSelected = triggerType === trigger.value;

                return (
                  <button
                    key={trigger.value}
                    type="button"
                    onClick={() => setTriggerType(trigger.value)}
                    className={`p-4 rounded-lg border-2 text-left transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                      <span className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                        {trigger.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{trigger.description}</p>
                  </button>
                );
              })}
            </div>
            {selectedTrigger && (
              <p className="text-sm text-gray-600 mt-2">
                <strong>Selected:</strong> {selectedTrigger.description}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Scenario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
