"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Bot } from 'lucide-react';
import { CreateAgentDialog } from '@/components/create-agent-dialog';
import { deleteAgent } from '../agent-actions';

interface AgentsClientProps {
  user: any;
  organizations: any[];
  currentOrganizationId?: string;
  teams: any[];
  agents: any[];
}

export function AgentsClient({
  user,
  organizations,
  currentOrganizationId,
  teams,
  agents,
}: AgentsClientProps) {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (agentId: string, agentName: string) => {
    if (!confirm(`Are you sure you want to delete "${agentName}"?`)) {
      return;
    }

    setIsDeleting(agentId);
    try {
      const result = await deleteAgent(agentId);
      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
      alert('Failed to delete agent');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Bot className="w-8 h-8" />
                Agents
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Create and manage reusable AI agents
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No agents</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first agent.
            </p>
            <div className="mt-6">
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: agent.color || '#3b82f6' }}
                    >
                      {agent.icon || '🤖'}
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(agent.id, agent.name)}
                        disabled={isDeleting === agent.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {agent.description || 'No description'}
                  </p>
                  <div className="mt-4 flex items-center text-xs text-gray-500">
                    <span>
                      Created {new Date(agent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateAgentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
        teams={teams}
      />
    </div>
  );
}
