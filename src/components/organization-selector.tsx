"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationSelectorProps {
  organizations: Organization[];
  currentOrganizationId?: string;
  onOrganizationChange: (organizationId: string) => void;
  onCreateNew: () => void;
}

export function OrganizationSelector({
  organizations,
  currentOrganizationId,
  onOrganizationChange,
  onCreateNew,
}: OrganizationSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Only render after mounting to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentOrganization = organizations.find(
    (org) => org.id === currentOrganizationId
  );

  // Show a simplified button during SSR
  if (!mounted) {
    return (
      <Button
        variant="outline"
        className="w-full justify-between"
        disabled
      >
        {currentOrganization ? currentOrganization.name : "Select organization..."}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {currentOrganization ? currentOrganization.name : "Select organization..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search organization..." />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => {
                    onOrganizationChange(org.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentOrganizationId === org.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {org.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onCreateNew();
                  setOpen(false);
                }}
                className="text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create new organization
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
