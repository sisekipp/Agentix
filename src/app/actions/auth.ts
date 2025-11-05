"use server";

import { db } from "@/lib/db";
import { organizations, users, teams, teamMembers } from "@/lib/db/schema";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";

export async function createUserWithOrganization(data: {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
}) {
  try {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, data.email),
    });

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await hash(data.password, 10);

    // Create organization, user, default team, and team member in a transaction
    const result = await db.transaction(async (tx) => {
      // 1. Create organization
      const [organization] = await tx
        .insert(organizations)
        .values({
          name: data.organizationName || `${data.name}'s Organization`,
          slug: `org-${randomUUID().slice(0, 8)}`,
        })
        .returning();

      // 2. Create user
      const [user] = await tx
        .insert(users)
        .values({
          email: data.email,
          name: data.name,
          passwordHash,
          organizationId: organization.id,
        })
        .returning();

      // 3. Create default team
      const [team] = await tx
        .insert(teams)
        .values({
          organizationId: organization.id,
          name: "Default Team",
          slug: "default",
        })
        .returning();

      // 4. Add user to team as admin
      await tx.insert(teamMembers).values({
        teamId: team.id,
        userId: user.id,
        role: "admin",
      });

      return { user, organization, team };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    console.error("Error creating user with organization:", error);
    return {
      success: false,
      error: error.message || "Failed to create account",
    };
  }
}
