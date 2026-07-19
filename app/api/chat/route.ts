import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const agentBackendUrl = process.env.AGENT_BACKEND_URL || "http://127.0.0.1:8000";

    // Call the Python FastAPI agent service
    const backendResponse = await fetch(`${agentBackendUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error("FastAPI backend error:", errorText);
      return NextResponse.json(
        { error: `Backend responded with status ${backendResponse.status}` },
        { status: backendResponse.status }
      );
    }

    // Directly pipe the readable stream from uvicorn to next.js client response
    return new Response(backendResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable buffering in proxy layers (like Nginx)
      },
    });
  } catch (error) {
    console.error("Chat API proxy exception:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
