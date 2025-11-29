"use client";

import { useState } from "react";

interface AgentStep {
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    toolName: string;
    result: unknown;
  }>;
  text?: string;
}

interface AgentResponse {
  success: boolean;
  steps?: AgentStep[];
  finalAnswer?: string;
  error?: string;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

  const runAgent = async (prompt?: string) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data: AgentResponse = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to run agent",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <div className="hero">
        <div className="logo">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="48" height="48" rx="12" fill="var(--bg-tertiary)" />
            <path
              d="M24 12L36 36H12L24 12Z"
              fill="var(--accent-green)"
              fillOpacity="0.9"
            />
            <circle cx="24" cy="28" r="4" fill="var(--bg-tertiary)" />
          </svg>
        </div>
        <h1>Performance Insights Agent</h1>
        <p className="subtitle">
          AI-powered performance monitoring via Vercel Speed Insights Drains
        </p>
      </div>

      <div className="card">
        <h2>Run Performance Check</h2>
        <p className="card-description">
          Execute the agent to fetch Web Vitals, analyze performance, and send a
          daily summary notification to Slack.
        </p>

        <div className="input-group">
          <input
            type="text"
            placeholder="Custom prompt (optional)"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="prompt-input"
          />
          <button
            onClick={() => runAgent(customPrompt || undefined)}
            disabled={loading}
            className="run-button"
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Run Agent
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className={`result-card ${result.success ? "success" : "error"}`}>
          <div className="result-header">
            <span className="status-badge">
              {result.success ? "✓ Success" : "✕ Failed"}
            </span>
          </div>

          {result.error && <div className="error-message">{result.error}</div>}

          {result.steps && result.steps.length > 0 && (
            <div className="steps-section">
              <h3>Agent Steps</h3>
              <div className="steps-list">
                {result.steps.map((step, index) => (
                  <div key={index} className="step">
                    <div className="step-number">{index + 1}</div>
                    <div className="step-content">
                      {step.toolCalls?.map((tc, tcIndex) => (
                        <div key={tcIndex} className="tool-call">
                          <span className="tool-name">{tc.toolName}</span>
                          <code className="tool-args">
                            {JSON.stringify(tc.args, null, 2)}
                          </code>
                        </div>
                      ))}
                      {step.text && <p className="step-text">{step.text}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.finalAnswer && (
            <div className="final-answer">
              <h3>Final Answer</h3>
              <p>{result.finalAnswer}</p>
            </div>
          )}
        </div>
      )}

      <div className="info-section">
        <div className="info-card">
          <h3>📊 Web Vitals Monitored</h3>
          <ul>
            <li>
              <strong>LCP</strong> - Largest Contentful Paint
            </li>
            <li>
              <strong>INP</strong> - Interaction to Next Paint
            </li>
            <li>
              <strong>CLS</strong> - Cumulative Layout Shift
            </li>
            <li>
              <strong>FCP</strong> - First Contentful Paint
            </li>
            <li>
              <strong>TTFB</strong> - Time to First Byte
            </li>
          </ul>
        </div>

        <div className="info-card">
          <h3>⚡ Automated Reports</h3>
          <p>
            Configure the cron job to receive daily performance summaries in
            your Slack channel every morning at 8 AM UTC.
          </p>
        </div>

        <div className="info-card">
          <h3>🔧 Configuration</h3>
          <p>Set these environment variables:</p>
          <code className="env-list">
            SENTRY_AUTH_TOKEN
            <br />
            SENTRY_ORG
            <br />
            SENTRY_PROJECT
            <br />
            OPENAI_API_KEY
            <br />
            SLACK_BOT_TOKEN
            <br />
            SLACK_CHANNEL_ID
          </code>
        </div>
      </div>

      <style jsx>{`
        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 4rem 1.5rem;
        }

        .hero {
          text-align: center;
          margin-bottom: 3rem;
        }

        .logo {
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: center;
        }

        h1 {
          font-size: 2.5rem;
          font-weight: 700;
          background: linear-gradient(
            135deg,
            var(--text-primary) 0%,
            var(--accent-green) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .subtitle {
          color: var(--text-secondary);
          font-size: 1.125rem;
        }

        .card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .card h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .card-description {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .input-group {
          display: flex;
          gap: 1rem;
        }

        .prompt-input {
          flex: 1;
          padding: 0.875rem 1rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          color: var(--text-primary);
          font-size: 0.9375rem;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .prompt-input:focus {
          outline: none;
          border-color: var(--accent-green);
        }

        .prompt-input::placeholder {
          color: var(--text-muted);
        }

        .run-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          background: var(--accent-green);
          color: #000;
          border: none;
          border-radius: 10px;
          font-size: 0.9375rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
        }

        .run-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px var(--accent-green-glow);
        }

        .run-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .result-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .result-card.success {
          border-color: rgba(34, 197, 94, 0.3);
        }

        .result-card.error {
          border-color: rgba(239, 68, 68, 0.3);
        }

        .result-header {
          margin-bottom: 1rem;
        }

        .status-badge {
          display: inline-flex;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .success .status-badge {
          background: var(--accent-green-glow);
          color: var(--accent-green);
        }

        .error .status-badge {
          background: rgba(239, 68, 68, 0.15);
          color: var(--accent-red);
        }

        .error-message {
          color: var(--accent-red);
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 8px;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.875rem;
        }

        .steps-section {
          margin-top: 1.5rem;
        }

        .steps-section h3,
        .final-answer h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .steps-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .step {
          display: flex;
          gap: 1rem;
        }

        .step-number {
          width: 28px;
          height: 28px;
          background: var(--bg-tertiary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--accent-green);
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
          min-width: 0;
        }

        .tool-call {
          background: var(--bg-tertiary);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 0.5rem;
        }

        .tool-name {
          display: inline-block;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.8125rem;
          color: var(--accent-green);
          margin-bottom: 0.5rem;
        }

        .tool-args {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          white-space: pre-wrap;
          word-break: break-all;
        }

        .step-text {
          color: var(--text-secondary);
          font-size: 0.9375rem;
          line-height: 1.6;
        }

        .final-answer {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-subtle);
        }

        .final-answer p {
          color: var(--text-primary);
          line-height: 1.7;
        }

        .info-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .info-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .info-card h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .info-card p {
          color: var(--text-secondary);
          font-size: 0.875rem;
          line-height: 1.6;
        }

        .info-card ul {
          list-style: none;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .info-card li {
          padding: 0.25rem 0;
        }

        .info-card li strong {
          color: var(--accent-green);
          font-family: "JetBrains Mono", monospace;
          font-size: 0.8125rem;
        }

        .env-list {
          display: block;
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: var(--bg-tertiary);
          border-radius: 8px;
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.8;
        }

        @media (max-width: 640px) {
          .container {
            padding: 2rem 1rem;
          }

          h1 {
            font-size: 1.875rem;
          }

          .input-group {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
