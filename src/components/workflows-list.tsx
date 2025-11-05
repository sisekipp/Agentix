"use client";

import * as React from "react";
import { Trash2, Edit, Play, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteWorkflow, executeWorkflow } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  team?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface WorkflowsListProps {
  workflows: Workflow[];
  onWorkflowDeleted: () => void;
}

export function WorkflowsList({ workflows, onWorkflowDeleted }: WorkflowsListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [executingId, setExecutingId] = React.useState<string | null>(null);

  async function handleDelete(workflowId: string) {
    if (!confirm("Are you sure you want to delete this workflow?")) {
      return;
    }

    setDeletingId(workflowId);
    const result = await deleteWorkflow(workflowId);

    if (result.error) {
      alert(result.error);
    } else {
      onWorkflowDeleted();
    }
    setDeletingId(null);
  }

  function handleEdit(workflowId: string) {
    router.push(`/dashboard/workflows/${workflowId}`);
  }

  async function handleRun(workflowId: string) {
    if (!confirm("Are you sure you want to run this workflow?")) {
      return;
    }

    setExecutingId(workflowId);
    const result = await executeWorkflow(workflowId, {});

    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      alert(
        `Workflow started!\nExecution ID: ${result.execution?.executionId}\nStatus: ${result.execution?.status}`
      );
    }
    setExecutingId(null);
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (workflows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Workflows Yet</CardTitle>
          <CardDescription>
            Create your first workflow to get started with AI automation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflows</CardTitle>
        <CardDescription>
          Manage your AI agent workflows and automations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <TableRow key={workflow.id}>
                <TableCell className="font-medium">{workflow.name}</TableCell>
                <TableCell className="max-w-md truncate">
                  {workflow.description || "-"}
                </TableCell>
                <TableCell>{workflow.team?.name || "-"}</TableCell>
                <TableCell>{formatDate(workflow.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === workflow.id}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => handleEdit(workflow.id)}
                        disabled={deletingId === workflow.id || executingId === workflow.id}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRun(workflow.id)}
                        disabled={deletingId === workflow.id || executingId === workflow.id}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {executingId === workflow.id ? "Running..." : "Run"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDelete(workflow.id)}
                        disabled={deletingId === workflow.id || executingId === workflow.id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingId === workflow.id ? "Deleting..." : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
