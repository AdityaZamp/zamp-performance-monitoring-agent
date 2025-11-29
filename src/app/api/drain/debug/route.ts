import { NextResponse } from "next/server";
import {
  getProjectIds,
  getEventCount,
  getLatestEvents,
  getAggregatedMetrics,
  checkDatabaseConnection,
} from "@/lib/drain/speed-insights-store";

/**
 * Debug endpoint to check drain data status
 * GET /api/drain/debug
 */
export async function GET() {
  // First check database connection
  const dbStatus = await checkDatabaseConnection();
  
  if (!dbStatus.connected) {
    return NextResponse.json({
      status: "database-error",
      message: dbStatus.message,
      timestamp: new Date().toISOString(),
      setup: {
        step1: "Create a Supabase project at https://supabase.com",
        step2: "Run the SQL schema from supabase/schema.sql in the SQL Editor",
        step3: "Add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables",
        step4: "Redeploy your app",
      },
    });
  }

  const projectIds = await getProjectIds();

  if (projectIds.length === 0) {
    return NextResponse.json({
      status: "no-data",
      database: "connected",
      message: "Database connected but no drain data has been received yet",
      timestamp: new Date().toISOString(),
      tips: [
        "1. Verify drain is configured in Vercel Dashboard → Team Settings → Drains",
        "2. Check the drain is Active and endpoint URL is correct",
        "3. Visit your monitored site to generate fresh Web Vitals data",
        "4. Wait 1-2 minutes for Vercel to batch and send data",
        "5. Check logs: npx vercel logs vercel-agent-kappa.vercel.app --follow",
      ],
    });
  }

  // Get data for each project
  const projects = await Promise.all(
    projectIds.map(async (projectId) => {
      const eventCount = await getEventCount(projectId);
      const latestEvents = await getLatestEvents(projectId, 5);
      const metrics = await getAggregatedMetrics(projectId);

      return {
        projectId,
        eventCount,
        latestEvents: latestEvents.map((e) => ({
          timestamp: new Date(e.timestamp).toISOString(),
          url: e.url,
          path: e.path,
          device: e.deviceType,
          metrics: {
            lcp: e.metrics.lcp ? `${e.metrics.lcp}ms` : null,
            inp: e.metrics.inp ? `${e.metrics.inp}ms` : null,
            cls: e.metrics.cls?.toFixed(3) || null,
            fcp: e.metrics.fcp ? `${e.metrics.fcp}ms` : null,
            ttfb: e.metrics.ttfb ? `${e.metrics.ttfb}ms` : null,
          },
        })),
        aggregatedMetrics: metrics
          ? {
              sampleSize: metrics.sampleSize,
              period: {
                from: new Date(metrics.period.from).toISOString(),
                to: new Date(metrics.period.to).toISOString(),
              },
              coreWebVitals: {
                lcp: { p75: metrics.metrics.lcp.p75, rating: metrics.metrics.lcp.rating },
                inp: { p75: metrics.metrics.inp.p75, rating: metrics.metrics.inp.rating },
                cls: { p75: metrics.metrics.cls.p75, rating: metrics.metrics.cls.rating },
              },
            }
          : null,
      };
    })
  );

  const totalEvents = projects.reduce((sum, p) => sum + p.eventCount, 0);

  return NextResponse.json({
    status: "active",
    database: "connected",
    message: "Drain data is being received and stored in Supabase",
    timestamp: new Date().toISOString(),
    totalProjects: projectIds.length,
    totalEvents,
    projects,
  });
}


