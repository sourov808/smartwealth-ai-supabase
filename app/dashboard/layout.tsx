import { Suspense } from "react";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { ChatAssistant } from "@/components/dashboard/chat-assistant";
import { RealtimeListener } from "@/components/dashboard/realtime-listener";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

async function SidebarLoader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username || user.email?.split("@")[0] || "User";
  const email = user.email || "";

  return <Sidebar username={username} email={email} />;
}

function SidebarFallback() {
  return (
    <div className="hidden w-56 shrink-0 px-6 py-8 md:block">
      <Skeleton className="mb-12 h-6 w-20" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-28" />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper font-sans text-ink md:flex-row">
      <Suspense fallback={<SidebarFallback />}>
        <SidebarLoader />
      </Suspense>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-5 py-8 md:px-12 md:py-14">
        {/* Narrower than the previous 6xl. Editorial layouts depend on a
            measure that does not run past comfortable reading width. */}
        <div className="mx-auto w-full max-w-5xl space-y-section">{children}</div>
      </main>

      <RealtimeListener />
      <ChatAssistant />
    </div>
  );
}
