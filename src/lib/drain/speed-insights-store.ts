import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Speed Insights Drain Data Store (Supabase)
 *
 * This module handles incoming Speed Insights data from Vercel Drains
 * and stores it in Supabase for persistent storage.
 *
 * Vercel Drains documentation: https://vercel.com/docs/drains
 */

// Speed Insights event from Vercel Drain
export interface SpeedInsightsEvent {
  id: string;
  timestamp: number;
  projectId: string;
  deploymentId?: string;
  environment: "production" | "preview" | "development";
  url: string;
  route?: string;
  path: string;
  deviceType: "desktop" | "mobile" | "tablet";
  connectionType?: string;
  browser?: string;
  os?: string;
  country?: string;
  metrics: {
    lcp?: number;
    inp?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
    fid?: number;
  };
}

// Aggregated metrics for reporting
export interface AggregatedMetrics {
  projectId: string;
  period: {
    from: number;
    to: number;
  };
  sampleSize: number;
  metrics: {
    lcp: MetricStats;
    inp: MetricStats;
    cls: MetricStats;
    fcp: MetricStats;
    ttfb: MetricStats;
    fid: MetricStats;
  };
  byDevice: {
    desktop: DeviceMetrics;
    mobile: DeviceMetrics;
    tablet: DeviceMetrics;
  };
  byRoute: Map<string, RouteMetrics>;
}

export interface MetricStats {
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  avg: number;
  count: number;
  rating: "good" | "needs-improvement" | "poor" | "no-data";
}

export interface DeviceMetrics {
  sampleSize: number;
  lcp: number;
  inp: number;
  cls: number;
  fcp: number;
  ttfb: number;
}

export interface RouteMetrics {
  route: string;
  sampleSize: number;
  lcp: number;
  inp: number;
  cls: number;
}

// Web Vitals thresholds (based on Google's recommendations)
const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
  FID: { good: 100, needsImprovement: 300 },
};

/**
 * Store multiple events in Supabase
 */
export async function storeEvents(events: SpeedInsightsEvent[]): Promise<void> {
  if (!isSupabaseConfigured) {
    console.warn("Supabase not configured, skipping event storage");
    return;
  }

  const rows = events.map((event) => ({
    event_id: event.id,
    project_id: event.projectId,
    deployment_id: event.deploymentId,
    environment: event.environment,
    url: event.url,
    route: event.route,
    path: event.path,
    device_type: event.deviceType,
    connection_type: event.connectionType,
    browser: event.browser,
    os: event.os,
    country: event.country,
    lcp: event.metrics.lcp,
    inp: event.metrics.inp,
    cls: event.metrics.cls,
    fcp: event.metrics.fcp,
    ttfb: event.metrics.ttfb,
    fid: event.metrics.fid,
    event_timestamp: new Date(event.timestamp).toISOString(),
  }));

  const { error } = await supabase.from("speed_insights_events").insert(rows);

  if (error) {
    console.error("Failed to store events in Supabase:", error);
    throw error;
  }
}

/**
 * Get rating based on metric value
 */
function getRating(
  metric: keyof typeof THRESHOLDS,
  value: number
): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[metric];
  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Calculate percentile from array of values
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate metric statistics from values
 */
function calculateMetricStats(
  values: number[],
  metric: keyof typeof THRESHOLDS
): MetricStats {
  if (values.length === 0) {
    return {
      p50: 0,
      p75: 0,
      p90: 0,
      p99: 0,
      avg: 0,
      count: 0,
      rating: "no-data",
    };
  }

  const p75 = percentile(values, 75);

  return {
    p50: percentile(values, 50),
    p75,
    p90: percentile(values, 90),
    p99: percentile(values, 99),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    count: values.length,
    rating: getRating(metric, p75),
  };
}

interface DbEvent {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  fid: number | null;
  device_type: string;
  route: string | null;
}

/**
 * Get aggregated metrics for a project within a time range
 */
