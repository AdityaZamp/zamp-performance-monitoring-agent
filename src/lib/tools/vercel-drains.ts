import { tool } from "ai";
import { z } from "zod";
import {
  getAggregatedMetrics,
  getLatestEvents,
  getEventCount,
  getProjectIds,
  checkDatabaseConnection,
  AggregatedMetrics,
  SpeedInsightsEvent,
} from "@/lib/drain/speed-insights-store";

/**
 * Tools for accessing Speed Insights data received via Vercel Drains
 *
 * These tools provide access to real-time Web Vitals data that has been
 * pushed to the application via Vercel Drains, offering more granular
 * and immediate insights compared to the aggregated API endpoints.
 */

// Format aggregated metrics for AI consumption
function formatMetricsForAgent(metrics: AggregatedMetrics): {
  summary: {
    projectId: string;
    period: string;
    sampleSize: number;
    overallScore: number;
    overallRating: string;
  };
  coreWebVitals: {
    lcp: { p75: number; rating: string; description: string };
    inp: { p75: number; rating: string; description: string };
    cls: { p75: number; rating: string; description: string };
  };
  additionalMetrics: {
    fcp: { p75: number; rating: string };
    ttfb: { p75: number; rating: string };
    fid: { p75: number; rating: string };
  };
  slowestRoutes: Array<{
    route: string;
    sampleSize: number;
    lcp: number;
    inp: number;
    cls: number;
  }>;
} {
  const { period, sampleSize, metrics: m, byRoute } = metrics;

  // Calculate overall score based on Core Web Vitals
  const coreVitals = [m.lcp, m.inp, m.cls].filter((v) => v.rating !== "no-data");
  const goodCount = coreVitals.filter((v) => v.rating === "good").length;
  const score = coreVitals.length > 0 ? Math.round((goodCount / coreVitals.length) * 100) : 0;

  let overallRating = "no-data";
  if (coreVitals.length > 0) {
    if (coreVitals.every((v) => v.rating === "good")) {
      overallRating = "good";
    } else if (coreVitals.some((v) => v.rating === "poor")) {
      overallRating = "poor";
    } else {
      overallRating = "needs-improvement";
    }
  }

  // Get slowest routes by LCP
  const routeArray = Array.from(byRoute.values())
    .filter((r) => r.sampleSize > 0)
    .sort((a, b) => b.lcp - a.lcp)
    .slice(0, 5);

  return {
    summary: {
      projectId: metrics.projectId,
      period: `${new Date(period.from).toISOString()} to ${new Date(period.to).toISOString()}`,
      sampleSize,
      overallScore: score,
      overallRating,
    },
    coreWebVitals: {
      lcp: {
        p75: m.lcp.p75,
        rating: m.lcp.rating,
        description: `Largest Contentful Paint: ${m.lcp.p75}ms (${m.lcp.count} samples)`,
      },
      inp: {
        p75: m.inp.p75,
        rating: m.inp.rating,
        description: `Interaction to Next Paint: ${m.inp.p75}ms (${m.inp.count} samples)`,
      },
      cls: {
        p75: m.cls.p75,
        rating: m.cls.rating,
        description: `Cumulative Layout Shift: ${m.cls.p75.toFixed(3)} (${m.cls.count} samples)`,
      },
    },
    additionalMetrics: {
      fcp: { p75: m.fcp.p75, rating: m.fcp.rating },
      ttfb: { p75: m.ttfb.p75, rating: m.ttfb.rating },
      fid: { p75: m.fid.p75, rating: m.fid.rating },
    },
    slowestRoutes: routeArray.map((r) => ({
      route: r.route,
      sampleSize: r.sampleSize,
      lcp: r.lcp,
      inp: r.inp,
      cls: r.cls,
    })),
  };
}

/**
 * Get aggregated Speed Insights from drain data
 */
