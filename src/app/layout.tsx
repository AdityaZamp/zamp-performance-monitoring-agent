import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Performance Insights Agent",
  description:
    "AI-powered performance monitoring via Vercel Speed Insights Drains with daily summary notification to Slack",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
