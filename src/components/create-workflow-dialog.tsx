"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWorkflow } from "@/app/dashboard/actions";

interface Team {
  id: string;
  name: string;
}

interface CreateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  teams: Team[];
}

export function CreateWorkflowDialog({
  open,
  onOpenChange,
  onSuccess,
  teams,
}: CreateWorkflowDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = React.useState<string>("");

  // Auto-select first team when dialog opens or teams change
  React.useEffect(() => {
    if (open && teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0].id);
    }
  }, [open, teams, selectedTeam]);

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedTeam("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("teamId", selectedTeam);

    console.log("Submitting workflow creation:", {
      name: formData.get("name"),
      teamId: selectedTeam,
      description: formData.get("description"),
    });

    const result = await createWorkflow(formData);

    console.log("Workflow creation result:", result);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
    } else {
      onSuccess();
      onOpenChange(false);
      // Reset form
      (e.target as HTMLFormElement).reset();
      setSelectedTeam("");
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
          <DialogDescription>
            Create a new workflow to automate your processes with AI agents.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Workflow Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="My Workflow"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team">
                Team <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedTeam}
                onValueChange={setSelectedTeam}
                required
                disabled={isSubmitting || teams.length === 0}
              >
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
              {teams.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No teams available. Please select an organization first.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe your workflow..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedTeam}>
              {isSubmitting ? "Creating..." : "Create Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