export const getDrainSpeedInsightsTool = tool({
  description: `Fetches aggregated Web Vitals metrics from Speed Insights data received via Vercel Drains.
This provides real-time performance data that has been pushed to the application, offering more granular
insights including per-route metrics. Use this for detailed performance analysis.

The data includes:
- Core Web Vitals: LCP, INP, CLS with p75 values and ratings
- Additional metrics: FCP, TTFB, FID
- Route analysis: identify slowest pages/routes

Note: This requires the Vercel Drain to be configured and sending data to /api/drain/speed-insights`,
  parameters: z.object({
    projectId: z
      .string()
      .optional()
      .describe(
        "The Vercel project ID. If not provided, uses VERCEL_PROJECT_ID env var."
      ),
    period: z
      .enum(["1h", "6h", "24h", "7d", "30d"])
      .optional()
      .default("24h")
      .describe("Time period for aggregating metrics"),
  }),
  execute: async ({ projectId, period }) => {
    const resolvedProjectId = projectId || process.env.VERCEL_PROJECT_ID;

    if (!resolvedProjectId) {
      return {
        success: false,
        error:
          "Project ID is required. Provide it as parameter or set VERCEL_PROJECT_ID env var.",
        data: null,
      };
    }

    // Calculate time range
    const now = Date.now();
    const periodMs: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const from = now - (periodMs[period || "24h"] || periodMs["24h"]);

    try {
      const metrics = await getAggregatedMetrics(resolvedProjectId, from, now);

      if (!metrics) {
        return {
          success: false,
          error: `No Speed Insights drain data found for project "${resolvedProjectId}". Make sure:
1. Supabase is configured with SUPABASE_URL and SUPABASE_ANON_KEY
2. Vercel Drain is configured in Team Settings > Drains
3. The drain is sending data to: /api/drain/speed-insights
4. There has been traffic to your site to generate Web Vitals data`,
          data: null,
        };
      }

      const formatted = formatMetricsForAgent(metrics);

      return {
        success: true,
        error: null,
        data: formatted,
        source: "Vercel Drain + Supabase",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get drain metrics",
        data: null,
      };
    }
  },
});

/**
 * Get recent Speed Insights events for debugging
 */
export const getRecentDrainEventsTool = tool({
  description: `Fetches the most recent raw Speed Insights events received via Vercel Drains.
Useful for debugging, monitoring data flow, or analyzing individual user experiences.
Returns detailed event-level data including URL, device type, and all metrics.`,
  parameters: z.object({
    projectId: z
      .string()
      .optional()
      .describe("The Vercel project ID. If not provided, uses VERCEL_PROJECT_ID env var."),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Number of recent events to return (max 50)"),
  }),
  execute: async ({ projectId, limit }) => {
    const resolvedProjectId = projectId || process.env.VERCEL_PROJECT_ID;

    if (!resolvedProjectId) {
      return {
        success: false,
        error: "Project ID is required.",
        data: null,
      };
    }

    const events = await getLatestEvents(resolvedProjectId, Math.min(limit || 10, 50));

    if (events.length === 0) {
      return {
        success: false,
        error: `No drain events found for project "${resolvedProjectId}".`,
        data: null,
      };
    }

    // Format events for readability
    const formattedEvents = events.map((e: SpeedInsightsEvent) => ({
      timestamp: new Date(e.timestamp).toISOString(),
      url: e.url,
      path: e.path,
      device: e.deviceType,
      country: e.country,
      metrics: {
        lcp: e.metrics.lcp ? `${e.metrics.lcp}ms` : "n/a",
        inp: e.metrics.inp ? `${e.metrics.inp}ms` : "n/a",
        cls: e.metrics.cls?.toFixed(3) || "n/a",
        fcp: e.metrics.fcp ? `${e.metrics.fcp}ms` : "n/a",
        ttfb: e.metrics.ttfb ? `${e.metrics.ttfb}ms` : "n/a",
      },
    }));

    return {
      success: true,
      error: null,
      data: {
        count: events.length,
        events: formattedEvents,
      },
    };
  },
});

/**
 * Get drain status and statistics
 */
export const getDrainStatusTool = tool({
  description: `Gets the current status of Speed Insights drain data collection.
Shows how many events have been received and which projects have data.
Useful for verifying that the drain and database are configured correctly.`,
  parameters: z.object({}),
  execute: async () => {
    // First check database connection
    const dbStatus = await checkDatabaseConnection();
    
    if (!dbStatus.connected) {
      return {
        success: false,
        error: null,
        data: {
          status: "database-error",
          message: dbStatus.message,
          configurationTips: [
            "1. Create a Supabase project at https://supabase.com",
            "2. Run the SQL schema from supabase/schema.sql",
            "3. Add SUPABASE_URL and SUPABASE_ANON_KEY to environment variables",
            "4. Redeploy your app",
          ],
        },
      };
    }

    const projectIds = await getProjectIds();

    if (projectIds.length === 0) {
      return {
        success: true,
        error: null,
        data: {
          status: "no-data",
          database: "connected",
          message: "Database connected but no drain data has been received yet.",
          projects: [],
          configurationTips: [
            "1. Go to Vercel Dashboard > Team Settings > Drains",
            "2. Click 'Add Drain' and select 'Speed Insights'",
            "3. Set endpoint URL to: https://your-app.vercel.app/api/drain/speed-insights",
            "4. Choose JSON or NDJSON format",
            "5. Visit your monitored site to generate Web Vitals data",
          ],
        },
      };
    }

    const projects = await Promise.all(
      projectIds.map(async (id) => ({
        projectId: id,
        eventCount: await getEventCount(id),
      }))
    );

    return {
      success: true,
      error: null,
      data: {
        status: "active",
        database: "connected",
        message: "Drain is receiving data and storing in Supabase",
        projects,
        totalEvents: projects.reduce((sum, p) => sum + p.eventCount, 0),
      },
    };
  },
});

