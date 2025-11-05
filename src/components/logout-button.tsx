"use client";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const handleLogout = async () => {
    await signOutAction();
  };

  return (
    <Button variant="outline" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
