import { NextRequest, NextResponse } from "next/server";
import { runPerformanceAgent } from "@/lib/agent";

// Set max duration for the cron job
export const maxDuration = 120;

export async function GET(_request: NextRequest) {
  // No auth check - cron runs from Vercel's internal scheduler

  console.log("🚀 Starting daily performance check...");

  try {
    const result = await runPerformanceAgent(
      "Check the drain status, fetch Web Vitals data from Vercel Drains. Thoroughly analyze all Core Web Vitals metrics (LCP, FCP, CLS, FID, TTFB, INP), compare them to Google's recommended thresholds, include slowest routes, and send a comprehensive daily performance summary to Slack. Include specific recommendations for any metrics that need improvement."
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

