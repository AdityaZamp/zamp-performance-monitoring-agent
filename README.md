# Speed Insights Agent

An AI-powered agent that monitors your Vercel project's performance using Web Vitals and sends daily summaries to Slack.

Built with the [Vercel AI SDK](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk).

## Features

- 📊 **Automated Web Vitals Monitoring** - Collects LCP, INP, CLS, FCP, TTFB metrics
- 🔄 **Vercel Drains Integration** - Receives real-time performance data via [Vercel Drains](https://vercel.com/docs/drains)
- 💾 **Supabase Storage** - Persists metrics data across serverless invocations
- 🤖 **AI-Powered Analysis** - Uses GPT-4 to analyze metrics and generate actionable insights
- 💬 **Slack Notifications** - Sends beautifully formatted daily reports
- ⏰ **Scheduled Reports** - Runs automatically via Vercel Cron
- 🛤️ **Route Analysis** - Identifies slowest pages/routes

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            COMPLETE SYSTEM FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

  1️⃣ DATA COLLECTION (Your Monitored Site)
  ─────────────────────────────────────────

  User visits your site → @vercel/speed-insights collects Web Vitals
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         VERCEL PLATFORM                                  │
  │  ┌─────────────────┐                                                    │
  │  │ Speed Insights  │  Collects: LCP, INP, CLS, FCP, TTFB, FID          │
  │  │    Service      │  Per metric event with device/route info           │
  │  └────────┬────────┘                                                    │
  │           │                                                              │
  │           ▼                                                              │
  │  ┌─────────────────┐                                                    │
  │  │  Vercel Drains  │  Forwards each metric as JSON event                │
  │  │  (Speed Insights)│  Format: {metricType: "LCP", value: 2500, ...}    │
  │  └────────┬────────┘                                                    │
  └───────────│──────────────────────────────────────────────────────────────┘
              │
              │ HTTPS POST (JSON/NDJSON)
              ▼

  2️⃣ DATA INGESTION (This Agent App)
  ────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      SPEED INSIGHTS AGENT                                │
  │                                                                          │
  │  ┌─────────────────────────────────────────────────────────────────┐    │
  │  │              /api/drain/speed-insights                           │    │
  │  │  ─────────────────────────────────────────────────────────────   │    │
  │  │  • Receives Vercel Drain webhooks                                │    │
  │  │  • Parses metricType + value from each event                     │    │
  │  │  • Normalizes data (timestamps, routes, etc.)                    │    │
  │  │  • Stores to Supabase                                            │    │
  │  └──────────────────────────┬──────────────────────────────────────┘    │
  │                             │                                            │
  └─────────────────────────────│────────────────────────────────────────────┘
                                │
                                ▼

  3️⃣ DATA STORAGE (Supabase)
  ───────────────────────────

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                          SUPABASE                                        │
  │  ┌─────────────────────────────────────────────────────────────────┐    │
  │  │              speed_insights_events table                         │    │
  │  │  ─────────────────────────────────────────────────────────────   │    │
  │  │  id | project_id | device_type | path | lcp | inp | cls | ...   │    │
  │  │  ─────────────────────────────────────────────────────────────   │    │
  │  │  Persistent storage for all Web Vitals events                    │    │
  │  │  Indexed by project_id, timestamp for fast queries               │    │
  │  └─────────────────────────────────────────────────────────────────┘    │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
                                │
                                │ Query
                                ▼

  4️⃣ AI ANALYSIS (Triggered by Cron or API)
  ──────────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         AI AGENT FLOW                                    │
  │                                                                          │
  │   Trigger: Cron (8 AM UTC) or POST /api/agent                           │
  │                    │                                                     │
  │                    ▼                                                     │
  │   ┌────────────────────────────────────────────────────────────────┐    │
  │   │                    GPT-4o Agent                                 │    │
  │   │  ──────────────────────────────────────────────────────────    │    │
  │   │  System Prompt: "You are a Performance Monitoring Agent..."    │    │
  │   │  User Prompt: "Check drain status and analyze Web Vitals"      │    │
  │   └────────────────────────┬───────────────────────────────────────┘    │
  │                            │                                             │
  │                            │ Multi-step reasoning                        │
  │                            ▼                                             │
  │   ┌────────────────────────────────────────────────────────────────┐    │
  │   │                    TOOL CALLS                                   │    │
  │   │  ──────────────────────────────────────────────────────────    │    │
  │   │                                                                 │    │
  │   │  Step 1: getDrainStatus()                                       │    │
  │   │          → Check if Supabase connected, count events            │    │
  │   │                                                                 │    │
  │   │  Step 2: getDrainSpeedInsights({period: "24h"})                 │    │
  │   │          → Query Supabase for metrics                           │    │
  │   │          → Calculate p50, p75, p90, p99 percentiles             │    │
  │   │          → Identify slowest routes                              │    │
  │   │                                                                 │    │
  │   │  Step 3: sendSlackNotification({message: "..."})                │    │
  │   │          → Format analysis as Slack message                     │    │
  │   │          → Send to configured channel                           │    │
  │   │                                                                 │    │
  │   └────────────────────────────────────────────────────────────────┘    │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼

  5️⃣ NOTIFICATION (Slack)
  ────────────────────────

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                           SLACK                                          │
  │  ┌─────────────────────────────────────────────────────────────────┐    │
  │  │  📊 Daily Performance Report                                     │    │
  │  │  ─────────────────────────────────────────────────────────────   │    │
  │  │  ✅ Overall Score: 85% (Good)                                    │    │
  │  │                                                                  │    │
  │  │  *Core Web Vitals:*                                              │    │
  │  │  • LCP: `2.1s` ✅ Good                                           │    │
  │  │  • INP: `180ms` ✅ Good                                          │    │
  │  │  • CLS: `0.05` ✅ Good                                           │    │
  │  │                                                                  │    │
  │  │  *Slowest Routes:*                                               │    │
  │  │  • /dashboard: LCP 3.2s ⚠️                                       │    │
  │  │  • /settings: LCP 2.8s ✅                                        │    │
  │  └─────────────────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
vercel-agent/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/
│   │   │   │   └── route.ts          # POST /api/agent - Run AI agent
│   │   │   ├── cron/
│   │   │   │   └── speed-insights/
│   │   │   │       └── route.ts      # GET - Cron trigger for daily reports
│   │   │   └── drain/
│   │   │       ├── speed-insights/
│   │   │       │   └── route.ts      # POST - Receives Vercel Drain data
│   │   │       └── debug/
│   │   │           └── route.ts      # GET - Debug endpoint
│   │   ├── page.tsx                  # Dashboard UI
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── lib/
│       ├── agent.ts                  # AI Agent configuration
│       ├── supabase.ts               # Supabase client
│       ├── drain/
│       │   └── speed-insights-store.ts  # Data storage & aggregation
│       └── tools/
│           ├── vercel-drains.ts      # Drain data tools for AI
│           └── slack.ts              # Slack notification tools
├── supabase/
│   └── schema.sql                    # Database schema
├── vercel.json                       # Cron configuration
└── package.json
```

---

## How Each Component Works

### 1. Drain Endpoint (`/api/drain/speed-insights`)

Receives webhook events from Vercel Drains. Each event contains ONE metric:

```json
{
  "metricType": "LCP",
  "value": 2500,
  "path": "/dashboard",
  "deviceType": "desktop",
  "projectId": "prj_xxx",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

The endpoint:

1. Parses the `metricType` and `value` fields
2. Normalizes timestamps, routes, etc.
3. Stores the event in Supabase

### 2. Data Store (`speed-insights-store.ts`)

Handles all database operations:

- **`storeEvents()`** - Insert new events from drain
- **`getAggregatedMetrics()`** - Calculate percentiles (p50, p75, p90, p99)
- **`getLatestEvents()`** - Fetch recent raw events
- **`getProjectIds()`** - List projects with data
- **`checkDatabaseConnection()`** - Verify Supabase connectivity

### 3. AI Agent (`agent.ts`)

Configures the GPT-4o agent with:

- **System Prompt** - Defines agent behavior, metric thresholds, output format
- **Tools** - Functions the agent can call:
  - `getDrainStatus` - Check if data is flowing
  - `getDrainSpeedInsights` - Get aggregated metrics
  - `getRecentDrainEvents` - Debug individual events
  - `sendSlackNotification` - Send formatted reports
  - `sendSlackAlert` - Send urgent alerts

### 4. Cron Job (`/api/cron/speed-insights`)

Triggered daily at 8 AM UTC (configurable in `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/speed-insights",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Vercel account (Pro or Enterprise for Drains)
- Supabase account (free tier works)
- OpenAI API key
- Slack workspace with a bot

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase/schema.sql`
3. Copy credentials from Project Settings → API

### 3. Configure Environment Variables

Create `.env.local`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C01234567

# Vercel (optional, for project identification)
VERCEL_PROJECT_ID=prj_xxx

# Cron Security
CRON_SECRET=random_secret_string
```

### 4. Deploy to Vercel

```bash
npx vercel deploy --prod
```

### 5. Configure Vercel Drain

1. Go to [Vercel Dashboard](https://vercel.com) → Team Settings → Drains
2. Click **Add Drain**
3. Configure:
   - **Data Type:** Speed Insights
   - **Projects:** Select your monitored project(s)
   - **Endpoint URL:** `https://your-agent.vercel.app/api/drain/speed-insights`
   - **Format:** JSON

### 6. Generate Traffic & Test

1. Visit your monitored site to generate Web Vitals data
2. Check the debug endpoint:

```bash
curl https://your-agent.vercel.app/api/drain/debug
```

3. Run the agent:

```bash
curl -X POST https://your-agent.vercel.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Check drain status and show me Web Vitals"}'
```

---

## API Reference

### POST /api/agent

Run the AI agent with a custom prompt.

```bash
curl -X POST https://your-app.vercel.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What are my Core Web Vitals for the last 7 days?"}'
```

**Response:**

```json
{
  "success": true,
  "steps": [...],
  "finalAnswer": "Your LCP is 2.1s (Good)..."
}
```

### GET /api/cron/speed-insights

Triggered by Vercel Cron. Requires `CRON_SECRET` header for authentication.

### POST /api/drain/speed-insights

Receives Vercel Drain webhooks. Returns 200 to acknowledge receipt.

### GET /api/drain/debug

Returns current drain status, event counts, and sample data.

---

## Web Vitals Thresholds

Based on [Google's Core Web Vitals](https://web.dev/vitals/):

| Metric                              | Good    | Needs Improvement | Poor    |
| ----------------------------------- | ------- | ----------------- | ------- |
| **LCP** (Largest Contentful Paint)  | ≤ 2.5s  | ≤ 4s              | > 4s    |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms           | > 500ms |
| **CLS** (Cumulative Layout Shift)   | ≤ 0.1   | ≤ 0.25            | > 0.25  |
| **FCP** (First Contentful Paint)    | ≤ 1.8s  | ≤ 3s              | > 3s    |
| **TTFB** (Time to First Byte)       | ≤ 800ms | ≤ 1.8s            | > 1.8s  |
| **FID** (First Input Delay)         | ≤ 100ms | ≤ 300ms           | > 300ms |

---

## Troubleshooting

### No drain data received

1. Check drain is configured correctly in Vercel Dashboard
2. Verify endpoint URL is correct
3. Ensure your monitored site has traffic
4. Check logs: `npx vercel logs your-app.vercel.app --follow`

### Metrics showing as NULL

Events stored before the fix may have NULL metrics. Either:

- Wait for new traffic to generate fresh events
- Clear old data: `DELETE FROM speed_insights_events;`

### Database connection failed

1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
2. Run `supabase/schema.sql` in SQL Editor
3. Check RLS policies allow access
