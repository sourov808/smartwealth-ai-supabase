import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile from the database
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username || user.email?.split("@")[0] || "User";
  const email = user.email || "";

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground font-sans">
      {/* Sidebar Navigation */}
      <Sidebar username={username} email={email} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background md:p-8 p-4 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
