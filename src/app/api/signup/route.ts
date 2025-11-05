import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations, users, teams, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, organizationName } = body;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Step 1: Create organization first
    console.log("Creating organization...");
    const [organization] = await db
      .insert(organizations)
      .values({
        name: organizationName || `${name}'s Organization`,
        slug: `org-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      })
      .returning();
    console.log("Organization created:", organization.id);

    // Step 2: Use Better Auth to create user with password
    // Better Auth will handle password hashing and storage in accounts table
    console.log("Creating user with Better Auth...");
    const signUpResponse = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });
    console.log("Better Auth signup response:", signUpResponse);

    // Step 3: Update the user with organizationId
    // Better Auth creates user without organizationId, so we need to update it
    console.log("Updating user with organizationId...");
    const [updatedUser] = await db
      .update(users)
      .set({ organizationId: organization.id })
      .where(eq(users.email, email))
      .returning();
    console.log("User updated:", updatedUser.id);

    // Step 4: Create default team
    console.log("Creating default team...");
    const [team] = await db
      .insert(teams)
      .values({
        organizationId: organization.id,
        name: "Default Team",
        slug: "default",
      })
      .returning();
    console.log("Team created:", team.id);

    // Step 5: Add user to team as admin
    console.log("Adding user to team...");
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: updatedUser.id,
      role: "admin",
    });
    console.log("User added to team successfully");

    return NextResponse.json(
      {
        success: true,
        user: updatedUser,
        organization,
        session: signUpResponse,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    });
    return NextResponse.json(
      {
        error: error.message || "Failed to create user",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
