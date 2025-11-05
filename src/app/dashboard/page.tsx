import { getCurrentUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Dashboard</h1>
            <p className="mt-2 text-zinc-600">Welcome back, {user.name}!</p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Your Profile</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="font-medium text-zinc-500">Name</dt>
                <dd className="text-zinc-900">{user.name}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-500">Email</dt>
                <dd className="text-zinc-900">{user.email}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-500">User ID</dt>
                <dd className="font-mono text-xs text-zinc-600">{user.id}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Getting Started</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Your authentication system is now set up and working!
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li>✓ Email/Password Authentication</li>
              <li>✓ Session Management</li>
              <li>✓ Protected Routes</li>
              <li>✓ Multi-tenancy Ready</li>
            </ul>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Next Steps</h3>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li>• Create your first workflow</li>
              <li>• Invite team members</li>
              <li>• Configure integrations</li>
              <li>• Explore API endpoints</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
