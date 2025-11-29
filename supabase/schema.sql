-- Speed Insights Events Table
-- Run this SQL in your Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS speed_insights_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  project_id TEXT NOT NULL,
  deployment_id TEXT,
  environment TEXT DEFAULT 'production',
  
  -- Page information
  url TEXT NOT NULL,
  route TEXT,
  path TEXT NOT NULL,
  
  -- Device information
  device_type TEXT DEFAULT 'desktop',
  connection_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  
  -- Web Vitals metrics (all in milliseconds except CLS)
  lcp NUMERIC,           -- Largest Contentful Paint
  inp NUMERIC,           -- Interaction to Next Paint
  cls NUMERIC,           -- Cumulative Layout Shift
  fcp NUMERIC,           -- First Contentful Paint
  ttfb NUMERIC,          -- Time to First Byte
  fid NUMERIC,           -- First Input Delay
  
  -- Timestamps
  event_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_speed_insights_project_id ON speed_insights_events(project_id);
CREATE INDEX IF NOT EXISTS idx_speed_insights_timestamp ON speed_insights_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_speed_insights_project_timestamp ON speed_insights_events(project_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_speed_insights_device ON speed_insights_events(device_type);
CREATE INDEX IF NOT EXISTS idx_speed_insights_route ON speed_insights_events(route);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE speed_insights_events ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (adjust based on your security needs)
CREATE POLICY "Allow all operations" ON speed_insights_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to clean up old events (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_speed_insights()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM speed_insights_events
  WHERE event_timestamp < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up old data (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-speed-insights', '0 0 * * *', 'SELECT cleanup_old_speed_insights()');

