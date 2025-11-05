import { auth } from "./auth";
import { headers } from "next/headers";
import { cache } from "react";

/**
 * Get the current session on the server side
 * This function is cached per request
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
});

/**
 * Get the current user on the server side
 * Returns null if not authenticated
 */
export const getCurrentUser = async () => {
  const session = await getSession();
  return session?.user ?? null;
};

/**
 * Require authentication - throws if not authenticated
 * Use this in Server Actions or API routes that require auth
 */
export const requireAuth = async () => {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
};
