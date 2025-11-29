import { NextRequest, NextResponse } from "next/server";
import { runPerformanceAgent, runCustomAgentQuery } from "@/lib/agent";

// Set max duration for the agent (adjust based on your Vercel plan)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body as { prompt?: string };

    // Run the agent with custom prompt or default workflow
    const result = prompt
      ? await runCustomAgentQuery(prompt)
      : await runPerformanceAgent();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Agent execution failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      steps: result.steps,
      finalAnswer: result.finalAnswer,
    });
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Speed Insights Agent API",
    usage: {
      method: "POST",
      body: {
        prompt: "Optional custom prompt for the agent",
      },
    },
    endpoints: {
      "/api/agent": "Run the agent with optional custom prompt",
      "/api/cron/speed-insights": "Cron endpoint for scheduled runs",
    },
  });
}

