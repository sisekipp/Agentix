import { NextRequest, NextResponse } from "next/server";
import { createUserWithOrganization } from "@/app/actions/auth";
import { auth } from "@/lib/auth";

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

    // Create user with organization
    const result = await createUserWithOrganization({
      name,
      email,
      password,
      organizationName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Sign in the user using Better Auth
    const signInResponse = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: result.data?.user,
        session: signInResponse,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
