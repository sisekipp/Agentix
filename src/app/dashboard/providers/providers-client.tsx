"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Power, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProvider,
  deleteProvider,
  toggleProviderActive,
} from "../actions";
import { Badge } from "@/components/ui/badge";

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
}

interface Provider {
  id: string;
  teamId: string;
  name: string;
  provider: string;
  model: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProvidersClientProps {
  organizationId: string;
  teams: Team[];
  selectedTeamId: string;
  providers: Provider[];
}

export function ProvidersClient({
  organizationId,
  teams,
  selectedTeamId,
  providers,
}: ProvidersClientProps) {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleTeamChange(teamId: string) {
    router.push(`/dashboard/providers?org=${organizationId}&team=${teamId}`);
  }

  async function handleCreateProvider(formData: FormData) {
    setIsCreating(true);
    setError(null);

    formData.append("teamId", selectedTeamId);

    const result = await createProvider(formData);

    if (result.error) {
      setError(result.error);
      setIsCreating(false);
    } else {
      setShowCreateDialog(false);
      setIsCreating(false);
      router.refresh();
    }
  }

  async function handleDeleteProvider(providerId: string) {
    if (!confirm("Are you sure you want to delete this provider?")) {
      return;
    }

    const result = await deleteProvider(providerId);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleToggleActive(providerId: string) {
    const result = await toggleProviderActive(providerId);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/dashboard?org=${organizationId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold">LLM Providers</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Label>Team:</Label>
            <Select value={selectedTeamId} onValueChange={handleTeamChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select team" />
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
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {provider.provider} - {provider.model}
                    </CardDescription>
                  </div>
                  <Badge variant={provider.isActive ? "default" : "secondary"}>
                    {provider.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(provider.id)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteProvider(provider.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {providers.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  No providers configured for this team.
                  <br />
                  Click "Add Provider" to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <form action={handleCreateProvider}>
            <DialogHeader>
              <DialogTitle>Add LLM Provider</DialogTitle>
              <DialogDescription>
                Configure a new LLM provider for this team.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="name">Provider Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="My GPT-4 Provider"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="provider">Provider Type</Label>
                <Select name="provider" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  name="model"
                  placeholder="gpt-4-turbo"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  name="apiKey"
                  type="password"
                  placeholder="sk-..."
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Provider"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
