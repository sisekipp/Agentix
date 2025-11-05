"use client";

import * as React from "react";
import { Users, MoreVertical, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
}

interface TeamsListProps {
  teams: Team[];
}

export function TeamsList({ teams }: TeamsListProps) {
  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Teams Yet</CardTitle>
          <CardDescription>
            Create your first team to organize workflows and collaborate.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <Card key={team.id} className="relative">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">/{team.slug}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Members
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {team.description || "No description"}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Created {formatDate(team.createdAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
