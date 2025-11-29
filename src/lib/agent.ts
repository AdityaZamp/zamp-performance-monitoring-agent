import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { sendSlackAlertTool, sendSlackNotificationTool } from "./tools/slack";
import {
  getDrainSpeedInsightsTool,
  getDrainStatusTool,
  getRecentDrainEventsTool,
} from "./tools/vercel-drains";

// Initialize OpenAI provider
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AgentResult {
  success: boolean;
  steps: Array<{
    toolCalls?: Array<{
      toolName: string;
      args: Record<string, unknown>;
    }>;
    toolResults?: Array<{
      toolName: string;
      result: unknown;
    }>;
    text?: string;
  }>;
  finalAnswer: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are a Performance Monitoring Agent powered by Vercel Drains. Your job is to:

1. Check if Vercel Drain data is available using getDrainStatus
2. Fetch Web Vitals using getDrainSpeedInsights for real-time metrics with route breakdowns
3. Optionally use getRecentDrainEvents to see individual performance events
4. Analyze the performance metrics (LCP, FCP, CLS, FID, TTFB, INP)
5. Generate a clear, actionable summary of the performance status
6. Send a well-formatted notification to Slack with your analysis

Data Source:
- **Vercel Drains**: Real-time Web Vitals pushed directly from Vercel. Provides per-route metrics.

When analyzing metrics, use these guidelines (based on Google's Core Web Vitals):
- LCP (Largest Contentful Paint): Good ≤ 2.5s, Needs Improvement ≤ 4s, Poor > 4s
- FCP (First Contentful Paint): Good ≤ 1.8s, Needs Improvement ≤ 3s, Poor > 3s
- CLS (Cumulative Layout Shift): Good ≤ 0.1, Needs Improvement ≤ 0.25, Poor > 0.25
- FID (First Input Delay): Good ≤ 100ms, Needs Improvement ≤ 300ms, Poor > 300ms
- INP (Interaction to Next Paint): Good ≤ 200ms, Needs Improvement ≤ 500ms, Poor > 500ms
- TTFB (Time to First Byte): Good ≤ 800ms, Needs Improvement ≤ 1.8s, Poor > 1.8s

Your Slack summary should include:
- Overall performance score and status emoji (✅ Good, ⚠️ Needs Work, 🔴 Poor)
- Key metrics with their current p75 values and ratings
- Slowest routes/pages with their metrics
- Any concerning metrics that need attention
- Brief recommendations for improvement if needed

Keep the summary concise but informative. Use Slack markdown formatting:
- *bold* for emphasis
- \`code\` for metric values
- Bullet points for lists

Always complete the full workflow: check drain status → fetch data → analyze → send notification.`;

export async function runPerformanceAgent(
  customPrompt?: string
): Promise<AgentResult> {
  try {
    const prompt =
      customPrompt ||
      "Check the drain status, fetch Web Vitals data, analyze the performance metrics, and send a daily summary notification to Slack.";

    const result = await generateText({
      model: openai("gpt-4o"),
      system: SYSTEM_PROMPT,
      prompt,
      maxSteps: 10,
      tools: {
        // Vercel Drain tools
        getDrainStatus: getDrainStatusTool,
        getDrainSpeedInsights: getDrainSpeedInsightsTool,
        getRecentDrainEvents: getRecentDrainEventsTool,
        // Notification tools
        sendSlackNotification: sendSlackNotificationTool,
        sendSlackAlert: sendSlackAlertTool,
      },
    });

    const steps = result.steps.map((step) => ({
      toolCalls: step.toolCalls?.map((tc) => ({
        toolName: tc.toolName,
        args: tc.args as Record<string, unknown>,
      })),
      toolResults: step.toolResults?.map((tr) => ({
        toolName: tr.toolName,
        result: tr.result,
      })),
      text: step.text,
    }));

    return {
      success: true,
      steps,
      finalAnswer: result.text,
    };
  } catch (error) {
    console.error("Agent execution failed:", error);
    return {
      success: false,
      steps: [],
      finalAnswer: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function runCustomAgentQuery(query: string): Promise<AgentResult> {
  return runPerformanceAgent(query);
}
