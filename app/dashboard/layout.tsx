import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

import { ChatAssistant } from "@/components/dashboard/chat-assistant";
import { RealtimeListener } from "@/components/dashboard/realtime-listener";

async function SidebarLoader() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch user profile from the database
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username || user.email?.split("@")[0] || "User";
  const email = user.email || "";

  return <Sidebar username={username} email={email} />;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground font-sans">
      {/* Sidebar Navigation */}
      <Suspense
        fallback={
          <div className="w-64 bg-card border-r border-border min-h-screen p-6 animate-pulse hidden md:block">
            <div className="h-9 w-24 bg-stone-200 dark:bg-stone-800 rounded-lg mb-10" />
            <div className="space-y-4">
              <div className="h-8 bg-stone-200 dark:bg-stone-800 rounded-lg w-full" />
              <div className="h-8 bg-stone-200 dark:bg-stone-800 rounded-lg w-full" />
              <div className="h-8 bg-stone-200 dark:bg-stone-800 rounded-lg w-full" />
            </div>
          </div>
        }
      >
        <SidebarLoader />
      </Suspense>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background md:p-8 p-4 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto space-y-6">
          {children}
        </div>
      </main>

      {/* Realtime PostgreSQL changes listener */}
      <RealtimeListener />

      {/* Floating AI Chat Assistant */}
      <ChatAssistant />
    </div>
  );
}