export async function getAggregatedMetrics(
  projectId: string,
  fromTimestamp?: number,
  toTimestamp?: number
): Promise<AggregatedMetrics | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const now = Date.now();
  const from = fromTimestamp || now - 24 * 60 * 60 * 1000;
  const to = toTimestamp || now;

  const { data: events, error } = await supabase
    .from("speed_insights_events")
    .select("*")
    .eq("project_id", projectId)
    .gte("event_timestamp", new Date(from).toISOString())
    .lte("event_timestamp", new Date(to).toISOString())
    .order("event_timestamp", { ascending: false });

  if (error) {
    console.error("Failed to fetch events from Supabase:", error);
    return null;
  }

  if (!events || events.length === 0) {
    return null;
  }

  // Collect metric values
  const lcpValues: number[] = [];
  const inpValues: number[] = [];
  const clsValues: number[] = [];
  const fcpValues: number[] = [];
  const ttfbValues: number[] = [];
  const fidValues: number[] = [];

  // Device-specific metrics
  const deviceMetrics = {
    desktop: {
      lcp: [] as number[],
      inp: [] as number[],
      cls: [] as number[],
      fcp: [] as number[],
      ttfb: [] as number[],
    },
    mobile: {
      lcp: [] as number[],
      inp: [] as number[],
      cls: [] as number[],
      fcp: [] as number[],
      ttfb: [] as number[],
    },
    tablet: {
      lcp: [] as number[],
      inp: [] as number[],
      cls: [] as number[],
      fcp: [] as number[],
      ttfb: [] as number[],
    },
  };

  // Route-specific metrics
  const routeMetrics = new Map<
    string,
    { lcp: number[]; inp: number[]; cls: number[] }
  >();

  for (const event of events as DbEvent[]) {
    const deviceType = (event.device_type || "desktop") as keyof typeof deviceMetrics;
    const route = event.route;

    if (event.lcp !== null) {
      lcpValues.push(event.lcp);
      if (deviceMetrics[deviceType]) {
        deviceMetrics[deviceType].lcp.push(event.lcp);
      }
    }
    if (event.inp !== null) {
      inpValues.push(event.inp);
      if (deviceMetrics[deviceType]) {
        deviceMetrics[deviceType].inp.push(event.inp);
      }
    }
    if (event.cls !== null) {
      clsValues.push(event.cls);
      if (deviceMetrics[deviceType]) {
        deviceMetrics[deviceType].cls.push(event.cls);
      }
    }
    if (event.fcp !== null) {
      fcpValues.push(event.fcp);
      if (deviceMetrics[deviceType]) {
        deviceMetrics[deviceType].fcp.push(event.fcp);
      }
    }
    if (event.ttfb !== null) {
      ttfbValues.push(event.ttfb);
      if (deviceMetrics[deviceType]) {
        deviceMetrics[deviceType].ttfb.push(event.ttfb);
      }
    }
    if (event.fid !== null) {
      fidValues.push(event.fid);
    }

    // Track by route
    if (route) {
      if (!routeMetrics.has(route)) {
        routeMetrics.set(route, { lcp: [], inp: [], cls: [] });
      }
      const rm = routeMetrics.get(route)!;
      if (event.lcp !== null) rm.lcp.push(event.lcp);
      if (event.inp !== null) rm.inp.push(event.inp);
      if (event.cls !== null) rm.cls.push(event.cls);
    }
  }

  // Calculate device averages
  const calcDeviceMetrics = (
    device: keyof typeof deviceMetrics
  ): DeviceMetrics => {
    const d = deviceMetrics[device];
    return {
      sampleSize: d.lcp.length,
      lcp: d.lcp.length > 0 ? percentile(d.lcp, 75) : 0,
      inp: d.inp.length > 0 ? percentile(d.inp, 75) : 0,
      cls: d.cls.length > 0 ? percentile(d.cls, 75) : 0,
      fcp: d.fcp.length > 0 ? percentile(d.fcp, 75) : 0,
      ttfb: d.ttfb.length > 0 ? percentile(d.ttfb, 75) : 0,
    };
  };

  // Calculate route metrics
  const byRoute = new Map<string, RouteMetrics>();
  for (const [route, rm] of routeMetrics) {
    byRoute.set(route, {
      route,
      sampleSize: rm.lcp.length,
      lcp: rm.lcp.length > 0 ? percentile(rm.lcp, 75) : 0,
      inp: rm.inp.length > 0 ? percentile(rm.inp, 75) : 0,
      cls: rm.cls.length > 0 ? percentile(rm.cls, 75) : 0,
    });
  }

  return {
    projectId,
    period: { from, to },
    sampleSize: events.length,
    metrics: {
      lcp: calculateMetricStats(lcpValues, "LCP"),
      inp: calculateMetricStats(inpValues, "INP"),
      cls: calculateMetricStats(clsValues, "CLS"),
      fcp: calculateMetricStats(fcpValues, "FCP"),
      ttfb: calculateMetricStats(ttfbValues, "TTFB"),
      fid: calculateMetricStats(fidValues, "FID"),
    },
    byDevice: {
      desktop: calcDeviceMetrics("desktop"),
      mobile: calcDeviceMetrics("mobile"),
      tablet: calcDeviceMetrics("tablet"),
    },
    byRoute,
  };
}

