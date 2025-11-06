"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Power, ArrowLeft, Pencil } from "lucide-react";
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
  updateProvider,
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

const MODEL_EXAMPLES = {
  openai: "gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo",
  anthropic: "claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307",
  google: "gemini-1.5-pro, gemini-1.5-flash, gemini-pro",
};

export function ProvidersClient({
  organizationId,
  teams,
  selectedTeamId,
  providers,
}: ProvidersClientProps) {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [editingProvider, setEditingProvider] = React.useState<Provider | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedProviderType, setSelectedProviderType] = React.useState<string>("openai");

  function handleTeamChange(teamId: string) {
    router.push(`/dashboard/providers?org=${organizationId}&team=${teamId}`);
  }

  async function handleCreateProvider(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    formData.append("teamId", selectedTeamId);

    const result = await createProvider(formData);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
    } else {
      setShowCreateDialog(false);
      setIsSubmitting(false);
      setSelectedProviderType("openai");
      router.refresh();
    }
  }

  async function handleUpdateProvider(formData: FormData) {
    if (!editingProvider) return;

    setIsSubmitting(true);
    setError(null);

    const result = await updateProvider(editingProvider.id, formData);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
    } else {
      setShowEditDialog(false);
      setEditingProvider(null);
      setIsSubmitting(false);
      router.refresh();
    }
  }

  function openEditDialog(provider: Provider) {
    setEditingProvider(provider);
    setSelectedProviderType(provider.provider);
    setShowEditDialog(true);
    setError(null);
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
                    onClick={() => openEditDialog(provider)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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

      {/* Create Provider Dialog */}
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
                <Select
                  name="provider"
                  required
                  value={selectedProviderType}
                  onValueChange={setSelectedProviderType}
                >
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
                  placeholder={MODEL_EXAMPLES[selectedProviderType as keyof typeof MODEL_EXAMPLES]?.split(',')[0]?.trim() || "gpt-4o"}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Examples: {MODEL_EXAMPLES[selectedProviderType as keyof typeof MODEL_EXAMPLES]}
                </p>
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
                onClick={() => {
                  setShowCreateDialog(false);
                  setError(null);
                  setSelectedProviderType("openai");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Provider"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Provider Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent key={editingProvider?.id}>
          <form action={handleUpdateProvider}>
            <DialogHeader>
              <DialogTitle>Edit LLM Provider</DialogTitle>
              <DialogDescription>
                Update the provider configuration.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="edit-name">Provider Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingProvider?.name || ""}
                  placeholder="My GPT-4 Provider"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label>Provider Type</Label>
                <Input
                  value={editingProvider?.provider || ""}
                  disabled
                  className="bg-muted"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Provider type cannot be changed
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-model">Model</Label>
                <Input
                  id="edit-model"
                  name="model"
                  defaultValue={editingProvider?.model || ""}
                  placeholder={MODEL_EXAMPLES[selectedProviderType as keyof typeof MODEL_EXAMPLES]?.split(',')[0]?.trim() || "gpt-4o"}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Examples: {MODEL_EXAMPLES[selectedProviderType as keyof typeof MODEL_EXAMPLES]}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-apiKey">API Key (optional)</Label>
                <Input
                  id="edit-apiKey"
                  name="apiKey"
                  type="password"
                  placeholder="Leave empty to keep current key"
                />
                <p className="text-xs text-muted-foreground">
                  Only fill this if you want to update the API key
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingProvider(null);
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Provider"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
