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
import { createAgent } from '@/app/dashboard/agent-actions';
import { useRouter } from 'next/navigation';

interface CreateAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  teams: any[];
}

const AGENT_ICONS = ['🤖', '🦾', '🧠', '🚀', '⚡', '🔮', '🎯', '💡', '🛠️', '🎨'];
const AGENT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // green
  '#06b6d4', // cyan
  '#ef4444', // red
  '#6366f1', // indigo
];

export function CreateAgentDialog({
  open,
  onClose,
  onSuccess,
  teams,
}: CreateAgentDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [color, setColor] = useState('#3b82f6');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !teamId) {
      alert('Name and team are required');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('teamId', teamId);
      formData.append('icon', icon);
      formData.append('color', color);

      const result = await createAgent(formData);

      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        // Reset form
        setName('');
        setDescription('');
        setIcon('🤖');
        setColor('#3b82f6');

        // Call onSuccess first (closes dialog and refreshes cache)
        onSuccess?.();

        // Then navigate to agent editor after a brief delay
        if (result.agent?.id) {
          setTimeout(() => {
            router.push(`/dashboard/agents/${result.agent.id}`);
          }, 100);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">Name*</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
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
            <Label>Icon</Label>
            <div className="flex gap-2 mt-2">
              {AGENT_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl hover:bg-gray-100 transition ${
                    icon === emoji ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg transition ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Agent'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
