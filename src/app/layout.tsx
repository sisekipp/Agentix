import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentix - AI Workflow Automation",
  description: "Build, test, and deploy AI agent workflows with a visual interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
