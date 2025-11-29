import {
  SpeedInsightsEvent,
  storeEvents,
} from "@/lib/drain/speed-insights-store";
import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel Speed Insights Drain Endpoint
 *
 * This endpoint receives Speed Insights (Web Vitals) data from Vercel Drains.
 * Configure this endpoint in your Vercel dashboard: Team Settings > Drains > Add Drain
 *
 * Documentation: https://vercel.com/docs/drains
 *
 * Endpoint URL: https://your-app.vercel.app/api/drain/speed-insights
 * Format: JSON or NDJSON
 */

export const maxDuration = 30;

// Parse NDJSON (newline-delimited JSON)
function parseNDJSON(body: string): Record<string, unknown>[] {
  return body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/**
 * Normalize the incoming event to our internal format
 *
 * Vercel Speed Insights sends ONE metric per event with:
 * - metricType: "LCP", "CLS", "FID", "FCP", "TTFB", "INP"
 * - value: the metric value
 *
 * Reference: https://vercel.com/docs/drains/reference/speed-insights
 */
function normalizeEvent(raw: Record<string, unknown>): SpeedInsightsEvent {
  // Parse timestamp - Vercel sends ISO string
  let timestamp: number;
  if (typeof raw.timestamp === "string") {
    timestamp = new Date(raw.timestamp).getTime();
  } else if (typeof raw.timestamp === "number") {
    timestamp = raw.timestamp;
  } else {
    timestamp = Date.now();
  }

  // Extract the single metric from metricType + value
  const metricType = (raw.metricType as string)?.toUpperCase();
  const value = raw.value as number | undefined;

  // Build metrics object with only the metric that was sent
  const metrics: SpeedInsightsEvent["metrics"] = {};
  if (metricType && typeof value === "number") {
    switch (metricType) {
      case "LCP":
        metrics.lcp = value;
        break;
      case "INP":
        metrics.inp = value;
        break;
      case "CLS":
        metrics.cls = value;
        break;
      case "FCP":
        metrics.fcp = value;
        break;
      case "TTFB":
        metrics.ttfb = value;
        break;
      case "FID":
        metrics.fid = value;
        break;
    }
  }

  // Map Vercel's vercelEnvironment to our environment type
  const vercelEnv = raw.vercelEnvironment as string | undefined;
  let environment: "production" | "preview" | "development" = "production";
  if (vercelEnv === "preview") environment = "preview";
  if (vercelEnv === "development") environment = "development";

  const event: SpeedInsightsEvent = {
    id:
      (raw.deviceId?.toString() || crypto.randomUUID()) +
      "-" +
      (metricType || "unknown"),
    timestamp,
    projectId:
      (raw.projectId as string) || process.env.VERCEL_PROJECT_ID || "unknown",
    deploymentId: raw.deploymentId as string | undefined,
    environment,
    url: (raw.origin as string) || (raw.url as string) || "",
    route: raw.route as string | undefined,
    path: (raw.path as string) || "/",
    deviceType: normalizeDeviceType(raw.deviceType as string),
    connectionType: raw.connectionSpeed as string | undefined,
    browser: raw.clientName as string | undefined,
    os: raw.osName as string | undefined,
    country: raw.country as string | undefined,
    metrics,
  };

  return event;
}

/**
 * Normalize device type to our expected values
 */
function normalizeDeviceType(
  deviceType: string | undefined
): "desktop" | "mobile" | "tablet" {
  if (!deviceType) return "desktop";
  const lower = deviceType.toLowerCase();
  if (lower === "mobile" || lower === "smartphone") return "mobile";
  if (lower === "tablet") return "tablet";
  return "desktop";
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();

    // Optional: Verify signature if configured
    // Uncomment below to enable signature verification:
    // const drainSecret = process.env.VERCEL_DRAIN_SECRET;
    // const signature = request.headers.get("x-vercel-signature");
    // if (drainSecret && signature && !verifySignature(rawBody, signature, drainSecret)) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    // }

    // Parse the body based on content type
    const contentType = request.headers.get("content-type") || "";
    let events: SpeedInsightsEvent[];

    if (contentType.includes("application/x-ndjson")) {
      // NDJSON format (newline-delimited JSON)
      const rawEvents = parseNDJSON(rawBody);
      events = rawEvents.map(normalizeEvent);
    } else {
      // Regular JSON (single event or array)
      const parsed = JSON.parse(rawBody);
      const rawEvents = Array.isArray(parsed) ? parsed : [parsed];
      events = rawEvents.map(normalizeEvent);
    }

    // Store the events
    await storeEvents(events);

    // Log details for debugging
    const metricTypes = events.map((e) => {
      const m = e.metrics;
      if (m.lcp !== undefined) return "LCP";
      if (m.inp !== undefined) return "INP";
      if (m.cls !== undefined) return "CLS";
      if (m.fcp !== undefined) return "FCP";
      if (m.ttfb !== undefined) return "TTFB";
      if (m.fid !== undefined) return "FID";
      return "unknown";
    });

    console.log(
      `📊 Stored ${events.length} Speed Insights event(s) for project: ${
        events[0]?.projectId
      } | Metrics: ${metricTypes.join(", ")}`
    );

    // Return success - Vercel expects a 200 response
    return NextResponse.json({
      success: true,
      eventsReceived: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error processing drain data:", error);

    // Still return 200 to prevent Vercel from retrying bad data
    // Log the error for debugging
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process data",
      },
      { status: 200 } // Return 200 to acknowledge receipt even on error
    );
  }
}

// Health check endpoint for drain validation
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "Speed Insights Drain",
    timestamp: new Date().toISOString(),
  });
}