interface LatestEventRow {
  event_id: string;
  event_timestamp: string;
  project_id: string;
  deployment_id: string | null;
  environment: string;
  url: string;
  route: string | null;
  path: string;
  device_type: string;
  connection_type: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  fid: number | null;
}

/**
 * Get the latest events for debugging/monitoring
 */
export async function getLatestEvents(
  projectId: string,
  limit: number = 10
): Promise<SpeedInsightsEvent[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data: events, error } = await supabase
    .from("speed_insights_events")
    .select("*")
    .eq("project_id", projectId)
    .order("event_timestamp", { ascending: false })
    .limit(limit);

  if (error || !events) {
    console.error("Failed to fetch latest events:", error);
    return [];
  }

  return events.map((e: LatestEventRow) => ({
    id: e.event_id,
    timestamp: new Date(e.event_timestamp).getTime(),
    projectId: e.project_id,
    deploymentId: e.deployment_id || undefined,
    environment: e.environment as "production" | "preview" | "development",
    url: e.url,
    route: e.route || undefined,
    path: e.path,
    deviceType: e.device_type as "desktop" | "mobile" | "tablet",
    connectionType: e.connection_type || undefined,
    browser: e.browser || undefined,
    os: e.os || undefined,
    country: e.country || undefined,
    metrics: {
      lcp: e.lcp || undefined,
      inp: e.inp || undefined,
      cls: e.cls || undefined,
      fcp: e.fcp || undefined,
      ttfb: e.ttfb || undefined,
      fid: e.fid || undefined,
    },
  }));
}

/**
 * Get event count for a project
 */
export async function getEventCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0;
  }

  const { count, error } = await supabase
    .from("speed_insights_events")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) {
    console.error("Failed to get event count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get all project IDs with stored events
 */
export async function getProjectIds(): Promise<string[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from("speed_insights_events")
    .select("project_id")
    .limit(100);

  if (error || !data) {
    console.error("Failed to get project IDs:", error);
    return [];
  }

  // Get unique project IDs
  const uniqueIds = [...new Set(data.map((d: { project_id: string }) => d.project_id))];
  return uniqueIds;
}

/**
 * Check if Supabase is configured and working
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  if (!isSupabaseConfigured) {
    return {
      connected: false,
      message: "Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.",
    };
  }

  try {
    const { error } = await supabase
      .from("speed_insights_events")
      .select("id")
      .limit(1);

    if (error) {
      return {
        connected: false,
        message: `Database error: ${error.message}. Make sure you've run the schema.sql in Supabase.`,
      };
    }

    return {
      connected: true,
      message: "Connected to Supabase successfully",
    };
  } catch (err) {
    return {
      connected: false,
      message: `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
