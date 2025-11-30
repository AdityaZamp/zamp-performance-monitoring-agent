import { runPerformanceAgent } from "@/lib/agent";
import { NextRequest, NextResponse } from "next/server";

// Set max duration for the cron job
export const maxDuration = 120;

export async function GET(_request: NextRequest) {
  // No auth check - cron runs from Vercel's internal scheduler

  console.log("🚀 Starting daily performance check...");

  try {
    const result = await runPerformanceAgent(
      "last 24 hours performance insights report"
    );

    if (!result.success) {
      console.error("❌ Agent failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    console.log("✅ Daily performance check completed");

    return NextResponse.json({
      success: true,
      message: "Daily performance report sent",
      timestamp: new Date().toISOString(),
      summary: result.finalAnswer,
    });
  } catch (error) {
    console.error("❌ Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cron job failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
