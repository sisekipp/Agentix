"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations, users, teams, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";

export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Validate input
  if (!email || !password) {
    return { error: "Missing email or password" };
  }

  try {
    const signInResponse = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: await headers(),
    });

    if (!signInResponse || signInResponse.error) {
      return {
        error: signInResponse?.error?.message || "Invalid email or password",
      };
    }

    // Success - redirect to dashboard
    redirect("/dashboard");
  } catch (error: any) {
    // Re-throw NEXT_REDIRECT errors - these are not actual errors
    if (error.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Sign in error:", error);
    return {
      error: error.message || "Failed to sign in",
    };
  }
}

export async function signOutAction() {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });

    redirect("/login");
  } catch (error: any) {
    // Re-throw NEXT_REDIRECT errors - these are not actual errors
    if (error.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Sign out error:", error);
    return {
      error: error.message || "Failed to sign out",
    };
  }
}

export async function signUpAction(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const organizationName = formData.get("organizationName") as string | null;

  // Validate input
  if (!name || !email || !password) {
    return { error: "Missing required fields" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  try {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return { error: "User with this email already exists" };
    }

    // Step 1: Create organization first
    const [organization] = await db
      .insert(organizations)
      .values({
        name: organizationName || `${name}'s Organization`,
        slug: `org-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      })
      .returning();

    // Step 2: Use Better Auth to create user with password
    const signUpResponse = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
      headers: await headers(),
    });

    // Check if signup was successful
    if (!signUpResponse || signUpResponse.error) {
      return {
        error: signUpResponse?.error?.message || "Failed to create user",
      };
    }

    // Step 3: Update the user with organizationId
    const [updatedUser] = await db
      .update(users)
      .set({ organizationId: organization.id })
      .where(eq(users.email, email))
      .returning();

    // Step 4: Create default team
    const [team] = await db
      .insert(teams)
      .values({
        organizationId: organization.id,
        name: "Default Team",
        slug: "default",
      })
      .returning();

    // Step 5: Add user to team as admin
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: updatedUser.id,
      role: "admin",
    });

    // Return success - client will handle login
    return { success: true };
  } catch (error: any) {
    // Re-throw NEXT_REDIRECT errors - these are not actual errors
    if (error.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Signup error:", error);
    return {
      error: error.message || "Failed to create account",
    };
  }
}
