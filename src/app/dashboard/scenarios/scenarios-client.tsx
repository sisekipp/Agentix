"use client";

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Workflow, MessageSquare, Zap, Webhook, Clock, LayoutDashboard, Bot } from 'lucide-react';
import { CreateScenarioDialog } from '@/components/create-scenario-dialog';
import { deleteScenario } from '../agent-actions';
import { LogoutButton } from '@/components/logout-button';
import { OrganizationSelector } from '@/components/organization-selector';
import { useToast } from '@/hooks/use-toast';

interface ScenariosClientProps {
  user: any;
  organizations: any[];
  currentOrganizationId?: string;
  teams: any[];
  scenarios: any[];
}

const TRIGGER_ICONS = {
  chat: MessageSquare,
  api: Zap,
  webhook: Webhook,
  schedule: Clock,
};

const TRIGGER_COLORS = {
  chat: 'bg-blue-100 text-blue-800',
  api: 'bg-green-100 text-green-800',
  webhook: 'bg-purple-100 text-purple-800',
  schedule: 'bg-orange-100 text-orange-800',
};

export function ScenariosClient({
  user,
  organizations,
  currentOrganizationId,
  teams,
  scenarios,
}: ScenariosClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const navigationItems = [
    {
      name: 'Dashboard',
      href: `/dashboard${currentOrganizationId ? `?org=${currentOrganizationId}` : ''}`,
      icon: LayoutDashboard,
      current: pathname === '/dashboard',
    },
    {
      name: 'Agents',
      href: `/dashboard/agents${currentOrganizationId ? `?org=${currentOrganizationId}` : ''}`,
      icon: Bot,
      current: pathname === '/dashboard/agents',
    },
    {
      name: 'Scenarios',
      href: `/dashboard/scenarios${currentOrganizationId ? `?org=${currentOrganizationId}` : ''}`,
      icon: Workflow,
      current: pathname === '/dashboard/scenarios',
    },
  ];

  const handleDelete = async (scenarioId: string, scenarioName: string) => {
    if (!confirm(`Are you sure you want to delete "${scenarioName}"?`)) {
      return;
    }

    setIsDeleting(scenarioId);
    try {
      const result = await deleteScenario(scenarioId);
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Scenario deleted',
          description: `"${scenarioName}" has been deleted successfully.`,
        });
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete scenario:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete scenario',
        variant: 'destructive',
      });
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">Agentix</h1>
              <div className="h-6 w-px bg-gray-300" />
              <div className="w-64">
                <OrganizationSelector
                  organizations={organizations}
                  currentOrganizationId={currentOrganizationId}
                  onOrganizationChange={(orgId) => router.push(`/dashboard/scenarios?org=${orgId}`)}
                  onCreateNew={() => {}}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.name}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`
                    flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors
                    ${
                      item.current
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
        {/* Page Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Workflow className="w-8 h-8" />
                Scenarios
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Orchestrate multiple agents with different triggers
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Create Scenario
            </Button>
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {scenarios.length === 0 ? (
          <div className="text-center py-12">
            <Workflow className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No scenarios</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first scenario.
            </p>
            <div className="mt-6">
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Scenario
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((scenario) => {
              const TriggerIcon = TRIGGER_ICONS[scenario.triggerType as keyof typeof TRIGGER_ICONS] || Zap;
              const triggerColorClass = TRIGGER_COLORS[scenario.triggerType as keyof typeof TRIGGER_COLORS] || 'bg-gray-100 text-gray-800';

              return (
                <div
                  key={scenario.id}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/dashboard/scenarios/${scenario.id}`)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium ${triggerColorClass}`}>
                        <TriggerIcon className="w-4 h-4" />
                        {scenario.triggerType}
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/dashboard/scenarios/${scenario.id}`)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(scenario.id, scenario.name)}
                          disabled={isDeleting === scenario.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {scenario.name}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {scenario.description || 'No description'}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Created {new Date(scenario.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      <span className={`px-2 py-1 rounded ${scenario.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {scenario.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateScenarioDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
        teams={teams}
      />
    </div>
  );
}
